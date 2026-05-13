import { invoke } from "@tauri-apps/api/core";
import type {
  AgentExecutorRunDetail,
  AgentExecutorRunHistory,
  AgentExecutorRunSummary,
  GetAgentExecutorRunDetailRequest,
  ListAgentExecutorRunsRequest,
  WidgetLogEntry,
} from "./types";

type TauriAgentExecutorRunHistory = {
  workspace_id: string;
  workbench_id: string;
  widget_instance_id: string;
  runs: TauriAgentExecutorRunSummary[];
};

type TauriAgentExecutorRunSummary = {
  run_id: string;
  status: string;
  command_kind: string | null;
  result_type: string | null;
  started_at: string;
  finished_at: string | null;
  duration_ms: number | null;
  title: string;
  repo_root: string | null;
  mode: string | null;
  validation_profile: string | null;
  validation_status: string | null;
  has_result: boolean;
  log_count: number | null;
};

type TauriAgentExecutorRunDetail = {
  summary: TauriAgentExecutorRunSummary;
  result_id: string | null;
  result_status: string | null;
  result_summary: string | null;
  result_content: string | null;
  result_payload: string | null;
  final_message: string | null;
  stdout_preview: string | null;
  stderr_preview: string | null;
  error_message: string | null;
  validation_profile: string | null;
  validation_status: string | null;
  changed_files_summary: string | null;
  logs: TauriWidgetLogEntry[];
};

type TauriWidgetLogEntry = {
  id: string;
  widget_instance_id: string;
  run_id: string | null;
  level: string;
  message: string;
  payload: string | null;
  created_at: string;
};

export async function listAgentExecutorRuns(
  request: ListAgentExecutorRunsRequest,
): Promise<AgentExecutorRunHistory | null> {
  const history = await invoke<TauriAgentExecutorRunHistory | null>(
    "list_agent_executor_runs",
    {
      request: {
        workspace_id: request.workspaceId,
        workbench_id: request.workbenchId,
        widget_instance_id: request.widgetInstanceId,
        limit: request.limit ?? null,
      },
    },
  );

  return history ? normalizeAgentExecutorRunHistory(history) : null;
}

export async function getAgentExecutorRunDetail(
  request: GetAgentExecutorRunDetailRequest,
): Promise<AgentExecutorRunDetail | null> {
  const detail = await invoke<TauriAgentExecutorRunDetail | null>(
    "get_agent_executor_run_detail",
    {
      request: {
        workspace_id: request.workspaceId,
        workbench_id: request.workbenchId,
        widget_instance_id: request.widgetInstanceId,
        run_id: request.runId,
      },
    },
  );

  return detail ? normalizeAgentExecutorRunDetail(detail) : null;
}

function normalizeAgentExecutorRunHistory(
  history: TauriAgentExecutorRunHistory,
): AgentExecutorRunHistory {
  return {
    workspaceId: history.workspace_id,
    workbenchId: history.workbench_id,
    widgetInstanceId: history.widget_instance_id,
    runs: history.runs.map(normalizeAgentExecutorRunSummary),
  };
}

function normalizeAgentExecutorRunDetail(
  detail: TauriAgentExecutorRunDetail,
): AgentExecutorRunDetail {
  return {
    summary: normalizeAgentExecutorRunSummary(detail.summary),
    resultId: detail.result_id,
    resultStatus: detail.result_status,
    resultSummary: detail.result_summary,
    resultContent: detail.result_content,
    resultPayload: detail.result_payload,
    finalMessage: detail.final_message,
    stdoutPreview: detail.stdout_preview,
    stderrPreview: detail.stderr_preview,
    errorMessage: detail.error_message,
    validationProfile: detail.validation_profile,
    validationStatus: detail.validation_status,
    changedFilesSummary: detail.changed_files_summary,
    logs: detail.logs.map(normalizeWidgetLogEntry),
  };
}

function normalizeAgentExecutorRunSummary(
  summary: TauriAgentExecutorRunSummary,
): AgentExecutorRunSummary {
  return {
    runId: summary.run_id,
    status: summary.status,
    commandKind: summary.command_kind,
    resultType: summary.result_type,
    startedAt: summary.started_at,
    finishedAt: summary.finished_at,
    durationMs: summary.duration_ms,
    title: summary.title,
    repoRoot: summary.repo_root,
    mode: summary.mode,
    validationProfile: summary.validation_profile,
    validationStatus: summary.validation_status,
    hasResult: summary.has_result,
    logCount: summary.log_count,
  };
}

function normalizeWidgetLogEntry(log: TauriWidgetLogEntry): WidgetLogEntry {
  return {
    id: log.id,
    widgetInstanceId: log.widget_instance_id,
    runId: log.run_id,
    level: log.level,
    message: log.message,
    payload: log.payload,
    createdAt: log.created_at,
  };
}
