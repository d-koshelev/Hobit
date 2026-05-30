import { Badge } from "../design-system/Badge";
import { Button } from "../design-system/Button";
import type { AgentQueueFoundationController } from "./queue/useAgentQueueController";

type AgentQueueSidebarProps = {
  foundation: AgentQueueFoundationController;
};

export function AgentQueueSidebar({ foundation }: AgentQueueSidebarProps) {
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
        <p className="agent-queue-section-title">Queue tags</p>
        <div className="agent-queue-sidebar-list">
          {foundation.queueTags.map((tag) => (
            <div className="agent-queue-sidebar-row" key={tag.queueTagId}>
              <div>
                <p className="agent-queue-sidebar-row-title">{tag.queueTagName}</p>
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
              </div>
              <div className="agent-queue-sidebar-row-actions">
                <Badge variant={tag.status === "paused" ? "warning" : "success"}>
                  {tag.status}
                </Badge>
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
      </section>

      <section className="agent-queue-sidebar-section">
        <p className="agent-queue-section-title">Workers</p>
        <div className="agent-queue-sidebar-list">
          {foundation.workers.length === 0 ? (
            <p className="agent-queue-run-note">No Agent Workers. Add Agent Executor widgets to create worker slots.</p>
          ) : (
            foundation.workers.map((worker) => (
              <div className="agent-queue-worker-row" key={worker.workerId}>
                <div className="agent-queue-sidebar-row-main">
                  <p className="agent-queue-sidebar-row-title">{worker.name}</p>
                  <p className="agent-queue-sidebar-row-meta">
                    {worker.currentItemId
                      ? `Current item ${worker.currentItemId}`
                      : "No current item"}
                  </p>
                </div>
                <Badge variant={worker.status === "running" ? "info" : worker.status === "paused" ? "warning" : worker.status === "failed" ? "error" : "neutral"}>
                  {worker.status}
                </Badge>
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
