import { describe, expect, it, vi } from "vitest";

import type { DirectWorkGitReviewHandoff } from "./useDirectWorkGitReviewHandoff";
import type { DirectWorkRunHandoffController } from "./useDirectWorkRunHandoff";
import type { WorkbenchWidgetInstanceActions } from "./useWorkbenchWidgetActions";
import { widgetHostRenderProps } from "./widgetHostRenderProps";
import {
  AGENT_QUEUE_PLACEHOLDER_COMPONENT_KEY,
  AGENT_RUN_PLACEHOLDER_COMPONENT_KEY,
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
});

function renderPropsFor(
  componentKey: string,
  onAttachContextToCoordinator: Parameters<
    typeof widgetHostRenderProps
  >[0]["onAttachContextToCoordinator"],
) {
  return widgetHostRenderProps({
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
