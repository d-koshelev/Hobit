import type {
  AgentQueueWorkflowCreateSetupStartStepResult,
  AgentQueueWorkflowJsonValue,
  AgentQueueWorkflowStartResult,
} from "../../../workspace/types";
import type {
  QueueWorkflowPersistencePort,
  QueueWorkflowRunnerRuntimeResult,
  QueueWorkflowRunnerRuntimeStatus,
} from "./queueWorkflowRuntimeAdapter/queueWorkflowRuntimeAdapterTypes";
import type {
  QueueWorkflowRunnerBlockerReason,
  QueueWorkflowRunnerRequest,
  QueueWorkflowRunnerResult,
} from "./queueWorkflowRunner";

export async function executeBackendOwnedCreateSetupStartStep({
  actorId,
  persistenceStatus,
  persistentStatus,
  request,
  validationReasons,
  validationStatus,
  workflowPersistence,
  workflowRunId,
  workspaceId,
  workflowStartStatus,
}: {
  actorId: string;
  persistenceStatus: string | null;
  persistentStatus: string | null;
  request: QueueWorkflowRunnerRequest;
  validationReasons: readonly string[];
  validationStatus?: string;
  workflowPersistence: QueueWorkflowPersistencePort;
  workflowRunId: string | null;
  workspaceId: string;
  workflowStartStatus: AgentQueueWorkflowStartResult["status"] | null;
}): Promise<QueueWorkflowRunnerRuntimeResult> {
  if (!workflowPersistence.executeAgentQueueWorkflowCreateSetupStartStep) {
    return {
      blockers: ["Backend-owned Queue workflow create/setup/start step is unavailable."],
      invoked: false,
      moduleId: request.moduleId,
      persistenceStatus,
      persistentStatus,
      phase: "create_setup_start",
      phasesExecuted: [],
      requestId: request.requestId,
      status: "unavailable",
      summary:
        "Queue workflow create/setup/start backend step is unavailable; no workflow mutations were run.",
      validationReasons,
      validationStatus,
      workflowId: request.workflowId,
      workflowRunId,
      workflowStartStatus,
    };
  }

  const stepResult =
    await workflowPersistence.executeAgentQueueWorkflowCreateSetupStartStep({
      actorId,
      confirmationToken: confirmationTokenFromGrant(request.grant),
      grantSummary: grantSummaryWithoutConfirmation(request.grant),
      inputs: (request.inputs ?? null) as AgentQueueWorkflowJsonValue | null,
      requestId: request.requestId,
      workflowId: request.workflowId,
      workflowRunId,
      workspaceId,
    });
  const runnerResult = projectCreateSetupStartStepResultToRunnerResult({
    request,
    result: stepResult,
  });
  const runtimeStatus = runtimeStatusFromStartStep(stepResult);
  const actionCount = Object.values(stepResult.actions).filter(Boolean).length;

  return {
    actionLedgerSummaryCount: actionCount,
    blockers: stepResult.blockers.map((blocker) => blocker.blockerMessage),
    createSetupStartStepResult: stepResult,
    invoked: true,
    moduleId: request.moduleId,
    persistedActionCount: actionCount,
    persistenceStatus: `create_setup_start_step_${stepResult.status}`,
    persistentStatus: stepResult.workflowRun?.status ?? persistentStatus,
    phase: "create_setup_start",
    phasesExecuted: ["create_setup_start"],
    requestId: request.requestId,
    runnerResult,
    status: runtimeStatus,
    summary: runnerResult.report.summary,
    validationReasons,
    validationStatus,
    workflowId: request.workflowId,
    workflowRunId: stepResult.workflowRunId ?? workflowRunId,
    workflowStartStatus,
  };
}

function projectCreateSetupStartStepResultToRunnerResult({
  request,
  result,
}: {
  request: QueueWorkflowRunnerRequest;
  result: AgentQueueWorkflowCreateSetupStartStepResult;
}): QueueWorkflowRunnerResult {
  const taskIdsBySlot = result.taskIdsBySlot;
  const runIdsBySlot = result.runIdsBySlot;
  const slots = slotVariables(result);
  const upstreamTaskId = taskIdsBySlot.upstream;
  const downstreamTaskId = taskIdsBySlot.downstream;
  const runId = runIdsBySlot.upstream;
  const blocker = result.blockers[0];
  const status = runnerStatusFromStartStep(result);
  const createSetupStartStatus = createSetupStartStatusFromStep(result);
  const didMutateQueue = Object.values(result.actions).some(
    (action) => action?.status === "completed",
  );
  const report = {
    createSetupStart: {
      downstreamTaskId,
      materializedSlots: materializedSlotsFromResult(result),
      phase: "create_setup_start" as const,
      promote: {
        slot: "upstream",
        status: result.actions.promoteTask?.status ?? result.status,
        taskId: upstreamTaskId,
      },
      queueControl: result.queueControl
        ? {
            status: result.queueControl.status,
            version: result.queueControl.version,
          }
        : undefined,
      runSettings: {
        executionTargetHash: result.executionTargetHash ?? undefined,
        executionTargetKind: result.executionTargetKind ?? undefined,
        providerId: result.providerId ?? undefined,
        settingsHash: result.settingsHash ?? undefined,
        slot: "upstream",
        status: result.actions.updateRunSettings?.status ?? result.status,
        taskId: upstreamTaskId,
      },
      start: {
        actionIdempotencyKey:
          result.actions.startWorker?.idempotencyKey ?? null,
        runId,
        status: startReportStatus(result),
        taskId: upstreamTaskId,
      },
      status: createSetupStartStatus,
      supportedWorkflow: true,
      upstreamTaskId,
      workflowRunId: result.workflowRunId ?? undefined,
    },
    evidenceReads: [],
    finalization: {
      confirmationTokenAccepted: false,
      downstreamVerification: {
        dependencyVerified: result.downstreamVerification?.dependencyEdgeExists ?? null,
        notAutoStartedVerified:
          result.downstreamVerification?.downstreamNotStarted ?? null,
        verificationMissing: !result.downstreamVerification,
      },
      idempotent: false,
      phase: "finalization" as const,
      status: null,
      supportedWorkflow: true,
    },
    missingExplicitIds: [],
    mutationSummary: {
      didAckReview: false,
      didBlock: false,
      didCreateReviewMessage: false,
      didFail: false,
      didFollowUp: false,
      didLaunchTerminal: false,
      didMarkDone: false,
      didMutateGit: false,
      didMutateQueue,
      didRollback: false,
      didStartWorker: Boolean(runId),
      didValidate: false,
    },
    nextMutatingPhase:
      result.status === "executed" || result.status === "already_applied"
        ? "worker_evidence"
        : null,
    readOnly: false,
    review: {
      idempotentAck: false,
      idempotentCreate: false,
      phase: "review" as const,
      status: null,
      supportedWorkflow: true,
    },
    summary: createSetupStartStepSummary(result),
    taskReads: [],
    workerEvidence: {
      idempotent: false,
      phase: "worker_evidence" as const,
      runId,
      status: null,
      supportedWorkflow: true,
      targetSlot: "upstream",
      taskId: upstreamTaskId,
    },
  };

  return {
    blockers: blocker
      ? [
          {
            fieldPath: blocker.missingRequiredField ?? undefined,
            message: blocker.blockerMessage,
            reasonCode: blockerReasonFromStartStep(result),
            slot: "upstream",
            taskId: upstreamTaskId,
          },
        ]
      : [],
    events: [
      {
        message: createSetupStartStepSummary(result),
        phase: "run_start",
        reasonCode: blocker ? blockerReasonFromStartStep(result) : undefined,
        slot: "upstream",
        status:
          result.status === "executed" || result.status === "already_applied"
            ? "paused"
            : result.status === "failed_unexpected"
              ? "failed_unexpected"
              : "blocked",
        taskId: upstreamTaskId,
      },
    ],
    report,
    requestId: request.requestId,
    status,
    steps: Object.values(result.actions)
      .filter((action): action is NonNullable<typeof action> => Boolean(action))
      .map((action) => ({
        message: `${action.actionType} ${action.status}`,
        phase: "run_start" as const,
        reasonCode: action.blockerCode
          ? blockerReasonFromStartStep(result)
          : undefined,
        runId,
        slot: action.actionType === "create_task" ? action.stepId : "upstream",
        status:
          action.status === "completed"
            ? "completed"
            : action.status === "failed"
              ? "failed_unexpected"
              : "blocked",
        stepId: action.actionId,
        taskId: upstreamTaskId,
      })),
    variables: {
      evidenceBundleIdsBySlot: {},
      messageIdsBySlot: {},
      readSnapshots: {
        aggregatesByTaskId: {},
        evidenceByKey: {},
        lifecycleByTaskId: {},
      },
      requestId: request.requestId,
      runIdsBySlot,
      scopedEvidenceBundleIds: [],
      scopedMessageIds: [],
      scopedRunIds: Object.values(runIdsBySlot),
      scopedTaskIds: Object.values(taskIdsBySlot),
      slots,
      taskIdsBySlot,
      workflowId: request.workflowId,
    },
    workflowId: request.workflowId,
  };
}

function runnerStatusFromStartStep(
  result: AgentQueueWorkflowCreateSetupStartStepResult,
): QueueWorkflowRunnerResult["status"] {
  if (result.status === "executed" || result.status === "already_applied") {
    return "awaiting_worker_completion";
  }
  if (result.status === "invalid_input") return "invalid_request";
  if (result.status === "failed_unexpected") return "failed_unexpected";
  return blockerReasonFromStartStep(result) === "blocked_queue_control"
    ? "blocked_queue_control"
    : "blocked_worker_start";
}

function runtimeStatusFromStartStep(
  result: AgentQueueWorkflowCreateSetupStartStepResult,
): QueueWorkflowRunnerRuntimeStatus {
  if (result.status === "executed" || result.status === "already_applied") {
    return "paused";
  }
  if (result.status === "invalid_input") return "invalid_request";
  if (result.status === "failed_unexpected") return "failed_unexpected";
  return "blocked";
}

function createSetupStartStatusFromStep(
  result: AgentQueueWorkflowCreateSetupStartStepResult,
): QueueWorkflowRunnerResult["report"]["createSetupStart"]["status"] {
  if (result.status === "executed" || result.status === "already_applied") {
    return "awaiting_worker_completion";
  }
  if (blockerReasonFromStartStep(result) === "blocked_queue_control") {
    return "blocked_queue_control";
  }
  if (blockerReasonFromStartStep(result) === "blocked_materialization") {
    return "blocked_materialization";
  }
  if (blockerReasonFromStartStep(result) === "blocked_setup") {
    return "blocked_setup";
  }
  return "blocked_worker_start";
}

function blockerReasonFromStartStep(
  result: AgentQueueWorkflowCreateSetupStartStepResult,
): QueueWorkflowRunnerBlockerReason {
  const code = result.blockers[0]?.blockerCode ?? result.conflict?.conflictCode;
  if (code === "blocked_control_disabled" || code === "version_conflict") {
    return "blocked_queue_control";
  }
  if (
    code === "tasks_missing" ||
    code === "task_slot_missing" ||
    code === "dependency_edge_missing"
  ) {
    return "blocked_materialization";
  }
  if (code?.includes("settings")) return "blocked_setup";
  if (result.status === "invalid_input") return "invalid_request";
  return "blocked_worker_start";
}

function startReportStatus(
  result: AgentQueueWorkflowCreateSetupStartStepResult,
): string {
  if (result.status === "already_applied") return "already_started";
  if (result.runIdsBySlot.upstream) return "started";
  return result.actions.startWorker?.status ?? result.status;
}

function createSetupStartStepSummary(
  result: AgentQueueWorkflowCreateSetupStartStepResult,
): string {
  if (result.status === "executed" || result.status === "already_applied") {
    return `Queue workflow ${result.workflowId} run ${result.workflowRunId ?? "unknown"} reached awaiting_worker_completion.`;
  }
  return (
    result.blockers[0]?.blockerMessage ??
    result.conflict?.conflictMessage ??
    `Queue workflow create/setup/start returned ${result.status}.`
  );
}

function materializedSlotsFromResult(
  result: AgentQueueWorkflowCreateSetupStartStepResult,
): QueueWorkflowRunnerResult["report"]["createSetupStart"]["materializedSlots"] {
  const snapshot = isRecord(result.slotBindingSnapshot)
    ? result.slotBindingSnapshot
    : {};
  return Object.fromEntries(
    ["upstream", "downstream"].map((slot) => {
      const binding = isRecord(snapshot[slot]) ? snapshot[slot] : {};
      return [
        slot,
        {
          dependencyTaskIds: stringArray(binding.dependencyTaskIds),
          dependsOnSlots: stringArray(binding.dependsOnSlots),
          status:
            slot === "upstream"
              ? result.actions.createTaskUpstream?.status ?? result.status
              : result.actions.createTaskDownstream?.status ?? result.status,
          taskId: stringValue(binding.taskId) ?? result.taskIdsBySlot[slot],
          taskSpecHash: stringValue(binding.taskSpecHash),
        },
      ];
    }),
  );
}

function slotVariables(
  result: AgentQueueWorkflowCreateSetupStartStepResult,
): QueueWorkflowRunnerResult["variables"]["slots"] {
  const snapshot = isRecord(result.slotBindingSnapshot)
    ? result.slotBindingSnapshot
    : {};
  return Object.fromEntries(
    Object.entries(result.taskIdsBySlot).map(([slot, taskId]) => {
      const binding = isRecord(snapshot[slot]) ? snapshot[slot] : {};
      return [
        slot,
        {
          executionTargetHash: stringValue(binding.executionTargetHash),
          executionTargetKind: stringValue(binding.executionTargetKind),
          providerId: stringValue(binding.providerId),
          runId: result.runIdsBySlot[slot],
          settingsHash: stringValue(binding.settingsHash),
          slot,
          taskId,
          taskSpecHash: stringValue(binding.taskSpecHash),
        },
      ];
    }),
  );
}

function confirmationTokenFromGrant(
  grant: QueueWorkflowRunnerRequest["grant"],
): string | null {
  const token = grant?.confirmationToken;
  return typeof token === "string" && token.trim() ? token.trim() : null;
}

function grantSummaryWithoutConfirmation(
  grant: QueueWorkflowRunnerRequest["grant"],
): AgentQueueWorkflowJsonValue | null {
  if (!grant) return null;
  const { confirmationToken: _confirmationToken, ...safeGrant } = grant;
  return safeGrant as AgentQueueWorkflowJsonValue;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function stringValue(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function stringArray(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const values = value.filter(
    (entry): entry is string => typeof entry === "string" && entry.trim().length > 0,
  );
  return values.length > 0 ? values : undefined;
}
