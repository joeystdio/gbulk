import chalk from 'chalk';
import ora, { type Ora } from 'ora';
import { existsSync } from 'fs';
import path from 'path';
import type { RepoStatus, PullOptions } from '../types.js';
import { runGit, runGitOrThrow } from '../utils/git.js';
import { getRepoName } from '../utils/repos.js';
import { promptUser } from '../utils/prompt.js';
import { printResults } from '../utils/output.js';

const FALLBACK_BRANCHES = ['develop', 'main', 'master'];

interface BranchInfo {
  name: string;
  isGone: boolean;
}

async function findGoneBranches(repoPath: string): Promise<string[]> {
  const goneBranches = new Set<string>();

  // Method 1: Parse `git branch -vv` for "[gone]" markers
  try {
    const branchVvResult = await runGit(['branch', '-vv'], repoPath);
    if (branchVvResult.exitCode === 0) {
      const lines = branchVvResult.stdout.split('\n');
      for (const line of lines) {
        if (line.includes('[gone]')) {
          // Extract branch name (remove leading spaces and asterisk)
          const branchName = line.trim().replace(/^\*?\s*/, '').split(/\s+/)[0];
          if (branchName) {
            goneBranches.add(branchName);
          }
        }
      }
    }
  } catch (error) {
    // Ignore errors from method 1, continue to method 2
  }

  // Method 2: Use `git for-each-ref` with upstream tracking
  try {
    const refResult = await runGit(
      ['for-each-ref', '--format=%(refname:short)|%(upstream:track)', 'refs/heads'],
      repoPath
    );
    if (refResult.exitCode === 0) {
      const lines = refResult.stdout.split('\n');
      for (const line of lines) {
        if (line.includes('gone')) {
          const [branchName] = line.split('|');
          if (branchName) {
            goneBranches.add(branchName);
          }
        }
      }
    }
  } catch (error) {
    // Ignore errors from method 2
  }

  return Array.from(goneBranches);
}

async function findFallbackBranch(repoPath: string): Promise<string | null> {
  // Get all local branches
  const branchesResult = await runGit(['branch', '-l'], repoPath);
  if (branchesResult.exitCode !== 0) {
    return null;
  }

  const branches = branchesResult.stdout
    .split('\n')
    .map((line) => line.trim().replace(/^\*?\s*/, ''))
    .filter((branch) => branch.length > 0);

  // Find first available fallback branch
  for (const fallback of FALLBACK_BRANCHES) {
    if (branches.includes(fallback)) {
      return fallback;
    }
  }

  return null;
}

async function pullRepo(
  repoPath: string,
  options: PullOptions,
  spinner: Ora
): Promise<RepoStatus> {
  const repoName = getRepoName(repoPath);

  try {
    // Step 1: Get current branch
    spinner.text = `${repoName} - Getting current branch`;
    const currentBranch = await runGitOrThrow(['rev-parse', '--abbrev-ref', 'HEAD'], repoPath);
    const originalBranch = currentBranch.trim();

    // Step 2: Fetch with prune
    if (!options.dryRun) {
      spinner.text = `${repoName} - Fetching from remote`;
      await runGitOrThrow(['fetch', '--all', '--prune'], repoPath);
    } else {
      spinner.text = `${repoName} - [DRY-RUN] Would fetch from remote`;
    }

    // Step 3: Find gone branches
    spinner.text = `${repoName} - Checking for gone branches`;
    const goneBranches = await findGoneBranches(repoPath);

    // Step 4: Handle gone branches
    if (goneBranches.length > 0) {
      let branchesToDelete = goneBranches;

      // If current branch is gone, switch to fallback first
      if (goneBranches.includes(originalBranch)) {
        const fallbackBranch = await findFallbackBranch(repoPath);
        if (fallbackBranch) {
          if (!options.dryRun) {
            spinner.text = `${repoName} - Switching to ${fallbackBranch}`;
            await runGitOrThrow(['checkout', fallbackBranch], repoPath);
          } else {
            spinner.text = `${repoName} - [DRY-RUN] Would switch to ${fallbackBranch}`;
          }
        } else {
          // Can't delete current branch without a fallback
          branchesToDelete = goneBranches.filter((b) => b !== originalBranch);
        }
      }

      // Prompt or auto-delete gone branches
      if (branchesToDelete.length > 0) {
        const branchList = branchesToDelete.join(', ');
        let shouldDelete = options.yes;

        if (!options.yes && !options.dryRun) {
          spinner.stop();
          const answer = await promptUser(
            `${repoName}: Delete gone branches: ${branchList}?`
          );
          shouldDelete = answer;
          spinner.start();
        }

        if (shouldDelete) {
          for (const branch of branchesToDelete) {
            if (!options.dryRun) {
              spinner.text = `${repoName} - Deleting gone branch ${branch}`;
              await runGitOrThrow(['branch', '-D', branch], repoPath);
            } else {
              spinner.text = `${repoName} - [DRY-RUN] Would delete gone branch ${branch}`;
            }
          }
        }
      }
    }

    // Step 5: Get all local branches
    spinner.text = `${repoName} - Getting local branches`;
    const branchesResult = await runGitOrThrow(['branch', '-l'], repoPath);
    const localBranches = branchesResult
      .split('\n')
      .map((line) => line.trim().replace(/^\*?\s*/, ''))
      .filter((branch) => branch.length > 0 && !branch.startsWith('('));

    // Step 6: Update all branches with rebase
    if (!options.dryRun) {
      for (const branch of localBranches) {
        spinner.text = `${repoName} - Updating branch ${branch}`;
        const rebaseResult = await runGit(
          ['rebase', '--autostash', `origin/${branch}`, branch],
          repoPath
        );
        // Continue even if some branches fail (e.g., no upstream)
        if (rebaseResult.exitCode !== 0 && !rebaseResult.stderr.includes('no tracking')) {
          // Only log actual errors, not missing upstreams
          if (!rebaseResult.stderr.includes('no such ref')) {
            console.warn(
              `\n${chalk.yellow('Warning')}: Failed to update ${branch} in ${repoName}`
            );
          }
        }
      }
    } else {
      spinner.text = `${repoName} - [DRY-RUN] Would update ${localBranches.length} branches`;
    }

    // Step 7: Switch back to original branch
    const currentBranchAfter = await runGitOrThrow(['rev-parse', '--abbrev-ref', 'HEAD'], repoPath);
    if (currentBranchAfter.trim() !== originalBranch) {
      // Check if original branch still exists
      const branchExistsResult = await runGit(['rev-parse', '--verify', originalBranch], repoPath);
      if (branchExistsResult.exitCode === 0) {
        if (!options.dryRun) {
          spinner.text = `${repoName} - Switching back to ${originalBranch}`;
          await runGitOrThrow(['checkout', originalBranch], repoPath);
        } else {
          spinner.text = `${repoName} - [DRY-RUN] Would switch back to ${originalBranch}`;
        }
      }
    }

    // Step 8: Update submodules if present
    const gitmodulesPath = path.join(repoPath, '.gitmodules');
    if (existsSync(gitmodulesPath)) {
      if (!options.dryRun) {
        spinner.text = `${repoName} - Updating submodules`;
        await runGitOrThrow(['submodule', 'update', '--init', '--recursive'], repoPath);
      } else {
        spinner.text = `${repoName} - [DRY-RUN] Would update submodules`;
      }
    }

    spinner.succeed(`${repoName} - ${options.dryRun ? '[DRY-RUN] ' : ''}Completed successfully`);

    return {
      path: repoPath,
      success: true,
      message: options.dryRun ? 'Dry-run completed' : 'Pull completed successfully',
    };
  } catch (error) {
    spinner.fail(`${repoName} - Failed`);
    return {
      path: repoPath,
      success: false,
      message: error instanceof Error ? error.message : String(error),
    };
  }
}

export async function pullAllRepos(repos: string[], options: PullOptions): Promise<void> {
  console.log();
  console.log(
    chalk.cyan.bold(
      `→ Pulling ${repos.length} repositories${options.dryRun ? ' (DRY-RUN)' : ''}...`
    )
  );
  console.log();

  // Create spinners for each repo and process in parallel
  const tasks = repos.map(async (repoPath) => {
    const spinner = ora({
      text: `${getRepoName(repoPath)} - Starting`,
      prefixText: '',
    }).start();

    return pullRepo(repoPath, options, spinner);
  });

  const results = await Promise.all(tasks);

  printResults(results);
}
