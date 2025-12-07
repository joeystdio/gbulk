import ora from 'ora';
import chalk from 'chalk';
import type { RepoStatus } from '../types.js';
import { runGit } from '../utils/git.js';
import { getRepoName } from '../utils/repos.js';
import { printResults } from '../utils/output.js';

export async function execAllRepos(repos: string[], args: string[]): Promise<void> {
  const argsStr = args.join(' ');
  console.log();
  console.log(chalk.cyan.bold(`→ Running 'git ${argsStr}' in ${repos.length} repositories...`));
  console.log();

  const results = await Promise.all(
    repos.map(async (repoPath): Promise<RepoStatus> => {
      const repoName = getRepoName(repoPath);
      const spinner = ora({
        text: chalk.dim(repoName),
        prefixText: chalk.cyan('⟳'),
      }).start();

      try {
        const result = await runGit(args, repoPath);

        if (result.exitCode === 0) {
          spinner.succeed(chalk.green(repoName));
          return {
            path: repoPath,
            success: true,
            message: result.stdout.trim() || 'completed successfully',
          };
        } else {
          spinner.fail(chalk.red(repoName));
          return {
            path: repoPath,
            success: false,
            message: result.stderr.trim() || `Command failed with exit code ${result.exitCode}`,
          };
        }
      } catch (error) {
        spinner.fail(chalk.red(repoName));
        return {
          path: repoPath,
          success: false,
          message: error instanceof Error ? error.message : String(error),
        };
      }
    })
  );

  printResults(results);
}
