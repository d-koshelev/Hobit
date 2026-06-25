import { DEPENDENCY_WORKFLOWS, MUTATION_SUMMARY } from "./queueWorkflowRunnerConstants";
import { pushStep } from "./queueWorkflowRunnerEvents";
import { verifyDownstreamAfterFinalization } from "./queueWorkflowDownstreamVerification";
import {
  blockerForFinalizationResult,
  finalizationStatusForCommandResult,
  finalizationSuccessMessage,
  resolveFinalizationConfirmation,
  resolveFinalizationTarget,
  reviewAcknowledgedForFinalization,
  snapshotForTask,
  validateFinalizationRunnerBoundary,
} from "./queueWorkflowFinalizationHelpers";
import { buildVariables, stripUndefined } from "./queueWorkflowRunnerRefs";
import {
  missingAggregateBlockersForReads,
  readTaskSnapshots,
} from "./queueWorkflowRunnerReadSnapshots";
import { finalizationReport, result } from "./queueWorkflowRunnerReports";
import type {
  QueueWorkflowFinalizationRunnerInput,
  QueueWorkflowRunnerBlocker,
  QueueWorkflowRunnerEvent,
  QueueWorkflowRunnerResult,
  QueueWorkflowRunnerStep,
} from "./queueWorkflowRunnerTypes";

export async function runQueueWorkflowFinalizationRunner(
  input: QueueWorkflowFinalizationRunnerInput,
): Promise<QueueWorkflowRunnerResult> {
  const steps: QueueWorkflowRunnerStep[] = [];
  const events: QueueWorkflowRunnerEvent[] = [];
  const blockers: QueueWorkflowRunnerBlocker[] = [];
  const variables = buildVariables(input.request);
  const mutationSummary = { ...MUTATION_SUMMARY };

  const validationBlocker = validateFinalizationRunnerBoundary(input);
  if (validationBlocker) {
    blockers.push(validationBlocker);
    pushStep(steps, events, {
      message: validationBlocker.message,
      phase: "validate",
      reasonCode: validationBlocker.reasonCode,
      status: "blocked",
      stepId: "validate_finalization_request",
    });
    return result({
      blockers,
      events,
      finalizationReport: finalizationReport({
        status: "finalization_invalid_input",
      }),
      mutationSummary,
      readOnly: false,
      reportSummary: validationBlocker.message,
      status: "finalization_invalid_input",
      steps,
      variables,
    });
  }

  if (!DEPENDENCY_WORKFLOWS.has(input.request.workflowId)) {
    const blocker: QueueWorkflowRunnerBlocker = {
      fieldPath: "$.workflowId",
      message: `${input.request.workflowId} is not supported by the Queue finalization workflow runner.`,
      reasonCode: "finalization_not_supported_for_workflow",
    };
    blockers.push(blocker);
    pushStep(steps, events, {
      message: blocker.message,
      phase: "finalization",
      reasonCode: blocker.reasonCode,
      status: "blocked",
      stepId: "select_finalization_workflow",
    });
    return result({
      blockers,
      events,
      finalizationReport: finalizationReport({
        status: "finalization_not_supported_for_workflow",
        supportedWorkflow: false,
      }),
      mutationSummary,
      readOnly: false,
      reportSummary: blocker.message,
      status: "finalization_not_supported_for_workflow",
      steps,
      variables,
    });
  }

  const target = resolveFinalizationTarget(input.request, variables);
  if (!target.ok) {
    blockers.push(target.blocker);
    pushStep(steps, events, {
      message: target.blocker.message,
      phase: "finalization",
      reasonCode: target.blocker.reasonCode,
      slot: target.blocker.slot,
      status: "blocked",
      stepId: "resolve_finalization_target",
      taskId: target.blocker.taskId,
    });
    return result({
      blockers,
      events,
      finalizationReport: finalizationReport({
        finalizationAction:
          input.request.workflowId === "dependency_failure_smoke"
            ? "fail"
            : "mark_done",
        status: "finalization_blocked",
        supportedWorkflow: true,
        targetSlot: target.blocker.slot,
        taskId: target.blocker.taskId,
      }),
      mutationSummary,
      readOnly: false,
      reportSummary: target.blocker.message,
      status: "finalization_blocked",
      steps,
      variables,
    });
  }

  const confirmation = resolveFinalizationConfirmation(input.request);
  if (!confirmation.ok) {
    blockers.push(confirmation.blocker);
    pushStep(steps, events, {
      message: confirmation.blocker.message,
      phase: "finalization",
      reasonCode: confirmation.blocker.reasonCode,
      status:
        confirmation.status === "finalization_needs_confirmation"
          ? "paused"
          : "blocked",
      stepId: `confirm_finalization:${target.value.taskId}`,
      taskId: target.value.taskId,
    });
    return result({
      blockers,
      events,
      finalizationReport: finalizationReport({
        failureReason: target.value.failureReason,
        finalizationAction: target.value.action,
        status: confirmation.status,
        supportedWorkflow: true,
        targetSlot: target.value.targetSlot,
        taskId: target.value.taskId,
      }),
      mutationSummary,
      readOnly: false,
      reportSummary: confirmation.blocker.message,
      status: confirmation.status,
      steps,
      variables,
    });
  }

  if (!input.readPort) {
    const blocker: QueueWorkflowRunnerBlocker = {
      message: "Queue workflow read port is unavailable.",
      reasonCode: "read_port_unavailable",
      taskId: target.value.taskId,
    };
    blockers.push(blocker);
    pushStep(steps, events, {
      message: blocker.message,
      phase: "read",
      reasonCode: blocker.reasonCode,
      status: "unavailable",
      stepId: "open_finalization_read_port",
      taskId: target.value.taskId,
    });
    return result({
      blockers,
      events,
      finalizationReport: finalizationReport({
        failureReason: target.value.failureReason,
        finalizationAction: target.value.action,
        status: "finalization_blocked",
        supportedWorkflow: true,
        targetSlot: target.value.targetSlot,
        taskId: target.value.taskId,
      }),
      mutationSummary,
      readOnly: false,
      reportSummary: blocker.message,
      status: "unavailable",
      steps,
      variables,
    });
  }

  if (!input.finalizationPort) {
    const blocker: QueueWorkflowRunnerBlocker = {
      message: "Queue workflow finalization port is unavailable.",
      reasonCode: "finalization_port_unavailable",
      taskId: target.value.taskId,
    };
    blockers.push(blocker);
    pushStep(steps, events, {
      message: blocker.message,
      phase: "finalization",
      reasonCode: blocker.reasonCode,
      status: "unavailable",
      stepId: "open_finalization_port",
      taskId: target.value.taskId,
    });
    return result({
      blockers,
      events,
      finalizationReport: finalizationReport({
        failureReason: target.value.failureReason,
        finalizationAction: target.value.action,
        status: "finalization_blocked",
        supportedWorkflow: true,
        targetSlot: target.value.targetSlot,
        taskId: target.value.taskId,
      }),
      mutationSummary,
      readOnly: false,
      reportSummary: blocker.message,
      status: "unavailable",
      steps,
      variables,
    });
  }

  const baseFinalizationReport = finalizationReport({
    confirmationTokenAccepted: true,
    failureReason: target.value.failureReason,
    finalizationAction: target.value.action,
    supportedWorkflow: true,
    targetSlot: target.value.targetSlot,
    taskId: target.value.taskId,
  });

  try {
    await readTaskSnapshots({
      events,
      readPort: input.readPort,
      steps,
      taskIds: [target.value.taskId],
      variables,
    });

    const aggregateBlockers = missingAggregateBlockersForReads(variables, [
      target.value.taskId,
    ]);
    if (aggregateBlockers.length > 0) {
      blockers.push(...aggregateBlockers);
      return result({
        blockers,
        events,
        finalizationReport: {
          ...baseFinalizationReport,
          status: "finalization_blocked",
        },
        mutationSummary,
        readOnly: false,
        reportSummary:
          "Queue finalization workflow blocked because the explicit upstream aggregate was not found.",
        status: "finalization_blocked",
        steps,
        variables,
      });
    }

    const reviewPrecondition = reviewAcknowledgedForFinalization({
      request: input.request,
      snapshot: snapshotForTask(variables, target.value.taskId),
      target: target.value,
    });
    if (!reviewPrecondition.ok) {
      blockers.push(reviewPrecondition.blocker);
      pushStep(steps, events, {
        message: reviewPrecondition.blocker.message,
        phase: "finalization",
        reasonCode: reviewPrecondition.blocker.reasonCode,
        status: "blocked",
        stepId: `check_review_ack:${target.value.taskId}`,
        taskId: target.value.taskId,
      });
      return result({
        blockers,
        events,
        finalizationReport: {
          ...baseFinalizationReport,
          status: "finalization_blocked",
        },
        mutationSummary,
        readOnly: false,
        reportSummary: reviewPrecondition.blocker.message,
        status: "finalization_blocked",
        steps,
        variables,
      });
    }

    const commandResult =
      target.value.action === "mark_done"
        ? await input.finalizationPort.markDone(
            stripUndefined({
              confirmationToken: confirmation.token,
              messageId: target.value.messageId,
              reason: target.value.reason,
              runId: target.value.runId,
              taskId: target.value.taskId,
            }),
          )
        : await input.finalizationPort.failItem(
            stripUndefined({
              confirmationToken: confirmation.token,
              evidenceBundleId: target.value.evidenceBundleId,
              messageId: target.value.messageId,
              reason: target.value.failureReason!,
              runId: target.value.runId,
              taskId: target.value.taskId,
            }),
          );

    if (commandResult.aggregate) {
      variables.readSnapshots.aggregatesByTaskId[target.value.taskId] =
        commandResult.aggregate;
      variables.readSnapshots.lifecycleByTaskId[target.value.taskId] =
        commandResult.aggregate;
    }

    const status = finalizationStatusForCommandResult(
      commandResult.status,
      target.value.action,
    );
    const idempotent =
      status === "finalization_already_done" ||
      status === "finalization_already_failed";

    if (
      status === "finalization_completed" ||
      status === "finalization_already_done" ||
      status === "finalization_already_failed"
    ) {
      if (commandResult.status === "succeeded") {
        if (target.value.action === "mark_done") {
          mutationSummary.didMarkDone = true;
        } else {
          mutationSummary.didFail = true;
        }
        mutationSummary.didMutateQueue = true;
      }

      pushStep(steps, events, {
        message: finalizationSuccessMessage(commandResult.status, target.value.action),
        phase: "finalization",
        status: "completed",
        stepId: `${target.value.action}:${target.value.taskId}`,
        taskId: target.value.taskId,
      });

      const downstreamVerification = await verifyDownstreamAfterFinalization({
        action: target.value.action,
        downstreamTaskId: target.value.downstreamTaskId,
        events,
        readPort: input.readPort,
        steps,
        variables,
      });

      return result({
        blockers,
        events,
        finalizationReport: finalizationReport({
          ...baseFinalizationReport,
          commandStatus: commandResult.status,
          decisionId: commandResult.decisionId ?? undefined,
          downstreamVerification,
          idempotent,
          status,
        }),
        mutationSummary,
        readOnly: false,
        reportSummary:
          target.value.action === "mark_done"
            ? "Queue acceptance finalization completed for explicit upstream task."
            : "Queue failure finalization completed for explicit upstream task.",
        status,
        steps,
        variables,
      });
    }

    const blocker = blockerForFinalizationResult(
      commandResult,
      target.value.action,
      target.value.taskId,
    );
    blockers.push(blocker);
    pushStep(steps, events, {
      message: blocker.message,
      phase: "finalization",
      reasonCode: blocker.reasonCode,
      status:
        status === "finalization_failed_unexpected"
          ? "failed_unexpected"
          : "blocked",
      stepId: `${target.value.action}_blocked:${target.value.taskId}`,
      taskId: target.value.taskId,
    });
    return result({
      blockers,
      events,
      finalizationReport: finalizationReport({
        ...baseFinalizationReport,
        commandStatus: commandResult.status,
        status:
          status === "unavailable" ? "finalization_blocked" : status,
      }),
      mutationSummary,
      readOnly: false,
      reportSummary: blocker.message,
      status,
      steps,
      variables,
    });
  } catch (error) {
    const blocker: QueueWorkflowRunnerBlocker = {
      message:
        error instanceof Error
          ? error.message
          : "Queue finalization workflow failed unexpectedly.",
      reasonCode: "failed_unexpected",
      taskId: target.value.taskId,
    };
    blockers.push(blocker);
    pushStep(steps, events, {
      message: blocker.message,
      phase: "finalization",
      reasonCode: blocker.reasonCode,
      status: "failed_unexpected",
      stepId: "finalization_failed",
      taskId: target.value.taskId,
    });
    return result({
      blockers,
      events,
      finalizationReport: finalizationReport({
        ...baseFinalizationReport,
        status: "finalization_failed_unexpected",
      }),
      mutationSummary,
      readOnly: false,
      reportSummary: blocker.message,
      status: "finalization_failed_unexpected",
      steps,
      variables,
    });
  }
}
