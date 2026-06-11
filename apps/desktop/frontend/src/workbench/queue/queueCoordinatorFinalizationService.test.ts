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
import { validateCoordinatorDecisionRequest } from "../coordinator";
import { createAgentQueueWidgetApi } from "./agentQueueWidgetApi";
import {
  createCoordinatorFollowUp,
  finalizeQueueItemWithCoordinatorDecision,
  markQueueItemRollbackRequired,
  recomputeDependentReadinessAfterFinalization,
  requestQueueItemChanges,
} from "./queueCoordinatorFinalizationService";

describe("queue coordinator finalization service", () => {
  it("accept_with_commit stores commit info without mutating Git", async () => {
    const effects = forbiddenEffects();
    const source = queueTask({
      queueItemId: "task-1",
      status: "review_needed",
      validationStatus: "passed",
      workerExecutionReports: [
        workerReport({
          changedFiles: ["apps/desktop/frontend/src/workbench/Queue.tsx"],
          reportId: "worker-report-1",
        }),
      ],
    });
    const harness = createQueueApiHarness([source]);

    const result = await finalizeQueueItemWithCoordinatorDecision({
      commit: {
        commitHash: "abc123def456",
        commitTitle: "frontend: add queue finalization",
        expectedCommitTitle: "frontend: add queue finalization",
        verificationStatus: "unverified",
      },
      decision: "accepted_with_commit",
      evidenceRefs: [
        { kind: "validation", refId: "validation-report-1", status: "passed" },
      ],
      operatorNote: "Reviewed locally.",
      queueApi: harness.api,
      queueItemId: "task-1",
      task: source,
      tasks: [source],
      workspaceId: "workspace-1",
      now: fixedNow,
    });

    const updated = harness.task("task-1");
    const reports = updated?.workerExecutionReports ?? [];
    const report = reports[reports.length - 1];

    expect(result.decisionState).toMatchObject({
      closureState: "commit_created",
      coordinatorStatus: "finalized",
      status: "completed",
    });
    expect(updated?.status).toBe("completed");
    expect(updated?.validationStatus).toBe("passed");
    expect(report?.commitHash).toBe("abc123def456");
    expect(report?.rawReportPreview).toContain("commit_title: frontend: add queue finalization");
    expect(report?.rawReportPreview).toContain("expected_commit_title: frontend: add queue finalization");
    expect(report?.rawReportPreview).toContain("effects: no_run, no_autorun, no_commit, no_push, no_rollback");
    expect(updated?.description).toContain("[Coordinator finalization]");
    expect(result.warnings.map((warning) => warning.code)).toContain(
      "commit_hash_unverified",
    );
    expectNoForbiddenEffects(effects);
  });

  it("accept_without_commit stores explicit reason", async () => {
    const source = queueTask({
      queueItemId: "task-1",
      status: "review_needed",
      workerExecutionReports: [workerReport({ changedFiles: [] })],
    });
    const harness = createQueueApiHarness([source]);

    await finalizeQueueItemWithCoordinatorDecision({
      commit: {
        noCommitReason: "Documentation-only review found no code changes.",
      },
      decision: "accepted_without_commit",
      queueApi: harness.api,
      queueItemId: "task-1",
      task: source,
      tasks: [source],
      workspaceId: "workspace-1",
      now: fixedNow,
    });

    const reports = harness.task("task-1")?.workerExecutionReports ?? [];
    const report = reports[reports.length - 1];

    expect(harness.task("task-1")?.status).toBe("completed");
    expect(report?.commitHash).toBeUndefined();
    expect(report?.summary).toContain("Accepted without commit");
    expect(report?.rawReportPreview).toContain(
      "no_commit_reason: Documentation-only review found no code changes.",
    );
  });

  it("request_changes does not unblock dependents", async () => {
    const source = queueTask({
      queueItemId: "task-1",
      status: "completed",
      title: "Prerequisite",
    });
    const dependent = queueTask({
      dependsOn: ["task-1"],
      queueItemId: "task-2",
      status: "ready",
      title: "Dependent",
    });
    const harness = createQueueApiHarness([source, dependent]);

    const result = await requestQueueItemChanges({
      operatorNote: "Scope mismatch.",
      queueApi: harness.api,
      queueItemId: "task-1",
      task: source,
      tasks: [source, dependent],
      workspaceId: "workspace-1",
      now: fixedNow,
    });

    expect(result.decisionState.coordinatorStatus).toBe("needs_changes");
    expect(result.dependencyGate.dependents[0]).toMatchObject({
      dependentItemId: "task-2",
      ready: false,
    });
    expect(result.dependencyGate.dependents[0]?.blockedBy[0]?.reason).toBe(
      "not_completed",
    );
    expect(harness.startAssignedAgentQueueTask).not.toHaveBeenCalled();
    expect(harness.autorunStart).not.toHaveBeenCalled();
  });

  it("rollback_required blocks dependents", async () => {
    const source = queueTask({
      queueItemId: "task-1",
      status: "completed",
      title: "Prerequisite",
    });
    const dependent = queueTask({
      dependsOn: ["task-1"],
      queueItemId: "task-2",
      status: "ready",
      title: "Dependent",
    });
    const harness = createQueueApiHarness([source, dependent]);

    const result = await markQueueItemRollbackRequired({
      operatorNote: "Regression found in review.",
      queueApi: harness.api,
      queueItemId: "task-1",
      task: source,
      tasks: [source, dependent],
      workspaceId: "workspace-1",
      now: fixedNow,
    });

    expect(result.decisionState.coordinatorStatus).toBe("rollback_required");
    expect(result.dependencyGate.sourceSatisfiesDependency).toBe(false);
    expect(result.dependencyGate.dependents[0]?.ready).toBe(false);
    expect(result.report.rawReportPreview).toContain(
      "effects: no_run, no_autorun, no_commit, no_push, no_rollback",
    );
  });

  it("requires all prerequisites finalized for dependent readiness", () => {
    const first = queueTask({
      coordinatorStatus: "finalized",
      queueItemId: "task-1",
      status: "completed",
      title: "Accepted prerequisite",
    });
    const second = queueTask({
      coordinatorStatus: "needs_changes",
      queueItemId: "task-2",
      status: "completed",
      title: "Unaccepted prerequisite",
    });
    const dependent = queueTask({
      dependsOn: ["task-1", "task-2"],
      queueItemId: "task-3",
      status: "ready",
      title: "Dependent",
    });

    const blocked = recomputeDependentReadinessAfterFinalization({
      finalizedTask: first,
      tasks: [first, second, dependent],
    });

    expect(blocked.dependents[0]).toMatchObject({
      dependentItemId: "task-3",
      ready: false,
    });
    expect(blocked.dependents[0]?.blockedBy).toEqual([
      {
        queueItemId: "task-2",
        reason: "not_finalized",
        title: "Unaccepted prerequisite",
      },
    ]);

    const acceptedSecond = {
      ...second,
      coordinatorStatus: "finalized" as const,
      status: "completed" as const,
    };
    const ready = recomputeDependentReadinessAfterFinalization({
      finalizedTask: acceptedSecond,
      tasks: [first, acceptedSecond, dependent],
    });

    expect(ready.dependents[0]).toMatchObject({
      dependentItemId: "task-3",
      ready: true,
    });
  });

  it("smokes coordinator finalization as the dependency readiness gate", async () => {
    const effects = forbiddenEffects();
    const validationEvidence = {
      kind: "validation" as const,
      refId: "validation-report-task-001",
      status: "passed",
      summary: "typecheck and focused coordinator tests passed",
    };
    const diffReview = {
      itemId: "diff-review-task-001",
      recommendation: "accept_ready",
      reportId: "diff-report-task-001",
      status: "passed",
    };
    const sourceWithValidationOnly = task001({
      status: "completed",
      validationStatus: "passed",
      workerExecutionReports: [
        workerReport({
          reportId: "validation-report-task-001",
          summary: "Validation evidence passed for task 001.",
          validationCommandsRun: [
            "npm.cmd run typecheck --prefix apps/desktop/frontend",
          ],
          validationResult: "passed",
        }),
      ],
    });
    const dependent = task002();

    expect(
      getQueueTaskDependencyState(dependent, [
        sourceWithValidationOnly,
        dependent,
      ]),
    ).toMatchObject({
      blockedBy: [
        {
          queueItemId: "task-001",
          reason: "not_finalized",
          title: "001 Coordinator finalization source",
        },
      ],
      status: "blocked",
    });

    const sourceWithDiffReady = task001({
      ...sourceWithValidationOnly,
      coordinatorStatus: "ready_for_finalization",
      workerExecutionReports: [
        ...(sourceWithValidationOnly.workerExecutionReports ?? []),
        workerReport({
          changedFiles: [
            "apps/desktop/frontend/src/workbench/queue/queueCoordinatorFinalizationService.test.ts",
          ],
          finalGitStatus: "diff_review_passed",
          reportId: "diff-report-task-001",
          summary: "Diff Review ready/passed for task 001.",
          validationResult: "passed",
        }),
      ],
    });

    expect(
      getQueueTaskDependencyState(dependent, [sourceWithDiffReady, dependent]),
    ).toMatchObject({
      blockedBy: [
        {
          queueItemId: "task-001",
          reason: "not_finalized",
        },
      ],
      status: "blocked",
    });

    const requestChangesHarness = createQueueApiHarness([
      sourceWithDiffReady,
      dependent,
    ]);
    const requestChanges = await requestQueueItemChanges({
      diffReview,
      evidenceRefs: [validationEvidence],
      operatorNote: "Diff Review requested changes.",
      queueApi: requestChangesHarness.api,
      queueItemId: "task-001",
      task: sourceWithDiffReady,
      tasks: [sourceWithDiffReady, dependent],
      workspaceId: "workspace-1",
      now: fixedNow,
    });

    expect(requestChanges.decisionState.coordinatorStatus).toBe("needs_changes");
    expect(requestChanges.dependencyGate.dependents[0]).toMatchObject({
      dependentItemId: "task-002",
      ready: false,
    });
    expect(requestChanges.message).toContain("no dependent task was started");

    const invalidCommitDecision = validateCoordinatorDecisionRequest({
      ...coordinatorDecisionRequest("accept_with_commit"),
      commit: {
        hash: "not-a-sha",
        title: "frontend: add coordinator finalization smoke",
      },
    });

    expect(invalidCommitDecision.ok).toBe(false);
    expect(invalidCommitDecision.nextAction).toBe("resolve_commit");
    expect(invalidCommitDecision.errors.map((item) => item.message)).toContain(
      "Accept with commit requires a valid commit hash.",
    );

    const genericTitleDecision = validateCoordinatorDecisionRequest({
      ...coordinatorDecisionRequest("accept_with_commit"),
      commit: {
        hash: "abc1234",
        title: "fix",
      },
    });

    expect(genericTitleDecision.ok).toBe(false);
    expect(genericTitleDecision.commitValidation.titleStatus).toBe("generic");
    expect(genericTitleDecision.errors.map((item) => item.message)).toContain(
      "Generic commit titles are not valid coordinator evidence.",
    );

    const noCommitDecision = validateCoordinatorDecisionRequest(
      coordinatorDecisionRequest("accept_without_commit"),
    );
    expect(noCommitDecision.ok).toBe(true);
    expect(noCommitDecision.shouldUnblockDependents).toBe(true);

    const noCommitHarness = createQueueApiHarness([sourceWithDiffReady, dependent]);
    const noCommitResult = await finalizeQueueItemWithCoordinatorDecision({
      commit: {
        noCommitReason: "Smoke task produced review evidence only; no file commit required.",
      },
      decision: "accepted_without_commit",
      diffReview,
      evidenceRefs: [validationEvidence],
      operatorNote: "Coordinator accepted task 001 without a commit.",
      queueApi: noCommitHarness.api,
      queueItemId: "task-001",
      task: sourceWithDiffReady,
      tasks: [sourceWithDiffReady, dependent],
      workspaceId: "workspace-1",
      now: fixedNow,
    });
    const noCommitSummary = [
      noCommitResult.message,
      noCommitResult.report.summary,
      noCommitResult.report.rawReportPreview,
    ].join("\n");

    expect(noCommitResult.dependencyGate.sourceSatisfiesDependency).toBe(true);
    expect(noCommitResult.dependencyGate.dependents[0]).toMatchObject({
      dependentItemId: "task-002",
      ready: true,
      summary: "All prerequisites accepted/finalized.",
    });
    expect(noCommitSummary).toContain("decision: accepted_without_commit");
    expect(noCommitSummary).toContain(
      "no_commit_reason: Smoke task produced review evidence only; no file commit required.",
    );
    expect(noCommitSummary).toContain("diff_review_report_id: diff-report-task-001");
    expect(noCommitSummary).toContain(
      "evidence_refs: validation:validation-report-task-001:passed",
    );
    expect(noCommitSummary).toContain(
      "dependency_gate: 1 of 1 dependent Queue item is dependency-ready; no dependent task was started.",
    );

    const commitDecision = validateCoordinatorDecisionRequest(
      coordinatorDecisionRequest("accept_with_commit"),
    );
    expect(commitDecision.ok).toBe(true);
    expect(commitDecision.shouldUnblockDependents).toBe(true);

    const commitHarness = createQueueApiHarness([sourceWithDiffReady, dependent]);
    const commitResult = await finalizeQueueItemWithCoordinatorDecision({
      commit: {
        commitHash: "abc1234",
        commitTitle: "frontend: add coordinator finalization smoke",
        expectedCommitTitle: "frontend: add coordinator finalization smoke",
        verificationStatus: "unverified",
      },
      decision: "accepted_with_commit",
      diffReview,
      evidenceRefs: [validationEvidence],
      operatorNote: "Coordinator accepted task 001 with an existing commit.",
      queueApi: commitHarness.api,
      queueItemId: "task-001",
      task: sourceWithDiffReady,
      tasks: [sourceWithDiffReady, dependent],
      workspaceId: "workspace-1",
      now: fixedNow,
    });
    const commitSummary = [
      commitResult.message,
      commitResult.report.summary,
      commitResult.report.rawReportPreview,
    ].join("\n");

    expect(commitResult.dependencyGate.sourceSatisfiesDependency).toBe(true);
    expect(commitResult.dependencyGate.dependents[0]).toMatchObject({
      dependentItemId: "task-002",
      ready: true,
    });
    expect(commitSummary).toContain("decision: accepted_with_commit");
    expect(commitSummary).toContain("commit_hash: abc1234");
    expect(commitSummary).toContain(
      "commit_title: frontend: add coordinator finalization smoke",
    );
    expect(commitSummary).toContain(
      "effects: no_run, no_autorun, no_commit, no_push, no_rollback",
    );
    expect(
      requestChangesHarness.startAssignedAgentQueueTask,
    ).not.toHaveBeenCalled();
    expect(noCommitHarness.startAssignedAgentQueueTask).not.toHaveBeenCalled();
    expect(commitHarness.startAssignedAgentQueueTask).not.toHaveBeenCalled();
    expect(requestChangesHarness.autorunStart).not.toHaveBeenCalled();
    expect(noCommitHarness.autorunStart).not.toHaveBeenCalled();
    expect(commitHarness.autorunStart).not.toHaveBeenCalled();
    expectNoForbiddenEffects(effects);
  });

  it("unsupported fields produce warning and visible metadata", async () => {
    const source = queueTask({
      queueItemId: "task-1",
      status: "review_needed",
    });
    const harness = createQueueApiHarness([source], {
      supportsReportEvidence: false,
    });

    const result = await finalizeQueueItemWithCoordinatorDecision({
      commit: { noCommitReason: "No file changes." },
      decision: "accepted_without_commit",
      queueApi: harness.api,
      queueItemId: "task-1",
      task: source,
      tasks: [source],
      workspaceId: "workspace-1",
      now: fixedNow,
    });

    expect(result.warnings.map((warning) => warning.code)).toContain(
      "first_class_fields_unsupported",
    );
    expect(result.warnings.map((warning) => warning.code)).toContain(
      "queue_report_metadata_unavailable",
    );
    expect(harness.task("task-1")?.workerExecutionReports).toEqual([]);
    expect(harness.task("task-1")?.description).toContain(
      "decision: accepted_without_commit",
    );
  });

  it("creates follow-up only through explicit action and does not run it", async () => {
    const source = queueTask({
      queueItemId: "task-1",
      status: "review_needed",
      title: "Implementation task",
    });
    const harness = createQueueApiHarness([source]);

    const result = await createCoordinatorFollowUp({
      followUpPrompt: "Fix the review finding.",
      followUpTitle: "Follow-up: fix review finding",
      queueApi: harness.api,
      queueItemId: "task-1",
      task: source,
      tasks: [source],
      workspaceId: "workspace-1",
      now: fixedNow,
    });

    expect(result.createResult?.ok).toBe(true);
    expect(harness.createRequests).toHaveLength(1);
    expect(harness.createRequests[0]).toMatchObject({
      executionPolicy: "manual",
      itemType: "follow_up",
      prompt: "Fix the review finding.",
      status: "queued",
      title: "Follow-up: fix review finding",
    });
    expect(harness.task("task-1")?.status).toBe("review_needed");
    expect(harness.startAssignedAgentQueueTask).not.toHaveBeenCalled();
    expect(harness.autorunStart).not.toHaveBeenCalled();
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
  const autorunStart = vi.fn();
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
        updatedAt: "2026-06-11T10:01:00.000Z",
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
    autorunStart,
    createRequests,
    startAssignedAgentQueueTask,
    task: (queueItemId: string) => tasks.get(queueItemId),
    updateRequests,
  };
}

function fixedNow() {
  return "2026-06-11T10:00:00.000Z";
}

function forbiddenEffects() {
  return {
    autorunStart: vi.fn(),
    commit: vi.fn(),
    push: vi.fn(),
    rollback: vi.fn(),
    start: vi.fn(),
  };
}

function expectNoForbiddenEffects(effects: ReturnType<typeof forbiddenEffects>) {
  expect(effects.autorunStart).not.toHaveBeenCalled();
  expect(effects.commit).not.toHaveBeenCalled();
  expect(effects.push).not.toHaveBeenCalled();
  expect(effects.rollback).not.toHaveBeenCalled();
  expect(effects.start).not.toHaveBeenCalled();
}

function queueTask(overrides: Partial<AgentQueueTask> = {}): AgentQueueTask {
  return {
    approvalPolicy: "never",
    assignedExecutorWidgetId: null,
    codexExecutable: "codex.cmd",
    createdAt: "2026-06-11T09:00:00.000Z",
    dependsOn: [],
    description: "Queue task description.",
    executionPolicy: "manual",
    executionWorkspace: "C:/repo",
    itemType: "implementation",
    priority: 0,
    prompt: "Implement the Queue task.",
    queueItemId: "task-1",
    queueTagId: "default",
    queueTagName: "Default",
    sandbox: "read_only",
    status: "queued",
    title: "Queue task",
    updatedAt: "2026-06-11T09:00:00.000Z",
    validationStatus: "not_started",
    workerExecutionReports: [],
    workspaceId: "workspace-1",
    ...overrides,
  };
}

function task001(overrides: Partial<AgentQueueTask> = {}) {
  return queueTask({
    description:
      "Task 001 has validation evidence plus a Diff Review link/status and gates task 002.",
    prompt: "Implement safe coordinator finalization fixture task 001.",
    queueItemId: "task-001",
    title: "001 Coordinator finalization source",
    ...overrides,
  });
}

function task002(overrides: Partial<AgentQueueTask> = {}) {
  return queueTask({
    dependsOn: ["task-001"],
    description: "Task 002 must wait for accepted/finalized task 001.",
    prompt: "Run only after task 001 is explicitly coordinator finalized.",
    queueItemId: "task-002",
    status: "queued",
    title: "002 Dependent readiness gate",
    ...overrides,
  });
}

function coordinatorDecisionRequest(
  decision: "accept_with_commit" | "accept_without_commit",
) {
  return {
    commit:
      decision === "accept_without_commit"
        ? {
            hash: null,
            missingHashReason:
              "Smoke task produced review evidence only; no file commit required.",
            title: null,
          }
        : {
            hash: "abc1234",
            title: "frontend: add coordinator finalization smoke",
          },
    decision,
    dependencyGate: {
      dependentTaskIds: ["task-002"],
      readyToUnblock: false,
      reason: "Task 002 waits for explicit accepted/finalized task 001.",
    },
    diffReview: {
      recommendation: "accept_ready" as const,
      reportId: "diff-report-task-001",
      status: "reported" as const,
      taskId: "diff-review-task-001",
    },
    operatorNote: "Coordinator reviewed visible validation and Diff Review evidence.",
    promptPackMetadata: {
      allowedScope: ["apps/desktop/frontend/src/workbench/queue"],
      blockId: "COORDINATOR-FINALIZATION-DEPENDENCY-GATE-SMOKE-TEST-01",
      dependencies: [],
      expectedCommitTitle: "frontend: add coordinator finalization smoke",
      forbiddenScope: ["backend", "storage", "runtime"],
      packId: "self-development-smoke",
      packName: "Self-development smoke prompt pack",
      projectName: "Hobit",
      validationCommands: [
        "npm.cmd run test --prefix apps/desktop/frontend -- --run queueCoordinatorFinalizationService",
      ],
    },
    sourceQueueTask: {
      id: "task-001",
      status: "review_needed" as const,
      title: "001 Coordinator finalization source",
    },
    validationEvidence: {
      evidenceRefs: [
        {
          id: "validation-report-task-001",
          kind: "validation" as const,
          status: "passed",
        },
      ],
      status: "passed" as const,
      summary: "typecheck and focused coordinator tests passed",
    },
  };
}

function workerReport(
  overrides: Partial<AgentQueueWorkerExecutionReport> = {},
): AgentQueueWorkerExecutionReport {
  return {
    changedFiles: [],
    commandsRun: ["npm typecheck"],
    createdAt: "2026-06-11T09:30:00.000Z",
    errors: [],
    itemId: "task-1",
    reportId: "worker-report-1",
    reportStatus: "completed",
    summary: "Worker completed the task.",
    validationCommandsSuggested: ["npm typecheck"],
    validationResult: "passed",
    warnings: [],
    workerId: "executor-1",
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
