import type {
  HobitAgentActionResult,
  HobitAgentActionStatus,
  HobitAgentWorkflowRequestEnvelopeReadResult,
} from "../agents/broker";
import type {
  AgentActivitySeverity,
  AgentActivityStatus,
} from "../agentActivityModel";
import type {
  QueueWorkflowRunnerRuntimeResult,
  QueueWorkflowRunnerRuntimeStatus,
} from "../agents/modules";

export function workspaceAgentHobitActionResultMessage(
  actionResult: HobitAgentActionResult,
): string {
  switch (actionResult.status) {
    case "succeeded":
      return succeededActionMessage(actionResult);
    case "blocked":
      return withReason("Action blocked.", actionResult);
    case "blocked_actionable":
      return withReason("Action blocked with next action.", actionResult);
    case "already_exists":
      return withReason("Action already exists.", actionResult);
    case "already_done":
      return withReason("Action already done.", actionResult);
    case "already_failed":
      return withReason("Action already failed.", actionResult);
    case "precondition_failed":
      return withReason("Action precondition failed.", actionResult);
    case "needs_confirmation":
      return withReason("Action needs confirmation.", actionResult);
    case "paused":
      return withReason("Action paused.", actionResult);
    case "dry_run_required":
      return withReason("Action requires dry-run first.", actionResult);
    case "policy_blocked":
      return withReason("Action blocked by policy.", actionResult);
    case "unavailable":
      return withReason("Action unavailable.", actionResult);
    case "invalid_input":
      return withReason("Invalid Hobit action request.", actionResult);
    case "failed_unexpected":
      return withReason("Hobit action failed unexpectedly.", actionResult);
    case "failed":
      return withReason("Hobit action failed.", actionResult);
  }
}

export function workspaceAgentInvalidActionRequestMessage(
  reasons: readonly string[],
): string {
  return withOptionalReason(
    "Invalid Hobit action request.",
    reasons[0] ?? null,
  );
}

export function workspaceAgentWorkflowRequestMessage(
  workflowRead: Extract<
    HobitAgentWorkflowRequestEnvelopeReadResult,
    { status: "valid" }
  >,
): string {
  if (workflowRead.validation.ok) {
    if (workflowRead.validation.status === "workflow_valid_not_executable") {
      return withOptionalReason(
        "Queue workflow request validated, but no workflow runner was invoked in this context.",
        workflowRead.validation.reasons[1] ?? null,
      );
    }

    return "Workflow request recognized, but no workflow runner was invoked in this context.";
  }

  if (!workflowRead.validation.ok) {
    if (workflowRead.validation.reasonCode === "input_validation_deferred") {
      return withOptionalReason(
        "Workflow request recognized, but Queue workflow input validation is deferred.",
        workflowRead.validation.reasons[0] ?? null,
      );
    }

    if (workflowRead.validation.reasonCode === "workflow_unavailable") {
      return withOptionalReason(
        "Workflow request recognized, but no workflow runner was invoked in this context.",
        workflowRead.validation.reasons[0] ?? null,
      );
    }

    return withOptionalReason(
      "Workflow request recognized, but workflow is not declared/implemented yet.",
      workflowRead.validation.reasons[0] ?? null,
    );
  }

  return "Workflow request recognized, but no workflow runner was invoked in this context.";
}

export function workspaceAgentInvalidWorkflowRequestMessage(
  reasons: readonly string[],
): string {
  return withOptionalReason(
    "Invalid Hobit workflow request.",
    reasons.length > 0 ? reasons.join(" ") : null,
  );
}

export function workspaceAgentQueueWorkflowRuntimeResultMessage(
  runtimeResult: QueueWorkflowRunnerRuntimeResult,
): string {
  const runnerResult = runtimeResult.runnerResult;
  const taskIdsBySlot = runnerResult
    ? Object.entries(runnerResult.variables.taskIdsBySlot)
    : [];
  const review = runnerResult?.report.review;
  const finalization = runnerResult?.report.finalization;
  const downstream = finalization?.downstreamVerification;
  const missingIds = runnerResult?.report.missingExplicitIds ?? [];
  const idParts = [
    runtimeResult.workflowId
      ? `Workflow: ${runtimeResult.workflowId}.`
      : null,
    runtimeResult.workflowRunId
      ? `Workflow run: ${runtimeResult.workflowRunId}.`
      : null,
    runtimeResult.requestId ? `Request: ${runtimeResult.requestId}.` : null,
    runtimeResult.persistentStatus
      ? `Persistent status: ${runtimeResult.persistentStatus}.`
      : null,
    runtimeResult.workflowStartStatus
      ? `Start: ${runtimeResult.workflowStartStatus}.`
      : null,
    runtimeResult.persistenceStatus
      ? `Persistence: ${runtimeResult.persistenceStatus}.`
      : null,
    runtimeResult.phase ? `Phase: ${runtimeResult.phase}.` : null,
    runtimeResult.phasesExecuted.length > 0
      ? `Executed: ${runtimeResult.phasesExecuted.join(", ")}.`
      : null,
    typeof runtimeResult.actionLedgerSummaryCount === "number"
      ? `Action summaries: ${runtimeResult.actionLedgerSummaryCount.toString()}.`
      : null,
    typeof runtimeResult.persistedActionCount === "number"
      ? `Persisted actions: ${runtimeResult.persistedActionCount.toString()}.`
      : null,
    runtimeResult.resumePlan
      ? `Resume plan: ${runtimeResult.resumePlan.status}.`
      : null,
  ];
  const runnerParts = [
    taskIdsBySlot.length > 0
      ? `Task ids: ${taskIdsBySlot
          .map(([slot, taskId]) => `${slot}=${taskId}`)
          .join(", ")}.`
      : null,
    runnerResult?.variables.scopedRunIds.length
      ? `Run ids: ${runnerResult.variables.scopedRunIds.join(", ")}.`
      : null,
    runnerResult?.variables.scopedEvidenceBundleIds.length
      ? `Evidence bundle ids: ${runnerResult.variables.scopedEvidenceBundleIds.join(", ")}.`
      : null,
    runnerResult?.variables.scopedMessageIds.length
      ? `Message ids: ${runnerResult.variables.scopedMessageIds.join(", ")}.`
      : null,
  ];
  const reviewParts = review
    ? [
        review.status ? `Review: ${review.status}.` : null,
        review.taskId ? `Review task: ${review.taskId}.` : null,
        review.runId ? `Review run: ${review.runId}.` : null,
        review.evidenceBundleId
          ? `Review evidence: ${review.evidenceBundleId}.`
          : null,
        review.messageId ? `Review message: ${review.messageId}.` : null,
        review.createStatus ? `Review create: ${review.createStatus}.` : null,
        review.ackStatus ? `Review ack: ${review.ackStatus}.` : null,
      ]
    : [];
  const finalizationParts = finalization
    ? [
        finalization.status ? `Finalization: ${finalization.status}.` : null,
        finalization.finalizationAction
          ? `Finalization action: ${finalization.finalizationAction}.`
          : null,
        finalization.taskId
          ? `Finalization task: ${finalization.taskId}.`
          : null,
        finalization.commandStatus
          ? `Finalization command: ${finalization.commandStatus}.`
          : null,
        finalization.failureReason
          ? `Failure reason: ${finalization.failureReason}.`
          : null,
        downstream?.taskId ? `Downstream task: ${downstream.taskId}.` : null,
        downstream?.dependencyVerified !== null &&
        downstream?.dependencyVerified !== undefined
          ? `Downstream dependency verified: ${String(downstream.dependencyVerified)}.`
          : null,
        downstream?.notAutoStartedVerified !== null &&
        downstream?.notAutoStartedVerified !== undefined
          ? `Downstream auto-start check: ${String(downstream.notAutoStartedVerified)}.`
          : null,
      ]
    : [];
  const diagnosticParts = [
    missingIds.length > 0 ? `Missing ids: ${missingIds.join(", ")}.` : null,
    runtimeResult.blockers.length > 0
      ? `Blocker: ${runtimeResult.blockers.slice(0, 2).join(" ")}`
      : null,
    runtimeResult.unsupportedReason
      ? `Reason: ${runtimeResult.unsupportedReason}.`
      : null,
  ];
  const parts = [
    `Queue workflow runner report. Status: ${runtimeResult.status}.`,
    runtimeResult.summary,
    ...idParts,
    ...runnerParts,
    ...reviewParts,
    ...finalizationParts,
    ...diagnosticParts,
  ].filter((part): part is string => Boolean(part));

  return parts.join(" ");
}

export function activityStatusForQueueWorkflowRuntimeResult(
  runtimeResult: QueueWorkflowRunnerRuntimeResult,
): AgentActivityStatus {
  if (runtimeResult.status === "completed") {
    return "completed";
  }

  if (
    runtimeResult.status === "blocked" ||
    runtimeResult.status === "deferred" ||
    runtimeResult.status === "paused" ||
    runtimeResult.status === "unsupported" ||
    runtimeResult.status === "unavailable"
  ) {
    return "pending";
  }

  return "failed";
}

export function activitySeverityForQueueWorkflowRuntimeResult(
  runtimeResult: QueueWorkflowRunnerRuntimeResult,
): AgentActivitySeverity {
  if (runtimeResult.status === "completed") {
    return "success";
  }

  if (
    runtimeResult.status === "blocked" ||
    runtimeResult.status === "deferred" ||
    runtimeResult.status === "paused" ||
    runtimeResult.status === "unsupported" ||
    runtimeResult.status === "unavailable"
  ) {
    return "warning";
  }

  return "error";
}

export function workspaceAgentQueueWorkflowRuntimeActivityTitle(
  runtimeStatus: QueueWorkflowRunnerRuntimeStatus,
): string {
  if (runtimeStatus === "completed") {
    return "Queue workflow runner completed";
  }

  if (runtimeStatus === "paused") {
    return "Queue workflow runner paused";
  }

  if (runtimeStatus === "blocked") {
    return "Queue workflow runner blocked";
  }

  if (runtimeStatus === "deferred") {
    return "Queue workflow deferred";
  }

  if (runtimeStatus === "unsupported") {
    return "Queue workflow unsupported";
  }

  if (runtimeStatus === "unavailable") {
    return "Queue workflow runner unavailable";
  }

  return "Queue workflow runner failed";
}

export function workspaceAgentHobitActionActivityTitle(
  resultStatus: HobitAgentActionStatus,
  capabilityId?: string,
  dryRun = false,
): string {
  if (resultStatus === "succeeded") {
    if (capabilityId === "queue.targetSingletonQueue") {
      return "Queue target resolved";
    }

    if (capabilityId === "queue.items.list") {
      return "Queue items listed";
    }

    if (capabilityId === "queue.item.updateRunSettings") {
      return "Queue run settings updated";
    }

    if (capabilityId === "queue.item.promoteDraft") {
      return dryRun
        ? "Queue draft promotion preview prepared"
        : "Queue draft promoted";
    }

    if (capabilityId === "queue.enable") {
      return dryRun ? "Queue enable preview prepared" : "Queue enabled";
    }

    if (capabilityId === "queue.item.startRun") {
      return "Queue-linked run started";
    }

    const lifecycleTitle = queueLifecycleActivityTitle(capabilityId);
    if (lifecycleTitle) {
      return lifecycleTitle;
    }

    if (
      capabilityId === "queue.preparePromptPackPreview" ||
      ((capabilityId === "queue.createItem" ||
        capabilityId === "queue.createItems" ||
        capabilityId === "queue.importPromptPack") &&
        dryRun)
    ) {
      return "Queue items preview prepared";
    }

    if (
      capabilityId === "queue.createItem" ||
      capabilityId === "queue.createItems" ||
      capabilityId === "queue.importPromptPack"
    ) {
      return "Queue items created";
    }

    return "Hobit action completed";
  }

  if (resultStatus === "needs_confirmation") {
    return "Action needs confirmation";
  }

  if (resultStatus === "blocked") {
    return "Action blocked";
  }

  if (resultStatus === "blocked_actionable") {
    return "Action blocked with next action";
  }

  if (resultStatus === "already_exists") {
    return "Action already exists";
  }

  if (resultStatus === "already_done") {
    return "Action already done";
  }

  if (resultStatus === "already_failed") {
    return "Action already failed";
  }

  if (resultStatus === "precondition_failed") {
    return "Action precondition failed";
  }

  if (resultStatus === "paused") {
    return "Action paused";
  }

  if (resultStatus === "dry_run_required") {
    return "Action requires dry-run first";
  }

  if (resultStatus === "policy_blocked") {
    return "Action blocked by policy";
  }

  if (resultStatus === "unavailable") {
    return "Action unavailable";
  }

  if (resultStatus === "invalid_input") {
    return "Invalid Hobit action request";
  }

  if (resultStatus === "failed_unexpected") {
    return "Hobit action failed unexpectedly";
  }

  return "Hobit action failed";
}

export function activityStatusForHobitActionResult(
  actionResult: HobitAgentActionResult | undefined,
): AgentActivityStatus {
  if (!actionResult) {
    return "failed";
  }

  if (actionResult.status === "succeeded") {
    return "completed";
  }

  if (
    actionResult.status === "needs_confirmation" ||
    actionResult.status === "dry_run_required"
  ) {
    return "pending";
  }

  return "failed";
}

export function activitySeverityForHobitActionResult(
  actionResult: HobitAgentActionResult | undefined,
): AgentActivitySeverity {
  if (!actionResult) {
    return "error";
  }

  if (actionResult.status === "succeeded") {
    return "success";
  }

  if (
    actionResult.status === "needs_confirmation" ||
    actionResult.status === "dry_run_required" ||
    actionResult.status === "unavailable"
  ) {
    return "warning";
  }

  return "error";
}

function succeededActionMessage(actionResult: HobitAgentActionResult) {
  if (actionResult.capabilityId === "queue.targetSingletonQueue") {
    return "Queue target resolved.";
  }

  const lifecycleMessage = queueLifecycleSucceededMessage(
    actionResult.capabilityId,
    actionResult.dryRun,
  );
  if (lifecycleMessage) {
    return lifecycleMessage;
  }

  if (
    actionResult.capabilityId === "queue.preparePromptPackPreview" ||
    (actionResult.capabilityId === "queue.createItems" && actionResult.dryRun) ||
    (actionResult.capabilityId === "queue.createItem" && actionResult.dryRun) ||
    (actionResult.capabilityId === "queue.importPromptPack" &&
      actionResult.dryRun)
  ) {
    const count = numberOutputField(actionResult.output, "wouldCreateItems");
    return count === null
      ? "Queue items preview prepared."
      : `Queue items preview prepared. Would create ${count.toString()} Queue item${count === 1 ? "" : "s"}.`;
  }

  if (
    actionResult.capabilityId === "queue.createItem" ||
    actionResult.capabilityId === "queue.createItems" ||
    actionResult.capabilityId === "queue.importPromptPack"
  ) {
    return createdQueueItemsMessage(actionResult);
  }

  if (actionResult.capabilityId === "queue.items.list") {
    return queueItemsListMessage(actionResult);
  }

  if (actionResult.capabilityId === "queue.item.updateRunSettings") {
    return queueRunSettingsMessage(actionResult);
  }

  if (actionResult.capabilityId === "queue.item.promoteDraft") {
    return queuePromoteDraftMessage(actionResult);
  }

  if (actionResult.capabilityId === "queue.enable") {
    return queueEnableMessage(actionResult);
  }

  if (actionResult.capabilityId === "queue.item.startRun") {
    return queueStartRunMessage(actionResult);
  }

  if (actionResult.capabilityId === "queue.selfTest") {
    return actionResult.message || "Queue self-test completed.";
  }

  return actionResult.message || "Hobit action completed.";
}

function createdQueueItemsMessage(actionResult: HobitAgentActionResult) {
  const createdItems = arrayOutputField(actionResult.output, "createdItems");
  if (!createdItems) {
    return "Queue items created.";
  }
  const count = createdItems.length;

  const ids = createdItems
    .map((item) => (isRecord(item) ? stringField(item, "id") : null))
    .filter((item): item is string => Boolean(item));
  const titles = createdItems
    .map((item) => (isRecord(item) ? stringField(item, "title") : null))
    .filter((item): item is string => Boolean(item));
  const blockers = createdItems.flatMap((item) =>
    isRecord(item) && isRecord(item.readiness)
      ? stringArrayField(item.readiness, "blockerReasons")
      : [],
  );
  const parts = [
    `Queue items created. Created ${count.toString()} Queue item${count === 1 ? "" : "s"}.`,
    ids.length > 0
      ? `Task id${ids.length === 1 ? "" : "s"}: ${ids.join(", ")}.`
      : null,
    titles.length > 0
      ? `Title${titles.length === 1 ? "" : "s"}: ${titles.join("; ")}.`
      : null,
    blockers.length > 0 ? `Blocker: ${blockers[0]}` : null,
    nextSuggestedCapability(actionResult.output),
  ].filter((part): part is string => Boolean(part));

  return parts.join(" ");
}

function queueItemsListMessage(actionResult: HobitAgentActionResult) {
  const items = arrayOutputField(actionResult.output, "items") ?? [];
  const ids = items
    .map((item) => (isRecord(item) ? stringField(item, "taskId") : null))
    .filter((item): item is string => Boolean(item));
  const executors = arrayOutputField(actionResult.output, "availableExecutors") ?? [];
  const executorIds = executors
    .map((item) =>
      isRecord(item) ? stringField(item, "executorWidgetId") : null,
    )
    .filter((item): item is string => Boolean(item));
  const firstBlocker = items
    .flatMap((item) =>
      isRecord(item) ? stringArrayField(item, "blockerReasons") : [],
    )[0];
  const parts = [
    `Queue items listed. Returned ${items.length.toString()} item${items.length === 1 ? "" : "s"}.`,
    ids.length > 0
      ? `Task id${ids.length === 1 ? "" : "s"}: ${ids.join(", ")}.`
      : null,
    executorIds.length > 0
      ? `Executor widget id${executorIds.length === 1 ? "" : "s"}: ${executorIds.join(", ")}.`
      : null,
    firstBlocker ? `Blocker: ${firstBlocker}` : null,
    nextSuggestedCapability(actionResult.output),
  ].filter((part): part is string => Boolean(part));

  return parts.join(" ");
}

function queueRunSettingsMessage(actionResult: HobitAgentActionResult) {
  const item = recordOutputField(actionResult.output, "item");
  const taskId =
    stringField(actionResult.output, "taskId") ??
    (isRecord(item) ? stringField(item, "taskId") : null);
  const readiness = isRecord(item) ? stringField(item, "readinessState") : null;
  const firstBlocker = isRecord(item)
    ? stringArrayField(item, "blockerReasons")[0]
    : null;
  const parts = [
    `Queue run settings ${actionResult.dryRun ? "preview prepared" : "updated"}.`,
    taskId ? `Task id: ${taskId}.` : null,
    readiness ? `Readiness: ${readiness}.` : null,
    firstBlocker ? `Blocker: ${firstBlocker}` : null,
    nextSuggestedCapability(actionResult.output),
  ].filter((part): part is string => Boolean(part));

  return parts.join(" ");
}

function queuePromoteDraftMessage(actionResult: HobitAgentActionResult) {
  const item = recordOutputField(actionResult.output, "item");
  const taskId =
    stringField(actionResult.output, "taskId") ??
    (isRecord(item) ? stringField(item, "taskId") : null);
  const status = isRecord(item) ? stringField(item, "status") : null;
  const firstBlocker = isRecord(item)
    ? stringArrayField(item, "blockerReasons")[0]
    : null;
  const parts = [
    actionResult.dryRun
      ? "Queue draft promotion preview prepared."
      : "Queue draft promoted.",
    taskId ? `Task id: ${taskId}.` : null,
    status ? `Status: ${status}.` : null,
    firstBlocker ? `Blocker: ${firstBlocker}` : null,
    nextSuggestedCapability(actionResult.output),
  ].filter((part): part is string => Boolean(part));

  return parts.join(" ");
}

function queueEnableMessage(actionResult: HobitAgentActionResult) {
  const queueEnabled = booleanField(actionResult.output, "queueEnabled");
  const blockers = stringArrayField(actionResult.output, "blockerReasons");
  const parts = [
    actionResult.dryRun
      ? "Queue enable preview prepared."
      : queueEnabled
        ? "Queue enabled."
        : "Queue enable completed.",
    blockers[0] ? `Blocker: ${blockers[0]}` : null,
    nextSuggestedCapability(actionResult.output),
  ].filter((part): part is string => Boolean(part));

  return parts.join(" ");
}

function queueStartRunMessage(actionResult: HobitAgentActionResult) {
  const taskId =
    stringField(actionResult.output, "taskId") ??
    stringField(actionResult.output, "queueItemId");
  const runId = stringField(actionResult.output, "runId");
  const executorWidgetId = stringField(actionResult.output, "executorWidgetId");
  const firstBlocker = stringArrayField(
    actionResult.output,
    "blockerReasons",
  )[0];

  if (!actionResult.ok) {
    const parts = [
      "Queue-linked run blocked.",
      taskId ? `Task id: ${taskId}.` : null,
      executorWidgetId ? `Executor widget id: ${executorWidgetId}.` : null,
      firstBlocker ? `Blocker: ${firstBlocker}` : null,
      nextSuggestedCapability(actionResult.output),
    ].filter((part): part is string => Boolean(part));

    return parts.join(" ");
  }

  const parts = [
    "Queue-linked run started.",
    taskId ? `Task id: ${taskId}.` : null,
    runId ? `Run id: ${runId}.` : null,
    executorWidgetId ? `Executor widget id: ${executorWidgetId}.` : null,
  ].filter((part): part is string => Boolean(part));

  return parts.join(" ");
}

function queueLifecycleActivityTitle(capabilityId?: string) {
  switch (capabilityId) {
    case "queue.lifecycle.agentFinished":
      return "Queue lifecycle agent finished";
    case "queue.review.createMessage":
      return "Queue review message created";
    case "queue.review.ack":
      return "Queue review acknowledged";
    case "queue.coordinator.approveValidation":
      return "Queue validation approved";
    case "queue.coordinator.addFollowUpPrompt":
      return "Queue follow-up prompt added";
    case "queue.item.markDone":
      return "Queue item marked done";
    case "queue.item.block":
      return "Queue item blocked";
    case "queue.item.fail":
      return "Queue item failed";
    case "queue.lifecycle.get":
      return "Queue lifecycle read";
    case "queue.review.getEvidenceBundle":
      return "Queue review evidence bundle read";
    default:
      return null;
  }
}

function queueLifecycleSucceededMessage(capabilityId: string, dryRun: boolean) {
  const title = queueLifecycleActivityTitle(capabilityId);

  return title ? `${title}${dryRun ? " preview prepared" : ""}.` : null;
}

function withReason(prefix: string, actionResult: HobitAgentActionResult) {
  return withOptionalReason(
    prefix,
    actionResult.policyReasons[0] ??
      actionResult.unavailableReason ??
      actionResult.message,
  );
}

function withOptionalReason(prefix: string, reason: string | null) {
  const trimmedReason = reason?.trim() ?? "";
  if (!trimmedReason || trimmedReason === prefix.trim()) {
    return prefix;
  }

  return `${prefix} ${trimmedReason}`;
}

function numberOutputField(output: unknown, fieldName: string) {
  const value = recordOutputField(output, fieldName);
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function arrayOutputField(output: unknown, fieldName: string) {
  const value = recordOutputField(output, fieldName);
  return Array.isArray(value) ? value : null;
}

function recordOutputField(output: unknown, fieldName: string) {
  return isRecord(output) ? output[fieldName] : undefined;
}

function stringField(output: unknown, fieldName: string) {
  const value = recordOutputField(output, fieldName);
  return typeof value === "string" && value.trim() ? value : null;
}

function booleanField(output: unknown, fieldName: string) {
  const value = recordOutputField(output, fieldName);
  return typeof value === "boolean" ? value : null;
}

function stringArrayField(output: unknown, fieldName: string): string[] {
  const value = recordOutputField(output, fieldName);
  return Array.isArray(value)
    ? value.filter(
        (item): item is string =>
          typeof item === "string" && Boolean(item.trim()),
      )
    : [];
}

function nextSuggestedCapability(output: unknown) {
  const nextCapability = stringField(output, "nextSuggestedCapability");
  return nextCapability ? `Next: ${nextCapability}.` : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
