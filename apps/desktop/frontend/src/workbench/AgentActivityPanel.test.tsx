import { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

import { AgentActivityPanel } from "./AgentActivityPanel";
import { AgentActivityWidget } from "./AgentActivityWidget";
import type { AgentActivityEvent } from "./agentActivityModel";

let root: Root | null = null;
let container: HTMLDivElement | null = null;
const originalScrollTo = HTMLElement.prototype.scrollTo;

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
  if (originalScrollTo) {
    HTMLElement.prototype.scrollTo = originalScrollTo;
  } else {
    delete (HTMLElement.prototype as Partial<HTMLElement>).scrollTo;
  }
  vi.restoreAllMocks();
});

describe("AgentActivityPanel", () => {
  it("renders the empty state", () => {
    render(<AgentActivityPanel events={[]} />);

    expect(document.body.textContent).toContain("No agent activity yet.");
  });

  it("renders compact one-line rows by default", () => {
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

    const rows = document.querySelectorAll(".agent-activity-event-row");

    expect(rows).toHaveLength(4);
    expect(document.body.textContent).toContain("Started thread");
    expect(document.body.textContent).toContain("Running command");
    expect(document.body.textContent).toContain("Running git status --short");
    expect(document.body.textContent).toContain("Finished command");
    expect(document.body.textContent).toContain("Command failed");
    expect(document.querySelector(".agent-activity-event-details")).toBeNull();
  });

  it("keeps details and raw previews collapsed by default", () => {
    render(
      <AgentActivityPanel
        events={[
          activityEvent({
            command: "npm run build",
            details: "Exit code: 1",
            outputPreview: "stderr output",
            rawPreview: '{"type":"item.completed","raw":true}',
            title: "Command failed",
          }),
        ]}
      />,
    );

    expect(document.querySelector(".agent-activity-event-details")).toBeNull();
    expect(document.body.textContent).not.toContain("Exit code: 1");
    expect(document.body.textContent).not.toContain("stderr output");
    expect(document.body.textContent).not.toContain("Raw preview");
    expect(document.body.textContent).not.toContain("item.completed");
  });

  it("expands details and raw previews when a row is clicked", () => {
    render(
      <AgentActivityPanel
        events={[
          activityEvent({
            command: "npm run build",
            details: "Exit code: 1",
            outputPreview: "stderr output",
            rawPreview: '{"type":"item.completed","raw":true}',
            title: "Command failed",
          }),
        ]}
      />,
    );

    clickRow("Command failed");

    const details = document.querySelector(".agent-activity-event-details");

    expect(details).not.toBeNull();
    expect(details?.textContent).toContain("Raw preview");
    expect(details?.textContent).toContain("Exit code: 1");
    expect(details?.textContent).toContain("npm run build");
    expect(details?.textContent).toContain("stderr output");
    expect(details?.textContent).toContain("item.completed");
  });

  it("uses lifecycle status tones consistently", () => {
    render(
      <AgentActivityPanel
        events={[
          activityEvent({
            id: "running-event",
            severity: "info",
            status: "running",
            title: "Ran command",
          }),
          activityEvent({
            id: "completed-event",
            severity: "success",
            status: "completed",
            title: "Command finished",
          }),
          activityEvent({
            id: "failed-event",
            severity: "error",
            status: "failed",
            title: "Command failed",
          }),
        ]}
      />,
    );

    const rows = Array.from(document.querySelectorAll(".agent-activity-event"));

    expect(rows[0]?.className).toContain("agent-activity-event-status-running");
    expect(rows[0]?.querySelector(".status-dot")?.className).toContain(
      "status-dot-info",
    );
    expect(rows[0]?.textContent).toContain("Running");

    expect(rows[1]?.className).toContain(
      "agent-activity-event-status-completed",
    );
    expect(rows[1]?.querySelector(".status-dot")?.className).toContain(
      "status-dot-success",
    );
    expect(rows[1]?.textContent).toContain("Completed");

    expect(rows[2]?.className).toContain("agent-activity-event-status-failed");
    expect(rows[2]?.querySelector(".status-dot")?.className).toContain(
      "status-dot-error",
    );
    expect(rows[2]?.textContent).toContain("Failed");
  });

  it("auto-scrolls while following latest activity and pauses after scrolling away", () => {
    const scrollTo = vi.fn();
    Object.defineProperty(HTMLElement.prototype, "scrollTo", {
      configurable: true,
      value: scrollTo,
    });

    const view = render(
      <AgentActivityPanel events={[activityEvent({ id: "event-1" })]} />,
    );
    const timeline = document.querySelector<HTMLOListElement>(
      "[data-agent-activity-timeline]",
    );

    expect(timeline).not.toBeNull();
    expect(scrollTo).toHaveBeenCalled();

    scrollTo.mockClear();
    setScrollMetrics(timeline!, {
      clientHeight: 200,
      scrollHeight: 1000,
      scrollTop: 100,
    });
    dispatchScroll(timeline!);

    view.rerender(
      <AgentActivityPanel
        events={[
          activityEvent({ id: "event-1" }),
          activityEvent({ id: "event-2" }),
        ]}
      />,
    );

    expect(scrollTo).not.toHaveBeenCalled();

    setScrollMetrics(timeline!, {
      clientHeight: 200,
      scrollHeight: 1000,
      scrollTop: 780,
    });
    dispatchScroll(timeline!);
    scrollTo.mockClear();

    view.rerender(
      <AgentActivityPanel
        events={[
          activityEvent({ id: "event-1" }),
          activityEvent({ id: "event-2" }),
          activityEvent({ id: "event-3" }),
        ]}
      />,
    );

    expect(scrollTo).toHaveBeenCalledWith({
      behavior: "auto",
      top: 1000,
    });
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
    expect(document.body.textContent).not.toContain("Workspace Agent");

    clickRow("Prepared response");

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

  return {
    rerender(nextElement: ReactNode) {
      act(() => {
        root?.render(nextElement);
      });
    },
  };
}

function clickRow(text: string) {
  const row = Array.from(
    document.querySelectorAll<HTMLButtonElement>(".agent-activity-event-row"),
  ).find((candidate) => candidate.textContent?.includes(text));

  expect(row).toBeDefined();

  act(() => {
    row?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });
}

function dispatchScroll(element: HTMLElement) {
  act(() => {
    element.dispatchEvent(new Event("scroll", { bubbles: true }));
  });
}

function setScrollMetrics(
  element: HTMLElement,
  metrics: { clientHeight: number; scrollHeight: number; scrollTop: number },
) {
  Object.defineProperty(element, "clientHeight", {
    configurable: true,
    value: metrics.clientHeight,
  });
  Object.defineProperty(element, "scrollHeight", {
    configurable: true,
    value: metrics.scrollHeight,
  });
  Object.defineProperty(element, "scrollTop", {
    configurable: true,
    value: metrics.scrollTop,
    writable: true,
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
