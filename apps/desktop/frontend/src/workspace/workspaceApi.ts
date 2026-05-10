import { memoryWorkspaceApi } from "./memoryWorkspaceApi";
import { tauriWorkspaceApi } from "./tauriWorkspaceApi";
import { isTauriRuntime } from "./tauriEnvironment";
import type {
  AddWidgetInstanceToWorkbenchRequest,
  CreateWorkspaceRequest,
  ListWidgetLogsRequest,
  UpdateWidgetInstanceLayoutRequest,
  UpdateWidgetInstanceStateRequest,
  WidgetLogEntry,
  WorkspaceSessionSummary,
  WorkspaceSummary,
  WorkspaceWorkbenchState,
} from "./types";

export type WorkspaceApi = {
  createWorkspace: (
    request: CreateWorkspaceRequest,
  ) => Promise<WorkspaceSummary>;
  listWorkspaces: () => Promise<WorkspaceSummary[]>;
  getWorkspaceSummary: (
    workspaceId: string,
  ) => Promise<WorkspaceSummary | null>;
  openWorkspace: (
    workspaceId: string,
  ) => Promise<WorkspaceSessionSummary | null>;
  getWorkspaceWorkbenchState: (
    workspaceId: string,
  ) => Promise<WorkspaceWorkbenchState | null>;
  addWidgetInstanceToWorkbench: (
    request: AddWidgetInstanceToWorkbenchRequest,
  ) => Promise<WorkspaceWorkbenchState | null>;
  updateWidgetInstanceState: (
    request: UpdateWidgetInstanceStateRequest,
  ) => Promise<WorkspaceWorkbenchState | null>;
  updateWidgetInstanceLayout: (
    request: UpdateWidgetInstanceLayoutRequest,
  ) => Promise<WorkspaceWorkbenchState | null>;
  listWidgetLogs: (
    request: ListWidgetLogsRequest,
  ) => Promise<WidgetLogEntry[]>;
};

export function getWorkspaceApi(): WorkspaceApi {
  return isTauriRuntime() ? tauriWorkspaceApi : memoryWorkspaceApi;
}

export function createWorkspace(
  request: CreateWorkspaceRequest,
): Promise<WorkspaceSummary> {
  return getWorkspaceApi().createWorkspace(
    normalizeCreateWorkspaceRequest(request),
  );
}

export function listWorkspaces(): Promise<WorkspaceSummary[]> {
  return getWorkspaceApi().listWorkspaces();
}

export function getWorkspaceSummary(
  workspaceId: string,
): Promise<WorkspaceSummary | null> {
  return getWorkspaceApi().getWorkspaceSummary(workspaceId);
}

export function openWorkspace(
  workspaceId: string,
): Promise<WorkspaceSessionSummary | null> {
  return getWorkspaceApi().openWorkspace(workspaceId);
}

export function getWorkspaceWorkbenchState(
  workspaceId: string,
): Promise<WorkspaceWorkbenchState | null> {
  return getWorkspaceApi().getWorkspaceWorkbenchState(workspaceId);
}

export function addWidgetInstanceToWorkbench(
  request: AddWidgetInstanceToWorkbenchRequest,
): Promise<WorkspaceWorkbenchState | null> {
  return getWorkspaceApi().addWidgetInstanceToWorkbench(request);
}

export function updateWidgetInstanceState(
  request: UpdateWidgetInstanceStateRequest,
): Promise<WorkspaceWorkbenchState | null> {
  return getWorkspaceApi().updateWidgetInstanceState(request);
}

export function updateWidgetInstanceLayout(
  request: UpdateWidgetInstanceLayoutRequest,
): Promise<WorkspaceWorkbenchState | null> {
  return getWorkspaceApi().updateWidgetInstanceLayout(request);
}

export function listWidgetLogs(
  request: ListWidgetLogsRequest,
): Promise<WidgetLogEntry[]> {
  return getWorkspaceApi().listWidgetLogs(request);
}

function normalizeCreateWorkspaceRequest(
  request: CreateWorkspaceRequest,
): CreateWorkspaceRequest {
  return {
    title: request.title,
    description: request.description ?? null,
  };
}
