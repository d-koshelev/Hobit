import { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

import { InteractiveAgentPlaceholderWidget } from "./InteractiveAgentPlaceholderWidget";
import type { WidgetDefinition, WidgetInstance } from "./types";
import type {
  DirectWorkStreamEvent,
  GenerateCoordinatorProviderResponse,
  GenerateCoordinatorProviderResponseRequest,
  KnowledgeDocument,
  KnowledgeDocumentSearchResult,
  Skill,
} from "../workspace/types";

type CreateQueueTaskInput = Parameters<
  NonNullable<
    Parameters<typeof InteractiveAgentPlaceholderWidget>[0]["onCreateAgentQueueTask"]
  >
>[0];

type CreateKnowledgeDocumentInput = Parameters<
  NonNullable<
    Parameters<
      typeof InteractiveAgentPlaceholderWidget
    >[0]["onCreateKnowledgeDocument"]
  >
>[0];

type CreateSkillInput = Parameters<
  NonNullable<
    Parameters<typeof InteractiveAgentPlaceholderWidget>[0]["onCreateSkill"]
  >
>[0];

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

describe("InteractiveAgentPlaceholderWidget Workspace Agent UI", () => {
  it("renders suggested prompts and compact safety badges in the empty state", () => {
    renderWidget();

    expect(document.body.textContent).not.toContain("Direct Mode");
    expect(document.body.textContent).not.toContain("Codex Direct Mode");
    expect(checkboxWithLabel("Direct Mode")).toBeUndefined();
    expect(document.body.textContent).toContain("Agent");
    expect(document.body.textContent).toContain("Codex");
    expect(document.body.textContent).toContain("Status");
    expect(document.body.textContent).toContain("Ready");
    expect(agentPicker()?.value).toBe("codex");
    expect(agentPicker()?.disabled).toBe(true);
    expect(document.body.textContent).toContain("Make a plan");
    expect(document.body.textContent).toContain("Break into Queue tasks");
    expect(document.body.textContent).toContain("Draft tasks for this goal");
    expect(document.body.textContent).toContain("Review pasted Queue result");
    expect(document.body.textContent).toContain("Explain this Executor failure");
    expect(document.body.textContent).toContain("Turn this result into next steps");
    expect(document.body.textContent).toContain("Draft follow-up Queue tasks");
    expect(document.body.textContent).toContain("Summarize validation output");
    expect(document.body.textContent).toContain(
      "Explain how to execute this safely",
    );
    expect(document.body.textContent).toContain("visible chat only");
    expect(document.body.textContent).toContain("No tools run");
    expect(document.body.textContent).not.toContain("Agent details");
    expect(
      document.querySelector(".widget-title")?.textContent,
    ).toBe("Workspace Agent");
    expect(document.body.textContent).not.toContain(
      "Plan work, draft tasks, review results",
    );
    expect(document.body.textContent).not.toContain("Response setup");
    expect(document.body.textContent).not.toContain("Backend selected");
    expect(document.body.textContent).not.toContain("Mock/local fallback");
    expect(document.body.textContent).not.toContain("Supported review cards");
    expect(document.body.textContent).toContain(
      "Drafts stay inert until you approve them and use the separate create or copy action.",
    );
    expect(
      document.querySelector('[aria-label="Workspace Agent suggested prompts"]'),
    ).not.toBeNull();
    expect(
      document.querySelector(".interactive-agent-empty")?.textContent,
    ).toContain("Workspace Agent works from visible chat and explicit attachments.");
  });

  it("shows Codex as the default agent with home as the default working directory", async () => {
    renderWidget({ onStartCodexDirectWorkStream: vi.fn() });

    expect(checkboxWithLabel("Direct Mode")).toBeUndefined();
    expect(buttonWithText("Start Direct Work")).toBeUndefined();

    expect(document.querySelector(".interactive-agent-direct-mode-bar")).not.toBeNull();
    expect(document.body.textContent).toContain("Working dir");
    expect(textInputValue()).toBe("~");
    expect(document.body.textContent).toContain("No active thread");
    expect(document.body.textContent).toContain("New thread");
    expect(buttonsWithText("New thread")).toHaveLength(1);
    expect(document.body.textContent).not.toContain("New Codex thread");
    expect(document.body.textContent).toContain(
      "~ resolves to your user home.",
    );
    expect(document.body.textContent).toContain(
      "If access is denied, choose a project folder or scratch workspace.",
    );
    expect(document.body.textContent).toContain(
      "Try: /Documents/hobit-workspace-agent-scratch",
    );
    expect(buttonWithText("Run with Codex")).toBeDefined();
    expect(document.body.textContent).not.toContain("Codex Direct Mode");
  });

  it("renders the transcript directly before the composer input", () => {
    renderWidget({ onStartCodexDirectWorkStream: vi.fn() });

    const transcript = document.querySelector(
      ".interactive-agent-message-list",
    );
    const composer = document.querySelector(".interactive-agent-composer");
    const textarea = document.querySelector("textarea");
    const directModePanel = document.querySelector(
      ".interactive-agent-direct-mode",
    );

    expect(transcript).not.toBeNull();
    expect(composer).not.toBeNull();
    expect(textarea).not.toBeNull();
    expect(directModePanel).not.toBeNull();
    expect(
      transcript!.compareDocumentPosition(composer!) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(
      textarea!.compareDocumentPosition(directModePanel!) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it("message send still behaves like chat when the Codex bridge is unavailable", async () => {
    const startDirectWork = vi.fn();
    const provider = vi.fn(async () => providerResponse());
    renderWidget({ onGenerateCoordinatorProviderResponse: provider });

    await sendMessage("Make a plan for visible work");

    expect(startDirectWork).not.toHaveBeenCalled();
    expect(provider).toHaveBeenCalledTimes(1);
    expect(document.body.textContent).toContain("Workspace Agent plan");
  });

  it("renders transcript bubbles without visible speaker labels", async () => {
    const provider = vi.fn(async () =>
      providerResponse({ assistantText: "Assistant visible answer." }),
    );
    renderWidget({ onGenerateCoordinatorProviderResponse: provider });

    await sendMessage("Operator visible request.");

    const operatorMessages = document.querySelectorAll(
      '[data-testid="interactive-agent-message-operator"]',
    );
    const assistantMessages = document.querySelectorAll(
      '[data-testid="interactive-agent-message-assistant"]',
    );
    const operatorBubble = operatorMessages[operatorMessages.length - 1];
    const assistantBubble = assistantMessages[assistantMessages.length - 1];

    expect(operatorBubble?.getAttribute("aria-label")).toBe("User message");
    expect(assistantBubble?.getAttribute("aria-label")).toBe(
      "Workspace Agent message",
    );
    expect(operatorBubble?.textContent).toContain("Operator visible request.");
    expect(assistantBubble?.textContent).toContain("Assistant visible answer.");
    expect(operatorBubble?.textContent).not.toContain("You");
    expect(assistantBubble?.textContent).not.toContain("Workspace Agent");
  });

  it("Codex makes the primary composer action run without calling the chat provider", async () => {
    const provider = vi.fn(async () => providerResponse());
    const startDirectWork = vi.fn(
      async (
        _widgetInstanceId: string,
        _request: unknown,
        onEvent: (event: DirectWorkStreamEvent) => void,
      ) => {
        onEvent(directWorkEvent({ eventKind: "started", runId: "run_brain" }));
        onEvent(
          directWorkEvent({
            codexThreadId: "thread_brain_123456",
            eventKind: "codex_json_event",
            parsedCodexEventType: "thread.started",
            runId: "run_brain",
          }),
        );
        onEvent(
          directWorkEvent({
            eventKind: "completed",
            finalStatus: "completed",
            isFinal: true,
            runId: "run_brain",
            text: "Codex handled the task.",
          }),
        );
        return {
          runId: "run_brain",
          status: "started",
          stopListening: vi.fn(),
        };
      },
    );
    renderWidget({
      onGenerateCoordinatorProviderResponse: provider,
      onStartCodexDirectWorkStream: startDirectWork,
    });

    await toggleDirectMode();
    await setTextareaValue("Make a plan while Codex is active");
    await clickButton("Run with Codex");

    expect(startDirectWork).toHaveBeenCalledTimes(1);
    expect(startDirectWork.mock.calls[0][1]).toMatchObject({
      codexThreadId: null,
      operatorPrompt: "Make a plan while Codex is active",
      skipGitRepoCheck: true,
    });
    expect(provider).not.toHaveBeenCalled();
    expect(document.body.textContent).toContain(
      "Runs with Codex from the selected working directory.",
    );
    expect(document.body.textContent).toContain(
      "Starting new Codex thread. Workspace knowledge not available. Starting Codex Direct Work from ~.",
    );
    expect(document.body.textContent).toContain("Codex handled the task.");
    expect(document.body.textContent).toContain("Thread active thread_b...");
    expect(lastAssistantMessageText()).toBe("Codex handled the task.");
    expect(lastAssistantMessageText()).not.toContain("Sent to Codex Direct Mode");
    expect(lastAssistantMessageText()).not.toContain("Starting foreground Codex Direct Work");
    expect(lastAssistantMessageText()).not.toContain("Starting Codex Direct Work");
    expect(lastAssistantMessageText()).not.toContain("Codex Direct Mode completed");
    expect(document.body.textContent).not.toContain("Drafting from the visible chat.");
    expect(document.body.textContent).not.toContain("Workspace Agent plan");
  });

  it("shows one-line live activity without adding activity to the transcript", async () => {
    const publishActivityEvents = vi.fn();
    const startDirectWork = vi.fn(
      async (
        _widgetInstanceId: string,
        _request: unknown,
        onEvent: (event: DirectWorkStreamEvent) => void,
      ) => {
        onEvent(directWorkEvent({ eventKind: "started", runId: "run_live" }));
        onEvent(
          directWorkEvent({
            eventKind: "codex_json_event",
            isFinal: false,
            line: JSON.stringify({
              item: {
                args: ["status"],
                command: "git",
                type: "command_execution",
              },
              type: "item.started",
            }),
            parsedCodexEventType: "item.started",
            runId: "run_live",
          }),
        );
        return {
          runId: "run_live",
          status: "started",
          stopListening: vi.fn(),
        };
      },
    );
    renderWidget({
      onPublishAgentActivityEvents: publishActivityEvents,
      onStartCodexDirectWorkStream: startDirectWork,
    });

    await setTextareaValue("Check repo status.");
    await clickButton("Run with Codex");

    expect(document.body.textContent).toContain(
      "Codex is runningRunning command: git status",
    );
    const assistantMessages = document.querySelectorAll(
      '[data-testid="interactive-agent-message-assistant"]',
    );
    expect(assistantMessages).toHaveLength(0);
    expect(lastOperatorMessageText()).toBe("Check repo status.");
    const details = document.querySelector<HTMLDetailsElement>(
      ".interactive-agent-direct-mode-details",
    );
    expect(details?.open).toBe(false);
    expect(details?.textContent).toContain("item.started");
    expect(publishActivityEvents).toHaveBeenCalled();
    expect(
      publishActivityEvents.mock.calls.flatMap((call) => call[0]),
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          runId: "run_live",
          sourceKind: "workspace-agent",
          summary: "Running git status",
          title: "Ran command",
        }),
      ]),
    );
  });

  it("stores the first Codex thread id and resumes it on the next Codex run", async () => {
    const startDirectWork = vi.fn(
      async (
        _widgetInstanceId: string,
        request: unknown,
        onEvent: (event: DirectWorkStreamEvent) => void,
      ) => {
        const runId =
          (request as { codexThreadId?: string | null }).codexThreadId
            ? "run_resume"
            : "run_new";
        onEvent(directWorkEvent({ eventKind: "started", runId }));
        onEvent(
          directWorkEvent({
            codexThreadId: "thread_stateful_123456",
            eventKind: "codex_json_event",
            parsedCodexEventType: "thread.started",
            runId,
          }),
        );
        onEvent(
          directWorkEvent({
            eventKind: "final_message",
            isFinal: false,
            runId,
            text: `Final for ${runId}.`,
          }),
        );
        onEvent(
          directWorkEvent({
            eventKind: "completed",
            finalStatus: "completed",
            isFinal: true,
            runId,
          }),
        );
        return {
          runId,
          status: "started",
          stopListening: vi.fn(),
        };
      },
    );
    renderWidget({ onStartCodexDirectWorkStream: startDirectWork });

    await toggleDirectMode();
    await setTextareaValue("I have 5 apples, you have 2.");
    await clickButton("Run with Codex");
    await setTextareaValue("How many apples do you have?");
    await clickButton("Run with Codex");

    expect(startDirectWork).toHaveBeenCalledTimes(2);
    expect(startDirectWork.mock.calls[0][1]).toMatchObject({
      codexThreadId: null,
      operatorPrompt: "I have 5 apples, you have 2.",
    });
    expect(startDirectWork.mock.calls[1][1]).toMatchObject({
      codexThreadId: "thread_stateful_123456",
      operatorPrompt: "How many apples do you have?",
    });
    expect(
      JSON.stringify(startDirectWork.mock.calls[1][1]),
    ).not.toContain("I have 5 apples");
    expect(document.body.textContent).toContain("Continuing Codex thread");
    expect(document.body.textContent).toContain("Thread active thread_s...");
  });

  it("keeps Codex thread ids independent across two Workspace Agent widgets", async () => {
    const startDirectWork = vi.fn(
      async (
        widgetInstanceId: string,
        _request: unknown,
        onEvent: (event: DirectWorkStreamEvent) => void,
      ) => {
        const threadId =
          widgetInstanceId === "coordinator_widget_a"
            ? "thread_agent_a_123456"
            : "thread_agent_b_123456";
        const runId = `run_${widgetInstanceId}_${startDirectWork.mock.calls.length}`;
        onEvent(
          directWorkEvent({
            codexThreadId: threadId,
            eventKind: "codex_json_event",
            parsedCodexEventType: "thread.started",
            runId,
            widgetInstanceId,
          }),
        );
        onEvent(
          directWorkEvent({
            eventKind: "completed",
            finalStatus: "completed",
            isFinal: true,
            runId,
            text: `Final for ${widgetInstanceId}.`,
            widgetInstanceId,
          }),
        );
        return {
          runId,
          status: "started",
          stopListening: vi.fn(),
        };
      },
    );

    renderWidgetTree(
      <>
        <div data-testid="agent-a">
          <InteractiveAgentPlaceholderWidget
            config={{}}
            definition={definition()}
            instance={instance({ id: "coordinator_widget_a" })}
            onStartCodexDirectWorkStream={startDirectWork}
            title="Workspace Agent A"
            workspaceId="workspace_1"
          />
        </div>
        <div data-testid="agent-b">
          <InteractiveAgentPlaceholderWidget
            config={{}}
            definition={definition()}
            instance={instance({ id: "coordinator_widget_b" })}
            onStartCodexDirectWorkStream={startDirectWork}
            title="Workspace Agent B"
            workspaceId="workspace_1"
          />
        </div>
      </>,
    );

    await setTextareaValueIn('[data-testid="agent-a"]', "Agent A first run.");
    await clickButtonIn('[data-testid="agent-a"]', "Run with Codex");
    await setTextareaValueIn('[data-testid="agent-b"]', "Agent B first run.");
    await clickButtonIn('[data-testid="agent-b"]', "Run with Codex");
    await setTextareaValueIn('[data-testid="agent-a"]', "Agent A follow-up.");
    await clickButtonIn('[data-testid="agent-a"]', "Run with Codex");
    await setTextareaValueIn('[data-testid="agent-b"]', "Agent B follow-up.");
    await clickButtonIn('[data-testid="agent-b"]', "Run with Codex");

    expect(startDirectWork).toHaveBeenCalledTimes(4);
    expect(startDirectWork.mock.calls[0][1]).toMatchObject({
      codexThreadId: null,
      operatorPrompt: "Agent A first run.",
    });
    expect(startDirectWork.mock.calls[1][1]).toMatchObject({
      codexThreadId: null,
      operatorPrompt: "Agent B first run.",
    });
    expect(startDirectWork.mock.calls[2][1]).toMatchObject({
      codexThreadId: "thread_agent_a_123456",
      operatorPrompt: "Agent A follow-up.",
    });
    expect(startDirectWork.mock.calls[3][1]).toMatchObject({
      codexThreadId: "thread_agent_b_123456",
      operatorPrompt: "Agent B follow-up.",
    });
  });

  it("switching workspace clears the active Codex thread", async () => {
    const startDirectWork = vi.fn(
      async (
        _widgetInstanceId: string,
        _request: unknown,
        onEvent: (event: DirectWorkStreamEvent) => void,
      ) => {
        const runId = `run_${startDirectWork.mock.calls.length}`;
        onEvent(
          directWorkEvent({
            codexThreadId: "thread_workspace_a_123456",
            eventKind: "codex_json_event",
            parsedCodexEventType: "thread.started",
            runId,
            workspaceId: "workspace_a",
          }),
        );
        onEvent(
          directWorkEvent({
            eventKind: "completed",
            finalStatus: "completed",
            isFinal: true,
            runId,
            text: "Workspace A final.",
            workspaceId: "workspace_a",
          }),
        );
        return {
          runId,
          status: "started",
          stopListening: vi.fn(),
        };
      },
    );
    renderWidget({
      onStartCodexDirectWorkStream: startDirectWork,
      workspaceId: "workspace_a",
    });

    await setTextareaValue("Workspace A first run.");
    await clickButton("Run with Codex");
    expect(document.body.textContent).toContain("Thread active thread_w...");

    await rerenderWidget({
      onStartCodexDirectWorkStream: startDirectWork,
      workspaceId: "workspace_b",
    });

    expect(document.body.textContent).toContain("No active thread");
    expect(document.body.textContent).not.toContain("Thread active thread_w...");

    await setTextareaValue("Workspace B first run.");
    await clickButton("Run with Codex");

    expect(startDirectWork).toHaveBeenCalledTimes(2);
    expect(startDirectWork.mock.calls[1][1]).toMatchObject({
      codexThreadId: null,
      operatorPrompt: "Workspace B first run.",
    });
  });

  it("switching Workspace Agent widget instance clears the active Codex thread", async () => {
    const startDirectWork = vi.fn(
      async (
        widgetInstanceId: string,
        _request: unknown,
        onEvent: (event: DirectWorkStreamEvent) => void,
      ) => {
        const runId = `run_${startDirectWork.mock.calls.length}`;
        onEvent(
          directWorkEvent({
            codexThreadId: "thread_agent_original_123456",
            eventKind: "codex_json_event",
            parsedCodexEventType: "thread.started",
            runId,
            widgetInstanceId,
          }),
        );
        onEvent(
          directWorkEvent({
            eventKind: "completed",
            finalStatus: "completed",
            isFinal: true,
            runId,
            text: "Widget final.",
            widgetInstanceId,
          }),
        );
        return {
          runId,
          status: "started",
          stopListening: vi.fn(),
        };
      },
    );
    renderWidget({
      instance: instance({ id: "coordinator_widget_a" }),
      onStartCodexDirectWorkStream: startDirectWork,
      workspaceId: "workspace_1",
    });

    await setTextareaValue("Widget A first run.");
    await clickButton("Run with Codex");

    await rerenderWidget({
      instance: instance({ id: "coordinator_widget_b" }),
      onStartCodexDirectWorkStream: startDirectWork,
      workspaceId: "workspace_1",
    });

    expect(document.body.textContent).toContain("No active thread");

    await setTextareaValue("Widget B first run.");
    await clickButton("Run with Codex");

    expect(startDirectWork).toHaveBeenCalledTimes(2);
    expect(startDirectWork.mock.calls[1][0]).toBe("coordinator_widget_b");
    expect(startDirectWork.mock.calls[1][1]).toMatchObject({
      codexThreadId: null,
      operatorPrompt: "Widget B first run.",
    });
  });

  it("New thread clears the current Codex thread without clearing chat", async () => {
    const startDirectWork = vi.fn(
      async (
        _widgetInstanceId: string,
        request: unknown,
        onEvent: (event: DirectWorkStreamEvent) => void,
      ) => {
        const runId =
          (request as { codexThreadId?: string | null }).codexThreadId
            ? "run_resume"
            : `run_${startDirectWork.mock.calls.length}`;
        onEvent(directWorkEvent({ eventKind: "started", runId }));
        onEvent(
          directWorkEvent({
            codexThreadId: "thread_reset_123456",
            eventKind: "codex_json_event",
            parsedCodexEventType: "thread.started",
            runId,
          }),
        );
        onEvent(
          directWorkEvent({
            eventKind: "completed",
            finalStatus: "completed",
            isFinal: true,
            runId,
            text: `Final for ${runId}.`,
          }),
        );
        return {
          runId,
          status: "started",
          stopListening: vi.fn(),
        };
      },
    );
    renderWidget({ onStartCodexDirectWorkStream: startDirectWork });

    await toggleDirectMode();
    await setTextareaValue("Remember this.");
    await clickButton("Run with Codex");
    await clickButton("New thread");
    expect(document.body.textContent).toContain("Codex thread reset.");
    expect(document.body.textContent).toContain("No active thread");

    await setTextareaValue("Start over.");
    await clickButton("Run with Codex");

    expect(startDirectWork).toHaveBeenCalledTimes(2);
    expect(startDirectWork.mock.calls[1][1]).toMatchObject({
      codexThreadId: null,
      operatorPrompt: "Start over.",
    });
    expect(document.body.textContent).toContain("Remember this.");
    expect(buttonsWithText("New thread")).toHaveLength(1);
    expect(document.body.textContent).not.toContain("New Codex thread");
  });

  it("New thread clears visible carried context and old knowledge before the next run", async () => {
    const searchKnowledge = vi
      .fn()
      .mockResolvedValueOnce([
        knowledgeResult({
          documentTitle: "Falcon code",
          snippet: "The secret smoke code for Falcon is BLUE-RAVEN-42.",
        }),
      ])
      .mockResolvedValueOnce([]);
    const startDirectWork = vi.fn(
      async (
        _widgetInstanceId: string,
        _request: unknown,
        onEvent: (event: DirectWorkStreamEvent) => void,
      ) => {
        const runId = `run_${startDirectWork.mock.calls.length}`;
        onEvent(
          directWorkEvent({
            codexThreadId: "thread_context_123456",
            eventKind: "codex_json_event",
            parsedCodexEventType: "thread.started",
            runId,
          }),
        );
        onEvent(
          directWorkEvent({
            eventKind: "completed",
            finalStatus: "completed",
            isFinal: true,
            runId,
            text: "Falcon answer handled.",
          }),
        );
        return {
          runId,
          status: "started",
          stopListening: vi.fn(),
        };
      },
    );
    renderWidget({
      onSearchKnowledgeDocuments: searchKnowledge,
      onStartCodexDirectWorkStream: startDirectWork,
      workspaceId: "workspace_1",
    });

    await setTextareaValue("What is the Falcon smoke code?");
    await clickButton("Run with Codex");
    expect(
      (startDirectWork.mock.calls[0][1] as { operatorPrompt: string })
        .operatorPrompt,
    ).toContain("BLUE-RAVEN-42");

    await rerenderWidget({
      coordinatorAttachedContextRequest: attachedContextRequest({
        contextText: "Carryover should be removable: BLUE-RAVEN-42",
        sourceLabel: "Manual context",
      }),
      onSearchKnowledgeDocuments: searchKnowledge,
      onStartCodexDirectWorkStream: startDirectWork,
      workspaceId: "workspace_1",
    });
    expect(textareaValue()).toContain("BLUE-RAVEN-42");

    await clickButton("New thread");

    expect(textareaValue()).not.toContain("BLUE-RAVEN-42");
    expect(document.body.textContent).toContain("No active thread");
    expect(document.body.textContent).not.toContain(
      "Falcon code, chunk 1",
    );

    await setTextareaValue("Ask again without workspace knowledge.");
    await clickButton("Run with Codex");

    const nextRequest = startDirectWork.mock.calls[1][1] as {
      codexThreadId: string | null;
      operatorPrompt: string;
    };
    expect(nextRequest.codexThreadId).toBeNull();
    expect(nextRequest.operatorPrompt).toBe(
      "Ask again without workspace knowledge.",
    );
    expect(nextRequest.operatorPrompt).not.toContain("BLUE-RAVEN-42");
    expect(document.body.textContent).toContain(
      "Workspace knowledge checked: no matches",
    );
  });

  it("changing the working directory clears the current Codex thread", async () => {
    const startDirectWork = vi.fn(
      async (
        _widgetInstanceId: string,
        _request: unknown,
        onEvent: (event: DirectWorkStreamEvent) => void,
      ) => {
        const runId = `run_${startDirectWork.mock.calls.length}`;
        onEvent(directWorkEvent({ eventKind: "started", runId }));
        onEvent(
          directWorkEvent({
            codexThreadId: "thread_directory_123456",
            eventKind: "codex_json_event",
            parsedCodexEventType: "thread.started",
            runId,
          }),
        );
        onEvent(
          directWorkEvent({
            eventKind: "completed",
            finalStatus: "completed",
            isFinal: true,
            runId,
            text: `Final for ${runId}.`,
          }),
        );
        return {
          runId,
          status: "started",
          stopListening: vi.fn(),
        };
      },
    );
    renderWidget({ onStartCodexDirectWorkStream: startDirectWork });

    await toggleDirectMode();
    await setTextareaValue("Run in home.");
    await clickButton("Run with Codex");
    await setTextInputValue("C:/work/project");
    expect(document.body.textContent).toContain(
      "Working directory changed. Next Codex run starts a new thread.",
    );

    await setTextareaValue("Run in the new directory.");
    await clickButton("Run with Codex");

    expect(startDirectWork).toHaveBeenCalledTimes(2);
    expect(startDirectWork.mock.calls[1][1]).toMatchObject({
      codexThreadId: null,
      repoRoot: "C:/work/project",
    });
  });

  it("selecting a working directory with Browse clears the current Codex thread", async () => {
    const startDirectWork = vi.fn(
      async (
        _widgetInstanceId: string,
        _request: unknown,
        onEvent: (event: DirectWorkStreamEvent) => void,
      ) => {
        const runId = `run_${startDirectWork.mock.calls.length}`;
        onEvent(directWorkEvent({ eventKind: "started", runId }));
        onEvent(
          directWorkEvent({
            codexThreadId: "thread_browse_123456",
            eventKind: "codex_json_event",
            parsedCodexEventType: "thread.started",
            runId,
          }),
        );
        onEvent(
          directWorkEvent({
            eventKind: "completed",
            finalStatus: "completed",
            isFinal: true,
            runId,
            text: `Final for ${runId}.`,
          }),
        );
        return {
          runId,
          status: "started",
          stopListening: vi.fn(),
        };
      },
    );
    const selectWorkspaceDirectory = vi.fn(async () => "C:/work/browsed");
    renderWidget({
      onSelectWorkspaceDirectory: selectWorkspaceDirectory,
      onStartCodexDirectWorkStream: startDirectWork,
    });

    await toggleDirectMode();
    await setTextareaValue("Run in home.");
    await clickButton("Run with Codex");
    await clickButton("Browse");

    expect(selectWorkspaceDirectory).toHaveBeenCalledTimes(1);
    expect(textInputValue()).toBe("C:/work/browsed");
    expect(document.body.textContent).toContain(
      "Working directory changed. Next Codex run starts a new thread.",
    );

    await setTextareaValue("Run in the browsed directory.");
    await clickButton("Run with Codex");

    expect(startDirectWork).toHaveBeenCalledTimes(2);
    expect(startDirectWork.mock.calls[1][1]).toMatchObject({
      codexThreadId: null,
      repoRoot: "C:/work/browsed",
    });
  });

  it("requires a working directory before starting Codex", async () => {
    const startDirectWork = vi.fn();
    renderWidget({ onStartCodexDirectWorkStream: startDirectWork });

    await toggleDirectMode();
    await setTextInputValue("");
    await setTextareaValue("Implement a focused change.");
    await clickButton("Run with Codex");

    expect(startDirectWork).not.toHaveBeenCalled();
    expect(document.body.textContent).toContain(
      "Working directory is required before Direct Work can start.",
    );
    expect(document.body.textContent).toContain("Direct Work failed");
    expect(document.body.textContent).toContain("failed");
  });

  it("Codex with an empty composer does not start", async () => {
    const startDirectWork = vi.fn();
    renderWidget({ onStartCodexDirectWorkStream: startDirectWork });

    await toggleDirectMode();

    const runButton = buttonWithText("Run with Codex");
    expect(runButton).toBeDefined();
    expect(runButton?.hasAttribute("disabled")).toBe(true);
    expect(startDirectWork).not.toHaveBeenCalled();
  });

  it("adds retrieved workspace knowledge visibly to the Codex prompt", async () => {
    const searchKnowledge = vi.fn(async () => [
      knowledgeResult({
        chunkId: "chunk_api_1",
        documentTitle: "API guide",
        snippet: "Use the workspace-local API reference.",
      }),
      knowledgeResult({
        chunkId: "chunk_runbook_1",
        documentTitle: "Runbook guide",
        snippet: "Validate with the documented smoke command.",
      }),
    ]);
    const startDirectWork = vi.fn(
      async (
        _widgetInstanceId: string,
        _request: unknown,
        onEvent: (event: DirectWorkStreamEvent) => void,
      ) => {
        onEvent(
          directWorkEvent({
            eventKind: "completed",
            finalStatus: "completed",
            isFinal: true,
            text: "Codex used visible knowledge if relevant.",
          }),
        );
        return {
          runId: "run_knowledge",
          status: "started",
          stopListening: vi.fn(),
        };
      },
    );
    renderWidget({
      onSearchKnowledgeDocuments: searchKnowledge,
      onStartCodexDirectWorkStream: startDirectWork,
    });

    await toggleDirectMode();
    await setTextareaValue("Use the API docs for this task.");
    await clickButton("Run with Codex");

    expect(searchKnowledge).toHaveBeenCalledWith({
      limit: 5,
      query: "Use the API docs for this task.",
    });
    expect(startDirectWork).toHaveBeenCalledTimes(1);
    const request = startDirectWork.mock.calls[0][1] as {
      operatorPrompt: string;
    };
    expect(request.operatorPrompt).toContain(
      "Workspace knowledge found for this request:",
    );
    expect(request.operatorPrompt).toContain("[Doc: API guide, chunk 1]");
    expect(request.operatorPrompt).toContain("Scope: Workspace");
    expect(request.operatorPrompt).toContain(
      "Use the workspace-local API reference.",
    );
    expect(request.operatorPrompt).toContain("User request:");
    expect(request.operatorPrompt).toContain("Use the API docs for this task.");
    expect(JSON.stringify(request)).not.toMatch(/notes body|filesystem|disabled/i);
    expect(document.body.textContent).toContain("Used knowledge: 2 snippets");
    expect(document.body.textContent).toContain("Workspace API guide, chunk 1");
  });

  it("shows global and workspace scope for used knowledge details and prompt context", async () => {
    const searchKnowledge = vi.fn(async () => [
      knowledgeResult({
        chunkId: "chunk_workspace_1",
        documentTitle: "Falcon deployment notes",
        scope: "workspace",
        snippet: "Use workspace Falcon deployment notes.",
      }),
      knowledgeResult({
        chunkId: "chunk_global_1",
        documentTitle: "Vertica EON troubleshooting",
        scope: "global",
        snippet: "Use global Vertica EON troubleshooting.",
      }),
    ]);
    const startDirectWork = vi.fn(
      async (
        _widgetInstanceId: string,
        _request: unknown,
        onEvent: (event: DirectWorkStreamEvent) => void,
      ) => {
        onEvent(
          directWorkEvent({
            eventKind: "completed",
            finalStatus: "completed",
            isFinal: true,
            text: "Codex used scoped knowledge if relevant.",
          }),
        );
        return {
          runId: "run_scoped_knowledge",
          status: "started",
          stopListening: vi.fn(),
        };
      },
    );
    renderWidget({
      onSearchKnowledgeDocuments: searchKnowledge,
      onStartCodexDirectWorkStream: startDirectWork,
    });

    await setTextareaValue("Use Falcon and EON docs.");
    await clickButton("Run with Codex");

    const request = startDirectWork.mock.calls[0][1] as {
      operatorPrompt: string;
    };
    expect(request.operatorPrompt).toContain("Scope: Workspace");
    expect(request.operatorPrompt).toContain("Scope: Global");
    expect(document.body.textContent).toContain(
      "Workspace Falcon deployment notes, chunk 1",
    );
    expect(document.body.textContent).toContain(
      "Global Vertica EON troubleshooting, chunk 1",
    );
  });

  it("shows no-match knowledge checks without augmenting the Codex prompt", async () => {
    const searchKnowledge = vi.fn(async () => []);
    const startDirectWork = vi.fn(
      async (
        _widgetInstanceId: string,
        _request: unknown,
        onEvent: (event: DirectWorkStreamEvent) => void,
      ) => {
        onEvent(
          directWorkEvent({
            eventKind: "completed",
            finalStatus: "completed",
            isFinal: true,
            text: "No matching workspace knowledge.",
          }),
        );
        return {
          runId: "run_no_knowledge",
          status: "started",
          stopListening: vi.fn(),
        };
      },
    );
    renderWidget({
      onSearchKnowledgeDocuments: searchKnowledge,
      onStartCodexDirectWorkStream: startDirectWork,
    });

    await toggleDirectMode();
    await setTextareaValue("No document should match.");
    await clickButton("Run with Codex");

    expect(searchKnowledge).toHaveBeenCalledTimes(1);
    expect(startDirectWork.mock.calls[0][1]).toMatchObject({
      operatorPrompt: "No document should match.",
    });
    expect(document.body.textContent).toContain(
      "Workspace knowledge checked: no matches",
    );
  });

  it("does not leak Falcon knowledge through a resumed thread in a new workspace", async () => {
    const searchKnowledge = vi
      .fn()
      .mockResolvedValueOnce([
        knowledgeResult({
          documentTitle: "Falcon smoke",
          snippet: "The secret smoke code for Falcon is BLUE-RAVEN-42.",
        }),
      ])
      .mockResolvedValueOnce([]);
    const startDirectWork = vi.fn(
      async (
        _widgetInstanceId: string,
        _request: unknown,
        onEvent: (event: DirectWorkStreamEvent) => void,
      ) => {
        const workspaceForRun =
          startDirectWork.mock.calls.length === 1
            ? "workspace_a"
            : "workspace_b";
        const runId = `run_${startDirectWork.mock.calls.length}`;
        onEvent(
          directWorkEvent({
            codexThreadId: "thread_falcon_a_123456",
            eventKind: "codex_json_event",
            parsedCodexEventType: "thread.started",
            runId,
            workspaceId: workspaceForRun,
          }),
        );
        onEvent(
          directWorkEvent({
            eventKind: "completed",
            finalStatus: "completed",
            isFinal: true,
            runId,
            text:
              workspaceForRun === "workspace_a"
                ? "The secret smoke code for Falcon is BLUE-RAVEN-42."
                : "No workspace-local Falcon knowledge was found.",
            workspaceId: workspaceForRun,
          }),
        );
        return {
          runId,
          status: "started",
          stopListening: vi.fn(),
        };
      },
    );
    renderWidget({
      onSearchKnowledgeDocuments: searchKnowledge,
      onStartCodexDirectWorkStream: startDirectWork,
      workspaceId: "workspace_a",
    });

    await setTextareaValue("What is the Falcon smoke code?");
    await clickButton("Run with Codex");
    expect(document.body.textContent).toContain("Thread active thread_f...");
    expect(document.body.textContent).toContain("BLUE-RAVEN-42");

    await rerenderWidget({
      onSearchKnowledgeDocuments: searchKnowledge,
      onStartCodexDirectWorkStream: startDirectWork,
      workspaceId: "workspace_b",
    });

    expect(document.body.textContent).toContain("No active thread");
    expect(document.body.textContent).not.toContain("BLUE-RAVEN-42");

    await setTextareaValue("What is the Falcon smoke code?");
    await clickButton("Run with Codex");

    const workspaceBRequest = startDirectWork.mock.calls[1][1] as {
      codexThreadId: string | null;
      operatorPrompt: string;
    };
    expect(workspaceBRequest.codexThreadId).toBeNull();
    expect(workspaceBRequest.operatorPrompt).toBe(
      "What is the Falcon smoke code?",
    );
    expect(workspaceBRequest.operatorPrompt).not.toContain("BLUE-RAVEN-42");
    expect(document.body.textContent).toContain(
      "Workspace knowledge checked: no matches",
    );
  });

  it("starts Workspace Agent Codex from the composer without creating Queue work or Autorun", async () => {
    const createQueueTask = vi.fn();
    const startQueueAutorun = vi.fn();
    const provider = vi.fn(async () => providerResponse());
    const startDirectWork = vi.fn(
      async (
        _widgetInstanceId: string,
        _request: unknown,
        onEvent: (event: DirectWorkStreamEvent) => void,
      ) => {
        onEvent(directWorkEvent({ eventKind: "started", runId: "run_1" }));
        onEvent(
          directWorkEvent({
            eventKind: "final_message",
            isFinal: false,
            runId: "run_1",
            text: "Final foreground result.",
          }),
        );
        onEvent(
          directWorkEvent({
            eventKind: "completed",
            finalStatus: "completed",
            isFinal: true,
            runId: "run_1",
          }),
        );
        return {
          runId: "run_1",
          status: "started",
          stopListening: vi.fn(),
        };
      },
    );
    renderWidget({
      onCreateAgentQueueTask: createQueueTask,
      onGenerateCoordinatorProviderResponse: provider,
      onStartAgentQueueRunnerSession: startQueueAutorun,
      onStartCodexDirectWorkStream: startDirectWork,
    });

    await toggleDirectMode();
    await setTextareaValue("Implement this directly.");
    await clickButton("Run with Codex");

    expect(startDirectWork).toHaveBeenCalledTimes(1);
    expect(startDirectWork.mock.calls[0][0]).toBe("coordinator_widget");
    expect(startDirectWork.mock.calls[0][1]).toMatchObject({
      approvalPolicy: "never",
      codexExecutable: expectedCoordinatorCodexExecutable(),
      operatorPrompt: "Implement this directly.",
      repoRoot: "~",
      sandbox: "workspace_write",
      skipGitRepoCheck: true,
    });
    expect(createQueueTask).not.toHaveBeenCalled();
    expect(startQueueAutorun).not.toHaveBeenCalled();
    expect(provider).not.toHaveBeenCalled();
    expect(document.body.textContent).toContain("completed");
    expect(document.body.textContent).toContain("Implement this directly.");
    expect(document.body.textContent).toContain(
      "Starting new Codex thread. Workspace knowledge not available. Starting Codex Direct Work from ~.",
    );
    expect(document.body.textContent).toContain("Final foreground result.");
    expect(document.body.textContent).not.toContain("Codex Direct Mode completed.");

    const operatorMessages = document.querySelectorAll(
      '[data-testid="interactive-agent-message-operator"]',
    );
    const assistantMessages = document.querySelectorAll(
      '[data-testid="interactive-agent-message-assistant"]',
    );

    expect(operatorMessages.length).toBeGreaterThan(0);
    expect(assistantMessages.length).toBeGreaterThan(0);
    expect(operatorMessages[operatorMessages.length - 1]?.textContent).toContain(
      "Implement this directly.",
    );
    expect(
      assistantMessages[assistantMessages.length - 1]?.textContent,
    ).toContain("Final foreground result.");
    expect(
      assistantMessages[assistantMessages.length - 1]?.textContent,
    ).not.toContain("Sent to Codex Direct Mode");
    expect(
      assistantMessages[assistantMessages.length - 1]?.textContent,
    ).not.toContain("Starting foreground Codex Direct Work");
    expect(
      assistantMessages[assistantMessages.length - 1]?.textContent,
    ).not.toContain("Starting Codex Direct Work");
    expect(
      assistantMessages[assistantMessages.length - 1]?.textContent,
    ).not.toContain("Codex Direct Mode completed");
    expect(operatorMessages[operatorMessages.length - 1]?.textContent).not.toContain(
      "You",
    );
    expect(
      assistantMessages[assistantMessages.length - 1]?.textContent,
    ).not.toContain("Workspace Agent");
  });

  it("shows Direct Work failure reasons and safe fallback in the compact status", async () => {
    const startDirectWork = vi.fn(
      async (
        _widgetInstanceId: string,
        _request: unknown,
        onEvent: (event: DirectWorkStreamEvent) => void,
      ) => {
        onEvent(directWorkEvent({ eventKind: "started", runId: "run_failed" }));
        onEvent(
          directWorkEvent({
            eventKind: "failed",
            finalStatus: "failed",
            isFinal: true,
            runId: "run_failed",
            errorMessage: "codex executable not found",
          }),
        );
        return {
          runId: "run_failed",
          status: "started",
          stopListening: vi.fn(),
        };
      },
    );
    renderWidget({ onStartCodexDirectWorkStream: startDirectWork });

    await toggleDirectMode();
    await setTextareaValue("Run and fail with a clear reason.");
    await clickButton("Run with Codex");

    expect(document.body.textContent).toContain("codex executable not found");
    expect(document.body.textContent).toContain(
      "Direct Work failed: codex executable not found",
    );
    expect(lastAssistantMessageText()).toBe(
      "Direct Work failed: codex executable not found",
    );
    expect(
      document.querySelector<HTMLDetailsElement>(
        ".interactive-agent-direct-mode-details",
      )?.open,
    ).toBe(false);
    expect(
      document.querySelector(".interactive-agent-direct-mode-details")
        ?.textContent,
    ).toContain("Run run_failed started.");
    expect(
      document.querySelector(".interactive-agent-direct-mode-details")
        ?.textContent,
    ).toContain("Run ended with failed.");
  });

  it("shows trusted-directory Codex failures as actionable Workspace Agent Codex copy", async () => {
    const trustedDirectoryMessage =
      "codex exec --json exited with code 1: stderr: Codex refused this directory. Workspace Agent Codex should run with skip git repo check or choose a trusted Git project. stderr: Not inside a trusted directory and --skip-git-repo-check was not specified; could not read final message file `last.txt`: file missing";
    const startDirectWork = vi.fn(
      async (
        _widgetInstanceId: string,
        _request: unknown,
        onEvent: (event: DirectWorkStreamEvent) => void,
      ) => {
        onEvent(directWorkEvent({ eventKind: "started", runId: "run_failed" }));
        onEvent(
          directWorkEvent({
            eventKind: "failed",
            finalStatus: "failed",
            isFinal: true,
            runId: "run_failed",
            errorMessage: trustedDirectoryMessage,
            stderrPreview:
              "Not inside a trusted directory and --skip-git-repo-check was not specified",
          }),
        );
        return {
          runId: "run_failed",
          status: "started",
          stopListening: vi.fn(),
        };
      },
    );
    renderWidget({ onStartCodexDirectWorkStream: startDirectWork });

    await toggleDirectMode();
    await setTextareaValue("Run from home.");
    await clickButton("Run with Codex");

    expect(document.body.textContent).toContain(
      "Codex refused this directory. Workspace Agent Codex should run with skip git repo check or choose a trusted Git project.",
    );
    expect(document.body.textContent).toContain(
      "Not inside a trusted directory and --skip-git-repo-check was not specified",
    );
  });

  it("maps access denied command output to an actionable Codex error", async () => {
    const createQueueTask = vi.fn();
    const startQueueAutorun = vi.fn();
    const startDirectWork = vi.fn(
      async (
        _widgetInstanceId: string,
        _request: unknown,
        onEvent: (event: DirectWorkStreamEvent) => void,
      ) => {
        onEvent(directWorkEvent({ eventKind: "started", runId: "run_denied" }));
        onEvent(
          directWorkEvent({
            eventKind: "stdout_line",
            isFinal: false,
            line: "UnauthorizedAccessException: Access to the path 'C:\\Users\\Someone' is denied.",
            runId: "run_denied",
          }),
        );
        onEvent(
          directWorkEvent({
            eventKind: "failed",
            finalStatus: "failed",
            isFinal: true,
            runId: "run_denied",
            errorMessage:
              "codex exec --json exited with code 1: stdout: command_execution failed",
          }),
        );
        return {
          runId: "run_denied",
          status: "started",
          stopListening: vi.fn(),
        };
      },
    );
    renderWidget({
      onCreateAgentQueueTask: createQueueTask,
      onStartAgentQueueRunnerSession: startQueueAutorun,
      onStartCodexDirectWorkStream: startDirectWork,
    });

    await toggleDirectMode();
    await setTextareaValue("List directories.");
    await clickButton("Run with Codex");

    expect(document.body.textContent).toContain(
      "Working directory access denied. Choose another folder.",
    );
    expect(document.body.textContent).toContain(
      "Codex could not access this working directory. Choose a project folder or scratch workspace.",
    );
    expect(document.body.textContent).toContain("Direct Work failed");
    expect(lastAssistantMessageText()).toBe(
      "Direct Work failed: Working directory access denied. Choose another folder.",
    );
    expect(createQueueTask).not.toHaveBeenCalled();
    expect(startQueueAutorun).not.toHaveBeenCalled();
  });

  it("shows the final Codex agent message when a command_execution item failed", async () => {
    const startDirectWork = vi.fn(
      async (
        _widgetInstanceId: string,
        _request: unknown,
        onEvent: (event: DirectWorkStreamEvent) => void,
      ) => {
        onEvent(directWorkEvent({ eventKind: "started", runId: "run_agent" }));
        onEvent(
          directWorkEvent({
            eventKind: "codex_json_event",
            isFinal: false,
            line: JSON.stringify({
              item: {
                exit_code: 1,
                stderr:
                  "UnauthorizedAccessException: Access to the path 'C:\\Users\\Someone' is denied.",
                type: "command_execution",
              },
              type: "item.completed",
            }),
            parsedCodexEventType: "item.completed",
            runId: "run_agent",
          }),
        );
        onEvent(
          directWorkEvent({
            eventKind: "codex_json_event",
            isFinal: false,
            line: JSON.stringify({
              item: {
                text: "I could not list the directories because the working directory was denied.",
                type: "agent_message",
              },
              type: "item.completed",
            }),
            parsedCodexEventType: "item.completed",
            runId: "run_agent",
          }),
        );
        onEvent(
          directWorkEvent({
            eventKind: "failed",
            finalStatus: "failed",
            isFinal: true,
            runId: "run_agent",
            errorMessage:
              "codex exec --json exited with code 1: stdout: item.completed command_execution failed",
          }),
        );
        return {
          runId: "run_agent",
          status: "started",
          stopListening: vi.fn(),
        };
      },
    );
    renderWidget({ onStartCodexDirectWorkStream: startDirectWork });

    await toggleDirectMode();
    await setTextareaValue("List directories.");
    await clickButton("Run with Codex");

    expect(document.body.textContent).toContain(
      "I could not list the directories because the working directory was denied.",
    );
    expect(document.body.textContent).toContain(
      "Working directory access denied. Choose another folder.",
    );
    const assistantMessages = document.querySelectorAll(
      '[data-testid="interactive-agent-message-assistant"]',
    );
    expect(
      assistantMessages[assistantMessages.length - 1]?.textContent,
    ).toContain(
      "I could not list the directories because the working directory was denied.",
    );
    expect(
      assistantMessages[assistantMessages.length - 1]?.textContent,
    ).not.toContain("codex exec --json exited");
    expect(
      assistantMessages[assistantMessages.length - 1]?.textContent,
    ).not.toContain("Codex Direct Mode completed");
  });

  it("shows a safe Direct Work failure fallback when no backend reason is returned", async () => {
    const startDirectWork = vi.fn(
      async (
        _widgetInstanceId: string,
        _request: unknown,
        onEvent: (event: DirectWorkStreamEvent) => void,
      ) => {
        onEvent(directWorkEvent({ eventKind: "started", runId: "run_failed" }));
        onEvent(
          directWorkEvent({
            eventKind: "failed",
            finalStatus: "failed",
            isFinal: true,
            runId: "run_failed",
          }),
        );
        return {
          runId: "run_failed",
          status: "started",
          stopListening: vi.fn(),
        };
      },
    );
    renderWidget({ onStartCodexDirectWorkStream: startDirectWork });

    await toggleDirectMode();
    await setTextareaValue("Run and fail without a clear reason.");
    await clickButton("Run with Codex");

    expect(document.body.textContent).toContain(
      "Codex Direct Work failed. Check Codex CLI availability, login, working directory, or logs.",
    );
  });

  it("Stop button calls the existing Direct Work cancellation path", async () => {
    const cancelDirectWork = vi.fn(async () => ({
      cancellationRequested: true,
      message: "Cancellation requested.",
      runId: "run_stop",
      status: "cancellation_requested",
    }));
    const startDirectWork = vi.fn(
      async (
        _widgetInstanceId: string,
        _request: unknown,
        onEvent: (event: DirectWorkStreamEvent) => void,
      ) => {
        onEvent(directWorkEvent({ eventKind: "started", runId: "run_stop" }));
        return {
          runId: "run_stop",
          status: "started",
          stopListening: vi.fn(),
        };
      },
    );
    renderWidget({
      onCancelCodexDirectWorkRun: cancelDirectWork,
      onStartCodexDirectWorkStream: startDirectWork,
    });

    await toggleDirectMode();
    await setTextareaValue("Run until stopped.");
    await clickButton("Run with Codex");
    await clickButton("Stop");

    expect(cancelDirectWork).toHaveBeenCalledWith(
      "coordinator_widget",
      "run_stop",
    );
    expect(document.body.textContent).toContain("Cancellation requested.");
  });

  it("keeps mock/local provider debug text out of the normal assistant body", async () => {
    const provider = vi.fn(async () =>
      providerResponse({
        assistantText:
          'Mock Workspace Agent provider response. I received your explicit message: "hello". Tools are disabled with allowed_tools: [], and no hidden Workspace context was used.',
        providerKind: "mock-local",
        visibleContextMessageCount: 1,
      }),
    );

    renderWidget({ onGenerateCoordinatorProviderResponse: provider });
    await sendMessage("hello");

    const assistantBodies = Array.from(
      document.querySelectorAll(
        ".interactive-agent-message-assistant .interactive-agent-message-body",
      ),
    );
    const visibleAssistantBody =
      assistantBodies[assistantBodies.length - 1]?.textContent ?? "";

    expect(visibleAssistantBody).not.toContain(
      "Mock Workspace Agent provider response",
    );
    expect(visibleAssistantBody).not.toContain(
      "I received your explicit message",
    );
    expect(visibleAssistantBody).not.toContain("allowed_tools");
    expect(document.body.textContent).toContain("allowed_tools: []");
  });

  it("renders the local fallback as assistant copy without debug wording", async () => {
    renderWidget();
    await sendMessage("what time is it?");

    const assistantBodies = Array.from(
      document.querySelectorAll(
        ".interactive-agent-message-assistant .interactive-agent-message-body",
      ),
    );
    const visibleAssistantBody =
      assistantBodies[assistantBodies.length - 1]?.textContent ?? "";

    expect(visibleAssistantBody).toContain(
      "I can help plan work, draft Queue tasks, or review pasted results.",
    );
    expect(visibleAssistantBody).toContain(
      "This workspace does not have a live time tool connected.",
    );
    expect(visibleAssistantBody).not.toContain(
      "Local deterministic fallback did not detect",
    );
    expect(visibleAssistantBody).not.toContain("proposal");
    expect(visibleAssistantBody).not.toContain("allowed_tools");
  });

  it("removes Agent details from normal UI and keeps response details collapsed", async () => {
    const provider = vi.fn(async () =>
      providerResponse({
        visibleContextMessageCount: 1,
      }),
    );

    renderWidget({ onGenerateCoordinatorProviderResponse: provider });
    await sendMessage("hello");

    const responseDetails = document.querySelector<HTMLDetailsElement>(
      ".interactive-agent-provider-meta",
    );

    expect(
      document.querySelector(".interactive-agent-provider-secondary"),
    ).toBeNull();
    expect(document.body.textContent).not.toContain("Agent details");
    expect(document.body.textContent).not.toContain("Chat response");
    expect(document.body.textContent).not.toContain("Runtime");
    expect(document.body.textContent).not.toContain("Backend");
    expect(document.body.textContent).not.toContain("Response setup");
    expect(document.body.textContent).not.toContain("Backend selected");
    expect(document.body.textContent).not.toContain("Mock/local fallback");
    expect(document.body.textContent).not.toContain("Supported review cards");
    expect(responseDetails).not.toBeNull();
    expect(responseDetails?.open).toBe(false);
    expect(responseDetails?.querySelector("summary")?.textContent).toBe(
      "Details",
    );
    expect(document.body.textContent).not.toContain("mock-local details");
  });

  it("clicking a planning suggestion inserts visible text only", async () => {
    const provider = vi.fn();
    const createQueueTask = vi.fn();
    renderWidget({
      onCreateAgentQueueTask: createQueueTask,
      onGenerateCoordinatorProviderResponse: provider,
    });

    await clickButton("Make a plan");

    expect(textareaValue()).toBe(
      "Make a plan from the visible chat only. Goal: ",
    );
    expect(provider).not.toHaveBeenCalled();
    expect(createQueueTask).not.toHaveBeenCalled();
  });

  it("clicking an outcome-review suggestion inserts visible text only", async () => {
    const provider = vi.fn();
    const createQueueTask = vi.fn();
    renderWidget({
      onCreateAgentQueueTask: createQueueTask,
      onGenerateCoordinatorProviderResponse: provider,
    });

    await clickButton("Explain this Executor failure");

    expect(textareaValue()).toBe(
      "Explain this Executor failure using visible chat text only. Paste failure here: ",
    );
    expect(provider).not.toHaveBeenCalled();
    expect(createQueueTask).not.toHaveBeenCalled();
  });

  it("renders attached Queue or Executor context visibly without sending", () => {
    const provider = vi.fn();

    renderWidget({
      coordinatorAttachedContextRequest: attachedContextRequest({
        contextText: [
          "Queue run metadata",
          "Queue task: Task (task_1)",
          "Run: run_safe_123456",
          "Status: completed",
        ].join("\n"),
        sourceLabel: "Queue latest run",
      }),
      onGenerateCoordinatorProviderResponse: provider,
    });

    expect(document.body.textContent).toContain("Visible attached context");
    expect(document.body.textContent).toContain("Queue latest run");
    expect(document.body.textContent).toContain("Queue run metadata");
    expect(document.body.textContent).toContain(
      "Included in the message below. Edit or remove it before Send.",
    );
    expect(textareaValue()).toContain(
      "Visible attached context (Queue latest run)",
    );
    expect(textareaValue()).toContain("Run: run_safe_123456");
    expect(provider).not.toHaveBeenCalled();
  });

  it("allows visible attached context to be removed before send", async () => {
    renderWidget({
      coordinatorAttachedContextRequest: attachedContextRequest({
        contextText: "Executor run metadata\nRun: run_safe_123456",
        sourceLabel: "Executor run detail",
      }),
    });

    await clickButton("Remove");

    expect(document.body.textContent).not.toContain("Executor run detail");
    expect(textareaValue()).not.toContain("run_safe_123456");
  });

  it("renders a local Plan card without implying execution", async () => {
    renderWidget();

    await sendMessage("Make a plan for stabilizing the visible frontend task");

    expect(document.body.textContent).toContain("Workspace Agent plan");
    expect(document.body.textContent).toContain("Plan draft");
    expect(document.body.textContent).toContain(
      "stabilizing the visible frontend task",
    );
    expect(document.body.textContent).toContain(
      "Separate quick operator decisions from larger async Queue work.",
    );
    expect(document.body.textContent).toContain("No execution");
    expect(document.body.textContent).toContain(
      "Plan only. Queue task drafts require approval plus Create Queue task.",
    );
    expect(document.body.textContent).toContain(
      "No Workspace, Queue, Executor, Notes, Git, JDBC, Terminal, logs, files, or artifacts were read.",
    );
  });

  it("renders a pasted Queue result Review card from visible text only", async () => {
    renderWidget();

    await sendMessage(
      [
        "Review pasted Queue result using visible chat text only.",
        "Queue task completed.",
        "npm test passed.",
        "cargo check completed successfully.",
      ].join("\n"),
    );

    expect(document.body.textContent).toContain("Outcome review");
    expect(document.body.textContent).toContain("Observed result summary");
    expect(document.body.textContent).toContain("Status interpretation");
    expect(document.body.textContent).toContain("success");
    expect(document.body.textContent).toContain("Likely outcome");
    expect(document.body.textContent).toContain(
      "Review uses visible chat text only; no hidden Queue or Executor logs were read.",
    );
    expect(document.body.textContent).toContain(
      "Review only. Workspace Agent does not read Queue history, Executor logs, or artifacts unless you paste or explicitly share them.",
    );
    expect(document.body.textContent).toContain("No execution");
    expect(buttonWithText("Approve")).toBeUndefined();
    expect(buttonWithText("Create Queue task")).toBeUndefined();
  });

  it("drafts follow-up Queue tasks for a visible Executor failure without creating or running them", async () => {
    const createQueueTask = vi.fn();
    renderWidget({ onCreateAgentQueueTask: createQueueTask });

    await sendMessage(
      [
        "Explain this Executor failure using visible chat text only.",
        "Executor run failed.",
        "npm test failed with exit code 1.",
      ].join("\n"),
    );

    expect(document.body.textContent).toContain("Outcome review");
    expect(document.body.textContent).toContain("failure");
    expect(document.body.textContent).toContain("Draft Queue task");
    expect(document.body.textContent).toContain(
      "Investigate pasted Executor failure",
    );
    expect(document.body.textContent).toContain(
      "Creates a draft task. Does not run it.",
    );
    expect(buttonWithText("Create Queue task")).toBeUndefined();
    expect(createQueueTask).not.toHaveBeenCalled();

    await clickButton("Approve");

    expect(document.body.textContent).toContain("Approved preview");
    expect(buttonWithText("Create Queue task")).toBeDefined();
    expect(createQueueTask).not.toHaveBeenCalled();
  });

  it("sends visible chat and proposal summaries through the provider path", async () => {
    const provider = vi.fn<
      (
        widgetInstanceId: string,
        request: Omit<
          GenerateCoordinatorProviderResponseRequest,
          "workspaceId" | "workbenchId" | "widgetInstanceId"
        >,
      ) => Promise<GenerateCoordinatorProviderResponse>
    >(async (_widgetInstanceId, request) =>
      providerResponse({
        assistantText:
          "Provider answer with code:\n```ts\nconst tools = [];\n```",
        visibleContextMessageCount: request.visibleConversation.length,
        visibleProposalDraftCount: request.visibleProposalDrafts.length,
      }),
    );

    renderWidget({ onGenerateCoordinatorProviderResponse: provider });
    await sendMessage(
      "create queue task title: Visible task prompt: Use only chat",
    );

    expect(provider).toHaveBeenCalledTimes(1);
    const [widgetInstanceId, request] = provider.mock.calls[0];
    expect(widgetInstanceId).toBe("coordinator_widget");
    expect(Object.keys(request).sort()).toEqual([
      "operatorMessage",
      "visibleConversation",
      "visibleProposalDrafts",
    ]);
    expect(request.visibleConversation).toEqual([
      {
        body: "create queue task title: Visible task prompt: Use only chat",
        id: "local-1",
        role: "operator",
      },
    ]);
    expect(request.visibleProposalDrafts).toHaveLength(1);
    expect(JSON.stringify(request)).not.toMatch(
      /terminal_output|agent_executor_logs|git_status|git_diff|jdbc_metadata|jdbc_results|notes_body|skill|knowledge|filesystem|environment_variables|provider_api_key/i,
    );
    expect(document.body.textContent).toContain("allowed_tools: []");
    expect(document.body.textContent).toContain("const tools = [];");
  });

  it("sends attached context only after the operator presses Send", async () => {
    const provider = vi.fn<
      (
        widgetInstanceId: string,
        request: Omit<
          GenerateCoordinatorProviderResponseRequest,
          "workspaceId" | "workbenchId" | "widgetInstanceId"
        >,
      ) => Promise<GenerateCoordinatorProviderResponse>
    >(async (_widgetInstanceId, request) =>
      providerResponse({
        visibleContextMessageCount: request.visibleConversation.length,
      }),
    );

    renderWidget({
      coordinatorAttachedContextRequest: attachedContextRequest({
        contextText: [
          "Executor run metadata",
          "Executor: Agent Executor visible (executor_visible)",
          "Run: run_safe_123456",
          "Status: completed",
        ].join("\n"),
        sourceLabel: "Executor run history row",
      }),
      onGenerateCoordinatorProviderResponse: provider,
    });

    expect(provider).not.toHaveBeenCalled();

    await setTextareaValue(
      `${textareaValue()}\nOperator note: review only the attached visible metadata.`,
    );
    await clickButton("Send");

    expect(provider).toHaveBeenCalledTimes(1);
    const request = provider.mock.calls[0][1];
    expect(request.operatorMessage).toContain(
      "Visible attached context (Executor run history row)",
    );
    expect(request.operatorMessage).toContain("Executor run metadata");
    expect(request.operatorMessage).toContain(
      "Operator note: review only the attached visible metadata.",
    );
    expect(request.visibleConversation).toEqual([
      {
        body: request.operatorMessage,
        id: "local-1",
        role: "operator",
      },
    ]);
    expect(JSON.stringify(request)).not.toMatch(
      /stdout|stderr|final response|diff|repoRoot|repo_root|payloadJson|secret/i,
    );
    expect(document.body.textContent).toContain("allowed_tools: []");
  });

  it("renders selected Executor excerpts as visible editable context before send", async () => {
    const provider = vi.fn<
      (
        widgetInstanceId: string,
        request: Omit<
          GenerateCoordinatorProviderResponseRequest,
          "workspaceId" | "workbenchId" | "widgetInstanceId"
        >,
      ) => Promise<GenerateCoordinatorProviderResponse>
    >(async (_widgetInstanceId, request) =>
      providerResponse({
        visibleContextMessageCount: request.visibleConversation.length,
      }),
    );

    renderWidget({
      coordinatorAttachedContextRequest: attachedContextRequest({
        contextText: [
          "Executor selected excerpt",
          "Executor: Agent Executor visible (executor_visible)",
          "Run: run_safe_123456",
          "Excerpt:",
          "Visible final response line selected by the operator.",
        ].join("\n"),
        sourceLabel: "Executor selected excerpt",
      }),
      onGenerateCoordinatorProviderResponse: provider,
    });

    expect(document.body.textContent).toContain("Visible attached context");
    expect(document.body.textContent).toContain("Executor selected excerpt");
    expect(textareaValue()).toContain(
      "Visible attached context (Executor selected excerpt)",
    );
    expect(textareaValue()).toContain(
      "Visible final response line selected by the operator.",
    );
    expect(provider).not.toHaveBeenCalled();

    await clickButton("Send");

    expect(provider).toHaveBeenCalledTimes(1);
    const request = provider.mock.calls[0][1];
    expect(request.operatorMessage).toContain(
      "Visible final response line selected by the operator.",
    );
    expect(JSON.stringify(request)).not.toMatch(
      /hidden raw detail|full executor logs|payloadJson|repo_root|secret/i,
    );
    expect(document.body.textContent).toContain("allowed_tools: []");
  });

  it("renders attached Skill context visibly and sends it only after Send", async () => {
    const provider = vi.fn<
      (
        widgetInstanceId: string,
        request: Omit<
          GenerateCoordinatorProviderResponseRequest,
          "workspaceId" | "workbenchId" | "widgetInstanceId"
        >,
      ) => Promise<GenerateCoordinatorProviderResponse>
    >(async (_widgetInstanceId, request) =>
      providerResponse({
        visibleContextMessageCount: request.visibleConversation.length,
      }),
    );

    renderWidget({
      coordinatorAttachedContextRequest: attachedContextRequest({
        contextText: [
          "Skill Library Skill",
          "Title: Frontend review",
          "When to use:",
          "Before merging frontend changes",
          "Prerequisites:",
          "Reviewed working tree",
          "Steps:",
          "Run typecheck",
          "Run focused tests",
          "Validation:",
          "npm test passes",
          "Risks:",
          "Validation may be slow",
          "Tags: frontend, review",
          "Review status: Reviewed",
        ].join("\n"),
        sourceLabel: "Skill Library / Skill",
      }),
      onGenerateCoordinatorProviderResponse: provider,
    });

    expect(document.body.textContent).toContain("Visible attached context");
    expect(document.body.textContent).toContain("Skill Library / Skill");
    expect(textareaValue()).toContain(
      "Visible attached context (Skill Library / Skill)",
    );
    expect(textareaValue()).toContain("Title: Frontend review");
    expect(textareaValue()).toContain("Steps:\nRun typecheck\nRun focused tests");
    expect(provider).not.toHaveBeenCalled();

    await clickButton("Send");

    expect(provider).toHaveBeenCalledTimes(1);
    const request = provider.mock.calls[0][1];
    expect(request.operatorMessage).toContain(
      "Visible attached context (Skill Library / Skill)",
    );
    expect(request.operatorMessage).toContain("Skill Library Skill");
    expect(request.operatorMessage).toContain("Review status: Reviewed");
    expect(request.visibleConversation).toEqual([
      {
        body: request.operatorMessage,
        id: "local-1",
        role: "operator",
      },
    ]);
    expect(JSON.stringify(request)).not.toMatch(
      /skillId|workspaceId|createdAt|updatedAt|hidden|context pack|evidence/i,
    );
    expect(document.body.textContent).toContain("allowed_tools: []");
  });

  it("renders Executor preview sections as visible editable context before send", async () => {
    const provider = vi.fn<
      (
        widgetInstanceId: string,
        request: Omit<
          GenerateCoordinatorProviderResponseRequest,
          "workspaceId" | "workbenchId" | "widgetInstanceId"
        >,
      ) => Promise<GenerateCoordinatorProviderResponse>
    >(async (_widgetInstanceId, request) =>
      providerResponse({
        visibleContextMessageCount: request.visibleConversation.length,
      }),
    );

    renderWidget({
      coordinatorAttachedContextRequest: attachedContextRequest({
        contextText: [
          "Executor visible preview",
          "Executor: Agent Executor visible",
          "Run: run_safe_123456",
          "Section: Final response preview",
          "Status: completed",
          "Preview:",
          "Visible final response preview selected by button.",
        ].join("\n"),
        sourceLabel: "Executor Final response preview",
      }),
      onGenerateCoordinatorProviderResponse: provider,
    });

    expect(document.body.textContent).toContain("Visible attached context");
    expect(document.body.textContent).toContain(
      "Executor Final response preview",
    );
    expect(textareaValue()).toContain(
      "Visible attached context (Executor Final response preview)",
    );
    expect(textareaValue()).toContain(
      "Visible final response preview selected by button.",
    );
    expect(provider).not.toHaveBeenCalled();

    await clickButton("Send");

    expect(provider).toHaveBeenCalledTimes(1);
    const request = provider.mock.calls[0][1];
    expect(request.operatorMessage).toContain(
      "Visible final response preview selected by button.",
    );
    expect(JSON.stringify(request)).not.toMatch(
      /hidden raw detail|full executor logs|stdout secret|stderr secret|payloadJson|repo_root|secret/i,
    );
    expect(document.body.textContent).toContain("allowed_tools: []");
  });

  it("renders provider proposal cards without creating Queue tasks before approval", async () => {
    const createQueueTask = vi.fn();
    const provider = vi.fn(async () =>
      providerResponse({
        proposalDrafts: [
          {
            expectedResult:
              "A draft Queue task can be created after explicit approval.",
            id: "provider-visible-task",
            intent: "Create a Queue task from visible chat.",
            riskNotes: ["No assignment, dispatch, or run."],
            targetCapability: "create Queue task",
            targetWidget: "Agent Queue",
            title: "Provider visible task",
            typeId: "create-agent-queue-task",
            visibleInputs: [
              { label: "Title", value: "Provider visible task" },
              { label: "Prompt", value: "Use only visible Workspace Agent chat." },
            ],
          },
        ],
        visibleContextMessageCount: 1,
        visibleProposalDraftCount: 0,
      }),
    );

    renderWidget({
      onCreateAgentQueueTask: createQueueTask,
      onGenerateCoordinatorProviderResponse: provider,
    });
    await sendMessage("plan work from visible chat");

    expect(document.body.textContent).toContain("Provider visible task");
    expect(document.body.textContent).toContain("Draft Queue task");
    expect(document.body.textContent).toContain("Priority");
    expect(document.body.textContent).toContain("0");
    expect(document.body.textContent).toContain("Policy");
    expect(document.body.textContent).toContain("manual");
    expect(document.body.textContent).toContain("Pending preview");
    expect(buttonWithText("Create Queue task")).toBeUndefined();
    expect(createQueueTask).not.toHaveBeenCalled();
  });

  it("degrades unsafe provider drafts to assistant text without proposal actions", async () => {
    const createQueueTask = vi.fn();
    const provider = vi.fn(async () =>
      providerResponse({
        assistantText:
          "I cannot run Terminal, Queue, Executor, Git, JDBC, or hidden tools from Coordinator.",
        proposalDrafts: [
          {
            expectedResult: "Run a shell command.",
            id: "unsafe-terminal-draft",
            intent: "Run a Terminal command from Coordinator.",
            riskNotes: ["Unsafe."],
            targetCapability: "run terminal command",
            targetWidget: "Terminal",
            title: "Run Terminal command",
            typeId: "create-agent-queue-task",
            visibleInputs: [
              { label: "Title", value: "Run Terminal command" },
              { label: "Prompt", value: "Run dir" },
            ],
          },
        ],
      }),
    );

    renderWidget({
      onCreateAgentQueueTask: createQueueTask,
      onGenerateCoordinatorProviderResponse: provider,
    });
    await sendMessage("provider should reject unsafe draft");

    expect(document.body.textContent).toContain(
      "I cannot run Terminal, Queue, Executor, Git, JDBC, or hidden tools from Coordinator.",
    );
    expect(document.body.textContent).not.toContain("Run Terminal command");
    expect(buttonWithText("Approve")).toBeUndefined();
    expect(createQueueTask).not.toHaveBeenCalled();
  });

  it("renders Queue task draft cards from visible planning text", async () => {
    renderWidget();

    await sendMessage(
      [
        "Break this into Queue tasks from visible text only.",
        "- Audit the Workspace Agent proposal flow",
        "- Add a compact planning card",
      ].join("\n"),
    );

    expect(document.body.textContent).toContain("Plan draft");
    expect(document.body.textContent).toContain("Draft Queue task");
    expect(document.body.textContent).toContain("Audit the Workspace Agent proposal flow");
    expect(document.body.textContent).toContain("Add a compact planning card");
    expect(document.body.textContent).toContain("Prompt preview");
    expect(document.body.textContent).toContain("Priority");
    expect(document.body.textContent).toContain("Policy");
    expect(document.body.textContent).toContain("manual");
    expect(document.body.textContent).toContain("draft/proposed");
    expect(document.body.textContent).toContain(
      "Creates a draft task. Does not run it.",
    );
    expect(buttonWithText("Create Queue task")).toBeUndefined();
  });

  it("reviews multiple Queue task drafts without creating or running them", async () => {
    const createQueueTask = vi.fn();
    renderWidget({ onCreateAgentQueueTask: createQueueTask });

    await sendMessage(
      [
        "Break this into Queue tasks from visible text only.",
        "- Audit the Workspace Agent proposal flow",
        "- Add a compact planning card",
      ].join("\n"),
    );

    expect(document.body.textContent).toContain(
      "2 drafted, 0 approved, 0 created.",
    );
    expect(document.body.textContent).toContain(
      "Approve all drafts is local review only.",
    );

    await clickButton("Approve all drafts");

    expect(document.body.textContent).toContain(
      "2 drafted, 2 approved, 0 created.",
    );
    expect(buttonsWithText("Create Queue task")).toHaveLength(2);
    expect(createQueueTask).not.toHaveBeenCalled();
  });

  it("approval does not create or run a Queue task", async () => {
    const createQueueTask = vi.fn();
    renderWidget({ onCreateAgentQueueTask: createQueueTask });

    await sendMessage(
      "create queue task title: Visible task prompt: Use only chat",
    );
    await clickButton("Approve");

    expect(document.body.textContent).toContain("Approved preview");
    expect(document.body.textContent).toContain(
      "Approval only accepts the draft. Use Create Queue task separately. Creates a draft task. Does not run it.",
    );
    expect(buttonWithText("Create Queue task")).toBeDefined();
    expect(createQueueTask).not.toHaveBeenCalled();
  });

  it("creates a Queue task only after the explicit Create Queue task action", async () => {
    const createQueueTask = vi.fn(async (request: CreateQueueTaskInput) => ({
      assignedExecutorWidgetId: null,
      createdAt: "2026-05-24T00:00:00Z",
      description: request.description,
      executionPolicy: request.executionPolicy,
      priority: request.priority,
      prompt: request.prompt,
      queueItemId: "queue_task_1",
      status: request.status,
      title: request.title,
      updatedAt: "2026-05-24T00:00:00Z",
      workspaceId: "workspace_1",
    }));
    renderWidget({ onCreateAgentQueueTask: createQueueTask });

    await sendMessage(
      "create queue task title: Visible task prompt: Use only chat priority: 2",
    );
    await clickButton("Approve");
    await clickButton("Create Queue task");

    expect(createQueueTask).toHaveBeenCalledTimes(1);
    expect(createQueueTask.mock.calls[0][0]).toMatchObject({
      description:
        "create queue task title: Visible task prompt: Use only chat priority: 2",
      executionPolicy: "manual",
      priority: 2,
      prompt: "Use only chat",
      status: "draft",
      title: "Visible task",
    });
    expect(document.body.textContent).toContain("Queue task created");
    expect(document.body.textContent).toContain(
      "It was not assigned, dispatched, run, or handed to Agent Executor.",
    );
  });

  it("keeps Note and JDBC proposal behavior review-only before explicit actions", async () => {
    const createNote = vi.fn();
    renderWidget({ onCreateWorkspaceNote: createNote });

    await sendMessage("create note title: Visible note body: Keep this visible");
    expect(document.body.textContent).toContain("Note proposal");
    expect(document.body.textContent).toContain(
      "No existing Notes content is read or summarized.",
    );
    expect(buttonWithText("Create Note")).toBeUndefined();
    expect(createNote).not.toHaveBeenCalled();

    await sendMessage("prepare sql query: select * from visible_table");
    expect(document.body.textContent).toContain("JDBC SQL suggestion");
    expect(document.body.textContent).toContain("SQL suggestion only");
    expect(document.body.textContent).toContain("Copy SQL");
    expect(document.body.textContent).toContain(
      "No JDBC connector metadata, schemas, database data, or results were read.",
    );
  });

  it("drafts and creates a Knowledge Document from visible conversation text only", async () => {
    const createKnowledgeDocument = vi.fn(
      async (request: CreateKnowledgeDocumentInput) =>
        knowledgeDocumentFixture({
          ...request,
          knowledgeDocumentId: "doc_visible",
        }),
    );

    renderWidget({ onCreateKnowledgeDocument: createKnowledgeDocument });

    await sendMessage(
      [
        "Here is documentation, add it to knowledge.",
        "Title: Falcon deployment notes",
        "Tags: falcon, deployment",
        "Content: Deploy Falcon from the release branch after validation.",
      ].join("\n"),
    );

    expect(document.body.textContent).toContain("Knowledge Document draft");
    expect(document.body.textContent).toContain("Falcon deployment notes");
    expect(document.body.textContent).toContain(
      "Deploy Falcon from the release branch after validation.",
    );
    expect(buttonWithText("Create Document")).toBeUndefined();
    expect(createKnowledgeDocument).not.toHaveBeenCalled();

    await clickButton("Approve");
    await clickButton("Create Document");

    expect(createKnowledgeDocument).toHaveBeenCalledTimes(1);
    expect(createKnowledgeDocument.mock.calls[0][0]).toMatchObject({
      content: "Deploy Falcon from the release branch after validation.",
      enabled: true,
      sourceLabel: "Workspace Agent conversation",
      tags: "falcon, deployment",
      title: "Falcon deployment notes",
    });
    expect(document.body.textContent).toContain("Knowledge Document created");
    expect(document.body.textContent).toContain("visible approved content only");
  });

  it("drafts and creates a Skill from visible conversation text only", async () => {
    const createSkill = vi.fn(async (request: CreateSkillInput) =>
      skillFixture({
        ...request,
        skillId: "skill_visible",
      }),
    );

    renderWidget({ onCreateSkill: createSkill });

    await sendMessage(
      [
        "Turn this into a skill.",
        "Title: Falcon deploy procedure",
        "When to use: Before Falcon production deployment",
        "Steps: Run validation, deploy release, verify health checks",
        "Validation: Health checks pass",
        "Risks: Rollback may be required",
        "Tags: falcon, deploy",
      ].join("\n"),
    );

    expect(document.body.textContent).toContain("Skill draft");
    expect(document.body.textContent).toContain("Falcon deploy procedure");
    expect(buttonWithText("Create Skill")).toBeUndefined();
    expect(createSkill).not.toHaveBeenCalled();

    await clickButton("Approve");
    await clickButton("Create Skill");

    expect(createSkill).toHaveBeenCalledTimes(1);
    expect(createSkill.mock.calls[0][0]).toMatchObject({
      prerequisites: "",
      reviewStatus: "draft",
      risks: "Rollback may be required",
      steps: "Run validation, deploy release, verify health checks",
      tags: "falcon, deploy",
      title: "Falcon deploy procedure",
      validation: "Health checks pass",
      whenToUse: "Before Falcon production deployment",
    });
    expect(document.body.textContent).toContain("Skill created");
    expect(document.body.textContent).toContain("visible approved content only");
  });

  it("renders provider fenced catalog action blocks as visible drafts before save", async () => {
    const createKnowledgeDocument = vi.fn(
      async (request: CreateKnowledgeDocumentInput) =>
        knowledgeDocumentFixture({
          ...request,
          knowledgeDocumentId: "doc_provider",
        }),
    );
    const provider = vi.fn(async () =>
      providerResponse({
        assistantText: [
          "I drafted a catalog action from visible text.",
          "```hobit-catalog-action",
          JSON.stringify({
            content: "Provider visible deployment content.",
            enabled: true,
            source_label: "Workspace Agent conversation",
            tags: ["provider", "deployment"],
            title: "Provider deployment notes",
            type: "create_knowledge_document",
          }),
          "```",
        ].join("\n"),
      }),
    );

    renderWidget({
      onCreateKnowledgeDocument: createKnowledgeDocument,
      onGenerateCoordinatorProviderResponse: provider,
    });

    await sendMessage("Remember this as workspace knowledge.");

    expect(document.body.textContent).toContain("Provider deployment notes");
    expect(document.body.textContent).toContain("Knowledge Document draft");
    expect(document.body.textContent).toContain("Provider visible deployment content.");
    expect(createKnowledgeDocument).not.toHaveBeenCalled();
  });

  it("renders Codex fenced catalog action blocks as visible drafts before save", async () => {
    const createSkill = vi.fn(async (request: CreateSkillInput) =>
      skillFixture({
        ...request,
        skillId: "skill_codex",
      }),
    );
    const startDirectWork = vi.fn(
      async (
        _widgetInstanceId: string,
        _request: unknown,
        onEvent: (event: DirectWorkStreamEvent) => void,
      ) => {
        onEvent(
          directWorkEvent({
            eventKind: "final_message",
            isFinal: false,
            text: [
              "Drafted from visible content.",
              "```hobit-catalog-action",
              JSON.stringify({
                prerequisites: "Release branch selected",
                review_status: "draft",
                risks: "Rollback may be needed",
                steps: "Run deploy\nCheck health",
                tags: ["codex", "deploy"],
                title: "Codex deploy skill",
                type: "create_skill",
                validation: "Health checks pass",
                when_to_use: "Before deployment",
              }),
              "```",
            ].join("\n"),
          }),
        );
        onEvent(
          directWorkEvent({
            eventKind: "completed",
            finalStatus: "completed",
            isFinal: true,
          }),
        );
        return {
          runId: "run_catalog",
          status: "started",
          stopListening: vi.fn(),
        };
      },
    );

    renderWidget({
      onCreateSkill: createSkill,
      onStartCodexDirectWorkStream: startDirectWork,
    });

    await setTextareaValue("Turn this into a skill with Codex.");
    await clickButton("Run with Codex");

    expect(document.body.textContent).toContain("Codex deploy skill");
    expect(document.body.textContent).toContain("Skill draft");
    expect(buttonWithText("Create Skill")).toBeUndefined();

    await clickButton("Approve");
    await clickButton("Create Skill");

    expect(createSkill).toHaveBeenCalledTimes(1);
    expect(createSkill.mock.calls[0][0]).toMatchObject({
      prerequisites: "Release branch selected",
      reviewStatus: "draft",
      risks: "Rollback may be needed",
      steps: "Run deploy\nCheck health",
      tags: "codex, deploy",
      title: "Codex deploy skill",
      validation: "Health checks pass",
      whenToUse: "Before deployment",
    });
  });
});

function renderWidget(
  overrides: Partial<
    Parameters<typeof InteractiveAgentPlaceholderWidget>[0]
  > = {},
) {
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);

  renderWidgetIntoRoot(overrides);
}

async function rerenderWidget(
  overrides: Partial<
    Parameters<typeof InteractiveAgentPlaceholderWidget>[0]
  > = {},
) {
  await act(async () => {
    root?.render(widgetElement(overrides));
    await Promise.resolve();
    await Promise.resolve();
  });
}

function renderWidgetIntoRoot(
  overrides: Partial<
    Parameters<typeof InteractiveAgentPlaceholderWidget>[0]
  > = {},
) {
  act(() => {
    root?.render(widgetElement(overrides));
  });
}

function renderWidgetTree(element: ReactNode) {
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);

  act(() => {
    root?.render(element);
  });
}

function widgetElement(
  overrides: Partial<
    Parameters<typeof InteractiveAgentPlaceholderWidget>[0]
  > = {},
) {
  return (
    <InteractiveAgentPlaceholderWidget
      config={{}}
      definition={definition()}
      instance={instance()}
      title="Workspace Agent"
      {...overrides}
    />
  );
}

async function sendMessage(message: string) {
  await setTextareaValue(message);

  await act(async () => {
    const sendButton = buttonWithText("Send");
    if (!sendButton) {
      throw new Error("Send button not found.");
    }
    sendButton.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    await Promise.resolve();
    await Promise.resolve();
  });
}

async function setTextareaValue(message: string) {
  const textarea = document.querySelector("textarea");
  if (!textarea) {
    throw new Error("Message textarea not found.");
  }

  await act(async () => {
    setNativeValue(textarea, message);
    textarea.dispatchEvent(new Event("input", { bubbles: true }));
    textarea.dispatchEvent(new Event("change", { bubbles: true }));
  });
}

function setNativeValue(field: HTMLTextAreaElement, value: string) {
  const descriptor = Object.getOwnPropertyDescriptor(
    HTMLTextAreaElement.prototype,
    "value",
  );
  descriptor?.set?.call(field, value);
}

function setNativeInputValue(field: HTMLInputElement, value: string) {
  const descriptor = Object.getOwnPropertyDescriptor(
    HTMLInputElement.prototype,
    "value",
  );
  descriptor?.set?.call(field, value);
}

function buttonWithText(text: string) {
  return Array.from(document.querySelectorAll("button")).find(
    (button) => button.textContent === text,
  );
}

function buttonsWithText(text: string) {
  return Array.from(document.querySelectorAll("button")).filter(
    (button) => button.textContent === text,
  );
}

function checkboxWithLabel(text: string) {
  return Array.from(document.querySelectorAll("label")).find((label) =>
    label.textContent?.includes(text),
  )?.querySelector<HTMLInputElement>('input[type="checkbox"]');
}

async function toggleDirectMode() {
  await act(async () => {
    await Promise.resolve();
  });
}

function agentPicker() {
  return document.querySelector<HTMLSelectElement>(
    'select[aria-label="Workspace Agent picker"]',
  );
}

function textInput() {
  const input = document.querySelector<HTMLInputElement>(
    'input[aria-label="Working directory"]',
  );
  if (!input) {
    throw new Error("Working directory input not found.");
  }
  return input;
}

async function setTextareaValueIn(selector: string, message: string) {
  const rootElement = document.querySelector(selector);
  const textarea = rootElement?.querySelector("textarea");
  if (!textarea) {
    throw new Error(`Message textarea not found in ${selector}.`);
  }

  await act(async () => {
    setNativeValue(textarea, message);
    textarea.dispatchEvent(new Event("input", { bubbles: true }));
    textarea.dispatchEvent(new Event("change", { bubbles: true }));
  });
}

async function clickButtonIn(selector: string, text: string) {
  const rootElement = document.querySelector(selector);
  const button = Array.from(rootElement?.querySelectorAll("button") ?? []).find(
    (button) => button.textContent === text,
  );
  if (!button) {
    throw new Error(`Button not found in ${selector}: ${text}`);
  }

  await act(async () => {
    button.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    await Promise.resolve();
    await Promise.resolve();
  });
}

function textInputValue() {
  return textInput().value;
}

async function setTextInputValue(value: string) {
  const input = textInput();

  await act(async () => {
    setNativeInputValue(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
  });
}

async function clickButton(text: string) {
  await act(async () => {
    const button = buttonWithText(text);
    if (!button) {
      throw new Error(`Button not found: ${text}`);
    }
    button.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    await Promise.resolve();
    await Promise.resolve();
  });
}

function textareaValue() {
  const textarea = document.querySelector("textarea");
  if (!textarea) {
    throw new Error("Message textarea not found.");
  }
  return textarea.value;
}

function lastAssistantMessageText() {
  const assistantMessages = document.querySelectorAll(
    '[data-testid="interactive-agent-message-assistant"]',
  );
  const lastMessage = assistantMessages[assistantMessages.length - 1];
  return lastMessage?.textContent ?? "";
}

function lastOperatorMessageText() {
  const operatorMessages = document.querySelectorAll(
    '[data-testid="interactive-agent-message-operator"]',
  );
  const lastMessage = operatorMessages[operatorMessages.length - 1];
  return lastMessage?.textContent ?? "";
}

function providerResponse(
  overrides: Partial<GenerateCoordinatorProviderResponse> = {},
): GenerateCoordinatorProviderResponse {
  return {
    allowedTools: [],
    assistantText: "Provider answer.",
    noHiddenContextUsed: true,
    noMutationsPerformed: true,
    noToolsExecuted: true,
    proposalDrafts: [],
    providerError: null,
    providerKind: "mock-local",
    providerStatus: "completed",
    requestId: "provider-test-request",
    visibleContextMessageCount: 1,
    visibleProposalDraftCount: 0,
    ...overrides,
  };
}

function definition(): WidgetDefinition {
  return {
    category: "core",
    componentKey: "interactive-agent",
    defaultConfig: {},
    defaultTitle: "Workspace Agent",
    description: "Workspace Agent",
    id: "interactive-agent",
    title: "Workspace Agent",
  };
}

function instance(overrides: Partial<WidgetInstance> = {}): WidgetInstance {
  return {
    config: {},
    definitionId: "interactive-agent",
    id: "coordinator_widget",
    layout: {
      area: "main",
      height: 720,
      mode: "docked",
      order: 0,
      width: 760,
      x: 0,
      y: 0,
    },
    state: {},
    title: "Workspace Agent",
    visible: true,
    ...overrides,
  };
}

function attachedContextRequest(overrides: {
  contextText: string;
  sourceLabel: string;
}) {
  return {
    contextText: overrides.contextText,
    id: 1,
    sourceLabel: overrides.sourceLabel,
    targetCoordinatorWidgetInstanceId: "coordinator_widget",
  };
}

function directWorkEvent(
  overrides: Partial<DirectWorkStreamEvent>,
): DirectWorkStreamEvent {
  return {
    elapsedMs: 0,
    errorMessage: null,
    eventKind: "started",
    exitCode: null,
    failedStage: null,
    finalStatus: null,
    isFinal: false,
    line: null,
    parsedCodexEventType: null,
    codexThreadId: null,
    runId: "run_1",
    status: null,
    stderrPreview: null,
    text: null,
    widgetInstanceId: "coordinator_widget",
    workbenchId: "workbench_1",
    workspaceId: "workspace_1",
    ...overrides,
  };
}

function knowledgeResult(
  overrides: Partial<KnowledgeDocumentSearchResult>,
): KnowledgeDocumentSearchResult {
  return {
    chunkId: "chunk_1",
    chunkIndex: 0,
    documentTitle: "Knowledge doc",
    knowledgeDocumentId: "doc_1",
    score: 10,
    snippet: "Knowledge snippet.",
    sourceLabel: "Workspace document",
    scope: "workspace",
    tags: "docs",
    ...overrides,
  };
}

function skillFixture(
  overrides: Partial<Skill> & {
    reviewStatus?: Skill["reviewStatus"];
    title?: string;
  } = {},
): Skill {
  return {
    createdAt: "2026-05-24T00:00:00Z",
    prerequisites: "",
    reviewStatus: "draft",
    risks: "",
    skillId: "skill_1",
    steps: "",
    tags: "",
    title: "Skill",
    updatedAt: "2026-05-24T00:00:00Z",
    validation: "",
    whenToUse: "",
    workspaceId: "workspace_1",
    ...overrides,
  };
}

function knowledgeDocumentFixture(
  overrides: Partial<KnowledgeDocument> & {
    title?: string;
  } = {},
): KnowledgeDocument {
  return {
    content: "",
    createdAt: "2026-05-24T00:00:00Z",
    enabled: true,
    knowledgeDocumentId: "doc_1",
    scope: "workspace",
    sourceLabel: "Workspace Agent conversation",
    tags: "",
    title: "Document",
    updatedAt: "2026-05-24T00:00:00Z",
    workspaceId: "workspace_1",
    ...overrides,
  };
}

function expectedCoordinatorCodexExecutable() {
  const platformText = `${navigator.userAgent} ${navigator.platform}`;
  return /(Windows|Win32|Win64|WOW64)/i.test(platformText)
    ? "codex.cmd"
    : "codex";
}
