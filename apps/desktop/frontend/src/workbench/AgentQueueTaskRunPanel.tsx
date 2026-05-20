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
import type { AgentQueueRunController } from "./queue/useAgentQueueController";

type AgentQueueTaskRunPanelProps = {
  run: AgentQueueRunController;
  selectedTask: AgentQueueTask;
};

export function AgentQueueTaskRunPanel({
  run,
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
          <p className="agent-queue-run-title">Run assigned task</p>
          <p className="agent-queue-run-copy">
            Running starts this task as Codex Direct Work in the assigned Agent
            Executor.
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

      <p className="agent-queue-run-boundary-copy">
        Queue tasks can be planned without an execution workspace. Select one
        only when starting a Codex Direct Work run.
      </p>

      {run.readinessMessage ? (
        <p className="agent-queue-run-note">{run.readinessMessage}</p>
      ) : (
        <>
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
              <p className="agent-queue-run-note">
                Current Codex Direct Work expects an explicit existing
                repository or local project folder. Queue task planning does
                not store or require it.
              </p>
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

          {run.preconditionMessages.length > 0 ? (
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
        </>
      )}

      {run.startMessage ? (
        <>
          <p className="agent-queue-message agent-queue-message-success">
            {run.startMessage}
            {run.startedRunId ? ` Run id: ${run.startedRunId}.` : ""}
          </p>
          <p className="agent-queue-run-note">
            Live logs and result are shown in the assigned Agent Executor.
            Queue status will refresh after the assigned Agent Executor reaches
            a final state.
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
