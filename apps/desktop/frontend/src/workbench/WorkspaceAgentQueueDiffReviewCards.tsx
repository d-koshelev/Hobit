import { DisabledActionReason } from "../design-system/ActionPrimitives";
import { Badge } from "../design-system/Badge";
import { Button } from "../design-system/Button";
import type {
  AgentQueueTask,
  AgentQueueWorkerExecutionReport,
} from "../workspace/types";
import {
  resolveDiffReviewInputSnapshot,
  type DiffReviewInputAvailabilitySummary,
  type DiffReviewInputSnapshot,
} from "./diffReview";
import type { WorkspaceChatQueueActionResult } from "./workspaceChatQueueControlService";

export function WorkspaceAgentQueueDiffReviewPreflightCard({
  disabledReason,
  report,
  task,
  validationStatusLabelValue,
}: {
  disabledReason: string | null;
  report?: AgentQueueWorkerExecutionReport | null;
  task: AgentQueueTask;
  validationStatusLabelValue: string;
}) {
  const resolved = resolveDiffReviewInputSnapshot({
    report,
    sourceTask: task,
  });
  const preflight = buildDiffReviewPreflight({
    availability: resolved.availability,
    disabledReason,
    inputSnapshot: resolved.inputSnapshot,
    task,
    validationStatusLabelValue,
  });

  return (
    <section
      aria-label="Create Diff Review preflight"
      className="workspace-agent-queue-diff-review-preflight"
    >
      <div className="workspace-agent-queue-action-card-header">
        <div>
          <p className="coordinator-proposal-kicker">Create Diff Review preflight</p>
          <p className="coordinator-proposal-note">
            Creation is explicit and produces a manual Queue item only.
          </p>
        </div>
        <Badge variant={preflight.actionAvailable ? "success" : "warning"}>
          {preflight.actionAvailable ? "Available" : "Unavailable"}
        </Badge>
      </div>
      <dl className="workspace-agent-queue-action-card-facts">
        {preflight.facts.map((fact) => (
          <DiffReviewFact key={fact.label} label={fact.label} value={fact.value} />
        ))}
      </dl>
      {preflight.warnings.length ? (
        <ul className="workspace-agent-queue-action-card-list">
          {preflight.warnings.map((warning) => (
            <li key={warning}>{warning}</li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}

export function WorkspaceAgentQueueDiffReviewCreationResultCard({
  onOpenQueueItem,
  result,
}: {
  onOpenQueueItem?: (queueItemId: string) => void;
  result: WorkspaceChatQueueActionResult;
}) {
  const creation = result.diffReviewCreation;

  if (!creation) {
    return null;
  }

  const createdId = creation.createdReviewTaskId;
  const createdTitle = creation.createdReviewTaskTitle ?? "Not created";

  return (
    <section
      aria-label="Diff Review creation result card"
      className="workspace-agent-queue-diff-review-result"
    >
      <div className="workspace-agent-queue-action-card-header">
        <div>
          <p className="coordinator-proposal-kicker">Diff Review result</p>
          <h4 className="coordinator-proposal-title">{createdTitle}</h4>
        </div>
        <Badge variant={result.status === "success" ? "success" : "error"}>
          {result.status === "success" ? "Created" : "Failed"}
        </Badge>
      </div>
      <dl className="workspace-agent-queue-action-card-facts">
        <DiffReviewFact label="Review task" value={createdId ?? "Not created"} />
        <DiffReviewFact label="Source task" value={creation.sourceTaskId} />
      </dl>
      <p
        className={`coordinator-proposal-result coordinator-proposal-result-${
          result.status === "failed" ? "error" : "success"
        }`}
      >
        {result.message}
      </p>
      {creation.warnings.length ? (
        <ul
          aria-label="Diff Review creation warnings"
          className="workspace-agent-queue-action-card-list"
        >
          {creation.warnings.map((warning) => (
            <li key={`${warning.code}:${warning.message}`}>{warning.message}</li>
          ))}
        </ul>
      ) : null}
      <div className="workspace-agent-queue-task-status-actions">
        <span className="workspace-agent-queue-task-status-action">
          <Button
            disabled={!createdId || !onOpenQueueItem}
            onClick={() => {
              if (createdId) {
                onOpenQueueItem?.(createdId);
              }
            }}
            title={
              onOpenQueueItem
                ? undefined
                : "Open Queue is unavailable in this Workspace Agent surface."
            }
            variant="secondary"
          >
            Open review task
          </Button>
          <DisabledActionReason
            reason={
              createdId && !onOpenQueueItem
                ? "Open Queue is unavailable in this Workspace Agent surface."
                : null
            }
          />
        </span>
      </div>
      <p className="coordinator-proposal-note">
        The source task was not accepted, finalized, run, committed, pushed, or
        unblocked by this action.
      </p>
    </section>
  );
}

type DiffReviewPreflight = {
  actionAvailable: boolean;
  facts: { label: string; value: string }[];
  warnings: string[];
};

function buildDiffReviewPreflight({
  availability,
  disabledReason,
  inputSnapshot,
  task,
  validationStatusLabelValue,
}: {
  availability: DiffReviewInputAvailabilitySummary;
  disabledReason: string | null;
  inputSnapshot: DiffReviewInputSnapshot;
  task: AgentQueueTask;
  validationStatusLabelValue: string;
}): DiffReviewPreflight {
  const scopeMetadataAvailable =
    Boolean(inputSnapshot.allowedScope?.length) ||
    Boolean(inputSnapshot.forbiddenFiles?.length);
  const warnings = [
    ...availability.warnings,
    ...(disabledReason ? [disabledReason] : []),
  ];

  return {
    actionAvailable: !disabledReason,
    facts: [
      { label: "Source task", value: task.queueItemId },
      {
        label: "Report",
        value: availability.hasReport ? "Available" : "Missing",
      },
      {
        label: "Validation",
        value: availability.hasValidationEvidence
          ? `${validationStatusLabelValue}; evidence available`
          : `${validationStatusLabelValue}; evidence missing`,
      },
      {
        label: "Diff",
        value: task.executionWorkspace?.trim()
          ? "Workspace recorded; live diff not loaded"
          : "Missing execution workspace",
      },
      {
        label: "Commit title",
        value: availability.hasExpectedCommitTitle ? "Available" : "Missing",
      },
      {
        label: "Scope metadata",
        value: scopeMetadataAvailable ? "Available" : "Missing",
      },
    ],
    warnings: uniqueMessages(warnings),
  };
}

function DiffReviewFact({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

function uniqueMessages(messages: string[]) {
  return [...new Set(messages.map((message) => message.trim()).filter(Boolean))];
}
