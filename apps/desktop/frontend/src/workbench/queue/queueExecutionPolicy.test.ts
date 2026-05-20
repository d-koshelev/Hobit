import type { AgentQueueTaskStatus } from "../../workspace/types";
import {
  getQueueRunnerPolicyDecision,
  hasQueueTaskRunnablePrompt,
  isQueueTaskRunnableStatus,
  normalizeQueueExecutionPolicy,
  type QueueRunnerPreviousTaskStatus,
} from "./queueExecutionPolicy";

describe("queue execution policy helpers", () => {
  it("treats queued, ready, and review_needed as runnable statuses", () => {
    const runnableStatuses: AgentQueueTaskStatus[] = [
      "queued",
      "ready",
      "review_needed",
    ];

    for (const status of runnableStatuses) {
      expect(isQueueTaskRunnableStatus(status)).toBe(true);
    }
  });

  it("treats draft, running, final, and unknown statuses as not runnable", () => {
    const nonRunnableStatuses = [
      "draft",
      "running",
      "completed",
      "failed",
      "cancelled",
      "blocked",
      "timed_out",
      null,
      undefined,
    ];

    for (const status of nonRunnableStatuses) {
      expect(isQueueTaskRunnableStatus(status)).toBe(false);
    }
  });

  it("requires a non-empty prompt after trimming", () => {
    expect(hasQueueTaskRunnablePrompt({ prompt: "Do the work" })).toBe(true);
    expect(hasQueueTaskRunnablePrompt({ prompt: "  Do the work  " })).toBe(true);
    expect(hasQueueTaskRunnablePrompt({ prompt: "" })).toBe(false);
    expect(hasQueueTaskRunnablePrompt({ prompt: "   " })).toBe(false);
    expect(hasQueueTaskRunnablePrompt({ prompt: null })).toBe(false);
    expect(hasQueueTaskRunnablePrompt({})).toBe(false);
  });

  it("normalizes missing and unknown policies to manual", () => {
    expect(normalizeQueueExecutionPolicy("manual")).toBe("manual");
    expect(normalizeQueueExecutionPolicy("auto")).toBe("auto");
    expect(normalizeQueueExecutionPolicy("after_previous_success")).toBe(
      "after_previous_success",
    );
    expect(normalizeQueueExecutionPolicy("unsupported")).toBe("manual");
    expect(normalizeQueueExecutionPolicy(null)).toBe("manual");
    expect(normalizeQueueExecutionPolicy(undefined)).toBe("manual");
  });

  it("stops on manual policy even when status and prompt are runnable", () => {
    expect(
      getQueueRunnerPolicyDecision({
        executionPolicy: "manual",
        prompt: "Run this",
        status: "ready",
      }),
    ).toBe("stop_for_manual");
  });

  it("runs auto policy only when status and prompt are runnable", () => {
    expect(
      getQueueRunnerPolicyDecision({
        executionPolicy: "auto",
        prompt: "Run this",
        status: "queued",
      }),
    ).toBe("run");

    expect(
      getQueueRunnerPolicyDecision({
        executionPolicy: "auto",
        prompt: "   ",
        status: "queued",
      }),
    ).toBe("skip_missing_prompt");

    expect(
      getQueueRunnerPolicyDecision({
        executionPolicy: "auto",
        prompt: "Run this",
        status: "draft",
      }),
    ).toBe("skip_not_runnable_status");
  });

  it("runs after_previous_success only after the previous task completed", () => {
    expect(
      getQueueRunnerPolicyDecision({
        executionPolicy: "after_previous_success",
        previousTaskStatus: "completed",
        prompt: "Run this",
        status: "ready",
      }),
    ).toBe("run");
  });

  it("stops after_previous_success when there is no previous executed task", () => {
    expect(
      getQueueRunnerPolicyDecision({
        executionPolicy: "after_previous_success",
        previousTaskStatus: null,
        prompt: "Run this",
        status: "ready",
      }),
    ).toBe("stop_waiting_for_previous_success");
  });

  it("stops after_previous_success when the previous task did not complete successfully", () => {
    const unsuccessfulStatuses: QueueRunnerPreviousTaskStatus[] = [
      "failed",
      "cancelled",
      "timed_out",
    ];

    for (const previousTaskStatus of unsuccessfulStatuses) {
      expect(
        getQueueRunnerPolicyDecision({
          executionPolicy: "after_previous_success",
          previousTaskStatus,
          prompt: "Run this",
          status: "ready",
        }),
      ).toBe("stop_previous_task_not_successful");
    }
  });

  it("does not return runnable starts for draft, running, or final task statuses", () => {
    const nonStartStatuses: AgentQueueTaskStatus[] = [
      "draft",
      "running",
      "completed",
      "failed",
      "cancelled",
    ];

    for (const status of nonStartStatuses) {
      expect(
        getQueueRunnerPolicyDecision({
          executionPolicy: "auto",
          prompt: "Run this",
          status,
        }),
      ).toBe("skip_not_runnable_status");
    }
  });

  it("treats missing or unknown policy decisions as manual stops", () => {
    expect(
      getQueueRunnerPolicyDecision({
        prompt: "Run this",
        status: "ready",
      }),
    ).toBe("stop_for_manual");

    expect(
      getQueueRunnerPolicyDecision({
        executionPolicy: "unsupported",
        prompt: "Run this",
        status: "ready",
      }),
    ).toBe("stop_for_manual");
  });
});
