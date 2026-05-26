import {
  COORDINATOR_ACTION_PROPOSAL_REGISTRY,
  type CoordinatorActionProposal,
  type CoordinatorProposalInput,
  type CoordinatorProposalTypeDefinition,
} from "./coordinatorActionProposalRegistry";
import type { SkillReviewStatus } from "../workspace/types";

type CatalogActionKind = "create_knowledge_document" | "create_skill";

type CatalogActionParseOptions = {
  includePlainTextIntents?: boolean;
};

const CATALOG_ACTION_BLOCK_PATTERN =
  /```hobit-catalog-action\s*([\s\S]*?)```/gi;

const CATALOG_INTENT_PATTERNS = [
  /\badd\s+(?:it|this|these)?\s*(?:to|as)\s+(?:workspace\s+)?knowledge\b/i,
  /\bremember\s+(?:it|this|these)?\s+as\s+(?:workspace\s+)?knowledge\b/i,
  /\bsave\s+this[\s\S]*\b(?:catalog|knowledge)\b/i,
  /\bcreate\s+(?:a\s+)?(?:knowledge\s+)?document\s+from\s+this\b/i,
  /\bturn\s+this\s+into\s+(?:a\s+)?(?:knowledge\s+)?document\b/i,
];

const SKILL_INTENT_PATTERNS = [
  /\bturn\s+this\s+into\s+(?:a\s+)?skill\b/i,
  /\bcreate\s+(?:a\s+)?skill\s+from\s+this\b/i,
  /\bsave\s+this[\s\S]*\b(?:procedure|runbook|instructions?)\b[\s\S]*\b(?:skill|catalog)\b/i,
  /\bremember\s+this\s+as\s+(?:a\s+)?skill\b/i,
];

const BOTH_INTENT_PATTERNS = [
  /\bcreate\s+(?:a\s+)?skill\s+and\s+(?:a\s+)?(?:knowledge\s+)?document\s+from\s+this\b/i,
  /\bcreate\s+(?:a\s+)?(?:knowledge\s+)?document\s+and\s+(?:a\s+)?skill\s+from\s+this\b/i,
];

const LABELED_VALUE_BOUNDARY = [
  "title",
  "source label",
  "source",
  "body",
  "content",
  "tags",
  "enabled",
  "when to use",
  "when_to_use",
  "prerequisites",
  "steps",
  "validation",
  "risks",
  "review status",
  "review_status",
].join("|");

export function catalogActionProposalsFromText(
  text: string,
  sourceMessageId: string,
  options: CatalogActionParseOptions = {},
): CoordinatorActionProposal[] {
  const visibleText = text.trim();
  if (!visibleText) {
    return [];
  }

  const proposals = catalogActionBlocksFromText(visibleText, sourceMessageId);

  if (proposals.length > 0 || !options.includePlainTextIntents) {
    return proposals;
  }

  return plainTextCatalogProposals(visibleText, sourceMessageId);
}

function catalogActionBlocksFromText(
  text: string,
  sourceMessageId: string,
): CoordinatorActionProposal[] {
  const proposals: CoordinatorActionProposal[] = [];
  let match: RegExpExecArray | null;
  let index = 0;

  CATALOG_ACTION_BLOCK_PATTERN.lastIndex = 0;
  while ((match = CATALOG_ACTION_BLOCK_PATTERN.exec(text))) {
    const parsed = parseJsonActionBlock(match[1]);
    const actions = Array.isArray(parsed) ? parsed : parsed ? [parsed] : [];

    actions.forEach((action) => {
      const proposal = catalogActionToProposal(action, sourceMessageId, index);
      index += 1;
      if (proposal) {
        proposals.push(proposal);
      }
    });
  }

  return proposals;
}

function parseJsonActionBlock(block: string): unknown {
  try {
    return JSON.parse(block.trim()) as unknown;
  } catch {
    return null;
  }
}

function catalogActionToProposal(
  action: unknown,
  sourceMessageId: string,
  index: number,
): CoordinatorActionProposal | null {
  if (!isRecord(action)) {
    return null;
  }

  if (action.type === "create_knowledge_document") {
    return createKnowledgeDocumentProposal(
      {
        content: stringField(action.content),
        enabled: booleanField(action.enabled, true),
        sourceLabel:
          stringField(action.source_label) ||
          stringField(action.sourceLabel) ||
          "Workspace Agent conversation",
        tags: tagsField(action.tags),
        title: stringField(action.title) || "Workspace knowledge",
      },
      sourceMessageId,
      index,
      "Structured catalog action from visible assistant text.",
    );
  }

  if (action.type === "create_skill") {
    return createSkillProposal(
      {
        prerequisites: stringField(action.prerequisites),
        reviewStatus: reviewStatusField(
          action.review_status ?? action.reviewStatus,
        ),
        risks: stringField(action.risks),
        steps: stringField(action.steps),
        tags: tagsField(action.tags),
        title: stringField(action.title) || "Workspace skill",
        validation: stringField(action.validation),
        whenToUse:
          stringField(action.when_to_use) || stringField(action.whenToUse),
      },
      sourceMessageId,
      index,
      "Structured catalog action from visible assistant text.",
    );
  }

  return null;
}

function plainTextCatalogProposals(
  text: string,
  sourceMessageId: string,
): CoordinatorActionProposal[] {
  const shouldCreateBoth = matchesAny(text, BOTH_INTENT_PATTERNS);
  const shouldCreateDocument =
    shouldCreateBoth || matchesAny(text, CATALOG_INTENT_PATTERNS);
  const shouldCreateSkill =
    shouldCreateBoth || matchesAny(text, SKILL_INTENT_PATTERNS);
  const content = visibleContentFromIntent(text);
  const title = labeledValue(text, ["title"]) || derivedCatalogTitle(content);
  const tags = labeledValue(text, ["tags"]);
  const proposals: CoordinatorActionProposal[] = [];

  if (shouldCreateDocument && content) {
    const proposal = createKnowledgeDocumentProposal(
      {
        content,
        enabled: true,
        sourceLabel:
          labeledValue(text, ["source label", "source"]) ||
          "Workspace Agent conversation",
        tags,
        title,
      },
      sourceMessageId,
      proposals.length,
      "Drafted locally from visible conversation text.",
    );
    if (proposal) {
      proposals.push(proposal);
    }
  }

  if (shouldCreateSkill && content) {
    const proposal = createSkillProposal(
      {
        prerequisites: labeledValue(text, ["prerequisites"]),
        reviewStatus: "draft",
        risks: labeledValue(text, ["risks"]),
        steps: labeledValue(text, ["steps"]) || content,
        tags,
        title,
        validation: labeledValue(text, ["validation"]),
        whenToUse:
          labeledValue(text, ["when to use", "when_to_use"]) ||
          "Use when this workspace procedure or guidance is relevant.",
      },
      sourceMessageId,
      proposals.length,
      "Drafted locally from visible conversation text.",
    );
    if (proposal) {
      proposals.push(proposal);
    }
  }

  return proposals;
}

function createKnowledgeDocumentProposal(
  draft: {
    content: string;
    enabled: boolean;
    sourceLabel: string;
    tags: string;
    title: string;
  },
  sourceMessageId: string,
  index: number,
  resultSummary: string,
): CoordinatorActionProposal | null {
  if (!draft.content.trim()) {
    return null;
  }

  const definition = proposalTypeDefinition("create-knowledge-document");
  const title = compactTitle(draft.title, "Workspace knowledge");

  return {
    approvalStatus: "Pending preview",
    executionStatus: "Not run",
    expectedResult:
      "A workspace-local Knowledge Document can be created after approval and a separate Create Document action.",
    id: `${sourceMessageId}-create-knowledge-document-${index}`,
    inputs: [
      { label: "Title", value: title },
      { label: "Source label", value: draft.sourceLabel.trim() },
      { label: "Content", value: draft.content.trim() },
      { label: "Tags", value: draft.tags.trim() },
      { label: "Enabled", value: draft.enabled ? "true" : "false" },
    ],
    intent:
      "Create a workspace-local Knowledge Document from visible conversation content.",
    resultSummary,
    riskLevel: definition.riskLevel,
    riskNotes: [
      ...definition.safetyNotes,
      "Save is explicit and workspace-local only.",
    ],
    targetCapability: definition.targetCapability,
    targetWidget: definition.targetWidget,
    title,
    typeId: definition.typeId,
  };
}

function createSkillProposal(
  draft: {
    prerequisites: string;
    reviewStatus: SkillReviewStatus;
    risks: string;
    steps: string;
    tags: string;
    title: string;
    validation: string;
    whenToUse: string;
  },
  sourceMessageId: string,
  index: number,
  resultSummary: string,
): CoordinatorActionProposal | null {
  if (!draft.steps.trim() && !draft.whenToUse.trim()) {
    return null;
  }

  const definition = proposalTypeDefinition("create-skill");
  const title = compactTitle(draft.title, "Workspace skill");

  return {
    approvalStatus: "Pending preview",
    executionStatus: "Not run",
    expectedResult:
      "A workspace-local Skill can be created after approval and a separate Create Skill action.",
    id: `${sourceMessageId}-create-skill-${index}`,
    inputs: [
      { label: "Title", value: title },
      { label: "When to use", value: draft.whenToUse.trim() },
      { label: "Prerequisites", value: draft.prerequisites.trim() },
      { label: "Steps", value: draft.steps.trim() },
      { label: "Validation", value: draft.validation.trim() },
      { label: "Risks", value: draft.risks.trim() },
      { label: "Tags", value: draft.tags.trim() },
      { label: "Review status", value: draft.reviewStatus },
    ],
    intent:
      "Create a reusable workspace-local Skill from visible conversation content.",
    resultSummary,
    riskLevel: definition.riskLevel,
    riskNotes: [
      ...definition.safetyNotes,
      "Save is explicit and workspace-local only.",
    ],
    targetCapability: definition.targetCapability,
    targetWidget: definition.targetWidget,
    title,
    typeId: definition.typeId,
  };
}

function proposalTypeDefinition(typeId: "create-knowledge-document" | "create-skill") {
  return COORDINATOR_ACTION_PROPOSAL_REGISTRY.find(
    (proposalType): proposalType is CoordinatorProposalTypeDefinition =>
      proposalType.typeId === typeId,
  ) as CoordinatorProposalTypeDefinition;
}

function visibleContentFromIntent(text: string) {
  const labeledContent = labeledValue(text, ["content", "body", "steps"]);
  if (labeledContent) {
    return labeledContent;
  }

  return text
    .replace(/\bhere\s+is\s+(?:some\s+)?(?:documentation|docs|instructions|a\s+runbook|notes|operational\s+text)\b[:,]?\s*/i, "")
    .replace(/\b(add\s+(?:it|this|these)?\s*(?:to|as)\s+(?:workspace\s+)?knowledge|remember\s+(?:it|this|these)?\s+as\s+(?:workspace\s+)?knowledge|turn\s+this\s+into\s+(?:a\s+)?skill|create\s+(?:a\s+)?skill\s+from\s+this|create\s+(?:a\s+)?skill\s+and\s+(?:a\s+)?(?:knowledge\s+)?document\s+from\s+this|create\s+(?:a\s+)?(?:knowledge\s+)?document\s+and\s+(?:a\s+)?skill\s+from\s+this|create\s+(?:a\s+)?(?:knowledge\s+)?document\s+from\s+this|save\s+this\s+deployment\s+procedure\s+to\s+the\s+catalog|save\s+this\s+to\s+the\s+catalog)\b[:,]?\s*/gi, "")
    .trim();
}

function labeledValue(text: string, labels: string[]) {
  for (const label of labels) {
    const pattern = new RegExp(
      `\\b${escapeRegExp(label)}\\s*[:=]\\s*(?:"([^"]+)"|'([^']+)'|([\\s\\S]*?)(?=(?:\\s+\\b(?:${LABELED_VALUE_BOUNDARY})\\s*[:=])|[;\\n]|$))`,
      "i",
    );
    const match = text.match(pattern);
    const value = match?.[1] ?? match?.[2] ?? match?.[3];

    if (value?.trim()) {
      return value.trim();
    }
  }

  return "";
}

function derivedCatalogTitle(text: string) {
  const firstLine =
    text
      .split(/\r?\n/)
      .map((line) => line.trim())
      .find(Boolean) ?? "Workspace catalog draft";

  return compactTitle(firstLine, "Workspace catalog draft");
}

function compactTitle(value: string, fallback: string) {
  const title = value.replace(/\s+/g, " ").trim() || fallback;
  return title.length <= 72 ? title : `${title.slice(0, 71).trim()}...`;
}

function matchesAny(message: string, patterns: RegExp[]) {
  return patterns.some((pattern) => pattern.test(message));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function stringField(value: unknown) {
  if (typeof value === "string") {
    return value.trim();
  }

  if (Array.isArray(value)) {
    return value
      .map((entry) => (typeof entry === "string" ? entry.trim() : ""))
      .filter(Boolean)
      .join("\n");
  }

  return "";
}

function tagsField(value: unknown) {
  if (Array.isArray(value)) {
    return value
      .map((entry) => (typeof entry === "string" ? entry.trim() : ""))
      .filter(Boolean)
      .join(", ");
  }

  return stringField(value);
}

function booleanField(value: unknown, fallback: boolean) {
  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (["true", "yes", "enabled", "1"].includes(normalized)) {
      return true;
    }
    if (["false", "no", "disabled", "0"].includes(normalized)) {
      return false;
    }
  }

  return fallback;
}

function reviewStatusField(value: unknown): SkillReviewStatus {
  const normalized = stringField(value).toLowerCase();

  if (
    normalized === "needs_review" ||
    normalized === "reviewed" ||
    normalized === "deprecated" ||
    normalized === "draft"
  ) {
    return normalized;
  }

  if (normalized === "needs review") {
    return "needs_review";
  }

  return "draft";
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
