import {
  COORDINATOR_ACTION_PROPOSAL_REGISTRY,
  type CoordinatorActionProposal,
  type CoordinatorProposalInput,
  type CoordinatorProposalTypeDefinition,
  type CoordinatorProposalTypeId,
} from "./coordinatorActionProposalRegistry";
import type {
  CoordinatorProviderProposalDraftContext,
  GenerateCoordinatorProviderResponse,
} from "../workspace/types/coordinatorProvider";

export type ProviderDraftProposalResult = {
  proposals: CoordinatorActionProposal[];
  rejectedCount: number;
};

const PROVIDER_DRAFT_SUMMARY =
  "Provider draft from visible chat. Review or edit before approval; no action has run.";

const SQL_PLACEHOLDER = [
  "-- Edit this visible SQL suggestion before use.",
  "-- Coordinator did not inspect connectors, schemas, or database data.",
].join("\n");

export function coordinatorProviderDraftProposals(
  response: GenerateCoordinatorProviderResponse | null,
  sourceMessageId: string,
): ProviderDraftProposalResult {
  if (!response || response.providerStatus !== "completed") {
    return { proposals: [], rejectedCount: 0 };
  }

  let rejectedCount = 0;
  const proposals: CoordinatorActionProposal[] = [];

  response.proposalDrafts.forEach((draft, index) => {
    const proposal = providerDraftToProposal(draft, sourceMessageId, index);

    if (proposal) {
      proposals.push(proposal);
    } else {
      rejectedCount += 1;
    }
  });

  return { proposals, rejectedCount };
}

function providerDraftToProposal(
  draft: CoordinatorProviderProposalDraftContext,
  sourceMessageId: string,
  index: number,
): CoordinatorActionProposal | null {
  if (!isProposalTypeId(draft.typeId) || hasUnsafeTarget(draft)) {
    return null;
  }

  const definition = proposalDefinition(draft.typeId);
  if (!matchesTarget(draft, definition)) {
    return null;
  }

  const inputs = normalizedInputs(draft, definition);
  if (!inputs) {
    return null;
  }

  return {
    approvalStatus: "Pending preview",
    executionStatus:
      draft.typeId === "prepare-jdbc-query-suggestion"
        ? "SQL suggestion only"
        : "Not run",
    expectedResult:
      draft.expectedResult.trim() || defaultExpectedResult(draft.typeId),
    id: `${sourceMessageId}-provider-${draft.typeId}-${index}`,
    inputs,
    intent: draft.intent.trim() || defaultIntent(draft.typeId),
    resultSummary: PROVIDER_DRAFT_SUMMARY,
    riskLevel: definition.riskLevel,
    riskNotes: riskNotes(draft, definition),
    targetCapability: definition.targetCapability,
    targetWidget: definition.targetWidget,
    title: draft.title.trim() || titleInputValue(inputs) || definition.displayName,
    typeId: draft.typeId,
  };
}

function normalizedInputs(
  draft: CoordinatorProviderProposalDraftContext,
  definition: CoordinatorProposalTypeDefinition,
): CoordinatorProposalInput[] | null {
  if (definition.typeId === "create-agent-queue-task") {
    const title = requiredInput(draft, "Title");
    const description = requiredInput(draft, "Description");
    const prompt = requiredInput(draft, "Prompt");

    if (!title || !description || !prompt) {
      return null;
    }

    return [
      { label: "Title", value: title },
      { label: "Description", value: description },
      { label: "Prompt", value: prompt },
      {
        label: "Priority",
        value: clampPriority(optionalInput(draft, "Priority")).toString(),
      },
      {
        label: "Policy",
        value: normalizeExecutionPolicy(optionalInput(draft, "Policy")),
      },
    ];
  }

  if (definition.typeId === "create-note") {
    const title = requiredInput(draft, "Title");
    const body = requiredInput(draft, "Body");

    if (!title || !body) {
      return null;
    }

    return [
      { label: "Title", value: title },
      { label: "Body", value: body },
      { label: "Pinned", value: normalizePinned(optionalInput(draft, "Pinned")) },
    ];
  }

  const question = optionalInput(draft, "Question") || draft.intent.trim();
  const connectorLabel = optionalInput(draft, "Connector label");
  const inputs: CoordinatorProposalInput[] = [
    { label: "Question", value: question || "Review this SQL suggestion." },
  ];

  if (connectorLabel) {
    inputs.push({ label: "Connector label", value: connectorLabel });
  }

  inputs.push({
    label: "Suggested SQL text",
    value: optionalInput(draft, "Suggested SQL text") || SQL_PLACEHOLDER,
  });

  return inputs;
}

function riskNotes(
  draft: CoordinatorProviderProposalDraftContext,
  definition: CoordinatorProposalTypeDefinition,
) {
  const notes = draft.riskNotes
    .map((note) => note.trim())
    .filter(Boolean);

  return notes.length > 0
    ? notes
    : [
        ...definition.safetyNotes,
        "Provider draft was validated before rendering.",
      ];
}

function requiredInput(
  draft: CoordinatorProviderProposalDraftContext,
  label: string,
) {
  return optionalInput(draft, label) || "";
}

function optionalInput(
  draft: CoordinatorProviderProposalDraftContext,
  label: string,
) {
  return (
    draft.visibleInputs
      .find((input) => input.label.toLowerCase() === label.toLowerCase())
      ?.value.trim() ?? ""
  );
}

function isProposalTypeId(value: string): value is CoordinatorProposalTypeId {
  return COORDINATOR_ACTION_PROPOSAL_REGISTRY.some(
    (definition) => definition.typeId === value,
  );
}

function proposalDefinition(typeId: CoordinatorProposalTypeId) {
  return COORDINATOR_ACTION_PROPOSAL_REGISTRY.find(
    (definition) => definition.typeId === typeId,
  ) as CoordinatorProposalTypeDefinition;
}

function matchesTarget(
  draft: CoordinatorProviderProposalDraftContext,
  definition: CoordinatorProposalTypeDefinition,
) {
  return (
    draft.targetWidget.toLowerCase() === definition.targetWidget.toLowerCase() &&
    draft.targetCapability.toLowerCase() ===
      definition.targetCapability.toLowerCase()
  );
}

function hasUnsafeTarget(draft: CoordinatorProviderProposalDraftContext) {
  const target = [
    draft.typeId,
    draft.targetWidget,
    draft.targetCapability,
    draft.intent,
  ]
    .join(" ")
    .toLowerCase();

  return [
    "terminal",
    "git",
    "agent executor",
    "queue dispatch",
    "auto-dispatch",
    "start queue",
    "run queue",
    "execute sql",
    "run sql",
    "filesystem",
    "secret",
    "environment variable",
  ].some((needle) => target.includes(needle));
}

function defaultExpectedResult(typeId: CoordinatorProposalTypeId) {
  if (typeId === "create-agent-queue-task") {
    return "A draft Queue task can be created only after approval plus a separate Create Queue task action.";
  }
  if (typeId === "create-note") {
    return "A workspace-local Note can be created only after approval plus a separate Create Note action.";
  }
  return "A SQL suggestion can be reviewed and copied, but it cannot execute SQL.";
}

function defaultIntent(typeId: CoordinatorProposalTypeId) {
  if (typeId === "create-agent-queue-task") {
    return "Create a draft Agent Queue task from visible chat text.";
  }
  if (typeId === "create-note") {
    return "Create a workspace-local Note from visible chat text.";
  }
  return "Prepare non-executing SQL suggestion text.";
}

function titleInputValue(inputs: CoordinatorProposalInput[]) {
  return inputs
    .find((input) => input.label.toLowerCase() === "title")
    ?.value.trim();
}

function clampPriority(value: string) {
  const priority = Number.parseInt(value, 10);

  if (!Number.isFinite(priority)) {
    return 0;
  }

  return Math.min(5, Math.max(0, priority));
}

function normalizePinned(value: string) {
  return ["true", "yes", "pinned", "1"].includes(value.trim().toLowerCase())
    ? "true"
    : "false";
}

function normalizeExecutionPolicy(value: string) {
  const normalized = value.trim().toLowerCase();

  if (
    normalized === "auto" ||
    normalized === "after_previous_success" ||
    normalized === "manual"
  ) {
    return normalized;
  }

  return "manual";
}
