import {
  COORDINATOR_ACTION_PROPOSAL_REGISTRY,
  type CoordinatorActionProposal,
  type CoordinatorProposalTypeDefinition,
} from "./coordinatorActionProposalRegistry";
import {
  docsKnowledgeGenerationSourceRefs,
  formatKnowledgeGenerationSourceRefs,
  historyKnowledgeGenerationQueueTaskPrompt,
} from "./workspaceAgentQueuePromptTemplates";

const LABELED_VALUE_BOUNDARY = [
  "title",
  "task title",
  "description",
  "docs",
  "doc",
  "documentation",
  "path",
  "paths",
  "source",
  "sources",
  "selected docs",
  "selected path",
  "history",
  "selected history",
  "coordinator history",
  "workspace agent transcript",
  "agent transcript",
  "command history",
  "command summaries",
  "run history",
  "run summaries",
  "queue history",
  "queue reports",
  "terminal history",
  "terminal excerpt",
  "executor history",
  "executor summary",
  "external runner summary",
  "source refs",
  "prompt",
  "body",
  "goal",
  "priority",
].join("|");

const KNOWLEDGE_FROM_DOCS_INTENT_PATTERNS = [
  /\bcreate\s+knowledge\s+from\s+docs?\b/i,
  /\bgenerate\s+(?:documentation\s+)?knowledge\s+from\s+docs?\b/i,
  /\bturn\s+(?:selected\s+)?docs?\s+into\s+(?:draft\s+)?knowledge\b/i,
  /\bdocs?\s+(?:to|into)\s+(?:draft\s+)?knowledge\b/i,
  /\bknowledge\s+generation\s+(?:from|for)\s+docs?\b/i,
];

const KNOWLEDGE_FROM_HISTORY_INTENT_PATTERNS = [
  /\bcreate\s+knowledge\s+from\s+(?:recent\s+)?(?:coordinator|workspace\s+agent|agent|command|terminal|run|executor|queue|history)\s*(?:history|transcript|summar(?:y|ies)|reports?|excerpts?)?\b/i,
  /\bgenerate\s+(?:draft\s+)?knowledge\s+from\s+(?:recent\s+)?(?:coordinator|workspace\s+agent|agent|command|terminal|run|executor|queue|history)\s*(?:history|transcript|summar(?:y|ies)|reports?|excerpts?)?\b/i,
  /\bsummar(?:ize|ise)\s+(?:recent\s+)?(?:coordinator|workspace\s+agent|agent|command|terminal|run|executor|queue)\s+(?:history|transcript|summar(?:y|ies)|reports?|excerpts?)\s+into\s+(?:draft\s+)?knowledge\b/i,
  /\b(?:coordinator|workspace\s+agent|agent|command|terminal|run|executor|queue)\s+(?:history|transcript|summar(?:y|ies)|reports?|excerpts?)\s+(?:to|into)\s+(?:draft\s+)?knowledge\b/i,
];

export function localKnowledgeGenerationProposal({
  normalizedMessage,
  proposalIndex,
  sourceMessageId,
  visibleMessage,
}: {
  normalizedMessage: string;
  proposalIndex: number;
  sourceMessageId: string;
  visibleMessage: string;
}) {
  const shouldCreateKnowledgeFromDocs = matchesAny(
    normalizedMessage,
    KNOWLEDGE_FROM_DOCS_INTENT_PATTERNS,
  );
  const shouldCreateKnowledgeFromHistory = matchesAny(
    normalizedMessage,
    KNOWLEDGE_FROM_HISTORY_INTENT_PATTERNS,
  );

  if (shouldCreateKnowledgeFromDocs) {
    return {
      proposal: createDocsKnowledgeQueueProposal(
        visibleMessage,
        normalizedMessage,
        sourceMessageId,
        proposalIndex,
      ),
      shouldCreatePlan: true,
    };
  }

  if (shouldCreateKnowledgeFromHistory) {
    return {
      proposal: createHistoryKnowledgeQueueProposal(
        visibleMessage,
        normalizedMessage,
        sourceMessageId,
        proposalIndex,
      ),
      shouldCreatePlan: true,
    };
  }

  return {
    proposal: null,
    shouldCreatePlan: false,
  };
}

function createDocsKnowledgeQueueProposal(
  visibleMessage: string,
  normalizedMessage: string,
  sourceMessageId: string,
  index = 0,
): CoordinatorActionProposal {
  const definition = proposalTypeDefinition();
  const sourceRefs = docsKnowledgeSourceRefs(normalizedMessage);
  const title =
    extractLabeledValue(normalizedMessage, ["title", "task title"]) ||
    "Generate documentation Knowledge drafts";

  return {
    approvalStatus: "Pending preview",
    executionStatus: "Not run",
    expectedResult:
      "A manual draft Queue task can be created to generate draft Knowledge items from the listed docs/path only. It does not run or activate Knowledge.",
    id: `${sourceMessageId}-docs-knowledge-queue-task-${index}`,
    inputs: [
      { label: "Title", value: title },
      {
        label: "Description",
        value: `Generate draft Knowledge items from selected documentation refs: ${sourceRefs}`,
      },
      { label: "Source docs/path", value: sourceRefs },
      { label: "Prompt", value: docsKnowledgeQueuePrompt(sourceRefs) },
      { label: "Priority", value: "1" },
      { label: "Policy", value: "manual" },
    ],
    intent:
      "Create a manual Agent Queue task that asks a future worker to turn explicitly selected documentation into draft Knowledge items.",
    resultSummary:
      "Drafted locally from explicit chat text. No docs were read and no Queue task or Knowledge item has been created yet.",
    riskLevel: definition.riskLevel,
    riskNotes: [
      ...definition.safetyNotes,
      "Workspace Agent did not scan docs or read files; it only copied the visible docs/path refs into a Queue task draft.",
      "The Queue task must use only the listed source refs and explicit operator-provided context.",
      "Generated Knowledge must remain draft/disabled until separate operator review and acceptance.",
      "No automatic Knowledge activation, Queue execution, Agent Executor handoff, or hidden ingestion.",
      `Original visible request: ${truncateForRiskNote(visibleMessage)}`,
    ],
    targetCapability: definition.targetCapability,
    targetWidget: definition.targetWidget,
    title,
    typeId: definition.typeId,
  };
}

function createHistoryKnowledgeQueueProposal(
  visibleMessage: string,
  normalizedMessage: string,
  sourceMessageId: string,
  index = 0,
): CoordinatorActionProposal {
  const definition = proposalTypeDefinition();
  const sourceRefs = historyKnowledgeSourceRefs(normalizedMessage);
  const draft = historyKnowledgeGenerationQueueTaskPrompt(normalizedMessage);
  const title =
    extractLabeledValue(normalizedMessage, ["title", "task title"]) ||
    draft.title;

  return {
    approvalStatus: "Pending preview",
    executionStatus: "Not run",
    expectedResult:
      "A manual draft Queue task can be created to generate draft Knowledge items from selected history summaries only. It does not run or activate Knowledge.",
    id: `${sourceMessageId}-history-knowledge-queue-task-${index}`,
    inputs: [
      { label: "Title", value: title },
      {
        label: "Description",
        value: draft.description,
      },
      { label: "Source history refs", value: sourceRefs },
      { label: "Prompt", value: draft.prompt },
      { label: "Priority", value: "1" },
      { label: "Policy", value: "manual" },
    ],
    intent:
      "Create a manual Agent Queue task that asks a future worker to turn explicitly selected coordinator, command, or run history summaries into draft Knowledge items.",
    resultSummary:
      "Drafted locally from explicit chat text. No history, logs, transcripts, Queue reports, Terminal output, or Executor output were read automatically.",
    riskLevel: definition.riskLevel,
    riskNotes: [
      ...definition.safetyNotes,
      "Workspace Agent did not auto-read transcript, Queue, Terminal, Executor, Agent Activity, files, logs, or hidden Workspace state.",
      "The Queue task must use only the listed source refs and explicit operator-provided context.",
      "Terminal history, raw Executor output, provider responses, Git diffs, repo paths, and secrets must be omitted unless explicitly selected under a later safe policy.",
      "Generated Knowledge must remain draft/disabled until separate operator review and acceptance.",
      "No automatic Knowledge activation, Queue execution, Agent Executor handoff, or hidden ingestion.",
      `Original visible request: ${truncateForRiskNote(visibleMessage)}`,
    ],
    targetCapability: definition.targetCapability,
    targetWidget: definition.targetWidget,
    title,
    typeId: definition.typeId,
  };
}

function docsKnowledgeSourceRefs(message: string) {
  const labeledSource =
    extractLabeledValue(message, ["selected docs", "docs", "documentation"]) ||
    extractLabeledValue(message, ["selected path", "path", "paths"]) ||
    extractLabeledValue(message, ["source", "sources"]);

  if (labeledSource) {
    return labeledSource;
  }

  const fromDocsMatch = message.match(
    /\bfrom\s+(?:docs?|documentation|path|paths)\s+([^\n;]+)$/i,
  );
  const sourceRefs = fromDocsMatch?.[1]?.trim();

  if (sourceRefs) {
    return sourceRefs;
  }

  return "Not selected yet. Edit this task to list the approved documentation paths, imported docs, decisions, contracts, README sections, or external refs before running.";
}

function historyKnowledgeSourceRefs(message: string) {
  const labeledSource =
    extractLabeledValue(message, [
      "selected history",
      "history",
      "coordinator history",
      "workspace agent transcript",
      "agent transcript",
    ]) ||
    extractLabeledValue(message, [
      "command history",
      "command summaries",
      "run history",
      "run summaries",
      "queue history",
      "queue reports",
      "terminal history",
      "terminal excerpt",
      "executor history",
      "executor summary",
      "external runner summary",
    ]) ||
    extractLabeledValue(message, ["source refs", "source", "sources"]);

  if (labeledSource) {
    return labeledSource;
  }

  const fromHistoryMatch = message.match(
    /\bfrom\s+(?:recent\s+)?(?:coordinator|workspace\s+agent|agent|command|terminal|run|executor|queue|history)\s*(?:history|transcript|summar(?:y|ies)|reports?|excerpts?)?\s+([^\n;]+)$/i,
  );
  const sourceRefs = fromHistoryMatch?.[1]?.trim();

  if (sourceRefs) {
    return sourceRefs;
  }

  return "Not selected yet. Edit this task to list the approved visible transcript excerpts, Queue task/report summaries, validation or command summaries, selected Terminal excerpts, Executor run summaries, Agent Activity summaries, or external runner summary files before running.";
}

function docsKnowledgeQueuePrompt(sourceRefs: string) {
  return [
    "Task type: knowledge_generation",
    "Workflow: create Knowledge from docs",
    "",
    "Selected source refs:",
    sourceRefs,
    "",
    formatKnowledgeGenerationSourceRefs(
      docsKnowledgeGenerationSourceRefs(sourceRefs),
    ),
    "",
    "Use only the listed source refs and explicit operator-provided context in this Queue task. Do not scan folders, read unlisted files, use hidden Workspace state, inspect Notes, logs, Git/JDBC/Terminal/Executor output, or substitute extra sources.",
    "",
    "Analyze the selected docs/path and return draft Knowledge items only. Do not create Knowledge Documents, activate Knowledge, enable Knowledge, mutate files, mutate Git, assign/run Executor work, or dispatch Queue tasks.",
    "",
    "Draft item requirements:",
    "- overview",
    "- component responsibilities",
    "- acceptance criteria",
    "- non-goals",
    "- known gaps",
    "- related docs index",
    "- quick summaries",
    "",
    "Preserve source attribution. Distinguish current, planned, deferred, compatibility, deprecated, and superseded language when sources use those statuses.",
    "",
    "Return a bounded draft pack with proposed items containing title, quickSummary, fullContent, suggestedType, suggestedTags, suggestedScope, sourceRefs, confidence, blockers, reviewNotes, related docs/files/tasks/commits where explicit, and activationRecommendation. Default suggestedScope to workspace-local and activationRecommendation to draft/disabled unless the operator later accepts it separately.",
  ].join("\n");
}

function proposalTypeDefinition(): CoordinatorProposalTypeDefinition {
  const definition = COORDINATOR_ACTION_PROPOSAL_REGISTRY.find(
    (proposalType) => proposalType.typeId === "create-agent-queue-task",
  );

  if (!definition) {
    throw new Error("Missing Workspace Agent proposal type: create-agent-queue-task");
  }

  return definition;
}

function matchesAny(message: string, patterns: RegExp[]) {
  return patterns.some((pattern) => pattern.test(message));
}

function extractLabeledValue(message: string, labels: string[]) {
  for (const label of labels) {
    const pattern = new RegExp(
      `\\b${escapeRegExp(label)}\\s*[:=]\\s*(?:"([^"]+)"|'([^']+)'|([\\s\\S]*?)(?=(?:\\s+\\b(?:${LABELED_VALUE_BOUNDARY})\\s*[:=])|[;\\n]|$))`,
      "i",
    );
    const match = message.match(pattern);
    const value = match?.[1] ?? match?.[2] ?? match?.[3];

    if (value?.trim()) {
      return value.trim();
    }
  }

  return "";
}

function truncateForRiskNote(value: string) {
  const normalized = normalizeWhitespace(value);
  return normalized.length <= 180
    ? normalized
    : `${normalized.slice(0, 177).trim()}...`;
}

function normalizeWhitespace(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
