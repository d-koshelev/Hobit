export type GetGitRepositoryStatusRequest = {
  workspaceId: string;
  workbenchId: string;
  widgetInstanceId: string;
  repositoryRoot: string;
};

export type CreateGitCommitRequest = {
  workspaceId: string;
  workbenchId: string;
  widgetInstanceId: string;
  repoRoot: string;
  commitMessage: string;
  includedFiles: string[];
};

export type GitCommitResponse = {
  status: string;
  commitHash: string | null;
  branch: string | null;
  repoRoot: string;
  includedFiles: string[];
  commitMessage: string;
  exitCode: number | null;
  stdout: string;
  stderr: string;
  durationMs: number;
  errorMessage: string | null;
  commandSummary: GitCommitCommandSummary[];
  pushPerformed: boolean;
  forcePushPerformed: boolean;
  resetPerformed: boolean;
  cleanPerformed: boolean;
  autoCommit: boolean;
  operatorConfirmedRequired: boolean;
};

export type GitCommitCommandSummary = {
  program: string;
  args: string[];
};

export type GitRepositoryStatus = {
  branch: GitBranchStatus | null;
  workingTree: GitWorkingTreeStatus;
  changedFiles: GitFileChange[];
  lastCommit: GitLastCommit | null;
  warnings: string[];
};

export type GitBranchStatus = {
  name: string | null;
  upstream: string | null;
  ahead: number | null;
  behind: number | null;
  isDetached: boolean;
};

export type GitWorkingTreeStatus = {
  isClean: boolean;
  isDirty: boolean;
  stagedCount: number;
  unstagedCount: number;
  untrackedCount: number;
};

export type GitFileChange = {
  area: string;
  kind: string;
  path: string;
  originalPath: string | null;
};

export type GitLastCommit = {
  hash: string;
  title: string;
  author: string | null;
  committedAt: string | null;
};
