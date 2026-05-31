import { useState } from "react";
import { Badge } from "../design-system/Badge";
import { Button } from "../design-system/Button";
import type {
  AgentQueueReportActionCard,
  AgentQueueReportActionType,
  AgentQueueTask,
  CreateAgentQueueTaskRequest,
  UpdateAgentQueueTaskRequest,
} from "../workspace/types";
import {
  diffReviewTaskPromptFromReportCard,
  followUpTaskPromptFromReportCard,
} from "./queue/agentQueueReportActionCardModel";

export type WorkspaceAgentQueueReportActionResult = {
  message: string;
  status: "completed" | "failed";
};

export type WorkspaceAgentQueueReportActionCardPatch = {
  linkedDiffReviewItemId?: string;
  linkedFollowUpItemIds?: string[];
};

type WorkspaceAgentQueueReportActionCardProps = {
  actionResults: Record<string, WorkspaceAgentQueueReportActionResult>;
  card: AgentQueueReportActionCard;
  onCreateQueueTask?: (
    request: Omit<CreateAgentQueueTaskRequest, "workspaceId">,
  ) => Promise<AgentQueueTask>;
  onOpenQueueItem?: (queueItemId: string) => void;
  onPatchCard: (
    cardId: string,
    patch: WorkspaceAgentQueueReportActionCardPatch,
  ) => void;
  onRecordActionResult: (
    cardId: string,
    actionType: AgentQueueReportActionType,
    result: WorkspaceAgentQueueReportActionResult,
  ) => void;
  onUpdateQueueTask?: (
    request: Omit<UpdateAgentQueueTaskRequest, "workspaceId">,
  ) => Promise<AgentQueueTask | null>;
};

export function WorkspaceAgentQueueReportActionCard({
  actionResults,
  card,
  onCreateQueueTask,
  onOpenQueueItem,
  onPatchCard,
  onRecordActionResult,
  onUpdateQueueTask,
}: WorkspaceAgentQueueReportActionCardProps) {
  const [pendingAction, setPendingAction] =
    useState<AgentQueueReportActionType | null>(null);
  const compactChangedFiles = card.changedFiles.slice(0, 3);
  const hiddenChangedFiles = Math.max(
    0,
    card.changedFiles.length - compactChangedFiles.length,
  );

  async function runAction(actionType: AgentQueueReportActionType) {
    if (pendingAction) {
      return;
    }

    setPendingAction(actionType);
    try {
      const result = await performAction(actionType);
      onRecordActionResult(card.cardId, actionType, {
        message: result,
        status: "completed",
      });
    } catch (error) {
      onRecordActionResult(card.cardId, actionType, {
        message:
          error instanceof Error
            ? error.message
            : "Action failed visibly. No hidden work ran.",
        status: "failed",
      });
    } finally {
      setPendingAction(null);
    }
  }

  async function performAction(actionType: AgentQueueReportActionType) {
    switch (actionType) {
      case "open_source_item":
        onOpenQueueItem?.(card.sourceItemId);
        return onOpenQueueItem
          ? "Open source Queue item request sent. No status was changed."
          : `Source Queue item: ${card.sourceItemId}. No status was changed.`;
      case "open_linked_diff_review":
        if (!card.linkedDiffReviewItemId) {
          return "No linked Diff Review item is recorded on this card.";
        }
        onOpenQueueItem?.(card.linkedDiffReviewItemId);
        return "Open linked Diff Review item request sent. No status was changed.";
      case "create_follow_up":
        return createFollowUpItem();
      case "create_diff_review":
        return createDiffReviewItem();
      case "mark_needs_changes":
        return markNeedsChanges();
      case "mark_ready_for_finalization":
        return "Report marked ready for coordinator finalization review on this card. No final Queue status was applied.";
      case "mark_rollback_required":
        return "Rollback marked required on this card only. No rollback execution was started.";
      case "pause_dependent_items":
        return card.dependentItemIds?.length
          ? `Pause requested for ${card.dependentItemIds.length.toString()} dependent task(s) on this card. No process was killed.`
          : "No dependent tasks were listed on this card. No process was killed.";
      case "pause_queue_tag":
        return `Pause requested for queue tag ${card.sourceQueueTag} on this card. No process was killed.`;
      default:
        return "Action recorded on this card. No hidden work ran.";
    }
  }

  async function createFollowUpItem() {
    if (!onCreateQueueTask) {
      return "Queue task creation is unavailable in this runtime. No work ran.";
    }

    const createdTask = await onCreateQueueTask({
      description: `Follow-up from report ${card.sourceReportId} for ${card.sourceItemTitle}.`,
      executionPolicy: "manual",
      itemType: "follow_up",
      priority: card.sourceItemPriority,
      prompt: followUpTaskPromptFromReportCard(card),
      queueTagId: card.sourceQueueTagId,
      queueTagName: card.sourceQueueTag,
      status: "queued",
      title: `Follow-up: ${card.sourceItemTitle}`,
      validationStatus: "not_started",
    });
    onPatchCard(card.cardId, {
      linkedFollowUpItemIds: [
        ...(card.linkedFollowUpItemIds ?? []),
        createdTask.queueItemId,
      ],
    });

    return `Queued follow-up item ${createdTask.queueItemId}. It was not run.`;
  }

  async function createDiffReviewItem() {
    if (card.linkedDiffReviewItemId) {
      onOpenQueueItem?.(card.linkedDiffReviewItemId);
      return "Existing linked Diff Review item opened. No new task was created.";
    }

    if (!onCreateQueueTask) {
      return "Queue task creation is unavailable in this runtime. No work ran.";
    }

    const createdTask = await onCreateQueueTask({
      description:
        "Review the source implementation diff against the report, declared scope, and Hobit contracts.",
      executionPolicy: "manual",
      itemType: "diff_review",
      priority: card.sourceItemPriority,
      prompt: diffReviewTaskPromptFromReportCard(card),
      queueTagId: card.sourceQueueTagId,
      queueTagName: card.sourceQueueTag,
      status: "queued",
      title: `Diff review: ${card.sourceItemTitle}`,
      validationStatus: "not_started",
    });
    onPatchCard(card.cardId, {
      linkedDiffReviewItemId: createdTask.queueItemId,
    });

    return `Queued Diff Review item ${createdTask.queueItemId}. It was not run.`;
  }

  async function markNeedsChanges() {
    if (!onUpdateQueueTask || !card.sourceItemPrompt) {
      return "Needs-changes marker recorded on this card only. Source Queue update is unavailable.";
    }

    await onUpdateQueueTask({
      description: card.sourceItemDescription ?? "",
      executionPolicy: "manual",
      itemType: card.sourceItemType,
      priority: card.sourceItemPriority,
      prompt: card.sourceItemPrompt,
      queueItemId: card.sourceItemId,
      queueTagId: card.sourceQueueTagId,
      queueTagName: card.sourceQueueTag,
      status: "review_needed",
      title: card.sourceItemTitle,
      validationStatus: "needs_review",
    });

    return "Source Queue item marked review_needed / needs_review. It was not finalized as done or failed.";
  }

  return (
    <section
      aria-label={`Queue report action card: ${card.sourceItemTitle}`}
      className="workspace-agent-report-card"
    >
      <div className="workspace-agent-report-card-header">
        <div>
          <p className="coordinator-proposal-kicker">Queue report action card</p>
          <h4 className="coordinator-proposal-title">{card.sourceItemTitle}</h4>
        </div>
        <div className="coordinator-proposal-badges">
          <Badge variant="warning">Coordinator action required</Badge>
          <Badge variant="neutral">No final status applied</Badge>
        </div>
      </div>

      <dl className="workspace-agent-report-card-facts">
        <ReportFact label="Type" value={card.sourceItemType} />
        <ReportFact label="Queue tag" value={card.sourceQueueTag} />
        <ReportFact label="Report" value={card.reportKind} />
        <ReportFact label="Status" value={card.reportStatus} />
        {card.commitHash ? <ReportFact label="Commit" value={card.commitHash} /> : null}
      </dl>

      <p className="coordinator-proposal-section-value">{card.reportSummary}</p>

      <div className="workspace-agent-report-card-counts">
        <Badge variant="neutral">
          {card.changedFiles.length.toString()} changed file(s)
        </Badge>
        <Badge variant={card.warnings.length ? "warning" : "neutral"}>
          {card.warnings.length.toString()} warning(s)
        </Badge>
        <Badge variant={card.errors.length ? "error" : "neutral"}>
          {card.errors.length.toString()} error(s)
        </Badge>
      </div>

      {compactChangedFiles.length ? (
        <ul className="workspace-agent-report-card-file-list">
          {compactChangedFiles.map((file) => (
            <li key={file}>{file}</li>
          ))}
          {hiddenChangedFiles ? <li>+{hiddenChangedFiles.toString()} more</li> : null}
        </ul>
      ) : null}

      {card.followUpRecommendation ? (
        <p className="agent-queue-run-warning">
          Follow-up recommendation: {card.followUpRecommendation}
        </p>
      ) : null}
      {card.rollbackRecommendation ? (
        <p className="agent-queue-run-warning">
          Rollback recommendation: {card.rollbackRecommendation}
        </p>
      ) : null}
      {card.linkedDiffReviewItemId ? (
        <p className="coordinator-proposal-note">
          Linked Diff Review: {card.linkedDiffReviewItemId}
          {card.linkedDiffReviewStatus ? ` (${card.linkedDiffReviewStatus})` : ""}
        </p>
      ) : null}

      <p className="coordinator-proposal-note">
        Report received. Actions create/update Queue state only where explicit
        plumbing exists. No provider, Executor, Codex, rollback, or finalization
        runs from this card.
      </p>

      <div className="workspace-agent-report-card-actions">
        {card.recommendedActions.map((action) => (
          <Button
            disabled={!action.enabled || pendingAction === action.type}
            key={action.actionId}
            onClick={() => void runAction(action.type)}
            title={action.description}
            variant={primaryActionVariant(action.type)}
          >
            {pendingAction === action.type ? "Working" : action.label}
          </Button>
        ))}
      </div>

      {Object.entries(actionResults).length ? (
        <div className="workspace-agent-report-card-results">
          {Object.entries(actionResults).map(([actionType, result]) => (
            <p
              className={`coordinator-proposal-result coordinator-proposal-result-${result.status === "failed" ? "error" : "success"}`}
              key={actionType}
            >
              {result.message}
            </p>
          ))}
        </div>
      ) : null}
    </section>
  );
}

function ReportFact({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

function primaryActionVariant(actionType: AgentQueueReportActionType) {
  return actionType === "create_follow_up" || actionType === "create_diff_review"
    ? "primary"
    : "secondary";
}
