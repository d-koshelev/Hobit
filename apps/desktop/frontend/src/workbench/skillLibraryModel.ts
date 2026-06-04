import type {
  KnowledgeDocument,
  KnowledgeDocumentScope,
  Skill,
  SkillReviewStatus,
} from "../workspace/types";

export const DEFAULT_SKILL_TITLE = "Untitled skill";
export const DEFAULT_DOCUMENT_TITLE = "Untitled document";

export const REVIEW_STATUS_OPTIONS: Array<{
  label: string;
  value: SkillReviewStatus;
}> = [
  { label: "Draft", value: "draft" },
  { label: "Needs review", value: "needs_review" },
  { label: "Reviewed", value: "reviewed" },
  { label: "Deprecated", value: "deprecated" },
];

export type SkillDraft = {
  skillId: string | null;
  title: string;
  whenToUse: string;
  prerequisites: string;
  steps: string;
  validation: string;
  risks: string;
  tags: string;
  reviewStatus: SkillReviewStatus;
};

export type KnowledgeSurfaceTab = "skills" | "documents";

export type KnowledgeDocumentDraft = {
  knowledgeDocumentId: string | null;
  scope: KnowledgeDocumentScope;
  catalogItemType: KnowledgeDocument["catalogItemType"];
  quickSummary: string;
  lifecycleStatus: KnowledgeDocument["lifecycleStatus"];
  title: string;
  sourceLabel: string;
  sourceKind: string;
  sourceRef: string;
  content: string;
  tags: string;
  enabled: boolean;
};

export const EMPTY_SKILL_DRAFT: SkillDraft = {
  skillId: null,
  title: DEFAULT_SKILL_TITLE,
  whenToUse: "",
  prerequisites: "",
  steps: "",
  validation: "",
  risks: "",
  tags: "",
  reviewStatus: "draft",
};

export const EMPTY_DOCUMENT_DRAFT: KnowledgeDocumentDraft = {
  knowledgeDocumentId: null,
  scope: "workspace",
  catalogItemType: "documentation_knowledge",
  quickSummary: "",
  lifecycleStatus: "active",
  title: DEFAULT_DOCUMENT_TITLE,
  sourceLabel: "Workspace document",
  sourceKind: "operator_authored",
  sourceRef: "",
  content: "",
  tags: "",
  enabled: true,
};

export function skillDraftFromSkill(skill: Skill): SkillDraft {
  return {
    skillId: skill.skillId,
    title: skill.title,
    whenToUse: skill.whenToUse,
    prerequisites: skill.prerequisites,
    steps: skill.steps,
    validation: skill.validation,
    risks: skill.risks,
    tags: skill.tags,
    reviewStatus: skill.reviewStatus,
  };
}

export function knowledgeDocumentDraftFromDocument(
  document: KnowledgeDocument,
): KnowledgeDocumentDraft {
  return {
    knowledgeDocumentId: document.knowledgeDocumentId,
    scope: document.scope,
    catalogItemType: document.catalogItemType,
    quickSummary: document.quickSummary,
    lifecycleStatus: document.lifecycleStatus,
    title: document.title,
    sourceLabel: document.sourceLabel,
    sourceKind: document.sourceKind,
    sourceRef: document.sourceRef,
    content: document.content,
    tags: document.tags,
    enabled: document.enabled,
  };
}

export function hasSkillDraftContent(draft: SkillDraft) {
  return Boolean(
    draft.title.trim() !== DEFAULT_SKILL_TITLE ||
      draft.whenToUse.trim() ||
      draft.prerequisites.trim() ||
      draft.steps.trim() ||
      draft.validation.trim() ||
      draft.risks.trim() ||
      draft.tags.trim(),
  );
}

export function hasKnowledgeDocumentDraftContent(
  draft: KnowledgeDocumentDraft,
) {
  return Boolean(
    draft.title.trim() !== DEFAULT_DOCUMENT_TITLE ||
      draft.scope !== "workspace" ||
      draft.catalogItemType !== "documentation_knowledge" ||
      draft.quickSummary.trim() ||
      draft.lifecycleStatus !== "active" ||
      draft.sourceLabel.trim() !== "Workspace document" ||
      draft.sourceKind.trim() !== "operator_authored" ||
      draft.sourceRef.trim() ||
      draft.content.trim() ||
      draft.tags.trim() ||
      !draft.enabled,
  );
}

export function isSkillDraftDirty(
  draft: SkillDraft,
  selectedSkill: Skill | null,
) {
  return !draft.skillId
    ? hasSkillDraftContent(draft)
    : Boolean(
        selectedSkill &&
          (draft.title !== selectedSkill.title ||
            draft.whenToUse !== selectedSkill.whenToUse ||
            draft.prerequisites !== selectedSkill.prerequisites ||
            draft.steps !== selectedSkill.steps ||
            draft.validation !== selectedSkill.validation ||
            draft.risks !== selectedSkill.risks ||
            draft.tags !== selectedSkill.tags ||
            draft.reviewStatus !== selectedSkill.reviewStatus),
      );
}

export function isKnowledgeDocumentDraftDirty(
  draft: KnowledgeDocumentDraft,
  selectedDocument: KnowledgeDocument | null,
) {
  return !draft.knowledgeDocumentId
    ? hasKnowledgeDocumentDraftContent(draft)
    : Boolean(
        selectedDocument &&
          (draft.title !== selectedDocument.title ||
            draft.scope !== selectedDocument.scope ||
            draft.catalogItemType !== selectedDocument.catalogItemType ||
            draft.quickSummary !== selectedDocument.quickSummary ||
            draft.lifecycleStatus !== selectedDocument.lifecycleStatus ||
            draft.sourceLabel !== selectedDocument.sourceLabel ||
            draft.sourceKind !== selectedDocument.sourceKind ||
            draft.sourceRef !== selectedDocument.sourceRef ||
            draft.content !== selectedDocument.content ||
            draft.tags !== selectedDocument.tags ||
            draft.enabled !== selectedDocument.enabled),
      );
}

export function skillCoordinatorContextText(
  skill: Pick<
    Skill,
    | "prerequisites"
    | "reviewStatus"
    | "risks"
    | "steps"
    | "tags"
    | "title"
    | "validation"
    | "whenToUse"
  >,
) {
  return [
    "Skill Library Skill",
    `Title: ${visibleSkillValue(skill.title)}`,
    "When to use:",
    visibleSkillValue(skill.whenToUse),
    "Prerequisites:",
    visibleSkillValue(skill.prerequisites),
    "Steps:",
    visibleSkillValue(skill.steps),
    "Validation:",
    visibleSkillValue(skill.validation),
    "Risks:",
    visibleSkillValue(skill.risks),
    `Tags: ${visibleSkillValue(skill.tags)}`,
    `Review status: ${statusLabel(skill.reviewStatus)}`,
  ].join("\n");
}

export function statusLabel(status: SkillReviewStatus) {
  return (
    REVIEW_STATUS_OPTIONS.find((option) => option.value === status)?.label ??
    status
  );
}

export function statusVariant(status: SkillReviewStatus) {
  switch (status) {
    case "reviewed":
      return "success";
    case "needs_review":
      return "warning";
    case "deprecated":
      return "neutral";
    case "draft":
    default:
      return "info";
  }
}

function visibleSkillValue(value: string) {
  const trimmed = value.trim();
  return trimmed || "(empty)";
}
