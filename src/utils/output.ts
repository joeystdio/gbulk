import chalk from 'chalk';
import type { RepoStatus } from '../types.js';
import { getRepoName } from './repos.js';

export function printResults(results: RepoStatus[]): void {
  const successCount = results.filter((r) => r.success).length;
  const failCount = results.length - successCount;

  console.log();
  console.log(chalk.bold('Results:'));
  console.log('─'.repeat(60));

  for (const result of results) {
    const repoName = getRepoName(result.path);

    if (result.success) {
      console.log(
        `${chalk.green.bold('✓')} ${chalk.green(repoName)} - ${chalk.dim(result.message)}`
      );
    } else {
      console.log(
        `${chalk.red.bold('✗')} ${chalk.red(repoName)} - ${result.message}`
      );
    }
  }

  console.log('─'.repeat(60));
  console.log();
  console.log(
    `${chalk.bold('Summary:')} ${chalk.green(successCount.toString())} succeeded, ${
      failCount > 0 ? chalk.red(failCount.toString()) : chalk.dim(failCount.toString())
    } failed`
  );
  console.log();
}
