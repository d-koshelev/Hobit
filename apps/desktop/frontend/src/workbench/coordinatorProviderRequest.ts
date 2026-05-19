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

export type CoordinatorProviderMessageMeta = {
  badgeVariant: "neutral" | "info" | "success" | "warning" | "error";
  detail: string;
  label: string;
  tone: "neutral" | "pending" | "success" | "warning" | "error";
};

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

export function coordinatorProviderAssistantText(
  response: CoordinatorProviderResponse,
  localFallback: string,
) {
  if (!response) {
    return localFallback;
  }

  return response.assistantText;
}

export function coordinatorProviderPendingMeta(
  proposalDraftCount: number,
): CoordinatorProviderMessageMeta {
  return {
    badgeVariant: "warning",
    detail: proposalDraftCount
      ? `${proposalDraftCount} visible local proposal summar${
          proposalDraftCount === 1 ? "y" : "ies"
        } included for review context.`
      : "Visible chat context only; no local proposal summaries included.",
    label: "Drafting",
    tone: "pending",
  };
}

export function coordinatorProviderFallbackMeta(
  detail: string,
): CoordinatorProviderMessageMeta {
  return {
    badgeVariant: "neutral",
    detail,
    label: "Local fallback",
    tone: "neutral",
  };
}

export function coordinatorProviderErrorMeta(
  detail: string,
): CoordinatorProviderMessageMeta {
  return {
    badgeVariant: "error",
    detail,
    label: "Provider error",
    tone: "error",
  };
}

export function coordinatorProviderResponseMeta(
  response: CoordinatorProviderResponse,
): CoordinatorProviderMessageMeta {
  if (!response) {
    return coordinatorProviderFallbackMeta(
      "Mock/local provider returned no response. Local deterministic fallback remained in use.",
    );
  }

  const toolsDisabled = response.allowedTools.length === 0;
  const boundarySatisfied =
    toolsDisabled &&
    response.noToolsExecuted &&
    response.noMutationsPerformed &&
    response.noHiddenContextUsed;
  const contextSummary = `${response.visibleContextMessageCount} visible message${
    response.visibleContextMessageCount === 1 ? "" : "s"
  }, ${response.visibleProposalDraftCount} proposal summar${
    response.visibleProposalDraftCount === 1 ? "y" : "ies"
  }.`;
  const providerDraftSummary = `${response.proposalDrafts.length} validated provider draft${
    response.proposalDrafts.length === 1 ? "" : "s"
  }.`;

  if (response.providerStatus !== "completed") {
    return {
      badgeVariant: "warning",
      detail: `${response.providerError ?? "Provider did not complete."} ${contextSummary} Tools stayed disabled.`,
      label: `${response.providerKind} ${response.providerStatus}`,
      tone: "warning",
    };
  }

  return {
    badgeVariant: boundarySatisfied ? "success" : "warning",
    detail: boundarySatisfied
      ? `${contextSummary} ${providerDraftSummary} allowed_tools: []; no tools, mutations, or hidden context.`
      : `${contextSummary} ${providerDraftSummary} Provider safety flags were incomplete; treat as untrusted draft.`,
    label: response.providerKind,
    tone: boundarySatisfied ? "success" : "warning",
  };
}
