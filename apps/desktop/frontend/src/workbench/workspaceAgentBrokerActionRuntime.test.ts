import { describe, expect, it, vi } from "vitest";

import {
  createHobitAgentActionRequestFromEnvelope,
  readHobitAgentActionRequestEnvelope,
} from "./agents/broker";
import {
  createWorkspaceAgentHobitActionInvoker,
  workspaceAgentHobitActionResultMessage,
} from "./workspaceAgentBrokerActionRuntime";
import runtimeSource from "./workspaceAgentBrokerActionRuntime.ts?raw";
import envelopeSource from "./agents/broker/hobitAgentActionRequestEnvelope.ts?raw";
import type { WorkspaceAgentQueueBridge } from "./workspaceAgentQueueBridge";
import type {
  AgentQueueItemAggregate,
  AgentQueueReviewCreateMessageResult,
  AgentQueueWorkerEvidenceQueryResult,
  AgentQueueWorkerFinishedCommandResult,
} from "../workspace/types";
import type {
  QueueWidgetActionResult,
  QueueWidgetItemSnapshot,
  QueueWidgetSnapshot,
} from "./queue/agentQueueWidgetApiTypes";

describe("workspaceAgentBrokerActionRuntime structured action requests", () => {
  it("invokes a valid Queue lifecycle envelope through the Workspace Agent broker runtime", async () => {
    const getSnapshot = vi.fn();
    const recordWorkerFinished = vi.fn(async () =>
      workerFinishedCommandResult({
        aggregate: queueAggregate({
          evidenceState: "available",
          nextActions: [
            {
              available: true,
              code: "create_review_message",
              label: "Create review message",
              unavailableReason: null,
            },
          ],
          reviewState: "awaiting_review",
          ticketState: "awaiting_review",
          workerRunState: "completed",
        }),
      }),
    );
    const invoker = createWorkspaceAgentHobitActionInvoker({
      workspaceAgentQueueBridge: queueBridge({
        getSnapshot,
        recordWorkerFinished,
      }),
    });
    const parsed = readHobitAgentActionRequestEnvelope(
      JSON.stringify({
        capabilityId: "queue.lifecycle.agentFinished",
        dryRun: false,
        input: {
          attemptId: "attempt-1",
          finalAgentMessage: "Implemented the requested changes.",
          outcome: "completed",
          runId: "run-1",
          taskId: "task-1",
          validationSummary: "typecheck passed",
        },
        requestId: "runtime-lifecycle-valid",
        type: "hobit.action.request",
      }),
    );

    expect(parsed.status).toBe("valid");
    if (parsed.status !== "valid") {
      throw new Error("Expected valid lifecycle envelope.");
    }

    const result = await invoker(
      createHobitAgentActionRequestFromEnvelope({
        agentId: "workspace-agent",
        createdAt: "2026-06-16T12:00:00.000Z",
        envelope: parsed.envelope,
      }),
    );

    expect(result.status).toBe("succeeded");
    expect(recordWorkerFinished).toHaveBeenCalledWith(
      expect.objectContaining({
        outcome: "completed",
        runId: "run-1",
        summary: "Implemented the requested changes.",
        taskId: "task-1",
      }),
    );
    expect(result.result.output).toMatchObject({
      evidenceBundleId: "bundle-1",
      queueMutation: "backend_domain",
      ticketState: "awaiting_review",
      wouldStartWorkers: false,
    });
    expect(workspaceAgentHobitActionResultMessage(result.result)).toBe(
      "Queue lifecycle agent finished.",
    );
    expect(getSnapshot).not.toHaveBeenCalled();
  });

  it("returns compact invalid_input for an invalid lifecycle envelope", async () => {
    const getSnapshot = vi.fn();
    const invoker = createWorkspaceAgentHobitActionInvoker({
      workspaceAgentQueueBridge: queueBridge({ getSnapshot }),
    });
    const parsed = readHobitAgentActionRequestEnvelope(
      JSON.stringify({
        capabilityId: "queue.lifecycle.agentFinished",
        dryRun: false,
        input: {
          outcome: "completed",
          runId: "run-1",
          taskId: "task-1",
        },
        type: "hobit.action.request",
      }),
    );

    expect(parsed.status).toBe("valid");
    if (parsed.status !== "valid") {
      throw new Error("Expected valid envelope with invalid capability input.");
    }

    const result = await invoker(
      createHobitAgentActionRequestFromEnvelope({
        agentId: "workspace-agent",
        createdAt: "2026-06-16T12:00:00.000Z",
        envelope: parsed.envelope,
      }),
    );

    expect(result.status).toBe("invalid_input");
    expect(workspaceAgentHobitActionResultMessage(result.result)).toBe(
      "Invalid Hobit action request. finalAgentMessage is required.",
    );
    expect(getSnapshot).not.toHaveBeenCalled();
  });

  it("invokes queue.lifecycle.get through backend aggregate reads without Queue snapshots", async () => {
    const getSnapshot = vi.fn();
    const getItemAggregate = vi.fn(async ({ taskId }: { taskId: string }) =>
      queueAggregate({
        blockers: [
          {
            code: "evidence_not_durable",
            message: "Evidence is not durable yet.",
          },
        ],
        commitState: "not_durable",
        dependencyState: "unknown",
        evidenceState: "not_durable",
        evidenceSummary: {
          available: false,
          notDurableReason: "Evidence is not durable yet.",
          source: "aggregate",
          summary: null,
        },
        latestRun: {
          completedAt: "2026-06-16T12:02:00.000Z",
          executorWidgetId: "executor-1",
          finalDetailAvailable: true,
          reviewStatus: "review_needed",
          runId: "run-1",
          runLinkId: "link-1",
          source: "manual",
          startedAt: "2026-06-16T12:00:00.000Z",
          status: "completed",
          validationStatus: null,
        },
        reviewState: "in_review",
        taskId,
        ticketState: "awaiting_review",
        validationState: "unknown",
        workerRunState: "completed",
      }),
    );
    const invoker = createWorkspaceAgentHobitActionInvoker({
      workspaceAgentQueueBridge: queueBridge({ getItemAggregate, getSnapshot }),
    });
    const parsed = readHobitAgentActionRequestEnvelope(
      JSON.stringify({
        capabilityId: "queue.lifecycle.get",
        dryRun: false,
        input: {
          taskId: "task-1",
        },
        requestId: "runtime-lifecycle-get",
        type: "hobit.action.request",
      }),
    );

    expect(parsed.status).toBe("valid");
    if (parsed.status !== "valid") {
      throw new Error("Expected valid lifecycle get envelope.");
    }

    const result = await invoker(
      createHobitAgentActionRequestFromEnvelope({
        agentId: "workspace-agent",
        createdAt: "2026-06-16T12:00:00.000Z",
        envelope: parsed.envelope,
      }),
    );

    expect(result.status).toBe("succeeded");
    expect(getItemAggregate).toHaveBeenCalledWith({ taskId: "task-1" });
    expect(getSnapshot).not.toHaveBeenCalled();
    expect(result.result.output).toMatchObject({
      authoritativeBackendAggregate: true,
      blockerReasons: ["Evidence is not durable yet."],
      commitState: "not_durable",
      dependencyState: "unknown",
      evidenceState: "not_durable",
      evidenceSummary: {
        available: false,
        notDurableReason: "Evidence is not durable yet.",
        source: "aggregate",
        summary: null,
      },
      latestRun: {
        runId: "run-1",
        status: "completed",
      },
      lifecycle: null,
      reviewState: "in_review",
      taskId: "task-1",
      ticketState: "awaiting_review",
      validationState: "unknown",
      workerRunState: "completed",
    });
  });

  it("invokes queue.review.getEvidenceBundle through backend evidence reads without Queue snapshots", async () => {
    const getSnapshot = vi.fn();
    const getWorkerEvidenceBundle = vi.fn(
      async ({ runId, taskId }: { runId?: string | null; taskId: string }) =>
        workerEvidenceQueryResult({
          aggregate: queueAggregate({
            evidenceState: "available",
            nextActions: [
              {
                available: true,
                code: "create_review_message",
                label: "Create review message",
                unavailableReason: null,
              },
            ],
            taskId,
            ticketState: "awaiting_review",
            workerRunState: "completed",
          }),
          runId: runId ?? "run-1",
        }),
    );
    const invoker = createWorkspaceAgentHobitActionInvoker({
      workspaceAgentQueueBridge: queueBridge({
        getSnapshot,
        getWorkerEvidenceBundle,
      }),
    });
    const parsed = readHobitAgentActionRequestEnvelope(
      JSON.stringify({
        capabilityId: "queue.review.getEvidenceBundle",
        dryRun: false,
        input: {
          runId: "run-1",
          taskId: "task-1",
        },
        requestId: "runtime-review-evidence-get",
        type: "hobit.action.request",
      }),
    );

    expect(parsed.status).toBe("valid");
    if (parsed.status !== "valid") {
      throw new Error("Expected valid evidence read envelope.");
    }

    const result = await invoker(
      createHobitAgentActionRequestFromEnvelope({
        agentId: "workspace-agent",
        createdAt: "2026-06-16T12:00:00.000Z",
        envelope: parsed.envelope,
      }),
    );

    expect(result.status).toBe("succeeded");
    expect(getWorkerEvidenceBundle).toHaveBeenCalledWith({
      runId: "run-1",
      taskId: "task-1",
    });
    expect(getSnapshot).not.toHaveBeenCalled();
    expect(result.result.output).toMatchObject({
      evidenceBundleId: "bundle-1",
      evidenceBundlePersistence: "backend_durable",
      evidenceState: "available",
      nextSuggestedCapability: "queue.review.createMessage",
      runId: "run-1",
      taskId: "task-1",
    });
  });

  it("surfaces queue.review.createMessage backend blockers with aggregate states", async () => {
    const getSnapshot = vi.fn();
    const createReviewMessage = vi.fn(async () =>
      reviewCreateMessageBlockedResult({
        aggregate: queueAggregate({
          evidenceState: "none",
          reviewState: "not_requested",
          taskId: "task-1",
          ticketState: "draft",
          workerRunState: "not_started",
        }),
      }),
    );
    const invoker = createWorkspaceAgentHobitActionInvoker({
      workspaceAgentQueueBridge: queueBridge({
        createReviewMessage,
        getSnapshot,
      }),
    });
    const parsed = readHobitAgentActionRequestEnvelope(
      JSON.stringify({
        capabilityId: "queue.review.createMessage",
        dryRun: false,
        input: {
          taskId: "task-1",
        },
        requestId: "runtime-review-create-blocked",
        type: "hobit.action.request",
      }),
    );

    expect(parsed.status).toBe("valid");
    if (parsed.status !== "valid") {
      throw new Error("Expected valid review create envelope.");
    }

    const result = await invoker(
      createHobitAgentActionRequestFromEnvelope({
        agentId: "workspace-agent",
        createdAt: "2026-06-16T12:00:00.000Z",
        envelope: parsed.envelope,
      }),
    );

    expect(result.status).toBe("failed");
    expect(createReviewMessage).toHaveBeenCalledWith({
      actorId: "workspace-agent",
      evidenceBundleId: null,
      messageBody: null,
      runId: null,
      taskId: "task-1",
    });
    expect(result.result.message).toContain("task_is_draft");
    expect(result.result.message).toContain("ticketState=draft");
    expect(result.result.output).toMatchObject({
      backendCreateMessageStatus: "precondition_failed",
      blockerCode: "task_is_draft",
      evidenceState: "none",
      reviewState: "not_requested",
      ticketState: "draft",
      workerRunState: "not_started",
    });
    expect(workspaceAgentHobitActionResultMessage(result.result)).toContain(
      "task_is_draft",
    );
    expect(workspaceAgentHobitActionResultMessage(result.result)).not.toBe(
      "Hobit action failed. Queue review message could not be created.",
    );
    expect(getSnapshot).not.toHaveBeenCalled();
  });

  it("keeps prose-only assistant responses as prose", () => {
    expect(
      readHobitAgentActionRequestEnvelope(
        "Normal assistant response without app action.",
      ),
    ).toEqual({ status: "none" });
  });

  it("does not add natural-language routing in the Workspace Agent broker runtime", () => {
    for (const source of [runtimeSource, envelopeSource]) {
      expect(source).not.toContain("new RegExp");
      expect(source).not.toContain(".match(");
      expect(source).not.toContain("classifyUserIntent");
      expect(source).not.toContain(["user text", " -> regex"].join(""));
    }
  });
});

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
  const item = {
    dependencies: [],
    id: "queue-created",
    prompt: "Prompt",
    status: "queued",
    title: "Queue item",
    ...overrides,
  } as QueueWidgetItemSnapshot;

  return {
    action: "queue.createItem",
    events: [],
    item,
    message: "Queue item created. No task execution started.",
    ok: true,
    safetyClass: "safe_create_update",
  };
}

function snapshotResult(
  overrides: Partial<QueueWidgetSnapshot> = {},
): QueueWidgetActionResult<QueueWidgetSnapshot> {
  const snapshot = {
    items: [],
    queueId: "workspace:workspace_1:agent-queue",
    selectedItem: null,
    selectedItemId: null,
    widgetType: "agent-queue",
    workspaceId: "workspace_1",
    ...overrides,
  } as unknown as QueueWidgetSnapshot;

  return {
    action: "queue.getSnapshot",
    events: [],
    message: "Queue snapshot returned.",
    ok: true,
    safetyClass: "safe_read",
    snapshot,
  };
}

function snapshotItem(
  overrides: Partial<QueueWidgetItemSnapshot> = {},
): QueueWidgetItemSnapshot {
  return {
    dependencies: [],
    id: "task-1",
    prompt: "Implement the request.",
    status: "queued",
    title: "Queue item",
    workspaceId: "workspace_1",
    ...overrides,
  } as QueueWidgetItemSnapshot;
}

function queueAggregate(
  overrides: Partial<AgentQueueItemAggregate> = {},
): AgentQueueItemAggregate {
  return {
    blockers: [],
    commitState: "none",
    dependencyState: "none",
    durableFlags: {
      commitState: true,
      completionState: false,
      dependencyState: true,
      evidenceState: overrides.evidenceState !== "not_durable",
      frontendOverlayUsed: false,
      latestRunLink: false,
      reviewState: true,
      taskRow: true,
      validationState: true,
    },
    evidenceState: "none",
    evidenceSummary: null,
    latestRun: null,
    nextActions: [],
    reviewState: "not_requested",
    runSettings: {
      approvalPolicy: "on_request",
      assignedExecutorWidgetId: null,
      codexExecutable: "codex.cmd",
      executionPolicy: "manual",
      executionWorkspace: "C:/repo",
      sandbox: "workspace_write",
    },
    taskId: "task-1",
    ticketState: "queued",
    title: "Queue item",
    updatedAt: "2026-06-16T12:00:00.000Z",
    validationState: "not_requested",
    workerRunState: "not_started",
    workspaceId: "workspace_1",
    ...overrides,
  };
}

function workerFinishedCommandResult({
  aggregate = queueAggregate(),
}: {
  aggregate?: AgentQueueItemAggregate;
} = {}): AgentQueueWorkerFinishedCommandResult {
  return {
    aggregate,
    bundleId: "bundle-1",
    durable: true,
    evidenceBundle: {
      bundleId: "bundle-1",
      changedFiles: [],
      changedFilesCount: 0,
      changedFilesSummary: null,
      createdAt: "2026-06-16T12:01:00.000Z",
      errorSummary: null,
      executorWidgetId: "executor-1",
      metadataJson: null,
      outcome: "completed",
      runId: "run-1",
      runLinkId: "link-1",
      source: "workspace_agent",
      summary: "Implemented the requested changes.",
      taskId: aggregate.taskId,
      updatedAt: "2026-06-16T12:01:00.000Z",
      validationSummary: "typecheck passed",
      workerId: "workspace-agent",
      workspaceId: aggregate.workspaceId,
    },
    runId: "run-1",
    taskId: aggregate.taskId,
    workspaceId: aggregate.workspaceId,
  };
}

function workerEvidenceQueryResult({
  aggregate = queueAggregate(),
  runId = "run-1",
}: {
  aggregate?: AgentQueueItemAggregate;
  runId?: string;
} = {}): AgentQueueWorkerEvidenceQueryResult {
  return {
    aggregate,
    durable: true,
    evidenceBundle: {
      bundleId: "bundle-1",
      changedFiles: [],
      changedFilesCount: 0,
      changedFilesSummary: null,
      createdAt: "2026-06-16T12:01:00.000Z",
      errorSummary: null,
      executorWidgetId: "executor-1",
      metadataJson: null,
      outcome: "completed",
      runId,
      runLinkId: "link-1",
      source: "workspace_agent",
      summary: "Implemented the requested changes.",
      taskId: aggregate.taskId,
      updatedAt: "2026-06-16T12:01:00.000Z",
      validationSummary: "typecheck passed",
      workerId: "workspace-agent",
      workspaceId: aggregate.workspaceId,
    },
    runId,
    state: "available",
    taskId: aggregate.taskId,
    workspaceId: aggregate.workspaceId,
  };
}

function reviewCreateMessageBlockedResult({
  aggregate = queueAggregate({
    evidenceState: "none",
    reviewState: "not_requested",
    ticketState: "draft",
    workerRunState: "not_started",
  }),
}: {
  aggregate?: AgentQueueItemAggregate;
} = {}): AgentQueueReviewCreateMessageResult {
  return {
    aggregate,
    blocker: {
      blockerCode: "task_is_draft",
      blockerMessage: "Draft Queue tasks cannot create review messages.",
      durableEvidenceRequired: false,
      evidenceBundleId: null,
      evidenceBundleIdRequired: false,
      evidenceState: aggregate.evidenceState,
      existingMessageId: null,
      missingRequiredField: null,
      nextSuggestedCapability: "queue.item.updateRunSettings",
      reviewMessageAlreadyExists: false,
      reviewState: aggregate.reviewState,
      runId: null,
      runIdRequired: false,
      taskId: aggregate.taskId,
      ticketState: aggregate.ticketState,
      workerRunState: aggregate.workerRunState,
    },
    durable: false,
    evidenceBundleId: null,
    messageId: null,
    reviewMessage: null,
    runId: null,
    status: "precondition_failed",
    taskId: aggregate.taskId,
    workspaceId: aggregate.workspaceId,
  };
}
