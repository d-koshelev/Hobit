import { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";

import { AgentActivityPanel } from "./AgentActivityPanel";
import { AgentActivityWidget } from "./AgentActivityWidget";
import type { AgentActivityEvent } from "./agentActivityModel";

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
});

describe("AgentActivityPanel", () => {
  it("renders the empty state", () => {
    render(<AgentActivityPanel events={[]} />);

    expect(document.body.textContent).toContain("No agent activity yet.");
  });

  it("renders readable timeline events", () => {
    render(
      <AgentActivityPanel
        events={[
          activityEvent({
            summary: "Codex thread started.",
            title: "Started thread",
          }),
          activityEvent({
            id: "event-command-started",
            severity: "info",
            status: "running",
            summary: "Running git status --short",
            title: "Ran command",
          }),
          activityEvent({
            id: "event-command-finished",
            severity: "success",
            status: "running",
            summary: "git status --short finished.",
            title: "Command finished",
          }),
          activityEvent({
            id: "event-command-failed",
            severity: "warning",
            status: "failed",
            summary: "npm run build failed.",
            title: "Command failed",
          }),
        ]}
      />,
    );

    expect(document.body.textContent).toContain("Started thread");
    expect(document.body.textContent).toContain("Ran command");
    expect(document.body.textContent).toContain("Running git status --short");
    expect(document.body.textContent).toContain("Command finished");
    expect(document.body.textContent).toContain("Command failed");
  });

  it("keeps details and raw previews collapsed by default", () => {
    render(
      <AgentActivityPanel
        events={[
          activityEvent({
            details: "Exit code: 1",
            rawPreview: '{"type":"item.completed","raw":true}',
            title: "Command failed",
          }),
        ]}
      />,
    );

    const details = document.querySelector<HTMLDetailsElement>(
      ".agent-activity-event-details",
    );

    expect(details).not.toBeNull();
    expect(details?.open).toBe(false);
    expect(details?.textContent).toContain("Raw preview");
  });
});

describe("AgentActivityWidget", () => {
  it("renders published Workspace Agent events", () => {
    render(
      <AgentActivityWidget
        agentActivityEvents={[
          activityEvent({
            sourceKind: "workspace-agent",
            sourceLabel: "Workspace Agent",
            summary: "Agent response is ready.",
            title: "Prepared response",
          }),
        ]}
        config={{}}
        definition={{
          category: "observability",
          componentKey: "agent-activity-widget",
          defaultConfig: {},
          defaultTitle: "Agent Activity",
          description: "Activity",
          id: "agent-activity",
          title: "Agent Activity",
        }}
        instance={{
          config: {},
          definitionId: "agent-activity",
          id: "activity-widget",
          layout: {
            area: "main",
            height: 520,
            mode: "docked",
            order: 0,
            width: 520,
            x: 0,
            y: 0,
          },
          state: {},
          title: "Agent Activity",
          visible: true,
        }}
        title="Agent Activity"
        workspaceId="workspace-1"
      />,
    );

    expect(document.body.textContent).toContain("Current-session timeline");
    expect(document.body.textContent).toContain("Prepared response");
    expect(document.body.textContent).toContain("Workspace Agent");
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

function activityEvent(
  overrides: Partial<AgentActivityEvent> = {},
): AgentActivityEvent {
  return {
    id: "event-1",
    runId: "run-1",
    severity: "info",
    sourceKind: "workspace-agent",
    sourceLabel: "Workspace Agent",
    sourceWidgetInstanceId: "workspace-agent-1",
    status: "running",
    summary: "Running.",
    timestamp: 1_000,
    timestampLabel: "1s",
    title: "Started run",
    workspaceId: "workspace-1",
    ...overrides,
  };
}
