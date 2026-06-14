import { Badge, Button, TopbarGroup } from "../../../design-system";
import { type QueueGlobalStatus } from "../../agentQueueTaskUiModel";
import type { AgentQueueController } from "../../queue/details/agentQueueTaskDetailsTypes";
import type { QueueV2ViewModel } from "../../queue/queueV2ViewModel";
import {
  queueV2EnableState,
  queueV2StateBadge,
} from "./model/queueV2StateBadge";

type QueueV2TopBarProps = {
  readonly globalExecutionState: QueueGlobalStatus;
  readonly queue?: AgentQueueController;
  readonly viewModel: QueueV2ViewModel;
};

export function QueueV2TopBar({
  globalExecutionState,
  queue,
  viewModel,
}: QueueV2TopBarProps) {
  const blockedCount = viewModel.lanes.blocked.length;
  const readyCount = viewModel.lanes.ready.length;
  const queueState = queueV2StateBadge({
    apiAvailable: queue?.apiAvailable ?? false,
    blockedCount,
    globalExecutionState,
    hasQueueControls: Boolean(queue?.foundation?.onStartWorkers),
    runningCount: viewModel.counts.running,
    availableSlots: viewModel.capacity.availableSlots,
    totalSlots: viewModel.capacity.totalSlots,
  });
  const enableState = queueV2EnableState({
    apiAvailable: queue?.apiAvailable ?? false,
    globalExecutionState,
    hasQueueControls: Boolean(queue?.foundation?.onStartWorkers),
  });

  return (
    <div className="queue-v2-top-bar" aria-label="Queue v2 top command bar">
      <TopbarGroup
        className="queue-v2-top-bar-status"
        data-group="status"
        label="Queue v2 status"
      >
        <span>Queue state</span>
        <div className="queue-v2-top-bar-state-row">
          <Badge
            aria-label={`Queue state: ${queueState.label}`}
            title={queueState.title}
            variant={queueState.variant}
          >
            {queueState.label}
          </Badge>
          {globalExecutionState !== "started" ? (
            <Button
              disabled={enableState.disabled}
              onClick={() => queue?.foundation.onStartWorkers()}
              title={enableState.reason}
              variant="primary"
            >
              Enable Queue
            </Button>
          ) : null}
          {enableState.disabled && enableState.reason ? (
            <span className="queue-v2-top-bar-action-reason">
              {enableState.reason}
            </span>
          ) : null}
        </div>
      </TopbarGroup>
      <TopbarGroup
        className="queue-v2-top-bar-counts"
        data-group="metrics"
        label="Queue v2 status counts"
      >
        <QueueV2TopBarMetric label="Ready" value={readyCount} />
        <QueueV2TopBarMetric label="Running" value={viewModel.counts.running} />
        <QueueV2TopBarMetric label="Review" value={viewModel.counts.reviewNeeded} />
        <QueueV2TopBarMetric label="Blocked" value={blockedCount} />
      </TopbarGroup>
      <TopbarGroup
        className="queue-v2-top-bar-capacity"
        data-group="capacity"
        label="Queue v2 capacity"
      >
        <span>Capacity</span>
        <strong>
          {viewModel.capacity.availableSlots.toString()} available /{" "}
          {viewModel.capacity.totalSlots.toString()} total
        </strong>
      </TopbarGroup>
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
