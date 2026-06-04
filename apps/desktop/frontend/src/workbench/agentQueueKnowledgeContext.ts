import type {
  AgentQueueTask,
  AgentQueueTaskContext,
  AgentQueueTaskContextRef,
  AgentQueueTaskContextWarning,
  KnowledgeDocument,
  Skill,
} from "../workspace/types";

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
  status: "attached" | "blocked" | "unavailable";
  taskTitle?: string;
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

export function queueContextSummary(context: AgentQueueTaskContext | undefined) {
  const knowledgeCount = context?.attachedKnowledgeRefs.length ?? 0;
  const skillCount = context?.attachedSkillRefs.length ?? 0;
  const blockedCount =
    context?.contextWarnings.filter((warning) => warning.severity === "blocked")
      .length ?? 0;
  const warningCount =
    context?.contextWarnings.filter((warning) => warning.severity === "warning")
      .length ?? 0;

  return { blockedCount, knowledgeCount, skillCount, warningCount };
}

export function isQueueContextAttachmentBlocked(
  input: AgentQueueKnowledgeContextAttachInput,
) {
  return buildQueueContextAttachment(input).warnings.some(
    (warning) => warning.severity === "blocked",
  );
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
    warnings: skillWarnings(skill, ref, attachedAt),
  };
}

function mergeTaskContext(
  context: AgentQueueTaskContext | undefined,
  attachment: {
    ref: AgentQueueTaskContextRef;
    warnings: AgentQueueTaskContextWarning[];
  },
): AgentQueueTaskContext {
  const existingKnowledgeRefs = context?.attachedKnowledgeRefs ?? [];
  const existingSkillRefs = context?.attachedSkillRefs ?? [];
  const existingWarnings = context?.contextWarnings ?? [];
  const nextWarnings = [
    ...existingWarnings.filter(
      (warning) => warning.sourceRefId !== attachment.ref.id,
    ),
    ...attachment.warnings,
  ];

  if (attachment.ref.kind === "knowledge_document") {
    return {
      attachedKnowledgeRefs: [
        ...existingKnowledgeRefs.filter((ref) => ref.id !== attachment.ref.id),
        attachment.ref,
      ],
      attachedSkillRefs: existingSkillRefs,
      contextWarnings: nextWarnings,
      materializedAt: null,
    };
  }

  return {
    attachedKnowledgeRefs: existingKnowledgeRefs,
    attachedSkillRefs: [
      ...existingSkillRefs.filter((ref) => ref.id !== attachment.ref.id),
      attachment.ref,
    ],
    contextWarnings: nextWarnings,
    materializedAt: null,
  };
}

function knowledgeDocumentWarnings(
  document: KnowledgeDocument,
  ref: AgentQueueTaskContextRef,
  createdAt: string,
) {
  const warnings: AgentQueueTaskContextWarning[] = [];

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
    default:
      return `${ref.title} has a context warning: ${code}.`;
  }
}

function visibleSummary(value: string) {
  return visibleValue(value, "No quick summary yet.");
}

function visibleValue(value: string, fallback: string) {
  const trimmed = value.trim();
  return trimmed || fallback;
}
