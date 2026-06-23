import { describe, expect, it, vi } from "vitest";

import { createActionRequest } from "./agents/broker";
import { createWorkspaceAgentHobitActionInvoker } from "./workspaceAgentBrokerActionRuntime";
import type { WorkspaceAgentQueueBridge } from "./workspaceAgentQueueBridge";
import type {
  QueueWidgetActionResult,
  QueueWidgetItemSnapshot,
  QueueWidgetSnapshot,
} from "./queue/agentQueueWidgetApiTypes";

describe("queue.control.get", () => {
  it("reads backend Queue control state without confirmation, mutation, or worker start", async () => {
    const bridge = queueBridge({
      getQueueControlState: () => ({
        backendOwned: true,
        globalExecutionState: "started",
        queueEnabled: true,
        reason: "operator enabled Queue manually",
        status: "manual_enabled",
        updatedAt: "2026-06-23T12:00:00.000Z",
        updatedByActorId: "operator",
        version: 3,
        workspaceId: "workspace-1",
      }),
    });
    const invoker = createWorkspaceAgentHobitActionInvoker({
      workspaceAgentQueueBridge: bridge,
    });

    const result = await invoker(
      createActionRequest({
        agentRoleId: "workspace_agent",
        capabilityId: "queue.control.get",
        dryRun: false,
        input: {},
        requestId: "queue-control-get-1",
      }),
    );

    expect(result.status).toBe("succeeded");
    expect(result.policyDecision.capability).toMatchObject({
      confirmationRequirement: "none",
      ownerSurface: "Agent Queue",
      sideEffectLevel: "read",
    });
    expect(result.result.output).toMatchObject({
      backendOwned: true,
      blockers: [],
      didAutoRunWorkers: false,
      didMutateQueue: false,
      didStartWorkers: false,
      queueEnabled: true,
      status: "manual_enabled",
      updatedAt: "2026-06-23T12:00:00.000Z",
      updatedByActorId: "operator",
      version: 3,
      workspaceId: "workspace-1",
    });
    expect(bridge.createItem).not.toHaveBeenCalled();
    expect(bridge.updateItem).not.toHaveBeenCalled();
  });

  it("returns disabled state and preserves optional workspace isolation", async () => {
    const invoker = createWorkspaceAgentHobitActionInvoker({
      workspaceAgentQueueBridge: queueBridge({
        getQueueControlState: () => ({
          backendOwned: true,
          globalExecutionState: "stopped",
          queueEnabled: false,
          status: "disabled",
          version: 4,
          workspaceId: "workspace-1",
        }),
      }),
    });

    const result = await invoker(
      createActionRequest({
        agentRoleId: "workspace_agent",
        capabilityId: "queue.control.get",
        input: {
          workspaceId: "workspace-1",
        },
        requestId: "queue-control-disabled-1",
      }),
    );

    expect(result.status).toBe("succeeded");
    expect(result.result.output).toMatchObject({
      queueEnabled: false,
      status: "disabled",
      version: 4,
      workspaceId: "workspace-1",
    });
  });

  it("rejects workspace mismatch and unsupported prose fields", async () => {
    const invoker = createWorkspaceAgentHobitActionInvoker({
      workspaceAgentQueueBridge: queueBridge({
        getQueueControlState: () => ({
          backendOwned: true,
          queueEnabled: false,
          status: "disabled",
          workspaceId: "workspace-1",
        }),
      }),
    });

    const mismatch = await invoker(
      createActionRequest({
        agentRoleId: "workspace_agent",
        capabilityId: "queue.control.get",
        input: {
          workspaceId: "workspace-2",
        },
        requestId: "queue-control-mismatch-1",
      }),
    );
    expect(mismatch.status).toBe("precondition_failed");
    expect(mismatch.result.output).toMatchObject({
      blockers: ["workspace_mismatch"],
      missingCapabilities: ["workspace_mismatch"],
      workspaceId: "workspace-1",
    });

    const invalid = await invoker(
      createActionRequest({
        agentRoleId: "workspace_agent",
        capabilityId: "queue.control.get",
        input: {
          titleHint: "Queue",
        },
        requestId: "queue-control-invalid-1",
      }),
    );
    expect(invalid.status).toBe("invalid_input");
    expect(invalid.result.message).toBe(
      "titleHint is not supported by queue.control.get.",
    );
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
    id: "queue-item-1",
    prompt: "Prompt",
    status: "queued",
    title: "Queue item",
    ...overrides,
  } as QueueWidgetItemSnapshot;

  return {
    action: "queue.createItem",
    events: [],
    item,
    message: "Queue item result.",
    ok: true,
    safetyClass: "safe_create_update",
  };
}

function snapshotResult(): QueueWidgetActionResult<QueueWidgetSnapshot> {
  return {
    action: "queue.getSnapshot",
    events: [],
    message: "Queue snapshot returned.",
    ok: true,
    safetyClass: "safe_read",
    snapshot: {
      items: [],
      queueId: "workspace:workspace-1:agent-queue",
      selectedItem: null,
      selectedItemId: null,
      widgetType: "agent-queue",
      workspaceId: "workspace-1",
    } as unknown as QueueWidgetSnapshot,
  };
}
