import { act } from "react";
import { describe, expect, it, vi } from "vitest";

import {
  buttonWithText,
  clickButton,
  directWorkEvent,
  renderWidget,
  setTextareaValue,
  type DirectWorkStreamEvent,
} from "./InteractiveAgentPlaceholderWidget.test-utils";
import type { WorkspaceAgentQueueBridge } from "./workspaceAgentQueueBridge";
import type {
  QueueWidgetActionResult,
  QueueWidgetItemSnapshot,
  QueueWidgetSnapshot,
} from "./queue/agentQueueWidgetApiTypes";

describe("InteractiveAgentPlaceholderWidget Agent Self-Test Runner", () => {
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
    expect(reportText).toContain("agent.status.read");
    expect(reportText).toContain("agent.history.read");
    expect(reportText).toContain("agent.message.send");
    expect(reportText).toContain("agent.capabilities.read");
    expect(reportText).toContain("agent.selfTest.run");
    expect(reportText).toContain("Queue widget contract");
    expect(reportText).toContain("Workspace Agent widget contract");
    expect(reportText).toContain("Knowledge / Skills");
    expect(reportText).toContain("Notes");
    expect(reportText).toContain("Terminal");
    expect(reportText).toContain("Capability unavailable");
    expect(reportText).toContain("Not implemented yet");
    expect(reportText).toContain("Dry-run only");
    expect(reportText).toContain("No hidden side effects");
    expect(reportText).not.toContain("{");
    expect(reportText).not.toContain("reportId");
  });

  it("runs self-test without Codex, shell, Queue mutation, workers, Terminal, Git, or rollback execution", async () => {
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

async function flushAsync() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
  });
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
