import { describe, expect, it, vi } from "vitest";
import {
  attachedContextRequest,
  buttonWithText,
  buttonsWithText,
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
      document.querySelector(".interactive-agent-direct-mode-details"),
    ).toBeNull();
    await clickButton("Run details");
    const runDetails = document.querySelector(".interactive-agent-run-details-popup");
    expect(runDetails?.textContent).toContain("Run run_failed started.");
    expect(runDetails?.textContent).toContain("Run ended with failed.");
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

});
