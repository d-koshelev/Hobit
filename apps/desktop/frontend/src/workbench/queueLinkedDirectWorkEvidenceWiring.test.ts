import { describe, expect, it, vi } from "vitest";

import type {
  AgentExecutorRunDetail,
  DirectWorkStreamEvent,
} from "../workspace/types";
import type { DirectWorkRunHandoff } from "./types";
import {
  createEvidenceBundleFromAgentExecutorRunDetail,
} from "./queue/smartQueueWorkerEvidenceBundle";
import type {
  QueueLinkedAgentExecutorIngestionInput,
  QueueWorkerEvidenceIngestionResult,
} from "./queue/smartQueueWorkerEvidenceIngestion";
import {
  ingestQueueLinkedDirectWorkCompletionEvidence,
  type QueueLinkedDirectWorkEvidenceIngestionCallback,
} from "./queueLinkedDirectWorkEvidenceWiring";
import agentActivitySource from "./agentActivityModel.ts?raw";
import executorHistorySource from "./AgentExecutorRunHistoryPanel.tsx?raw";
import wiringSource from "./queueLinkedDirectWorkEvidenceWiring.ts?raw";
import workspaceAgentDirectWorkSource from "./useWorkspaceAgentDirectWorkController.ts?raw";

const baseHandoff: DirectWorkRunHandoff = {
  executorWidgetInstanceId: "executor-1",
  id: 1,
  queueItemId: "queue-1",
  repoRoot: "/repo",
  runId: "run-1",
  startedAt: "2026-06-16T10:00:00.000Z",
  taskTitle: "Queue task",
  workbenchId: "workbench-1",
  workspaceId: "workspace-1",
};

describe("queueLinkedDirectWorkEvidenceWiring", () => {
  it("ingests a valid Queue-linked final run detail with explicit metadata fields", async () => {
    const calls: QueueLinkedAgentExecutorIngestionInput[] = [];
    const ingestEvidence: QueueLinkedDirectWorkEvidenceIngestionCallback = vi.fn(
      async (input) => {
        calls.push(input);
        return successIngestionResult(input);
      },
    );

    const result = await ingestQueueLinkedDirectWorkCompletionEvidence({
      finalStatus: "completed",
      handoff: baseHandoff,
      handledIngestionKeys: new Set(),
      ingestEvidence,
      runDetail: runDetail("run-1", "completed", {
        changedFilesSummary: "Changed 2 files.",
        finalMessage: "Queue work completed.",
        validationProfile: "changed",
        validationStatus: "passed",
      }),
      streamEvent: streamEvent("run-1", "completed", true, "thread-1"),
    });

    expect(result).toMatchObject({
      activityTitle: "Queue worker evidence ingested",
      productStatusLabel: "Queue item awaiting review",
      runId: "run-1",
      status: "success",
      taskId: "queue-1",
    });
    expect(calls).toHaveLength(1);
    expect(calls[0]).toMatchObject({
      requestId: expect.stringContaining("queue-linked-direct-work"),
      taskId: "queue-1",
      threadId: "thread-1",
      workerId: "executor-1",
    });
    expect(calls[0].detail.summary.runId).toBe("run-1");
    expect(calls[0].logReference).toContain("run-1");
    expect(result.ingestionResult?.evidenceBundle).toMatchObject({
      changedFilesSummary: "Changed 2 files.",
      finalAgentMessage: "Queue work completed.",
      runId: "run-1",
      taskId: "queue-1",
      threadId: "thread-1",
      validationStatus: "passed",
      workerId: "executor-1",
    });
  });

  it("guards duplicate completion keys while allowing different run and Queue item ids", async () => {
    const handledIngestionKeys = new Set<string>();
    const calls: QueueLinkedAgentExecutorIngestionInput[] = [];
    const ingestEvidence: QueueLinkedDirectWorkEvidenceIngestionCallback = vi.fn(
      async (input) => {
        calls.push(input);
        return successIngestionResult(input);
      },
    );

    const first = await ingestQueueLinkedDirectWorkCompletionEvidence({
      handoff: baseHandoff,
      handledIngestionKeys,
      ingestEvidence,
      runDetail: runDetail("run-1", "completed"),
    });
    const duplicate = await ingestQueueLinkedDirectWorkCompletionEvidence({
      handoff: baseHandoff,
      handledIngestionKeys,
      ingestEvidence,
      runDetail: runDetail("run-1", "completed"),
    });
    const differentRun = await ingestQueueLinkedDirectWorkCompletionEvidence({
      handoff: { ...baseHandoff, id: 2, runId: "run-2" },
      handledIngestionKeys,
      ingestEvidence,
      runDetail: runDetail("run-2", "completed"),
    });
    const differentQueueItem = await ingestQueueLinkedDirectWorkCompletionEvidence({
      handoff: { ...baseHandoff, id: 3, queueItemId: "queue-2" },
      handledIngestionKeys,
      ingestEvidence,
      runDetail: runDetail("run-1", "completed"),
    });

    expect(first.status).toBe("success");
    expect(duplicate.status).toBe("duplicate_ignored");
    expect(differentRun.status).toBe("success");
    expect(differentQueueItem.status).toBe("success");
    expect(calls.map((call) => [call.taskId, call.detail.summary.runId])).toEqual([
      ["queue-1", "run-1"],
      ["queue-1", "run-2"],
      ["queue-2", "run-1"],
    ]);
  });

  it("skips or fails explicit identity guard cases without text inference", async () => {
    const ingestEvidence = vi.fn();
    const detailWithTemptingText = runDetail("run-1", "completed", {
      changedFilesSummary: "Touched /repo/queue-1/src/file.ts.",
      finalMessage: "Completed Queue item queue-1.",
      resultSummary: "Task title mentions queue-1.",
    });

    const notLinked = await ingestQueueLinkedDirectWorkCompletionEvidence({
      ingestEvidence,
      runDetail: detailWithTemptingText,
    });
    const missingQueueItem = await ingestQueueLinkedDirectWorkCompletionEvidence({
      handoff: {
        ...baseHandoff,
        queueItemId: " ",
        taskTitle: "Queue task queue-1",
      },
      ingestEvidence,
      runDetail: detailWithTemptingText,
    });
    const missingRunId = await ingestQueueLinkedDirectWorkCompletionEvidence({
      handoff: { ...baseHandoff, runId: " " },
      ingestEvidence,
      runDetail: detailWithTemptingText,
    });
    const missingExecutor = await ingestQueueLinkedDirectWorkCompletionEvidence({
      handoff: { ...baseHandoff, executorWidgetInstanceId: " " },
      ingestEvidence,
      runDetail: detailWithTemptingText,
    });

    expect(notLinked.status).toBe("not_queue_linked");
    expect(missingQueueItem.status).toBe("missing_queue_item");
    expect(missingRunId.status).toBe("missing_run_id");
    expect(missingExecutor.status).toBe("missing_executor_widget");
    expect(ingestEvidence).not.toHaveBeenCalled();
  });

  it("requires available final matching Agent Executor run detail", async () => {
    const ingestEvidence = vi.fn();

    const unavailable = await ingestQueueLinkedDirectWorkCompletionEvidence({
      handoff: baseHandoff,
      ingestEvidence,
      runDetail: null,
    });
    const mismatch = await ingestQueueLinkedDirectWorkCompletionEvidence({
      handoff: baseHandoff,
      ingestEvidence,
      runDetail: runDetail("other-run", "completed"),
    });
    const nonFinal = await ingestQueueLinkedDirectWorkCompletionEvidence({
      handoff: baseHandoff,
      ingestEvidence,
      runDetail: runDetail("run-1", "running"),
    });

    expect(unavailable.status).toBe("run_detail_unavailable");
    expect(mismatch.status).toBe("run_mismatch");
    expect(nonFinal.status).toBe("run_detail_unavailable");
    expect(ingestEvidence).not.toHaveBeenCalled();
  });

  it("reports unavailable ingestion and broker or evidence failures structurally", async () => {
    const unavailable = await ingestQueueLinkedDirectWorkCompletionEvidence({
      handoff: baseHandoff,
      runDetail: runDetail("run-1", "completed"),
    });
    const invalidEvidence = await ingestQueueLinkedDirectWorkCompletionEvidence({
      handoff: { ...baseHandoff, runId: "run-invalid" },
      ingestEvidence: async (input) => ({
        ...successIngestionResult(input),
        productStatusLabel: "Queue evidence ingestion failed",
        status: "invalid_input",
      }),
      runDetail: runDetail("run-invalid", "completed"),
    });
    const brokerFailed = await ingestQueueLinkedDirectWorkCompletionEvidence({
      handoff: { ...baseHandoff, runId: "run-failed" },
      ingestEvidence: async (input) => ({
        ...successIngestionResult(input),
        productStatusLabel: "Queue evidence ingestion failed",
        status: "failed",
      }),
      runDetail: runDetail("run-failed", "completed"),
    });

    expect(unavailable.status).toBe("ingestion_unavailable");
    expect(invalidEvidence.status).toBe("evidence_invalid");
    expect(brokerFailed.status).toBe("broker_failed");
  });

  it("contains no execution, Git, rollback, scheduler, duplicate Queue, or prompt-regex hooks", () => {
    expect(wiringSource).not.toContain("runCodexDirectWork(");
    expect(wiringSource).not.toContain("startCodexDirectWorkStream");
    expect(wiringSource).not.toContain("workspace.shell");
    expect(wiringSource).not.toContain("launchTerminal");
    expect(wiringSource).not.toContain("mutateGit");
    expect(wiringSource).not.toContain("createGitCommit");
    expect(wiringSource).not.toContain("executeRollback");
    expect(wiringSource).not.toContain("startAssignedAgentQueueTask");
    expect(wiringSource).not.toContain("createQueueView");
    expect(wiringSource).not.toContain("new RegExp");
    expect(wiringSource).not.toContain(".match(");
    expect(workspaceAgentDirectWorkSource).not.toContain(
      "onIngestQueueLinkedDirectWorkEvidence",
    );
    expect(workspaceAgentDirectWorkSource).not.toContain(
      "ingestQueueLinkedDirectWorkCompletionEvidence",
    );
    expect(agentActivitySource).not.toContain(
      "onIngestQueueLinkedDirectWorkEvidence",
    );
    expect(agentActivitySource).not.toContain(
      "ingestQueueLinkedDirectWorkCompletionEvidence",
    );
    expect(executorHistorySource).not.toContain(
      "onIngestQueueLinkedDirectWorkEvidence",
    );
    expect(executorHistorySource).not.toContain(
      "ingestQueueLinkedDirectWorkCompletionEvidence",
    );
  });
});

function successIngestionResult(
  input: QueueLinkedAgentExecutorIngestionInput,
): QueueWorkerEvidenceIngestionResult {
  const taskId = input.taskId ?? "";
  const evidenceBundle = createEvidenceBundleFromAgentExecutorRunDetail({
    attemptId: input.attemptId,
    detail: input.detail,
    logReference: input.logReference,
    taskId,
    threadId: input.threadId,
    workerId: input.workerId,
  });

  return {
    activityTitle: "Queue worker evidence ingested",
    dryRun: false,
    evidenceBundle,
    evidenceSummary: evidenceBundle.summary.humanSummary,
    lifecycleOutput: {
      activityEventNames: [],
      dryRunOnly: false,
      queueMutation: "frontend_controller_overlay",
      reviewOutcome: evidenceBundle.outcome,
      taskId,
      ticketState: "awaiting_review",
      wouldAutoRunWorkers: false,
      wouldCallGit: false,
      wouldExecuteRollback: false,
      wouldLaunchTerminal: false,
      wouldPersistBackend: false,
      wouldRunValidation: false,
      wouldStartWorkers: false,
    } as unknown as QueueWorkerEvidenceIngestionResult["lifecycleOutput"],
    message: "Queue item moved to awaiting review.",
    productStatusLabel: "Queue item awaiting review",
    reasons: [],
    status: "success",
    taskId,
  };
}

function streamEvent(
  runId: string,
  eventKind: DirectWorkStreamEvent["eventKind"],
  isFinal: boolean,
  codexThreadId: string | null = null,
): DirectWorkStreamEvent {
  return {
    codexThreadId,
    elapsedMs: 100,
    errorMessage: null,
    eventKind,
    exitCode: eventKind === "completed" ? 0 : null,
    failedStage: null,
    finalStatus: null,
    isFinal,
    line: null,
    parsedCodexEventType: null,
    runId,
    status: eventKind,
    stderrPreview: null,
    text: null,
    widgetInstanceId: "executor-1",
    workbenchId: "workbench-1",
    workspaceId: "workspace-1",
  };
}

function runDetail(
  runId: string,
  status: string,
  overrides: Partial<AgentExecutorRunDetail> = {},
): AgentExecutorRunDetail {
  return {
    changedFilesSummary: null,
    errorMessage: null,
    finalMessage: "done",
    logs: [],
    resultContent: "done",
    resultId: "result-1",
    resultPayload: JSON.stringify({ status }),
    resultStatus: status,
    resultSummary: "done",
    stderrPreview: "",
    stdoutPreview: "",
    validationProfile: null,
    validationStatus: null,
    ...overrides,
    summary: {
      commandKind: "codex_direct_work",
      durationMs: 1000,
      finishedAt: "2026-06-16T10:00:01.000Z",
      hasResult: true,
      logCount: 1,
      mode: "direct_work",
      repoRoot: "/repo",
      resultType: "codex_direct_work",
      runId,
      startedAt: "2026-06-16T10:00:00.000Z",
      status,
      title: "Queue task",
      validationProfile: null,
      validationStatus: null,
      ...overrides.summary,
    },
  };
}
