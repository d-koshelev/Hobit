import { Badge } from "../../../design-system/Badge";
import { Button } from "../../../design-system/Button";
import {
  coordinatorStatusBadgeVariant,
  coordinatorStatusBlocksNewWork,
  coordinatorStatusLabel,
} from "../../agentQueueTaskUiModel";
import {
  queueClosureStateBadgeVariant,
  queueClosureStateForTask,
  queueClosureStateLabel,
} from "../agentQueueClosureState";
import { executionPlanStatusLabel } from "../agentQueueExecutionPlanModel";
import {
  compactNextActionBlocker,
  isReportReadyStatus,
  isRunSettingPrecondition,
} from "./agentQueueTaskDetailsFormatters";
import {
  directWorkEvidenceForQueue,
  hasFinishedRunLink,
  isFailedRunEvidence,
} from "./agentQueueTaskDetailsEvidence";
import type {
  AgentQueueController,
  AgentQueueDetailsBadgeVariant,
  SelectedAgentQueueTask,
} from "./agentQueueTaskDetailsTypes";
import { autonomousNextActionForSelectedTask } from "./agentQueueTaskDetailsViewModel";

type NextAction = {
  actions: Array<{
    disabled?: boolean;
    label: string;
    onClick: () => void;
    variant: "primary" | "secondary" | "ghost";
  }>;
  badge: string;
  badgeVariant: AgentQueueDetailsBadgeVariant;
  copy: string | null;
  secondaryCopy: string | null;
  title: string;
  tone: string;
};

export function AgentQueueTaskNextActionPanel({
  queue,
  selectedTask,
}: {
  queue: AgentQueueController;
  selectedTask: SelectedAgentQueueTask;
}) {
  const action = nextActionForSelectedTask(queue, selectedTask);

  return (
    <section
      aria-label="Next action"
      className={[
        "agent-queue-expanded-section",
        "agent-queue-next-action",
        `agent-queue-next-action-${action.tone}`,
      ].join(" ")}
    >
      <div className="agent-queue-expanded-section-header">
        <div>
          <p className="agent-queue-expanded-kicker">Next action</p>
          <p className="agent-queue-next-action-title">{action.title}</p>
        </div>
        <Badge variant={action.badgeVariant}>{action.badge}</Badge>
      </div>
      <p className="agent-queue-next-action-copy">{action.copy}</p>
      {action.secondaryCopy ? (
        <p className="agent-queue-next-action-secondary">
          {action.secondaryCopy}
        </p>
      ) : null}
      {action.actions.length > 0 ? (
        <div className="agent-queue-run-actions">
          {action.actions.map((item) => (
            <Button
              disabled={item.disabled}
              key={item.label}
              onClick={item.onClick}
              variant={item.variant}
            >
              {item.label}
            </Button>
          ))}
        </div>
      ) : null}
    </section>
  );
}

function nextActionForSelectedTask(
  queue: AgentQueueController,
  selectedTask: SelectedAgentQueueTask,
): NextAction {
  const hasReport = (selectedTask.workerExecutionReports?.length ?? 0) > 0;
  const runEvidence = directWorkEvidenceForQueue(queue);
  const hasRunEvidence = Boolean(runEvidence);
  const hasReviewEvidence = hasReport || hasRunEvidence;
  const planLabel = executionPlanStatusLabel(selectedTask.executionPlanPreview);
  const readinessMessage = queue.run.readinessMessage;
  const preconditionMessage = queue.run.preconditionMessages[0] ?? null;
  const routingState = queue.assignedWorkerRoutingStates.get(
    selectedTask.queueItemId,
  );
  const routingBlocker =
    routingState && !routingState.canTake
      ? routingState.blockedReasons[0]?.label ?? null
      : null;
  const actions: NextAction["actions"] = [];
  const closureState = queueClosureStateForTask(selectedTask);

  if (selectedTask.status === "running" || queue.latestRun.link?.status === "running") {
    return {
      actions,
      badge: "Running",
      badgeVariant: "info",
      copy: "Running - waiting for final response.",
      secondaryCopy: null,
      title: "Agent activity",
      tone: "waiting",
    };
  }

  if (hasReviewEvidence) {
    actions.push({
      label: "View report",
      onClick: () => scrollToSelectedTaskReport(),
      variant: "primary",
    });

    actions.push({
      disabled: !queue.coordinatorFinalization.canAct,
      label: "Mark ready for finalization",
      onClick: () => queue.coordinatorFinalization.onMarkReadyForFinalization(),
      variant: "secondary",
    });
    actions.push({
      disabled: !queue.coordinatorFinalization.canAct,
      label: "Finalize / Accept",
      onClick: () => queue.coordinatorFinalization.onFinalize(),
      variant: "secondary",
    });

    actions.push({
      disabled: !queue.coordinatorFinalization.canAct,
      label: "Request changes",
      onClick: () => queue.coordinatorFinalization.onMarkNeedsChanges(),
      variant: "secondary",
    });
    actions.push({
      disabled: !queue.coordinatorFinalization.canAct,
      label: "Follow-up required",
      onClick: () => queue.coordinatorFinalization.onMarkFollowUpRequired(),
      variant: "secondary",
    });

    const failed = isFailedRunEvidence(queue, selectedTask);

    return {
      actions,
      badge: failed ? "Run failed" : queueClosureStateLabel(closureState),
      badgeVariant: failed ? "error" : queueClosureStateBadgeVariant(closureState),
      copy: failed
        ? "Run failed. Review the visible error evidence and make an explicit coordinator decision."
        : "Execution complete. Review report evidence and make an explicit coordinator decision.",
      secondaryCopy: "Coordinator finalization remains explicit; no item is accepted automatically.",
      title: "Review report and make coordinator decision",
      tone: "review",
    };
  }

  const autonomousAction = autonomousNextActionForSelectedTask(queue, selectedTask);

  if (autonomousAction) {
    return autonomousAction;
  }

  if (
    hasFinishedRunLink(queue) ||
    isReportReadyStatus(selectedTask.status) ||
    coordinatorStatusBlocksNewWork(selectedTask.coordinatorStatus)
  ) {
    if (queue.runEvidence.apiAvailable) {
      actions.push({
        disabled: queue.runEvidence.isLoading,
        label: queue.runEvidence.isLoading ? "Loading evidence" : "Refresh result",
        onClick: () => queue.runEvidence.onRefresh(),
        variant: "primary",
      });
    }

    actions.push({
      disabled: !queue.workerReport.canAttach,
      label: "Attach report",
      onClick: () => queue.workerReport.onAttachDemoReport(),
      variant: "secondary",
    });

    actions.push({
      label: "Developer details",
      onClick: () => scrollToDeveloperDetails(),
      variant: "ghost",
    });

    const failed = isFailedRunEvidence(queue, selectedTask);

    return {
      actions,
      badge: failed ? "Failure evidence missing" : "Evidence missing",
      badgeVariant: "warning",
      copy: failed
        ? "The run failed, but no worker report or Direct Work result evidence is attached. Review is not ready."
        : "Execution is complete, but no worker report or Direct Work result evidence is attached. Review is not ready.",
      secondaryCopy: "Rerun the task, attach a report, or inspect Developer details before making a coordinator decision.",
      title: failed ? "Failure evidence missing" : "Evidence missing",
      tone: "blocked",
    };
  }

  if (queue.run.canStart) {
    const executorCopy = queue.run.executorSelectionMessage?.startsWith(
      "Local executor selected automatically",
    )
      ? `${queue.run.executorSelectionMessage} `
      : "";

    actions.push({
      label: queue.run.isStarting ? "Starting" : "Run task",
      onClick: () => queue.run.onStartAssignedTask(),
      variant: "primary",
    });

    return {
      actions,
      badge: "Ready",
      badgeVariant: "success",
      copy: `${executorCopy}Start this task explicitly when ready.`,
      secondaryCopy: "Worker report appears below after execution.",
      title: "Run task",
      tone: "ready",
    };
  }

  if (coordinatorStatusBlocksNewWork(selectedTask.coordinatorStatus)) {
    actions.push({
      label: "View report",
      onClick: () => scrollToSelectedTaskReport(),
      variant: "primary",
    });

    actions.push({
      disabled: !queue.coordinatorFinalization.canAct,
      label: "Mark ready for finalization",
      onClick: () => queue.coordinatorFinalization.onMarkReadyForFinalization(),
      variant: "secondary",
    });
    actions.push({
      disabled: !queue.coordinatorFinalization.canAct,
      label: "Finalize / Accept",
      onClick: () => queue.coordinatorFinalization.onFinalize(),
      variant: "secondary",
    });

    actions.push({
      disabled: !queue.coordinatorFinalization.canAct,
      label: "Request changes",
      onClick: () => queue.coordinatorFinalization.onMarkNeedsChanges(),
      variant: "secondary",
    });
    actions.push({
      disabled: !queue.coordinatorFinalization.canAct,
      label: "Follow-up required",
      onClick: () => queue.coordinatorFinalization.onMarkFollowUpRequired(),
      variant: "secondary",
    });

    return {
      actions,
      badge: coordinatorStatusLabel(selectedTask.coordinatorStatus),
      badgeVariant: coordinatorStatusBadgeVariant(selectedTask.coordinatorStatus),
      copy:
        "Worker evidence or coordinator decisions are waiting for explicit review. Do not start more work until the coordinator state is resolved.",
      secondaryCopy: hasReviewEvidence
        ? "Review the report evidence below, then use coordinator finalization when it is relevant."
        : "No run evidence is attached yet.",
      title: "Awaiting coordinator review",
      tone: "review",
    };
  }

  if (selectedTask.status === "draft") {
    if (queue.draftPromotion.canPromote) {
      actions.push({
        label: "Promote to queued",
        onClick: () => queue.draftPromotion.onPromote(),
        variant: "primary",
      });
    }

    actions.push({
      label: queue.editTask.isEditing ? "Editing status" : "Edit status",
      onClick: () => queue.editTask.onStart(),
      variant: "secondary",
    });

    if (queue.executionPlan.canGenerate) {
      actions.push({
        label: "Generate plan preview",
        onClick: () => queue.executionPlan.onGenerate(),
        variant: "ghost",
      });
    }

    return {
      actions,
      badge: "Not runnable",
      badgeVariant: "warning",
      copy: "Draft task.",
      secondaryCopy: planLabel,
      title: "Promote to queued",
      tone: "blocked",
    };
  }

  if (readinessMessage === "Local executor unavailable.") {
    actions.push({
      disabled:
        queue.isAssigning ||
        !queue.selectedExecutorWidgetId ||
        !queue.assignmentApiAvailable,
      label: queue.isAssigning ? "Assigning" : "Assign executor",
      onClick: () => void queue.assignSelectedTask(),
      variant: "primary",
    });

    return {
      actions,
      badge: "Unassigned",
      badgeVariant: "warning",
      copy: "Local executor unavailable.",
      secondaryCopy: null,
      title: "Select local executor",
      tone: "blocked",
    };
  }

  if (readinessMessage?.includes("status") || routingBlocker) {
    return {
      actions,
      badge: "Blocked",
      badgeVariant: "warning",
      copy: compactNextActionBlocker(readinessMessage ?? routingBlocker),
      secondaryCopy: null,
      title: "Not runnable yet",
      tone: "blocked",
    };
  }

  if (!readinessMessage && preconditionMessage) {
    const missingRunSetting = isRunSettingPrecondition(preconditionMessage);

    return {
      actions,
      badge: missingRunSetting ? "Not configured" : "Waiting",
      badgeVariant: "warning",
      copy: compactNextActionBlocker(preconditionMessage),
      secondaryCopy: null,
      title: missingRunSetting ? "Set run settings" : "Waiting for run",
      tone: "blocked",
    };
  }

  return {
    actions,
    badge: readinessMessage ? "Blocked" : "Waiting",
    badgeVariant: readinessMessage ? "warning" : "neutral",
    copy:
      compactNextActionBlocker(readinessMessage ?? routingBlocker) ??
      "Review settings, then run explicitly.",
    secondaryCopy: null,
    title: readinessMessage ? "Blocked before execution" : "Waiting for action",
    tone: readinessMessage ? "blocked" : "waiting",
  };
}

function scrollToSelectedTaskReport() {
  if (typeof document === "undefined") {
    return;
  }

  document
    .getElementById("agent-queue-human-log-report")
    ?.scrollIntoView({ block: "nearest" });
}

function scrollToDeveloperDetails() {
  if (typeof document === "undefined") {
    return;
  }

  document
    .getElementById("agent-queue-developer-details")
    ?.scrollIntoView({ block: "nearest" });
}
