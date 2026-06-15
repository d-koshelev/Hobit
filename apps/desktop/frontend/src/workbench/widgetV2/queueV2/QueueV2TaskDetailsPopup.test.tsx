import { describe, expect, it, vi } from "vitest";
import type { ComponentProps } from "react";

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

  it("shows rollback proposal as destructive and approval required without executing rollback", async () => {
    const taskWithRollback = smartFailureTask({
      decision: "rollback",
      evidenceSummary: "Attempt changed files that may need operator rollback.",
      failureKind: "validation_failure",
      queueItemId: "rollback-task",
      reason: "Validation failed after file changes.",
    });

    await renderDecisionPopup(taskWithRollback, {
      queue: queueController({
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
    expect(buttonWithText("Rollback proposal")).toBeNull();
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
    expect(onShowQueueTaskInWorkspaceChat).not.toHaveBeenCalled();
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

function smartFailureTask({
  decision,
  evidenceSummary,
  failureKind,
  maxRetries,
  queueItemId,
  reason,
  retryCount,
  includeRetrySame,
}: {
  decision?: "rollback";
  evidenceSummary: string;
  failureKind: Parameters<typeof buildSmartQueueWorkerFailureIntegration>[0]["failureKind"];
  includeRetrySame?: boolean;
  maxRetries?: number;
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
    status: "review_needed",
    title: queueItemId,
    validationStatus:
      failureKind === "validation_failure" ? "failed" : "needs_review",
  });
  const integration = buildSmartQueueWorkerFailureIntegration({
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
    attempt: integration.attempt,
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
        rawReportPreview: JSON.stringify(payload),
        summary: coordinatorDecision.productLabel,
      },
    ],
  };
}
