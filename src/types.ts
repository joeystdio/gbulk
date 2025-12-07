export interface RepoStatus {
  path: string;
  success: boolean;
  message: string;
}

export interface PullOptions {
  yes: boolean;
  dryRun: boolean;
}
