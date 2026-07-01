import { describe, expect, it } from "vitest";

import { createActionRequest } from "./agents/broker";
import { createWorkspaceAgentHobitActionInvoker } from "./workspaceAgentBrokerActionRuntime";
import type { WidgetInstance } from "./types";
import { createWorkspaceAgentLiveWorkbenchContextSnapshot } from "./workspaceAgentLiveWorkbenchContext";

describe("workspace.context.get", () => {
  it("is registered and handled as a read-only Workspace Agent capability", async () => {
    const invoker = createWorkspaceAgentHobitActionInvoker({
      workspaceAgentLiveContext: {
        currentRuntimeMode: "test_renderer",
        getQueueControlState: () => ({
          backendOwned: true,
          queueEnabled: false,
          reason: "manual smoke setup",
          status: "disabled",
          updatedAt: "2026-06-23T12:00:00.000Z",
          updatedByActorId: "operator",
          version: 7,
          workspaceId: "workspace-1",
        }),
        workbenchSnapshot: liveWorkbenchSnapshot([
          widget({ definitionId: "interactive-agent", id: "agent-1" }),
          widget({ definitionId: "agent-queue", id: "queue-1" }),
          widget({ definitionId: "agent-run", id: "executor-1" }),
        ]),
      },
    });

    const result = await invoker(
      createActionRequest({
        agentRoleId: "workspace_agent",
        capabilityId: "workspace.context.get",
        dryRun: false,
        input: {
          includeQueueControl: true,
          includeWidgetSummary: true,
        },
        requestId: "workspace-context-get-1",
      }),
    );

    expect(result.status).toBe("succeeded");
    expect(result.policyDecision.capability).toMatchObject({
      confirmationRequirement: "none",
      ownerSurface: "Workbench",
      sideEffectLevel: "read",
    });
    expect(result.result.output).toMatchObject({
      agentExecutorCount: 1,
      agentExecutorBlockers: [],
      agentExecutors: [
        {
          definitionId: "agent-run",
          executorWidgetId: "executor-1",
          id: "executor-1",
          visible: true,
        },
      ],
      blockers: [],
      currentRuntimeMode: "test_renderer",
      currentWorkbenchAvailable: true,
      currentWorkspaceAvailable: true,
      missingCapabilities: [],
      optionalWorkspaceSuggestions: [],
      queueLocalExecutionTargetBlockers: [],
      queueLocalExecutionTargetAvailable: true,
      queueLocalExecutionTargetCount: 1,
      queueLocalExecutionTargets: [
        {
          definitionId: "agent-queue",
          id: "queue-1",
          kind: "queue_local",
          providerId: "codex",
          queueOwnerWidgetInstanceId: "queue-1",
          visible: true,
        },
      ],
      queueControlState: {
        backendOwned: true,
        status: "disabled",
        version: 7,
        workspaceId: "workspace-1",
      },
      recommendedExecutionTarget: {
        kind: "queue_local",
        providerId: "codex",
        queueOwnerWidgetInstanceId: "queue-1",
      },
      recommendedExecutorWidgetId: "executor-1",
      recommendedQueueOwnerWidgetInstanceId: "queue-1",
      visibleWidgetCount: 3,
      widgetSummary: {
        agentExecutorCount: 1,
        agentExecutorBlockers: [],
        agentExecutors: [
          {
            definitionId: "agent-run",
            executorWidgetId: "executor-1",
            id: "executor-1",
            visible: true,
          },
        ],
        optionalWorkspaceSuggestions: [],
        queueLocalExecutionTargetBlockers: [],
        queueLocalExecutionTargetAvailable: true,
        queueLocalExecutionTargetCount: 1,
        queueLocalExecutionTargets: [
          {
            definitionId: "agent-queue",
            id: "queue-1",
            kind: "queue_local",
            providerId: "codex",
            queueOwnerWidgetInstanceId: "queue-1",
            visible: true,
          },
        ],
        recommendedExecutionTarget: {
          kind: "queue_local",
          providerId: "codex",
          queueOwnerWidgetInstanceId: "queue-1",
        },
        recommendedExecutorWidgetId: "executor-1",
        recommendedQueueOwnerWidgetInstanceId: "queue-1",
        visibleWidgetCount: 3,
        widgetCount: 3,
      },
      widgetCount: 3,
      workbenchId: "workbench-1",
      workspaceId: "workspace-1",
      workspaceRootPath: "C:/repo",
    });
    expect(result.result.hiddenSideEffectFlags).toMatchObject({
      noCodexRun: false,
      noQueueMutation: false,
      noShellCommand: false,
      noTerminalLaunch: false,
      noWorkerStart: false,
    });
  });

  it("returns structured blockers when live workspace context is missing", async () => {
    const invoker = createWorkspaceAgentHobitActionInvoker({
      workspaceAgentLiveContext: {
        workbenchId: null,
        widgets: undefined,
        workspaceId: null,
        workspaceRootPath: null,
      },
    });

    const result = await invoker(
      createActionRequest({
        agentRoleId: "workspace_agent",
        capabilityId: "workspace.context.get",
        input: {
          includeWidgetSummary: true,
        },
        requestId: "workspace-context-missing-1",
      }),
    );

    expect(result.status).toBe("succeeded");
    expect(result.result.output).toMatchObject({
      currentWorkbenchAvailable: false,
      currentWorkspaceAvailable: false,
      blockers: [
        "workspace_unavailable",
        "workbench_unavailable",
        "workbench_widgets_unavailable",
      ],
      missingCapabilities: [
        "workspace_unavailable",
        "workbench_unavailable",
        "workbench_widgets_unavailable",
      ],
      workbenchId: null,
      workspaceId: null,
      workspaceRootPath: null,
    });
  });

  it("reports backend-owned queue_local target and optional Queue widget suggestion when Queue widget is absent", async () => {
    const invoker = createWorkspaceAgentHobitActionInvoker({
      workspaceAgentLiveContext: {
        currentRuntimeMode: "test_renderer",
        getQueueControlState: () => ({
          backendOwned: true,
          queueEnabled: true,
          status: "manual_enabled",
          version: 3,
          workspaceId: "workspace-1",
        }),
        workbenchSnapshot: liveWorkbenchSnapshot([
          widget({ definitionId: "interactive-agent", id: "agent-1" }),
          widget({ definitionId: "notes", id: "notes-1" }),
        ]),
      },
    });

    const result = await invoker(
      createActionRequest({
        agentRoleId: "workspace_agent",
        capabilityId: "workspace.context.get",
        input: {
          includeQueueControl: true,
          includeWidgetSummary: true,
        },
        requestId: "workspace-context-no-queue-1",
      }),
    );

    expect(result.status).toBe("succeeded");
    expect(result.result.output).toMatchObject({
      blockers: [],
      missingCapabilities: [],
      optionalWorkspaceSuggestions: [
        {
          blocker: false,
          kind: "add_widget",
          reason: "Optional Queue widget can be added to observe Queue state.",
          widgetDefinitionId: "agent-queue",
        },
      ],
      queueLocalExecutionTargetBlockers: [],
      queueLocalExecutionTargetAvailable: true,
      queueLocalExecutionTargetCount: 0,
      queueWidgetPresent: false,
      recommendedExecutionTarget: {
        kind: "queue_local",
        providerId: "codex",
      },
      recommendedQueueOwnerWidgetInstanceId: null,
      widgetSummary: {
        optionalWorkspaceSuggestions: [
          {
            blocker: false,
            kind: "add_widget",
            reason: "Optional Queue widget can be added to observe Queue state.",
            widgetDefinitionId: "agent-queue",
          },
        ],
        queueLocalExecutionTargetBlockers: [],
        queueLocalExecutionTargetAvailable: true,
        queueLocalExecutionTargetCount: 0,
        queueWidgetPresent: false,
        recommendedExecutionTarget: {
          kind: "queue_local",
          providerId: "codex",
        },
        recommendedQueueOwnerWidgetInstanceId: null,
      },
    });
  });

  it("rejects prose or unsupported discovery input fields", async () => {
    const invoker = createWorkspaceAgentHobitActionInvoker({
      workspaceAgentLiveContext: {
        workbenchId: "workbench-1",
        workspaceId: "workspace-1",
      },
    });

    const result = await invoker(
      createActionRequest({
        agentRoleId: "workspace_agent",
        capabilityId: "workspace.context.get",
        input: {
          titleHint: "Queue smoke",
        },
        requestId: "workspace-context-invalid-1",
      }),
    );

    expect(result.status).toBe("invalid_input");
    expect(result.result.message).toBe(
      "titleHint is not supported by workspace.context.get.",
    );
  });
});

function widget(overrides: Partial<WidgetInstance>): WidgetInstance {
  return {
    config: {},
    definitionId: "notes",
    id: "widget-1",
    layout: {
      area: "main",
      height: 360,
      mode: "docked",
      order: 0,
      width: 480,
      x: 0,
      y: 0,
    },
    state: {},
    title: "Widget",
    visible: true,
    ...overrides,
  };
}

function liveWorkbenchSnapshot(widgets: readonly WidgetInstance[]) {
  return createWorkspaceAgentLiveWorkbenchContextSnapshot({
    widgetInstances: widgets,
    workbenchId: "workbench-1",
    workspaceId: "workspace-1",
    workspaceRootPath: "C:/repo",
  });
}
