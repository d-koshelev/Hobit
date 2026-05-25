import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

import { InteractiveAgentPlaceholderWidget } from "./InteractiveAgentPlaceholderWidget";
import type { WidgetDefinition, WidgetInstance } from "./types";
import type {
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
    expect(document.body.textContent).toContain(
      "Coordinator drafts work; Queue and Executor execute only after explicit operator action.",
    );
    expect(
      document.querySelector('[aria-label="Coordinator suggested prompts"]'),
    ).not.toBeNull();
    expect(
      document.querySelector(".interactive-agent-empty")?.textContent,
    ).not.toContain("Workspace");
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
      "Coordinator details",
    );
    expect(
      providerDetails?.querySelector(".interactive-agent-provider-row"),
    ).not.toBeNull();
    expect(responseDetails).not.toBeNull();
    expect(responseDetails?.open).toBe(false);
    expect(responseDetails?.querySelector("summary")?.textContent).toBe(
      "mock-local details",
    );
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
      "Only visible attached context is sent.",
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

    await clickButton("Send");

    expect(provider).toHaveBeenCalledTimes(1);
    const request = provider.mock.calls[0][1];
    expect(request.operatorMessage).toContain(
      "Visible attached context (Executor run history row)",
    );
    expect(request.operatorMessage).toContain("Executor run metadata");
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
  const textarea = document.querySelector("textarea");
  if (!textarea) {
    throw new Error("Message textarea not found.");
  }

  await act(async () => {
    setNativeValue(textarea, message);
    textarea.dispatchEvent(new Event("input", { bubbles: true }));
    textarea.dispatchEvent(new Event("change", { bubbles: true }));
  });

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

function setNativeValue(field: HTMLTextAreaElement, value: string) {
  const descriptor = Object.getOwnPropertyDescriptor(
    HTMLTextAreaElement.prototype,
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
