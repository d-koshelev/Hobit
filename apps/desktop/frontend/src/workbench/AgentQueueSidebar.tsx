import { useState } from "react";
import { Badge } from "../design-system/Badge";
import { Button } from "../design-system/Button";
import type { AgentQueueFoundationController } from "./queue/useAgentQueueController";

type AgentQueueSidebarProps = {
  foundation: AgentQueueFoundationController;
};

export function AgentQueueSidebar({ foundation }: AgentQueueSidebarProps) {
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
          <Badge variant={foundation.globalStatus === "running" ? "info" : "neutral"}>
            {foundation.globalStatus}
          </Badge>
        </div>
        <div className="agent-queue-global-actions">
          <Button onClick={() => foundation.onStartWorkers()} variant="secondary">
            START
          </Button>
          <Button onClick={() => foundation.onStopWorkers()} variant="ghost">
            STOP
          </Button>
          <Button
            className="agent-queue-stop-kill-button"
            onClick={() => foundation.onStopAndKillRunning()}
            variant="ghost"
          >
            STOP + KILL RUNNING
          </Button>
        </div>
        {foundation.globalMessage ? (
          <p className="agent-queue-run-note">{foundation.globalMessage}</p>
        ) : null}
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
          <Button onClick={() => foundation.onCreateWorker()} variant="secondary">
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
                  <p className="agent-queue-sidebar-row-meta">
                    {worker.enabled ? "Enabled" : "Disabled"}
                    {worker.scope.kind === "queue_tag"
                      ? `, scoped to ${worker.scope.queueTagName}`
                      : ", all queues"}
                  </p>
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
