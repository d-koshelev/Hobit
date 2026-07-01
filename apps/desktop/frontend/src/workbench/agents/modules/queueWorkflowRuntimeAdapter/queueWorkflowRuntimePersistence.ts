import type {
  AgentQueueWorkflowResumePlan,
  AgentQueueWorkflowStartResult,
  StartAgentQueueWorkflowRequest,
} from "../../../../workspace/types";
import { isBackendOwnedQueueWorkflowPhase } from "../queueWorkflowBackendStepDispatcher";
import type { QueueWorkflowRunnerRequest } from "../queueWorkflowRunner";
import type {
  PreparedQueueWorkflowRuntime,
  QueueWorkflowPersistencePort,
  QueueWorkflowRunnerRuntimePhase,
  QueueWorkflowRunnerRuntimeResult,
  QueueWorkflowRunnerRuntimeStatus,
} from "./queueWorkflowRuntimeAdapterTypes";
import { notInvoked } from "./queueWorkflowRuntimeErrors";
import {
  assignString,
  hasTypedWorkerEvidenceInput,
  isAckedReviewStatus,
  isRecord,
  parseJsonRecord,
  recordRecord,
  sanitizeJsonValue,
  stringValue,
  stripUndefined,
  workflowPhaseForRuntimePhase,
  runtimePhaseFromWorkflowPhase,
} from "./queueWorkflowRuntimeGuards";

export async function prepareQueueWorkflowRuntimeExecution({
  actorId,
  phase,
  request,
  typedWorkflowRunId,
  validationReasons,
  validationStatus,
  workflowPersistence,
  workspaceId,
}: {
  actorId: string;
  phase: QueueWorkflowRunnerRuntimePhase;
  request: QueueWorkflowRunnerRequest;
  typedWorkflowRunId: string | null;
  validationReasons: readonly string[];
  validationStatus?: string;
  workflowPersistence?: QueueWorkflowPersistencePort | null;
  workspaceId?: string | null;
}): Promise<
  | { ok: true; value: PreparedQueueWorkflowRuntime }
  | { ok: false; result: QueueWorkflowRunnerRuntimeResult }
> {
  const normalizedWorkspaceId = workspaceId?.trim() ?? "";
  if (!workflowPersistence || !normalizedWorkspaceId) {
    return {
      ok: false,
      result: notInvoked({
        blockers: ["Queue workflow persistence is unavailable."],
        moduleId: request.moduleId,
        requestId: request.requestId,
        status: "unavailable",
        summary:
          "Queue workflow persistence is unavailable; Queue workflow runner was not invoked.",
        validationReasons,
        validationStatus,
        workflowId: request.workflowId,
      }),
    };
  }

  let runnerRequest = request;
  let selectedPhase = phase;
  let persistenceStatus: string | null = null;
  let persistentStatus: string | null = null;
  let resumePlan: AgentQueueWorkflowResumePlan | undefined;
  let workflowRunId: string | null = null;
  let workflowStartStatus: AgentQueueWorkflowStartResult["status"] | null = null;

  if (typedWorkflowRunId) {
    const planned = await workflowPersistence.planAgentQueueWorkflowResume({
      workflowRunId: typedWorkflowRunId,
      workspaceId: normalizedWorkspaceId,
    });
    if (!planned) {
      return {
        ok: false,
        result: notInvoked({
          blockers: ["Queue workflow run was not found for resume planning."],
          moduleId: request.moduleId,
          persistenceStatus: "resume_not_found",
          requestId: request.requestId,
          status: "blocked",
          summary:
            "Queue workflow run was not found; Queue workflow runner was not invoked.",
          validationReasons,
          validationStatus,
          workflowId: request.workflowId,
          workflowRunId: typedWorkflowRunId,
        }),
      };
    }

    resumePlan = planned;
    workflowRunId = planned.workflowRun.workflowRunId;
    persistentStatus = planned.workflowRun.status;
    const resumeDecision = resumeDecisionForPlan({
      fallbackPhase: selectedPhase,
      plan: planned,
      request,
    });
    if (!resumeDecision.ok) {
      return {
        ok: false,
        result: notInvoked({
          blockers: resumeDecision.blockers,
          moduleId: request.moduleId,
          persistenceStatus: "resume_planned",
          persistentStatus,
          phase: resumeDecision.phase ?? selectedPhase,
          requestId: request.requestId,
          resumePlan: planned,
          status: resumeDecision.status,
          summary: resumeDecision.summary,
          validationReasons,
          validationStatus,
          workflowId: request.workflowId,
          workflowRunId,
        }),
      };
    }

    selectedPhase = resumeDecision.phase;
    runnerRequest = runnerRequestFromResumePlan({
      phase: selectedPhase,
      plan: planned,
      request,
    });
    persistenceStatus = "resume_planned";
  } else {
    if (selectedPhase === "worker_evidence" || selectedPhase === "finalization") {
      const phaseLabel =
        selectedPhase === "worker_evidence"
          ? "Queue worker evidence recording"
          : "Queue workflow finalization";
      return {
        ok: false,
        result: notInvoked({
          blockers: [`${phaseLabel} requires metadata.workflowRunId.`],
          moduleId: request.moduleId,
          requestId: request.requestId,
          status: "blocked",
          summary: `${phaseLabel} requires a persisted workflowRunId; no workflow was started.`,
          validationReasons,
          validationStatus,
          workflowId: request.workflowId,
        }),
      };
    }

    if (
      selectedPhase === "create_setup_start" &&
      isBackendOwnedQueueWorkflowPhase(selectedPhase)
    ) {
      persistenceStatus = "backend_start_pending";
    } else {
      const startResult = await workflowPersistence.startAgentQueueWorkflow(
        startRequestForWorkflow({
          actorId,
          phase: selectedPhase,
          request,
          workspaceId: normalizedWorkspaceId,
        }),
      );
      workflowStartStatus = startResult.status;
      workflowRunId = startResult.workflowRun?.workflowRunId ?? null;
      persistentStatus = startResult.workflowRun?.status ?? null;

      if (startResult.status === "conflict") {
        return {
          ok: false,
          result: notInvoked({
            blockers: [
              startResult.conflict?.conflictMessage ??
                "Queue workflow requestId conflicts with a different persisted request hash.",
            ],
            moduleId: request.moduleId,
            persistenceStatus: "conflict",
            persistentStatus,
            requestHashConflict: startResult.conflict,
            requestId: request.requestId,
            status: "blocked",
            summary:
              "Queue workflow requestId/hash conflict; Queue workflow runner was not invoked.",
            validationReasons,
            validationStatus,
            workflowId: request.workflowId,
            workflowRunId,
            workflowStartStatus,
          }),
        };
      }

      if (!startResult.workflowRun || startResult.status === "invalid_input") {
        return {
          ok: false,
          result: notInvoked({
            blockers: [
              startResult.blocker?.blockerMessage ??
                "Queue workflow start failed before runner invocation.",
            ],
            moduleId: request.moduleId,
            persistenceStatus: startResult.status,
            requestId: request.requestId,
            status: "blocked",
            summary:
              "Queue workflow start failed; Queue workflow runner was not invoked.",
            validationReasons,
            validationStatus,
            workflowId: request.workflowId,
            workflowRunId,
            workflowStartStatus,
          }),
        };
      }

      persistenceStatus =
        startResult.status === "already_exists" ? "reused" : "started";
    }
  }

  return {
    ok: true,
    value: {
      persistenceStatus,
      persistentStatus,
      resumePlan,
      runnerRequest,
      selectedPhase,
      workflowPersistence,
      workflowRunId,
      workflowStartStatus,
      workspaceId: normalizedWorkspaceId,
    },
  };
}

function startRequestForWorkflow({
  actorId,
  phase,
  request,
  workspaceId,
}: {
  actorId: string;
  phase: QueueWorkflowRunnerRuntimePhase;
  request: QueueWorkflowRunnerRequest;
  workspaceId: string;
}): StartAgentQueueWorkflowRequest {
  const slotBindings = slotBindingsFromInputs(request.inputs);
  return {
    actionLogSummary: {
      phase,
      runnerStatus: "requested",
      summary: "Queue workflow runner requested.",
    },
    actorId,
    currentStep: `${phase}_requested`,
    grantSummary: sanitizeJsonValue(request.grant),
    idempotencyKeys: {},
    inputsSnapshot: sanitizeJsonValue(request.inputs),
    mutationRefs: {},
    phase: workflowPhaseForRuntimePhase(phase),
    requestId: request.requestId,
    slotBindings,
    variables: {
      phase,
      requestId: request.requestId,
      workflowId: request.workflowId,
    },
    workflowId: request.workflowId,
    workspaceId,
  };
}

function runnerRequestFromResumePlan({
  phase,
  plan,
  request,
}: {
  phase: QueueWorkflowRunnerRuntimePhase;
  plan: AgentQueueWorkflowResumePlan;
  request: QueueWorkflowRunnerRequest;
}): QueueWorkflowRunnerRequest {
  const persistedInputs = parseJsonRecord(plan.workflowRun.inputsSnapshotJson);
  const persistedBindings = parseJsonRecord(plan.workflowRun.slotBindingsJson);
  const bindingInputs = inputsFromResumeBindings({
    persistedBindings,
    plan,
  });

  return {
    ...(request.grant ? { grant: request.grant } : {}),
    inputs: stripUndefined({
      ...persistedInputs,
      ...bindingInputs,
      ...(request.inputs ?? {}),
      phase,
    }),
    moduleId: request.moduleId,
    requestId: request.requestId,
    workflowId: request.workflowId,
  };
}

function inputsFromResumeBindings({
  persistedBindings,
  plan,
}: {
  persistedBindings: Record<string, unknown>;
  plan: AgentQueueWorkflowResumePlan;
}) {
  const taskIdsBySlot: Record<string, string> = {};
  const runIdsBySlot: Record<string, string> = {};
  const evidenceBundleIdsBySlot: Record<string, string> = {};
  const messageIdsBySlot: Record<string, string> = {};
  const reviewAcknowledgedBySlot: Record<string, boolean> = {};

  for (const [slot, rawBinding] of Object.entries(persistedBindings)) {
    if (!isRecord(rawBinding)) continue;
    assignString(taskIdsBySlot, slot, rawBinding.taskId);
    assignString(runIdsBySlot, slot, rawBinding.runId);
    assignString(evidenceBundleIdsBySlot, slot, rawBinding.evidenceBundleId);
    assignString(messageIdsBySlot, slot, rawBinding.messageId);
  }

  for (const reconciliation of plan.slotReconciliations) {
    assignString(taskIdsBySlot, reconciliation.slot, reconciliation.taskId);
    assignString(runIdsBySlot, reconciliation.slot, reconciliation.runId);
    assignString(
      evidenceBundleIdsBySlot,
      reconciliation.slot,
      reconciliation.evidenceBundleId,
    );
    assignString(messageIdsBySlot, reconciliation.slot, reconciliation.messageId);
    if (isAckedReviewStatus(reconciliation.reviewMessageStatus)) {
      reviewAcknowledgedBySlot[reconciliation.slot] = true;
    }
  }

  return stripUndefined({
    evidenceBundleIdsBySlot,
    messageIdsBySlot,
    reviewAcknowledgedBySlot,
    runIdsBySlot,
    taskIdsBySlot,
  });
}

function resumeDecisionForPlan({
  fallbackPhase,
  plan,
  request,
}: {
  fallbackPhase: QueueWorkflowRunnerRuntimePhase;
  plan: AgentQueueWorkflowResumePlan;
  request: QueueWorkflowRunnerRequest;
}):
  | { ok: true; phase: QueueWorkflowRunnerRuntimePhase }
  | {
      blockers: readonly string[];
      ok: false;
      phase?: QueueWorkflowRunnerRuntimePhase;
      status: QueueWorkflowRunnerRuntimeStatus;
      summary: string;
    } {
  const plannedPhase =
    runtimePhaseFromWorkflowPhase(plan.nextPhase) ?? fallbackPhase;
  if (
    plan.status === "terminal_completed" ||
    plan.status === "terminal_failed" ||
    plan.status === "terminal_cancelled"
  ) {
    return {
      blockers: plan.blockers.map((blocker) => blocker.blockerMessage),
      ok: false,
      phase: plannedPhase,
      status: plan.status === "terminal_completed" ? "completed" : "blocked",
      summary: plan.reportSummary,
    };
  }

  if (plan.requiredFreshGrant && !request.grant) {
    return {
      blockers: ["Fresh structured Queue workflow grant is required."],
      ok: false,
      phase: plannedPhase,
      status: "blocked",
      summary:
        "Queue workflow resume requires a fresh structured grant; Queue workflow runner was not invoked.",
    };
  }

  if (
    plan.nextStep === "awaiting_worker_completion" ||
    plan.nextStep === "worker_running_waiting_for_evidence"
  ) {
    return {
      blockers: [],
      ok: false,
      phase: "worker_evidence",
      status: "paused",
      summary:
        "Queue workflow worker is still running; worker evidence was not recorded.",
    };
  }

  if (plan.status === "resume_read_only_ready") {
    return {
      ok: true,
      phase: plannedPhase === "create_setup_start" ? plannedPhase : "read",
    };
  }

  if (
    isWorkerEvidenceResumeStep(plan) &&
    workerEvidenceResumeAllowedByPlan(plan)
  ) {
    if (!hasTypedWorkerEvidenceInput(request)) {
      return {
        blockers: ["Typed inputs.workerEvidence is required to record worker evidence."],
        ok: false,
        phase: "worker_evidence",
        status: "paused",
        summary:
          "Queue workflow worker completion/evidence input is missing; evidence was not recorded.",
      };
    }
    return { ok: true, phase: "worker_evidence" };
  }

  if (isWorkerEvidenceResumeStep(plan)) {
    return {
      blockers: plan.blockers.map((blocker) => blocker.blockerMessage),
      ok: false,
      phase: "worker_evidence",
      status: plan.status === "failed_unexpected" ? "failed_unexpected" : "blocked",
      summary: plan.reportSummary,
    };
  }

  if (isReviewResumeStep(plan)) {
    if (!reviewResumeAllowedByPlan(plan)) {
      return {
        blockers: plan.blockers.map((blocker) => blocker.blockerMessage),
        ok: false,
        phase: "review",
        status: plan.status === "failed_unexpected" ? "failed_unexpected" : "blocked",
        summary: plan.reportSummary,
      };
    }
    return { ok: true, phase: "review" };
  }

  if (plan.requiredConfirmation || plan.status === "blocked_missing_confirmation") {
    if (plannedPhase === "finalization") {
      return { ok: true, phase: plannedPhase };
    }
    if (
      !(
        plannedPhase === "create_setup_start" &&
        plan.nextStep === "start_worker_ready"
      )
    ) {
      return {
        blockers: [
          "Fresh confirmation may only resume supported finalization or worker-start phases.",
        ],
        ok: false,
        phase: plannedPhase,
        status: "blocked",
        summary:
          "Queue workflow resume requested confirmation for an unsupported phase; Queue workflow runner was not invoked.",
      };
    }
    if (request.grant?.confirmationToken !== "operator-confirmed") {
      return {
        blockers: ["Fresh exact structured confirmationToken is required."],
        ok: false,
        phase: plannedPhase,
        status: "paused",
        summary:
          "Queue workflow resume requires fresh exact structured confirmation; Queue workflow runner was not invoked.",
      };
    }
    return { ok: true, phase: plannedPhase };
  }

  if (
    plan.status === "blocked_missing_task" ||
    plan.status === "blocked_state_mismatch" ||
    plan.status === "blocked_missing_review_ack" ||
    plan.status === "blocked_missing_evidence" ||
    plan.status === "blocked_stale_grant" ||
    plan.status === "blocked_settings_mismatch" ||
    plan.status === "blocked_promote_state_mismatch" ||
    plan.status === "blocked_executor_mismatch" ||
    plan.status === "blocked_incomplete_slot_binding" ||
    plan.status === "blocked_incomplete_workflow_action_refs" ||
    plan.status === "blocked_dependency_edge_missing" ||
    plan.status === "unsupported_phase" ||
    plan.status === "failed_unexpected" ||
    plan.status === "version_conflict"
  ) {
    return {
      blockers: plan.blockers.map((blocker) => blocker.blockerMessage),
      ok: false,
      phase: plannedPhase,
      status: plan.status === "failed_unexpected" ? "failed_unexpected" : "blocked",
      summary: plan.reportSummary,
    };
  }

  if (
    plan.status === "resume_ready" ||
    plan.status === "waiting_for_run_settings" ||
    plan.status === "waiting_for_promote"
  ) {
    return {
      ok: true,
      phase: plannedPhase,
    };
  }

  return {
    blockers: plan.blockers.map((blocker) => blocker.blockerMessage),
    ok: false,
    phase: plannedPhase,
    status: "blocked",
    summary: plan.reportSummary,
  };
}

function isWorkerEvidenceResumeStep(plan: AgentQueueWorkflowResumePlan): boolean {
  return (
    plan.nextPhase === "worker_evidence" ||
    plan.nextStep === "waiting_for_worker_evidence" ||
    plan.nextStep === "worker_evidence_required"
  );
}

function workerEvidenceResumeAllowedByPlan(
  plan: AgentQueueWorkflowResumePlan,
): boolean {
  return (
    plan.status === "retryable_worker_evidence_failure" ||
    plan.status === "retryable_worker_evidence_action_repair" ||
    plan.status === "waiting_for_worker_evidence"
  );
}

function isReviewResumeStep(plan: AgentQueueWorkflowResumePlan): boolean {
  return (
    plan.nextPhase === "review" &&
    (plan.nextStep === "review_create_ready" ||
      plan.nextStep === "review_ack_ready" ||
      plan.nextStep === "awaiting_review")
  );
}

function reviewResumeAllowedByPlan(plan: AgentQueueWorkflowResumePlan): boolean {
  return (
    plan.status === "resume_ready" ||
    plan.status === "retryable_review_failure_before_mutation" ||
    (plan.status === "blocked_missing_review_ack" &&
      plan.nextStep === "review_ack_ready")
  );
}

function slotBindingsFromInputs(
  inputs: QueueWorkflowRunnerRequest["inputs"],
) {
  const taskIdsBySlot = recordRecord(inputs, "taskIdsBySlot");
  const runIdsBySlot = recordRecord(inputs, "runIdsBySlot");
  const evidenceBundleIdsBySlot = recordRecord(inputs, "evidenceBundleIdsBySlot");
  const messageIdsBySlot = recordRecord(inputs, "messageIdsBySlot");
  const slots = new Set([
    ...Object.keys(taskIdsBySlot),
    ...Object.keys(runIdsBySlot),
    ...Object.keys(evidenceBundleIdsBySlot),
    ...Object.keys(messageIdsBySlot),
  ]);
  const bindings: Record<string, unknown> = {};
  for (const slot of slots) {
    bindings[slot] = stripUndefined({
      evidenceBundleId: stringValue(evidenceBundleIdsBySlot[slot]),
      messageId: stringValue(messageIdsBySlot[slot]),
      runId: stringValue(runIdsBySlot[slot]),
      taskId: stringValue(taskIdsBySlot[slot]),
    });
  }
  return sanitizeJsonValue(bindings);
}
