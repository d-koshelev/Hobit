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
import { queueV2NextActionLabel } from "./widgetV2/queueV2/QueueV2TaskDetailsPopup";
import { selectQueueV2ViewModel } from "./queue/queueV2ViewModel";

type WorkspaceAgentQueueTaskStatusCardProps = {
  onOpenQueueItem?: (queueItemId: string) => void;
  onViewReport?: (queueItemId: string) => void;
  queue?: AgentQueueController | null;
  task: AgentQueueTask;
};

type CardAction = {
  disabledReason: string | null;
  label: string;
  onClick: () => void;
  variant: "primary" | "secondary" | "ghost";
};

export function WorkspaceAgentQueueTaskStatusCard({
  onOpenQueueItem,
  onViewReport,
  queue,
  task,
}: WorkspaceAgentQueueTaskStatusCardProps) {
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
    hasReport,
    onOpenQueueItem,
    onViewReport,
    queue,
    task: displayedTask,
  });

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

      <p className="coordinator-proposal-note">
        Card actions are explicit. Rendering this card does not run, stop,
        refresh, validate, or update Queue work.
      </p>
    </section>
  );
}

function queueTaskCardActions({
  hasReport,
  onOpenQueueItem,
  onViewReport,
  queue,
  task,
}: {
  hasReport: boolean;
  onOpenQueueItem?: (queueItemId: string) => void;
  onViewReport?: (queueItemId: string) => void;
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

  return [
    {
      disabledReason: onOpenQueueItem
        ? null
        : "Open Queue is unavailable in this Workspace Agent surface.",
      label: "Open Queue",
      onClick: () => onOpenQueueItem?.(task.queueItemId),
      variant: "secondary",
    },
    {
      disabledReason: hasReport
        ? onViewReport
          ? null
          : "Report viewing is unavailable in this Workspace Agent surface."
        : "No report is ready for this task.",
      label: "View report",
      onClick: () => onViewReport?.(task.queueItemId),
      variant: "secondary",
    },
    {
      disabledReason: task.status === "running" ? "Task is already running." : runReason,
      label: queue?.run.isStarting ? "Starting" : "Run",
      onClick: () => queue?.run.onStartAssignedTask(),
      variant: "primary",
    },
    {
      disabledReason:
        task.status === "running"
          ? "Selected-task stop/cancel is not exposed to Workspace Chat. Use the Agent Executor run controls."
          : "Stop is only relevant while a task is running.",
      label: "Stop",
      onClick: () => undefined,
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
