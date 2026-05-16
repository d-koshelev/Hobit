import { useEffect, useId, useMemo, useRef, useState } from "react";
import { Badge } from "../design-system/Badge";
import { Button } from "../design-system/Button";
import { Input } from "../design-system/Input";
import type {
  AgentQueueTask,
  DirectWorkApprovalPolicy,
  DirectWorkSandbox,
  StartAssignedAgentQueueTaskResponse,
} from "../workspace/types";
import type { AgentQueueTaskStartRequest } from "./agentQueueTaskWidgetActions";
import {
  assignmentLabel,
  errorToMessage,
  isFinalQueueTaskStatus,
  shortWidgetInstanceId,
  statusBadgeVariant,
  statusLabel,
} from "./agentQueueTaskUiModel";

// Duplicated from the Agent Executor form to keep Queue-side run UI focused.
const DEFAULT_CODEX_EXECUTABLE = "codex";
const WINDOWS_CODEX_EXECUTABLE = "codex.cmd";

type AgentQueueTaskRunPanelProps = {
  isDirty: boolean;
  onStartAssignedTask?: (
    request: AgentQueueTaskStartRequest,
  ) => Promise<StartAssignedAgentQueueTaskResponse>;
  selectedTask: AgentQueueTask;
};

export function AgentQueueTaskRunPanel({
  isDirty,
  onStartAssignedTask,
  selectedTask,
}: AgentQueueTaskRunPanelProps) {
  const repoRootInputId = useId();
  const codexExecutableInputId = useId();
  const sandboxInputId = useId();
  const approvalPolicyInputId = useId();
  const [repoRootDraft, setRepoRootDraft] = useState("");
  const [codexExecutableDraft, setCodexExecutableDraft] = useState(
    defaultCodexExecutable,
  );
  const [sandbox, setSandbox] = useState<DirectWorkSandbox>("read_only");
  const [approvalPolicy, setApprovalPolicy] =
    useState<DirectWorkApprovalPolicy>("never");
  const [isStarting, setIsStarting] = useState(false);
  const [startMessage, setStartMessage] = useState<string | null>(null);
  const [startedRunId, setStartedRunId] = useState<string | null>(null);
  const [startError, setStartError] = useState<string | null>(null);
  const startInFlightRef = useRef(false);

  useEffect(() => {
    setRepoRootDraft("");
    setStartMessage(null);
    setStartedRunId(null);
    setStartError(null);
  }, [selectedTask.queueItemId]);

  const repoRoot = repoRootDraft.trim();
  const codexExecutable = codexExecutableDraft.trim();
  const preconditionMessages = useMemo(
    () =>
      runPreconditionMessages({
        codexExecutable,
        isDirty,
        isStarting,
        repoRoot,
        selectedTask,
        startApiAvailable: Boolean(onStartAssignedTask),
      }),
    [
      codexExecutable,
      isDirty,
      isStarting,
      onStartAssignedTask,
      repoRoot,
      selectedTask,
    ],
  );
  const canStart = preconditionMessages.length === 0;

  async function startAssignedTask() {
    if (!canStart || !onStartAssignedTask || startInFlightRef.current) {
      return;
    }

    startInFlightRef.current = true;
    setIsStarting(true);
    setStartMessage(null);
    setStartedRunId(null);
    setStartError(null);

    try {
      const response = await onStartAssignedTask({
        approvalPolicy,
        codexExecutable,
        queueItemId: selectedTask.queueItemId,
        repoRoot,
        sandbox,
      });
      setStartMessage(
        `Task started in Agent Executor ${shortWidgetInstanceId(
          response.executorWidgetInstanceId,
        )}.`,
      );
      setStartedRunId(response.runId);
    } catch (error) {
      setStartError(queueRunStartErrorMessage(error));
    } finally {
      startInFlightRef.current = false;
      setIsStarting(false);
    }
  }

  return (
    <section
      aria-label="Run assigned Agent Queue task"
      className="agent-queue-run-section"
    >
      <div className="agent-queue-run-header">
        <div>
          <p className="agent-queue-run-title">Run assigned task</p>
          <p className="agent-queue-run-copy">
            Running starts the task in the assigned Agent Executor.
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
        Agent Executor owns live logs, result, validation, diff, and stop
        controls. Queue only tracks task status and assignment.
      </p>

      <div className="agent-queue-run-controls">
        <div className="agent-queue-run-field agent-queue-run-field-wide">
          <label className="field-label" htmlFor={repoRootInputId}>
            Repo root
          </label>
          <Input
            autoComplete="off"
            id={repoRootInputId}
            onChange={(event) => {
              setRepoRootDraft(event.currentTarget.value);
              setStartError(null);
            }}
            placeholder="C:\\path\\to\\repo"
            spellCheck={false}
            type="text"
            value={repoRootDraft}
          />
          <p className="agent-queue-run-note">
            Queue tasks do not store repo roots. Enter the approved root for
            this run.
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
              setCodexExecutableDraft(event.currentTarget.value);
              setStartError(null);
            }}
            spellCheck={false}
            type="text"
            value={codexExecutableDraft}
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
              setSandbox(event.currentTarget.value as DirectWorkSandbox)
            }
            value={sandbox}
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
              setApprovalPolicy(event.currentTarget.value as DirectWorkApprovalPolicy)
            }
            value={approvalPolicy}
          >
            <option value="never">never</option>
            <option value="on_request">on_request</option>
            <option value="untrusted">untrusted</option>
          </select>
        </div>
      </div>

      {preconditionMessages.length > 0 ? (
        <div className="agent-queue-run-warning-list">
          {preconditionMessages.map((message) => (
            <p className="agent-queue-run-warning" key={message}>
              {message}
            </p>
          ))}
        </div>
      ) : null}

      <div className="agent-queue-run-actions">
        <Button
          disabled={!canStart}
          onClick={() => void startAssignedTask()}
          variant="primary"
        >
          {isStarting ? "Starting" : "Run assigned task"}
        </Button>
        <p className="agent-queue-run-note">
          Open the assigned Agent Executor for live logs and result.
        </p>
      </div>

      {startMessage ? (
        <>
          <p className="agent-queue-message agent-queue-message-success">
            {startMessage}
            {startedRunId ? ` Run id: ${startedRunId}.` : ""}
          </p>
          <p className="agent-queue-run-note">
            Live logs and result are shown in the assigned Agent Executor.
            Use Refresh to update Queue status after the Executor reaches a
            final state.
          </p>
        </>
      ) : null}
      {startError ? (
        <p className="agent-queue-message agent-queue-message-error" role="alert">
          {startError}
        </p>
      ) : null}
    </section>
  );
}

function runPreconditionMessages({
  codexExecutable,
  isDirty,
  isStarting,
  repoRoot,
  selectedTask,
  startApiAvailable,
}: {
  codexExecutable: string;
  isDirty: boolean;
  isStarting: boolean;
  repoRoot: string;
  selectedTask: AgentQueueTask;
  startApiAvailable: boolean;
}) {
  const messages: string[] = [];

  if (!startApiAvailable) {
    messages.push("Agent Queue execution is not available in this runtime.");
  }

  if (!selectedTask.assignedExecutorWidgetId) {
    messages.push("Assign this task to an Agent Executor before running.");
  }

  if (selectedTask.status === "draft") {
    messages.push("Set status to queued, ready, or review needed before running.");
  } else if (selectedTask.status === "running") {
    messages.push("This task is already running.");
  } else if (isFinalQueueTaskStatus(selectedTask.status)) {
    messages.push("Final-status tasks cannot be run in this version.");
  } else if (!isRunnableQueueTaskStatus(selectedTask.status)) {
    messages.push(`Task status cannot be run: ${statusLabel(selectedTask.status)}.`);
  }

  if (!selectedTask.prompt.trim()) {
    messages.push("Task prompt is required before running.");
  }

  if (isDirty) {
    messages.push("Save task edits before running.");
  }

  if (!repoRoot) {
    messages.push("Repository root is required before running.");
  }

  if (!codexExecutable) {
    messages.push("Codex executable is required before running.");
  }

  if (isStarting) {
    messages.push("Run request is already in flight.");
  }

  return messages;
}

function isRunnableQueueTaskStatus(status: string) {
  return status === "queued" || status === "ready" || status === "review_needed";
}

function queueRunStartErrorMessage(error: unknown) {
  const message = errorToMessage(error, "Unable to start assigned queue task.");

  if (/already has an active Direct Work run/i.test(message)) {
    return "Assigned Agent Executor is already running another task.";
  }

  if (/repo root must not be empty/i.test(message)) {
    return "Repository root is required before running.";
  }

  if (/queue task status cannot be run/i.test(message)) {
    return message;
  }

  return message;
}

function defaultCodexExecutable(): string {
  if (typeof navigator === "undefined") {
    return DEFAULT_CODEX_EXECUTABLE;
  }

  const platformText = `${navigator.userAgent} ${navigator.platform}`;
  return /(Windows|Win32|Win64|WOW64)/i.test(platformText)
    ? WINDOWS_CODEX_EXECUTABLE
    : DEFAULT_CODEX_EXECUTABLE;
}
