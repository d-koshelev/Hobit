import { describe, expect, it, vi } from "vitest";

import type { AgentQueueTask } from "../workspace/types";
import type { AgentQueueController } from "./queue/useAgentQueueController";
import type {
  QueueWidgetActionResult,
  QueueWidgetItemSnapshot,
} from "./queue/agentQueueWidgetApiTypes";
import type { WorkspaceAgentQueueBridge } from "./workspaceAgentQueueBridge";
import {
  createValidationRunner,
  type ValidationCommandExecutor,
  type ValidationExecutorResult,
} from "./validation";
import {
  createWorkspaceChatQueueControlService,
  emptyWorkspaceChatQueueTaskDraft,
} from "./workspaceChatQueueControlService";

describe("workspace chat Queue control service", () => {
  it("maps create_task to the existing Workspace Agent Queue bridge create action", async () => {
    const createItem = vi.fn(async () =>
      itemResult({
        id: "queue-created",
        title: "Typed task",
      }),
    );
    const service = createWorkspaceChatQueueControlService({
      bridge: queueBridge({ createItem }),
    });

    const result = await service.execute({
      draft: {
        ...emptyWorkspaceChatQueueTaskDraft(),
        approvalPolicy: "never",
        codexExecutable: "codex.cmd",
        executionPolicy: "manual",
        executionWorkspace: "C:/repo",
        priority: "3",
        prompt: "Do the typed Queue task.",
        queueTag: "Control",
        sandbox: "danger_full_access",
        status: "queued",
        title: "Typed task",
      },
      kind: "create_task",
    });

    expect(createItem).toHaveBeenCalledWith({
      approvalPolicy: "never",
      codexExecutable: "codex.cmd",
      description: "",
      executionPolicy: "manual",
      executionWorkspace: "C:/repo",
      priority: 3,
      prompt: "Do the typed Queue task.",
      queueTag: { name: "Control" },
      sandbox: "danger_full_access",
      status: "queued",
      title: "Typed task",
    });
    expect(result).toMatchObject({
      action: "create_task",
      queueItemId: "queue-created",
      status: "success",
    });
  });

  it("returns unavailable for validation when no runner is available", async () => {
    const createItem = vi.fn();
    const service = createWorkspaceChatQueueControlService({
      bridge: queueBridge({ createItem }),
    });

    const result = await service.execute({
      kind: "request_validation",
      request: validationRunRequest(),
      queueItemId: "queue-1",
    });

    expect(result).toMatchObject({
      action: "request_validation",
      queueItemId: "queue-1",
      status: "unavailable",
    });
    expect(result.reason).toContain("runner is unavailable");
    expect(createItem).not.toHaveBeenCalled();
  });

  it("runs explicit validation through the Queue evidence service once", async () => {
    const updateItem = vi
      .fn()
      .mockResolvedValueOnce(itemResult({ validationStatus: "validating" }))
      .mockResolvedValueOnce(itemResult({
        reportSummary: {
          status: "report_ready",
          validationSummary: "Validation result: passed.",
        },
        validationStatus: "passed",
      }));
    const executor = validationExecutor();
    const service = createWorkspaceChatQueueControlService({
      bridge: queueBridge({ updateItem }),
      validationRunner: createValidationRunner({ executor }),
    });

    const result = await service.execute({
      kind: "request_validation",
      request: validationRunRequest(),
      queueItemId: "queue-1",
    });

    expect(executor.execute).toHaveBeenCalledTimes(1);
    expect(updateItem).toHaveBeenCalledTimes(2);
    expect(updateItem.mock.calls[0][0].patch.validationStatus).toBe("validating");
    expect(updateItem.mock.calls[1][0].patch.validationStatus).toBe("passed");
    expect(updateItem.mock.calls[1][0].patch.appendWorkerExecutionReport).toBeDefined();
    expect(result).toMatchObject({
      action: "request_validation",
      queueItemId: "queue-1",
      status: "success",
    });
    expect(result.validationResult?.runnerOutput.summary.passedCount).toBe(1);
  });

  it("does not fire actions on service construction", () => {
    const createItem = vi.fn();
    const openTask = vi.fn();
    const runTask = vi.fn();

    createWorkspaceChatQueueControlService({
      bridge: queueBridge({ createItem }),
      onOpenQueueItem: openTask,
      queue: queueController({
        onStartAssignedTask: runTask,
        selectedTask: queueTask({ queueItemId: "queue-1" }),
      }),
    });

    expect(createItem).not.toHaveBeenCalled();
    expect(openTask).not.toHaveBeenCalled();
    expect(runTask).not.toHaveBeenCalled();
  });

  it("create_task does not call Queue run/start actions", async () => {
    const createItem = vi.fn(async () =>
      itemResult({
        id: "queue-created",
        title: "Typed task",
      }),
    );
    const onStartAssignedTask = vi.fn();
    const service = createWorkspaceChatQueueControlService({
      bridge: queueBridge({ createItem }),
      queue: queueController({
        onStartAssignedTask,
        selectedTask: queueTask({ queueItemId: "queue-created" }),
      }),
    });

    await service.execute({
      draft: {
        ...emptyWorkspaceChatQueueTaskDraft(),
        prompt: "Create only.",
        status: "queued",
        title: "Typed task",
      },
      kind: "create_task",
    });

    expect(createItem).toHaveBeenCalledTimes(1);
    expect(onStartAssignedTask).not.toHaveBeenCalled();
  });

  it("promotes a selected draft through the existing Queue draft-promotion callback only after execute", async () => {
    const onPromote = vi.fn();
    const onStartAssignedTask = vi.fn();
    const service = createWorkspaceChatQueueControlService({
      queue: queueController({
        onPromote,
        onStartAssignedTask,
        selectedTask: queueTask({ queueItemId: "queue-draft", status: "draft" }),
      }),
    });

    expect(onPromote).not.toHaveBeenCalled();
    expect(onStartAssignedTask).not.toHaveBeenCalled();

    const result = await service.execute({
      kind: "promote_task",
      queueItemId: "queue-draft",
    });

    expect(onPromote).toHaveBeenCalledTimes(1);
    expect(onStartAssignedTask).not.toHaveBeenCalled();
    expect(result).toMatchObject({
      action: "promote_task",
      queueItemId: "queue-draft",
      status: "success",
    });
    expect(result.message).toContain("No task was started");
  });

  it("does not promote or run non-selected draft Queue tasks", async () => {
    const onPromote = vi.fn();
    const onStartAssignedTask = vi.fn();
    const service = createWorkspaceChatQueueControlService({
      queue: queueController({
        onPromote,
        onStartAssignedTask,
        selectedTask: queueTask({ queueItemId: "queue-draft", status: "draft" }),
      }),
    });

    const result = await service.execute({
      kind: "promote_task",
      queueItemId: "queue-other",
    });

    expect(result).toMatchObject({
      action: "promote_task",
      queueItemId: "queue-other",
      status: "unavailable",
    });
    expect(onPromote).not.toHaveBeenCalled();
    expect(onStartAssignedTask).not.toHaveBeenCalled();
  });

  it("rejects empty create_task title or prompt before calling the bridge", async () => {
    const createItem = vi.fn(async () => itemResult());
    const service = createWorkspaceChatQueueControlService({
      bridge: queueBridge({ createItem }),
    });

    const missingTitle = await service.execute({
      draft: {
        ...emptyWorkspaceChatQueueTaskDraft(),
        prompt: "Create only.",
        title: "",
      },
      kind: "create_task",
    });
    const missingPrompt = await service.execute({
      draft: {
        ...emptyWorkspaceChatQueueTaskDraft(),
        prompt: "   ",
        title: "Typed task",
      },
      kind: "create_task",
    });

    expect(missingTitle).toMatchObject({
      action: "create_task",
      status: "unavailable",
    });
    expect(missingTitle.reason).toContain("title is required");
    expect(missingPrompt).toMatchObject({
      action: "create_task",
      status: "unavailable",
    });
    expect(missingPrompt.reason).toContain("prompt is required");
    expect(createItem).not.toHaveBeenCalled();
  });

  it("maps create errors to visible failed result objects", async () => {
    const createItem = vi.fn(async () => {
      throw new Error("Queue create failed");
    });
    const service = createWorkspaceChatQueueControlService({
      bridge: queueBridge({ createItem }),
    });

    const result = await service.execute({
      draft: {
        ...emptyWorkspaceChatQueueTaskDraft(),
        prompt: "Create should fail.",
        title: "Failed task",
      },
      kind: "create_task",
    });

    expect(result).toEqual({
      action: "create_task",
      message: "Queue create failed",
      reason: "Queue create failed",
      status: "failed",
    });
  });

  it("runs selected tasks only through the existing Queue run callback", async () => {
    const onStartAssignedTask = vi.fn();
    const service = createWorkspaceChatQueueControlService({
      queue: queueController({
        onStartAssignedTask,
        selectedTask: queueTask({ queueItemId: "queue-1" }),
      }),
    });

    const result = await service.execute({
      kind: "run_task",
      queueItemId: "queue-1",
    });

    expect(onStartAssignedTask).toHaveBeenCalledTimes(1);
    expect(result).toMatchObject({
      action: "run_task",
      queueItemId: "queue-1",
      status: "success",
    });
  });

  it("does not run a non-selected Queue task", async () => {
    const onStartAssignedTask = vi.fn();
    const service = createWorkspaceChatQueueControlService({
      queue: queueController({
        onStartAssignedTask,
        selectedTask: queueTask({ queueItemId: "queue-1" }),
      }),
    });

    const result = await service.execute({
      kind: "run_task",
      queueItemId: "queue-2",
    });

    expect(result).toMatchObject({
      action: "run_task",
      queueItemId: "queue-2",
      status: "unavailable",
    });
    expect(onStartAssignedTask).not.toHaveBeenCalled();
  });

  it("creates a Diff Review Queue item explicitly without running or finalizing", async () => {
    const createItem = vi.fn(async (request) =>
      itemResult({
        dependencies: request.dependencies ?? [],
        id: "review-1",
        itemType: request.itemType,
        prompt: request.prompt ?? "",
        title: request.title,
      }),
    );
    const onCreateDiffReview = vi.fn();
    const onRollback = vi.fn();
    const onStartAssignedTask = vi.fn();
    const sourceTask = queueTask({
      queueItemId: "queue-1",
      status: "review_needed",
      title: "Source implementation",
      workerExecutionReports: [workerReport()],
    });
    const service = createWorkspaceChatQueueControlService({
      bridge: queueBridge({ createItem }),
      queue: queueController({
        canAct: true,
        onCreateDiffReview,
        onRollback,
        onStartAssignedTask,
        selectedTask: sourceTask,
        tasks: [sourceTask],
      }),
    });

    const result = await service.execute({
      kind: "create_diff_review",
      queueItemId: "queue-1",
    });

    expect(createItem).toHaveBeenCalledTimes(1);
    expect(createItem.mock.calls[0]?.[0]).toMatchObject({
      dependencies: ["queue-1"],
      executionPolicy: "manual",
      itemType: "diff_review",
      status: "queued",
      title: "Diff Review - Source implementation",
    });
    expect(createItem.mock.calls[0]?.[0].prompt).toContain(
      "Read-only by default.",
    );
    expect(createItem.mock.calls[0]?.[0].prompt).toContain(
      "Expected recommendation format:",
    );
    expect(result).toMatchObject({
      action: "create_diff_review",
      diffReviewCreation: {
        createdReviewTaskId: "review-1",
        createdReviewTaskTitle: "Diff Review - Source implementation",
        sourceTaskId: "queue-1",
      },
      queueItemId: "review-1",
      status: "success",
    });
    expect(result.diffReviewCreation?.warnings.map((warning) => warning.code)).toContain(
      "missing_diff",
    );
    expect(result.message).toContain("It was not run");
    expect(onCreateDiffReview).not.toHaveBeenCalled();
    expect(onStartAssignedTask).not.toHaveBeenCalled();
    expect(onRollback).not.toHaveBeenCalled();
  });

  it("marks rollback required through Workspace Chat Queue control actions", async () => {
    const onRollback = vi.fn();
    const onStartAssignedTask = vi.fn();
    const service = createWorkspaceChatQueueControlService({
      queue: queueController({
        canAct: true,
        onRollback,
        onStartAssignedTask,
        selectedTask: queueTask({ queueItemId: "queue-1" }),
      }),
    });

    const rollbackResult = await service.execute({
      actionType: "mark_rollback_required",
      kind: "coordinator_decision",
      queueItemId: "queue-1",
    });

    expect(rollbackResult).toMatchObject({
      action: "coordinator_decision",
      queueItemId: "queue-1",
      status: "success",
    });
    expect(onRollback).toHaveBeenCalledTimes(1);
    expect(onStartAssignedTask).not.toHaveBeenCalled();
  });
});

function queueBridge(
  overrides: Partial<WorkspaceAgentQueueBridge> = {},
): WorkspaceAgentQueueBridge {
  return {
    createItem: vi.fn(async () => itemResult()),
    getSnapshot: vi.fn(),
    updateItem: vi.fn(),
    ...overrides,
  } as WorkspaceAgentQueueBridge;
}

function queueController({
  canAct = false,
  canStart = true,
  onCreateDiffReview = vi.fn(),
  onPromote = vi.fn(),
  onRollback = vi.fn(),
  onStartAssignedTask = vi.fn(),
  selectedTask,
  tasks,
}: {
  canAct?: boolean;
  canStart?: boolean;
  onCreateDiffReview?: () => void;
  onPromote?: () => void;
  onRollback?: () => void;
  onStartAssignedTask?: () => void;
  selectedTask: AgentQueueTask | null;
  tasks?: AgentQueueTask[];
}): AgentQueueController {
  return {
    coordinatorFinalization: {
      canAct,
      message: null,
      onAcceptWithoutCommit: vi.fn(),
      onCreateFollowUp: vi.fn(),
      onFinalize: vi.fn(),
      onMarkBlocked: vi.fn(),
      onMarkFailedRejected: vi.fn(),
      onMarkFollowUpRequired: vi.fn(),
      onMarkNeedsChanges: vi.fn(),
      onMarkReadyForFinalization: vi.fn(),
      onMarkRollbackRequired: onRollback,
    },
    diffReview: {
      canCreate: false,
      message: null,
      onCreate: onCreateDiffReview,
    },
    draftPromotion: {
      canPromote: selectedTask?.status === "draft",
      isPromoting: false,
      onPromote,
    },
    run: {
      canStart,
      onStartAssignedTask,
      preconditionMessages: [],
      readinessMessage: canStart ? null : "Run is unavailable.",
    },
    selectedTask,
    tasks: tasks ?? (selectedTask ? [selectedTask] : []),
  } as unknown as AgentQueueController;
}

function queueTask(overrides: Partial<AgentQueueTask> = {}): AgentQueueTask {
  return {
    assignedExecutorWidgetId: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    description: "",
    executionPolicy: "manual",
    priority: 0,
    prompt: "Prompt",
    queueItemId: "queue-1",
    status: "queued",
    title: "Queue task",
    updatedAt: "2026-01-01T00:00:00.000Z",
    workspaceId: "workspace-1",
    ...overrides,
  } as AgentQueueTask;
}

function workerReport() {
  return {
    changedFiles: ["src/source.ts"],
    commandsRun: ["npm test"],
    createdAt: "2026-06-10T11:30:00.000Z",
    errors: [],
    itemId: "queue-1",
    rawReportPreview: "Source implementation finished.",
    reportId: "report-1",
    reportStatus: "completed" as const,
    summary: "Source implementation report.",
    validationCommandsRun: ["npm test"],
    validationCommandsSuggested: ["npm test"],
    validationResult: "passed" as const,
    warnings: [],
    workerId: "executor-1",
  };
}

function itemResult(
  overrides: Partial<QueueWidgetItemSnapshot> = {},
): QueueWidgetActionResult<QueueWidgetItemSnapshot> {
  const item: QueueWidgetItemSnapshot = {
    blockers: [],
    dependencies: [],
    description: "",
    evidenceSummary: {
      runRefs: [],
      status: "none",
    },
    executionPolicy: "manual",
    executionStatus: "queued",
    id: "queue-created",
    priority: 0,
    prompt: "Prompt",
    queueId: "queue",
    queueTag: {
      id: null,
      name: null,
    },
    reportSummary: {
      status: "none",
    },
    runLinks: [],
    status: "queued",
    title: "Queue task",
    workspaceId: "workspace-1",
    ...overrides,
  };

  return {
    action: "queue.createItem",
    events: [],
    item,
    message: "Created",
    ok: true,
    safetyClass: "safe_create_update",
  };
}

function validationRunRequest() {
  return {
    createdAt: "2026-06-10T12:00:00.000Z",
    queueItemId: "queue-1",
    requestedBySurface: "workspace_chat" as const,
    runId: "validation-run-1",
    suite: {
      commands: [
        {
          args: ["run", "typecheck", "--prefix", "apps/desktop/frontend"],
          cwd: "C:/repo",
          executable: "npm.cmd",
          id: "typecheck",
          safetyCategory: "build_or_test" as const,
          source: { kind: "manual" as const },
          stderrCapBytes: 1_000,
          stdoutCapBytes: 1_000,
          title: "Typecheck",
        },
      ],
      id: "queue-validation-suite",
      source: { kind: "manual" as const },
      stopOnFirstFailure: true,
      title: "Queue validation suite",
    },
    workspaceId: "workspace-1",
  };
}

function validationExecutor(
  overrides: Partial<ValidationCommandExecutor> = {},
): ValidationCommandExecutor {
  return {
    capabilities: {
      available: true,
      supportsCancellation: false,
      supportsTimeout: true,
    },
    execute: vi.fn(async (): Promise<ValidationExecutorResult> => ({
      durationMs: 32,
      exitCode: 0,
      status: "completed",
      stderr: "",
      stdout: "typecheck ok",
    })),
    ...overrides,
  };
}
