import { useMemo } from "react";
import { Badge } from "../design-system/Badge";
import type { AgentQueueTask } from "../workspace/types";
import {
  validationBadgeVariant,
  statusBadgeVariant,
  type AgentQueueDependencyState,
  type AgentWorkerSummary,
} from "./agentQueueTaskUiModel";
import {
  buildQueueFlowMap,
  type QueueExecutorLane,
  type QueueFlowItemBlock,
} from "./queue/agentQueueFlowMapModel";
import type { AgentQueueAssignedWorkerRoutingState } from "./queue/agentQueueRoutingModel";

type AgentQueueFlowMapProps = {
  dependencyStates: ReadonlyMap<string, AgentQueueDependencyState>;
  isSelecting: boolean;
  onSelectTask: (queueItemId: string) => void;
  pausedQueueTagIds: ReadonlySet<string>;
  routingStates: ReadonlyMap<string, AgentQueueAssignedWorkerRoutingState>;
  selectedTask: AgentQueueTask | null;
  tasks: AgentQueueTask[];
  workers: AgentWorkerSummary[];
};

export function AgentQueueFlowMap({
  dependencyStates,
  isSelecting,
  onSelectTask,
  pausedQueueTagIds,
  routingStates,
  selectedTask,
  tasks,
  workers,
}: AgentQueueFlowMapProps) {
  const flowMap = useMemo(
    () =>
      buildQueueFlowMap({
        dependencyStates,
        pausedQueueTagIds,
        routingStates,
        tasks,
        workers,
      }),
    [dependencyStates, pausedQueueTagIds, routingStates, tasks, workers],
  );

  return (
    <section aria-label="Agent Queue flow map" className="agent-queue-flow-map-pane">
      <div className="agent-queue-pane-header">
        <div>
          <p className="agent-queue-pane-title">Flow map</p>
          <p className="agent-queue-pane-subtitle">
            {tasks.length === 1 ? "1 work item" : `${tasks.length.toString()} work items`}
          </p>
        </div>
        <Badge variant="neutral">visual only</Badge>
      </div>

      <div className="agent-queue-flow-map-scroll">
        {flowMap.columns.length === 0 ? (
          <div className="agent-queue-empty-state agent-queue-empty-state-compact">
            <p className="empty-state-title">No active queue flow.</p>
            <p className="empty-state-text">
              Active queued, ready, running, or review-needed items appear here.
            </p>
          </div>
        ) : (
          <div className="agent-queue-flow-layers" role="list">
            {flowMap.columns.map((column) => (
              <div className="agent-queue-flow-layer" key={column.id} role="listitem">
                <div className="agent-queue-flow-layer-header">
                  <p className="agent-queue-flow-layer-title">{column.label}</p>
                  <Badge variant="neutral">
                    {column.groups.reduce(
                      (count, group) => count + group.items.length,
                      0,
                    )}{" "}
                    items
                  </Badge>
                </div>
                <div className="agent-queue-flow-groups">
                  {column.groups.map((group) => (
                    <section
                      className={[
                        "agent-queue-flow-group",
                        group.colorToken,
                      ].join(" ")}
                      data-tag-color-token={group.colorToken}
                      key={group.id}
                    >
                      <div className="agent-queue-flow-group-header">
                        <span className="agent-queue-flow-tag-swatch" />
                        <p className="agent-queue-flow-group-title">
                          {group.queueTagName}
                        </p>
                      </div>
                      <div className="agent-queue-flow-block-stack">
                        {group.items.map((item) => (
                          <FlowItemBlock
                            isSelecting={isSelecting}
                            isSelected={
                              selectedTask?.queueItemId === item.queueItemId
                            }
                            item={item}
                            key={item.queueItemId}
                            onSelectTask={onSelectTask}
                          />
                        ))}
                      </div>
                    </section>
                  ))}
                </div>
                {column.barriersAfter.map((barrier) => (
                  <div
                    className="agent-queue-flow-barrier"
                    key={barrier.id}
                    role="separator"
                    title={`${barrier.blockingItemIds.length.toString()} blockers, ${barrier.blockedItemIds.length.toString()} dependent items`}
                  >
                    <span className="agent-queue-flow-barrier-line" />
                    <span className="agent-queue-flow-barrier-label">
                      {barrier.label}
                    </span>
                    <span className="agent-queue-flow-barrier-line" />
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}

        <section
          aria-label="Agent Executor section"
          className="agent-queue-flow-executors"
        >
          <div className="agent-queue-flow-section-baseline">
            <span />
            <p>Agent Executor section</p>
            <span />
          </div>
          <div className="agent-queue-flow-executor-lanes">
            {flowMap.executorLanes.length === 0 ? (
              <div className="agent-queue-flow-executor-empty">
                No Agent Workers configured.
              </div>
            ) : (
              flowMap.executorLanes.map((lane) => (
                <ExecutorLaneBlock
                  isSelecting={isSelecting}
                  key={lane.id}
                  lane={lane}
                  onSelectTask={onSelectTask}
                  selectedTask={selectedTask}
                />
              ))
            )}
          </div>
        </section>

        <section aria-label="Queue results" className="agent-queue-flow-results">
          <div className="agent-queue-flow-section-baseline">
            <span />
            <p>Results</p>
            <span />
          </div>
          {flowMap.resultGroups.length === 0 ? (
            <div className="agent-queue-flow-result-empty">
              No completed, failed, or cancelled result blocks yet.
            </div>
          ) : (
            <div className="agent-queue-flow-result-groups">
              {flowMap.resultGroups.map((group) => (
                <section
                  className={[
                    "agent-queue-flow-result-group",
                    group.colorToken,
                  ].join(" ")}
                  data-tag-color-token={group.colorToken}
                  key={group.id}
                >
                  <div className="agent-queue-flow-group-header">
                    <span className="agent-queue-flow-tag-swatch" />
                    <p className="agent-queue-flow-group-title">
                      {group.queueTagName}
                    </p>
                  </div>
                  <div className="agent-queue-flow-block-stack">
                    {group.items.map((item) => (
                      <FlowItemBlock
                        isSelecting={isSelecting}
                        isSelected={
                          selectedTask?.queueItemId === item.queueItemId
                        }
                        item={item}
                        key={item.queueItemId}
                        onSelectTask={onSelectTask}
                      />
                    ))}
                  </div>
                </section>
              ))}
            </div>
          )}
        </section>
      </div>
    </section>
  );
}

function FlowItemBlock({
  isSelecting,
  isSelected,
  item,
  onSelectTask,
}: {
  isSelecting: boolean;
  isSelected: boolean;
  item: QueueFlowItemBlock;
  onSelectTask: (queueItemId: string) => void;
}) {
  const isBlocked = item.blockedReasons.length > 0;

  return (
    <button
      aria-current={isSelected ? "true" : undefined}
      className={[
        "agent-queue-flow-block",
        item.colorToken,
        isSelected ? "agent-queue-flow-block-selected" : null,
        isBlocked ? "agent-queue-flow-block-muted" : null,
      ]
        .filter(Boolean)
        .join(" ")}
      data-tag-color-token={item.colorToken}
      disabled={isSelecting}
      onClick={() => onSelectTask(item.queueItemId)}
      title={itemTitle(item)}
      type="button"
    >
      <span className="agent-queue-flow-block-title">{item.title}</span>
      <span className="agent-queue-flow-block-meta">
        <span>{item.shortId}</span>
        <span>{item.priorityLabel}</span>
        <span>{item.itemType}</span>
      </span>
      <span className="agent-queue-flow-block-badges">
        <Badge variant={statusBadgeVariant(item.status)}>{item.statusLabel}</Badge>
        <Badge
          className={
            item.validationStatus === "validating"
              ? "agent-queue-validation-animating"
              : undefined
          }
          variant={validationBadgeVariant(item.validationStatus)}
        >
          {item.validationStatusLabel}
        </Badge>
        {isBlocked ? <Badge variant="warning">Blocked</Badge> : null}
      </span>
      {isBlocked ? (
        <span className="agent-queue-flow-block-reason">
          {item.blockedReasons[0]}
        </span>
      ) : null}
    </button>
  );
}

function ExecutorLaneBlock({
  isSelecting,
  lane,
  onSelectTask,
  selectedTask,
}: {
  isSelecting: boolean;
  lane: QueueExecutorLane;
  onSelectTask: (queueItemId: string) => void;
  selectedTask: AgentQueueTask | null;
}) {
  const activeItemSelected =
    lane.activeItem?.queueItemId === selectedTask?.queueItemId;
  const laneClassName = [
    "agent-queue-flow-executor-block",
    lane.isWorking ? "agent-queue-flow-executor-working" : "agent-queue-flow-executor-spare",
    lane.colorToken,
    activeItemSelected ? "agent-queue-flow-block-selected" : null,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <button
      aria-current={activeItemSelected ? "true" : undefined}
      className={laneClassName}
      data-tag-color-token={lane.colorToken ?? undefined}
      disabled={isSelecting || !lane.activeItem}
      onClick={() => {
        if (lane.activeItem) {
          onSelectTask(lane.activeItem.queueItemId);
        }
      }}
      title={
        lane.activeItem
          ? `Working on ${lane.activeItem.title}. Click to select the Queue item.`
          : "Spare executor lane. This block is visual only."
      }
      type="button"
    >
      <span className="agent-queue-flow-executor-name">{lane.label}</span>
      <span className="agent-queue-flow-executor-meta">
        {lane.scopeLabel} | {lane.status}
      </span>
      <span className="agent-queue-flow-executor-task">
        {lane.activeItem ? lane.activeItem.title : "Spare executor"}
      </span>
    </button>
  );
}

function itemTitle(item: QueueFlowItemBlock) {
  return [
    item.title,
    `Queue tag: ${item.queueTagName}`,
    `Status: ${item.statusLabel}`,
    `Validation: ${item.validationStatusLabel}`,
    item.dependsOn.length > 0
      ? `Dependencies: ${item.dependsOn.join(", ")}`
      : "Dependencies: none",
    ...item.blockedReasons.map((reason) => `Blocked: ${reason}`),
  ].join("\n");
}
