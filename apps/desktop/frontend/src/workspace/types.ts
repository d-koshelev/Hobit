export type CreateWorkspaceRequest = {
  title: string;
  description?: string | null;
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

export type ListWidgetLogsRequest = {
  workspaceId: string;
  workbenchId: string;
  widgetInstanceId: string;
  limit: number;
};

export type GetGitRepositoryStatusRequest = {
  workspaceId: string;
  workbenchId: string;
  widgetInstanceId: string;
  repositoryRoot: string;
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

export type WorkspaceSummary = {
  id: string;
  title: string;
  description: string | null;
  status: string;
  workbenchId: string | null;
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

export type GitRepositoryStatus = {
  branch: GitBranchStatus | null;
  workingTree: GitWorkingTreeStatus;
  changedFiles: GitFileChange[];
  lastCommit: GitLastCommit | null;
  warnings: string[];
};

export type GitBranchStatus = {
  name: string | null;
  upstream: string | null;
  ahead: number | null;
  behind: number | null;
  isDetached: boolean;
};

export type GitWorkingTreeStatus = {
  isClean: boolean;
  isDirty: boolean;
  stagedCount: number;
  unstagedCount: number;
  untrackedCount: number;
};

export type GitFileChange = {
  area: string;
  kind: string;
  path: string;
  originalPath: string | null;
};

export type GitLastCommit = {
  hash: string;
  title: string;
  author: string | null;
  committedAt: string | null;
};
