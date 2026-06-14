import { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

import { WidgetHost } from "./WidgetHost";
import type { DirectWorkGitReviewHandoff } from "./useDirectWorkGitReviewHandoff";
import type { DirectWorkRunHandoffController } from "./useDirectWorkRunHandoff";
import type { WorkbenchWidgetInstanceActions } from "./useWorkbenchWidgetActions";
import type { WorkspaceQueueApi } from "./queue/useWorkspaceQueueApi";
import type { WidgetInstance } from "./types";
import {
  AGENT_QUEUE_PLACEHOLDER_COMPONENT_KEY,
  AGENT_QUEUE_WIDGET_DEFINITION_ID,
} from "./widgetRegistry";

vi.mock("./AgentQueuePlaceholderWidget", () => ({
  AgentQueuePlaceholderWidget: ({ instance, title }: { instance: WidgetInstance; title: string }) => (
    <section
      data-component-key={AGENT_QUEUE_PLACEHOLDER_COMPONENT_KEY}
      data-definition-id={instance.definitionId}
      data-testid="active-agent-queue-surface"
    >
      {title}
    </section>
  ),
}));

let root: Root | null = null;
let container: HTMLDivElement | null = null;

afterEach(() => {
  if (root && container) {
    act(() => {
      root?.unmount();
    });
    container.remove();
  }
  root = null;
  container = null;
  document.body.innerHTML = "";
  vi.restoreAllMocks();
});

describe("WidgetHost Queue product surface", () => {
  it("renders the active saved-compatible Agent Queue surface for the Queue widget id", () => {
    render(
      <WidgetHost
        agentActivityEvents={[]}
        agentExecutorRunOpenRequest={null}
        agentExecutorSlots={[]}
        agentQueueItemOpenRequest={null}
        coordinatorAttachedContextRequest={null}
        directWorkGitReview={directWorkGitReviewHandoff()}
        directWorkRunHandoff={directWorkRunHandoffController()}
        hasGitWidget={false}
        instance={queueWidget()}
        layoutMode="locked"
        onDockBack={vi.fn()}
        onOpenAgentExecutorRun={vi.fn()}
        onPublishAgentActivityEvents={vi.fn()}
        onStartDockedDrag={vi.fn()}
        onStartPopoutDrag={vi.fn()}
        onPopOut={vi.fn()}
        presentationMode="docked"
        queueReportActionCardRequest={null}
        queueTaskStatusCardRequest={null}
        widgetActions={widgetActions()}
        workspaceId="workspace-1"
        workspaceQueueApi={workspaceQueueApi()}
      />,
    );

    const activeQueueSurface = document.querySelector(
      "[data-testid='active-agent-queue-surface']",
    );

    expect(activeQueueSurface).not.toBeNull();
    expect(activeQueueSurface?.getAttribute("data-definition-id")).toBe(
      AGENT_QUEUE_WIDGET_DEFINITION_ID,
    );
    expect(activeQueueSurface?.getAttribute("data-component-key")).toBe(
      AGENT_QUEUE_PLACEHOLDER_COMPONENT_KEY,
    );
    expect(document.body.textContent).toContain("Agent Queue");
    expect(document.querySelector("[data-definition-id='queue-v2']")).toBeNull();
  });
});

function render(element: ReactNode) {
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);

  act(() => {
    root?.render(element);
  });
}

function queueWidget(): WidgetInstance {
  return {
    config: {},
    definitionId: AGENT_QUEUE_WIDGET_DEFINITION_ID,
    id: "queue-widget-1",
    layout: {
      area: "main",
      height: 680,
      mode: "docked",
      order: 0,
      width: 1160,
      x: 0,
      y: 0,
    },
    state: {},
    title: "Agent Queue",
    visible: true,
  };
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
    listWidgetLogs: vi.fn(),
    removeWidgetInstance: vi.fn(),
    getWidgetRemovalConfirmation: vi.fn(),
  } as unknown as WorkbenchWidgetInstanceActions;
}

function workspaceQueueApi(): WorkspaceQueueApi {
  return {
    controller: {},
    createItem: vi.fn(),
    getRunSettingsDefaults: vi.fn(),
    getSnapshot: vi.fn(),
    queueExecutorSlots: [],
    queueId: "workspace:workspace-1:agent-queue",
    requestValidation: vi.fn(),
    runAutonomousQueue: vi.fn(),
    stopAutonomousQueueAfterCurrent: vi.fn(),
    updateItem: vi.fn(),
    validationRunner: {},
  } as unknown as WorkspaceQueueApi;
}
