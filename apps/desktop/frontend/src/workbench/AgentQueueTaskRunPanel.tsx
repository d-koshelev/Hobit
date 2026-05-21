import { useId } from "react";
import { Badge } from "../design-system/Badge";
import { Button } from "../design-system/Button";
import { Input } from "../design-system/Input";
import type {
  AgentQueueTask,
  DirectWorkApprovalPolicy,
  DirectWorkSandbox,
} from "../workspace/types";
import {
  assignmentLabel,
  statusBadgeVariant,
  statusLabel,
} from "./agentQueueTaskUiModel";
import type {
  AgentQueueRunController,
  AgentQueueRunnerController,
} from "./queue/useAgentQueueController";

type AgentQueueTaskRunPanelProps = {
  hasExecutorSlots: boolean;
  run: AgentQueueRunController;
  runner: AgentQueueRunnerController;
  selectedTask: AgentQueueTask;
};

export function AgentQueueTaskRunPanel({
  hasExecutorSlots,
  run,
  runner,
  selectedTask,
}: AgentQueueTaskRunPanelProps) {
  const repoRootInputId = useId();
  const codexExecutableInputId = useId();
  const sandboxInputId = useId();
  const approvalPolicyInputId = useId();

  return (
    <section
      aria-label="Run assigned Agent Queue task"
      className="agent-queue-run-section"
    >
      <div className="agent-queue-run-header">
        <div>
          <p
            className="agent-queue-run-title"
            title="Starts this task as Codex Direct Work in the assigned Agent Executor."
          >
            Run assigned task
          </p>
        </div>
        <div className="agent-queue-run-badges">
          <Badge variant={selectedTask.assignedExecutorWidgetId ? "info" : "neutral"}>
            {assignmentLabel(selectedTask.assignedExecutorWidgetId)}
          </Badge>
          <Badge variant={statusBadgeVariant(selectedTask.status)}>
            {statusLabel(selectedTask.status)}
          </Badge>
        </div>
      </div>

      {!hasExecutorSlots ? (
        <p className="agent-queue-attention-message" role="status">
          No Agent Executor widgets available. Add an Agent Executor to run Queue
          tasks.
        </p>
      ) : run.readinessMessage ? (
        <p className="agent-queue-run-note">{run.readinessMessage}</p>
      ) : null}

      <div className="agent-queue-run-controls">
        <div className="agent-queue-run-field agent-queue-run-field-wide">
          <label className="field-label" htmlFor={repoRootInputId}>
            Execution workspace
          </label>
          <Input
            autoComplete="off"
            id={repoRootInputId}
            onChange={(event) => {
              run.onRepoRootDraftChange(event.currentTarget.value);
            }}
            placeholder="C:\\path\\to\\repo-or-project"
            spellCheck={false}
            type="text"
            value={run.repoRootDraft}
          />
        </div>

        <div className="agent-queue-run-field agent-queue-run-field-wide">
          <label className="field-label" htmlFor={codexExecutableInputId}>
            Codex executable
          </label>
          <Input
            autoComplete="off"
            id={codexExecutableInputId}
            onChange={(event) => {
              run.onCodexExecutableDraftChange(event.currentTarget.value);
            }}
            spellCheck={false}
            type="text"
            value={run.codexExecutableDraft}
          />
        </div>

        <div className="agent-queue-run-field">
          <label className="field-label" htmlFor={sandboxInputId}>
            Sandbox
          </label>
          <select
            className="input agent-queue-run-select"
            id={sandboxInputId}
            onChange={(event) =>
              run.onSandboxChange(event.currentTarget.value as DirectWorkSandbox)
            }
            value={run.sandbox}
          >
            <option value="read_only">read_only</option>
            <option value="workspace_write">workspace_write</option>
          </select>
        </div>

        <div className="agent-queue-run-field">
          <label className="field-label" htmlFor={approvalPolicyInputId}>
            Approval policy
          </label>
          <select
            className="input agent-queue-run-select"
            id={approvalPolicyInputId}
            onChange={(event) =>
              run.onApprovalPolicyChange(
                event.currentTarget.value as DirectWorkApprovalPolicy,
              )
            }
            value={run.approvalPolicy}
          >
            <option value="never">never</option>
            <option value="on_request">on_request</option>
            <option value="untrusted">untrusted</option>
          </select>
        </div>
      </div>

      {!run.readinessMessage && run.preconditionMessages.length > 0 ? (
        <div className="agent-queue-run-warning-list">
          {run.preconditionMessages.map((message) => (
            <p className="agent-queue-run-warning" key={message}>
              {message}
            </p>
          ))}
        </div>
      ) : null}

      <div className="agent-queue-run-actions">
        <Button
          disabled={!run.canStart}
          onClick={() => run.onStartAssignedTask()}
          variant="primary"
        >
          {run.isStarting ? "Starting" : "Run assigned task"}
        </Button>
        <p className="agent-queue-run-note">
          Open the assigned Agent Executor for live logs and result.
        </p>
      </div>

      <div className="agent-queue-run-actions">
        <Button
          disabled={!runner.canStart}
          onClick={() => runner.onStart()}
          variant="secondary"
        >
          {isRunnerActive(runner.status) ? "Runner active" : "Run queue"}
        </Button>
        <Button
          disabled={!isRunnerActive(runner.status)}
          onClick={() => runner.onStop()}
          variant="ghost"
        >
          Stop runner
        </Button>
        <Badge variant={runnerStatusBadgeVariant(runner.status)}>
          {runnerStatusLabel(runner.status)}
        </Badge>
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

      <details className="agent-queue-details">
        <summary>Run details</summary>
        <p className="agent-queue-run-note">
          Direct Work requires an explicit existing repository or local project
          folder.
        </p>
      </details>

      {run.startMessage ? (
        <>
          <p className="agent-queue-message agent-queue-message-success">
            {run.startMessage}
            {run.startedRunId ? ` Run id: ${run.startedRunId}.` : ""}
          </p>
          <p className="agent-queue-run-note">
            Result appears in the assigned Agent Executor.
          </p>
        </>
      ) : null}
      {run.startError ? (
        <p className="agent-queue-message agent-queue-message-error" role="alert">
          {run.startError}
        </p>
      ) : null}
    </section>
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
