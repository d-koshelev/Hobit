import { useMemo, useState } from "react";

import { DisabledActionReason } from "../design-system/ActionPrimitives";
import { Badge } from "../design-system/Badge";
import { Button } from "../design-system/Button";
import { Input } from "../design-system/Input";
import type {
  AgentQueueReportActionType,
  AgentQueueTask,
  AgentQueueWorkerExecutionReport,
} from "../workspace/types";
import {
  validateCommitHashFormat,
  validateExpectedCommitTitle,
} from "./coordinator";
import { normalizeTaskDependencies } from "./agentQueueDependencyUi";
import {
  coordinatorStatusLabel,
  displayTaskTitle,
  statusLabel,
  validationStatusLabel,
} from "./agentQueueTaskUiModel";
import { getQueuePromptPackImportMetadata } from "./promptPack/queuePromptPackMetadata";
import { recomputeDependentReadinessAfterFinalization } from "./queue/queueCoordinatorFinalizationService";
import type {
  WorkspaceChatCoordinatorDecisionInput,
  WorkspaceChatQueueAction,
  WorkspaceChatQueueActionResult,
} from "./workspaceChatQueueControlService";

type ConfirmationTarget =
  | "accept_without_commit"
  | "accept_with_commit"
  | "mark_rollback_required";

type WorkspaceAgentQueueFinalizationCardProps = {
  bridgeAvailable: boolean;
  coordinatorDisabledReason: string | null;
  latestReport: AgentQueueWorkerExecutionReport | null;
  onOpenQueueItem?: (queueItemId: string) => void;
  onQueueAction: (action: WorkspaceChatQueueAction) => void;
  pendingAction: WorkspaceChatQueueAction["kind"] | "view_report" | null;
  result: WorkspaceChatQueueActionResult | null;
  task: AgentQueueTask;
  tasks: AgentQueueTask[];
};

export function WorkspaceAgentQueueFinalizationCard({
  bridgeAvailable,
  coordinatorDisabledReason,
  latestReport,
  onOpenQueueItem,
  onQueueAction,
  pendingAction,
  result,
  task,
  tasks,
}: WorkspaceAgentQueueFinalizationCardProps) {
  const [confirmationTarget, setConfirmationTarget] =
    useState<ConfirmationTarget | null>(null);
  const [commitHash, setCommitHash] = useState(latestReport?.commitHash ?? "");
  const [commitTitle, setCommitTitle] = useState("");
  const [note, setNote] = useState("");
  const promptPackMetadata = getQueuePromptPackImportMetadata(task);
  const expectedCommitTitle = promptPackMetadata?.expectedCommitTitle ?? null;
  const linkedDiffReview = linkedDiffReviewTask(task, tasks);
  const dependencyImpact = useMemo(
    () => finalizationDependencyImpact(task, tasks),
    [task, tasks],
  );
  const commitValidation = commitHash.trim()
    ? validateCommitHashFormat(commitHash)
    : null;
  const titleValidation =
    commitHash.trim() || commitTitle.trim()
      ? validateExpectedCommitTitle(commitTitle, expectedCommitTitle, {
          requireExpected: true,
        })
      : null;
  const commitErrors = [
    ...(commitValidation?.errors ?? []),
    ...(titleValidation?.errors ?? []),
    ...(!commitHash.trim()
      ? ["Accept with commit requires a commit hash."]
      : []),
  ];
  const acceptWithCommitDisabledReason =
    coordinatorDisabledReason ??
    (!bridgeAvailable
      ? "Queue finalization bridge is unavailable, so commit metadata cannot be saved."
      : null) ??
    (!latestReport ? "Accept with commit needs a visible report." : null) ??
    (commitErrors[0] ?? null);
  const acceptWithoutCommitDisabledReason =
    coordinatorDisabledReason ??
    (!latestReport ? "Accept without commit needs a visible report." : null);
  const decisionDisabledReason =
    coordinatorDisabledReason ??
    (!latestReport ? "Coordinator decisions need a visible report or review result." : null);

  function runDecision(
    actionType: AgentQueueReportActionType,
    decisionInput?: WorkspaceChatCoordinatorDecisionInput,
  ) {
    setConfirmationTarget(null);
    onQueueAction({
      actionType,
      decisionInput,
      kind: "coordinator_decision",
      queueItemId: task.queueItemId,
    });
  }

  function commitDecisionInput(): WorkspaceChatCoordinatorDecisionInput {
    return {
      commitHash: commitHash.trim(),
      commitTitle: commitTitle.trim(),
      decision: "accepted_with_commit",
      expectedCommitTitle: expectedCommitTitle ?? undefined,
      operatorNote: note.trim() || undefined,
    };
  }

  return (
    <section
      aria-label="Coordinator finalization controls"
      className="workspace-agent-queue-finalization-card"
    >
      <div className="workspace-agent-queue-finalization-header">
        <div>
          <p className="coordinator-proposal-kicker">Coordinator finalization</p>
          <h4 className="coordinator-proposal-title">
            {displayTaskTitle(task)}
          </h4>
          <p className="coordinator-proposal-note">
            Decisions update Queue review state only. No commit, push, rollback,
            Autorun, or dependent task starts from this card.
          </p>
        </div>
        <Badge variant={coordinatorDisabledReason ? "warning" : "success"}>
          {coordinatorDisabledReason ? "Unavailable" : "Eligible"}
        </Badge>
      </div>

      <dl className="workspace-agent-queue-finalization-facts">
        <FinalizationFact label="Task status" value={statusLabel(task.status)} />
        <FinalizationFact
          label="Coordinator"
          value={coordinatorStatusLabel(task.coordinatorStatus)}
        />
        <FinalizationFact
          label="Validation"
          value={validationEvidenceSummary(task, latestReport)}
        />
        <FinalizationFact
          label="Diff Review"
          value={diffReviewSummary(linkedDiffReview)}
        />
        <FinalizationFact
          label="Expected commit title"
          value={expectedCommitTitle ?? "Missing"}
        />
        <FinalizationFact
          label="Dependency gate"
          value={dependencyImpact.summary}
        />
      </dl>

      {linkedDiffReview && onOpenQueueItem ? (
        <Button
          onClick={() => onOpenQueueItem(linkedDiffReview.queueItemId)}
          variant="ghost"
        >
          Open Diff Review
        </Button>
      ) : null}

      {coordinatorDisabledReason ? (
        <p className="workspace-agent-queue-finalization-warning">
          {coordinatorDisabledReason}
        </p>
      ) : null}

      <div className="workspace-agent-queue-finalization-inputs">
        <label>
          <span>Commit hash</span>
          <Input
            aria-label="Coordinator commit hash"
            onChange={(event) => setCommitHash(event.target.value)}
            placeholder="7-40 character commit SHA"
            value={commitHash}
          />
        </label>
        <label>
          <span>Commit title</span>
          <Input
            aria-label="Coordinator commit title"
            onChange={(event) => setCommitTitle(event.target.value)}
            placeholder={expectedCommitTitle ?? "Repository commit title"}
            value={commitTitle}
          />
        </label>
        <label>
          <span>Decision note</span>
          <Input
            aria-label="Coordinator decision note"
            onChange={(event) => setNote(event.target.value)}
            placeholder="Optional visible note"
            value={note}
          />
        </label>
      </div>

      {commitErrors.length || titleValidation?.warnings.length ? (
        <ul className="workspace-agent-queue-finalization-errors">
          {[...commitErrors, ...(titleValidation?.warnings ?? [])].map((message) => (
            <li key={message}>{message}</li>
          ))}
        </ul>
      ) : null}

      <div
        aria-label="Coordinator decision actions"
        className="workspace-agent-queue-task-status-actions"
      >
        <DecisionButton
          disabledReason={acceptWithoutCommitDisabledReason}
          label={
            confirmationTarget === "accept_without_commit"
              ? "Confirm accept without commit"
              : "Accept without commit"
          }
          onClick={() =>
            confirmationTarget === "accept_without_commit"
              ? runDecision("accept_without_commit", {
                  decision: "accepted_without_commit",
                  noCommitReason:
                    note.trim() ||
                    "Operator accepted this Queue item without a commit.",
                  operatorNote: note.trim() || undefined,
                })
              : setConfirmationTarget("accept_without_commit")
          }
          pending={pendingAction === "coordinator_decision"}
          variant="secondary"
        />
        <DecisionButton
          disabledReason={acceptWithCommitDisabledReason}
          label={
            confirmationTarget === "accept_with_commit"
              ? "Confirm accept with commit"
              : "Accept with commit hash"
          }
          onClick={() =>
            confirmationTarget === "accept_with_commit"
              ? runDecision("finalize_accept_item", commitDecisionInput())
              : setConfirmationTarget("accept_with_commit")
          }
          pending={pendingAction === "coordinator_decision"}
          variant="primary"
        />
        <DecisionButton
          disabledReason={decisionDisabledReason}
          label="Request changes"
          onClick={() =>
            runDecision("mark_needs_changes", {
              operatorNote: note.trim() || "Changes requested from Workspace Chat.",
            })
          }
          pending={pendingAction === "coordinator_decision"}
          variant="secondary"
        />
        <DecisionButton
          disabledReason={decisionDisabledReason}
          label="Create follow-up"
          onClick={() =>
            runDecision("create_follow_up", {
              operatorNote: note.trim() || "Follow-up requested from Workspace Chat.",
            })
          }
          pending={pendingAction === "coordinator_decision"}
          variant="secondary"
        />
        <DecisionButton
          disabledReason={decisionDisabledReason}
          label="Mark blocked"
          onClick={() =>
            runDecision("mark_blocked", {
              operatorNote: note.trim() || "Blocked from Workspace Chat review.",
            })
          }
          pending={pendingAction === "coordinator_decision"}
          variant="secondary"
        />
        <DecisionButton
          disabledReason={decisionDisabledReason}
          label={
            confirmationTarget === "mark_rollback_required"
              ? "Confirm rollback required"
              : "Rollback required"
          }
          onClick={() =>
            confirmationTarget === "mark_rollback_required"
              ? runDecision("mark_rollback_required", {
                  operatorNote:
                    note.trim() ||
                    "Rollback required marker recorded from Workspace Chat.",
                })
              : setConfirmationTarget("mark_rollback_required")
          }
          pending={pendingAction === "coordinator_decision"}
          variant="secondary"
        />
      </div>

      {confirmationTarget ? (
        <p className="workspace-agent-queue-finalization-warning">
          Confirm {confirmationLabel(confirmationTarget)} to apply this Queue
          decision. No Git or Queue runtime action will run.
        </p>
      ) : null}

      {result?.coordinatorFinalization ? (
        <WorkspaceAgentCoordinatorFinalizationResultCard result={result} />
      ) : null}
    </section>
  );
}

export function WorkspaceAgentCoordinatorFinalizationResultCard({
  result,
}: {
  result: WorkspaceChatQueueActionResult;
}) {
  const finalization = result.coordinatorFinalization;

  if (!finalization) {
    return null;
  }

  return (
    <section
      aria-label="Coordinator finalization result"
      className="workspace-agent-queue-finalization-result"
    >
      <p className="coordinator-proposal-kicker">Decision result</p>
      <h4 className="coordinator-proposal-title">
        {finalization.decisionApplied}
      </h4>
      <dl className="workspace-agent-queue-finalization-facts">
        <FinalizationFact
          label="Commit hash"
          value={finalization.commitHash ?? "Not provided"}
        />
        <FinalizationFact
          label="Commit title"
          value={finalization.commitTitle ?? "Not provided"}
        />
        <FinalizationFact
          label="Dependents"
          value={finalization.dependencyGateSummary}
        />
        <FinalizationFact label="Next action" value={finalization.nextAction} />
      </dl>
      {finalization.dependents.length ? (
        <ul className="workspace-agent-queue-action-card-list">
          {finalization.dependents.map((dependent) => (
            <li key={dependent.dependentItemId}>
              {dependent.dependentItemId}:{" "}
              {dependent.ready ? "dependency-ready" : "blocked"} -{" "}
              {dependent.summary}
            </li>
          ))}
        </ul>
      ) : null}
      {finalization.warnings.length ? (
        <ul className="workspace-agent-queue-finalization-errors">
          {finalization.warnings.map((warning) => (
            <li key={warning}>{warning}</li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}

function DecisionButton({
  disabledReason,
  label,
  onClick,
  pending,
  variant,
}: {
  disabledReason: string | null;
  label: string;
  onClick: () => void;
  pending: boolean;
  variant: "primary" | "secondary";
}) {
  return (
    <span className="workspace-agent-queue-task-status-action">
      <Button
        disabled={Boolean(disabledReason) || pending}
        onClick={onClick}
        title={disabledReason ?? undefined}
        variant={variant}
      >
        {pending ? "Applying" : label}
      </Button>
      <DisabledActionReason reason={disabledReason} />
    </span>
  );
}

function FinalizationFact({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

function validationEvidenceSummary(
  task: AgentQueueTask,
  latestReport: AgentQueueWorkerExecutionReport | null,
) {
  const taskStatus = validationStatusLabel(task.validationStatus ?? "not_started");
  const reportStatus = latestReport?.validationResult;
  const evidence = latestReport
    ? reportStatus
      ? `report ${reportStatus}`
      : "report without validation result"
    : "evidence missing";

  return `${taskStatus}; ${evidence}`;
}

function diffReviewSummary(task: AgentQueueTask | null) {
  if (!task) {
    return "Missing";
  }

  return `${displayTaskTitle(task)} (${statusLabel(task.status)})`;
}

function linkedDiffReviewTask(
  sourceTask: AgentQueueTask,
  tasks: AgentQueueTask[],
) {
  if (sourceTask.diffReview?.sourceItemId) {
    return sourceTask;
  }

  return (
    tasks.find(
      (task) =>
        task.itemType === "diff_review" &&
        task.diffReview?.sourceItemId === sourceTask.queueItemId,
    ) ?? null
  );
}

function finalizationDependencyImpact(
  task: AgentQueueTask,
  tasks: AgentQueueTask[],
) {
  const dependents = tasks.filter((candidate) =>
    normalizeTaskDependencies(candidate.dependsOn).includes(task.queueItemId),
  );

  if (!dependents.length) {
    return {
      summary:
        "No dependent Queue items reference this task; no dependent task will run.",
    };
  }

  const acceptedGate = recomputeDependentReadinessAfterFinalization({
    finalizedTask: {
      ...task,
      coordinatorStatus: "finalized",
      status: "completed",
    },
    tasks,
  });

  return {
    summary: `${acceptedGate.summary} Non-accept decisions keep dependents blocked.`,
  };
}

function confirmationLabel(target: ConfirmationTarget) {
  switch (target) {
    case "accept_with_commit":
      return "accept with commit";
    case "accept_without_commit":
      return "accept without commit";
    case "mark_rollback_required":
      return "rollback required";
  }
}
