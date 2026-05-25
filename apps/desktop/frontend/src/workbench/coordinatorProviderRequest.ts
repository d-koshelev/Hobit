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

  return coordinatorProviderDisplayText(response, localFallback);
}

function coordinatorProviderDisplayText(
  response: NonNullable<CoordinatorProviderResponse>,
  localFallback: string,
) {
  const text = response.assistantText.trim();

  if (!text) {
    return localFallback;
  }

  if (response.providerKind === "mock-local") {
    if (
      /Mock Coordinator provider response|I received your explicit message|allowed_tools/i.test(
        text,
      )
    ) {
      return mockLocalDisplayText(response, localFallback);
    }
  }

  return sanitizedProviderText(text) || localFallback;
}

function mockLocalDisplayText(
  response: NonNullable<CoordinatorProviderResponse>,
  localFallback: string,
) {
  if (response.proposalDrafts.length > 0) {
    return "I drafted reviewable cards from the visible chat. Review the cards below before approving or creating anything.";
  }

  if (localFallback.trim()) {
    return localFallback;
  }

  return "I can help plan work, draft Queue tasks, or review pasted results. This workspace does not have a live time tool connected.";
}

function sanitizedProviderText(text: string) {
  return text
    .replace(/\bMock Coordinator provider response\.?\s*/gi, "")
    .replace(/\bI received your explicit message:\s*"[^"]*"\.?\s*/gi, "")
    .replace(/\bTools are disabled with allowed_tools:\s*\[\],?\s*/gi, "")
    .replace(/\ballowed_tools was empty and\s*/gi, "")
    .replace(/\ballowed_tools:\s*\[\]\.?,?\s*/gi, "")
    .replace(/\s{2,}/g, " ")
    .trim();
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

export function coordinatorProviderModeLabel(
  response: CoordinatorProviderResponse,
) {
  if (!response) {
    return "Local fallback";
  }

  if (response.providerStatus === "not_configured") {
    return "Not configured";
  }

  if (response.providerKind === "mock-local") {
    return "Mock/local provider";
  }

  if (response.providerStatus === "unsupported") {
    return "Configured provider unavailable";
  }

  if (response.providerStatus === "timeout") {
    return "Provider timeout";
  }

  if (response.providerStatus === "invalid_response") {
    return "Invalid provider response";
  }

  if (response.providerStatus === "provider_error") {
    return "Provider error";
  }

  if (response.providerStatus === "network_failure") {
    return "Network failure";
  }

  if (response.providerStatus === "request_too_large") {
    return "Request too large";
  }

  return "Configured provider";
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
    const label = coordinatorProviderStatusLabel(
      response.providerStatus,
      response.providerKind,
    );
    const isHardProviderFailure =
      response.providerStatus === "provider_error" ||
      response.providerStatus === "network_failure";

    return {
      badgeVariant: isHardProviderFailure ? "error" : "warning",
      detail: `${response.providerError ?? "Provider did not complete."} ${contextSummary} Tools stayed disabled.`,
      label,
      tone: isHardProviderFailure ? "error" : "warning",
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

function coordinatorProviderStatusLabel(
  providerStatus: string,
  providerKind: string,
) {
  switch (providerStatus) {
    case "not_configured":
      return "Not configured";
    case "unsupported":
      return "Unsupported";
    case "timeout":
      return "Timeout";
    case "invalid_response":
      return "Invalid response";
    case "provider_error":
      return "Provider error";
    case "network_failure":
      return "Network failure";
    case "request_too_large":
      return "Request too large";
    default:
      return `${providerKind} ${providerStatus}`;
  }
}
