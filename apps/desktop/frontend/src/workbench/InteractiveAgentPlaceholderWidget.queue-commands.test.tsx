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
  it("renders Queue report action cards without calling provider or Executor", async () => {
    const provider = vi.fn();
    const createQueueTask = vi.fn(async (request: CreateQueueTaskInput) => ({
      assignedExecutorWidgetId: null,
      createdAt: "2026-05-31T10:03:00.000Z",
      description: request.description,
      executionPolicy: request.executionPolicy,
      itemType: request.itemType,
      priority: request.priority,
      prompt: request.prompt,
      queueItemId: "follow-up-1",
      queueTagId: request.queueTagId,
      queueTagName: request.queueTagName,
      status: request.status,
      title: request.title,
      updatedAt: "2026-05-31T10:03:00.000Z",
      validationStatus: request.validationStatus,
      workspaceId: "workspace-1",
    }));

    renderWidget({
      onCreateAgentQueueTask: createQueueTask,
      onGenerateCoordinatorProviderResponse: provider,
      queueReportActionCardRequest: queueReportCardRequest(queueReportCard()),
    });

    expect(document.body.textContent).toContain("Queue report action card");
    expect(document.body.textContent).toContain("Source Queue item");
    expect(document.body.textContent).toContain("Implementation");
    expect(document.body.textContent).toContain("needs_follow_up");
    expect(document.body.textContent).toContain("src/report-card.tsx");
    expect(document.body.textContent).toContain("1 warning(s)");
    expect(document.body.textContent).toContain("1 error(s)");
    expect(document.body.textContent).toContain("abc1234");
    expect(document.body.textContent).toContain("No closure state");
    expect(provider).not.toHaveBeenCalled();

    await clickButton("Create follow-up");

    expect(createQueueTask).toHaveBeenCalledTimes(1);
    expect(createQueueTask.mock.calls[0][0]).toMatchObject({
      executionPolicy: "manual",
      itemType: "follow_up",
      queueTagName: "Implementation",
      status: "queued",
      validationStatus: "not_started",
    });
    expect(document.body.textContent).toContain(
      "Queued follow-up item follow-up-1. It was not run.",
    );
    expect(provider).not.toHaveBeenCalled();
  });


  it("marks Queue report needs changes without finalizing done or failed", async () => {
    const updateQueueTask = vi.fn(async (request: UpdateQueueTaskInput) => ({
      assignedExecutorWidgetId: null,
      createdAt: "2026-05-31T10:00:00.000Z",
      updatedAt: "2026-05-31T10:04:00.000Z",
      workspaceId: "workspace-1",
      ...request,
    }));

    renderWidget({
      onUpdateAgentQueueTask: updateQueueTask,
      queueReportActionCardRequest: queueReportCardRequest(queueReportCard()),
    });

    await clickButton("Needs changes");

    expect(updateQueueTask).toHaveBeenCalledWith(
      expect.objectContaining({
        queueItemId: "source-1",
        status: "review_needed",
        validationStatus: "needs_review",
      }),
    );
    expect(updateQueueTask.mock.calls[0][0].status).not.toMatch(
      /completed|failed/,
    );
    expect(document.body.textContent).toContain(
      "It was not finalized as done or failed.",
    );
  });


  it("applies explicit Queue report ready, finalize, and rollback markers without runtime calls", async () => {
    const updateQueueTask = vi.fn(async (request: UpdateQueueTaskInput) => ({
      assignedExecutorWidgetId: null,
      createdAt: "2026-05-31T10:00:00.000Z",
      updatedAt: "2026-05-31T10:04:00.000Z",
      workspaceId: "workspace-1",
      ...request,
    }));
    const provider = vi.fn();

    renderWidget({
      onGenerateCoordinatorProviderResponse: provider,
      onUpdateAgentQueueTask: updateQueueTask,
      queueReportActionCardRequest: queueReportCardRequest(
        queueReportCard({
          changedFiles: [],
          commitHash: undefined,
          recommendedActions: [
            {
              actionId: "mark_ready_for_finalization",
              description: "Ready for finalization.",
              enabled: true,
              label: "Ready for finalization",
              type: "mark_ready_for_finalization",
            },
            {
              actionId: "finalize_accept_item",
              description: "Finalize.",
              enabled: true,
              label: "Finalize / accept",
              type: "finalize_accept_item",
            },
            {
              actionId: "accept_without_commit",
              description: "Accept no-change.",
              enabled: true,
              label: "Accept without commit",
              type: "accept_without_commit",
            },
            {
              actionId: "mark_rollback_required",
              description: "Rollback required.",
              enabled: true,
              label: "Rollback required",
              type: "mark_rollback_required",
            },
          ],
        }),
      ),
    });

    await clickButton("Ready for finalization");
    await clickButton("Accept without commit");
    await clickButton("Finalize / accept");
    await clickButton("Rollback required");

    expect(updateQueueTask).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        status: "review_needed",
        validationStatus: "needs_review",
      }),
    );
    expect(updateQueueTask).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        status: "completed",
        validationStatus: "passed",
      }),
    );
    expect(updateQueueTask).toHaveBeenNthCalledWith(
      3,
      expect.objectContaining({
        status: "completed",
        validationStatus: "passed",
      }),
    );
    expect(updateQueueTask).toHaveBeenNthCalledWith(
      4,
      expect.objectContaining({
        status: "review_needed",
        validationStatus: "needs_review",
      }),
    );
    expect(document.body.textContent).toContain(
      "No file changes; no commit created.",
    );
    expect(document.body.textContent).toContain("No rollback");
    expect(provider).not.toHaveBeenCalled();
  });


  it("opens linked Queue items from report cards through visible plumbing", async () => {
    const onOpenAgentQueueItem = vi.fn();

    renderWidget({
      onOpenAgentQueueItem,
      queueReportActionCardRequest: queueReportCardRequest(
        queueReportCard({ linkedDiffReviewItemId: "diff-review-1" }),
      ),
    });

    await clickButton("Open source item");
    await clickButton("Open linked diff review");

    expect(onOpenAgentQueueItem).toHaveBeenCalledWith("source-1");
    expect(onOpenAgentQueueItem).toHaveBeenCalledWith("diff-review-1");
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
      [
        "Break this into Queue tasks from visible text only.",
        "- Visible task using only chat",
      ].join("\n"),
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
      [
        "Break this into Queue tasks from visible text only.",
        "- Visible task using only chat",
      ].join("\n"),
    );
    await clickButton("Approve");
    await clickButton("Create Queue task");

    expect(createQueueTask).toHaveBeenCalledTimes(1);
    expect(createQueueTask.mock.calls[0][0]).toMatchObject({
      description:
        "Drafted from visible Workspace Agent chat: Visible task using only chat",
      executionPolicy: "manual",
      priority: 0,
      prompt: [
        "Visible task using only chat",
        "",
        "Use only the task prompt and explicit operator-provided context. Do not run hidden tools, mutate Git, or assume hidden Workspace context.",
      ].join("\n"),
      status: "draft",
      title: "Visible task using only chat",
    });
    expect(document.body.textContent).toContain("Queue task created");
    expect(document.body.textContent).toContain(
      "It was not assigned, dispatched, run, or handed to Agent Executor.",
    );
  });

});
