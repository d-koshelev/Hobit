import type {
  AgentQueueTaskExecutionPolicy,
  AgentQueueTaskItemType,
} from "../../workspace/types";

export type PromptPackFileSource =
  | "browser-file"
  | "desktop-file"
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
  | "pack_metadata_missing"
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
  id: string;
  name: string;
  sourcePaths: string[];
};

export type PromptPackImportItem = {
  allowedScope: string[];
  dependencies: string[];
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

export type ParsePromptPackOptions = {
  dependencyPolicy?: PromptPackDependencyPolicy;
  defaultModelProfile?: string | null;
  defaultReasoningEffort?: string | null;
  defaultValidatorProfile?: string | null;
};
