import { invoke } from "@tauri-apps/api/core";
import type {
  CreateGitCommitRequest,
  GitCommitCommandSummary,
  GitCommitResponse,
} from "./types";

type TauriGitCommitResponse = {
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

export async function createGitCommit(
  request: CreateGitCommitRequest,
): Promise<GitCommitResponse | null> {
  const response = await invoke<TauriGitCommitResponse | null>(
    "create_git_commit",
    {
      request: {
        workspace_id: request.workspaceId,
        workbench_id: request.workbenchId,
        widget_instance_id: request.widgetInstanceId,
        repo_root: request.repoRoot,
        commit_message: request.commitMessage,
        included_files: request.includedFiles,
      },
    },
  );

  return response ? normalizeGitCommitResponse(response) : null;
}

export function normalizeGitCommitResponse(
  response: TauriGitCommitResponse,
): GitCommitResponse {
  return {
    status: response.status,
    commitHash: response.commit_hash,
    branch: response.branch,
    repoRoot: response.repo_root,
    includedFiles: response.included_files,
    commitMessage: response.commit_message,
    exitCode: response.exit_code,
    stdout: response.stdout,
    stderr: response.stderr,
    durationMs: response.duration_ms,
    errorMessage: response.error_message,
    commandSummary: response.command_summary.map(normalizeCommandSummary),
    pushPerformed: response.push_performed,
    forcePushPerformed: response.force_push_performed,
    resetPerformed: response.reset_performed,
    cleanPerformed: response.clean_performed,
    autoCommit: response.auto_commit,
    operatorConfirmedRequired: response.operator_confirmed_required,
  };
}

function normalizeCommandSummary(
  command: TauriGitCommitCommandSummary,
): GitCommitCommandSummary {
  return {
    program: command.program,
    args: command.args,
  };
}
