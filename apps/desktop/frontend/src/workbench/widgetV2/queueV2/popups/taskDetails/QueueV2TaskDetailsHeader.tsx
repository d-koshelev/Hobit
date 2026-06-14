import { Badge, KeyValueList } from "../../../../../design-system";
import type { QueueInspectorSnapshot } from "../../../../queue/queueV2ViewModel";
import { lifecycleLabel, laneLabel } from "../../model/queueV2TaskDetailsFormat";

export function QueueV2TaskDetailsHeader({
  inspector,
  taskStatus,
}: {
  inspector: QueueInspectorSnapshot;
  taskStatus: string;
}) {
  return (
    <div className="queue-v2-task-details-product-header" aria-label="Task status summary">
      <div className="queue-v2-task-details-status-line">
        <Badge variant={statusVariant(inspector.boardLane)}>
          {laneLabel(inspector.boardLane)}
        </Badge>
        <span>{lifecycleLabel(inspector.lifecycle)}</span>
      </div>
      <KeyValueList
        compact
        items={[
          { label: "Priority", value: inspector.priority.toString() },
          { label: "Task status", value: taskStatus },
          {
            label: "Review",
            value: inspector.reviewDecisionState === "none"
              ? "No review pending"
              : inspector.reviewDecisionState.replace(/_/g, " "),
          },
        ]}
      />
    </div>
  );
}

function statusVariant(lane: QueueInspectorSnapshot["boardLane"]) {
  switch (lane) {
    case "blocked":
      return "warning";
    case "review":
      return "warning";
    case "running":
      return "info";
    case "closed":
      return "success";
    default:
      return "neutral";
  }
}
