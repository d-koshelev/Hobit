import type {
  AgentQueueTaskExecutionPolicy,
  AgentQueueTaskItemType,
} from "../../workspace/types";
import type { SmartQueueMaterializationPreview } from "../queue/smartQueuePromptPackMaterialization";

export type PromptPackFileSource =
  | "browser-file"
  | "desktop-file"
  | "desktop-prompt-pack"
  | "drag-drop"
  | "test"
  | "unknown";

export type PromptPackFileEntry = Readonly<{
  name?: string;
  path?: string;
  size?: number;
  source?: PromptPackFileSource | string;
  text: string;
}>;

export type PromptPackSeverity = "error" | "warning";

export type PromptPackDiagnosticCode =
  | "duplicate_item_id"
  | "empty_input"
  | "invalid_json"
  | "missing_body"
  | "missing_item_id"
  | "numeric_dependency_suggestion"
  | "no_selected_items"
  | "pack_metadata_missing"
  | "unselected_dependency"
  | "unsupported_file"
  | "unresolved_dependency"
  | "dependency_cycle";

export type PromptPackDiagnostic = {
  code: PromptPackDiagnosticCode;
  itemId?: string;
  message: string;
  path?: string;
  severity: PromptPackSeverity;
};

export type PromptPackDependencyPolicy =
  | "explicit_only"
  | "suggest_numeric_order"
  | "hard_numeric_order";

export type PromptPackMetadata = {
  description?: string | null;
  id: string;
  name: string;
  sourcePaths: string[];
};

export type PromptPackImportItem = {
  allowedScope: string[];
  dependencies: string[];
  executionWorkspace: string | null;
  expectedCommitTitle: string | null;
  forbiddenScope: string[];
  id: string;
  itemType: AgentQueueTaskItemType;
  modelProfile: string | null;
  numericOrder: number | null;
  priority: number;
  promptBody: string;
  queueDraft: PromptPackQueueDraft;
  reasoningEffort: string | null;
  sourcePath: string | null;
  suggestedDependencyIds: string[];
  tags: string[];
  title: string;
  validationCommands: string[];
  validatorProfile: string | null;
};

export type PromptPackQueueDraft = {
  dependencies: string[];
  description: string;
  executionPolicy: AgentQueueTaskExecutionPolicy;
  executionWorkspace?: string;
  itemType: AgentQueueTaskItemType;
  priority: number;
  prompt: string;
  queueTagName?: string;
  status: "draft";
  title: string;
};

export type PromptPackImportPlan = {
  dependencyPolicy: PromptPackDependencyPolicy;
  diagnostics: PromptPackDiagnostic[];
  errors: PromptPackDiagnostic[];
  items: PromptPackImportItem[];
  pack: PromptPackMetadata;
  warnings: PromptPackDiagnostic[];
};

export type PromptPackDependencyGraphSummary = {
  blockedSelectedItemCount: number;
  edgeCount: number;
  hasCycles: boolean;
  leafItemCount: number;
  maxDepth: number;
  rootItemCount: number;
  selectedItemCount: number;
  totalItemCount: number;
  unresolvedDependencyCount: number;
};

export type PromptPackModelRoute = {
  itemIds: string[];
  modelProfile: string;
  reasoningEffort: string;
  validatorProfile: string;
};

export type PromptPackImportPreviewModel = {
  dependencyGraphSummary: PromptPackDependencyGraphSummary;
  errors: PromptPackDiagnostic[];
  expectedCommitTitles: string[];
  importAvailable: boolean;
  itemCount: number;
  modelRouting: PromptPackModelRoute[];
  pack: PromptPackMetadata;
  selectedItemIds: string[];
  selectedItems: PromptPackImportItem[];
  smartQueueMaterialization: SmartQueueMaterializationPreview;
  sourceAdapter: PromptPackSourceAdapterStatus;
  unselectedItems: PromptPackImportItem[];
  unresolvedDependencies: PromptPackDiagnostic[];
  validationCommands: string[];
  warnings: PromptPackDiagnostic[];
};

export type PromptPackImportValidation = {
  blockingErrors: PromptPackDiagnostic[];
  canImport: boolean;
  warnings: PromptPackDiagnostic[];
};

export type PromptPackSourceAdapterStatus = {
  kind: "available" | "unavailable";
  label: string;
  message: string;
};

export type PromptPackMaterializationDiagnosticCode =
  | "dependency_link_failed"
  | "dependency_link_skipped"
  | "import_blocked"
  | "item_create_failed"
  | "metadata_preserved_in_prompt"
  | "queue_blocked_status_unsupported"
  | "queue_metadata_field_unsupported";

export type PromptPackMaterializationDiagnostic = {
  code: PromptPackMaterializationDiagnosticCode;
  dependencyItemId?: string;
  itemId?: string;
  message: string;
};

export type PromptPackCreatedQueueTask = {
  itemId: string;
  queueItemId: string;
  title: string;
};

export type PromptPackDependencyMaterializationLink = {
  dependencyItemId: string;
  dependencyQueueItemId?: string;
  dependentItemId: string;
  dependentQueueItemId?: string;
  message?: string;
  status: "created" | "skipped";
};

export type PromptPackMaterializationResult = {
  createdTasks: PromptPackCreatedQueueTask[];
  dependencyLinksCreated: PromptPackDependencyMaterializationLink[];
  dependencyLinksSkipped: PromptPackDependencyMaterializationLink[];
  errors: PromptPackMaterializationDiagnostic[];
  ok: boolean;
  warnings: PromptPackMaterializationDiagnostic[];
};

export type ParsePromptPackOptions = {
  dependencyPolicy?: PromptPackDependencyPolicy;
  defaultModelProfile?: string | null;
  defaultReasoningEffort?: string | null;
  defaultValidatorProfile?: string | null;
};
