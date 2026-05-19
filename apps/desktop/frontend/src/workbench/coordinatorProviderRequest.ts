import type { CoordinatorActionProposal } from "./coordinatorActionProposalRegistry";
import type { WidgetRenderProps } from "./types";

type CoordinatorProviderRequest = Parameters<
  NonNullable<WidgetRenderProps["onGenerateCoordinatorProviderResponse"]>
>[1];

type CoordinatorProviderVisibleMessage =
  CoordinatorProviderRequest["visibleConversation"][number];

type CoordinatorProviderProposalDraft =
  CoordinatorProviderRequest["visibleProposalDrafts"][number];

type CoordinatorProviderResponse = Awaited<
  ReturnType<NonNullable<WidgetRenderProps["onGenerateCoordinatorProviderResponse"]>>
>;

type CoordinatorChatMessage = {
  body: string;
  id: string;
  role: "operator" | "assistant";
};

export function coordinatorProviderMessage(
  message: CoordinatorChatMessage,
): CoordinatorProviderVisibleMessage {
  return {
    body: message.body,
    id: message.id,
    role: message.role,
  };
}

export function coordinatorProviderProposalDraftContext(
  proposal: CoordinatorActionProposal,
): CoordinatorProviderProposalDraft {
  return {
    expectedResult: proposal.expectedResult,
    id: proposal.id,
    intent: proposal.intent,
    riskNotes: proposal.riskNotes,
    targetCapability: proposal.targetCapability,
    targetWidget: proposal.targetWidget,
    title: proposal.title,
    typeId: proposal.typeId,
    visibleInputs: proposal.inputs.map((input) => ({
      label: input.label,
      value: input.value,
    })),
  };
}

export function coordinatorProviderResponseBody(
  response: CoordinatorProviderResponse,
  localFallback: string,
) {
  if (!response) {
    return `${localFallback} Mock/local provider returned no response. No tools or widget capabilities were executed.`;
  }

  const safetySummary =
    response.allowedTools.length === 0 &&
    response.noToolsExecuted &&
    response.noMutationsPerformed &&
    response.noHiddenContextUsed
      ? "Provider safety: allowed_tools is empty, no tools executed, and no hidden context was used."
      : "Provider safety flags were not all satisfied; treat this as a non-executing draft only.";

  const statusSummary =
    response.providerStatus === "completed"
      ? `Provider: ${response.providerKind}. ${safetySummary}`
      : `Provider: ${response.providerKind} (${response.providerStatus}). ${response.providerError ?? "No additional error detail."} ${safetySummary}`;

  return `${response.assistantText} ${statusSummary}`;
}
