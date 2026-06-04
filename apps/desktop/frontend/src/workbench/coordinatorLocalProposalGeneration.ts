import {
  COORDINATOR_ACTION_PROPOSAL_REGISTRY,
  type CoordinatorActionProposal,
  type CoordinatorProposalInput,
  type CoordinatorProposalTypeId,
  type CoordinatorProposalTypeDefinition,
} from "./coordinatorActionProposalRegistry";
import { catalogActionProposalsFromText } from "./coordinatorCatalogActionDrafts";

export type LocalProposalGenerationResult = {
  plan: CoordinatorPlanDraft | null;
  proposals: CoordinatorActionProposal[];
  review: CoordinatorOutcomeReviewDraft | null;
  responseBody: string;
};

export type CoordinatorPlanDraft = {
  goal: string;
  id: string;
  riskNotes: string[];
  steps: string[];
  suggestedNextActions: string[];
  title: string;
};

export type CoordinatorOutcomeReviewDraft = {
  id: string;
  likelyOutcome: string;
  nextActions: string[];
  observedSummary: string;
  risksBlockers: string[];
  statusInterpretation: "success" | "failure" | "unclear" | "needs review";
  title: string;
};

const NO_PROPOSAL_RESPONSE =
  "I can help plan work, draft Queue tasks, or review pasted results. This workspace does not have a live time tool connected.";

const GENERATED_PROPOSAL_RESPONSE =
  "I drafted reviewable proposal cards from your message. Review or edit the visible inputs before approval; approval does not execute by itself.";

const GENERATED_PLAN_RESPONSE =
  "I drafted a plan from the visible chat. Review the steps and decide whether any work should become a Queue task.";

const GENERATED_PLAN_AND_PROPOSAL_RESPONSE =
  "I drafted a plan and reviewable proposal cards from the visible chat. Review or edit visible fields before approval; approval does not execute by itself.";

const GENERATED_REVIEW_RESPONSE =
  "I reviewed the pasted result text and summarized what it appears to show. No Queue, Executor, validation logs, files, artifacts, or hidden context were read.";

const GENERATED_REVIEW_AND_PROPOSAL_RESPONSE =
  "I reviewed the pasted result text and drafted a follow-up Queue task card. Review or edit visible fields before approval; approval does not execute by itself.";

const MAX_TITLE_LENGTH = 72;
const MAX_LOCAL_QUEUE_DRAFTS = 4;
const LABELED_VALUE_BOUNDARY = [
  "title",
  "task title",
  "note title",
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
  "prompt",
  "body",
  "goal",
  "priority",
  "question",
  "sql",
  "query",
  "connector",
  "connector label",
].join("|");

const INTENT_PREFIX_PATTERN =
  /\b(create\s+(?:an?\s+)?(?:agent\s+)?queue\s+task|add\s+(?:an?\s+)?(?:agent\s+)?queue\s+task|make\s+(?:an?\s+)?task|create\s+(?:an?\s+)?note|save\s+(?:an?\s+)?note|write\s+(?:an?\s+)?note|prepare\s+sql|write\s+sql|suggest\s+(?:a\s+)?query)\b/gi;

const LABELED_PREFIX_PATTERN =
  /\b(title|task title|note title|prompt|body|sql|query)\s*[:=]/gi;

const QUEUE_INTENT_PATTERNS = [
  /\bcreate\s+(?:an?\s+)?(?:agent\s+)?queue\s+task\b/i,
  /\badd\s+(?:an?\s+)?(?:agent\s+)?queue\s+task\b/i,
  /\bmake\s+(?:an?\s+)?task\b/i,
  /\bbreak\s+(?:this|it|that|the\s+work|this\s+work)?[\s\S]*\bqueue\s+tasks?\b/i,
  /\bdraft\s+tasks?\s+for\b/i,
  /\bqueue\s+task\s+drafts?\b/i,
];

const KNOWLEDGE_FROM_DOCS_INTENT_PATTERNS = [
  /\bcreate\s+knowledge\s+from\s+docs?\b/i,
  /\bgenerate\s+(?:documentation\s+)?knowledge\s+from\s+docs?\b/i,
  /\bturn\s+(?:selected\s+)?docs?\s+into\s+(?:draft\s+)?knowledge\b/i,
  /\bdocs?\s+(?:to|into)\s+(?:draft\s+)?knowledge\b/i,
  /\bknowledge\s+generation\s+(?:from|for)\s+docs?\b/i,
];

const NOTE_INTENT_PATTERNS = [
  /\bcreate\s+(?:an?\s+)?note\b/i,
  /\bsave\s+(?:an?\s+)?note\b/i,
  /\bwrite\s+(?:an?\s+)?note\b/i,
];

const JDBC_INTENT_PATTERNS = [
  /\bprepare\s+sql\b/i,
  /\bwrite\s+sql\b/i,
  /\bsuggest\s+(?:a\s+)?query\b/i,
];

const OUTCOME_REVIEW_INTENT_PATTERNS = [
  /\breview\s+(?:pasted\s+)?(?:queue|executor|validation|result|output|failure)/i,
  /\bexplain\s+(?:this\s+)?executor\s+failure\b/i,
  /\bturn\s+this\s+result\s+into\s+next\s+steps\b/i,
  /\bdraft\s+follow-up\s+queue\s+tasks?\b/i,
  /\bsummarize\s+validation\s+output\b/i,
  /\bpaste\s+results?\s+here\s+to\s+analy[sz]e\b/i,
];

const FOLLOW_UP_QUEUE_INTENT_PATTERNS = [
  /\bdraft\s+follow-up\s+queue\s+tasks?\b/i,
  /\bturn\s+this\s+result\s+into\s+next\s+steps\b/i,
];

const PLAN_INTENT_PATTERNS = [
  /\bmake\s+(?:a\s+)?plan\b/i,
  /\bplan\s+(?:this|the|my|our)\b/i,
  /\bbreak\s+(?:this|it|that|the\s+work|this\s+work)\s+(?:down|into)\b/i,
  /\bdraft\s+tasks?\s+for\b/i,
  /\bexplain\s+how\s+to\s+execute\s+this\s+safely\b/i,
  /\bsuggest\s+next\s+actions\b/i,
];

export function generateLocalCoordinatorProposals(
  message: string,
  sourceMessageId: string,
): LocalProposalGenerationResult {
  const visibleMessage = message.trim();
  const normalizedMessage = normalizeWhitespace(message);
  const shouldCreateKnowledgeFromDocs = matchesAny(
    normalizedMessage,
    KNOWLEDGE_FROM_DOCS_INTENT_PATTERNS,
  );
  const shouldCreatePlan =
    shouldCreateKnowledgeFromDocs ||
    matchesAny(normalizedMessage, PLAN_INTENT_PATTERNS) ||
    matchesAny(normalizedMessage, QUEUE_INTENT_PATTERNS);
  const review = matchesAny(normalizedMessage, OUTCOME_REVIEW_INTENT_PATTERNS)
    ? createOutcomeReviewDraft(visibleMessage, normalizedMessage, sourceMessageId)
    : null;
  const plan = shouldCreatePlan
    ? createPlanDraft(visibleMessage, sourceMessageId)
    : null;
  const proposals: CoordinatorActionProposal[] = [];
  const catalogProposals = catalogActionProposalsFromText(
    visibleMessage,
    sourceMessageId,
    { includePlainTextIntents: true },
  );

  proposals.push(...catalogProposals);

  if (shouldCreateKnowledgeFromDocs) {
    proposals.push(
      createDocsKnowledgeQueueProposal(
        visibleMessage,
        normalizedMessage,
        sourceMessageId,
        proposals.length,
      ),
    );
  } else if (matchesAny(normalizedMessage, QUEUE_INTENT_PATTERNS)) {
    proposals.push(
      ...queueDraftsFromMessage(visibleMessage).map((draft, index) =>
        createQueueProposal(draft, sourceMessageId, index),
      ),
    );
  }

  if (review && shouldDraftOutcomeFollowUp(normalizedMessage, review)) {
    proposals.push(
      createQueueProposal(
        queueDraftFromOutcomeReview(visibleMessage, review),
        sourceMessageId,
        proposals.length,
      ),
    );
  }

  if (matchesAny(normalizedMessage, NOTE_INTENT_PATTERNS)) {
    proposals.push(createNoteProposal(normalizedMessage, sourceMessageId));
  }

  if (matchesAny(normalizedMessage, JDBC_INTENT_PATTERNS)) {
    proposals.push(
      createJdbcProposal(message, normalizedMessage, sourceMessageId),
    );
  }

  return {
    plan,
    proposals,
    review,
    responseBody: responseBodyFor(plan, review, proposals.length),
  };
}

function createDocsKnowledgeQueueProposal(
  visibleMessage: string,
  normalizedMessage: string,
  sourceMessageId: string,
  index = 0,
): CoordinatorActionProposal {
  const definition = proposalTypeDefinition("create-agent-queue-task");
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

function createQueueProposal(
  draft: QueueTaskDraft,
  sourceMessageId: string,
  index = 0,
): CoordinatorActionProposal {
  const definition = proposalTypeDefinition("create-agent-queue-task");
  const title = draft.title;

  return {
    approvalStatus: "Pending preview",
    executionStatus: "Not run",
    expectedResult:
      "A reviewed draft Queue task can be created after approval and a separate Create Queue task action. Creates a draft task. Does not run it.",
    id: `${sourceMessageId}-create-queue-task-${index}`,
    inputs: [
      { label: "Title", value: title },
      { label: "Description", value: draft.description },
      { label: "Prompt", value: draft.prompt },
      { label: "Priority", value: draft.priority },
      { label: "Policy", value: "manual" },
    ],
    intent:
      "Create a draft Agent Queue task from explicit operator text for later manual review.",
    resultSummary:
      "Drafted locally from explicit chat text. No Queue task has been created yet.",
    riskLevel: definition.riskLevel,
    riskNotes: [
      ...definition.safetyNotes,
      "Proposal generation used only this chat message.",
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

function docsKnowledgeQueuePrompt(sourceRefs: string) {
  return [
    "Task type: knowledge_generation",
    "Workflow: create Knowledge from docs",
    "",
    "Selected source refs:",
    sourceRefs,
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

function truncateForRiskNote(value: string) {
  const normalized = normalizeWhitespace(value);
  return normalized.length <= 180
    ? normalized
    : `${normalized.slice(0, 177).trim()}...`;
}

type QueueTaskDraft = {
  description: string;
  priority: string;
  prompt: string;
  title: string;
};

function createPlanDraft(
  message: string,
  sourceMessageId: string,
): CoordinatorPlanDraft {
  const goal = planningGoal(message);
  const localSteps = planningSteps(message);

  return {
    goal,
    id: `${sourceMessageId}-plan`,
    riskNotes: [
      "Plan generated only from visible chat text.",
      "No Workspace, Queue, Executor, Notes, Git, JDBC, Terminal, logs, files, or artifacts were read.",
      "Queue and Executor work still requires explicit operator action.",
    ],
    steps: localSteps,
    suggestedNextActions: [
      "Edit or send a sharper prompt if the goal is too broad.",
      "Approve any Queue task draft only after reviewing its visible prompt.",
      "Create Queue tasks only for larger async work; creation does not run them.",
    ],
    title: derivedTitle(message, "Workspace Agent plan"),
  };
}

function createOutcomeReviewDraft(
  visibleMessage: string,
  normalizedMessage: string,
  sourceMessageId: string,
): CoordinatorOutcomeReviewDraft {
  const statusInterpretation = outcomeStatus(normalizedMessage);

  return {
    id: `${sourceMessageId}-outcome-review`,
    likelyOutcome: likelyOutcomeFor(statusInterpretation),
    nextActions: nextActionsFor(statusInterpretation),
    observedSummary: observedOutcomeSummary(visibleMessage),
    risksBlockers: risksFor(statusInterpretation),
    statusInterpretation,
    title: derivedTitle(
      visibleMessage,
      statusInterpretation === "failure"
        ? "Review pasted failure"
        : "Review pasted result",
    ),
  };
}

function outcomeStatus(
  message: string,
): CoordinatorOutcomeReviewDraft["statusInterpretation"] {
  if (
    /\b(failed|failure|error|exception|panic|timed\s*out|timeout|cancelled|canceled|exit\s+code\s+[1-9]|non[-\s]?zero|validation\s+failed|test\s+failed)\b/i.test(
      message,
    )
  ) {
    return "failure";
  }

  if (
    /\b(blocked|warning|warn|needs\s+review|skipped|partial|dirty|conflict|manual\s+review)\b/i.test(
      message,
    )
  ) {
    return "needs review";
  }

  if (
    /\b(passed|success|successful|completed|validated|all\s+tests\s+passed|exit\s+code\s+0|finished)\b/i.test(
      message,
    )
  ) {
    return "success";
  }

  return "unclear";
}

function observedOutcomeSummary(message: string) {
  const cleaned = stripOutcomeReviewPrefix(message);
  const lines = cleaned
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const summarySource = lines.slice(0, 3).join(" ");
  const summary = normalizeWhitespace(summarySource || cleaned);

  if (!summary) {
    return "No pasted result text was included yet.";
  }

  return summary.length <= 260 ? summary : `${summary.slice(0, 257).trim()}...`;
}

function likelyOutcomeFor(
  status: CoordinatorOutcomeReviewDraft["statusInterpretation"],
) {
  if (status === "success") {
    return "The visible pasted text appears to report a successful result.";
  }
  if (status === "failure") {
    return "The visible pasted text appears to report a failed or blocked outcome.";
  }
  if (status === "needs review") {
    return "The visible pasted text includes warning, skipped, partial, or review-needed signals.";
  }
  return "The visible pasted text does not include enough final status detail to classify confidently.";
}

function risksFor(status: CoordinatorOutcomeReviewDraft["statusInterpretation"]) {
  const shared = [
    "Review uses visible chat text only; no hidden Queue or Executor logs were read.",
  ];

  if (status === "success") {
    return [
      "Confirm the pasted validation scope matches the original task.",
      "Check for skipped checks or warnings before accepting the result.",
      ...shared,
    ];
  }

  if (status === "failure") {
    return [
      "Do not accept the result until the first failing command or error is understood.",
      "A follow-up fix may need a focused Queue task if it is larger than a quick operator decision.",
      ...shared,
    ];
  }

  if (status === "needs review") {
    return [
      "Warnings, skipped checks, dirty state, or partial completion may still need operator review.",
      "Ask for or paste the missing visible result lines before creating larger follow-up work.",
      ...shared,
    ];
  }

  return [
    "The pasted text lacks a clear final status.",
    "Paste the relevant Queue, Executor, or validation summary lines before deciding next steps.",
    ...shared,
  ];
}

function nextActionsFor(
  status: CoordinatorOutcomeReviewDraft["statusInterpretation"],
) {
  if (status === "success") {
    return [
      "Confirm all expected validation commands are represented in the pasted text.",
      "Accept the result only if no warnings or skipped checks matter.",
      "Create a follow-up Queue task only for remaining explicit work.",
    ];
  }

  if (status === "failure") {
    return [
      "Identify the first visible failing command, error, or timeout.",
      "Decide whether the fix is small enough for immediate operator action.",
      "Draft a focused follow-up Queue task when the fix needs async execution.",
    ];
  }

  if (status === "needs review") {
    return [
      "Resolve warnings, skipped checks, or partial completion before accepting.",
      "Paste additional visible result lines if the boundary is unclear.",
      "Draft follow-up Queue work only after the needed scope is visible.",
    ];
  }

  return [
    "Paste the final status, failed command, or validation summary.",
    "Ask Workspace Agent again after the visible result text is complete.",
    "Avoid creating Queue work until the outcome is clear.",
  ];
}

function shouldDraftOutcomeFollowUp(
  normalizedMessage: string,
  review: CoordinatorOutcomeReviewDraft,
) {
  return (
    matchesAny(normalizedMessage, FOLLOW_UP_QUEUE_INTENT_PATTERNS) ||
    review.statusInterpretation === "failure" ||
    review.statusInterpretation === "needs review"
  );
}

function queueDraftFromOutcomeReview(
  visibleMessage: string,
  review: CoordinatorOutcomeReviewDraft,
): QueueTaskDraft {
  const title =
    review.statusInterpretation === "failure"
      ? "Investigate pasted Executor failure"
      : review.statusInterpretation === "success"
        ? "Review successful pasted result"
        : "Follow up pasted result review";

  return {
    description: `Follow-up drafted from visible Workspace Agent outcome review: ${review.observedSummary}`,
    priority: review.statusInterpretation === "failure" ? "2" : "1",
    prompt: [
      "Review the visible pasted outcome below and propose the smallest safe follow-up.",
      "",
      visibleMessage,
      "",
      "Use only this prompt and explicit operator-provided context. Do not read hidden Queue or Executor logs, artifacts, files, Notes, Git, JDBC, Terminal output, or Context Packs.",
    ].join("\n"),
    title,
  };
}

function queueDraftsFromMessage(message: string): QueueTaskDraft[] {
  const explicitTitle = extractLabeledValue(message, ["title", "task title"]);
  const explicitPrompt = extractLabeledValue(message, ["prompt"]);
  const explicitPriority = extractLabeledValue(message, ["priority"]) || "0";

  if (explicitTitle || explicitPrompt) {
    return [
      {
        description: message,
        priority: explicitPriority,
        prompt: explicitPrompt || message,
        title: explicitTitle || derivedTitle(message, "Workspace Agent queue task"),
      },
    ];
  }

  const listItems = extractedTaskLines(message);
  if (listItems.length > 0) {
    return listItems.slice(0, MAX_LOCAL_QUEUE_DRAFTS).map((item) => ({
      description: `Drafted from visible Workspace Agent chat: ${item}`,
      priority: "0",
      prompt: [
        item,
        "",
        "Use only the task prompt and explicit operator-provided context. Do not run hidden tools, mutate Git, or assume hidden Workspace context.",
      ].join("\n"),
      title: derivedTitle(item, "Workspace Agent queue task"),
    }));
  }

  const goal = planningGoal(message);
  return [
    {
      description: `Clarify the visible goal before execution: ${goal}`,
      priority: "0",
      prompt: `Clarify scope, assumptions, expected changed layers, and non-goals for this visible goal: ${goal}`,
      title: derivedTitle(`Clarify scope for ${goal}`, "Clarify scope"),
    },
    {
      description: `Prepare a focused implementation block for the visible goal: ${goal}`,
      priority: "0",
      prompt: `Draft a small implementation block for this visible goal: ${goal}\n\nKeep execution explicit, scoped, and validation-oriented.`,
      title: derivedTitle(
        `Implement first slice for ${goal}`,
        "Implement first slice",
      ),
    },
    {
      description: `Validate and review the completed work for the visible goal: ${goal}`,
      priority: "0",
      prompt: `Validate the completed work for this visible goal: ${goal}\n\nReport validation results and any intentionally unimplemented scope.`,
      title: derivedTitle(`Validate ${goal}`, "Validate work"),
    },
  ];
}

function planningGoal(message: string) {
  return (
    extractLabeledValue(message, ["goal", "prompt", "description"]) ||
    stripPlanningPrefix(message) ||
    "the visible Workspace Agent request"
  );
}

function planningSteps(message: string) {
  const taskLines = extractedTaskLines(message);
  if (taskLines.length > 0) {
    return taskLines.slice(0, MAX_LOCAL_QUEUE_DRAFTS);
  }

  const goal = planningGoal(message);
  return [
    `Confirm the exact goal and missing context for: ${goal}`,
    "Separate quick operator decisions from larger async Queue work.",
    "Draft Queue tasks only for focused work blocks with visible prompts.",
    "Run any accepted task later through Queue/Executor controls, not from Workspace Agent.",
  ];
}

function extractedTaskLines(message: string) {
  return message
    .split(/\r?\n|;/)
    .map((line) => line.replace(/^\s*(?:[-*]|\d+[.)])\s*/, "").trim())
    .filter((line) => line.length >= 8)
    .filter((line) => !matchesAny(line, QUEUE_INTENT_PATTERNS))
    .filter((line) => !matchesAny(line, PLAN_INTENT_PATTERNS));
}

function stripPlanningPrefix(message: string) {
  return message
    .replace(/\bmake\s+(?:a\s+)?plan(?:\s+for)?\b/gi, "")
    .replace(/\bplan\s+(?:this|the|my|our)?\b/gi, "")
    .replace(/\bbreak\s+(?:this|it|that|the\s+work|this\s+work)\s+(?:down|into\s+queue\s+tasks?)\b/gi, "")
    .replace(/\bdraft\s+tasks?\s+for(?:\s+this\s+goal)?\b/gi, "")
    .replace(/\bexplain\s+how\s+to\s+execute\s+this\s+safely\b/gi, "")
    .trim();
}

function stripOutcomeReviewPrefix(message: string) {
  return message
    .replace(/\breview\s+pasted\s+queue\s+result\b/gi, "")
    .replace(/\bexplain\s+this\s+executor\s+failure\b/gi, "")
    .replace(/\bturn\s+this\s+result\s+into\s+next\s+steps\b/gi, "")
    .replace(/\bdraft\s+follow-up\s+queue\s+tasks?\b/gi, "")
    .replace(/\bsummarize\s+validation\s+output\b/gi, "")
    .replace(/\bpaste\s+results?\s+here\s+to\s+analy[sz]e\s+them\b/gi, "")
    .replace(/^[:\s-]+/, "")
    .trim();
}

function responseBodyFor(
  plan: CoordinatorPlanDraft | null,
  review: CoordinatorOutcomeReviewDraft | null,
  proposalCount: number,
) {
  if (review && proposalCount > 0) {
    return GENERATED_REVIEW_AND_PROPOSAL_RESPONSE;
  }

  if (review) {
    return GENERATED_REVIEW_RESPONSE;
  }

  if (plan && proposalCount > 0) {
    return GENERATED_PLAN_AND_PROPOSAL_RESPONSE;
  }

  if (plan) {
    return GENERATED_PLAN_RESPONSE;
  }

  if (proposalCount > 0) {
    return GENERATED_PROPOSAL_RESPONSE;
  }

  return NO_PROPOSAL_RESPONSE;
}

function createNoteProposal(
  message: string,
  sourceMessageId: string,
): CoordinatorActionProposal {
  const definition = proposalTypeDefinition("create-note");
  const title =
    extractLabeledValue(message, ["title", "note title"]) ||
    derivedTitle(message, "Workspace Agent note");

  return {
    approvalStatus: "Pending preview",
    executionStatus: "Not run",
    expectedResult:
      "A reviewed workspace-local Note can be created after approval and a separate Create Note action.",
    id: `${sourceMessageId}-create-note`,
    inputs: [
      { label: "Title", value: title },
      {
        label: "Body",
        value: extractLabeledValue(message, ["body"]) || message,
      },
      { label: "Pinned", value: "false" },
    ],
    intent:
      "Create a workspace-local Note from explicit operator text after review.",
    resultSummary:
      "Generated locally from explicit chat text. No Note has been created yet.",
    riskLevel: definition.riskLevel,
    riskNotes: [
      ...definition.safetyNotes,
      "No existing Notes content is read or summarized.",
    ],
    targetCapability: definition.targetCapability,
    targetWidget: definition.targetWidget,
    title,
    typeId: definition.typeId,
  };
}

function createJdbcProposal(
  rawMessage: string,
  normalizedMessage: string,
  sourceMessageId: string,
): CoordinatorActionProposal {
  const definition = proposalTypeDefinition("prepare-jdbc-query-suggestion");
  const sqlSuggestion = extractReadOnlySql(rawMessage) || jdbcSqlPlaceholder();
  const inputs: CoordinatorProposalInput[] = [
    { label: "Question", value: normalizedMessage },
    { label: "Suggested SQL text", value: sqlSuggestion },
  ];
  const connectorLabel = extractLabeledValue(normalizedMessage, [
    "connector",
    "connector label",
  ]);

  if (connectorLabel) {
    inputs.splice(1, 0, { label: "Connector label", value: connectorLabel });
  }

  return {
    approvalStatus: "Pending preview",
    executionStatus: "SQL suggestion only",
    expectedResult:
      "A SQL suggestion can be reviewed and copied, but this preview cannot execute SQL.",
    id: `${sourceMessageId}-jdbc-query-suggestion`,
    inputs,
    intent:
      "Prepare non-executing SQL suggestion text from explicit operator input.",
    resultSummary:
      "Generated locally from explicit chat text. Copy SQL copies only the visible SQL text.",
    riskLevel: definition.riskLevel,
    riskNotes: [
      ...definition.safetyNotes,
      "No JDBC connector metadata, schemas, database data, or results were read.",
      "Future execution must happen only through an approved JDBC execution surface.",
    ],
    targetCapability: definition.targetCapability,
    targetWidget: definition.targetWidget,
    title: derivedTitle(normalizedMessage, "JDBC query suggestion"),
    typeId: definition.typeId,
  };
}

function proposalTypeDefinition(
  typeId: CoordinatorProposalTypeId,
): CoordinatorProposalTypeDefinition {
  const definition = COORDINATOR_ACTION_PROPOSAL_REGISTRY.find(
    (proposalType) => proposalType.typeId === typeId,
  );

  if (!definition) {
    throw new Error(`Missing Workspace Agent proposal type: ${typeId}`);
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

function extractReadOnlySql(message: string) {
  const codeBlockMatch = message.match(/```(?:sql)?\s*([\s\S]*?)```/i);
  const sqlFromCodeBlock = codeBlockMatch?.[1]?.trim();

  if (sqlFromCodeBlock && startsWithReadOnlySql(sqlFromCodeBlock)) {
    return sqlFromCodeBlock;
  }

  const labeledSql = extractLabeledValue(message, ["sql", "query"]);
  if (labeledSql && startsWithReadOnlySql(labeledSql)) {
    return labeledSql;
  }

  const inlineSqlMatch = message.match(
    /\b(select|with|show|describe|explain)\b[\s\S]*$/i,
  );
  const inlineSql = inlineSqlMatch?.[0]?.trim();

  if (inlineSql && startsWithReadOnlySql(inlineSql)) {
    return inlineSql;
  }

  return "";
}

function startsWithReadOnlySql(value: string) {
  return /^(select|with|show|describe|explain)\b/i.test(value.trim());
}

function jdbcSqlPlaceholder() {
  return [
    "-- Edit this visible SQL suggestion before use.",
    "-- Workspace Agent did not inspect connectors, schemas, or database data.",
  ].join("\n");
}

function derivedTitle(message: string, fallback: string) {
  const cleaned = message
    .replace(INTENT_PREFIX_PATTERN, "")
    .replace(LABELED_PREFIX_PATTERN, "")
    .trim();
  const title = normalizeWhitespace(cleaned || fallback);

  if (title.length <= MAX_TITLE_LENGTH) {
    return title;
  }

  return `${title.slice(0, MAX_TITLE_LENGTH - 1).trim()}...`;
}

function normalizeWhitespace(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
