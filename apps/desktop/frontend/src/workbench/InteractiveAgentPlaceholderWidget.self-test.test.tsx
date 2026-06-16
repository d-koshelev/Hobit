import { act, useState } from "react";
import { describe, expect, it, vi } from "vitest";

import {
  buttonWithText,
  clickButton,
  definition,
  directWorkEvent,
  instance,
  InteractiveAgentPlaceholderWidget,
  renderWidgetTree,
  renderWidget,
  setTextareaValue,
  type DirectWorkStreamEvent,
} from "./InteractiveAgentPlaceholderWidget.test-utils";
import {
  mergeAgentActivityEvents,
  type AgentActivityEvent,
} from "./agentActivityModel";
import type { WorkspaceAgentQueueBridge } from "./workspaceAgentQueueBridge";
import type {
  QueueWidgetActionResult,
  QueueWidgetItemSnapshot,
  QueueWidgetSnapshot,
} from "./queue/agentQueueWidgetApiTypes";

describe("InteractiveAgentPlaceholderWidget Agent Self-Test Runner", () => {
  it("updates one visible self-test activity lifecycle from Running to Completed", async () => {
    const publishActivityEvents = vi.fn();

    renderWidgetTree(
      <SelfTestActivityHarness onPublishEvents={publishActivityEvents} />,
    );

    const selfTestButton = buttonWithText("Run Agent Self-Test");
    expect(selfTestButton).toBeDefined();

    act(() => {
      selfTestButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    let rows = activityRows();
    expect(rows).toHaveLength(1);
    expect(rows[0]?.textContent).toContain("Agent self-test started");
    expect(rows[0]?.textContent).toContain("Running");

    await flushAsync();

    rows = activityRows();
    expect(rows).toHaveLength(1);
    expect(rows[0]?.textContent).toContain("Agent self-test completed");
    expect(rows[0]?.textContent).toContain("Completed");
    expect(rows[0]?.textContent).not.toContain("Running");
    expect(selfTestReportCard().textContent).toContain(
      "Agent Self-Test Report",
    );

    const selfTestEvents = publishActivityEvents.mock.calls
      .flatMap((call) => call[0] as AgentActivityEvent[])
      .filter((event) => event.runKind === "workspace-agent-self-test");

    expect(selfTestEvents).toHaveLength(2);
    expect(new Set(selfTestEvents.map((event) => event.runId)).size).toBe(1);
    expect(selfTestEvents).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          lifecycleStage: "started",
          status: "running",
          title: "Agent self-test started",
        }),
        expect.objectContaining({
          lifecycleStage: "completed",
          status: "completed",
          title: "Agent self-test completed",
        }),
      ]),
    );
  });

  it("shows Run Agent Self-Test as a visible header action and renders a compact report", async () => {
    const publishActivityEvents = vi.fn();

    renderWidget({
      onPublishAgentActivityEvents: publishActivityEvents,
      workspaceAgentQueueBridge: queueBridge(),
      workspaceId: "workspace_1",
    });

    const button = buttonWithText("Run Agent Self-Test");
    const header = document.querySelector(".interactive-agent-frame-status");

    expect(button).toBeDefined();
    expect(header?.contains(button ?? null)).toBe(true);
    expect(document.body.textContent).not.toContain("Debug");

    await clickButton("Run Agent Self-Test");
    await flushAsync();

    expect(document.body.textContent).toContain("Agent self-test started");
    expect(document.body.textContent).toContain("Agent self-test completed");
    expect(
      publishActivityEvents.mock.calls.flatMap((call) => call[0]),
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ title: "Agent self-test started" }),
        expect.objectContaining({ title: "Agent self-test completed" }),
      ]),
    );

    const report = selfTestReportCard();
    const reportText = report.textContent ?? "";

    expect(reportText).toContain("Agent Self-Test Report");
    expect(reportText).toContain("Passed");
    expect(reportText).toContain("Failed");
    expect(reportText).toContain("Skipped");
    expect(reportText).toContain("Blocked");
    expect(reportText).toContain("Agent status read");
    expect(reportText).toContain("Agent history read");
    expect(reportText).toContain("Agent self-test message");
    expect(reportText).toContain("Agent capability manifest");
    expect(reportText).toContain("Agent peer self-test");
    expect(reportText).toContain("Queue self-test passed");
    expect(reportText).toContain("Queue dry-run preview prepared");
    expect(reportText).toContain("Singleton Queue target verified");
    expect(reportText).toContain("No Queue mutation");
    expect(reportText).toContain("No Queue worker start");
    expect(reportText).toContain("No Queue view creation");
    expect(reportText).toContain("Agent Queue / QueueV2 widget contract");
    expect(reportText).toContain("Workspace Agent widget contract");
    expect(reportText).toContain("Knowledge / Skills");
    expect(reportText).toContain("Notes");
    expect(reportText).toContain("Terminal");
    expect(reportText).toContain("Capability unavailable");
    expect(reportText).toContain("not implemented yet");
    expect(reportText).toContain("Dry-run only");
    expect(reportText).toContain("No hidden side effects");
    expect(reportText).not.toContain("agent.status.read");
    expect(reportText).not.toContain("agent.history.read");
    expect(reportText).not.toContain("agent.message.send");
    expect(reportText).not.toContain("agent.capabilities.read");
    expect(reportText).not.toContain("agent.selfTest.run");
    expect(reportText).not.toContain("queue.selfTest");
    expect(reportText).not.toContain("queue.createItems");
    expect(reportText).not.toContain("{");
    expect(reportText).not.toContain("reportId");
  });

  it("runs self-test without Codex, shell, Queue mutation, workers, Terminal, Git, or rollback execution", async () => {
    const cancelDirectWork = vi.fn();
    const startDirectWork = vi.fn();
    const runCodexDirectWork = vi.fn();
    const runTerminal = vi.fn();
    const createTerminalPtySession = vi.fn();
    const createGitCommit = vi.fn();
    const createItem = vi.fn(async () => itemResult());
    const updateItem = vi.fn(async () => itemResult());
    const runAutonomousQueue = vi.fn();
    const stopAutonomousQueueAfterCurrent = vi.fn();

    renderWidget({
      onCreateGitCommit: createGitCommit,
      onCreateTerminalPtySession: createTerminalPtySession,
      onCancelCodexDirectWorkRun: cancelDirectWork,
      onRunCodexDirectWork: runCodexDirectWork,
      onRunTerminalCommand: runTerminal,
      onStartCodexDirectWorkStream: startDirectWork,
      workspaceAgentQueueBridge: queueBridge({
        createItem,
        runAutonomousQueue,
        stopAutonomousQueueAfterCurrent,
        updateItem,
      }),
      workspaceId: "workspace_1",
    });

    await clickButton("Run Agent Self-Test");
    await flushAsync();

    expect(startDirectWork).not.toHaveBeenCalled();
    expect(runCodexDirectWork).not.toHaveBeenCalled();
    expect(cancelDirectWork).not.toHaveBeenCalled();
    expect(runTerminal).not.toHaveBeenCalled();
    expect(createTerminalPtySession).not.toHaveBeenCalled();
    expect(createGitCommit).not.toHaveBeenCalled();
    expect(createItem).not.toHaveBeenCalled();
    expect(updateItem).not.toHaveBeenCalled();
    expect(runAutonomousQueue).not.toHaveBeenCalled();
    expect(stopAutonomousQueueAfterCurrent).not.toHaveBeenCalled();
    expect(selfTestReportCard().textContent).toContain("No hidden side effects");
  });

  it("preserves normal Direct Work after self-test and keeps structured broker action handling available", async () => {
    const startDirectWork = startDirectWorkWithFinalText(
      "Normal assistant response.",
    );

    renderWidget({
      onStartCodexDirectWorkStream: startDirectWork,
      workspaceAgentQueueBridge: queueBridge(),
      workspaceId: "workspace_1",
    });

    await clickButton("Run Agent Self-Test");
    await flushAsync();

    expect(startDirectWork).not.toHaveBeenCalled();

    await setTextareaValue("Run normal Direct Work.");
    await clickButton("Run with Codex");
    await flushAsync();

    expect(startDirectWork).toHaveBeenCalledTimes(1);
    expect(document.body.textContent).toContain("Normal assistant response.");
  });

  it("disables self-test while Direct Work is running", async () => {
    const startDirectWork = vi.fn(
      async () =>
        await new Promise<{
          runId: string;
          status: "started";
          stopListening: () => void;
        }>(() => undefined),
    );

    renderWidget({
      onStartCodexDirectWorkStream: startDirectWork,
      workspaceAgentQueueBridge: queueBridge(),
      workspaceId: "workspace_1",
    });

    await setTextareaValue("Keep Direct Work running.");
    await clickButton("Run with Codex");
    await flushAsync();

    const selfTestButton = buttonWithText("Run Agent Self-Test");

    expect(startDirectWork).toHaveBeenCalledTimes(1);
    expect(selfTestButton?.disabled).toBe(true);
    expect(selfTestButton?.getAttribute("aria-label")).toBe(
      "Run Agent Self-Test unavailable: Agent is running",
    );
    expect(document.body.textContent).toContain("Agent is running");
  });
});

function SelfTestActivityHarness({
  onPublishEvents,
}: {
  onPublishEvents: (events: AgentActivityEvent[]) => void;
}) {
  const [events, setEvents] = useState<AgentActivityEvent[]>([]);

  return (
    <InteractiveAgentPlaceholderWidget
      agentActivityEvents={events}
      config={{}}
      definition={definition()}
      instance={instance()}
      onPublishAgentActivityEvents={(nextEvents) => {
        onPublishEvents(nextEvents);
        setEvents((currentEvents) =>
          mergeAgentActivityEvents(currentEvents, nextEvents),
        );
      }}
      title="Workspace Agent"
      workspaceAgentQueueBridge={queueBridge()}
      workspaceId="workspace_1"
    />
  );
}

async function flushAsync() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
  });
}

function activityRows() {
  return Array.from(
    document.querySelectorAll<HTMLButtonElement>(".agent-activity-event-row"),
  );
}

function selfTestReportCard() {
  const report = document.querySelector<HTMLElement>(
    '[aria-label="Agent Self-Test Report"]',
  );
  if (!report) {
    throw new Error("Agent Self-Test Report not found.");
  }

  return report;
}

function startDirectWorkWithFinalText(text: string) {
  return vi.fn(
    async (
      _widgetInstanceId: string,
      _request: unknown,
      onEvent: (event: DirectWorkStreamEvent) => void,
    ) => {
      onEvent(
        directWorkEvent({
          eventKind: "started",
          isFinal: false,
          runId: "run_self_test_preservation",
        }),
      );
      onEvent(
        directWorkEvent({
          elapsedMs: 100,
          eventKind: "completed",
          finalStatus: "completed",
          isFinal: true,
          runId: "run_self_test_preservation",
          text,
        }),
      );

      return {
        runId: "run_self_test_preservation",
        status: "started" as const,
        stopListening: vi.fn(),
      };
    },
  );
}

function queueBridge(
  overrides: Partial<WorkspaceAgentQueueBridge> = {},
): WorkspaceAgentQueueBridge {
  return {
    createItem: vi.fn(async () => itemResult()),
    getSnapshot: vi.fn(async () => snapshotResult()),
    updateItem: vi.fn(async () => itemResult()),
    ...overrides,
  };
}

function itemResult(
  overrides: Partial<QueueWidgetItemSnapshot> = {},
): QueueWidgetActionResult<QueueWidgetItemSnapshot> {
  const item = {
    dependencies: [],
    id: "queue-created",
    prompt: "Prompt",
    status: "queued",
    title: "Queue item",
    ...overrides,
  } as QueueWidgetItemSnapshot;

  return {
    action: "queue.createItem",
    events: [],
    item,
    message: "Queue item created. No task execution started.",
    ok: true,
    safetyClass: "safe_create_update",
  };
}

function snapshotResult(): QueueWidgetActionResult<QueueWidgetSnapshot> {
  return {
    action: "queue.getSnapshot",
    events: [],
    message: "Queue snapshot returned.",
    ok: true,
    safetyClass: "safe_read",
    snapshot: {
      items: [],
      queueId: "workspace:workspace_1:agent-queue",
      widgetType: "agent-queue",
      workspaceId: "workspace_1",
    } as unknown as QueueWidgetSnapshot,
  };
}
