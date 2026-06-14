import { describe, expect, it, vi } from "vitest";
import {
  attachedContextRequest,
  buttonWithText,
  checkboxWithLabel,
  clickButton,
  clickButtonIn,
  directWorkEvent,
  expectedCoordinatorCodexExecutable,
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
  it("renders suggested prompts and compact safety badges in the empty state", async () => {
    renderWidget();

    expect(document.body.textContent).not.toContain("Direct Mode");
    expect(document.body.textContent).not.toContain("Codex Direct Mode");
    expect(checkboxWithLabel("Direct Mode")).toBeUndefined();
    expect(
      document.querySelector('[aria-label="Workspace Agent run configuration"]'),
    ).not.toBeNull();
    expect(document.body.textContent).toContain("Codex");
    expect(document.body.textContent).toContain("Claude Not connected");
    expect(document.body.textContent).toContain("Amp Not connected");
    expect(document.body.textContent).toContain("Status");
    expect(document.body.textContent).toContain("Ready");
    expect(document.body.textContent).toContain("Model");
    expect(document.body.textContent).toContain("gpt-5.5");
    expect(document.body.textContent).toContain("Reasoning");
    expect(document.body.textContent).toContain("medium");
    expect(providerSelect()?.value).toBe("codex");
    expect(providerOption("Codex")?.disabled).toBe(false);
    expect(providerOption("Claude Not connected")?.disabled).toBe(true);
    expect(providerOption("Amp Not connected")?.disabled).toBe(true);
    expect(
      document
        .querySelector('[aria-label="Workspace Agent model setting"]')
        ?.getAttribute("aria-readonly"),
    ).toBe("true");
    expect(
      document
        .querySelector('[aria-label="Workspace Agent reasoning setting"]')
        ?.getAttribute("aria-readonly"),
    ).toBe("true");
    expect(document.body.textContent).toContain("Make a plan");
    expect(document.body.textContent).toContain("Break into Queue tasks");
    expect(document.body.textContent).not.toContain("Draft tasks for this goal");
    expect(document.body.textContent).not.toContain("Review pasted Queue result");
    expect(document.body.textContent).not.toContain(
      "Explain this Executor failure",
    );
    expect(document.body.textContent).not.toContain(
      "Turn this result into next steps",
    );
    expect(document.body.textContent).not.toContain(
      "Draft follow-up Queue tasks",
    );
    expect(document.body.textContent).not.toContain("Summarize validation output");
    expect(document.body.textContent).toContain(
      "Use Examples above for more prompt starters.",
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
      document.querySelector('[aria-label="Workspace Agent prompt examples"]'),
    ).toBeNull();
    expect(
      document.querySelector(".interactive-agent-empty")?.textContent,
    ).toContain("Workspace Agent works from visible chat and explicit attachments.");

    await clickButton("Examples");

    expect(
      document.querySelector('[aria-label="Workspace Agent prompt examples"]'),
    ).not.toBeNull();
    expect(document.body.textContent).toContain("Draft tasks for this goal");
    expect(document.body.textContent).toContain("Review pasted Queue result");
    expect(document.body.textContent).toContain("Explain this Executor failure");
    expect(document.body.textContent).toContain("Turn this result into next steps");
    expect(document.body.textContent).toContain("Draft follow-up Queue tasks");
    expect(document.body.textContent).toContain("Summarize validation output");
    expect(document.body.textContent).toContain(
      "Explain how to execute this safely",
    );
  });


  it("shows Codex as the default agent with home as the default working directory", async () => {
    renderWidget({ onStartCodexDirectWorkStream: vi.fn() });

    expect(checkboxWithLabel("Direct Mode")).toBeUndefined();
    expect(buttonWithText("Start Direct Work")).toBeUndefined();

    expect(
      document.querySelector('[aria-label="Codex settings"]'),
    ).toBeNull();
    expect(buttonWithText("⚙")).toBeDefined();
    expect(document.body.textContent).not.toContain("Working dir");
    await clickButton("⚙");
    expect(
      document.querySelector('[aria-label="Codex settings"]'),
    ).not.toBeNull();
    expect(document.body.textContent).toContain("Working dir");
    expect(textInputValue()).toBe("~");
    expect(document.body.textContent).toContain("Thread: none");
    expect(document.body.textContent).toContain("New Thread");
    expect(document.body.textContent).not.toContain("New Codex thread");
    expect(document.body.textContent).toContain(
      "~ resolves to your user home.",
    );
    expect(document.body.textContent).toContain(
      "If access is denied, choose a project folder or scratch workspace.",
    );
    expect(document.body.textContent).not.toContain(
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
    expect(document.body.textContent).toContain("Plan draft");
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

    await clickButton("Examples");
    await clickButton("Explain this Executor failure");

    expect(textareaValue()).toBe(
      "Explain this Executor failure using visible chat text only. Paste failure here: ",
    );
    expect(provider).not.toHaveBeenCalled();
    expect(createQueueTask).not.toHaveBeenCalled();
  });

});

function providerSelect(): HTMLSelectElement | null {
  return document.querySelector<HTMLSelectElement>(
    'select[aria-label="Workspace Agent provider"]',
  );
}

function providerOption(text: string): HTMLOptionElement | undefined {
  return Array.from(
    document.querySelectorAll<HTMLOptionElement>(
      'select[aria-label="Workspace Agent provider"] option',
    ),
  ).find((option) => option.textContent === text);
}
