import { describe, expect, it, vi } from "vitest";

import type {
  HobitAgentActionRequest,
  HobitAgentBrokerResult,
} from "../agents/broker/types";
import type {
  QueueAgentLifecycleTransitionOutput,
} from "../agents/adapters/queueAgentCapabilityTypes";
import {
  createDogfoodLifecycleItem,
} from "./smartQueueDogfoodLifecycle";
import {
  createQueueWorkerEvidenceBundle,
} from "./smartQueueWorkerEvidenceBundle";
import {
  invokeQueueReviewEvidenceBrokerAction,
} from "./queueReviewEvidenceActions";

const NOW = "2026-06-17T10:00:00.000Z";

describe("queue review evidence broker actions", () => {
  it("sends explicit structured Queue review actions through broker capabilities", async () => {
    const requests: HobitAgentActionRequest[] = [];
    const invoke = vi.fn(async (request: HobitAgentActionRequest) => {
      requests.push(request);
      return brokerResult(request);
    });
    const evidenceBundle = createQueueWorkerEvidenceBundle({
      changedFiles: ["src/review.ts"],
      finalAgentMessage: "Worker completed.",
      outcome: "completed",
      taskId: "task-1",
      validationStatus: "passed",
      validationSummary: "Validation passed.",
    });

    await invokeQueueReviewEvidenceBrokerAction(
      { invokeHobitAgentActionRequest: invoke, now: () => NOW },
      {
        changedFilesSummary: "src/review.ts",
        evidenceBundle,
        finalAgentMessage: "Worker completed.",
        taskId: "task-1",
        type: "create_review_message",
        validationSummary: "Validation passed.",
      },
    );
    await invokeQueueReviewEvidenceBrokerAction(
      { invokeHobitAgentActionRequest: invoke, now: () => NOW },
      {
        messageId: "review-message-1",
        taskId: "task-1",
        type: "ack_review",
      },
    );
    await invokeQueueReviewEvidenceBrokerAction(
      { invokeHobitAgentActionRequest: invoke, now: () => NOW },
      { taskId: "task-1", type: "approve_validation" },
    );
    await invokeQueueReviewEvidenceBrokerAction(
      { invokeHobitAgentActionRequest: invoke, now: () => NOW },
      {
        prompt: "Please address the visible review note.",
        taskId: "task-1",
        type: "add_follow_up_prompt",
      },
    );
    await invokeQueueReviewEvidenceBrokerAction(
      { invokeHobitAgentActionRequest: invoke, now: () => NOW },
      { taskId: "task-1", type: "mark_done" },
    );
    await invokeQueueReviewEvidenceBrokerAction(
      { invokeHobitAgentActionRequest: invoke, now: () => NOW },
      {
        reason: "Visible evidence failed review.",
        taskId: "task-1",
        type: "fail",
      },
    );
    await invokeQueueReviewEvidenceBrokerAction(
      { invokeHobitAgentActionRequest: invoke, now: () => NOW },
      {
        reason: "Blocked pending explicit operator input.",
        taskId: "task-1",
        type: "block",
      },
    );

    expect(requests.map((request) => request.capabilityId)).toEqual([
      "queue.review.createMessage",
      "queue.review.ack",
      "queue.coordinator.approveValidation",
      "queue.coordinator.addFollowUpPrompt",
      "queue.item.markDone",
      "queue.item.fail",
      "queue.item.block",
    ]);
    for (const request of requests) {
      expect(request.dryRun).toBe(false);
      expect(request.input).toMatchObject({ taskId: "task-1" });
      expect(request.agentRoleId).toBe("workspace_agent");
    }
    expect(inputFor(requests, "queue.review.createMessage")).toMatchObject({
      coordinatorAgentId: "queue-coordinator",
      evidenceBundle,
      finalAgentMessage: "Worker completed.",
      taskId: "task-1",
    });
    expect(inputFor(requests, "queue.review.ack")).toMatchObject({
      messageId: "review-message-1",
      taskId: "task-1",
    });
    expect(inputFor(requests, "queue.coordinator.approveValidation")).toMatchObject({
      summary: "Validation approved by coordinator review. No validation execution.",
      taskId: "task-1",
    });
    expect(inputFor(requests, "queue.coordinator.addFollowUpPrompt")).toMatchObject({
      prompt: "Please address the visible review note.",
      taskId: "task-1",
    });
    expect(inputFor(requests, "queue.item.markDone")).toMatchObject({
      commit: {
        commitTitle: "Coordinator accepted Queue review. No Git mutation.",
      },
      taskId: "task-1",
      validationApproved: true,
    });
    expect(inputFor(requests, "queue.item.fail")).toMatchObject({
      reason: "Visible evidence failed review.",
    });
    expect(inputFor(requests, "queue.item.block")).toMatchObject({
      reason: "Blocked pending explicit operator input.",
    });
  });

  it("does not invoke hidden execution, Git, rollback, worker, or inferred routing paths", async () => {
    const requests: HobitAgentActionRequest[] = [];
    const invoke = vi.fn(async (request: HobitAgentActionRequest) => {
      requests.push(request);
      return brokerResult(request);
    });

    await invokeQueueReviewEvidenceBrokerAction(
      { invokeHobitAgentActionRequest: invoke, now: () => NOW },
      { taskId: "task-1", type: "mark_done" },
    );
    await invokeQueueReviewEvidenceBrokerAction(
      { invokeHobitAgentActionRequest: invoke, now: () => NOW },
      {
        prompt: "Explicit follow-up prompt.",
        taskId: "task-1",
        type: "add_follow_up_prompt",
      },
    );

    const capabilityText = requests
      .map((request) => request.capabilityId)
      .join(" ");
    expect(capabilityText).not.toContain("codex");
    expect(capabilityText).not.toContain("shell");
    expect(capabilityText).not.toContain("terminal");
    expect(capabilityText).not.toContain("git");
    expect(capabilityText).not.toContain("rollback");
    expect(capabilityText).not.toContain("startWorker");
    expect(capabilityText).not.toContain("queue.lifecycle.agentFinished");
    expect(JSON.stringify(requests.map((request) => request.input))).not.toContain(
      "infer",
    );
  });

  it("reports unavailable broker without fake success", async () => {
    const result = await invokeQueueReviewEvidenceBrokerAction(
      {},
      { taskId: "task-1", type: "mark_done" },
    );

    expect(result.ok).toBe(false);
    expect(result.message).toBe("Review actions unavailable.");
    expect(result.lifecycle).toBeNull();
  });
});

function inputFor(
  requests: readonly HobitAgentActionRequest[],
  capabilityId: string,
) {
  return requests.find((request) => request.capabilityId === capabilityId)?.input;
}

function brokerResult(
  request: HobitAgentActionRequest,
): HobitAgentBrokerResult<QueueAgentLifecycleTransitionOutput> {
  const lifecycle = createDogfoodLifecycleItem({
    createdAt: NOW,
    originalPrompt: "Prompt",
    taskId: "task-1",
    title: "Task 1",
  });
  const output: QueueAgentLifecycleTransitionOutput = {
    actionLabel: "Queue review action",
    additionalPromptCount: lifecycle.additionalPromptCount,
    agentPromptState: lifecycle.agentPromptState,
    dryRunOnly: false,
    lifecycle,
    previousAgentPromptState: lifecycle.agentPromptState,
    previousTicketState: lifecycle.ticketState,
    queueMutation: "frontend_controller_overlay",
    reviewOutcome: lifecycle.reviewOutcome ?? null,
    taskId: lifecycle.taskId,
    ticketState: lifecycle.ticketState,
    value: null,
    wouldAutoRunWorkers: false,
    wouldCallGit: false,
    wouldExecuteRollback: false,
    wouldLaunchTerminal: false,
    wouldPersistBackend: false,
    wouldRunValidation: false,
    wouldStartWorkers: false,
  };

  return {
    policyDecision: {
      allowed: true,
      reasons: [],
      requiresConfirmation: false,
      requiresDryRun: false,
      status: "allowed",
    },
    request,
    result: {
      auditEvents: [],
      capabilityId: request.capabilityId,
      dryRun: request.dryRun,
      hiddenSideEffectFlags: {
        noCodexRun: false,
        noGitMutation: false,
        noQueueMutation: false,
        noRollbackExecution: false,
        noShellCommand: false,
        noTerminalLaunch: false,
        noWorkerStart: false,
      },
      message: "Queue review action completed.",
      ok: true,
      output,
      policyReasons: [],
      requestId: request.requestId,
      status: "succeeded",
    },
    status: "succeeded",
  };
}
