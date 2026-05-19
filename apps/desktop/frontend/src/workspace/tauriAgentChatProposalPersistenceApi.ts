import { invoke } from "@tauri-apps/api/core";
import type {
  PersistAgentChatProposalRequest,
  PersistAgentChatProposalResponse,
} from "./types";

type TauriPersistAgentChatProposalResponse = {
  run_id: string;
  status: string;
  result_id: string;
  result_type: string;
  summary: string;
};

export async function persistAgentChatProposal(
  request: PersistAgentChatProposalRequest,
): Promise<PersistAgentChatProposalResponse | null> {
  const response = await invoke<TauriPersistAgentChatProposalResponse | null>(
    "persist_agent_chat_proposal",
    {
      request: {
        workspace_id: request.workspaceId,
        workbench_id: request.workbenchId,
        widget_instance_id: request.widgetInstanceId,
        operator_prompt: request.operatorPrompt,
        approved_context_snapshot_json: request.approvedContextSnapshotJson,
        proposal: {
          id: request.proposal.id,
          request_summary: request.proposal.requestSummary,
          proposed_plan: request.proposal.proposedPlan,
          context_needed: request.proposal.contextNeeded,
          action_proposals: request.proposal.actionProposals.map((action) => ({
            title: action.title,
            description: action.description,
          })),
          safety_notes: request.proposal.safetyNotes,
          runtime_notes: request.proposal.runtimeNotes,
        },
      },
    },
  );

  return response ? normalizePersistAgentChatProposalResponse(response) : null;
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
