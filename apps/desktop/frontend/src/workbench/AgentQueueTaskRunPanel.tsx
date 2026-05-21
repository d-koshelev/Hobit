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
  isAssignmentLockedQueueTaskStatus,
  isFinalQueueTaskStatus,
  statusBadgeVariant,
  statusLabel,
} from "./agentQueueTaskUiModel";
import type {
  AgentQueueRunController,
  AgentQueueRunnerController,
} from "./queue/useAgentQueueController";
import type { AgentExecutorSlot } from "./types";

type AgentQueueTaskRunPanelProps = {
  apiAvailable: boolean;
  assignmentError: string | null;
  assignmentMessage: string | null;
  currentSelection: string;
  executorSlots: AgentExecutorSlot[];
  hasExecutorSlots: boolean;
  inputId: string;
  isAssigning: boolean;
  isDirty: boolean;
  onAssign: () => void;
  onClear: () => void;
  onSelectionChange: (executorWidgetInstanceId: string) => void;
  run: AgentQueueRunController;
  runner: AgentQueueRunnerController;
  selectedTask: AgentQueueTask;
};

export function AgentQueueTaskRunPanel({
  apiAvailable,
  assignmentError,
  assignmentMessage,
  currentSelection,
  executorSlots,
  hasExecutorSlots,
  inputId,
  isAssigning,
  isDirty,
  onAssign,
  onClear,
  onSelectionChange,
  run,
  runner,
  selectedTask,
}: AgentQueueTaskRunPanelProps) {
  const repoRootInputId = useId();
  const codexExecutableInputId = useId();
  const sandboxInputId = useId();
  const approvalPolicyInputId = useId();
  const hasAssignedExecutor = Boolean(selectedTask.assignedExecutorWidgetId);
  const isFinalStatus = isFinalQueueTaskStatus(selectedTask.status);
  const isAssignmentLockedStatus = isAssignmentLockedQueueTaskStatus(
    selectedTask.status,
  );
  const assignmentDisabledReason = assignmentControlMessage({
    apiAvailable,
    hasExecutorSlots,
    isDirty,
    isFinalStatus,
    isRunningStatus: selectedTask.status === "running",
  });
  const assignDisabled = Boolean(
    assignmentDisabledReason ||
      isAssigning ||
      !hasExecutorSlots ||
      !currentSelection,
  );
  const clearDisabled = Boolean(
    assignmentDisabledReason || isAssigning || !hasAssignedExecutor,
  );

  return (
    <section
      aria-label="Queue task execution"
      className="agent-queue-execution-section"
    >
      <div className="agent-queue-execution-header">
        <div>
          <p
            className="agent-queue-execution-title"
            title="Select an Agent Executor, configure Direct Work, then run the task."
          >
            Execution
          </p>
        </div>
        <div className="agent-queue-execution-badges">
          <Badge
            variant={selectedTask.assignedExecutorWidgetId ? "info" : "neutral"}
          >
            {assignmentLabel(selectedTask.assignedExecutorWidgetId)}
          </Badge>
          <Badge variant={statusBadgeVariant(selectedTask.status)}>
            {statusLabel(selectedTask.status)}
          </Badge>
        </div>
      </div>

      {!hasExecutorSlots ? (
        <div className="agent-queue-attention-message" role="alert">
          <p className="agent-queue-attention-title">
            No Agent Executor available
          </p>
          <p className="agent-queue-attention-copy">
            Add an Agent Executor widget to run Queue tasks.
          </p>
        </div>
      ) : run.readinessMessage ? (
        <p className="agent-queue-run-note">{run.readinessMessage}</p>
      ) : null}

      {assignmentDisabledReason ? (
        <p className="agent-queue-assignment-note">
          {assignmentDisabledReason}
        </p>
      ) : null}

      {hasExecutorSlots ? (
        <div className="agent-queue-assignment-controls">
          <div className="agent-queue-assignment-field">
            <label className="field-label" htmlFor={inputId}>
              Executor
            </label>
            <select
              className="input agent-queue-assignment-select"
              disabled={
                !apiAvailable ||
                isDirty ||
                isAssignmentLockedStatus ||
                isAssigning
              }
              id={inputId}
              onChange={(event) =>
                onSelectionChange(event.currentTarget.value)
              }
              value={currentSelection}
            >
              {executorSlots.map((slot) => (
                <option
                  key={slot.widgetInstanceId}
                  value={slot.widgetInstanceId}
                >
                  {slot.label}
                </option>
              ))}
            </select>
          </div>
          <div className="agent-queue-assignment-buttons">
            <Button
              disabled={assignDisabled}
              onClick={() => onAssign()}
              variant="secondary"
            >
              {isAssigning ? "Assigning" : "Assign"}
            </Button>
            {hasAssignedExecutor ? (
              <Button
                disabled={clearDisabled}
                onClick={() => onClear()}
                variant="ghost"
              >
                Clear
              </Button>
            ) : null}
          </div>
        </div>
      ) : hasAssignedExecutor ? (
        <div className="agent-queue-assignment-buttons">
          <Button
            disabled={clearDisabled}
            onClick={() => onClear()}
            variant="ghost"
          >
            Clear assignment
          </Button>
        </div>
      ) : null}

      {assignmentMessage ? (
        <p className="agent-queue-message agent-queue-message-success">
          {assignmentMessage}
        </p>
      ) : null}
      {assignmentError ? (
        <p
          className="agent-queue-message agent-queue-message-error"
          role="alert"
        >
          {assignmentError}
        </p>
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
        <Button
          disabled={!selectedTask.assignedExecutorWidgetId}
          onClick={() =>
            openAssignedExecutor(selectedTask.assignedExecutorWidgetId)
          }
          title="Scroll to the assigned Agent Executor for live logs and result."
          variant="ghost"
        >
          Open Executor
        </Button>
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
    </section>
  );
}

function openAssignedExecutor(assignedExecutorWidgetId: string | null) {
  if (!assignedExecutorWidgetId || typeof document === "undefined") {
    return;
  }

  const target = Array.from(
    document.querySelectorAll<HTMLElement>("[data-widget-instance-id]"),
  ).find(
    (element) => element.dataset.widgetInstanceId === assignedExecutorWidgetId,
  );

  target?.scrollIntoView({
    block: "nearest",
    inline: "nearest",
  });
}

function assignmentControlMessage({
  hasExecutorSlots,
  apiAvailable,
  isDirty,
  isFinalStatus,
  isRunningStatus,
}: {
  apiAvailable: boolean;
  hasExecutorSlots: boolean;
  isDirty: boolean;
  isFinalStatus: boolean;
  isRunningStatus: boolean;
}) {
  if (!apiAvailable) {
    return "Assignment persistence is not available in this runtime.";
  }

  if (isDirty) {
    return "Save task edits before changing assignment.";
  }

  if (isFinalStatus) {
    return "Assignment is locked for final-status tasks.";
  }

  if (isRunningStatus) {
    return "Assignment locked: task is running.";
  }

  if (!hasExecutorSlots) {
    return null;
  }

  return null;
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
