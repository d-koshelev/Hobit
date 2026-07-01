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
  finalAnswerEnvelope,
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

    expect(document.body.textContent).toContain("Plan draft");
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
          "Knowledge / Skills Skill",
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
        sourceLabel: "Knowledge / Skills / Skill",
      }),
      onGenerateCoordinatorProviderResponse: provider,
    });

    expect(document.body.textContent).toContain("Visible attached context");
    expect(document.body.textContent).toContain("Knowledge / Skills / Skill");
    expect(textareaValue()).toContain(
      "Visible attached context (Knowledge / Skills / Skill)",
    );
    expect(textareaValue()).toContain("Title: Frontend review");
    expect(textareaValue()).toContain("Steps:\nRun typecheck\nRun focused tests");
    expect(provider).not.toHaveBeenCalled();

    await clickButton("Send");

    expect(provider).toHaveBeenCalledTimes(1);
    const request = provider.mock.calls[0][1];
    expect(request.operatorMessage).toContain(
      "Visible attached context (Knowledge / Skills / Skill)",
    );
    expect(request.operatorMessage).toContain("Knowledge / Skills Skill");
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
    await setTextareaValue(textareaValue());
    expect(buttonWithText("Send")?.disabled).toBe(false);

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
            text: finalAnswerEnvelope(
              [
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
            ),
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
