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
        recommendedExecutorWidgetId: "executor-1",
        widgetCount: 3,
      },
      workbenchId: "workbench-1",
      workspaceId: "workspace-1",
    });
    expect(widgets.status).toBe("succeeded");
    expect(widgets.result.output).toMatchObject({
      agentExecutors: [
        {
          definitionId: "agent-run",
          id: "executor-1",
          title: "Widget",
          visible: true,
        },
      ],
      blockers: [],
      recommendedExecutorWidgetId: "executor-1",
      widgetInstances: [
        {
          definitionId: "agent-run",
          id: "executor-1",
          title: "Widget",
          visible: true,
        },
      ],
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
          id: "executor-1",
          visible: true,
        },
      ],
      blockers: [],
      recommendedExecutorWidgetId: "executor-1",
      visibleOnly: true,
      widgetInstances: [
        {
          definitionId: "agent-run",
          id: "executor-1",
          visible: true,
        },
      ],
      workbenchId: "workbench-1",
      workspaceId: "workspace-1",
    });
    expect(JSON.stringify(result.result.output)).not.toContain("Executor One");
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
      blockers: ["no_agent_executor"],
      recommendedExecutorWidgetId: null,
    });
  });

  it("returns no-agent and ambiguous-executor blockers without choosing by order", async () => {
    const noExecutor = await invokeWidgetsList({
      widgets: [widget({ definitionId: "interactive-agent", id: "agent-1" })],
    });
    expect(noExecutor.result.output).toMatchObject({
      blockers: ["no_agent_executor"],
      recommendedExecutorWidgetId: null,
    });

    const multipleExecutors = await invokeWidgetsList({
      widgets: [
        widget({ definitionId: "agent-run", id: "executor-1" }),
        widget({ definitionId: "agent-run", id: "executor-2" }),
      ],
    });
    expect(multipleExecutors.result.output).toMatchObject({
      blockers: ["ambiguous_agent_executor"],
      recommendedExecutorWidgetId: null,
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
