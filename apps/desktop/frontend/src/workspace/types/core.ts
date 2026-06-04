export type WorkspaceSummary = {
  id: string;
  title: string;
  description: string | null;
  status: string;
  createdAt: string;
  updatedAt: string;
  lastOpenedAt: string | null;
  widgetCount: number;
  workspaceAgentCount: number;
  noteCount: number;
  skillCount: number;
  knowledgeDocumentCount: number;
  queueTaskCount: number;
  workbenchId: string | null;
};

export type CreateWorkspaceRequest = {
  title: string;
  description?: string | null;
};

export type UpdateWorkspaceRequest = {
  workspaceId: string;
  title: string;
};

export type DeleteWorkspaceRequest = {
  workspaceId: string;
};

export type DeleteWorkspaceResponse = {
  deletedWorkspaceId: string;
  deleted: boolean;
  remainingWorkspaces: WorkspaceSummary[];
};

export type AddWidgetInstanceToWorkbenchRequest = {
  workspaceId: string;
  workbenchId: string;
  definitionId: string;
  title: string;
  category: string;
};

export type UpdateWidgetInstanceStateRequest = {
  workspaceId: string;
  workbenchId: string;
  widgetInstanceId: string;
  state: string;
};

export type WidgetInstanceLayoutUpdate = {
  layoutMode: string;
  dockX: number | null;
  dockY: number | null;
  dockWidth: number | null;
  dockHeight: number | null;
  popoutX: number | null;
  popoutY: number | null;
  popoutWidth: number | null;
  popoutHeight: number | null;
  alwaysOnTop: boolean;
  isVisible: boolean;
};

export type UpdateWidgetInstanceLayoutRequest = {
  workspaceId: string;
  workbenchId: string;
  widgetInstanceId: string;
  layout: WidgetInstanceLayoutUpdate;
};

export type DeleteWidgetInstanceFromWorkbenchRequest = {
  workspaceId: string;
  workbenchId: string;
  widgetInstanceId: string;
};

export type ListWidgetLogsRequest = {
  workspaceId: string;
  workbenchId: string;
  widgetInstanceId: string;
  limit: number;
};

export type WidgetLogEntry = {
  id: string;
  widgetInstanceId: string;
  runId: string | null;
  level: string;
  message: string;
  payload: string | null;
  createdAt: string;
};

export type WorkspaceSessionSummary = {
  id: string;
  workspaceId: string;
  status: string;
  activeWidgetId: string | null;
};

export type WorkspaceWorkbenchState = {
  workspace: WorkspaceSummary;
  workbench: WorkbenchSummary | null;
  widgetInstances: WorkspaceWidgetInstanceSummary[];
  sharedStateObjects: WorkspaceSharedStateObjectSummary[];
  recentEvents: WorkspaceEventSummary[];
};

export type WorkbenchSummary = {
  id: string;
  workspaceId: string;
  presetOriginId: string | null;
};

export type WorkspaceWidgetInstanceSummary = {
  id: string;
  definitionId: string;
  title: string;
  category: string;
  layoutMode: string;
  dockX: number | null;
  dockY: number | null;
  dockWidth: number | null;
  dockHeight: number | null;
  popoutX: number | null;
  popoutY: number | null;
  popoutWidth: number | null;
  popoutHeight: number | null;
  alwaysOnTop: boolean;
  isVisible: boolean;
  config: string | null;
  state: string | null;
};

export type WorkspaceSharedStateObjectSummary = {
  id: string;
  key: string;
  value: string;
  valueKind: string;
};

export type WorkspaceEventSummary = {
  id: string;
  kind: string;
  summary: string;
  createdAt: string;
};
