import { invoke } from "@tauri-apps/api/core";
import type {
  AgentQueueItemAggregate,
  AgentQueueItemAggregateBlocker,
  AgentQueueItemAggregateDurableFlags,
  AgentQueueItemAggregateEvidenceSummary,
  AgentQueueItemAggregateLatestRun,
  AgentQueueItemAggregateNextAction,
  AgentQueueItemAggregateRunSettings,
  GetAgentQueueItemAggregateRequest,
  ListAgentQueueItemAggregatesRequest,
} from "./types";

export type TauriAgentQueueItemAggregate = {
  blockers: TauriAgentQueueItemAggregateBlocker[];
  commit_state: string;
  dependency_state: string;
  durable_flags: TauriAgentQueueItemAggregateDurableFlags;
  evidence_state: string;
  evidence_summary: TauriAgentQueueItemAggregateEvidenceSummary | null;
  latest_run: TauriAgentQueueItemAggregateLatestRun | null;
  next_actions: TauriAgentQueueItemAggregateNextAction[];
  review_state: string;
  run_settings: TauriAgentQueueItemAggregateRunSettings;
  task_id: string;
  ticket_state: string;
  title: string;
  updated_at: string;
  validation_state: string;
  worker_run_state: string;
  workspace_id: string;
};

export type TauriAgentQueueItemAggregateRunSettings = {
  approval_policy: string | null;
  assigned_executor_widget_id: string | null;
  codex_executable: string | null;
  execution_policy: string;
  execution_workspace: string | null;
  sandbox: string | null;
};

export type TauriAgentQueueItemAggregateLatestRun = {
  completed_at: string | null;
  executor_widget_id: string;
  final_detail_available: boolean;
  review_status: string | null;
  run_id: string;
  run_link_id: string;
  source: string;
  started_at: string;
  status: string;
  validation_status: string | null;
};

export type TauriAgentQueueItemAggregateEvidenceSummary = {
  available: boolean;
  not_durable_reason: string | null;
  source: string;
  summary: string | null;
};

export type TauriAgentQueueItemAggregateBlocker = {
  code: string;
  message: string;
};

export type TauriAgentQueueItemAggregateNextAction = {
  available: boolean;
  code: string;
  label: string;
  unavailable_reason: string | null;
};

export type TauriAgentQueueItemAggregateDurableFlags = {
  commit_state: boolean;
  completion_state: boolean;
  dependency_state: boolean;
  evidence_state: boolean;
  frontend_overlay_used: boolean;
  latest_run_link: boolean;
  review_state: boolean;
  task_row: boolean;
  validation_state: boolean;
};

export async function listAgentQueueItemAggregates(
  request: ListAgentQueueItemAggregatesRequest,
): Promise<AgentQueueItemAggregate[]> {
  const aggregates = await invoke<TauriAgentQueueItemAggregate[]>(
    "list_agent_queue_item_aggregates",
    {
      request: {
        workspace_id: request.workspaceId,
      },
    },
  );

  return aggregates.map(normalizeAgentQueueItemAggregate);
}

export async function getAgentQueueItemAggregate(
  request: GetAgentQueueItemAggregateRequest,
): Promise<AgentQueueItemAggregate | null> {
  const aggregate = await invoke<TauriAgentQueueItemAggregate | null>(
    "get_agent_queue_item_aggregate",
    {
      request: {
        task_id: request.taskId,
        workspace_id: request.workspaceId,
      },
    },
  );

  return aggregate ? normalizeAgentQueueItemAggregate(aggregate) : null;
}

export function normalizeAgentQueueItemAggregate(
  aggregate: TauriAgentQueueItemAggregate,
): AgentQueueItemAggregate {
  return {
    blockers: aggregate.blockers.map(normalizeBlocker),
    commitState: aggregate.commit_state,
    dependencyState: aggregate.dependency_state,
    durableFlags: normalizeDurableFlags(aggregate.durable_flags),
    evidenceState: aggregate.evidence_state,
    evidenceSummary: aggregate.evidence_summary
      ? normalizeEvidenceSummary(aggregate.evidence_summary)
      : null,
    latestRun: aggregate.latest_run
      ? normalizeLatestRun(aggregate.latest_run)
      : null,
    nextActions: aggregate.next_actions.map(normalizeNextAction),
    reviewState: aggregate.review_state,
    runSettings: normalizeRunSettings(aggregate.run_settings),
    taskId: aggregate.task_id,
    ticketState: aggregate.ticket_state,
    title: aggregate.title,
    updatedAt: aggregate.updated_at,
    validationState: aggregate.validation_state,
    workerRunState: aggregate.worker_run_state,
    workspaceId: aggregate.workspace_id,
  };
}

function normalizeRunSettings(
  settings: TauriAgentQueueItemAggregateRunSettings,
): AgentQueueItemAggregateRunSettings {
  return {
    approvalPolicy: settings.approval_policy,
    assignedExecutorWidgetId: settings.assigned_executor_widget_id,
    codexExecutable: settings.codex_executable,
    executionPolicy: settings.execution_policy,
    executionWorkspace: settings.execution_workspace,
    sandbox: settings.sandbox,
  };
}

function normalizeLatestRun(
  run: TauriAgentQueueItemAggregateLatestRun,
): AgentQueueItemAggregateLatestRun {
  return {
    completedAt: run.completed_at,
    executorWidgetId: run.executor_widget_id,
    finalDetailAvailable: run.final_detail_available,
    reviewStatus: run.review_status,
    runId: run.run_id,
    runLinkId: run.run_link_id,
    source: run.source,
    startedAt: run.started_at,
    status: run.status,
    validationStatus: run.validation_status,
  };
}

function normalizeEvidenceSummary(
  summary: TauriAgentQueueItemAggregateEvidenceSummary,
): AgentQueueItemAggregateEvidenceSummary {
  return {
    available: summary.available,
    notDurableReason: summary.not_durable_reason,
    source: summary.source,
    summary: summary.summary,
  };
}

function normalizeBlocker(
  blocker: TauriAgentQueueItemAggregateBlocker,
): AgentQueueItemAggregateBlocker {
  return {
    code: blocker.code,
    message: blocker.message,
  };
}

function normalizeNextAction(
  action: TauriAgentQueueItemAggregateNextAction,
): AgentQueueItemAggregateNextAction {
  return {
    available: action.available,
    code: action.code,
    label: action.label,
    unavailableReason: action.unavailable_reason,
  };
}

function normalizeDurableFlags(
  flags: TauriAgentQueueItemAggregateDurableFlags,
): AgentQueueItemAggregateDurableFlags {
  return {
    commitState: flags.commit_state,
    completionState: flags.completion_state,
    dependencyState: flags.dependency_state,
    evidenceState: flags.evidence_state,
    frontendOverlayUsed: flags.frontend_overlay_used,
    latestRunLink: flags.latest_run_link,
    reviewState: flags.review_state,
    taskRow: flags.task_row,
    validationState: flags.validation_state,
  };
}
