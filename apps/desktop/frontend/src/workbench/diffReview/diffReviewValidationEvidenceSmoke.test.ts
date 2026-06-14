import { describe, expect, it, vi } from "vitest";

import type {
  AgentQueueRunnerSnapshot,
  AgentQueueTask,
  AgentQueueTaskRunLinkSummary,
  AgentQueueWorkerExecutionReport,
  CreateAgentQueueTaskRequest,
  UpdateAgentQueueTaskRequest,
} from "../../workspace/types";
import { getQueueTaskDependencyState } from "../agentQueueDependencyUi";
import { createWorkspaceAgentQueueBridge } from "../workspaceAgentQueueBridge";
import { materializePromptPackPreviewToQueue } from "../promptPack/promptPackMaterialization";
import {
  buildPromptPackImportPreview,
  PROMPT_PACK_TYPED_FOLDER_SOURCE_ADAPTER,
  promptPackPreviewFromFileEntries,
} from "../promptPack/promptPackImportPreview";
import { parsePromptPackImportPlan } from "../promptPack/promptPackParser";
import {
  realisticDogfoodingSmokePromptPackEntries,
  selfDevelopmentSmokePromptPackEntries,
} from "../promptPack/selfDevelopmentSmokePromptPackFixture.test-fixtures";
import { createAgentQueueWidgetApi } from "../queue/agentQueueWidgetApi";
import { finalizeQueueItemWithCoordinatorDecision } from "../queue/queueCoordinatorFinalizationService";
import { requestValidationForQueueItem } from "../queue/queueValidationEvidenceService";
import {
  createValidationRunner,
  type ValidationCommandExecutor,
  type ValidationExecutorResult,
} from "../validation";
import { buildWorkspaceChatValidationRunRequest } from "../workspaceChatQueueValidation";
import { resolveDiffReviewInputSnapshot } from "./diffReviewInputSnapshotResolver";
import { createDiffReviewQueueItem } from "./diffReviewQueueItemCreation";

describe("validation evidence to Diff Review smoke", () => {
  it("covers realistic prompt-pack import through explicit coordinator finalization without runtime side effects", async () => {
    const harness = createQueueApiHarness();
    const effects = forbiddenEffects();
    const bridge = createWorkspaceAgentQueueBridge({
      autonomousActions: {
        runAutonomousQueue: effects.runAutonomousQueue,
        stopAutonomousQueueAfterCurrent: effects.stopAutonomousQueueAfterCurrent,
      },
      queueApi: harness.api,
      workspaceId: "workspace-1",
    });
    const preview = promptPackPreviewFromFileEntries(
      realisticDogfoodingSmokePromptPackEntries,
    );

    expect(preview).not.toBeNull();
    expect(preview?.sourceAdapter).toEqual(PROMPT_PACK_TYPED_FOLDER_SOURCE_ADAPTER);
    expect(preview?.importAvailable).toBe(true);
    expect(preview?.selectedItems).toHaveLength(2);
    expect(preview?.selectedItemIds).toEqual([
      "001-add-dogfooding-smoke-result-doc",
      "002-record-dependent-gate-result",
    ]);
    expect(preview?.errors).toEqual([]);
    expect(preview?.dependencyGraphSummary).toMatchObject({
      edgeCount: 1,
      hasCycles: false,
      rootItemCount: 1,
      selectedItemCount: 2,
      totalItemCount: 2,
      unresolvedDependencyCount: 0,
    });
    expect(preview?.selectedItems[1]?.dependencies).toEqual([
      "001-add-dogfooding-smoke-result-doc",
    ]);

    const importResult = await materializePromptPackPreviewToQueue({
      bridge,
      confirmed: true,
      currentWorkspaceRoot: "C:/Users/Dmitry/Documents/prj/Hobit_fixed",
      preview: preview!,
    });
    const sourceQueueItemId =
      importResult.createdTasks.find(
        (task) => task.itemId === "001-add-dogfooding-smoke-result-doc",
      )?.queueItemId ?? "";
    const dependentQueueItemId =
      importResult.createdTasks.find(
        (task) => task.itemId === "002-record-dependent-gate-result",
      )?.queueItemId ?? "";

    expect(importResult.ok).toBe(true);
    expect(importResult.createdTasks).toHaveLength(2);
    expect(importResult.dependencyLinksCreated).toEqual([
      {
        dependencyItemId: "001-add-dogfooding-smoke-result-doc",
        dependencyQueueItemId: sourceQueueItemId,
        dependentItemId: "002-record-dependent-gate-result",
        dependentQueueItemId,
        status: "created",
      },
    ]);
    expect(harness.createRequests).toHaveLength(2);
    expect(harness.createRequests.map((request) => request.status)).toEqual([
      "queued",
      "draft",
    ]);
    expect(
      harness.createRequests.map((request) => request.executionPolicy),
    ).toEqual(["manual", "manual"]);
    expect(harness.updateRequests).toEqual([
      expect.objectContaining({
        dependsOn: [sourceQueueItemId],
        queueItemId: dependentQueueItemId,
      }),
    ]);

    let sourceTask = requiredTask(harness, sourceQueueItemId);
    let dependentTask = requiredTask(harness, dependentQueueItemId);
    expect(dependentTask.dependsOn).toEqual([sourceQueueItemId]);
    expect(
      getQueueTaskDependencyState(dependentTask, [sourceTask, dependentTask]),
    ).toMatchObject({
      blockedBy: [
        {
          queueItemId: sourceQueueItemId,
          reason: "not_completed",
        },
      ],
      status: "blocked",
    });

    const prepareResult = await bridge.updateItem({
      itemId: sourceQueueItemId,
      patch: {
        status: "ready",
      },
      reason: "Explicit typed preparation action for task 001.",
    });

    expect(prepareResult.ok).toBe(true);
    sourceTask = requiredTask(harness, sourceQueueItemId);
    dependentTask = requiredTask(harness, dependentQueueItemId);
    expect(sourceTask.status).toBe("ready");
    expect(
      getQueueTaskDependencyState(sourceTask, [sourceTask, dependentTask]).status,
    ).toBe("ready");
    expect(
      getQueueTaskDependencyState(dependentTask, [sourceTask, dependentTask]),
    ).toMatchObject({
      blockedBy: [
        {
          queueItemId: sourceQueueItemId,
          reason: "not_completed",
        },
      ],
      status: "blocked",
    });

    await harness.api.updateItem({
      actor: "test_harness",
      itemId: sourceQueueItemId,
      patch: {
        appendWorkerExecutionReport: implementationReport(sourceQueueItemId),
        status: "review_needed",
      },
      reason: "Mock explicit task 001 run evidence without starting runtime work.",
      workspaceId: "workspace-1",
    });
    sourceTask = requiredTask(harness, sourceQueueItemId);
    dependentTask = requiredTask(harness, dependentQueueItemId);

    const validationExecutor = mockedValidationExecutor();
    const validationResult = await requestValidationForQueueItem({
      queueApi: harness.api,
      request: buildWorkspaceChatValidationRunRequest({
        createdAt: "2026-06-11T11:00:00.000Z",
        runId: "validation-run-realistic-smoke-1",
        task: sourceTask,
      }),
      runner: createValidationRunner({
        executor: validationExecutor,
        now: () => "2026-06-11T11:01:00.000Z",
      }),
    });

    expect(validationExecutor.execute).toHaveBeenCalledTimes(3);
    expect(
      validationExecutor.execute.mock.calls.map((call) => call[0].title),
    ).toEqual([
      "npm.cmd run typecheck --prefix apps/desktop/frontend",
      "git diff --check",
      "git status --short --branch",
    ]);
    expect(validationResult.started).toBe(true);
    expect(validationResult.attachment.attached).toBe(true);
    sourceTask = requiredTask(harness, sourceQueueItemId);
    dependentTask = requiredTask(harness, dependentQueueItemId);
    expect(sourceTask.validationStatus).toBe("passed");
    expect(
      getQueueTaskDependencyState(dependentTask, [sourceTask, dependentTask]),
    ).toMatchObject({
      blockedBy: [
        {
          queueItemId: sourceQueueItemId,
          reason: "not_completed",
        },
      ],
      status: "blocked",
    });

    const diffReviewCreation = await createDiffReviewQueueItem({
      createItem: (request) => bridge.createItem(request),
      now: () => "2026-06-11T11:05:00.000Z",
      sourceTask,
      validationEvidenceSummary: validationResult.runnerOutput.summary,
    });

    expect(diffReviewCreation.status).toBe("created");
    expect(diffReviewCreation.metadata).toMatchObject({
      readonlyByDefault: true,
      reviewType: "diff_review",
      sourceTaskId: sourceQueueItemId,
    });
    expect(diffReviewCreation.prompt).toContain("Read-only by default.");
    expect(diffReviewCreation.prompt).toContain("Do not modify code");
    const diffReviewTask = requiredTask(
      harness,
      diffReviewCreation.createdReviewTaskId!,
    );
    expect(diffReviewTask).toMatchObject({
      dependsOn: [sourceQueueItemId],
      executionPolicy: "manual",
      itemType: "diff_review",
      status: "queued",
    });
    expect(
      getQueueTaskDependencyState(dependentTask, [sourceTask, dependentTask]),
    ).toMatchObject({
      blockedBy: [
        {
          queueItemId: sourceQueueItemId,
          reason: "not_completed",
        },
      ],
      status: "blocked",
    });

    await harness.api.updateItem({
      actor: "test_harness",
      itemId: sourceQueueItemId,
      patch: {
        appendWorkerExecutionReport: diffReviewReport(sourceQueueItemId),
        status: "completed",
      },
      reason: "Attach mocked read-only Diff Review evidence for coordinator review.",
      workspaceId: "workspace-1",
    });
    sourceTask = {
      ...requiredTask(harness, sourceQueueItemId),
      coordinatorStatus: "ready_for_finalization",
    };
    dependentTask = requiredTask(harness, dependentQueueItemId);
    expect(
      getQueueTaskDependencyState(dependentTask, [sourceTask, dependentTask]),
    ).toMatchObject({
      blockedBy: [
        {
          queueItemId: sourceQueueItemId,
          reason: "not_finalized",
        },
      ],
      status: "blocked",
    });

    const finalization = await finalizeQueueItemWithCoordinatorDecision({
      commit: {
        noCommitReason:
          "Service-level smoke used mocked evidence only; no product commit was created.",
      },
      decision: "accepted_without_commit",
      diffReview: {
        itemId: diffReviewTask.queueItemId,
        recommendation: "accept_ready",
        reportId: "diff-review-report-realistic-smoke-1",
        status: "passed",
      },
      evidenceRefs: [
        {
          kind: "validation",
          refId: validationResult.attachment.report.reportId,
          status: "passed",
          summary: validationResult.runnerOutput.summary.summary,
        },
        {
          kind: "diff_review",
          refId: "diff-review-report-realistic-smoke-1",
          status: "passed",
          summary: "Read-only Diff Review fixture accepted the scoped change.",
        },
      ],
      operatorNote: "Explicit coordinator finalization for task 001.",
      queueApi: harness.api,
      queueItemId: sourceQueueItemId,
      task: sourceTask,
      tasks: [sourceTask, dependentTask, diffReviewTask],
      workspaceId: "workspace-1",
      now: () => "2026-06-11T11:10:00.000Z",
    });

    expect(finalization.decisionState).toMatchObject({
      closureState: "no_change_accepted",
      coordinatorStatus: "finalized",
      status: "completed",
      validationStatus: "passed",
    });
    expect(finalization.dependencyGate).toMatchObject({
      sourceItemId: sourceQueueItemId,
      sourceSatisfiesDependency: true,
    });
    expect(finalization.dependencyGate.dependents).toEqual(expect.arrayContaining([
      expect.objectContaining({
        dependentItemId: dependentQueueItemId,
        ready: true,
        summary: "All prerequisites accepted/finalized.",
      }),
      expect.objectContaining({
        dependentItemId: diffReviewTask.queueItemId,
        ready: true,
      }),
    ]));
    const finalizedSourceTask = {
      ...sourceTask,
      ...finalization.localTaskPatch,
      status: finalization.decisionState.status,
    };
    expect(
      getQueueTaskDependencyState(dependentTask, [
        finalizedSourceTask,
        dependentTask,
      ]),
    ).toMatchObject({
      blockedBy: [],
      status: "ready",
    });
    expect(requiredTask(harness, dependentQueueItemId).status).toBe("draft");
    expectNoForbiddenEffects(effects);
    expect(harness.startAssignedQueueTask).not.toHaveBeenCalled();
    expect(harness.commit).not.toHaveBeenCalled();
    expect(harness.push).not.toHaveBeenCalled();
  });

  it("attaches validation evidence to a prompt-pack Queue item and creates an independent read-only Diff Review item", async () => {
    const harness = createQueueApiHarness();
    const runAutonomousQueue = vi.fn();
    const stopAutonomousQueueAfterCurrent = vi.fn();
    const startAssignedQueueTask = vi.fn();
    const finalizeSourceTask = vi.fn();
    const unblockDependentTasks = vi.fn();
    const bridge = createWorkspaceAgentQueueBridge({
      autonomousActions: {
        runAutonomousQueue,
        stopAutonomousQueueAfterCurrent,
      },
      queueApi: harness.api,
      workspaceId: "workspace-1",
    });
    const preview = buildPromptPackImportPreview(
      parsePromptPackImportPlan(selfDevelopmentSmokePromptPackEntries),
    );

    const importResult = await materializePromptPackPreviewToQueue({
      bridge,
      confirmed: true,
      currentWorkspaceRoot: "C:/Users/Dmitry/Documents/prj/Hobit_fixed",
      preview,
    });
    const sourceQueueItemId = importResult.createdTasks[0]?.queueItemId;

    expect(importResult.ok).toBe(true);
    expect(sourceQueueItemId).toBe("queue-001-safe-docs-noop");

    await harness.api.updateItem({
      actor: "test_harness",
      itemId: sourceQueueItemId,
      patch: {
        appendWorkerExecutionReport: implementationReport(sourceQueueItemId),
        status: "review_needed",
      },
      reason: "Mock completed implementation report for smoke coverage.",
      workspaceId: "workspace-1",
    });

    const sourceBeforeValidation = harness.task(sourceQueueItemId);
    expect(sourceBeforeValidation).toBeDefined();
    expect(sourceBeforeValidation?.itemType).toBe("implementation");
    expect(sourceBeforeValidation?.prompt).toContain(
      "Prompt pack materialization metadata",
    );
    expect(sourceBeforeValidation?.prompt).toContain(
      "Expected commit title: docs: smoke no-op readiness note",
    );

    const validationExecutor = mockedValidationExecutor();
    const validationResult = await requestValidationForQueueItem({
      queueApi: harness.api,
      request: buildWorkspaceChatValidationRunRequest({
        createdAt: "2026-06-11T10:15:00.000Z",
        runId: "validation-run-smoke-1",
        task: sourceBeforeValidation!,
      }),
      runner: createValidationRunner({
        executor: validationExecutor,
        now: () => "2026-06-11T10:16:00.000Z",
      }),
    });

    expect(validationExecutor.execute).toHaveBeenCalledTimes(2);
    expect(validationExecutor.execute.mock.calls.map((call) => call[0].title)).toEqual([
      "git status --short --branch",
      "git diff --check",
    ]);
    expect(validationResult.started).toBe(true);
    expect(validationResult.attachment.attached).toBe(true);
    expect(validationResult.attachment.state).toBe("passed");

    const sourceTask = harness.task(sourceQueueItemId);
    expect(sourceTask?.validationStatus).toBe("passed");
    expect(sourceTask?.workerExecutionReports?.map((report) => report.reportId)).toEqual([
      "implementation-report-smoke-1",
      "validation-report-validation-run-smoke-1",
    ]);

    const snapshotResolution = resolveDiffReviewInputSnapshot({
      sourceTask: sourceTask!,
      validationEvidenceSummary: validationResult.runnerOutput.summary,
    });

    expect(snapshotResolution.inputSnapshot.validationEvidenceSummary).toMatchObject({
      commandCount: 2,
      passedCount: 2,
      status: "passed",
    });
    expect(
      snapshotResolution.inputSnapshot.validationEvidenceSummary?.evidenceRefs,
    ).toHaveLength(2);
    expect(snapshotResolution.inputSnapshot.validationResult).toBe("passed");
    expect(snapshotResolution.inputSnapshot.expectedCommitTitle).toBe(
      "docs: smoke no-op readiness note",
    );
    expect(snapshotResolution.inputSnapshot.allowedScope).toEqual([
      "docs/SELF_DEVELOPMENT_READINESS_SMOKE_AUDIT.md",
      "apps/desktop/frontend/src/workbench/promptPack/fixtures/self-development-smoke-prompt-pack/**",
    ]);
    expect(snapshotResolution.inputSnapshot.forbiddenFiles).toContain(
      "apps/desktop/frontend/src/workbench/**/*.ts",
    );
    expect(snapshotResolution.inputSnapshot.actualDiffSummary).toBeNull();
    expect(snapshotResolution.inputSnapshot.unsupportedStates).toContain(
      "diff unavailable, manual diff required",
    );
    expect(snapshotResolution.availability.warnings).toContain(
      "diff unavailable, manual diff required",
    );

    const createDiffReviewItem = vi.fn((request) => bridge.createItem(request));
    const diffReviewCreation = await createDiffReviewQueueItem({
      createItem: createDiffReviewItem,
      now: () => "2026-06-11T10:20:00.000Z",
      sourceTask: sourceTask!,
      validationEvidenceSummary: validationResult.runnerOutput.summary,
    });

    expect(createDiffReviewItem).toHaveBeenCalledTimes(1);
    expect(createDiffReviewItem.mock.calls[0]?.[0]).toMatchObject({
      dependencies: [sourceQueueItemId],
      executionPolicy: "manual",
      itemType: "diff_review",
      status: "queued",
      title: "Diff Review - 001-safe-docs-noop: docs: smoke no-op readiness note",
    });
    expect(createDiffReviewItem.mock.calls[0]?.[0].description).toContain(
      `Source task: ${sourceQueueItemId}`,
    );
    expect(createDiffReviewItem.mock.calls[0]?.[0].prompt).toContain(
      "Read-only by default.",
    );
    expect(createDiffReviewItem.mock.calls[0]?.[0].prompt).toContain(
      "Do not modify code",
    );
    expect(createDiffReviewItem.mock.calls[0]?.[0].prompt).toContain(
      "Source item id: queue-001-safe-docs-noop",
    );
    expect(createDiffReviewItem.mock.calls[0]?.[0].prompt).toContain(
      "Expected commit title: docs: smoke no-op readiness note",
    );
    expect(createDiffReviewItem.mock.calls[0]?.[0].prompt).toContain(
      "diff unavailable, manual diff required",
    );
    expect(diffReviewCreation).toMatchObject({
      metadata: {
        readonlyByDefault: true,
        reviewType: "diff_review",
        sourceTaskId: sourceQueueItemId,
      },
      sourceTaskId: sourceQueueItemId,
      status: "created",
    });
    expect(diffReviewCreation.createdReviewTaskId).toBe("queue-diff-review");
    expect(diffReviewCreation.prompt).toContain("Validation evidence: passed");
    expect(diffReviewCreation.warnings.map((warning) => warning.code)).toEqual([
      "missing_diff",
      "source_link_metadata_unsupported",
    ]);

    const reviewTask = harness.task("queue-diff-review");
    expect(reviewTask).toMatchObject({
      dependsOn: [sourceQueueItemId],
      executionPolicy: "manual",
      itemType: "diff_review",
      status: "queued",
    });

    expect(startAssignedQueueTask).not.toHaveBeenCalled();
    expect(finalizeSourceTask).not.toHaveBeenCalled();
    expect(unblockDependentTasks).not.toHaveBeenCalled();
    expect(runAutonomousQueue).not.toHaveBeenCalled();
    expect(stopAutonomousQueueAfterCurrent).not.toHaveBeenCalled();
  });
});

function createQueueApiHarness() {
  const tasks = new Map<string, AgentQueueTask>();
  const createRequests: Array<Omit<CreateAgentQueueTaskRequest, "workspaceId">> = [];
  const updateRequests: Array<Omit<UpdateAgentQueueTaskRequest, "workspaceId">> = [];
  const commit = vi.fn();
  const push = vi.fn();
  const startAssignedQueueTask = vi.fn();
  const api = createAgentQueueWidgetApi({
    createAgentQueueTask: async (request) => {
      createRequests.push(request);
      const queueItemId = queueItemIdForTitle(request.title, tasks.size);
      const task: AgentQueueTask = {
        ...request,
        assignedExecutorWidgetId: null,
        createdAt: "2026-06-11T10:00:00.000Z",
        queueItemId,
        updatedAt: "2026-06-11T10:00:00.000Z",
        workspaceId: "workspace-1",
      };
      tasks.set(queueItemId, task);
      return task;
    },
    getAgentQueueRunnerSnapshot: async () => queueRunnerSnapshot(),
    getAgentQueueTask: async (queueItemId) => tasks.get(queueItemId) ?? null,
    listAgentQueueTaskRunLinks: async () => [],
    listAgentQueueTasks: async () => Array.from(tasks.values()),
    now: () => "2026-06-11T10:00:00.000Z",
    updateAgentQueueTask: async (request) => {
      updateRequests.push(request);
      const current = tasks.get(request.queueItemId);
      if (!current) {
        return null;
      }

      const updated: AgentQueueTask = {
        ...current,
        ...request,
        assignedExecutorWidgetId: current.assignedExecutorWidgetId,
        createdAt: current.createdAt,
        dependsOn: request.dependsOn ?? current.dependsOn,
        updatedAt: "2026-06-11T10:05:00.000Z",
        workspaceId: current.workspaceId,
      };
      tasks.set(updated.queueItemId, updated);
      return updated;
    },
    workspaceId: "workspace-1",
  });

  return {
    api,
    commit,
    createRequests,
    push,
    startAssignedQueueTask,
    task: (queueItemId: string) => tasks.get(queueItemId),
    updateRequests,
  };
}

function queueItemIdForTitle(title: string, index: number) {
  if (title.startsWith("Diff Review -")) {
    return "queue-diff-review";
  }

  const promptPackItemId = title.split(":")[0]?.trim();
  return promptPackItemId
    ? `queue-${promptPackItemId}`
    : `queue-${(index + 1).toString()}`;
}

function implementationReport(itemId: string): AgentQueueWorkerExecutionReport {
  return {
    changedFiles: [
      "docs/SELF_DEVELOPMENT_READINESS_SMOKE_AUDIT.md",
      "apps/desktop/frontend/src/workbench/promptPack/fixtures/self-development-smoke-prompt-pack/README.md",
    ],
    commandsRun: [],
    commitHash: "abc1234",
    createdAt: "2026-06-11T10:10:00.000Z",
    errors: [],
    finalGitStatus: "not checked in smoke",
    itemId,
    rawReportPreview:
      "Mock implementation completed for self-development readiness smoke.",
    reportId: "implementation-report-smoke-1",
    reportStatus: "completed",
    summary:
      "Mock source implementation report with docs-only fixture scope preserved.",
    validationCommandsSuggested: [
      "git status --short --branch",
      "git diff --check",
    ],
    warnings: [],
    workerId: "mock-executor",
  };
}

function diffReviewReport(itemId: string): AgentQueueWorkerExecutionReport {
  return {
    changedFiles: [],
    commandsRun: [],
    createdAt: "2026-06-11T11:08:00.000Z",
    errors: [],
    finalGitStatus: "read-only diff review fixture",
    itemId,
    rawReportPreview:
      "Mock read-only Diff Review passed. No code changes, finalization, commit, push, or rollback were performed.",
    reportId: "diff-review-report-realistic-smoke-1",
    reportStatus: "completed",
    summary: "Read-only Diff Review fixture accepted the scoped task.",
    validationCommandsRun: [],
    validationCommandsSuggested: [],
    validationResult: "passed",
    warnings: [],
    workerId: "mock-diff-reviewer",
  };
}

function mockedValidationExecutor(): ValidationCommandExecutor & {
  execute: ReturnType<typeof vi.fn>;
} {
  return {
    capabilities: {
      available: true,
      supportsCancellation: false,
      supportsTimeout: true,
    },
    execute: vi.fn(async (): Promise<ValidationExecutorResult> => ({
      durationMs: 12,
      exitCode: 0,
      status: "completed",
      stderr: "",
      stdout: "mock validation passed",
    })),
  };
}

function queueRunnerSnapshot(
  overrides: Partial<AgentQueueRunnerSnapshot> = {},
): AgentQueueRunnerSnapshot {
  return {
    activeQueueItemId: null,
    finalRunStatus: null,
    isActive: false,
    isSessionOnly: true,
    lastReconciledAt: null,
    policy: {
      allowHiddenExecution: false,
      durableResume: false,
      oneTaskAtATime: true,
      requireOperatorStart: true,
      stopOnCancel: true,
      stopOnFailure: true,
      stopOnReviewNeeded: true,
    },
    sessionId: null,
    status: "idle",
    stopReason: null,
    waitingRunId: null,
    ...overrides,
  };
}

function requiredTask(
  harness: ReturnType<typeof createQueueApiHarness>,
  queueItemId: string,
) {
  const task = harness.task(queueItemId);

  expect(task).toBeDefined();

  return task!;
}

function forbiddenEffects() {
  return {
    runAutonomousQueue: vi.fn(async () => ({
      action: "queue.runAutonomousQueue" as const,
      message: "forbidden in smoke",
      ok: false,
      status: "forbidden",
    })),
    stopAutonomousQueueAfterCurrent: vi.fn(async () => ({
      action: "queue.stopAutonomousQueueAfterCurrent" as const,
      message: "forbidden in smoke",
      ok: false,
      status: "forbidden",
    })),
  };
}

function expectNoForbiddenEffects(effects: ReturnType<typeof forbiddenEffects>) {
  expect(effects.runAutonomousQueue).not.toHaveBeenCalled();
  expect(effects.stopAutonomousQueueAfterCurrent).not.toHaveBeenCalled();
}
