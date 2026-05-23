import {
  assignAgentQueueTaskToExecutor,
  clearAgentQueueTaskAssignment,
  createAgentQueueTask,
  deleteAgentQueueTask,
  getAgentQueueTask,
  getAgentQueueTaskLatestRunLink,
  getAgentQueueRunnerSnapshot,
  listAgentQueueTasks,
  startAssignedAgentQueueTask,
  startAgentQueueRunnerSession,
  stopAgentQueueRunnerSession,
  updateAgentQueueTask,
} from "../workspace/workspaceApi";
import type {
  AgentQueueRunnerSnapshot,
  AgentQueueTask,
  AgentQueueTaskRunLinkSummary,
  AssignAgentQueueTaskToExecutorRequest,
  ClearAgentQueueTaskAssignmentRequest,
  CreateAgentQueueTaskRequest,
  DeleteAgentQueueTaskRequest,
  StartAssignedAgentQueueTaskRequest,
  StartAssignedAgentQueueTaskResponse,
  StartAgentQueueRunnerSessionRequest,
  UpdateAgentQueueTaskRequest,
} from "../workspace/types";
import type { WorkbenchViewState } from "./types";

export type AgentQueueTaskCreateRequest = Omit<
  CreateAgentQueueTaskRequest,
  "workspaceId"
>;

export type AgentQueueTaskUpdateRequest = Omit<
  UpdateAgentQueueTaskRequest,
  "workspaceId"
>;

export type AgentQueueTaskAssignRequest = Omit<
  AssignAgentQueueTaskToExecutorRequest,
  "workspaceId"
>;

export type AgentQueueTaskClearAssignmentRequest = Omit<
  ClearAgentQueueTaskAssignmentRequest,
  "workspaceId"
>;

export type AgentQueueTaskDeleteRequest = Omit<
  DeleteAgentQueueTaskRequest,
  "workspaceId"
>;

export type AgentQueueTaskStartRequest = Omit<
  StartAssignedAgentQueueTaskRequest,
  "workspaceId"
>;

export type AgentQueueTaskLatestRunLinkRequest = {
  queueItemId: string;
};

export type AgentQueueRunnerSessionStartRequest = Omit<
  StartAgentQueueRunnerSessionRequest,
  "workspaceId"
>;

export type AgentQueueTaskWidgetActions = {
  createAgentQueueTask: (
    request: AgentQueueTaskCreateRequest,
  ) => Promise<AgentQueueTask>;
  listAgentQueueTasks: () => Promise<AgentQueueTask[]>;
  getAgentQueueTask: (queueItemId: string) => Promise<AgentQueueTask | null>;
  updateAgentQueueTask: (
    request: AgentQueueTaskUpdateRequest,
  ) => Promise<AgentQueueTask | null>;
  deleteAgentQueueTask: (
    request: AgentQueueTaskDeleteRequest,
  ) => Promise<boolean>;
  assignAgentQueueTaskToExecutor: (
    request: AgentQueueTaskAssignRequest,
  ) => Promise<AgentQueueTask>;
  clearAgentQueueTaskAssignment: (
    request: AgentQueueTaskClearAssignmentRequest,
  ) => Promise<AgentQueueTask>;
  startAssignedAgentQueueTask: (
    request: AgentQueueTaskStartRequest,
  ) => Promise<StartAssignedAgentQueueTaskResponse>;
  getAgentQueueTaskLatestRunLink: (
    request: AgentQueueTaskLatestRunLinkRequest,
  ) => Promise<AgentQueueTaskRunLinkSummary | null>;
  startAgentQueueRunnerSession: (
    request: AgentQueueRunnerSessionStartRequest,
  ) => Promise<AgentQueueRunnerSnapshot>;
  stopAgentQueueRunnerSession: () => Promise<AgentQueueRunnerSnapshot>;
  getAgentQueueRunnerSnapshot: () => Promise<AgentQueueRunnerSnapshot>;
};

export function createAgentQueueTaskActions(
  viewState: WorkbenchViewState,
): AgentQueueTaskWidgetActions {
  return {
    createAgentQueueTask: (request) => {
      requireOpenWorkbench(viewState, "create Agent Queue tasks");
      return createAgentQueueTask({
        workspaceId: viewState.workspace.id,
        ...request,
      });
    },
    getAgentQueueTask: (queueItemId) => {
      requireOpenWorkbench(viewState, "read Agent Queue tasks");
      return getAgentQueueTask({
        workspaceId: viewState.workspace.id,
        queueItemId,
      });
    },
    listAgentQueueTasks: () => {
      requireOpenWorkbench(viewState, "read Agent Queue tasks");
      return listAgentQueueTasks({
        workspaceId: viewState.workspace.id,
      });
    },
    updateAgentQueueTask: (request) => {
      requireOpenWorkbench(viewState, "update Agent Queue tasks");
      return updateAgentQueueTask({
        workspaceId: viewState.workspace.id,
        ...request,
      });
    },
    deleteAgentQueueTask: (request) => {
      requireOpenWorkbench(viewState, "delete Agent Queue tasks");
      return deleteAgentQueueTask({
        workspaceId: viewState.workspace.id,
        ...request,
      });
    },
    assignAgentQueueTaskToExecutor: (request) => {
      requireOpenWorkbench(viewState, "assign Agent Queue tasks");
      return assignAgentQueueTaskToExecutor({
        workspaceId: viewState.workspace.id,
        ...request,
      });
    },
    clearAgentQueueTaskAssignment: (request) => {
      requireOpenWorkbench(viewState, "clear Agent Queue task assignment");
      return clearAgentQueueTaskAssignment({
        workspaceId: viewState.workspace.id,
        ...request,
      });
    },
    startAssignedAgentQueueTask: (request) => {
      requireOpenWorkbench(viewState, "start an assigned Agent Queue task");
      return startAssignedAgentQueueTask({
        workspaceId: viewState.workspace.id,
        ...request,
      });
    },
    getAgentQueueTaskLatestRunLink: (request) => {
      requireOpenWorkbench(viewState, "read Agent Queue task run links");
      return getAgentQueueTaskLatestRunLink({
        workspaceId: viewState.workspace.id,
        queueItemId: request.queueItemId,
      });
    },
    startAgentQueueRunnerSession: (request) => {
      requireOpenWorkbench(viewState, "arm Queue Autorun");
      return startAgentQueueRunnerSession({
        workspaceId: viewState.workspace.id,
        ...request,
      });
    },
    stopAgentQueueRunnerSession: () => {
      requireOpenWorkbench(viewState, "stop Queue Autorun");
      return stopAgentQueueRunnerSession();
    },
    getAgentQueueRunnerSnapshot: () => {
      requireOpenWorkbench(viewState, "read Queue Autorun status");
      return getAgentQueueRunnerSnapshot();
    },
  };
}

function requireOpenWorkbench(viewState: WorkbenchViewState, action: string) {
  if (!viewState.workbench.id) {
    throw new Error(`A workbench must be open to ${action}.`);
  }
}
