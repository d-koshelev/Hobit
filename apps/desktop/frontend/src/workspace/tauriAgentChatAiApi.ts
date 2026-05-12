import { invoke } from "@tauri-apps/api/core";
import type {
  GenerateAgentChatAiProposalRequest,
  GenerateAgentChatAiProposalResponse,
  PersistAgentChatProposalResponse,
} from "./types";

type TauriGenerateAgentChatAiProposalResponse = {
  run: TauriPersistAgentChatProposalResponse;
  proposal: TauriAgentChatProposalPayload;
  runtime_status: string;
  provider_status: string;
  provider_used: boolean;
  provider_response_received: boolean;
  no_tools_executed: boolean;
  no_mutations_performed: boolean;
  context_was_approved: boolean;
  normalization_warnings: string[];
};

type TauriPersistAgentChatProposalResponse = {
  run_id: string;
  status: string;
  result_id: string;
  result_type: string;
  summary: string;
};

type TauriAgentChatProposalPayload = {
  id: string;
  request_summary: string;
  proposed_plan: string[];
  context_needed: string[];
  action_proposals: TauriAgentChatProposalActionPayload[];
  safety_notes: string[];
  runtime_notes: string[];
};

type TauriAgentChatProposalActionPayload = {
  title: string;
  description: string;
};

export async function generateAgentChatAiProposal(
  request: GenerateAgentChatAiProposalRequest,
): Promise<GenerateAgentChatAiProposalResponse | null> {
  const response = await invoke<TauriGenerateAgentChatAiProposalResponse | null>(
    "generate_agent_chat_ai_proposal",
    {
      request: {
        workspace_id: request.workspaceId,
        workbench_id: request.workbenchId,
        widget_instance_id: request.widgetInstanceId,
        operator_prompt: request.operatorPrompt,
        approved_context_snapshot_json: request.approvedContextSnapshotJson,
      },
    },
  );

  return response ? normalizeGenerateAgentChatAiProposalResponse(response) : null;
}

function normalizeGenerateAgentChatAiProposalResponse(
  response: TauriGenerateAgentChatAiProposalResponse,
): GenerateAgentChatAiProposalResponse {
  return {
    run: normalizePersistAgentChatProposalResponse(response.run),
    proposal: {
      actionProposals: response.proposal.action_proposals.map((action) => ({
        description: action.description,
        title: action.title,
      })),
      contextNeeded: response.proposal.context_needed,
      id: response.proposal.id,
      proposedPlan: response.proposal.proposed_plan,
      requestSummary: response.proposal.request_summary,
      runtimeNotes: response.proposal.runtime_notes,
      safetyNotes: response.proposal.safety_notes,
    },
    runtimeStatus: response.runtime_status,
    providerStatus: response.provider_status,
    providerUsed: response.provider_used,
    providerResponseReceived: response.provider_response_received,
    noToolsExecuted: response.no_tools_executed,
    noMutationsPerformed: response.no_mutations_performed,
    contextWasApproved: response.context_was_approved,
    normalizationWarnings: response.normalization_warnings,
  };
}

function normalizePersistAgentChatProposalResponse(
  response: TauriPersistAgentChatProposalResponse,
): PersistAgentChatProposalResponse {
  return {
    runId: response.run_id,
    status: response.status,
    resultId: response.result_id,
    resultType: response.result_type,
    summary: response.summary,
  };
}
