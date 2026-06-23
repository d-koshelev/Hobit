import type {
  AgentQueueWidgetApi,
  QueueCreateItemRequest,
  QueueGetSnapshotRequest,
  QueueUpdateItemRequest,
  QueueWidgetActionResult,
  QueueWidgetItemSnapshot,
  QueueWidgetSnapshot,
} from "./queue/agentQueueWidgetApiTypes";
import type { AgentQueueTaskRunSettingsDefaults } from "./queue/agentQueueRunSettingsDefaults";
import type {
  AgentQueueControlStatus,
  AgentQueueTask,
  AgentQueueItemAggregate,
  AgentQueueReviewCommandResult,
  AgentQueueReviewCreateMessageResult,
  AgentQueueCompletionCommandResult,
  AgentQueueFailureCommandResult,
  AgentQueueWorkerEvidenceQueryResult,
  AgentQueueWorkerFinishedCommandResult,
  AckAgentQueueReviewMessageRequest,
  ApplyAgentQueueWorkflowRunSettingsRequest,
  CreateAgentQueueReviewMessageRequest,
  FailAgentQueueItemRequest,
  GetAgentQueueWorkerEvidenceBundleRequest,
  GetAgentQueueItemAggregateRequest,
  ListAgentQueueItemAggregatesRequest,
  MarkAgentQueueItemDoneRequest,
  MaterializeAgentQueueWorkflowTaskSlotRequest,
  PromoteAgentQueueWorkflowTaskSlotRequest,
  RecordAgentQueueWorkerFinishedRequest,
  StartAssignedAgentQueueTaskRequest,
  AttachKnowledgeToQueueTaskRequest,
  AttachSkillToQueueTaskRequest,
  StartAssignedAgentQueueTaskResponse,
  AgentQueueWorkflowApplyRunSettingsResult,
  AgentQueueWorkflowMaterializeTaskSlotResult,
  AgentQueueWorkflowPromoteTaskSlotResult,
  AgentQueueWorkflowWorkerEvidenceRecordResult,
  RecordAgentQueueWorkflowWorkerEvidenceRequest,
} from "../workspace/types";
import type { AgentExecutorSlot } from "./types";

export type WorkspaceAgentQueueAutonomousActionName =
  | "queue.runAutonomousQueue"
  | "queue.stopAutonomousQueueAfterCurrent";

export type WorkspaceAgentQueueAutonomousActionResult = {
  action: WorkspaceAgentQueueAutonomousActionName;
  error?: {
    code: string;
    message: string;
  };
  message: string;
  ok: boolean;
  status?: string;
};

export type WorkspaceQueueAutonomousActions = {
  runAutonomousQueue: () => Promise<WorkspaceAgentQueueAutonomousActionResult>;
  stopAutonomousQueueAfterCurrent: () => Promise<WorkspaceAgentQueueAutonomousActionResult>;
};

export type WorkspaceAgentQueueEnableRequest = {
  dryRun: boolean;
};

export type WorkspaceAgentQueueEnableResult = {
  backendOwned?: boolean;
  blockerReasons?: string[];
  didAutoRunWorkers: false;
  didStartWorkers: false;
  globalExecutionState?: string;
  message: string;
  ok: boolean;
  queueEnabled: boolean;
  queueControlStatus?: AgentQueueControlStatus;
  status: "blocked" | "enabled" | "preview" | "unavailable";
  version?: number;
};

export type WorkspaceAgentQueueStartRunRequest = {
  dryRun: boolean;
  executorWidgetId: string;
  queueId?: string;
  taskId: string;
};

export type WorkspaceAgentQueueControlState = {
  backendOwned?: boolean;
  createdAt?: string | null;
  globalExecutionState?: string | null;
  queueEnabled: boolean;
  reason?: string | null;
  status?: AgentQueueControlStatus;
  updatedAt?: string | null;
  updatedByActorId?: string | null;
  version?: number;
  workspaceId?: string | null;
};

export type WorkspaceAgentQueueStartRunResult = {
  blockerReasons?: string[];
  executorWidgetId?: string;
  message: string;
  ok: boolean;
  response?: StartAssignedAgentQueueTaskResponse;
  status:
    | "blocked"
    | "confirmation_required"
    | "preview"
    | "started"
    | "unavailable";
};

export type WorkspaceQueueControlActions = {
  enableQueue: (
    request: WorkspaceAgentQueueEnableRequest,
  ) => Promise<WorkspaceAgentQueueEnableResult>;
  getAvailableExecutorTargets?: () => AgentExecutorSlot[];
  getQueueControlState?: () => WorkspaceAgentQueueControlState | null;
  startQueueLinkedRun: (
    request: WorkspaceAgentQueueStartRunRequest,
  ) => Promise<WorkspaceAgentQueueStartRunResult>;
};

export type WorkspaceQueueStateAccess = {
  getCurrentWorkspaceRoot?: () => string | null;
  getRunSettingsDefaults: () => AgentQueueTaskRunSettingsDefaults;
  refreshAfterMutation: (queueItemId: string) => Promise<void> | void;
};

export type WorkspaceQueueContextActions = {
  attachKnowledgeToQueueTask: (
    request: AttachKnowledgeToQueueTaskRequest,
  ) => Promise<AgentQueueTask>;
  attachSkillToQueueTask: (
    request: AttachSkillToQueueTaskRequest,
  ) => Promise<AgentQueueTask>;
};

export type WorkspaceQueueAggregateReadActions = {
  getAgentQueueItemAggregate: (
    request: GetAgentQueueItemAggregateRequest,
  ) => Promise<AgentQueueItemAggregate | null>;
  listAgentQueueItemAggregates: (
    request: ListAgentQueueItemAggregatesRequest,
  ) => Promise<AgentQueueItemAggregate[]>;
};

export type WorkspaceQueueReviewActions = {
  ackAgentQueueReviewMessage: (
    request: AckAgentQueueReviewMessageRequest,
  ) => Promise<AgentQueueReviewCommandResult>;
  createAgentQueueReviewMessage: (
    request: CreateAgentQueueReviewMessageRequest,
  ) => Promise<AgentQueueReviewCreateMessageResult>;
};

export type WorkspaceQueueCompletionActions = {
  markAgentQueueItemDone: (
    request: MarkAgentQueueItemDoneRequest,
  ) => Promise<AgentQueueCompletionCommandResult>;
};

export type WorkspaceQueueFailureActions = {
  failAgentQueueItem: (
    request: FailAgentQueueItemRequest,
  ) => Promise<AgentQueueFailureCommandResult>;
};

export type WorkspaceQueueWorkerEvidenceActions = {
  getAgentQueueWorkerEvidenceBundle: (
    request: GetAgentQueueWorkerEvidenceBundleRequest,
  ) => Promise<AgentQueueWorkerEvidenceQueryResult>;
  recordAgentQueueWorkerFinished: (
    request: RecordAgentQueueWorkerFinishedRequest,
  ) => Promise<AgentQueueWorkerFinishedCommandResult>;
};

export type WorkspaceQueueWorkflowActions = {
  applyWorkflowRunSettings: (
    request: ApplyAgentQueueWorkflowRunSettingsRequest,
  ) => Promise<AgentQueueWorkflowApplyRunSettingsResult>;
  materializeWorkflowTaskSlot: (
    request: MaterializeAgentQueueWorkflowTaskSlotRequest,
  ) => Promise<AgentQueueWorkflowMaterializeTaskSlotResult>;
  promoteWorkflowTaskSlot: (
    request: PromoteAgentQueueWorkflowTaskSlotRequest,
  ) => Promise<AgentQueueWorkflowPromoteTaskSlotResult>;
  recordWorkflowWorkerEvidence: (
    request: RecordAgentQueueWorkflowWorkerEvidenceRequest,
  ) => Promise<AgentQueueWorkflowWorkerEvidenceRecordResult>;
  startAssignedAgentQueueTask: (
    request: StartAssignedAgentQueueTaskRequest,
  ) => Promise<StartAssignedAgentQueueTaskResponse>;
};

export type WorkspaceAgentQueueBridge = {
  attachKnowledgeToQueueTask?: (
    request: Omit<AttachKnowledgeToQueueTaskRequest, "workspaceId">,
  ) => Promise<AgentQueueTask>;
  attachSkillToQueueTask?: (
    request: Omit<AttachSkillToQueueTaskRequest, "workspaceId">,
  ) => Promise<AgentQueueTask>;
  createItem: (
    request: Omit<QueueCreateItemRequest, "workspaceId">,
  ) => Promise<QueueWidgetActionResult<QueueWidgetItemSnapshot>>;
  getCurrentWorkspaceRoot?: () => string | null;
  getRunSettingsDefaults?: () => AgentQueueTaskRunSettingsDefaults | null;
  getAvailableExecutorTargets?: () => AgentExecutorSlot[];
  getQueueControlState?: () => WorkspaceAgentQueueControlState | null;
  getSnapshot: (
    request?: Omit<Partial<QueueGetSnapshotRequest>, "workspaceId">,
  ) => Promise<QueueWidgetActionResult<QueueWidgetSnapshot>>;
  getItemAggregate?: (
    request: Omit<GetAgentQueueItemAggregateRequest, "workspaceId">,
  ) => Promise<AgentQueueItemAggregate | null>;
  listItemAggregates?: () => Promise<AgentQueueItemAggregate[]>;
  ackReviewMessage?: (
    request: Omit<AckAgentQueueReviewMessageRequest, "workspaceId">,
  ) => Promise<AgentQueueReviewCommandResult>;
  createReviewMessage?: (
    request: Omit<CreateAgentQueueReviewMessageRequest, "workspaceId">,
  ) => Promise<AgentQueueReviewCreateMessageResult>;
  markItemDone?: (
    request: Omit<MarkAgentQueueItemDoneRequest, "workspaceId">,
  ) => Promise<AgentQueueCompletionCommandResult>;
  failItem?: (
    request: Omit<FailAgentQueueItemRequest, "workspaceId">,
  ) => Promise<AgentQueueFailureCommandResult>;
  getWorkerEvidenceBundle?: (
    request: Omit<GetAgentQueueWorkerEvidenceBundleRequest, "workspaceId">,
  ) => Promise<AgentQueueWorkerEvidenceQueryResult>;
  recordWorkerFinished?: (
    request: Omit<RecordAgentQueueWorkerFinishedRequest, "workspaceId">,
  ) => Promise<AgentQueueWorkerFinishedCommandResult>;
  applyWorkflowRunSettings?: (
    request: Omit<ApplyAgentQueueWorkflowRunSettingsRequest, "workspaceId">,
  ) => Promise<AgentQueueWorkflowApplyRunSettingsResult>;
  materializeWorkflowTaskSlot?: (
    request: Omit<MaterializeAgentQueueWorkflowTaskSlotRequest, "workspaceId">,
  ) => Promise<AgentQueueWorkflowMaterializeTaskSlotResult>;
  promoteWorkflowTaskSlot?: (
    request: Omit<PromoteAgentQueueWorkflowTaskSlotRequest, "workspaceId">,
  ) => Promise<AgentQueueWorkflowPromoteTaskSlotResult>;
  recordWorkflowWorkerEvidence?: (
    request: Omit<RecordAgentQueueWorkflowWorkerEvidenceRequest, "workspaceId">,
  ) => Promise<AgentQueueWorkflowWorkerEvidenceRecordResult>;
  startWorkflowAssignedTask?: (
    request: Omit<StartAssignedAgentQueueTaskRequest, "workspaceId">,
  ) => Promise<StartAssignedAgentQueueTaskResponse>;
  updateItem: (
    request: Omit<QueueUpdateItemRequest, "workspaceId">,
  ) => Promise<QueueWidgetActionResult<QueueWidgetItemSnapshot>>;
  runAutonomousQueue?: () => Promise<WorkspaceAgentQueueAutonomousActionResult>;
  enableQueue?: (
    request: WorkspaceAgentQueueEnableRequest,
  ) => Promise<WorkspaceAgentQueueEnableResult>;
  startQueueLinkedRun?: (
    request: WorkspaceAgentQueueStartRunRequest,
  ) => Promise<WorkspaceAgentQueueStartRunResult>;
  stopAutonomousQueueAfterCurrent?: () => Promise<WorkspaceAgentQueueAutonomousActionResult>;
};

export function createWorkspaceAgentQueueBridge({
  autonomousActions,
  aggregateReadActions,
  contextActions,
  completionActions,
  controlActions,
  failureActions,
  queueApi,
  reviewActions,
  queueState,
  workflowActions,
  workerEvidenceActions,
  workspaceId,
}: {
  autonomousActions?: WorkspaceQueueAutonomousActions | null;
  aggregateReadActions?: WorkspaceQueueAggregateReadActions | null;
  contextActions?: WorkspaceQueueContextActions | null;
  completionActions?: WorkspaceQueueCompletionActions | null;
  controlActions?: WorkspaceQueueControlActions | null;
  failureActions?: WorkspaceQueueFailureActions | null;
  queueApi: AgentQueueWidgetApi;
  reviewActions?: WorkspaceQueueReviewActions | null;
  queueState?: WorkspaceQueueStateAccess | null;
  workflowActions?: WorkspaceQueueWorkflowActions | null;
  workerEvidenceActions?: WorkspaceQueueWorkerEvidenceActions | null;
  workspaceId: string;
}): WorkspaceAgentQueueBridge {
  return {
    attachKnowledgeToQueueTask: contextActions
      ? async (request) => {
          const task = await contextActions.attachKnowledgeToQueueTask({
            ...request,
            workspaceId,
          });
          await refreshQueueStateAfterContextMutation(queueState, task);
          return task;
        }
      : undefined,
    attachSkillToQueueTask: contextActions
      ? async (request) => {
          const task = await contextActions.attachSkillToQueueTask({
            ...request,
            workspaceId,
          });
          await refreshQueueStateAfterContextMutation(queueState, task);
          return task;
        }
      : undefined,
    createItem: async (request) => {
      const result = await queueApi.createItem({
        ...request,
        actor: request.actor ?? "workspace_agent",
        workspaceId,
      });

      await refreshQueueStateAfterMutation(queueState, result);

      return result;
    },
    getRunSettingsDefaults: () =>
      queueState?.getRunSettingsDefaults() ?? null,
    getAvailableExecutorTargets: () =>
      controlActions?.getAvailableExecutorTargets?.() ?? [],
    getQueueControlState: () =>
      controlActions?.getQueueControlState?.() ?? null,
    getCurrentWorkspaceRoot: () =>
      queueState?.getCurrentWorkspaceRoot?.() ?? null,
    getSnapshot: (request = {}) =>
      queueApi.getSnapshot({
        ...request,
        workspaceId,
      }),
    getItemAggregate: aggregateReadActions
      ? (request) =>
          aggregateReadActions.getAgentQueueItemAggregate({
            ...request,
            workspaceId,
          })
      : undefined,
    listItemAggregates: aggregateReadActions
      ? () => aggregateReadActions.listAgentQueueItemAggregates({ workspaceId })
      : undefined,
    ackReviewMessage: reviewActions
      ? (request) =>
          reviewActions.ackAgentQueueReviewMessage({
            ...request,
            workspaceId,
          })
      : undefined,
    createReviewMessage: reviewActions
      ? (request) =>
          reviewActions.createAgentQueueReviewMessage({
            ...request,
            workspaceId,
          })
      : undefined,
    markItemDone: completionActions
      ? (request) =>
          completionActions.markAgentQueueItemDone({
            ...request,
            workspaceId,
          })
      : undefined,
    failItem: failureActions
      ? (request) =>
          failureActions.failAgentQueueItem({
            ...request,
            workspaceId,
          })
      : undefined,
    getWorkerEvidenceBundle: workerEvidenceActions
      ? (request) =>
          workerEvidenceActions.getAgentQueueWorkerEvidenceBundle({
            ...request,
            workspaceId,
          })
      : undefined,
    recordWorkerFinished: workerEvidenceActions
      ? (request) =>
          workerEvidenceActions.recordAgentQueueWorkerFinished({
            ...request,
            workspaceId,
          })
      : undefined,
    applyWorkflowRunSettings: workflowActions
      ? (request) =>
          workflowActions.applyWorkflowRunSettings({
            ...request,
            workspaceId,
          })
      : undefined,
    materializeWorkflowTaskSlot: workflowActions
      ? (request) =>
          workflowActions.materializeWorkflowTaskSlot({
            ...request,
            workspaceId,
          })
      : undefined,
    promoteWorkflowTaskSlot: workflowActions
      ? (request) =>
          workflowActions.promoteWorkflowTaskSlot({
            ...request,
            workspaceId,
          })
      : undefined,
    recordWorkflowWorkerEvidence: workflowActions
      ? (request) =>
          workflowActions.recordWorkflowWorkerEvidence({
            ...request,
            workspaceId,
          })
      : undefined,
    startWorkflowAssignedTask: workflowActions
      ? (request) =>
          workflowActions.startAssignedAgentQueueTask({
            ...request,
            workspaceId,
          })
      : undefined,
    updateItem: async (request) => {
      const result = await queueApi.updateItem({
        ...request,
        actor: request.actor ?? "workspace_agent",
        workspaceId,
      });

      await refreshQueueStateAfterMutation(queueState, result);

      return result;
    },
    runAutonomousQueue: () =>
      autonomousActions
        ? autonomousActions.runAutonomousQueue()
        : Promise.resolve(
            unavailableAutonomousResult(
              "queue.runAutonomousQueue",
              "Queue autonomous controls are unavailable.",
            ),
          ),
    enableQueue: (request) =>
      controlActions
        ? controlActions.enableQueue(request)
        : Promise.resolve(
            unavailableQueueEnableResult(
              "Queue enable controls are unavailable.",
            ),
          ),
    startQueueLinkedRun: (request) =>
      controlActions
        ? controlActions.startQueueLinkedRun(request)
        : Promise.resolve(
            unavailableQueueStartResult(
              "Queue-linked start controls are unavailable.",
            ),
          ),
    stopAutonomousQueueAfterCurrent: () =>
      autonomousActions
        ? autonomousActions.stopAutonomousQueueAfterCurrent()
        : Promise.resolve(
            unavailableAutonomousResult(
              "queue.stopAutonomousQueueAfterCurrent",
              "Queue autonomous controls are unavailable.",
            ),
          ),
  };
}

function unavailableQueueEnableResult(
  message: string,
): WorkspaceAgentQueueEnableResult {
  return {
    blockerReasons: [message],
    didAutoRunWorkers: false,
    didStartWorkers: false,
    message,
    ok: false,
    queueEnabled: false,
    status: "unavailable",
  };
}

function unavailableQueueStartResult(
  message: string,
): WorkspaceAgentQueueStartRunResult {
  return {
    blockerReasons: [message],
    message,
    ok: false,
    status: "unavailable",
  };
}

async function refreshQueueStateAfterMutation(
  queueState: WorkspaceQueueStateAccess | null | undefined,
  result: QueueWidgetActionResult<QueueWidgetItemSnapshot>,
) {
  if (!result.ok || !result.item) {
    return;
  }

  try {
    await queueState?.refreshAfterMutation(result.item.id);
  } catch {
    // Queue CRUD already succeeded; refresh failures are non-mutating UI state.
  }
}

async function refreshQueueStateAfterContextMutation(
  queueState: WorkspaceQueueStateAccess | null | undefined,
  task: AgentQueueTask,
) {
  try {
    await queueState?.refreshAfterMutation(task.queueItemId);
  } catch {
    // Context attach succeeded; refresh failures are non-mutating UI state.
  }
}

function unavailableAutonomousResult(
  action: WorkspaceAgentQueueAutonomousActionName,
  message: string,
): WorkspaceAgentQueueAutonomousActionResult {
  return {
    action,
    error: {
      code: "autonomous_controls_unavailable",
      message,
    },
    message,
    ok: false,
    status: "unavailable",
  };
}
