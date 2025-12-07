# gbulk

Fast bulk git operations across multiple repositories.

`gbulk` is a CLI tool that discovers git repositories recursively in a directory tree and executes git commands in parallel. Perfect for managing monorepos, workspace setups, or directories containing multiple git projects.

## Features

- **Fast Parallel Execution**: Runs operations across all repositories simultaneously
- **Recursive Discovery**: Automatically finds all git repositories in a directory tree
- **Smart Pull**: Advanced `pull-all` command with auto-stash, branch switching, and gone branch cleanup
- **Custom Commands**: Execute any git command across all repositories with `exec`
- **Submodule Support**: List and update git submodules across all repos
- **Real-time Feedback**: Live spinner updates showing progress for each repository
- **Error Resilient**: Individual repository failures don't stop other operations

## Installation

### Global Installation (Recommended)

```bash
npm install -g gbulk
```

### Local Installation

```bash
npm install gbulk
npx gbulk [command]
```

### From Source

```bash
git clone https://github.com/joeystdio/gbulk.git
cd gbulk
npm install
npm run build
npm link
```

## Usage

### Basic Syntax

```bash
gbulk [options] <command>
```

### Global Options

- `-d, --directory <path>`: Base directory to search for repositories (default: current directory)

### Commands

#### `list`

List all git repositories found in the directory tree.

```bash
# List repos in current directory
gbulk list

# List repos in a specific directory
gbulk -d ~/projects list
```

#### `pull-all`

Pull all repositories with advanced features:
- Fetches with `--prune`
- Detects "gone" branches (deleted on remote)
- Auto-switches from gone branches to fallback branches (develop/main/master)
- Updates ALL local branches via rebase with `--autostash`
- Restores original branch
- Updates submodules if `.gitmodules` exists

```bash
# Pull all repositories
gbulk pull-all

# Auto-confirm prompts (skip gone branch deletion prompt)
gbulk pull-all --yes
gbulk pull-all -y

# Preview changes without making modifications
gbulk pull-all --dry-run
```

#### `exec`

Run a custom git command in all repositories.

```bash
# Check status of all repos
gbulk exec status

# Show short status
gbulk exec status -s

# Create a branch in all repos
gbulk exec checkout -b feature/new-feature

# View recent commits
gbulk exec log --oneline -5

# Any git command works
gbulk exec fetch --all
gbulk exec stash list
gbulk exec diff --stat
```

#### `submodule-list`

List all repositories that contain git submodules.

```bash
gbulk submodule-list
```

#### `submodule-update`

Update submodules in all repositories that have them.

```bash
gbulk submodule-update
```

## Examples

### Update all projects in a workspace

```bash
cd ~/workspace
gbulk pull-all --yes
```

### Check which repos have uncommitted changes

```bash
gbulk exec status -s
```

### Fetch latest from all remotes

```bash
gbulk exec fetch --all --prune
```

### Create a new branch across all repos

```bash
gbulk exec checkout -b feature/update-dependencies
```

### Find repos with specific branches

```bash
gbulk exec branch --list "*feature*"
```

## How It Works

1. **Discovery**: `gbulk` recursively searches the directory tree for `.git` folders (excludes `node_modules`)
2. **Parallel Execution**: All operations run concurrently for maximum performance
3. **Individual Spinners**: Each repository gets real-time status updates
4. **Summary Report**: After completion, see which repos succeeded, failed, or had warnings

## Development

### Prerequisites

- Node.js >= 18.0.0
- npm or pnpm

### Setup

```bash
git clone https://github.com/joeystdio/gbulk.git
cd gbulk
npm install
```

### Build

```bash
# Build TypeScript to dist/
npm run build

# Watch mode for development
npm run dev
```

### Testing Locally

```bash
# After building
node dist/index.js [command]

# Or use the bin file
./bin/gbulk [command]
```

### Project Structure

```
gbulk/
├── src/
│   ├── index.ts              # CLI entry point
│   ├── commands/             # Command implementations
│   │   ├── list.ts
│   │   ├── pull-all.ts       # Most complex command
│   │   ├── exec.ts
│   │   ├── submodule-list.ts
│   │   └── submodule-update.ts
│   └── utils/
│       ├── repos.ts          # Repository discovery
│       ├── git.ts            # Git operations wrapper
│       └── results.ts        # Result formatting
├── bin/
│   └── gbulk                 # Executable wrapper
└── dist/                     # Compiled output
```

## Requirements

- Node.js >= 18.0.0
- Git installed and available in PATH

## License

MIT

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## Issues

Found a bug or have a feature request? Please open an issue at:
https://github.com/joeystdio/gbulk/issues

## Author

Jo Jo (joeystdio@gmail.com)
