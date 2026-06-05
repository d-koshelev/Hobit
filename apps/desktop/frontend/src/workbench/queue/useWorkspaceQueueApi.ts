import { useCallback, useMemo, useRef, useState } from "react";

import type { WorkbenchWidgetInstanceActions } from "../useWorkbenchWidgetActions";
import type { DirectWorkRunHandoffController } from "../useDirectWorkRunHandoff";
import type { AgentExecutorSlot, AgentQueueItemOpenRequest } from "../types";
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
  openQueueItem: (queueItemId: string) => void;
  queueItemOpenRequest: AgentQueueItemOpenRequest | null;
  queueExecutorSlots: AgentExecutorSlot[];
  queueId: string;
};

export function useWorkspaceQueueApi({
  actions,
  directWorkRunHandoff,
  queueExecutorSlots,
  workspaceId,
}: {
  actions: WorkspaceQueueActions;
  queueExecutorSlots: AgentExecutorSlot[];
  directWorkRunHandoff: DirectWorkRunHandoffController;
  workspaceId: string;
}): WorkspaceQueueApi {
  const queueItemOpenRequestIdRef = useRef(0);
  const [queueItemOpenRequest, setQueueItemOpenRequest] =
    useState<AgentQueueItemOpenRequest | null>(null);
  const queueOwnerWidgetInstanceId = useMemo(
    () =>
      queueExecutorSlots.find((slot) => slot.ownerKind === "agent_queue")
        ?.widgetInstanceId ?? null,
    [queueExecutorSlots],
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
    onClearAgentQueueTaskAssignment: actions.clearAgentQueueTaskAssignment,
    onCreateAgentQueueTask: actions.createAgentQueueTask,
    onCreateAgentQueueWorker: actions.createAgentQueueWorker,
    onDeleteAgentQueueTask: actions.deleteAgentQueueTask,
    onDeleteAgentQueueWorker: actions.deleteAgentQueueWorker,
    onDirectWorkRunHandoffStarted: directWorkRunHandoff.recordHandoff,
    onGetAgentExecutorRunDetail: actions.getAgentExecutorRunDetail,
    onGetAgentQueueRunnerSnapshot: actions.getAgentQueueRunnerSnapshot,
    onGetAgentQueueTask: actions.getAgentQueueTask,
    onGetAgentQueueTaskLatestRunLink: getAgentQueueTaskLatestRunLink,
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
    queueWidgetInstanceId: queueOwnerWidgetInstanceId,
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
  const openQueueItem = useCallback(
    (queueItemId: string) => {
      const trimmedQueueItemId = queueItemId.trim();

      if (!trimmedQueueItemId) {
        return;
      }

      setQueueItemOpenRequest({
        id: ++queueItemOpenRequestIdRef.current,
        queueItemId: trimmedQueueItemId,
      });
      void controller.selectTask(trimmedQueueItemId);
    },
    [controller.selectTask],
  );

  return {
    ...bridge,
    controller,
    openQueueItem,
    queueItemOpenRequest,
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
