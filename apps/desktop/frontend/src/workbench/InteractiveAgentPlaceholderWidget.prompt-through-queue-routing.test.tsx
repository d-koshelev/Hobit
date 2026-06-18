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
            text: JSON.stringify({
              message: "Final foreground result.",
              type: "hobit.final.answer",
            }),
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
      operatorPrompt: expect.stringContaining(
        "User request:\nImplement this directly.",
      ),
      repoRoot: "~",
      sandbox: "workspace_write",
      skipGitRepoCheck: true,
    });
    expect(createQueueTask).not.toHaveBeenCalled();
    expect(startQueueAutorun).not.toHaveBeenCalled();
    expect(provider).not.toHaveBeenCalled();
    expect(document.body.textContent).toContain("Completed");
    expect(document.body.textContent).toContain("Implement this directly.");
    expect(document.body.textContent).toContain(
      "Codex thread not available. Next Codex run starts a new thread.",
    );
    expect(document.body.textContent).toContain("Completed - 1 step");
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

});
