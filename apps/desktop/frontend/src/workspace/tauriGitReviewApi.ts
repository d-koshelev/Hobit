import { invoke } from "@tauri-apps/api/core";
import type {
  GetGitFileDiffRequest,
  GetGitLogRequest,
  GitDiffCommandSummary,
  GitFileDiff,
  GitLog,
  GitLogEntry,
} from "./types";

type TauriGitFileDiff = {
  repo_root: string;
  path: string;
  status: string;
  patch: string | null;
  patch_truncated: boolean;
  error_message: string | null;
  command_summary: TauriGitDiffCommandSummary[];
};

type TauriGitLog = {
  repo_root: string;
  entries: TauriGitLogEntry[];
  command_summary: TauriGitDiffCommandSummary[];
};

type TauriGitLogEntry = {
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

export async function getGitFileDiff(
  request: GetGitFileDiffRequest,
): Promise<GitFileDiff | null> {
  const diff = await invoke<TauriGitFileDiff | null>("get_git_file_diff", {
    request: {
      workspace_id: request.workspaceId,
      workbench_id: request.workbenchId,
      widget_instance_id: request.widgetInstanceId,
      repository_root: request.repositoryRoot,
      path: request.path,
      max_patch_bytes: request.maxPatchBytes ?? null,
    },
  });

  return diff ? normalizeGitFileDiff(diff) : null;
}

export async function getGitLog(
  request: GetGitLogRequest,
): Promise<GitLog | null> {
  const log = await invoke<TauriGitLog | null>("get_git_log", {
    request: {
      workspace_id: request.workspaceId,
      workbench_id: request.workbenchId,
      widget_instance_id: request.widgetInstanceId,
      repository_root: request.repositoryRoot,
      limit: request.limit ?? null,
    },
  });

  return log ? normalizeGitLog(log) : null;
}

function normalizeGitFileDiff(diff: TauriGitFileDiff): GitFileDiff {
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

function normalizeGitLog(log: TauriGitLog): GitLog {
  return {
    repoRoot: log.repo_root,
    entries: log.entries.map(normalizeGitLogEntry),
    commandSummary: log.command_summary.map(normalizeGitDiffCommandSummary),
  };
}

function normalizeGitLogEntry(entry: TauriGitLogEntry): GitLogEntry {
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
