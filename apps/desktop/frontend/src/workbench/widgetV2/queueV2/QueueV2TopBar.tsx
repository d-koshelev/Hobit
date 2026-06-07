import {
  queueGlobalExecutionStateLabel,
  type QueueGlobalStatus,
} from "../../agentQueueTaskUiModel";
import type { QueueV2ViewModel } from "../../queue/queueV2ViewModel";

type QueueV2TopBarProps = {
  readonly globalExecutionState: QueueGlobalStatus;
  readonly viewModel: QueueV2ViewModel;
};

export function QueueV2TopBar({
  globalExecutionState,
  viewModel,
}: QueueV2TopBarProps) {
  const blockedCount = viewModel.lanes.blocked.length;
  const readyCount = viewModel.lanes.ready.length;

  return (
    <div className="queue-v2-top-bar" aria-label="Queue v2 top command bar">
      <div className="queue-v2-top-bar-status">
        <span>Queue mode</span>
        <strong>{queueGlobalExecutionStateLabel(globalExecutionState)}</strong>
      </div>
      <div className="queue-v2-top-bar-counts" aria-label="Queue v2 status counts">
        <QueueV2TopBarMetric label="Ready" value={readyCount} />
        <QueueV2TopBarMetric label="Running" value={viewModel.counts.running} />
        <QueueV2TopBarMetric label="Review" value={viewModel.counts.reviewNeeded} />
        <QueueV2TopBarMetric label="Blocked" value={blockedCount} />
      </div>
      <div className="queue-v2-top-bar-capacity" aria-label="Queue v2 capacity">
        <span>Capacity</span>
        <strong>
          {viewModel.capacity.availableSlots.toString()} available /{" "}
          {viewModel.capacity.totalSlots.toString()} total
        </strong>
      </div>
      <div className="queue-v2-top-bar-placeholders">
        <input
          aria-label="Queue v2 search placeholder"
          disabled
          placeholder="Search tasks"
          type="search"
        />
        <button disabled type="button">
          Filters
        </button>
        <button disabled type="button">
          Settings
        </button>
      </div>
    </div>
  );
}

function QueueV2TopBarMetric({
  label,
  value,
}: {
  readonly label: string;
  readonly value: number;
}) {
  return (
    <span className="queue-v2-top-bar-metric">
      <span>{label}</span>
      <strong>{value.toString()}</strong>
    </span>
  );
}
