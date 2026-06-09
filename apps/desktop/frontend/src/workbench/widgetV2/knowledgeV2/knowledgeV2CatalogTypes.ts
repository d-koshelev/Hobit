import type {
  KnowledgeCatalogItemType,
  KnowledgeDocumentScope,
  KnowledgeLifecycleStatus,
  KnowledgeSourceRef,
} from "../../../workspace/types/knowledgeDocuments";
import type { SkillReviewStatus } from "../../../workspace/types/skills";

export type KnowledgeV2CatalogItemType =
  | "document"
  | "skill"
  | "runbook"
  | "draft";

export type KnowledgeV2CatalogRecordKind = "document" | "skill" | "draft";

export type KnowledgeV2CatalogLifecycleState =
  | KnowledgeLifecycleStatus
  | "needs_review"
  | "reviewed"
  | "deprecated";

export type KnowledgeV2CatalogWarningSeverity = "info" | "warning" | "blocked";

export type KnowledgeV2CatalogWarning = {
  readonly code: string;
  readonly message: string;
  readonly severity: KnowledgeV2CatalogWarningSeverity;
};

export type KnowledgeV2CatalogSource = {
  readonly scope?: KnowledgeDocumentScope | "workspace" | null;
  readonly label?: string | null;
  readonly kind?: string | null;
  readonly ref?: string | null;
};

export type KnowledgeV2CatalogSourceRefs = {
  readonly count: number;
  readonly refs: readonly KnowledgeSourceRef[];
};

export type KnowledgeV2CatalogItem = {
  readonly id: string;
  readonly recordKind: KnowledgeV2CatalogRecordKind;
  readonly recordId: string;
  readonly type: KnowledgeV2CatalogItemType;
  readonly documentSubtype?: KnowledgeCatalogItemType;
  readonly title: string;
  readonly summary: string;
  readonly description: string;
  readonly source: KnowledgeV2CatalogSource;
  readonly sourcePreview: string;
  readonly sourcePreviewCapped: boolean;
  readonly sourcePreviewLength: number;
  readonly lifecycleState: KnowledgeV2CatalogLifecycleState;
  readonly reviewState?: SkillReviewStatus | KnowledgeLifecycleStatus;
  readonly enabled?: boolean;
  readonly searchable?: boolean;
  readonly tags: readonly string[];
  readonly sourceRefs: KnowledgeV2CatalogSourceRefs;
  readonly sourceRefCount: number;
  readonly version?: string | null;
  readonly versionSummary?: string | null;
  readonly createdAt?: string | null;
  readonly createdBy?: string | null;
  readonly createdByTaskId?: string | null;
  readonly createdFromRunId?: string | null;
  readonly reviewedAt?: string | null;
  readonly updatedAt?: string | null;
  readonly warnings: readonly KnowledgeV2CatalogWarning[];
  readonly searchableText: string;
};

export type KnowledgeV2CatalogFilters = {
  readonly types?: readonly KnowledgeV2CatalogItemType[];
  readonly lifecycleStates?: readonly KnowledgeV2CatalogLifecycleState[];
  readonly reviewStates?: readonly string[];
  readonly enabled?: "all" | "enabled" | "disabled";
  readonly searchable?: "all" | "searchable" | "not_searchable";
  readonly text?: string;
  readonly tags?: readonly string[];
  readonly scopes?: ReadonlyArray<KnowledgeDocumentScope | "workspace">;
  readonly sourceKinds?: readonly string[];
  readonly includeDrafts?: boolean;
};

export type KnowledgeV2CatalogSort =
  | "updated-desc"
  | "updated-asc"
  | "title-asc"
  | "title-desc"
  | "type-asc";

export type KnowledgeV2CatalogSelection = {
  readonly selectedItemId: string | null;
  readonly selectedPreviewKind: KnowledgeV2CatalogPreviewKind;
};

export type KnowledgeV2CatalogPreviewKind =
  | "summary"
  | "details"
  | "source"
  | "warnings";

export type KnowledgeV2CatalogViewModel = {
  readonly items: readonly KnowledgeV2CatalogItem[];
  readonly filteredItems: readonly KnowledgeV2CatalogItem[];
  readonly selection: KnowledgeV2CatalogSelection;
};
