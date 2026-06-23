import runnerSource from "./queueWorkflowRunner.ts?raw";

import { describe, expect, it } from "vitest";

import type {
  AgentQueueItemAggregate,
  AgentQueueWorkerEvidenceQueryResult,
} from "../../../workspace/types";
import type {
  QueueWorkflowEvidenceReadRequest,
  QueueWorkflowFailItemRequest,
  QueueWorkflowFinalizationCommandResult,
  QueueWorkflowFinalizationPort,
  QueueWorkflowMarkDoneRequest,
  QueueWorkflowReadPort,
  QueueWorkflowReviewPort,
  QueueWorkflowAckReviewMessageRequest,
  QueueWorkflowAckReviewMessageResult,
  QueueWorkflowCreateReviewMessageRequest,
  QueueWorkflowCreateReviewMessageResult,
  QueueWorkflowCreateSetupStartPort,
  QueueWorkflowRecordWorkerEvidenceRequest,
  QueueWorkflowRunnerRequest,
  QueueWorkflowWorkerEvidencePort,
} from "./queueWorkflowRunner";
import {
  runQueueWorkflowCreateSetupStartRunner,
  runQueueWorkflowFinalizationRunner,
  runQueueWorkflowReadOnlyRunner,
  runQueueWorkflowReviewRunner,
  runQueueWorkflowWorkerEvidenceRunner,
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
      "Create/setup/start can materialize dependency slots",
    );
    expect(result.report.nextMutatingPhase).toContain(
      "evidence, review, and accepted-completion finalization remain separate typed phases",
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

  it("runs create/setup/start and pauses awaiting worker completion", async () => {
    const port = fakeCreateSetupStartPort();
    const request = workflowRequest({
      grant: validGrant("queue_acceptance_smoke", {
        confirmationToken: "operator-confirmed",
      }),
    });

    const result = await runQueueWorkflowCreateSetupStartRunner({
      createSetupStartPort: port,
      request,
      validation: validateQueueWorkflowRequest(request),
      workflowRunId: "queue-workflow-run-1",
    });

    expect(result.status).toBe("awaiting_worker_completion");
    expect(result.variables.taskIdsBySlot).toMatchObject({
      downstream: "task-downstream",
      upstream: "task-upstream",
    });
    expect(result.variables.runIdsBySlot).toMatchObject({
      upstream: "run-upstream",
    });
    expect(result.report.createSetupStart).toMatchObject({
      downstreamTaskId: "task-downstream",
      materializedSlots: {
        downstream: {
          dependencyTaskIds: ["task-upstream"],
          dependsOnSlots: ["upstream"],
          status: "created",
          taskId: "task-downstream",
        },
        upstream: {
          dependsOnSlots: [],
          status: "created",
          taskId: "task-upstream",
        },
      },
      promote: {
        status: "promoted",
        taskId: "task-upstream",
      },
      queueControl: {
        status: "manual_enabled",
        version: 7,
      },
      runSettings: {
        executorWidgetId: "executor-widget-1",
        settingsHash: "settings-hash-upstream",
        status: "applied",
        taskId: "task-upstream",
      },
      start: {
        runId: "run-upstream",
        status: "started",
        taskId: "task-upstream",
      },
      upstreamTaskId: "task-upstream",
      workflowRunId: "queue-workflow-run-1",
    });
    expect(result.report.mutationSummary).toEqual(
      expect.objectContaining({
        didAckReview: false,
        didCreateReviewMessage: false,
        didFail: false,
        didMarkDone: false,
        didMutateGit: false,
        didMutateQueue: true,
        didRollback: false,
        didStartWorker: true,
        didValidate: false,
      }),
    );
    expect(result.report.evidenceReads).toEqual([]);
    expect(result.report.review.status).toBeNull();
    expect(result.report.finalization.status).toBeNull();
    expect(port.calls).toEqual([
      expect.objectContaining({
        method: "materializeTaskSlot",
        slot: "upstream",
      }),
      expect.objectContaining({
        dependsOnSlots: ["upstream"],
        method: "materializeTaskSlot",
        slot: "downstream",
      }),
      expect.objectContaining({
        method: "applyRunSettings",
        slot: "upstream",
        taskId: "task-upstream",
      }),
      expect.objectContaining({
        method: "promoteTaskSlot",
        slot: "upstream",
        taskId: "task-upstream",
      }),
      { method: "getQueueControlState" },
      expect.objectContaining({
        method: "startWorkerForSlot",
        queueItemId: "task-upstream",
        workflowStartContext: expect.objectContaining({
          actionIdempotencyKey:
            "queue-workflow-run-1:start_worker:task-upstream:executor-widget-1:settings-hash-upstream",
          confirmationToken: "operator-confirmed",
          expectedQueueControlVersion: 7,
          executorWidgetId: "executor-widget-1",
          settingsHash: "settings-hash-upstream",
          taskId: "task-upstream",
          workflowRunId: "queue-workflow-run-1",
        }),
      }),
    ]);
  });

  it("records worker evidence for explicit upstream task and run then stops before review", async () => {
    const port = fakeWorkerEvidencePort();
    const request = workerEvidenceWorkflowRequest();

    const result = await runQueueWorkflowWorkerEvidenceRunner({
      request,
      validation: validateQueueWorkflowRequest(request),
      workerEvidencePort: port,
      workflowRunId: "queue-workflow-run-1",
    });

    expect(result.status).toBe("awaiting_review");
    expect(result.variables.taskIdsBySlot.upstream).toBe("task-upstream");
    expect(result.variables.runIdsBySlot.upstream).toBe("run-upstream");
    expect(result.variables.evidenceBundleIdsBySlot.upstream).toBe(
      "evidence-bundle-1",
    );
    expect(result.report.workerEvidence).toMatchObject({
      commandStatus: "recorded",
      evidenceBundleId: "evidence-bundle-1",
      idempotent: false,
      runId: "run-upstream",
      status: "evidence_recorded",
      targetSlot: "upstream",
      taskId: "task-upstream",
    });
    expect(result.report.mutationSummary).toEqual(
      expect.objectContaining({
        didAckReview: false,
        didCreateReviewMessage: false,
        didFail: false,
        didMarkDone: false,
        didStartWorker: false,
        didValidate: false,
      }),
    );
    expect(port.calls).toEqual([
      expect.objectContaining({
        method: "recordWorkerEvidenceForSlot",
        outcome: "completed",
        runId: "run-upstream",
        slot: "upstream",
        taskId: "task-upstream",
        workflowRunId: "queue-workflow-run-1",
      }),
    ]);
  });

  it("completes the dependency_acceptance_smoke path across typed durable phases", async () => {
    const createPort = fakeCreateSetupStartPort();
    const createRequest = workflowRequest({
      grant: validGrant("queue_acceptance_smoke", {
        confirmationToken: "operator-confirmed",
      }),
    });
    const create = await runQueueWorkflowCreateSetupStartRunner({
      createSetupStartPort: createPort,
      request: createRequest,
      validation: validateQueueWorkflowRequest(createRequest),
      workflowRunId: "queue-workflow-run-1",
    });

    const evidencePort = fakeWorkerEvidencePort();
    const evidenceRequest = workerEvidenceWorkflowRequest({
      inputs: {
        phase: "worker_evidence",
        taskIdsBySlot: create.variables.taskIdsBySlot,
        workerEvidence: {
          outcome: "completed",
          runId: create.variables.runIdsBySlot.upstream,
          slot: "upstream",
          summary: "Worker completed.",
          taskId: create.variables.taskIdsBySlot.upstream,
          workflowRunId: "queue-workflow-run-1",
        },
      },
    });
    const evidence = await runQueueWorkflowWorkerEvidenceRunner({
      request: evidenceRequest,
      validation: validateQueueWorkflowRequest(evidenceRequest),
      workerEvidencePort: evidencePort,
      workflowRunId: "queue-workflow-run-1",
    });

    const reviewReadPort = fakeReadPort({
      aggregates: {
        "task-upstream": aggregate({
          reviewState: "awaiting_review",
          taskId: "task-upstream",
          workerRunState: "completed",
        }),
      },
      evidence: {
        "task-upstream|run-upstream|evidence-bundle-1": evidenceQuery({
          bundleId: "evidence-bundle-1",
          runId: "run-upstream",
          taskId: "task-upstream",
        }),
      },
    });
    const reviewPort = fakeReviewPort({
      ackResult: { status: "succeeded" },
      createResult: {
        evidenceBundleId: "evidence-bundle-1",
        messageId: "message-upstream",
        runId: "run-upstream",
        status: "succeeded",
      },
    });
    const reviewRequest = workflowRequest({
      inputs: {
        ...validInputs(),
        evidenceBundleIdsBySlot: evidence.variables.evidenceBundleIdsBySlot,
        runIdsBySlot: evidence.variables.runIdsBySlot,
        taskIdsBySlot: {
          ...create.variables.taskIdsBySlot,
          ...evidence.variables.taskIdsBySlot,
        },
      },
    });
    const review = await runQueueWorkflowReviewRunner({
      readPort: reviewReadPort,
      request: reviewRequest,
      reviewPort,
      validation: validateQueueWorkflowRequest(reviewRequest),
    });

    const finalizationReadPort = fakeReadPort({
      aggregates: {
        "task-downstream": aggregate({
          dependencyState: "ready",
          taskId: "task-downstream",
          workerRunState: "not_started",
        }),
        "task-upstream": aggregate({
          reviewState: "in_review",
          taskId: "task-upstream",
          workerRunState: "completed",
        }),
      },
    });
    const finalizationPort = fakeFinalizationPort({
      markDoneResult: {
        decisionId: "completion-decision-1",
        status: "succeeded",
      },
    });
    const finalizationRequest = workflowRequest({
      grant: validGrant("queue_acceptance_smoke", {
        confirmationToken: "operator-confirmed",
      }),
      inputs: {
        ...validInputs(),
        evidenceBundleIdsBySlot: evidence.variables.evidenceBundleIdsBySlot,
        messageIdsBySlot: review.variables.messageIdsBySlot,
        runIdsBySlot: evidence.variables.runIdsBySlot,
        taskIdsBySlot: {
          ...create.variables.taskIdsBySlot,
          ...evidence.variables.taskIdsBySlot,
        },
      },
    });
    const finalization = await runQueueWorkflowFinalizationRunner({
      finalizationPort,
      readPort: finalizationReadPort,
      request: finalizationRequest,
      validation: validateQueueWorkflowRequest(finalizationRequest),
    });

    expect(create.status).toBe("awaiting_worker_completion");
    expect(evidence.status).toBe("awaiting_review");
    expect(review.status).toBe("review_acknowledged");
    expect(finalization.status).toBe("finalization_completed");
    expect(finalization.report.finalization).toMatchObject({
      decisionId: "completion-decision-1",
      downstreamVerification: {
        dependencyState: "ready",
        dependencyVerified: true,
        notAutoStartedVerified: true,
        workerRunState: "not_started",
      },
      finalizationAction: "mark_done",
      status: "finalization_completed",
    });
    expect(createPort.calls.filter((call) => call.method === "startWorkerForSlot")).toEqual([
      expect.objectContaining({ queueItemId: "task-upstream" }),
    ]);
    expect(finalization.report.mutationSummary).toEqual(
      expect.objectContaining({
        didLaunchTerminal: false,
        didMutateGit: false,
        didRollback: false,
        didStartWorker: false,
        didValidate: false,
      }),
    );
  });

  it("treats existing worker evidence as idempotent success", async () => {
    const port = fakeWorkerEvidencePort({ status: "already_recorded" });
    const request = workerEvidenceWorkflowRequest();

    const result = await runQueueWorkflowWorkerEvidenceRunner({
      request,
      validation: validateQueueWorkflowRequest(request),
      workerEvidencePort: port,
      workflowRunId: "queue-workflow-run-1",
    });

    expect(result.status).toBe("awaiting_review");
    expect(result.report.workerEvidence).toMatchObject({
      commandStatus: "already_recorded",
      idempotent: true,
      status: "evidence_already_recorded",
    });
    expect(result.report.mutationSummary.didMutateQueue).toBe(false);
  });

  it("pauses worker evidence recording without typed completion input", async () => {
    const request = workflowRequest({
      inputs: {
        ...validInputs(),
        phase: "worker_evidence",
      },
    });

    const result = await runQueueWorkflowWorkerEvidenceRunner({
      request,
      validation: validateQueueWorkflowRequest(request),
      workerEvidencePort: fakeWorkerEvidencePort(),
      workflowRunId: "queue-workflow-run-1",
    });

    expect(result.status).toBe("awaiting_worker_completion");
    expect(result.blockers).toEqual([
      expect.objectContaining({
        reasonCode: "worker_evidence_missing_input",
      }),
    ]);
    expect(result.report.mutationSummary.didMutateQueue).toBe(false);
  });

  it("blocks worker evidence conflicts without review or finalization", async () => {
    const port = fakeWorkerEvidencePort({ status: "conflict" });
    const request = workerEvidenceWorkflowRequest();

    const result = await runQueueWorkflowWorkerEvidenceRunner({
      request,
      validation: validateQueueWorkflowRequest(request),
      workerEvidencePort: port,
      workflowRunId: "queue-workflow-run-1",
    });

    expect(result.status).toBe("blocked_evidence_conflict");
    expect(result.report.workerEvidence.status).toBe("blocked_evidence_conflict");
    expect(result.report.mutationSummary).toEqual(
      expect.objectContaining({
        didAckReview: false,
        didCreateReviewMessage: false,
        didFail: false,
        didMarkDone: false,
        didStartWorker: false,
      }),
    );
  });

  it("blocks before worker start when executorWidgetId is missing", async () => {
    const port = fakeCreateSetupStartPort();
    const request = workflowRequest({
      grant: validGrant("queue_acceptance_smoke", {
        confirmationToken: "operator-confirmed",
      }),
      inputs: {
        ...validInputs(),
        runSettings: {
          ...validInputs().runSettings,
          executorWidgetId: "",
        },
      },
    });

    const result = await runQueueWorkflowCreateSetupStartRunner({
      createSetupStartPort: port,
      request,
      validation: validateQueueWorkflowRequest(request),
      workflowRunId: "queue-workflow-run-1",
    });

    expect(result.status).toBe("invalid_request");
    expect(result.blockers).toEqual([
      expect.objectContaining({
        reasonCode: "invalid_request",
      }),
    ]);
    expect(port.calls).toEqual([]);
  });

  it("blocks after setup when backend Queue control is disabled", async () => {
    const port = fakeCreateSetupStartPort({
      queueControlState: { status: "disabled", version: 9 },
    });
    const request = workflowRequest({
      grant: validGrant("queue_acceptance_smoke", {
        confirmationToken: "operator-confirmed",
      }),
    });

    const result = await runQueueWorkflowCreateSetupStartRunner({
      createSetupStartPort: port,
      request,
      validation: validateQueueWorkflowRequest(request),
      workflowRunId: "queue-workflow-run-1",
    });

    expect(result.status).toBe("blocked_queue_control");
    expect(result.blockers).toEqual([
      expect.objectContaining({
        reasonCode: "blocked_queue_control",
        taskId: "task-upstream",
      }),
    ]);
    expect(port.calls.map((call) => call.method)).toEqual([
      "materializeTaskSlot",
      "materializeTaskSlot",
      "applyRunSettings",
      "promoteTaskSlot",
      "getQueueControlState",
    ]);
  });

  it("blocks settings mismatch before promotion or worker start", async () => {
    const port = fakeCreateSetupStartPort({
      applyStatus: "conflict",
    });
    const request = workflowRequest({
      grant: validGrant("queue_acceptance_smoke", {
        confirmationToken: "operator-confirmed",
      }),
    });

    const result = await runQueueWorkflowCreateSetupStartRunner({
      createSetupStartPort: port,
      request,
      validation: validateQueueWorkflowRequest(request),
      workflowRunId: "queue-workflow-run-1",
    });

    expect(result.status).toBe("blocked_setup");
    expect(result.blockers).toEqual([
      expect.objectContaining({
        reasonCode: "blocked_setup",
      }),
    ]);
    expect(port.calls.map((call) => call.method)).toEqual([
      "materializeTaskSlot",
      "materializeTaskSlot",
      "applyRunSettings",
    ]);
  });

  it("treats duplicate create/setup/start as idempotent reuse", async () => {
    const port = fakeCreateSetupStartPort({
      applyStatus: "reused",
      materializeStatus: "reused",
      promoteStatus: "reused",
      startStatus: "already_started",
    });
    const request = workflowRequest({
      grant: validGrant("queue_acceptance_smoke", {
        confirmationToken: "operator-confirmed",
      }),
    });

    const result = await runQueueWorkflowCreateSetupStartRunner({
      createSetupStartPort: port,
      request,
      validation: validateQueueWorkflowRequest(request),
      workflowRunId: "queue-workflow-run-1",
    });

    expect(result.status).toBe("awaiting_worker_completion");
    expect(result.report.createSetupStart.start).toMatchObject({
      runId: "run-upstream",
      status: "already_started",
    });
    expect(result.report.mutationSummary).toEqual(
      expect.objectContaining({
        didMutateQueue: false,
        didStartWorker: false,
      }),
    );
    expect(port.calls.filter((call) => call.method === "startWorkerForSlot")).toHaveLength(1);
  });

  it("returns an orphan worker-start blocker without starting downstream", async () => {
    const port = fakeCreateSetupStartPort({
      startBlockerCode: "orphaned_start",
      startStatus: "blocked",
    });
    const request = workflowRequest({
      grant: validGrant("queue_acceptance_smoke", {
        confirmationToken: "operator-confirmed",
      }),
    });

    const result = await runQueueWorkflowCreateSetupStartRunner({
      createSetupStartPort: port,
      request,
      validation: validateQueueWorkflowRequest(request),
      workflowRunId: "queue-workflow-run-1",
    });

    expect(result.status).toBe("blocked_worker_start");
    expect(result.blockers).toEqual([
      expect.objectContaining({
        reasonCode: "worker_start_orphan",
        taskId: "task-upstream",
      }),
    ]);
    expect(port.calls.filter((call) => call.method === "startWorkerForSlot")).toEqual([
      expect.objectContaining({ queueItemId: "task-upstream" }),
    ]);
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

  it("finalizes dependency_acceptance_smoke by marking explicit upstream done and verifying downstream ready", async () => {
    const readPort = fakeReadPort({
      aggregates: {
        "task-downstream": aggregate({
          dependencyState: "ready",
          taskId: "task-downstream",
          workerRunState: "not_started",
        }),
        "task-upstream": aggregate({
          reviewState: "in_review",
          taskId: "task-upstream",
          workerRunState: "completed",
        }),
      },
    });
    const finalizationPort = fakeFinalizationPort({
      markDoneResult: {
        aggregate: aggregate({
          reviewState: "done",
          taskId: "task-upstream",
          ticketState: "done",
          workerRunState: "completed",
        }),
        status: "succeeded",
      },
    });
    const request = workflowRequest({
      grant: validGrant("queue_acceptance_smoke", {
        confirmationToken: "operator-confirmed",
      }),
      inputs: {
        ...validInputs(),
        messageIdsBySlot: {
          upstream: "message-upstream",
        },
        runIdsBySlot: {
          upstream: "run-upstream",
        },
        taskIdsBySlot: {
          downstream: "task-downstream",
          upstream: "task-upstream",
        },
      },
    });

    const result = await runQueueWorkflowFinalizationRunner({
      finalizationPort,
      readPort,
      request,
      validation: validateQueueWorkflowRequest(request),
    });

    expect(result.status).toBe("finalization_completed");
    expect(result.report.finalization).toMatchObject({
      commandStatus: "succeeded",
      confirmationTokenAccepted: true,
      downstreamVerification: {
        dependencyState: "ready",
        dependencyVerified: true,
        notAutoStartedVerified: true,
        taskId: "task-downstream",
        verificationMissing: false,
        workerRunState: "not_started",
      },
      finalizationAction: "mark_done",
      idempotent: false,
      status: "finalization_completed",
      targetSlot: "upstream",
      taskId: "task-upstream",
    });
    expect(result.report.mutationSummary).toEqual(
      expect.objectContaining({
        didAckReview: false,
        didCreateReviewMessage: false,
        didFail: false,
        didMarkDone: true,
        didMutateQueue: true,
        didStartWorker: false,
        didValidate: false,
      }),
    );
    expect(finalizationPort.calls).toEqual([
      {
        confirmationToken: "operator-confirmed",
        messageId: "message-upstream",
        method: "markDone",
        runId: "run-upstream",
        taskId: "task-upstream",
      },
    ]);
    expect(readPort.calls).toEqual([
      { method: "getQueueItemAggregate", taskId: "task-upstream" },
      { method: "getLifecycle", taskId: "task-upstream" },
      { method: "getQueueItemAggregate", taskId: "task-downstream" },
      { method: "getLifecycle", taskId: "task-downstream" },
    ]);
  });

  it("treats already_done as idempotent acceptance finalization success", async () => {
    const readPort = fakeReadPort({
      aggregates: {
        "task-downstream": aggregate({
          dependencyState: "ready",
          taskId: "task-downstream",
        }),
        "task-upstream": aggregate({
          reviewState: "done",
          taskId: "task-upstream",
          ticketState: "done",
        }),
      },
    });
    const finalizationPort = fakeFinalizationPort({
      markDoneResult: { status: "already_done" },
    });
    const request = workflowRequest({
      grant: validGrant("queue_acceptance_smoke", {
        confirmationToken: "operator-confirmed",
      }),
      inputs: {
        ...validInputs(),
        taskIdsBySlot: {
          downstream: "task-downstream",
          upstream: "task-upstream",
        },
      },
    });

    const result = await runQueueWorkflowFinalizationRunner({
      finalizationPort,
      readPort,
      request,
      validation: validateQueueWorkflowRequest(request),
    });

    expect(result.status).toBe("finalization_already_done");
    expect(result.report.finalization).toMatchObject({
      commandStatus: "already_done",
      idempotent: true,
      status: "finalization_already_done",
    });
    expect(result.report.mutationSummary).toEqual(
      expect.objectContaining({
        didMarkDone: false,
        didMutateQueue: false,
      }),
    );
    expect(finalizationPort.calls.map((call) => call.method)).toEqual([
      "markDone",
    ]);
  });

  it("blocks acceptance finalization without exact structured confirmation before any port call", async () => {
    const readPort = fakeReadPort();
    const finalizationPort = fakeFinalizationPort();
    const request = workflowRequest({
      inputs: {
        ...validInputs(),
        taskIdsBySlot: {
          downstream: "task-downstream",
          upstream: "task-upstream",
        },
      },
    });

    const result = await runQueueWorkflowFinalizationRunner({
      finalizationPort,
      readPort,
      request,
      validation: validateQueueWorkflowRequest(request),
    });

    expect(result.status).toBe("finalization_needs_confirmation");
    expect(result.blockers).toEqual([
      expect.objectContaining({
        fieldPath: "$.grant.confirmationToken",
        reasonCode: "finalization_confirmation_required",
      }),
    ]);
    expect(finalizationPort.calls).toEqual([]);
    expect(readPort.calls).toEqual([]);
  });

  it("blocks acceptance finalization when review ACK is not proven", async () => {
    const readPort = fakeReadPort({
      aggregates: {
        "task-upstream": aggregate({
          reviewState: "review_message_created",
          taskId: "task-upstream",
        }),
      },
    });
    const finalizationPort = fakeFinalizationPort();
    const request = workflowRequest({
      grant: validGrant("queue_acceptance_smoke", {
        confirmationToken: "operator-confirmed",
      }),
      inputs: {
        ...validInputs(),
        taskIdsBySlot: {
          downstream: "task-downstream",
          upstream: "task-upstream",
        },
      },
    });

    const result = await runQueueWorkflowFinalizationRunner({
      finalizationPort,
      readPort,
      request,
      validation: validateQueueWorkflowRequest(request),
    });

    expect(result.status).toBe("finalization_blocked");
    expect(result.blockers).toEqual([
      expect.objectContaining({
        reasonCode: "finalization_review_ack_required",
        taskId: "task-upstream",
      }),
    ]);
    expect(finalizationPort.calls).toEqual([]);
    expect(readPort.calls).toEqual([
      { method: "getQueueItemAggregate", taskId: "task-upstream" },
      { method: "getLifecycle", taskId: "task-upstream" },
    ]);
  });

  it("blocks acceptance finalization without explicit upstream taskId and does not infer from prose", async () => {
    const readPort = fakeReadPort();
    const finalizationPort = fakeFinalizationPort();
    const request = workflowRequest({
      grant: {
        ...validGrant("queue_acceptance_smoke", {
          confirmationToken: "operator-confirmed",
        }),
        scope: {
          taskIds: ["task-upstream"],
        },
      },
      inputs: validInputs(),
    });

    const result = await runQueueWorkflowFinalizationRunner({
      finalizationPort,
      readPort,
      request,
      validation: validateQueueWorkflowRequest(request),
    });

    expect(result.status).toBe("finalization_blocked");
    expect(result.blockers).toEqual([
      expect.objectContaining({
        fieldPath: "$.inputs.taskIdsBySlot.upstream",
        reasonCode: "finalization_missing_upstream_task_id",
      }),
    ]);
    expect(result.variables.taskIdsBySlot).toEqual({});
    expect(finalizationPort.calls).toEqual([]);
    expect(readPort.calls).toEqual([]);
  });

  it("allows acceptance finalization with missing downstream taskId but reports verification missing", async () => {
    const readPort = fakeReadPort({
      aggregates: {
        "task-upstream": aggregate({
          reviewState: "in_review",
          taskId: "task-upstream",
        }),
      },
    });
    const finalizationPort = fakeFinalizationPort({
      markDoneResult: { status: "succeeded" },
    });
    const request = workflowRequest({
      grant: validGrant("queue_acceptance_smoke", {
        confirmationToken: "operator-confirmed",
      }),
      inputs: {
        ...validInputs(),
        taskIdsBySlot: {
          upstream: "task-upstream",
        },
      },
    });

    const result = await runQueueWorkflowFinalizationRunner({
      finalizationPort,
      readPort,
      request,
      validation: validateQueueWorkflowRequest(request),
    });

    expect(result.status).toBe("finalization_completed");
    expect(result.report.finalization.downstreamVerification).toMatchObject({
      missingReason: "missing_downstream_task_id",
      verificationMissing: true,
    });
    expect(readPort.calls).toEqual([
      { method: "getQueueItemAggregate", taskId: "task-upstream" },
      { method: "getLifecycle", taskId: "task-upstream" },
    ]);
    expect(finalizationPort.calls).toHaveLength(1);
  });

  it("finalizes dependency_failure_smoke by failing explicit upstream and verifying downstream failed_upstream", async () => {
    const readPort = fakeReadPort({
      aggregates: {
        "task-downstream": aggregate({
          dependencyState: "failed_upstream",
          taskId: "task-downstream",
          workerRunState: "not_started",
        }),
        "task-upstream": aggregate({
          reviewState: "in_review",
          taskId: "task-upstream",
          workerRunState: "failed",
        }),
      },
    });
    const finalizationPort = fakeFinalizationPort({
      failResult: {
        aggregate: aggregate({
          reviewState: "failed",
          taskId: "task-upstream",
          ticketState: "failure",
          workerRunState: "failed",
        }),
        status: "succeeded",
      },
    });
    const request = workflowRequest({
      grant: validGrant("queue_failure_smoke", {
        confirmationToken: "operator-confirmed",
      }),
      inputs: {
        ...validInputs(),
        evidenceBundleIdsBySlot: {
          upstream: "bundle-upstream",
        },
        failureReason: "Upstream worker failed during smoke.",
        messageIdsBySlot: {
          upstream: "message-upstream",
        },
        runIdsBySlot: {
          upstream: "run-upstream",
        },
        taskIdsBySlot: {
          downstream: "task-downstream",
          upstream: "task-upstream",
        },
      },
      workflowId: "dependency_failure_smoke",
    });

    const result = await runQueueWorkflowFinalizationRunner({
      finalizationPort,
      readPort,
      request,
      validation: validateQueueWorkflowRequest(request),
    });

    expect(result.status).toBe("finalization_completed");
    expect(result.report.finalization).toMatchObject({
      commandStatus: "succeeded",
      downstreamVerification: {
        dependencyState: "failed_upstream",
        dependencyVerified: true,
        notAutoStartedVerified: true,
        taskId: "task-downstream",
        verificationMissing: false,
        workerRunState: "not_started",
      },
      failureReason: "Upstream worker failed during smoke.",
      finalizationAction: "fail",
      status: "finalization_completed",
      targetSlot: "upstream",
      taskId: "task-upstream",
    });
    expect(result.report.mutationSummary).toEqual(
      expect.objectContaining({
        didFail: true,
        didMarkDone: false,
        didMutateQueue: true,
        didStartWorker: false,
        didValidate: false,
      }),
    );
    expect(finalizationPort.calls).toEqual([
      {
        confirmationToken: "operator-confirmed",
        evidenceBundleId: "bundle-upstream",
        messageId: "message-upstream",
        method: "failItem",
        reason: "Upstream worker failed during smoke.",
        runId: "run-upstream",
        taskId: "task-upstream",
      },
    ]);
  });

  it("treats already_failed as idempotent failure finalization success", async () => {
    const readPort = fakeReadPort({
      aggregates: {
        "task-downstream": aggregate({
          dependencyState: "failed_upstream",
          taskId: "task-downstream",
        }),
        "task-upstream": aggregate({
          reviewState: "failed",
          taskId: "task-upstream",
          ticketState: "failure",
        }),
      },
    });
    const finalizationPort = fakeFinalizationPort({
      failResult: { status: "already_failed" },
    });
    const request = workflowRequest({
      grant: validGrant("queue_failure_smoke", {
        confirmationToken: "operator-confirmed",
      }),
      inputs: {
        ...validInputs(),
        failureReason: "Already failed upstream.",
        taskIdsBySlot: {
          downstream: "task-downstream",
          upstream: "task-upstream",
        },
      },
      workflowId: "dependency_failure_smoke",
    });

    const result = await runQueueWorkflowFinalizationRunner({
      finalizationPort,
      readPort,
      request,
      validation: validateQueueWorkflowRequest(request),
    });

    expect(result.status).toBe("finalization_already_failed");
    expect(result.report.finalization).toMatchObject({
      commandStatus: "already_failed",
      idempotent: true,
      status: "finalization_already_failed",
    });
    expect(result.report.mutationSummary).toEqual(
      expect.objectContaining({
        didFail: false,
        didMutateQueue: false,
      }),
    );
    expect(finalizationPort.calls.map((call) => call.method)).toEqual([
      "failItem",
    ]);
  });

  it("blocks failure finalization without failureReason before any port call", async () => {
    const readPort = fakeReadPort();
    const finalizationPort = fakeFinalizationPort();
    const request = workflowRequest({
      grant: validGrant("queue_failure_smoke", {
        confirmationToken: "operator-confirmed",
      }),
      inputs: {
        ...validInputs(),
        taskIdsBySlot: {
          downstream: "task-downstream",
          upstream: "task-upstream",
        },
      },
      workflowId: "dependency_failure_smoke",
    });

    const result = await runQueueWorkflowFinalizationRunner({
      finalizationPort,
      readPort,
      request,
      validation: validateQueueWorkflowRequest(request),
    });

    expect(result.status).toBe("finalization_blocked");
    expect(result.blockers).toEqual([
      expect.objectContaining({
        fieldPath: "$.inputs.failureReason",
        reasonCode: "finalization_missing_failure_reason",
      }),
    ]);
    expect(finalizationPort.calls).toEqual([]);
    expect(readPort.calls).toEqual([]);
  });

  it("blocks failure finalization without exact structured confirmation before any port call", async () => {
    const readPort = fakeReadPort();
    const finalizationPort = fakeFinalizationPort();
    const request = workflowRequest({
      grant: validGrant("queue_failure_smoke"),
      inputs: {
        ...validInputs(),
        failureReason: "Failure reason exists.",
        taskIdsBySlot: {
          downstream: "task-downstream",
          upstream: "task-upstream",
        },
      },
      workflowId: "dependency_failure_smoke",
    });

    const result = await runQueueWorkflowFinalizationRunner({
      finalizationPort,
      readPort,
      request,
      validation: validateQueueWorkflowRequest(request),
    });

    expect(result.status).toBe("finalization_needs_confirmation");
    expect(finalizationPort.calls).toEqual([]);
    expect(readPort.calls).toEqual([]);
  });

  it("blocks failure finalization when review ACK is not proven", async () => {
    const readPort = fakeReadPort({
      aggregates: {
        "task-upstream": aggregate({
          reviewState: "awaiting_review",
          taskId: "task-upstream",
        }),
      },
    });
    const finalizationPort = fakeFinalizationPort();
    const request = workflowRequest({
      grant: validGrant("queue_failure_smoke", {
        confirmationToken: "operator-confirmed",
      }),
      inputs: {
        ...validInputs(),
        failureReason: "Failure reason exists.",
        taskIdsBySlot: {
          downstream: "task-downstream",
          upstream: "task-upstream",
        },
      },
      workflowId: "dependency_failure_smoke",
    });

    const result = await runQueueWorkflowFinalizationRunner({
      finalizationPort,
      readPort,
      request,
      validation: validateQueueWorkflowRequest(request),
    });

    expect(result.status).toBe("finalization_blocked");
    expect(result.blockers).toEqual([
      expect.objectContaining({
        reasonCode: "finalization_review_ack_required",
      }),
    ]);
    expect(finalizationPort.calls).toEqual([]);
  });

  it("blocks failure finalization without explicit upstream taskId", async () => {
    const readPort = fakeReadPort();
    const finalizationPort = fakeFinalizationPort();
    const request = workflowRequest({
      grant: validGrant("queue_failure_smoke", {
        confirmationToken: "operator-confirmed",
      }),
      inputs: {
        ...validInputs(),
        failureReason: "Failure reason exists.",
        taskIdsBySlot: {
          downstream: "task-downstream",
        },
      },
      workflowId: "dependency_failure_smoke",
    });

    const result = await runQueueWorkflowFinalizationRunner({
      finalizationPort,
      readPort,
      request,
      validation: validateQueueWorkflowRequest(request),
    });

    expect(result.status).toBe("finalization_blocked");
    expect(result.blockers).toEqual([
      expect.objectContaining({
        reasonCode: "finalization_missing_upstream_task_id",
      }),
    ]);
    expect(finalizationPort.calls).toEqual([]);
    expect(readPort.calls).toEqual([]);
  });

  it("does not import Queue UI, visual shell, providers, Tauri, or WorkerProvider", () => {
    expect(runnerSource).not.toContain("@tauri-apps");
    expect(runnerSource).not.toContain("AgentProvider");
    expect(runnerSource).not.toContain("WorkerProvider");
    expect(runnerSource).not.toContain("AgentQueueV2Board");
    expect(runnerSource).not.toContain("AgentQueuePlaceholderWidget");
    expect(runnerSource).not.toContain("ModuleShell");
    expect(runnerSource).not.toContain("reviewMessageId");
    expect(runnerSource).not.toContain("queue.lifecycle.agentFinished");
    expect(runnerSource).not.toContain("recordWorkerFinished");
    expect(runnerSource).not.toContain("approveValidation");
    expect(runnerSource).not.toContain("addFollowUpPrompt");
    expect(runnerSource).not.toContain("blockItem");
    expect(runnerSource).not.toContain("startRun");
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

function workerEvidenceWorkflowRequest(
  overrides: Partial<QueueWorkflowRunnerRequest> = {},
): QueueWorkflowRunnerRequest {
  return workflowRequest({
    inputs: {
      phase: "worker_evidence",
      workerEvidence: {
        changedFiles: ["src/file.ts"],
        outcome: "completed",
        runId: "run-upstream",
        slot: "upstream",
        summary: "Worker completed.",
        taskId: "task-upstream",
        workflowRunId: "queue-workflow-run-1",
      },
    },
    ...overrides,
  });
}

function validGrant(mode: string, overrides: Record<string, unknown> = {}) {
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
    ...overrides,
  };
}

function validInputs() {
  return {
    runSettings: {
      approvalPolicy: "never",
      codexExecutable: "codex.cmd",
      executionPolicy: "manual",
      executorWidgetId: "executor-widget-1",
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

type FakeCreateSetupStartPort = QueueWorkflowCreateSetupStartPort & {
  calls: Array<{ method: string } & Record<string, unknown>>;
};

type FakeWorkerEvidencePort = QueueWorkflowWorkerEvidencePort & {
  calls: Array<
    { method: "recordWorkerEvidenceForSlot" } & QueueWorkflowRecordWorkerEvidenceRequest
  >;
};

function fakeWorkerEvidencePort(
  options: { status?: string } = {},
): FakeWorkerEvidencePort {
  const calls: FakeWorkerEvidencePort["calls"] = [];
  const status = options.status ?? "recorded";
  return {
    calls,
    recordWorkerEvidenceForSlot: async (request) => {
      calls.push({ method: "recordWorkerEvidenceForSlot", ...request });
      return {
        action: null,
        aggregate: aggregate({ taskId: request.taskId }),
        binding:
          status === "recorded" || status === "already_recorded"
            ? {
                evidenceActionId: "workflow-action-evidence",
                evidenceActionIdempotencyKey:
                  request.actionIdempotencyKey ??
                  `${request.workflowRunId}:record_worker_evidence:${request.slot}:${request.taskId}:${request.runId}`,
                evidenceBundleId: "evidence-bundle-1",
                evidenceRecordedAt: "2026-06-22T00:00:00.000Z",
                runId: request.runId,
                slot: request.slot,
                taskId: request.taskId,
                workerFinalStatus: "completed",
                workerOutcome: request.outcome,
              }
            : null,
        blocker:
          status === "blocked"
            ? {
                blockerCode: "worker_not_complete",
                blockerMessage: "Worker is still running.",
                missingRequiredField: "runId",
              }
            : null,
        conflict:
          status === "conflict"
            ? {
                conflictCode: "evidence_metadata_conflict",
                conflictMessage: "Evidence conflicts.",
                existingRequestHash: "existing",
                existingWorkflowRunId: request.workflowRunId,
                requestedRequestHash: "requested",
              }
            : null,
        evidenceBundle:
          status === "recorded" || status === "already_recorded"
            ? evidenceQuery({
                bundleId: "evidence-bundle-1",
                runId: request.runId,
                taskId: request.taskId,
              }).evidenceBundle
            : null,
        status,
        workflowRun: null,
      };
    },
  };
}

function fakeCreateSetupStartPort(
  options: {
    applyStatus?: string;
    materializeStatus?: string;
    promoteStatus?: string;
    queueControlState?: { status: string; version?: number | null };
    startBlockerCode?: string;
    startStatus?: string;
  } = {},
): FakeCreateSetupStartPort {
  const calls: FakeCreateSetupStartPort["calls"] = [];
  const materializeStatus = options.materializeStatus ?? "created";
  const applyStatus = options.applyStatus ?? "applied";
  const promoteStatus = options.promoteStatus ?? "promoted";
  const startStatus = options.startStatus ?? "started";

  return {
    calls,
    applyRunSettings: async (request) => {
      calls.push({ method: "applyRunSettings", ...request });
      return {
        action: null,
        binding:
          applyStatus === "applied" || applyStatus === "reused"
            ? {
                executorWidgetId: request.runSettings.executorWidgetId,
                settingsHash: "settings-hash-upstream",
                slot: request.slot,
                taskId: request.taskId ?? "task-upstream",
                updateRunSettingsActionId: "workflow-action-settings",
                updateRunSettingsActionIdempotencyKey:
                  "queue-workflow-run-1:update_run_settings:upstream:settings-hash-upstream",
              }
            : null,
        blocker:
          applyStatus === "conflict"
            ? {
                blockerCode: "settings_mismatch",
                blockerMessage: "Durable run settings do not match.",
                missingRequiredField: "runSettings",
              }
            : null,
        conflict: null,
        status: applyStatus,
        task: null,
        workflowRun: null,
      };
    },
    getQueueControlState: () => {
      calls.push({ method: "getQueueControlState" });
      return options.queueControlState ?? { status: "manual_enabled", version: 7 };
    },
    materializeTaskSlot: async (request) => {
      calls.push({ method: "materializeTaskSlot", ...request });
      const taskId =
        request.slot === "upstream" ? "task-upstream" : "task-downstream";
      return {
        action: null,
        binding:
          materializeStatus === "created" || materializeStatus === "reused"
            ? {
                createTaskActionId: `workflow-action-create-${request.slot}`,
                createTaskActionIdempotencyKey:
                  `queue-workflow-run-1:create_task:${request.slot}:task-spec-hash-${request.slot}`,
                dependencyEdgeHash: `dependency-edge-hash-${request.slot}`,
                dependencySpecHash: `dependency-spec-hash-${request.slot}`,
                dependencyTaskIds:
                  request.slot === "downstream" ? ["task-upstream"] : [],
                dependsOnSlots: request.dependsOnSlots ?? [],
                slot: request.slot,
                taskId,
                taskSpecHash: `task-spec-hash-${request.slot}`,
              }
            : null,
        blocker: null,
        conflict: null,
        status: materializeStatus,
        task: null,
        workflowRun: null,
      };
    },
    promoteTaskSlot: async (request) => {
      calls.push({ method: "promoteTaskSlot", ...request });
      return {
        action: null,
        binding:
          promoteStatus === "promoted" || promoteStatus === "reused"
            ? {
                promoteActionId: "workflow-action-promote-upstream",
                promoteActionIdempotencyKey:
                  "queue-workflow-run-1:promote_task:upstream:task-spec-hash-upstream:settings-hash-upstream",
                promoted: true,
                settingsHash: request.settingsHash,
                slot: request.slot,
                taskId: request.taskId ?? "task-upstream",
                taskSpecHash: request.taskSpecHash,
                taskStatus: "queued",
              }
            : null,
        blocker: null,
        conflict: null,
        status: promoteStatus,
        task: null,
        workflowRun: null,
      };
    },
    startWorkerForSlot: async (request) => {
      calls.push({ method: "startWorkerForSlot", ...request });
      return {
        actionIdempotencyKey:
          request.workflowStartContext?.actionIdempotencyKey ?? null,
        blocker:
          startStatus === "blocked"
            ? {
                actionIdempotencyKey:
                  request.workflowStartContext?.actionIdempotencyKey ?? null,
                actualQueueControlVersion: null,
                actualSettingsHash: null,
                blockerCode: options.startBlockerCode ?? "worker_start_blocked",
                blockerMessage: "Workflow worker start is blocked.",
                currentRunState: null,
                expectedQueueControlVersion:
                  request.workflowStartContext?.expectedQueueControlVersion ??
                  null,
                expectedSettingsHash:
                  request.workflowStartContext?.settingsHash ?? null,
                executorWidgetId:
                  request.workflowStartContext?.executorWidgetId ?? null,
                missingRequiredField: null,
                runId: null,
                taskId: request.queueItemId,
                workflowActionId:
                  request.workflowStartContext?.workflowActionId ?? null,
                workflowRunId:
                  request.workflowStartContext?.workflowRunId ?? null,
              }
            : null,
        currentRunState:
          startStatus === "started" || startStatus === "already_started"
            ? "running"
            : null,
        executorWidgetInstanceId:
          request.workflowStartContext?.executorWidgetId ?? "executor-widget-1",
        queueItemId: request.queueItemId,
        runId: startStatus === "blocked" ? "" : "run-upstream",
        settingsHash: request.workflowStartContext?.settingsHash ?? null,
        status: startStatus,
        workbenchId: "workbench-1",
        workflowActionId: request.workflowStartContext?.workflowActionId ?? null,
        workflowRunId: request.workflowStartContext?.workflowRunId ?? null,
        workspaceId: "workspace-1",
      };
    },
  };
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

type FakeFinalizationPort = QueueWorkflowFinalizationPort & {
  calls: Array<
    | ({
        method: "failItem";
      } & QueueWorkflowFailItemRequest)
    | ({
        method: "markDone";
      } & QueueWorkflowMarkDoneRequest)
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

function fakeFinalizationPort({
  failError,
  failResult = { status: "succeeded" },
  markDoneError,
  markDoneResult = { status: "succeeded" },
}: {
  failError?: Error;
  failResult?: QueueWorkflowFinalizationCommandResult;
  markDoneError?: Error;
  markDoneResult?: QueueWorkflowFinalizationCommandResult;
} = {}): FakeFinalizationPort {
  const calls: FakeFinalizationPort["calls"] = [];
  return {
    calls,
    failItem: async (request) => {
      calls.push({
        method: "failItem",
        ...request,
      });
      if (failError) {
        throw failError;
      }
      return {
        taskId: request.taskId,
        ...failResult,
      };
    },
    markDone: async (request) => {
      calls.push({
        method: "markDone",
        ...request,
      });
      if (markDoneError) {
        throw markDoneError;
      }
      return {
        taskId: request.taskId,
        ...markDoneResult,
      };
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
  durableFlags = {},
  reviewState = "none",
  taskId,
  ticketState = "queued",
  title = "Queue task",
  workerRunState = "not_started",
}: {
  dependencyState?: string;
  durableFlags?: Partial<AgentQueueItemAggregate["durableFlags"]>;
  reviewState?: string;
  taskId: string;
  ticketState?: string;
  title?: string;
  workerRunState?: string;
}): AgentQueueItemAggregate {
  const defaultDurableFlags: AgentQueueItemAggregate["durableFlags"] = {
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
  };

  return {
    blockers: [],
    commitState: "none",
    dependencyState,
    durableFlags: {
      ...defaultDurableFlags,
      ...durableFlags,
    },
    evidenceState: "none",
    evidenceSummary: null,
    latestRun: null,
    nextActions: [],
    reviewState,
    runSettings: {
      approvalPolicy: "never",
      assignedExecutorWidgetId: null,
      codexExecutable: "codex.cmd",
      executionPolicy: "manual",
      executionWorkspace: "C:/work/hobit",
      sandbox: "read_only",
    },
    taskId,
    ticketState,
    title,
    updatedAt: "2026-06-22T00:00:00.000Z",
    validationState: "not_requested",
    workerRunState,
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
