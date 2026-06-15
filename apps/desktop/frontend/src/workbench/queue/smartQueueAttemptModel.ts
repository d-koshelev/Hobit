export type SmartQueueAttemptStatus =
  | "pending"
  | "running"
  | "validation"
  | "succeeded"
  | "failed"
  | "cancelled";

export type SmartQueueAttemptFailureKind =
  | "validation_failure"
  | "execution_failure"
  | "missing_config"
  | "missing_context"
  | "dependency_failed"
  | "dependency_blocked"
  | "dirty_worktree"
  | "timeout"
  | "tool_failure"
  | "unknown";

export type SmartQueueAttemptValidationStatus =
  | "not_run"
  | "running"
  | "passed"
  | "failed";

export type SmartQueueAttemptValidationResult = {
  readonly status: SmartQueueAttemptValidationStatus;
  readonly summary?: string;
  readonly evidence?: readonly string[];
};

export type SmartQueueAttemptResult = {
  readonly summary?: string;
  readonly evidence?: readonly string[];
};

export type SmartQueueAttemptRollbackScope = {
  readonly attemptId: string;
  readonly baseRevision?: string;
  readonly changedFiles: readonly string[];
  readonly requiresApproval: true;
  readonly wouldExecuteRollback: false;
};

export type SmartQueueAttempt = {
  readonly attemptId: string;
  readonly taskId: string;
  readonly attemptNumber: number;
  readonly status: SmartQueueAttemptStatus;
  readonly startedAt?: string;
  readonly finishedAt?: string;
  readonly workerId?: string;
  readonly baseRevision?: string;
  readonly changedFiles?: readonly string[];
  readonly validationResult?: SmartQueueAttemptValidationResult;
  readonly result?: SmartQueueAttemptResult;
  readonly failureKind?: SmartQueueAttemptFailureKind;
  readonly shortReason?: string;
  readonly coordinatorDecisionId?: string;
};

export type SmartQueueAttemptHistory = {
  readonly taskId: string;
  readonly attempts: readonly SmartQueueAttempt[];
};

export type SmartQueueAttemptStartInput = {
  readonly startedAt: string;
  readonly workerId?: string;
  readonly baseRevision?: string;
  readonly changedFiles?: readonly string[];
  readonly coordinatorDecisionId?: string;
};

export type SmartQueueAttemptFinishInput = {
  readonly finishedAt: string;
  readonly changedFiles?: readonly string[];
  readonly validationResult?: SmartQueueAttemptValidationResult;
  readonly result?: SmartQueueAttemptResult;
  readonly coordinatorDecisionId?: string;
};

export type SmartQueueAttemptFailureInput = SmartQueueAttemptFinishInput & {
  readonly failureKind: SmartQueueAttemptFailureKind;
  readonly shortReason: string;
};

export type SmartQueueAttemptCreateInput = {
  readonly attemptId: string;
  readonly taskId: string;
  readonly attemptNumber?: number;
  readonly coordinatorDecisionId?: string;
};

export type SmartQueueAttemptAppendInput = Omit<
  SmartQueueAttemptCreateInput,
  "attemptNumber" | "taskId"
>;

export type SmartQueueAttemptSummaryRow = {
  readonly attemptId: string;
  readonly attemptNumber: number;
  readonly statusLabel: string;
  readonly text: string;
};

export type SmartQueueAttemptSideEffectFlags = {
  readonly wouldCallWorkspaceApi: false;
  readonly wouldExecuteAttempt: false;
  readonly wouldExecuteRetry: false;
  readonly wouldExecuteRollback: false;
  readonly wouldMutateQueue: false;
  readonly wouldPersist: false;
};

export type SmartQueueAttemptSummary = {
  readonly taskId: string;
  readonly totalAttempts: number;
  readonly currentAttemptId?: string;
  readonly currentAttemptNumber?: number;
  readonly currentStatusLabel?: string;
  readonly rows: readonly SmartQueueAttemptSummaryRow[];
  readonly lastFailureText?: string;
  readonly changedFilesCount: number;
  readonly changedFilesText: string;
  readonly rollbackScope?: SmartQueueAttemptRollbackScope;
  readonly sideEffects: SmartQueueAttemptSideEffectFlags;
};

const NO_SIDE_EFFECTS: SmartQueueAttemptSideEffectFlags = {
  wouldCallWorkspaceApi: false,
  wouldExecuteAttempt: false,
  wouldExecuteRetry: false,
  wouldExecuteRollback: false,
  wouldMutateQueue: false,
  wouldPersist: false,
};

export function createInitialAttempt(
  input: SmartQueueAttemptCreateInput,
): SmartQueueAttempt {
  return {
    attemptId: input.attemptId,
    attemptNumber: Math.max(1, input.attemptNumber ?? 1),
    coordinatorDecisionId: input.coordinatorDecisionId,
    status: "pending",
    taskId: input.taskId,
  };
}

export function startAttempt(
  attempt: SmartQueueAttempt,
  input: SmartQueueAttemptStartInput,
): SmartQueueAttempt {
  return {
    ...attempt,
    baseRevision: input.baseRevision ?? attempt.baseRevision,
    changedFiles: input.changedFiles ?? attempt.changedFiles,
    coordinatorDecisionId:
      input.coordinatorDecisionId ?? attempt.coordinatorDecisionId,
    startedAt: input.startedAt,
    status: "running",
    workerId: input.workerId ?? attempt.workerId,
  };
}

export function finishAttemptSuccess(
  attempt: SmartQueueAttempt,
  input: SmartQueueAttemptFinishInput,
): SmartQueueAttempt {
  return {
    ...attempt,
    changedFiles: input.changedFiles ?? attempt.changedFiles,
    coordinatorDecisionId:
      input.coordinatorDecisionId ?? attempt.coordinatorDecisionId,
    failureKind: undefined,
    finishedAt: input.finishedAt,
    result: input.result ?? attempt.result,
    shortReason: undefined,
    status: "succeeded",
    validationResult: input.validationResult ?? attempt.validationResult,
  };
}

export function finishAttemptFailure(
  attempt: SmartQueueAttempt,
  input: SmartQueueAttemptFailureInput,
): SmartQueueAttempt {
  return {
    ...attempt,
    changedFiles: input.changedFiles ?? attempt.changedFiles,
    coordinatorDecisionId:
      input.coordinatorDecisionId ?? attempt.coordinatorDecisionId,
    failureKind: input.failureKind,
    finishedAt: input.finishedAt,
    result: input.result ?? attempt.result,
    shortReason: cleanText(input.shortReason, defaultFailureReason(input.failureKind)),
    status: "failed",
    validationResult: input.validationResult ?? attempt.validationResult,
  };
}

export function cancelAttempt(
  attempt: SmartQueueAttempt,
  input: Pick<SmartQueueAttemptFinishInput, "coordinatorDecisionId" | "finishedAt">,
): SmartQueueAttempt {
  return {
    ...attempt,
    coordinatorDecisionId:
      input.coordinatorDecisionId ?? attempt.coordinatorDecisionId,
    finishedAt: input.finishedAt,
    status: "cancelled",
  };
}

export function markAttemptValidation(
  attempt: SmartQueueAttempt,
  validationResult: SmartQueueAttemptValidationResult = { status: "running" },
): SmartQueueAttempt {
  return {
    ...attempt,
    status: "validation",
    validationResult,
  };
}

export function appendAttempt(
  history: SmartQueueAttemptHistory,
  input: SmartQueueAttemptAppendInput,
): SmartQueueAttemptHistory {
  const attempt = createInitialAttempt({
    attemptId: input.attemptId,
    attemptNumber: nextAttemptNumber(history.attempts),
    coordinatorDecisionId: input.coordinatorDecisionId,
    taskId: history.taskId,
  });

  return {
    taskId: history.taskId,
    attempts: [...history.attempts, attempt],
  };
}

export function attachCoordinatorDecisionToAttempt(
  attempt: SmartQueueAttempt,
  coordinatorDecisionId: string,
): SmartQueueAttempt {
  return {
    ...attempt,
    coordinatorDecisionId,
  };
}

export function selectCurrentAttempt(
  history: SmartQueueAttemptHistory,
): SmartQueueAttempt | undefined {
  return [...history.attempts].sort(compareCurrentAttempt)[0];
}

export function computeAttemptSummary(
  history: SmartQueueAttemptHistory,
): SmartQueueAttemptSummary {
  const currentAttempt = selectCurrentAttempt(history);
  const rollbackScope = currentAttempt
    ? computeAttemptRollbackScope(currentAttempt)
    : undefined;
  const changedFilesCount = uniqueChangedFiles(history.attempts).length;

  return {
    changedFilesCount,
    changedFilesText: `Changed files: ${changedFilesCount}`,
    currentAttemptId: currentAttempt?.attemptId,
    currentAttemptNumber: currentAttempt?.attemptNumber,
    currentStatusLabel: currentAttempt
      ? attemptStatusLabel(currentAttempt)
      : undefined,
    lastFailureText: lastFailureText(history.attempts),
    rollbackScope,
    rows: history.attempts
      .slice()
      .sort(compareAttemptNumberAscending)
      .map((attempt) => ({
        attemptId: attempt.attemptId,
        attemptNumber: attempt.attemptNumber,
        statusLabel: attemptStatusLabel(attempt),
        text: `Attempt ${attempt.attemptNumber} ${attemptStatusLabel(attempt)}`,
      })),
    sideEffects: NO_SIDE_EFFECTS,
    taskId: history.taskId,
    totalAttempts: history.attempts.length,
  };
}

export function computeAttemptRollbackScope(
  attempt: SmartQueueAttempt,
): SmartQueueAttemptRollbackScope | undefined {
  if (!attempt.baseRevision && !attempt.changedFiles?.length) {
    return undefined;
  }

  return {
    attemptId: attempt.attemptId,
    baseRevision: attempt.baseRevision,
    changedFiles: attempt.changedFiles ?? [],
    requiresApproval: true,
    wouldExecuteRollback: false,
  };
}

export function getSmartQueueAttemptModelSideEffects(): SmartQueueAttemptSideEffectFlags {
  return NO_SIDE_EFFECTS;
}

function nextAttemptNumber(attempts: readonly SmartQueueAttempt[]) {
  return (
    attempts.reduce(
      (maxAttemptNumber, attempt) =>
        Math.max(maxAttemptNumber, attempt.attemptNumber),
      0,
    ) + 1
  );
}

function compareCurrentAttempt(
  left: SmartQueueAttempt,
  right: SmartQueueAttempt,
) {
  const byAttemptNumber = right.attemptNumber - left.attemptNumber;

  if (byAttemptNumber !== 0) {
    return byAttemptNumber;
  }

  return right.attemptId.localeCompare(left.attemptId);
}

function compareAttemptNumberAscending(
  left: SmartQueueAttempt,
  right: SmartQueueAttempt,
) {
  const byAttemptNumber = left.attemptNumber - right.attemptNumber;

  if (byAttemptNumber !== 0) {
    return byAttemptNumber;
  }

  return left.attemptId.localeCompare(right.attemptId);
}

function attemptStatusLabel(attempt: SmartQueueAttempt) {
  switch (attempt.status) {
    case "pending":
      return "Pending";
    case "running":
      return "Running";
    case "validation":
      return "Validating";
    case "succeeded":
      return "Completed";
    case "failed":
      return failedAttemptLabel(attempt);
    case "cancelled":
      return "Cancelled";
  }
}

function failedAttemptLabel(attempt: SmartQueueAttempt) {
  if (
    attempt.failureKind === "validation_failure" ||
    attempt.validationResult?.status === "failed"
  ) {
    return "Failed validation";
  }

  return "Failed";
}

function lastFailureText(attempts: readonly SmartQueueAttempt[]) {
  const failedAttempt = attempts
    .filter((attempt) => attempt.status === "failed")
    .sort(compareCurrentAttempt)[0];

  if (!failedAttempt) {
    return undefined;
  }

  return `Last failure: ${cleanText(
    failedAttempt.shortReason,
    defaultFailureReason(failedAttempt.failureKind),
  )}`;
}

function uniqueChangedFiles(attempts: readonly SmartQueueAttempt[]) {
  return [
    ...new Set(
      attempts.flatMap((attempt) =>
        (attempt.changedFiles ?? []).map((changedFile) => changedFile.trim()),
      ).filter(Boolean),
    ),
  ];
}

function defaultFailureReason(kind: SmartQueueAttemptFailureKind | undefined) {
  switch (kind) {
    case "validation_failure":
      return "validation failed";
    case "execution_failure":
      return "execution failed";
    case "missing_config":
      return "missing config";
    case "missing_context":
      return "missing context";
    case "dependency_failed":
      return "dependency failed";
    case "dependency_blocked":
      return "dependency blocked";
    case "dirty_worktree":
      return "dirty workspace";
    case "timeout":
      return "timeout";
    case "tool_failure":
      return "tool failure";
    case "unknown":
    default:
      return "attempt failed";
  }
}

function cleanText(value: string | undefined, fallback: string) {
  const cleanValue = value?.trim();

  return cleanValue || fallback;
}
