import { useCallback, useMemo, useRef, type MutableRefObject } from "react";

import type { WorkbenchWidgetInstanceActions } from "../useWorkbenchWidgetActions";
import type { DirectWorkRunHandoffController } from "../useDirectWorkRunHandoff";
import type { AgentExecutorSlot, WidgetInstanceId } from "../types";
import type { QueueValidationRunResult } from "./queueValidationEvidenceService";
import type { ValidationRunner } from "../validation";
import type {
  AgentQueueTask,
  DirectWorkApprovalPolicy,
  DirectWorkSandbox,
} from "../../workspace/types";
import {
  getAgentQueueItemAggregate,
  listAgentQueueItemAggregates,
} from "../../workspace/tauriAgentQueueAggregateApi";
import { markAgentQueueItemDone } from "../../workspace/tauriAgentQueueCompletionApi";
import {
  ackAgentQueueReviewMessage,
  createAgentQueueReviewMessage,
} from "../../workspace/tauriAgentQueueReviewApi";
import {
  getAgentQueueWorkerEvidenceBundle,
  recordAgentQueueWorkerFinished,
} from "../../workspace/tauriAgentQueueWorkerEvidenceApi";
import {
  createWorkspaceAgentQueueBridge,
  type WorkspaceAgentQueueAutonomousActionName,
  type WorkspaceAgentQueueAutonomousActionResult,
  type WorkspaceAgentQueueBridge,
  type WorkspaceAgentQueueControlState,
  type WorkspaceAgentQueueEnableResult,
  type WorkspaceAgentQueueStartRunRequest,
  type WorkspaceAgentQueueStartRunResult,
} from "../workspaceAgentQueueBridge";
import {
  agentQueueTaskRunSettingsDefaultsFromRun,
  defaultAgentQueueTaskRunSettings,
} from "./agentQueueRunSettingsDefaults";
import { NO_ELIGIBLE_TASK_BLOCKER } from "./agentQueueAutonomousRunnerModel";
import { createAgentQueueWidgetApi, queueIdForWorkspace } from "./agentQueueWidgetApi";
import type { AgentQueueAutonomousController } from "./agentQueueControllerTypes";
import {
  useAgentQueueController,
  type AgentQueueController,
} from "./useAgentQueueController";
import { createQueueValidationRunner } from "./queueValidationRunnerAdapter";
import { requestValidationForQueueItem } from "./queueValidationEvidenceService";
import { buildQueueTaskValidationRunRequest } from "../workspaceChatQueueValidation";
import {
  createWorkspaceAgentHobitActionInvoker,
  type WorkspaceAgentHobitActionInvoker,
} from "../workspaceAgentBrokerActionRuntime";
import {
  ingestQueueLinkedAgentExecutorRunDetail,
  type QueueWorkerEvidenceIngestionBrokerInvoker,
} from "./smartQueueWorkerEvidenceIngestion";
import type { QueueLinkedDirectWorkEvidenceIngestionCallback } from "../queueLinkedDirectWorkEvidenceWiring";

type WorkspaceQueueActions = Pick<
  WorkbenchWidgetInstanceActions,
  | "assignAgentQueueTaskToExecutor"
  | "attachKnowledgeToQueueTask"
  | "attachSkillToQueueTask"
  | "clearAgentQueueTaskAssignment"
  | "createAgentQueueTask"
  | "createAgentQueueWorker"
  | "deleteAgentQueueTask"
  | "detachKnowledgeFromQueueTask"
  | "detachSkillFromQueueTask"
  | "deleteAgentQueueWorker"
  | "getAgentExecutorRunDetail"
  | "getAgentQueueRunnerSnapshot"
  | "getAgentQueueTask"
  | "getAgentQueueTaskLatestRunLink"
  | "listenToDirectWorkStreamEvents"
  | "listAgentQueueTaskRunLinks"
  | "listAgentQueueTasks"
  | "listAgentQueueWorkers"
  | "runQueueValidationSuite"
  | "startAgentQueueRunnerSession"
  | "startAssignedAgentQueueTask"
  | "stopAgentQueueRunnerSession"
  | "updateAgentQueueTask"
  | "updateAgentQueueWorker"
>;

export type WorkspaceQueueApi = WorkspaceAgentQueueBridge & {
  controller: AgentQueueController;
  ingestQueueLinkedDirectWorkEvidence?: QueueLinkedDirectWorkEvidenceIngestionCallback;
  invokeHobitAgentActionRequest?: WorkspaceAgentHobitActionInvoker;
  queueExecutorSlots: AgentExecutorSlot[];
  queueId: string;
  requestValidation: (
    task: AgentQueueTask,
    runner: ValidationRunner,
  ) => Promise<QueueValidationRunResult>;
  validationRunner: ValidationRunner;
};

export function useWorkspaceQueueApi({
  actions,
  agentExecutorSlots,
  currentWorkspaceRoot,
  directWorkRunHandoff,
  queueWidgetInstanceId,
  workspaceId,
}: {
  actions: WorkspaceQueueActions;
  agentExecutorSlots: AgentExecutorSlot[];
  currentWorkspaceRoot?: string | null;
  directWorkRunHandoff: DirectWorkRunHandoffController;
  queueWidgetInstanceId?: WidgetInstanceId | null;
  workspaceId: string;
}): WorkspaceQueueApi {
  const latestBridgeRef = useRef<WorkspaceAgentQueueBridge | null>(null);
  const stableBrokerBridge = useMemo<WorkspaceAgentQueueBridge>(
    () => ({
      createItem: (request) => requiredBridge(latestBridgeRef).createItem(request),
      getCurrentWorkspaceRoot: () =>
        latestBridgeRef.current?.getCurrentWorkspaceRoot?.() ?? null,
      getRunSettingsDefaults: () =>
        latestBridgeRef.current?.getRunSettingsDefaults?.() ?? null,
      getAvailableExecutorTargets: () =>
        latestBridgeRef.current?.getAvailableExecutorTargets?.() ?? [],
      getQueueControlState: () =>
        latestBridgeRef.current?.getQueueControlState?.() ?? null,
      getSnapshot: (request) =>
        requiredBridge(latestBridgeRef).getSnapshot(request),
      getItemAggregate: (request) =>
        latestBridgeRef.current?.getItemAggregate?.(request) ??
        Promise.reject(new Error("Queue aggregate read API is unavailable.")),
      listItemAggregates: () =>
        latestBridgeRef.current?.listItemAggregates?.() ??
        Promise.reject(new Error("Queue aggregate read API is unavailable.")),
      ackReviewMessage: (request) =>
        latestBridgeRef.current?.ackReviewMessage?.(request) ??
        Promise.reject(new Error("Queue review command API is unavailable.")),
      createReviewMessage: (request) =>
        latestBridgeRef.current?.createReviewMessage?.(request) ??
        Promise.reject(new Error("Queue review command API is unavailable.")),
      markItemDone: (request) =>
        latestBridgeRef.current?.markItemDone?.(request) ??
        Promise.reject(
          new Error("Queue accepted completion command API is unavailable."),
        ),
      getWorkerEvidenceBundle: (request) =>
        latestBridgeRef.current?.getWorkerEvidenceBundle?.(request) ??
        Promise.reject(
          new Error("Queue worker evidence read API is unavailable."),
        ),
      recordWorkerFinished: (request) =>
        latestBridgeRef.current?.recordWorkerFinished?.(request) ??
        Promise.reject(
          new Error("Queue worker evidence command API is unavailable."),
        ),
      enableQueue: (request) =>
        latestBridgeRef.current?.enableQueue?.(request) ??
        Promise.resolve(
          queueEnableResult({
            blockerReasons: ["Queue enable controls are unavailable."],
            message: "Queue enable controls are unavailable.",
            ok: false,
            queueEnabled: false,
            status: "unavailable",
          }),
        ),
      runAutonomousQueue: () =>
        latestBridgeRef.current?.runAutonomousQueue?.() ??
        Promise.resolve(
          autonomousQueueResult({
            action: "queue.runAutonomousQueue",
            code: "autonomous_controls_unavailable",
            message: "Queue autonomous controls are unavailable.",
            ok: false,
            status: "unavailable",
          }),
        ),
      stopAutonomousQueueAfterCurrent: () =>
        latestBridgeRef.current?.stopAutonomousQueueAfterCurrent?.() ??
        Promise.resolve(
          autonomousQueueResult({
            action: "queue.stopAutonomousQueueAfterCurrent",
            code: "autonomous_controls_unavailable",
            message: "Queue autonomous controls are unavailable.",
            ok: false,
            status: "unavailable",
          }),
        ),
      startQueueLinkedRun: (request) =>
        latestBridgeRef.current?.startQueueLinkedRun?.(request) ??
        Promise.resolve(
          queueStartRunResult({
            blockerReasons: ["Queue-linked start controls are unavailable."],
            message: "Queue-linked start controls are unavailable.",
            ok: false,
            status: "unavailable",
          }),
        ),
      updateItem: (request) => requiredBridge(latestBridgeRef).updateItem(request),
    }),
    [],
  );
  const invokeHobitAgentActionRequest = useMemo(
    () =>
      createWorkspaceAgentHobitActionInvoker({
        workspaceAgentQueueBridge: stableBrokerBridge,
      }),
    [stableBrokerBridge],
  );
  const invokeQueueWorkerEvidenceBrokerAction =
    useCallback<QueueWorkerEvidenceIngestionBrokerInvoker>(
      (request) =>
        invokeHobitAgentActionRequest(request) as ReturnType<
          QueueWorkerEvidenceIngestionBrokerInvoker
        >,
      [invokeHobitAgentActionRequest],
    );
  const ingestQueueLinkedDirectWorkEvidence =
    useCallback<QueueLinkedDirectWorkEvidenceIngestionCallback>(
      (input) =>
        ingestQueueLinkedAgentExecutorRunDetail(
          {
            agentId: "queue.linked.direct-work.evidence",
            agentRoleId: "workspace_agent",
            invokeBrokerAction: invokeQueueWorkerEvidenceBrokerAction,
          },
          input,
        ),
      [invokeQueueWorkerEvidenceBrokerAction],
    );
  const normalizedCurrentWorkspaceRoot =
    normalizeWorkspaceRoot(currentWorkspaceRoot);
  const queueExecutorSlots = useMemo(
    () =>
      queueWidgetInstanceId
        ? [
            {
              label: "Local executor ready",
              ownerKind: "agent_queue" as const,
              widgetInstanceId: queueWidgetInstanceId,
            },
            ...agentExecutorSlots.map((slot) => ({
              ...slot,
              ownerKind: slot.ownerKind ?? ("agent_executor" as const),
            })),
          ]
        : agentExecutorSlots,
    [agentExecutorSlots, queueWidgetInstanceId],
  );
  const getAgentQueueTaskLatestRunLink = useCallback(
    (queueItemId: string) =>
      actions.getAgentQueueTaskLatestRunLink({ queueItemId }),
    [actions.getAgentQueueTaskLatestRunLink],
  );
  const listAgentQueueTaskRunLinks = useCallback(
    (queueItemId: string) =>
      actions.listAgentQueueTaskRunLinks({ queueItemId }),
    [actions.listAgentQueueTaskRunLinks],
  );
  const controller = useAgentQueueController({
    agentExecutorSlots: queueExecutorSlots,
    onAssignAgentQueueTaskToExecutor: actions.assignAgentQueueTaskToExecutor,
    onAttachKnowledgeToQueueTask: actions.attachKnowledgeToQueueTask,
    onAttachSkillToQueueTask: actions.attachSkillToQueueTask,
    onClearAgentQueueTaskAssignment: actions.clearAgentQueueTaskAssignment,
    onCreateAgentQueueTask: actions.createAgentQueueTask,
    onCreateAgentQueueWorker: actions.createAgentQueueWorker,
    onDeleteAgentQueueTask: actions.deleteAgentQueueTask,
    onDetachKnowledgeFromQueueTask: actions.detachKnowledgeFromQueueTask,
    onDetachSkillFromQueueTask: actions.detachSkillFromQueueTask,
    onDeleteAgentQueueWorker: actions.deleteAgentQueueWorker,
    onDirectWorkRunHandoffStarted: directWorkRunHandoff.recordHandoff,
    onGetAgentExecutorRunDetail: actions.getAgentExecutorRunDetail,
    onGetAgentQueueRunnerSnapshot: actions.getAgentQueueRunnerSnapshot,
    onGetAgentQueueTask: actions.getAgentQueueTask,
    onGetAgentQueueTaskLatestRunLink: getAgentQueueTaskLatestRunLink,
    onIngestQueueLinkedDirectWorkEvidence: ingestQueueLinkedDirectWorkEvidence,
    onListenToDirectWorkStreamEvents: actions.listenToDirectWorkStreamEvents,
    onListAgentQueueTaskRunLinks: listAgentQueueTaskRunLinks,
    onListAgentQueueTasks: actions.listAgentQueueTasks,
    onListAgentQueueWorkers: actions.listAgentQueueWorkers,
    onStartAgentQueueRunnerSession: actions.startAgentQueueRunnerSession,
    onStartAssignedAgentQueueTask: actions.startAssignedAgentQueueTask,
    onStopAgentQueueRunnerSession: actions.stopAgentQueueRunnerSession,
    onUpdateAgentQueueTask: actions.updateAgentQueueTask,
    onUpdateAgentQueueWorker: actions.updateAgentQueueWorker,
    queueTaskAutoRefreshRequest: directWorkRunHandoff.queueTaskAutoRefreshRequest,
    queueWidgetInstanceId: queueWidgetInstanceId ?? null,
  });
  const queueId = queueIdForWorkspace(workspaceId);
  const queueApi = useMemo(
    () =>
      createAgentQueueWidgetApi({
        agentExecutorSlots: queueExecutorSlots,
        createAgentQueueTask: actions.createAgentQueueTask,
        getAgentQueueRunnerSnapshot: actions.getAgentQueueRunnerSnapshot,
        getAgentQueueTask: actions.getAgentQueueTask,
        listAgentQueueTaskRunLinks,
        listAgentQueueTasks: actions.listAgentQueueTasks,
        listAgentQueueWorkers: actions.listAgentQueueWorkers,
        queueId,
        selectedItemId: controller.selectedTask?.queueItemId ?? null,
        updateAgentQueueTask: actions.updateAgentQueueTask,
        workspaceId,
      }),
    [
      actions.createAgentQueueTask,
      actions.getAgentQueueRunnerSnapshot,
      actions.getAgentQueueTask,
      listAgentQueueTaskRunLinks,
      actions.listAgentQueueTasks,
      actions.listAgentQueueWorkers,
      actions.updateAgentQueueTask,
      controller.selectedTask?.queueItemId,
      queueExecutorSlots,
      queueId,
      workspaceId,
    ],
  );
  const validationRunner = useMemo(
    () =>
      createQueueValidationRunner({
        available: isTauriDesktopRuntime(),
        runQueueValidationSuite: actions.runQueueValidationSuite,
      }),
    [actions.runQueueValidationSuite],
  );
  const bridge = createWorkspaceAgentQueueBridge({
    autonomousActions: {
      runAutonomousQueue: () => runAutonomousQueue(controller.autonomous),
      stopAutonomousQueueAfterCurrent: () =>
        stopAutonomousQueueAfterCurrent(controller.autonomous),
    },
    aggregateReadActions: {
      getAgentQueueItemAggregate,
      listAgentQueueItemAggregates,
    },
    contextActions: {
      attachKnowledgeToQueueTask: actions.attachKnowledgeToQueueTask,
      attachSkillToQueueTask: actions.attachSkillToQueueTask,
    },
    completionActions: {
      markAgentQueueItemDone,
    },
    controlActions: {
      enableQueue: (request) =>
        enableQueueForWorkspaceAgent(controller, request.dryRun),
      getAvailableExecutorTargets: () => queueExecutorSlots,
      getQueueControlState: () => queueControlStateFromController(controller),
      startQueueLinkedRun: (request) =>
        startQueueLinkedRunForWorkspaceAgent({
          actions,
          controller,
          directWorkRunHandoff,
          queueExecutorSlots,
          queueId,
          request,
          workspaceId,
        }),
    },
    queueApi,
    reviewActions: {
      ackAgentQueueReviewMessage,
      createAgentQueueReviewMessage,
    },
    workerEvidenceActions: {
      getAgentQueueWorkerEvidenceBundle,
      recordAgentQueueWorkerFinished,
    },
    queueState: {
      getCurrentWorkspaceRoot: () => normalizedCurrentWorkspaceRoot,
      getRunSettingsDefaults: () =>
        agentQueueTaskRunSettingsDefaultsFromRun(controller.run) ??
        defaultAgentQueueTaskRunSettings(),
      refreshAfterMutation: (queueItemId) =>
        controller.refreshAfterExternalMutation(queueItemId),
    },
    workspaceId,
  });
  latestBridgeRef.current = bridge;
  const requestValidation = useCallback(
    (task: AgentQueueTask, runner: ValidationRunner) =>
      requestValidationForQueueItem({
        queueApi,
        request: buildQueueTaskValidationRunRequest({
          createdAt: new Date().toISOString(),
          requestedBySurface: "queue",
          runId: `queue-validation-${task.queueItemId}-${Date.now().toString()}`,
          task,
        }),
        runner,
      }),
    [queueApi],
  );

  return {
    ...bridge,
    controller,
    ingestQueueLinkedDirectWorkEvidence,
    invokeHobitAgentActionRequest,
    queueExecutorSlots,
    queueId,
    requestValidation,
    validationRunner,
  };
}

function queueControlStateFromController(
  controller: AgentQueueController,
): WorkspaceAgentQueueControlState {
  return {
    globalExecutionState: controller.foundation.globalExecutionState,
    queueEnabled: controller.foundation.globalExecutionState === "started",
  };
}

function requiredBridge(
  ref: MutableRefObject<WorkspaceAgentQueueBridge | null>,
) {
  if (!ref.current) {
    throw new Error("Workspace Queue bridge is unavailable.");
  }

  return ref.current;
}

function isTauriDesktopRuntime() {
  return (
    typeof window !== "undefined" &&
    ("__TAURI_INTERNALS__" in window || "__TAURI__" in window)
  );
}

function normalizeWorkspaceRoot(value: string | null | undefined) {
  const trimmed = value?.trim() ?? "";

  if (!trimmed || trimmed === "~" || trimmed === ".") {
    return null;
  }

  return trimmed;
}

function runAutonomousQueue(
  autonomous: AgentQueueAutonomousController,
): Promise<WorkspaceAgentQueueAutonomousActionResult> {
  if (!autonomous.apiAvailable || !autonomous.canStart) {
    return Promise.resolve(
      autonomousQueueResult({
        action: "queue.runAutonomousQueue",
        code: "autonomous_start_blocked",
        message: autonomousStartBlockerMessage(autonomous),
        ok: false,
        status: autonomous.status,
      }),
    );
  }

  if (autonomous.remainingEligibleCount <= 0) {
    return Promise.resolve(
      autonomousQueueResult({
        action: "queue.runAutonomousQueue",
        code: "autonomous_no_eligible_tasks",
        message: NO_ELIGIBLE_TASK_BLOCKER,
        ok: false,
        status: autonomous.status,
      }),
    );
  }

  autonomous.onStart();

  return Promise.resolve(
    autonomousQueueResult({
      action: "queue.runAutonomousQueue",
      message: "Autonomous Queue started.",
      ok: true,
      status: autonomous.status,
    }),
  );
}

function stopAutonomousQueueAfterCurrent(
  autonomous: AgentQueueAutonomousController,
): Promise<WorkspaceAgentQueueAutonomousActionResult> {
  if (autonomous.status !== "running" && autonomous.status !== "stopping") {
    return Promise.resolve(
      autonomousQueueResult({
        action: "queue.stopAutonomousQueueAfterCurrent",
        code: "autonomous_not_running",
        message: "Autonomous Queue is not running.",
        ok: false,
        status: autonomous.status,
      }),
    );
  }

  autonomous.onStopAfterCurrent();

  return Promise.resolve(
    autonomousQueueResult({
      action: "queue.stopAutonomousQueueAfterCurrent",
      message: "Autonomous Queue will stop after the current task.",
      ok: true,
      status: autonomous.status,
    }),
  );
}

function autonomousStartBlockerMessage(
  autonomous: AgentQueueAutonomousController,
) {
  return (
    autonomous.preconditionMessages[0] ??
    autonomous.error ??
    autonomous.message ??
    "Autonomous Queue is not ready."
  );
}

function autonomousQueueResult({
  action,
  code,
  message,
  ok,
  status,
}: {
  action: WorkspaceAgentQueueAutonomousActionName;
  code?: string;
  message: string;
  ok: boolean;
  status: string;
}): WorkspaceAgentQueueAutonomousActionResult {
  return {
    action,
    error: ok || !code ? undefined : { code, message },
    message,
    ok,
    status,
  };
}

function enableQueueForWorkspaceAgent(
  controller: AgentQueueController,
  dryRun: boolean,
): Promise<WorkspaceAgentQueueEnableResult> {
  if (dryRun) {
    return Promise.resolve(
      queueEnableResult({
        message:
          "Queue enable preview prepared. No task execution or worker start was requested.",
        ok: true,
        queueEnabled: controller.foundation.globalExecutionState === "started",
        status: "preview",
        globalExecutionState: controller.foundation.globalExecutionState,
      }),
    );
  }

  const hasTaskWithCodexExecutable = controller.tasks.some((task) =>
    Boolean(task.codexExecutable?.trim()),
  );
  if (!hasTaskWithCodexExecutable) {
    return Promise.resolve(
      queueEnableResult({
        blockerReasons: [
          "Set a Codex executable on at least one Queue task before enabling Queue scheduling.",
        ],
        message:
          "Set a Codex executable on at least one Queue task before enabling Queue scheduling.",
        ok: false,
        queueEnabled: false,
        status: "blocked",
        globalExecutionState: controller.foundation.globalExecutionState,
      }),
    );
  }

  if (controller.foundation.globalExecutionState !== "started") {
    controller.foundation.onStartWorkers();
  }

  return Promise.resolve(
    queueEnableResult({
      message:
        "Queue enabled. No task execution, Queue Autorun, shell command, Terminal launch, Git action, validation, or rollback was started.",
      ok: true,
      queueEnabled: true,
      status: "enabled",
      globalExecutionState: "started",
    }),
  );
}

async function startQueueLinkedRunForWorkspaceAgent({
  actions,
  controller,
  directWorkRunHandoff,
  queueExecutorSlots,
  queueId,
  request,
}: {
  actions: WorkspaceQueueActions;
  controller: AgentQueueController;
  directWorkRunHandoff: DirectWorkRunHandoffController;
  queueExecutorSlots: AgentExecutorSlot[];
  queueId: string;
  request: WorkspaceAgentQueueStartRunRequest;
  workspaceId: string;
}): Promise<WorkspaceAgentQueueStartRunResult> {
  if (request.dryRun) {
    return queueStartRunResult({
      blockerReasons: [
        "queue.item.startRun does not support dry-run because successful output must include a real Direct Work run id.",
      ],
      message:
        "queue.item.startRun does not support dry-run because successful output must include a real Direct Work run id.",
      ok: false,
      status: "blocked",
    });
  }

  if (request.queueId && request.queueId !== queueId) {
    return queueStartRunResult({
      blockerReasons: [
        "Queue id does not match the singleton Workspace Queue target.",
      ],
      message: "Queue id does not match the singleton Workspace Queue target.",
      ok: false,
      status: "blocked",
    });
  }

  if (controller.foundation.globalExecutionState !== "started") {
    return queueStartRunResult({
      blockerReasons: ["Queue disabled."],
      message: "Queue disabled.",
      ok: false,
      status: "blocked",
    });
  }

  const task = await actions.getAgentQueueTask(request.taskId);
  if (!task) {
    return queueStartRunResult({
      blockerReasons: [`Queue item "${request.taskId}" was not found.`],
      message: `Queue item "${request.taskId}" was not found.`,
      ok: false,
      status: "blocked",
    });
  }

  const blockers = queueLinkedStartBlockers({
    executorWidgetId: request.executorWidgetId,
    queueExecutorSlots,
    task,
  });
  const dependencyState = controller.dependencyStates.get(task.queueItemId);
  if (dependencyState && dependencyState.status !== "ready") {
    blockers.push("Resolve dependencies before starting this Queue item.");
  }

  if (blockers.length > 0) {
    return queueStartRunResult({
      blockerReasons: blockers,
      message: blockers[0] ?? "Queue-linked run is blocked.",
      ok: false,
      status: "blocked",
    });
  }

  const selectedExecutorSlot = queueExecutorSlots.find(
    (slot) => slot.widgetInstanceId === request.executorWidgetId,
  );
  const selectedExecutorIsQueueOwned =
    selectedExecutorSlot?.ownerKind === "agent_queue";
  const repoRoot = task.executionWorkspace?.trim() ?? "";
  const codexExecutable = task.codexExecutable?.trim() ?? "";
  const sandbox = task.sandbox as DirectWorkSandbox;
  const approvalPolicy = task.approvalPolicy as DirectWorkApprovalPolicy;

  try {
    const response = await actions.startAssignedAgentQueueTask({
      approvalPolicy,
      codexExecutable,
      queueItemId: task.queueItemId,
      queueOwnerWidgetInstanceId: selectedExecutorIsQueueOwned
        ? request.executorWidgetId
        : undefined,
      repoRoot,
      sandbox,
    });
    directWorkRunHandoff.recordHandoff({
      executorWidgetInstanceId: response.executorWidgetInstanceId,
      queueItemId: response.queueItemId,
      queueLinkedSource: "queue_manual_start",
      repoRoot,
      runId: response.runId,
      startedAt: new Date().toISOString(),
      taskTitle: task.title,
      workbenchId: response.workbenchId,
      workspaceId: response.workspaceId,
    });
    await controller.refreshAfterExternalMutation(response.queueItemId);

    return queueStartRunResult({
      executorWidgetId: response.executorWidgetInstanceId,
      message: "Queue-linked Direct Work run started.",
      ok: true,
      response,
      status: "started",
    });
  } catch (error) {
    const message = errorToMessage(
      error,
      "Unable to start Queue-linked Direct Work run.",
    );

    return queueStartRunResult({
      blockerReasons: [message],
      message,
      ok: false,
      status: "blocked",
    });
  }
}

function queueLinkedStartBlockers({
  executorWidgetId,
  queueExecutorSlots,
  task,
}: {
  executorWidgetId: string;
  queueExecutorSlots: AgentExecutorSlot[];
  task: AgentQueueTask;
}) {
  const blockers: string[] = [];
  const selectedExecutorSlot = queueExecutorSlots.find(
    (slot) => slot.widgetInstanceId === executorWidgetId,
  );
  const selectedExecutorIsQueueOwned =
    selectedExecutorSlot?.ownerKind === "agent_queue";

  if (!isRunnableQueueStatus(task.status)) {
    blockers.push(
      task.status === "draft"
        ? "Draft tasks must be promoted before starting."
        : isFinalQueueStatus(task.status)
          ? "Final-status Queue items cannot be started."
          : `Queue item status cannot be started: ${task.status}.`,
    );
  }

  if (!task.prompt.trim()) {
    blockers.push("Add a task prompt before starting.");
  }

  if (!task.executionWorkspace?.trim()) {
    blockers.push("Set workspace before starting.");
  }

  if (!task.codexExecutable?.trim()) {
    blockers.push("Set Codex executable before starting.");
  }

  if (!isSupportedSandbox(task.sandbox)) {
    blockers.push("Set sandbox before starting.");
  }

  if (!isSupportedApprovalPolicy(task.approvalPolicy)) {
    blockers.push("Set approval policy before starting.");
  }

  if (
    task.assignedExecutorWidgetId !== executorWidgetId &&
    !selectedExecutorIsQueueOwned
  ) {
    blockers.push(
      "Queue item is not assigned to the supplied executorWidgetId.",
    );
  }

  if (!selectedExecutorSlot && task.assignedExecutorWidgetId !== executorWidgetId) {
    blockers.push("Supplied executorWidgetId is not available.");
  }

  return blockers;
}

function queueEnableResult({
  blockerReasons = [],
  globalExecutionState,
  message,
  ok,
  queueEnabled,
  status,
}: {
  blockerReasons?: string[];
  globalExecutionState?: string;
  message: string;
  ok: boolean;
  queueEnabled: boolean;
  status: WorkspaceAgentQueueEnableResult["status"];
}): WorkspaceAgentQueueEnableResult {
  return {
    blockerReasons,
    didAutoRunWorkers: false,
    didStartWorkers: false,
    globalExecutionState,
    message,
    ok,
    queueEnabled,
    status,
  };
}

function queueStartRunResult({
  blockerReasons = [],
  executorWidgetId,
  message,
  ok,
  response,
  status,
}: {
  blockerReasons?: string[];
  executorWidgetId?: string;
  message: string;
  ok: boolean;
  response?: WorkspaceAgentQueueStartRunResult["response"];
  status: WorkspaceAgentQueueStartRunResult["status"];
}): WorkspaceAgentQueueStartRunResult {
  return {
    blockerReasons,
    executorWidgetId,
    message,
    ok,
    response,
    status,
  };
}

function isRunnableQueueStatus(status: string) {
  return status === "queued" || status === "ready" || status === "review_needed";
}

function isFinalQueueStatus(status: string) {
  return status === "completed" || status === "failed" || status === "cancelled";
}

function isSupportedSandbox(
  value: string | null | undefined,
): value is DirectWorkSandbox {
  return (
    value === "danger_full_access" ||
    value === "read_only" ||
    value === "workspace_write"
  );
}

function isSupportedApprovalPolicy(
  value: string | null | undefined,
): value is DirectWorkApprovalPolicy {
  return value === "never" || value === "on_request" || value === "untrusted";
}

function errorToMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  if (typeof error === "string" && error.trim()) {
    return error;
  }

  return fallback;
}
