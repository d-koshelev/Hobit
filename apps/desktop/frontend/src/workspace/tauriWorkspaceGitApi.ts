import { invoke } from "@tauri-apps/api/core";
import type {
  CreateWorkspaceGitCommitRequest,
  GetWorkspaceGitDiffSummaryRequest,
  GetWorkspaceGitFileDiffRequest,
  GetWorkspaceGitLogRequest,
  GetWorkspaceGitStatusRequest,
  GitCommitResponse,
  GitDiffCommandSummary,
  GitFileDiff,
  GitLog,
  GitLogEntry,
  GitPushResponse,
  GitRepositoryStatus,
  PushWorkspaceGitRequest,
  WorkspaceGitDiffSummary,
} from "./types";
import { normalizeGitCommitResponse } from "./tauriGitCommitApi";
import { normalizeGitRepositoryStatus } from "./tauriGitStatusApi";

type TauriWorkspaceGitStatus = {
  branch: TauriGitBranchStatus | null;
  working_tree: TauriGitWorkingTreeStatus;
  changed_files: TauriGitFileChange[];
  last_commit: TauriGitLastCommit | null;
  warnings: string[];
};

type TauriGitBranchStatus = {
  name: string | null;
  upstream: string | null;
  ahead: number | null;
  behind: number | null;
  is_detached: boolean;
};

type TauriGitWorkingTreeStatus = {
  is_clean: boolean;
  is_dirty: boolean;
  staged_count: number;
  unstaged_count: number;
  untracked_count: number;
};

type TauriGitFileChange = {
  area: string;
  kind: string;
  path: string;
  original_path: string | null;
};

type TauriGitLastCommit = {
  hash: string;
  title: string;
  author: string | null;
  committed_at: string | null;
};

type TauriWorkspaceGitDiffSummary = {
  repo_root: string;
  status: string;
  files: TauriWorkspaceGitDiffFileSummary[];
  summary: TauriWorkspaceGitDiffTotals;
  error_message: string | null;
  command_summary: TauriGitDiffCommandSummary[];
};

type TauriWorkspaceGitDiffFileSummary = {
  path: string;
  status: string;
  staged: boolean;
  unstaged: boolean;
  untracked: boolean;
  conflicted: boolean;
  additions: number | null;
  deletions: number | null;
  patch_preview: string | null;
  patch_truncated: boolean;
};

type TauriWorkspaceGitDiffTotals = {
  total_files: number;
  staged_count: number;
  unstaged_count: number;
  untracked_count: number;
  conflicted_count: number;
  total_additions: number | null;
  total_deletions: number | null;
};

type TauriWorkspaceGitFileDiff = {
  repo_root: string;
  path: string;
  status: string;
  patch: string | null;
  patch_truncated: boolean;
  error_message: string | null;
  command_summary: TauriGitDiffCommandSummary[];
};

type TauriWorkspaceGitLog = {
  repo_root: string;
  entries: TauriWorkspaceGitLogEntry[];
  command_summary: TauriGitDiffCommandSummary[];
};

type TauriWorkspaceGitLogEntry = {
  hash: string;
  short_hash: string;
  subject: string;
  author: string;
  date: string;
};

type TauriGitDiffCommandSummary = {
  program: string;
  args: string[];
};

type TauriWorkspaceGitCommitResponse = {
  status: string;
  commit_hash: string | null;
  branch: string | null;
  repo_root: string;
  included_files: string[];
  commit_message: string;
  exit_code: number | null;
  stdout: string;
  stderr: string;
  duration_ms: number;
  error_message: string | null;
  command_summary: TauriGitCommitCommandSummary[];
  push_performed: boolean;
  force_push_performed: boolean;
  reset_performed: boolean;
  clean_performed: boolean;
  auto_commit: boolean;
  operator_confirmed_required: boolean;
};

type TauriGitCommitCommandSummary = {
  program: string;
  args: string[];
};

type TauriWorkspaceGitPushResponse = {
  status: string;
  branch: string;
  upstream: string;
  remote: string;
  remote_branch: string;
  repo_root: string;
  ahead: number;
  behind: number;
  exit_code: number | null;
  stdout: string;
  stderr: string;
  duration_ms: number;
  command_summary: TauriGitDiffCommandSummary[];
  force_push_performed: boolean;
  operator_confirmed_required: boolean;
};

export async function getWorkspaceGitStatus(
  request: GetWorkspaceGitStatusRequest,
): Promise<GitRepositoryStatus> {
  const status = await invoke<TauriWorkspaceGitStatus>(
    "get_workspace_git_status",
    {
      request: {
        repo_root: request.repoRoot,
      },
    },
  );

  return normalizeGitRepositoryStatus(status);
}

export async function getWorkspaceGitDiffSummary(
  request: GetWorkspaceGitDiffSummaryRequest,
): Promise<WorkspaceGitDiffSummary> {
  const summary = await invoke<TauriWorkspaceGitDiffSummary>(
    "get_workspace_git_diff_summary",
    {
      request: {
        repo_root: request.repoRoot,
        max_files: request.maxFiles ?? null,
        max_patch_bytes_per_file: request.maxPatchBytesPerFile ?? null,
        include_patch_preview: request.includePatchPreview ?? null,
      },
    },
  );

  return normalizeWorkspaceGitDiffSummary(summary);
}

export async function getWorkspaceGitFileDiff(
  request: GetWorkspaceGitFileDiffRequest,
): Promise<GitFileDiff> {
  const diff = await invoke<TauriWorkspaceGitFileDiff>(
    "get_workspace_git_file_diff",
    {
      request: {
        repo_root: request.repoRoot,
        path: request.path,
        max_patch_bytes: request.maxPatchBytes ?? null,
      },
    },
  );

  return normalizeWorkspaceGitFileDiff(diff);
}

export async function getWorkspaceGitLog(
  request: GetWorkspaceGitLogRequest,
): Promise<GitLog> {
  const log = await invoke<TauriWorkspaceGitLog>("get_workspace_git_log", {
    request: {
      repo_root: request.repoRoot,
      limit: request.limit ?? null,
    },
  });

  return normalizeWorkspaceGitLog(log);
}

export async function createWorkspaceGitCommit(
  request: CreateWorkspaceGitCommitRequest,
): Promise<GitCommitResponse> {
  const response = await invoke<TauriWorkspaceGitCommitResponse>(
    "create_workspace_git_commit",
    {
      request: {
        repo_root: request.repoRoot,
        commit_message: request.commitMessage,
        included_files: request.includedFiles,
      },
    },
  );

  return normalizeGitCommitResponse(response);
}

export async function pushWorkspaceGit(
  request: PushWorkspaceGitRequest,
): Promise<GitPushResponse> {
  const response = await invoke<TauriWorkspaceGitPushResponse>(
    "push_workspace_git",
    {
      request: {
        repo_root: request.repoRoot,
        expected_branch: request.expectedBranch,
        expected_upstream: request.expectedUpstream,
        expected_ahead: request.expectedAhead ?? null,
        expected_behind: request.expectedBehind ?? null,
        operator_confirmed: request.operatorConfirmed,
      },
    },
  );

  return normalizeWorkspaceGitPushResponse(response);
}

function normalizeWorkspaceGitDiffSummary(
  summary: TauriWorkspaceGitDiffSummary,
): WorkspaceGitDiffSummary {
  return {
    repoRoot: summary.repo_root,
    status: summary.status,
    files: summary.files.map((file) => ({
      path: file.path,
      status: file.status,
      staged: file.staged,
      unstaged: file.unstaged,
      untracked: file.untracked,
      conflicted: file.conflicted,
      additions: file.additions,
      deletions: file.deletions,
      patchPreview: file.patch_preview,
      patchTruncated: file.patch_truncated,
    })),
    summary: {
      totalFiles: summary.summary.total_files,
      stagedCount: summary.summary.staged_count,
      unstagedCount: summary.summary.unstaged_count,
      untrackedCount: summary.summary.untracked_count,
      conflictedCount: summary.summary.conflicted_count,
      totalAdditions: summary.summary.total_additions,
      totalDeletions: summary.summary.total_deletions,
    },
    errorMessage: summary.error_message,
    commandSummary: summary.command_summary.map(normalizeGitDiffCommandSummary),
  };
}

function normalizeWorkspaceGitFileDiff(
  diff: TauriWorkspaceGitFileDiff,
): GitFileDiff {
  return {
    repoRoot: diff.repo_root,
    path: diff.path,
    status: diff.status,
    patch: diff.patch,
    patchTruncated: diff.patch_truncated,
    errorMessage: diff.error_message,
    commandSummary: diff.command_summary.map(normalizeGitDiffCommandSummary),
  };
}

function normalizeWorkspaceGitLog(log: TauriWorkspaceGitLog): GitLog {
  return {
    repoRoot: log.repo_root,
    entries: log.entries.map(normalizeWorkspaceGitLogEntry),
    commandSummary: log.command_summary.map(normalizeGitDiffCommandSummary),
  };
}

function normalizeWorkspaceGitPushResponse(
  response: TauriWorkspaceGitPushResponse,
): GitPushResponse {
  return {
    status: response.status,
    branch: response.branch,
    upstream: response.upstream,
    remote: response.remote,
    remoteBranch: response.remote_branch,
    repoRoot: response.repo_root,
    ahead: response.ahead,
    behind: response.behind,
    exitCode: response.exit_code,
    stdout: response.stdout,
    stderr: response.stderr,
    durationMs: response.duration_ms,
    commandSummary: response.command_summary.map(normalizeGitDiffCommandSummary),
    forcePushPerformed: response.force_push_performed,
    operatorConfirmedRequired: response.operator_confirmed_required,
  };
}

function normalizeWorkspaceGitLogEntry(
  entry: TauriWorkspaceGitLogEntry,
): GitLogEntry {
  return {
    hash: entry.hash,
    shortHash: entry.short_hash,
    subject: entry.subject,
    author: entry.author,
    date: entry.date,
  };
}

function normalizeGitDiffCommandSummary(
  command: TauriGitDiffCommandSummary,
): GitDiffCommandSummary {
  return {
    program: command.program,
    args: command.args,
  };
}
