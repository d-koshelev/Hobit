import { describe, expect, it } from "vitest";

import { createActionRequest } from "./agents/broker";
import { createWorkspaceAgentHobitActionInvoker } from "./workspaceAgentBrokerActionRuntime";
import type { WidgetInstance } from "./types";
import { createWorkspaceAgentLiveWorkbenchContextSnapshot } from "./workspaceAgentLiveWorkbenchContext";

describe("workbench.widgets.list", () => {
  it("uses the same live snapshot after workspace.context.get succeeds", async () => {
    const invoker = createWorkspaceAgentHobitActionInvoker({
      workspaceAgentLiveContext: {
        currentRuntimeMode: "test_renderer",
        getQueueControlState: () => ({
          backendOwned: true,
          queueEnabled: false,
          status: "disabled",
          version: 2,
          workspaceId: "workspace-1",
        }),
        workbenchSnapshot: liveWorkbenchSnapshot([
          widget({ definitionId: "interactive-agent", id: "agent-1" }),
          widget({ definitionId: "agent-queue", id: "queue-1" }),
          widget({ definitionId: "agent-run", id: "executor-1" }),
          widget({ definitionId: "notes", id: "notes-1" }),
        ]),
      },
    });

    const context = await invoker(
      createActionRequest({
        agentRoleId: "workspace_agent",
        capabilityId: "workspace.context.get",
        input: {
          includeQueueControl: true,
          includeWidgetSummary: true,
        },
        requestId: "workbench-widgets-context-1",
      }),
    );
    const widgets = await invoker(
      createActionRequest({
        agentRoleId: "workspace_agent",
        capabilityId: "workbench.widgets.list",
        input: {
          definitionIdFilter: "agent-run",
          includeTitles: true,
        },
        requestId: "workbench-widgets-context-2",
      }),
    );

    expect(context.status).toBe("succeeded");
    expect(context.result.output).toMatchObject({
      currentWorkbenchAvailable: true,
      currentWorkspaceAvailable: true,
      widgetSummary: {
        agentExecutorCount: 1,
        queueLocalExecutionTargetCount: 1,
        recommendedExecutorWidgetId: "executor-1",
        recommendedQueueOwnerWidgetInstanceId: "queue-1",
        widgetCount: 4,
      },
      workbenchId: "workbench-1",
      workspaceId: "workspace-1",
    });
    expect(widgets.status).toBe("succeeded");
    expect(widgets.result.output).toMatchObject({
      agentExecutors: [
        {
          definitionId: "agent-run",
          executorWidgetId: "executor-1",
          id: "executor-1",
          title: "Widget",
          visible: true,
        },
      ],
      agentExecutorCount: 1,
      agentExecutorBlockers: [],
      blockers: [],
      queueLocalExecutionTargetBlockers: [],
      queueLocalExecutionTargetCount: 1,
      recommendedQueueOwnerWidgetInstanceId: "queue-1",
      recommendedExecutorWidgetId: "executor-1",
      returnedWidgetCount: 1,
      visibleWidgetCount: 4,
      widgetInstances: [
        {
          definitionId: "agent-run",
          id: "executor-1",
          title: "Widget",
          visible: true,
        },
      ],
      widgetCount: 4,
      workbenchId: "workbench-1",
      workspaceId: "workspace-1",
    });
  });

  it("lists bounded widgets and recommends exactly one visible Agent Executor", async () => {
    const result = await invokeWidgetsList({
      input: {
        definitionIdFilter: "agent-run",
        includeTitles: false,
      },
      widgets: [
        widget({
          definitionId: "interactive-agent",
          id: "workspace-agent-1",
          title: "Workspace Agent",
        }),
        widget({
          definitionId: "agent-queue",
          id: "queue-1",
          title: "Queue",
        }),
        widget({
          definitionId: "agent-run",
          id: "executor-1",
          title: "Executor One",
        }),
        widget({
          definitionId: "agent-run",
          id: "executor-hidden",
          title: "Hidden Executor",
          visible: false,
        }),
      ],
    });

    expect(result.status).toBe("succeeded");
    expect(result.policyDecision.capability).toMatchObject({
      confirmationRequirement: "none",
      ownerSurface: "Workbench",
      sideEffectLevel: "read",
    });
    expect(result.result.output).toMatchObject({
      agentExecutors: [
        {
          definitionId: "agent-run",
          executorWidgetId: "executor-1",
          id: "executor-1",
          visible: true,
        },
      ],
      agentExecutorCount: 1,
      agentExecutorBlockers: [],
      blockers: [],
      queueLocalExecutionTargetBlockers: [],
      queueLocalExecutionTargetCount: 1,
      recommendedQueueOwnerWidgetInstanceId: "queue-1",
      recommendedExecutorWidgetId: "executor-1",
      returnedWidgetCount: 1,
      visibleOnly: true,
      visibleWidgetCount: 3,
      widgetInstances: [
        {
          definitionId: "agent-run",
          id: "executor-1",
          visible: true,
        },
      ],
      widgetCount: 4,
      workbenchId: "workbench-1",
      workspaceId: "workspace-1",
    });
    expect(JSON.stringify(result.result.output)).not.toContain("Executor One");
  });

  it("lists queue-local execution targets from Agent Queue widgets", async () => {
    const result = await invokeWidgetsList({
      input: {
        definitionIdFilter: "agent-queue",
        includeTitles: true,
      },
      widgets: [
        widget({ definitionId: "interactive-agent", id: "agent-1" }),
        widget({ definitionId: "agent-queue", id: "queue-1", title: "Queue" }),
      ],
    });

    expect(result.status).toBe("succeeded");
    expect(result.result.output).toMatchObject({
      blockers: [],
      queueLocalExecutionTargetCount: 1,
      queueLocalExecutionTargets: [
        {
          definitionId: "agent-queue",
          id: "queue-1",
          kind: "queue_local",
          providerId: "codex",
          queueOwnerWidgetInstanceId: "queue-1",
          title: "Queue",
          visible: true,
        },
      ],
      recommendedQueueOwnerWidgetInstanceId: "queue-1",
      widgetInstances: [
        {
          definitionId: "agent-queue",
          id: "queue-1",
          title: "Queue",
          visible: true,
        },
      ],
    });
  });

  it("does not infer Agent Executor identity from title or prose", async () => {
    const result = await invokeWidgetsList({
      input: {
        includeTitles: true,
      },
      widgets: [
        widget({
          definitionId: "notes",
          id: "notes-pretending",
          title: "Agent Executor",
        }),
      ],
    });

    expect(result.status).toBe("succeeded");
    expect(result.result.output).toMatchObject({
      agentExecutors: [],
      agentExecutorBlockers: ["no_agent_executor"],
      blockers: ["no_queue_local_execution_target"],
      queueLocalExecutionTargetBlockers: ["no_queue_local_execution_target"],
      recommendedExecutorWidgetId: null,
      recommendedQueueOwnerWidgetInstanceId: null,
    });
  });

  it("returns compatibility executor blockers without choosing by order", async () => {
    const noExecutor = await invokeWidgetsList({
      widgets: [
        widget({ definitionId: "interactive-agent", id: "agent-1" }),
        widget({ definitionId: "agent-queue", id: "queue-1" }),
      ],
    });
    expect(noExecutor.result.output).toMatchObject({
      agentExecutorBlockers: ["no_agent_executor"],
      blockers: [],
      recommendedExecutorWidgetId: null,
      recommendedQueueOwnerWidgetInstanceId: "queue-1",
    });

    const multipleExecutors = await invokeWidgetsList({
      widgets: [
        widget({ definitionId: "agent-queue", id: "queue-1" }),
        widget({ definitionId: "agent-run", id: "executor-1" }),
        widget({ definitionId: "agent-run", id: "executor-2" }),
      ],
    });
    expect(multipleExecutors.result.output).toMatchObject({
      agentExecutorBlockers: ["ambiguous_agent_executor"],
      blockers: [],
      recommendedExecutorWidgetId: null,
      recommendedQueueOwnerWidgetInstanceId: "queue-1",
    });
  });

  it("returns a workbench_unavailable blocker when live widget state is missing", async () => {
    const invoker = createWorkspaceAgentHobitActionInvoker({
      workspaceAgentLiveContext: {
        workbenchId: null,
        widgets: undefined,
        workspaceId: "workspace-1",
      },
    });

    const result = await invoker(
      createActionRequest({
        agentRoleId: "workspace_agent",
        capabilityId: "workbench.widgets.list",
        input: {},
        requestId: "workbench-widgets-missing-1",
      }),
    );

    expect(result.status).toBe("precondition_failed");
    expect(result.result.output).toMatchObject({
      blockers: ["workbench_unavailable"],
      missingCapabilities: ["workbench_unavailable"],
      recommendedExecutorWidgetId: null,
      widgetInstances: [],
    });
  });

  it("returns a workbench_unavailable blocker when workbench ids exist but the live snapshot is missing", async () => {
    const invoker = createWorkspaceAgentHobitActionInvoker({
      workspaceAgentLiveContext: {
        workbenchId: "workbench-1",
        widgets: undefined,
        workspaceId: "workspace-1",
      },
    });

    const result = await invoker(
      createActionRequest({
        agentRoleId: "workspace_agent",
        capabilityId: "workbench.widgets.list",
        input: {},
        requestId: "workbench-widgets-missing-snapshot-1",
      }),
    );

    expect(result.status).toBe("precondition_failed");
    expect(result.result.output).toMatchObject({
      blockers: ["workbench_unavailable"],
      missingCapabilities: ["workbench_unavailable"],
      recommendedExecutorWidgetId: null,
      widgetInstances: [],
      workbenchId: "workbench-1",
      workspaceId: "workspace-1",
    });
  });
});

async function invokeWidgetsList({
  input = {},
  widgets,
}: {
  input?: Record<string, unknown>;
  widgets: readonly WidgetInstance[];
}) {
  const invoker = createWorkspaceAgentHobitActionInvoker({
    workspaceAgentLiveContext: {
      workbenchSnapshot: liveWorkbenchSnapshot(widgets),
    },
  });

  return invoker(
    createActionRequest({
      agentRoleId: "workspace_agent",
      capabilityId: "workbench.widgets.list",
      input,
      requestId: "workbench-widgets-list-1",
    }),
  );
}

function liveWorkbenchSnapshot(widgets: readonly WidgetInstance[]) {
  return createWorkspaceAgentLiveWorkbenchContextSnapshot({
    widgetInstances: widgets,
    workbenchId: "workbench-1",
    workspaceId: "workspace-1",
    workspaceRootPath: "C:/repo",
  });
}

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
