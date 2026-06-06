import type {
  AgentQueueTask,
  AgentQueueTaskContext,
  AgentQueueTaskContextRef,
  AgentQueueTaskContextRefKind,
  AgentQueueTaskContextSnapshot,
  AgentQueueTaskContextWarning,
  KnowledgeDocument,
  Skill,
} from "../workspace/types";

const CONTEXT_TOKEN_BUDGET = 1600;
const CONTEXT_CHAR_BUDGET = CONTEXT_TOKEN_BUDGET * 4;
const KNOWLEDGE_DOCUMENT_EXCERPT_CHARS = 2200;
const SKILL_INSTRUCTION_CHARS = 1800;
const LARGE_KNOWLEDGE_CONTENT_CHARS = 100_000;

export type AgentQueueKnowledgeContextAttachInput =
  | {
      kind: "knowledge_document";
      document: KnowledgeDocument;
    }
  | {
      kind: "skill";
      skill: Skill;
    };

export type AgentQueueKnowledgeContextAttachResult = {
  message: string;
  status: "attached" | "blocked" | "detached" | "unavailable";
  taskTitle?: string;
};

export type AgentQueueContextPromptMaterialization = {
  contextSection: string | null;
  evidenceSection: string | null;
  materializedPrompt: string;
  snapshotsUsed: AgentQueueTaskContextSnapshot[];
  tokenEstimate: number;
};

export function buildQueueContextAttachment(
  input: AgentQueueKnowledgeContextAttachInput,
  attachedAt = new Date().toISOString(),
) {
  return input.kind === "knowledge_document"
    ? buildKnowledgeDocumentAttachment(input.document, attachedAt)
    : buildSkillAttachment(input.skill, attachedAt);
}

export function attachContextToQueueTask(
  task: AgentQueueTask,
  input: AgentQueueKnowledgeContextAttachInput,
  attachedAt = new Date().toISOString(),
): AgentQueueTask {
  const attachment = buildQueueContextAttachment(input, attachedAt);

  return {
    ...task,
    context: mergeTaskContext(task.context, attachment),
  };
}

export function detachContextFromQueueTask(
  task: AgentQueueTask,
  ref: AgentQueueTaskContextRef,
): AgentQueueTask {
  const context = task.context ?? emptyQueueTaskContext();
  const attachedKnowledgeRefs = context.attachedKnowledgeRefs.filter(
    (existingRef) => existingRef.id !== ref.id,
  );
  const attachedSkillRefs = context.attachedSkillRefs.filter(
    (existingRef) => existingRef.id !== ref.id,
  );
  const attachedKnowledgeSnapshots = context.attachedKnowledgeSnapshots.filter(
    (snapshot) => snapshot.sourceRefId !== ref.id,
  );

  return {
    ...task,
    context: withContextBudget({
      attachedKnowledgeRefs,
      attachedSkillRefs,
      attachedKnowledgeSnapshots,
      contextWarnings: context.contextWarnings.filter(
        (warning) => warning.sourceRefId !== ref.id,
      ),
      contextTokenBudget: emptyContextBudget(),
      materializedAt:
        attachedKnowledgeSnapshots[attachedKnowledgeSnapshots.length - 1]
          ?.materializedAt ?? null,
    }),
  };
}

export function emptyQueueTaskContext(): AgentQueueTaskContext {
  return {
    attachedKnowledgeRefs: [],
    attachedSkillRefs: [],
    attachedKnowledgeSnapshots: [],
    contextWarnings: [],
    contextTokenBudget: emptyContextBudget(),
    materializedAt: null,
  };
}

export function queueContextSummary(context: AgentQueueTaskContext | undefined) {
  const knowledgeCount = context?.attachedKnowledgeRefs.length ?? 0;
  const skillCount = context?.attachedSkillRefs.length ?? 0;
  const snapshotCount = context?.attachedKnowledgeSnapshots.length ?? 0;
  const blockedCount =
    context?.contextWarnings.filter((warning) => warning.severity === "blocked")
      .length ?? 0;
  const warningCount =
    context?.contextWarnings.filter((warning) => warning.severity === "warning")
      .length ?? 0;

  return { blockedCount, knowledgeCount, skillCount, snapshotCount, warningCount };
}

export function isQueueContextAttachmentBlocked(
  input: AgentQueueKnowledgeContextAttachInput,
) {
  return buildQueueContextAttachment(input).warnings.some(
    (warning) => warning.severity === "blocked",
  );
}

export function materializeQueueExecutionPrompt(
  task: AgentQueueTask,
): AgentQueueContextPromptMaterialization {
  const context = task.context;
  const snapshots = context?.attachedKnowledgeSnapshots ?? [];
  const snapshotsUsed = cappedSnapshotsForPrompt(snapshots);
  const contextSection =
    snapshotsUsed.length > 0 ? promptContextSection(snapshotsUsed) : null;
  const evidenceSection =
    snapshotsUsed.length > 0
      ? promptEvidenceSection(task, snapshotsUsed, context?.contextWarnings ?? [])
      : null;
  const materializedPrompt = [contextSection, task.prompt.trim(), evidenceSection]
    .filter((section): section is string => Boolean(section?.trim()))
    .join("\n\n");

  return {
    contextSection,
    evidenceSection,
    materializedPrompt,
    snapshotsUsed,
    tokenEstimate: snapshotsUsed.reduce(
      (total, snapshot) => total + snapshot.tokenEstimate,
      0,
    ),
  };
}

function buildKnowledgeDocumentAttachment(
  document: KnowledgeDocument,
  attachedAt: string,
) {
  const ref: AgentQueueTaskContextRef = {
    attachedAt,
    id: document.knowledgeDocumentId,
    kind: "knowledge_document",
    quickSummary: visibleSummary(document.quickSummary),
    scope: document.scope === "global" ? "global" : "workspace-local",
    source: visibleValue(document.sourceLabel, "Knowledge Document"),
    status: document.enabled ? document.lifecycleStatus : "disabled",
    title: visibleValue(document.title, "Untitled document"),
    version: document.updatedAt,
  };

  return {
    ref,
    snapshot: knowledgeDocumentSnapshot(document, ref, attachedAt),
    warnings: knowledgeDocumentWarnings(document, ref, attachedAt),
  };
}

function buildSkillAttachment(skill: Skill, attachedAt: string) {
  const ref: AgentQueueTaskContextRef = {
    attachedAt,
    id: skill.skillId,
    kind: "skill",
    quickSummary: visibleSummary(skill.whenToUse),
    scope: "workspace-local",
    source: "Workspace Skill",
    status: skill.reviewStatus,
    title: visibleValue(skill.title, "Untitled skill"),
    version: skill.updatedAt,
  };

  return {
    ref,
    snapshot: skillSnapshot(skill, ref, attachedAt),
    warnings: skillWarnings(skill, ref, attachedAt),
  };
}

function mergeTaskContext(
  context: AgentQueueTaskContext | undefined,
  attachment: {
    ref: AgentQueueTaskContextRef;
    snapshot: AgentQueueTaskContextSnapshot;
    warnings: AgentQueueTaskContextWarning[];
  },
): AgentQueueTaskContext {
  const existingKnowledgeRefs = context?.attachedKnowledgeRefs ?? [];
  const existingSkillRefs = context?.attachedSkillRefs ?? [];
  const existingSnapshots = context?.attachedKnowledgeSnapshots ?? [];
  const existingWarnings = context?.contextWarnings ?? [];
  const nextWarnings = [
    ...existingWarnings.filter(
      (warning) => warning.sourceRefId !== attachment.ref.id,
    ),
    ...attachment.warnings,
  ];
  const nextSnapshots = [
    ...existingSnapshots.filter(
      (snapshot) => snapshot.sourceRefId !== attachment.ref.id,
    ),
    attachment.snapshot,
  ];

  if (attachment.ref.kind === "knowledge_document") {
    return withContextBudget({
      attachedKnowledgeRefs: [
        ...existingKnowledgeRefs.filter((ref) => ref.id !== attachment.ref.id),
        attachment.ref,
      ],
      attachedSkillRefs: existingSkillRefs,
      attachedKnowledgeSnapshots: nextSnapshots,
      contextWarnings: nextWarnings,
      contextTokenBudget: emptyContextBudget(),
      materializedAt: attachment.snapshot.materializedAt,
    });
  }

  return withContextBudget({
    attachedKnowledgeRefs: existingKnowledgeRefs,
    attachedSkillRefs: [
      ...existingSkillRefs.filter((ref) => ref.id !== attachment.ref.id),
      attachment.ref,
    ],
    attachedKnowledgeSnapshots: nextSnapshots,
    contextWarnings: nextWarnings,
    contextTokenBudget: emptyContextBudget(),
    materializedAt: attachment.snapshot.materializedAt,
  });
}

function knowledgeDocumentSnapshot(
  document: KnowledgeDocument,
  ref: AgentQueueTaskContextRef,
  materializedAt: string,
): AgentQueueTaskContextSnapshot {
  const excerpt = boundedText(document.content, KNOWLEDGE_DOCUMENT_EXCERPT_CHARS);
  const content = [
    `Knowledge Document: ${ref.title}`,
    `Scope: ${ref.scope}`,
    `Source: ${ref.source}`,
    `Version: ${ref.version || "Unknown"}`,
    `Status: ${ref.status}`,
    `Summary: ${ref.quickSummary}`,
    excerpt.text ? `Bounded excerpt:\n${excerpt.text}` : null,
  ]
    .filter((line): line is string => Boolean(line))
    .join("\n");

  return snapshot({
    capped: excerpt.capped,
    content,
    kind: "knowledge_document",
    materializedAt,
    ref,
  });
}

function skillSnapshot(
  skill: Skill,
  ref: AgentQueueTaskContextRef,
  materializedAt: string,
): AgentQueueTaskContextSnapshot {
  const body = [
    `Skill Instructions: ${ref.title}`,
    `Scope: ${ref.scope}`,
    `Source: ${ref.source}`,
    `Version: ${ref.version || "Unknown"}`,
    `Review status: ${ref.status}`,
    `When to use: ${visibleSummary(skill.whenToUse)}`,
    skill.prerequisites.trim() ? `Prerequisites:\n${skill.prerequisites.trim()}` : null,
    skill.steps.trim() ? `Steps:\n${skill.steps.trim()}` : null,
    skill.validation.trim() ? `Validation:\n${skill.validation.trim()}` : null,
    skill.risks.trim() ? `Risks:\n${skill.risks.trim()}` : null,
    skill.tags.trim() ? `Tags: ${skill.tags.trim()}` : null,
  ]
    .filter((line): line is string => Boolean(line))
    .join("\n");
  const bounded = boundedText(body, SKILL_INSTRUCTION_CHARS);

  return snapshot({
    capped: bounded.capped,
    content: bounded.text,
    kind: "skill",
    materializedAt,
    ref,
  });
}

function snapshot({
  capped,
  content,
  kind,
  materializedAt,
  ref,
}: {
  capped: boolean;
  content: string;
  kind: AgentQueueTaskContextRefKind;
  materializedAt: string;
  ref: AgentQueueTaskContextRef;
}): AgentQueueTaskContextSnapshot {
  return {
    capped,
    content,
    id: `snapshot:${kind}:${ref.id}:${materializedAt}`,
    kind,
    materializedAt,
    scope: ref.scope,
    source: ref.source,
    sourceRefId: ref.id,
    status: ref.status,
    title: ref.title,
    tokenEstimate: estimateTokens(content),
    version: ref.version,
  };
}

function cappedSnapshotsForPrompt(snapshots: AgentQueueTaskContextSnapshot[]) {
  const selected: AgentQueueTaskContextSnapshot[] = [];
  let usedChars = 0;

  for (const snapshot of snapshots) {
    if (usedChars >= CONTEXT_CHAR_BUDGET) {
      break;
    }

    const remaining = CONTEXT_CHAR_BUDGET - usedChars;
    const bounded = boundedText(snapshot.content, remaining);
    const content = bounded.text;
    selected.push({
      ...snapshot,
      capped: snapshot.capped || bounded.capped,
      content,
      tokenEstimate: estimateTokens(content),
    });
    usedChars += content.length;
  }

  return selected;
}

function promptContextSection(snapshots: AgentQueueTaskContextSnapshot[]) {
  const knowledge = snapshots.filter((snapshot) => snapshot.kind === "knowledge_document");
  const skills = snapshots.filter((snapshot) => snapshot.kind === "skill");

  return [
    "Knowledge / Skills context",
    "Only this visible, bounded Queue-owned task context is included.",
    "This prepared context is visible before execution and included only in the explicit run prompt.",
    skills.length > 0 ? "Visible Skill Instructions" : null,
    ...skills.map(snapshotPromptBlock),
    knowledge.length > 0 ? "Visible Knowledge Document Excerpts" : null,
    ...knowledge.map(snapshotPromptBlock),
  ]
    .filter((line): line is string => Boolean(line))
    .join("\n\n");
}

function promptEvidenceSection(
  task: AgentQueueTask,
  snapshots: AgentQueueTaskContextSnapshot[],
  warnings: AgentQueueTaskContextWarning[],
) {
  const warningIds = warnings.map((warning) => warning.id);
  return [
    "Context used",
    `Queue task id: ${task.queueItemId}`,
    "Context storage: visible prepared Queue task context.",
    "Included in this run prompt: yes.",
    `Snapshot ids used: ${snapshots.map((snapshot) => snapshot.id).join(", ")}`,
    `Knowledge refs used: ${snapshots
      .filter((snapshot) => snapshot.kind === "knowledge_document")
      .map((snapshot) => `${snapshot.sourceRefId}@${snapshot.version || "unknown"}`)
      .join(", ") || "None"}`,
    `Skill refs used: ${snapshots
      .filter((snapshot) => snapshot.kind === "skill")
      .map((snapshot) => `${snapshot.sourceRefId}@${snapshot.version || "unknown"}`)
      .join(", ") || "None"}`,
    `Materialized at: ${snapshots[0]?.materializedAt ?? "Not materialized"}`,
    `Context token estimate: ${snapshots
      .reduce((total, snapshot) => total + snapshot.tokenEstimate, 0)
      .toString()}`,
    `Context warning ids: ${warningIds.length > 0 ? warningIds.join(", ") : "None"}`,
    `Source scopes: ${Array.from(new Set(snapshots.map((snapshot) => snapshot.scope))).join(", ")}`,
    `Source labels: ${Array.from(new Set(snapshots.map((snapshot) => snapshot.source))).join(", ")}`,
  ].join("\n");
}

function snapshotPromptBlock(snapshot: AgentQueueTaskContextSnapshot) {
  return [
    `[${snapshot.kind}] ${snapshot.title}`,
    `Ref: ${snapshot.sourceRefId}`,
    `Scope: ${snapshot.scope}`,
    `Source: ${snapshot.source}`,
    `Version: ${snapshot.version || "Unknown"}`,
    `Snapshot: ${snapshot.id}`,
    snapshot.content,
    snapshot.capped ? "[Capped excerpt]" : null,
  ]
    .filter((line): line is string => Boolean(line))
    .join("\n");
}

function withContextBudget(context: AgentQueueTaskContext): AgentQueueTaskContext {
  const estimatedTokens = context.attachedKnowledgeSnapshots.reduce(
    (total, snapshot) => total + snapshot.tokenEstimate,
    0,
  );

  return {
    ...context,
    contextTokenBudget: {
      estimatedTokens,
      maxTokens: CONTEXT_TOKEN_BUDGET,
      overBudget: estimatedTokens > CONTEXT_TOKEN_BUDGET,
    },
  };
}

function emptyContextBudget() {
  return {
    estimatedTokens: 0,
    maxTokens: CONTEXT_TOKEN_BUDGET,
    overBudget: false,
  };
}

function boundedText(value: string, maxChars: number) {
  const text = value.trim();

  if (text.length <= maxChars) {
    return { capped: false, text };
  }

  return {
    capped: true,
    text: `${text.slice(0, Math.max(0, maxChars - 12)).trimEnd()}\n[truncated]`,
  };
}

function estimateTokens(value: string) {
  return Math.max(1, Math.ceil(value.length / 4));
}

function knowledgeDocumentWarnings(
  document: KnowledgeDocument,
  ref: AgentQueueTaskContextRef,
  createdAt: string,
) {
  const warnings: AgentQueueTaskContextWarning[] = [];

  if (!document.quickSummary.trim()) {
    warnings.push(contextWarning(ref, "warning", "summary_missing", createdAt));
  }

  if (!document.enabled) {
    warnings.push(contextWarning(ref, "blocked", "disabled", createdAt));
  }

  if (document.lifecycleStatus === "rejected") {
    warnings.push(contextWarning(ref, "blocked", "rejected", createdAt));
  } else if (document.lifecycleStatus === "stale") {
    warnings.push(contextWarning(ref, "warning", "stale", createdAt));
  } else if (
    document.lifecycleStatus === "draft" ||
    document.lifecycleStatus === "archived"
  ) {
    warnings.push(
      contextWarning(ref, "warning", document.lifecycleStatus, createdAt),
    );
  }

  if (document.content.length > LARGE_KNOWLEDGE_CONTENT_CHARS) {
    warnings.push(contextWarning(ref, "warning", "large_content", createdAt));
  } else if (document.content.length > KNOWLEDGE_DOCUMENT_EXCERPT_CHARS) {
    warnings.push(contextWarning(ref, "warning", "content_capped", createdAt));
  }

  if (containsPossibleSecret(document.content)) {
    warnings.push(contextWarning(ref, "warning", "possible_secret", createdAt));
  }

  return warnings;
}

function skillWarnings(
  skill: Skill,
  ref: AgentQueueTaskContextRef,
  createdAt: string,
) {
  if (skill.reviewStatus === "reviewed") {
    return [];
  }

  if (skill.reviewStatus === "deprecated") {
    return [contextWarning(ref, "blocked", "deprecated", createdAt)];
  }

  return [contextWarning(ref, "warning", skill.reviewStatus, createdAt)];
}

function contextWarning(
  ref: AgentQueueTaskContextRef,
  severity: AgentQueueTaskContextWarning["severity"],
  code: string,
  createdAt: string,
): AgentQueueTaskContextWarning {
  return {
    code,
    createdAt,
    id: `${ref.kind}:${ref.id}:${code}`,
    message: contextWarningMessage(ref, code),
    severity,
    sourceRefId: ref.id,
  };
}

function contextWarningMessage(ref: AgentQueueTaskContextRef, code: string) {
  switch (code) {
    case "disabled":
      return `${ref.title} is disabled and cannot be used as Queue context.`;
    case "rejected":
      return `${ref.title} is rejected and cannot be used as Queue context.`;
    case "deprecated":
      return `${ref.title} is deprecated and cannot be used as Queue context.`;
    case "stale":
      return `${ref.title} is stale. Review before any future materialization.`;
    case "draft":
      return `${ref.title} is draft context. It is not reviewed project knowledge.`;
    case "needs_review":
      return `${ref.title} needs review before it is treated as reliable guidance.`;
    case "archived":
      return `${ref.title} is archived. Review before any future materialization.`;
    case "summary_missing":
      return `${ref.title} has a summary missing warning. Add a quick summary before relying on this Knowledge context.`;
    case "content_capped":
      return `${ref.title} was capped to a bounded excerpt before Queue materialization.`;
    case "large_content":
      return `${ref.title} is large and was materialized only as a bounded excerpt.`;
    case "possible_secret":
      return `${ref.title} may contain an obvious credential or token. Redact before relying on this context.`;
    default:
      return `${ref.title} has a context warning: ${code}.`;
  }
}

function containsPossibleSecret(value: string) {
  const lowered = value.toLocaleLowerCase();
  return (
    lowered.includes("-----begin private key-----") ||
    /\b(password|passwd|pwd|api[_-]?key|secret|token|access[_-]?key)\s*[:=]/i.test(value) ||
    /\baws[_-]?secret[_-]?access[_-]?key\b/i.test(value) ||
    /\bAKIA[0-9A-Z]{16}\b/.test(value)
  );
}

function visibleSummary(value: string) {
  return visibleValue(value, "Summary missing.");
}

function visibleValue(value: string, fallback: string) {
  const trimmed = value.trim();
  return trimmed || fallback;
}
