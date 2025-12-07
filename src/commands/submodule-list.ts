import { existsSync } from 'node:fs';
import { join } from 'node:path';
import chalk from 'chalk';
import { runGit } from '../utils/git.js';
import { getRepoName } from '../utils/repos.js';

/**
 * Lists all repositories that contain submodules and displays their submodule information
 */
export async function listSubmoduleRepos(repos: string[]): Promise<void> {
  // Filter repositories that have .gitmodules file
  const reposWithSubmodules = repos.filter((repo) => {
    const gitmodulesPath = join(repo, '.gitmodules');
    return existsSync(gitmodulesPath);
  });

  console.log();
  console.log(chalk.green.bold('✓') + ' Repositories with submodules:');
  console.log();

  // If no repositories with submodules found
  if (reposWithSubmodules.length === 0) {
    console.log('  ' + chalk.yellow('No repositories with submodules found'));
    console.log();
    return;
  }

  // Display each repository and its submodules
  for (const repo of reposWithSubmodules) {
    const repoName = getRepoName(repo);
    console.log('  ' + chalk.green(repoName));

    // Run git submodule command to list submodules
    const result = await runGit(['submodule'], repo);

    if (result.exitCode === 0 && result.stdout) {
      // Print each line of submodule info dimmed
      const lines = result.stdout.trim().split('\n');
      for (const line of lines) {
        if (line.trim()) {
          console.log(chalk.dim(`    ${line}`));
        }
      }
    } else if (result.stderr) {
      console.log(chalk.dim(`    Error: ${result.stderr}`));
    }
  }

  console.log();
}
