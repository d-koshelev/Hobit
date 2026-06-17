import { describe, expect, it, vi } from "vitest";
import { act, type ComponentProps } from "react";

import type { AgentQueueTask } from "../../../workspace/types";
import { selectQueueV2ViewModel } from "../../queue/queueV2ViewModel";
import {
  buildSmartQueueWorkerFailureIntegration,
} from "../../queue/smartQueueWorkerReportIntegration";
import {
  proposeSmartQueueRollbackAttemptDecision,
  type SmartQueueCoordinatorDecision,
} from "../../queue/smartQueueCoordinatorDecision";
import { QueueV2TaskDetailsPopup } from "./QueueV2TaskDetailsPopup";
import {
  buttonWithText,
  click,
  queueController,
  report,
  render,
  task,
  worker,
} from "./QueueV2Board.testUtils";

describe("QueueV2TaskDetailsPopup", () => {
  it("renders title, status, summary, and product tabs without default debug content", async () => {
    const selectedTask = task({
      queueItemId: "popup-task",
      status: "queued",
      title: "Popup task",
    });
    const popup = popupModel([selectedTask], selectedTask.queueItemId);

    await render(
      <QueueV2TaskDetailsPopup
        inspector={popup.inspector}
        isOpen
        onRequestClose={vi.fn()}
        taskViewModel={popup.taskViewModel}
      />,
    );

    expect(document.body.textContent).toContain("Popup task");
    expect(document.body.textContent).toContain("Ready");
    expect(document.body.textContent).toContain("Stage");
    expect(document.body.textContent).toContain("Next action");
    expect(document.body.textContent).toContain("Workspace / worker");
    expect(buttonWithText("Overview")).not.toBeNull();
    expect(buttonWithText("Prompt")).not.toBeNull();
    expect(buttonWithText("Context")).not.toBeNull();
    expect(buttonWithText("Result")).not.toBeNull();
    expect(buttonWithText("Activity")).not.toBeNull();
    expect(document.querySelector(".popup-shell-eyebrow")).toBeNull();
    expect(document.body.textContent).not.toContain("Developer");
    expect(document.body.textContent).not.toContain("Raw IDs");
    expect(document.body.textContent).not.toContain("Callback availability");
    expect(document.body.textContent).not.toContain("Queue bridge state");
  });

  it("switches product tabs", async () => {
    const selectedTask = task({
      prompt: "Implement the focused Queue popup redesign.",
      queueItemId: "tabs-task",
      title: "Tabs task",
    });
    const popup = popupModel([selectedTask], selectedTask.queueItemId);

    await render(
      <QueueV2TaskDetailsPopup
        inspector={popup.inspector}
        isOpen
        onRequestClose={vi.fn()}
        taskViewModel={popup.taskViewModel}
      />,
    );

    await click(buttonWithText("Prompt"));

    expect(document.querySelector("[role='tabpanel']")?.textContent).toContain(
      "Implement the focused Queue popup redesign.",
    );
  });

  it("keeps action callbacks wired through the primary action", async () => {
    const onRun = vi.fn();
    const selectedTask = task({
      assignedExecutorWidgetId: "executor",
      assignedWorkerId: "worker",
      queueItemId: "run-task",
      status: "ready",
      title: "Runnable task",
    });
    const popup = popupModel([selectedTask], selectedTask.queueItemId);

    await render(
      <QueueV2TaskDetailsPopup
        inspector={popup.inspector}
        isOpen
        onRequestClose={vi.fn()}
        queue={queueController({
          onRun,
          runCanStart: true,
          selectedTask,
          tasks: [selectedTask],
        })}
        taskViewModel={popup.taskViewModel}
      />,
    );

    await click(buttonWithText("Run task"));

    expect(onRun).toHaveBeenCalledTimes(1);
  });

  it("keeps blocked and missing configuration reasons visible", async () => {
    const selectedTask = task({
      codexExecutable: "",
      queueItemId: "blocked-task",
      status: "queued",
      title: "Blocked task",
    });
    const popup = popupModel([selectedTask], selectedTask.queueItemId, "stopped");

    await render(
      <QueueV2TaskDetailsPopup
        inspector={popup.inspector}
        isOpen
        onRequestClose={vi.fn()}
        queue={queueController({
          selectedTask,
          tasks: [selectedTask],
        })}
        taskViewModel={popup.taskViewModel}
      />,
    );

    expect(document.body.textContent).toContain("Set Codex executable");
    expect(document.body.textContent).toContain("Missing Codex executable");
  });

  it("saves Codex executable through the task-scoped setup control", async () => {
    const onSaveCodexExecutable = vi.fn();
    const onRun = vi.fn();
    const onPromote = vi.fn();
    const selectedTask = task({
      codexExecutable: "",
      queueItemId: "codex-setup-task",
      status: "draft",
      title: "Codex setup task",
    });
    const popup = popupModel([selectedTask], selectedTask.queueItemId, "stopped");

    await render(
      <QueueV2TaskDetailsPopup
        inspector={popup.inspector}
        isOpen
        onRequestClose={vi.fn()}
        queue={queueController({
          onPromote,
          onRun,
          onSaveCodexExecutable,
          selectedTask,
          tasks: [selectedTask],
        })}
        taskViewModel={popup.taskViewModel}
      />,
    );

    expect(sectionByName("Task Codex executable setup")).not.toBeNull();

    await setInputValue("Codex executable", "codex.cmd");
    await click(buttonWithText("Save Codex executable"));

    expect(onSaveCodexExecutable).toHaveBeenCalledWith("codex.cmd");
    expect(onRun).not.toHaveBeenCalled();
    expect(onPromote).not.toHaveBeenCalled();
  });

  it("rejects empty Codex executable without calling task update", async () => {
    const onSaveCodexExecutable = vi.fn();
    const selectedTask = task({
      codexExecutable: "",
      queueItemId: "empty-codex-task",
      status: "draft",
      title: "Empty Codex task",
    });
    const popup = popupModel([selectedTask], selectedTask.queueItemId, "stopped");

    await render(
      <QueueV2TaskDetailsPopup
        inspector={popup.inspector}
        isOpen
        onRequestClose={vi.fn()}
        queue={queueController({
          onSaveCodexExecutable,
          selectedTask,
          tasks: [selectedTask],
        })}
        taskViewModel={popup.taskViewModel}
      />,
    );

    await setInputValue("Codex executable", "   ");
    await click(buttonWithText("Save Codex executable"));

    expect(document.body.textContent).toContain(
      "Enter a Codex executable before saving.",
    );
    expect(onSaveCodexExecutable).not.toHaveBeenCalled();
  });

  it("shows unavailable state when task updates are not wired", async () => {
    const selectedTask = task({
      codexExecutable: "",
      queueItemId: "unavailable-codex-task",
      status: "draft",
      title: "Unavailable Codex task",
    });
    const popup = popupModel([selectedTask], selectedTask.queueItemId, "stopped");
    const controller = queueController({
      selectedTask,
      tasks: [selectedTask],
    });

    controller.run.canUpdateTaskSettings = false;
    controller.run.onSaveTaskCodexExecutable = undefined as never;

    await render(
      <QueueV2TaskDetailsPopup
        inspector={popup.inspector}
        isOpen
        onRequestClose={vi.fn()}
        queue={controller}
        taskViewModel={popup.taskViewModel}
      />,
    );

    expect(sectionByName("Task Codex executable setup")?.textContent).toContain(
      "Queue task updates are unavailable in this runtime.",
    );
    expect(buttonWithText("Save Codex executable")?.disabled).toBe(true);
  });

  it("shows failed task update result without hiding the setup control", async () => {
    const selectedTask = task({
      codexExecutable: "",
      queueItemId: "failed-codex-task",
      status: "draft",
      title: "Failed Codex task",
    });
    const popup = popupModel([selectedTask], selectedTask.queueItemId, "stopped");
    const controller = queueController({
      selectedTask,
      tasks: [selectedTask],
    });

    controller.run.onSaveTaskCodexExecutable = vi.fn(async () => ({
      message: "Unable to save task run settings.",
      ok: false as const,
    }));

    await render(
      <QueueV2TaskDetailsPopup
        inspector={popup.inspector}
        isOpen
        onRequestClose={vi.fn()}
        queue={controller}
        taskViewModel={popup.taskViewModel}
      />,
    );

    await setInputValue("Codex executable", "codex.cmd");
    await click(buttonWithText("Save Codex executable"));

    expect(document.body.textContent).toContain(
      "Unable to save task run settings.",
    );
    expect(sectionByName("Task Codex executable setup")).not.toBeNull();
  });

  it("shows Enable Queue when queue is disabled and the task can use that action", async () => {
    const selectedTask = task({
      queueItemId: "enable-task",
      status: "queued",
      title: "Enable task",
    });
    const popup = popupModel([selectedTask], selectedTask.queueItemId, "stopped");

    await render(
      <QueueV2TaskDetailsPopup
        inspector={popup.inspector}
        isOpen
        onRequestClose={vi.fn()}
        queue={queueController({
          selectedTask,
          tasks: [selectedTask],
        })}
        taskViewModel={popup.taskViewModel}
      />,
    );

    expect(buttonWithText("Enable Queue")).not.toBeNull();
  });

  it("shows Coordinator Decision card for validation failure details", async () => {
    await renderDecisionPopup(
      smartFailureTask({
        evidenceSummary: "Validation command failed in typecheck.",
        failureKind: "validation_failure",
        queueItemId: "validation-task",
        reason: "Validation failed.",
      }),
    );

    const card = coordinatorDecisionCard();

    expect(card?.textContent).toContain("Coordinator decision");
    expect(card?.textContent).toContain("Needs decision: validation failed");
    expect(card?.textContent).toContain("Validation command failed in typecheck.");
    expect(card?.textContent).toContain("Retry with changes");
    expect(card?.textContent).toContain("Request human input");
    expect(card?.textContent).toContain("Mark failed");
    expect(card?.textContent).toContain("Operator approval required");
    expect(card?.textContent).toContain("No destructive action proposed");
    expect(card?.textContent).toContain("Action unavailable");
  });

  it("renders a real Retry button when validation failure decision allows Retry same", async () => {
    const onRetrySame = vi.fn();
    const selectedTask = smartFailureTask({
      evidenceSummary: "Validation failed after a transient environment issue.",
      failureKind: "validation_failure",
      includeRetrySame: true,
      maxRetries: 2,
      queueItemId: "validation-retry-task",
      reason: "Validation failed.",
      retryCount: 0,
    });

    await renderDecisionPopup(selectedTask, {
      queue: queueController({
        onRetrySame,
        selectedTask,
        tasks: [selectedTask],
      }),
    });

    const retryButton = buttonWithText("Retry");

    expect(retryButton).not.toBeNull();
    expect(retryButton?.disabled).toBe(false);
    expect(coordinatorDecisionCard()?.textContent).not.toContain("retry_same");

    await click(retryButton);

    expect(onRetrySame).toHaveBeenCalledTimes(1);
  });

  it("renders Retry with changes only when the decision allows modified-prompt retry", async () => {
    const onRetryWithModifiedPrompt = vi.fn();
    const selectedTask = smartFailureTask({
      evidenceSummary: "Validation failed and needs a prompt adjustment.",
      failureKind: "validation_failure",
      maxRetries: 2,
      queueItemId: "modified-retry-task",
      reason: "Validation failed.",
      retryCount: 0,
    });

    await renderDecisionPopup(selectedTask, {
      queue: queueController({
        onRetryWithModifiedPrompt,
        selectedTask,
        tasks: [selectedTask],
      }),
    });

    expect(buttonWithText("Retry with changes")).not.toBeNull();
    expect(coordinatorDecisionCard()?.textContent).not.toContain(
      "retry_with_modified_prompt",
    );
  });

  it("does not render Retry with changes when retry budget is exhausted", async () => {
    const selectedTask = smartFailureTask({
      evidenceSummary: "Validation failed after final retry.",
      failureKind: "validation_failure",
      maxRetries: 1,
      queueItemId: "modified-retry-limit-task",
      reason: "Validation failed.",
      retryCount: 1,
    });

    await renderDecisionPopup(selectedTask, {
      queue: queueController({
        selectedTask,
        tasks: [selectedTask],
      }),
    });

    expect(coordinatorDecisionCard()?.textContent).toContain(
      "Needs decision: validation failed",
    );
    expect(coordinatorDecisionCard()?.textContent).toContain(
      "Action unavailable",
    );
    expect(buttonWithText("Retry with changes")).toBeNull();
  });

  it("opens a compact modified prompt editor with the current prompt", async () => {
    const selectedTask = smartFailureTask({
      evidenceSummary: "Validation failed and needs a prompt adjustment.",
      failureKind: "validation_failure",
      maxRetries: 2,
      prompt: "Original prompt for retry",
      queueItemId: "modified-editor-task",
      reason: "Validation failed.",
      retryCount: 0,
    });

    await renderDecisionPopup(selectedTask, {
      queue: queueController({
        selectedTask,
        tasks: [selectedTask],
      }),
    });

    await click(buttonWithText("Retry with changes"));

    const editor = document.querySelector<HTMLElement>(
      "[aria-label='Retry with modified prompt editor']",
    );
    const modifiedPrompt = document.querySelector<HTMLTextAreaElement>(
      "textarea[aria-label='Modified retry prompt']",
    );

    expect(editor?.textContent).toContain("Current prompt");
    expect(editor?.textContent).toContain("Modified prompt");
    expect(document.body.textContent).toContain("Original prompt for retry");
    expect(modifiedPrompt?.value).toBe("Original prompt for retry");
  });

  it("rejects an empty modified prompt with product-facing error", async () => {
    const onRetryWithModifiedPrompt = vi.fn();
    const selectedTask = smartFailureTask({
      evidenceSummary: "Validation failed and needs a prompt adjustment.",
      failureKind: "validation_failure",
      maxRetries: 2,
      prompt: "Original prompt for retry",
      queueItemId: "modified-empty-task",
      reason: "Validation failed.",
      retryCount: 0,
    });

    await renderDecisionPopup(selectedTask, {
      queue: queueController({
        onRetryWithModifiedPrompt,
        selectedTask,
        tasks: [selectedTask],
      }),
    });

    await click(buttonWithText("Retry with changes"));
    await setTextareaValue("Modified retry prompt", "   ");
    await click(buttonWithText("Queue retry"));

    expect(document.body.textContent).toContain(
      "Enter a modified prompt before queueing retry.",
    );
    expect(onRetryWithModifiedPrompt).not.toHaveBeenCalled();
  });

  it("submits the modified prompt through the Queue controller without starting work", async () => {
    const onRetryWithModifiedPrompt = vi.fn().mockResolvedValue(true);
    const onRun = vi.fn();
    const selectedTask = smartFailureTask({
      evidenceSummary: "Validation failed and needs a prompt adjustment.",
      failureKind: "validation_failure",
      maxRetries: 2,
      prompt: "Original prompt for retry",
      queueItemId: "modified-submit-task",
      reason: "Validation failed.",
      retryCount: 0,
    });

    await renderDecisionPopup(selectedTask, {
      queue: queueController({
        onRetryWithModifiedPrompt,
        onRun,
        selectedTask,
        tasks: [selectedTask],
      }),
    });

    await click(buttonWithText("Retry with changes"));
    await setTextareaValue(
      "Modified retry prompt",
      "Modified prompt for next attempt",
    );
    await click(buttonWithText("Queue retry"));

    expect(onRetryWithModifiedPrompt).toHaveBeenCalledWith(
      "Modified prompt for next attempt",
    );
    expect(onRun).not.toHaveBeenCalled();
  });

  it("shows product-facing execution failure decision", async () => {
    await renderDecisionPopup(
      smartFailureTask({
        evidenceSummary: "Direct Work exited before producing a report.",
        failureKind: "execution_failure",
        queueItemId: "exec-task",
        reason: "Direct Work failed.",
      }),
    );

    expect(coordinatorDecisionCard()?.textContent).toContain(
      "Blocked: exec failure",
    );
    expect(coordinatorDecisionCard()?.textContent).toContain("Block");
  });

  it("shows product-facing missing config decision", async () => {
    await renderDecisionPopup(
      smartFailureTask({
        evidenceSummary: "Task workspace is missing.",
        failureKind: "missing_config",
        queueItemId: "config-task",
        reason: "Missing execution workspace.",
      }),
    );

    expect(coordinatorDecisionCard()?.textContent).toContain(
      "Blocked: missing config",
    );
    expect(coordinatorDecisionCard()?.textContent).toContain(
      "Task workspace is missing.",
    );
  });

  it("shows timeout retry budget available decision", async () => {
    await renderDecisionPopup(
      smartFailureTask({
        evidenceSummary: "The attempt timed out after the configured limit.",
        failureKind: "timeout",
        maxRetries: 2,
        queueItemId: "retry-task",
        reason: "Run timed out.",
        retryCount: 0,
      }),
    );

    expect(coordinatorDecisionCard()?.textContent).toContain("Retry available");
    expect(coordinatorDecisionCard()?.textContent).toContain("Retry");
    expect(buttonWithText("Retry")).toBeNull();
  });

  it("shows timeout retry limit reached decision", async () => {
    const selectedTask = smartFailureTask({
        evidenceSummary: "The attempt timed out after the final retry.",
        failureKind: "timeout",
        maxRetries: 1,
        queueItemId: "retry-limit-task",
        reason: "Run timed out.",
        retryCount: 1,
    });

    await renderDecisionPopup(selectedTask, {
      queue: queueController({
        selectedTask,
        tasks: [selectedTask],
      }),
    });

    expect(coordinatorDecisionCard()?.textContent).toContain(
      "Retry limit reached",
    );
    expect(coordinatorDecisionCard()?.textContent).toContain(
      "Request human input",
    );
    expect(buttonWithText("Retry")).toBeNull();
  });

  it("renders real rollback proposal action only when rollback proposal is allowed", async () => {
    const onPrepareRollbackProposal = vi.fn().mockResolvedValue({
      approvalRequired: true,
      attemptId: "smart-attempt:rollback-task:rollback-task-run",
      baseRevision: "base-rev-1",
      changedFiles: ["src/workbench/queue.ts"],
      changedFilesCount: 1,
      coordinatorDecisionId:
        "smart-queue-decision:rollback-task:smart-attempt:rollback-task:rollback-task-run:validation_failure",
      createdAt: "2026-06-15T12:00:00.000Z",
      destructive: true,
      executableNow: false,
      failureSummary: "Attempt changed files that may need operator rollback.",
      planText: "No rollback executed.",
      proposalId: "rollback-proposal-1",
      reason: "rollback proposal",
      riskSummary: "Destructive rollback needs operator approval before any action.",
      status: "Needs decision: rollback proposal",
      taskId: "rollback-task",
    });
    const taskWithRollback = smartFailureTask({
      changedFiles: ["src/workbench/queue.ts"],
      decision: "rollback",
      evidenceSummary: "Attempt changed files that may need operator rollback.",
      failureKind: "validation_failure",
      queueItemId: "rollback-task",
      reason: "Validation failed after file changes.",
    });

    await renderDecisionPopup(taskWithRollback, {
      queue: queueController({
        onPrepareRollbackProposal,
        selectedTask: taskWithRollback,
        tasks: [taskWithRollback],
      }),
    });

    const card = coordinatorDecisionCard();

    expect(card?.textContent).toContain("Needs decision: rollback proposal");
    expect(card?.textContent).toContain("Rollback proposal");
    expect(card?.textContent).toContain("Operator approval required");
    expect(card?.textContent).toContain("Destructive action proposed");
    expect(card?.textContent).toContain("Destructive");
    expect(buttonWithText("Retry")).toBeNull();
    expect(buttonWithText("Retry with changes")).toBeNull();
    expect(buttonWithText("Rollback proposal")).toBeNull();
    expect(buttonWithText("Prepare rollback proposal")).not.toBeNull();

    await click(buttonWithText("Prepare rollback proposal"));

    expect(onPrepareRollbackProposal).toHaveBeenCalledTimes(1);
    expect(document.body.textContent).toContain("Rollback proposal prepared");
    expect(document.body.textContent).toContain("Approval required");
    expect(document.body.textContent).toContain("Destructive");
    expect(document.body.textContent).toContain("Affected files: 1");
    expect(document.body.textContent).toContain("src/workbench/queue.ts");
    expect(document.body.textContent).toContain("Base revision");
    expect(document.body.textContent).toContain("base-rev-1");
    expect(document.body.textContent).toContain("No rollback executed");
  });

  it("does not render a fake rollback proposal action when the handler is missing", async () => {
    const taskWithRollback = smartFailureTask({
      decision: "rollback",
      evidenceSummary: "Attempt changed files that may need operator rollback.",
      failureKind: "validation_failure",
      queueItemId: "rollback-no-handler-task",
      reason: "Validation failed after file changes.",
    });
    const controller = queueController({
      selectedTask: taskWithRollback,
      tasks: [taskWithRollback],
    });

    (controller as Partial<typeof controller>).smartQueueRollback = undefined;

    await renderDecisionPopup(taskWithRollback, { queue: controller });

    expect(coordinatorDecisionCard()?.textContent).toContain("Rollback proposal");
    expect(buttonWithText("Prepare rollback proposal")).toBeNull();
  });

  it("shows Workspace Agent assistance proposal without calling runtime", async () => {
    const onShowQueueTaskInWorkspaceChat = vi.fn();

    await renderDecisionPopup(
      smartFailureTask({
        evidenceSummary: "The task needs visible product context.",
        failureKind: "missing_context",
        queueItemId: "assistance-task",
        reason: "Context needed.",
      }),
      { onShowQueueTaskInWorkspaceChat },
    );

    const card = coordinatorDecisionCard();

    expect(card?.textContent).toContain("Ask Workspace Agent");
    expect(card?.textContent).toContain("Action unavailable");
    expect(buttonWithText("Ask Workspace Agent")).toBeNull();
    expect(onShowQueueTaskInWorkspaceChat).not.toHaveBeenCalled();
  });

  it("renders real Ask Workspace Agent action only with an assistance handler", async () => {
    const onAskWorkspaceAgent = vi.fn().mockResolvedValue({
      changedFiles: [],
      coordinatorDecisionId: "decision-1",
      createdAt: "2026-06-15T12:00:00.000Z",
      currentRunnablePrompt: "Run the task",
      failureSummary: "The task needs visible product context.",
      originalPrompt: "Run the task",
      reason: "missing context",
      recommendedPrompt: [
        "Please review why the Queue task \"assistance-task\" is stuck or failed.",
        "Failure summary: The task needs visible product context.",
        "Inspect the likely cause and propose one next step.",
      ].join("\n"),
      requestId: "assistance-1",
      status: "Ask Workspace Agent",
      taskId: "assistance-task",
      taskTitle: "assistance-task",
    });
    const selectedTask = smartFailureTask({
      evidenceSummary: "The task needs visible product context.",
      failureKind: "missing_context",
      queueItemId: "assistance-task",
      reason: "Context needed.",
    });

    await renderDecisionPopup(selectedTask, {
      queue: queueController({
        onAskWorkspaceAgent,
        selectedTask,
        tasks: [selectedTask],
      }),
    });

    const askButton = buttonWithText("Ask Workspace Agent");

    expect(askButton).not.toBeNull();
    expect(coordinatorDecisionCard()?.textContent).not.toContain(
      "request_workspace_agent_assistance",
    );

    await click(askButton);

    expect(onAskWorkspaceAgent).toHaveBeenCalledTimes(1);
    expect(document.body.textContent).toContain("Assistance request prepared");
    expect(document.body.textContent).toContain("Handoff prompt");
    expect(
      document.querySelector<HTMLTextAreaElement>(
        "textarea[aria-label='Workspace Agent handoff prompt']",
      )?.value,
    ).toContain("The task needs visible product context.");
    expect(buttonWithText("Select prompt")).not.toBeNull();
  });

  it("does not render a fake Ask Workspace Agent action when the handler is missing", async () => {
    const selectedTask = smartFailureTask({
      evidenceSummary: "The task needs visible product context.",
      failureKind: "missing_context",
      queueItemId: "assistance-no-handler-task",
      reason: "Context needed.",
    });
    const controller = queueController({
      selectedTask,
      tasks: [selectedTask],
    });

    (controller as Partial<typeof controller>).smartQueueAssistance = undefined;

    await renderDecisionPopup(selectedTask, { queue: controller });

    expect(coordinatorDecisionCard()?.textContent).toContain(
      "Ask Workspace Agent",
    );
    expect(buttonWithText("Ask Workspace Agent")).toBeNull();
  });

  it("keeps raw enum names and raw JSON out of the assistance handoff", async () => {
    const onAskWorkspaceAgent = vi.fn().mockResolvedValue({
      changedFiles: [],
      coordinatorDecisionId: "decision-1",
      createdAt: "2026-06-15T12:00:00.000Z",
      currentRunnablePrompt: "Run validation",
      failureSummary: "Validation command failed.",
      originalPrompt: "Run validation",
      reason: "validation failed",
      recommendedPrompt: [
        "Please review why the Queue task \"handoff-task\" is stuck or failed.",
        "Failure summary: Validation command failed.",
        "Inspect the likely cause and propose one next step.",
      ].join("\n"),
      requestId: "assistance-1",
      status: "Needs decision",
      taskId: "handoff-task",
      taskTitle: "handoff-task",
    });
    const selectedTask = smartFailureTask({
      evidenceSummary:
        '{"kind":"smart_queue_worker_failure_report","failureKind":"validation_failure"}',
      failureKind: "missing_context",
      queueItemId: "handoff-task",
      reason: "Context needed.",
    });

    await renderDecisionPopup(selectedTask, {
      queue: queueController({
        onAskWorkspaceAgent,
        selectedTask,
        tasks: [selectedTask],
      }),
    });
    await click(buttonWithText("Ask Workspace Agent"));

    const prompt =
      document.querySelector<HTMLTextAreaElement>(
        "textarea[aria-label='Workspace Agent handoff prompt']",
      )?.value ?? "";

    expect(prompt).toContain("Validation command failed.");
    expect(prompt).not.toContain("validation_failure");
    expect(prompt).not.toContain("smart_queue_worker_failure_report");
    expect(prompt).not.toContain('{"');
  });

  it("does not render the decision card for legacy tasks without Smart Queue decision payload", async () => {
    await renderDecisionPopup(
      task({
        queueItemId: "legacy-task",
        status: "review_needed",
        title: "Legacy report task",
        workerExecutionReports: [
          report({
            rawReportPreview: "Legacy report text without Smart Queue payload.",
            summary: "Legacy report",
          }),
        ],
      }),
    );

    expect(coordinatorDecisionCard()).toBeNull();
    expect(document.body.textContent).toContain("Legacy report task");
    expect(buttonWithText("Retry with changes")).toBeNull();
    expect(buttonWithText("Prepare rollback proposal")).toBeNull();
  });

  it("keeps raw enum names and raw JSON out of the decision card", async () => {
    await renderDecisionPopup(
      smartFailureTask({
        evidenceSummary:
          '{"kind":"smart_queue_worker_failure_report","failureKind":"validation_failure"}',
        failureKind: "validation_failure",
        queueItemId: "raw-task",
        reason: "Validation failed.",
      }),
    );

    const text = coordinatorDecisionCard()?.textContent ?? "";

    expect(text).toContain("Worker report needs operator review.");
    expect(text).not.toContain("smart_queue_worker_failure_report");
    expect(text).not.toContain("validation_failure");
    expect(text).not.toContain('{"');
  });
});

function popupModel(
  tasks: ReturnType<typeof task>[],
  selectedTaskId: string,
  globalExecutionState: "started" | "stopped" = "started",
) {
  const viewModel = selectQueueV2ViewModel({
    globalExecutionState,
    selectedTaskId,
    tasks,
    workers: [worker()],
  });

  const taskViewModel =
    viewModel.tasks.find((item) => item.taskId === selectedTaskId) ?? null;

  return {
    inspector: viewModel.inspector,
    taskViewModel,
  };
}

async function renderDecisionPopup(
  selectedTask: AgentQueueTask,
  overrides: Pick<
    ComponentProps<typeof QueueV2TaskDetailsPopup>,
    "onShowQueueTaskInWorkspaceChat" | "queue"
  > = {},
) {
  const popup = popupModel([selectedTask], selectedTask.queueItemId);

  await render(
    <QueueV2TaskDetailsPopup
      inspector={popup.inspector}
      isOpen
      onRequestClose={vi.fn()}
      showCoordinatorDecisionCard
      taskViewModel={popup.taskViewModel}
      {...overrides}
    />,
  );
}

function coordinatorDecisionCard() {
  return document.querySelector<HTMLElement>(
    "[aria-label='Coordinator Decision card']",
  );
}

function sectionByName(name: string): HTMLElement | null {
  return (
    Array.from(document.querySelectorAll<HTMLElement>("section")).find(
      (element) => element.getAttribute("aria-label") === name,
    ) ?? null
  );
}

async function setInputValue(label: string, value: string) {
  const labels = Array.from(document.querySelectorAll<HTMLLabelElement>("label"));
  const labelElement = labels.find((item) => item.textContent === label);
  const inputId = labelElement?.getAttribute("for");
  const input = inputId
    ? document.getElementById(inputId) as HTMLInputElement | null
    : null;

  if (!input) {
    throw new Error(`Input ${label} not found.`);
  }

  await act(async () => {
    setNativeValue(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
  });
}

async function setTextareaValue(label: string, value: string) {
  const textarea = document.querySelector<HTMLTextAreaElement>(
    `textarea[aria-label="${label}"]`,
  );

  if (!textarea) {
    throw new Error(`Textarea ${label} not found.`);
  }

  await act(async () => {
    setNativeValue(textarea, value);
    textarea.dispatchEvent(new Event("input", { bubbles: true }));
    textarea.dispatchEvent(new Event("change", { bubbles: true }));
  });
}

function setNativeValue(
  element: HTMLInputElement | HTMLTextAreaElement,
  value: string,
) {
  const valueSetter = Object.getOwnPropertyDescriptor(element, "value")?.set;
  const prototype = Object.getPrototypeOf(element) as HTMLInputElement;
  const prototypeValueSetter = Object.getOwnPropertyDescriptor(
    prototype,
    "value",
  )?.set;

  if (prototypeValueSetter && valueSetter !== prototypeValueSetter) {
    prototypeValueSetter.call(element, value);
    return;
  }

  valueSetter?.call(element, value);
}

function smartFailureTask({
  changedFiles,
  decision,
  evidenceSummary,
  failureKind,
  maxRetries,
  queueItemId,
  reason,
  retryCount,
  includeRetrySame,
  prompt,
}: {
  changedFiles?: readonly string[];
  decision?: "rollback";
  evidenceSummary: string;
  failureKind: Parameters<typeof buildSmartQueueWorkerFailureIntegration>[0]["failureKind"];
  includeRetrySame?: boolean;
  maxRetries?: number;
  prompt?: string;
  queueItemId: string;
  reason: string;
  retryCount?: number;
}) {
  const baseTask = task({
    coordinatorStatus:
      failureKind === "execution_failure" || failureKind === "missing_config"
        ? "blocked"
        : "awaiting_coordinator_review",
    queueItemId,
    ...(prompt !== undefined ? { prompt } : {}),
    status: "review_needed",
    title: queueItemId,
    validationStatus:
      failureKind === "validation_failure" ? "failed" : "needs_review",
  });
  const integration = buildSmartQueueWorkerFailureIntegration({
    changedFiles,
    createdAt: "2026-01-01T00:00:00.000Z",
    evidenceSummary,
    failureKind,
    maxRetries,
    reason,
    retryCount,
    runId: `${queueItemId}-run`,
    task: baseTask,
  });
  const coordinatorDecision: SmartQueueCoordinatorDecision =
    decision === "rollback"
      ? proposeSmartQueueRollbackAttemptDecision({
          maxRetries: maxRetries ?? 1,
          report: integration.workerReport,
          retryCount: retryCount ?? 1,
        })
      : includeRetrySame
        ? {
            ...integration.coordinatorDecision,
            availableActions: [
              "retry_same",
              ...integration.coordinatorDecision.availableActions,
            ],
            retryPolicy: {
              canRetry: true,
              maxRetries: maxRetries ?? 1,
              retryCount: retryCount ?? 0,
            },
          }
        : integration.coordinatorDecision;
  const payload = {
    attempt:
      decision === "rollback"
        ? {
            ...integration.attempt,
            baseRevision: "base-rev-1",
            changedFiles: changedFiles ?? [],
          }
        : integration.attempt,
    coordinatorDecision,
    kind: "smart_queue_worker_failure_report",
    queueDetail: integration.queueDetail,
    queueStatus: coordinatorDecision.productLabel,
    sideEffects: integration.sideEffects,
    version: 1,
    workerReport: integration.workerReport,
  };

  return {
    ...baseTask,
    coordinatorStatus: integration.taskPatch.coordinatorStatus,
    validationStatus: integration.taskPatch.validationStatus,
    workerExecutionReports: [
      {
        ...integration.taskPatch.workerExecutionReport,
        changedFiles: changedFiles
          ? [...changedFiles]
          : integration.taskPatch.workerExecutionReport.changedFiles,
        rawReportPreview: JSON.stringify(payload),
        summary: coordinatorDecision.productLabel,
      },
    ],
  };
}
