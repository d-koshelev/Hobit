export type WidgetCategory =
  | "core"
  | "tool"
  | "codebase"
  | "database"
  | "design"
  | "knowledge"
  | "workflow"
  | "notes";

export type WidgetDefinitionId = string;
export type WidgetInstanceId = string;
export type WidgetTemplateId = string;
export type WidgetRunId = string;
export type WorkbenchPresetId = string;

export type WidgetLayoutMode = "docked" | "popped-out" | "minimized";

export type WidgetGeometry = {
  x: number;
  y: number;
  width: number;
  height: number;
  minWidth?: number;
  minHeight?: number;
  maxWidth?: number;
  maxHeight?: number;
};

export type WidgetLayout = WidgetGeometry & {
  area: string;
  mode: WidgetLayoutMode;
  order: number;
  popout?: WidgetGeometry & {
    alwaysOnTop: boolean;
    screen?: string;
  };
};

export type WidgetDefinition = {
  id: WidgetDefinitionId;
  title: string;
  category: WidgetCategory;
  description: string;
  defaultTitle: string;
  defaultConfig: Record<string, unknown>;
  componentKey: string;
};

export type WidgetInstance = {
  id: WidgetInstanceId;
  definitionId: WidgetDefinitionId;
  title: string;
  config: Record<string, unknown>;
  layout: WidgetLayout;
  visible: boolean;
};

export type WorkbenchPreset = {
  id: WorkbenchPresetId;
  title: string;
  description: string;
  widgets: WidgetInstance[];
};

export type WidgetInput = {
  data: Record<string, unknown>;
  context: Record<string, unknown>;
};

export type WidgetCommand = {
  id: string;
  type: string;
  payload: Record<string, unknown>;
  source: "operator" | "agent" | "system";
  requiresApproval: boolean;
};

export type WidgetRunStatus =
  | "idle"
  | "input-ready"
  | "waiting-for-approval"
  | "running"
  | "result-ready"
  | "completed"
  | "failed"
  | "cancelled";

export type WidgetRun = {
  id: WidgetRunId;
  widgetInstanceId: WidgetInstanceId;
  command: WidgetCommand;
  status: WidgetRunStatus;
  startedAt?: string;
  finishedAt?: string;
};

export type WidgetLogEntry = {
  id: string;
  runId: WidgetRunId;
  level: "debug" | "info" | "warning" | "error";
  message: string;
  timestamp: string;
  details?: Record<string, unknown>;
};

export type WidgetResult = {
  id: string;
  runId: WidgetRunId;
  type: string;
  summary: string;
  payload: Record<string, unknown>;
};

export type WidgetRenderProps = {
  config: Record<string, unknown>;
  definition: WidgetDefinition;
  instance: WidgetInstance;
  title: string;
};
