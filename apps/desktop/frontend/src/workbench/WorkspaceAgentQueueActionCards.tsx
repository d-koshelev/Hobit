import { useState } from "react";
import { Badge } from "../design-system/Badge";
import { Button } from "../design-system/Button";
import type { AgentQueueTaskExecutionPolicy } from "../workspace/types";
import {
  APPROVAL_POLICY_OPTIONS,
  CREATE_STATUS_OPTIONS,
  EXECUTION_POLICY_OPTIONS,
  QueueSelect,
  QueueTextarea,
  QueueTextInput,
  SANDBOX_OPTIONS,
  UPDATE_STATUS_OPTIONS,
} from "./WorkspaceAgentQueueActionCardShared";
import { WorkspaceAgentQueueCreateDraftCard } from "./WorkspaceAgentQueueCreateDraftCard";
import { WorkspaceAgentQueueUpdateDraftCard } from "./WorkspaceAgentQueueUpdateDraftCard";
import type { WorkspaceAgentQueueBridge } from "./workspaceAgentQueueBridge";
import {
  EMPTY_WORKSPACE_AGENT_QUEUE_CREATE_DRAFT,
  EMPTY_WORKSPACE_AGENT_QUEUE_UPDATE_DRAFT,
  workspaceAgentQueueActionFailureResult,
  workspaceAgentQueueCreateRequestFromDraft,
  workspaceAgentQueueUpdateDraftHasPatch,
  workspaceAgentQueueUpdateRequestFromDraft,
  type WorkspaceAgentQueueActionCardResult,
  type WorkspaceAgentQueueCreateDraft,
  type WorkspaceAgentQueueUpdateDraft,
} from "./workspaceAgentQueueActions";
import {
  type WorkspaceAgentQueueIntentDraft,
} from "./workspaceAgentQueueIntent";
import type { QueueWidgetActionName } from "./queue/agentQueueWidgetApiTypes";

type WorkspaceAgentQueueActionPanelProps = {
  bridge?: WorkspaceAgentQueueBridge;
  onActionResult: (result: WorkspaceAgentQueueActionCardResult) => void;
};

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
  if (draft.intentType === "createItem") {
    return (
      <WorkspaceAgentQueueCreateDraftCard
        bridge={bridge}
        draft={draft}
        onActionResult={onActionResult}
        onDiscard={onDiscard}
        onPatchDraft={onPatchDraft}
      />
    );
  }

  return (
    <WorkspaceAgentQueueUpdateDraftCard
      bridge={bridge}
      draft={draft}
      onActionResult={onActionResult}
      onDiscard={onDiscard}
      onPatchDraft={onPatchDraft}
    />
  );
}

export { WorkspaceAgentQueueActionResultCard } from "./WorkspaceAgentQueueResultCard";
