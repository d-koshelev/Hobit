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
  AgentQueueWorkerEvidenceQueryResult,
} from "../../../workspace/types";
import type { WorkspaceAgentQueueBridge } from "../../workspaceAgentQueueBridge";
import type {
  QueueWidgetActionResult,
  QueueWidgetItemSnapshot,
  QueueWidgetSnapshot,
} from "../../queue/agentQueueWidgetApiTypes";
import { runQueueWorkflowRunnerRuntimeAdapter } from "./queueWorkflowRunnerRuntimeAdapter";

describe("QueueWorkflowRunnerRuntimeAdapter", () => {
  it("invokes read-only runner for valid dependency_acceptance_smoke with explicit ids", async () => {
    const bridge = queueBridge({
      getItemAggregate: vi.fn(async ({ taskId }: { taskId: string }) =>
        aggregate({ taskId }),
      ),
      listItemAggregates: vi.fn(async () => []),
    });

    const result = await runQueueWorkflowRunnerRuntimeAdapter({
      queueBridge: bridge,
      workflowRequestRead: validRead(
        workflowRequest({
          inputs: {
            ...validInputs(),
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
    expect(bridge.getItemAggregate).toHaveBeenCalledTimes(4);
  });

  it("does not invoke the runner for invalid workflow envelopes", async () => {
    const bridge = queueBridge({
      getItemAggregate: vi.fn(),
      markItemDone: vi.fn(),
    });

    const result = await runQueueWorkflowRunnerRuntimeAdapter({
      queueBridge: bridge,
      workflowRequestRead: readWorkflow({ ...workflowRequest(), requestId: "" }),
    });

    expect(result).toMatchObject({
      invoked: false,
      status: "invalid_request",
    });
    expect(bridge.getItemAggregate).not.toHaveBeenCalled();
    expect(bridge.markItemDone).not.toHaveBeenCalled();
  });

  it("does not invoke the runner for unknown Queue workflows", async () => {
    const bridge = queueBridge({ getItemAggregate: vi.fn() });

    const result = await runQueueWorkflowRunnerRuntimeAdapter({
      queueBridge: bridge,
      workflowRequestRead: validRead(
        workflowRequest({ workflowId: "unknown_queue_workflow" }),
      ),
    });

    expect(result).toMatchObject({
      invoked: false,
      status: "unsupported",
      unsupportedReason: "workflow_not_declared",
    });
    expect(bridge.getItemAggregate).not.toHaveBeenCalled();
  });

  it("does not invoke validation-deferred terminal_failure", async () => {
    const bridge = queueBridge({
      getItemAggregate: vi.fn(),
      failItem: vi.fn(),
    });

    const result = await runQueueWorkflowRunnerRuntimeAdapter({
      queueBridge: bridge,
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
  });

  it("returns runner blockers for missing task ids without port mutations", async () => {
    const bridge = queueBridge({
      getItemAggregate: vi.fn(),
      listItemAggregates: vi.fn(async () => []),
      markItemDone: vi.fn(),
    });

    const result = await runQueueWorkflowRunnerRuntimeAdapter({
      queueBridge: bridge,
      workflowRequestRead: validRead(workflowRequest()),
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

    const result = await runQueueWorkflowRunnerRuntimeAdapter({
      queueBridge: bridge,
      workflowRequestRead: validRead(
        workflowRequest({
          inputs: {
            ...validInputs(),
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

  it("review phase calls evidence, create review message, and ACK review message", async () => {
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

    const result = await runQueueWorkflowRunnerRuntimeAdapter({
      actorId: "workspace-agent:test",
      queueBridge: bridge,
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

    const result = await runQueueWorkflowRunnerRuntimeAdapter({
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

    const result = await runQueueWorkflowRunnerRuntimeAdapter({
      actorId: "workspace-agent:test",
      queueBridge: bridge,
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
  });

  it("failure finalization calls failItem only with structured failureReason", async () => {
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

    const result = await runQueueWorkflowRunnerRuntimeAdapter({
      actorId: "workspace-agent:test",
      queueBridge: bridge,
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
  });

  it("blocks finalization before markDone when confirmation is missing", async () => {
    const bridge = queueBridge({
      getItemAggregate: vi.fn(async ({ taskId }: { taskId: string }) =>
        aggregate({ reviewState: "in_review", taskId }),
      ),
      listItemAggregates: vi.fn(async () => []),
      markItemDone: vi.fn(),
    });

    const result = await runQueueWorkflowRunnerRuntimeAdapter({
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
    });

    const result = await runQueueWorkflowRunnerRuntimeAdapter({
      queueBridge: bridge,
      workflowRequestRead: readWorkflow(
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
      invoked: false,
      status: "invalid_request",
    });
    expect(bridge.failItem).not.toHaveBeenCalled();
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

function explicitDependencyTaskIds() {
  return {
    downstream: "task-downstream",
    upstream: "task-upstream",
  };
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
    decisionId: null,
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
