import { describe, expect, it } from "vitest";

import type { QueueAgentLifecycleTransitionOutput } from "../adapters";
import type { HobitAgentBrokerResult } from "../broker";
import {
  createQueueDogfoodBrokerSelfTestFakeStore,
  QUEUE_DOGFOOD_BROKER_SELF_TEST_REQUIRED_CAPABILITY_IDS,
  runQueueDogfoodBrokerSelfTest,
} from "./hobitQueueDogfoodBrokerSelfTest";

describe("Queue dogfood broker self-test", () => {
  it("passes the full fake broker-driven success path", () => {
    const report = runQueueDogfoodBrokerSelfTest({
      reportId: "queue-dogfood-broker:test",
    });

    expect(report.status).toBe("passed");
    expect(report.coverageBoundary).toContain(
      "Fake frontend model/controller/broker-level",
    );
    expect(report.exercisedCapabilityIds).toEqual(
      expect.arrayContaining([
        ...QUEUE_DOGFOOD_BROKER_SELF_TEST_REQUIRED_CAPABILITY_IDS,
        "queue.review.getEvidenceBundle",
      ]),
    );
    expect(caseById(report, "queue-dogfood-broker:summary")).toMatchObject({
      message: "Queue dogfood broker loop passed.",
      status: "passed",
    });
    expect(
      caseById(report, "queue-dogfood-broker:agent-finished-awaiting-review"),
    ).toMatchObject({
      capabilityIds: ["queue.lifecycle.agentFinished"],
      message: "Agent finished - awaiting review.",
      status: "passed",
    });
    expect(
      caseById(report, "queue-dogfood-broker:review-message-created"),
    ).toMatchObject({
      message: "Review message created.",
      status: "passed",
    });
    expect(
      caseById(report, "queue-dogfood-broker:coordinator-ack-in-review"),
    ).toMatchObject({
      message: "Coordinator ACK - in review.",
      status: "passed",
    });
    expect(
      caseById(report, "queue-dogfood-broker:validation-approved"),
    ).toMatchObject({
      message: "Validation approved.",
      status: "passed",
    });
    expect(caseById(report, "queue-dogfood-broker:mark-done")).toMatchObject({
      message: "Mark done.",
      status: "passed",
    });
    expect(
      caseById(report, "queue-dogfood-broker:dependent-unblocked-after-done"),
    ).toMatchObject({
      message: "Dependent unblocked after done.",
      status: "passed",
    });
  });

  it("passes the follow-up branch and keeps worker execution fake-only", () => {
    const report = runQueueDogfoodBrokerSelfTest();
    const followUp = caseById(report, "queue-dogfood-broker:follow-up-running");

    expect(followUp).toMatchObject({
      message: "Follow-up prompt returns to running.",
      status: "passed",
    });
    expect(followUp.evidence).toEqual(
      expect.arrayContaining([
        "ticketState: running.",
        "agentPromptState: additional_prompt_running.",
        "additionalPromptCount: 1.",
        "wouldStartWorkers: false.",
      ]),
    );
  });

  it("passes the failure branch and keeps the dependent task blocked", () => {
    const report = runQueueDogfoodBrokerSelfTest();
    const failure = caseById(
      report,
      "queue-dogfood-broker:failure-dependent-blocked",
    );

    expect(failure).toMatchObject({
      message: "Failure keeps dependent blocked.",
      status: "passed",
    });
    expect(failure.evidence).toEqual(
      expect.arrayContaining([
        "ticketState: failure.",
        "Dependent startable after upstream failure: false.",
      ]),
    );
  });

  it("marks runtime durability worker validation and Git checks honestly", () => {
    const report = runQueueDogfoodBrokerSelfTest();

    expect(caseById(report, "queue-dogfood-broker:backend-durability")).toMatchObject({
      message: "Backend durability is not covered.",
      reason: "Frontend fake broker self-test only",
      required: false,
      status: "skipped",
    });
    expect(
      caseById(report, "queue-dogfood-broker:real-worker-execution"),
    ).toMatchObject({
      message: "Real worker execution is not covered.",
      required: false,
      status: "blocked",
    });
    expect(
      caseById(report, "queue-dogfood-broker:real-validation-execution"),
    ).toMatchObject({
      message: "Real validation execution is not covered.",
      required: false,
      status: "blocked",
    });
    expect(
      caseById(report, "queue-dogfood-broker:real-git-commit-execution"),
    ).toMatchObject({
      message: "Real Git commit execution is not covered.",
      required: false,
      status: "blocked",
    });
    expect(
      caseById(report, "queue-dogfood-broker:queue-linked-evidence-event-wiring"),
    ).toMatchObject({
      message: "Queue-linked evidence event wiring is available.",
      required: false,
      status: "passed",
    });
    expect(
      caseById(report, "queue-dogfood-broker:raw-non-queue-ingestion-blocked"),
    ).toMatchObject({
      message: "Raw non-Queue Direct Work ingestion is blocked.",
      required: false,
      status: "passed",
    });
    expect(
      caseById(report, "queue-dogfood-broker:duplicate-completion-guarded"),
    ).toMatchObject({
      message: "Duplicate Queue-linked completion ingestion is guarded.",
      required: false,
      status: "passed",
    });
    expect(report.summary).toEqual({
      blocked: 3,
      failed: 0,
      passed: 13,
      skipped: 1,
      total: 17,
    });
  });

  it("asserts no hidden side effects without repeating every assertion on every row", () => {
    const report = runQueueDogfoodBrokerSelfTest();
    const sideEffects = caseById(
      report,
      "queue-dogfood-broker:no-hidden-side-effects",
    );
    const agentFinished = caseById(
      report,
      "queue-dogfood-broker:agent-finished-awaiting-review",
    );

    expect(sideEffects).toMatchObject({
      message: "No hidden side effects.",
      status: "passed",
    });
    expect(sideEffects.evidence).toEqual(
      expect.arrayContaining([
        "No Codex run",
        "No shell command",
        "Only fake frontend lifecycle overlay mutation",
        "No real Queue worker start",
        "No Terminal launch",
        "No Git mutation",
        "No rollback execution",
        "No backend durability or storage mutation",
        "No duplicate Queue view creation",
        "No natural-language regex routing",
      ]),
    );
    expect(report.sideEffectAssertions.every((item) => item.passed)).toBe(true);
    expect(agentFinished.evidence).not.toContain("No Codex run");
  });
});

describe("Queue dogfood broker capability calls", () => {
  it("dry-runs lifecycle actions without mutating the fake store", () => {
    const store = createQueueDogfoodBrokerSelfTestFakeStore();
    const before = store.readLifecycle(store.taskId);

    const result = store.invoke<QueueAgentLifecycleTransitionOutput>(
      "queue.lifecycle.agentFinished",
      {
        evidenceBundle: store.evidenceBundle,
      },
      { dryRun: true },
    );
    const after = store.readLifecycle(store.taskId);

    expect(result.status).toBe("succeeded");
    expect(lifecycleOutput(result)).toMatchObject({
      dryRunOnly: true,
      queueMutation: "none",
      ticketState: "awaiting_review",
    });
    expect(before).toMatchObject({
      agentPromptState: "running",
      ticketState: "running",
    });
    expect(after).toMatchObject({
      agentPromptState: "running",
      ticketState: "running",
    });
  });

  it("execution mutates only the fake frontend lifecycle overlay", () => {
    const store = createQueueDogfoodBrokerSelfTestFakeStore();

    const result = store.invoke<QueueAgentLifecycleTransitionOutput>(
      "queue.lifecycle.agentFinished",
      {
        evidenceBundle: store.evidenceBundle,
      },
    );
    const output = lifecycleOutput(result);
    const after = store.readLifecycle(store.taskId);

    expect(result.status).toBe("succeeded");
    expect(output).toMatchObject({
      queueMutation: "frontend_controller_overlay",
      ticketState: "awaiting_review",
      wouldAutoRunWorkers: false,
      wouldCallGit: false,
      wouldExecuteRollback: false,
      wouldLaunchTerminal: false,
      wouldPersistBackend: false,
      wouldRunValidation: false,
      wouldStartWorkers: false,
    });
    expect(after).toMatchObject({
      finalAgentMessage: store.finalAgentMessage,
      workerEvidenceBundle: {
        taskId: store.taskId,
        threadId: store.fakeThreadId,
      },
      ticketState: "awaiting_review",
    });
  });

  it("fails wrong ACK targets through the real broker handler", () => {
    const store = createQueueDogfoodBrokerSelfTestFakeStore();

    store.invoke("queue.lifecycle.agentFinished", {
      attemptId: store.fakeAttemptId,
      finalAgentMessage: store.finalAgentMessage,
      outcome: "completed",
      runId: "fake-run-upstream-1",
      taskId: store.taskId,
      validationSummary: store.validationSummary,
    });
    store.invoke("queue.review.createMessage", {
      coordinatorAgentId: store.coordinatorAgentId,
      messageId: store.reviewMessageId,
      taskId: store.taskId,
    });
    const wrongAck = store.invoke("queue.review.ack", {
      coordinatorAgentId: "wrong-coordinator",
      messageId: store.reviewMessageId,
      taskId: store.taskId,
    });

    expect(wrongAck.status).toBe("failed");
    expect(wrongAck.result.message).toContain("message target does not match");
  });

  it("requires in-review state before markDone can close the item", () => {
    const store = createQueueDogfoodBrokerSelfTestFakeStore();

    const result = store.invoke("queue.item.markDone", {
      commit: store.fakeCommit,
      coordinatorAgentId: store.coordinatorAgentId,
      taskId: store.taskId,
      validationApproved: true,
    });

    expect(result.status).toBe("failed");
    expect(result.result.message).toContain("approveValidation cannot run");
    expect(store.readLifecycle(store.taskId)).toMatchObject({
      ticketState: "running",
    });
  });

  it("exercises all required lifecycle capability ids", () => {
    const report = runQueueDogfoodBrokerSelfTest();

    for (const capabilityId of QUEUE_DOGFOOD_BROKER_SELF_TEST_REQUIRED_CAPABILITY_IDS) {
      expect(report.exercisedCapabilityIds).toContain(capabilityId);
    }
  });
});

type BrokerResult = HobitAgentBrokerResult<QueueAgentLifecycleTransitionOutput>;

function lifecycleOutput(result: BrokerResult) {
  return result.result.output as QueueAgentLifecycleTransitionOutput | undefined;
}

function caseById(
  report: ReturnType<typeof runQueueDogfoodBrokerSelfTest>,
  caseId: string,
) {
  const result = report.cases.find((item) => item.caseId === caseId);
  if (!result) {
    throw new Error(`Missing Queue dogfood broker self-test case: ${caseId}`);
  }

  return result;
}
