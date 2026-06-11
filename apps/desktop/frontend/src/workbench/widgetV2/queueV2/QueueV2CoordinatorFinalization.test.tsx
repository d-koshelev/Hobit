import { act } from "react";
import type { ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

import type {
  AgentQueueTask,
  AgentQueueWorkerExecutionReport,
} from "../../../workspace/types";
import type { AgentWorkerSummary } from "../../agentQueueTaskUiModel";
import { QueueV2Board } from "./QueueV2Board";

let root: Root | null = null;
let container: HTMLDivElement | null = null;

afterEach(() => {
  if (root && container) {
    act(() => root?.unmount());
    container.remove();
  }
  root = null;
  container = null;
  document.body.innerHTML = "";
});

describe("QueueV2 coordinator finalization display/actions", () => {
  it("shows coordinator state, commit markers, and saved commit metadata", async () => {
    await render(
      <QueueV2Board
        tasks={[
          task({
            closureState: "commit_created",
            coordinatorStatus: "finalized",
            queueItemId: "finalized-with-commit",
            status: "completed",
            title: "Finalized implementation",
            validationStatus: "passed",
            workerExecutionReports: [
              report({
                commitHash: "abc1234",
                rawReportPreview: coordinatorFinalizationRaw({
                  commitHash: "abc1234",
                  commitTitle: "frontend: show coordinator state",
                  operatorNote: "Accepted after validation and Diff Review.",
                }),
                reportId: "coordinator-report",
                summary: "Accepted with existing commit abc1234.",
                workerId: "queue-coordinator",
              }),
            ],
          }),
        ]}
        workers={[worker()]}
      />,
    );

    await click(laneToggle("Closed"));

    expect(card("finalized-with-commit")?.dataset.queueV2Coordinator).toBe(
      "finalized",
    );
    expect(card("finalized-with-commit")?.textContent).toContain(
      "Finalized / commit saved",
    );
    expect(card("finalized-with-commit")?.textContent).toContain("Commit saved");

    await openCardDetails("finalized-with-commit");
    await click(buttonWithText("Coordinator"));

    const panelText = activePanel()?.textContent ?? "";
    expect(panelText).toContain("Decision state");
    expect(panelText).toContain("abc1234 / frontend: show coordinator state");
    expect(panelText).toContain("frontend: show coordinator state");
    expect(panelText).toContain("Accepted after validation and Diff Review.");
    expect(panelText).toContain("No dependent Queue items reference this item.");
  });

  it("shows coordinator validation and Diff Review warnings when evidence is missing", async () => {
    await render(
      <QueueV2Board
        tasks={[
          task({
            closureState: "commit_required",
            coordinatorStatus: "ready_for_finalization",
            queueItemId: "missing-evidence",
            status: "review_needed",
            title: "Missing evidence task",
            validationStatus: "not_started",
            workerExecutionReports: [report({ changedFiles: ["src/app.ts"] })],
          }),
        ]}
        workers={[worker()]}
      />,
    );

    expect(card("missing-evidence")?.textContent).toContain(
      "Ready for finalization",
    );

    await openCardDetails("missing-evidence");
    await click(buttonWithText("Coordinator"));

    const panelText = activePanel()?.textContent ?? "";
    expect(panelText).toContain("Validation evidence is missing.");
    expect(panelText).toContain("Diff Review reference is missing.");
    expect(panelText).toContain("Resolve validation evidence before acceptance.");
  });

  it("keeps coordinator actions disabled with reasons when Queue actions are unavailable", async () => {
    const onSelectedTaskChange = vi.fn();

    await render(
      <QueueV2Board
        onSelectedTaskChange={onSelectedTaskChange}
        tasks={[
          task({
            queueItemId: "unwired",
            status: "review_needed",
            title: "Unwired coordinator task",
            workerExecutionReports: [report()],
          }),
        ]}
        workers={[worker()]}
      />,
    );

    await openCardDetails("unwired");
    await click(buttonWithText("Coordinator"));

    expect(buttonWithText("Accept without commit")?.disabled).toBe(true);
    expect(buttonWithText("Accept with commit hash")?.disabled).toBe(true);
    expect(activePanel()?.textContent).toContain(
      "Queue coordinator actions are not wired in this view.",
    );
    await click(buttonWithText("Accept without commit"));
    await click(buttonWithText("Request changes"));

    expect(onSelectedTaskChange).toHaveBeenCalledTimes(1);
  });

  it("calls coordinator action callbacks only after explicit clicks", async () => {
    const actions = {
      onAcceptWithoutCommit: vi.fn(),
      onCreateFollowUp: vi.fn(),
      onFinalize: vi.fn(),
      onMarkBlocked: vi.fn(),
      onMarkNeedsChanges: vi.fn(),
      onMarkRollbackRequired: vi.fn(),
    };
    const actionableTask = task({
      closureState: "commit_created",
      coordinatorStatus: "ready_for_finalization",
      queueItemId: "actionable",
      status: "review_needed",
      title: "Actionable coordinator task",
      validationStatus: "passed",
      workerExecutionReports: [
        report({
          commitHash: "def5678",
          rawReportPreview: coordinatorFinalizationRaw({
            commitHash: "def5678",
            commitTitle: "frontend: finalize queue item",
          }),
          workerId: "queue-coordinator",
        }),
      ],
    });
    const queue = {
      coordinatorFinalization: {
        canAct: true,
        message: null,
        status: "ready_for_finalization",
        ...actions,
      },
      run: { canStart: false, readinessMessage: null, preconditionMessages: [] },
      selectedTask: actionableTask,
      tasks: [actionableTask],
      workerReport: { canAttach: false, message: null, onAttachDemoReport: vi.fn() },
    } as any;

    await render(
      <QueueV2Board queue={queue} tasks={[actionableTask]} workers={[worker()]} />,
    );

    await click(laneToggle("Closed"));
    await openCardDetails("actionable");
    await click(buttonWithText("Coordinator"));

    for (const callback of Object.values(actions)) {
      expect(callback).not.toHaveBeenCalled();
    }

    await click(buttonWithText("Accept with commit hash"));
    await click(buttonWithText("Accept without commit"));
    await click(buttonWithText("Request changes"));
    await click(buttonWithText("Follow-up"));
    await click(buttonWithText("Mark blocked"));
    await click(buttonWithText("Rollback required"));

    expect(actions.onFinalize).toHaveBeenCalledTimes(1);
    expect(actions.onAcceptWithoutCommit).toHaveBeenCalledTimes(1);
    expect(actions.onMarkNeedsChanges).toHaveBeenCalledTimes(1);
    expect(actions.onCreateFollowUp).toHaveBeenCalledTimes(1);
    expect(actions.onMarkBlocked).toHaveBeenCalledTimes(1);
    expect(actions.onMarkRollbackRequired).toHaveBeenCalledTimes(1);
  });
});

async function render(element: ReactNode) {
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  await act(async () => root?.render(element));
}

async function click(element: Element | null) {
  if (!element) {
    throw new Error("Expected element to click.");
  }
  await act(async () => {
    element.dispatchEvent(
      new MouseEvent("click", { bubbles: true, cancelable: true }),
    );
  });
}

function card(taskId: string) {
  return document.querySelector<HTMLElement>(`[data-queue-item-id='${taskId}']`);
}

function cardActionsButton(taskId: string) {
  return card(taskId)?.querySelector<HTMLButtonElement>(
    ".queue-v2-card-details",
  ) ?? null;
}

async function openCardDetails(taskId: string) {
  await click(cardActionsButton(taskId));
  await click(buttonWithText("Open details"));
}

function buttonWithText(text: string): HTMLButtonElement | null {
  return (
    Array.from(document.querySelectorAll<HTMLButtonElement>("button")).find(
      (button) => button.textContent === text,
    ) ?? null
  );
}

function activePanel() {
  return document.querySelector<HTMLElement>("[role='tabpanel']");
}

function laneToggle(label: string): HTMLButtonElement | null {
  return (
    Array.from(
      document.querySelectorAll<HTMLButtonElement>(
        ".queue-v2-collapsible-lane-header",
      ),
    ).find((element) =>
      element.getAttribute("aria-label")?.includes(`${label} lane`),
    ) ?? null
  );
}

function task(overrides: Partial<AgentQueueTask> = {}): AgentQueueTask {
  return {
    approvalPolicy: "never",
    assignedExecutorWidgetId: null,
    assignedWorkerId: null,
    closureState: undefined,
    codexExecutable: "codex",
    context: undefined,
    coordinatorStatus: "not_reported",
    createdAt: "2026-01-01T00:00:00.000Z",
    dependsOn: [],
    description: "Description",
    executionPolicy: "manual",
    executionWorkspace: "C:/work",
    itemType: "implementation",
    orderIndex: 0,
    priority: 1,
    prompt: "Do the work",
    queueItemId: "task",
    queueTagId: "default",
    queueTagName: "Default",
    sandbox: "danger_full_access",
    status: "queued",
    title: "Task",
    updatedAt: "2026-01-01T00:00:00.000Z",
    validationStatus: "not_started",
    workerExecutionReports: [],
    workspaceId: "workspace",
    ...overrides,
  };
}

function worker(overrides: Partial<AgentWorkerSummary> = {}): AgentWorkerSummary {
  return {
    currentItemId: null,
    displayOrder: 0,
    enabled: true,
    lastReportSummary: null,
    name: "Worker",
    scope: { kind: "all" },
    status: "idle",
    workerId: "worker",
    ...overrides,
  };
}

function report(overrides: Partial<AgentQueueWorkerExecutionReport> = {}) {
  return {
    changedFiles: [],
    commandsRun: [],
    createdAt: "2026-01-01T00:00:00.000Z",
    errors: [],
    itemId: "task",
    reportId: "report",
    reportStatus: "completed" as const,
    summary: "Finished",
    validationCommandsSuggested: [],
    warnings: [],
    workerId: "worker",
    ...overrides,
  };
}

function coordinatorFinalizationRaw({
  commitHash,
  commitTitle,
  operatorNote = "Operator accepted the result.",
}: {
  commitHash: string;
  commitTitle: string;
  operatorNote?: string;
}) {
  return [
    "[Coordinator finalization]",
    "report_id: coordinator-report",
    "recorded_at: 2026-01-02T00:00:00.000Z",
    "queue_item_id: finalized-with-commit",
    "decision: accepted_with_commit",
    "queue_status: completed",
    "coordinator_status: finalized",
    "closure_state: commit_created",
    "validation_status: passed",
    `commit_hash: ${commitHash}`,
    `commit_title: ${commitTitle}`,
    "expected_commit_title: frontend: show coordinator state",
    "diff_review_item_id: diff-review-1",
    "diff_review_status: completed",
    "dependency_gate: No dependent Queue items reference this item.",
    `operator_note: ${operatorNote}`,
    "effects: no_run, no_autorun, no_commit, no_push, no_rollback",
    "[/Coordinator finalization]",
  ].join("\n");
}
