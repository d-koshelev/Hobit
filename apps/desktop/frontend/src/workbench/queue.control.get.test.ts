import { describe, expect, it, vi } from "vitest";

import { createActionRequest } from "./agents/broker";
import { createWorkspaceAgentHobitActionInvoker } from "./workspaceAgentBrokerActionRuntime";
import type {
  WorkspaceAgentQueueBridge,
  WorkspaceAgentQueueSetManualEnabledResult,
} from "./workspaceAgentQueueBridge";
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

describe("queue.control.setManualEnabled", () => {
  it("sets backend Queue control to manual_enabled without confirmation, task mutation, or worker start", async () => {
    const setQueueControlManualEnabled = vi.fn(async () =>
      setManualEnabledResult({
        controlState: {
          backendOwned: true,
          queueEnabled: true,
          reason: "prepare smoke",
          status: "manual_enabled",
          updatedAt: "2026-06-23T12:05:00.000Z",
          updatedByActorId: "workspace-agent:test",
          version: 4,
          workspaceId: "workspace-1",
        },
        didMutateQueueControlState: true,
        status: "succeeded",
      }),
    );
    const bridge = queueBridge({ setQueueControlManualEnabled });
    const invoker = createWorkspaceAgentHobitActionInvoker({
      workspaceAgentQueueBridge: bridge,
    });

    const result = await invoker(
      createActionRequest({
        agentId: "workspace-agent:test",
        agentRoleId: "workspace_agent",
        capabilityId: "queue.control.setManualEnabled",
        dryRun: false,
        input: {
          expectedVersion: 3,
          reason: "prepare smoke",
          workspaceId: "workspace-1",
        },
        requestId: "queue-control-set-manual-enabled-1",
      }),
    );

    expect(result.status).toBe("succeeded");
    expect(result.policyDecision.capability).toMatchObject({
      confirmationRequirement: "recommended",
      ownerSurface: "Agent Queue",
      sideEffectLevel: "write",
    });
    expect(result.result.output).toMatchObject({
      backendOwned: true,
      blockers: [],
      controlState: {
        reason: "prepare smoke",
        status: "manual_enabled",
        updatedAt: "2026-06-23T12:05:00.000Z",
        updatedByActorId: "workspace-agent:test",
        version: 4,
      },
      didAutoRunWorkers: false,
      didCreateRunLinks: false,
      didInvokeWorkflowRunner: false,
      didMutateEvidence: false,
      didMutateFinalization: false,
      didMutateQueueControlState: true,
      didMutateQueueTasks: false,
      didMutateReviews: false,
      didScheduleOrAutodispatch: false,
      didStartDownstream: false,
      didStartWorkers: false,
      queueEnabled: true,
      resultStatus: "succeeded",
      workspaceId: "workspace-1",
    });
    expect(setQueueControlManualEnabled).toHaveBeenCalledWith(
      expect.objectContaining({
        actorId: "workspace-agent:test",
        dryRun: false,
        expectedVersion: 3,
        reason: "prepare smoke",
        workspaceId: "workspace-1",
      }),
    );
    expect(bridge.createItem).not.toHaveBeenCalled();
    expect(bridge.updateItem).not.toHaveBeenCalled();
    expect(bridge.enableQueue).toBeUndefined();
    expect(bridge.startQueueLinkedRun).toBeUndefined();
  });

  it("returns already_in_state without mutating Queue control when already manual_enabled", async () => {
    const invoker = createWorkspaceAgentHobitActionInvoker({
      workspaceAgentQueueBridge: queueBridge({
        setQueueControlManualEnabled: vi.fn(async () =>
          setManualEnabledResult({
            controlState: {
              backendOwned: true,
              queueEnabled: true,
              status: "manual_enabled",
              version: 7,
              workspaceId: "workspace-1",
            },
            didMutateQueueControlState: false,
            status: "already_in_state",
          }),
        ),
      }),
    });

    const result = await invoker(
      createActionRequest({
        agentRoleId: "workspace_agent",
        capabilityId: "queue.control.setManualEnabled",
        input: {},
        requestId: "queue-control-already-manual-1",
      }),
    );

    expect(result.status).toBe("already_exists");
    expect(result.result.output).toMatchObject({
      didMutateQueueControlState: false,
      queueEnabled: true,
      resultStatus: "already_in_state",
      workspaceId: "workspace-1",
    });
  });

  it("returns structured version_conflict and workspace_not_found blockers", async () => {
    const setQueueControlManualEnabled = vi
      .fn()
      .mockResolvedValueOnce(
        setManualEnabledResult({
          blockerReasons: ["Queue control state version conflict."],
          controlState: {
            backendOwned: true,
            queueEnabled: false,
            status: "disabled",
            version: 5,
            workspaceId: "workspace-1",
          },
          status: "version_conflict",
        }),
      )
      .mockResolvedValueOnce(
        setManualEnabledResult({
          blockerReasons: ["Workspace was not found."],
          controlState: null,
          status: "workspace_not_found",
          workspaceId: "missing-workspace",
        }),
      );
    const invoker = createWorkspaceAgentHobitActionInvoker({
      workspaceAgentQueueBridge: queueBridge({ setQueueControlManualEnabled }),
    });

    const conflict = await invoker(
      createActionRequest({
        agentRoleId: "workspace_agent",
        capabilityId: "queue.control.setManualEnabled",
        input: { expectedVersion: 4 },
        requestId: "queue-control-version-conflict-1",
      }),
    );
    const missingWorkspace = await invoker(
      createActionRequest({
        agentRoleId: "workspace_agent",
        capabilityId: "queue.control.setManualEnabled",
        input: { workspaceId: "missing-workspace" },
        requestId: "queue-control-missing-workspace-1",
      }),
    );

    expect(conflict.status).toBe("precondition_failed");
    expect(conflict.result.reasonCode).toBe("version_conflict");
    expect(conflict.result.output).toMatchObject({
      blockers: ["Queue control state version conflict."],
      didMutateQueueControlState: false,
      resultStatus: "version_conflict",
    });
    expect(missingWorkspace.status).toBe("precondition_failed");
    expect(missingWorkspace.result.reasonCode).toBe("workspace_not_found");
    expect(missingWorkspace.result.output).toMatchObject({
      blockers: ["Workspace was not found."],
      resultStatus: "workspace_not_found",
      workspaceId: "missing-workspace",
    });
  });

  it("rejects prose, actor, and unrelated ids as invalid input", async () => {
    const setQueueControlManualEnabled = vi.fn(async () =>
      setManualEnabledResult({ status: "succeeded" }),
    );
    const invoker = createWorkspaceAgentHobitActionInvoker({
      workspaceAgentQueueBridge: queueBridge({ setQueueControlManualEnabled }),
    });

    const invalid = await invoker(
      createActionRequest({
        agentRoleId: "workspace_agent",
        capabilityId: "queue.control.setManualEnabled",
        input: {
          actorId: "model-invented",
          confirmationText: "I confirm",
          taskId: "task-1",
        },
        requestId: "queue-control-set-invalid-1",
      }),
    );

    expect(invalid.status).toBe("invalid_input");
    expect(invalid.result.message).toBe(
      "actorId is not supported by queue.control.setManualEnabled.",
    );
    expect(setQueueControlManualEnabled).not.toHaveBeenCalled();
  });

  it("returns a structured policy blocker when side-effecting invoke policy requires dry-run first", async () => {
    const setQueueControlManualEnabled = vi.fn(async () =>
      setManualEnabledResult({ status: "succeeded" }),
    );
    const invoker = createWorkspaceAgentHobitActionInvoker({
      policy: {
        requireDryRunBeforeSideEffectingInvoke: true,
      },
      workspaceAgentQueueBridge: queueBridge({ setQueueControlManualEnabled }),
    });

    const result = await invoker(
      createActionRequest({
        agentRoleId: "workspace_agent",
        capabilityId: "queue.control.setManualEnabled",
        dryRun: false,
        input: {},
        requestId: "queue-control-set-policy-blocked-1",
      }),
    );

    expect(result.status).toBe("dry_run_required");
    expect(result.result.reasonCode).toBe("precondition_failed");
    expect(setQueueControlManualEnabled).not.toHaveBeenCalled();
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

function setManualEnabledResult(
  overrides: Partial<WorkspaceAgentQueueSetManualEnabledResult> = {},
): WorkspaceAgentQueueSetManualEnabledResult {
  const status = overrides.status ?? "succeeded";
  const controlState = Object.prototype.hasOwnProperty.call(
    overrides,
    "controlState",
  )
    ? overrides.controlState ?? null
    : {
        backendOwned: true,
        queueEnabled: true,
        status: "manual_enabled" as const,
        version: 1,
        workspaceId: "workspace-1",
      };
  const queueEnabled =
    overrides.queueEnabled ?? controlState?.queueEnabled ?? status === "succeeded";

  return {
    backendOwned: true,
    blockerReasons: [],
    controlState,
    didAutoRunWorkers: false,
    didCreateRunLinks: false,
    didInvokeWorkflowRunner: false,
    didMutateEvidence: false,
    didMutateFinalization: false,
    didMutateQueueControlState: status === "succeeded",
    didMutateQueueTasks: false,
    didMutateReviews: false,
    didScheduleOrAutodispatch: false,
    didStartDownstream: false,
    didStartWorkers: false,
    message: "Queue manual control result.",
    ok: status === "succeeded" || status === "already_in_state",
    queueEnabled,
    status,
    workspaceId: controlState?.workspaceId ?? "workspace-1",
    ...overrides,
  };
}
