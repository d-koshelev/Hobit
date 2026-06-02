import { useId } from "react";
import { Button } from "../design-system/Button";
import { Input } from "../design-system/Input";
import type { BadgeVariant } from "./agentQueueFormatting";
import {
  assignmentLabel,
  statusLabel,
  type AgentWorkerSummary,
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
  hasExecutorSlots: boolean;
  isAssigning: boolean;
  onAssignSelectedWorker: () => void;
  onPromoteDraftToQueued: () => void;
  routingState?: AgentQueueAssignedWorkerRoutingState;
  run: AgentQueueRunController;
  selectedTask: AgentQueueTask;
  selectedWorker?: AgentWorkerSummary;
  showRunButton?: boolean;
};

export function AgentQueueRunReadinessPanel({
  canAssignSelectedWorker,
  canPromoteDraftToQueued,
  currentSelection,
  executorSlots,
  hasExecutorSlots,
  isAssigning,
  onAssignSelectedWorker,
  onPromoteDraftToQueued,
  routingState,
  run,
  selectedTask,
  selectedWorker,
  showRunButton = true,
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
    hasExecutorSlots,
    isAssigning,
    onAssignSelectedWorker,
    onPromoteDraftToQueued,
    routingState,
    run,
    selectedTask,
    selectedWorker,
  });
  const blockingChecklist = checklist.filter((item) => item.state !== "ok");
  const settingsNeedSetup =
    !run.repoRootDraft.trim() ||
    !run.codexExecutableDraft.trim() ||
    !run.sandbox ||
    !run.approvalPolicy ||
    run.preconditionMessages.length > 0;

  return (
    <div className="agent-queue-execution-group">
      <div className="agent-queue-execution-group-header">
        <div>
          <p
            className="agent-queue-execution-group-title"
            title="Starts only the selected Queue task."
          >
            Run selected task
          </p>
          <p className="agent-queue-run-note">
            Explicit selected-task run. No work starts until Run task.
          </p>
        </div>
        {showRunButton ? (
          <Button
            disabled={!run.canStart}
            onClick={() => run.onStartAssignedTask()}
            variant="primary"
          >
            {run.isStarting ? "Starting" : "Run task"}
          </Button>
        ) : null}
      </div>

      {blockingChecklist.length > 0 ? (
        <div className="agent-queue-setup-fixes" role="status">
          <p className="agent-queue-setup-fixes-title">Before run</p>
          <div className="agent-queue-compact-blocker-list">
            {blockingChecklist.map((item) => (
              <div className="agent-queue-compact-blocker-row" key={item.label}>
                <span>{item.label}</span>
                <span>{item.copy}</span>
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
      ) : (
        <p className="agent-queue-run-note">
          Ready to run once the operator starts it explicitly.
        </p>
      )}

      {run.sandbox === "danger_full_access" ? (
        <p className="agent-queue-run-warning" role="alert">
          Unsafe local dev mode.
        </p>
      ) : null}

      <details
        className="agent-queue-details agent-queue-secondary-details agent-queue-run-settings-details"
        open={settingsNeedSetup}
      >
        <summary>Execution settings</summary>
        <div className="agent-queue-run-controls">
          <div className="agent-queue-run-field agent-queue-run-field-wide">
            <label
              className="field-label"
              htmlFor={repoRootInputId}
              title="Use an existing repository or local project folder."
            >
              Task workspace
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
              <option value="">Select sandbox</option>
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
              <option value="">Select approval policy</option>
              <option value="never">never</option>
              <option value="on_request">on_request</option>
              <option value="untrusted">untrusted</option>
            </select>
          </div>
        </div>
        {run.hasUnsavedTaskSettings ? (
          <div className="agent-queue-assignment-buttons">
            <Button
              disabled={!selectedTask.title.trim()}
              onClick={() => run.onSaveTaskSettings()}
              variant="secondary"
            >
              Save task settings
            </Button>
          </div>
        ) : null}
      </details>

      {run.startMessage ? (
        <>
          <p className="agent-queue-message agent-queue-message-success">
            {run.startMessage}
            {run.startedRunId ? ` Run id: ${run.startedRunId}.` : ""}
          </p>
          <p className="agent-queue-run-note">
            Result appears in Logs/report when available.
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
  hasExecutorSlots,
  isAssigning,
  onAssignSelectedWorker,
  onPromoteDraftToQueued,
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
  const selectedExecutorIsQueueOwned =
    executorSlots.find((slot) => slot.widgetInstanceId === currentSelection)
      ?.ownerKind === "agent_queue";

  items.push(
    hasExecutorSlots
      ? okItem(
          "Local executor ready",
          `${executorSlots.length.toString()} local slot${
            executorSlots.length === 1 ? "" : "s"
          }.`,
        )
      : blockedItem(
          "Local executor unavailable",
          "No local slot.",
        ),
  );

  items.push(
    run.repoRootDraft.trim()
      ? okItem("Task workspace set", run.repoRootDraft.trim())
      : fixItem(
          "Set task workspace",
          "Choose repo/project path.",
        ),
  );

  items.push(
    run.codexExecutableDraft.trim()
      ? okItem("Codex executable set", run.codexExecutableDraft.trim())
      : fixItem(
          "Set Codex executable",
          "Required before run.",
        ),
  );

  items.push(
    run.sandbox
      ? sandboxChecklistItem(run.sandbox)
      : fixItem("Set sandbox", "Required before run."),
  );

  items.push(
    run.approvalPolicy
      ? okItem("Approval policy", `${run.approvalPolicy} selected for this task.`)
      : fixItem("Set approval policy", "Required before run."),
  );

  items.push(
    taskStatusChecklistItem({
      canPromoteDraftToQueued,
      onPromoteDraftToQueued,
      selectedTask,
    }),
  );

  if ((run.usesDefaultExecutorOnStart || selectedExecutorIsQueueOwned) && currentSelection) {
    items.push(
      okItem(
        "Local executor selected",
        selectedExecutorLabel,
      ),
    );
  } else if (!assignedWorkerId && hasExecutorSlots) {
    items.push({
      action: {
        disabled: !canAssignSelectedWorker,
        label: isAssigning ? "Assigning" : "Assign",
        onClick: onAssignSelectedWorker,
        variant: "secondary",
      },
      ...blockedItem(
        "Select local executor",
        selectedExecutorLabel,
      ),
    });
  } else if (selectedWorker && !selectedWorker.enabled) {
    items.push(
      blockedItem(
        "Local executor unavailable",
        "Selected worker disabled.",
      ),
    );
  } else if (manualRunRoutingBlocker(routingState)) {
    const blocker = routingState?.blockedReasons.find(
      (reason) => reason.code !== "queue_stopped",
    );
    items.push(
      blockedItem(
        "Local executor unavailable",
        blocker?.label ?? "Assigned worker blocked.",
      ),
    );
  } else {
    items.push(
      okItem(
        "Local executor selected",
        assignmentLabel(assignedWorkerId),
      ),
    );
  }

  return items;
}

function manualRunRoutingBlocker(
  routingState?: AgentQueueAssignedWorkerRoutingState,
) {
  if (!routingState || routingState.canTake) {
    return false;
  }

  return routingState.blockedReasons.some(
    (reason) => reason.code !== "queue_stopped",
  );
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
        "Task runnable",
        statusLabel(selectedTask.status),
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
          "Promote to queued",
          "Draft task.",
        ),
      };
    case "running":
      return blockedItem(
        "Task already running",
        "Wait for result.",
      );
    case "completed":
    case "failed":
    case "cancelled":
      return blockedItem(
        "Task final",
        statusLabel(selectedTask.status),
      );
    default:
      return blockedItem(
        "Task not runnable",
        statusLabel(selectedTask.status),
      );
  }
}

function sandboxChecklistItem(
  sandbox: DirectWorkSandbox,
): PrepareLocalRunChecklistItem {
  if (sandbox === "danger_full_access") {
    return okItem(
      "Sandbox selected",
      "Unsafe local dev mode.",
    );
  }

  return okItem("Sandbox selected", sandbox);
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
