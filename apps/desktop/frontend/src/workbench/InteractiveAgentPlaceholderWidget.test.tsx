import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

import { InteractiveAgentPlaceholderWidget } from "./InteractiveAgentPlaceholderWidget";
import type { WidgetDefinition, WidgetInstance } from "./types";
import type {
  DirectWorkStreamEvent,
  GenerateCoordinatorProviderResponse,
  GenerateCoordinatorProviderResponseRequest,
} from "../workspace/types";

type CreateQueueTaskInput = Parameters<
  NonNullable<
    Parameters<typeof InteractiveAgentPlaceholderWidget>[0]["onCreateAgentQueueTask"]
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

describe("InteractiveAgentPlaceholderWidget Coordinator Chat UI", () => {
  it("renders suggested prompts and compact safety badges in the empty state", () => {
    renderWidget();

    expect(document.body.textContent).toContain("Direct Mode");
    expect(document.body.textContent).toContain("idle");
    expect(document.body.textContent).not.toContain("Working directory");
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
    expect(document.body.textContent).toContain("Visible context only");
    expect(document.body.textContent).toContain("Tools disabled");
    expect(document.body.textContent).toContain("No hidden context");
    expect(
      document.querySelector(".widget-title")?.textContent,
    ).toBe("Coordinator Chat");
    expect(
      document.querySelector(".widget-content")?.textContent,
    ).not.toContain("Coordinator Chat");
    expect(document.body.textContent).toContain(
      "Plan work, draft tasks, review results",
    );
    expect(document.body.textContent).toContain(
      "Drafts stay inert until you approve them and use the separate create or copy action.",
    );
    expect(
      document.querySelector('[aria-label="Coordinator suggested prompts"]'),
    ).not.toBeNull();
    expect(
      document.querySelector(".interactive-agent-empty")?.textContent,
    ).not.toContain("Workspace");
  });

  it("shows Direct Mode off by default with home as the default working directory when enabled", async () => {
    renderWidget();

    expect(checkboxWithLabel("Direct Mode")?.checked).toBe(false);
    expect(buttonWithText("Start Direct Work")).toBeUndefined();
    expect(buttonWithText("Run with Codex")).toBeUndefined();

    await toggleDirectMode();

    expect(document.querySelector(".interactive-agent-direct-mode-bar")).not.toBeNull();
    expect(document.body.textContent).toContain("Working dir");
    expect(textInputValue()).toBe("~");
    expect(document.body.textContent).toContain(
      "Runs from ~ by default. Non-git directories use Codex skip git repo check.",
    );
    expect(buttonWithText("Run with Codex")).toBeDefined();
  });

  it("message send still behaves like chat when Direct Mode is off", async () => {
    const startDirectWork = vi.fn();
    const provider = vi.fn(async () => providerResponse());
    renderWidget({
      onGenerateCoordinatorProviderResponse: provider,
      onStartCodexDirectWorkStream: startDirectWork,
    });

    await sendMessage("Make a plan for visible work");

    expect(startDirectWork).not.toHaveBeenCalled();
    expect(provider).toHaveBeenCalledTimes(1);
    expect(document.body.textContent).toContain("Coordinator plan");
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
      "Coordinator message",
    );
    expect(operatorBubble?.textContent).toContain("Operator visible request.");
    expect(assistantBubble?.textContent).toContain("Assistant visible answer.");
    expect(operatorBubble?.textContent).not.toContain("You");
    expect(assistantBubble?.textContent).not.toContain("Coordinator Chat");
  });

  it("Direct Mode makes the primary composer action run Codex without calling the chat provider", async () => {
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
    await setTextareaValue("Make a plan while Direct Mode is enabled");
    await clickButton("Run with Codex");

    expect(startDirectWork).toHaveBeenCalledTimes(1);
    expect(startDirectWork.mock.calls[0][1]).toMatchObject({
      operatorPrompt: "Make a plan while Direct Mode is enabled",
      skipGitRepoCheck: true,
    });
    expect(provider).not.toHaveBeenCalled();
    expect(document.body.textContent).toContain(
      "Primary action sends this message to Codex Direct Mode.",
    );
    expect(document.body.textContent).toContain(
      "Sent to Codex Direct Mode. Starting foreground Codex Direct Work from ~.",
    );
    expect(document.body.textContent).toContain("Codex handled the task.");
    expect(document.body.textContent).not.toContain("Drafting from the visible chat.");
    expect(document.body.textContent).not.toContain("Coordinator plan");
  });

  it("requires a working directory before starting Direct Mode", async () => {
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

  it("Direct Mode enabled with an empty composer does not start Codex", async () => {
    const startDirectWork = vi.fn();
    renderWidget({ onStartCodexDirectWorkStream: startDirectWork });

    await toggleDirectMode();

    const runButton = buttonWithText("Run with Codex");
    expect(runButton).toBeDefined();
    expect(runButton?.hasAttribute("disabled")).toBe(true);
    expect(startDirectWork).not.toHaveBeenCalled();
  });

  it("starts Coordinator Direct Mode from the composer without creating Queue work or Autorun", async () => {
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
            text: "Final Coordinator result.",
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
      "Sent to Codex Direct Mode. Starting foreground Codex Direct Work from ~.",
    );
    expect(document.body.textContent).toContain("Codex Direct Mode completed.");
    expect(document.body.textContent).toContain("Final Coordinator result.");

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
    ).toContain("Final Coordinator result.");
    expect(operatorMessages[operatorMessages.length - 1]?.textContent).not.toContain(
      "You",
    );
    expect(
      assistantMessages[assistantMessages.length - 1]?.textContent,
    ).not.toContain("Coordinator Chat");
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
      "Codex Direct Work failed: codex executable not found",
    );
  });

  it("shows trusted-directory Codex failures as actionable Coordinator Direct Mode copy", async () => {
    const trustedDirectoryMessage =
      "codex exec --json exited with code 1: stderr: Codex refused this directory. Coordinator Direct Mode should run with skip git repo check or choose a trusted Git project. stderr: Not inside a trusted directory and --skip-git-repo-check was not specified; could not read final message file `last.txt`: file missing";
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
      "Codex refused this directory. Coordinator Direct Mode should run with skip git repo check or choose a trusted Git project.",
    );
    expect(document.body.textContent).toContain(
      "Not inside a trusted directory and --skip-git-repo-check was not specified",
    );
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
          'Mock Coordinator provider response. I received your explicit message: "hello". Tools are disabled with allowed_tools: [], and no hidden Workspace context was used.',
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
      "Mock Coordinator provider response",
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

  it("keeps provider and response details collapsed in secondary UI", async () => {
    const provider = vi.fn(async () =>
      providerResponse({
        visibleContextMessageCount: 1,
      }),
    );

    renderWidget({ onGenerateCoordinatorProviderResponse: provider });
    await sendMessage("hello");

    const providerDetails = document.querySelector<HTMLDetailsElement>(
      ".interactive-agent-provider-secondary",
    );
    const responseDetails = document.querySelector<HTMLDetailsElement>(
      ".interactive-agent-provider-meta",
    );

    expect(providerDetails).not.toBeNull();
    expect(providerDetails?.open).toBe(false);
    expect(providerDetails?.querySelector("summary")?.textContent).toBe(
      "Response setup",
    );
    expect(
      providerDetails?.querySelector(".interactive-agent-provider-row"),
    ).not.toBeNull();
    expect(providerDetails?.textContent).toContain("Response");
    expect(providerDetails?.textContent).toContain("Setup");
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

    expect(document.body.textContent).toContain("Coordinator plan");
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
      "Review only. Coordinator does not read Queue history, Executor logs, or artifacts unless you paste or explicitly share them.",
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
              { label: "Prompt", value: "Use only visible Coordinator chat." },
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
        "- Audit the Coordinator proposal flow",
        "- Add a compact planning card",
      ].join("\n"),
    );

    expect(document.body.textContent).toContain("Plan draft");
    expect(document.body.textContent).toContain("Draft Queue task");
    expect(document.body.textContent).toContain("Audit the Coordinator proposal flow");
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
        "- Audit the Coordinator proposal flow",
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
});

function renderWidget(
  overrides: Partial<
    Parameters<typeof InteractiveAgentPlaceholderWidget>[0]
  > = {},
) {
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);

  act(() => {
    root?.render(
      <InteractiveAgentPlaceholderWidget
        config={{}}
        definition={definition()}
        instance={instance()}
        title="Coordinator Chat"
        {...overrides}
      />,
    );
  });
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
  const checkbox = checkboxWithLabel("Direct Mode");
  if (!checkbox) {
    throw new Error("Direct Mode checkbox not found.");
  }

  await act(async () => {
    checkbox.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    await Promise.resolve();
  });
}

function textInput() {
  const input = document.querySelector<HTMLInputElement>('input[type="text"]');
  if (!input) {
    throw new Error("Text input not found.");
  }
  return input;
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
    defaultTitle: "Coordinator Chat",
    description: "Coordinator Chat",
    id: "interactive-agent",
    title: "Coordinator Chat",
  };
}

function instance(): WidgetInstance {
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
    title: "Coordinator Chat",
    visible: true,
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

function expectedCoordinatorCodexExecutable() {
  const platformText = `${navigator.userAgent} ${navigator.platform}`;
  return /(Windows|Win32|Win64|WOW64)/i.test(platformText)
    ? "codex.cmd"
    : "codex";
}
