import { describe, expect, it, vi } from "vitest";
import {
  attachedContextRequest,
  buttonWithText,
  checkboxWithLabel,
  clickButton,
  clickButtonIn,
  directWorkEvent,
  expectedCoordinatorCodexExecutable,
  agentPicker,
  InteractiveAgentPlaceholderWidget,
  knowledgeDocumentFixture,
  knowledgeResult,
  lastAssistantMessageText,
  lastOperatorMessageText,
  providerResponse,
  queueReportCard,
  queueReportCardRequest,
  renderWidget,
  renderWidgetTree,
  rerenderWidget,
  setSandboxValue,
  setCheckboxChecked,
  setTextareaValue,
  setTextareaValueIn,
  setTextInputValue,
  skillFixture,
  textInputValue,
  textareaValue,
  toggleDirectMode,
  definition,
  instance,
  sendMessage,
  type CreateKnowledgeDocumentInput,
  type CreateQueueTaskInput,
  type CreateSkillInput,
  type DirectWorkStreamEvent,
  type GenerateCoordinatorProviderResponse,
  type GenerateCoordinatorProviderResponseRequest,
  type UpdateQueueTaskInput,
} from "./InteractiveAgentPlaceholderWidget.test-utils";
describe("InteractiveAgentPlaceholderWidget Workspace Agent UI", () => {
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
            eventKind: "codex_json_event",
            line: JSON.stringify({
              type: "turn.completed",
              usage: {
                input_tokens: 10,
                output_tokens: 20,
                total_tokens: 30,
              },
            }),
            parsedCodexEventType: "turn.completed",
            runId: "run_brain",
          }),
        );
        onEvent(
          directWorkEvent({
            elapsedMs: 1234,
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
    expect(document.body.textContent).toContain("Thread active: thread_b...");
    expect(document.body.textContent).toContain("Codex handled the task.");
    expect(document.body.textContent).toContain("Thread: thread_b...");
    expect(document.body.textContent).toContain("StatusCompleted");
    expect(document.body.textContent).toContain("Steps3");
    expect(document.body.textContent).toContain("Time1.2s");
    expect(document.body.textContent).toContain("Threadthread_b...");
    expect(document.body.textContent).toContain("Tokens10 in, 20 out, 30 total");
    expect(lastAssistantMessageText()).toBe("Codex handled the task.");
    expect(lastAssistantMessageText()).not.toContain("Sent to Codex Direct Mode");
    expect(lastAssistantMessageText()).not.toContain("Starting foreground Codex Direct Work");
    expect(lastAssistantMessageText()).not.toContain("Starting Codex Direct Work");
    expect(lastAssistantMessageText()).not.toContain("Codex Direct Mode completed");
    expect(document.body.textContent).not.toContain("Drafting from the visible chat.");
    expect(document.body.textContent).not.toContain("Workspace Agent plan");
  });


  it("lets Workspace Agent runs use explicit danger_full_access sandbox", async () => {
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
            text: "Unsafe sandbox smoke complete.",
          }),
        );
        return {
          runId: "run_unsafe",
          status: "started",
          stopListening: vi.fn(),
        };
      },
    );
    renderWidget({ onStartCodexDirectWorkStream: startDirectWork });

    await setSandboxValue("danger_full_access");
    await setTextareaValue("Read AGENTS.md first line and git status only.");
    await clickButton("Run with Codex");

    expect(startDirectWork).toHaveBeenCalledTimes(1);
    expect(startDirectWork.mock.calls[0][1]).toMatchObject({
      approvalPolicy: "never",
      sandbox: "danger_full_access",
      skipGitRepoCheck: true,
    });
    expect(document.body.textContent).toContain(
      "danger_full_access is unsafe",
    );
    expect(document.body.textContent).toContain(
      "disables Codex sandbox restrictions",
    );
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
      "Codex is running: Running command: git status",
    );
    const assistantMessages = document.querySelectorAll(
      '[data-testid="interactive-agent-message-assistant"]',
    );
    expect(assistantMessages).toHaveLength(0);
    expect(lastOperatorMessageText()).toBe("Check repo status.");
    const details = document.querySelector<HTMLDetailsElement>(
      ".interactive-agent-direct-mode-details",
    );
    expect(details).toBeNull();
    expect(document.body.textContent).not.toContain("item.started");
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
    expect(document.body.textContent).toContain("Thread active: thread_s...");
    expect(document.body.textContent).toContain("Thread: thread_s...");
  });

  it("New Thread checkbox starts only the next Codex run without the active thread", async () => {
    const startDirectWork = vi.fn(
      async (
        _widgetInstanceId: string,
        request: unknown,
        onEvent: (event: DirectWorkStreamEvent) => void,
      ) => {
        const requestedThreadId = (request as { codexThreadId?: string | null })
          .codexThreadId;
        const runIndex = startDirectWork.mock.calls.length;
        const runId = `run_checkbox_${runIndex}`;
        const threadId =
          runIndex === 1
            ? "thread_checkbox_first_123456"
            : requestedThreadId ?? "thread_checkbox_forced_new_123456";
        onEvent(directWorkEvent({ eventKind: "started", runId }));
        onEvent(
          directWorkEvent({
            codexThreadId: threadId,
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
            text: "Done.",
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

    await setTextareaValue("First run.");
    await clickButton("Run with Codex");
    expect(document.body.textContent).toContain("Thread: thread_c...");

    await setTextareaValue("Fresh run.");
    await setCheckboxChecked("New Thread", true);
    await clickButton("Run with Codex");

    await setTextareaValue("Follow up after fresh run.");
    await clickButton("Run with Codex");

    expect(startDirectWork).toHaveBeenCalledTimes(3);
    expect(startDirectWork.mock.calls[0][1]).toMatchObject({
      codexThreadId: null,
      operatorPrompt: "First run.",
    });
    expect(startDirectWork.mock.calls[1][1]).toMatchObject({
      codexThreadId: null,
      operatorPrompt: "Fresh run.",
    });
    expect(startDirectWork.mock.calls[2][1]).toMatchObject({
      codexThreadId: "thread_checkbox_forced_new_123456",
      operatorPrompt: "Follow up after fresh run.",
    });
    expect(checkboxWithLabel("New Thread")?.checked).toBe(false);
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
    expect(document.body.textContent).toContain("Thread: thread_w...");

    await rerenderWidget({
      onStartCodexDirectWorkStream: startDirectWork,
      workspaceId: "workspace_b",
    });

    expect(document.body.textContent).toContain("Thread: none");
    expect(document.body.textContent).not.toContain("Thread: thread_w...");

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

    expect(document.body.textContent).toContain("Thread: none");

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
    await setCheckboxChecked("New Thread", true);

    await setTextareaValue("Start over.");
    await clickButton("Run with Codex");

    expect(startDirectWork).toHaveBeenCalledTimes(2);
    expect(startDirectWork.mock.calls[1][1]).toMatchObject({
      codexThreadId: null,
      operatorPrompt: "Start over.",
    });
    expect(document.body.textContent).toContain("Remember this.");
    expect(checkboxWithLabel("New Thread")).toBeDefined();
    expect(document.body.textContent).not.toContain("New Codex thread");
  });


  it("New thread clears visible carried context before the next run", async () => {
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
      onStartCodexDirectWorkStream: startDirectWork,
      workspaceId: "workspace_1",
    });

    await setTextareaValue("What is the Falcon smoke code?");
    await clickButton("Run with Codex");
    expect(
      (startDirectWork.mock.calls[0][1] as { operatorPrompt: string })
        .operatorPrompt,
    ).toBe("What is the Falcon smoke code?");

    await rerenderWidget({
      coordinatorAttachedContextRequest: attachedContextRequest({
        contextText: "Carryover should be removable: BLUE-RAVEN-42",
        sourceLabel: "Manual context",
      }),
      onStartCodexDirectWorkStream: startDirectWork,
      workspaceId: "workspace_1",
    });
    expect(textareaValue()).toContain("BLUE-RAVEN-42");

    await setCheckboxChecked("New Thread", true);

    await setTextareaValue("Ask again without workspace knowledge.");
    await clickButton("Run with Codex");

    expect(textareaValue()).not.toContain("BLUE-RAVEN-42");
    expect(document.body.textContent).not.toContain("Falcon code, chunk 1");

    const nextRequest = startDirectWork.mock.calls[1][1] as {
      codexThreadId: string | null;
      operatorPrompt: string;
    };
    expect(nextRequest.codexThreadId).toBeNull();
    expect(nextRequest.operatorPrompt).toBe(
      "Ask again without workspace knowledge.",
    );
    expect(nextRequest.operatorPrompt).not.toContain("BLUE-RAVEN-42");
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
    await clickButton("⚙");
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
    await clickButton("⚙");
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


  it("selecting a Linux working directory with Browse does not start Codex automatically", async () => {
    const startDirectWork = vi.fn();
    const selectWorkspaceDirectory = vi.fn(
      async () => "/home/dmitry/work/browsed",
    );
    renderWidget({
      onSelectWorkspaceDirectory: selectWorkspaceDirectory,
      onStartCodexDirectWorkStream: startDirectWork,
    });

    await clickButton("⚙");
    await clickButton("Browse");

    expect(selectWorkspaceDirectory).toHaveBeenCalledTimes(1);
    expect(textInputValue()).toBe("/home/dmitry/work/browsed");
    expect(startDirectWork).not.toHaveBeenCalled();
    expect(document.body.textContent).not.toContain(
      "Starting new Codex thread",
    );
  });

  it("requires a working directory before starting Codex", async () => {
    const startDirectWork = vi.fn();
    renderWidget({ onStartCodexDirectWorkStream: startDirectWork });

    await toggleDirectMode();
    await clickButton("⚙");
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


  it("searches Knowledge only through an explicit Workspace Agent command", async () => {
    const provider = vi.fn();
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
    const startDirectWork = vi.fn();
    renderWidget({
      onGenerateCoordinatorProviderResponse: provider,
      onSearchKnowledgeDocuments: searchKnowledge,
      onStartCodexDirectWorkStream: startDirectWork,
    });

    await setTextareaValue("knowledge search: API docs");
    await clickButton("Run with Codex");

    expect(searchKnowledge).toHaveBeenCalledWith({
      limit: 3,
      query: "API docs",
    });
    expect(document.body.textContent).toContain("Knowledge search results");
    expect(document.body.textContent).toContain("API guide");
    expect(document.body.textContent).toContain("Scope: Workspace");
    expect(document.body.textContent).toContain(
      "Use the workspace-local API reference.",
    );
    expect(document.body.textContent).toContain("No context was attached");
    expect(document.body.textContent).not.toMatch(/Terminal command|JDBC query/i);
    expect(provider).not.toHaveBeenCalled();
    expect(startDirectWork).not.toHaveBeenCalled();
  });


  it("attaches one active Knowledge result as visible bounded context before Codex", async () => {
    const searchKnowledge = vi.fn(async () => [
      knowledgeResult({
        chunkId: "chunk_api_1",
        documentTitle: "API guide",
        scope: "workspace",
        snippet: "Use the workspace-local API reference.",
      }),
    ]);
    const getKnowledgeDocument = vi.fn(async () =>
      knowledgeDocumentFixture({
        knowledgeDocumentId: "doc_1",
        quickSummary: "Use the API reference.",
        sourceLabel: "Workspace API guide",
        sourceRef: "docs/api.md",
        title: "API guide",
        updatedAt: "2026-06-01T10:00:00.000Z",
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
            eventKind: "completed",
            finalStatus: "completed",
            isFinal: true,
            text: "Codex used visible context if relevant.",
          }),
        );
        return {
          runId: "run_visible_knowledge",
          status: "started",
          stopListening: vi.fn(),
        };
      },
    );
    renderWidget({
      onGetKnowledgeDocument: getKnowledgeDocument,
      onSearchKnowledgeDocuments: searchKnowledge,
      onStartCodexDirectWorkStream: startDirectWork,
    });

    await setTextareaValue("knowledge attach: API docs");
    await clickButton("Run with Codex");
    expect(startDirectWork).not.toHaveBeenCalled();
    expect(searchKnowledge).toHaveBeenCalledWith({
      limit: 3,
      query: "API docs",
    });
    expect(getKnowledgeDocument).toHaveBeenCalledWith("doc_1");
    expect(document.body.textContent).toContain("Knowledge context attached visibly");
    expect(textareaValue()).toContain("Visible attached context");
    expect(textareaValue()).toContain("Scope: Workspace");
    expect(textareaValue()).toContain("Version: 2026-06-01T10:00:00.000Z");

    await setTextareaValue(textareaValue() + "\n\nUse this context for the task.");
    await clickButton("Run with Codex");
    const request = startDirectWork.mock.calls[0][1] as {
      operatorPrompt: string;
    };
    expect(request.operatorPrompt).toContain("Visible attached context");
    expect(request.operatorPrompt).toContain("Knowledge: API guide");
    expect(request.operatorPrompt).toContain("Scope: Workspace");
    expect(request.operatorPrompt).toContain("Source ref: docs/api.md");
    expect(request.operatorPrompt).not.toMatch(/RAW_FULL_DOCUMENT_BODY|allowed_tools/i);
  });


  it("does not search Knowledge automatically before Codex runs", async () => {
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

    expect(searchKnowledge).not.toHaveBeenCalled();
    expect(startDirectWork.mock.calls[0][1]).toMatchObject({
      operatorPrompt: "No document should match.",
    });
    await clickButton("Run details");
    expect(document.body.textContent).toContain(
      "Knowledge is not searched automatically",
    );
  });


  it("does not leak Falcon knowledge through a resumed thread in a new workspace", async () => {
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
      onStartCodexDirectWorkStream: startDirectWork,
      workspaceId: "workspace_a",
    });

    await setTextareaValue("What is the Falcon smoke code?");
    await clickButton("Run with Codex");
    expect(document.body.textContent).toContain("Thread: thread_f...");

    await rerenderWidget({
      onStartCodexDirectWorkStream: startDirectWork,
      workspaceId: "workspace_b",
    });

    expect(document.body.textContent).toContain("Thread: none");
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
  });

});

async function toggleDetails(summaryText: string) {
  const summary = Array.from(document.querySelectorAll("summary")).find(
    (candidate) => candidate.textContent === summaryText,
  );
  const details = summary?.closest("details") as HTMLDetailsElement | null;

  if (!details) {
    throw new Error(`Details summary not found: ${summaryText}`);
  }

  details.open = true;
  details.dispatchEvent(new Event("toggle", { bubbles: true }));
  await Promise.resolve();
  await Promise.resolve();
}
