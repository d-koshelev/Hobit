import { KeyValueList, Notice } from "../../../../../design-system";
import type { AgentQueueTask } from "../../../../../workspace/types";
import { queueV2NextActionLabel } from "../../../../queue/queueV2NextActionModel";
import type { QueueInspectorSnapshot } from "../../../../queue/queueV2ViewModel";
import { queueV2BlockedByDependencyLabel } from "../../../../queue/queueV2SmartStatusModel";
import { laneLabel } from "../../model/queueV2TaskDetailsFormat";

export function QueueV2TaskDetailsSummary({
  inspector,
  task,
}: {
  inspector: QueueInspectorSnapshot;
  task: AgentQueueTask;
}) {
  const blockedBy = queueV2BlockedByDependencyLabel(inspector.dependencySummary);
  const blocker = blockedBy
    ? `${inspector.humanStatus.text}; ${blockedBy}`
    : inspector.blockerSummary.primaryReason ?? "None";
  const worker =
    task.assignedWorkerId ??
    task.assignedExecutorWidgetId ??
    (inspector.workerAssignment.compatibleWorkerIds.length
      ? `${inspector.workerAssignment.compatibleWorkerIds.length.toString()} compatible`
      : "Unassigned");

  return (
    <section
      aria-label="Task decision summary"
      className="queue-v2-task-details-summary"
    >
      <KeyValueList
        compact
        items={[
          { label: "Stage", value: laneLabel(inspector.boardLane) },
          { label: "Status", value: inspector.humanStatus.text },
          { label: "Dependencies", value: inspector.dependencySummary.message },
          {
            label: "Next action",
            value: queueV2NextActionLabel(inspector.nextAction),
          },
          {
            label: "Next available action",
            value: inspector.blockerSummary.nextAction,
          },
          { label: "Blocker", value: blocker },
          {
            label: "Coordinator decision",
            value: coordinatorDecisionSummary(inspector),
          },
          { label: "Workspace / worker", value: workspaceWorkerLabel(task, worker) },
        ]}
      />
      {inspector.humanStatus.status === "waiting_dependency" ? (
        <Notice variant="warning" title="Waiting dependency">
          {inspector.dependencySummary.message}
        </Notice>
      ) : inspector.humanStatus.status === "needs_decision" ? (
        <Notice variant="warning" title="Coordinator decision required">
          {inspector.humanStatus.text}
        </Notice>
      ) : inspector.blockerSummary.primaryReason ? (
        <Notice variant="warning" title="Blocked">
          {blockedNoticeText(inspector, blockedBy)}
        </Notice>
      ) : null}
    </section>
  );
}

function blockedNoticeText(
  inspector: QueueInspectorSnapshot,
  blockedBy: string | null,
) {
  return [
    inspector.humanStatus.text,
    blockedBy,
    inspector.blockerSummary.nextAction,
  ]
    .filter((item): item is string => Boolean(item))
    .join(". ");
}

function coordinatorDecisionSummary(inspector: QueueInspectorSnapshot) {
  if (inspector.humanStatus.status === "needs_decision") {
    return inspector.humanStatus.text;
  }

  if (inspector.reviewDecisionState === "none") {
    return "No coordinator decision pending";
  }

  return inspector.blockerSummary.nextAction;
}

function workspaceWorkerLabel(task: AgentQueueTask, worker: string) {
  const workspace = task.executionWorkspace?.trim();

  if (!workspace) {
    return worker;
  }

  return `${workspace} / ${worker}`;
}
