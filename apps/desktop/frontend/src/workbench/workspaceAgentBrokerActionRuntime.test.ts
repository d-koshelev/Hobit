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
        evidenceState: "not_durable",
        taskId,
        ticketState: "awaiting_review",
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
      evidenceState: "not_durable",
      lifecycle: null,
      taskId: "task-1",
      ticketState: "awaiting_review",
    });
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
