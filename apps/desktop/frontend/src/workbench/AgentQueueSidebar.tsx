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
        <p className="agent-queue-run-note">
          {queueGlobalExecutionStateDescription(globalExecutionState)}
        </p>
        {foundation.globalMessage ? (
          <p className="agent-queue-run-note">{foundation.globalMessage}</p>
        ) : null}
        <div className="agent-queue-scheduler-preview" aria-label="Scheduler dry-run preview">
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
          <p className="agent-queue-run-note">
            {foundation.schedulerPlan.explanation}
          </p>
          {foundation.schedulerPlan.topBlockedReasons.length > 0 ? (
            <p className="agent-queue-sidebar-row-meta">
              Top blocker: {foundation.schedulerPlan.topBlockedReasons[0].label}
            </p>
          ) : null}
        </div>
      </section>

      <section
        aria-label="Agent Executor section"
        className="agent-queue-sidebar-section"
      >
        <div className="agent-queue-section-header">
          <p className="agent-queue-section-title">Agent Executor section</p>
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
        {foundation.maxExecutorMessage ? (
          <p className="agent-queue-run-note">{foundation.maxExecutorMessage}</p>
        ) : null}
        <dl className="agent-queue-executor-facts">
          <div>
            <dt>Configured</dt>
            <dd>
              {foundation.embeddedExecutor.currentConfiguredWorkerCount}
            </dd>
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
        <p className="agent-queue-run-note">
          Scheduler capacity is a dry run only; changing this value does not
          start or stop Agent Executor work.
        </p>
      </section>

      <section className="agent-queue-sidebar-section">
        <div className="agent-queue-section-header">
          <p className="agent-queue-section-title">Queue tags</p>
          <Badge variant="neutral">routing</Badge>
        </div>
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
          <p className="agent-queue-message agent-queue-message-error" role="alert">
            {foundation.tagManagementError}
          </p>
        ) : foundation.tagManagementMessage ? (
          <p className="agent-queue-message">{foundation.tagManagementMessage}</p>
        ) : null}
        <div className="agent-queue-sidebar-list">
          {foundation.queueTags.map((tag) => (
            <div className="agent-queue-sidebar-row" key={tag.queueTagId}>
              <div>
                {renamingTagId === tag.queueTagId ? (
                  <input
                    aria-label={`Rename ${tag.queueTagName}`}
                    className="input agent-queue-tag-management-input"
                    onChange={(event) => setRenameDraft(event.currentTarget.value)}
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
                  {tag.validatingCount} validating, {tag.needsReviewCount} needs review
                  {tag.failedValidationCount > 0
                    ? `, ${tag.failedValidationCount.toString()} failed`
                    : ""}
                </p>
                {tag.coordinatorReviewCount > 0 ? (
                  <p className="agent-queue-sidebar-row-meta">
                    {tag.coordinatorReviewCount} awaiting coordinator review
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
                    onClick={() => startRename(tag.queueTagId, tag.queueTagName)}
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
      </section>

      <section className="agent-queue-sidebar-section">
        <div className="agent-queue-section-header">
          <p className="agent-queue-section-title">Workers</p>
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
        </div>
        <div className="agent-queue-sidebar-list">
          {foundation.workers.length === 0 ? (
            <p className="agent-queue-run-note">No Agent Workers configured.</p>
          ) : (
            foundation.workers.map((worker) => (
              <div className="agent-queue-worker-row" key={worker.workerId}>
                <div className="agent-queue-sidebar-row-main">
                  {renamingWorkerId === worker.workerId ? (
                    <input
                      aria-label={`Rename ${worker.name}`}
                      className="input agent-queue-tag-management-input"
                      onChange={(event) =>
                        setWorkerRenameDraft(event.currentTarget.value)
                      }
                      onKeyDown={(event) => {
                        if (event.key === "Enter") {
                          foundation.onRenameWorker(
                            worker.workerId,
                            workerRenameDraft,
                          );
                          setRenamingWorkerId(null);
                          setWorkerRenameDraft("");
                        }
                      }}
                      value={workerRenameDraft}
                    />
                  ) : (
                    <p className="agent-queue-sidebar-row-title">{worker.name}</p>
                  )}
                  <p className="agent-queue-sidebar-row-meta">
                    {worker.currentItemId
                      ? `Current item ${worker.currentItemId}`
                      : "No current item"}
                  </p>
                  {worker.lastReportSummary ? (
                    <p className="agent-queue-sidebar-row-meta">
                      {worker.lastReportSummary}
                    </p>
                  ) : null}
                  <p className="agent-queue-sidebar-row-meta">
                    {worker.enabled ? "Enabled" : "Disabled"}
                    {worker.scope.kind === "queue_tag"
                      ? `, scoped to ${worker.scope.queueTagName}`
                      : ", all queues"}
                  </p>
                  <p className="agent-queue-sidebar-row-meta">
                    {workerSchedulerPlan(foundation, worker.workerId)
                      ? `${workerSchedulerPlan(
                          foundation,
                          worker.workerId,
                        )?.eligibleItemCount.toString()} schedulable item${
                          workerSchedulerPlan(foundation, worker.workerId)
                            ?.eligibleItemCount === 1
                            ? ""
                            : "s"
                        }`
                      : "Scheduler not evaluated"}
                  </p>
                  {workerSchedulerPlan(foundation, worker.workerId)?.bestNextItem ? (
                    <>
                      <p className="agent-queue-sidebar-row-meta">
                        Dry-run next:{" "}
                        {
                          workerSchedulerPlan(foundation, worker.workerId)
                            ?.bestNextItem?.title
                        }
                      </p>
                      <p className="agent-queue-sidebar-row-meta">
                        {workerNextPlanStatus(foundation, worker.workerId)}
                      </p>
                    </>
                  ) : workerSchedulerPlan(foundation, worker.workerId)?.idleReason ? (
                    <p className="agent-queue-sidebar-row-meta">
                      Idle:{" "}
                      {workerSchedulerPlan(foundation, worker.workerId)?.idleReason}
                    </p>
                  ) : null}
                {worker.scope.kind === "queue_tag" &&
                worker.status === "paused" ? (
                  <p className="agent-queue-sidebar-row-meta">
                    Scoped tag is paused; this worker cannot take new work from it.
                  </p>
                ) : null}
              </div>
                <Badge variant={worker.status === "running" ? "info" : worker.status === "paused" ? "warning" : worker.status === "failed" ? "error" : "neutral"}>
                  {worker.status}
                </Badge>
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
                    worker.scope.kind === "queue_tag"
                      ? worker.scope.queueTagId
                      : "all"
                  }
                >
                  <option value="all">All queues</option>
                  {foundation.queueTags.map((tag) => (
                    <option key={tag.queueTagId} value={tag.queueTagId}>
                      {tag.queueTagName}
                    </option>
                  ))}
                </select>
                {renamingWorkerId === worker.workerId ? (
                  <>
                    <Button
                      onClick={() => {
                        foundation.onRenameWorker(
                          worker.workerId,
                          workerRenameDraft,
                        );
                        setRenamingWorkerId(null);
                        setWorkerRenameDraft("");
                      }}
                      variant="secondary"
                    >
                      Save
                    </Button>
                    <Button
                      onClick={() => {
                        setRenamingWorkerId(null);
                        setWorkerRenameDraft("");
                      }}
                      variant="ghost"
                    >
                      Cancel
                    </Button>
                  </>
                ) : (
                  <Button
                    onClick={() => {
                      setRenamingWorkerId(worker.workerId);
                      setWorkerRenameDraft(worker.name);
                      setDeleteConfirmWorkerId(null);
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
                        setDeleteConfirmWorkerId(null);
                      }}
                      variant="ghost"
                    >
                      Confirm remove
                    </Button>
                    <Button
                      onClick={() => setDeleteConfirmWorkerId(null)}
                      variant="ghost"
                    >
                      Cancel
                    </Button>
                  </>
                ) : (
                  <Button
                    className="agent-queue-delete-button"
                    onClick={() => {
                      setDeleteConfirmWorkerId(worker.workerId);
                      setRenamingWorkerId(null);
                    }}
                    variant="ghost"
                  >
                    Remove
                  </Button>
                )}
              </div>
            ))
          )}
        </div>
      </section>

      <section className="agent-queue-sidebar-section">
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
  const nextItem = foundation.workers.find((worker) => worker.workerId === workerId)
    ?.routingSummary?.nextItem;

  return nextItem
    ? executionPlanStatusLabel(nextItem.executionPlanPreview)
    : "Plan needed";
}
