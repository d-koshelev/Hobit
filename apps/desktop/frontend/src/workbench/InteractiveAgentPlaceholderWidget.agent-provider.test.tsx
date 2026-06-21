import { act } from "react";
import { describe, expect, it, vi } from "vitest";

import {
  clickButton,
  lastAssistantMessageText,
  renderWidget,
  setTextareaValue,
} from "./InteractiveAgentPlaceholderWidget.test-utils";
import type { WorkspaceAgentQueueBridge } from "./workspaceAgentQueueBridge";
import {
  createFakeAgentProvider,
  fakeAgentProviderScriptForScenario,
  type FakeAgentProviderScenario,
} from "./agentRuntime";
import type {
  QueueWidgetActionResult,
  QueueWidgetItemSnapshot,
  QueueWidgetSnapshot,
} from "./queue/agentQueueWidgetApiTypes";

describe("WorkspaceAgent AgentProvider", () => {
  it("uses FakeAgentProvider for final answer turns without Codex", async () => {
    renderWidget({
      workspaceAgentProvider: fakeProvider("final_answer"),
      workspaceId: "workspace_1",
    });

    await runDirectWork("Answer through fake provider.");
    await flushAsync();

    expect(lastAssistantMessageText()).toBe("Fake provider final answer.");
  });

  it("uses FakeAgentProvider for valid action requests", async () => {
    const listItemAggregates = vi.fn(async () => []);

    renderWidget({
      workspaceAgentProvider: fakeProvider("valid_action_request"),
      workspaceAgentQueueBridge: queueBridge({ listItemAggregates }),
      workspaceId: "workspace_1",
    });

    await runDirectWork("List Queue items through fake provider.");
    await flushAsync();

    expect(listItemAggregates).toHaveBeenCalledTimes(1);
    expect(allAssistantMessageText()).toEqual(
      expect.arrayContaining([
        expect.stringContaining("Action 1/16: queue.items.list"),
        expect.stringContaining("Queue items listed."),
      ]),
    );
  });

  it("stops invalid FakeAgentProvider action requests before broker execution", async () => {
    const listItemAggregates = vi.fn(async () => []);

    renderWidget({
      workspaceAgentProvider: fakeProvider("invalid_action_request"),
      workspaceAgentQueueBridge: queueBridge({ listItemAggregates }),
      workspaceId: "workspace_1",
    });

    await runDirectWork("Emit an invalid fake action.");
    await flushAsync();

    expect(listItemAggregates).not.toHaveBeenCalled();
    expect(lastAssistantMessageText()).toContain("Invalid Hobit action request.");
    expect(lastAssistantMessageText()).toContain(
      "Stopped: invalid or unsupported action envelope.",
    );
  });

  it("recognizes FakeAgentProvider workflow requests without executing workflows", async () => {
    const listItemAggregates = vi.fn(async () => []);

    renderWidget({
      workspaceAgentProvider: fakeProvider("valid_workflow_request"),
      workspaceAgentQueueBridge: queueBridge({ listItemAggregates }),
      workspaceId: "workspace_1",
    });

    await runDirectWork("Emit a fake workflow request.");
    await flushAsync();

    expect(listItemAggregates).not.toHaveBeenCalled();
    expect(lastAssistantMessageText()).toContain(
      "Workflow request recognized, but workflow is not declared/implemented yet.",
    );
  });

  it("rejects invalid FakeAgentProvider workflow requests before broker execution", async () => {
    const listItemAggregates = vi.fn(async () => []);

    renderWidget({
      workspaceAgentProvider: fakeProvider("invalid_workflow_request"),
      workspaceAgentQueueBridge: queueBridge({ listItemAggregates }),
      workspaceId: "workspace_1",
    });

    await runDirectWork("Emit an invalid fake workflow request.");
    await flushAsync();

    expect(listItemAggregates).not.toHaveBeenCalled();
    expect(lastAssistantMessageText()).toContain("Invalid Hobit workflow request.");
    expect(lastAssistantMessageText()).toContain("product_input_in_grant");
  });

  it("surfaces FakeAgentProvider error events without invoking Queue", async () => {
    const listItemAggregates = vi.fn(async () => []);

    renderWidget({
      workspaceAgentProvider: fakeProvider("error"),
      workspaceAgentQueueBridge: queueBridge({ listItemAggregates }),
      workspaceId: "workspace_1",
    });

    await runDirectWork("Fail through fake provider.");
    await flushAsync();

    expect(listItemAggregates).not.toHaveBeenCalled();
    expect(lastAssistantMessageText()).toContain("Fake provider failed.");
  });

  it("surfaces FakeAgentProvider cancellation without invoking Queue", async () => {
    const listItemAggregates = vi.fn(async () => []);

    renderWidget({
      workspaceAgentProvider: fakeProvider("cancelled"),
      workspaceAgentQueueBridge: queueBridge({ listItemAggregates }),
      workspaceId: "workspace_1",
    });

    await runDirectWork("Cancel through fake provider.");
    await flushAsync();

    expect(listItemAggregates).not.toHaveBeenCalled();
    expect(lastAssistantMessageText()).toContain("Fake provider cancelled.");
  });
});

function fakeProvider(scenario: FakeAgentProviderScenario) {
  return createFakeAgentProvider({
    providerId: `fake-${scenario}`,
    providerThreadId: "fake-thread-1",
    script: fakeAgentProviderScriptForScenario(scenario),
  });
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

function snapshotResult(
  overrides: Partial<QueueWidgetSnapshot> = {},
): QueueWidgetActionResult<QueueWidgetSnapshot> {
  return {
    action: "queue.getSnapshot",
    events: [],
    message: "Queue snapshot returned.",
    ok: true,
    safetyClass: "safe_read",
    snapshot: {
      items: [],
      queueId: "workspace:workspace_1:agent-queue",
      selectedItem: null,
      selectedItemId: null,
      widgetType: "agent-queue",
      workspaceId: "workspace_1",
      ...overrides,
    } as QueueWidgetSnapshot,
  };
}

async function runDirectWork(prompt: string) {
  await setTextareaValue(prompt);
  await clickButton("Run with Codex");
}

async function flushAsync(cycles = 12) {
  await act(async () => {
    for (let index = 0; index < cycles; index += 1) {
      await Promise.resolve();
    }
  });
}

function allAssistantMessageText() {
  return Array.from(
    document.querySelectorAll(
      '[data-testid="interactive-agent-message-assistant"]',
    ),
  ).map(
    (message) =>
      message.querySelector(".interactive-agent-message-body")?.textContent ??
      "",
  );
}
