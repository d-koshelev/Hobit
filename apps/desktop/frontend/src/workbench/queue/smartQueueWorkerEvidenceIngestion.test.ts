import { describe, expect, it, vi } from "vitest";

import type {
  AgentExecutorRunDetail,
  AgentExecutorRunSummary,
  AgentQueueTask,
  AgentQueueWorkerExecutionReport,
  RunCodexDirectWorkResponse,
  RunDirectWorkValidationResponse,
} from "../../workspace/types";
import {
  createDefaultQueueAgentAdapterApi,
  createInMemoryQueueDogfoodLifecycleAdapterApi,
  createQueueAgentActionHandlers,
  type QueueAgentAdapterApi,
  type QueueAgentLifecycleGetOutput,
  type QueueAgentLifecycleTaskSeed,
  type QueueAgentLifecycleTransitionOutput,
  type QueueAgentReviewEvidenceBundleOutput,
} from "../agents/adapters";
import {
  createActionRequest,
  createHobitAgentActionBroker,
  type HobitAgentActionRequest,
  type HobitAgentBrokerResult,
} from "../agents/broker";
import { createHobitAgentCapabilityRegistry } from "../agents/capabilities";
import type { SmartQueueDogfoodLifecycleItem } from "./smartQueueDogfoodLifecycle";
import {
  canQueueTaskStartByDogfoodLifecycleGate,
} from "./smartQueueDogfoodLifecycleController";
import { createQueueWorkerEvidenceBundle } from "./smartQueueWorkerEvidenceBundle";
import ingestionSource from "./smartQueueWorkerEvidenceIngestion.ts?raw";
import {
  createQueueWorkerEvidenceIngestionBridge,
  ingestQueueLinkedAgentExecutorRunDetail,
  ingestQueueLinkedDirectWorkCompletion,
  ingestQueueLinkedWorkerReport,
  ingestQueueLinkedWorkspaceAgentCompletion,
  ingestQueueWorkerEvidence,
  maybeIngestQueueLinkedDirectWorkCompletion,
} from "./smartQueueWorkerEvidenceIngestion";

const NOW = "2026-06-16T12:00:00.000Z";
const TASK_ID = "task-ingest";
const ATTEMPT_ID = "attempt-ingest";
const THREAD_ID = "thread-ingest";
const DEPENDENT_TASK_ID = "task-dependent";

describe("smartQueueWorkerEvidenceIngestion", () => {
  it("dry-runs ingestion through the broker without mutating lifecycle state", async () => {
    const harness = createHarness();
    const before = harness.readLifecycle(TASK_ID);

    const result = await ingestQueueWorkerEvidence(harness.dependencies, {
      attemptId: ATTEMPT_ID,
      dryRun: true,
      finalAgentMessage: "Implementation completed.",
      outcome: "completed",
      runId: "run-ingest-preview",
      taskId: TASK_ID,
      threadId: THREAD_ID,
      validationSummary: "typecheck passed",
    });
    const after = harness.readLifecycle(TASK_ID);

    expect(result).toMatchObject({
      brokerStatus: "succeeded",
      productStatusLabel: "Queue worker evidence preview prepared",
      status: "success",
      taskId: TASK_ID,
    });
    expect(result.lifecycleOutput).toMatchObject({
      dryRunOnly: true,
      queueMutation: "none",
      ticketState: "awaiting_review",
    });
    expect(before).toMatchObject({ ticketState: "running" });
    expect(after).toMatchObject({ ticketState: "running" });
    expect(harness.invokedRequests).toHaveLength(1);
    expect(harness.invokedRequests[0]).toMatchObject({
      capabilityId: "queue.lifecycle.agentFinished",
      dryRun: true,
    });
  });

  it("ingests evidence through the broker and stores it in the frontend lifecycle overlay", async () => {
    const harness = createHarness();
    const bridge = createQueueWorkerEvidenceIngestionBridge(harness.dependencies);

    const result = await bridge({
      attemptId: ATTEMPT_ID,
      changedFiles: ["apps/desktop/frontend/src/workbench/queue/bridge.ts"],
      finalAgentMessage: "Implementation completed.",
      outcome: "completed",
      runId: "run-ingest-bridge",
      taskId: TASK_ID,
      threadId: THREAD_ID,
      validationSummary: "typecheck passed",
    });
    const lifecycle = harness.readLifecycle(TASK_ID);
    const evidence = harness.readEvidence(TASK_ID);

    expect(result).toMatchObject({
      activityTitle: "Queue worker evidence ingested",
      brokerStatus: "succeeded",
      productStatusLabel: "Queue item awaiting review",
      status: "success",
    });
    expect(result.lifecycleOutput).toMatchObject({
      queueMutation: "frontend_controller_overlay",
      ticketState: "awaiting_review",
      wouldAutoRunWorkers: false,
      wouldCallGit: false,
      wouldExecuteRollback: false,
      wouldLaunchTerminal: false,
      wouldPersistBackend: false,
      wouldRunValidation: false,
      wouldStartWorkers: false,
    });
    expect(lifecycle).toMatchObject({
      finalAgentMessage: "Implementation completed.",
      ticketState: "awaiting_review",
      workerEvidenceBundle: {
        attemptId: ATTEMPT_ID,
        taskId: TASK_ID,
        threadId: THREAD_ID,
      },
    });
    expect(evidence).toMatchObject({
      evidenceBundle: {
        durable: false,
        frontendOnly: true,
        taskId: TASK_ID,
      },
      latestReviewMessage: null,
      reviewMessages: [],
      taskId: TASK_ID,
    });
  });

  it("fails when taskId is missing and never asks the broker to infer it", async () => {
    const invokeBrokerAction = vi.fn();

    const result = await ingestQueueWorkerEvidence(
      { invokeBrokerAction },
      {
        finalAgentMessage: "Done for task-ingest.",
        outcome: "completed",
      },
    );

    expect(result).toMatchObject({
      productStatusLabel: "Queue evidence ingestion failed",
      status: "invalid_input",
    });
    expect(result.reasons).toEqual([
      "taskId is required. Evidence ingestion never infers taskId from text.",
    ]);
    expect(invokeBrokerAction).not.toHaveBeenCalled();
  });

  it("fails when the explicit taskId does not match the evidence bundle taskId", async () => {
    const harness = createHarness();
    const evidenceBundle = createQueueWorkerEvidenceBundle({
      finalAgentMessage: "Done.",
      outcome: "completed",
      runId: "run-different-task",
      taskId: "different-task",
    });

    const result = await ingestQueueWorkerEvidence(harness.dependencies, {
      evidenceBundle,
      taskId: TASK_ID,
    });

    expect(result).toMatchObject({
      status: "invalid_input",
      taskId: TASK_ID,
    });
    expect(result.reasons).toEqual([
      "Evidence bundle taskId does not match the action input taskId.",
    ]);
    expect(harness.invokedRequests).toHaveLength(0);
  });

  it("fails when the explicit attemptId conflicts with the evidence bundle attemptId", async () => {
    const harness = createHarness();
    const evidenceBundle = createQueueWorkerEvidenceBundle({
      attemptId: "attempt-other",
      finalAgentMessage: "Done.",
      outcome: "completed",
      runId: "run-attempt-conflict",
      taskId: TASK_ID,
    });

    const result = await ingestQueueWorkerEvidence(harness.dependencies, {
      attemptId: ATTEMPT_ID,
      evidenceBundle,
      taskId: TASK_ID,
    });

    expect(result.status).toBe("invalid_input");
    expect(result.reasons).toEqual([
      "Evidence bundle attemptId does not match the action input attemptId.",
    ]);
    expect(harness.invokedRequests).toHaveLength(0);
  });

  it("fails invalid evidence before invoking the broker", async () => {
    const harness = createHarness();

    const result = await ingestQueueWorkerEvidence(harness.dependencies, {
      outcome: "completed",
      runId: "run-invalid-evidence",
      taskId: TASK_ID,
    });

    expect(result).toMatchObject({
      status: "invalid_input",
      taskId: TASK_ID,
    });
    expect(result.reasons).toContain("Completed evidence requires a final report.");
    expect(harness.invokedRequests).toHaveLength(0);
  });

  it("returns unavailable when broker dependencies or lifecycle controller are unavailable", async () => {
    const missingBroker = await ingestQueueWorkerEvidence({}, {
      finalAgentMessage: "Done.",
      outcome: "completed",
      runId: "run-missing-broker",
      taskId: TASK_ID,
    });
    const missingController = await ingestQueueWorkerEvidence(
      createHarness({ withLifecycle: false }).dependencies,
      {
        finalAgentMessage: "Done.",
        outcome: "completed",
        runId: "run-missing-controller",
        taskId: TASK_ID,
      },
    );

    expect(missingBroker).toMatchObject({
      status: "unavailable",
      taskId: TASK_ID,
    });
    expect(missingController).toMatchObject({
      brokerStatus: "unavailable",
      status: "unavailable",
      taskId: TASK_ID,
    });
  });

  it("preserves dry-run-required broker status", async () => {
    const harness = createHarness({ requireDryRunBeforeSideEffectingInvoke: true });

    const result = await ingestQueueWorkerEvidence(harness.dependencies, {
      finalAgentMessage: "Done.",
      outcome: "completed",
      runId: "run-dry-run-required",
      taskId: TASK_ID,
    });

    expect(result).toMatchObject({
      brokerStatus: "dry_run_required",
      productStatusLabel: "Queue evidence ingestion needs dry-run",
      status: "dry_run_required",
    });
    expect(harness.readLifecycle(TASK_ID)).toMatchObject({
      ticketState: "running",
    });
  });

  it("maps completed failed and not-completed outcomes to awaiting review", async () => {
    const completed = createHarness();
    const failed = createHarness({ taskId: "task-failed" });
    const notCompleted = createHarness({ taskId: "task-stuck" });

    const completedResult = await ingestQueueWorkerEvidence(completed.dependencies, {
      finalAgentMessage: "Completed.",
      outcome: "completed",
      runId: "run-completed-outcome",
      taskId: "task-failed",
    });
    const failedResult = await ingestQueueWorkerEvidence(failed.dependencies, {
      failureReason: "Validation failed.",
      outcome: "failed",
      runId: "run-failed-outcome",
      taskId: "task-failed",
    });
    const notCompletedResult = await ingestQueueWorkerEvidence(
      notCompleted.dependencies,
      {
        outcome: "not_completed",
        runId: "run-not-completed-outcome",
        stuckReason: "Needs a smaller follow-up prompt.",
        taskId: "task-stuck",
      },
    );

    expect(completedResult.lifecycleOutput).toMatchObject({
      reviewOutcome: "completed",
      ticketState: "awaiting_review",
    });
    expect(failedResult.lifecycleOutput).toMatchObject({
      reviewOutcome: "failed",
      ticketState: "awaiting_review",
    });
    expect(notCompletedResult.lifecycleOutput).toMatchObject({
      reviewOutcome: "not_completed",
      ticketState: "awaiting_review",
    });
  });

  it("makes evidence readable and keeps review-message creation explicit", async () => {
    const harness = createHarness();

    await ingestQueueWorkerEvidence(harness.dependencies, {
      attemptId: ATTEMPT_ID,
      changedFiles: ["src/a.ts"],
      finalAgentMessage: "Implementation completed.",
      outcome: "completed",
      runId: "run-evidence-readable",
      taskId: TASK_ID,
      validationSummary: "typecheck passed",
    });
    const beforeReview = harness.readEvidence(TASK_ID);
    const review = harness.invoke<QueueAgentLifecycleTransitionOutput>(
      "queue.review.createMessage",
      {
        coordinatorAgentId: "coordinator-1",
        messageId: "review-message-1",
        taskId: TASK_ID,
      },
    );
    const afterReview = harness.readEvidence(TASK_ID);

    expect(beforeReview).toMatchObject({
      evidenceBundle: { taskId: TASK_ID },
      latestReviewMessage: null,
      reviewMessages: [],
    });
    expect(review.status).toBe("succeeded");
    expect(afterReview).toMatchObject({
      evidenceBundle: { taskId: TASK_ID },
      latestReviewMessage: {
        evidenceSummary: expect.stringContaining("Agent completed"),
        finalAgentMessage: "Implementation completed.",
        workerEvidenceBundle: { taskId: TASK_ID },
      },
      reviewMessages: [
        {
          evidenceSummary: expect.stringContaining("1 changed file"),
          taskId: TASK_ID,
        },
      ],
    });
  });

  it("does not unblock dependents before coordinator markDone", async () => {
    const harness = createHarness();

    await ingestQueueWorkerEvidence(harness.dependencies, {
      finalAgentMessage: "Implementation completed.",
      outcome: "completed",
      runId: "run-dependent-gate",
      taskId: TASK_ID,
    });

    expect(harness.canDependentStart()).toBe(false);
    expect(harness.readLifecycle(TASK_ID)).toMatchObject({
      ticketState: "awaiting_review",
    });
  });

  it("adapts explicit Queue-linked Direct Work results without starting Direct Work", async () => {
    const harness = createHarness();

    const result = await ingestQueueLinkedDirectWorkCompletion(harness.dependencies, {
      changedFiles: ["src/direct.ts"],
      result: directWorkResponse({
        finalMessage: "Direct Work completed.",
        runId: "run-direct-linked",
        status: "completed",
      }),
      taskId: TASK_ID,
      validation: validationResponse({ exitCode: 0, status: "completed" }),
    });

    expect(result).toMatchObject({
      status: "success",
      taskId: TASK_ID,
    });
    expect(result.evidenceBundle).toMatchObject({
      outcome: "completed",
      runId: "run-direct-linked",
      taskId: TASK_ID,
      validationStatus: "passed",
    });
    expect(harness.invokedRequests).toHaveLength(1);
  });

  it("skips non-Queue-linked Direct Work results without inferring taskId from text", async () => {
    const invokeBrokerAction = vi.fn();

    const result = await maybeIngestQueueLinkedDirectWorkCompletion(
      { invokeBrokerAction },
      {
        result: directWorkResponse({
          finalMessage: "Completed queue task task-ingest.",
        }),
      },
    );

    expect(result).toMatchObject({
      productStatusLabel: "Queue evidence ingestion skipped",
      status: "not_linked",
    });
    expect(invokeBrokerAction).not.toHaveBeenCalled();
  });

  it("adapts explicit Workspace Agent, Agent Executor, and worker report results", async () => {
    const workspaceAgent = createHarness({ taskId: "task-workspace" });
    const executor = createHarness({ taskId: "task-executor" });
    const report = createHarness({ taskId: "task-report" });

    const workspaceAgentResult = await ingestQueueLinkedWorkspaceAgentCompletion(
      workspaceAgent.dependencies,
      {
        finalAgentMessage: "Workspace Agent completed.",
        runId: "workspace-run",
        status: "completed",
        taskId: "task-workspace",
        threadId: "thread-workspace",
      },
    );
    const executorResult = await ingestQueueLinkedAgentExecutorRunDetail(
      executor.dependencies,
      {
        detail: runDetail({
          changedFilesSummary: "Changed files: 1",
          finalMessage: "Executor completed.",
          summary: { runId: "run-executor" },
        }),
        taskId: "task-executor",
      },
    );
    const workerReportResult = await ingestQueueLinkedWorkerReport(
      report.dependencies,
      {
        report: queueWorkerReport({
          changedFiles: ["src/report.ts"],
          itemId: "task-report",
          reportStatus: "completed",
          summary: "Worker report completed.",
        }),
        taskId: "task-report",
      },
    );

    expect(workspaceAgentResult.evidenceBundle).toMatchObject({
      outcome: "completed",
      runId: "workspace-run",
      taskId: "task-workspace",
      threadId: "thread-workspace",
    });
    expect(executorResult.evidenceBundle).toMatchObject({
      changedFilesSummary: "Changed files: 1",
      runId: "run-executor",
      taskId: "task-executor",
    });
    expect(workerReportResult.evidenceBundle).toMatchObject({
      changedFiles: [{ path: "src/report.ts" }],
      taskId: "task-report",
    });
  });

  it("rejects worker report task-link mismatches before broker invocation", async () => {
    const harness = createHarness({ taskId: "task-report" });

    const result = await ingestQueueLinkedWorkerReport(harness.dependencies, {
      report: queueWorkerReport({ itemId: "different-task" }),
      taskId: "task-report",
    });

    expect(result).toMatchObject({
      status: "invalid_input",
      taskId: "task-report",
    });
    expect(result.reasons).toEqual([
      "Worker report itemId must match explicit taskId.",
    ]);
    expect(harness.invokedRequests).toHaveLength(0);
  });

  it("contains no execution, Git, rollback, duplicate Queue, filesystem, or natural-language regex routing hooks", () => {
    expect(ingestionSource).not.toContain("runCodexDirectWork(");
    expect(ingestionSource).not.toContain("startCodexDirectWorkStream");
    expect(ingestionSource).not.toContain("workspace.shell");
    expect(ingestionSource).not.toContain("launchTerminal");
    expect(ingestionSource).not.toContain("mutateGit");
    expect(ingestionSource).not.toContain("executeRollback");
    expect(ingestionSource).not.toContain("startAssignedAgentQueueTask");
    expect(ingestionSource).not.toContain("createQueueView");
    expect(ingestionSource).not.toContain("readFileSync");
    expect(ingestionSource).not.toContain("new RegExp");
    expect(ingestionSource).not.toContain(".match(");
  });
});

type Harness = {
  readonly canDependentStart: () => boolean;
  readonly dependencies: {
    readonly agentRoleId: "test_harness";
    readonly createdAt: string;
    readonly invokeBrokerAction: (
      request: HobitAgentActionRequest,
    ) => HobitAgentBrokerResult<QueueAgentLifecycleTransitionOutput>;
  };
  readonly invoke: <TOutput = unknown>(
    capabilityId: string,
    input: unknown,
    options?: { readonly dryRun?: boolean },
  ) => HobitAgentBrokerResult<TOutput>;
  readonly invokedRequests: HobitAgentActionRequest[];
  readonly readEvidence: (
    taskId: string,
  ) => QueueAgentReviewEvidenceBundleOutput | null;
  readonly readLifecycle: (taskId: string) => SmartQueueDogfoodLifecycleItem | null;
};

function createHarness({
  requireDryRunBeforeSideEffectingInvoke = false,
  taskId = TASK_ID,
  withLifecycle = true,
}: {
  readonly requireDryRunBeforeSideEffectingInvoke?: boolean;
  readonly taskId?: string;
  readonly withLifecycle?: boolean;
} = {}): Harness {
  const taskSeeds = lifecycleSeeds(taskId);
  const adapterApi: QueueAgentAdapterApi = {
    ...createDefaultQueueAgentAdapterApi(),
    ...(withLifecycle
      ? {
          dogfoodLifecycle: createInMemoryQueueDogfoodLifecycleAdapterApi({
            initialTaskSeeds: taskSeeds,
            now: () => NOW,
          }),
        }
      : {}),
  };
  const broker = createHobitAgentActionBroker({
    handlers: createQueueAgentActionHandlers(adapterApi),
    policy: { requireDryRunBeforeSideEffectingInvoke },
    registry: createHobitAgentCapabilityRegistry(),
  });
  const invokedRequests: HobitAgentActionRequest[] = [];
  let requestIndex = 0;

  const invoke = <TOutput = unknown>(
    capabilityId: string,
    input: unknown,
    options: { readonly dryRun?: boolean } = {},
  ): HobitAgentBrokerResult<TOutput> => {
    requestIndex += 1;
    return broker.invoke<TOutput>(
      createActionRequest({
        agentId: "queue-worker-evidence-ingestion:test",
        agentRoleId: "test_harness",
        capabilityId,
        createdAt: NOW,
        dryRun: options.dryRun ?? false,
        input,
        reason: "queue-worker-evidence-ingestion-test",
        requestId: `queue-worker-evidence-ingestion:${requestIndex.toString()}:${capabilityId}`,
      }),
    );
  };
  const readLifecycle = (
    requestedTaskId: string,
  ): SmartQueueDogfoodLifecycleItem | null => {
    const result = invoke<QueueAgentLifecycleGetOutput>(
      "queue.lifecycle.get",
      { taskId: requestedTaskId },
      { dryRun: true },
    );

    return result.status === "succeeded"
      ? result.result.output?.lifecycle ?? null
      : null;
  };
  const readEvidence = (
    requestedTaskId: string,
  ): QueueAgentReviewEvidenceBundleOutput | null => {
    const result = invoke<QueueAgentReviewEvidenceBundleOutput>(
      "queue.review.getEvidenceBundle",
      { taskId: requestedTaskId },
      { dryRun: true },
    );

    return result.status === "succeeded" ? result.result.output ?? null : null;
  };
  const tasks = taskSeeds.map((seed) => queueTaskFromSeed(seed));

  return {
    canDependentStart: () => {
      const dependent = tasks.find(
        (candidate) => candidate.queueItemId === DEPENDENT_TASK_ID,
      );
      if (!dependent) {
        return false;
      }

      const lifecycles = (dependent.dependsOn ?? [])
        .map((candidateTaskId) => readLifecycle(candidateTaskId))
        .filter(
          (item): item is SmartQueueDogfoodLifecycleItem => Boolean(item),
        );

      return canQueueTaskStartByDogfoodLifecycleGate({
        lifecycles,
        task: dependent,
        tasks,
      });
    },
    dependencies: {
      agentRoleId: "test_harness",
      createdAt: NOW,
      invokeBrokerAction: (request) => {
        invokedRequests.push(request);
        return broker.invoke<QueueAgentLifecycleTransitionOutput>(request);
      },
    },
    invoke,
    invokedRequests,
    readEvidence,
    readLifecycle,
  };
}

function lifecycleSeeds(taskId: string): readonly QueueAgentLifecycleTaskSeed[] {
  return [
    {
      createdAt: NOW,
      prompt: "Run the fake Queue-linked worker.",
      status: "running",
      taskId,
      title: "Queue-linked worker task",
      updatedAt: NOW,
    },
    {
      createdAt: NOW,
      prompt: "Run after the upstream task is done.",
      status: "queued",
      taskId: DEPENDENT_TASK_ID,
      title: "Dependent task",
      updatedAt: NOW,
    },
    {
      createdAt: NOW,
      prompt: "Run a failed fake worker result.",
      status: "running",
      taskId: "task-failed",
      title: "Failed worker task",
      updatedAt: NOW,
    },
    {
      createdAt: NOW,
      prompt: "Run a not-completed fake worker result.",
      status: "running",
      taskId: "task-stuck",
      title: "Not completed worker task",
      updatedAt: NOW,
    },
  ];
}

function queueTaskFromSeed(seed: QueueAgentLifecycleTaskSeed): AgentQueueTask {
  return {
    assignedExecutorWidgetId: null,
    createdAt: seed.createdAt ?? NOW,
    dependsOn:
      seed.taskId === DEPENDENT_TASK_ID
        ? [TASK_ID]
        : [],
    description: "",
    executionPolicy: "manual",
    priority: 0,
    prompt: seed.prompt ?? "Run fake Queue task.",
    queueItemId: seed.taskId,
    status: seed.status ?? "queued",
    title: seed.title ?? "Fake Queue task",
    updatedAt: seed.updatedAt ?? NOW,
    workspaceId: "workspace-ingestion-test",
  };
}

function directWorkResponse(
  overrides: Partial<RunCodexDirectWorkResponse> = {},
): RunCodexDirectWorkResponse {
  return {
    approvalPolicy: "never",
    commandSummary: ["codex", "exec"],
    durationMs: 1000,
    errorMessage: null,
    executorKind: "codex",
    exitCode: 0,
    finalMessage: "Done.",
    gitMutationsPerformedByHobit: false,
    mode: "codex_direct_work",
    noAutoCommit: true,
    noAutoPush: true,
    repoRoot: "C:/repo",
    resultId: "result-direct",
    resultType: "codex_direct_work",
    runId: "run-direct",
    sandbox: "workspace_write",
    status: "completed",
    stderr: "",
    stderrTruncated: false,
    stdout: "stdout",
    stdoutTruncated: false,
    ...overrides,
  };
}

function validationResponse(
  overrides: Partial<RunDirectWorkValidationResponse> = {},
): RunDirectWorkValidationResponse {
  return {
    commandSummary: ["npm.cmd", "run", "typecheck"],
    durationMs: 1000,
    errorMessage: null,
    exitCode: 0,
    gitMutationsPerformedByHobit: false,
    noCommitPush: true,
    noGitMutations: true,
    profile: "changed",
    repoRoot: "C:/repo",
    resultId: "validation-result",
    resultType: "direct_work_validation",
    runId: "validation-run",
    runStatus: "completed",
    status: "completed",
    stderr: "",
    stderrTruncated: false,
    stdout: "typecheck passed",
    stdoutTruncated: false,
    ...overrides,
  };
}

type AgentExecutorRunDetailOverrides = Omit<
  Partial<AgentExecutorRunDetail>,
  "summary"
> & {
    summary?: Partial<AgentExecutorRunSummary>;
  };

function runDetail(
  overrides: AgentExecutorRunDetailOverrides = {},
): AgentExecutorRunDetail {
  return {
    changedFilesSummary: null,
    errorMessage: null,
    finalMessage: "Executor final message.",
    logs: [],
    resultContent: null,
    resultId: "result-detail",
    resultPayload: null,
    resultStatus: "completed",
    resultSummary: "Executor completed.",
    stderrPreview: null,
    stdoutPreview: "stdout preview",
    validationProfile: null,
    validationStatus: null,
    ...overrides,
    summary: {
      commandKind: "codex_direct_work",
      durationMs: 1000,
      finishedAt: "2026-06-16T12:10:00.000Z",
      hasResult: true,
      logCount: 1,
      mode: "codex_direct_work",
      repoRoot: "C:/repo",
      resultType: "codex_direct_work",
      runId: "run-detail",
      startedAt: "2026-06-16T12:00:00.000Z",
      status: "completed",
      title: "Executor run",
      validationProfile: null,
      validationStatus: null,
      ...overrides.summary,
    },
  };
}

function queueWorkerReport(
  overrides: Partial<AgentQueueWorkerExecutionReport> = {},
): AgentQueueWorkerExecutionReport {
  return {
    changedFiles: [],
    commandsRun: [],
    createdAt: "2026-06-16T12:10:00.000Z",
    errors: [],
    itemId: "task-report",
    rawReportPreview: "Worker raw report preview.",
    reportId: "worker-report-1",
    reportStatus: "completed",
    summary: "Worker report completed.",
    validationCommandsSuggested: [],
    validationResult: "not_run",
    warnings: [],
    workerId: "worker-report",
    ...overrides,
  };
}
