import {
  assignAgentQueueTaskToExecutor,
  attachKnowledgeToQueueTask,
  attachSkillToQueueTask,
  clearAgentQueueTaskAssignment,
  createAgentQueueTask,
  createAgentQueueWorker,
  deleteAgentQueueTask,
  deleteAgentQueueWorker,
  getAgentQueueTask,
  detachKnowledgeFromQueueTask,
  detachSkillFromQueueTask,
  getAgentQueueTaskLatestRunLink,
  getAgentQueueRunnerSnapshot,
  listAgentQueueTaskRunLinks,
  listAgentQueueTasks,
  listAgentQueueWorkers,
  startAssignedAgentQueueTask,
  startAgentQueueRunnerSession,
  stopAgentQueueRunnerSession,
  updateAgentQueueTask,
  updateAgentQueueWorker,
} from "../workspace/workspaceApi";
import type {
  AgentQueueRunnerSnapshot,
  AgentQueueTask,
  AgentQueueTaskRunLinkSummary,
  AgentQueueWorkerConfig,
  AttachKnowledgeToQueueTaskRequest,
  AttachSkillToQueueTaskRequest,
  AssignAgentQueueTaskToExecutorRequest,
  ClearAgentQueueTaskAssignmentRequest,
  CreateAgentQueueTaskRequest,
  CreateAgentQueueWorkerRequest,
  DeleteAgentQueueTaskRequest,
  DeleteAgentQueueWorkerRequest,
  DetachKnowledgeFromQueueTaskRequest,
  DetachSkillFromQueueTaskRequest,
  StartAssignedAgentQueueTaskRequest,
  StartAssignedAgentQueueTaskResponse,
  StartAgentQueueRunnerSessionRequest,
  UpdateAgentQueueTaskRequest,
  UpdateAgentQueueWorkerRequest,
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

export type AgentQueueTaskAttachKnowledgeRequest = Omit<
  AttachKnowledgeToQueueTaskRequest,
  "workspaceId"
>;

export type AgentQueueTaskDetachKnowledgeRequest = Omit<
  DetachKnowledgeFromQueueTaskRequest,
  "workspaceId"
>;

export type AgentQueueTaskAttachSkillRequest = Omit<
  AttachSkillToQueueTaskRequest,
  "workspaceId"
>;

export type AgentQueueTaskDetachSkillRequest = Omit<
  DetachSkillFromQueueTaskRequest,
  "workspaceId"
>;

export type AgentQueueWorkerCreateRequest = Omit<
  CreateAgentQueueWorkerRequest,
  "workspaceId"
>;

export type AgentQueueWorkerUpdateRequest = Omit<
  UpdateAgentQueueWorkerRequest,
  "workspaceId"
>;

export type AgentQueueWorkerDeleteRequest = Omit<
  DeleteAgentQueueWorkerRequest,
  "workspaceId"
>;

export type AgentQueueTaskStartRequest = Omit<
  StartAssignedAgentQueueTaskRequest,
  "workspaceId"
>;

export type AgentQueueTaskLatestRunLinkRequest = {
  queueItemId: string;
};

export type AgentQueueTaskRunLinksRequest = {
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
  attachKnowledgeToQueueTask: (
    request: AgentQueueTaskAttachKnowledgeRequest,
  ) => Promise<AgentQueueTask>;
  detachKnowledgeFromQueueTask: (
    request: AgentQueueTaskDetachKnowledgeRequest,
  ) => Promise<AgentQueueTask>;
  attachSkillToQueueTask: (
    request: AgentQueueTaskAttachSkillRequest,
  ) => Promise<AgentQueueTask>;
  detachSkillFromQueueTask: (
    request: AgentQueueTaskDetachSkillRequest,
  ) => Promise<AgentQueueTask>;
  listAgentQueueWorkers: () => Promise<AgentQueueWorkerConfig[]>;
  createAgentQueueWorker: (
    request: AgentQueueWorkerCreateRequest,
  ) => Promise<AgentQueueWorkerConfig>;
  updateAgentQueueWorker: (
    request: AgentQueueWorkerUpdateRequest,
  ) => Promise<AgentQueueWorkerConfig | null>;
  deleteAgentQueueWorker: (
    request: AgentQueueWorkerDeleteRequest,
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
  listAgentQueueTaskRunLinks: (
    request: AgentQueueTaskRunLinksRequest,
  ) => Promise<AgentQueueTaskRunLinkSummary[]>;
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
    attachKnowledgeToQueueTask: (request) => {
      requireOpenWorkbench(viewState, "attach Knowledge to Agent Queue tasks");
      return attachKnowledgeToQueueTask({
        workspaceId: viewState.workspace.id,
        ...request,
      });
    },
    detachKnowledgeFromQueueTask: (request) => {
      requireOpenWorkbench(viewState, "detach Knowledge from Agent Queue tasks");
      return detachKnowledgeFromQueueTask({
        workspaceId: viewState.workspace.id,
        ...request,
      });
    },
    attachSkillToQueueTask: (request) => {
      requireOpenWorkbench(viewState, "attach Skills to Agent Queue tasks");
      return attachSkillToQueueTask({
        workspaceId: viewState.workspace.id,
        ...request,
      });
    },
    detachSkillFromQueueTask: (request) => {
      requireOpenWorkbench(viewState, "detach Skills from Agent Queue tasks");
      return detachSkillFromQueueTask({
        workspaceId: viewState.workspace.id,
        ...request,
      });
    },
    listAgentQueueWorkers: () => {
      requireOpenWorkbench(viewState, "read Agent Worker configuration");
      return listAgentQueueWorkers({
        workspaceId: viewState.workspace.id,
      });
    },
    createAgentQueueWorker: (request) => {
      requireOpenWorkbench(viewState, "create Agent Worker configuration");
      return createAgentQueueWorker({
        workspaceId: viewState.workspace.id,
        ...request,
      });
    },
    updateAgentQueueWorker: (request) => {
      requireOpenWorkbench(viewState, "update Agent Worker configuration");
      return updateAgentQueueWorker({
        workspaceId: viewState.workspace.id,
        ...request,
      });
    },
    deleteAgentQueueWorker: (request) => {
      requireOpenWorkbench(viewState, "delete Agent Worker configuration");
      return deleteAgentQueueWorker({
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
    listAgentQueueTaskRunLinks: (request) => {
      requireOpenWorkbench(viewState, "read Agent Queue task run links");
      return listAgentQueueTaskRunLinks({
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

  return viewState.workbench.id;
}
