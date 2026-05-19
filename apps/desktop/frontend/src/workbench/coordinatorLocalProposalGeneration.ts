import {
  COORDINATOR_ACTION_PROPOSAL_REGISTRY,
  type CoordinatorActionProposal,
  type CoordinatorProposalInput,
  type CoordinatorProposalTypeId,
  type CoordinatorProposalTypeDefinition,
} from "./coordinatorActionProposalRegistry";

export type LocalProposalGenerationResult = {
  proposals: CoordinatorActionProposal[];
  responseBody: string;
};

const NO_PROPOSAL_RESPONSE =
  "Coordinator Chat is not connected yet. This message is stored only in this local widget session. No explicit safe proposal intent was detected.";

const GENERATED_PROPOSAL_RESPONSE =
  "Generated local deterministic proposal previews from your explicit message. Review or edit the visible inputs before approval; approval does not execute by itself.";

const MAX_TITLE_LENGTH = 72;
const LABELED_VALUE_BOUNDARY = [
  "title",
  "task title",
  "note title",
  "description",
  "prompt",
  "body",
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

export function generateLocalCoordinatorProposals(
  message: string,
  sourceMessageId: string,
): LocalProposalGenerationResult {
  const normalizedMessage = normalizeWhitespace(message);
  const proposals: CoordinatorActionProposal[] = [];

  if (matchesAny(normalizedMessage, QUEUE_INTENT_PATTERNS)) {
    proposals.push(createQueueProposal(normalizedMessage, sourceMessageId));
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
    proposals,
    responseBody:
      proposals.length > 0 ? GENERATED_PROPOSAL_RESPONSE : NO_PROPOSAL_RESPONSE,
  };
}

function createQueueProposal(
  message: string,
  sourceMessageId: string,
): CoordinatorActionProposal {
  const definition = proposalTypeDefinition("create-agent-queue-task");
  const title =
    extractLabeledValue(message, ["title", "task title"]) ||
    derivedTitle(message, "Coordinator queue task");

  return {
    approvalStatus: "Pending preview",
    executionStatus: "Not run",
    expectedResult:
      "A reviewed draft Queue task can be created after approval and a separate Create Queue task action, but it will not run automatically.",
    id: `${sourceMessageId}-create-queue-task`,
    inputs: [
      { label: "Title", value: title },
      { label: "Description", value: message },
      {
        label: "Prompt",
        value: extractLabeledValue(message, ["prompt"]) || message,
      },
      {
        label: "Priority",
        value: extractLabeledValue(message, ["priority"]) || "0",
      },
    ],
    intent:
      "Create a draft Agent Queue task from explicit operator text for later manual review.",
    resultSummary:
      "Generated locally from explicit chat text. No Queue task has been created yet.",
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

function createNoteProposal(
  message: string,
  sourceMessageId: string,
): CoordinatorActionProposal {
  const definition = proposalTypeDefinition("create-note");
  const title =
    extractLabeledValue(message, ["title", "note title"]) ||
    derivedTitle(message, "Coordinator note");

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
    throw new Error(`Missing Coordinator proposal type: ${typeId}`);
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
    "-- Coordinator did not inspect connectors, schemas, or database data.",
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
