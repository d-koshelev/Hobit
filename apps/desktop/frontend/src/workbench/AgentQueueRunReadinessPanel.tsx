import { useId } from "react";
import { Badge } from "../design-system/Badge";
import { Button } from "../design-system/Button";
import { Input } from "../design-system/Input";
import type { BadgeVariant } from "./agentQueueFormatting";
import {
  assignmentLabel,
  statusLabel,
  type AgentWorkerSummary,
  type QueueGlobalStatus,
} from "./agentQueueTaskUiModel";
import type {
  AgentQueueTask,
  DirectWorkApprovalPolicy,
  DirectWorkSandbox,
} from "../workspace/types";
import type { AgentExecutorSlot } from "./types";
import type { AgentQueueRunController } from "./queue/useAgentQueueController";
import type { AgentQueueAssignedWorkerRoutingState } from "./queue/agentQueueRoutingModel";

type AgentQueueRunReadinessPanelProps = {
  canAssignSelectedWorker: boolean;
  canPromoteDraftToQueued: boolean;
  currentSelection: string;
  executorSlots: AgentExecutorSlot[];
  globalExecutionState: QueueGlobalStatus;
  hasExecutorSlots: boolean;
  isAssigning: boolean;
  onAssignSelectedWorker: () => void;
  onPromoteDraftToQueued: () => void;
  onStartWorkers: () => void;
  routingState?: AgentQueueAssignedWorkerRoutingState;
  run: AgentQueueRunController;
  selectedTask: AgentQueueTask;
  selectedWorker?: AgentWorkerSummary;
};

export function AgentQueueRunReadinessPanel({
  canAssignSelectedWorker,
  canPromoteDraftToQueued,
  currentSelection,
  executorSlots,
  globalExecutionState,
  hasExecutorSlots,
  isAssigning,
  onAssignSelectedWorker,
  onPromoteDraftToQueued,
  onStartWorkers,
  routingState,
  run,
  selectedTask,
  selectedWorker,
}: AgentQueueRunReadinessPanelProps) {
  const repoRootInputId = useId();
  const codexExecutableInputId = useId();
  const sandboxInputId = useId();
  const approvalPolicyInputId = useId();
  const checklist = buildPrepareLocalRunChecklist({
    canAssignSelectedWorker,
    canPromoteDraftToQueued,
    currentSelection,
    executorSlots,
    globalExecutionState,
    hasExecutorSlots,
    isAssigning,
    onAssignSelectedWorker,
    onPromoteDraftToQueued,
    onStartWorkers,
    routingState,
    run,
    selectedTask,
    selectedWorker,
  });

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

      <div
        aria-label="Prepare local run checklist"
        className="agent-queue-prepare-local-run"
      >
        <div className="agent-queue-prepare-header">
          <div>
            <p className="agent-queue-prepare-title">Prepare local run</p>
            <p className="agent-queue-run-note">
              Check the local gates before starting the assigned task.
            </p>
          </div>
          <Badge
            variant={checklist.every((item) => item.state === "ok") ? "success" : "warning"}
          >
            {checklist.every((item) => item.state === "ok")
              ? "Ready"
              : "Needs setup"}
          </Badge>
        </div>
        <div className="agent-queue-prepare-list">
          {checklist.map((item) => (
            <div className="agent-queue-prepare-item" key={item.label}>
              <div className="agent-queue-prepare-item-main">
                <Badge variant={item.badgeVariant}>{item.badge}</Badge>
                <div>
                  <p className="agent-queue-prepare-item-title">{item.label}</p>
                  <p className="agent-queue-prepare-item-copy">{item.copy}</p>
                </div>
              </div>
              {item.action ? (
                <Button
                  disabled={item.action.disabled}
                  onClick={item.action.onClick}
                  variant={item.action.variant}
                >
                  {item.action.label}
                </Button>
              ) : null}
            </div>
          ))}
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
            <option value="danger_full_access">
              danger_full_access (unsafe local dev)
            </option>
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
      {run.sandbox === "danger_full_access" ? (
        <p className="agent-queue-run-warning" role="alert">
          danger_full_access is unsafe and intended only for trusted local
          development. It disables Codex sandbox restrictions. Git mutations
          remain forbidden unless explicitly requested; Hobit will still not
          auto-commit, push, reset, clean, stash, or roll back changes.
        </p>
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

type PrepareLocalRunChecklistItem = {
  action?: {
    disabled?: boolean;
    label: string;
    onClick: () => void;
    variant: "primary" | "secondary" | "ghost";
  };
  badge: "OK" | "Blocked" | "Fix";
  badgeVariant: BadgeVariant;
  copy: string;
  label: string;
  state: "ok" | "blocker" | "fix";
};

function buildPrepareLocalRunChecklist({
  canAssignSelectedWorker,
  canPromoteDraftToQueued,
  currentSelection,
  executorSlots,
  globalExecutionState,
  hasExecutorSlots,
  isAssigning,
  onAssignSelectedWorker,
  onPromoteDraftToQueued,
  onStartWorkers,
  routingState,
  run,
  selectedTask,
  selectedWorker,
}: Omit<AgentQueueRunReadinessPanelProps, "run"> & {
  run: AgentQueueRunController;
}): PrepareLocalRunChecklistItem[] {
  const items: PrepareLocalRunChecklistItem[] = [];
  const assignedWorkerId =
    selectedTask.assignedWorkerId ?? selectedTask.assignedExecutorWidgetId;
  const selectedExecutorLabel =
    executorSlots.find((slot) => slot.widgetInstanceId === currentSelection)
      ?.label ?? assignmentLabel(currentSelection || null);

  items.push(
    hasExecutorSlots
      ? okItem(
          "Agent Executor availability",
          `${executorSlots.length.toString()} Agent Executor slot${
            executorSlots.length === 1 ? "" : "s"
          } visible.`,
        )
      : blockedItem(
          "Agent Executor availability",
          "No Agent Executor available. Add an Agent Executor widget to run Queue tasks.",
        ),
  );

  if (globalExecutionState === "started") {
    items.push(okItem("Queue START/STOP state", "Queue is in START state."));
  } else if (globalExecutionState === "stop_kill_requested") {
    items.push({
      action: {
        label: "START",
        onClick: onStartWorkers,
        variant: "secondary",
      },
      ...blockedItem(
        "Queue START/STOP state",
        "STOP + KILL RUNNING is requested. Review running work or click START before starting new work.",
      ),
    });
  } else {
    items.push({
      action: {
        label: "START",
        onClick: onStartWorkers,
        variant: "secondary",
      },
      ...blockedItem(
        "Queue START/STOP state",
        "Queue is stopped. Click START before running the selected task.",
      ),
    });
  }

  items.push(
    run.repoRootDraft.trim()
      ? okItem("Execution workspace", run.repoRootDraft.trim())
      : fixItem(
          "Execution workspace",
          "Set workspace to the Hobit repo root before running this task.",
        ),
  );

  items.push(
    run.codexExecutableDraft.trim()
      ? okItem("Codex executable", run.codexExecutableDraft.trim())
      : fixItem(
          "Codex executable",
          "Codex executable is required before running. Set the executable in this field.",
        ),
  );

  items.push(sandboxChecklistItem(run.sandbox));

  items.push(
    okItem("Approval policy", `${run.approvalPolicy} selected for this run.`),
  );

  items.push(
    taskStatusChecklistItem({
      canPromoteDraftToQueued,
      onPromoteDraftToQueued,
      selectedTask,
    }),
  );

  if (!assignedWorkerId) {
    items.push({
      action: hasExecutorSlots
        ? {
            disabled: !canAssignSelectedWorker,
            label: isAssigning ? "Assigning" : "Assign",
            onClick: onAssignSelectedWorker,
            variant: "secondary",
          }
        : undefined,
      ...blockedItem(
        "Worker / executor assignment",
        hasExecutorSlots
          ? `Assign a Worker / Executor before running. Current selection: ${selectedExecutorLabel}.`
          : "Assign a Worker / Executor before running.",
      ),
    });
  } else if (selectedWorker && !selectedWorker.enabled) {
    items.push(
      blockedItem(
        "Worker / executor assignment",
        "Selected worker is disabled. Enable it before assigning new work.",
      ),
    );
  } else if (routingState && !routingState.canTake) {
    items.push(
      blockedItem(
        "Worker / executor assignment",
        routingState.blockedReasons[0]?.label ??
          "Assigned worker cannot take this task yet.",
      ),
    );
  } else {
    items.push(
      okItem(
        "Worker / executor assignment",
        `${assignmentLabel(assignedWorkerId)} is assigned.`,
      ),
    );
  }

  return items;
}

function taskStatusChecklistItem({
  canPromoteDraftToQueued,
  onPromoteDraftToQueued,
  selectedTask,
}: {
  canPromoteDraftToQueued: boolean;
  onPromoteDraftToQueued: () => void;
  selectedTask: AgentQueueTask;
}): PrepareLocalRunChecklistItem {
  switch (selectedTask.status) {
    case "queued":
    case "ready":
    case "review_needed":
      return okItem(
        "Task execution status",
        `${statusLabel(selectedTask.status)} is runnable for manual Queue start.`,
      );
    case "draft":
      return {
        action: {
          disabled: !canPromoteDraftToQueued,
          label: "Promote to queued",
          onClick: onPromoteDraftToQueued,
          variant: "primary",
        },
        ...blockedItem(
          "Task execution status",
          "Draft tasks are not runnable. Promote to queued or open Task edit and set Execution status to Queued.",
        ),
      };
    case "running":
      return blockedItem(
        "Task execution status",
        "This task is already running in its assigned Agent Executor.",
      );
    case "completed":
    case "failed":
    case "cancelled":
      return blockedItem(
        "Task execution status",
        `Final-status tasks cannot be run in this version. Current status: ${statusLabel(
          selectedTask.status,
        )}.`,
      );
    default:
      return blockedItem(
        "Task execution status",
        `Task status cannot be run: ${statusLabel(selectedTask.status)}.`,
      );
  }
}

function sandboxChecklistItem(
  sandbox: DirectWorkSandbox,
): PrepareLocalRunChecklistItem {
  if (sandbox === "danger_full_access") {
    return okItem(
      "Sandbox mode",
      "danger_full_access selected. Unsafe / trusted local development only.",
    );
  }

  return fixItem(
    "Sandbox mode",
    `${sandbox} selected. This Windows environment may require danger_full_access for local Hobit dogfooding. Change Sandbox to danger_full_access only for trusted local development.`,
  );
}

function okItem(
  label: string,
  copy: string,
): PrepareLocalRunChecklistItem {
  return {
    badge: "OK",
    badgeVariant: "success",
    copy,
    label,
    state: "ok",
  };
}

function blockedItem(
  label: string,
  copy: string,
): PrepareLocalRunChecklistItem {
  return {
    badge: "Blocked",
    badgeVariant: "warning",
    copy,
    label,
    state: "blocker",
  };
}

function fixItem(
  label: string,
  copy: string,
): PrepareLocalRunChecklistItem {
  return {
    badge: "Fix",
    badgeVariant: "warning",
    copy,
    label,
    state: "fix",
  };
}
