import chalk from 'chalk';

export function listRepos(repos: string[]): void {
  console.log();
  console.log(`${chalk.green.bold('✓')} Found ${repos.length} git repositories:`);
  console.log();
  for (const repo of repos) {
    console.log(`  ${repo}`);
  }
  console.log();
}
