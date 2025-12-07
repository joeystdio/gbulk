#!/usr/bin/env node

import { Command } from 'commander';
import chalk from 'chalk';
import { findGitRepos } from './utils/repos.js';
import { listRepos } from './commands/list.js';
import { pullAllRepos } from './commands/pull-all.js';
import { execAllRepos } from './commands/exec.js';
import { listSubmoduleRepos } from './commands/submodule-list.js';
import { updateSubmoduleRepos } from './commands/submodule-update.js';

const program = new Command();

program
  .name('gbulk')
  .description('Bulk git operations across multiple repositories')
  .option('-d, --directory <path>', 'Base directory to search for repositories', '.');

program
  .command('list')
  .description('List all git repositories found')
  .action(async () => {
    const opts = program.opts();
    const repos = await findGitRepos(opts.directory);

    if (repos.length === 0) {
      console.log(chalk.yellow('No git repositories found!'));
      return;
    }

    await listRepos(repos);
  });

program
  .command('pull-all')
  .description('Pull all repositories (fetch + rebase with auto-stash)')
  .option('-y, --yes', 'Auto-confirm prompts', false)
  .option('--dry-run', 'Preview changes without making modifications', false)
  .action(async (cmdOpts) => {
    const opts = program.opts();
    const repos = await findGitRepos(opts.directory);

    if (repos.length === 0) {
      console.log(chalk.yellow('No git repositories found!'));
      return;
    }

    await pullAllRepos(repos, { yes: cmdOpts.yes, dryRun: cmdOpts.dryRun });
  });

program
  .command('exec')
  .description('Run custom git command in all repositories')
  .argument('<args...>', 'Git command arguments')
  .allowUnknownOption()
  .action(async (args) => {
    const opts = program.opts();
    const repos = await findGitRepos(opts.directory);

    if (repos.length === 0) {
      console.log(chalk.yellow('No git repositories found!'));
      return;
    }

    await execAllRepos(repos, args);
  });

program
  .command('submodule-list')
  .description('List repositories with submodules')
  .action(async () => {
    const opts = program.opts();
    const repos = await findGitRepos(opts.directory);

    if (repos.length === 0) {
      console.log(chalk.yellow('No git repositories found!'));
      return;
    }

    await listSubmoduleRepos(repos);
  });

program
  .command('submodule-update')
  .description('Update submodules in all repositories')
  .action(async () => {
    const opts = program.opts();
    const repos = await findGitRepos(opts.directory);

    if (repos.length === 0) {
      console.log(chalk.yellow('No git repositories found!'));
      return;
    }

    await updateSubmoduleRepos(repos);
  });

program.parse();
