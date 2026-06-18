import { invoke } from "@tauri-apps/api/core";
import type {
  AgentQueueWorkerEvidenceBundle,
  AgentQueueWorkerEvidenceQueryResult,
  AgentQueueWorkerFinishedCommandResult,
  GetAgentQueueWorkerEvidenceBundleRequest,
  RecordAgentQueueWorkerFinishedRequest,
} from "./types";
import { normalizeAgentQueueItemAggregate } from "./tauriAgentQueueAggregateApi";

type TauriAgentQueueWorkerEvidenceBundle = {
  bundle_id: string;
  changed_files: string[];
  changed_files_count: number;
  changed_files_summary: string | null;
  created_at: string;
  error_summary: string | null;
  executor_widget_id: string | null;
  metadata_json: string | null;
  outcome: AgentQueueWorkerEvidenceBundle["outcome"];
  run_id: string;
  run_link_id: string | null;
  source: string;
  summary: string;
  task_id: string;
  updated_at: string;
  validation_summary: string | null;
  worker_id: string | null;
  workspace_id: string;
};

type TauriAgentQueueWorkerFinishedCommandResult = {
  aggregate: Parameters<typeof normalizeAgentQueueItemAggregate>[0];
  bundle_id: string;
  durable: boolean;
  evidence_bundle: TauriAgentQueueWorkerEvidenceBundle;
  run_id: string;
  task_id: string;
  workspace_id: string;
};

type TauriAgentQueueWorkerEvidenceQueryResult = {
  aggregate: Parameters<typeof normalizeAgentQueueItemAggregate>[0] | null;
  durable: boolean;
  evidence_bundle: TauriAgentQueueWorkerEvidenceBundle | null;
  run_id: string | null;
  state: string;
  task_id: string;
  workspace_id: string;
};

export async function recordAgentQueueWorkerFinished(
  request: RecordAgentQueueWorkerFinishedRequest,
): Promise<AgentQueueWorkerFinishedCommandResult> {
  const result = await invoke<TauriAgentQueueWorkerFinishedCommandResult>(
    "record_agent_queue_worker_finished",
    {
      request: {
        changed_files: request.changedFiles ?? null,
        changed_files_summary: request.changedFilesSummary ?? null,
        error_summary: request.errorSummary ?? null,
        finished_at: request.finishedAt ?? null,
        metadata_json: request.metadataJson ?? null,
        outcome: request.outcome,
        run_id: request.runId,
        source: request.source ?? null,
        summary: request.summary ?? null,
        task_id: request.taskId,
        validation_summary: request.validationSummary ?? null,
        worker_id: request.workerId ?? null,
        workspace_id: request.workspaceId,
      },
    },
  );

  return normalizeWorkerFinishedResult(result);
}

export async function getAgentQueueWorkerEvidenceBundle(
  request: GetAgentQueueWorkerEvidenceBundleRequest,
): Promise<AgentQueueWorkerEvidenceQueryResult> {
  const result = await invoke<TauriAgentQueueWorkerEvidenceQueryResult>(
    "get_agent_queue_worker_evidence_bundle",
    {
      request: {
        run_id: request.runId ?? null,
        task_id: request.taskId,
        workspace_id: request.workspaceId,
      },
    },
  );

  return normalizeWorkerEvidenceQueryResult(result);
}

function normalizeWorkerFinishedResult(
  result: TauriAgentQueueWorkerFinishedCommandResult,
): AgentQueueWorkerFinishedCommandResult {
  return {
    aggregate: normalizeAgentQueueItemAggregate(result.aggregate),
    bundleId: result.bundle_id,
    durable: result.durable,
    evidenceBundle: normalizeWorkerEvidenceBundle(result.evidence_bundle),
    runId: result.run_id,
    taskId: result.task_id,
    workspaceId: result.workspace_id,
  };
}

function normalizeWorkerEvidenceQueryResult(
  result: TauriAgentQueueWorkerEvidenceQueryResult,
): AgentQueueWorkerEvidenceQueryResult {
  return {
    aggregate: result.aggregate
      ? normalizeAgentQueueItemAggregate(result.aggregate)
      : null,
    durable: result.durable,
    evidenceBundle: result.evidence_bundle
      ? normalizeWorkerEvidenceBundle(result.evidence_bundle)
      : null,
    runId: result.run_id,
    state: result.state,
    taskId: result.task_id,
    workspaceId: result.workspace_id,
  };
}

function normalizeWorkerEvidenceBundle(
  bundle: TauriAgentQueueWorkerEvidenceBundle,
): AgentQueueWorkerEvidenceBundle {
  return {
    bundleId: bundle.bundle_id,
    changedFiles: bundle.changed_files,
    changedFilesCount: bundle.changed_files_count,
    changedFilesSummary: bundle.changed_files_summary,
    createdAt: bundle.created_at,
    errorSummary: bundle.error_summary,
    executorWidgetId: bundle.executor_widget_id,
    metadataJson: bundle.metadata_json,
    outcome: bundle.outcome,
    runId: bundle.run_id,
    runLinkId: bundle.run_link_id,
    source: bundle.source,
    summary: bundle.summary,
    taskId: bundle.task_id,
    updatedAt: bundle.updated_at,
    validationSummary: bundle.validation_summary,
    workerId: bundle.worker_id,
    workspaceId: bundle.workspace_id,
  };
}
