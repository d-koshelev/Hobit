import { describe, expect, it, vi } from "vitest";

import type {
  AgentQueueRunnerSnapshot,
  AgentQueueTask,
  AgentQueueTaskRunLinkSummary,
  CreateAgentQueueTaskRequest,
  UpdateAgentQueueTaskRequest,
} from "../../workspace/types";
import {
  createValidationRunner,
  type ValidationCommandExecutor,
  type ValidationExecutorResult,
} from "../validation";
import type {
  ValidationCommandSpec,
  ValidationRunRequest,
} from "../validation";
import {
  createAgentQueueWidgetApi,
} from "./agentQueueWidgetApi";
import {
  attachValidationEvidenceToQueueItem,
  requestValidationForQueueItem,
  summarizeQueueValidationState,
} from "./queueValidationEvidenceService";

describe("queue validation evidence service", () => {
  it("attaches evidence after an explicit validation run", async () => {
    const harness = createQueueApiHarness([queueTask()]);
    const executor = validationExecutor();
    const runner = createValidationRunner({ executor });

    expect(executor.execute).not.toHaveBeenCalled();

    const result = await requestValidationForQueueItem({
      queueApi: harness.api,
      request: validationRunRequest(),
      runner,
    });

    expect(executor.execute).toHaveBeenCalledTimes(1);
    expect(result.started).toBe(true);
    expect(result.attachment.attached).toBe(true);
    expect(result.attachment.state).toBe("passed");
    expect(harness.task("task-1")?.validationStatus).toBe("passed");
    expect(harness.task("task-1")?.workerExecutionReports).toHaveLength(1);
    expect(harness.task("task-1")?.workerExecutionReports?.[0]).toMatchObject({
      itemId: "task-1",
      reportId: "validation-report-validation-run-1",
      validationResult: "passed",
    });
    expect(harness.updateRequests[0]).toMatchObject({
      queueItemId: "task-1",
      validationStatus: "validating",
    });
    expect(harness.updateRequests[1]).toMatchObject({
      queueItemId: "task-1",
      validationStatus: "passed",
    });
  });

  it("failed evidence marks Queue validation failed", async () => {
    const harness = createQueueApiHarness([queueTask()]);
    const runner = createValidationRunner({
      executor: validationExecutor({
        execute: vi.fn(async (): Promise<ValidationExecutorResult> => ({
          status: "completed",
          exitCode: 1,
          stdout: "",
          stderr: "typecheck failed",
        })),
      }),
    });

    const result = await requestValidationForQueueItem({
      queueApi: harness.api,
      request: validationRunRequest(),
      runner,
    });

    expect(result.attachment.state).toBe("failed");
    expect(harness.task("task-1")?.validationStatus).toBe("failed");
    expect(harness.task("task-1")?.workerExecutionReports?.[0]).toMatchObject({
      reportStatus: "failed",
      validationResult: "failed",
    });
  });

  it("passed evidence marks Queue validation passed", async () => {
    const harness = createQueueApiHarness([queueTask()]);
    const runner = createValidationRunner({ executor: validationExecutor() });

    const result = await requestValidationForQueueItem({
      queueApi: harness.api,
      request: validationRunRequest(),
      runner,
    });

    expect(result.attachment.state).toBe("passed");
    expect(result.attachment.summary.state).toBe("passed");
    expect(result.attachment.updateResult?.item?.validationStatus).toBe("passed");
  });

  it("caps evidence summaries and does not store huge logs inline", async () => {
    const hugeLog = `start-${"x".repeat(5_000)}-hidden-tail`;
    const harness = createQueueApiHarness([queueTask()]);
    const runner = createValidationRunner({
      executor: validationExecutor({
        execute: vi.fn(async (): Promise<ValidationExecutorResult> => ({
          status: "completed",
          exitCode: 0,
          stdout: hugeLog,
          stderr: "",
        })),
      }),
    });

    const output = await runner.run(
      validationRunRequest([
        validationCommandSpec({
          stdoutCapBytes: 10_000,
        }),
      ]),
    );
    const result = await attachValidationEvidenceToQueueItem({
      queueApi: harness.api,
      output,
      request: validationRunRequest([
        validationCommandSpec({
          stdoutCapBytes: 10_000,
        }),
      ]),
    });

    const report = harness.task("task-1")?.workerExecutionReports?.[0];

    expect(result.warnings.map((warning) => warning.code)).toContain("summary_capped");
    expect((report?.rawReportPreview ?? "").length).toBeLessThanOrEqual(1_800);
    expect(report?.rawReportPreview).toContain("start-");
    expect(report?.rawReportPreview).not.toContain("hidden-tail");
  });

  it("does not finalize tasks or start dependents when validation passes", async () => {
    const dependency = queueTask({
      queueItemId: "task-1",
      prompt: "Validate foundation task.",
      status: "queued",
    });
    const dependent = queueTask({
      dependsOn: ["task-1"],
      queueItemId: "task-2",
      prompt: "Dependent work must not auto-start.",
      status: "queued",
      title: "Dependent task",
    });
    const harness = createQueueApiHarness([dependency, dependent]);
    const runner = createValidationRunner({ executor: validationExecutor() });

    await requestValidationForQueueItem({
      queueApi: harness.api,
      request: validationRunRequest(),
      runner,
    });

    expect(harness.task("task-1")?.status).toBe("queued");
    expect(harness.task("task-2")?.status).toBe("queued");
    expect(harness.task("task-1")?.coordinatorStatus).toBeUndefined();
    expect(harness.startAssignedAgentQueueTask).not.toHaveBeenCalled();
    expect(harness.updateRequests.every((request) => request.status !== "completed")).toBe(true);
    expect(
      harness.updateRequests.every(
        (request) => !("coordinatorStatus" in request),
      ),
    ).toBe(true);
  });

  it("summarizes stale validation evidence when task changes after evidence capture", () => {
    const summary = summarizeQueueValidationState(
      queueTask({
        updatedAt: "2026-06-10T12:30:00.000Z",
        validationStatus: "passed",
        workerExecutionReports: [
          {
            changedFiles: [],
            commandsRun: ["Typecheck (passed)"],
            createdAt: "2026-06-10T12:00:00.000Z",
            errors: [],
            itemId: "task-1",
            rawReportPreview: "Validation evidence",
            reportId: "validation-report-old",
            reportStatus: "completed",
            summary: "Validation passed before the latest task edit.",
            validationCommandsRun: ["Typecheck (passed)"],
            validationCommandsSuggested: [],
            validationResult: "passed",
            warnings: [],
            workerId: "queue-validation",
          },
        ],
      }),
    );

    expect(summary.state).toBe("stale");
    expect(summary.latestEvidenceAt).toBe("2026-06-10T12:00:00.000Z");
  });

  it("reports a warning instead of fake success when the Queue update path drops evidence fields", async () => {
    const harness = createQueueApiHarness([queueTask()], {
      supportsReportEvidence: false,
    });
    const runner = createValidationRunner({ executor: validationExecutor() });

    const result = await requestValidationForQueueItem({
      queueApi: harness.api,
      request: validationRunRequest(),
      runner,
    });

    expect(result.attachment.updateResult?.ok).toBe(true);
    expect(result.attachment.attached).toBe(false);
    expect(result.attachment.warnings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "queue_evidence_field_unavailable",
        }),
      ]),
    );
    expect(harness.task("task-1")?.workerExecutionReports).toEqual([]);
  });
});

function createQueueApiHarness(
  initialTasks: AgentQueueTask[],
  options: { supportsReportEvidence?: boolean } = {},
) {
  const supportsReportEvidence = options.supportsReportEvidence ?? true;
  const tasks = new Map(initialTasks.map((task) => [task.queueItemId, task]));
  const updateRequests: Array<Omit<UpdateAgentQueueTaskRequest, "workspaceId">> = [];
  const createRequests: Array<Omit<CreateAgentQueueTaskRequest, "workspaceId">> = [];
  const startAssignedAgentQueueTask = vi.fn();
  const api = createAgentQueueWidgetApi({
    createAgentQueueTask: async (request) => {
      createRequests.push(request);
      const task = queueTask({
        ...request,
        queueItemId: `task-${(tasks.size + 1).toString()}`,
      });
      tasks.set(task.queueItemId, task);
      return task;
    },
    getAgentQueueRunnerSnapshot: async () => queueRunnerSnapshot(),
    getAgentQueueTask: async (queueItemId) => tasks.get(queueItemId) ?? null,
    listAgentQueueTaskRunLinks: async () => [],
    listAgentQueueTasks: async () => Array.from(tasks.values()),
    updateAgentQueueTask: async (request) => {
      updateRequests.push(request);
      const task = tasks.get(request.queueItemId);
      if (!task) {
        return null;
      }

      const updated = {
        ...task,
        approvalPolicy: request.approvalPolicy ?? null,
        codexExecutable: request.codexExecutable ?? null,
        dependsOn: request.dependsOn ?? task.dependsOn,
        description: request.description,
        executionPolicy: request.executionPolicy ?? "manual",
        executionWorkspace: request.executionWorkspace ?? null,
        itemType: request.itemType,
        priority: request.priority,
        prompt: request.prompt,
        queueTagId: request.queueTagId,
        queueTagName: request.queueTagName,
        sandbox: request.sandbox ?? null,
        status: request.status,
        title: request.title,
        updatedAt: "2026-06-10T12:01:00.000Z",
        validationStatus: request.validationStatus ?? task.validationStatus,
        workerExecutionReports: supportsReportEvidence
          ? request.workerExecutionReports ?? task.workerExecutionReports ?? []
          : task.workerExecutionReports ?? [],
      } satisfies AgentQueueTask;
      tasks.set(updated.queueItemId, updated);
      return updated;
    },
    workspaceId: "workspace-1",
  });

  return {
    api,
    createRequests,
    startAssignedAgentQueueTask,
    task: (queueItemId: string) => tasks.get(queueItemId),
    updateRequests,
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

function validationRunRequest(
  commands: ValidationCommandSpec[] = [validationCommandSpec()],
): ValidationRunRequest {
  return {
    createdAt: "2026-06-10T12:00:00.000Z",
    queueItemId: "task-1",
    requestedBySurface: "queue",
    runId: "validation-run-1",
    suite: {
      commands,
      id: "queue-validation-suite",
      source: { kind: "manual" },
      stopOnFirstFailure: true,
      title: "Queue validation suite",
    },
    workspaceId: "workspace-1",
  };
}

function validationCommandSpec(
  overrides: Partial<ValidationCommandSpec> = {},
): ValidationCommandSpec {
  return {
    args: ["run", "typecheck", "--prefix", "apps/desktop/frontend"],
    cwd: "C:/repo",
    executable: "npm.cmd",
    id: "typecheck",
    safetyCategory: "build_or_test",
    source: { kind: "manual" },
    stderrCapBytes: 1_000,
    stdoutCapBytes: 1_000,
    title: "Typecheck",
    ...overrides,
  };
}

function queueTask(overrides: Partial<AgentQueueTask> = {}): AgentQueueTask {
  return {
    approvalPolicy: "never",
    assignedExecutorWidgetId: null,
    codexExecutable: "codex.cmd",
    createdAt: "2026-06-10T11:00:00.000Z",
    dependsOn: [],
    description: "Queue task description.",
    executionPolicy: "manual",
    executionWorkspace: "C:/repo",
    priority: 0,
    prompt: "Run validation for this task.",
    queueItemId: "task-1",
    sandbox: "read_only",
    status: "queued",
    title: "Queue task",
    updatedAt: "2026-06-10T11:00:00.000Z",
    validationStatus: "not_started",
    workerExecutionReports: [],
    workspaceId: "workspace-1",
    ...overrides,
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
