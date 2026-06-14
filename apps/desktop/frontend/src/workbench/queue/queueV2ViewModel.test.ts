import { describe, expect, it } from "vitest";

import type {
  AgentQueueTask,
  AgentQueueWorkerExecutionReport,
} from "../../workspace/types";
import type { AgentWorkerSummary } from "../agentQueueTaskUiModel";
import {
  queueV2ClosureStateForTask,
  queueV2LifecycleForTask,
  type QueueTaskLifecycle,
} from "./queueV2LifecycleModel";
import { selectQueueV2ViewModel } from "./queueV2ViewModel";

describe("Queue v2 view model selectors", () => {
  it("maps current statuses into conservative v2 lifecycles and lanes", () => {
    const tasks = [
      task({ queueItemId: "draft", status: "draft" }),
      task({ queueItemId: "queued", status: "queued" }),
      task({ queueItemId: "ready", status: "ready" }),
      task({ queueItemId: "running", status: "running" }),
      task({ queueItemId: "completed", status: "completed" }),
      task({ queueItemId: "review", status: "review_needed" }),
      task({ queueItemId: "failed", status: "failed" }),
      task({ queueItemId: "cancelled", status: "cancelled" }),
    ];
    const viewModel = selectQueueV2ViewModel({
      tasks,
      workers: [worker()],
    });

    expect(lifecycleMap(viewModel.tasks)).toEqual({
      cancelled: "cancelled",
      completed: "report_ready",
      draft: "draft",
      failed: "failed",
      queued: "queued",
      ready: "ready",
      review: "review_required",
      running: "running",
    } satisfies Record<string, QueueTaskLifecycle>);
    expect(viewModel.lanes.intake_draft.map((item) => item.taskId)).toEqual([
      "draft",
    ]);
    expect(viewModel.lanes.ready.map((item) => item.taskId)).toEqual([
      "queued",
      "ready",
    ]);
    expect(viewModel.lanes.running.map((item) => item.taskId)).toEqual([
      "running",
    ]);
    expect(viewModel.lanes.review.map((item) => item.taskId)).toEqual([
      "completed",
      "review",
    ]);
    expect(viewModel.lanes.closed.map((item) => item.taskId)).toEqual([
      "cancelled",
    ]);
    expect(viewModel.lanes.blocked.map((item) => item.taskId)).toEqual([
      "failed",
    ]);
  });

  it("keeps report-ready output out of finalized without explicit closure", () => {
    const completedTask = task({
      queueItemId: "done",
      status: "completed",
      workerExecutionReports: [report()],
    });

    expect(queueV2LifecycleForTask(completedTask)).toBe("report_ready");
    expect(
      queueV2LifecycleForTask({
        ...completedTask,
        closureState: "no_change_accepted",
      }),
    ).toBe("finalized");
  });

  it("keeps needs-changes in review without deriving request-changes closure", () => {
    const needsChangesTask = task({
      coordinatorStatus: "needs_changes",
      queueItemId: "needs-changes",
      status: "completed",
      workerExecutionReports: [report()],
    });
    const viewModel = selectQueueV2ViewModel({
      tasks: [needsChangesTask],
      workers: [worker()],
    });
    const item = viewModel.tasks[0];

    expect(queueV2ClosureStateForTask(needsChangesTask)).toBeNull();
    expect(item).toMatchObject({
      boardLane: "review",
      closureState: null,
      lifecycle: "review_required",
      nextAction: "request_changes",
    });
    expect(viewModel.lanes.closed).toEqual([]);
  });

  it("keeps failed tasks out of rejected closure", () => {
    const failedTask = task({
      coordinatorStatus: "failed",
      queueItemId: "failed-task",
      status: "failed",
    });
    const viewModel = selectQueueV2ViewModel({
      tasks: [failedTask],
      workers: [worker()],
    });
    const item = viewModel.tasks[0];

    expect(queueV2ClosureStateForTask(failedTask)).toBeNull();
    expect(item).toMatchObject({
      boardLane: "blocked",
      closureState: null,
      lifecycle: "failed",
      nextAction: "retry_or_rerun",
    });
    expect(viewModel.lanes.closed).toEqual([]);
  });

  it("keeps closure-blocked tasks reviewable instead of finalized", () => {
    const closureBlockedTask = task({
      closureState: "closure_blocked",
      coordinatorStatus: "blocked",
      queueItemId: "closure-blocked",
      status: "completed",
      workerExecutionReports: [report()],
    });
    const viewModel = selectQueueV2ViewModel({
      tasks: [closureBlockedTask],
      workers: [worker()],
    });
    const item = viewModel.tasks[0];

    expect(item).toMatchObject({
      boardLane: "review",
      closureState: "closure_blocked",
      lifecycle: "review_required",
    });
    expect(viewModel.lanes.closed).toEqual([]);
  });

  it("keeps completed and report-ready tasks in review lane until closure", () => {
    const viewModel = selectQueueV2ViewModel({
      tasks: [
        task({ queueItemId: "completed", status: "completed" }),
        task({
          queueItemId: "reported",
          status: "queued",
          workerExecutionReports: [report()],
        }),
      ],
      workers: [worker()],
    });

    expect(viewModel.tasks.map((item) => [item.taskId, item.lifecycle])).toEqual([
      ["completed", "report_ready"],
      ["reported", "report_ready"],
    ]);
    expect(viewModel.lanes.review.map((item) => item.taskId)).toEqual([
      "completed",
      "reported",
    ]);
    expect(viewModel.lanes.closed).toEqual([]);
  });

  it("finalizes only with an explicit persisted closure outcome", () => {
    const finalizedWithoutClosure = task({
      coordinatorStatus: "finalized",
      queueItemId: "status-only",
      status: "completed",
      workerExecutionReports: [report()],
    });
    const finalizedWithClosure = task({
      closureState: "no_change_accepted",
      coordinatorStatus: "finalized",
      queueItemId: "explicit",
      status: "completed",
      workerExecutionReports: [report()],
    });
    const viewModel = selectQueueV2ViewModel({
      tasks: [finalizedWithoutClosure, finalizedWithClosure],
      workers: [worker()],
    });

    expect(viewModel.tasks.map((item) => [item.taskId, item.lifecycle])).toEqual([
      ["status-only", "report_ready"],
      ["explicit", "finalized"],
    ]);
    expect(viewModel.tasks.map((item) => [item.taskId, item.closureState])).toEqual([
      ["status-only", null],
      ["explicit", "no_change_accepted"],
    ]);
    expect(viewModel.lanes.review.map((item) => item.taskId)).toEqual([
      "status-only",
    ]);
    expect(viewModel.lanes.closed.map((item) => item.taskId)).toEqual([
      "explicit",
    ]);
  });

  it("derives blocked reasons from dependencies and paused tags", () => {
    const dependency = task({
      queueItemId: "dependency",
      status: "queued",
      title: "Dependency task",
    });
    const dependent = task({
      dependsOn: ["dependency"],
      queueItemId: "dependent",
      queueTagId: "tag-a",
      queueTagName: "Tag A",
      status: "ready",
    });
    const viewModel = selectQueueV2ViewModel({
      pausedQueueTagIds: new Set(["tag-a"]),
      tasks: [dependency, dependent],
      workers: [worker({ scope: { kind: "queue_tag", queueTagId: "tag-a", queueTagName: "Tag A" } })],
    });
    const dependentView = viewModel.tasks.find(
      (item) => item.taskId === "dependent",
    );

    expect(dependentView?.boardLane).toBe("blocked");
    expect(dependentView?.blockedReasons.map((reason) => reason.code)).toEqual([
      "tag_paused",
    ]);
  });

  it("derives a first-class blocker summary in priority order", () => {
    const prerequisite = task({
      queueItemId: "001",
      status: "queued",
      title: "001 Setup",
    });
    const blockedTask = task({
      dependsOn: ["001"],
      executionWorkspace: "",
      queueItemId: "002",
      status: "ready",
      title: "002 Implementation",
      validationStatus: "failed",
    });
    const viewModel = selectQueueV2ViewModel({
      globalExecutionState: "stopped",
      selectedTaskId: "002",
      tasks: [prerequisite, blockedTask],
      workers: [worker()],
    });
    const blocked = viewModel.tasks.find((item) => item.taskId === "002");

    expect(blocked?.blockedReasons.map((reason) => reason.code)).toEqual([
      "missing_execution_workspace",
      "queue_disabled",
      "validation_failed",
    ]);
    expect(blocked?.blockerSummary).toMatchObject({
      category: "workspace",
      kind: "missing_execution_workspace",
      nextAction: "Set task workspace",
      primaryReason: "Missing execution workspace",
      secondaryReasons: ["Queue disabled", "Validation failed"],
    });
    expect(blocked?.dependencySummary).toMatchObject({
      gate: "waiting",
      message: "Waiting for: Task 001",
    });
    expect(viewModel.inspector?.blockerSummary.primaryReason).toBe(
      "Missing execution workspace",
    );
    expect(viewModel.inspector?.eligibility).toMatchObject({
      dependencyOk: false,
      eligibleNow: false,
      queueEnabled: false,
      runSettingsOk: false,
      safetyOk: false,
    });
  });

  it("does not treat validation not requested as a QueueV2 blocker", () => {
    const viewModel = selectQueueV2ViewModel({
      tasks: [
        task({
          queueItemId: "ready",
          status: "ready",
          validationStatus: "not_started",
        }),
      ],
      workers: [worker()],
    });
    const ready = viewModel.tasks.find((item) => item.taskId === "ready");

    expect(ready?.blockedReasons.map((reason) => reason.code)).not.toContain(
      "validation_failed",
    );
    expect(ready?.boardLane).toBe("ready");
    expect(ready?.eligibility.eligibleNow).toBe(true);
  });

  it("treats missing Codex executable as a visible run-settings blocker", () => {
    const viewModel = selectQueueV2ViewModel({
      globalExecutionState: "stopped",
      selectedTaskId: "missing-codex",
      tasks: [
        task({
          codexExecutable: "",
          queueItemId: "missing-codex",
          status: "ready",
        }),
      ],
      workers: [worker()],
    });
    const blocked = viewModel.tasks.find(
      (item) => item.taskId === "missing-codex",
    );

    expect(blocked?.blockedReasons.map((reason) => reason.code)).toEqual([
      "missing_codex_executable",
      "queue_disabled",
    ]);
    expect(blocked?.blockerSummary).toMatchObject({
      kind: "missing_codex_executable",
      nextAction: "Set Codex executable",
      primaryReason: "Missing Codex executable",
      secondaryReasons: ["Queue disabled"],
    });
    expect(viewModel.inspector?.eligibility).toMatchObject({
      eligibleNow: false,
      queueEnabled: false,
      runSettingsOk: false,
    });
  });

  it("keeps imported dependents waiting until prerequisite coordinator finalization", () => {
    const prerequisiteWithValidation = task({
      coordinatorStatus: "ready_for_finalization",
      queueItemId: "queue-001",
      status: "completed",
      title: "001 Prerequisite",
      validationStatus: "passed",
      workerExecutionReports: [
        report({
          reportId: "validation-report-001",
          summary: "Validation passed for prerequisite.",
          validationResult: "passed",
        }),
        report({
          reportId: "diff-review-report-001",
          summary: "Diff Review passed for prerequisite.",
          validationResult: "passed",
        }),
      ],
    });
    const dependent = task({
      dependsOn: ["queue-001"],
      executionPolicy: "auto",
      queueItemId: "queue-002",
      status: "ready",
      title: "002 Dependent",
    });
    const blocked = selectQueueV2ViewModel({
      tasks: [prerequisiteWithValidation, dependent],
      workers: [worker()],
    });
    const blockedDependent = blocked.tasks.find(
      (item) => item.taskId === "queue-002",
    );

    expect(blockedDependent).toMatchObject({
      boardLane: "waiting_dependency",
      humanStatus: {
        status: "waiting_dependency",
        text: "Waiting for: Task 001",
      },
      nextAction: "resolve_dependency",
    });
    expect(blockedDependent?.eligibility).toMatchObject({
      dependencyOk: false,
      eligibleNow: false,
    });
    expect(blockedDependent?.blockedReasons.map((reason) => reason.code)).not.toContain(
      "dependency_open",
    );
    expect(blocked.lanes.ready.map((item) => item.taskId)).not.toContain(
      "queue-002",
    );
    expect(blocked.lanes.waiting_dependency.map((item) => item.taskId)).toContain(
      "queue-002",
    );

    const finalized = selectQueueV2ViewModel({
      tasks: [
        {
          ...prerequisiteWithValidation,
          closureState: "no_change_accepted",
          coordinatorStatus: "finalized",
          status: "completed",
        },
        dependent,
      ],
      workers: [worker()],
    });
    const readyDependent = finalized.tasks.find(
      (item) => item.taskId === "queue-002",
    );

    expect(readyDependent).toMatchObject({
      boardLane: "ready",
      nextAction: "run_now",
    });
    expect(readyDependent?.eligibility).toMatchObject({
      dependencyOk: true,
      eligibleNow: true,
    });
    expect(finalized.lanes.ready.map((item) => item.taskId)).toContain(
      "queue-002",
    );
  });

  it("derives next actions from eligibility and blockers", () => {
    const viewModel = selectQueueV2ViewModel({
      tasks: [
        task({ queueItemId: "draft", status: "draft" }),
        task({ queueItemId: "ready", status: "ready" }),
        task({ queueItemId: "no-capacity", status: "ready" }),
        task({ queueItemId: "review", status: "completed" }),
      ],
      workers: [worker({ currentItemId: null, status: "idle" })],
    });

    expect(actionFor(viewModel, "draft")).toBe("edit_draft");
    expect(actionFor(viewModel, "ready")).toBe("run_now");
    expect(actionFor(viewModel, "review")).toBe("review_report");

    const noCapacity = selectQueueV2ViewModel({
      tasks: [task({ queueItemId: "no-capacity", status: "ready" })],
      workers: [worker({ status: "running" })],
    });

    expect(actionFor(noCapacity, "no-capacity")).toBe("assign_worker");
  });

  it("derives prepare action for imported prompt-pack drafts while blocking dependents", () => {
    const importedFirst = task({
      description: [
        "Prompt pack: Self Development (self-development)",
        "Prompt item: 001",
      ].join("\n"),
      prompt: promptPackPrompt({
        blockId: "001",
        validationCommand: "npm.cmd run typecheck --prefix apps/desktop/frontend",
      }),
      queueItemId: "queue-001",
      status: "draft",
      title: "001: Imported first task",
    });
    const importedSecond = task({
      dependsOn: ["queue-001"],
      description: [
        "Prompt pack: Self Development (self-development)",
        "Prompt item: 002",
      ].join("\n"),
      prompt: promptPackPrompt({
        blockId: "002",
        dependency: "001",
        validationCommand: "npm.cmd run typecheck --prefix apps/desktop/frontend",
      }),
      queueItemId: "queue-002",
      status: "draft",
      title: "002: Imported dependent task",
    });
    const ordinaryDraft = task({
      queueItemId: "ordinary-draft",
      status: "draft",
      title: "Ordinary draft",
    });
    const viewModel = selectQueueV2ViewModel({
      tasks: [importedFirst, importedSecond, ordinaryDraft],
      workers: [worker()],
    });

    expect(actionFor(viewModel, "queue-001")).toBe("queue_task");
    expect(actionFor(viewModel, "ordinary-draft")).toBe("edit_draft");

    const dependent = viewModel.tasks.find((item) => item.taskId === "queue-002");
    expect(dependent).toMatchObject({
      boardLane: "waiting_dependency",
      nextAction: "resolve_dependency",
    });
    expect(dependent?.eligibility).toMatchObject({
      dependencyOk: false,
      eligibleNow: false,
    });
    expect(dependent?.blockedReasons.map((reason) => reason.code)).not.toContain(
      "dependency_open",
    );
  });

  it("derives counts, capacity, and selected-task inspector snapshot", () => {
    const tasks = [
      task({ queueItemId: "ready", status: "ready" }),
      task({ queueItemId: "running", status: "running" }),
      task({ queueItemId: "report", status: "completed" }),
    ];
    const viewModel = selectQueueV2ViewModel({
      selectedTaskId: "ready",
      tasks,
      workers: [
        worker({ workerId: "idle-worker" }),
        worker({
          currentItemId: "running",
          status: "running",
          workerId: "busy-worker",
        }),
      ],
    });

    expect(viewModel.counts).toEqual({
      eligibleNow: 1,
      reviewNeeded: 1,
      running: 1,
    });
    expect(viewModel.capacity).toMatchObject({
      availableSlots: 1,
      runningSlots: 1,
      totalSlots: 2,
    });
    expect(viewModel.inspector).toMatchObject({
      boardLane: "ready",
      lifecycle: "ready",
      nextAction: "run_now",
      taskId: "ready",
    });
  });

  it("does not mutate input task array or task order", () => {
    const tasks = [
      task({ queueItemId: "b", priority: 1 }),
      task({ queueItemId: "a", priority: 5 }),
    ];
    const originalOrder = tasks.map((item) => item.queueItemId);
    const originalTasksJson = JSON.stringify(tasks);
    const viewModel = selectQueueV2ViewModel({
      tasks,
      workers: [worker()],
    });

    expect(tasks.map((item) => item.queueItemId)).toEqual(originalOrder);
    expect(JSON.stringify(tasks)).toBe(originalTasksJson);
    expect(viewModel.tasks.map((item) => item.taskId)).toEqual(originalOrder);
  });
});

function lifecycleMap(items: ReturnType<typeof selectQueueV2ViewModel>["tasks"]) {
  return Object.fromEntries(
    items.map((item) => [item.taskId, item.lifecycle]),
  );
}

function actionFor(
  viewModel: ReturnType<typeof selectQueueV2ViewModel>,
  taskId: string,
) {
  return viewModel.tasks.find((item) => item.taskId === taskId)?.nextAction;
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
    ...baseReport(),
    ...overrides,
  };
}

function baseReport(): AgentQueueWorkerExecutionReport {
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
  };
}

function promptPackPrompt({
  blockId,
  dependency,
  validationCommand,
}: {
  blockId: string;
  dependency?: string;
  validationCommand: string;
}) {
  return [
    `Imported prompt body for ${blockId}.`,
    "",
    "Prompt pack materialization metadata",
    "Pack: Self Development (self-development)",
    `Block id: ${blockId}`,
    dependency ? `Prompt-pack dependencies: ${dependency}` : null,
    "Validation commands",
    `- ${validationCommand}`,
    "Imported Queue items must not auto-run.",
  ]
    .filter((line): line is string => line !== null)
    .join("\n");
}
