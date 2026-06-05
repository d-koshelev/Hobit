import { useMemo, useState } from "react";
import { Badge } from "../design-system/Badge";
import type { AgentQueueTask } from "../workspace/types";
import {
  validationBadgeVariant,
  coordinatorStatusBadgeVariant,
  type AgentQueueDependencyState,
  type AgentWorkerSummary,
  type QueueTagSummary,
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
import { buildSampleQueueFlowMapTopology } from "./queue/sampleQueueFlowMapFixture";
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
  queueTags?: QueueTagSummary[];
  workers: AgentWorkerSummary[];
};

const CAN_SHOW_SAMPLE_TOPOLOGY = import.meta.env.DEV;

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
  queueTags = [],
  workers,
}: AgentQueueFlowMapProps) {
  const [isSampleTopologyEnabled, setIsSampleTopologyEnabled] = useState(false);
  const [selectedSampleItemId, setSelectedSampleItemId] = useState<string | null>(null);
  const flowMap = useMemo(
    () =>
      buildQueueFlowMap({
        dependencyStates,
        pausedQueueTagIds,
        queueTags,
        routingStates,
        schedulerPlan,
        tasks,
        workers,
      }),
    [dependencyStates, pausedQueueTagIds, queueTags, routingStates, schedulerPlan, tasks, workers],
  );
  const sampleTopology = useMemo(
    () => (CAN_SHOW_SAMPLE_TOPOLOGY ? buildSampleQueueFlowMapTopology() : null),
    [],
  );
  const canShowSampleTopology = CAN_SHOW_SAMPLE_TOPOLOGY;
  const isSampleTopology =
    canShowSampleTopology && isSampleTopologyEnabled && sampleTopology !== null;
  const activeFlowMap = isSampleTopology && sampleTopology ? sampleTopology.flowMap : flowMap;
  const activeEmbeddedExecutor = isSampleTopology ? sampleTopology?.embeddedExecutor : embeddedExecutor;
  const activeSchedulerPlan = isSampleTopology ? sampleTopology?.schedulerPlan : schedulerPlan;
  const activeSelectedTaskId = isSampleTopology
    ? selectedSampleItemId
    : selectedTask?.queueItemId ?? null;
  const selectedSampleItem = isSampleTopology
    ? findFlowMapItem(activeFlowMap, selectedSampleItemId)
    : null;
  const flowItemCount =
    isSampleTopology && sampleTopology ? sampleTopology.taskCount : tasks.length;

  function selectFlowItem(queueItemId: string) {
    if (isSampleTopology) {
      setSelectedSampleItemId(queueItemId);
      return;
    }

    onSelectTask(queueItemId);
  }

  return (
    <section aria-label="Agent Queue flow map" className="agent-queue-flow-map-pane">
      <div className="agent-queue-pane-header">
        <div>
          <p className="agent-queue-pane-title">Flow map</p>
          <p className="agent-queue-pane-subtitle">
            {isSampleTopology
              ? `${flowItemCount.toString()} sample blocks - Flow Map only`
              : tasks.length === 1
                ? "1 work item"
                : `${tasks.length.toString()} work items`}
          </p>
        </div>
        <div className="agent-queue-flow-header-actions">
          <Badge variant="neutral">visual only</Badge>
          {canShowSampleTopology ? (
            <button
              aria-pressed={isSampleTopology}
              className={[
                "agent-queue-flow-sample-toggle",
                isSampleTopology
                  ? "agent-queue-flow-sample-toggle-active"
                  : null,
              ]
                .filter(Boolean)
                .join(" ")}
              onClick={() => setIsSampleTopologyEnabled((current) => !current)}
              title="Visual sample only. Does not create Queue items, write storage, or start work."
              type="button"
            >
              <span>Sample topology</span>
              <span>visual sample</span>
            </button>
          ) : null}
        </div>
      </div>
      {isSampleTopology ? (
        <div className="agent-queue-flow-sample-note" role="note">
          <span>Sample topology active.</span>
          <span>Non-persistent visual-test data; real Queue state is unchanged.</span>
          {selectedSampleItem ? (
            <span>Sample selected: {selectedSampleItem.title}</span>
          ) : null}
        </div>
      ) : null}

      <div className="agent-queue-flow-map-scroll">
        <div
          className={[
            "agent-queue-flow-canvas",
            isSampleTopology ? "agent-queue-flow-canvas-sample" : null,
          ]
            .filter(Boolean)
            .join(" ")}
          data-testid="queue-flow-topology-canvas"
        >
          <QueueFlowSectionHeading label="Work intake topology" />

          <div
            aria-label="Queue intake topology"
            className="agent-queue-flow-intake-region"
          >
            <QueueFlowTopLane
              ariaLabel="Work Queue / Backlog"
              columns={activeFlowMap.workColumns}
              emptyText="Backlog clear"
              isSelecting={isSelecting}
              label="Work Queue / Backlog"
              onSelectTask={selectFlowItem}
              selectedTaskId={activeSelectedTaskId}
              useSampleTopology={isSampleTopology}
            />
            <QueueFlowTopLane
              ariaLabel="Waiting work"
              columns={activeFlowMap.waitingColumns}
              emptyText="No waiting work"
              isSelecting={isSelecting}
              label="Waiting / Not runnable"
              onSelectTask={selectFlowItem}
              selectedTaskId={activeSelectedTaskId}
              useSampleTopology={isSampleTopology}
            />
            <QueueFlowTopLane
              ariaLabel="Blocked work"
              columns={activeFlowMap.blockedColumns}
              emptyText="No blocked work"
              isSelecting={isSelecting}
              label="Blocked work"
              onSelectTask={selectFlowItem}
              selectedTaskId={activeSelectedTaskId}
              useSampleTopology={isSampleTopology}
            />
          </div>

          <QueueFlowDependencyBars
            barriers={activeFlowMap.columns.flatMap((column) => column.barriersAfter)}
          />

          <QueueFlowExecutorSection
            embeddedExecutor={activeEmbeddedExecutor}
            lanes={activeFlowMap.executorLanes}
            schedulerPlan={activeSchedulerPlan}
            isSelecting={isSelecting}
            onSelectTask={selectFlowItem}
            selectedTaskId={activeSelectedTaskId}
            useSampleTopology={isSampleTopology}
          />

          <QueueFlowResultsSection
            groups={activeFlowMap.resultGroups}
            isSelecting={isSelecting}
            onSelectTask={selectFlowItem}
            selectedTaskId={activeSelectedTaskId}
            useSampleTopology={isSampleTopology}
          />
        </div>
      </div>
    </section>
  );
}

function QueueFlowTopLane({
  ariaLabel,
  columns,
  emptyText,
  isSelecting,
  label,
  onSelectTask,
  selectedTaskId,
  useSampleTopology,
}: {
  ariaLabel: string;
  columns: QueueFlowColumn[];
  emptyText: string;
  isSelecting: boolean;
  label: string;
  onSelectTask: (queueItemId: string) => void;
  selectedTaskId: string | null;
  useSampleTopology: boolean;
}) {
  return (
    <section
      aria-label={ariaLabel}
      className="agent-queue-flow-zone agent-queue-flow-top-lane"
    >
      <QueueFlowLaneLabel label={label} />
      {columns.length === 0 ? (
        <QueueFlowZoneEmpty text={emptyText} />
      ) : (
        <QueueFlowLayers
          columns={columns}
          isSelecting={isSelecting}
          onSelectTask={onSelectTask}
          selectedTaskId={selectedTaskId}
          useSampleTopology={useSampleTopology}
        />
      )}
    </section>
  );
}

function QueueFlowLayers({
  columns,
  isSelecting,
  onSelectTask,
  selectedTaskId,
  useSampleTopology,
}: {
  columns: QueueFlowColumn[];
  isSelecting: boolean;
  onSelectTask: (queueItemId: string) => void;
  selectedTaskId: string | null;
  useSampleTopology: boolean;
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
          useSampleTopology={useSampleTopology}
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
  useSampleTopology,
}: {
  column: QueueFlowColumn;
  isSelecting: boolean;
  onSelectTask: (queueItemId: string) => void;
  selectedTaskId: string | null;
  useSampleTopology: boolean;
}) {
  return (
    <div className="agent-queue-flow-layer" role="listitem">
      <div className="agent-queue-flow-layer-header">
        <p className="agent-queue-flow-layer-title">{column.label}</p>
        <span className="agent-queue-flow-layer-count">
          {flowLayerItemCount(column)} blocks
        </span>
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
            useSampleTopology={useSampleTopology}
          />
        ))}
      </div>
    </div>
  );
}

function QueueFlowTagGroup({
  className,
  group,
  isSelecting,
  onSelectTask,
  selectedTaskId,
  useSampleTopology = false,
}: {
  className: "agent-queue-flow-group" | "agent-queue-flow-result-group";
  group: QueueFlowGroup | QueueResultGroup;
  isSelecting: boolean;
  onSelectTask: (queueItemId: string) => void;
  selectedTaskId: string | null;
  useSampleTopology?: boolean;
}) {
  const isDenseGroup =
    useSampleTopology &&
    group.queueTagId.startsWith("dense-lane-") &&
    group.items.length === 15;

  return (
    <section
      className={[
        className,
        group.colorToken,
        isDenseGroup ? "agent-queue-flow-group-dense" : null,
      ]
        .filter(Boolean)
        .join(" ")}
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
            variant={useSampleTopology ? "compact" : "default"}
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
      role="note"
      title={`${barrier.blockingItemIds.length.toString()} blockers, ${barrier.blockedItemIds.length.toString()} dependent items`}
    >
      <span className="agent-queue-flow-barrier-body">
        <span className="agent-queue-flow-barrier-label">{barrier.label}</span>
        <span className="agent-queue-flow-barrier-copy">
          {barrier.blockingSummary} blocks {barrier.blockedSummary}
        </span>
      </span>
    </div>
  );
}

function QueueFlowDependencyBars({
  barriers,
}: {
  barriers: QueueFlowBarrierModel[];
}) {
  if (barriers.length === 0) {
    return null;
  }

  return (
    <div className="agent-queue-flow-dependency-bars" aria-label="Dependency relationships">
      <p className="agent-queue-flow-dependency-heading">Dependency blockers</p>
      {barriers.map((barrier) => (
        <QueueFlowBarrier barrier={barrier} key={barrier.id} />
      ))}
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
  useSampleTopology,
}: {
  embeddedExecutor?: AgentQueueEmbeddedExecutorSectionModel;
  lanes: QueueExecutorLane[];
  schedulerPlan?: AgentQueueSchedulerPlan;
  isSelecting: boolean;
  onSelectTask: (queueItemId: string) => void;
  selectedTaskId: string | null;
  useSampleTopology: boolean;
}) {
  return (
    <section
      aria-label="Local executor section / Working executors"
      className="agent-queue-flow-zone agent-queue-flow-executors"
    >
      <div className="agent-queue-flow-zone-header">
        <QueueFlowSectionHeading label="Local executor section / Working executors" />
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
          {compactGlobalExecutionNote(schedulerPlan.globalState.code)}
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
              useSampleTopology={useSampleTopology}
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
  useSampleTopology,
}: {
  groups: QueueResultGroup[];
  isSelecting: boolean;
  onSelectTask: (queueItemId: string) => void;
  selectedTaskId: string | null;
  useSampleTopology: boolean;
}) {
  return (
    <section
      aria-label="Results / Reports / Completed work"
      className="agent-queue-flow-zone agent-queue-flow-results"
    >
      <QueueFlowSectionHeading label="Results / Reports / Completed work" />
      {groups.length === 0 ? (
        <div className="agent-queue-flow-result-empty">
          <span>No results yet</span>
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
              useSampleTopology={useSampleTopology}
            />
          ))}
        </div>
      )}
    </section>
  );
}

function QueueFlowSectionHeading({ label }: { label: string }) {
  return (
    <div className="agent-queue-flow-section-heading">
      <p>{label}</p>
    </div>
  );
}

function QueueFlowLaneLabel({ label }: { label: string }) {
  return (
    <div className="agent-queue-flow-lane-label">
      <p>{label}</p>
    </div>
  );
}

function QueueFlowZoneEmpty({ text }: { text: string }) {
  return (
    <div className="agent-queue-flow-zone-empty">
      <span className="agent-queue-flow-zone-empty-node" />
      <span>{text}</span>
    </div>
  );
}

function FlowItemBlock({
  isSelecting,
  isSelected,
  item,
  onSelectTask,
  variant = "default",
}: {
  isSelecting: boolean;
  isSelected: boolean;
  item: QueueFlowItemBlock;
  onSelectTask: (queueItemId: string) => void;
  variant?: "compact" | "default";
}) {
  const isBlocked = item.primaryZone === "blocked";
  const hasReason = item.blockedReasons.length > 0;
  const isCompact = variant === "compact";

  return (
    <button
      aria-label={isCompact ? itemTitle(item) : undefined}
      aria-current={isSelected ? "true" : undefined}
      className={[
        "agent-queue-flow-block",
        item.colorToken,
        isCompact ? "agent-queue-flow-block-compact" : null,
        isSelected ? "agent-queue-flow-block-selected" : null,
        isBlocked ? "agent-queue-flow-block-muted" : null,
      ]
        .filter(Boolean)
        .join(" ")}
      data-tag-color-token={item.colorToken}
      data-queue-item-id={item.queueItemId}
      disabled={isSelecting}
      onClick={() => onSelectTask(item.queueItemId)}
      title={itemTitle(item)}
      type="button"
    >
      <span className="agent-queue-flow-block-heading">
        <span className="agent-queue-flow-tag-swatch agent-queue-flow-block-swatch" />
        <span className="agent-queue-flow-block-title">{item.title}</span>
      </span>
      {isCompact ? null : (
        <span className="agent-queue-flow-block-badges">
          <Badge variant={item.statusBadgeVariant}>{item.statusLabel}</Badge>
          <Badge variant="neutral">
            {item.assignedWorkerLabel ?? item.executorInfoLabel}
          </Badge>
          {item.hasWorkerReport ? (
            <Badge variant="info">Report ready</Badge>
          ) : null}
          {item.coordinatorStatus !== "not_reported" ? (
            <Badge variant={coordinatorStatusBadgeVariant(item.coordinatorStatus)}>
              {item.coordinatorStatusLabel}
            </Badge>
          ) : null}
          {item.hasLinkedDiffReview ? (
            <Badge variant="warning">Diff review</Badge>
          ) : null}
          {item.validationStatus !== "not_started" ? (
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
          ) : null}
          {isBlocked ? <Badge variant="warning">Blocked</Badge> : null}
        </span>
      )}
      {hasReason && !isCompact ? (
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
  useSampleTopology,
}: {
  isSelecting: boolean;
  lane: QueueExecutorLane;
  onSelectTask: (queueItemId: string) => void;
  selectedTaskId: string | null;
  useSampleTopology: boolean;
}) {
  const activeItemSelected = lane.activeItem?.queueItemId === selectedTaskId;
  const laneClassName = [
    "agent-queue-flow-executor-block",
    lane.isWorking ? "agent-queue-flow-executor-working" : "agent-queue-flow-executor-spare",
    lane.colorToken,
    useSampleTopology ? "agent-queue-flow-executor-block-sample" : null,
    activeItemSelected ? "agent-queue-flow-block-selected" : null,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <button
      aria-current={activeItemSelected ? "true" : undefined}
      className={laneClassName}
      data-tag-color-token={lane.colorToken ?? undefined}
      data-queue-item-id={lane.activeItem?.queueItemId}
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
      {useSampleTopology ? (
        <>
          <span className="agent-queue-flow-executor-name">{lane.label}</span>
          <span className="agent-queue-flow-executor-task">
            {lane.activeItem ? lane.activeItem.title : "Idle"}
          </span>
        </>
      ) : (
        <>
          <span className="agent-queue-flow-executor-name">{lane.label}</span>
          <span className="agent-queue-flow-executor-meta">
            <span className="agent-queue-flow-executor-state">
              {lane.isWorking ? "Working" : "Spare executor"}
            </span>
            <span>{lane.scopeLabel}</span>
          </span>
          {lane.activeItem ? (
            <span className="agent-queue-flow-executor-badges">
              <Badge variant={lane.activeItem.statusBadgeVariant}>
                {lane.activeItem.statusLabel}
              </Badge>
              {lane.activeItem.validationStatus !== "not_started" ? (
                <Badge
                  className={
                    lane.activeItem.validationStatus === "validating"
                      ? "agent-queue-validation-animating"
                      : undefined
                  }
                  variant={validationBadgeVariant(lane.activeItem.validationStatus)}
                >
                  {lane.activeItem.validationStatusLabel}
                </Badge>
              ) : null}
            </span>
          ) : null}
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
        </>
      )}
    </button>
  );
}

function flowLayerItemCount(column: QueueFlowColumn) {
  return column.groups.reduce((count, group) => count + group.items.length, 0);
}

function findFlowMapItem(flowMap: ReturnType<typeof buildQueueFlowMap>, queueItemId: string | null) {
  if (!queueItemId) {
    return null;
  }

  const items = [
    ...flowMap.columns.flatMap((column) =>
      column.groups.flatMap((group) => group.items),
    ),
    ...flowMap.executorLanes.flatMap((lane) =>
      lane.activeItem ? [lane.activeItem] : [],
    ),
    ...flowMap.resultGroups.flatMap((group) => group.items),
  ];

  return items.find((item) => item.queueItemId === queueItemId) ?? null;
}

function compactGlobalExecutionNote(code: AgentQueueSchedulerPlan["globalState"]["code"]) {
  return code === "stop_kill_requested"
    ? "Stop/kill review requested."
    : "New starts paused.";
}

function itemTitle(item: QueueFlowItemBlock) {
  return [
    item.title,
    `Queue tag: ${item.queueTagName}`,
    `Status: ${item.statusLabel}`,
    `Validation: ${item.validationStatusLabel}`,
    `Executor: ${item.executorInfoLabel}`,
    `Plan: ${item.planStatusLabel}`,
    item.hasWorkerReport ? "Worker report: received / not final" : null,
    `Coordinator: ${item.coordinatorStatusLabel}`,
    item.hasLinkedDiffReview ? "Diff review: requested" : null,
    item.sourceItemLabel ? `Source item: ${item.sourceItemLabel}` : null,
    item.reviewTargetSummary ? `Review target: ${item.reviewTargetSummary}` : null,
    item.assignedWorkerLabel ? `Assigned worker: ${item.assignedWorkerLabel}` : null,
    item.dependsOn.length > 0
      ? `Dependencies: ${item.dependsOn.join(", ")}`
      : "Dependencies: none",
    ...item.blockedReasons.map((reason) => `Blocked: ${reason}`),
  ]
    .filter(Boolean)
    .join("\n");
}
