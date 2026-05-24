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
    expect(document.body.textContent).toContain("Break this into Queue tasks");
    expect(document.body.textContent).toContain("Draft tasks for this goal");
    expect(document.body.textContent).toContain("Review latest Queue results");
    expect(document.body.textContent).toContain(
      "Explain how to execute this safely",
    );
    expect(document.body.textContent).toContain("Visible context only");
    expect(document.body.textContent).toContain("Tools disabled");
    expect(document.body.textContent).toContain("No hidden context");
    expect(document.body.textContent).toContain(
      "Coordinator drafts work; Queue and Executor execute only after explicit operator action.",
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

  it("renders a local Plan card without implying execution", async () => {
    renderWidget();

    await sendMessage("Make a plan for stabilizing the visible frontend task");

    expect(document.body.textContent).toContain("Plan draft");
    expect(document.body.textContent).toContain("No execution");
    expect(document.body.textContent).toContain(
      "Planning is UI-only. Queue task drafts still require proposal approval plus Create Queue task",
    );
    expect(document.body.textContent).toContain(
      "No Workspace, Queue, Executor, Notes, Git, JDBC, Terminal, logs, files, or artifacts were read.",
    );
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
      /terminal_output|agent_executor_logs|git_status|git_diff|jdbc_metadata|jdbc_results|notes_body|filesystem|environment_variables|provider_api_key/i,
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
              { label: "Description", value: "Visible provider draft." },
              { label: "Prompt", value: "Use only visible Coordinator chat." },
              { label: "Priority", value: "1" },
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
    expect(document.body.textContent).toContain("Pending preview");
    expect(buttonWithText("Create Queue task")).toBeUndefined();
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
    expect(document.body.textContent).toContain("Queue task proposal");
    expect(document.body.textContent).toContain("Audit the Coordinator proposal flow");
    expect(document.body.textContent).toContain("Add a compact planning card");
    expect(document.body.textContent).toContain("Policy");
    expect(document.body.textContent).toContain("manual");
    expect(buttonWithText("Create Queue task")).toBeUndefined();
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
      "Approval only accepts the preview. Use Create Queue task separately to create a draft task.",
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
