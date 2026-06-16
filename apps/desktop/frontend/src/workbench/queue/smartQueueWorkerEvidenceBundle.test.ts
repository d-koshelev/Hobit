import { describe, expect, it } from "vitest";

import type {
  AgentExecutorRunDetail,
  AgentExecutorRunSummary,
  AgentQueueWorkerExecutionReport,
  RunCodexDirectWorkResponse,
  RunDirectWorkValidationResponse,
} from "../../workspace/types";
import evidenceBundleSource from "./smartQueueWorkerEvidenceBundle.ts?raw";
import {
  createEvidenceBundleFromAgentExecutorRunDetail,
  createEvidenceBundleFromDirectWorkResult,
  createEvidenceBundleFromQueueWorkerReport,
  createEvidenceBundleFromWorkspaceAgentRun,
  createQueueWorkerEvidenceBundle,
  getEvidenceBundleHumanSummary,
  getEvidenceBundleMissingFields,
  getQueueWorkerEvidenceOutcome,
  mapEvidenceOutcomeToReviewOutcome,
  normalizeQueueWorkerEvidenceBundle,
  summarizeQueueWorkerEvidenceBundle,
  toLifecycleAgentFinishedInput,
  toReviewMessageEvidenceInput,
  validateQueueWorkerEvidenceBundle,
} from "./smartQueueWorkerEvidenceBundle";

describe("smartQueueWorkerEvidenceBundle", () => {
  it("normalizes completed worker evidence into a bounded product-facing bundle", () => {
    const bundle = createQueueWorkerEvidenceBundle({
      attemptId: "attempt-1",
      changedFiles: [
        "apps/desktop/frontend/src/workbench/queue/a.ts\nhidden",
        { path: "apps/desktop/frontend/src/workbench/queue/b.ts", status: "modified" },
      ],
      completedAt: "2026-06-16T12:10:00.000Z",
      finalAgentMessage: "Implementation completed.",
      logReference: "frontend://logs/attempt-1",
      outcome: "completed",
      providerId: "codex",
      rawProviderSummary: "Provider reported completion.",
      runId: "run-1",
      startedAt: "2026-06-16T12:00:00.000Z",
      taskId: "task-1",
      threadId: "thread-1",
      validationExitCode: 0,
      validationOutputPreview: "typecheck passed",
      validationSummary: "Validation passed.",
      workerId: "worker-1",
    });

    expect(validateQueueWorkerEvidenceBundle(bundle)).toMatchObject({
      ok: true,
      missingFields: [],
    });
    expect(bundle).toMatchObject({
      attemptId: "attempt-1",
      durable: false,
      frontendOnly: true,
      outcome: "completed",
      runId: "run-1",
      taskId: "task-1",
      threadId: "thread-1",
      validationStatus: "passed",
    });
    expect(bundle.changedFiles).toHaveLength(2);
    expect(bundle.changedFiles[0]?.path).not.toContain("\n");
    expect(bundle.summary).toMatchObject({
      changedFilesLabel: "2 changed files",
      finalReportLabel: "Final report available",
      frontendOnlyLabel: "Evidence bundle is frontend-only and not durable yet",
      logsLabel: "Logs available",
      outcomeLabel: "Agent completed",
      validationLabel: "Validation passed",
    });
    expect(getEvidenceBundleHumanSummary(bundle)).toContain("Agent completed");
    expect(getEvidenceBundleHumanSummary(bundle)).toContain("2 changed files");
  });

  it("validates outcome-specific required evidence without requiring run or thread ids", () => {
    const completedMissingReport = createQueueWorkerEvidenceBundle({
      changedFiles: [],
      outcome: "completed",
      taskId: "task-1",
    });
    const failedWithReason = createQueueWorkerEvidenceBundle({
      changedFiles: [],
      failureReason: "Worker failed before producing a final report.",
      outcome: "failed",
      taskId: "task-1",
    });
    const notCompletedStuck = createQueueWorkerEvidenceBundle({
      changedFiles: [],
      outcome: "not_completed",
      stuckReason: "Worker needs another prompt.",
      taskId: "task-1",
    });

    expect(validateQueueWorkerEvidenceBundle(completedMissingReport)).toMatchObject({
      ok: false,
      missingFields: ["finalAgentMessage"],
    });
    expect(validateQueueWorkerEvidenceBundle(failedWithReason)).toMatchObject({
      ok: true,
      missingFields: [],
    });
    expect(validateQueueWorkerEvidenceBundle(notCompletedStuck)).toMatchObject({
      ok: true,
      missingFields: [],
    });
    expect(failedWithReason.runId).toBeUndefined();
    expect(failedWithReason.threadId).toBeUndefined();
  });

  it("rejects task and attempt mismatches when evidence is used as broker input", () => {
    const bundle = createQueueWorkerEvidenceBundle({
      attemptId: "attempt-1",
      changedFiles: [],
      finalAgentMessage: "Done.",
      outcome: "completed",
      taskId: "task-1",
    });

    expect(
      validateQueueWorkerEvidenceBundle(bundle, { expectedTaskId: "other-task" }),
    ).toMatchObject({
      ok: false,
      reasons: ["Evidence bundle taskId does not match the action input taskId."],
    });
    expect(
      validateQueueWorkerEvidenceBundle(bundle, {
        expectedAttemptId: "other-attempt",
      }),
    ).toMatchObject({
      ok: false,
      reasons: ["Evidence bundle attemptId does not match the action input attemptId."],
    });
    expect(
      normalizeQueueWorkerEvidenceBundle({
        attemptId: "attempt-1",
        finalAgentMessage: "Done.",
        outcome: "completed",
        taskId: "task-1",
      }, { expectedTaskId: "other-task" }),
    ).toMatchObject({
      ok: false,
    });
  });

  it("bounds changed files and validation output for display", () => {
    const bundle = createQueueWorkerEvidenceBundle({
      changedFiles: Array.from({ length: 25 }, (_, index) =>
        `src/${index.toString().padStart(2, "0")}/${"x".repeat(400)}.ts`,
      ),
      finalAgentMessage: "Done.",
      outcome: "completed",
      taskId: "task-1",
      validationOutputPreview: "v".repeat(4_000),
      validationStatus: "failed",
    });

    expect(bundle.changedFiles).toHaveLength(20);
    expect(bundle.changedFiles[0]?.path.length).toBeLessThanOrEqual(240);
    expect(bundle.changedFiles[0]?.truncated).toBe(true);
    expect(bundle.validationOutputPreview?.length).toBeLessThan(4_000);
    expect(bundle.validationOutputPreview).toContain("Preview capped");
    expect(summarizeQueueWorkerEvidenceBundle(bundle).validationLabel).toBe(
      "Validation failed",
    );
  });

  it("maps evidence into lifecycle agent-finished and review-message inputs", () => {
    const bundle = createQueueWorkerEvidenceBundle({
      attemptId: "attempt-1",
      changedFiles: ["src/a.ts"],
      completedAt: "2026-06-16T12:10:00.000Z",
      finalAgentMessage: "Done.",
      outcome: "completed",
      taskId: "task-1",
      threadId: "thread-1",
      validationStatus: "passed",
      validationSummary: "typecheck passed",
    });

    expect(getQueueWorkerEvidenceOutcome(bundle)).toBe("completed");
    expect(mapEvidenceOutcomeToReviewOutcome(bundle.outcome)).toBe("completed");
    expect(toLifecycleAgentFinishedInput(bundle)).toMatchObject({
      attemptId: "attempt-1",
      changedFilesSummary: "1 changed file: src/a.ts",
      finalAgentMessage: "Done.",
      finishedAt: "2026-06-16T12:10:00.000Z",
      outcome: "completed",
      taskId: "task-1",
      threadId: "thread-1",
      validationSummary: "typecheck passed",
    });
    expect(toReviewMessageEvidenceInput(bundle)).toMatchObject({
      evidenceSummary: expect.stringContaining("Agent completed"),
      finalAgentMessage: "Done.",
      workerEvidenceBundle: bundle,
    });
  });

  it("adapts existing frontend Direct Work result shapes without execution", () => {
    const direct = createEvidenceBundleFromDirectWorkResult({
      changedFiles: ["src/direct.ts"],
      result: directWorkResponse({
        finalMessage: "Direct Work completed.",
        status: "completed",
      }),
      taskId: "task-direct",
      threadId: "thread-direct",
      validation: validationResponse({ exitCode: 0, status: "completed" }),
    });
    const executor = createEvidenceBundleFromAgentExecutorRunDetail({
      detail: runDetail({
        changedFilesSummary: "Changed files: 1",
        finalMessage: "Executor detail completed.",
        validationProfile: "changed",
        validationStatus: "passed",
      }),
      taskId: "task-executor",
    });
    const workerReport = createEvidenceBundleFromQueueWorkerReport({
      report: queueWorkerReport({
        changedFiles: ["src/report.ts"],
        reportStatus: "failed",
        errors: ["Validation failed."],
        validationResult: "failed",
      }),
    });
    const workspaceAgent = createEvidenceBundleFromWorkspaceAgentRun({
      finalAgentMessage: "Workspace Agent completed.",
      runId: "workspace-run",
      status: "completed",
      taskId: "task-agent",
      threadId: "thread-agent",
    });

    expect(direct).toMatchObject({
      outcome: "completed",
      runId: "run-direct",
      taskId: "task-direct",
      threadId: "thread-direct",
      validationStatus: "passed",
    });
    expect(executor).toMatchObject({
      changedFilesSummary: "Changed files: 1",
      outcome: "completed",
      runId: "run-detail",
      taskId: "task-executor",
      validationStatus: "passed",
    });
    expect(workerReport).toMatchObject({
      failureReason: "Validation failed.",
      outcome: "failed",
      taskId: "task-report",
      validationStatus: "failed",
    });
    expect(workspaceAgent).toMatchObject({
      outcome: "completed",
      runId: "workspace-run",
      taskId: "task-agent",
      threadId: "thread-agent",
    });
  });

  it("reports missing fields without exposing raw enum names in summaries", () => {
    expect(getEvidenceBundleMissingFields({ outcome: "not_completed", taskId: "task" }))
      .toEqual(["stuckReason"]);

    const summary = getEvidenceBundleHumanSummary(
      createQueueWorkerEvidenceBundle({
        changedFiles: [],
        outcome: "not_completed",
        stuckReason: "Needs more input.",
        taskId: "task",
      }),
    );

    expect(summary).toContain("Agent did not complete");
    expect(summary).toContain("Validation not run");
    expect(summary).not.toContain("not_completed");
  });

  it("does not add Codex, shell, Terminal, Git, rollback, worker, duplicate Queue, persistence, or regex routing side effects", () => {
    expect(evidenceBundleSource).not.toContain("runCodexDirectWork(");
    expect(evidenceBundleSource).not.toContain("startCodexDirectWorkStream");
    expect(evidenceBundleSource).not.toContain("workspace.shell");
    expect(evidenceBundleSource).not.toContain("launchTerminal");
    expect(evidenceBundleSource).not.toContain("mutateGit");
    expect(evidenceBundleSource).not.toContain("executeRollback");
    expect(evidenceBundleSource).not.toContain("startAssignedAgentQueueTask");
    expect(evidenceBundleSource).not.toContain("createQueueView");
    expect(evidenceBundleSource).not.toContain("persistBackend");
    expect(evidenceBundleSource).not.toContain("new RegExp");
    expect(evidenceBundleSource).not.toContain(".match(");
  });
});

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

function runDetail(
  overrides: Partial<AgentExecutorRunDetail> & {
    summary?: Partial<AgentExecutorRunSummary>;
  } = {},
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
