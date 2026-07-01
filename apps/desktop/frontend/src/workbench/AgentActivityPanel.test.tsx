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

  it("renders compact grouped run rows by default", () => {
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

    expect(rows).toHaveLength(1);
    expect(document.body.textContent).toContain("Agent run");
    expect(document.body.textContent).toContain("4 steps");
    expect(document.body.textContent).toContain("latest: Running command");
    expect(document.body.textContent).not.toContain("Started thread");
    expect(document.body.textContent).toContain("Running command");
    expect(document.body.textContent).not.toContain("Running git status --short");
    expect(document.body.textContent).not.toContain("Command failed");
    expect(document.querySelector(".agent-activity-event-details")).toBeNull();
  });

  it("renders one completed Workspace Agent self-test lifecycle row without stale Running", () => {
    render(
      <AgentActivityPanel
        events={[
          activityEvent({
            id: "self-test-started",
            lifecycleStage: "started",
            runId: "self-test-run-1",
            runKind: "workspace-agent-self-test",
            severity: "info",
            status: "running",
            summary: "Safe self-test checks started.",
            timestamp: 1_000,
            timestampLabel: "0s",
            title: "Agent self-test started",
          }),
          activityEvent({
            id: "self-test-completed",
            lifecycleStage: "completed",
            runId: "self-test-run-1",
            runKind: "workspace-agent-self-test",
            severity: "success",
            status: "completed",
            summary:
              "Agent-executed smoke completed: 20 passed, 0 failed, 4 skipped, 1 blocked. No hidden side effects.",
            timestamp: 2_000,
            timestampLabel: "1s",
            title: "Agent self-test completed",
          }),
        ]}
      />,
    );

    const rows = activityRows();

    expect(rows).toHaveLength(1);
    expect(rows[0]?.textContent).toContain("Agent self-test completed");
    expect(rows[0]?.textContent).toContain("Completed");
    expect(rows[0]?.textContent).toContain("1s");
    expect(rows[0]?.textContent).not.toContain("Running");
    expect(document.body.textContent).not.toContain("Agent run");
  });

  it("renders one failed Workspace Agent self-test lifecycle row without stale Running", () => {
    render(
      <AgentActivityPanel
        events={[
          activityEvent({
            id: "self-test-started",
            lifecycleStage: "started",
            runId: "self-test-run-2",
            runKind: "workspace-agent-self-test",
            severity: "info",
            status: "running",
            summary: "Safe self-test checks started.",
            timestamp: 1_000,
            timestampLabel: "0s",
            title: "Agent self-test started",
          }),
          activityEvent({
            id: "self-test-failed",
            lifecycleStage: "failed",
            runId: "self-test-run-2",
            runKind: "workspace-agent-self-test",
            severity: "error",
            status: "failed",
            summary: "Self-test runner failed.",
            timestamp: 2_000,
            timestampLabel: "1s",
            title: "Agent self-test failed",
          }),
        ]}
      />,
    );

    const rows = activityRows();

    expect(rows).toHaveLength(1);
    expect(rows[0]?.textContent).toContain("Agent self-test failed");
    expect(rows[0]?.textContent).toContain("Failed");
    expect(rows[0]?.textContent).not.toContain("Running");
    expect(document.body.textContent).not.toContain("Agent run");
  });

  it("renders one Workspace Agent broker continuation chain row", () => {
    render(
      <AgentActivityPanel
        events={[
          activityEvent({
            id: "broker-action-1-requested",
            lifecycleStage: "step",
            runId: "broker-chain-1",
            runKind: "workspace-agent-broker-continuation",
            severity: "info",
            status: "running",
            summary: "Action 1/16: queue.targetSingletonQueue",
            timestamp: 1_000,
            timestampLabel: "0s",
            title: "Hobit action requested",
          }),
          activityEvent({
            id: "broker-action-1-completed",
            lifecycleStage: "step",
            runId: "broker-chain-1",
            runKind: "workspace-agent-broker-continuation",
            severity: "success",
            status: "completed",
            summary:
              "Action 1/16: queue.targetSingletonQueue\nQueue target resolved.",
            timestamp: 2_000,
            timestampLabel: "1s",
            title: "Queue target resolved",
          }),
          activityEvent({
            id: "broker-action-2-completed",
            lifecycleStage: "completed",
            runId: "broker-chain-1",
            runKind: "workspace-agent-broker-continuation",
            severity: "success",
            status: "completed",
            summary:
              "Workspace Agent completed the action chain. Stopped: final answer received.",
            timestamp: 3_000,
            timestampLabel: "2s",
            title: "Broker action chain completed",
          }),
        ]}
      />,
    );

    const rows = activityRows();

    expect(rows).toHaveLength(1);
    expect(rows[0]?.textContent).toContain("Workspace Agent action chain");
    expect(rows[0]?.textContent).toContain("Completed");
    expect(rows[0]?.textContent).toContain("2s");
    expect(rows[0]?.textContent).toContain(
      "Workspace Agent completed the action chain.",
    );
    expect(rows[0]?.textContent).not.toContain("Agent run");
    expect(rows[0]?.textContent).not.toContain("Running");
  });

  it("renders Workspace Agent protocol repair and protocol error visibility", () => {
    render(
      <AgentActivityPanel
        events={[
          activityEvent({
            id: "broker-protocol-repair",
            lifecycleStage: "step",
            rawPreview: "Awaiting `queue.items.list` result.",
            runId: "broker-chain-protocol",
            runKind: "workspace-agent-broker-continuation",
            severity: "warning",
            status: "running",
            summary:
              "Workspace Agent action protocol repair requested. No broker action was executed.",
            timestamp: 1_000,
            timestampLabel: "0s",
            title: "Protocol repair requested",
          }),
          activityEvent({
            id: "broker-protocol-error",
            lifecycleStage: "failed",
            runId: "broker-chain-protocol",
            runKind: "workspace-agent-broker-continuation",
            severity: "error",
            status: "failed",
            summary:
              "Workspace Agent action protocol error. No broker action was executed. Stopped: action protocol error.",
            timestamp: 2_000,
            timestampLabel: "1s",
            title: "Broker action chain stopped",
          }),
        ]}
      />,
    );

    const rows = activityRows();

    expect(rows).toHaveLength(1);
    expect(rows[0]?.textContent).toContain("Workspace Agent action chain");
    expect(rows[0]?.textContent).toContain("Failed");
    expect(rows[0]?.textContent).toContain("No broker action was executed");
    expect(document.body.textContent).not.toContain("queue.items.list");

    clickRow("Workspace Agent action chain");

    expect(document.body.textContent).toContain("Protocol repair requested");
    expect(document.body.textContent).toContain("Raw preview");
    expect(document.body.textContent).toContain("queue.items.list");
  });

  it("keeps Direct Work running activity grouped as the existing Agent run row", () => {
    render(
      <AgentActivityPanel
        events={[
          activityEvent({
            id: "direct-work-started",
            lifecycleStage: "started",
            runId: "direct-work-run-1",
            runKind: "direct-work",
            severity: "info",
            status: "running",
            summary: "Direct Work accepted.",
            title: "Started run",
          }),
        ]}
      />,
    );

    const rows = activityRows();

    expect(rows).toHaveLength(1);
    expect(rows[0]?.textContent).toContain("Agent run");
    expect(rows[0]?.textContent).toContain("Running");
    expect(rows[0]?.textContent).not.toContain("Agent self-test");
  });

  it("renders event rows in a top-aligned newest-first timeline", () => {
    render(
      <AgentActivityPanel
        events={[
          activityEvent({
            id: "old-event",
            runId: "run-old",
            timestamp: 1_000,
            timestampLabel: "1s",
            title: "Started old run",
          }),
          activityEvent({
            id: "current-event",
            runId: "run-current",
            timestamp: 2_000,
            timestampLabel: "2s",
            title: "Started current run",
          }),
        ]}
      />,
    );

    const timeline = document.querySelector<HTMLOListElement>(
      "[data-agent-activity-timeline]",
    );
    const rows = Array.from(
      document.querySelectorAll<HTMLButtonElement>(".agent-activity-event-row"),
    );

    expect(timeline?.className).toContain("agent-activity-panel");
    expect(rows).toHaveLength(2);
    expect(rows[0]?.textContent).toContain("Started current run");
    expect(rows[1]?.textContent).toContain("Started old run");
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
            runId: "run-2",
            severity: "success",
            status: "completed",
            title: "Command finished",
          }),
          activityEvent({
            id: "failed-event",
            runId: "run-3",
            severity: "error",
            status: "failed",
            title: "Command failed",
          }),
        ]}
      />,
    );

    const rows = Array.from(document.querySelectorAll(".agent-activity-event"));

    const runningRow = rows.find((row) =>
      row.className.includes("agent-activity-event-status-running"),
    );
    const completedRow = rows.find((row) =>
      row.className.includes("agent-activity-event-status-completed"),
    );
    const failedRow = rows.find((row) =>
      row.className.includes("agent-activity-event-status-failed"),
    );

    expect(runningRow?.querySelector(".status-dot")?.className).toContain(
      "status-dot-info",
    );
    expect(runningRow?.textContent).toContain("Running");

    expect(completedRow?.querySelector(".status-dot")?.className).toContain(
      "status-dot-success",
    );
    expect(completedRow?.textContent).toContain("Completed");

    expect(failedRow?.querySelector(".status-dot")?.className).toContain(
      "status-dot-error",
    );
    expect(failedRow?.textContent).toContain("Failed");
  });

  it("auto-scrolls to the top while following latest activity and pauses after scrolling away", () => {
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
      scrollTop: 10,
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
      top: 0,
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

function activityRows() {
  return Array.from(
    document.querySelectorAll<HTMLButtonElement>(".agent-activity-event-row"),
  );
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
