# GEMINI.md

This file provides guidance to Gemini/Antigravity agents when working with code in this repository.

## Project Overview

`gbulk` is a fast, cross-platform CLI tool for running bulk git operations across multiple repositories in parallel. It uses Rust with Tokio for async/parallel execution, clap for CLI parsing, and indicatif for progress display.

## Build and Development Commands

```bash
# Build the project
cargo build

# Build release version
cargo build --release

# Run the binary (after building)
./target/debug/gbulk
./target/release/gbulk

# Install locally to ~/.cargo/bin
cargo install --path .

# Run with cargo (for development)
cargo run -- list
cargo run -- pull-all
cargo run -- pull-all -y          # Auto-confirm prompts
cargo run -- pull-all --dry-run   # Preview changes
cargo run -- submodule-list
cargo run -- submodule-update
cargo run -- exec status

# Check code
cargo check

# Format code
cargo fmt

# Run clippy
cargo clippy

# Build Debian package (Ubuntu installer)
./build-deb.sh

# Windows installers (run in PowerShell on Windows)
.\install-windows.ps1           # Simple install script
.\build-inno.ps1               # Build Inno Setup installer (requires Inno Setup)
.\build-msi.ps1                # Build WiX MSI installer (requires WiX Toolset)
```

## Architecture

**Single-file architecture**: The entire application is contained in `src/main.rs`.

### Core Components

1. **CLI Structure**

   - Uses `clap` derive API for argument parsing
   - Global `-d/--directory` flag for base directory (defaults to ".")
   - Five subcommands: `PullAll`, `Exec`, `List`, `SubmoduleList`, `SubmoduleUpdate`
   - `PullAll` supports `-y/--yes` (auto-confirm) and `--dry-run` flags

2. **Pull Logic** - **SIGNIFICANTLY ENHANCED**

   - `pull_repo()`: Complex state machine matching PowerShell script behavior
   - Closure `run_git` for executing git commands with error handling
   - Steps:
     1. Get current branch
     2. Fetch with `--prune` flag
     3. Find "gone" branches (two detection methods)
     4. Prompt to delete gone branches (or auto-delete with `-y`)
     5. Update ALL local branches with `--autostash`
     6. Switch back to original branch
     7. Update submodules if present
   - Interactive prompts with `prompt_user()` function
   - Dry-run mode skips all mutations

3. **Gone Branch Detection**

   - `find_gone_branches()`: Two-method detection strategy
   - Method 1: Parse `git branch -vv` output for `[gone]` markers
   - Method 2: Use `git for-each-ref` with upstream tracking info
   - Deduplicates results from both methods

4. **Submodule Support**

   - `list_submodule_repos()`: Shows repos with `.gitmodules`
   - `update_submodule_repos()`: Parallel submodule updates
   - `update_submodules()`: Checks out main and pulls with autostash/rebase

5. **Result Handling**
   - `RepoStatus` struct: captures path, success flag, and message
   - `print_results()`: Formats output with colored success/failure indicators
   - Shows summary counts at the end

### Key Design Patterns

- **Progress feedback**: Every async task updates a spinner showing current operation and elapsed time
- **Error isolation**: Failures in one repository don't affect others; each task independently reports success/failure
- **Multi-branch updates**: Unlike simple pull, updates ALL local branches not just current
- **Gone branch cleanup**: Automatically detects and offers to delete branches whose upstream was removed
- **Interactive safety**: Prompts before destructive operations (deletions), unless `-y` flag used
- **Dry-run support**: `--dry-run` flag shows what would happen without making changes
- **Submodule awareness**: Automatically handles submodule updates during pull-all
- **Fallback branch switching**: Smart branch switching to develop/main/master before deleting current branch

## Dependencies

- `clap`: CLI argument parsing with derive macros
- `tokio`: Async runtime with full features
- `indicatif`: Progress bars and spinners
- `walkdir`: Recursive directory traversal
- `anyhow`: Error handling with context
- `colored`: Terminal color output

## Important Implementation Details

- **Git execution**: All git commands use `std::process::Command` (synchronous), wrapped in async tasks
- **Repo name extraction**: Uses `path.file_name()` to get display name (last path component)
- **Rebase with autostash**: Uses `git rebase --autostash` for all branch updates (matches PowerShell scripts)
- **Fetch with prune**: Uses `git fetch --all --prune` to clean up deleted remote branch tracking
- **Gone branch detection**: Two methods ensure comprehensive detection:
  - `git branch -vv` parsing for `[gone]` markers
  - `git for-each-ref` with upstream tracking info
- **Interactive prompts**: Uses `std::io::stdin` for y/N confirmation prompts
- **Dry-run implementation**: Skips all git write operations when `--dry-run` flag is set
- **Submodule detection**: Checks for `.gitmodules` file existence
- **Fallback branches**: Tries `develop`, `main`, `master` in order when switching from gone branch

## Testing the Application

```bash
# Create test repos
mkdir test-repos && cd test-repos
git init repo1 && git init repo2 && git init repo3

# Run gbulk from parent directory
cd ..
cargo run -- -d test-repos list
cargo run -- -d test-repos exec status
cargo run -- -d test-repos pull-all --dry-run
cargo run -- -d test-repos submodule-list
```
