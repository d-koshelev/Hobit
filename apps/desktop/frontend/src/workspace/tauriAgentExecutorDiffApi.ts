import { invoke } from "@tauri-apps/api/core";
import type {
  AgentExecutorDiffFileSummary,
  AgentExecutorDiffSummary,
  AgentExecutorDiffTotals,
  GetAgentExecutorDiffSummaryRequest,
  GitDiffCommandSummary,
} from "./types";

type TauriAgentExecutorDiffSummary = {
  repo_root: string;
  status: string;
  files: TauriAgentExecutorDiffFileSummary[];
  summary: TauriAgentExecutorDiffTotals;
  error_message: string | null;
  command_summary: TauriGitDiffCommandSummary[];
};

type TauriAgentExecutorDiffFileSummary = {
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

type TauriAgentExecutorDiffTotals = {
  total_files: number;
  staged_count: number;
  unstaged_count: number;
  untracked_count: number;
  conflicted_count: number;
  total_additions: number | null;
  total_deletions: number | null;
};

type TauriGitDiffCommandSummary = {
  program: string;
  args: string[];
};

export async function getAgentExecutorDiffSummary(
  request: GetAgentExecutorDiffSummaryRequest,
): Promise<AgentExecutorDiffSummary | null> {
  const summary = await invoke<TauriAgentExecutorDiffSummary | null>(
    "get_agent_executor_diff_summary",
    {
      request: {
        workspace_id: request.workspaceId,
        workbench_id: request.workbenchId,
        widget_instance_id: request.widgetInstanceId,
        repo_root: request.repoRoot,
        max_files: request.maxFiles ?? null,
        max_patch_bytes_per_file: request.maxPatchBytesPerFile ?? null,
        include_patch_preview: request.includePatchPreview ?? null,
      },
    },
  );

  return summary ? normalizeAgentExecutorDiffSummary(summary) : null;
}

function normalizeAgentExecutorDiffSummary(
  summary: TauriAgentExecutorDiffSummary,
): AgentExecutorDiffSummary {
  return {
    repoRoot: summary.repo_root,
    status: summary.status,
    files: summary.files.map(normalizeAgentExecutorDiffFileSummary),
    summary: normalizeAgentExecutorDiffTotals(summary.summary),
    errorMessage: summary.error_message,
    commandSummary: summary.command_summary.map(normalizeGitDiffCommandSummary),
  };
}

function normalizeAgentExecutorDiffFileSummary(
  file: TauriAgentExecutorDiffFileSummary,
): AgentExecutorDiffFileSummary {
  return {
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
  };
}

function normalizeAgentExecutorDiffTotals(
  totals: TauriAgentExecutorDiffTotals,
): AgentExecutorDiffTotals {
  return {
    totalFiles: totals.total_files,
    stagedCount: totals.staged_count,
    unstagedCount: totals.unstaged_count,
    untrackedCount: totals.untracked_count,
    conflictedCount: totals.conflicted_count,
    totalAdditions: totals.total_additions,
    totalDeletions: totals.total_deletions,
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
