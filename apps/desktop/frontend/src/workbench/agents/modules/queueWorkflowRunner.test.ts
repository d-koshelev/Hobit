import runnerSource from "./queueWorkflowRunner.ts?raw";

import { describe, expect, it } from "vitest";

import type {
  AgentQueueItemAggregate,
  AgentQueueWorkerEvidenceQueryResult,
} from "../../../workspace/types";
import type {
  QueueWorkflowEvidenceReadRequest,
  QueueWorkflowReadPort,
  QueueWorkflowReviewPort,
  QueueWorkflowAckReviewMessageRequest,
  QueueWorkflowAckReviewMessageResult,
  QueueWorkflowCreateReviewMessageRequest,
  QueueWorkflowCreateReviewMessageResult,
  QueueWorkflowRunnerRequest,
} from "./queueWorkflowRunner";
import {
  runQueueWorkflowReadOnlyRunner,
  runQueueWorkflowReviewRunner,
} from "./queueWorkflowRunner";
import { validateQueueWorkflowRequest } from "./queueWorkflowRequestValidation";

describe("QueueWorkflowRunner", () => {
  it("pauses dependency_acceptance_smoke without explicit task ids and performs no reads", async () => {
    const readPort = fakeReadPort();
    const request = workflowRequest();

    const result = await runQueueWorkflowReadOnlyRunner({
      readPort,
      request,
      validation: validateQueueWorkflowRequest(request),
    });

    expect(result).toMatchObject({
      blockers: expect.arrayContaining([
        expect.objectContaining({
          reasonCode: "read_only_runner_requires_existing_tasks",
        }),
        expect.objectContaining({
          fieldPath: "$.inputs.taskIdsBySlot.upstream",
          reasonCode: "missing_explicit_task_ids",
        }),
        expect.objectContaining({
          fieldPath: "$.inputs.taskIdsBySlot.downstream",
          reasonCode: "missing_explicit_task_ids",
        }),
      ]),
      report: {
        mutationSummary: expect.objectContaining({
          didMutateQueue: false,
          didStartWorker: false,
        }),
        readOnly: true,
      },
      status: "paused",
      workflowId: "dependency_acceptance_smoke",
    });
    expect(readPort.calls).toEqual([]);
  });

  it("pauses dependency_failure_smoke without explicit task ids and performs no reads", async () => {
    const readPort = fakeReadPort();
    const request = workflowRequest({
      grant: validGrant("queue_failure_smoke"),
      inputs: {
        ...validInputs(),
        failureReason: "Simulated failure for read-only workflow runner smoke.",
      },
      workflowId: "dependency_failure_smoke",
    });

    const result = await runQueueWorkflowReadOnlyRunner({
      readPort,
      request,
      validation: validateQueueWorkflowRequest(request),
    });

    expect(result.status).toBe("paused");
    expect(result.blockers).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          reasonCode: "read_only_runner_requires_existing_tasks",
        }),
      ]),
    );
    expect(readPort.calls).toEqual([]);
  });

  it("reads explicit scoped task ids without assigning dependency slots by order", async () => {
    const readPort = fakeReadPort({
      aggregates: {
        "task-downstream": aggregate({
          taskId: "task-downstream",
          title: "Downstream title",
        }),
        "task-upstream": aggregate({
          taskId: "task-upstream",
          title: "Upstream title",
        }),
      },
    });
    const request = workflowRequest({
      grant: {
        ...validGrant("queue_acceptance_smoke"),
        scope: {
          taskIds: ["task-downstream", "task-upstream"],
        },
      },
    });

    const result = await runQueueWorkflowReadOnlyRunner({
      readPort,
      request,
      validation: validateQueueWorkflowRequest(request),
    });

    expect(result.status).toBe("paused");
    expect(result.variables.taskIdsBySlot).toEqual({});
    expect(result.variables.scopedTaskIds).toEqual([
      "task-downstream",
      "task-upstream",
    ]);
    expect(result.blockers).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          fieldPath: "$.inputs.taskIdsBySlot.upstream",
          reasonCode: "missing_explicit_task_ids",
        }),
        expect.objectContaining({
          fieldPath: "$.inputs.taskIdsBySlot.downstream",
          reasonCode: "missing_explicit_task_ids",
        }),
      ]),
    );
    expect(readPort.calls).toEqual([
      { method: "getQueueItemAggregate", taskId: "task-downstream" },
      { method: "getLifecycle", taskId: "task-downstream" },
      { method: "getQueueItemAggregate", taskId: "task-upstream" },
      { method: "getLifecycle", taskId: "task-upstream" },
    ]);
  });

  it("completes read-only dependency inspection when slot task ids are explicit", async () => {
    const readPort = fakeReadPort({
      aggregates: {
        "task-downstream": aggregate({
          dependencyState: "waiting",
          taskId: "task-downstream",
        }),
        "task-upstream": aggregate({
          dependencyState: "none",
          taskId: "task-upstream",
        }),
      },
    });
    const request = workflowRequest({
      inputs: {
        ...validInputs(),
        taskIdsBySlot: {
          downstream: "task-downstream",
          upstream: "task-upstream",
        },
      },
    });

    const result = await runQueueWorkflowReadOnlyRunner({
      readPort,
      request,
      validation: validateQueueWorkflowRequest(request),
    });

    expect(result.status).toBe("completed");
    expect(result.variables.readSnapshots.aggregatesByTaskId).toMatchObject({
      "task-downstream": {
        dependencyState: "waiting",
        taskId: "task-downstream",
      },
      "task-upstream": {
        dependencyState: "none",
        taskId: "task-upstream",
      },
    });
    expect(result.report.nextMutatingPhase).toContain(
      "only inspect Queue state or mutate review message/ACK ledger",
    );
    expect(result.report.mutationSummary).toEqual(
      expect.objectContaining({
        didAckReview: false,
        didCreateReviewMessage: false,
        didFail: false,
        didFollowUp: false,
        didLaunchTerminal: false,
        didMarkDone: false,
        didMutateGit: false,
        didMutateQueue: false,
        didRollback: false,
        didStartWorker: false,
        didValidate: false,
      }),
    );
  });

  it("reads evidence only when explicit task and run or evidence ids are supplied", async () => {
    const readPort = fakeReadPort({
      aggregates: {
        "task-downstream": aggregate({ taskId: "task-downstream" }),
        "task-upstream": aggregate({ taskId: "task-upstream" }),
      },
      evidence: {
        "task-upstream|run-upstream|bundle-upstream": evidenceQuery({
          bundleId: "bundle-upstream",
          runId: "run-upstream",
          taskId: "task-upstream",
        }),
      },
    });
    const request = workflowRequest({
      inputs: {
        ...validInputs(),
        evidenceReads: [
          { taskId: "task-upstream" },
          {
            evidenceBundleId: "bundle-upstream",
            runId: "run-upstream",
            taskId: "task-upstream",
          },
        ],
        taskIdsBySlot: {
          downstream: "task-downstream",
          upstream: "task-upstream",
        },
      },
    });

    const result = await runQueueWorkflowReadOnlyRunner({
      readPort,
      request,
      validation: validateQueueWorkflowRequest(request),
    });

    expect(result.status).toBe("paused");
    expect(result.blockers).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          reasonCode: "missing_explicit_evidence_ids",
          taskId: "task-upstream",
        }),
      ]),
    );
    expect(readPort.calls).toEqual(
      expect.arrayContaining([
        {
          evidenceBundleId: "bundle-upstream",
          method: "getEvidenceBundle",
          runId: "run-upstream",
          taskId: "task-upstream",
        },
      ]),
    );
    expect(
      readPort.calls.filter((call) => call.method === "getEvidenceBundle"),
    ).toHaveLength(1);
  });

  it("returns validation-deferred for review_acceptance without Queue reads", async () => {
    const readPort = fakeReadPort();
    const request = workflowRequest({
      grant: validGrant("queue_acceptance_smoke"),
      workflowId: "review_acceptance",
    });

    const result = await runQueueWorkflowReadOnlyRunner({
      readPort,
      request,
      validation: validateQueueWorkflowRequest(request),
    });

    expect(result.status).toBe("paused");
    expect(result.blockers).toEqual([
      expect.objectContaining({
        reasonCode: "input_validation_deferred",
      }),
    ]);
    expect(readPort.calls).toEqual([]);
  });

  it("returns validation-deferred for terminal_failure without Queue reads", async () => {
    const readPort = fakeReadPort();
    const request = workflowRequest({
      grant: validGrant("queue_failure_smoke"),
      workflowId: "terminal_failure",
    });

    const result = await runQueueWorkflowReadOnlyRunner({
      readPort,
      request,
      validation: validateQueueWorkflowRequest(request),
    });

    expect(result.status).toBe("paused");
    expect(result.blockers).toEqual([
      expect.objectContaining({
        reasonCode: "input_validation_deferred",
      }),
    ]);
    expect(readPort.calls).toEqual([]);
  });

  it("does not infer task ids from task title, prompt prose, or task order", async () => {
    const readPort = fakeReadPort({
      aggregates: {
        "task-downstream": aggregate({ taskId: "task-downstream" }),
        "task-upstream": aggregate({ taskId: "task-upstream" }),
      },
    });
    const request = workflowRequest({
      inputs: {
        ...validInputs(),
        tasks: [
          {
            prompt:
              "The explicit-looking prose mentions task-upstream, but it is not workflow input.",
            slot: "upstream",
            title: "task-upstream",
          },
          {
            dependsOnSlots: ["upstream"],
            prompt: "The second task title mentions task-downstream.",
            slot: "downstream",
            title: "task-downstream",
          },
        ],
      },
    });

    const result = await runQueueWorkflowReadOnlyRunner({
      readPort,
      request,
      validation: validateQueueWorkflowRequest(request),
    });

    expect(result.status).toBe("paused");
    expect(result.variables.taskIdsBySlot).toEqual({});
    expect(readPort.calls).toEqual([]);
  });

  it("uses only read port methods and never calls mutating methods present on the fake object", async () => {
    let mutatingCalls = 0;
    const readPort = {
      ...fakeReadPort({
        aggregates: {
          "task-downstream": aggregate({ taskId: "task-downstream" }),
          "task-upstream": aggregate({ taskId: "task-upstream" }),
        },
      }),
      failItem: () => {
        mutatingCalls += 1;
        throw new Error("mutating failItem must not be called");
      },
      markItemDone: () => {
        mutatingCalls += 1;
        throw new Error("mutating markItemDone must not be called");
      },
      recordWorkerFinished: () => {
        mutatingCalls += 1;
        throw new Error("mutating recordWorkerFinished must not be called");
      },
    };
    const request = workflowRequest({
      inputs: {
        ...validInputs(),
        taskIdsBySlot: {
          downstream: "task-downstream",
          upstream: "task-upstream",
        },
      },
    });

    const result = await runQueueWorkflowReadOnlyRunner({
      readPort,
      request,
      validation: validateQueueWorkflowRequest(request),
    });

    expect(result.status).toBe("completed");
    expect(mutatingCalls).toBe(0);
    expect(readPort.calls.map((call) => call.method)).toEqual([
      "getQueueItemAggregate",
      "getLifecycle",
      "getQueueItemAggregate",
      "getLifecycle",
    ]);
  });

  it("runs review phase for dependency_acceptance_smoke with explicit upstream taskId and runId", async () => {
    let finalizationCalls = 0;
    const readPort = fakeReadPort({
      aggregates: {
        "task-downstream": aggregate({ taskId: "task-downstream" }),
        "task-upstream": aggregate({ taskId: "task-upstream" }),
      },
      evidence: {
        "task-upstream|run-upstream|": evidenceQuery({
          bundleId: "bundle-upstream",
          runId: "run-upstream",
          taskId: "task-upstream",
        }),
      },
    });
    const reviewPort = {
      ...fakeReviewPort({
        ackResult: { status: "succeeded" },
        createResult: {
          evidenceBundleId: "bundle-upstream",
          messageId: "message-upstream",
          runId: "run-upstream",
          status: "succeeded",
        },
      }),
      failItem: () => {
        finalizationCalls += 1;
        throw new Error("failItem must not be called");
      },
      markItemDone: () => {
        finalizationCalls += 1;
        throw new Error("markItemDone must not be called");
      },
      startRun: () => {
        finalizationCalls += 1;
        throw new Error("startRun must not be called");
      },
    };
    const request = workflowRequest({
      inputs: {
        ...validInputs(),
        runIdsBySlot: {
          upstream: "run-upstream",
        },
        taskIdsBySlot: {
          downstream: "task-downstream",
          upstream: "task-upstream",
        },
      },
    });

    const result = await runQueueWorkflowReviewRunner({
      readPort,
      request,
      reviewPort,
      validation: validateQueueWorkflowRequest(request),
    });

    expect(result.status).toBe("review_acknowledged");
    expect(result.variables.evidenceBundleIdsBySlot.upstream).toBe(
      "bundle-upstream",
    );
    expect(result.variables.messageIdsBySlot.upstream).toBe("message-upstream");
    expect(result.report).toMatchObject({
      mutationSummary: {
        didAckReview: true,
        didBlock: false,
        didCreateReviewMessage: true,
        didFail: false,
        didFollowUp: false,
        didLaunchTerminal: false,
        didMarkDone: false,
        didMutateGit: false,
        didMutateQueue: true,
        didRollback: false,
        didStartWorker: false,
        didValidate: false,
      },
      readOnly: false,
      review: {
        ackStatus: "succeeded",
        createStatus: "succeeded",
        evidenceBundleId: "bundle-upstream",
        messageId: "message-upstream",
        runId: "run-upstream",
        status: "review_acknowledged",
        targetSlot: "upstream",
        taskId: "task-upstream",
      },
    });
    expect(readPort.calls).toEqual([
      { method: "getQueueItemAggregate", taskId: "task-upstream" },
      { method: "getLifecycle", taskId: "task-upstream" },
      {
        method: "getEvidenceBundle",
        runId: "run-upstream",
        taskId: "task-upstream",
      },
    ]);
    expect(reviewPort.calls).toEqual([
      {
        evidenceBundleId: "bundle-upstream",
        method: "createReviewMessage",
        runId: "run-upstream",
        taskId: "task-upstream",
      },
      {
        messageId: "message-upstream",
        method: "ackReviewMessage",
        taskId: "task-upstream",
      },
    ]);
    expect(finalizationCalls).toBe(0);
  });

  it("treats already-existing review message and already-done ACK as idempotent", async () => {
    const readPort = fakeReadPort({
      aggregates: {
        "task-downstream": aggregate({ taskId: "task-downstream" }),
        "task-upstream": aggregate({ taskId: "task-upstream" }),
      },
      evidence: {
        "task-upstream|run-upstream|": evidenceQuery({
          bundleId: "bundle-upstream",
          runId: "run-upstream",
          taskId: "task-upstream",
        }),
      },
    });
    const reviewPort = fakeReviewPort({
      ackResult: { status: "already_done" },
      createResult: {
        existingMessageId: "message-existing",
        status: "already_exists",
      },
    });
    const request = workflowRequest({
      inputs: {
        ...validInputs(),
        runIdsBySlot: {
          upstream: "run-upstream",
        },
        taskIdsBySlot: {
          downstream: "task-downstream",
          upstream: "task-upstream",
        },
      },
    });

    const result = await runQueueWorkflowReviewRunner({
      readPort,
      request,
      reviewPort,
      validation: validateQueueWorkflowRequest(request),
    });

    expect(result.status).toBe("review_acknowledged");
    expect(result.blockers).toEqual([]);
    expect(result.report.mutationSummary).toEqual(
      expect.objectContaining({
        didAckReview: false,
        didCreateReviewMessage: false,
        didMutateQueue: false,
      }),
    );
    expect(result.report.review).toMatchObject({
      ackStatus: "already_done",
      createStatus: "already_exists",
      idempotentAck: true,
      idempotentCreate: true,
      messageId: "message-existing",
      status: "review_acknowledged",
    });
    expect(reviewPort.calls).toEqual([
      {
        evidenceBundleId: "bundle-upstream",
        method: "createReviewMessage",
        runId: "run-upstream",
        taskId: "task-upstream",
      },
      {
        messageId: "message-existing",
        method: "ackReviewMessage",
        taskId: "task-upstream",
      },
    ]);
  });

  it("supports review_acceptance minimally from explicit deferred-validation typed inputs", async () => {
    const readPort = fakeReadPort({
      aggregates: {
        "task-review": aggregate({ taskId: "task-review" }),
      },
      evidence: {
        "task-review|run-review|": evidenceQuery({
          bundleId: "bundle-review",
          runId: "run-review",
          taskId: "task-review",
        }),
      },
    });
    const reviewPort = fakeReviewPort({
      ackResult: { status: "succeeded" },
      createResult: {
        evidenceBundleId: "bundle-review",
        messageId: "message-review",
        runId: "run-review",
        status: "succeeded",
      },
    });
    const request = workflowRequest({
      grant: validGrant("queue_operator_flow"),
      inputs: {
        runId: "run-review",
        taskId: "task-review",
      },
      workflowId: "review_acceptance",
    });

    const result = await runQueueWorkflowReviewRunner({
      readPort,
      request,
      reviewPort,
      validation: validateQueueWorkflowRequest(request),
    });

    expect(result.status).toBe("review_acknowledged");
    expect(result.report.review).toMatchObject({
      evidenceBundleId: "bundle-review",
      messageId: "message-review",
      status: "review_acknowledged",
      targetSlot: "review",
      taskId: "task-review",
    });
  });

  it("does not support terminal_failure finalization in the review runner", async () => {
    const readPort = fakeReadPort();
    const reviewPort = fakeReviewPort();
    const request = workflowRequest({
      grant: validGrant("queue_failure_smoke"),
      workflowId: "terminal_failure",
    });

    const result = await runQueueWorkflowReviewRunner({
      readPort,
      request,
      reviewPort,
      validation: validateQueueWorkflowRequest(request),
    });

    expect(result.status).toBe("review_not_supported_for_workflow");
    expect(readPort.calls).toEqual([]);
    expect(reviewPort.calls).toEqual([]);
  });

  it("blocks review phase when upstream taskId is missing and does not assign scoped ids by order", async () => {
    const readPort = fakeReadPort({
      aggregates: {
        "task-downstream": aggregate({ taskId: "task-downstream" }),
        "task-upstream": aggregate({ taskId: "task-upstream" }),
      },
    });
    const reviewPort = fakeReviewPort();
    const request = workflowRequest({
      grant: {
        ...validGrant("queue_acceptance_smoke"),
        scope: {
          taskIds: ["task-downstream", "task-upstream"],
        },
      },
      inputs: validInputs(),
    });

    const result = await runQueueWorkflowReviewRunner({
      readPort,
      request,
      reviewPort,
      validation: validateQueueWorkflowRequest(request),
    });

    expect(result.status).toBe("review_blocked_missing_task_or_run");
    expect(result.blockers).toEqual([
      expect.objectContaining({
        fieldPath: "$.inputs.taskIdsBySlot.upstream",
        reasonCode: "review_blocked_missing_task_or_run",
      }),
    ]);
    expect(result.variables.taskIdsBySlot).toEqual({});
    expect(readPort.calls).toEqual([]);
    expect(reviewPort.calls).toEqual([]);
  });

  it("blocks review phase when upstream runId and evidenceBundleId are missing", async () => {
    const readPort = fakeReadPort();
    const reviewPort = fakeReviewPort();
    const request = workflowRequest({
      inputs: {
        ...validInputs(),
        taskIdsBySlot: {
          downstream: "task-downstream",
          upstream: "task-upstream",
        },
      },
    });

    const result = await runQueueWorkflowReviewRunner({
      readPort,
      request,
      reviewPort,
      validation: validateQueueWorkflowRequest(request),
    });

    expect(result.status).toBe("review_blocked_missing_task_or_run");
    expect(result.blockers).toEqual([
      expect.objectContaining({
        fieldPath: "$.inputs.runIdsBySlot.upstream",
        reasonCode: "review_blocked_missing_task_or_run",
        taskId: "task-upstream",
      }),
    ]);
    expect(readPort.calls).toEqual([]);
    expect(reviewPort.calls).toEqual([]);
  });

  it("does not infer review task ids from title, prompt prose, or task order", async () => {
    const readPort = fakeReadPort();
    const reviewPort = fakeReviewPort();
    const request = workflowRequest({
      inputs: {
        ...validInputs(),
        runIdsBySlot: {
          upstream: "run-upstream",
        },
        tasks: [
          {
            prompt: "The prose mentions task-upstream but is not typed input.",
            slot: "upstream",
            title: "task-upstream",
          },
          {
            dependsOnSlots: ["upstream"],
            prompt: "The second item mentions task-downstream.",
            slot: "downstream",
            title: "task-downstream",
          },
        ],
      },
    });

    const result = await runQueueWorkflowReviewRunner({
      readPort,
      request,
      reviewPort,
      validation: validateQueueWorkflowRequest(request),
    });

    expect(result.status).toBe("review_blocked_missing_task_or_run");
    expect(result.variables.taskIdsBySlot).toEqual({});
    expect(readPort.calls).toEqual([]);
    expect(reviewPort.calls).toEqual([]);
  });

  it("blocks review create when evidence cannot be resolved", async () => {
    const readPort = fakeReadPort({
      aggregates: {
        "task-upstream": aggregate({ taskId: "task-upstream" }),
      },
    });
    const reviewPort = fakeReviewPort();
    const request = workflowRequest({
      inputs: {
        ...validInputs(),
        runIdsBySlot: {
          upstream: "run-upstream",
        },
        taskIdsBySlot: {
          downstream: "task-downstream",
          upstream: "task-upstream",
        },
      },
    });

    const result = await runQueueWorkflowReviewRunner({
      readPort,
      request,
      reviewPort,
      validation: validateQueueWorkflowRequest(request),
    });

    expect(result.status).toBe("review_blocked_missing_evidence");
    expect(result.blockers).toEqual([
      expect.objectContaining({
        reasonCode: "review_blocked_missing_evidence",
        taskId: "task-upstream",
      }),
    ]);
    expect(reviewPort.calls).toEqual([]);
  });

  it("blocks and does not ACK when review create returns a precondition failure", async () => {
    const readPort = fakeReadPort({
      aggregates: {
        "task-upstream": aggregate({ taskId: "task-upstream" }),
      },
      evidence: {
        "task-upstream|run-upstream|": evidenceQuery({
          bundleId: "bundle-upstream",
          runId: "run-upstream",
          taskId: "task-upstream",
        }),
      },
    });
    const reviewPort = fakeReviewPort({
      createResult: {
        message: "Durable worker evidence is required.",
        status: "precondition_failed",
      },
    });
    const request = workflowRequest({
      inputs: {
        ...validInputs(),
        runIdsBySlot: {
          upstream: "run-upstream",
        },
        taskIdsBySlot: {
          downstream: "task-downstream",
          upstream: "task-upstream",
        },
      },
    });

    const result = await runQueueWorkflowReviewRunner({
      readPort,
      request,
      reviewPort,
      validation: validateQueueWorkflowRequest(request),
    });

    expect(result.status).toBe("blocked");
    expect(result.blockers).toEqual([
      expect.objectContaining({
        message: "Durable worker evidence is required.",
        reasonCode: "review_create_blocked",
      }),
    ]);
    expect(reviewPort.calls.map((call) => call.method)).toEqual([
      "createReviewMessage",
    ]);
  });

  it("blocks ACK invalid input after create without finalizing", async () => {
    const readPort = fakeReadPort({
      aggregates: {
        "task-upstream": aggregate({ taskId: "task-upstream" }),
      },
      evidence: {
        "task-upstream|run-upstream|": evidenceQuery({
          bundleId: "bundle-upstream",
          runId: "run-upstream",
          taskId: "task-upstream",
        }),
      },
    });
    const reviewPort = fakeReviewPort({
      ackResult: {
        message: "messageId is invalid.",
        status: "invalid_input",
      },
      createResult: {
        messageId: "message-upstream",
        status: "succeeded",
      },
    });
    const request = workflowRequest({
      inputs: {
        ...validInputs(),
        runIdsBySlot: {
          upstream: "run-upstream",
        },
        taskIdsBySlot: {
          downstream: "task-downstream",
          upstream: "task-upstream",
        },
      },
    });

    const result = await runQueueWorkflowReviewRunner({
      readPort,
      request,
      reviewPort,
      validation: validateQueueWorkflowRequest(request),
    });

    expect(result.status).toBe("blocked");
    expect(result.blockers).toEqual([
      expect.objectContaining({
        message: "messageId is invalid.",
        reasonCode: "review_ack_invalid_input",
      }),
    ]);
    expect(result.report.mutationSummary).toEqual(
      expect.objectContaining({
        didAckReview: false,
        didCreateReviewMessage: true,
        didFail: false,
        didMarkDone: false,
        didStartWorker: false,
      }),
    );
  });

  it("maps unexpected review port errors to failed_unexpected", async () => {
    const readPort = fakeReadPort({
      aggregates: {
        "task-upstream": aggregate({ taskId: "task-upstream" }),
      },
      evidence: {
        "task-upstream|run-upstream|": evidenceQuery({
          bundleId: "bundle-upstream",
          runId: "run-upstream",
          taskId: "task-upstream",
        }),
      },
    });
    const reviewPort = fakeReviewPort({
      createError: new Error("backend review command unavailable"),
    });
    const request = workflowRequest({
      inputs: {
        ...validInputs(),
        runIdsBySlot: {
          upstream: "run-upstream",
        },
        taskIdsBySlot: {
          downstream: "task-downstream",
          upstream: "task-upstream",
        },
      },
    });

    const result = await runQueueWorkflowReviewRunner({
      readPort,
      request,
      reviewPort,
      validation: validateQueueWorkflowRequest(request),
    });

    expect(result.status).toBe("failed_unexpected");
    expect(result.blockers).toEqual([
      expect.objectContaining({
        message: "backend review command unavailable",
        reasonCode: "failed_unexpected",
      }),
    ]);
  });

  it("does not import Queue UI, visual shell, providers, Tauri, or WorkerProvider", () => {
    expect(runnerSource).not.toContain("@tauri-apps");
    expect(runnerSource).not.toContain("AgentProvider");
    expect(runnerSource).not.toContain("WorkerProvider");
    expect(runnerSource).not.toContain("AgentQueueV2Board");
    expect(runnerSource).not.toContain("AgentQueuePlaceholderWidget");
    expect(runnerSource).not.toContain("ModuleShell");
    expect(runnerSource).not.toContain("reviewMessageId");
    expect(runnerSource).not.toContain("widget.css");
    expect(runnerSource).not.toContain("queueV2");
  });
});

function workflowRequest(
  overrides: Partial<QueueWorkflowRunnerRequest> = {},
): QueueWorkflowRunnerRequest {
  return {
    grant: validGrant("queue_acceptance_smoke"),
    inputs: validInputs(),
    moduleId: "queue",
    requestId: "workflow-request-1",
    workflowId: "dependency_acceptance_smoke",
    ...overrides,
  };
}

function validGrant(mode: string) {
  return {
    constraints: {
      noDelete: true,
      noDownstreamAutoStart: true,
      noGit: true,
      noRollback: true,
      noTerminal: true,
      noValidationExecution: true,
    },
    maxActions: 16,
    mode,
  };
}

function validInputs() {
  return {
    runSettings: {
      approvalPolicy: "never",
      codexExecutable: "codex.cmd",
      sandbox: "read_only",
      workspaceRoot: "C:/work/hobit",
    },
    tasks: validTasks(),
  };
}

function validTasks() {
  return [
    {
      prompt: "Read-only upstream smoke task.",
      slot: "upstream",
      title: "Upstream task",
    },
    {
      dependsOnSlots: ["upstream"],
      prompt: "Read-only downstream smoke task.",
      slot: "downstream",
      title: "Downstream task",
    },
  ];
}

type FakeReadPort = QueueWorkflowReadPort & {
  calls: Array<
    | { method: "getLifecycle"; taskId: string }
    | { method: "getQueueItemAggregate"; taskId: string }
    | {
        evidenceBundleId?: string;
        method: "getEvidenceBundle";
        runId?: string;
        taskId: string;
      }
    | { method: "listQueueItemAggregates" }
  >;
};

type FakeReviewPort = QueueWorkflowReviewPort & {
  calls: Array<
    | ({
        method: "ackReviewMessage";
      } & QueueWorkflowAckReviewMessageRequest)
    | ({
        method: "createReviewMessage";
      } & QueueWorkflowCreateReviewMessageRequest)
  >;
};

function fakeReadPort({
  aggregates = {},
  evidence = {},
}: {
  aggregates?: Record<string, AgentQueueItemAggregate>;
  evidence?: Record<string, AgentQueueWorkerEvidenceQueryResult>;
} = {}): FakeReadPort {
  const calls: FakeReadPort["calls"] = [];
  return {
    calls,
    getEvidenceBundle: async (request) => {
      calls.push({
        ...(request.evidenceBundleId
          ? { evidenceBundleId: request.evidenceBundleId }
          : {}),
        method: "getEvidenceBundle",
        ...(request.runId ? { runId: request.runId } : {}),
        taskId: request.taskId,
      });
      return evidence[evidenceKey(request)] ?? null;
    },
    getLifecycle: async (taskId) => {
      calls.push({ method: "getLifecycle", taskId });
      return aggregates[taskId] ?? null;
    },
    getQueueItemAggregate: async (taskId) => {
      calls.push({ method: "getQueueItemAggregate", taskId });
      return aggregates[taskId] ?? null;
    },
    listQueueItemAggregates: async () => {
      calls.push({ method: "listQueueItemAggregates" });
      return Object.values(aggregates);
    },
  };
}

function fakeReviewPort({
  ackResult = { status: "succeeded" },
  createError,
  createResult = { messageId: "review-message-1", status: "succeeded" },
}: {
  ackResult?: QueueWorkflowAckReviewMessageResult;
  createError?: Error;
  createResult?: QueueWorkflowCreateReviewMessageResult;
} = {}): FakeReviewPort {
  const calls: FakeReviewPort["calls"] = [];
  return {
    calls,
    ackReviewMessage: async (request) => {
      calls.push({
        method: "ackReviewMessage",
        ...request,
      });
      return {
        messageId: request.messageId,
        taskId: request.taskId,
        ...ackResult,
      };
    },
    createReviewMessage: async (request) => {
      calls.push({
        method: "createReviewMessage",
        ...request,
      });
      if (createError) {
        throw createError;
      }
      return {
        evidenceBundleId: request.evidenceBundleId,
        runId: request.runId,
        taskId: request.taskId,
        ...createResult,
      };
    },
  };
}

function evidenceKey(request: QueueWorkflowEvidenceReadRequest): string {
  return [
    request.taskId,
    request.runId ?? "",
    request.evidenceBundleId ?? "",
  ].join("|");
}

function aggregate({
  dependencyState = "none",
  taskId,
  title = "Queue task",
}: {
  dependencyState?: string;
  taskId: string;
  title?: string;
}): AgentQueueItemAggregate {
  return {
    blockers: [],
    commitState: "none",
    dependencyState,
    durableFlags: {
      commitState: false,
      completionState: false,
      dependencyState: true,
      evidenceState: false,
      failureState: false,
      frontendOverlayUsed: false,
      latestRunLink: false,
      reviewState: false,
      taskRow: true,
      validationState: false,
    },
    evidenceState: "none",
    evidenceSummary: null,
    latestRun: null,
    nextActions: [],
    reviewState: "none",
    runSettings: {
      approvalPolicy: "never",
      assignedExecutorWidgetId: null,
      codexExecutable: "codex.cmd",
      executionPolicy: "manual",
      executionWorkspace: "C:/work/hobit",
      sandbox: "read_only",
    },
    taskId,
    ticketState: "queued",
    title,
    updatedAt: "2026-06-22T00:00:00.000Z",
    validationState: "not_requested",
    workerRunState: "not_started",
    workspaceId: "workspace-1",
  };
}

function evidenceQuery({
  bundleId,
  runId,
  taskId,
}: {
  bundleId: string;
  runId: string;
  taskId: string;
}): AgentQueueWorkerEvidenceQueryResult {
  return {
    aggregate: aggregate({ taskId }),
    durable: true,
    evidenceBundle: {
      bundleId,
      changedFiles: [],
      changedFilesCount: 0,
      changedFilesSummary: null,
      createdAt: "2026-06-22T00:00:00.000Z",
      errorSummary: null,
      executorWidgetId: "executor-1",
      metadataJson: null,
      outcome: "completed",
      runId,
      runLinkId: "run-link-1",
      source: "test",
      summary: "Worker evidence available.",
      taskId,
      updatedAt: "2026-06-22T00:00:00.000Z",
      validationSummary: null,
      workerId: "worker-1",
      workspaceId: "workspace-1",
    },
    runId,
    state: "available",
    taskId,
    workspaceId: "workspace-1",
  };
}
