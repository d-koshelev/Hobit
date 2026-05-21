import { Badge } from "../design-system/Badge";
import { Button } from "../design-system/Button";
import type { AgentQueueAutorunController } from "./queue/useAgentQueueController";

type AgentQueueAutorunPanelProps = {
  autorun: AgentQueueAutorunController;
};

export function AgentQueueAutorunPanel({
  autorun,
}: AgentQueueAutorunPanelProps) {
  const snapshot = autorun.snapshot;
  const canStop =
    autorun.apiAvailable &&
    Boolean(snapshot?.isActive) &&
    !autorun.isLoading &&
    !autorun.isStarting &&
    !autorun.isStopping;

  return (
    <section aria-label="Queue Autorun" className="agent-queue-run-section">
      <div className="agent-queue-run-header">
        <div>
          <p className="agent-queue-run-title">Queue Autorun</p>
          <p
            className="agent-queue-run-copy"
            title="Start Autorun uses the existing Queue-to-Executor path and remains current-session only."
          >
            Autorun is desktop-local and only works while Hobit is open.
          </p>
        </div>
        <div className="agent-queue-run-badges">
          <Badge variant={autorunStatusBadgeVariant(snapshot?.status)}>
            {autorunStatusLabel(snapshot?.status)}
          </Badge>
          <Badge
            variant={snapshot?.isSessionOnly === false ? "warning" : "neutral"}
          >
            {snapshot
              ? sessionBoundaryLabel(snapshot.isSessionOnly)
              : "desktop-only"}
          </Badge>
        </div>
      </div>

      <dl className="agent-queue-autorun-facts">
        <div>
          <dt>Executor</dt>
          <dd>
            {autorun.selectedExecutorLabel ?? "No Agent Executor selected"}
          </dd>
        </div>
        <div>
          <dt>Policy</dt>
          <dd>{policyText(snapshot)}</dd>
        </div>
        <div>
          <dt>State</dt>
          <dd>{autorunStateText(snapshot)}</dd>
        </div>
        <div>
          <dt>Sharing</dt>
          <dd>
            {snapshot?.policy.allowHiddenExecution === false
              ? "No hidden execution"
              : "Unknown"}
          </dd>
        </div>
        <div>
          <dt>Active task</dt>
          <dd>{snapshot?.activeQueueItemId ?? "None"}</dd>
        </div>
        <div>
          <dt>Waiting run</dt>
          <dd>{snapshot?.waitingRunId ?? "None"}</dd>
        </div>
        <div>
          <dt>Final status</dt>
          <dd>{snapshot?.finalRunStatus?.replace(/_/g, " ") ?? "None"}</dd>
        </div>
        <div>
          <dt>Last check</dt>
          <dd>{formatReconciledAt(snapshot?.lastReconciledAt)}</dd>
        </div>
        <div>
          <dt>Stop reason</dt>
          <dd>{snapshot?.stopReason?.replace(/_/g, " ") ?? "None"}</dd>
        </div>
      </dl>

      <div className="agent-queue-run-actions">
        <Button
          disabled={!autorun.canArm}
          onClick={() => autorun.onArm()}
          variant="primary"
        >
          {autorun.isStarting ? "Starting" : "Start Autorun"}
        </Button>
        <Button
          disabled={!canStop}
          onClick={() => autorun.onStop()}
          variant="secondary"
        >
          {autorun.isStopping ? "Stopping" : "Stop Autorun"}
        </Button>
        <Button
          disabled={!autorun.apiAvailable || autorun.isLoading}
          onClick={() => autorun.onRefresh()}
          variant="ghost"
        >
          {autorun.isLoading ? "Refreshing" : "Refresh status"}
        </Button>
      </div>

      {autorun.preconditionMessages.length > 0 ? (
        <div className="agent-queue-run-warning-list">
          {autorun.preconditionMessages.map((message) => (
            <p className="agent-queue-run-warning" key={message}>
              {message}
            </p>
          ))}
        </div>
      ) : null}

      {autorun.message ? (
        <p className="agent-queue-run-note">{autorun.message}</p>
      ) : null}
      <details className="agent-queue-details">
        <summary>Autorun limits</summary>
        <p className="agent-queue-run-note">
          Start Autorun uses the existing Queue-to-Executor path, then
          continues from a successful run to one next eligible task while Hobit
          is open. Stop Autorun stops future scheduling, not the active Agent
          Executor run. App close, reload, shutdown, or sleep can interrupt it.
        </p>
      </details>
      {autorun.error ? (
        <p
          className="agent-queue-message agent-queue-message-error"
          role="alert"
        >
          {autorun.error}
        </p>
      ) : null}
    </section>
  );
}

function policyText(snapshot: AgentQueueAutorunController["snapshot"]) {
  if (!snapshot) {
    return "Conservative defaults";
  }

  const policy = snapshot.policy;
  const labels = [
    policy.oneTaskAtATime ? "one task at a time" : "parallelism unknown",
    policy.stopOnFailure ? "stop on failure" : "failure behavior unknown",
    policy.stopOnReviewNeeded ? "stop on review" : "review behavior unknown",
    policy.stopOnCancel ? "stop on cancel" : "cancel behavior unknown",
  ];

  return labels.join(", ");
}

function autorunStateText(snapshot: AgentQueueAutorunController["snapshot"]) {
  if (!snapshot) {
    return "Unavailable";
  }

  if (snapshot.status === "waiting_for_executor") {
    return "Waiting for Agent Executor";
  }

  if (snapshot.status === "starting_task" || snapshot.status === "selecting_task") {
    return "Scheduling next task";
  }

  if (snapshot.status === "completed") {
    return "Completed for this session";
  }

  if (snapshot.status === "stopped") {
    return "Stopped";
  }

  if (snapshot.isActive) {
    return "Running while Hobit is open";
  }

  return autorunStatusLabel(snapshot.status);
}

function formatReconciledAt(value: string | null | undefined) {
  if (!value) {
    return "Not checked yet";
  }

  if (value.startsWith("unix_ms:")) {
    const millis = Number(value.slice("unix_ms:".length));
    if (Number.isFinite(millis)) {
      return new Date(millis).toLocaleTimeString();
    }
  }

  return value;
}

function autorunStatusLabel(status: string | undefined) {
  if (!status) {
    return "unavailable";
  }

  return status.replace(/_/g, " ");
}

function autorunStatusBadgeVariant(status: string | undefined) {
  if (
    status === "armed" ||
    status === "running" ||
    status === "waiting_for_executor" ||
    status === "starting_task"
  ) {
    return "info";
  }

  if (status === "stopped") {
    return "warning";
  }

  if (status === "error" || status === "failed") {
    return "error";
  }

  return "neutral";
}

function sessionBoundaryLabel(isSessionOnly: boolean) {
  return isSessionOnly ? "session-only" : "not session-only";
}
