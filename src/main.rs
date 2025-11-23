use anyhow::{Context, Result};
use clap::{Parser, Subcommand};
use colored::Colorize;
use indicatif::{MultiProgress, ProgressBar, ProgressStyle};
use std::io::{self, Write};
use std::path::{Path, PathBuf};
use std::process::Command;
use std::sync::{Arc, Mutex};
use tokio::task::JoinSet;
use walkdir::WalkDir;

#[derive(Parser)]
#[command(name = "gbulk")]
#[command(about = "Bulk git operations across multiple repositories", long_about = None)]
struct Cli {
    #[arg(short, long, default_value = ".")]
    directory: PathBuf,

    #[command(subcommand)]
    command: Commands,
}

#[derive(Subcommand)]
enum Commands {
    #[command(about = "Pull all repositories (fetch + rebase with auto-stash)")]
    PullAll {
        #[arg(short, long, help = "Auto-confirm all prompts")]
        yes: bool,

        #[arg(long, help = "Show what would be done without making changes")]
        dry_run: bool,
    },

    #[command(about = "Run custom git command in all repositories")]
    Exec {
        #[arg(trailing_var_arg = true, allow_hyphen_values = true)]
        args: Vec<String>,
    },

    #[command(about = "List all git repositories found")]
    List,

    #[command(about = "List repositories with submodules")]
    SubmoduleList,

    #[command(about = "Update submodules in all repositories")]
    SubmoduleUpdate,
}

struct RepoStatus {
    path: PathBuf,
    success: bool,
    message: String,
}

#[tokio::main]
async fn main() -> Result<()> {
    let cli = Cli::parse();

    let repos = find_git_repos(&cli.directory)?;

    if repos.is_empty() {
        println!("{}", "No git repositories found!".yellow());
        return Ok(());
    }

    match cli.command {
        Commands::List => {
            list_repos(&repos);
        }
        Commands::PullAll { yes, dry_run } => {
            pull_all_repos(repos, yes, dry_run).await?;
        }
        Commands::Exec { args } => {
            exec_all_repos(repos, args).await?;
        }
        Commands::SubmoduleList => {
            list_submodule_repos(&repos);
        }
        Commands::SubmoduleUpdate => {
            update_submodule_repos(repos).await?;
        }
    }

    Ok(())
}

fn find_git_repos(base_dir: &Path) -> Result<Vec<PathBuf>> {
    let mut repos = Vec::new();

    for entry in WalkDir::new(base_dir)
        .min_depth(1)
        .into_iter()
        .filter_entry(|e| {
            let name = e.file_name().to_string_lossy();
            !name.starts_with('.') || name == ".git"
        })
    {
        let entry = entry?;
        if entry.file_type().is_dir() && entry.file_name() == ".git" {
            if let Some(parent) = entry.path().parent() {
                repos.push(parent.to_path_buf());
            }
        }
    }

    repos.sort();
    Ok(repos)
}

fn list_repos(repos: &[PathBuf]) {
    println!(
        "\n{} Found {} git repositories:\n",
        "✓".green().bold(),
        repos.len()
    );
    for repo in repos {
        println!("  {}", repo.display());
    }
    println!();
}

fn list_submodule_repos(repos: &[PathBuf]) {
    println!("\n{} Repositories with submodules:\n", "✓".green().bold());
    let mut found = false;
    for repo in repos {
        if repo.join(".gitmodules").exists() {
            found = true;
            let repo_name = repo.file_name().unwrap_or_default().to_string_lossy();
            println!("  {}", repo_name.green());

            // Show submodule info
            let output = Command::new("git")
                .args(["submodule"])
                .current_dir(repo)
                .output();

            if let Ok(output) = output {
                let stdout = String::from_utf8_lossy(&output.stdout);
                for line in stdout.lines() {
                    println!("    {}", line.dimmed());
                }
            }
        }
    }

    if !found {
        println!("  {}", "No repositories with submodules found".yellow());
    }
    println!();
}

async fn update_submodule_repos(repos: Vec<PathBuf>) -> Result<()> {
    let multi = Arc::new(MultiProgress::new());
    let mut tasks = JoinSet::new();

    let submodule_repos: Vec<PathBuf> = repos
        .into_iter()
        .filter(|repo| repo.join(".gitmodules").exists())
        .collect();

    if submodule_repos.is_empty() {
        println!("\n{}", "No repositories with submodules found!".yellow());
        return Ok(());
    }

    println!(
        "\n{} Updating submodules in {} repositories...\n",
        "→".cyan().bold(),
        submodule_repos.len()
    );

    for repo in submodule_repos {
        let multi_clone = multi.clone();

        tasks.spawn(async move {
            let pb = multi_clone.add(ProgressBar::new_spinner());
            pb.set_style(
                ProgressStyle::default_spinner()
                    .template("{spinner:.cyan} [{elapsed}] {msg}")
                    .unwrap(),
            );

            let repo_name = repo
                .file_name()
                .unwrap_or_default()
                .to_string_lossy()
                .to_string();

            pb.set_message(format!("{}: Updating submodules...", repo_name));

            let result = update_submodules(&repo, &repo_name).await;

            pb.finish_and_clear();

            result
        });
    }

    let mut results = Vec::new();
    while let Some(result) = tasks.join_next().await {
        results.push(result?);
    }

    print_results(&results);

    Ok(())
}

async fn update_submodules(repo: &Path, _repo_name: &str) -> RepoStatus {
    let run_git = |args: &[&str]| -> Result<String> {
        let output = Command::new("git")
            .args(args)
            .current_dir(repo)
            .output()
            .context("Failed to execute git command")?;

        if output.status.success() {
            Ok(String::from_utf8_lossy(&output.stdout).to_string())
        } else {
            anyhow::bail!("{}", String::from_utf8_lossy(&output.stderr))
        }
    };

    // Checkout main in all submodules
    if let Err(e) = run_git(&["submodule", "foreach", "git", "checkout", "main"]) {
        return RepoStatus {
            path: repo.to_path_buf(),
            success: false,
            message: format!("Failed to checkout main in submodules: {}", e),
        };
    }

    // Pull with autostash and rebase in all submodules
    if let Err(e) = run_git(&[
        "submodule",
        "foreach",
        "git",
        "pull",
        "--autostash",
        "--rebase",
        "--no-commit",
    ]) {
        return RepoStatus {
            path: repo.to_path_buf(),
            success: false,
            message: format!("Failed to pull submodules: {}", e),
        };
    }

    RepoStatus {
        path: repo.to_path_buf(),
        success: true,
        message: "Submodules updated successfully".to_string(),
    }
}

async fn pull_all_repos(repos: Vec<PathBuf>, yes: bool, dry_run: bool) -> Result<()> {
    let multi = Arc::new(MultiProgress::new());
    let input_lock = Arc::new(Mutex::new(()));
    let mut tasks = JoinSet::new();

    if dry_run {
        println!(
            "\n{} DRY RUN MODE - No changes will be made\n",
            "⚠".yellow().bold()
        );
    }

    println!(
        "\n{} Pulling {} repositories...\n",
        "→".cyan().bold(),
        repos.len()
    );

    for repo in repos {
        let multi_clone = multi.clone();
        let input_lock_clone = input_lock.clone();

        tasks.spawn(async move {
            let pb = multi_clone.add(ProgressBar::new_spinner());
            pb.set_style(
                ProgressStyle::default_spinner()
                    .template("{spinner:.cyan} [{elapsed}] {msg}")
                    .unwrap(),
            );

            let repo_name = repo
                .file_name()
                .unwrap_or_default()
                .to_string_lossy()
                .to_string();

            pb.set_message(format!("{}: Starting...", repo_name));

            let result = pull_repo(&repo, &pb, &multi_clone, &input_lock_clone, &repo_name, yes, dry_run).await;

            pb.finish_and_clear();

            result
        });
    }

    let mut results = Vec::new();
    while let Some(result) = tasks.join_next().await {
        results.push(result?);
    }

    print_results(&results);

    Ok(())
}

async fn pull_repo(
    repo: &Path,
    pb: &ProgressBar,
    multi: &MultiProgress,
    input_lock: &Arc<Mutex<()>>,
    repo_name: &str,
    yes: bool,
    dry_run: bool,
) -> RepoStatus {
    let run_git = |args: &[&str]| -> Result<String> {
        let output = Command::new("git")
            .args(args)
            .current_dir(repo)
            .output()
            .context("Failed to execute git command")?;

        if output.status.success() {
            Ok(String::from_utf8_lossy(&output.stdout).to_string())
        } else {
            anyhow::bail!("{}", String::from_utf8_lossy(&output.stderr))
        }
    };

    pb.set_message(format!("{}: Getting current branch...", repo_name));
    let current_branch = match run_git(&["rev-parse", "--abbrev-ref", "HEAD"]) {
        Ok(branch) => branch.trim().to_string(),
        Err(e) => {
            return RepoStatus {
                path: repo.to_path_buf(),
                success: false,
                message: format!("Failed to get branch: {}", e),
            };
        }
    };

    pb.set_message(format!("{}: Fetching with prune...", repo_name));
    if !dry_run {
        if let Err(e) = run_git(&["fetch", "--all", "--prune"]) {
            return RepoStatus {
                path: repo.to_path_buf(),
                success: false,
                message: format!("Failed to fetch: {}", e),
            };
        }
    }

    // Find and handle gone branches
    pb.set_message(format!("{}: Checking for gone branches...", repo_name));
    let gone_branches = find_gone_branches(repo, &current_branch, &run_git);

    for branch in &gone_branches {
        if branch == &current_branch {
            // Switch to fallback branch before deleting current
            let fallback = find_fallback_branch(repo, &run_git);
            if let Some(fallback_branch) = fallback {
                pb.set_message(format!(
                    "{}: Switching to {} before deletion",
                    repo_name, fallback_branch
                ));
                if !dry_run {
                    if let Err(e) = run_git(&["checkout", &fallback_branch]) {
                        return RepoStatus {
                            path: repo.to_path_buf(),
                            success: false,
                            message: format!("Failed to switch branch: {}", e),
                        };
                    }
                }
            } else {
                continue; // Skip deletion if no fallback
            }
        }

        if dry_run {
            pb.set_message(format!(
                "{}: [DRY RUN] Would delete branch {}",
                repo_name, branch
            ));
        } else if yes
            || prompt_user(
                &format!(
                    "Delete branch '{}' in {} (upstream gone)?",
                    branch, repo_name
                ),
                multi,
                input_lock,
            )
        {
            pb.set_message(format!("{}: Deleting branch {}...", repo_name, branch));
            let _ = run_git(&["branch", "-D", branch]);
        }
    }

    // Get all local branches
    pb.set_message(format!("{}: Getting branches...", repo_name));
    let branches = match run_git(&["branch", "-l"]) {
        Ok(output) => output
            .lines()
            .map(|b| b.trim_start_matches("* ").trim().to_string())
            .collect::<Vec<_>>(),
        Err(e) => {
            return RepoStatus {
                path: repo.to_path_buf(),
                success: false,
                message: format!("Failed to get branches: {}", e),
            };
        }
    };

    // Update all branches
    for branch in &branches {
        pb.set_message(format!("{}: Updating origin/{}...", repo_name, branch));
        if !dry_run {
            if let Err(e) = run_git(&[
                "rebase",
                "--autostash",
                &format!("origin/{}", branch),
                branch,
            ]) {
                // Don't fail the whole operation if one branch fails
                pb.set_message(format!(
                    "{}: Warning: Failed to update {}: {}",
                    repo_name, branch, e
                ));
            }
        }
    }

    // Switch back to original branch
    pb.set_message(format!(
        "{}: Switching back to {}...",
        repo_name, current_branch
    ));
    if !dry_run {
        if let Err(e) = run_git(&["checkout", &current_branch]) {
            return RepoStatus {
                path: repo.to_path_buf(),
                success: false,
                message: format!("Failed to checkout {}: {}", current_branch, e),
            };
        }
    }

    // Update submodules if they exist
    if repo.join(".gitmodules").exists() {
        pb.set_message(format!("{}: Updating submodules...", repo_name));
        if !dry_run {
            let _ = run_git(&["submodule", "update"]);
            let _ = run_git(&["submodule", "foreach", "git", "remote", "prune", "origin"]);
        }
    }

    RepoStatus {
        path: repo.to_path_buf(),
        success: true,
        message: format!(
            "Successfully updated all branches (current: {})",
            current_branch
        ),
    }
}

fn find_gone_branches(
    _repo: &Path,
    _current_branch: &str,
    run_git: &dyn Fn(&[&str]) -> Result<String>,
) -> Vec<String> {
    let mut gone_branches = Vec::new();

    // Method 1: parse 'git branch -vv'
    if let Ok(output) = run_git(&["branch", "-vv"]) {
        for line in output.lines() {
            if line.contains("[gone]") {
                let trimmed = line.trim().trim_start_matches("* ");
                if let Some(branch_name) = trimmed.split_whitespace().next() {
                    if !gone_branches.contains(&branch_name.to_string()) {
                        gone_branches.push(branch_name.to_string());
                    }
                }
            }
        }
    }

    // Method 2: use for-each-ref
    if let Ok(output) = run_git(&[
        "for-each-ref",
        "--format=%(refname:short)|%(upstream:track)",
        "refs/heads",
    ]) {
        for line in output.lines() {
            let parts: Vec<&str> = line.split('|').collect();
            if parts.len() >= 2 && parts[1].contains("gone") {
                let branch_name = parts[0].to_string();
                if !gone_branches.contains(&branch_name) {
                    gone_branches.push(branch_name);
                }
            }
        }
    }

    gone_branches
}

fn find_fallback_branch(
    _repo: &Path,
    run_git: &dyn Fn(&[&str]) -> Result<String>,
) -> Option<String> {
    if let Ok(branches) = run_git(&["for-each-ref", "--format=%(refname:short)", "refs/heads"]) {
        for fallback in &["develop", "main", "master"] {
            if branches.lines().any(|b| b == *fallback) {
                return Some(fallback.to_string());
            }
        }
    }
    None
}

fn prompt_user(message: &str, multi: &MultiProgress, input_lock: &Arc<Mutex<()>>) -> bool {
    let _lock = input_lock.lock().unwrap();
    
    multi.suspend(|| {
        print!("{} [y/N]: ", message);
        io::stdout().flush().unwrap();

        let mut input = String::new();
        io::stdin().read_line(&mut input).unwrap();

        matches!(input.trim().to_lowercase().as_str(), "y" | "yes")
    })
}

async fn exec_all_repos(repos: Vec<PathBuf>, args: Vec<String>) -> Result<()> {
    let multi = Arc::new(MultiProgress::new());
    let mut tasks = JoinSet::new();

    println!(
        "\n{} Running 'git {}' in {} repositories...\n",
        "→".cyan().bold(),
        args.join(" "),
        repos.len()
    );

    for repo in repos {
        let multi_clone = multi.clone();
        let args_clone = args.clone();

        tasks.spawn(async move {
            let pb = multi_clone.add(ProgressBar::new_spinner());
            pb.set_style(
                ProgressStyle::default_spinner()
                    .template("{spinner:.cyan} [{elapsed}] {msg}")
                    .unwrap(),
            );

            let repo_name = repo
                .file_name()
                .unwrap_or_default()
                .to_string_lossy()
                .to_string();

            pb.set_message(format!("{}: Running...", repo_name));

            let output = Command::new("git")
                .args(&args_clone)
                .current_dir(&repo)
                .output();

            pb.finish_and_clear();

            match output {
                Ok(output) => {
                    let stdout = String::from_utf8_lossy(&output.stdout).to_string();
                    let stderr = String::from_utf8_lossy(&output.stderr).to_string();
                    let message = if output.status.success() {
                        if !stdout.trim().is_empty() {
                            stdout.trim().to_string()
                        } else {
                            "Success".to_string()
                        }
                    } else {
                        stderr.trim().to_string()
                    };

                    RepoStatus {
                        path: repo,
                        success: output.status.success(),
                        message,
                    }
                }
                Err(e) => RepoStatus {
                    path: repo,
                    success: false,
                    message: format!("Failed to execute: {}", e),
                },
            }
        });
    }

    let mut results = Vec::new();
    while let Some(result) = tasks.join_next().await {
        results.push(result?);
    }

    print_results(&results);

    Ok(())
}

fn print_results(results: &[RepoStatus]) {
    let success_count = results.iter().filter(|r| r.success).count();
    let fail_count = results.len() - success_count;

    println!("\n{}", "Results:".bold());
    println!("{}", "─".repeat(60));

    for result in results {
        let repo_name = result
            .path
            .file_name()
            .unwrap_or_default()
            .to_string_lossy();

        if result.success {
            println!(
                "{} {} - {}",
                "✓".green().bold(),
                repo_name.green(),
                result.message.dimmed()
            );
        } else {
            println!(
                "{} {} - {}",
                "✗".red().bold(),
                repo_name.red(),
                result.message
            );
        }
    }

    println!("{}", "─".repeat(60));
    println!(
        "\n{} {} succeeded, {} failed\n",
        "Summary:".bold(),
        success_count.to_string().green(),
        if fail_count > 0 {
            fail_count.to_string().red()
        } else {
            fail_count.to_string().dimmed()
        }
    );
}
