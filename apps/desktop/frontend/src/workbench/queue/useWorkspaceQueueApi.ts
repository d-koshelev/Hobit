import { useMemo } from "react";

import type { WorkbenchWidgetInstanceActions } from "../useWorkbenchWidgetActions";
import type { DirectWorkRunHandoffController } from "../useDirectWorkRunHandoff";
import type { AgentExecutorSlot, WidgetInstanceId } from "../types";
import {
  createWorkspaceAgentQueueBridge,
  type WorkspaceAgentQueueAutonomousActionName,
  type WorkspaceAgentQueueAutonomousActionResult,
  type WorkspaceAgentQueueBridge,
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

type WorkspaceQueueActions = Pick<
  WorkbenchWidgetInstanceActions,
  | "assignAgentQueueTaskToExecutor"
  | "clearAgentQueueTaskAssignment"
  | "createAgentQueueTask"
  | "createAgentQueueWorker"
  | "deleteAgentQueueTask"
  | "deleteAgentQueueWorker"
  | "getAgentExecutorRunDetail"
  | "getAgentQueueRunnerSnapshot"
  | "getAgentQueueTask"
  | "getAgentQueueTaskLatestRunLink"
  | "listenToDirectWorkStreamEvents"
  | "listAgentQueueTaskRunLinks"
  | "listAgentQueueTasks"
  | "listAgentQueueWorkers"
  | "startAgentQueueRunnerSession"
  | "startAssignedAgentQueueTask"
  | "stopAgentQueueRunnerSession"
  | "updateAgentQueueTask"
  | "updateAgentQueueWorker"
>;

export type WorkspaceQueueApi = WorkspaceAgentQueueBridge & {
  controller: AgentQueueController;
  queueExecutorSlots: AgentExecutorSlot[];
  queueId: string;
};

export function useWorkspaceQueueApi({
  actions,
  agentExecutorSlots,
  directWorkRunHandoff,
  queueWidgetInstanceId,
  workspaceId,
}: {
  actions: WorkspaceQueueActions;
  agentExecutorSlots: AgentExecutorSlot[];
  directWorkRunHandoff: DirectWorkRunHandoffController;
  queueWidgetInstanceId?: WidgetInstanceId | null;
  workspaceId: string;
}): WorkspaceQueueApi {
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
  const controller = useAgentQueueController({
    agentExecutorSlots: queueExecutorSlots,
    onAssignAgentQueueTaskToExecutor: actions.assignAgentQueueTaskToExecutor,
    onClearAgentQueueTaskAssignment: actions.clearAgentQueueTaskAssignment,
    onCreateAgentQueueTask: actions.createAgentQueueTask,
    onCreateAgentQueueWorker: actions.createAgentQueueWorker,
    onDeleteAgentQueueTask: actions.deleteAgentQueueTask,
    onDeleteAgentQueueWorker: actions.deleteAgentQueueWorker,
    onDirectWorkRunHandoffStarted: directWorkRunHandoff.recordHandoff,
    onGetAgentExecutorRunDetail: actions.getAgentExecutorRunDetail,
    onGetAgentQueueRunnerSnapshot: actions.getAgentQueueRunnerSnapshot,
    onGetAgentQueueTask: actions.getAgentQueueTask,
    onGetAgentQueueTaskLatestRunLink: (queueItemId) =>
      actions.getAgentQueueTaskLatestRunLink({ queueItemId }),
    onListenToDirectWorkStreamEvents: actions.listenToDirectWorkStreamEvents,
    onListAgentQueueTaskRunLinks: (queueItemId) =>
      actions.listAgentQueueTaskRunLinks({ queueItemId }),
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
        listAgentQueueTaskRunLinks: (queueItemId) =>
          actions.listAgentQueueTaskRunLinks({ queueItemId }),
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
      actions.listAgentQueueTaskRunLinks,
      actions.listAgentQueueTasks,
      actions.listAgentQueueWorkers,
      actions.updateAgentQueueTask,
      controller.selectedTask?.queueItemId,
      queueExecutorSlots,
      queueId,
      workspaceId,
    ],
  );
  const bridge = createWorkspaceAgentQueueBridge({
    autonomousActions: {
      runAutonomousQueue: () => runAutonomousQueue(controller.autonomous),
      stopAutonomousQueueAfterCurrent: () =>
        stopAutonomousQueueAfterCurrent(controller.autonomous),
    },
    queueApi,
    queueState: {
      getRunSettingsDefaults: () =>
        agentQueueTaskRunSettingsDefaultsFromRun(controller.run) ??
        defaultAgentQueueTaskRunSettings(),
      refreshAfterMutation: (queueItemId) =>
        controller.refreshAfterExternalMutation(queueItemId),
    },
    workspaceId,
  });

  return {
    ...bridge,
    controller,
    queueExecutorSlots,
    queueId,
  };
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
