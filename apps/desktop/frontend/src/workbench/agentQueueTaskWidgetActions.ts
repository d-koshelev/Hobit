import {
  assignAgentQueueTaskToExecutor,
  clearAgentQueueTaskAssignment,
  createAgentQueueTask,
  getAgentQueueTask,
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
  AssignAgentQueueTaskToExecutorRequest,
  ClearAgentQueueTaskAssignmentRequest,
  CreateAgentQueueTaskRequest,
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

export type AgentQueueTaskStartRequest = Omit<
  StartAssignedAgentQueueTaskRequest,
  "workspaceId"
>;

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
  assignAgentQueueTaskToExecutor: (
    request: AgentQueueTaskAssignRequest,
  ) => Promise<AgentQueueTask>;
  clearAgentQueueTaskAssignment: (
    request: AgentQueueTaskClearAssignmentRequest,
  ) => Promise<AgentQueueTask>;
  startAssignedAgentQueueTask: (
    request: AgentQueueTaskStartRequest,
  ) => Promise<StartAssignedAgentQueueTaskResponse>;
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
