import { useState } from "react";
import { Badge } from "../design-system/Badge";
import { Button } from "../design-system/Button";
import type {
  AgentQueueTaskExecutionPolicy,
  AgentQueueTaskStatus,
  DirectWorkApprovalPolicy,
  DirectWorkSandbox,
} from "../workspace/types";
import type { WorkspaceAgentQueueBridge } from "./workspaceAgentQueueBridge";
import {
  EMPTY_WORKSPACE_AGENT_QUEUE_CREATE_DRAFT,
  EMPTY_WORKSPACE_AGENT_QUEUE_UPDATE_DRAFT,
  workspaceAgentQueueActionCardTitle,
  workspaceAgentQueueActionFailureResult,
  workspaceAgentQueueActionSummary,
  workspaceAgentQueueBlockerLabel,
  workspaceAgentQueueCreateRequestFromDraft,
  workspaceAgentQueueNextRecommendedItem,
  workspaceAgentQueueTopBlockers,
  workspaceAgentQueueUpdateDraftHasPatch,
  workspaceAgentQueueUpdateRequestFromDraft,
  type WorkspaceAgentQueueActionCardResult,
  type WorkspaceAgentQueueCreateDraft,
  type WorkspaceAgentQueueUpdateDraft,
} from "./workspaceAgentQueueActions";
import {
  validateWorkspaceAgentQueueIntentDraft,
  workspaceAgentQueueCreateRequestFromIntentDraft,
  workspaceAgentQueueIntentCanApply,
  workspaceAgentQueueIntentPromptPreview,
  workspaceAgentQueueIntentTitle,
  workspaceAgentQueueUpdateRequestFromIntentDraft,
  type WorkspaceAgentQueueCreateIntentDraft,
  type WorkspaceAgentQueueIntentDraft,
  type WorkspaceAgentQueueUpdateIntentDraft,
} from "./workspaceAgentQueueIntent";
import type { QueueWidgetActionName } from "./queue/agentQueueWidgetApiTypes";
import type { QueueWidgetItemSnapshot } from "./queue/agentQueueWidgetApiTypes";

type WorkspaceAgentQueueActionPanelProps = {
  bridge?: WorkspaceAgentQueueBridge;
  onActionResult: (result: WorkspaceAgentQueueActionCardResult) => void;
};

const EXECUTION_POLICY_OPTIONS: AgentQueueTaskExecutionPolicy[] = [
  "manual",
  "auto",
  "after_previous_success",
];
const CREATE_STATUS_OPTIONS: Array<Extract<AgentQueueTaskStatus, "draft" | "queued">> = [
  "draft",
  "queued",
];
const UPDATE_STATUS_OPTIONS: AgentQueueTaskStatus[] = [
  "draft",
  "queued",
  "ready",
  "running",
  "completed",
  "failed",
  "cancelled",
  "review_needed",
];
const SANDBOX_OPTIONS: DirectWorkSandbox[] = [
  "read_only",
  "workspace_write",
  "danger_full_access",
];
const APPROVAL_POLICY_OPTIONS: DirectWorkApprovalPolicy[] = [
  "never",
  "on_request",
  "untrusted",
];

export function WorkspaceAgentQueueActionPanel({
  bridge,
  onActionResult,
}: WorkspaceAgentQueueActionPanelProps) {
  const [createDraft, setCreateDraft] =
    useState<WorkspaceAgentQueueCreateDraft>(
      EMPTY_WORKSPACE_AGENT_QUEUE_CREATE_DRAFT,
    );
  const [updateDraft, setUpdateDraft] =
    useState<WorkspaceAgentQueueUpdateDraft>(
      EMPTY_WORKSPACE_AGENT_QUEUE_UPDATE_DRAFT,
    );
  const [pendingAction, setPendingAction] =
    useState<QueueWidgetActionName | null>(null);

  if (!bridge) {
    return null;
  }
  const queueBridge = bridge;

  async function runQueueAction(
    action: QueueWidgetActionName,
    runner: () => Promise<WorkspaceAgentQueueActionCardResult>,
  ) {
    if (pendingAction) {
      return;
    }

    setPendingAction(action);
    try {
      const result = await runner();
      onActionResult(result);

      if (result.ok && action === "queue.createItem") {
        setCreateDraft(EMPTY_WORKSPACE_AGENT_QUEUE_CREATE_DRAFT);
      }
    } catch (error) {
      onActionResult(workspaceAgentQueueActionFailureResult({ action, error }));
    } finally {
      setPendingAction(null);
    }
  }

  function inspectQueue() {
    void runQueueAction("queue.getSnapshot", () =>
      queueBridge.getSnapshot({
        includeSelectedItem: true,
      }),
    );
  }

  function createQueueItem() {
    void runQueueAction("queue.createItem", () =>
      queueBridge.createItem(
        workspaceAgentQueueCreateRequestFromDraft(createDraft),
      ),
    );
  }

  function updateQueueItem() {
    void runQueueAction("queue.updateItem", () =>
      queueBridge.updateItem(
        workspaceAgentQueueUpdateRequestFromDraft(updateDraft),
      ),
    );
  }

  const canCreate = createDraft.title.trim().length > 0 && !pendingAction;
  const canUpdate =
    updateDraft.itemId.trim().length > 0 &&
    workspaceAgentQueueUpdateDraftHasPatch(updateDraft) &&
    !pendingAction;

  return (
    <section
      aria-label="Workspace Agent Queue actions"
      className="workspace-agent-queue-actions"
    >
      <div className="workspace-agent-queue-actions-header">
        <div>
          <p className="coordinator-proposal-kicker">Agent Queue API</p>
          <p className="coordinator-proposal-note">
            App-native Queue actions. No shell, Codex, or storage edits.
          </p>
        </div>
        <Badge variant="info">Visible action</Badge>
      </div>

      <div className="workspace-agent-queue-actions-row">
        <Button
          disabled={pendingAction === "queue.getSnapshot"}
          onClick={inspectQueue}
          variant="secondary"
        >
          {pendingAction === "queue.getSnapshot" ? "Inspecting" : "Inspect Queue"}
        </Button>
      </div>

      <details className="workspace-agent-queue-action-details">
        <summary>Create Queue item</summary>
        <div className="workspace-agent-queue-action-grid">
          <QueueTextInput
            label="Title"
            onChange={(value) =>
              setCreateDraft((draft) => ({ ...draft, title: value }))
            }
            value={createDraft.title}
          />
          <QueueTextInput
            label="Queue tag"
            onChange={(value) =>
              setCreateDraft((draft) => ({ ...draft, queueTag: value }))
            }
            value={createDraft.queueTag}
          />
          <QueueTextarea
            label="Prompt"
            onChange={(value) =>
              setCreateDraft((draft) => ({ ...draft, prompt: value }))
            }
            value={createDraft.prompt}
          />
          <QueueTextarea
            label="Description"
            onChange={(value) =>
              setCreateDraft((draft) => ({ ...draft, description: value }))
            }
            value={createDraft.description}
          />
          <QueueTextInput
            label="Priority"
            onChange={(value) =>
              setCreateDraft((draft) => ({ ...draft, priority: value }))
            }
            type="number"
            value={createDraft.priority}
          />
          <QueueSelect
            label="Initial status"
            onChange={(value) =>
              setCreateDraft((draft) => ({
                ...draft,
                status: value as WorkspaceAgentQueueCreateDraft["status"],
              }))
            }
            options={CREATE_STATUS_OPTIONS}
            value={createDraft.status}
          />
          <QueueSelect
            label="Execution policy"
            onChange={(value) =>
              setCreateDraft((draft) => ({
                ...draft,
                executionPolicy: value as AgentQueueTaskExecutionPolicy,
              }))
            }
            options={EXECUTION_POLICY_OPTIONS}
            value={createDraft.executionPolicy}
          />
          <QueueTextInput
            label="Execution workspace"
            onChange={(value) =>
              setCreateDraft((draft) => ({
                ...draft,
                executionWorkspace: value,
              }))
            }
            value={createDraft.executionWorkspace}
          />
          <QueueTextInput
            label="Codex executable"
            onChange={(value) =>
              setCreateDraft((draft) => ({
                ...draft,
                codexExecutable: value,
              }))
            }
            value={createDraft.codexExecutable}
          />
          <QueueSelect
            allowBlank
            label="Sandbox"
            onChange={(value) =>
              setCreateDraft((draft) => ({
                ...draft,
                sandbox: value as WorkspaceAgentQueueCreateDraft["sandbox"],
              }))
            }
            options={SANDBOX_OPTIONS}
            value={createDraft.sandbox}
          />
          <QueueSelect
            allowBlank
            label="Approval policy"
            onChange={(value) =>
              setCreateDraft((draft) => ({
                ...draft,
                approvalPolicy:
                  value as WorkspaceAgentQueueCreateDraft["approvalPolicy"],
              }))
            }
            options={APPROVAL_POLICY_OPTIONS}
            value={createDraft.approvalPolicy}
          />
        </div>
        <div className="workspace-agent-queue-actions-row">
          <Button
            disabled={!canCreate}
            onClick={createQueueItem}
            variant="primary"
          >
            {pendingAction === "queue.createItem"
              ? "Creating"
              : "Create Queue item"}
          </Button>
        </div>
      </details>

      <details className="workspace-agent-queue-action-details">
        <summary>Update Queue item</summary>
        <div className="workspace-agent-queue-action-grid">
          <QueueTextInput
            label="Item id"
            onChange={(value) =>
              setUpdateDraft((draft) => ({ ...draft, itemId: value }))
            }
            value={updateDraft.itemId}
          />
          <QueueTextInput
            label="Title"
            onChange={(value) =>
              setUpdateDraft((draft) => ({ ...draft, title: value }))
            }
            value={updateDraft.title}
          />
          <QueueTextarea
            label="Prompt"
            onChange={(value) =>
              setUpdateDraft((draft) => ({ ...draft, prompt: value }))
            }
            value={updateDraft.prompt}
          />
          <QueueTextarea
            label="Description"
            onChange={(value) =>
              setUpdateDraft((draft) => ({ ...draft, description: value }))
            }
            value={updateDraft.description}
          />
          <QueueTextInput
            label="Queue tag"
            onChange={(value) =>
              setUpdateDraft((draft) => ({ ...draft, queueTag: value }))
            }
            value={updateDraft.queueTag}
          />
          <QueueTextInput
            label="Priority"
            onChange={(value) =>
              setUpdateDraft((draft) => ({ ...draft, priority: value }))
            }
            type="number"
            value={updateDraft.priority}
          />
          <QueueSelect
            allowBlank
            label="Status"
            onChange={(value) =>
              setUpdateDraft((draft) => ({
                ...draft,
                status: value as WorkspaceAgentQueueUpdateDraft["status"],
              }))
            }
            options={UPDATE_STATUS_OPTIONS}
            value={updateDraft.status}
          />
          <QueueSelect
            allowBlank
            label="Execution policy"
            onChange={(value) =>
              setUpdateDraft((draft) => ({
                ...draft,
                executionPolicy:
                  value as WorkspaceAgentQueueUpdateDraft["executionPolicy"],
              }))
            }
            options={EXECUTION_POLICY_OPTIONS}
            value={updateDraft.executionPolicy}
          />
          <QueueTextInput
            label="Execution workspace"
            onChange={(value) =>
              setUpdateDraft((draft) => ({
                ...draft,
                executionWorkspace: value,
              }))
            }
            value={updateDraft.executionWorkspace}
          />
          <QueueTextInput
            label="Codex executable"
            onChange={(value) =>
              setUpdateDraft((draft) => ({
                ...draft,
                codexExecutable: value,
              }))
            }
            value={updateDraft.codexExecutable}
          />
          <QueueSelect
            allowBlank
            label="Sandbox"
            onChange={(value) =>
              setUpdateDraft((draft) => ({
                ...draft,
                sandbox: value as WorkspaceAgentQueueUpdateDraft["sandbox"],
              }))
            }
            options={SANDBOX_OPTIONS}
            value={updateDraft.sandbox}
          />
          <QueueSelect
            allowBlank
            label="Approval policy"
            onChange={(value) =>
              setUpdateDraft((draft) => ({
                ...draft,
                approvalPolicy:
                  value as WorkspaceAgentQueueUpdateDraft["approvalPolicy"],
              }))
            }
            options={APPROVAL_POLICY_OPTIONS}
            value={updateDraft.approvalPolicy}
          />
        </div>
        <div className="workspace-agent-queue-actions-row">
          <Button
            disabled={!canUpdate}
            onClick={updateQueueItem}
            variant="primary"
          >
            {pendingAction === "queue.updateItem"
              ? "Updating"
              : "Update Queue item"}
          </Button>
        </div>
      </details>
    </section>
  );
}

export function WorkspaceAgentQueueActionResultCard({
  result,
}: {
  result: WorkspaceAgentQueueActionCardResult;
}) {
  const title = workspaceAgentQueueActionCardTitle(result);
  const summary = workspaceAgentQueueActionSummary(result);
  const snapshot = result.snapshot;
  const item = snapshot ? null : queueItemFromResult(result.item);
  const topBlockers = snapshot ? workspaceAgentQueueTopBlockers(snapshot) : [];
  const recommendedItem = snapshot
    ? workspaceAgentQueueNextRecommendedItem(snapshot)
    : null;

  return (
    <section
      aria-label={title}
      className={`workspace-agent-queue-action-card workspace-agent-queue-action-card-${result.ok ? "success" : "error"}`}
    >
      <div className="workspace-agent-queue-action-card-header">
        <div>
          <p className="coordinator-proposal-kicker">{result.action}</p>
          <h4 className="coordinator-proposal-title">{title}</h4>
        </div>
        <Badge variant={result.ok ? "success" : "error"}>
          {result.ok ? "Completed" : "Failed"}
        </Badge>
      </div>

      <p className="coordinator-proposal-section-value">{summary}</p>

      {result.error ? (
        <p className="coordinator-proposal-result coordinator-proposal-result-error">
          {result.error.message}
        </p>
      ) : null}

      {item ? (
        <dl className="workspace-agent-queue-action-card-facts">
          <ActionFact label="Item id" value={item.id} />
          <ActionFact label="Title" value={item.title} />
          <ActionFact label="Status" value={item.status} />
          <ActionFact label="Priority" value={item.priority.toString()} />
          <ActionFact label="Policy" value={item.executionPolicy} />
          {item.queueTag.name ? (
            <ActionFact label="Queue tag" value={item.queueTag.name} />
          ) : null}
          {item.executionWorkspace ? (
            <ActionFact
              label="Execution workspace"
              value={item.executionWorkspace}
            />
          ) : null}
          {item.codexExecutable ? (
            <ActionFact label="Codex executable" value={item.codexExecutable} />
          ) : null}
          {item.sandbox ? <ActionFact label="Sandbox" value={item.sandbox} /> : null}
          {item.approvalPolicy ? (
            <ActionFact label="Approval" value={item.approvalPolicy} />
          ) : null}
        </dl>
      ) : null}

      {snapshot ? (
        <>
          <dl className="workspace-agent-queue-action-card-facts">
            <ActionFact
              label="Total"
              value={snapshot.itemCounts.total.toString()}
            />
            <ActionFact
              label="Queued"
              value={snapshot.itemCounts.queued.toString()}
            />
            <ActionFact
              label="Running"
              value={snapshot.itemCounts.running.toString()}
            />
            <ActionFact
              label="Blocked"
              value={snapshot.itemCounts.blocked.toString()}
            />
            <ActionFact
              label="Report-ready"
              value={snapshot.itemCounts.reportReady.toString()}
            />
            <ActionFact
              label="Finalized"
              value={snapshot.itemCounts.finalized.toString()}
            />
            <ActionFact
              label="Autorun"
              value={
                snapshot.autonomousRunnerState.available
                  ? `${snapshot.autonomousRunnerState.status}${
                      snapshot.autonomousRunnerState.isSessionOnly
                        ? " session-only"
                        : ""
                    }`
                  : "Unavailable"
              }
            />
          </dl>

          {snapshot.selectedItem ? (
            <p className="coordinator-proposal-note">
              Selected item: {snapshot.selectedItem.title} (
              {snapshot.selectedItem.id}) is {snapshot.selectedItem.status}.
            </p>
          ) : null}

          {topBlockers.length > 0 ? (
            <ul className="workspace-agent-queue-action-card-list">
              {topBlockers.map((blocker, index) => (
                <li key={`${blocker.itemId ?? "queue"}-${blocker.code}-${index.toString()}`}>
                  {workspaceAgentQueueBlockerLabel(blocker)}
                </li>
              ))}
            </ul>
          ) : recommendedItem ? (
            <p className="coordinator-proposal-note">
              Next recommended item: {recommendedItem.title} (
              {recommendedItem.id}).
            </p>
          ) : null}
        </>
      ) : null}

      <p className="coordinator-proposal-note">
        Result is a safe Queue API summary. No execution, delete, Queue Autorun,
        Codex run, Terminal command, Git mutation, or coordinator finalization
        was started.
      </p>
    </section>
  );
}

export function WorkspaceAgentQueueIntentDraftCard({
  bridge,
  draft,
  onActionResult,
  onDiscard,
  onPatchDraft,
}: {
  bridge?: WorkspaceAgentQueueBridge;
  draft: WorkspaceAgentQueueIntentDraft;
  onActionResult: (result: WorkspaceAgentQueueActionCardResult) => void;
  onDiscard: (draftId: string) => void;
  onPatchDraft: (
    draftId: string,
    patch: Partial<WorkspaceAgentQueueIntentDraft>,
  ) => void;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [pendingAction, setPendingAction] =
    useState<QueueWidgetActionName | null>(null);
  const validation = validateWorkspaceAgentQueueIntentDraft(draft);
  const canApply =
    Boolean(bridge) &&
    workspaceAgentQueueIntentCanApply(draft) &&
    !pendingAction;
  const title = workspaceAgentQueueIntentTitle(draft);
  const actionName =
    draft.intentType === "createItem" ? "queue.createItem" : "queue.updateItem";
  const applyLabel =
    draft.intentType === "createItem" ? "Apply create" : "Apply update";

  async function applyDraft() {
    if (!bridge || !canApply) {
      return;
    }

    setPendingAction(actionName);
    try {
      const result =
        draft.intentType === "createItem"
          ? await bridge.createItem(
              workspaceAgentQueueCreateRequestFromIntentDraft(draft),
            )
          : await bridge.updateItem(
              workspaceAgentQueueUpdateRequestFromIntentDraft(draft),
            );
      onActionResult(result);

      if (result.ok) {
        onDiscard(draft.id);
      }
    } catch (error) {
      onActionResult(
        workspaceAgentQueueActionFailureResult({
          action: actionName,
          error,
        }),
      );
    } finally {
      setPendingAction(null);
    }
  }

  return (
    <section
      aria-label={title}
      className="workspace-agent-queue-action-card workspace-agent-queue-intent-card"
    >
      <div className="workspace-agent-queue-action-card-header">
        <div>
          <p className="coordinator-proposal-kicker">{actionName}</p>
          <h4 className="coordinator-proposal-title">{title}</h4>
        </div>
        <Badge variant={validation.blockingMessages.length > 0 ? "warning" : "info"}>
          {validation.blockingMessages.length > 0
            ? "Needs review"
            : "Ready to apply"}
        </Badge>
      </div>

      <dl className="workspace-agent-queue-action-card-facts">
        <ActionFact label="Action type" value={draft.intentType} />
        {draft.intentType === "updateItem" ? (
          <ActionFact
            label="Target item"
            value={draft.itemId.trim() || "Missing"}
          />
        ) : null}
        <ActionFact label="Title" value={draft.title.trim() || "Missing"} />
        <ActionFact label="Status" value={draft.status || "Preserve"} />
        <ActionFact label="Queue tag" value={draft.queueTag.trim() || "None"} />
        <ActionFact label="Priority" value={draft.priority.trim() || "Preserve"} />
        <ActionFact
          label="Policy"
          value={draft.executionPolicy || "Preserve"}
        />
        <ActionFact
          label="Task workspace"
          value={draft.executionWorkspace.trim() || "Not set"}
        />
        <ActionFact
          label="Codex executable"
          value={draft.codexExecutable.trim() || "Not set"}
        />
        <ActionFact label="Sandbox" value={draft.sandbox || "Not set"} />
        <ActionFact
          label="Approval policy"
          value={draft.approvalPolicy || "Not set"}
        />
      </dl>

      <div className="coordinator-proposal-section">
        <p className="coordinator-proposal-section-label">Prompt preview</p>
        <p className="coordinator-proposal-section-value">
          {workspaceAgentQueueIntentPromptPreview(draft)}
        </p>
      </div>

      {validation.blockingMessages.length > 0 ? (
        <div
          aria-label="Queue intent validation"
          className="workspace-agent-queue-intent-validation"
        >
          {validation.blockingMessages.map((message) => (
            <p key={message}>{message}</p>
          ))}
        </div>
      ) : null}

      {isEditing ? (
        <WorkspaceAgentQueueIntentDraftFields
          draft={draft}
          onPatchDraft={(patch) => onPatchDraft(draft.id, patch)}
        />
      ) : null}

      <div className="coordinator-proposal-actions">
        <Button
          disabled={!canApply}
          onClick={() => void applyDraft()}
          variant="primary"
        >
          {pendingAction ? "Applying" : applyLabel}
        </Button>
        <Button
          onClick={() => setIsEditing((current) => !current)}
          variant="secondary"
        >
          {isEditing ? "Done editing" : "Edit fields"}
        </Button>
        <Button onClick={() => onDiscard(draft.id)} variant="ghost">
          Discard draft
        </Button>
      </div>

      <p className="coordinator-proposal-note">
        Applying uses the Queue Widget API bridge only. It does not run the
        task, start Queue Autorun, call Codex, launch Terminal, delete items, or
        finalize coordinator state.
      </p>
    </section>
  );
}

function WorkspaceAgentQueueIntentDraftFields({
  draft,
  onPatchDraft,
}: {
  draft: WorkspaceAgentQueueIntentDraft;
  onPatchDraft: (patch: Partial<WorkspaceAgentQueueIntentDraft>) => void;
}) {
  if (draft.intentType === "createItem") {
    return (
      <div
        aria-label="Edit Queue create intent fields"
        className="workspace-agent-queue-action-grid"
      >
        <QueueTextInput
          label="Title"
          onChange={(title) => onPatchDraft({ title })}
          value={draft.title}
        />
        <QueueTextInput
          label="Queue tag"
          onChange={(queueTag) => onPatchDraft({ queueTag })}
          value={draft.queueTag}
        />
        <QueueTextarea
          label="Prompt"
          onChange={(prompt) => onPatchDraft({ prompt })}
          value={draft.prompt}
        />
        <QueueTextarea
          label="Description"
          onChange={(description) => onPatchDraft({ description })}
          value={draft.description}
        />
        <QueueTextInput
          label="Priority"
          onChange={(priority) => onPatchDraft({ priority })}
          type="number"
          value={draft.priority}
        />
        <QueueSelect
          label="Initial status"
          onChange={(status) =>
            onPatchDraft({
              status: status as WorkspaceAgentQueueCreateIntentDraft["status"],
            })
          }
          options={CREATE_STATUS_OPTIONS}
          value={draft.status}
        />
        <QueueSelect
          label="Execution policy"
          onChange={(executionPolicy) =>
            onPatchDraft({
              executionPolicy:
                executionPolicy as AgentQueueTaskExecutionPolicy,
            })
          }
          options={EXECUTION_POLICY_OPTIONS}
          value={draft.executionPolicy}
        />
        <QueueRunSettingFields draft={draft} onPatchDraft={onPatchDraft} />
      </div>
    );
  }

  return (
    <div
      aria-label="Edit Queue update intent fields"
      className="workspace-agent-queue-action-grid"
    >
      <QueueTextInput
        label="Item id"
        onChange={(itemId) => onPatchDraft({ itemId })}
        value={draft.itemId}
      />
      <QueueTextInput
        label="Title"
        onChange={(title) => onPatchDraft({ title })}
        value={draft.title}
      />
      <QueueTextarea
        label="Prompt"
        onChange={(prompt) => onPatchDraft({ prompt })}
        value={draft.prompt}
      />
      <QueueTextarea
        label="Description"
        onChange={(description) => onPatchDraft({ description })}
        value={draft.description}
      />
      <QueueTextInput
        label="Queue tag"
        onChange={(queueTag) => onPatchDraft({ queueTag })}
        value={draft.queueTag}
      />
      <QueueTextInput
        label="Priority"
        onChange={(priority) => onPatchDraft({ priority })}
        type="number"
        value={draft.priority}
      />
      <QueueSelect
        allowBlank
        label="Status"
        onChange={(status) =>
          onPatchDraft({
            status: status as WorkspaceAgentQueueUpdateIntentDraft["status"],
          })
        }
        options={UPDATE_STATUS_OPTIONS}
        value={draft.status}
      />
      <QueueSelect
        allowBlank
        label="Execution policy"
        onChange={(executionPolicy) =>
          onPatchDraft({
            executionPolicy:
              executionPolicy as WorkspaceAgentQueueUpdateIntentDraft["executionPolicy"],
          })
        }
        options={EXECUTION_POLICY_OPTIONS}
        value={draft.executionPolicy}
      />
      <QueueRunSettingFields draft={draft} onPatchDraft={onPatchDraft} />
      <QueueTextarea
        label="Dependencies"
        onChange={(value) =>
          onPatchDraft({
            dependencies: value
              .split(/[\n,;]/)
              .map((entry) => entry.trim())
              .filter(Boolean),
          })
        }
        value={draft.dependencies.join("\n")}
      />
    </div>
  );
}

function QueueRunSettingFields({
  draft,
  onPatchDraft,
}: {
  draft: WorkspaceAgentQueueIntentDraft;
  onPatchDraft: (patch: Partial<WorkspaceAgentQueueIntentDraft>) => void;
}) {
  return (
    <>
      <QueueTextInput
        label="Execution workspace"
        onChange={(executionWorkspace) => onPatchDraft({ executionWorkspace })}
        value={draft.executionWorkspace}
      />
      <QueueTextInput
        label="Codex executable"
        onChange={(codexExecutable) => onPatchDraft({ codexExecutable })}
        value={draft.codexExecutable}
      />
      <QueueSelect
        allowBlank
        label="Sandbox"
        onChange={(sandbox) =>
          onPatchDraft({
            sandbox: sandbox as WorkspaceAgentQueueIntentDraft["sandbox"],
          })
        }
        options={SANDBOX_OPTIONS}
        value={draft.sandbox}
      />
      <QueueSelect
        allowBlank
        label="Approval policy"
        onChange={(approvalPolicy) =>
          onPatchDraft({
            approvalPolicy:
              approvalPolicy as WorkspaceAgentQueueIntentDraft["approvalPolicy"],
          })
        }
        options={APPROVAL_POLICY_OPTIONS}
        value={draft.approvalPolicy}
      />
    </>
  );
}

function QueueTextInput({
  label,
  onChange,
  type = "text",
  value,
}: {
  label: string;
  onChange: (value: string) => void;
  type?: "number" | "text";
  value: string;
}) {
  return (
    <label className="workspace-agent-queue-action-field">
      <span>{label}</span>
      <input
        aria-label={label}
        className="input"
        onChange={(event) => onChange(event.currentTarget.value)}
        type={type}
        value={value}
      />
    </label>
  );
}

function QueueTextarea({
  label,
  onChange,
  value,
}: {
  label: string;
  onChange: (value: string) => void;
  value: string;
}) {
  return (
    <label className="workspace-agent-queue-action-field">
      <span>{label}</span>
      <textarea
        aria-label={label}
        className="input workspace-agent-queue-action-textarea"
        onChange={(event) => onChange(event.currentTarget.value)}
        rows={2}
        value={value}
      />
    </label>
  );
}

function QueueSelect({
  allowBlank = false,
  label,
  onChange,
  options,
  value,
}: {
  allowBlank?: boolean;
  label: string;
  onChange: (value: string) => void;
  options: string[];
  value: string;
}) {
  return (
    <label className="workspace-agent-queue-action-field">
      <span>{label}</span>
      <select
        aria-label={label}
        className="input"
        onChange={(event) => onChange(event.currentTarget.value)}
        value={value}
      >
        {allowBlank ? <option value="">Preserve</option> : null}
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </label>
  );
}

function ActionFact({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

function queueItemFromResult(
  item: WorkspaceAgentQueueActionCardResult["item"],
): QueueWidgetItemSnapshot | null {
  if (item && "queueTag" in item && "status" in item) {
    return item;
  }

  return null;
}
