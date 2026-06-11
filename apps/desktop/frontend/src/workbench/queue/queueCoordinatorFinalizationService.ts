import type {
  AgentQueueClosureState,
  AgentQueueCoordinatorStatus,
  AgentQueueTask,
  AgentQueueTaskStatus,
  AgentQueueTaskValidationStatus,
  AgentQueueWorkerExecutionReport,
} from "../../workspace/types";
import { normalizeTaskDependencies } from "../agentQueueDependencyUi";
import { DEFAULT_TASK_TITLE, normalizeQueueTag } from "../agentQueueTaskUiModel";
import type {
  QueueCreateItemRequest,
  QueueUpdateItemRequest,
  QueueWidgetActionResult,
  QueueWidgetItemSnapshot,
} from "./agentQueueWidgetApiTypes";
import { validateCommitHashFormat } from "../coordinator";
import {
  appendCoordinatorFinalizationMetadata,
  buildCoordinatorFinalizationReport,
  decisionSummary,
  latestReportForTask,
} from "./queueCoordinatorFinalizationReport";

export type QueueCoordinatorFinalizationDecision =
  | "accepted_with_commit"
  | "accepted_without_commit"
  | "request_changes"
  | "follow_up_required"
  | "blocked"
  | "failed"
  | "rollback_required"
  | "manual_review_required";

export type QueueCoordinatorEvidenceRef = {
  kind: "validation" | "diff_review" | "worker_report" | "manual";
  refId: string;
  status: string;
  summary?: string;
};

export type QueueCoordinatorCommitMetadata = {
  commitHash?: string;
  commitTitle?: string;
  expectedCommitTitle?: string;
  noCommitReason?: string;
  verificationStatus?: "verified" | "unverified" | "unsupported";
};

export type QueueCoordinatorDiffReviewRef = {
  itemId?: string;
  recommendation?: string;
  reportId?: string;
  status?: string;
};

export type QueueDependencyGateResult = {
  dependents: QueueDependentGateState[];
  sourceItemId: string;
  sourceSatisfiesDependency: boolean;
  summary: string;
};

export type QueueDependentGateState = {
  blockedBy: Array<{
    queueItemId: string;
    reason: "missing" | "not_completed" | "not_finalized" | "self";
    title: string;
  }>;
  dependentItemId: string;
  ready: boolean;
  summary: string;
};

export type QueueCoordinatorFinalizationWarning = {
  code:
    | "accept_commit_hash_missing"
    | "commit_hash_invalid"
    | "commit_hash_unverified"
    | "first_class_fields_unsupported"
    | "queue_create_failed"
    | "queue_report_metadata_unavailable"
    | "queue_update_failed";
  message: string;
};

export type QueueCoordinatorDecisionState = {
  closureState: AgentQueueClosureState;
  coordinatorStatus: AgentQueueCoordinatorStatus;
  status: AgentQueueTaskStatus;
  validationStatus: AgentQueueTaskValidationStatus;
};

export type QueueCoordinatorFinalizationApi = {
  createItem?: (
    request: QueueCreateItemRequest,
  ) => Promise<QueueWidgetActionResult<QueueWidgetItemSnapshot>>;
  updateItem: (
    request: QueueUpdateItemRequest,
  ) => Promise<QueueWidgetActionResult<QueueWidgetItemSnapshot>>;
};

export type QueueCoordinatorFinalizationInput = {
  commit?: QueueCoordinatorCommitMetadata;
  decision: QueueCoordinatorFinalizationDecision;
  diffReview?: QueueCoordinatorDiffReviewRef;
  evidenceRefs?: QueueCoordinatorEvidenceRef[];
  now?: () => string;
  operatorNote?: string;
  queueApi: QueueCoordinatorFinalizationApi;
  queueItemId: string;
  task: AgentQueueTask;
  tasks: AgentQueueTask[];
  workspaceId: string;
};

export type QueueCoordinatorFinalizationResult = {
  decisionState: QueueCoordinatorDecisionState;
  dependencyGate: QueueDependencyGateResult;
  localTaskPatch: Pick<
    AgentQueueTask,
    "closureState" | "coordinatorStatus" | "validationStatus"
  >;
  message: string;
  report: AgentQueueWorkerExecutionReport;
  updateResult: QueueWidgetActionResult<QueueWidgetItemSnapshot>;
  warnings: QueueCoordinatorFinalizationWarning[];
};

export async function finalizeQueueItemWithCoordinatorDecision({
  commit,
  decision,
  diffReview,
  evidenceRefs = [],
  now = () => new Date().toISOString(),
  operatorNote,
  queueApi,
  queueItemId,
  task,
  tasks,
  workspaceId,
}: QueueCoordinatorFinalizationInput): Promise<QueueCoordinatorFinalizationResult> {
  const timestamp = now();
  const decisionState = decisionStateForCoordinatorDecision({
    commit,
    decision,
  });
  const taskAfterDecision = {
    ...task,
    closureState: decisionState.closureState,
    coordinatorStatus: decisionState.coordinatorStatus,
    status: decisionState.status,
    validationStatus: decisionState.validationStatus,
  };
  const dependencyGate = recomputeDependentReadinessAfterFinalization({
    finalizedTask: taskAfterDecision,
    tasks,
  });
  const warnings = finalizationWarnings({
    commit,
    decision,
  });
  const report = buildCoordinatorFinalizationReport({
    commit,
    dependencyGate,
    decision,
    decisionState,
    diffReview,
    evidenceRefs,
    operatorNote,
    task,
    timestamp,
    warnings,
  });
  const updateResult = await queueApi.updateItem({
    actor: "operator",
    itemId: queueItemId,
    patch: {
      appendWorkerExecutionReport: report,
      description: appendCoordinatorFinalizationMetadata(task.description, report),
      status: decisionState.status,
      validationStatus: decisionState.validationStatus,
    },
    reason: "Explicit coordinator finalization decision.",
    workspaceId,
  });
  const resultWarnings = [...warnings];

  if (!updateResult.ok) {
    resultWarnings.push({
      code: "queue_update_failed",
      message:
        updateResult.error?.message ??
        "Queue update failed; coordinator finalization metadata was not stored.",
    });
  } else if (updateResult.item?.reportSummary.status !== "report_ready") {
    resultWarnings.push({
      code: "queue_report_metadata_unavailable",
      message:
        "Queue update path accepted the decision, but attached coordinator report metadata was not returned by the current Queue DTO.",
    });
  }

  return {
    decisionState,
    dependencyGate,
    localTaskPatch: {
      closureState: decisionState.closureState,
      coordinatorStatus: decisionState.coordinatorStatus,
      validationStatus: decisionState.validationStatus,
    },
    message: `${decisionSummary(decision, commit)} ${dependencyGate.summary} No Queue run, Autorun, Git commit, push, or rollback was started.`,
    report,
    updateResult,
    warnings: resultWarnings,
  };
}

export function requestQueueItemChanges(
  input: Omit<QueueCoordinatorFinalizationInput, "decision">,
) {
  return finalizeQueueItemWithCoordinatorDecision({
    ...input,
    decision: "request_changes",
  });
}

export async function createCoordinatorFollowUp({
  followUpPrompt,
  followUpTitle,
  ...input
}: Omit<QueueCoordinatorFinalizationInput, "decision"> & {
  followUpPrompt?: string;
  followUpTitle?: string;
}) {
  if (!input.queueApi.createItem) {
    const result = await finalizeQueueItemWithCoordinatorDecision({
      ...input,
      decision: "follow_up_required",
      operatorNote:
        input.operatorNote ??
        "Follow-up creation was requested, but Queue create action is unavailable.",
    });

    return {
      ...result,
      createResult: null,
      warnings: [
        ...result.warnings,
        {
          code: "queue_create_failed" as const,
          message:
            "Queue create action is unavailable; no follow-up item was created or run.",
        },
      ],
    };
  }

  const sourceTitle = input.task.title.trim() || DEFAULT_TASK_TITLE;
  const queueTag = normalizeQueueTag(input.task);
  const createResult = await input.queueApi.createItem({
    actor: "operator",
    approvalPolicy: input.task.approvalPolicy ?? null,
    codexExecutable: input.task.codexExecutable ?? null,
    dependencies: [],
    description: `Explicit coordinator follow-up for ${sourceTitle}.`,
    executionPolicy: "manual",
    executionWorkspace: input.task.executionWorkspace ?? null,
    itemType: "follow_up",
    priority: input.task.priority,
    prompt:
      followUpPrompt ??
      `Follow-up for Queue item ${input.task.queueItemId}.\n\nSource: ${sourceTitle}\nCoordinator decision: follow-up required.\n\nDo not run automatically.`,
    queueTag: { id: queueTag.queueTagId, name: queueTag.queueTagName },
    sandbox: input.task.sandbox ?? null,
    status: "queued",
    title: followUpTitle ?? `Follow-up: ${sourceTitle}`,
    workspaceId: input.workspaceId,
  });
  const finalization = await finalizeQueueItemWithCoordinatorDecision({
    ...input,
    decision: "follow_up_required",
    operatorNote:
      input.operatorNote ??
      (createResult.ok && createResult.item
        ? `Created follow-up ${createResult.item.id}.`
        : "Follow-up creation failed."),
  });

  return {
    ...finalization,
    createResult,
    warnings: createResult.ok
      ? finalization.warnings
      : [
          ...finalization.warnings,
          {
            code: "queue_create_failed" as const,
            message:
              createResult.error?.message ??
              "Follow-up Queue item could not be created.",
          },
        ],
  };
}

export function markQueueItemBlockedByCoordinator(
  input: Omit<QueueCoordinatorFinalizationInput, "decision">,
) {
  return finalizeQueueItemWithCoordinatorDecision({
    ...input,
    decision: "blocked",
  });
}

export function markQueueItemRollbackRequired(
  input: Omit<QueueCoordinatorFinalizationInput, "decision">,
) {
  return finalizeQueueItemWithCoordinatorDecision({
    ...input,
    decision: "rollback_required",
  });
}

export function summarizeQueueCoordinatorState(task: AgentQueueTask) {
  const latestReport = latestReportForTask(task);

  return {
    closureState: task.closureState ?? null,
    commitHash: latestReport?.commitHash ?? null,
    coordinatorStatus: task.coordinatorStatus ?? "not_reported",
    diffReviewStatus: task.diffReview ? "linked" : "none",
    latestReportId: latestReport?.reportId ?? null,
    queueItemId: task.queueItemId,
    validationStatus: task.validationStatus ?? "not_started",
  };
}

export function recomputeDependentReadinessAfterFinalization({
  finalizedTask,
  tasks,
}: {
  finalizedTask: AgentQueueTask;
  tasks: AgentQueueTask[];
}): QueueDependencyGateResult {
  const nextTasks = tasks.map((task) =>
    task.queueItemId === finalizedTask.queueItemId ? finalizedTask : task,
  );
  const dependentStates = nextTasks
    .filter((task) =>
      normalizeTaskDependencies(task.dependsOn).includes(
        finalizedTask.queueItemId,
      ),
    )
    .map((dependent) => dependencyGateStateForTask(dependent, nextTasks));
  const sourceSatisfiesDependency =
    finalizedTask.status === "completed" &&
    finalizedTask.coordinatorStatus === "finalized";

  return {
    dependents: dependentStates,
    sourceItemId: finalizedTask.queueItemId,
    sourceSatisfiesDependency,
    summary: explainDependencyGateState({
      dependents: dependentStates,
      sourceSatisfiesDependency,
    }),
  };
}

export function explainDependencyGateState({
  dependents,
  sourceSatisfiesDependency,
}: Pick<
  QueueDependencyGateResult,
  "dependents" | "sourceSatisfiesDependency"
>) {
  if (!dependents.length) {
    return sourceSatisfiesDependency
      ? "No dependent Queue items reference this item."
      : "This decision does not satisfy dependency gates.";
  }

  const readyCount = dependents.filter((dependent) => dependent.ready).length;

  return `${readyCount.toString()} of ${dependents.length.toString()} dependent Queue item${dependents.length === 1 ? "" : "s"} ${readyCount === 1 ? "is" : "are"} dependency-ready; no dependent task was started.`;
}

function decisionStateForCoordinatorDecision({
  commit,
  decision,
}: {
  commit?: QueueCoordinatorCommitMetadata;
  decision: QueueCoordinatorFinalizationDecision;
}): QueueCoordinatorDecisionState {
  switch (decision) {
    case "accepted_with_commit":
      const hasValidCommit = hasValidCommitHash(commit);
      return {
        closureState: hasValidCommit ? "commit_created" : "commit_required",
        coordinatorStatus: hasValidCommit
          ? "finalized"
          : "ready_for_finalization",
        status: hasValidCommit ? "completed" : "review_needed",
        validationStatus: hasValidCommit ? "passed" : "needs_review",
      };
    case "accepted_without_commit":
      return {
        closureState: "no_change_accepted",
        coordinatorStatus: "finalized",
        status: "completed",
        validationStatus: "passed",
      };
    case "request_changes":
      return blockedDecision("needs_changes");
    case "follow_up_required":
      return blockedDecision("follow_up_required");
    case "blocked":
    case "manual_review_required":
      return blockedDecision("blocked");
    case "failed":
      return {
        closureState: "closure_blocked",
        coordinatorStatus: "failed",
        status: "failed",
        validationStatus: "failed",
      };
    case "rollback_required":
      return blockedDecision("rollback_required");
  }
}

function blockedDecision(
  coordinatorStatus: Exclude<
    AgentQueueCoordinatorStatus,
    | "awaiting_coordinator_review"
    | "awaiting_validation"
    | "finalized"
    | "not_reported"
    | "ready_for_finalization"
    | "worker_reported"
  >,
): QueueCoordinatorDecisionState {
  return {
    closureState: "closure_blocked",
    coordinatorStatus,
    status: "review_needed",
    validationStatus: "needs_review",
  };
}

function finalizationWarnings({
  commit,
  decision,
}: {
  commit?: QueueCoordinatorCommitMetadata;
  decision: QueueCoordinatorFinalizationDecision;
}): QueueCoordinatorFinalizationWarning[] {
  const warnings: QueueCoordinatorFinalizationWarning[] = [
    {
      code: "first_class_fields_unsupported",
      message:
        "Current Queue update DTO does not persist first-class coordinator finalization, closure, commit title, Diff Review, or dependency gate fields; metadata was stored in the visible Queue description/report section where supported.",
    },
  ];

  if (decision === "accepted_with_commit" && !commit?.commitHash) {
    warnings.push({
      code: "accept_commit_hash_missing",
      message:
        "Accepted-with-commit decision did not include a commit hash, so the task remains ready for finalization.",
    });
  }

  if (
    decision === "accepted_with_commit" &&
    commit?.commitHash &&
    !validateCommitHashFormat(commit.commitHash).valid
  ) {
    warnings.push({
      code: "commit_hash_invalid",
      message:
        "Accept with commit requires a valid 7-40 character hexadecimal commit hash.",
    });
  }

  if (
    decision === "accepted_with_commit" &&
    commit?.commitHash &&
    hasValidCommitHash(commit) &&
    commit.verificationStatus !== "verified"
  ) {
    warnings.push({
      code: "commit_hash_unverified",
      message:
        "Commit hash/title verification is unsupported by this frontend-only service; recorded commit metadata is unverified.",
    });
  }

  return warnings;
}

function hasValidCommitHash(commit: QueueCoordinatorCommitMetadata | undefined) {
  return validateCommitHashFormat(commit?.commitHash).valid;
}

function dependencyGateStateForTask(
  task: AgentQueueTask,
  tasks: AgentQueueTask[],
): QueueDependentGateState {
  const tasksById = new Map(tasks.map((candidate) => [candidate.queueItemId, candidate]));
  const blockers: QueueDependentGateState["blockedBy"] = [];

  for (const dependencyId of normalizeTaskDependencies(task.dependsOn)) {
    if (dependencyId === task.queueItemId) {
      blockers.push({
        queueItemId: dependencyId,
        reason: "self",
        title: task.title.trim() || task.queueItemId,
      });
      continue;
    }

    const dependency = tasksById.get(dependencyId);
    if (!dependency) {
      blockers.push({
        queueItemId: dependencyId,
        reason: "missing",
        title: dependencyId,
      });
      continue;
    }

    if (dependency.status !== "completed") {
      blockers.push({
        queueItemId: dependencyId,
        reason: "not_completed",
        title: dependency.title.trim() || dependency.queueItemId,
      });
      continue;
    }

    if (dependency.coordinatorStatus !== "finalized") {
      blockers.push({
        queueItemId: dependencyId,
        reason: "not_finalized",
        title: dependency.title.trim() || dependency.queueItemId,
      });
    }
  }

  return {
    blockedBy: blockers,
    dependentItemId: task.queueItemId,
    ready: blockers.length === 0,
    summary: blockers.length
      ? `Blocked by ${blockers.map((blocker) => blocker.title).join(", ")}.`
      : "All prerequisites accepted/finalized.",
  };
}
