export type WidgetCategory =
  | "core"
  | "tool"
  | "codebase"
  | "database"
  | "design"
  | "knowledge"
  | "workflow";

export type WidgetDefinitionId = string;
export type WidgetInstanceId = string;
export type WorkbenchPresetId = string;

export type WidgetLayout = {
  area: string;
  order: number;
  minWidth?: number;
  minHeight?: number;
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

export type WidgetRenderProps = {
  config: Record<string, unknown>;
  definition: WidgetDefinition;
  instance: WidgetInstance;
  title: string;
};
