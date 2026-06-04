import type { KnowledgeDocument, Skill } from "../workspace/types";
import type {
  KnowledgeCatalogAttachmentState,
  KnowledgeDocumentDraft,
} from "./skillLibraryModel";

export type KnowledgeRelation = {
  label: string;
  value: string;
};

export function skillCatalogFullContent(skill: Skill) {
  return [
    sectionText("When to use", skill.whenToUse),
    sectionText("Prerequisites", skill.prerequisites),
    sectionText("Steps", skill.steps),
    sectionText("Validation", skill.validation),
    sectionText("Risks", skill.risks),
  ].join("\n\n");
}

export function knowledgeDocumentRelations({
  attachmentState,
  documents,
  draft,
  skills,
}: {
  attachmentState?: KnowledgeCatalogAttachmentState;
  documents: KnowledgeDocument[];
  draft: KnowledgeDocumentDraft;
  skills: Skill[];
}): KnowledgeRelation[] {
  const relations: KnowledgeRelation[] = [];
  const sourcePath = sourceFilePathFromValues([
    draft.sourceKind,
    draft.sourceRef,
    draft.sourceLabel,
  ]);
  const queueTaskIds = queueTaskIdsFromValues([
    draft.sourceKind,
    draft.sourceRef,
    draft.sourceLabel,
  ]);
  const commitRefs = commitRefsFromValues([
    draft.sourceKind,
    draft.sourceRef,
    draft.sourceLabel,
    draft.tags,
  ]);
  const relatedItems = relatedCatalogItemsForDocument(draft, documents, skills);

  if (sourcePath) {
    relations.push({ label: "Source file/path", value: sourcePath });
  }

  if (queueTaskIds.length > 0) {
    relations.push({
      label: "Source Queue task",
      value: queueTaskIds.join(", "),
    });
  }

  if (attachmentState?.queueTaskTitle) {
    relations.push({
      label: "Attached Queue task",
      value: attachmentState.queueTaskTitle,
    });
  }

  if (attachmentState?.workspaceAgentContextAttached) {
    relations.push({
      label: "Workspace Agent context",
      value: "Attached in this session",
    });
  }

  if (relatedItems.length > 0) {
    relations.push({
      label: "Related catalog items",
      value: relatedItems.join("\n"),
    });
  }

  if (commitRefs.length > 0) {
    relations.push({ label: "Related commits", value: commitRefs.join(", ") });
  }

  return relations;
}

export function skillRelations({
  attachmentState,
  documents,
  skill,
  skills,
}: {
  attachmentState?: KnowledgeCatalogAttachmentState;
  documents: KnowledgeDocument[];
  skill: Skill;
  skills: Skill[];
}): KnowledgeRelation[] {
  const relations: KnowledgeRelation[] = [];
  const sourceText = [skill.prerequisites, skill.risks, skill.tags];
  const sourcePath = sourceFilePathFromValues(sourceText);
  const queueTaskIds = queueTaskIdsFromValues(sourceText);
  const commitRefs = commitRefsFromValues(sourceText);
  const relatedItems = relatedCatalogItemsForSkill(skill, documents, skills);

  if (sourcePath) {
    relations.push({ label: "Source file/path", value: sourcePath });
  }

  if (queueTaskIds.length > 0) {
    relations.push({
      label: "Source Queue task",
      value: queueTaskIds.join(", "),
    });
  }

  if (attachmentState?.queueTaskTitle) {
    relations.push({
      label: "Attached Queue task",
      value: attachmentState.queueTaskTitle,
    });
  }

  if (attachmentState?.workspaceAgentContextAttached) {
    relations.push({
      label: "Workspace Agent context",
      value: "Attached in this session",
    });
  }

  if (relatedItems.length > 0) {
    relations.push({
      label: "Related catalog items",
      value: relatedItems.join("\n"),
    });
  }

  if (commitRefs.length > 0) {
    relations.push({ label: "Related commits", value: commitRefs.join(", ") });
  }

  return relations;
}

function sectionText(label: string, value: string) {
  return `${label}:\n${visibleSkillValue(value)}`;
}

function visibleSkillValue(value: string) {
  const trimmed = value.trim();
  return trimmed || "(empty)";
}

function sourceFilePathFromValues(values: string[]) {
  for (const value of values) {
    const explicitRef = sourceRefFromText(value);
    if (explicitRef && isPathLikeRef(explicitRef)) {
      return explicitRef;
    }
  }

  for (const value of values) {
    const trimmed = value.trim();
    if (trimmed === "file_import") {
      continue;
    }

    if (isPathLikeRef(trimmed)) {
      return trimmed;
    }
  }

  return "";
}

function sourceRefFromText(value: string) {
  return value.match(/\bSource ref:\s*([^\r\n]+)/i)?.[1]?.trim() ?? "";
}

function isPathLikeRef(value: string) {
  const trimmed = value.trim();

  if (!trimmed || /^https?:\/\//i.test(trimmed) || /^queue:/i.test(trimmed)) {
    return false;
  }

  return /[\\/]/.test(trimmed) || /\.[a-z0-9]{1,12}$/i.test(trimmed);
}

function queueTaskIdsFromValues(values: string[]) {
  const taskIds: string[] = [];

  for (const value of values) {
    for (const match of value.matchAll(/\bqueue(?::|\s+task\s+)([A-Za-z0-9_.-]+)/gi)) {
      addUnique(taskIds, match[1]);
    }
  }

  return taskIds;
}

function commitRefsFromValues(values: string[]) {
  const commitRefs: string[] = [];

  for (const value of values) {
    for (const match of value.matchAll(
      /\b(?:commit|sha|revision|rev)[:\s#-]+([0-9a-f]{7,40})\b/gi,
    )) {
      addUnique(commitRefs, match[1]);
    }
  }

  return commitRefs;
}

function relatedCatalogItemsForDocument(
  draft: KnowledgeDocumentDraft,
  documents: KnowledgeDocument[],
  skills: Skill[],
) {
  const tags = tagsFromText(draft.tags);
  const sourceRef = draft.sourceRef.trim().toLowerCase();
  const queueTaskIds = queueTaskIdsFromValues([draft.sourceRef, draft.sourceLabel]);
  const related: string[] = [];

  for (const document of documents) {
    if (document.knowledgeDocumentId === draft.knowledgeDocumentId) {
      continue;
    }

    const reasons = relationReasons({
      currentQueueTaskIds: queueTaskIds,
      currentSourceRef: sourceRef,
      currentTags: tags,
      otherQueueTaskIds: queueTaskIdsFromValues([
        document.sourceRef,
        document.sourceLabel,
      ]),
      otherSourceRef: document.sourceRef.trim().toLowerCase(),
      otherTags: tagsFromText(document.tags),
    });

    if (reasons.length > 0) {
      related.push(`${document.title} (${reasons.join(", ")})`);
    }
  }

  for (const skill of skills) {
    const reasons = relationReasons({
      currentQueueTaskIds: queueTaskIds,
      currentSourceRef: sourceRef,
      currentTags: tags,
      otherQueueTaskIds: queueTaskIdsFromValues([skill.prerequisites]),
      otherSourceRef: sourceRefFromText(skill.prerequisites).toLowerCase(),
      otherTags: tagsFromText(skill.tags),
    });

    if (reasons.length > 0) {
      related.push(`${skill.title} (${reasons.join(", ")})`);
    }
  }

  return related.slice(0, 5);
}

function relatedCatalogItemsForSkill(
  skill: Skill,
  documents: KnowledgeDocument[],
  skills: Skill[],
) {
  const tags = tagsFromText(skill.tags);
  const sourceRef = sourceRefFromText(skill.prerequisites).toLowerCase();
  const queueTaskIds = queueTaskIdsFromValues([skill.prerequisites]);
  const related: string[] = [];

  for (const document of documents) {
    const reasons = relationReasons({
      currentQueueTaskIds: queueTaskIds,
      currentSourceRef: sourceRef,
      currentTags: tags,
      otherQueueTaskIds: queueTaskIdsFromValues([
        document.sourceRef,
        document.sourceLabel,
      ]),
      otherSourceRef: document.sourceRef.trim().toLowerCase(),
      otherTags: tagsFromText(document.tags),
    });

    if (reasons.length > 0) {
      related.push(`${document.title} (${reasons.join(", ")})`);
    }
  }

  for (const otherSkill of skills) {
    if (otherSkill.skillId === skill.skillId) {
      continue;
    }

    const reasons = relationReasons({
      currentQueueTaskIds: queueTaskIds,
      currentSourceRef: sourceRef,
      currentTags: tags,
      otherQueueTaskIds: queueTaskIdsFromValues([otherSkill.prerequisites]),
      otherSourceRef: sourceRefFromText(otherSkill.prerequisites).toLowerCase(),
      otherTags: tagsFromText(otherSkill.tags),
    });

    if (reasons.length > 0) {
      related.push(`${otherSkill.title} (${reasons.join(", ")})`);
    }
  }

  return related.slice(0, 5);
}

function relationReasons({
  currentQueueTaskIds,
  currentSourceRef,
  currentTags,
  otherQueueTaskIds,
  otherSourceRef,
  otherTags,
}: {
  currentQueueTaskIds: string[];
  currentSourceRef: string;
  currentTags: string[];
  otherQueueTaskIds: string[];
  otherSourceRef: string;
  otherTags: string[];
}) {
  const reasons: string[] = [];
  const sharedTags = currentTags.filter((tag) => otherTags.includes(tag));
  const sharedQueueTasks = currentQueueTaskIds.filter((taskId) =>
    otherQueueTaskIds.includes(taskId),
  );

  if (sharedTags.length > 0) {
    reasons.push(`tags: ${sharedTags.slice(0, 3).join(", ")}`);
  }

  if (currentSourceRef && currentSourceRef === otherSourceRef) {
    reasons.push("same source ref");
  }

  if (sharedQueueTasks.length > 0) {
    reasons.push(`Queue task: ${sharedQueueTasks.slice(0, 2).join(", ")}`);
  }

  return reasons;
}

function tagsFromText(value: string) {
  return value
    .split(/[,;#]/)
    .map((tag) => tag.trim().toLowerCase())
    .filter(Boolean);
}

function addUnique(values: string[], value: string | undefined) {
  const normalized = value?.trim();

  if (normalized && !values.includes(normalized)) {
    values.push(normalized);
  }
}
