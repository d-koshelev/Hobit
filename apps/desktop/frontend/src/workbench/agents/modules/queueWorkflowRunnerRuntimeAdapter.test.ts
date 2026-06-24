import adapterSource from "./queueWorkflowRunnerRuntimeAdapter.ts?raw";

import { describe, expect, it, vi } from "vitest";

import {
  HOBIT_AGENT_WORKFLOW_REQUEST_ENVELOPE_TYPE,
  readHobitAgentWorkflowRequestEnvelope,
  type HobitAgentWorkflowRequestEnvelopeReadResult,
} from "../broker";
import type {
  AgentQueueCompletionCommandResult,
  AgentQueueFailureCommandResult,
  AgentQueueItemAggregate,
  AgentQueueReviewCommandResult,
  AgentQueueReviewCreateMessageResult,
  AgentQueueWorkflowRun,
  AgentQueueWorkerEvidenceQueryResult,
} from "../../../workspace/types";
import type { WorkspaceAgentQueueBridge } from "../../workspaceAgentQueueBridge";
import type {
  QueueWidgetActionResult,
  QueueWidgetItemSnapshot,
  QueueWidgetSnapshot,
} from "../../queue/agentQueueWidgetApiTypes";
import {
  runQueueWorkflowRunnerRuntimeAdapter,
  type QueueWorkflowPersistencePort,
} from "./queueWorkflowRunnerRuntimeAdapter";

describe("QueueWorkflowRunnerRuntimeAdapter", () => {
  it("invokes read-only runner for valid dependency_acceptance_smoke with explicit ids", async () => {
    const persistence = workflowPersistence();
    const bridge = queueBridge({
      getItemAggregate: vi.fn(async ({ taskId }: { taskId: string }) =>
        aggregate({ taskId }),
      ),
      listItemAggregates: vi.fn(async () => []),
    });

    const result = await runAdapter({
      queueBridge: bridge,
      workflowPersistence: persistence,
      workflowRequestRead: readWorkflow(
        workflowRequest({
          inputs: {
            ...validInputs(),
            phase: "read",
            taskIdsBySlot: explicitDependencyTaskIds(),
          },
        }),
      ),
    });

    expect(result).toMatchObject({
      invoked: true,
      phase: "read",
      status: "completed",
      workflowId: "dependency_acceptance_smoke",
      workflowRunId: "queue-workflow-run-1",
      workflowStartStatus: "succeeded",
    });
    expect(persistence.startAgentQueueWorkflow).toHaveBeenCalledWith(
      expect.objectContaining({
        requestId: "workflow-request-1",
        workflowId: "dependency_acceptance_smoke",
        workspaceId: "workspace-1",
      }),
    );
    expect(persistence.recordAgentQueueWorkflowRunnerReport).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "paused",
        workflowRunId: "queue-workflow-run-1",
      }),
    );
    const reportRequest = vi.mocked(
      persistence.recordAgentQueueWorkflowRunnerReport,
    ).mock.calls[0]?.[0];
    expect(reportRequest?.slotBindings).toBeNull();
    expect(reportRequest?.variables).toEqual(
      expect.objectContaining({
        slots: expect.any(Object),
      }),
    );
    expect(result.runnerResult?.report.mutationSummary).toEqual(
      expect.objectContaining({
        didAckReview: false,
        didCreateReviewMessage: false,
        didFail: false,
        didMarkDone: false,
        didStartWorker: false,
      }),
    );
    expect(bridge.getItemAggregate).toHaveBeenCalledTimes(4);
  });

  it("reuses an existing workflow run for repeated requestId/hash", async () => {
    const persistence = workflowPersistence({
      startAgentQueueWorkflow: vi.fn(async (request) => ({
        blocker: null,
        conflict: null,
        status: "already_exists",
        workflowRun: workflowRun({
          requestId: request.requestId,
          workflowId: request.workflowId,
          workflowRunId: "queue-workflow-run-existing",
          workspaceId: request.workspaceId,
        }),
      })),
    });
    const bridge = queueBridge({
      getItemAggregate: vi.fn(async ({ taskId }: { taskId: string }) =>
        aggregate({ taskId }),
      ),
      listItemAggregates: vi.fn(async () => []),
    });

    const result = await runAdapter({
      queueBridge: bridge,
      workflowPersistence: persistence,
      workflowRequestRead: readWorkflow(
        workflowRequest({
          inputs: {
            ...validInputs(),
            phase: "read",
            taskIdsBySlot: explicitDependencyTaskIds(),
          },
        }),
      ),
    });

    expect(result).toMatchObject({
      invoked: true,
      persistenceStatus: "reused",
      workflowRunId: "queue-workflow-run-existing",
      workflowStartStatus: "already_exists",
    });
    expect(bridge.getItemAggregate).toHaveBeenCalled();
  });

  it("blocks requestId/hash conflicts before runner invocation", async () => {
    const persistence = workflowPersistence({
      startAgentQueueWorkflow: vi.fn(async () => ({
        blocker: null,
        conflict: {
          conflictCode: "request_id_hash_conflict",
          conflictMessage: "Different typed request content exists.",
          existingRequestHash: "fnv1a64:old",
          existingWorkflowRunId: "queue-workflow-run-existing",
          requestedRequestHash: "fnv1a64:new",
        },
        status: "conflict",
        workflowRun: workflowRun({
          requestHash: "fnv1a64:old",
          workflowRunId: "queue-workflow-run-existing",
        }),
      })),
    });
    const bridge = queueBridge({
      getItemAggregate: vi.fn(),
      listItemAggregates: vi.fn(async () => []),
    });

    const result = await runAdapter({
      queueBridge: bridge,
      workflowPersistence: persistence,
      workflowRequestRead: readWorkflow(
        workflowRequest({
          inputs: {
            ...validInputs(),
            phase: "read",
            taskIdsBySlot: explicitDependencyTaskIds(),
          },
        }),
      ),
    });

    expect(result).toMatchObject({
      invoked: false,
      persistenceStatus: "conflict",
      status: "blocked",
      workflowRunId: "queue-workflow-run-existing",
    });
    expect(bridge.getItemAggregate).not.toHaveBeenCalled();
    expect(persistence.recordAgentQueueWorkflowRunnerReport).not.toHaveBeenCalled();
  });

  it("does not invoke the runner for invalid workflow envelopes", async () => {
    const persistence = workflowPersistence();
    const bridge = queueBridge({
      getItemAggregate: vi.fn(),
      markItemDone: vi.fn(),
    });

    const result = await runAdapter({
      queueBridge: bridge,
      workflowPersistence: persistence,
      workflowRequestRead: readWorkflow({ ...workflowRequest(), requestId: "" }),
    });

    expect(result).toMatchObject({
      invoked: false,
      status: "invalid_request",
    });
    expect(bridge.getItemAggregate).not.toHaveBeenCalled();
    expect(bridge.markItemDone).not.toHaveBeenCalled();
    expect(persistence.startAgentQueueWorkflow).not.toHaveBeenCalled();
  });

  it("does not invoke the runner for unknown Queue workflows", async () => {
    const persistence = workflowPersistence();
    const bridge = queueBridge({ getItemAggregate: vi.fn() });

    const result = await runAdapter({
      queueBridge: bridge,
      workflowPersistence: persistence,
      workflowRequestRead: readWorkflow(
        workflowRequest({ workflowId: "unknown_queue_workflow" }),
      ),
    });

    expect(result).toMatchObject({
      invoked: false,
      status: "unsupported",
      unsupportedReason: "workflow_not_declared",
    });
    expect(bridge.getItemAggregate).not.toHaveBeenCalled();
    expect(persistence.startAgentQueueWorkflow).not.toHaveBeenCalled();
  });

  it("does not invoke validation-deferred terminal_failure", async () => {
    const persistence = workflowPersistence();
    const bridge = queueBridge({
      getItemAggregate: vi.fn(),
      failItem: vi.fn(),
    });

    const result = await runAdapter({
      queueBridge: bridge,
      workflowPersistence: persistence,
      workflowRequestRead: validRead(
        workflowRequest({
          grant: validGrant("queue_failure_smoke"),
          workflowId: "terminal_failure",
        }),
      ),
    });

    expect(result).toMatchObject({
      invoked: false,
      status: "deferred",
      unsupportedReason: "terminal_failure_deferred",
    });
    expect(bridge.getItemAggregate).not.toHaveBeenCalled();
    expect(bridge.failItem).not.toHaveBeenCalled();
    expect(persistence.startAgentQueueWorkflow).not.toHaveBeenCalled();
  });

  it("returns runner blockers for missing task ids without port mutations", async () => {
    const persistence = workflowPersistence();
    const bridge = queueBridge({
      getItemAggregate: vi.fn(),
      listItemAggregates: vi.fn(async () => []),
      markItemDone: vi.fn(),
    });

    const result = await runAdapter({
      queueBridge: bridge,
      workflowPersistence: persistence,
      workflowRequestRead: validRead(
        workflowRequest({
          inputs: {
            ...validInputs(),
            phase: "read",
          },
        }),
      ),
    });

    expect(result).toMatchObject({
      invoked: true,
      phase: "read",
      status: "paused",
    });
    expect(result.blockers).toEqual(
      expect.arrayContaining([
        expect.stringContaining("explicit existing task ids"),
      ]),
    );
    expect(bridge.getItemAggregate).not.toHaveBeenCalled();
    expect(bridge.markItemDone).not.toHaveBeenCalled();
    expect(persistence.recordAgentQueueWorkflowRunnerReport).toHaveBeenCalledWith(
      expect.objectContaining({
        actions: [],
        status: "paused",
        workflowRunId: "queue-workflow-run-1",
      }),
    );
  });

  it("read-only inspection calls only read bridge methods", async () => {
    const bridge = queueBridge({
      createReviewMessage: vi.fn(),
      failItem: vi.fn(),
      getItemAggregate: vi.fn(async ({ taskId }: { taskId: string }) =>
        aggregate({ taskId }),
      ),
      listItemAggregates: vi.fn(async () => []),
      markItemDone: vi.fn(),
    });

    const result = await runAdapter({
      queueBridge: bridge,
      workflowRequestRead: validRead(
        workflowRequest({
          inputs: {
            ...validInputs(),
            phase: "read",
            taskIdsBySlot: explicitDependencyTaskIds(),
          },
        }),
      ),
    });

    expect(result.status).toBe("completed");
    expect(bridge.getItemAggregate).toHaveBeenCalled();
    expect(bridge.createReviewMessage).not.toHaveBeenCalled();
    expect(bridge.markItemDone).not.toHaveBeenCalled();
    expect(bridge.failItem).not.toHaveBeenCalled();
  });

  it("persists create/setup/start report for valid dependency workflow requests", async () => {
    const workflowBridge = createSetupStartBridge();
    const persistence = workflowPersistence({
      recordAgentQueueWorkflowRunnerReport: recordWithPersistedCreateSetupActions(),
    });

    const result = await runAdapter({
      queueBridge: queueBridge(workflowBridge.bridge),
      workflowPersistence: persistence,
      workflowRequestRead: validRead(
        workflowRequest({
          grant: validGrant("queue_acceptance_smoke", {
            confirmationToken: "operator-confirmed",
          }),
        }),
      ),
    });

    expect(result).toMatchObject({
      actionLedgerSummaryCount: 5,
      invoked: true,
      persistedActionCount: 5,
      phase: "create_setup_start",
      status: "paused",
      workflowRunId: "queue-workflow-run-1",
    });
    expect(result.summary).toContain("queue-workflow-run-1");
    expect(result.summary).toContain("task-upstream");
    expect(result.summary).toContain("run-upstream");
    expect(persistence.recordAgentQueueWorkflowRunnerReport).toHaveBeenCalledWith(
      expect.objectContaining({
        currentStep: "awaiting_worker_completion",
        pauseReason: "awaiting_worker_completion",
        phase: "run_start",
        status: "paused",
        workflowRunId: "queue-workflow-run-1",
      }),
    );
    expect(workflowBridge.calls.map((call) => call.method)).toEqual([
      "materializeWorkflowTaskSlot",
      "materializeWorkflowTaskSlot",
      "applyWorkflowRunSettings",
      "promoteWorkflowTaskSlot",
      "getQueueControlState",
      "startWorkflowAssignedTask",
    ]);
  });

  it("starts dependency_failure_smoke setup without requiring the final failure reason", async () => {
    const workflowBridge = createSetupStartBridge();
    const persistence = workflowPersistence({
      recordAgentQueueWorkflowRunnerReport: recordWithPersistedCreateSetupActions(),
    });

    const result = await runAdapter({
      queueBridge: queueBridge(workflowBridge.bridge),
      workflowPersistence: persistence,
      workflowRequestRead: validRead(
        workflowRequest({
          grant: validGrant("queue_failure_smoke", {
            confirmationToken: "operator-confirmed",
          }),
          workflowId: "dependency_failure_smoke",
        }),
      ),
    });

    expect(result).toMatchObject({
      invoked: true,
      phase: "create_setup_start",
      status: "paused",
      workflowId: "dependency_failure_smoke",
      workflowRunId: "queue-workflow-run-1",
    });
    expect(persistence.startAgentQueueWorkflow).toHaveBeenCalledWith(
      expect.objectContaining({
        workflowId: "dependency_failure_smoke",
      }),
    );
    expect(workflowBridge.calls.filter((call) => call.method === "startWorkflowAssignedTask")).toEqual([
      expect.objectContaining({ queueItemId: "task-upstream" }),
    ]);
  });

  it("reuses create/setup/start actions for repeated requestId/hash", async () => {
    const workflowBridge = createSetupStartBridge({
      applyStatus: "reused",
      materializeStatus: "reused",
      promoteStatus: "reused",
      startStatus: "already_started",
    });
    const persistence = workflowPersistence({
      startAgentQueueWorkflow: vi.fn(async (request) => ({
        blocker: null,
        conflict: null,
        status: "already_exists",
        workflowRun: workflowRun({
          requestId: request.requestId,
          workflowId: request.workflowId,
          workflowRunId: "queue-workflow-run-existing",
          workspaceId: request.workspaceId,
        }),
      })),
    });

    const result = await runAdapter({
      queueBridge: queueBridge(workflowBridge.bridge),
      workflowPersistence: persistence,
      workflowRequestRead: validRead(
        workflowRequest({
          grant: validGrant("queue_acceptance_smoke", {
            confirmationToken: "operator-confirmed",
          }),
        }),
      ),
    });

    expect(result).toMatchObject({
      persistenceStatus: "reused",
      phase: "create_setup_start",
      status: "paused",
      workflowRunId: "queue-workflow-run-existing",
      workflowStartStatus: "already_exists",
    });
    expect(workflowBridge.calls.filter((call) => call.method === "startWorkflowAssignedTask")).toHaveLength(1);
    expect(result.runnerResult?.report.mutationSummary).toEqual(
      expect.objectContaining({
        didMutateQueue: false,
        didStartWorker: false,
      }),
    );
  });

  it("resumes waiting_for_run_settings through create/setup/start", async () => {
    const workflowBridge = createSetupStartBridge();
    const persistence = workflowPersistence({
      planAgentQueueWorkflowResume: vi.fn(async () =>
        createSetupStartResumePlan({
          nextPhase: "setup",
          nextStep: "waiting_for_run_settings",
          status: "waiting_for_run_settings",
        }),
      ),
    });

    const result = await runAdapter({
      queueBridge: queueBridge(workflowBridge.bridge),
      workflowPersistence: persistence,
      workflowRequestRead: validRead(
        workflowRequest({
          grant: validGrant("queue_acceptance_smoke", {
            confirmationToken: "operator-confirmed",
          }),
          metadata: { workflowRunId: "queue-workflow-run-1" },
        }),
      ),
    });

    expect(result).toMatchObject({
      invoked: true,
      phase: "create_setup_start",
      resumePlan: expect.objectContaining({
        status: "waiting_for_run_settings",
      }),
      status: "paused",
    });
    expect(persistence.startAgentQueueWorkflow).not.toHaveBeenCalled();
    expect(workflowBridge.calls.map((call) => call.method)).toContain(
      "applyWorkflowRunSettings",
    );
  });

  it("resumes waiting_for_promote through create/setup/start", async () => {
    const workflowBridge = createSetupStartBridge();
    const persistence = workflowPersistence({
      planAgentQueueWorkflowResume: vi.fn(async () =>
        createSetupStartResumePlan({
          nextPhase: "setup",
          nextStep: "waiting_for_promote",
          status: "waiting_for_promote",
        }),
      ),
    });

    const result = await runAdapter({
      queueBridge: queueBridge(workflowBridge.bridge),
      workflowPersistence: persistence,
      workflowRequestRead: validRead(
        workflowRequest({
          grant: validGrant("queue_acceptance_smoke", {
            confirmationToken: "operator-confirmed",
          }),
          metadata: { workflowRunId: "queue-workflow-run-1" },
        }),
      ),
    });

    expect(result.phase).toBe("create_setup_start");
    expect(workflowBridge.calls.map((call) => call.method)).toContain(
      "promoteWorkflowTaskSlot",
    );
  });

  it("resumes start_worker_ready only with fresh confirmation", async () => {
    const workflowBridge = createSetupStartBridge();
    const persistence = workflowPersistence({
      planAgentQueueWorkflowResume: vi.fn(async () =>
        createSetupStartResumePlan({
          nextPhase: "run_start",
          nextStep: "start_worker_ready",
          requiredConfirmation: true,
          requiredFreshGrant: true,
          status: "blocked_missing_confirmation",
        }),
      ),
    });

    const result = await runAdapter({
      queueBridge: queueBridge(workflowBridge.bridge),
      workflowPersistence: persistence,
      workflowRequestRead: validRead(
        workflowRequest({
          grant: validGrant("queue_acceptance_smoke", {
            confirmationToken: "operator-confirmed",
          }),
          metadata: { workflowRunId: "queue-workflow-run-1" },
        }),
      ),
    });

    expect(result).toMatchObject({
      invoked: true,
      phase: "create_setup_start",
      status: "paused",
    });
    expect(workflowBridge.calls.map((call) => call.method)).toContain(
      "startWorkflowAssignedTask",
    );
  });

  it("does not start a second worker when resume planner reports worker running", async () => {
    const workflowBridge = createSetupStartBridge();
    const persistence = workflowPersistence({
      planAgentQueueWorkflowResume: vi.fn(async () =>
        createSetupStartResumePlan({
          nextPhase: "worker_evidence",
          nextStep: "worker_running_waiting_for_evidence",
          status: "resume_read_only_ready",
        }),
      ),
    });

    const result = await runAdapter({
      queueBridge: queueBridge(workflowBridge.bridge),
      workflowPersistence: persistence,
      workflowRequestRead: validRead(
        workflowRequest({
          metadata: { workflowRunId: "queue-workflow-run-1" },
        }),
      ),
    });

    expect(result).toMatchObject({
      invoked: false,
      status: "paused",
      workflowRunId: "queue-workflow-run-1",
    });
    expect(workflowBridge.calls).toEqual([]);
    expect(persistence.recordAgentQueueWorkflowRunnerReport).not.toHaveBeenCalled();
  });

  it("does not materialize tasks when typed fields are missing", async () => {
    const workflowBridge = createSetupStartBridge();

    const result = await runAdapter({
      queueBridge: queueBridge(workflowBridge.bridge),
      workflowRequestRead: readWorkflow(
        workflowRequest({
          inputs: {
            ...validInputs(),
            runSettings: {
              ...validInputs().runSettings,
              executionTarget: undefined,
              executorWidgetId: undefined,
            },
          },
        }),
      ),
    });

    expect(result).toMatchObject({
      invoked: false,
      status: "invalid_request",
    });
    expect(workflowBridge.calls).toEqual([]);
  });

  it("review phase calls evidence, create review message, and ACK review message", async () => {
    const persistence = workflowPersistence();
    const bridge = queueBridge({
      ackReviewMessage: vi.fn(async () => reviewCommandResult()),
      createReviewMessage: vi.fn(async () => reviewCreateResult()),
      getItemAggregate: vi.fn(async ({ taskId }: { taskId: string }) =>
        aggregate({ taskId }),
      ),
      getWorkerEvidenceBundle: vi.fn(
        async ({ runId, taskId }: { runId?: string | null; taskId: string }) =>
          evidenceQuery({ runId: runId ?? "run-upstream", taskId }),
      ),
      listItemAggregates: vi.fn(async () => []),
      markItemDone: vi.fn(),
    });

    const result = await runAdapter({
      actorId: "workspace-agent:test",
      queueBridge: bridge,
      workflowPersistence: persistence,
      workflowRequestRead: validRead(
        workflowRequest({
          inputs: {
            ...validInputs(),
            phase: "review",
            runIdsBySlot: { upstream: "run-upstream" },
            taskIdsBySlot: explicitDependencyTaskIds(),
          },
        }),
      ),
    });

    expect(result).toMatchObject({
      invoked: true,
      phase: "review",
      status: "completed",
    });
    expect(bridge.getWorkerEvidenceBundle).toHaveBeenCalledWith({
      runId: "run-upstream",
      taskId: "task-upstream",
    });
    expect(bridge.createReviewMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        actorId: "workspace-agent:test",
        evidenceBundleId: "bundle-upstream",
        runId: "run-upstream",
        taskId: "task-upstream",
      }),
    );
    expect(bridge.ackReviewMessage).toHaveBeenCalledWith({
      actorId: "workspace-agent:test",
      messageId: "message-upstream",
      taskId: "task-upstream",
    });
    expect(persistence.recordAgentQueueWorkflowRunnerReport).toHaveBeenCalledWith(
      expect.objectContaining({
        actions: expect.arrayContaining([
          expect.objectContaining({ actionType: "queue.evidence.lookup" }),
          expect.objectContaining({
            actionType: "queue.review.createMessage",
            status: "completed",
          }),
          expect.objectContaining({
            actionType: "queue.review.ack",
            status: "completed",
          }),
        ]),
      }),
    );
    expect(bridge.markItemDone).not.toHaveBeenCalled();
  });

  it("supports validation-deferred review_acceptance only through review runner inputs", async () => {
    const bridge = queueBridge({
      ackReviewMessage: vi.fn(async () => reviewCommandResult()),
      createReviewMessage: vi.fn(async () => reviewCreateResult()),
      getItemAggregate: vi.fn(async ({ taskId }: { taskId: string }) =>
        aggregate({ taskId }),
      ),
      getWorkerEvidenceBundle: vi.fn(
        async ({ runId, taskId }: { runId?: string | null; taskId: string }) =>
          evidenceQuery({ runId: runId ?? "run-review", taskId }),
      ),
      listItemAggregates: vi.fn(async () => []),
    });

    const result = await runAdapter({
      queueBridge: bridge,
      workflowRequestRead: validRead(
        workflowRequest({
          grant: validGrant("queue_acceptance_smoke"),
          inputs: {
            phase: "review",
            runId: "run-review",
            taskId: "task-upstream",
          },
          workflowId: "review_acceptance",
        }),
      ),
    });

    expect(result).toMatchObject({
      invoked: true,
      phase: "review",
      status: "completed",
    });
    expect(bridge.createReviewMessage).toHaveBeenCalled();
    expect(bridge.ackReviewMessage).toHaveBeenCalled();
  });

  it("acceptance finalization calls markDone only after confirmation and review precondition", async () => {
    const persistence = workflowPersistence();
    const bridge = queueBridge({
      failItem: vi.fn(),
      getItemAggregate: vi.fn(async ({ taskId }: { taskId: string }) =>
        aggregate({
          dependencyState: taskId === "task-downstream" ? "done" : "none",
          reviewState: taskId === "task-upstream" ? "in_review" : "none",
          taskId,
          workerRunState: "not_started",
        }),
      ),
      listItemAggregates: vi.fn(async () => []),
      markItemDone: vi.fn(async () => completionResult()),
    });

    const result = await runAdapter({
      actorId: "workspace-agent:test",
      queueBridge: bridge,
      workflowPersistence: persistence,
      workflowRequestRead: validRead(
        workflowRequest({
          grant: validGrant("queue_acceptance_smoke", {
            confirmationToken: "operator-confirmed",
          }),
          inputs: {
            ...validInputs(),
            messageIdsBySlot: { upstream: "message-upstream" },
            phase: "finalization",
            reviewAcknowledgedBySlot: { upstream: true },
            runIdsBySlot: { upstream: "run-upstream" },
            taskIdsBySlot: explicitDependencyTaskIds(),
          },
        }),
      ),
    });

    expect(result).toMatchObject({
      invoked: true,
      phase: "finalization",
      status: "completed",
    });
    expect(bridge.markItemDone).toHaveBeenCalledWith({
      actorId: "workspace-agent:test",
      confirmationToken: "operator-confirmed",
      reason: undefined,
      reviewMessageId: "message-upstream",
      runId: "run-upstream",
      taskId: "task-upstream",
    });
    expect(persistence.recordAgentQueueWorkflowRunnerReport).toHaveBeenCalledWith(
      expect.objectContaining({
        actions: expect.arrayContaining([
          expect.objectContaining({
            actionType: "queue.item.markDone",
            status: "completed",
          }),
        ]),
        status: "completed",
      }),
    );
  });

  it("failure finalization calls failItem only with structured failureReason", async () => {
    const persistence = workflowPersistence();
    const bridge = queueBridge({
      failItem: vi.fn(async () => failureResult()),
      getItemAggregate: vi.fn(async ({ taskId }: { taskId: string }) =>
        aggregate({
          dependencyState:
            taskId === "task-downstream" ? "failed_upstream" : "none",
          reviewState: taskId === "task-upstream" ? "in_review" : "none",
          taskId,
          workerRunState: taskId === "task-downstream" ? "not_started" : "failed",
        }),
      ),
      listItemAggregates: vi.fn(async () => []),
      markItemDone: vi.fn(),
    });

    const result = await runAdapter({
      actorId: "workspace-agent:test",
      queueBridge: bridge,
      workflowPersistence: persistence,
      workflowRequestRead: validRead(
        workflowRequest({
          grant: validGrant("queue_failure_smoke", {
            confirmationToken: "operator-confirmed",
          }),
          inputs: {
            ...validInputs(),
            evidenceBundleIdsBySlot: { upstream: "bundle-upstream" },
            failureReason: "Upstream failed during smoke.",
            messageIdsBySlot: { upstream: "message-upstream" },
            phase: "finalization",
            reviewAcknowledgedBySlot: { upstream: true },
            runIdsBySlot: { upstream: "run-upstream" },
            taskIdsBySlot: explicitDependencyTaskIds(),
          },
          workflowId: "dependency_failure_smoke",
        }),
      ),
    });

    expect(result).toMatchObject({
      invoked: true,
      phase: "finalization",
      status: "completed",
    });
    expect(bridge.failItem).toHaveBeenCalledWith({
      actorId: "workspace-agent:test",
      confirmationToken: "operator-confirmed",
      evidenceBundleId: "bundle-upstream",
      reason: "Upstream failed during smoke.",
      reviewMessageId: "message-upstream",
      runId: "run-upstream",
      taskId: "task-upstream",
    });
    expect(persistence.recordAgentQueueWorkflowRunnerReport).toHaveBeenCalledWith(
      expect.objectContaining({
        actions: expect.arrayContaining([
          expect.objectContaining({
            actionType: "queue.item.fail",
            status: "completed",
          }),
        ]),
        status: "completed",
      }),
    );
  });

  it("blocks finalization before markDone when confirmation is missing", async () => {
    const bridge = queueBridge({
      getItemAggregate: vi.fn(async ({ taskId }: { taskId: string }) =>
        aggregate({ reviewState: "in_review", taskId }),
      ),
      listItemAggregates: vi.fn(async () => []),
      markItemDone: vi.fn(),
    });

    const result = await runAdapter({
      queueBridge: bridge,
      workflowRequestRead: validRead(
        workflowRequest({
          inputs: {
            ...validInputs(),
            phase: "finalization",
            reviewAcknowledgedBySlot: { upstream: true },
            taskIdsBySlot: explicitDependencyTaskIds(),
          },
        }),
      ),
    });

    expect(result).toMatchObject({
      invoked: true,
      phase: "finalization",
      status: "paused",
    });
    expect(result.blockers).toEqual(
      expect.arrayContaining([
        expect.stringContaining("confirmationToken"),
      ]),
    );
    expect(bridge.markItemDone).not.toHaveBeenCalled();
  });

  it("blocks failure finalization before failItem when failureReason is missing", async () => {
    const bridge = queueBridge({
      failItem: vi.fn(),
      getItemAggregate: vi.fn(),
      markItemDone: vi.fn(),
    });

    const result = await runAdapter({
      queueBridge: bridge,
      workflowRequestRead: validRead(
        workflowRequest({
          grant: validGrant("queue_failure_smoke", {
            confirmationToken: "operator-confirmed",
          }),
          inputs: {
            ...validInputs(),
            phase: "finalization",
            reviewAcknowledgedBySlot: { upstream: true },
            taskIdsBySlot: explicitDependencyTaskIds(),
          },
          workflowId: "dependency_failure_smoke",
        }),
      ),
    });

    expect(result).toMatchObject({
      invoked: true,
      phase: "finalization",
      status: "blocked",
    });
    expect(result.runnerResult?.blockers).toEqual([
      expect.objectContaining({
        reasonCode: "finalization_missing_failure_reason",
      }),
    ]);
    expect(bridge.failItem).not.toHaveBeenCalled();
  });

  it("uses resume planning for explicit workflowRunId before runner execution", async () => {
    const persistence = workflowPersistence({
      planAgentQueueWorkflowResume: vi.fn(async () => resumePlan()),
    });
    const bridge = queueBridge({
      getItemAggregate: vi.fn(async ({ taskId }: { taskId: string }) =>
        aggregate({ taskId }),
      ),
      listItemAggregates: vi.fn(async () => []),
    });

    const result = await runAdapter({
      queueBridge: bridge,
      workflowPersistence: persistence,
      workflowRequestRead: validRead(
        workflowRequest({
          metadata: { workflowRunId: "queue-workflow-run-1" },
        }),
      ),
    });

    expect(persistence.planAgentQueueWorkflowResume).toHaveBeenCalledWith({
      workflowRunId: "queue-workflow-run-1",
      workspaceId: "workspace-1",
    });
    expect(persistence.startAgentQueueWorkflow).not.toHaveBeenCalled();
    expect(result).toMatchObject({
      invoked: true,
      phase: "read",
      resumePlan: expect.objectContaining({
        status: "resume_read_only_ready",
      }),
      workflowRunId: "queue-workflow-run-1",
    });
  });

  it("resumes worker evidence phase with typed completion input", async () => {
    const persistence = workflowPersistence({
      planAgentQueueWorkflowResume: vi.fn(async () =>
        workerEvidenceResumePlan({
          slotReconciliations: [
            {
              aggregateDependencyState: "none",
              aggregateEvidenceState: "none",
              aggregateReviewState: "none",
              aggregateTicketState: "review_needed",
              blockerCode: null,
              completionDecisionExists: false,
              completionDecisionId: null,
              evidenceBundleId: null,
              evidenceExists: false,
              executorWidgetId: null,
              failureDecisionExists: false,
              failureDecisionId: null,
              messageId: null,
              reviewMessageExists: false,
              reviewMessageStatus: null,
              runExists: true,
              runId: "run-upstream",
              slot: "upstream",
              taskExists: true,
              taskId: "task-upstream",
            },
          ],
          workflowRun: workflowRun({
            inputsSnapshotJson: JSON.stringify(validInputs()),
            phase: "worker_evidence",
            slotBindingsJson: JSON.stringify({
              upstream: { taskId: "task-upstream" },
            }),
            status: "paused",
            workflowRunId: "queue-workflow-run-1",
          }),
        }),
      ),
    });
    const recordWorkflowWorkerEvidence = vi.fn(async (request) => ({
      action: null,
      aggregate: aggregate({ taskId: request.taskId }),
      binding: {
        evidenceActionId: "workflow-action-evidence",
        evidenceActionIdempotencyKey:
          request.actionIdempotencyKey ??
          `${request.workflowRunId}:record_worker_evidence:${request.slot}:${request.taskId}:${request.runId}`,
        evidenceBundleId: "bundle-upstream",
        evidenceRecordedAt: "2026-06-22T00:00:00.000Z",
        runId: request.runId,
        slot: request.slot,
        taskId: request.taskId,
        workerFinalStatus: "completed",
        workerOutcome: request.outcome,
      },
      blocker: null,
      conflict: null,
      evidenceBundle: evidenceQuery({
        runId: request.runId,
        taskId: request.taskId,
      }).evidenceBundle,
      status: "recorded",
      workflowRun: null,
    }));
    const bridge = queueBridge({ recordWorkflowWorkerEvidence });

    const result = await runAdapter({
      queueBridge: bridge,
      workflowPersistence: persistence,
      workflowRequestRead: validRead(
        workflowRequest({
          inputs: workerEvidenceInputs(),
          metadata: { workflowRunId: "queue-workflow-run-1" },
        }),
      ),
    });

    expect(result).toMatchObject({
      invoked: true,
      phase: "worker_evidence",
      status: "paused",
      workflowRunId: "queue-workflow-run-1",
    });
    expect(persistence.startAgentQueueWorkflow).not.toHaveBeenCalled();
    expect(recordWorkflowWorkerEvidence).toHaveBeenCalledWith(
      expect.objectContaining({
        outcome: "completed",
        runId: "run-upstream",
        slot: "upstream",
        taskId: "task-upstream",
        workflowRunId: "queue-workflow-run-1",
      }),
    );
    expect(persistence.recordAgentQueueWorkflowRunnerReport).toHaveBeenCalledWith(
      expect.objectContaining({
        currentStep: "awaiting_review",
        phase: "worker_evidence",
        pauseReason: "awaiting_review",
        status: "paused",
        workflowRunId: "queue-workflow-run-1",
      }),
    );
    const reportRequest = vi.mocked(
      persistence.recordAgentQueueWorkflowRunnerReport,
    ).mock.calls[0]?.[0];
    expect(reportRequest?.slotBindings).toEqual({
      upstream: {
        evidenceBundleId: "bundle-upstream",
        runId: "run-upstream",
        taskId: "task-upstream",
      },
    });
    expect(result.runnerResult?.report.workerEvidence).toMatchObject({
      commandStatus: "recorded",
      evidenceBundleId: "bundle-upstream",
      status: "evidence_recorded",
    });
    expect(result.runnerResult?.report.mutationSummary).toEqual(
      expect.objectContaining({
        didAckReview: false,
        didCreateReviewMessage: false,
        didFail: false,
        didMarkDone: false,
        didStartWorker: false,
      }),
    );
  });

  it("persists worker evidence outcome mismatch as a blocked evidence action", async () => {
    const persistence = workflowPersistence({
      planAgentQueueWorkflowResume: vi.fn(async () =>
        workerEvidenceResumePlan(),
      ),
    });
    const recordWorkflowWorkerEvidence = vi.fn(async (request) => ({
      action: null,
      aggregate: aggregate({ taskId: request.taskId }),
      binding: null,
      blocker: {
        blockerCode: "worker_outcome_mismatch",
        blockerMessage:
          "Queue workflow worker evidence outcome does not match the durable worker run status.",
        missingRequiredField: "workerEvidence.outcome",
      },
      conflict: null,
      evidenceBundle: null,
      status: "blocked",
      workflowRun: null,
    }));
    const bridge = queueBridge({ recordWorkflowWorkerEvidence });

    const result = await runAdapter({
      queueBridge: bridge,
      workflowPersistence: persistence,
      workflowRequestRead: validRead(
        workflowRequest({
          inputs: {
            phase: "worker_evidence",
            workerEvidence: {
              ...workerEvidenceInputs().workerEvidence,
              outcome: "failed",
              summary: "Typed mismatched evidence outcome.",
            },
          },
          metadata: { workflowRunId: "queue-workflow-run-1" },
        }),
      ),
    });

    expect(result).toMatchObject({
      actionLedgerSummaryCount: 1,
      invoked: true,
      phase: "worker_evidence",
      status: "blocked",
      workflowRunId: "queue-workflow-run-1",
    });
    expect(result.runnerResult?.status).toBe("blocked_worker_outcome_mismatch");
    expect(result.runnerResult?.blockers).toEqual([
      expect.objectContaining({
        reasonCode: "worker_outcome_mismatch",
      }),
    ]);
    expect(persistence.recordAgentQueueWorkflowRunnerReport).toHaveBeenCalledWith(
      expect.objectContaining({
        actions: [
          expect.objectContaining({
            actionType: "record_worker_evidence",
            blockerCode: "worker_outcome_mismatch",
            idempotencyKey:
              "queue-workflow-run-1:record_worker_evidence:upstream:task-upstream:run-upstream",
            resultRefs: expect.objectContaining({
              commandStatus: "blocked",
              outcome: "failed",
              status: "blocked_worker_outcome_mismatch",
            }),
            status: "blocked",
            targetRefs: {
              runId: "run-upstream",
              slot: "upstream",
              taskId: "task-upstream",
              workflowRunId: "queue-workflow-run-1",
            },
          }),
        ],
        currentStep: "worker_evidence_blocked",
        phase: "worker_evidence",
        status: "blocked",
      }),
    );
  });

  it("resumes retryable worker evidence failure with corrected typed outcome", async () => {
    const persistence = workflowPersistence({
      planAgentQueueWorkflowResume: vi.fn(async () =>
        workerEvidenceResumePlan({
          blockers: [
            {
              blockerCode: "retryable_worker_evidence_failure",
              blockerMessage:
                "Queue workflow failed during worker evidence recording before durable evidence mutation; retry with corrected typed workerEvidence is allowed.",
              completionDecisionId: null,
              evidenceBundleId: null,
              failureDecisionId: null,
              messageId: null,
              missingRequiredField: "workerEvidence",
              runId: "run-upstream",
              slot: "upstream",
              taskId: "task-upstream",
            },
          ],
          reportSummary:
            "Queue workflow run queue-workflow-run-1 resume plan status is retryable_worker_evidence_failure. Next step: waiting_for_worker_evidence. Blockers: 1. No workflow steps were executed.",
          status: "retryable_worker_evidence_failure",
          workflowRun: workflowRun({
            inputsSnapshotJson: JSON.stringify(validInputs()),
            phase: "worker_evidence",
            slotBindingsJson: JSON.stringify({
              upstream: { runId: "run-upstream", taskId: "task-upstream" },
            }),
            status: "failed",
            workflowRunId: "queue-workflow-run-1",
          }),
        }),
      ),
    });
    const recordWorkflowWorkerEvidence = vi.fn(async (request) => ({
      action: null,
      aggregate: aggregate({ taskId: request.taskId }),
      binding: {
        evidenceActionId: "workflow-action-evidence",
        evidenceActionIdempotencyKey:
          `${request.workflowRunId}:record_worker_evidence:${request.slot}:${request.taskId}:${request.runId}`,
        evidenceBundleId: "bundle-upstream",
        evidenceRecordedAt: "2026-06-22T00:00:00.000Z",
        runId: request.runId,
        slot: request.slot,
        taskId: request.taskId,
        workerFinalStatus: "completed",
        workerOutcome: request.outcome,
      },
      blocker: null,
      conflict: null,
      evidenceBundle: evidenceQuery({
        runId: request.runId,
        taskId: request.taskId,
      }).evidenceBundle,
      status: "recorded",
      workflowRun: null,
    }));
    const bridge = queueBridge({ recordWorkflowWorkerEvidence });

    const result = await runAdapter({
      queueBridge: bridge,
      workflowPersistence: persistence,
      workflowRequestRead: validRead(
        workflowRequest({
          inputs: workerEvidenceInputs(),
          metadata: { workflowRunId: "queue-workflow-run-1" },
        }),
      ),
    });

    expect(result).toMatchObject({
      invoked: true,
      phase: "worker_evidence",
      status: "paused",
      workflowRunId: "queue-workflow-run-1",
    });
    expect(persistence.startAgentQueueWorkflow).not.toHaveBeenCalled();
    expect(recordWorkflowWorkerEvidence).toHaveBeenCalledWith(
      expect.objectContaining({
        outcome: "completed",
        runId: "run-upstream",
        slot: "upstream",
        taskId: "task-upstream",
      }),
    );
    expect(persistence.recordAgentQueueWorkflowRunnerReport).toHaveBeenCalledWith(
      expect.objectContaining({
        blockerReason: null,
        currentStep: "awaiting_review",
        phase: "worker_evidence",
        actions: [
          expect.objectContaining({
            actionType: "record_worker_evidence",
            resultRefs: expect.objectContaining({
              evidenceBundleId: "bundle-upstream",
            }),
            status: "completed",
          }),
        ],
        status: "paused",
      }),
    );
    expect(result.runnerResult?.report.review.status).toBeNull();
    expect(result.runnerResult?.report.finalization.status).toBeNull();
  });

  it("keeps worker evidence resume paused without typed completion input", async () => {
    const persistence = workflowPersistence({
      planAgentQueueWorkflowResume: vi.fn(async () =>
        workerEvidenceResumePlan(),
      ),
    });
    const recordWorkflowWorkerEvidence = vi.fn();
    const bridge = queueBridge({ recordWorkflowWorkerEvidence });

    const result = await runAdapter({
      queueBridge: bridge,
      workflowPersistence: persistence,
      workflowRequestRead: validRead(
        workflowRequest({
          inputs: { phase: "worker_evidence" },
          metadata: { workflowRunId: "queue-workflow-run-1" },
        }),
      ),
    });

    expect(result).toMatchObject({
      invoked: false,
      phase: "worker_evidence",
      status: "paused",
      workflowRunId: "queue-workflow-run-1",
    });
    expect(recordWorkflowWorkerEvidence).not.toHaveBeenCalled();
    expect(persistence.recordAgentQueueWorkflowRunnerReport).not.toHaveBeenCalled();
  });

  it("treats repeated worker evidence continuation as idempotent", async () => {
    const persistence = workflowPersistence({
      planAgentQueueWorkflowResume: vi.fn(async () =>
        workerEvidenceResumePlan(),
      ),
    });
    const bridge = queueBridge({
      recordWorkflowWorkerEvidence: vi.fn(async (request) => ({
        action: null,
        aggregate: aggregate({ taskId: request.taskId }),
        binding: {
          evidenceActionId: "workflow-action-evidence",
          evidenceActionIdempotencyKey:
            `${request.workflowRunId}:record_worker_evidence:${request.slot}:${request.taskId}:${request.runId}`,
          evidenceBundleId: "bundle-upstream",
          evidenceRecordedAt: "2026-06-22T00:00:00.000Z",
          runId: request.runId,
          slot: request.slot,
          taskId: request.taskId,
          workerFinalStatus: "completed",
          workerOutcome: request.outcome,
        },
        blocker: null,
        conflict: null,
        evidenceBundle: evidenceQuery({
          runId: request.runId,
          taskId: request.taskId,
        }).evidenceBundle,
        status: "already_recorded",
        workflowRun: null,
      })),
    });

    const result = await runAdapter({
      queueBridge: bridge,
      workflowPersistence: persistence,
      workflowRequestRead: validRead(
        workflowRequest({
          inputs: workerEvidenceInputs(),
          metadata: { workflowRunId: "queue-workflow-run-1" },
        }),
      ),
    });

    expect(result.status).toBe("paused");
    expect(result.runnerResult?.report.workerEvidence).toMatchObject({
      commandStatus: "already_recorded",
      idempotent: true,
      status: "evidence_already_recorded",
    });
    expect(result.runnerResult?.report.mutationSummary.didMutateQueue).toBe(false);
  });

  it("resumes review create and ACK after worker evidence is durable", async () => {
    const persistence = workflowPersistence({
      planAgentQueueWorkflowResume: vi.fn(async () => reviewCreateResumePlan()),
    });
    const bridge = queueBridge({
      ackReviewMessage: vi.fn(async () => reviewCommandResult()),
      createReviewMessage: vi.fn(async () => reviewCreateResult()),
      getItemAggregate: vi.fn(async ({ taskId }: { taskId: string }) =>
        aggregate({ reviewState: "awaiting_review", taskId }),
      ),
      getWorkerEvidenceBundle: vi.fn(async () =>
        evidenceQuery({ runId: "run-upstream", taskId: "task-upstream" }),
      ),
      listItemAggregates: vi.fn(async () => []),
    });

    const result = await runAdapter({
      queueBridge: bridge,
      workflowPersistence: persistence,
      workflowRequestRead: validRead(
        workflowRequest({
          metadata: { workflowRunId: "queue-workflow-run-1" },
        }),
      ),
    });

    expect(result).toMatchObject({
      invoked: true,
      phase: "review",
      status: "completed",
      workflowRunId: "queue-workflow-run-1",
    });
    expect(bridge.createReviewMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        evidenceBundleId: "bundle-upstream",
        runId: "run-upstream",
        taskId: "task-upstream",
      }),
    );
    expect(bridge.ackReviewMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        messageId: "message-upstream",
        taskId: "task-upstream",
      }),
    );
    expect(persistence.recordAgentQueueWorkflowRunnerReport).toHaveBeenCalledWith(
      expect.objectContaining({
        currentStep: "review_ack",
        phase: "review",
        status: "paused",
        workflowRunId: "queue-workflow-run-1",
      }),
    );
  });

  it("resumes review ACK from durable messageId without creating another message", async () => {
    const persistence = workflowPersistence({
      planAgentQueueWorkflowResume: vi.fn(async () => reviewAckResumePlan()),
    });
    const bridge = queueBridge({
      ackReviewMessage: vi.fn(async () => reviewCommandResult()),
      createReviewMessage: vi.fn(),
      getItemAggregate: vi.fn(async ({ taskId }: { taskId: string }) =>
        aggregate({ reviewState: "review_message_created", taskId }),
      ),
      getWorkerEvidenceBundle: vi.fn(async () =>
        evidenceQuery({ runId: "run-upstream", taskId: "task-upstream" }),
      ),
      listItemAggregates: vi.fn(async () => []),
    });

    const result = await runAdapter({
      queueBridge: bridge,
      workflowPersistence: persistence,
      workflowRequestRead: validRead(
        workflowRequest({
          metadata: { workflowRunId: "queue-workflow-run-1" },
        }),
      ),
    });

    expect(result).toMatchObject({
      invoked: true,
      phase: "review",
      status: "completed",
    });
    expect(bridge.createReviewMessage).not.toHaveBeenCalled();
    expect(bridge.ackReviewMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        messageId: "message-upstream",
        taskId: "task-upstream",
      }),
    );
  });

  it("returns terminal resume plans without invoking the runner", async () => {
    const persistence = workflowPersistence({
      planAgentQueueWorkflowResume: vi.fn(async () =>
        resumePlan({
          reportSummary: "Workflow is already completed.",
          resumeAvailable: false,
          status: "terminal_completed",
          terminalStatus: "completed",
          workflowRun: workflowRun({
            completedAt: "2026-06-22T00:00:00.000Z",
            status: "completed",
            workflowRunId: "queue-workflow-run-1",
          }),
        }),
      ),
    });
    const bridge = queueBridge({ getItemAggregate: vi.fn() });

    const result = await runAdapter({
      queueBridge: bridge,
      workflowPersistence: persistence,
      workflowRequestRead: validRead(
        workflowRequest({
          metadata: { workflowRunId: "queue-workflow-run-1" },
        }),
      ),
    });

    expect(result).toMatchObject({
      invoked: false,
      persistentStatus: "completed",
      resumePlan: expect.objectContaining({ status: "terminal_completed" }),
      status: "completed",
    });
    expect(bridge.getItemAggregate).not.toHaveBeenCalled();
  });

  it("blocks arbitrary terminal failed workflow without invoking worker evidence", async () => {
    const persistence = workflowPersistence({
      planAgentQueueWorkflowResume: vi.fn(async () =>
        resumePlan({
          nextPhase: "closed",
          reportSummary: "Workflow failed before a retryable evidence point.",
          resumeAvailable: false,
          status: "terminal_failed",
          terminalStatus: "failed",
          workflowRun: workflowRun({
            completedAt: "2026-06-22T00:00:00.000Z",
            phase: "closed",
            status: "failed",
            workflowRunId: "queue-workflow-run-1",
          }),
        }),
      ),
    });
    const recordWorkflowWorkerEvidence = vi.fn();
    const bridge = queueBridge({ recordWorkflowWorkerEvidence });

    const result = await runAdapter({
      queueBridge: bridge,
      workflowPersistence: persistence,
      workflowRequestRead: validRead(
        workflowRequest({
          inputs: workerEvidenceInputs(),
          metadata: { workflowRunId: "queue-workflow-run-1" },
        }),
      ),
    });

    expect(result).toMatchObject({
      invoked: false,
      persistentStatus: "failed",
      resumePlan: expect.objectContaining({ status: "terminal_failed" }),
      status: "blocked",
    });
    expect(recordWorkflowWorkerEvidence).not.toHaveBeenCalled();
    expect(persistence.startAgentQueueWorkflow).not.toHaveBeenCalled();
    expect(persistence.recordAgentQueueWorkflowRunnerReport).not.toHaveBeenCalled();
  });

  it("returns blocked resume plans without invoking the runner", async () => {
    const persistence = workflowPersistence({
      planAgentQueueWorkflowResume: vi.fn(async () =>
        resumePlan({
          blockers: [
            {
              blockerCode: "task_missing",
              blockerMessage: "Persisted task is missing.",
              completionDecisionId: null,
              evidenceBundleId: null,
              failureDecisionId: null,
              messageId: null,
              missingRequiredField: "taskId",
              runId: null,
              slot: "upstream",
              taskId: "task-upstream",
            },
          ],
          reportSummary: "Persisted task is missing.",
          status: "blocked_missing_task",
        }),
      ),
    });
    const bridge = queueBridge({ getItemAggregate: vi.fn() });

    const result = await runAdapter({
      queueBridge: bridge,
      workflowPersistence: persistence,
      workflowRequestRead: validRead(
        workflowRequest({
          metadata: { workflowRunId: "queue-workflow-run-1" },
        }),
      ),
    });

    expect(result).toMatchObject({
      invoked: false,
      status: "blocked",
    });
    expect(result.blockers).toEqual(
      expect.arrayContaining(["Persisted task is missing."]),
    );
    expect(bridge.getItemAggregate).not.toHaveBeenCalled();
  });

  it("blocks mutating resume plans without fresh confirmation", async () => {
    const persistence = workflowPersistence({
      planAgentQueueWorkflowResume: vi.fn(async () => finalizationResumePlan()),
    });
    const bridge = queueBridge({ markItemDone: vi.fn() });

    const result = await runAdapter({
      queueBridge: bridge,
      workflowPersistence: persistence,
      workflowRequestRead: validRead(
        workflowRequest({
          inputs: {
            ...validInputs(),
            phase: "finalization",
          },
          metadata: { workflowRunId: "queue-workflow-run-1" },
        }),
      ),
    });

    expect(result).toMatchObject({
      invoked: false,
      status: "paused",
    });
    expect(result.blockers).toEqual(
      expect.arrayContaining([
        expect.stringContaining("confirmationToken"),
      ]),
    );
    expect(bridge.markItemDone).not.toHaveBeenCalled();
  });

  it("allows fresh confirmation to resume only supported finalization", async () => {
    const persistence = workflowPersistence({
      planAgentQueueWorkflowResume: vi.fn(async () => finalizationResumePlan()),
    });
    const bridge = queueBridge({
      failItem: vi.fn(),
      getItemAggregate: vi.fn(async ({ taskId }: { taskId: string }) =>
        aggregate({
          dependencyState: taskId === "task-downstream" ? "ready" : "none",
          reviewState: taskId === "task-upstream" ? "in_review" : "none",
          taskId,
        }),
      ),
      listItemAggregates: vi.fn(async () => []),
      markItemDone: vi.fn(async () => completionResult()),
    });

    const result = await runAdapter({
      actorId: "workspace-agent:test",
      queueBridge: bridge,
      workflowPersistence: persistence,
      workflowRequestRead: validRead(
        workflowRequest({
          grant: validGrant("queue_acceptance_smoke", {
            confirmationToken: "operator-confirmed",
          }),
          inputs: {
            ...validInputs(),
            phase: "finalization",
          },
          metadata: { workflowRunId: "queue-workflow-run-1" },
        }),
      ),
    });

    expect(result).toMatchObject({
      invoked: true,
      phase: "finalization",
      status: "completed",
    });
    expect(result.runnerResult?.report.finalization).toMatchObject({
      decisionId: "completion-decision-1",
      downstreamVerification: {
        dependencyVerified: true,
        notAutoStartedVerified: true,
      },
      status: "finalization_completed",
    });
    expect(bridge.markItemDone).toHaveBeenCalledWith(
      expect.objectContaining({
        confirmationToken: "operator-confirmed",
        taskId: "task-upstream",
      }),
    );
    expect(persistence.recordAgentQueueWorkflowRunnerReport).toHaveBeenCalledWith(
      expect.objectContaining({
        actions: expect.arrayContaining([
          expect.objectContaining({
            actionType: "queue.item.markDone",
            resultRefs: expect.objectContaining({
              decisionId: "completion-decision-1",
            }),
          }),
        ]),
        currentStep: "finalization_complete",
        phase: "decision",
        status: "completed",
      }),
    );
    expect(persistence.startAgentQueueWorkflow).not.toHaveBeenCalled();
  });

  it("resumes dependency_failure_smoke failure finalization from a persisted workflow run", async () => {
    const persistence = workflowPersistence({
      planAgentQueueWorkflowResume: vi.fn(async () =>
        failureFinalizationResumePlan(),
      ),
    });
    const bridge = queueBridge({
      failItem: vi.fn(async () => failureResult()),
      getItemAggregate: vi.fn(async ({ taskId }: { taskId: string }) =>
        aggregate({
          dependencyState:
            taskId === "task-downstream" ? "failed_upstream" : "none",
          reviewState: taskId === "task-upstream" ? "in_review" : "none",
          taskId,
          workerRunState:
            taskId === "task-downstream" ? "not_started" : "failed",
        }),
      ),
      listItemAggregates: vi.fn(async () => []),
      markItemDone: vi.fn(),
    });

    const result = await runAdapter({
      actorId: "workspace-agent:test",
      queueBridge: bridge,
      workflowPersistence: persistence,
      workflowRequestRead: validRead(
        workflowRequest({
          grant: validGrant("queue_failure_smoke", {
            confirmationToken: "operator-confirmed",
          }),
          inputs: {
            failureReason: "Upstream worker failed during smoke.",
            phase: "finalization",
          },
          metadata: { workflowRunId: "queue-workflow-run-1" },
          workflowId: "dependency_failure_smoke",
        }),
      ),
    });

    expect(result).toMatchObject({
      invoked: true,
      phase: "finalization",
      status: "completed",
      workflowId: "dependency_failure_smoke",
      workflowRunId: "queue-workflow-run-1",
    });
    expect(persistence.startAgentQueueWorkflow).not.toHaveBeenCalled();
    expect(bridge.failItem).toHaveBeenCalledWith({
      actorId: "workspace-agent:test",
      confirmationToken: "operator-confirmed",
      evidenceBundleId: "bundle-upstream",
      reason: "Upstream worker failed during smoke.",
      reviewMessageId: "message-upstream",
      runId: "run-upstream",
      taskId: "task-upstream",
    });
    expect(bridge.markItemDone).not.toHaveBeenCalled();
    expect(result.runnerResult?.report.finalization).toMatchObject({
      downstreamVerification: {
        dependencyState: "failed_upstream",
        dependencyVerified: true,
        notAutoStartedVerified: true,
      },
      failureReason: "Upstream worker failed during smoke.",
      finalizationAction: "fail",
      status: "finalization_completed",
    });
    expect(persistence.recordAgentQueueWorkflowRunnerReport).toHaveBeenCalledWith(
      expect.objectContaining({
        actions: expect.arrayContaining([
          expect.objectContaining({
            actionType: "queue.item.fail",
            resultRefs: expect.objectContaining({
              failureReason: "Upstream worker failed during smoke.",
            }),
            status: "completed",
          }),
        ]),
        currentStep: "finalization_complete",
        phase: "decision",
        status: "completed",
      }),
    );
    expect(
      JSON.stringify(
        vi.mocked(persistence.recordAgentQueueWorkflowRunnerReport).mock
          .calls[0]?.[0],
      ),
    ).not.toContain("confirmationToken");
  });

  it("does not import providers, Queue UI, visual shell, worker start, lifecycle finish, or evidence recording", () => {
    expect(adapterSource).not.toContain("AgentProvider");
    expect(adapterSource).not.toContain("WorkerProvider");
    expect(adapterSource).not.toContain("AgentQueueV2Board");
    expect(adapterSource).not.toContain("AgentQueuePlaceholderWidget");
    expect(adapterSource).not.toContain("widgetV2/queueV2");
    expect(adapterSource).not.toContain("queue/details");
    expect(adapterSource).not.toContain("ModuleShell");
    expect(adapterSource).not.toContain("tokens.css");
    expect(adapterSource).not.toContain("widget.css");
    expect(adapterSource).not.toContain("queue.lifecycle.agentFinished");
    expect(adapterSource).not.toContain("recordWorkerFinished");
    expect(adapterSource).not.toContain("startQueueLinkedRun");
    expect(adapterSource).not.toContain("recordEvidence");
  });
});

function readWorkflow(
  request: Record<string, unknown>,
): HobitAgentWorkflowRequestEnvelopeReadResult {
  return readHobitAgentWorkflowRequestEnvelope(JSON.stringify(request));
}

function validRead(
  request: Record<string, unknown>,
): Extract<HobitAgentWorkflowRequestEnvelopeReadResult, { status: "valid" }> {
  const read = readWorkflow(request);
  expect(read.status).toBe("valid");
  if (read.status !== "valid") {
    throw new Error("Expected valid workflow request.");
  }
  return read;
}

function runAdapter(
  input: Parameters<typeof runQueueWorkflowRunnerRuntimeAdapter>[0],
) {
  return runQueueWorkflowRunnerRuntimeAdapter({
    workflowPersistence: workflowPersistence(),
    workspaceId: "workspace-1",
    ...input,
  });
}

function workflowPersistence(
  overrides: Partial<QueueWorkflowPersistencePort> = {},
): QueueWorkflowPersistencePort {
  return {
    planAgentQueueWorkflowResume: vi.fn(async () => null),
    recordAgentQueueWorkflowRunnerReport: vi.fn(
      async (
        request: Parameters<
          QueueWorkflowPersistencePort["recordAgentQueueWorkflowRunnerReport"]
        >[0],
      ) => ({
        actions: request.actions.map((action, index) => ({
          actionId: `workflow-action-${index + 1}`,
          actionType: action.actionType,
          attemptCount: 1,
          blockerCode: action.blockerCode ?? null,
          blockerMessage: action.blockerMessage ?? null,
          completedAt: "2026-06-22T00:00:00.000Z",
          createdAt: "2026-06-22T00:00:00.000Z",
          idempotencyKey: action.idempotencyKey,
          resultRefsJson: action.resultRefs
            ? JSON.stringify(action.resultRefs)
            : null,
          startedAt: "2026-06-22T00:00:00.000Z",
          status: action.status,
          stepId: action.stepId,
          targetRefsJson: action.targetRefs
            ? JSON.stringify(action.targetRefs)
            : null,
          updatedAt: "2026-06-22T00:00:00.000Z",
          workflowRunId: request.workflowRunId,
          workspaceId: request.workspaceId,
        })),
        blocker: null,
        conflict: null,
        status: "recorded",
        workflowRun: workflowRun({
          currentStep: request.currentStep ?? null,
          phase: request.phase ?? "review",
          status: request.status,
          workflowRunId: request.workflowRunId,
          workspaceId: request.workspaceId,
        }),
      }),
    ),
    startAgentQueueWorkflow: vi.fn(
      async (
        request: Parameters<
          QueueWorkflowPersistencePort["startAgentQueueWorkflow"]
        >[0],
      ) => ({
        blocker: null,
        conflict: null,
        status: "succeeded",
        workflowRun: workflowRun({
          requestId: request.requestId,
          workflowId: request.workflowId,
          workspaceId: request.workspaceId,
        }),
      }),
    ),
    ...overrides,
  };
}

function workflowRun(
  overrides: Partial<AgentQueueWorkflowRun> = {},
): AgentQueueWorkflowRun {
  return {
    actionLogSummaryJson: null,
    actorId: "workspace-agent:test",
    blockerReason: null,
    completedAt: null,
    createdAt: "2026-06-22T00:00:00.000Z",
    currentStep: overrides.currentStep ?? "created",
    grantSummaryJson: null,
    idempotencyKeysJson: null,
    inputsSnapshotJson: null,
    mutationRefsJson: null,
    pauseReason: null,
    phase: overrides.phase ?? "intake",
    requestHash: overrides.requestHash ?? "fnv1a64:test",
    requestId: overrides.requestId ?? "workflow-request-1",
    schemaVersion: 1,
    slotBindingsJson: null,
    status: overrides.status ?? "created",
    updatedAt: "2026-06-22T00:00:00.000Z",
    variablesJson: null,
    version: 1,
    workflowId: overrides.workflowId ?? "dependency_acceptance_smoke",
    workflowRunId: overrides.workflowRunId ?? "queue-workflow-run-1",
    workspaceId: overrides.workspaceId ?? "workspace-1",
    ...overrides,
  };
}

function resumePlan(
  overrides: Partial<
    NonNullable<
      Awaited<
        ReturnType<QueueWorkflowPersistencePort["planAgentQueueWorkflowResume"]>
      >
    >
  > = {},
): NonNullable<
  Awaited<ReturnType<QueueWorkflowPersistencePort["planAgentQueueWorkflowResume"]>>
> {
  return {
    actions: [],
    blockers: [],
    nextPhase: "worker_evidence",
    nextStep: "read_ready",
    reconciledVariablesJson: null,
    reportSummary:
      "Queue workflow run queue-workflow-run-1 resume plan status is resume_read_only_ready. No workflow steps were executed.",
    requiredConfirmation: false,
    requiredFreshGrant: false,
    resumeAvailable: true,
    slotReconciliations: [
      {
        aggregateDependencyState: "none",
        aggregateEvidenceState: "available",
        aggregateReviewState: "none",
        aggregateTicketState: "queued",
        blockerCode: null,
        completionDecisionExists: false,
        completionDecisionId: null,
        evidenceBundleId: null,
        evidenceExists: false,
        executorWidgetId: null,
        failureDecisionExists: false,
        failureDecisionId: null,
        messageId: null,
        reviewMessageExists: false,
        reviewMessageStatus: null,
        runExists: false,
        runId: null,
        slot: "upstream",
        taskExists: true,
        taskId: "task-upstream",
      },
      {
        aggregateDependencyState: "none",
        aggregateEvidenceState: "available",
        aggregateReviewState: "none",
        aggregateTicketState: "queued",
        blockerCode: null,
        completionDecisionExists: false,
        completionDecisionId: null,
        evidenceBundleId: null,
        evidenceExists: false,
        executorWidgetId: null,
        failureDecisionExists: false,
        failureDecisionId: null,
        messageId: null,
        reviewMessageExists: false,
        reviewMessageStatus: null,
        runExists: false,
        runId: null,
        slot: "downstream",
        taskExists: true,
        taskId: "task-downstream",
      },
    ],
    status: "resume_read_only_ready",
    taskSnapshots: [],
    terminalStatus: null,
    workflowRun: workflowRun({
      phase: "worker_evidence",
      slotBindingsJson: JSON.stringify({
        downstream: { taskId: "task-downstream" },
        upstream: { taskId: "task-upstream" },
      }),
      status: "paused",
      workflowRunId: "queue-workflow-run-1",
    }),
    ...overrides,
  };
}

function finalizationResumePlan() {
  return resumePlan({
    nextPhase: "decision",
    nextStep: "mark_done_ready",
    reportSummary:
      "Queue workflow run queue-workflow-run-1 resume plan status is blocked_missing_confirmation. No workflow steps were executed.",
    requiredConfirmation: true,
    requiredFreshGrant: true,
    slotReconciliations: [
      {
        aggregateDependencyState: "none",
        aggregateEvidenceState: "available",
        aggregateReviewState: "acked",
        aggregateTicketState: "review_needed",
        blockerCode: null,
        completionDecisionExists: false,
        completionDecisionId: null,
        evidenceBundleId: "bundle-upstream",
        evidenceExists: true,
        executorWidgetId: null,
        failureDecisionExists: false,
        failureDecisionId: null,
        messageId: "message-upstream",
        reviewMessageExists: true,
        reviewMessageStatus: "acked",
        runExists: true,
        runId: "run-upstream",
        slot: "upstream",
        taskExists: true,
        taskId: "task-upstream",
      },
      {
        aggregateDependencyState: "done",
        aggregateEvidenceState: "available",
        aggregateReviewState: "none",
        aggregateTicketState: "queued",
        blockerCode: null,
        completionDecisionExists: false,
        completionDecisionId: null,
        evidenceBundleId: null,
        evidenceExists: false,
        executorWidgetId: null,
        failureDecisionExists: false,
        failureDecisionId: null,
        messageId: null,
        reviewMessageExists: false,
        reviewMessageStatus: null,
        runExists: false,
        runId: null,
        slot: "downstream",
        taskExists: true,
        taskId: "task-downstream",
      },
    ],
    status: "blocked_missing_confirmation",
    workflowRun: workflowRun({
      phase: "decision",
      slotBindingsJson: JSON.stringify({
        downstream: { taskId: "task-downstream" },
        upstream: {
          evidenceBundleId: "bundle-upstream",
          messageId: "message-upstream",
          runId: "run-upstream",
          taskId: "task-upstream",
        },
      }),
      status: "paused",
      workflowRunId: "queue-workflow-run-1",
    }),
  });
}

function failureFinalizationResumePlan() {
  return resumePlan({
    nextPhase: "decision",
    nextStep: "fail_ready",
    reportSummary:
      "Queue workflow run queue-workflow-run-1 resume plan status is blocked_missing_confirmation. No workflow steps were executed.",
    requiredConfirmation: true,
    requiredFreshGrant: true,
    slotReconciliations: [
      {
        aggregateDependencyState: "none",
        aggregateEvidenceState: "available",
        aggregateReviewState: "acked",
        aggregateTicketState: "review_needed",
        blockerCode: null,
        completionDecisionExists: false,
        completionDecisionId: null,
        evidenceBundleId: "bundle-upstream",
        evidenceExists: true,
        executorWidgetId: null,
        failureDecisionExists: false,
        failureDecisionId: null,
        messageId: "message-upstream",
        reviewMessageExists: true,
        reviewMessageStatus: "acked",
        runExists: true,
        runId: "run-upstream",
        slot: "upstream",
        taskExists: true,
        taskId: "task-upstream",
      },
      {
        aggregateDependencyState: "waiting",
        aggregateEvidenceState: "none",
        aggregateReviewState: "none",
        aggregateTicketState: "queued",
        blockerCode: null,
        completionDecisionExists: false,
        completionDecisionId: null,
        evidenceBundleId: null,
        evidenceExists: false,
        executorWidgetId: null,
        failureDecisionExists: false,
        failureDecisionId: null,
        messageId: null,
        reviewMessageExists: false,
        reviewMessageStatus: null,
        runExists: false,
        runId: null,
        slot: "downstream",
        taskExists: true,
        taskId: "task-downstream",
      },
    ],
    status: "blocked_missing_confirmation",
    workflowRun: workflowRun({
      inputsSnapshotJson: JSON.stringify(validInputs()),
      phase: "decision",
      slotBindingsJson: JSON.stringify({
        downstream: { taskId: "task-downstream" },
        upstream: {
          evidenceBundleId: "bundle-upstream",
          messageId: "message-upstream",
          runId: "run-upstream",
          taskId: "task-upstream",
        },
      }),
      status: "paused",
      workflowId: "dependency_failure_smoke",
      workflowRunId: "queue-workflow-run-1",
    }),
  });
}

function workflowRequest(overrides: Record<string, unknown> = {}) {
  return {
    grant: validGrant("queue_acceptance_smoke"),
    inputs: validInputs(),
    moduleId: "queue",
    requestId: "workflow-request-1",
    type: HOBIT_AGENT_WORKFLOW_REQUEST_ENVELOPE_TYPE,
    workflowId: "dependency_acceptance_smoke",
    ...overrides,
  };
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
      executionTarget: {
        kind: "queue_local",
        providerId: "codex",
        queueOwnerWidgetInstanceId: "agent-queue-widget-id",
      },
      sandbox: "read_only",
      workspaceRoot: "C:/work/hobit",
    },
    tasks: [
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
    ],
  };
}

function workerEvidenceInputs() {
  return {
    phase: "worker_evidence",
    workerEvidence: {
      changedFiles: [],
      outcome: "completed",
      runId: "run-upstream",
      slot: "upstream",
      summary: "Worker completed.",
      taskId: "task-upstream",
      workflowRunId: "queue-workflow-run-1",
    },
  };
}

function explicitDependencyTaskIds() {
  return {
    downstream: "task-downstream",
    upstream: "task-upstream",
  };
}

function createSetupStartBridge(
  options: {
    applyStatus?: string;
    materializeStatus?: string;
    promoteStatus?: string;
    startStatus?: string;
  } = {},
) {
  const calls: Array<{ method: string } & Record<string, unknown>> = [];
  const materializeStatus = options.materializeStatus ?? "created";
  const applyStatus = options.applyStatus ?? "applied";
  const promoteStatus = options.promoteStatus ?? "promoted";
  const startStatus = options.startStatus ?? "started";
  const bridge: Partial<WorkspaceAgentQueueBridge> = {
    applyWorkflowRunSettings: vi.fn(async (request) => {
      calls.push({ method: "applyWorkflowRunSettings", ...request });
      const executionTarget = request.runSettings.executionTarget;
      const executionTargetKind = executionTarget?.kind ?? "agent_executor";
      const providerId = executionTarget?.providerId ?? "codex";
      const queueOwnerWidgetInstanceId =
        executionTarget?.kind === "queue_local"
          ? executionTarget.queueOwnerWidgetInstanceId
          : null;
      const executorWidgetId =
        executionTarget?.kind === "agent_executor"
          ? executionTarget.executorWidgetId
          : (request.runSettings.executorWidgetId ??
            queueOwnerWidgetInstanceId ??
            "executor-widget-1");
      return {
        action: null,
        binding:
          applyStatus === "applied" || applyStatus === "reused"
            ? {
                executionTargetHash: `execution-target-hash-${executionTargetKind}`,
                executionTargetKind,
                executorWidgetId,
                providerId,
                queueOwnerWidgetInstanceId,
                settingsHash: "settings-hash-upstream",
                slot: request.slot,
                taskId: request.taskId ?? "task-upstream",
                updateRunSettingsActionId: "workflow-action-settings",
                updateRunSettingsActionIdempotencyKey:
                  "queue-workflow-run-1:update_run_settings:upstream:settings-hash-upstream",
              }
            : null,
        blocker: null,
        conflict: null,
        status: applyStatus,
        task: null,
        workflowRun: null,
      };
    }),
    getQueueControlState: vi.fn(() => {
      calls.push({ method: "getQueueControlState" });
      return {
        backendOwned: true,
        queueEnabled: true,
        status: "manual_enabled" as const,
        version: 7,
      };
    }),
    materializeWorkflowTaskSlot: vi.fn(async (request) => {
      calls.push({ method: "materializeWorkflowTaskSlot", ...request });
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
    }),
    promoteWorkflowTaskSlot: vi.fn(async (request) => {
      calls.push({ method: "promoteWorkflowTaskSlot", ...request });
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
    }),
    startWorkflowAssignedTask: vi.fn(async (request) => {
      calls.push({ method: "startWorkflowAssignedTask", ...request });
      return {
        actionIdempotencyKey:
          request.workflowStartContext?.actionIdempotencyKey ?? null,
        blocker: null,
        currentRunState: "running",
        executorWidgetInstanceId:
          request.workflowStartContext?.executorWidgetId ?? "executor-widget-1",
        queueItemId: request.queueItemId,
        runId: "run-upstream",
        settingsHash: request.workflowStartContext?.settingsHash ?? null,
        status: startStatus,
        workbenchId: "workbench-1",
        workflowActionId: request.workflowStartContext?.workflowActionId ?? null,
        workflowRunId: request.workflowStartContext?.workflowRunId ?? null,
        workspaceId: "workspace-1",
      };
    }),
  };

  return { bridge, calls };
}

function recordWithPersistedCreateSetupActions(): QueueWorkflowPersistencePort["recordAgentQueueWorkflowRunnerReport"] {
  return vi.fn(async (request) => ({
    actions: ["create-upstream", "create-downstream", "settings", "promote", "start"].map(
      (suffix, index) => ({
        actionId: `workflow-action-${suffix}`,
        actionType:
          index < 2
            ? "create_task"
            : index === 2
              ? "update_run_settings"
              : index === 3
                ? "promote_task"
                : "start_worker",
        attemptCount: 1,
        blockerCode: null,
        blockerMessage: null,
        completedAt: "2026-06-22T00:00:00.000Z",
        createdAt: "2026-06-22T00:00:00.000Z",
        idempotencyKey: `${request.workflowRunId}:${suffix}`,
        resultRefsJson: "{}",
        startedAt: "2026-06-22T00:00:00.000Z",
        status: "completed",
        stepId: suffix,
        targetRefsJson: "{}",
        updatedAt: "2026-06-22T00:00:00.000Z",
        workflowRunId: request.workflowRunId,
        workspaceId: request.workspaceId,
      }),
    ),
    blocker: null,
    conflict: null,
    status: "recorded",
    workflowRun: workflowRun({
      currentStep: request.currentStep ?? null,
      phase: request.phase ?? "run_start",
      status: request.status,
      workflowRunId: request.workflowRunId,
      workspaceId: request.workspaceId,
    }),
  }));
}

function createSetupStartResumePlan(
  overrides: Parameters<typeof resumePlan>[0] = {},
) {
  return resumePlan({
    nextPhase: "setup",
    nextStep: "waiting_for_run_settings",
    status: "waiting_for_run_settings",
    workflowRun: workflowRun({
      inputsSnapshotJson: JSON.stringify(validInputs()),
      phase: "setup",
      slotBindingsJson: JSON.stringify({
        downstream: { taskId: "task-downstream" },
        upstream: { taskId: "task-upstream" },
      }),
      status: "paused",
      workflowRunId: "queue-workflow-run-1",
    }),
    ...overrides,
  });
}

function workerEvidenceResumePlan(
  overrides: Parameters<typeof resumePlan>[0] = {},
) {
  return resumePlan({
    nextPhase: "worker_evidence",
    nextStep: "waiting_for_worker_evidence",
    reportSummary:
      "Queue workflow run queue-workflow-run-1 resume plan status is waiting_for_worker_evidence. No workflow steps were executed.",
    status: "waiting_for_worker_evidence",
    workflowRun: workflowRun({
      inputsSnapshotJson: JSON.stringify(validInputs()),
      phase: "worker_evidence",
      slotBindingsJson: JSON.stringify({
        upstream: { runId: "run-upstream", taskId: "task-upstream" },
      }),
      status: "paused",
      workflowRunId: "queue-workflow-run-1",
    }),
    ...overrides,
  });
}

function reviewCreateResumePlan(
  overrides: Parameters<typeof resumePlan>[0] = {},
) {
  return resumePlan({
    nextPhase: "review",
    nextStep: "review_create_ready",
    reportSummary:
      "Queue workflow run queue-workflow-run-1 resume plan status is resume_ready. Next step: review_create_ready. Fresh grant required. No workflow steps were executed.",
    requiredConfirmation: false,
    requiredFreshGrant: true,
    slotReconciliations: [
      {
        aggregateDependencyState: "none",
        aggregateEvidenceState: "available",
        aggregateReviewState: "awaiting_review",
        aggregateTicketState: "awaiting_review",
        blockerCode: null,
        completionDecisionExists: false,
        completionDecisionId: null,
        evidenceBundleId: "bundle-upstream",
        evidenceExists: true,
        executorWidgetId: null,
        failureDecisionExists: false,
        failureDecisionId: null,
        messageId: null,
        reviewMessageExists: false,
        reviewMessageStatus: null,
        runExists: true,
        runId: "run-upstream",
        slot: "upstream",
        taskExists: true,
        taskId: "task-upstream",
      },
      {
        aggregateDependencyState: "waiting",
        aggregateEvidenceState: "none",
        aggregateReviewState: "none",
        aggregateTicketState: "queued",
        blockerCode: null,
        completionDecisionExists: false,
        completionDecisionId: null,
        evidenceBundleId: null,
        evidenceExists: false,
        executorWidgetId: null,
        failureDecisionExists: false,
        failureDecisionId: null,
        messageId: null,
        reviewMessageExists: false,
        reviewMessageStatus: null,
        runExists: false,
        runId: null,
        slot: "downstream",
        taskExists: true,
        taskId: "task-downstream",
      },
    ],
    status: "resume_ready",
    workflowRun: workflowRun({
      inputsSnapshotJson: JSON.stringify(validInputs()),
      phase: "review",
      slotBindingsJson: JSON.stringify({
        downstream: { taskId: "task-downstream" },
        upstream: {
          evidenceBundleId: "bundle-upstream",
          runId: "run-upstream",
          taskId: "task-upstream",
        },
      }),
      status: "paused",
      workflowRunId: "queue-workflow-run-1",
    }),
    ...overrides,
  });
}

function reviewAckResumePlan(
  overrides: Parameters<typeof resumePlan>[0] = {},
) {
  return reviewCreateResumePlan({
    blockers: [
      {
        blockerCode: "review_ack_missing",
        blockerMessage: "The durable review message exists but has not been ACKed.",
        completionDecisionId: null,
        evidenceBundleId: "bundle-upstream",
        failureDecisionId: null,
        messageId: "message-upstream",
        missingRequiredField: "messageId",
        runId: "run-upstream",
        slot: "upstream",
        taskId: "task-upstream",
      },
    ],
    nextStep: "review_ack_ready",
    reportSummary:
      "Queue workflow run queue-workflow-run-1 resume plan status is blocked_missing_review_ack. Next step: review_ack_ready. Fresh grant required. No workflow steps were executed.",
    slotReconciliations: [
      {
        aggregateDependencyState: "none",
        aggregateEvidenceState: "available",
        aggregateReviewState: "review_message_created",
        aggregateTicketState: "awaiting_review",
        blockerCode: null,
        completionDecisionExists: false,
        completionDecisionId: null,
        evidenceBundleId: "bundle-upstream",
        evidenceExists: true,
        executorWidgetId: null,
        failureDecisionExists: false,
        failureDecisionId: null,
        messageId: "message-upstream",
        reviewMessageExists: true,
        reviewMessageStatus: "created",
        runExists: true,
        runId: "run-upstream",
        slot: "upstream",
        taskExists: true,
        taskId: "task-upstream",
      },
      {
        aggregateDependencyState: "waiting",
        aggregateEvidenceState: "none",
        aggregateReviewState: "none",
        aggregateTicketState: "queued",
        blockerCode: null,
        completionDecisionExists: false,
        completionDecisionId: null,
        evidenceBundleId: null,
        evidenceExists: false,
        executorWidgetId: null,
        failureDecisionExists: false,
        failureDecisionId: null,
        messageId: null,
        reviewMessageExists: false,
        reviewMessageStatus: null,
        runExists: false,
        runId: null,
        slot: "downstream",
        taskExists: true,
        taskId: "task-downstream",
      },
    ],
    status: "blocked_missing_review_ack",
    workflowRun: workflowRun({
      inputsSnapshotJson: JSON.stringify(validInputs()),
      phase: "review",
      slotBindingsJson: JSON.stringify({
        downstream: { taskId: "task-downstream" },
        upstream: {
          evidenceBundleId: "bundle-upstream",
          messageId: "message-upstream",
          runId: "run-upstream",
          taskId: "task-upstream",
        },
      }),
      status: "paused",
      workflowRunId: "queue-workflow-run-1",
    }),
    ...overrides,
  });
}

function queueBridge(
  overrides: Partial<WorkspaceAgentQueueBridge> = {},
): WorkspaceAgentQueueBridge {
  return {
    createItem: vi.fn(async () => itemResult()),
    getSnapshot: vi.fn(async () => snapshotResult()),
    updateItem: vi.fn(async () => itemResult()),
    ...overrides,
  };
}

function itemResult(
  overrides: Partial<QueueWidgetItemSnapshot> = {},
): QueueWidgetActionResult<QueueWidgetItemSnapshot> {
  return {
    action: "queue.createItem",
    events: [],
    item: {
      dependencies: [],
      id: "queue-created",
      prompt: "Prompt",
      status: "queued",
      title: "Queue item",
      ...overrides,
    } as QueueWidgetItemSnapshot,
    message: "Queue item created. No task execution started.",
    ok: true,
    safetyClass: "safe_create_update",
  };
}

function snapshotResult(
  overrides: Partial<QueueWidgetSnapshot> = {},
): QueueWidgetActionResult<QueueWidgetSnapshot> {
  return {
    action: "queue.getSnapshot",
    events: [],
    message: "Queue snapshot returned.",
    ok: true,
    safetyClass: "safe_read",
    snapshot: {
      items: [],
      queueId: "workspace:workspace_1:agent-queue",
      selectedItem: null,
      selectedItemId: null,
      widgetType: "agent-queue",
      workspaceId: "workspace_1",
      ...overrides,
    } as QueueWidgetSnapshot,
  };
}

function aggregate({
  dependencyState = "none",
  reviewState = "none",
  taskId,
  ticketState = "queued",
  workerRunState = "not_started",
}: {
  dependencyState?: string;
  reviewState?: string;
  taskId: string;
  ticketState?: string;
  workerRunState?: string;
}): AgentQueueItemAggregate {
  return {
    blockers: [],
    commitState: "none",
    dependencyState,
    durableFlags: {
      commitState: false,
      completionState: false,
      dependencyState: true,
      evidenceState: true,
      failureState: false,
      frontendOverlayUsed: false,
      latestRunLink: false,
      reviewState: true,
      taskRow: true,
      validationState: true,
    },
    evidenceState: "available",
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
    title: "Queue task",
    updatedAt: "2026-06-22T00:00:00.000Z",
    validationState: "not_requested",
    workerRunState,
    workspaceId: "workspace-1",
  };
}

function evidenceQuery({
  runId,
  taskId,
}: {
  runId: string;
  taskId: string;
}): AgentQueueWorkerEvidenceQueryResult {
  return {
    aggregate: aggregate({ taskId }),
    durable: true,
    evidenceBundle: {
      bundleId: "bundle-upstream",
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

function reviewCreateResult(): AgentQueueReviewCreateMessageResult {
  return {
    aggregate: aggregate({ taskId: "task-upstream" }),
    blocker: null,
    durable: true,
    evidenceBundleId: "bundle-upstream",
    messageId: "message-upstream",
    reviewMessage: reviewMessage(),
    runId: "run-upstream",
    status: "succeeded",
    taskId: "task-upstream",
    workspaceId: "workspace-1",
  };
}

function reviewCommandResult(): AgentQueueReviewCommandResult {
  return {
    aggregate: aggregate({ reviewState: "in_review", taskId: "task-upstream" }),
    durable: true,
    messageId: "message-upstream",
    reviewMessage: reviewMessage(),
    taskId: "task-upstream",
    workspaceId: "workspace-1",
  };
}

function reviewMessage() {
  return {
    ackActorId: "workspace-agent:test",
    ackedAt: "2026-06-22T00:01:00.000Z",
    actorId: "workspace-agent:test",
    createdAt: "2026-06-22T00:00:00.000Z",
    messageBody: "Review this Queue item.",
    messageId: "message-upstream",
    metadataJson: null,
    runId: "run-upstream",
    runLinkId: null,
    status: "acked",
    taskId: "task-upstream",
    updatedAt: "2026-06-22T00:01:00.000Z",
    workspaceId: "workspace-1",
  };
}

function completionResult(): AgentQueueCompletionCommandResult {
  return {
    aggregate: aggregate({ taskId: "task-upstream", ticketState: "done" }),
    blocker: null,
    completionDecision: null,
    decisionId: "completion-decision-1",
    durable: true,
    evidenceBundleId: null,
    reviewMessageId: "message-upstream",
    runId: "run-upstream",
    status: "succeeded",
    taskId: "task-upstream",
    workspaceId: "workspace-1",
  };
}

function failureResult(): AgentQueueFailureCommandResult {
  return {
    aggregate: aggregate({ taskId: "task-upstream", ticketState: "failure" }),
    blocker: null,
    decisionId: null,
    durable: true,
    evidenceBundleId: "bundle-upstream",
    failureDecision: null,
    reviewMessageId: "message-upstream",
    runId: "run-upstream",
    status: "succeeded",
    taskId: "task-upstream",
    workspaceId: "workspace-1",
  };
}
