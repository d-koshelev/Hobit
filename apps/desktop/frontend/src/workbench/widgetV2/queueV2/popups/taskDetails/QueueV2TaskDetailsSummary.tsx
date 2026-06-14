import { KeyValueList, Notice } from "../../../../../design-system";
import type { AgentQueueTask } from "../../../../../workspace/types";
import { queueV2NextActionLabel } from "../../../../queue/queueV2NextActionModel";
import type { QueueInspectorSnapshot } from "../../../../queue/queueV2ViewModel";
import { laneLabel } from "../../model/queueV2TaskDetailsFormat";

export function QueueV2TaskDetailsSummary({
  inspector,
  task,
}: {
  inspector: QueueInspectorSnapshot;
  task: AgentQueueTask;
}) {
  const blocker = inspector.blockerSummary.primaryReason ?? "None";
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
          {
            label: "Next action",
            value: queueV2NextActionLabel(inspector.nextAction),
          },
          {
            label: "Next available action",
            value: inspector.blockerSummary.nextAction,
          },
          { label: "Blocker", value: blocker },
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
          {inspector.blockerSummary.nextAction}
        </Notice>
      ) : null}
    </section>
  );
}

function workspaceWorkerLabel(task: AgentQueueTask, worker: string) {
  const workspace = task.executionWorkspace?.trim();

  if (!workspace) {
    return worker;
  }

  return `${workspace} / ${worker}`;
}
