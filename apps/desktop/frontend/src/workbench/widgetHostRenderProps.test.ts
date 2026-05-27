import { describe, expect, it, vi } from "vitest";

import type { DirectWorkGitReviewHandoff } from "./useDirectWorkGitReviewHandoff";
import type { DirectWorkRunHandoffController } from "./useDirectWorkRunHandoff";
import type { WorkbenchWidgetInstanceActions } from "./useWorkbenchWidgetActions";
import { widgetHostRenderProps } from "./widgetHostRenderProps";
import {
  AGENT_ACTIVITY_COMPONENT_KEY,
  AGENT_QUEUE_PLACEHOLDER_COMPONENT_KEY,
  AGENT_RUN_PLACEHOLDER_COMPONENT_KEY,
  INTERACTIVE_AGENT_PLACEHOLDER_COMPONENT_KEY,
  SKILL_LIBRARY_COMPONENT_KEY,
  TERMINAL_PLACEHOLDER_COMPONENT_KEY,
} from "./widgetRegistry";

describe("widgetHostRenderProps", () => {
  it("exposes Attach to Workspace Agent only for explicit attach-capable widgets", () => {
    const attach = vi.fn();

    expect(renderPropsFor(SKILL_LIBRARY_COMPONENT_KEY, attach).onAttachContextToCoordinator).toBe(attach);
    expect(renderPropsFor(AGENT_QUEUE_PLACEHOLDER_COMPONENT_KEY, attach).onAttachContextToCoordinator).toBe(attach);
    expect(renderPropsFor(AGENT_RUN_PLACEHOLDER_COMPONENT_KEY, attach).onAttachContextToCoordinator).toBe(attach);
    expect(renderPropsFor(TERMINAL_PLACEHOLDER_COMPONENT_KEY, attach).onAttachContextToCoordinator).toBeUndefined();
  });

  it("routes current-session Agent Activity events only to Agent Activity", () => {
    const publish = vi.fn();
    const activityEvents = [
      {
        id: "event-1",
        runId: "run-1",
        severity: "info" as const,
        sourceKind: "workspace-agent" as const,
        sourceLabel: "Workspace Agent",
        sourceWidgetInstanceId: "agent-1",
        status: "running" as const,
        timestamp: 1,
        timestampLabel: "0s",
        title: "Started run",
        workspaceId: "workspace-1",
      },
    ];

    expect(
      renderPropsFor(
        AGENT_ACTIVITY_COMPONENT_KEY,
        undefined,
        activityEvents,
        publish,
      ).agentActivityEvents,
    ).toBe(activityEvents);
    expect(
      renderPropsFor(
        INTERACTIVE_AGENT_PLACEHOLDER_COMPONENT_KEY,
        undefined,
        activityEvents,
        publish,
      ).agentActivityEvents,
    ).toBeUndefined();
    expect(
      renderPropsFor(
        INTERACTIVE_AGENT_PLACEHOLDER_COMPONENT_KEY,
        undefined,
        activityEvents,
        publish,
      ).onPublishAgentActivityEvents,
    ).toBe(publish);
  });
});

function renderPropsFor(
  componentKey: string,
  onAttachContextToCoordinator: Parameters<
    typeof widgetHostRenderProps
  >[0]["onAttachContextToCoordinator"],
  agentActivityEvents: Parameters<
    typeof widgetHostRenderProps
  >[0]["agentActivityEvents"] = [],
  onPublishAgentActivityEvents: Parameters<
    typeof widgetHostRenderProps
  >[0]["onPublishAgentActivityEvents"] = vi.fn(),
) {
  return widgetHostRenderProps({
    agentActivityEvents,
    agentExecutorRunOpenRequest: null,
    agentExecutorSlots: [],
    componentKey,
    coordinatorAttachedContextRequest: null,
    directWorkGitReview: directWorkGitReviewHandoff(),
    directWorkRunHandoff: directWorkRunHandoffController(),
    hasGitWidget: false,
    instanceId: "widget_1",
    onAttachContextToCoordinator,
    onOpenAgentExecutorRun: vi.fn(),
    onPublishAgentActivityEvents,
    widgetActions: widgetActions(),
  });
}

function directWorkGitReviewHandoff(): DirectWorkGitReviewHandoff {
  return {
    request: null,
    requestReview: vi.fn(),
    status: null,
    updateStatus: vi.fn(),
  };
}

function directWorkRunHandoffController(): DirectWorkRunHandoffController {
  return {
    handoffs: {},
    queueTaskAutoRefreshRequest: null,
    recordFinalState: vi.fn(),
    recordHandoff: vi.fn(),
  };
}

function widgetActions(): WorkbenchWidgetInstanceActions {
  return {
    logRefreshTokens: {},
  } as WorkbenchWidgetInstanceActions;
}
