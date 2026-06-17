import { describe, expect, it } from "vitest";

import {
  createDogfoodLifecycleItem,
  queueDogfoodLifecycleItem,
  startQueueItemRun,
  completeAgentPrompt,
  createReviewMessage,
  acknowledgeReviewMessage,
} from "./smartQueueDogfoodLifecycle";
import type {
  SmartQueueDogfoodLifecycleItem,
} from "./smartQueueDogfoodLifecycle";
import {
  createQueueWorkerEvidenceBundle,
} from "./smartQueueWorkerEvidenceBundle";
import {
  buildQueueReviewEvidenceViewModel,
} from "./queueReviewEvidenceViewModel";
import type {
  QueueAgentReviewEvidenceBundleOutput,
} from "../agents/adapters/queueAgentCapabilityTypes";

const NOW = "2026-06-17T10:00:00.000Z";

describe("queue review evidence view model", () => {
  it("presents awaiting review evidence with bounded message and changed files", () => {
    const hiddenTail = "hidden tail should not render";
    const lifecycle = completedLifecycle({
      finalAgentMessage: `${"Result start. ".repeat(80)}${hiddenTail}`,
    });
    const output = evidenceOutput(lifecycle);
    const model = buildQueueReviewEvidenceViewModel({
      evidenceOutput: output,
      taskId: lifecycle.taskId,
    });

    expect(model.relevant).toBe(true);
    expect(model.lifecycleStatusLabel).toBe("Awaiting review");
    expect(model.agentOutcomeLabel).toBe("Agent completed");
    expect(model.evidenceLabel).toBe("Evidence available");
    expect(model.evidenceSummary).toContain("Agent completed");
    expect(model.finalAgentMessage.preview).toContain("Result start.");
    expect(model.finalAgentMessage.preview).toContain("[Preview capped]");
    expect(model.finalAgentMessage.preview).not.toContain(hiddenTail);
    expect(model.changedFiles.count).toBe(7);
    expect(model.changedFiles.previewPaths).toHaveLength(5);
    expect(model.changedFiles.omittedCount).toBe(2);
    expect(model.validation.label).toBe("Validation passed");
    expect(model.validation.summaryPreview).toContain("Validation passed");
    expect(model.runReferenceLabel).toBe("Run run-1");
    expect(model.logReferenceLabel).toBe("Logs: log://run-1");
    expect(model.evidenceSummary).not.toContain("frontend-only");
    expect(model.frontendOnlyLabel).toBe("Frontend evidence only - not durable");
  });

  it("presents in review without exposing raw enum names", () => {
    const awaiting = completedLifecycle();
    const message = createReviewMessage(awaiting, {
      createdAt: NOW,
      finalAgentMessage: awaiting.finalAgentMessage,
      messageId: "review-message-1",
      toCoordinatorAgentId: "queue-coordinator",
    });
    const acked = acknowledgeReviewMessage(message.item, {
      ackId: "ack-1",
      coordinatorAgentId: "queue-coordinator",
      messageId: "review-message-1",
      receivedAt: NOW,
    });
    const model = buildQueueReviewEvidenceViewModel({
      evidenceOutput: evidenceOutput(acked.item),
      taskId: acked.item.taskId,
    });
    const visibleText = [
      model.lifecycleStatusLabel,
      model.agentOutcomeLabel,
      model.evidenceSummary,
      model.reviewMessageStateLabel,
      model.validation.label,
    ].join(" ");

    expect(model.lifecycleStatusLabel).toBe("In review");
    expect(model.reviewMessageStateLabel).toBe("In review");
    expect(visibleText).not.toContain("in_review");
    expect(visibleText).not.toContain("awaiting_review");
    expect(visibleText).not.toContain("frontend_only_not_durable");
    expect(visibleText).not.toContain("not_completed");
  });

  it("presents follow-up running and done states with product labels", () => {
    const lifecycle = {
      ...completedLifecycle(),
      additionalPromptCount: 1,
      agentPromptState: "additional_prompt_running" as const,
      ticketState: "running" as const,
    };
    const followUp = buildQueueReviewEvidenceViewModel({
      evidenceOutput: evidenceOutput(lifecycle),
      taskId: lifecycle.taskId,
    });
    const done = buildQueueReviewEvidenceViewModel({
      evidenceOutput: evidenceOutput({
        ...completedLifecycle(),
        ticketState: "done" as const,
      }),
      taskId: lifecycle.taskId,
    });

    expect(followUp.lifecycleStatusLabel).toBe("Follow-up prompt running");
    expect(followUp.additionalPromptCount).toBe(1);
    expect(done.lifecycleStatusLabel).toBe("Done");
  });
});

function completedLifecycle({
  finalAgentMessage = "Implementation completed.",
}: {
  readonly finalAgentMessage?: string;
} = {}): SmartQueueDogfoodLifecycleItem {
  const base = createDogfoodLifecycleItem({
    createdAt: NOW,
    originalPrompt: "Implement task.",
    taskId: "task-1",
    title: "Task 1",
  });
  const queued = queueDogfoodLifecycleItem(base, NOW).item;
  const running = startQueueItemRun(queued, {
    attemptId: "attempt-1",
    runnablePrompt: "Implement task.",
    startedAt: NOW,
    threadId: "thread-1",
  }).item;

  return completeAgentPrompt(running, {
    attemptId: "attempt-1",
    changedFilesSummary: "Changed files: 7",
    completedAt: NOW,
    finalAgentMessage,
    threadId: "thread-1",
    validationSummary: "Validation passed.",
    workerEvidenceBundle: createQueueWorkerEvidenceBundle({
      attemptId: "attempt-1",
      changedFiles: Array.from({ length: 7 }, (_, index) => ({
        path: `src/file-${index.toString()}.ts`,
        status: "modified",
      })),
      finalAgentMessage,
      logReference: "log://run-1",
      outcome: "completed",
      runId: "run-1",
      taskId: "task-1",
      threadId: "thread-1",
      validationStatus: "passed",
      validationSummary: "Validation passed.",
    }),
  }).item;
}

function evidenceOutput(
  lifecycle: SmartQueueDogfoodLifecycleItem,
): QueueAgentReviewEvidenceBundleOutput {
  return {
    changedFilesSummary: lifecycle.changedFilesSummary,
    evidenceBundle: lifecycle.workerEvidenceBundle ?? null,
    evidenceBundlePersistence: "frontend_only_not_durable",
    evidenceSummary: lifecycle.workerEvidenceSummary,
    finalAgentMessage: lifecycle.finalAgentMessage,
    latestReviewMessage:
      lifecycle.reviewMessages[lifecycle.reviewMessages.length - 1] ?? null,
    lifecycle,
    reviewMessages: [...lifecycle.reviewMessages],
    reviewOutcome: lifecycle.reviewOutcome ?? null,
    taskId: lifecycle.taskId,
    validationApprovals: [...lifecycle.validationApprovals],
    validationSummary: lifecycle.validationSummary,
  };
}
