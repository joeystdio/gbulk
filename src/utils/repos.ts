import fg from 'fast-glob';
import path from 'path';

export async function findGitRepos(baseDir: string): Promise<string[]> {
  const gitDirs = await fg('**/.git', {
    cwd: baseDir,
    onlyDirectories: true,
    dot: true,
    ignore: ['**/node_modules/**'],
    followSymbolicLinks: false,
  });

  const repos = gitDirs
    .map((gitDir) => path.dirname(path.join(baseDir, gitDir)))
    .sort();

  return repos;
}

export function getRepoName(repoPath: string): string {
  return path.basename(repoPath);
}
