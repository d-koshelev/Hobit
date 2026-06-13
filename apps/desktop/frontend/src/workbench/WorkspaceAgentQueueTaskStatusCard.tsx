import { useState } from "react";
import { DisabledActionReason } from "../design-system/ActionPrimitives";
import { Badge } from "../design-system/Badge";
import { Button } from "../design-system/Button";
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
import { selectQueueV2ViewModel } from "./queue/queueV2ViewModel";
import { canCreateDiffReviewItem } from "./queue/agentQueueDiffReviewModel";
import {
  WorkspaceAgentQueueDiffReviewCreationResultCard,
  WorkspaceAgentQueueDiffReviewPreflightCard,
} from "./WorkspaceAgentQueueDiffReviewCards";
import { WorkspaceAgentQueueFinalizationCard } from "./WorkspaceAgentQueueFinalizationCard";
import type { ValidationRunner } from "./validation";
import { WorkspaceAgentQueueValidationCard } from "./WorkspaceAgentQueueValidationCard";
import type { WorkspaceAgentQueueBridge } from "./workspaceAgentQueueBridge";
import { queueV2NextActionLabel } from "./queue/queueV2NextActionModel";
import { workspaceChatValidationAvailability } from "./workspaceChatQueueValidation";
import {
  createWorkspaceChatQueueControlService,
  type WorkspaceChatQueueAction,
  type WorkspaceChatQueueActionResult,
} from "./workspaceChatQueueControlService";

type WorkspaceAgentQueueTaskStatusCardProps = {
  manualValidationCommandInputSupported?: boolean;
  onOpenQueueItem?: (queueItemId: string) => void;
  onViewReport?: (queueItemId: string) => void;
  queue?: AgentQueueController | null;
  validationRunner?: ValidationRunner | null;
  task: AgentQueueTask;
  workspaceAgentQueueBridge?: WorkspaceAgentQueueBridge | null;
};

type CardAction = {
  disabledReason: string | null;
  label: string;
  onClick: () => void | Promise<void>;
  variant: "primary" | "secondary" | "ghost";
};

export function WorkspaceAgentQueueTaskStatusCard({
  manualValidationCommandInputSupported = true,
  onOpenQueueItem,
  onViewReport,
  queue,
  validationRunner,
  task,
  workspaceAgentQueueBridge,
}: WorkspaceAgentQueueTaskStatusCardProps) {
  const [pendingAction, setPendingAction] = useState<
    WorkspaceChatQueueAction["kind"] | "view_report" | null
  >(null);
  const [validationRequestOpen, setValidationRequestOpen] = useState(false);
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
  const diffReviewDisabledReason = diffReviewCreationDisabledReason({
    bridgeAvailable: Boolean(workspaceAgentQueueBridge),
    queueAvailable: Boolean(queue),
    task: displayedTask,
  });
  const coordinatorDisabledReason = coordinatorFinalizationDisabledReason({
    queue,
    task: displayedTask,
  });
  const currentWorkspaceRoot = normalizedExecutionWorkspace(
    workspaceAgentQueueBridge?.getCurrentWorkspaceRoot?.() ??
      workspaceAgentQueueBridge?.getRunSettingsDefaults?.()?.executionWorkspace,
  );
  const actions = queueTaskCardActions({
    canViewReport: Boolean(onViewReport),
    currentWorkspaceRoot,
    hasReport,
    onOpenQueueItem,
    onQueueAction: (action) => void executeQueueAction(action),
    onRequestValidationReview: () => {
      setValidationRequestOpen(true);
      setActionResult({
        action: "request_validation",
        message: "Review selected validation commands, then click Run validation.",
        queueItemId: displayedTask.queueItemId,
        status: "success",
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
    validationDisabledReason: workspaceChatValidationAvailability({
      queueBridgeAvailable: Boolean(workspaceAgentQueueBridge),
      runner: validationRunner,
      task: displayedTask,
    }).disabledReason,
    diffReviewDisabledReason,
  });

  async function executeQueueAction(action: WorkspaceChatQueueAction) {
    if (pendingAction) {
      return;
    }

    setPendingAction(action.kind);
    setActionResult(null);
    try {
      const service = createWorkspaceChatQueueControlService({
        bridge: workspaceAgentQueueBridge,
        onOpenQueueItem,
        queue,
        validationRunner,
      });
      const result = await service.execute(action);
      setActionResult(result);
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

      {validationRequestOpen ? (
        <WorkspaceAgentQueueValidationCard
          bridge={workspaceAgentQueueBridge}
          manualCommandInputSupported={manualValidationCommandInputSupported}
          onOpenQueueItem={onOpenQueueItem}
          runner={validationRunner}
          task={displayedTask}
        />
      ) : null}

      <WorkspaceAgentQueueDiffReviewPreflightCard
        disabledReason={diffReviewDisabledReason}
        report={latestReport}
        task={displayedTask}
        validationStatusLabelValue={validationStatusLabel(validationStatus)}
      />

      <WorkspaceAgentQueueFinalizationCard
        bridgeAvailable={Boolean(workspaceAgentQueueBridge)}
        coordinatorDisabledReason={coordinatorDisabledReason}
        latestReport={latestReport}
        onOpenQueueItem={onOpenQueueItem}
        onQueueAction={(action) => void executeQueueAction(action)}
        pendingAction={pendingAction}
        result={actionResult}
        task={displayedTask}
        tasks={queue?.tasks ?? [displayedTask]}
      />

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
        actionResult.coordinatorFinalization ? null : actionResult.action === "create_diff_review" &&
        actionResult.diffReviewCreation ? (
          <WorkspaceAgentQueueDiffReviewCreationResultCard
            onOpenQueueItem={onOpenQueueItem}
            result={actionResult}
          />
        ) : (
          <div className="workspace-agent-queue-action-card-results">
            <p
              className={`coordinator-proposal-result coordinator-proposal-result-${
                actionResult.status === "failed" ? "error" : "success"
              }`}
            >
              {actionResult.message}
            </p>
          </div>
        )
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
  hasReport,
  currentWorkspaceRoot,
  onOpenQueueItem,
  onQueueAction,
  onRequestValidationReview,
  onViewReport,
  pendingAction,
  queue,
  task,
  validationDisabledReason,
  diffReviewDisabledReason,
}: {
  canViewReport: boolean;
  currentWorkspaceRoot: string | null;
  diffReviewDisabledReason: string | null;
  hasReport: boolean;
  onOpenQueueItem?: (queueItemId: string) => void;
  onQueueAction: (action: WorkspaceChatQueueAction) => void;
  onRequestValidationReview: () => void;
  onViewReport: () => void;
  pendingAction: WorkspaceChatQueueAction["kind"] | "view_report" | null;
  queue?: AgentQueueController | null;
  task: AgentQueueTask;
  validationDisabledReason: string | null;
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
  const promoteReason =
    selectedTaskReason ??
    (task.status !== "draft"
      ? "Only draft Queue tasks can be queued through this action."
      : !queue
        ? "Queue draft promotion is unavailable in this chat surface."
        : queue.draftPromotion?.canPromote
          ? null
          : "Queue draft promotion is unavailable for this task.");
  const actions: CardAction[] = [
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
  ];

  if (!task.executionWorkspace?.trim()) {
    actions.push({
      disabledReason: currentWorkspaceRoot
        ? null
        : "Current Workspace root is unavailable. Open a Workspace root before setting this task workspace.",
      label:
        pendingAction === "set_task_workspace"
          ? "Setting workspace"
          : "Set task workspace",
      onClick: () =>
        onQueueAction({
          executionWorkspace: currentWorkspaceRoot ?? "",
          kind: "set_task_workspace",
          queueItemId: task.queueItemId,
        }),
      variant: "secondary",
    });
  }

  if (task.status === "draft") {
    actions.push({
      disabledReason: promoteReason,
      label:
        pendingAction === "promote_task" || queue?.draftPromotion?.isPromoting
          ? "Queuing"
          : "Queue for run",
      onClick: () =>
        onQueueAction({
          kind: "promote_task",
          queueItemId: task.queueItemId,
        }),
      variant: "primary",
    });
  }

  actions.push(
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
      disabledReason: validationDisabledReason,
      label: "Request validation",
      onClick: onRequestValidationReview,
      variant: "ghost",
    },
    {
      disabledReason: diffReviewDisabledReason,
      label: "Create diff review",
      onClick: () =>
        onQueueAction({
          kind: "create_diff_review",
          queueItemId: task.queueItemId,
        }),
      variant: "ghost",
    },
  );

  return actions;
}

function coordinatorFinalizationDisabledReason({
  queue,
  task,
}: {
  queue?: AgentQueueController | null;
  task: AgentQueueTask;
}) {
  if (!queue) {
    return "Queue finalization path unavailable in this Workspace Chat surface.";
  }

  if (queue.selectedTask && queue.selectedTask.queueItemId !== task.queueItemId) {
    return "Open this Queue task before applying coordinator finalization decisions.";
  }

  if (!queue.coordinatorFinalization.canAct) {
    return (
      queue.coordinatorFinalization.message ??
      "Coordinator decision actions are unavailable for this task."
    );
  }

  return null;
}

function diffReviewCreationDisabledReason({
  bridgeAvailable,
  queueAvailable,
  task,
}: {
  bridgeAvailable: boolean;
  queueAvailable: boolean;
  task: AgentQueueTask;
}) {
  if (!bridgeAvailable) {
    return "Queue create bridge is unavailable in this Workspace Agent surface.";
  }

  if (!queueAvailable) {
    return "Queue controller state is unavailable in this Workspace Agent surface.";
  }

  if (!canCreateDiffReviewItem(task)) {
    return "Diff Review creation needs a report-ready or review-needed implementation task.";
  }

  return null;
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

function normalizedExecutionWorkspace(value: string | null | undefined) {
  const trimmed = value?.trim() ?? "";

  if (!trimmed || trimmed === "~" || trimmed === ".") {
    return null;
  }

  return trimmed;
}
