import { useId } from "react";
import { Button } from "../design-system/Button";
import { Input } from "../design-system/Input";
import type {
  DirectWorkApprovalPolicy,
  DirectWorkSandbox,
} from "../workspace/types";
import type { AgentQueueRunController } from "./queue/useAgentQueueController";

type AgentQueueRunReadinessPanelProps = {
  run: AgentQueueRunController;
};

export function AgentQueueRunReadinessPanel({
  run,
}: AgentQueueRunReadinessPanelProps) {
  const repoRootInputId = useId();
  const codexExecutableInputId = useId();
  const sandboxInputId = useId();
  const approvalPolicyInputId = useId();

  return (
    <div className="agent-queue-execution-group">
      <div className="agent-queue-execution-group-header">
        <div>
          <p
            className="agent-queue-execution-group-title"
            title="Starts only the selected task in the assigned Agent Executor."
          >
            Run selected task
          </p>
        </div>
      </div>

      {run.readinessMessage ? (
        <p className="agent-queue-run-note">{run.readinessMessage}</p>
      ) : null}

      <div className="agent-queue-run-controls">
        <div className="agent-queue-run-field agent-queue-run-field-wide">
          <label
            className="field-label"
            htmlFor={repoRootInputId}
            title="Use an existing repository or local project folder."
          >
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
              run.onSandboxChange(
                event.currentTarget.value as DirectWorkSandbox,
              )
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
          {run.isStarting ? "Starting" : "Run this task"}
        </Button>
      </div>

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
        <p
          className="agent-queue-message agent-queue-message-error"
          role="alert"
        >
          {run.startError}
        </p>
      ) : null}
    </div>
  );
}
