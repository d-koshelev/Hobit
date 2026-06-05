import { useState } from "react";
import { Badge } from "../design-system/Badge";
import { Button } from "../design-system/Button";
import {
  RENDER_MEMORY_CAPS,
  cappedPreviewText,
} from "../renderMemoryGuards";
import {
  ActionFact,
  EXECUTION_POLICY_OPTIONS,
  QueueRunSettingFields,
  QueueSelect,
  QueueTextarea,
  QueueTextInput,
  UPDATE_STATUS_OPTIONS,
} from "./WorkspaceAgentQueueActionCardShared";
import type { WorkspaceAgentQueueBridge } from "./workspaceAgentQueueBridge";
import {
  workspaceAgentQueueActionFailureResult,
  type WorkspaceAgentQueueActionCardResult,
} from "./workspaceAgentQueueActions";
import {
  workspaceAgentQueueIntentPromptPreview,
  workspaceAgentQueueUpdateRequestFromIntentDraft,
  type WorkspaceAgentQueueIntentDraft,
  type WorkspaceAgentQueueUpdateIntentDraft,
} from "./workspaceAgentQueueIntent";
import {
  WORKSPACE_AGENT_QUEUE_APPLY_DRAFT_NOTE,
} from "./workspaceAgentQueueCardFormatters";
import {
  workspaceAgentQueueDraftCanApply,
  workspaceAgentQueueDraftReviewState,
} from "./workspaceAgentQueueDraftValidation";
import type { QueueWidgetActionName } from "./queue/agentQueueWidgetApiTypes";

type WorkspaceAgentQueueUpdateDraftCardProps = {
  bridge?: WorkspaceAgentQueueBridge;
  draft: WorkspaceAgentQueueUpdateIntentDraft;
  onActionResult: (result: WorkspaceAgentQueueActionCardResult) => void;
  onDiscard: (draftId: string) => void;
  onPatchDraft: (
    draftId: string,
    patch: Partial<WorkspaceAgentQueueIntentDraft>,
  ) => void;
};

export function WorkspaceAgentQueueUpdateDraftCard({
  bridge,
  draft,
  onActionResult,
  onDiscard,
  onPatchDraft,
}: WorkspaceAgentQueueUpdateDraftCardProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [pendingAction, setPendingAction] =
    useState<QueueWidgetActionName | null>(null);
  const actionName = "queue.updateItem";
  const title = "Draft Queue update";
  const reviewState = workspaceAgentQueueDraftReviewState(draft);
  const canApply = workspaceAgentQueueDraftCanApply({
    bridgeAvailable: Boolean(bridge),
    draft,
    pendingAction,
  });

  async function applyDraft() {
    if (!bridge || !canApply) {
      return;
    }

    setPendingAction(actionName);
    try {
      const result = await bridge.updateItem(
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
        <Badge variant={reviewState.badgeVariant}>
          {reviewState.badgeLabel}
        </Badge>
      </div>

      <dl className="workspace-agent-queue-action-card-facts">
        <ActionFact label="Action type" value={draft.intentType} />
        <ActionFact
          label="Target item"
          value={draft.itemId.trim() || "Missing"}
        />
        <ActionFact label="Title" value={draft.title.trim() || "Missing"} />
        <ActionFact label="Status" value={draft.status || "Preserve"} />
        <ActionFact label="Queue tag" value={draft.queueTag.trim() || "None"} />
        <ActionFact label="Priority" value={draft.priority.trim() || "Preserve"} />
        <ActionFact label="Policy" value={draft.executionPolicy || "Preserve"} />
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
          {cappedPreviewText(
            workspaceAgentQueueIntentPromptPreview(draft),
            RENDER_MEMORY_CAPS.transcriptPayloadChars,
          )}
        </p>
      </div>

      {reviewState.validation.blockingMessages.length > 0 ? (
        <div
          aria-label="Queue intent validation"
          className="workspace-agent-queue-intent-validation"
        >
          {reviewState.validation.blockingMessages.map((message) => (
            <p key={message}>{message}</p>
          ))}
        </div>
      ) : null}

      {isEditing ? (
        <WorkspaceAgentQueueUpdateDraftFields
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
          {pendingAction ? "Applying" : "Apply update"}
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
        {WORKSPACE_AGENT_QUEUE_APPLY_DRAFT_NOTE}
      </p>
    </section>
  );
}

function WorkspaceAgentQueueUpdateDraftFields({
  draft,
  onPatchDraft,
}: {
  draft: WorkspaceAgentQueueUpdateIntentDraft;
  onPatchDraft: (patch: Partial<WorkspaceAgentQueueIntentDraft>) => void;
}) {
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
