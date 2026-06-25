import type { StartAssignedAgentQueueTaskRequest } from "../../../../workspace/types";
import {
  MUTATION_SUMMARY,
} from "./queueWorkflowRunnerConstants";
import { pushStep } from "./queueWorkflowRunnerEvents";
import {
  blockerForApplyRunSettingsResult,
  blockerForCreateSetupStartError,
  blockerForMaterializeResult,
  blockerForPromoteResult,
  blockerForStartResult,
  createSetupStartReportForInput,
  createSetupStartSummary,
  materializeVerb,
  promoteVerb,
  resolveCreateSetupStartConfirmation,
  resolveCreateSetupStartInput,
  setMaterializedSlotVariables,
  setRunSettingsSlotVariables,
  setStartedSlotVariables,
  setupVerb,
  updateCreateSetupStartReportMaterialize,
  updateCreateSetupStartReportPromote,
  updateCreateSetupStartReportRunSettings,
  updateCreateSetupStartReportStart,
  validateCreateSetupStartRunnerBoundary,
  workflowStartIdempotencyKey,
} from "./queueWorkflowCreateSetupStartHelpers";
import { buildVariables } from "./queueWorkflowRunnerRefs";
import { result } from "./queueWorkflowRunnerReports";
import type {
  QueueWorkflowCreateSetupStartRunnerInput,
  QueueWorkflowCreateSetupStartStatus,
  QueueWorkflowRunnerBlocker,
  QueueWorkflowRunnerEvent,
  QueueWorkflowRunnerResult,
  QueueWorkflowRunnerStep,
} from "./queueWorkflowRunnerTypes";

export async function runQueueWorkflowCreateSetupStartRunner(
  input: QueueWorkflowCreateSetupStartRunnerInput,
): Promise<QueueWorkflowRunnerResult> {
  const steps: QueueWorkflowRunnerStep[] = [];
  const events: QueueWorkflowRunnerEvent[] = [];
  const blockers: QueueWorkflowRunnerBlocker[] = [];
  const variables = buildVariables(input.request);
  const mutationSummary = { ...MUTATION_SUMMARY };
  let createSetupStartReport = createSetupStartReportForInput(input);

  const validationBlocker = validateCreateSetupStartRunnerBoundary(input);
  if (validationBlocker) {
    blockers.push(validationBlocker);
    pushStep(steps, events, {
      message: validationBlocker.message,
      phase: "validate",
      reasonCode: validationBlocker.reasonCode,
      status: "blocked",
      stepId: "validate_create_setup_start_request",
    });
    return result({
      blockers,
      createSetupStartReport,
      events,
      mutationSummary,
      readOnly: false,
      reportSummary: validationBlocker.message,
      status:
        validationBlocker.reasonCode === "missing_workflow_run_id"
          ? "blocked_materialization"
          : "invalid_request",
      steps,
      variables,
    });
  }

  if (!input.createSetupStartPort) {
    const blocker: QueueWorkflowRunnerBlocker = {
      message: "Queue workflow create/setup/start port is unavailable.",
      reasonCode: "materialization_port_unavailable",
    };
    blockers.push(blocker);
    pushStep(steps, events, {
      message: blocker.message,
      phase: "setup",
      reasonCode: blocker.reasonCode,
      status: "unavailable",
      stepId: "open_create_setup_start_port",
    });
    return result({
      blockers,
      createSetupStartReport,
      events,
      mutationSummary,
      readOnly: false,
      reportSummary: blocker.message,
      status: "unavailable",
      steps,
      variables,
    });
  }

  const requestInput = resolveCreateSetupStartInput(input.request);
  if (!requestInput.ok) {
    blockers.push(requestInput.blocker);
    pushStep(steps, events, {
      message: requestInput.blocker.message,
      phase: "setup",
      reasonCode: requestInput.blocker.reasonCode,
      status: "blocked",
      stepId: "resolve_create_setup_start_inputs",
    });
    return result({
      blockers,
      createSetupStartReport,
      events,
      mutationSummary,
      readOnly: false,
      reportSummary: requestInput.blocker.message,
      status:
        requestInput.blocker.reasonCode === "missing_run_settings"
          ? "blocked_setup"
          : "blocked_materialization",
      steps,
      variables,
    });
  }

  try {
    const upstreamMaterialize =
      await input.createSetupStartPort.materializeTaskSlot({
        dependsOnSlots: requestInput.value.upstream.dependsOnSlots,
        slot: "upstream",
        taskSpec: requestInput.value.upstream.taskSpec,
        taskSpecHash: requestInput.value.upstream.taskSpecHash,
        workflowRunId: input.workflowRunId,
      });
    createSetupStartReport = updateCreateSetupStartReportMaterialize(
      createSetupStartReport,
      upstreamMaterialize,
      "upstream",
    );
    const upstreamMaterializeBlocker = blockerForMaterializeResult(
      upstreamMaterialize,
      "upstream",
    );
    if (upstreamMaterializeBlocker) {
      blockers.push(upstreamMaterializeBlocker);
      pushStep(steps, events, {
        message: upstreamMaterializeBlocker.message,
        phase: "setup",
        reasonCode: upstreamMaterializeBlocker.reasonCode,
        slot: "upstream",
        status: "blocked",
        stepId: "materialize_task_slot:upstream",
      });
      return result({
        blockers,
        createSetupStartReport: {
          ...createSetupStartReport,
          status: "blocked_materialization",
        },
        events,
        mutationSummary,
        readOnly: false,
        reportSummary: upstreamMaterializeBlocker.message,
        status: "blocked_materialization",
        steps,
        variables,
      });
    }
    const upstreamBinding = upstreamMaterialize.binding!;
    setMaterializedSlotVariables(variables, upstreamBinding);
    mutationSummary.didMutateQueue =
      mutationSummary.didMutateQueue || upstreamMaterialize.status === "created";
    pushStep(steps, events, {
      message: `Queue workflow upstream task ${upstreamBinding.taskId} ${materializeVerb(upstreamMaterialize.status)}.`,
      phase: "setup",
      slot: "upstream",
      status: "completed",
      stepId: "materialize_task_slot:upstream",
      taskId: upstreamBinding.taskId,
    });

    const downstreamMaterialize =
      await input.createSetupStartPort.materializeTaskSlot({
        dependsOnSlots: requestInput.value.downstream.dependsOnSlots,
        slot: "downstream",
        taskSpec: requestInput.value.downstream.taskSpec,
        taskSpecHash: requestInput.value.downstream.taskSpecHash,
        workflowRunId: input.workflowRunId,
      });
    createSetupStartReport = updateCreateSetupStartReportMaterialize(
      createSetupStartReport,
      downstreamMaterialize,
      "downstream",
    );
    const downstreamMaterializeBlocker = blockerForMaterializeResult(
      downstreamMaterialize,
      "downstream",
    );
    if (downstreamMaterializeBlocker) {
      blockers.push(downstreamMaterializeBlocker);
      pushStep(steps, events, {
        message: downstreamMaterializeBlocker.message,
        phase: "setup",
        reasonCode: downstreamMaterializeBlocker.reasonCode,
        slot: "downstream",
        status: "blocked",
        stepId: "materialize_task_slot:downstream",
      });
      return result({
        blockers,
        createSetupStartReport: {
          ...createSetupStartReport,
          status: "blocked_materialization",
        },
        events,
        mutationSummary,
        readOnly: false,
        reportSummary: downstreamMaterializeBlocker.message,
        status: "blocked_materialization",
        steps,
        variables,
      });
    }
    const downstreamBinding = downstreamMaterialize.binding!;
    setMaterializedSlotVariables(variables, downstreamBinding);
    mutationSummary.didMutateQueue =
      mutationSummary.didMutateQueue ||
      downstreamMaterialize.status === "created";
    pushStep(steps, events, {
      message: `Queue workflow downstream task ${downstreamBinding.taskId} ${materializeVerb(downstreamMaterialize.status)} with explicit upstream dependency.`,
      phase: "setup",
      slot: "downstream",
      status: "completed",
      stepId: "materialize_task_slot:downstream",
      taskId: downstreamBinding.taskId,
    });

    const applySettings = await input.createSetupStartPort.applyRunSettings({
      runSettings: requestInput.value.runSettings,
      slot: "upstream",
      taskId: upstreamBinding.taskId,
      workflowRunId: input.workflowRunId,
    });
    createSetupStartReport = updateCreateSetupStartReportRunSettings(
      createSetupStartReport,
      applySettings,
    );
    const applySettingsBlocker = blockerForApplyRunSettingsResult(applySettings);
    if (applySettingsBlocker) {
      blockers.push(applySettingsBlocker);
      pushStep(steps, events, {
        message: applySettingsBlocker.message,
        phase: "setup",
        reasonCode: applySettingsBlocker.reasonCode,
        slot: "upstream",
        status: "blocked",
        stepId: "apply_run_settings:upstream",
        taskId: upstreamBinding.taskId,
      });
      return result({
        blockers,
        createSetupStartReport: {
          ...createSetupStartReport,
          status: "blocked_setup",
        },
        events,
        mutationSummary,
        readOnly: false,
        reportSummary: applySettingsBlocker.message,
        status: "blocked_setup",
        steps,
        variables,
      });
    }
    const settingsBinding = applySettings.binding!;
    setRunSettingsSlotVariables(variables, settingsBinding);
    mutationSummary.didMutateQueue =
      mutationSummary.didMutateQueue || applySettings.status === "applied";
    pushStep(steps, events, {
      message: `Queue workflow upstream run settings ${setupVerb(applySettings.status)}.`,
      phase: "setup",
      slot: "upstream",
      status: "completed",
      stepId: "apply_run_settings:upstream",
      taskId: settingsBinding.taskId,
    });

    const promote = await input.createSetupStartPort.promoteTaskSlot({
      settingsHash: settingsBinding.settingsHash,
      slot: "upstream",
      taskId: upstreamBinding.taskId,
      taskSpecHash: upstreamBinding.taskSpecHash,
      workflowRunId: input.workflowRunId,
    });
    createSetupStartReport = updateCreateSetupStartReportPromote(
      createSetupStartReport,
      promote,
    );
    const promoteBlocker = blockerForPromoteResult(promote);
    if (promoteBlocker) {
      blockers.push(promoteBlocker);
      pushStep(steps, events, {
        message: promoteBlocker.message,
        phase: "setup",
        reasonCode: promoteBlocker.reasonCode,
        slot: "upstream",
        status: "blocked",
        stepId: "promote_task_slot:upstream",
        taskId: upstreamBinding.taskId,
      });
      return result({
        blockers,
        createSetupStartReport: {
          ...createSetupStartReport,
          status: "blocked_setup",
        },
        events,
        mutationSummary,
        readOnly: false,
        reportSummary: promoteBlocker.message,
        status: "blocked_setup",
        steps,
        variables,
      });
    }
    mutationSummary.didMutateQueue =
      mutationSummary.didMutateQueue || promote.status === "promoted";
    pushStep(steps, events, {
      message: `Queue workflow upstream task ${promoteVerb(promote.status)}.`,
      phase: "setup",
      slot: "upstream",
      status: "completed",
      stepId: "promote_task_slot:upstream",
      taskId: promote.binding?.taskId ?? upstreamBinding.taskId,
    });

    const queueControl = await input.createSetupStartPort.getQueueControlState();
    createSetupStartReport = {
      ...createSetupStartReport,
      queueControl: {
        status: queueControl?.status ?? null,
        version: queueControl?.version ?? null,
      },
    };
    if (queueControl?.status !== "manual_enabled") {
      const blocker: QueueWorkflowRunnerBlocker = {
        message:
          "Queue workflow worker start requires backend QueueControlState manual_enabled.",
        reasonCode: "blocked_queue_control",
        taskId: upstreamBinding.taskId,
      };
      blockers.push(blocker);
      pushStep(steps, events, {
        message: blocker.message,
        phase: "run_start",
        reasonCode: blocker.reasonCode,
        slot: "upstream",
        status: "blocked",
        stepId: "verify_queue_control",
        taskId: upstreamBinding.taskId,
      });
      return result({
        blockers,
        createSetupStartReport: {
          ...createSetupStartReport,
          status: "blocked_queue_control",
        },
        events,
        mutationSummary,
        readOnly: false,
        reportSummary: blocker.message,
        status: "blocked_queue_control",
        steps,
        variables,
      });
    }
    pushStep(steps, events, {
      message: `Queue control verified manual_enabled${typeof queueControl.version === "number" ? ` v${queueControl.version}` : ""}.`,
      phase: "run_start",
      slot: "upstream",
      status: "completed",
      stepId: "verify_queue_control",
      taskId: upstreamBinding.taskId,
    });

    const confirmation = resolveCreateSetupStartConfirmation(input.request);
    if (!confirmation.ok) {
      blockers.push(confirmation.blocker);
      pushStep(steps, events, {
        message: confirmation.blocker.message,
        phase: "run_start",
        reasonCode: confirmation.blocker.reasonCode,
        slot: "upstream",
        status: "blocked",
        stepId: "confirm_worker_start",
        taskId: upstreamBinding.taskId,
      });
      return result({
        blockers,
        createSetupStartReport: {
          ...createSetupStartReport,
          status: "blocked_worker_start",
        },
        events,
        mutationSummary,
        readOnly: false,
        reportSummary: confirmation.blocker.message,
        status: "blocked_worker_start",
        steps,
        variables,
      });
    }

    const startActionIdempotencyKey = workflowStartIdempotencyKey({
      executionTargetHash: settingsBinding.executionTargetHash,
      settingsHash: settingsBinding.settingsHash,
      taskId: upstreamBinding.taskId,
      workflowRunId: input.workflowRunId,
    });
    const queueOwnerWidgetInstanceId =
      settingsBinding.executionTargetKind === "queue_local"
        ? (settingsBinding.queueOwnerWidgetInstanceId ?? undefined)
        : undefined;
    const start = await input.createSetupStartPort.startWorkerForSlot({
      approvalPolicy: requestInput.value.runSettings.approvalPolicy as StartAssignedAgentQueueTaskRequest["approvalPolicy"],
      codexExecutable: requestInput.value.runSettings.codexExecutable,
      queueItemId: upstreamBinding.taskId,
      queueOwnerWidgetInstanceId,
      repoRoot: requestInput.value.runSettings.executionWorkspace,
      sandbox: requestInput.value.runSettings.sandbox as StartAssignedAgentQueueTaskRequest["sandbox"],
      stderrCapBytes: requestInput.value.stderrCapBytes,
      stdoutCapBytes: requestInput.value.stdoutCapBytes,
      timeoutMs: requestInput.value.timeoutMs,
      workflowStartContext: {
        actionIdempotencyKey: startActionIdempotencyKey,
        confirmationToken: confirmation.token,
        expectedQueueControlVersion:
          requestInput.value.expectedQueueControlVersion ??
          queueControl.version ??
          null,
        executorWidgetId: settingsBinding.executorWidgetId ?? undefined,
        executionTargetHash: settingsBinding.executionTargetHash,
        settingsHash: settingsBinding.settingsHash,
        slot: "upstream",
        taskId: upstreamBinding.taskId,
        workflowRunId: input.workflowRunId,
      },
    });
    const startBlocker = blockerForStartResult(start);
    createSetupStartReport = updateCreateSetupStartReportStart(
      createSetupStartReport,
      start,
      upstreamBinding.taskId,
    );
    if (startBlocker) {
      blockers.push(startBlocker);
      pushStep(steps, events, {
        message: startBlocker.message,
        phase: "run_start",
        reasonCode: startBlocker.reasonCode,
        runId: start.runId,
        slot: "upstream",
        status: "blocked",
        stepId: "start_worker:upstream",
        taskId: upstreamBinding.taskId,
      });
      return result({
        blockers,
        createSetupStartReport: {
          ...createSetupStartReport,
          status: "blocked_worker_start",
        },
        events,
        mutationSummary,
        readOnly: false,
        reportSummary: startBlocker.message,
        status: "blocked_worker_start",
        steps,
        variables,
      });
    }

    setStartedSlotVariables(variables, "upstream", start);
    mutationSummary.didStartWorker = start.status === "started";
    mutationSummary.didMutateQueue =
      mutationSummary.didMutateQueue || start.status === "started";
    const finalCreateSetupStatus: QueueWorkflowCreateSetupStartStatus =
      start.currentRunState === "running" || start.status === "already_started"
        ? "worker_running"
        : "awaiting_worker_completion";
    createSetupStartReport = {
      ...createSetupStartReport,
      status: finalCreateSetupStatus,
    };
    pushStep(steps, events, {
      message: `Queue workflow upstream worker ${start.status}; runId ${start.runId}.`,
      phase: "run_start",
      runId: start.runId,
      slot: "upstream",
      status: "paused",
      stepId: "start_worker:upstream",
      taskId: upstreamBinding.taskId,
    });

    return result({
      blockers,
      createSetupStartReport,
      events,
      mutationSummary,
      readOnly: false,
      reportSummary: createSetupStartSummary({
        report: createSetupStartReport,
        workflowId: input.request.workflowId,
      }),
      status: "awaiting_worker_completion",
      steps,
      variables,
    });
  } catch (error) {
    const blocker = blockerForCreateSetupStartError(error);
    blockers.push(blocker);
    pushStep(steps, events, {
      message: blocker.message,
      phase: "run_start",
      reasonCode: blocker.reasonCode,
      status: "blocked",
      stepId: "create_setup_start_error",
    });
    return result({
      blockers,
      createSetupStartReport: {
        ...createSetupStartReport,
        status: "blocked_worker_start",
      },
      events,
      mutationSummary,
      readOnly: false,
      reportSummary: blocker.message,
      status: "blocked_worker_start",
      steps,
      variables,
    });
  }
}
