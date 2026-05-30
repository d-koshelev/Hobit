import { Badge } from "../design-system/Badge";
import { Button } from "../design-system/Button";
import type { AgentQueueRunnerController } from "./queue/useAgentQueueController";

type AgentQueueSequentialRunnerPanelProps = {
  runner: AgentQueueRunnerController;
};

export function AgentQueueSequentialRunnerPanel({
  runner,
}: AgentQueueSequentialRunnerPanelProps) {
  return (
    <div className="agent-queue-execution-group">
      <div className="agent-queue-execution-group-header">
        <div>
          <p
            className="agent-queue-execution-group-title"
            title="Runs eligible tasks from the visible Queue while Hobit is open."
          >
            Sequential runner
          </p>
        </div>
        <Badge variant={runnerStatusBadgeVariant(runner.status)}>
          {runnerStatusLabel(runner.status)}
        </Badge>
      </div>

      <div className="agent-queue-run-actions">
        <Button
          disabled={!runner.canStart}
          onClick={() => runner.onStart()}
          variant="secondary"
        >
          {isRunnerActive(runner.status) ? "Runner active" : "Start runner"}
        </Button>
        <Button
          disabled={!isRunnerActive(runner.status)}
          onClick={() => runner.onStop()}
          variant="ghost"
        >
          Stop runner
        </Button>
      </div>

      {runner.preconditionMessages.length > 0 ? (
        <div className="agent-queue-run-warning-list">
          {runner.preconditionMessages.map((message) => (
            <p className="agent-queue-run-warning" key={message}>
              {message}
            </p>
          ))}
        </div>
      ) : null}

      {runner.message ? (
        <p className="agent-queue-run-note">{runner.message}</p>
      ) : null}
      {runner.error ? (
        <p
          className="agent-queue-message agent-queue-message-error"
          role="alert"
        >
          {runner.error}
        </p>
      ) : null}
    </div>
  );
}

function isRunnerActive(status: AgentQueueRunnerController["status"]) {
  return (
    status === "assigning" ||
    status === "running" ||
    status === "starting" ||
    status === "waiting_for_executor"
  );
}

function runnerStatusLabel(status: AgentQueueRunnerController["status"]) {
  switch (status) {
    case "waiting_for_executor":
      return "waiting for executor";
    default:
      return status;
  }
}

function runnerStatusBadgeVariant(status: AgentQueueRunnerController["status"]) {
  if (status === "completed") {
    return "success";
  }

  if (status === "error") {
    return "error";
  }

  if (isRunnerActive(status)) {
    return "info";
  }

  return "neutral";
}
