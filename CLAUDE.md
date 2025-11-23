# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

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

**Single-file architecture**: The entire application is contained in `src/main.rs` (~665 lines).

### Core Components

1. **CLI Structure** (lines 11-48)

   - Uses `clap` derive API for argument parsing
   - Global `-d/--directory` flag for base directory (defaults to ".")
   - Five subcommands: `PullAll`, `Exec`, `List`, `SubmoduleList`, `SubmoduleUpdate`
   - `PullAll` supports `-y/--yes` (auto-confirm) and `--dry-run` flags

2. **Repository Discovery** (lines 88-109)

   - `find_git_repos()`: Walks directory tree to find all `.git` folders
   - Filters out hidden directories except `.git` itself
   - Returns sorted list of repository paths

3. **Parallel Execution Pattern** (used in `pull_all_repos`, `exec_all_repos`, `update_submodule_repos`)

   - Uses `tokio::task::JoinSet` for concurrent task management
   - Each repo gets its own async task that runs independently
   - `Arc<MultiProgress>` shared across tasks for coordinated progress display
   - Results collected and printed after all tasks complete

4. **Pull Logic** (lines 289-411) - **SIGNIFICANTLY ENHANCED**

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

5. **Gone Branch Detection** (lines 413-444)

   - `find_gone_branches()`: Two-method detection strategy
   - Method 1: Parse `git branch -vv` output for `[gone]` markers
   - Method 2: Use `git for-each-ref` with upstream tracking info
   - Deduplicates results from both methods

6. **Submodule Support** (lines 119-241)

   - `list_submodule_repos()`: Shows repos with `.gitmodules`
   - `update_submodule_repos()`: Parallel submodule updates
   - `update_submodules()`: Checks out main and pulls with autostash/rebase

7. **Result Handling** (lines 50-54, print_results function)
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

### Dependencies

- `clap` (4.5): CLI argument parsing with derive macros
- `tokio` (1.41): Async runtime with full features
- `indicatif` (0.17): Progress bars and spinners
- `walkdir` (2.5): Recursive directory traversal
- `anyhow` (1.0): Error handling with context
- `colored` (2.1): Terminal color output

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

## Windows Installation Options

Three installer options are provided for Windows:

1. **install-windows.ps1** (Recommended for developers)

   - Simple PowerShell script that copies binary to `%LOCALAPPDATA%\gbulk`
   - Adds to user PATH (no admin rights needed)
   - Quick and easy, no installer software required
   - Includes `uninstall-windows.ps1` for removal

2. **build-inno.ps1** (Best for end users)

   - Creates professional installer: `gbulk-0.1.0-x64-setup.exe`
   - Requires Inno Setup 6 to build
   - Installs to `Program Files`, adds to system PATH
   - Standard Windows uninstaller in "Add or Remove Programs"
   - Configuration in `gbulk.iss`

3. **build-msi.ps1** (Enterprise deployment)
   - Creates MSI package: `gbulk-0.1.0-x64.msi`
   - Requires WiX Toolset to build
   - For corporate environments with deployment tools
   - Configuration in `gbulk.wxs`

## GitHub Actions CI/CD

The repository includes automated workflows in `.github/workflows/`:

### CI Workflow (`ci.yml`)

Runs on every push to `main` and all PRs:

- Tests build on Linux and Windows
- Runs `cargo check`, `cargo clippy -- -D warnings`, `cargo fmt --check`
- Builds installers (Debian package on Ubuntu, Inno Setup on Windows)
- Artifacts retained for 30 days

### Release Workflow (`release.yml`)

Triggered by version tags (e.g., `v0.1.0`):

- **Permissions**: Requires `contents: write` permission (already configured)
- **Build Linux**: Creates release binary and `.deb` package
- **Build Windows**: Creates release binary for `x86_64-pc-windows-msvc` target
  - **Important**: Binary is at `target/x86_64-pc-windows-msvc/release/gbulk.exe`
  - Workflow copies it to `target/release/gbulk.exe` for Inno Setup compatibility
  - Installs Inno Setup via Chocolatey and builds `.exe` installer
- **Create Release**: Downloads all artifacts and creates GitHub Release with:
  - `gbulk_0.1.0_amd64.deb`
  - `gbulk-0.1.0-x64-setup.exe`
  - `gbulk` (Linux binary)
  - `gbulk.exe` (Windows binary)

**To create a release:**

```bash
git tag -a v0.1.1 -m "Release v0.1.1"
git push origin v0.1.1
```

**Key implementation details:**

- Windows builds use explicit target `--target x86_64-pc-windows-msvc`
- `build-deb.sh` creates `debian/usr/` directories with `mkdir -p` (not in git)
- Inno Setup expects binary at `target\release\gbulk.exe` (workflow handles copy)

## PowerShell Script Migration

The tool was designed to replace PowerShell scripts with the following feature mapping:

- **pull-all.ps1** → `gbulk pull-all` (with `-y` and `--dry-run` flags)
- **list-submodule-repos.ps1** → `gbulk submodule-list`
- **update-submodule-repos.ps1** → `gbulk submodule-update`

All features from the original PowerShell scripts are implemented:

- ✅ Fetch with prune
- ✅ Gone branch detection and cleanup
- ✅ Multi-branch updates (all branches, not just current)
- ✅ Submodule support
- ✅ Interactive confirmations
- ✅ Dry-run mode
- ✅ Parallel execution (even faster than sequential PowerShell)

## Documentation Maintenance

When creating new code, refactoring, or modifying existing functionality, you MUST update this file to reflect the changes. Keep the documentation in sync with the actual codebase.
