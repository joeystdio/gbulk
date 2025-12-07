# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

gbulk is a CLI tool for performing fast bulk git operations across multiple repositories. It discovers git repositories recursively in a directory tree and executes git commands in parallel.

## Build and Development Commands

```bash
# Build the project (compiles TypeScript to dist/)
npm run build

# Watch mode for development
npm run dev

# Run the CLI locally (after building)
node dist/index.js [command]

# Or use the bin file directly
./bin/gbulk [command]
```

## Architecture

### Entry Point and CLI Structure
- **src/index.ts**: Main CLI entry point using Commander.js
- **bin/gbulk**: Executable wrapper (no .js extension) that imports dist/index.js
- All commands follow a pattern: discover repos → validate → execute in parallel → report results

### Repository Discovery
- **src/utils/repos.ts**: Uses fast-glob to find all `.git` directories recursively
- Automatically excludes `node_modules`
- Returns sorted absolute paths to repository root directories

### Command Execution Pattern
All commands in `src/commands/` follow a consistent pattern:
1. Receive array of repository paths
2. Execute operations in parallel using `Promise.all()`
3. Use `ora` spinners for real-time progress feedback
4. Return `RepoStatus[]` results
5. Print summary via `printResults()` utility

### Git Operations Layer
**src/utils/git.ts** provides two core functions:
- `runGit()`: Returns `{stdout, stderr, exitCode}`, never throws
- `runGitOrThrow()`: Returns stdout on success, throws on error

This abstraction ensures consistent error handling across all git operations.

### Key Commands

**pull-all** (src/commands/pull-all.ts):
The most complex command with sophisticated branch management:
1. Fetches with `--prune`
2. Detects "gone" branches (deleted on remote) using two methods: `git branch -vv` and `git for-each-ref`
3. Auto-switches from gone branches to fallback branches (develop/main/master)
4. Prompts to delete gone branches (unless `--yes` flag)
5. Updates ALL local branches via rebase with `--autostash`
6. Restores original branch
7. Updates submodules if `.gitmodules` exists

**exec** (src/commands/exec.ts):
- Runs arbitrary git commands across all repos
- Passes through arguments directly to git

### TypeScript Configuration
- ES2022 target with NodeNext modules
- Builds to `dist/` directory
- Source in `src/` directory
- All imports must use `.js` extension (ESM requirement)

### Important Patterns

1. **Parallel Execution**: All repo operations run in parallel for performance
2. **Error Resilience**: Individual repo failures don't stop other repos from processing
3. **Spinner Management**: Each repo gets its own ora spinner for concurrent feedback
4. **Module Imports**: Always use `.js` extension in imports (e.g., `'./utils/repos.js'`) due to ESM
