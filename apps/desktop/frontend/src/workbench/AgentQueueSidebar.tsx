import { useState } from "react";
import { Badge } from "../design-system/Badge";
import { Button } from "../design-system/Button";
import {
  queueGlobalExecutionStateDescription,
  queueGlobalExecutionStateLabel,
} from "./agentQueueTaskUiModel";
import { executionPlanStatusLabel } from "./queue/agentQueueExecutionPlanModel";
import type { AgentQueueFoundationController } from "./queue/useAgentQueueController";

type AgentQueueSidebarProps = {
  foundation: AgentQueueFoundationController;
};

export function AgentQueueSidebar({ foundation }: AgentQueueSidebarProps) {
  const globalExecutionState = foundation.globalExecutionState;
  const [newTagName, setNewTagName] = useState("");
  const [renamingTagId, setRenamingTagId] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState("");
  const [deleteConfirmTagId, setDeleteConfirmTagId] = useState<string | null>(
    null,
  );
  const [renamingWorkerId, setRenamingWorkerId] = useState<string | null>(null);
  const [workerRenameDraft, setWorkerRenameDraft] = useState("");
  const [deleteConfirmWorkerId, setDeleteConfirmWorkerId] = useState<
    string | null
  >(null);

  const enabledWorkerCount = foundation.workers.filter(
    (worker) => worker.enabled,
  ).length;
  const runningWorkerCount = foundation.workers.filter(
    (worker) => worker.status === "running",
  ).length;
  const pausedTagCount = foundation.queueTags.filter(
    (tag) => tag.status === "paused",
  ).length;

  function createTag() {
    if (foundation.onCreateQueueTag(newTagName)) {
      setNewTagName("");
      setDeleteConfirmTagId(null);
    }
  }

  function startRename(queueTagId: string, queueTagName: string) {
    setRenamingTagId(queueTagId);
    setRenameDraft(queueTagName);
    setDeleteConfirmTagId(null);
  }

  async function confirmRename(queueTagId: string) {
    if (await foundation.onRenameQueueTag(queueTagId, renameDraft)) {
      setRenamingTagId(null);
      setRenameDraft("");
    }
  }

  function requestDelete(queueTagId: string, isEmpty: boolean) {
    if (!isEmpty) {
      foundation.onDeleteQueueTag(queueTagId);
      return;
    }

    setDeleteConfirmTagId(queueTagId);
    setRenamingTagId(null);
  }

  return (
    <aside aria-label="Queue and workers" className="agent-queue-sidebar">
      <QueueStateSection foundation={foundation} />

      <ExecutorCapacitySection foundation={foundation} />

      <section className="agent-queue-sidebar-section">
        <div className="agent-queue-section-header">
          <p className="agent-queue-section-title">Queue tags</p>
          <Badge variant={pausedTagCount > 0 ? "warning" : "neutral"}>
            {foundation.queueTags.length.toString()} tags
          </Badge>
        </div>
        <p className="agent-queue-sidebar-row-meta agent-queue-compact-summary">
          {pausedTagCount > 0
            ? `${pausedTagCount.toString()} paused`
            : "Tags ready"}
        </p>
        <div className="agent-queue-sidebar-list">
          {foundation.queueTags.map((tag) => (
            <div
              className="agent-queue-sidebar-row agent-queue-sidebar-row-compact"
              key={tag.queueTagId}
            >
              <div>
                {renamingTagId === tag.queueTagId ? (
                  <input
                    aria-label={`Rename ${tag.queueTagName}`}
                    className="input agent-queue-tag-management-input"
                    onChange={(event) =>
                      setRenameDraft(event.currentTarget.value)
                    }
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        void confirmRename(tag.queueTagId);
                      }
                    }}
                    value={renameDraft}
                  />
                ) : (
                  <p className="agent-queue-sidebar-row-title">
                    {tag.queueTagName}
                  </p>
                )}
                <p className="agent-queue-sidebar-row-meta">
                  {tag.taskCount} items, {tag.runningCount} running
                </p>
                <p className="agent-queue-sidebar-row-meta">
                  Val {tag.validatingCount}, review {tag.needsReviewCount}
                  {tag.failedValidationCount > 0
                    ? `, ${tag.failedValidationCount.toString()} failed`
                    : ""}
                </p>
                {tag.coordinatorReviewCount > 0 ? (
                  <p className="agent-queue-sidebar-row-meta">
                    {tag.coordinatorReviewCount} coord review
                  </p>
                ) : null}
                {tag.pauseReason ? (
                  <p className="agent-queue-sidebar-row-meta">
                    Paused by {pauseReasonLabel(tag.pauseReason)}
                  </p>
                ) : null}
              </div>
              <div className="agent-queue-sidebar-row-actions">
                <Badge variant={tag.status === "paused" ? "warning" : "success"}>
                  {tag.status}
                </Badge>
                {tag.needsCoordinatorReview ? (
                  <Badge variant="warning">review</Badge>
                ) : null}
                {tag.status === "paused" ? (
                  <Button
                    onClick={() => foundation.onResumeQueueTag(tag.queueTagId)}
                    variant="ghost"
                  >
                    Resume tag
                  </Button>
                ) : (
                  <Button
                    onClick={() => foundation.onPauseQueueTag(tag.queueTagId)}
                    variant="ghost"
                  >
                    Pause
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
        <details className="agent-queue-details agent-queue-rail-details agent-queue-management-details">
          <summary>Manage tags</summary>
          <div className="agent-queue-tag-create-row">
            <input
              aria-label="New queue tag name"
              className="input agent-queue-tag-management-input"
              onChange={(event) => setNewTagName(event.currentTarget.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  createTag();
                }
              }}
              placeholder="New tag"
              value={newTagName}
            />
            <Button onClick={createTag} variant="secondary">
              Add tag
            </Button>
          </div>
          {foundation.tagManagementError ? (
            <p
              className="agent-queue-message agent-queue-message-error"
              role="alert"
            >
              {foundation.tagManagementError}
            </p>
          ) : foundation.tagManagementMessage ? (
            <p className="agent-queue-message">
              {foundation.tagManagementMessage}
            </p>
          ) : null}
          <div className="agent-queue-sidebar-list">
            {foundation.queueTags.map((tag) => (
              <div className="agent-queue-management-row" key={tag.queueTagId}>
                <p className="agent-queue-sidebar-row-title">
                  {tag.queueTagName}
                </p>
                <div className="agent-queue-sidebar-row-actions">
                  {renamingTagId === tag.queueTagId ? (
                    <>
                      <Button
                        onClick={() => void confirmRename(tag.queueTagId)}
                        variant="secondary"
                      >
                        Save
                      </Button>
                      <Button
                        onClick={() => {
                          setRenamingTagId(null);
                          setRenameDraft("");
                        }}
                        variant="ghost"
                      >
                        Cancel
                      </Button>
                    </>
                  ) : (
                    <Button
                      onClick={() =>
                        startRename(tag.queueTagId, tag.queueTagName)
                      }
                      variant="ghost"
                    >
                      Rename
                    </Button>
                  )}
                  {deleteConfirmTagId === tag.queueTagId ? (
                    <>
                      <Button
                        className="agent-queue-delete-button"
                        onClick={() => {
                          if (foundation.onDeleteQueueTag(tag.queueTagId)) {
                            setDeleteConfirmTagId(null);
                          }
                        }}
                        variant="ghost"
                      >
                        Confirm delete
                      </Button>
                      <Button
                        onClick={() => setDeleteConfirmTagId(null)}
                        variant="ghost"
                      >
                        Cancel
                      </Button>
                    </>
                  ) : (
                    <Button
                      className="agent-queue-delete-button"
                      onClick={() =>
                        requestDelete(tag.queueTagId, tag.taskCount === 0)
                      }
                      title={
                        tag.taskCount === 0
                          ? "Delete this empty queue tag."
                          : "Reassign items before deleting this queue tag."
                      }
                      variant="ghost"
                    >
                      Delete
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </details>
      </section>

      <section className="agent-queue-sidebar-section">
        <div className="agent-queue-section-header">
          <p className="agent-queue-section-title">Workers</p>
          <Badge variant={runningWorkerCount > 0 ? "info" : "neutral"}>
            {foundation.workers.length.toString()} total
          </Badge>
        </div>
        <p className="agent-queue-sidebar-row-meta agent-queue-compact-summary">
          {enabledWorkerCount.toString()} enabled,{" "}
          {runningWorkerCount.toString()} working
        </p>
        <div className="agent-queue-sidebar-list">
          {foundation.workers.length === 0 ? (
            <p className="agent-queue-run-note">No workers.</p>
          ) : (
            foundation.workers.map((worker) => (
              <WorkerRow
                foundation={foundation}
                globalExecutionState={globalExecutionState}
                key={worker.workerId}
                onDeleteConfirmWorkerIdChange={setDeleteConfirmWorkerId}
                onRenamingWorkerIdChange={setRenamingWorkerId}
                onWorkerRenameDraftChange={setWorkerRenameDraft}
                worker={worker}
                deleteConfirmWorkerId={deleteConfirmWorkerId}
                renamingWorkerId={renamingWorkerId}
                workerRenameDraft={workerRenameDraft}
              />
            ))
          )}
        </div>
        <details className="agent-queue-details agent-queue-rail-details agent-queue-management-details">
          <summary>Worker controls</summary>
          <Button
            disabled={
              foundation.embeddedExecutor.currentConfiguredWorkerCount >=
              foundation.embeddedExecutor.maxExecutors
            }
            onClick={() => foundation.onCreateWorker()}
            title={
              foundation.embeddedExecutor.currentConfiguredWorkerCount >=
              foundation.embeddedExecutor.maxExecutors
                ? "Max executors reached."
                : "Add a configured worker slot without starting runtime."
            }
            variant="secondary"
          >
            Add worker
          </Button>
        </details>
      </section>

      <section className="agent-queue-sidebar-section agent-queue-sidebar-section-secondary">
        <p className="agent-queue-section-title">Validation</p>
        <dl className="agent-queue-validation-summary">
          <div>
            <dt>Validating</dt>
            <dd>{foundation.validationSummary.validating ?? 0}</dd>
          </div>
          <div>
            <dt>Passed</dt>
            <dd>{foundation.validationSummary.passed ?? 0}</dd>
          </div>
          <div>
            <dt>Needs review</dt>
            <dd>{foundation.validationSummary.needs_review ?? 0}</dd>
          </div>
          <div>
            <dt>Failed</dt>
            <dd>{foundation.validationSummary.failed ?? 0}</dd>
          </div>
        </dl>
      </section>
    </aside>
  );
}

function QueueStateSection({
  foundation,
}: {
  foundation: AgentQueueFoundationController;
}) {
  const globalExecutionState = foundation.globalExecutionState;

  return (
    <section className="agent-queue-sidebar-section">
      <div className="agent-queue-sidebar-header">
        <p className="agent-queue-pane-title">Queue + Workers</p>
        <Badge
          variant={
            globalExecutionState === "started"
              ? "info"
              : globalExecutionState === "stop_kill_requested"
                ? "warning"
                : "neutral"
          }
        >
          {queueGlobalExecutionStateLabel(globalExecutionState)}
        </Badge>
      </div>
      <div className="agent-queue-global-actions">
        <Button
          className={
            globalExecutionState === "started"
              ? "agent-queue-global-action-active"
              : undefined
          }
          onClick={() => foundation.onStartWorkers()}
          variant="secondary"
        >
          START
        </Button>
        <Button
          className={
            globalExecutionState === "stopped"
              ? "agent-queue-global-action-active"
              : undefined
          }
          onClick={() => foundation.onStopWorkers()}
          variant="ghost"
        >
          STOP
        </Button>
        <Button
          className={[
            "agent-queue-stop-kill-button",
            globalExecutionState === "stop_kill_requested"
              ? "agent-queue-global-action-active"
              : null,
          ]
            .filter(Boolean)
            .join(" ")}
          onClick={() => foundation.onStopAndKillRunning()}
          variant="ghost"
        >
          STOP + KILL RUNNING
        </Button>
      </div>
      <p className="agent-queue-run-note agent-queue-state-strip">
        {queueGlobalExecutionStateDescription(globalExecutionState)}
      </p>
      {foundation.globalMessage ? (
        <p className="agent-queue-run-note agent-queue-sidebar-subtle">
          {foundation.globalMessage}
        </p>
      ) : null}
      <div
        className="agent-queue-scheduler-preview"
        aria-label="Scheduler dry-run preview"
      >
        <div className="agent-queue-section-header">
          <p className="agent-queue-section-title">Scheduler dry run</p>
          <Badge
            variant={
              foundation.schedulerPlan.globalState.allowsScheduling
                ? "info"
                : foundation.schedulerPlan.globalState.code ===
                    "stop_kill_requested"
                  ? "warning"
                  : "neutral"
            }
          >
            {foundation.schedulerPlan.globalState.label}
          </Badge>
        </div>
        <dl className="agent-queue-scheduler-facts">
          <div>
            <dt>Schedulable</dt>
            <dd>{foundation.schedulerPlan.schedulableItemCount}</dd>
          </div>
          <div>
            <dt>Worker next</dt>
            <dd>{foundation.schedulerPlan.recommendations.length}</dd>
          </div>
          <div>
            <dt>Blocked</dt>
            <dd>{foundation.schedulerPlan.blockedItems.length}</dd>
          </div>
        </dl>
        <details className="agent-queue-details agent-queue-rail-details">
          <summary>Reason</summary>
          <p className="agent-queue-run-note">
            {foundation.schedulerPlan.explanation}
          </p>
        </details>
        {foundation.schedulerPlan.topBlockedReasons.length > 0 ? (
          <p className="agent-queue-sidebar-row-meta">
            Top blocker: {foundation.schedulerPlan.topBlockedReasons[0].label}
          </p>
        ) : null}
      </div>
    </section>
  );
}

function ExecutorCapacitySection({
  foundation,
}: {
  foundation: AgentQueueFoundationController;
}) {
  return (
    <section
      aria-label="Agent Executor section"
      className="agent-queue-sidebar-section"
    >
      <div className="agent-queue-section-header">
        <p className="agent-queue-section-title">Executor capacity</p>
        <Badge
          variant={
            foundation.embeddedExecutor.capacityRecommendation.code ===
            "can_add_worker"
              ? "info"
              : foundation.embeddedExecutor.capacityRecommendation.code ===
                    "max_reached" ||
                  foundation.embeddedExecutor.capacityRecommendation.code ===
                    "blocked_by_tags_or_dependencies"
                ? "warning"
                : "neutral"
          }
        >
          {foundation.embeddedExecutor.capacityRecommendation.label}
        </Badge>
      </div>
      <div className="agent-queue-rail-inline-field">
        <label className="field-label" htmlFor="agent-queue-max-executors">
          Max executors
        </label>
        <input
          className="input agent-queue-max-executors-input"
          id="agent-queue-max-executors"
          min={1}
          onChange={(event) =>
            foundation.onMaxExecutorsChange(event.currentTarget.value)
          }
          type="number"
          value={foundation.embeddedExecutor.maxExecutors}
        />
      </div>
      {foundation.maxExecutorMessage ? (
        <p className="agent-queue-run-note">{foundation.maxExecutorMessage}</p>
      ) : null}
      <dl className="agent-queue-executor-facts">
        <div>
          <dt>Configured</dt>
          <dd>{foundation.embeddedExecutor.currentConfiguredWorkerCount}</dd>
        </div>
        <div>
          <dt>Spare</dt>
          <dd>{foundation.embeddedExecutor.spareExecutorSlots}</dd>
        </div>
        <div>
          <dt>Working</dt>
          <dd>{foundation.embeddedExecutor.workingExecutorSlots}</dd>
        </div>
        <div>
          <dt>Open slots</dt>
          <dd>{foundation.embeddedExecutor.unconfiguredExecutorSlots}</dd>
        </div>
      </dl>
      <details className="agent-queue-details agent-queue-rail-details">
        <summary>Capacity note</summary>
        <p className="agent-queue-run-note">
          Capacity is dry-run only; edits do not start or stop Executor work.
        </p>
      </details>
    </section>
  );
}

function WorkerRow({
  deleteConfirmWorkerId,
  foundation,
  globalExecutionState,
  onDeleteConfirmWorkerIdChange,
  onRenamingWorkerIdChange,
  onWorkerRenameDraftChange,
  renamingWorkerId,
  worker,
  workerRenameDraft,
}: {
  deleteConfirmWorkerId: string | null;
  foundation: AgentQueueFoundationController;
  globalExecutionState: AgentQueueFoundationController["globalExecutionState"];
  onDeleteConfirmWorkerIdChange: (workerId: string | null) => void;
  onRenamingWorkerIdChange: (workerId: string | null) => void;
  onWorkerRenameDraftChange: (draft: string) => void;
  renamingWorkerId: string | null;
  worker: AgentQueueFoundationController["workers"][number];
  workerRenameDraft: string;
}) {
  const plan = workerSchedulerPlan(foundation, worker.workerId);
  const planLabel = plan
    ? `${plan.eligibleItemCount.toString()} schedulable item${
        plan.eligibleItemCount === 1 ? "" : "s"
      }`
    : "No dry run";
  const dryRunNote = plan?.bestNextItem
    ? `Next: ${plan.bestNextItem.title}`
    : plan?.idleReason && globalExecutionState !== "stopped"
      ? `Idle: ${plan.idleReason}`
      : globalExecutionState === "stopped"
        ? "Dry-run paused"
        : null;

  return (
    <div className="agent-queue-worker-row">
      <div className="agent-queue-sidebar-row-main">
        {renamingWorkerId === worker.workerId ? (
          <input
            aria-label={`Rename ${worker.name}`}
            className="input agent-queue-tag-management-input"
            onChange={(event) =>
              onWorkerRenameDraftChange(event.currentTarget.value)
            }
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                foundation.onRenameWorker(worker.workerId, workerRenameDraft);
                onRenamingWorkerIdChange(null);
                onWorkerRenameDraftChange("");
              }
            }}
            value={workerRenameDraft}
          />
        ) : (
          <p className="agent-queue-sidebar-row-title">{worker.name}</p>
        )}
        <p className="agent-queue-sidebar-row-meta">
          {worker.enabled ? "Enabled" : "Disabled"}
          {worker.scope.kind === "queue_tag"
            ? `, tag: ${worker.scope.queueTagName}`
            : ", all tags"}
        </p>
        <p className="agent-queue-sidebar-row-meta">{planLabel}</p>
        {dryRunNote ? (
          <p className="agent-queue-sidebar-row-meta">{dryRunNote}</p>
        ) : null}
        {plan?.bestNextItem ? (
          <p className="agent-queue-sidebar-row-meta">
            {workerNextPlanStatus(foundation, worker.workerId)}
          </p>
        ) : null}
        {worker.scope.kind === "queue_tag" && worker.status === "paused" ? (
          <p className="agent-queue-sidebar-row-meta">Tag paused.</p>
        ) : null}
      </div>
      <div className="agent-queue-sidebar-row-actions agent-queue-worker-quick-facts">
        <Badge
          variant={
            worker.status === "running"
              ? "info"
              : worker.status === "paused"
                ? "warning"
                : worker.status === "failed"
                  ? "error"
                  : "neutral"
          }
        >
          {worker.status}
        </Badge>
        {worker.currentItemId ? <Badge variant="info">active</Badge> : null}
      </div>
      {worker.lastReportSummary ? (
        <p className="agent-queue-sidebar-row-meta">
          {worker.lastReportSummary}
        </p>
      ) : null}
      <details className="agent-queue-details agent-queue-rail-details agent-queue-worker-management">
        <summary>Manage worker</summary>
        <label className="field-label" htmlFor={`worker-enabled-${worker.workerId}`}>
          Enabled
        </label>
        <input
          checked={worker.enabled}
          id={`worker-enabled-${worker.workerId}`}
          onChange={(event) =>
            foundation.onWorkerEnabledChange(
              worker.workerId,
              event.currentTarget.checked,
            )
          }
          type="checkbox"
        />
        <label className="field-label" htmlFor={`worker-scope-${worker.workerId}`}>
          Scope
        </label>
        <select
          className="input agent-queue-worker-scope-select"
          id={`worker-scope-${worker.workerId}`}
          onChange={(event) => {
            const queueTagId = event.currentTarget.value;
            if (queueTagId === "all") {
              foundation.onWorkerScopeChange(worker.workerId, { kind: "all" });
              return;
            }
            const queueTag = foundation.queueTags.find(
              (tag) => tag.queueTagId === queueTagId,
            );
            if (queueTag) {
              foundation.onWorkerScopeChange(worker.workerId, {
                kind: "queue_tag",
                queueTagId: queueTag.queueTagId,
                queueTagName: queueTag.queueTagName,
              });
            }
          }}
          value={
            worker.scope.kind === "queue_tag" ? worker.scope.queueTagId : "all"
          }
        >
          <option value="all">All queues</option>
          {foundation.queueTags.map((tag) => (
            <option key={tag.queueTagId} value={tag.queueTagId}>
              {tag.queueTagName}
            </option>
          ))}
        </select>
        <div className="agent-queue-sidebar-row-actions">
          {renamingWorkerId === worker.workerId ? (
            <>
              <Button
                onClick={() => {
                  foundation.onRenameWorker(worker.workerId, workerRenameDraft);
                  onRenamingWorkerIdChange(null);
                  onWorkerRenameDraftChange("");
                }}
                variant="secondary"
              >
                Save
              </Button>
              <Button
                onClick={() => {
                  onRenamingWorkerIdChange(null);
                  onWorkerRenameDraftChange("");
                }}
                variant="ghost"
              >
                Cancel
              </Button>
            </>
          ) : (
            <Button
              onClick={() => {
                onRenamingWorkerIdChange(worker.workerId);
                onWorkerRenameDraftChange(worker.name);
                onDeleteConfirmWorkerIdChange(null);
              }}
              variant="ghost"
            >
              Rename
            </Button>
          )}
          {deleteConfirmWorkerId === worker.workerId ? (
            <>
              <Button
                className="agent-queue-delete-button"
                onClick={() => {
                  foundation.onDeleteWorker(worker.workerId);
                  onDeleteConfirmWorkerIdChange(null);
                }}
                variant="ghost"
              >
                Confirm remove
              </Button>
              <Button
                onClick={() => onDeleteConfirmWorkerIdChange(null)}
                variant="ghost"
              >
                Cancel
              </Button>
            </>
          ) : (
            <Button
              className="agent-queue-delete-button"
              onClick={() => {
                onDeleteConfirmWorkerIdChange(worker.workerId);
                onRenamingWorkerIdChange(null);
              }}
              variant="ghost"
            >
              Remove
            </Button>
          )}
        </div>
      </details>
    </div>
  );
}

function pauseReasonLabel(reason: string) {
  switch (reason) {
    case "edit_review":
      return "task edit review";
    case "manual":
    default:
      return "manual pause";
  }
}

function workerSchedulerPlan(
  foundation: AgentQueueFoundationController,
  workerId: string,
) {
  return foundation.schedulerPlan.workerPlans.find(
    (workerPlan) => workerPlan.workerId === workerId,
  );
}

function workerNextPlanStatus(
  foundation: AgentQueueFoundationController,
  workerId: string,
) {
  const nextItem = foundation.workers.find(
    (worker) => worker.workerId === workerId,
  )?.routingSummary?.nextItem;

  return nextItem
    ? executionPlanStatusLabel(nextItem.executionPlanPreview)
    : "Plan needed";
}
