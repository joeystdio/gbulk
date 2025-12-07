import { existsSync } from 'node:fs';
import { join } from 'node:path';
import ora from 'ora';
import chalk from 'chalk';
import type { RepoStatus } from '../types.js';
import { runGit } from '../utils/git.js';
import { getRepoName } from '../utils/repos.js';
import { printResults } from '../utils/output.js';

/**
 * Updates submodules in all repositories that contain them
 * Runs checkout main and pull with autostash/rebase for each submodule
 */
export async function updateSubmoduleRepos(repos: string[]): Promise<void> {
  // Filter repositories that have .gitmodules file
  const reposWithSubmodules = repos.filter((repo) => {
    const gitmodulesPath = join(repo, '.gitmodules');
    return existsSync(gitmodulesPath);
  });

  // If no repositories with submodules found
  if (reposWithSubmodules.length === 0) {
    console.log();
    console.log(chalk.yellow('No repositories with submodules found!'));
    return;
  }

  console.log();
  console.log(
    chalk.cyan.bold('→') +
      ` Updating submodules in ${reposWithSubmodules.length} repositories...`
  );
  console.log();

  // Process all repositories in parallel
  const results = await Promise.all(
    reposWithSubmodules.map((repo) => updateSubmodules(repo))
  );

  // Print results summary
  printResults(results);
}

/**
 * Updates submodules for a single repository
 */
async function updateSubmodules(repoPath: string): Promise<RepoStatus> {
  const repoName = getRepoName(repoPath);
  const spinner = ora({
    text: `${repoName}: Updating submodules`,
    color: 'cyan',
  }).start();

  try {
    // Step 1: Checkout main branch in all submodules
    spinner.text = `${repoName}: Checking out main in submodules`;
    const checkoutResult = await runGit(
      ['submodule', 'foreach', 'git', 'checkout', 'main'],
      repoPath
    );

    if (checkoutResult.exitCode !== 0) {
      spinner.fail(`${repoName}: Failed to checkout main`);
      return {
        path: repoPath,
        success: false,
        message: checkoutResult.stderr || 'Failed to checkout main in submodules',
      };
    }

    // Step 2: Pull with autostash and rebase in all submodules
    spinner.text = `${repoName}: Pulling submodules`;
    const pullResult = await runGit(
      ['submodule', 'foreach', 'git', 'pull', '--autostash', '--rebase', '--no-commit'],
      repoPath
    );

    if (pullResult.exitCode !== 0) {
      spinner.fail(`${repoName}: Failed to pull submodules`);
      return {
        path: repoPath,
        success: false,
        message: pullResult.stderr || 'Failed to pull submodules',
      };
    }

    spinner.succeed(`${repoName}: Submodules updated`);
    return {
      path: repoPath,
      success: true,
      message: 'Submodules updated successfully',
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    spinner.fail(`${repoName}: ${errorMessage}`);
    return {
      path: repoPath,
      success: false,
      message: errorMessage,
    };
  }
}
