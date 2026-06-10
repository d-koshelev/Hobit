import { useState } from "react";
import { DisabledActionReason } from "../design-system/ActionPrimitives";
import { Badge } from "../design-system/Badge";
import { Button } from "../design-system/Button";
import type { AgentQueueReportActionType } from "../workspace/types";
import type { AgentQueueTask } from "../workspace/types";
import {
  coordinatorStatusBadgeVariant,
  coordinatorStatusLabel,
  displayTaskTitle,
  normalizeValidationStatus,
  statusBadgeVariant,
  statusLabel,
  validationBadgeVariant,
  validationStatusLabel,
} from "./agentQueueTaskUiModel";
import type { AgentQueueController } from "./queue/useAgentQueueController";
import { queueV2NextActionLabel } from "./widgetV2/queueV2/QueueV2TaskDetailsPopup";
import { selectQueueV2ViewModel } from "./queue/queueV2ViewModel";
import {
  createWorkspaceChatQueueControlService,
  type WorkspaceChatQueueAction,
  type WorkspaceChatQueueActionResult,
} from "./workspaceChatQueueControlService";

type WorkspaceAgentQueueTaskStatusCardProps = {
  onOpenQueueItem?: (queueItemId: string) => void;
  onViewReport?: (queueItemId: string) => void;
  queue?: AgentQueueController | null;
  task: AgentQueueTask;
};

type CardAction = {
  disabledReason: string | null;
  label: string;
  onClick: () => void | Promise<void>;
  variant: "primary" | "secondary" | "ghost";
};

export function WorkspaceAgentQueueTaskStatusCard({
  onOpenQueueItem,
  onViewReport,
  queue,
  task,
}: WorkspaceAgentQueueTaskStatusCardProps) {
  const [pendingAction, setPendingAction] = useState<
    WorkspaceChatQueueAction["kind"] | "view_report" | null
  >(null);
  const [confirmationAction, setConfirmationAction] =
    useState<AgentQueueReportActionType | null>(null);
  const [actionResult, setActionResult] =
    useState<WorkspaceChatQueueActionResult | null>(null);
  const viewModel = selectQueueV2ViewModel({
    autorunArmed: Boolean(queue?.autorun.snapshot?.isActive),
    globalExecutionState: queue?.foundation.globalExecutionState ?? "started",
    pausedQueueTagIds: queue?.foundation.pausedQueueTagIds ?? new Set(),
    selectedTaskId: task.queueItemId,
    tasks: queue?.tasks ?? [task],
    workers: queue?.foundation.workers ?? [],
  });
  const taskViewModel =
    viewModel.tasks.find((item) => item.taskId === task.queueItemId) ??
    viewModel.tasks[0];
  const displayedTask = taskViewModel?.task ?? task;
  const latestReport =
    displayedTask.workerExecutionReports?.[
      displayedTask.workerExecutionReports.length - 1
    ] ?? null;
  const compactWarnings = [
    ...(latestReport?.warnings ?? []),
    ...(displayedTask.context?.contextWarnings.map((warning) => warning.message) ??
      []),
  ].slice(0, 2);
  const compactErrors = (latestReport?.errors ?? []).slice(0, 2);
  const validationStatus = normalizeValidationStatus(
    displayedTask.validationStatus,
  );
  const hasReport = Boolean(latestReport);
  const actions = queueTaskCardActions({
    confirmationAction,
    canViewReport: Boolean(onViewReport),
    hasReport,
    onConfirmCoordinatorAction: (actionType) =>
      void executeQueueAction({
        actionType,
        kind: "coordinator_decision",
        queueItemId: displayedTask.queueItemId,
      }),
    onOpenQueueItem,
    onQueueAction: (action) => void executeQueueAction(action),
    onRequestCoordinatorConfirmation: (actionType) => {
      setConfirmationAction(actionType);
      setActionResult({
        action: "coordinator_decision",
        message: "Confirm Accept result to finalize this Queue item.",
        queueItemId: displayedTask.queueItemId,
        status: "unavailable",
      });
    },
    onViewReport: () => {
      if (!onViewReport) {
        return;
      }
      setPendingAction("view_report");
      onViewReport(displayedTask.queueItemId);
      setPendingAction(null);
      setActionResult({
        action: "open_task",
        message: `View report request sent for ${displayedTask.queueItemId}.`,
        queueItemId: displayedTask.queueItemId,
        status: "success",
      });
    },
    pendingAction,
    queue,
    task: displayedTask,
  });

  async function executeQueueAction(action: WorkspaceChatQueueAction) {
    if (pendingAction) {
      return;
    }

    setPendingAction(action.kind);
    setActionResult(null);
    try {
      const service = createWorkspaceChatQueueControlService({
        onOpenQueueItem,
        queue,
      });
      const result = await service.execute(action);
      setActionResult(result);
      if (
        action.kind === "coordinator_decision" &&
        action.actionType === confirmationAction
      ) {
        setConfirmationAction(null);
      }
    } finally {
      setPendingAction(null);
    }
  }

  return (
    <section
      aria-label={`Queue task status card: ${displayTaskTitle(displayedTask)}`}
      className="workspace-agent-queue-action-card workspace-agent-queue-task-status-card"
    >
      <div className="workspace-agent-queue-action-card-header">
        <div>
          <p className="coordinator-proposal-kicker">Queue task status</p>
          <h4 className="coordinator-proposal-title">
            {displayTaskTitle(displayedTask)}
          </h4>
          <p className="coordinator-proposal-note">
            {shortQueueTaskId(displayedTask.queueItemId)}
          </p>
        </div>
        <div className="coordinator-proposal-badges">
          <Badge variant={statusBadgeVariant(displayedTask.status)}>
            {statusLabel(displayedTask.status)}
          </Badge>
          <Badge variant="neutral">
            {boardLaneLabel(taskViewModel?.boardLane ?? "blocked")}
          </Badge>
        </div>
      </div>

      <dl className="workspace-agent-queue-action-card-facts">
        <TaskFact
          label="Next action"
          value={
            taskViewModel
              ? queueV2NextActionLabel(taskViewModel.nextAction)
              : "Resolve blocker"
          }
        />
        <TaskFact
          label="Coordinator"
          value={coordinatorStatusLabel(displayedTask.coordinatorStatus)}
        />
        <TaskFact
          label="Validation"
          value={validationStatusLabel(validationStatus)}
        />
        <TaskFact
          label="Report"
          value={latestReport ? reportStatusLabel(latestReport.reportStatus) : "Not ready"}
        />
      </dl>

      <div className="workspace-agent-queue-task-status-badges">
        <Badge variant={coordinatorStatusBadgeVariant(displayedTask.coordinatorStatus)}>
          {coordinatorStatusLabel(displayedTask.coordinatorStatus)}
        </Badge>
        <Badge variant={validationBadgeVariant(validationStatus)}>
          {validationStatusLabel(validationStatus)}
        </Badge>
      </div>

      {taskViewModel?.blockedReasons.length ? (
        <ul className="workspace-agent-queue-action-card-list">
          {taskViewModel.blockedReasons.slice(0, 2).map((reason) => (
            <li key={reason.code}>{reason.label}</li>
          ))}
        </ul>
      ) : null}

      {compactWarnings.length || compactErrors.length ? (
        <div
          aria-label="Queue task compact warnings"
          className="workspace-agent-queue-task-status-warnings"
        >
          {[...compactErrors, ...compactWarnings].map((message) => (
            <p key={message}>{message}</p>
          ))}
        </div>
      ) : null}

      <div
        aria-label="Queue task status actions"
        className="workspace-agent-queue-task-status-actions"
      >
        {actions.map((action) => (
          <span
            className="workspace-agent-queue-task-status-action"
            key={action.label}
          >
            <Button
              disabled={Boolean(action.disabledReason)}
              onClick={action.onClick}
              title={action.disabledReason ?? undefined}
              variant={action.variant}
            >
              {action.label}
            </Button>
            <DisabledActionReason reason={action.disabledReason} />
          </span>
        ))}
      </div>

      {actionResult ? (
        <div className="workspace-agent-queue-action-card-results">
          <p
            className={`coordinator-proposal-result coordinator-proposal-result-${
              actionResult.status === "failed" ? "error" : "success"
            }`}
          >
            {actionResult.message}
          </p>
        </div>
      ) : null}

      <p className="coordinator-proposal-note">
        Card actions are explicit. Rendering this card does not run, stop,
        refresh, validate, or update Queue work.
      </p>
    </section>
  );
}

function queueTaskCardActions({
  canViewReport,
  confirmationAction,
  hasReport,
  onOpenQueueItem,
  onConfirmCoordinatorAction,
  onQueueAction,
  onRequestCoordinatorConfirmation,
  onViewReport,
  pendingAction,
  queue,
  task,
}: {
  confirmationAction: AgentQueueReportActionType | null;
  canViewReport: boolean;
  hasReport: boolean;
  onOpenQueueItem?: (queueItemId: string) => void;
  onConfirmCoordinatorAction: (actionType: AgentQueueReportActionType) => void;
  onQueueAction: (action: WorkspaceChatQueueAction) => void;
  onRequestCoordinatorConfirmation: (actionType: AgentQueueReportActionType) => void;
  onViewReport: () => void;
  pendingAction: WorkspaceChatQueueAction["kind"] | "view_report" | null;
  queue?: AgentQueueController | null;
  task: AgentQueueTask;
}): CardAction[] {
  const selectedTaskMismatch = Boolean(
    queue?.selectedTask && queue.selectedTask.queueItemId !== task.queueItemId,
  );
  const selectedTaskReason = selectedTaskMismatch
    ? "Open this Queue task before applying selected-task actions."
    : null;
  const runReason =
    selectedTaskReason ??
    (!queue
      ? "Queue run action is unavailable in this chat surface."
      : queue.run.canStart
        ? null
        : queue.run.readinessMessage ??
          queue.run.preconditionMessages[0] ??
          "Queue run action is unavailable for this task.");
  const coordinatorReason =
    selectedTaskReason ??
    (!queue
      ? "Queue coordinator actions are unavailable in this chat surface."
      : queue.coordinatorFinalization.canAct
        ? null
        : queue.coordinatorFinalization.message ??
          "Coordinator decision actions are unavailable for this task.");
  const acceptReason =
    coordinatorReason ??
    (!hasReport
      ? "Accept result needs a visible report or review result."
      : null);
  const acceptNeedsConfirmation =
    confirmationAction === "finalize_accept_item" && !acceptReason;

  return [
    {
      disabledReason: onOpenQueueItem
        ? null
        : "Open Queue is unavailable in this Workspace Agent surface.",
      label: "Open Queue",
      onClick: () =>
        onQueueAction({
          kind: "open_task",
          queueItemId: task.queueItemId,
        }),
      variant: "secondary",
    },
    {
      disabledReason: hasReport
        ? canViewReport
          ? null
          : "Report viewing is unavailable in this Workspace Agent surface."
        : "No report is ready for this task.",
      label: "View report",
      onClick: onViewReport,
      variant: "secondary",
    },
    {
      disabledReason: task.status === "running" ? "Task is already running." : runReason,
      label:
        pendingAction === "run_task" || queue?.run.isStarting ? "Starting" : "Run",
      onClick: () =>
        onQueueAction({
          kind: "run_task",
          queueItemId: task.queueItemId,
        }),
      variant: "primary",
    },
    {
      disabledReason:
        task.status === "running"
          ? "Selected-task stop/cancel is not exposed to Workspace Chat. Use the Agent Executor run controls."
          : "Stop is only relevant while a task is running.",
      label: "Stop",
      onClick: () =>
        onQueueAction({
          kind: "stop_task",
          queueItemId: task.queueItemId,
        }),
      variant: "ghost",
    },
    {
      disabledReason: "Queue validation execution is not exposed to Workspace Chat.",
      label: "Request validation",
      onClick: () =>
        onQueueAction({
          kind: "request_validation",
          queueItemId: task.queueItemId,
        }),
      variant: "ghost",
    },
    {
      disabledReason:
        "Diff Review task creation is not exposed as a Workspace Chat Queue control action.",
      label: "Create diff review",
      onClick: () =>
        onQueueAction({
          kind: "create_diff_review",
          queueItemId: task.queueItemId,
        }),
      variant: "ghost",
    },
    {
      disabledReason: acceptReason,
      label: acceptNeedsConfirmation ? "Confirm accept" : "Accept result",
      onClick: () =>
        acceptNeedsConfirmation
          ? onConfirmCoordinatorAction("finalize_accept_item")
          : onRequestCoordinatorConfirmation("finalize_accept_item"),
      variant: "primary",
    },
    {
      disabledReason: coordinatorReason,
      label: "Request changes",
      onClick: () =>
        onQueueAction({
          actionType: "mark_needs_changes",
          kind: "coordinator_decision",
          queueItemId: task.queueItemId,
        }),
      variant: "secondary",
    },
    {
      disabledReason: coordinatorReason,
      label: "Create follow-up",
      onClick: () =>
        onQueueAction({
          actionType: "create_follow_up",
          kind: "coordinator_decision",
          queueItemId: task.queueItemId,
        }),
      variant: "secondary",
    },
    {
      disabledReason: coordinatorReason,
      label: "Mark blocked",
      onClick: () =>
        onQueueAction({
          actionType: "mark_blocked",
          kind: "coordinator_decision",
          queueItemId: task.queueItemId,
        }),
      variant: "secondary",
    },
    {
      disabledReason: coordinatorReason,
      label: "Mark failed",
      onClick: () =>
        onQueueAction({
          actionType: "mark_failed_rejected",
          kind: "coordinator_decision",
          queueItemId: task.queueItemId,
        }),
      variant: "secondary",
    },
    {
      disabledReason:
        "Rollback is not exposed as a Workspace Chat Queue control action. No rollback, reset, clean, or process kill can run from this card.",
      label: "Rollback",
      onClick: () =>
        onQueueAction({
          actionType: "mark_rollback_required",
          kind: "coordinator_decision",
          queueItemId: task.queueItemId,
        }),
      variant: "ghost",
    },
  ];
}

function TaskFact({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

function shortQueueTaskId(queueItemId: string) {
  const trimmed = queueItemId.trim();
  if (trimmed.length <= 12) {
    return trimmed;
  }

  return `${trimmed.slice(0, 8)}...${trimmed.slice(-4)}`;
}

function boardLaneLabel(lane: string) {
  switch (lane) {
    case "intake_draft":
      return "Intake";
    case "ready":
      return "Ready";
    case "running":
      return "Running";
    case "review":
      return "Review";
    case "closed":
      return "Closed";
    case "blocked":
    default:
      return "Blocked";
  }
}

function reportStatusLabel(status: string) {
  switch (status) {
    case "completed":
      return "Completed";
    case "failed":
      return "Failed";
    case "interrupted":
      return "Interrupted";
    case "needs_follow_up":
      return "Needs follow-up";
    case "reported":
    default:
      return "Ready";
  }
}
