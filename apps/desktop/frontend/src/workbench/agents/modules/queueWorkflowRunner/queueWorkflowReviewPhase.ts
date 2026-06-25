import {
  MUTATION_SUMMARY,
  REVIEW_WORKFLOWS,
} from "./queueWorkflowRunnerConstants";
import { pushStep } from "./queueWorkflowRunnerEvents";
import {
  blockerForAckReviewResult,
  blockerForCreateReviewResult,
  messageIdFromCreateResult,
  resolveReviewEvidence,
  resolveReviewTarget,
  validateReviewRunnerBoundary,
} from "./queueWorkflowReviewHelpers";
import {
  buildVariables,
  cleanString,
  setSlotVariable,
  stripUndefined,
} from "./queueWorkflowRunnerRefs";
import {
  missingAggregateBlockersForReads,
  readTaskSnapshots,
} from "./queueWorkflowRunnerReadSnapshots";
import { result, reviewReport } from "./queueWorkflowRunnerReports";
import type {
  QueueWorkflowReviewReport,
  QueueWorkflowReviewRunnerInput,
  QueueWorkflowRunnerBlocker,
  QueueWorkflowRunnerEvent,
  QueueWorkflowRunnerResult,
  QueueWorkflowRunnerStep,
} from "./queueWorkflowRunnerTypes";

export async function runQueueWorkflowReviewRunner(
  input: QueueWorkflowReviewRunnerInput,
): Promise<QueueWorkflowRunnerResult> {
  const steps: QueueWorkflowRunnerStep[] = [];
  const events: QueueWorkflowRunnerEvent[] = [];
  const blockers: QueueWorkflowRunnerBlocker[] = [];
  const variables = buildVariables(input.request);
  const mutationSummary = { ...MUTATION_SUMMARY };

  const validationBlocker = validateReviewRunnerBoundary(input);
  if (validationBlocker) {
    blockers.push(validationBlocker);
    pushStep(steps, events, {
      message: validationBlocker.message,
      phase: "validate",
      reasonCode: validationBlocker.reasonCode,
      status: "blocked",
      stepId: "validate_review_request",
    });
    return result({
      blockers,
      events,
      mutationSummary,
      readOnly: false,
      reportSummary: validationBlocker.message,
      status: "invalid_request",
      steps,
      variables,
    });
  }

  if (!REVIEW_WORKFLOWS.has(input.request.workflowId)) {
    const blocker: QueueWorkflowRunnerBlocker = {
      fieldPath: "$.workflowId",
      message: `${input.request.workflowId} is not supported by the Queue review workflow runner.`,
      reasonCode: "review_not_supported_for_workflow",
    };
    blockers.push(blocker);
    pushStep(steps, events, {
      message: blocker.message,
      phase: "review",
      reasonCode: blocker.reasonCode,
      status: "blocked",
      stepId: "select_review_workflow",
    });
    return result({
      blockers,
      events,
      mutationSummary,
      readOnly: false,
      reportSummary: blocker.message,
      reviewReport: reviewReport({
        status: "review_not_supported_for_workflow",
        supportedWorkflow: false,
      }),
      status: "review_not_supported_for_workflow",
      steps,
      variables,
    });
  }

  const target = resolveReviewTarget(input.request, variables);
  if (!target.ok) {
    blockers.push(target.blocker);
    pushStep(steps, events, {
      message: target.blocker.message,
      phase: "review",
      reasonCode: target.blocker.reasonCode,
      slot: target.blocker.slot,
      status: "blocked",
      stepId: "resolve_review_target",
      taskId: target.blocker.taskId,
    });
    return result({
      blockers,
      events,
      mutationSummary,
      readOnly: false,
      reportSummary: target.blocker.message,
      reviewReport: reviewReport({
        status: "review_blocked_missing_task_or_run",
        supportedWorkflow: true,
        targetSlot: target.blocker.slot,
        taskId: target.blocker.taskId,
      }),
      status: "review_blocked_missing_task_or_run",
      steps,
      variables,
    });
  }

  const reviewReportDraft = reviewReport({
    evidenceBundleId: target.value.evidenceBundleId,
    messageId: target.value.messageId,
    runId: target.value.runId,
    status: null,
    supportedWorkflow: true,
    targetSlot: target.value.targetSlot,
    taskId: target.value.taskId,
  });

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
      stepId: "open_review_read_port",
      taskId: target.value.taskId,
    });
    return result({
      blockers,
      events,
      mutationSummary,
      readOnly: false,
      reportSummary: blocker.message,
      reviewReport: reviewReportDraft,
      status: "unavailable",
      steps,
      variables,
    });
  }

  if (!input.reviewPort) {
    const blocker: QueueWorkflowRunnerBlocker = {
      message: "Queue workflow review port is unavailable.",
      reasonCode: "review_port_unavailable",
      taskId: target.value.taskId,
    };
    blockers.push(blocker);
    pushStep(steps, events, {
      message: blocker.message,
      phase: "review",
      reasonCode: blocker.reasonCode,
      status: "unavailable",
      stepId: "open_review_port",
      taskId: target.value.taskId,
    });
    return result({
      blockers,
      events,
      mutationSummary,
      readOnly: false,
      reportSummary: blocker.message,
      reviewReport: reviewReportDraft,
      status: "unavailable",
      steps,
      variables,
    });
  }

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
        mutationSummary,
        readOnly: false,
        reportSummary:
          "Queue review workflow blocked because the explicit task aggregate was not found.",
        reviewReport: reviewReportDraft,
        status: "blocked",
        steps,
        variables,
      });
    }

    const evidence = await resolveReviewEvidence({
      events,
      readPort: input.readPort,
      steps,
      target: target.value,
      variables,
    });
    reviewReportDraft.evidenceState = evidence.evidenceState;
    if (!evidence.ok) {
      blockers.push(evidence.blocker);
      return result({
        blockers,
        events,
        mutationSummary,
        readOnly: false,
        reportSummary: evidence.blocker.message,
        reviewReport: reviewReport({
          ...reviewReportDraft,
          status: "review_blocked_missing_evidence",
        }),
        status: "review_blocked_missing_evidence",
        steps,
        variables,
      });
    }

    reviewReportDraft.evidenceBundleId = evidence.evidenceBundleId;
    reviewReportDraft.runId = evidence.runId;
    setSlotVariable(variables, target.value.targetSlot, {
      evidenceBundleId: evidence.evidenceBundleId,
      runId: evidence.runId,
    });

    let messageId = target.value.messageId;
    let createStatus: QueueWorkflowReviewReport["createStatus"] =
      messageId ? "skipped_existing_message" : undefined;
    let idempotentCreate = false;

    if (messageId) {
      pushStep(steps, events, {
        message:
          "Skipped review message creation because a typed messageId was already supplied.",
        messageId,
        phase: "review",
        status: "skipped",
        stepId: `skip_review_create:${target.value.taskId}`,
        taskId: target.value.taskId,
      });
    } else {
      const createResult = await input.reviewPort.createReviewMessage(
        stripUndefined({
          evidenceBundleId: evidence.evidenceBundleId,
          messageBody: target.value.messageBody,
          runId: evidence.runId,
          taskId: target.value.taskId,
        }),
      );
      createStatus = createResult.status;
      reviewReportDraft.createStatus = createStatus;

      if (createResult.status === "succeeded") {
        messageId = cleanString(createResult.messageId);
        if (!messageId) {
          const blocker: QueueWorkflowRunnerBlocker = {
            message:
              "Queue review create succeeded without returning a messageId.",
            reasonCode: "failed_unexpected",
            taskId: target.value.taskId,
          };
          blockers.push(blocker);
          pushStep(steps, events, {
            message: blocker.message,
            phase: "review",
            reasonCode: blocker.reasonCode,
            status: "failed_unexpected",
            stepId: `create_review_missing_message:${target.value.taskId}`,
            taskId: target.value.taskId,
          });
          return result({
            blockers,
            events,
            mutationSummary,
            readOnly: false,
            reportSummary: blocker.message,
            reviewReport: reviewReport({
              ...reviewReportDraft,
              status: "review_completed",
            }),
            status: "failed_unexpected",
            steps,
            variables,
          });
        }
        mutationSummary.didCreateReviewMessage = true;
        mutationSummary.didMutateQueue = true;
        pushStep(steps, events, {
          evidenceBundleId: evidence.evidenceBundleId,
          message: "Queue review message created.",
          messageId,
          phase: "review",
          runId: evidence.runId,
          status: "completed",
          stepId: `create_review:${target.value.taskId}`,
          taskId: target.value.taskId,
        });
      } else if (createResult.status === "already_exists") {
        messageId = messageIdFromCreateResult(createResult);
        idempotentCreate = true;
        if (!messageId) {
          const blocker: QueueWorkflowRunnerBlocker = {
            message:
              createResult.message ??
              "Queue review message already exists, but no existing messageId was returned.",
            reasonCode: "review_message_already_exists",
            taskId: target.value.taskId,
          };
          blockers.push(blocker);
          pushStep(steps, events, {
            message: blocker.message,
            phase: "review",
            reasonCode: blocker.reasonCode,
            status: "blocked",
            stepId: `create_review_already_exists_missing_message:${target.value.taskId}`,
            taskId: target.value.taskId,
          });
          return result({
            blockers,
            events,
            mutationSummary,
            readOnly: false,
            reportSummary: blocker.message,
            reviewReport: reviewReport({
              ...reviewReportDraft,
              createStatus,
              idempotentCreate,
              status: "review_message_already_exists",
            }),
            status: "review_message_already_exists",
            steps,
            variables,
          });
        }
        pushStep(steps, events, {
          evidenceBundleId: evidence.evidenceBundleId,
          message: "Queue review message already exists; using existing messageId.",
          messageId,
          phase: "review",
          reasonCode: "review_message_already_exists",
          runId: evidence.runId,
          status: "completed",
          stepId: `create_review_already_exists:${target.value.taskId}`,
          taskId: target.value.taskId,
        });
      } else {
        const blocker = blockerForCreateReviewResult(
          createResult,
          target.value.taskId,
        );
        blockers.push(blocker);
        pushStep(steps, events, {
          evidenceBundleId: evidence.evidenceBundleId,
          message: blocker.message,
          phase: "review",
          reasonCode: blocker.reasonCode,
          runId: evidence.runId,
          status:
            createResult.status === "failed_unexpected"
              ? "failed_unexpected"
              : "blocked",
          stepId: `create_review_blocked:${target.value.taskId}`,
          taskId: target.value.taskId,
        });
        return result({
          blockers,
          events,
          mutationSummary,
          readOnly: false,
          reportSummary: blocker.message,
          reviewReport: reviewReport({
            ...reviewReportDraft,
            createStatus,
            status: null,
          }),
          status:
            createResult.status === "failed_unexpected"
              ? "failed_unexpected"
              : createResult.status === "unavailable"
                ? "unavailable"
                : "blocked",
          steps,
          variables,
        });
      }
    }

    if (!messageId) {
      const blocker: QueueWorkflowRunnerBlocker = {
        message: "Queue review ACK requires messageId.",
        reasonCode: "review_ack_missing_message_id",
        taskId: target.value.taskId,
      };
      blockers.push(blocker);
      pushStep(steps, events, {
        message: blocker.message,
        phase: "review",
        reasonCode: blocker.reasonCode,
        status: "blocked",
        stepId: `ack_review_missing_message:${target.value.taskId}`,
        taskId: target.value.taskId,
      });
      return result({
        blockers,
        events,
        mutationSummary,
        readOnly: false,
        reportSummary: blocker.message,
        reviewReport: reviewReport({
          ...reviewReportDraft,
          createStatus,
          idempotentCreate,
          status: "review_completed",
        }),
        status: "blocked",
        steps,
        variables,
      });
    }

    reviewReportDraft.messageId = messageId;
    setSlotVariable(variables, target.value.targetSlot, { messageId });

    const ackResult = await input.reviewPort.ackReviewMessage({
      messageId,
      taskId: target.value.taskId,
    });
    const idempotentAck =
      ackResult.status === "already_done" || ackResult.status === "already_exists";

    if (ackResult.status === "succeeded" || idempotentAck) {
      if (ackResult.status === "succeeded") {
        mutationSummary.didAckReview = true;
        mutationSummary.didMutateQueue = true;
      }
      pushStep(steps, events, {
        message:
          ackResult.status === "succeeded"
            ? "Queue review acknowledged."
            : "Queue review ACK is already durable; treating as idempotent.",
        messageId,
        phase: "review",
        reasonCode: idempotentAck ? "review_ack_already_done" : undefined,
        status: "completed",
        stepId: `ack_review:${target.value.taskId}`,
        taskId: target.value.taskId,
      });
      return result({
        blockers,
        events,
        mutationSummary,
        readOnly: false,
        reportSummary:
          "Queue review workflow acknowledged review message without finalization.",
        reviewReport: reviewReport({
          ...reviewReportDraft,
          ackStatus: ackResult.status,
          createStatus,
          idempotentAck,
          idempotentCreate,
          messageId,
          status: "review_acknowledged",
        }),
        status: "review_acknowledged",
        steps,
        variables,
      });
    }

    const blocker = blockerForAckReviewResult(ackResult, target.value.taskId);
    blockers.push(blocker);
    pushStep(steps, events, {
      message: blocker.message,
      messageId,
      phase: "review",
      reasonCode: blocker.reasonCode,
      status:
        ackResult.status === "failed_unexpected"
          ? "failed_unexpected"
          : "blocked",
      stepId: `ack_review_blocked:${target.value.taskId}`,
      taskId: target.value.taskId,
    });
    return result({
      blockers,
      events,
      mutationSummary,
      readOnly: false,
      reportSummary: blocker.message,
      reviewReport: reviewReport({
        ...reviewReportDraft,
        ackStatus: ackResult.status,
        createStatus,
        idempotentCreate,
        messageId,
        status: "review_completed",
      }),
      status:
        ackResult.status === "failed_unexpected"
          ? "failed_unexpected"
          : ackResult.status === "unavailable"
            ? "unavailable"
            : "blocked",
      steps,
      variables,
    });
  } catch (error) {
    const blocker: QueueWorkflowRunnerBlocker = {
      message:
        error instanceof Error
          ? error.message
          : "Queue review workflow failed unexpectedly.",
      reasonCode: "failed_unexpected",
      taskId: target.value.taskId,
    };
    blockers.push(blocker);
    pushStep(steps, events, {
      message: blocker.message,
      phase: "review",
      reasonCode: blocker.reasonCode,
      status: "failed_unexpected",
      stepId: "review_failed",
      taskId: target.value.taskId,
    });
    return result({
      blockers,
      events,
      mutationSummary,
      readOnly: false,
      reportSummary: blocker.message,
      reviewReport: reviewReport({
        ...reviewReportDraft,
        status: null,
      }),
      status: "failed_unexpected",
      steps,
      variables,
    });
  }
}
