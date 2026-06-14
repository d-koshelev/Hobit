import type { AgentQueueTask } from "../../../workspace/types";
import {
  normalizeQueueTag,
  type QueueGlobalStatus,
} from "../../agentQueueTaskUiModel";
import { queueTagColorToken } from "../../queue/agentQueueTagColors";
import type { QueueV2ViewModel } from "../../queue/queueV2ViewModel";

type QueueV2LeftRailProps = {
  readonly globalExecutionState: QueueGlobalStatus;
  readonly tasks: readonly AgentQueueTask[];
  readonly viewModel: QueueV2ViewModel;
};

export function QueueV2LeftRail({
  globalExecutionState,
  tasks,
  viewModel,
}: QueueV2LeftRailProps) {
  const tagSummaries = queueV2TagSummaries(tasks);

  return (
    <div className="queue-v2-left-rail" aria-label="Queue v2 filters and capacity">
      <section className="queue-v2-left-rail-section" aria-label="Queue v2 filters">
        <h3>Filters</h3>
        <RailLine label="Ready now" value={viewModel.counts.eligibleNow.toString()} />
        <RailLine label="Needs review" value={viewModel.counts.reviewNeeded.toString()} />
        <RailLine label="Blocked" value={viewModel.lanes.blocked.length.toString()} />
        <RailLine
          label="Queue"
          value={globalExecutionState === "started" ? "Active" : "Paused"}
        />
      </section>

      <section className="queue-v2-left-rail-section" aria-label="Queue v2 tag legend">
        <h3>Tags</h3>
        {tagSummaries.length === 0 ? (
          <p className="queue-v2-left-rail-empty">No task tags</p>
        ) : (
          <ul className="queue-v2-tag-legend">
            {tagSummaries.map((tag) => (
              <li className={tag.colorToken} key={tag.id}>
                <span className="queue-v2-tag-swatch" aria-hidden="true" />
                <span>{tag.name}</span>
                <strong>{tag.count.toString()}</strong>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="queue-v2-left-rail-section" aria-label="Queue v2 workers capacity">
        <h3>Workers</h3>
        <RailLine
          label="Available"
          value={`${viewModel.capacity.availableSlots.toString()}/${viewModel.capacity.totalSlots.toString()}`}
        />
        <RailLine label="Running" value={viewModel.capacity.runningSlots.toString()} />
        <RailLine label="Paused" value={viewModel.capacity.pausedSlots.toString()} />
        {viewModel.capacity.workers.length === 0 ? (
          <p className="queue-v2-left-rail-empty">No visible workers</p>
        ) : (
          <ul className="queue-v2-worker-summary-list">
            {viewModel.capacity.workers.map((worker) => (
              <li key={worker.workerId}>
                <span>{worker.label}</span>
                <strong>
                  {worker.availableCount > 0
                    ? "Available"
                    : worker.runningCount > 0
                      ? "Running"
                      : "Paused"}
                </strong>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function RailLine({
  label,
  value,
}: {
  readonly label: string;
  readonly value: string;
}) {
  return (
    <div className="queue-v2-rail-line">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function queueV2TagSummaries(tasks: readonly AgentQueueTask[]) {
  const summaries = new Map<
    string,
    { colorToken: string; count: number; id: string; name: string }
  >();

  for (const task of tasks) {
    const tag = normalizeQueueTag(task);
    const current =
      summaries.get(tag.queueTagId) ??
      {
        colorToken: queueTagColorToken(tag.queueTagId),
        count: 0,
        id: tag.queueTagId,
        name: tag.queueTagName,
      };

    current.count += 1;
    summaries.set(tag.queueTagId, current);
  }

  return Array.from(summaries.values()).sort((left, right) =>
    left.name.localeCompare(right.name),
  );
}
