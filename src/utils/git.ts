import { execa } from 'execa';

export interface GitResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

export async function runGit(args: string[], cwd: string): Promise<GitResult> {
  try {
    const result = await execa('git', args, { cwd, reject: false });
    return {
      stdout: result.stdout,
      stderr: result.stderr,
      exitCode: result.exitCode ?? 1,
    };
  } catch (error) {
    return {
      stdout: '',
      stderr: error instanceof Error ? error.message : String(error),
      exitCode: 1,
    };
  }
}

export async function runGitOrThrow(args: string[], cwd: string): Promise<string> {
  const result = await runGit(args, cwd);
  if (result.exitCode !== 0) {
    throw new Error(result.stderr || `Git command failed with exit code ${result.exitCode}`);
  }
  return result.stdout;
}
