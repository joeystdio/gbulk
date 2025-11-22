# gbulk

A fast, cross-platform CLI tool for running bulk git operations across multiple repositories in parallel.

## Features

- **Parallel execution**: Process multiple repositories simultaneously for maximum speed
- **Progress indicators**: Real-time status updates with spinners showing what's happening in each repo
- **Smart pull-all**: Automatically fetches with prune, updates all branches, and handles submodules
- **Gone branch cleanup**: Auto-detect and delete local branches whose upstream is deleted
- **Multi-branch updates**: Rebases all local branches against their upstreams, not just current branch
- **Submodule support**: Automatically updates submodules during pull-all
- **Interactive mode**: Prompts for confirmation before deleting gone branches
- **Dry-run mode**: Preview changes without executing them
- **Custom commands**: Run any git command across all repositories
- **Cross-platform**: Works on Linux, macOS, and Windows

## Installation

Pre-built installers are available for each release. Download from the [Releases page](https://github.com/joeystdio/gbulk/releases).

### Windows

Download `gbulk-x.x.x-x64-setup.exe` from the [Releases page](https://github.com/joeystdio/gbulk/releases) and run the installer.

The installer will:

- Install to `%LOCALAPPDATA%\gbulk`
- Automatically add to your PATH
- Provide uninstaller in "Add or Remove Programs"

### Ubuntu/Debian

Download `gbulk_x.x.x_amd64.deb` from the [Releases page](https://github.com/joeystdio/gbulk/releases) and install:

```bash
sudo dpkg -i gbulk_x.x.x_amd64.deb
```

To uninstall:

```bash
sudo dpkg -r gbulk
```

### From Source (All Platforms)

If you prefer to build from source:

```bash
# Clone the repository
git clone https://github.com/joeystdio/gbulk.git
cd gbulk

# Build and install
cargo build --release
cargo install --path .
```

The binary will be installed to:

- Linux/macOS: `~/.cargo/bin/gbulk`
- Windows: `%USERPROFILE%\.cargo\bin\gbulk.exe`

## Usage

### Pull All Repositories

Fetch and rebase all git repositories found in the current directory or a specified directory.

```bash
# Pull all repos in current directory (interactive mode)
gbulk pull-all

# Pull all repos with auto-confirm (skip prompts)
gbulk pull-all -y

# Dry run to see what would happen
gbulk pull-all --dry-run

# Pull all repos in a specific directory
gbulk -d /path/to/projects pull-all
```

**What it does:**

1. Gets current branch
2. Fetches from all remotes with `--prune` (removes tracking for deleted remote branches)
3. Detects "gone" branches (local branches whose upstream was deleted)
4. Prompts to delete gone branches (or auto-deletes with `-y` flag)
5. Updates ALL local branches (rebases each against their upstream with `--autostash`)
6. Switches back to original branch
7. Updates submodules if `.gitmodules` exists

**Flags:**

- `-y, --yes`: Auto-confirm all prompts (delete gone branches without asking)
- `--dry-run`: Show what would be done without making changes

### List Repositories

List all git repositories found:

```bash
gbulk list

# In a specific directory
gbulk -d ~/projects list
```

### List Repositories with Submodules

List all repositories that contain submodules:

```bash
gbulk submodule-list
```

### Update Submodules

Update submodules in all repositories that have them:

```bash
gbulk submodule-update
```

**What it does:**

1. Finds all repos with `.gitmodules`
2. Checks out `main` branch in all submodules
3. Pulls with `--autostash --rebase --no-commit` in all submodules

### Execute Custom Commands

Run any git command across all repositories:

```bash
# Check status in all repos
gbulk exec status

# Create a branch in all repos
gbulk exec checkout -b feature/new-feature

# Show recent commits
gbulk exec log --oneline -5

# Any git command works
gbulk exec fetch origin
gbulk exec branch -a
```

## Examples

### Daily workflow

```bash
# Navigate to your projects directory
cd ~/projects

# Pull all repos to get latest changes
gbulk pull-all
```

### Check what's happening across all projects

```bash
# See status of all repos
gbulk exec status --short

# See all branches
gbulk exec branch -v
```

### Output Example

```
→ Pulling 5 repositories...

⠁ [2s] repo1: Fetching...
⠂ [1s] repo2: Rebasing...
⠄ [3s] repo3: Stashing changes...
⠁ [1s] repo4: Popping stash...
⠂ [2s] repo5: Getting current branch...

Results:
────────────────────────────────────────────────────────────
✓ repo1 - Successfully updated on main
✓ repo2 - Successfully updated on develop
✓ repo3 - Successfully updated on main
✗ repo4 - Failed to rebase: merge conflict
✓ repo5 - No upstream branch for 'feature-branch'
────────────────────────────────────────────────────────────

Summary: 4 succeeded, 1 failed
```

## Command Reference

### Global Options

- `-d, --directory <PATH>`: Base directory to search for git repositories (default: current directory)

### Commands

- `pull-all`: Pull all repositories (fetch + rebase with auto-stash)
  - `-y, --yes`: Auto-confirm all prompts
  - `--dry-run`: Show what would be done without making changes
- `list`: List all git repositories found
- `submodule-list`: List repositories with submodules
- `submodule-update`: Update submodules in all repositories
- `exec <args>...`: Run custom git command in all repositories

## How It Works

### Repository Discovery

`gbulk` recursively searches the specified directory for `.git` folders. Each directory containing a `.git` folder is treated as a repository. Hidden directories (starting with `.`) are skipped except for `.git` itself.

### Parallel Execution

All repository operations run in parallel using Tokio's async runtime. This means if you have 10 repos, they all process simultaneously rather than one at a time.

### Pull-All Logic

The `pull-all` command is designed to match the PowerShell script behavior:

1. **Current branch detection**: Saves current branch to switch back later
2. **Fetch with prune**: Fetches from all remotes and prunes deleted remote branches
3. **Gone branch detection**: Finds local branches whose upstream was deleted using two methods:
   - Parsing `git branch -vv` for `[gone]` markers
   - Using `git for-each-ref` for tracking info
4. **Interactive deletion**: Prompts to delete each gone branch (or auto-deletes with `-y`)
5. **Fallback switching**: If current branch is gone, switches to `develop`, `main`, or `master` before deleting
6. **Multi-branch update**: Rebases ALL local branches (not just current) against their upstreams with `--autostash`
7. **Branch restoration**: Switches back to original branch
8. **Submodule handling**: If `.gitmodules` exists, updates and prunes submodules

The `--dry-run` flag shows what would happen without making any changes.

## Requirements

- Git must be installed and available in PATH
- Rust 1.70+ (for building from source)

## Platform Support

- Linux (tested on Ubuntu)
- macOS
- Windows

## License

MIT

## Development

### GitHub Actions

This repository uses GitHub Actions for CI/CD:

**CI Workflow** (runs on every push/PR):

- Tests build on Linux and Windows
- Runs `cargo check`, `cargo clippy`, and `cargo fmt`
- Builds installers for Linux (`.deb`) and Windows (`.exe`)

**Release Workflow** (runs on version tags):

- Builds release installers for Linux and Windows
- Creates Debian package (`.deb`)
- Creates Windows installer (`.exe` via Inno Setup)
- Automatically creates GitHub Release with installers

To create a new release:

```bash
git tag v0.1.1
git push origin v0.1.1
```

### Building Installers Locally

For developers who want to build installers locally:

**Windows Installer:**

```powershell
# Requires Inno Setup 6 (https://jrsoftware.org/isinfo.php)
.\build-inno.ps1
```

Creates `gbulk-0.1.0-x64-setup.exe`

**Debian Package:**

```bash
./build-deb.sh
```

Creates `gbulk_0.1.0_amd64.deb`

**Simple Windows Install (No Installer):**

```powershell
.\install-windows.ps1  # Install to %LOCALAPPDATA%\gbulk
.\uninstall-windows.ps1  # Uninstall
```

## Contributing

Contributions welcome! Please open an issue or submit a pull request.

The CI will automatically test your changes on all platforms.
