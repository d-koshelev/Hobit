import { invoke } from "@tauri-apps/api/core";
import type {
  CoordinatorProviderProposalDraftContext,
  CoordinatorProviderVisibleInput,
  GenerateCoordinatorProviderResponse,
  GenerateCoordinatorProviderResponseRequest,
} from "./types";

type TauriGenerateCoordinatorProviderResponse = {
  request_id: string;
  assistant_text: string;
  provider_kind: string;
  provider_status: string;
  provider_error: string | null;
  allowed_tools: string[];
  visible_context_message_count: number;
  visible_proposal_draft_count: number;
  proposal_drafts: TauriCoordinatorProviderProposalDraftContext[];
  no_tools_executed: boolean;
  no_mutations_performed: boolean;
  no_hidden_context_used: boolean;
};

type TauriCoordinatorProviderProposalDraftContext = {
  id: string;
  type_id: string;
  title: string;
  target_widget: string;
  target_capability: string;
  intent: string;
  visible_inputs: TauriCoordinatorProviderVisibleInput[];
  risk_notes: string[];
  expected_result: string;
};

type TauriCoordinatorProviderVisibleInput = {
  label: string;
  value: string;
};

export async function generateCoordinatorProviderResponse(
  request: GenerateCoordinatorProviderResponseRequest,
): Promise<GenerateCoordinatorProviderResponse | null> {
  const response =
    await invoke<TauriGenerateCoordinatorProviderResponse | null>(
      "generate_coordinator_provider_response",
      {
        request: {
          workspace_id: request.workspaceId,
          workbench_id: request.workbenchId,
          widget_instance_id: request.widgetInstanceId,
          operator_message: request.operatorMessage,
          visible_conversation: request.visibleConversation.map((message) => ({
            id: message.id,
            role: message.role,
            body: message.body,
          })),
          visible_proposal_drafts: request.visibleProposalDrafts.map(
            (proposal) => ({
              id: proposal.id,
              type_id: proposal.typeId,
              title: proposal.title,
              target_widget: proposal.targetWidget,
              target_capability: proposal.targetCapability,
              intent: proposal.intent,
              visible_inputs: proposal.visibleInputs.map((input) => ({
                label: input.label,
                value: input.value,
              })),
              risk_notes: proposal.riskNotes,
              expected_result: proposal.expectedResult,
            }),
          ),
        },
      },
    );

  return response ? normalizeCoordinatorProviderResponse(response) : null;
}

function normalizeCoordinatorProviderResponse(
  response: TauriGenerateCoordinatorProviderResponse,
): GenerateCoordinatorProviderResponse {
  return {
    requestId: response.request_id,
    assistantText: response.assistant_text,
    providerKind: response.provider_kind,
    providerStatus: response.provider_status,
    providerError: response.provider_error,
    allowedTools: response.allowed_tools,
    visibleContextMessageCount: response.visible_context_message_count,
    visibleProposalDraftCount: response.visible_proposal_draft_count,
    proposalDrafts: response.proposal_drafts.map(normalizeProposalDraft),
    noToolsExecuted: response.no_tools_executed,
    noMutationsPerformed: response.no_mutations_performed,
    noHiddenContextUsed: response.no_hidden_context_used,
  };
}

function normalizeProposalDraft(
  proposal: TauriCoordinatorProviderProposalDraftContext,
): CoordinatorProviderProposalDraftContext {
  return {
    id: proposal.id,
    typeId: proposal.type_id,
    title: proposal.title,
    targetWidget: proposal.target_widget,
    targetCapability: proposal.target_capability,
    intent: proposal.intent,
    visibleInputs: proposal.visible_inputs.map(normalizeVisibleInput),
    riskNotes: proposal.risk_notes,
    expectedResult: proposal.expected_result,
  };
}

function normalizeVisibleInput(
  input: TauriCoordinatorProviderVisibleInput,
): CoordinatorProviderVisibleInput {
  return {
    label: input.label,
    value: input.value,
  };
}
