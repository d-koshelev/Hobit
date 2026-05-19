import { invoke } from "@tauri-apps/api/core";
import type {
  AgentMonitoringProposalResult,
  AgentMonitoringSnapshot,
  GetAgentMonitoringSnapshotRequest,
} from "./types";

type TauriAgentMonitoringSnapshot = {
  workspace_id: string;
  workbench_id: string;
  proposal_results: TauriAgentMonitoringProposalResult[];
};

type TauriAgentMonitoringProposalResult = {
  run_id: string;
  result_id: string;
  status: string;
  result_type: string;
  result_summary: string | null;
  result_content: string | null;
  run_started_at: string;
  run_finished_at: string | null;
  result_created_at: string;
  source_widget_id: string;
  source_widget_title: string;
  runtime_status: string;
  provider_status: string;
  provider_used: boolean;
  provider_response_received: boolean;
  no_llm_called: boolean;
  no_tools_executed: boolean;
  no_mutations_performed: boolean;
  context_was_approved: boolean;
  operator_prompt: string;
  proposal_summary: string;
  proposed_plan: string[];
  context_needed: string[];
  approved_context_summary: string;
  approved_context_status: string;
  approved_context_source_labels: string[];
  proposed_actions: TauriAgentMonitoringProposalAction[];
  safety_notes: string[];
  raw_payload: string;
};

type TauriAgentMonitoringProposalAction = {
  title: string;
  description: string;
  status: string;
  executed: boolean;
};

export async function getAgentMonitoringSnapshot(
  request: GetAgentMonitoringSnapshotRequest,
): Promise<AgentMonitoringSnapshot | null> {
  const snapshot = await invoke<TauriAgentMonitoringSnapshot | null>(
    "get_agent_monitoring_snapshot",
    {
      request: {
        workspace_id: request.workspaceId,
        workbench_id: request.workbenchId,
      },
    },
  );

  return snapshot ? normalizeAgentMonitoringSnapshot(snapshot) : null;
}

function normalizeAgentMonitoringSnapshot(
  snapshot: TauriAgentMonitoringSnapshot,
): AgentMonitoringSnapshot {
  return {
    workspaceId: snapshot.workspace_id,
    workbenchId: snapshot.workbench_id,
    proposalResults: snapshot.proposal_results.map(
      normalizeAgentMonitoringProposalResult,
    ),
  };
}

function normalizeAgentMonitoringProposalResult(
  result: TauriAgentMonitoringProposalResult,
): AgentMonitoringProposalResult {
  return {
    runId: result.run_id,
    resultId: result.result_id,
    status: result.status,
    resultType: result.result_type,
    resultSummary: result.result_summary,
    resultContent: result.result_content,
    runStartedAt: result.run_started_at,
    runFinishedAt: result.run_finished_at,
    resultCreatedAt: result.result_created_at,
    sourceWidgetId: result.source_widget_id,
    sourceWidgetTitle: result.source_widget_title,
    runtimeStatus: result.runtime_status,
    providerStatus: result.provider_status,
    providerUsed: result.provider_used,
    providerResponseReceived: result.provider_response_received,
    noLlmCalled: result.no_llm_called,
    noToolsExecuted: result.no_tools_executed,
    noMutationsPerformed: result.no_mutations_performed,
    contextWasApproved: result.context_was_approved,
    operatorPrompt: result.operator_prompt,
    proposalSummary: result.proposal_summary,
    proposedPlan: result.proposed_plan,
    contextNeeded: result.context_needed,
    approvedContextSummary: result.approved_context_summary,
    approvedContextStatus: result.approved_context_status,
    approvedContextSourceLabels: result.approved_context_source_labels,
    proposedActions: result.proposed_actions.map((action) => ({
      title: action.title,
      description: action.description,
      status: action.status,
      executed: action.executed,
    })),
    safetyNotes: result.safety_notes,
    rawPayload: result.raw_payload,
  };
}
