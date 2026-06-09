import { act } from "react";
import type { ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { AgentRunEvent } from "../../agentRuntime";
import { WorkspaceAgentV2ActivityPane } from "./WorkspaceAgentV2ActivityPane";

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

describe("WorkspaceAgentV2ActivityPane", () => {
  it("groups events by run id and makes the current run prominent", async () => {
    await render(
      <WorkspaceAgentV2ActivityPane
        currentRunId="run-current"
        events={[
          runEvent({
            id: "old-start",
            kind: "provider_started",
            lifecycle: "running",
            runId: "run-old",
            title: "Started old run",
          }),
          runEvent({
            id: "current-context",
            kind: "context_materialized",
            lifecycle: "starting",
            runId: "run-current",
            sequence: 1,
            timestampMs: 2_000,
            title: "Context materialized",
          }),
          runEvent({
            id: "current-provider",
            kind: "provider_started",
            lifecycle: "running",
            runId: "run-current",
            sequence: 2,
            timestampMs: 2_100,
            title: "Provider started",
          }),
        ]}
      />,
    );

    const groups = Array.from(
      document.querySelectorAll<HTMLElement>(".workspace-agent-v2-run-activity-group"),
    );

    expect(groups).toHaveLength(2);
    expect(
      document.querySelector(".workspace-agent-v2-activity-groups"),
    ).not.toBeNull();
    expect(groups[0]?.textContent).toContain("Current run");
    expect(groups[0]?.textContent).toContain("run-current");
    expect(groups[0]?.textContent).toContain("2 events");
    expect(groups[1]?.textContent).toContain("run-old");
  });

  it("shows Running, Completed, Failed, and Cancelled statuses", async () => {
    await render(
      <WorkspaceAgentV2ActivityPane
        events={[
          runEvent({ id: "running", lifecycle: "running", runId: "run-running" }),
          runEvent({
            id: "completed",
            kind: "completed",
            lifecycle: "completed",
            runId: "run-completed",
            timestampMs: 2_000,
          }),
          runEvent({
            id: "failed",
            kind: "failed",
            lifecycle: "failed",
            runId: "run-failed",
            timestampMs: 3_000,
          }),
          runEvent({
            id: "cancelled",
            kind: "cancelled",
            lifecycle: "cancelled",
            runId: "run-cancelled",
            timestampMs: 4_000,
          }),
        ]}
      />,
    );

    expect(document.body.textContent).toContain("Running");
    expect(document.body.textContent).toContain("Completed");
    expect(document.body.textContent).toContain("Failed");
    expect(document.body.textContent).toContain("Cancelled");
  });

  it("can request hiding the Activity pane from the pane header", async () => {
    const onRequestHide = vi.fn();

    await render(
      <WorkspaceAgentV2ActivityPane
        events={[
          runEvent({
            kind: "tool_call",
            lifecycle: "running",
            runId: "run-collapse",
            title: "Tool call summarized",
          }),
        ]}
        onRequestHide={onRequestHide}
      />,
    );

    expect(document.body.textContent).toContain("run-collapse");
    expect(document.body.textContent).toContain("Tool call summarized");
    expect(
      document.querySelector("[aria-label='Activity events for run-collapse']"),
    ).not.toBeNull();

    await click(buttonWithText("Hide activity"));

    expect(onRequestHide).toHaveBeenCalledTimes(1);
  });

  it("does not show raw or developer details inline", async () => {
    await render(
      <WorkspaceAgentV2ActivityPane
        events={[
          runEvent({
            kind: "response_received",
            message: "raw provider log: secret debug payload",
            runId: "run-safe",
            title: "Response received",
          }),
        ]}
      />,
    );

    expect(document.body.textContent).toContain("Developer Details");
    expect(document.body.textContent).toContain("Response received");
    expect(document.body.textContent).not.toContain("raw provider log");
    expect(document.body.textContent).not.toContain("secret debug payload");
    expect(buttonWithText("Developer Details")?.disabled).toBe(true);
  });

  it("shows Queue task creation as created and not as a provider run", async () => {
    await render(
      <WorkspaceAgentV2ActivityPane
        currentRunId="queue-item-1"
        events={[
          runEvent({
            id: "queue-item-1:created",
            kind: "queue_task_created",
            lifecycle: "draft",
            runId: "queue-item-1",
            title: "Queue task created: Queue this later.",
          }),
        ]}
      />,
    );

    expect(document.body.textContent).toContain("Queue task created");
    expect(document.body.textContent).toContain("Created, not started");
    expect(document.body.textContent).toContain("queue-item-1");
    expect(document.body.textContent).not.toContain("Provider started");
    expect(document.body.textContent).not.toContain("Codex");
  });
});

async function render(element: ReactNode) {
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);

  await act(async () => {
    root?.render(element);
  });
}

function runEvent(overrides: Partial<AgentRunEvent> = {}): AgentRunEvent {
  return {
    id: "event-1",
    kind: "provider_started",
    lifecycle: "running",
    runId: "run-1",
    sequence: 1,
    timestampMs: 1_000,
    title: "Provider started",
    ...overrides,
  };
}

function buttonWithText(text: string): HTMLButtonElement | null {
  return (
    Array.from(document.querySelectorAll<HTMLButtonElement>("button")).find(
      (button) => button.textContent === text,
    ) ?? null
  );
}

async function click(element: HTMLElement | null) {
  expect(element).not.toBeNull();
  await act(async () => {
    element?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });
}
