import type {
  KnowledgeDocument,
  KnowledgeDocumentScope,
  KnowledgeLifecycleStatus,
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

export type KnowledgeSurfaceTab = "catalog" | "skills";

export type KnowledgeCatalogView =
  | "all"
  | "active"
  | "global"
  | "workspace"
  | "skills"
  | "codebase"
  | "docs"
  | "decisions"
  | "runbooks"
  | "prompt_templates"
  | "validation_rules"
  | "workflows"
  | "drafts"
  | "stale"
  | "archived";

export type KnowledgeCatalogRecordKind = "document" | "skill";

export type KnowledgeCatalogListItem = {
  id: string;
  recordKind: KnowledgeCatalogRecordKind;
  recordId: string;
  title: string;
  typeLabel: string;
  scopeLabel: string;
  statusLabel: string;
  status: KnowledgeLifecycleStatus;
  tags: string;
  updatedAt: string;
  quickSummary: string;
};

export type KnowledgeCatalogAttachmentState = {
  queueTaskTitle?: string;
  workspaceAgentContextAttached?: boolean;
};

export type { KnowledgeRelation } from "./skillLibraryModelRelations";
export {
  knowledgeDocumentRelations,
  skillCatalogFullContent,
  skillRelations,
} from "./skillLibraryModelRelations";

export const KNOWLEDGE_CATALOG_VIEW_OPTIONS: Array<{
  label: string;
  value: KnowledgeCatalogView;
}> = [
  { label: "All", value: "all" },
  { label: "Active", value: "active" },
  { label: "Global", value: "global" },
  { label: "Workspace", value: "workspace" },
  { label: "Skills", value: "skills" },
  { label: "Codebase", value: "codebase" },
  { label: "Docs", value: "docs" },
  { label: "Decisions", value: "decisions" },
  { label: "Runbooks", value: "runbooks" },
  { label: "Prompt templates", value: "prompt_templates" },
  { label: "Validation rules", value: "validation_rules" },
  { label: "Workflows", value: "workflows" },
  { label: "Drafts", value: "drafts" },
  { label: "Stale", value: "stale" },
  { label: "Archived", value: "archived" },
];

export const KNOWLEDGE_DOCUMENT_TYPE_OPTIONS: Array<{
  label: string;
  value: KnowledgeDocument["catalogItemType"];
}> = [
  { label: "Codebase", value: "codebase_knowledge" },
  { label: "Docs", value: "documentation_knowledge" },
  { label: "Decision", value: "architecture_decision" },
  { label: "Runbook", value: "runbook" },
  { label: "Prompt template", value: "prompt_template" },
  { label: "Validation rule", value: "validation_rule" },
  { label: "Known issue", value: "known_issue" },
  { label: "Workflow", value: "workflow" },
  { label: "Command history summary", value: "command_history_summary" },
  { label: "Investigation summary", value: "investigation_summary" },
  { label: "External reference", value: "external_reference" },
];

export const KNOWLEDGE_LIFECYCLE_STATUS_OPTIONS: Array<{
  label: string;
  value: KnowledgeLifecycleStatus;
}> = [
  { label: "Draft", value: "draft" },
  { label: "Active", value: "active" },
  { label: "Stale", value: "stale" },
  { label: "Archived", value: "archived" },
  { label: "Rejected", value: "rejected" },
];

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

export function knowledgeCatalogItemsFromRecords(
  documents: KnowledgeDocument[],
  skills: Skill[],
): KnowledgeCatalogListItem[] {
  return [
    ...documents.map(knowledgeCatalogItemFromDocument),
    ...skills.map(knowledgeCatalogItemFromSkill),
  ].sort(compareKnowledgeCatalogItems);
}

export function filterKnowledgeCatalogItems(
  items: KnowledgeCatalogListItem[],
  view: KnowledgeCatalogView,
) {
  return items.filter((item) => knowledgeCatalogItemMatchesView(item, view));
}

export function knowledgeCatalogTypeLabel(
  type: KnowledgeDocument["catalogItemType"],
) {
  return (
    KNOWLEDGE_DOCUMENT_TYPE_OPTIONS.find((option) => option.value === type)
      ?.label ?? type
  );
}

export function knowledgeLifecycleStatusLabel(
  status: KnowledgeLifecycleStatus,
) {
  return (
    KNOWLEDGE_LIFECYCLE_STATUS_OPTIONS.find((option) => option.value === status)
      ?.label ?? status
  );
}

export function knowledgeDocumentScopeLabel(scope: KnowledgeDocumentScope) {
  return scope === "global" ? "Global" : "Workspace";
}

export function formatKnowledgeCatalogDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value || "Unknown";
  }

  return date.toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
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

function knowledgeCatalogItemFromDocument(
  document: KnowledgeDocument,
): KnowledgeCatalogListItem {
  return {
    id: `document:${document.knowledgeDocumentId}`,
    quickSummary:
      document.quickSummary.trim() ||
      firstUsefulLine(document.content) ||
      "No quick summary yet.",
    recordId: document.knowledgeDocumentId,
    recordKind: "document",
    scopeLabel: knowledgeDocumentScopeLabel(document.scope),
    status: document.lifecycleStatus,
    statusLabel: knowledgeLifecycleStatusLabel(document.lifecycleStatus),
    tags: document.tags,
    title: document.title,
    typeLabel: knowledgeCatalogTypeLabel(document.catalogItemType),
    updatedAt: document.updatedAt,
  };
}

function knowledgeCatalogItemFromSkill(skill: Skill): KnowledgeCatalogListItem {
  const status = skillLifecycleStatus(skill.reviewStatus);

  return {
    id: `skill:${skill.skillId}`,
    quickSummary:
      firstUsefulLine(skill.whenToUse) ||
      firstUsefulLine(skill.steps) ||
      "No quick summary yet.",
    recordId: skill.skillId,
    recordKind: "skill",
    scopeLabel: "Workspace",
    status,
    statusLabel: statusLabel(skill.reviewStatus),
    tags: skill.tags,
    title: skill.title,
    typeLabel: "Skill",
    updatedAt: skill.updatedAt,
  };
}

function compareKnowledgeCatalogItems(
  left: KnowledgeCatalogListItem,
  right: KnowledgeCatalogListItem,
) {
  const updatedCompare =
    new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime();
  if (updatedCompare !== 0) {
    return updatedCompare;
  }

  return left.title.localeCompare(right.title);
}

function knowledgeCatalogItemMatchesView(
  item: KnowledgeCatalogListItem,
  view: KnowledgeCatalogView,
) {
  switch (view) {
    case "active":
      return item.status === "active";
    case "global":
      return item.scopeLabel === "Global";
    case "workspace":
      return item.scopeLabel === "Workspace";
    case "skills":
      return item.recordKind === "skill";
    case "codebase":
      return item.typeLabel === "Codebase";
    case "docs":
      return item.typeLabel === "Docs";
    case "decisions":
      return item.typeLabel === "Decision";
    case "runbooks":
      return item.typeLabel === "Runbook";
    case "prompt_templates":
      return item.typeLabel === "Prompt template";
    case "validation_rules":
      return item.typeLabel === "Validation rule";
    case "workflows":
      return item.typeLabel === "Workflow";
    case "drafts":
      return item.status === "draft";
    case "stale":
      return item.status === "stale";
    case "archived":
      return item.status === "archived";
    case "all":
    default:
      return true;
  }
}

function skillLifecycleStatus(
  reviewStatus: SkillReviewStatus,
): KnowledgeLifecycleStatus {
  switch (reviewStatus) {
    case "reviewed":
      return "active";
    case "deprecated":
      return "archived";
    case "draft":
    case "needs_review":
    default:
      return "draft";
  }
}

function firstUsefulLine(value: string) {
  return (
    value
      .split(/\r?\n/)
      .map((line) => line.trim())
      .find(Boolean) ?? ""
  );
}
