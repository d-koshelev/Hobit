import { useState } from "react";
import { Badge } from "../design-system/Badge";
import { Button } from "../design-system/Button";
import { RENDER_MEMORY_CAPS, cappedPreviewText } from "../renderMemoryGuards";
import type {
  AgentQueueClosureState,
  AgentQueueReportActionCard,
  AgentQueueReportActionType,
  AgentQueueCoordinatorStatus,
  AgentQueueTask,
  CreateAgentQueueTaskRequest,
  GitRepositoryStatus,
  UpdateAgentQueueTaskRequest,
  WorkspaceGitDiffSummary,
} from "../workspace/types";
import {
  getWorkspaceGitDiffSummary,
  getWorkspaceGitStatus,
} from "../workspace/workspaceGitApi";
import {
  queueClosureStateBadgeVariant,
  queueClosureStateLabel,
} from "./queue/agentQueueClosureState";
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
  sourceClosureState?: AgentQueueClosureState;
  sourceCoordinatorStatus?: AgentQueueCoordinatorStatus;
};

type WorkspaceAgentGitReviewSummary = {
  changedFilesSummary: string;
  fileSummaries: string[];
  finalResponse: string;
  gitStatusSummary: string;
  repoRoot: string;
  taskId: string;
  taskTitle: string;
  warnings: string[];
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
  const [gitReviewSummary, setGitReviewSummary] =
    useState<WorkspaceAgentGitReviewSummary | null>(null);
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
      case "review_changes":
        return reviewChanges();
      case "create_follow_up":
        return createFollowUpItem();
      case "create_diff_review":
        return createDiffReviewItem();
      case "mark_needs_changes":
        return markSourceDecision({
          closureState: "closure_blocked",
          coordinatorStatus: "needs_changes",
          result:
            "Source Queue item marked needs changes. It was not finalized as done or failed.",
          status: "review_needed",
          validationStatus: "needs_review",
        });
      case "mark_ready_for_finalization":
        return markSourceDecision({
          closureState: "closure_required",
          coordinatorStatus: "ready_for_finalization",
          result:
            "Source Queue item marked ready for explicit coordinator finalization. No work was started.",
          status: "review_needed",
          validationStatus: "needs_review",
        });
      case "finalize_accept_item":
        return finalizeSourceItem();
      case "accept_without_commit":
        return acceptSourceItemWithoutCommit();
      case "mark_follow_up_required":
        return markSourceDecision({
          closureState: "closure_blocked",
          coordinatorStatus: "follow_up_required",
          result:
            "Source Queue item marked follow-up required. Dependencies remain blocked.",
          status: "review_needed",
          validationStatus: "needs_review",
        });
      case "mark_blocked":
        return markSourceDecision({
          closureState: "closure_blocked",
          coordinatorStatus: "blocked",
          result:
            "Source Queue item marked blocked by coordinator. No follow-up was auto-run.",
          status: "review_needed",
          validationStatus: "needs_review",
        });
      case "mark_failed_rejected":
        return markSourceDecision({
          closureState: "closure_blocked",
          coordinatorStatus: "failed",
          result:
            "Source Queue item marked failed / rejected. Evidence was preserved and rollback was not executed.",
          status: "failed",
          validationStatus: "failed",
        });
      case "mark_rollback_required":
        return markSourceDecision({
          closureState: "closure_blocked",
          coordinatorStatus: "rollback_required",
          result:
            "Rollback required marker recorded. No rollback, git reset, or process kill was started.",
          status: "review_needed",
          validationStatus: "needs_review",
        });
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
      sourceClosureState: "follow_up_created",
      sourceCoordinatorStatus: "follow_up_required",
    });

    return `Queued follow-up item ${createdTask.queueItemId}. It was not run.`;
  }

  async function reviewChanges() {
    const repoRoot = card.sourceExecutionWorkspace?.trim();

    if (!repoRoot) {
      setGitReviewSummary(null);
      return "Review changes needs an execution workspace / repository root on the source Queue item. No Git read ran.";
    }

    const [repositoryStatus, diffSummary] = await Promise.all([
      getWorkspaceGitStatus({ repoRoot }),
      getWorkspaceGitDiffSummary({
        includePatchPreview: false,
        maxFiles: 20,
        maxPatchBytesPerFile: 0,
        repoRoot,
      }),
    ]);

    setGitReviewSummary(
      gitReviewSummaryFromCard(card, repoRoot, repositoryStatus, diffSummary),
    );

    return "Review changes loaded read-only Workspace Git status and diff summary. No commit was created.";
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

  async function finalizeSourceItem() {
    const closureState = sourceClosureStateForAccept(card);

    if (closureState === "commit_required") {
      return markSourceDecision({
        closureState,
        coordinatorStatus: "ready_for_finalization",
        result:
          "Closure requires an explicit commit. No commit was created and the source Queue item was not finalized.",
        status: "review_needed",
        validationStatus: "needs_review",
      });
    }

    return markSourceDecision({
      closureState,
      coordinatorStatus: "finalized",
      result:
        closureState === "commit_created"
          ? "Source Queue item finalized / accepted with an existing commit reference. No commit was created by Queue."
          : "Source Queue item finalized / accepted as no-change work. No commit was created.",
      status: "completed",
      validationStatus: "passed",
    });
  }

  async function acceptSourceItemWithoutCommit() {
    if (card.changedFiles.length > 0 || card.commitHash) {
      return markSourceDecision({
        closureState: card.commitHash ? "commit_created" : "commit_required",
        coordinatorStatus: "ready_for_finalization",
        result:
          "Accept without commit requires a no-change report. The source Queue item was not finalized.",
        status: "review_needed",
        validationStatus: "needs_review",
      });
    }

    return markSourceDecision({
      closureState: "no_change_accepted",
      coordinatorStatus: "finalized",
      result:
        "No file changes; no commit created. Source Queue item finalized / accepted and evidence was preserved.",
      status: "completed",
      validationStatus: "passed",
    });
  }

  async function markSourceDecision({
    closureState,
    coordinatorStatus,
    result,
    status,
    validationStatus,
  }: {
    closureState: AgentQueueClosureState;
    coordinatorStatus: AgentQueueCoordinatorStatus;
    result: string;
    status: UpdateAgentQueueTaskRequest["status"];
    validationStatus: NonNullable<UpdateAgentQueueTaskRequest["validationStatus"]>;
  }) {
    if (!onUpdateQueueTask || !card.sourceItemPrompt) {
      onPatchCard(card.cardId, {
        sourceClosureState: closureState,
        sourceCoordinatorStatus: coordinatorStatus,
      });
      return `${result} Source Queue update is unavailable, so only this card was marked.`;
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
      status,
      title: card.sourceItemTitle,
      validationStatus,
    });
    onPatchCard(card.cardId, {
      sourceClosureState: closureState,
      sourceCoordinatorStatus: coordinatorStatus,
    });

    return result;
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
          <Badge variant={queueClosureStateBadgeVariant(card.sourceClosureState)}>
            {queueClosureStateLabel(card.sourceClosureState)}
          </Badge>
          <Badge variant="neutral">
            {card.sourceCoordinatorStatus === "finalized"
              ? "Finalized by coordinator"
              : "No automatic final status"}
          </Badge>
        </div>
      </div>

      <dl className="workspace-agent-report-card-facts">
        <ReportFact label="Type" value={card.sourceItemType} />
        <ReportFact label="Queue tag" value={card.sourceQueueTag} />
        <ReportFact label="Report" value={card.reportKind} />
        <ReportFact label="Status" value={card.reportStatus} />
        {card.sourceCoordinatorStatus ? (
          <ReportFact label="Coordinator" value={card.sourceCoordinatorStatus} />
        ) : null}
        {card.sourceClosureState ? (
          <ReportFact
            label="Closure"
            value={queueClosureStateLabel(card.sourceClosureState)}
          />
        ) : null}
        {card.commitHash ? <ReportFact label="Commit" value={card.commitHash} /> : null}
      </dl>

      <p className="coordinator-proposal-section-value">
        {cappedPreviewText(
          card.reportSummary,
          RENDER_MEMORY_CAPS.transcriptPayloadChars,
        )}
      </p>

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
          Follow-up recommendation:{" "}
          {cappedPreviewText(
            card.followUpRecommendation,
            RENDER_MEMORY_CAPS.transcriptPayloadChars,
          )}
        </p>
      ) : null}
      {card.rollbackRecommendation ? (
        <p className="agent-queue-run-warning">
          Rollback recommendation:{" "}
          {cappedPreviewText(
            card.rollbackRecommendation,
            RENDER_MEMORY_CAPS.transcriptPayloadChars,
          )}
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
        plumbing exists. No provider, Executor, Codex, rollback execution, or
        automatic finalization runs from this card.
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
              {cappedPreviewText(
                result.message,
                RENDER_MEMORY_CAPS.transcriptPayloadChars,
              )}
            </p>
          ))}
        </div>
      ) : null}

      {gitReviewSummary ? (
        <section
          aria-label="Coordinator review summary"
          className="workspace-agent-report-card-review-summary"
        >
          <p className="coordinator-proposal-kicker">Coordinator review summary</p>
          <dl className="workspace-agent-report-card-facts">
            <ReportFact label="Task id" value={gitReviewSummary.taskId} />
            <ReportFact label="Task title" value={gitReviewSummary.taskTitle} />
            <ReportFact label="Repository" value={gitReviewSummary.repoRoot} />
          </dl>
          <ReviewSummaryBlock
            label="Final response"
            value={gitReviewSummary.finalResponse}
          />
          <ReviewSummaryBlock
            label="Changed files summary"
            value={gitReviewSummary.changedFilesSummary}
          />
          {gitReviewSummary.fileSummaries.length ? (
            <ul className="workspace-agent-report-card-file-list">
              {gitReviewSummary.fileSummaries.map((summary) => (
                <li key={summary}>{summary}</li>
              ))}
            </ul>
          ) : null}
          <ReviewSummaryBlock
            label="Git status summary"
            value={gitReviewSummary.gitStatusSummary}
          />
          {gitReviewSummary.warnings.length ? (
            <ReviewSummaryBlock
              label="Warnings"
              value={gitReviewSummary.warnings.join("\n")}
            />
          ) : null}
          <p className="coordinator-proposal-note">
            Read-only Workspace Git review. No Git widget was opened and no
            commit, push, reset, checkout, clean, or stash action ran.
          </p>
        </section>
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

function ReviewSummaryBlock({ label, value }: { label: string; value: string }) {
  return (
    <div className="workspace-agent-report-card-review-block">
      <p className="coordinator-proposal-section-label">{label}</p>
      <pre>
        {cappedPreviewText(
          value,
          RENDER_MEMORY_CAPS.transcriptPayloadChars,
        )}
      </pre>
    </div>
  );
}

function primaryActionVariant(actionType: AgentQueueReportActionType) {
  return actionType === "create_follow_up" ||
    actionType === "create_diff_review" ||
    actionType === "finalize_accept_item" ||
    actionType === "accept_without_commit"
    ? "primary"
    : "secondary";
}

function sourceClosureStateForAccept(
  card: AgentQueueReportActionCard,
): AgentQueueClosureState {
  if (card.commitHash) {
    return "commit_created";
  }

  if (card.changedFiles.length > 0) {
    return "commit_required";
  }

  return "no_change_accepted";
}

function gitReviewSummaryFromCard(
  card: AgentQueueReportActionCard,
  repoRoot: string,
  repositoryStatus: GitRepositoryStatus,
  diffSummary: WorkspaceGitDiffSummary,
): WorkspaceAgentGitReviewSummary {
  const finalResponse = cappedPreviewText(
    card.finalResponse?.trim() ||
      card.reportSummary.trim() ||
      "No final response captured on this Queue report.",
    RENDER_MEMORY_CAPS.transcriptPayloadChars,
  );
  const fileSummaries = diffSummary.files.slice(0, 10).map((file) =>
    [
      file.path,
      file.status,
      file.additions === null ? null : `+${file.additions.toString()}`,
      file.deletions === null ? null : `-${file.deletions.toString()}`,
      file.staged ? "staged" : null,
      file.unstaged ? "unstaged" : null,
      file.untracked ? "untracked" : null,
      file.conflicted ? "conflicted" : null,
    ]
      .filter(Boolean)
      .join(" "),
  );
  const hiddenFiles = Math.max(0, diffSummary.files.length - fileSummaries.length);

  if (hiddenFiles) {
    fileSummaries.push(`+${hiddenFiles.toString()} more file(s)`);
  }

  return {
    changedFilesSummary: diffSummarySummary(diffSummary),
    fileSummaries,
    finalResponse,
    gitStatusSummary: repositoryStatusSummary(repositoryStatus),
    repoRoot,
    taskId: card.sourceItemId,
    taskTitle: card.sourceItemTitle,
    warnings: [...repositoryStatus.warnings],
  };
}

function diffSummarySummary(diffSummary: WorkspaceGitDiffSummary) {
  const totals = diffSummary.summary;
  const additions =
    totals.totalAdditions === null
      ? "additions unknown"
      : `${totals.totalAdditions.toString()} addition(s)`;
  const deletions =
    totals.totalDeletions === null
      ? "deletions unknown"
      : `${totals.totalDeletions.toString()} deletion(s)`;

  return [
    `${totals.totalFiles.toString()} changed file(s)`,
    `${totals.stagedCount.toString()} staged`,
    `${totals.unstagedCount.toString()} unstaged`,
    `${totals.untrackedCount.toString()} untracked`,
    `${totals.conflictedCount.toString()} conflicted`,
    additions,
    deletions,
    diffSummary.errorMessage ? `error: ${diffSummary.errorMessage}` : null,
  ]
    .filter(Boolean)
    .join("; ");
}

function repositoryStatusSummary(status: GitRepositoryStatus) {
  const branch = status.branch
    ? status.branch.isDetached
      ? `detached at ${status.branch.name ?? "unknown"}`
      : status.branch.name ?? "unknown branch"
    : "branch unavailable";
  const upstream = status.branch?.upstream
    ? `upstream ${status.branch.upstream}`
    : "no upstream reported";
  const ahead =
    status.branch?.ahead === null || status.branch?.ahead === undefined
      ? "ahead unknown"
      : `ahead ${status.branch.ahead.toString()}`;
  const behind =
    status.branch?.behind === null || status.branch?.behind === undefined
      ? "behind unknown"
      : `behind ${status.branch.behind.toString()}`;
  const tree = status.workingTree;

  return [
    `Branch ${branch}`,
    upstream,
    ahead,
    behind,
    tree.isClean ? "working tree clean" : "working tree dirty",
    `${tree.stagedCount.toString()} staged`,
    `${tree.unstagedCount.toString()} unstaged`,
    `${tree.untrackedCount.toString()} untracked`,
  ].join("; ");
}
