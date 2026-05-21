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
          <p className="agent-queue-run-copy">
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

      <p className="agent-queue-run-boundary-copy">
        This currently arms the Queue Autorun session. Task execution loop is
        not implemented yet.
      </p>

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
          <dt>Sharing</dt>
          <dd>
            {snapshot?.policy.allowHiddenExecution === false
              ? "No hidden execution"
              : "Unknown"}
          </dd>
        </div>
      </dl>

      <div className="agent-queue-run-actions">
        <Button
          disabled={!autorun.canArm}
          onClick={() => autorun.onArm()}
          variant="primary"
        >
          {autorun.isStarting ? "Arming" : "Arm Autorun"}
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

function autorunStatusLabel(status: string | undefined) {
  if (!status) {
    return "unavailable";
  }

  return status.replace(/_/g, " ");
}

function autorunStatusBadgeVariant(status: string | undefined) {
  if (status === "armed" || status === "running") {
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
