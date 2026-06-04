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
      [
        "Break this into Queue tasks from visible text only.",
        "- Visible task using only chat",
      ].join("\n"),
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
        body: [
          "Break this into Queue tasks from visible text only.",
          "- Visible task using only chat",
        ].join("\n"),
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

});
