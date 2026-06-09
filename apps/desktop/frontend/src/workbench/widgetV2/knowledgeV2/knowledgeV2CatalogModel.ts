import type { KnowledgeDocument } from "../../../workspace/types/knowledgeDocuments";
import type { Skill, SkillReviewStatus } from "../../../workspace/types/skills";
import type {
  KnowledgeV2CatalogFilters,
  KnowledgeV2CatalogItem,
  KnowledgeV2CatalogItemType,
  KnowledgeV2CatalogLifecycleState,
  KnowledgeV2CatalogSelection,
  KnowledgeV2CatalogSort,
  KnowledgeV2CatalogViewModel,
  KnowledgeV2CatalogWarning,
} from "./knowledgeV2CatalogTypes";

export type KnowledgeV2CatalogInput = {
  readonly documents: readonly KnowledgeDocument[];
  readonly skills: readonly Skill[];
};

export function buildKnowledgeV2CatalogViewModel({
  documents,
  filters = {},
  selection,
  skills,
  sort = "updated-desc",
}: KnowledgeV2CatalogInput & {
  readonly filters?: KnowledgeV2CatalogFilters;
  readonly selection?: KnowledgeV2CatalogSelection;
  readonly sort?: KnowledgeV2CatalogSort;
}): KnowledgeV2CatalogViewModel {
  const items = sortKnowledgeV2CatalogItems(
    normalizeKnowledgeV2CatalogItems({ documents, skills }),
    sort,
  );
  const filteredItems = filterKnowledgeV2CatalogItems(items, filters);

  return {
    filteredItems,
    items,
    selection: reconcileKnowledgeV2CatalogSelection(
      filteredItems,
      selection ?? defaultKnowledgeV2CatalogSelection(),
    ),
  };
}

export function normalizeKnowledgeV2CatalogItems({
  documents,
  skills,
}: KnowledgeV2CatalogInput): KnowledgeV2CatalogItem[] {
  return [
    ...documents.map(normalizeKnowledgeV2DocumentItem),
    ...skills.map(normalizeKnowledgeV2SkillItem),
  ];
}

export function normalizeKnowledgeV2DocumentItem(
  document: KnowledgeDocument,
): KnowledgeV2CatalogItem {
  const type = knowledgeV2TypeFromDocument(document);
  const tags = parseKnowledgeV2Tags(document.tags);
  const summary =
    document.quickSummary.trim() ||
    firstUsefulLine(document.content) ||
    "No quick summary yet.";
  const sourceRefs = document.sourceRefs ?? [];
  const warnings = knowledgeV2DocumentWarnings(document, summary);

  return {
    createdAt: document.createdAt,
    description: document.content.trim() || summary,
    documentSubtype: document.catalogItemType,
    enabled: document.enabled,
    id: `document:${document.knowledgeDocumentId}`,
    lifecycleState: document.lifecycleStatus,
    recordId: document.knowledgeDocumentId,
    recordKind: "document",
    reviewState: document.lifecycleStatus,
    searchable: document.searchable !== false,
    searchableText: knowledgeV2SearchableText([
      document.title,
      summary,
      document.catalogItemType,
      document.lifecycleStatus,
      document.scope,
      document.sourceLabel,
      document.sourceKind,
      document.sourceRef,
      document.versionSummary ?? "",
      ...tags,
    ]),
    source: {
      kind: document.sourceKind,
      label: document.sourceLabel,
      ref: document.sourceRef,
      scope: document.scope,
    },
    sourceRefCount: sourceRefs.length,
    sourceRefs: {
      count: sourceRefs.length,
      refs: sourceRefs,
    },
    summary,
    tags,
    title: document.title.trim() || "Untitled document",
    type,
    updatedAt: document.updatedAt,
    warnings,
  };
}

export function normalizeKnowledgeV2SkillItem(
  skill: Skill,
): KnowledgeV2CatalogItem {
  const lifecycleState = lifecycleStateFromSkillReviewStatus(skill.reviewStatus);
  const tags = parseKnowledgeV2Tags(skill.tags);
  const summary =
    firstUsefulLine(skill.whenToUse) ||
    firstUsefulLine(skill.steps) ||
    "No quick summary yet.";
  const warnings = knowledgeV2SkillWarnings(skill, summary);

  return {
    createdAt: skill.createdAt,
    description: skill.whenToUse.trim() || summary,
    enabled: skill.reviewStatus !== "deprecated",
    id: `skill:${skill.skillId}`,
    lifecycleState,
    recordId: skill.skillId,
    recordKind: "skill",
    reviewState: skill.reviewStatus,
    searchable: skill.reviewStatus === "reviewed",
    searchableText: knowledgeV2SearchableText([
      skill.title,
      summary,
      "skill",
      skill.reviewStatus,
      skill.whenToUse,
      skill.prerequisites,
      skill.steps,
      skill.validation,
      skill.risks,
      ...tags,
    ]),
    source: {
      kind: "operator_authored",
      label: "Workspace Skill",
      scope: "workspace",
    },
    sourceRefCount: 0,
    sourceRefs: {
      count: 0,
      refs: [],
    },
    summary,
    tags,
    title: skill.title.trim() || "Untitled skill",
    type: "skill",
    updatedAt: skill.updatedAt,
    warnings,
  };
}

export function filterKnowledgeV2CatalogItems(
  items: readonly KnowledgeV2CatalogItem[],
  filters: KnowledgeV2CatalogFilters = {},
): KnowledgeV2CatalogItem[] {
  const text = normalizeKnowledgeV2Text(filters.text ?? "");
  const types = new Set(filters.types ?? []);
  const lifecycleStates = new Set(filters.lifecycleStates ?? []);
  const reviewStates = new Set(filters.reviewStates ?? []);
  const tags = new Set((filters.tags ?? []).map(normalizeKnowledgeV2Text));
  const scopes = new Set(filters.scopes ?? []);
  const sourceKinds = new Set(
    (filters.sourceKinds ?? []).map(normalizeKnowledgeV2Text),
  );

  return items.filter((item) => {
    if (!filters.includeDrafts && item.type === "draft") {
      return false;
    }
    if (types.size > 0 && !types.has(item.type)) {
      return false;
    }
    if (
      lifecycleStates.size > 0 &&
      !lifecycleStates.has(item.lifecycleState)
    ) {
      return false;
    }
    if (
      reviewStates.size > 0 &&
      (!item.reviewState || !reviewStates.has(item.reviewState))
    ) {
      return false;
    }
    if (filters.enabled === "enabled" && item.enabled === false) {
      return false;
    }
    if (filters.enabled === "disabled" && item.enabled !== false) {
      return false;
    }
    if (filters.searchable === "searchable" && item.searchable === false) {
      return false;
    }
    if (filters.searchable === "not_searchable" && item.searchable !== false) {
      return false;
    }
    if (text && !item.searchableText.includes(text)) {
      return false;
    }
    if (tags.size > 0 && !item.tags.some((tag) => tags.has(normalizeKnowledgeV2Text(tag)))) {
      return false;
    }
    if (
      scopes.size > 0 &&
      (!item.source.scope || !scopes.has(item.source.scope))
    ) {
      return false;
    }
    if (
      sourceKinds.size > 0 &&
      !sourceKinds.has(normalizeKnowledgeV2Text(item.source.kind ?? ""))
    ) {
      return false;
    }

    return true;
  });
}

export function sortKnowledgeV2CatalogItems(
  items: readonly KnowledgeV2CatalogItem[],
  sort: KnowledgeV2CatalogSort = "updated-desc",
): KnowledgeV2CatalogItem[] {
  return [...items].sort((left, right) => compareKnowledgeV2Items(left, right, sort));
}

export function reconcileKnowledgeV2CatalogSelection(
  items: readonly KnowledgeV2CatalogItem[],
  selection: KnowledgeV2CatalogSelection,
): KnowledgeV2CatalogSelection {
  if (
    selection.selectedItemId &&
    items.some((item) => item.id === selection.selectedItemId)
  ) {
    return selection;
  }

  return {
    selectedItemId: null,
    selectedPreviewKind: selection.selectedPreviewKind,
  };
}

export function defaultKnowledgeV2CatalogSelection(): KnowledgeV2CatalogSelection {
  return {
    selectedItemId: null,
    selectedPreviewKind: "summary",
  };
}

function knowledgeV2TypeFromDocument(
  document: KnowledgeDocument,
): KnowledgeV2CatalogItemType {
  return document.catalogItemType === "runbook" ? "runbook" : "document";
}

function lifecycleStateFromSkillReviewStatus(
  status: SkillReviewStatus,
): KnowledgeV2CatalogLifecycleState {
  switch (status) {
    case "reviewed":
      return "active";
    case "deprecated":
      return "archived";
    case "needs_review":
      return "needs_review";
    case "draft":
    default:
      return "draft";
  }
}

function compareKnowledgeV2Items(
  left: KnowledgeV2CatalogItem,
  right: KnowledgeV2CatalogItem,
  sort: KnowledgeV2CatalogSort,
) {
  switch (sort) {
    case "updated-asc":
      return compareTime(left.updatedAt, right.updatedAt) || compareTitle(left, right);
    case "title-asc":
      return compareTitle(left, right);
    case "title-desc":
      return compareTitle(right, left);
    case "type-asc":
      return left.type.localeCompare(right.type) || compareTitle(left, right);
    case "updated-desc":
    default:
      return compareTime(right.updatedAt, left.updatedAt) || compareTitle(left, right);
  }
}

function compareTitle(left: KnowledgeV2CatalogItem, right: KnowledgeV2CatalogItem) {
  return left.title.localeCompare(right.title);
}

function compareTime(left?: string | null, right?: string | null) {
  return timestamp(left) - timestamp(right);
}

function timestamp(value?: string | null) {
  const parsed = value ? new Date(value).getTime() : 0;
  return Number.isFinite(parsed) ? parsed : 0;
}

function knowledgeV2DocumentWarnings(
  document: KnowledgeDocument,
  summary: string,
): KnowledgeV2CatalogWarning[] {
  return [
    document.quickSummary.trim()
      ? null
      : {
          code: "missing_quick_summary",
          message:
            summary === "No quick summary yet."
              ? "Document has no quick summary or content preview."
              : "Document has no quick summary; using the first content line.",
          severity: "info" as const,
        },
    document.enabled ? null : disabledWarning("Document is disabled."),
    document.searchable === false
      ? disabledWarning("Document is marked not searchable.")
      : null,
    document.lifecycleStatus === "rejected"
      ? {
          code: "rejected",
          message: "Rejected document is unavailable for normal catalog use.",
          severity: "blocked" as const,
        }
      : null,
    document.lifecycleStatus === "stale"
      ? {
          code: "stale",
          message: "Stale document may need review before normal use.",
          severity: "warning" as const,
        }
      : null,
    document.content.length > 12_000
      ? {
          code: "large_content",
          message: "Large document preview is capped in this browser.",
          severity: "info" as const,
        }
      : null,
  ].filter((warning): warning is KnowledgeV2CatalogWarning => Boolean(warning));
}

function knowledgeV2SkillWarnings(
  skill: Skill,
  summary: string,
): KnowledgeV2CatalogWarning[] {
  return [
    summary === "No quick summary yet."
      ? {
          code: "missing_skill_summary",
          message: "Skill has no when-to-use or steps summary.",
          severity: "info" as const,
        }
      : null,
    skill.reviewStatus === "deprecated"
      ? disabledWarning("Deprecated Skill is unavailable for normal catalog use.")
      : null,
    skill.steps.length + skill.whenToUse.length + skill.validation.length > 8_000
      ? {
          code: "large_skill",
          message: "Large Skill preview is capped in this browser.",
          severity: "info" as const,
        }
      : null,
  ].filter((warning): warning is KnowledgeV2CatalogWarning => Boolean(warning));
}

function disabledWarning(message: string): KnowledgeV2CatalogWarning {
  return {
    code: "unavailable",
    message,
    severity: "warning",
  };
}

function parseKnowledgeV2Tags(value: string) {
  return value
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);
}

function knowledgeV2SearchableText(values: readonly string[]) {
  return normalizeKnowledgeV2Text(values.filter(Boolean).join("\n"));
}

function normalizeKnowledgeV2Text(value: string) {
  return value.trim().toLowerCase();
}

function firstUsefulLine(value: string) {
  return (
    value
      .split(/\r?\n/)
      .map((line) => line.trim())
      .find(Boolean) ?? ""
  );
}
