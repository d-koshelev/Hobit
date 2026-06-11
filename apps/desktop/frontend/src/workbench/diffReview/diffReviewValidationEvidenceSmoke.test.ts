import { describe, expect, it, vi } from "vitest";

import type {
  AgentQueueRunnerSnapshot,
  AgentQueueTask,
  AgentQueueTaskRunLinkSummary,
  AgentQueueWorkerExecutionReport,
  CreateAgentQueueTaskRequest,
  UpdateAgentQueueTaskRequest,
} from "../../workspace/types";
import { createWorkspaceAgentQueueBridge } from "../workspaceAgentQueueBridge";
import { materializePromptPackPreviewToQueue } from "../promptPack/promptPackMaterialization";
import { parsePromptPackImportPlan } from "../promptPack/promptPackParser";
import { buildPromptPackImportPreview } from "../promptPack/promptPackImportPreview";
import { selfDevelopmentSmokePromptPackEntries } from "../promptPack/selfDevelopmentSmokePromptPackFixture.test-fixtures";
import { createAgentQueueWidgetApi } from "../queue/agentQueueWidgetApi";
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
    createRequests,
    task: (queueItemId: string) => tasks.get(queueItemId),
    updateRequests,
  };
}

function queueItemIdForTitle(title: string, index: number) {
  if (title.startsWith("001-safe-docs-noop:")) {
    return "queue-001-safe-docs-noop";
  }

  if (title.startsWith("002-dependent-follow-up:")) {
    return "queue-002-dependent-follow-up";
  }

  if (title.startsWith("Diff Review -")) {
    return "queue-diff-review";
  }

  return `queue-${(index + 1).toString()}`;
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
