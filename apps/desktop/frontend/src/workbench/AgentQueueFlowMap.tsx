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
  type QueueFlowBarrier as QueueFlowBarrierModel,
  type QueueFlowColumn,
  type QueueFlowGroup,
  type QueueExecutorLane,
  type QueueFlowItemBlock,
  type QueueResultGroup,
} from "./queue/agentQueueFlowMapModel";
import type { AgentQueueAssignedWorkerRoutingState } from "./queue/agentQueueRoutingModel";
import type {
  AgentQueueEmbeddedExecutorSectionModel,
  AgentQueueSchedulerPlan,
} from "./queue/agentQueueSchedulerModel";

type AgentQueueFlowMapProps = {
  dependencyStates: ReadonlyMap<string, AgentQueueDependencyState>;
  embeddedExecutor?: AgentQueueEmbeddedExecutorSectionModel;
  isSelecting: boolean;
  onSelectTask: (queueItemId: string) => void;
  pausedQueueTagIds: ReadonlySet<string>;
  routingStates: ReadonlyMap<string, AgentQueueAssignedWorkerRoutingState>;
  schedulerPlan?: AgentQueueSchedulerPlan;
  selectedTask: AgentQueueTask | null;
  tasks: AgentQueueTask[];
  workers: AgentWorkerSummary[];
};

export function AgentQueueFlowMap({
  dependencyStates,
  embeddedExecutor,
  isSelecting,
  onSelectTask,
  pausedQueueTagIds,
  routingStates,
  schedulerPlan,
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
        schedulerPlan,
        tasks,
        workers,
      }),
    [dependencyStates, pausedQueueTagIds, routingStates, schedulerPlan, tasks, workers],
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
        <section
          aria-label="Work queue and blocked work"
          className="agent-queue-flow-zone agent-queue-flow-work-zone"
        >
          <QueueFlowSectionBaseline label="Work queue / blocked work" />
          {flowMap.columns.length === 0 ? (
            <div className="agent-queue-empty-state agent-queue-empty-state-compact">
              <p className="empty-state-title">No active queue flow.</p>
              <p className="empty-state-text">
                Active queued, ready, running, or review-needed items appear here.
              </p>
            </div>
          ) : (
            <QueueFlowLayers
              columns={flowMap.columns}
              isSelecting={isSelecting}
              onSelectTask={onSelectTask}
              selectedTaskId={selectedTask?.queueItemId ?? null}
            />
          )}
        </section>

        <QueueFlowExecutorSection
          embeddedExecutor={embeddedExecutor}
          lanes={flowMap.executorLanes}
          schedulerPlan={schedulerPlan}
          isSelecting={isSelecting}
          onSelectTask={onSelectTask}
          selectedTaskId={selectedTask?.queueItemId ?? null}
        />

        <QueueFlowResultsSection
          groups={flowMap.resultGroups}
          isSelecting={isSelecting}
          onSelectTask={onSelectTask}
          selectedTaskId={selectedTask?.queueItemId ?? null}
        />
      </div>
    </section>
  );
}

function QueueFlowLayers({
  columns,
  isSelecting,
  onSelectTask,
  selectedTaskId,
}: {
  columns: QueueFlowColumn[];
  isSelecting: boolean;
  onSelectTask: (queueItemId: string) => void;
  selectedTaskId: string | null;
}) {
  return (
    <div className="agent-queue-flow-layers" role="list">
      {columns.map((column) => (
        <QueueFlowLayer
          column={column}
          isSelecting={isSelecting}
          key={column.id}
          onSelectTask={onSelectTask}
          selectedTaskId={selectedTaskId}
        />
      ))}
    </div>
  );
}

function QueueFlowLayer({
  column,
  isSelecting,
  onSelectTask,
  selectedTaskId,
}: {
  column: QueueFlowColumn;
  isSelecting: boolean;
  onSelectTask: (queueItemId: string) => void;
  selectedTaskId: string | null;
}) {
  return (
    <div className="agent-queue-flow-layer" role="listitem">
      <div className="agent-queue-flow-layer-header">
        <p className="agent-queue-flow-layer-title">{column.label}</p>
        <Badge variant="neutral">{flowLayerItemCount(column)} items</Badge>
      </div>
      <div className="agent-queue-flow-groups">
        {column.groups.map((group) => (
          <QueueFlowTagGroup
            className="agent-queue-flow-group"
            group={group}
            isSelecting={isSelecting}
            key={group.id}
            onSelectTask={onSelectTask}
            selectedTaskId={selectedTaskId}
          />
        ))}
      </div>
      {column.barriersAfter.map((barrier) => (
        <QueueFlowBarrier barrier={barrier} key={barrier.id} />
      ))}
    </div>
  );
}

function QueueFlowTagGroup({
  className,
  group,
  isSelecting,
  onSelectTask,
  selectedTaskId,
}: {
  className: "agent-queue-flow-group" | "agent-queue-flow-result-group";
  group: QueueFlowGroup | QueueResultGroup;
  isSelecting: boolean;
  onSelectTask: (queueItemId: string) => void;
  selectedTaskId: string | null;
}) {
  return (
    <section
      className={[className, group.colorToken].join(" ")}
      data-tag-color-token={group.colorToken}
    >
      <div className="agent-queue-flow-group-header">
        <span className="agent-queue-flow-tag-swatch" />
        <p className="agent-queue-flow-group-title">{group.queueTagName}</p>
      </div>
      <div className="agent-queue-flow-block-stack">
        {group.items.map((item) => (
          <FlowItemBlock
            isSelecting={isSelecting}
            isSelected={selectedTaskId === item.queueItemId}
            item={item}
            key={item.queueItemId}
            onSelectTask={onSelectTask}
          />
        ))}
      </div>
    </section>
  );
}

function QueueFlowBarrier({
  barrier,
}: {
  barrier: QueueFlowBarrierModel;
}) {
  return (
    <div
      className="agent-queue-flow-barrier"
      role="separator"
      title={`${barrier.blockingItemIds.length.toString()} blockers, ${barrier.blockedItemIds.length.toString()} dependent items`}
    >
      <span className="agent-queue-flow-barrier-line" />
      <span className="agent-queue-flow-barrier-body">
        <span className="agent-queue-flow-barrier-label">{barrier.label}</span>
        <span className="agent-queue-flow-barrier-copy">
          {barrier.blockingSummary} blocks {barrier.blockedSummary}
        </span>
      </span>
      <span className="agent-queue-flow-barrier-line" />
    </div>
  );
}

function QueueFlowExecutorSection({
  embeddedExecutor,
  lanes,
  schedulerPlan,
  isSelecting,
  onSelectTask,
  selectedTaskId,
}: {
  embeddedExecutor?: AgentQueueEmbeddedExecutorSectionModel;
  lanes: QueueExecutorLane[];
  schedulerPlan?: AgentQueueSchedulerPlan;
  isSelecting: boolean;
  onSelectTask: (queueItemId: string) => void;
  selectedTaskId: string | null;
}) {
  return (
    <section
      aria-label="Agent Executor section"
      className="agent-queue-flow-zone agent-queue-flow-executors"
    >
      <div className="agent-queue-flow-zone-header">
        <QueueFlowSectionBaseline label="Agent Executor section" />
        {schedulerPlan ? (
          <Badge
            variant={
              schedulerPlan.globalState.code === "started"
                ? "info"
                : schedulerPlan.globalState.code === "stop_kill_requested"
                  ? "warning"
                  : "neutral"
            }
          >
            {schedulerPlan.globalState.label}
          </Badge>
        ) : null}
      </div>
      {schedulerPlan && !schedulerPlan.globalState.allowsScheduling ? (
        <p className="agent-queue-flow-global-note">
          {schedulerPlan.globalState.explanation}
        </p>
      ) : null}
      {embeddedExecutor ? (
        <dl className="agent-queue-flow-executor-facts">
          <div>
            <dt>Max executors</dt>
            <dd>{embeddedExecutor.maxExecutors}</dd>
          </div>
          <div>
            <dt>Spare</dt>
            <dd>{embeddedExecutor.spareExecutorSlots}</dd>
          </div>
          <div>
            <dt>Working</dt>
            <dd>{embeddedExecutor.workingExecutorSlots}</dd>
          </div>
          <div>
            <dt>Capacity</dt>
            <dd>{embeddedExecutor.capacityRecommendation.label}</dd>
          </div>
        </dl>
      ) : null}
      <div className="agent-queue-flow-executor-lanes">
        {lanes.length === 0 ? (
          <div className="agent-queue-flow-executor-empty">
            No Agent Workers configured.
          </div>
        ) : (
          lanes.map((lane) => (
            <ExecutorLaneBlock
              isSelecting={isSelecting}
              key={lane.id}
              lane={lane}
              onSelectTask={onSelectTask}
              selectedTaskId={selectedTaskId}
            />
          ))
        )}
      </div>
    </section>
  );
}

function QueueFlowResultsSection({
  groups,
  isSelecting,
  onSelectTask,
  selectedTaskId,
}: {
  groups: QueueResultGroup[];
  isSelecting: boolean;
  onSelectTask: (queueItemId: string) => void;
  selectedTaskId: string | null;
}) {
  return (
    <section
      aria-label="Queue results"
      className="agent-queue-flow-zone agent-queue-flow-results"
    >
      <QueueFlowSectionBaseline label="Results" />
      {groups.length === 0 ? (
        <div className="agent-queue-flow-result-empty">
          No completed, failed, or cancelled result blocks yet.
        </div>
      ) : (
        <div className="agent-queue-flow-result-groups">
          {groups.map((group) => (
            <QueueFlowTagGroup
              className="agent-queue-flow-result-group"
              group={group}
              isSelecting={isSelecting}
              key={group.id}
              onSelectTask={onSelectTask}
              selectedTaskId={selectedTaskId}
            />
          ))}
        </div>
      )}
    </section>
  );
}

function QueueFlowSectionBaseline({ label }: { label: string }) {
  return (
    <div className="agent-queue-flow-section-baseline">
      <span />
      <p>{label}</p>
      <span />
    </div>
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
      <span className="agent-queue-flow-block-heading">
        <span className="agent-queue-flow-tag-swatch agent-queue-flow-block-swatch" />
        <span className="agent-queue-flow-block-title">{item.title}</span>
      </span>
      <span
        className={[
          "agent-queue-executor-info-box",
          `agent-queue-executor-info-${item.executorInfoTone}`,
        ].join(" ")}
        title={item.executorInfoDetail}
      >
        <span>Executor</span>
        <strong>{item.executorInfoLabel}</strong>
      </span>
      <span className="agent-queue-flow-block-meta">
        <span>{item.shortId}</span>
        <span>{item.itemType}</span>
        <span>{item.priorityLabel}</span>
        <span>{item.planStatusLabel}</span>
        {item.assignedWorkerLabel ? <span>{item.assignedWorkerLabel}</span> : null}
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
  selectedTaskId,
}: {
  isSelecting: boolean;
  lane: QueueExecutorLane;
  onSelectTask: (queueItemId: string) => void;
  selectedTaskId: string | null;
}) {
  const activeItemSelected = lane.activeItem?.queueItemId === selectedTaskId;
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
          : lane.nextItemTitle
            ? `Spare executor lane. Dry-run next: ${lane.nextItemTitle}.`
            : `Spare executor lane. ${lane.idleReason ?? "No eligible item"}.`
      }
      type="button"
    >
      <span className="agent-queue-flow-executor-name">{lane.label}</span>
      <span className="agent-queue-flow-executor-meta">
        <span className="agent-queue-flow-executor-state">
          {lane.isWorking ? "Working" : "Spare executor"}
        </span>
        <span>{lane.scopeLabel}</span>
      </span>
      <span className="agent-queue-flow-executor-task">
        {lane.activeItem
          ? lane.activeItem.title
          : lane.nextItemTitle
            ? `Next: ${lane.nextItemTitle}`
            : lane.idleReason ?? "No eligible item"}
      </span>
      {lane.reviewMessage ? (
        <span className="agent-queue-flow-executor-review">
          {lane.reviewMessage}
        </span>
      ) : null}
    </button>
  );
}

function flowLayerItemCount(column: QueueFlowColumn) {
  return column.groups.reduce((count, group) => count + group.items.length, 0);
}

function itemTitle(item: QueueFlowItemBlock) {
  return [
    item.title,
    `Queue tag: ${item.queueTagName}`,
    `Status: ${item.statusLabel}`,
    `Validation: ${item.validationStatusLabel}`,
    `Executor: ${item.executorInfoLabel}`,
    `Plan: ${item.planStatusLabel}`,
    item.assignedWorkerLabel ? `Assigned worker: ${item.assignedWorkerLabel}` : null,
    item.dependsOn.length > 0
      ? `Dependencies: ${item.dependsOn.join(", ")}`
      : "Dependencies: none",
    ...item.blockedReasons.map((reason) => `Blocked: ${reason}`),
  ]
    .filter(Boolean)
    .join("\n");
}
