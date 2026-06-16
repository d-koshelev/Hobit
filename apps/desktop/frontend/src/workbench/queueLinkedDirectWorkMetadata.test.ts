import { describe, expect, it } from "vitest";

import type {
  AgentExecutorRunDetail,
  DirectWorkStreamEvent,
} from "../workspace/types";
import type { DirectWorkRunHandoff } from "./types";
import metadataSource from "./queueLinkedDirectWorkMetadata.ts?raw";
import {
  assertQueueLinkedRunDetailMatches,
  createQueueLinkedDirectWorkCompletionIdentity,
  createQueueLinkedDirectWorkMetadata,
  getQueueLinkedDirectWorkHumanSummary,
  getQueueLinkedDirectWorkIngestionKey,
  isQueueLinkedDirectWorkMetadata,
  validateQueueLinkedDirectWorkMetadata,
  withQueueLinkedDirectWorkMetadata,
} from "./queueLinkedDirectWorkMetadata";

const baseHandoff: DirectWorkRunHandoff = {
  executorWidgetInstanceId: "executor-1",
  id: 1,
  queueItemId: "queue-1",
  repoRoot: "/repo",
  runId: "run-1",
  startedAt: "2026-05-20T10:00:00.000Z",
  taskTitle: "Queue task",
  workbenchId: "workbench-1",
  workspaceId: "workspace-1",
};

describe("queueLinkedDirectWorkMetadata", () => {
  it("creates explicit Queue-linked Direct Work metadata from handoff identifiers", () => {
    const handoff = withQueueLinkedDirectWorkMetadata({
      ...baseHandoff,
      queueLinkedSource: "queue_manual_start",
    });

    expect(handoff.queueLinkedMetadata).toMatchObject({
      attemptId: null,
      durable: false,
      executorWidgetId: "executor-1",
      frontendOnly: true,
      kind: "queue_linked_direct_work_metadata",
      queueItemId: "queue-1",
      runId: "run-1",
      source: "queue_manual_start",
      version: 1,
      workbenchId: "workbench-1",
      workspaceId: "workspace-1",
    });
    expect(handoff.queueLinkedMetadata?.idempotencyKey).toBe(
      handoff.queueLinkedMetadata?.ingestionId,
    );
    expect(isQueueLinkedDirectWorkMetadata(handoff.queueLinkedMetadata)).toBe(
      true,
    );
  });

  it("rejects incomplete explicit Queue-linked metadata without inferring task identity", () => {
    expect(
      createQueueLinkedDirectWorkMetadata({
        executorWidgetId: "executor-1",
        queueItemId: " ",
        runId: "run-1",
      }),
    ).toMatchObject({ status: "not_queue_linked" });
    expect(
      createQueueLinkedDirectWorkMetadata({
        executorWidgetId: "executor-1",
        queueItemId: "queue-1",
        runId: " ",
      }),
    ).toMatchObject({ status: "missing_run_id" });
    expect(
      createQueueLinkedDirectWorkMetadata({
        executorWidgetId: " ",
        queueItemId: "queue-1",
        runId: "run-1",
      }),
    ).toMatchObject({ status: "missing_executor_widget" });

    const textOnlyResult = createQueueLinkedDirectWorkMetadata({
      executorWidgetId: "executor-1",
      queueItemId: "",
      runId: "run-1",
      taskTitle: "Queue task queue-1",
      finalAgentMessage: "Completed task queue-1.",
      prompt: "Run queue-1.",
      repoRoot: "/repo/queue-1",
    } as unknown as Parameters<typeof createQueueLinkedDirectWorkMetadata>[0]);

    expect(textOnlyResult.status).toBe("not_queue_linked");
  });

  it("validates metadata shape and stable key consistency", () => {
    const result = createQueueLinkedDirectWorkMetadata({
      attemptId: "attempt-1",
      executorWidgetId: "executor-1",
      queueItemId: "queue-1",
      runId: "run-1",
      workspaceId: "workspace-1",
    });

    expect(result.status).toBe("valid");
    if (result.status !== "valid") {
      throw new Error("metadata was not valid");
    }

    expect(validateQueueLinkedDirectWorkMetadata(result.metadata)).toMatchObject({
      status: "valid",
    });
    expect(
      validateQueueLinkedDirectWorkMetadata({
        ...result.metadata,
        idempotencyKey: "different",
      }),
    ).toMatchObject({ status: "invalid" });
    expect(
      validateQueueLinkedDirectWorkMetadata({
        ...result.metadata,
        durable: true,
      }),
    ).toMatchObject({ status: "invalid" });
    expect(
      validateQueueLinkedDirectWorkMetadata({
        ...result.metadata,
        source: "prompt_text_route",
      }),
    ).toMatchObject({ status: "invalid" });
  });

  it("builds stable current-session idempotency keys only from explicit link fields", () => {
    const key = getQueueLinkedDirectWorkIngestionKey({
      queueItemId: "queue-1",
      runId: "run-1",
      workspaceId: "workspace-1",
    });

    expect(
      getQueueLinkedDirectWorkIngestionKey({
        queueItemId: "queue-1",
        runId: "run-1",
        workspaceId: "workspace-1",
      }),
    ).toBe(key);
    expect(
      getQueueLinkedDirectWorkIngestionKey({
        queueItemId: "queue-1",
        runId: "run-2",
        workspaceId: "workspace-1",
      }),
    ).not.toBe(key);
    expect(
      getQueueLinkedDirectWorkIngestionKey({
        queueItemId: "queue-2",
        runId: "run-1",
        workspaceId: "workspace-1",
      }),
    ).not.toBe(key);
    expect(
      getQueueLinkedDirectWorkIngestionKey({
        attemptId: "attempt-1",
        queueItemId: "queue-1",
        runId: "run-1",
        workspaceId: "workspace-1",
      }),
    ).not.toBe(key);

    const withPromptLikeText = createQueueLinkedDirectWorkMetadata({
      executorWidgetId: "executor-1",
      queueItemId: "queue-1",
      runId: "run-1",
      taskTitle: "Different title",
      finalAgentMessage: "Different final message",
      prompt: "Different prompt",
      repoRoot: "/different/path",
      workspaceId: "workspace-1",
    } as unknown as Parameters<typeof createQueueLinkedDirectWorkMetadata>[0]);

    expect(withPromptLikeText.status).toBe("valid");
    if (withPromptLikeText.status === "valid") {
      expect(withPromptLikeText.metadata.idempotencyKey).toBe(key);
    }
  });

  it("creates a bounded product-facing human summary", () => {
    const handoff = withQueueLinkedDirectWorkMetadata({
      ...baseHandoff,
      queueItemId: "queue-item-with-a-long-but-explicit-identifier",
      runId: "run-with-a-long-but-explicit-identifier",
    });

    const summary = getQueueLinkedDirectWorkHumanSummary(
      handoff.queueLinkedMetadata!,
      120,
    );

    expect(summary.length).toBeLessThanOrEqual(120);
    expect(summary).toContain("Queue-linked Direct Work run");
    expect(summary).toContain("Frontend-only metadata, not durable");
  });

  it("accepts matching run detail and rejects mismatched run detail", () => {
    const match = assertQueueLinkedRunDetailMatches(
      baseHandoff,
      runDetail("run-1", "completed"),
    );

    expect(match).toMatchObject({
      status: "valid",
      identity: {
        detailRunId: "run-1",
        queueItemId: "queue-1",
        runId: "run-1",
      },
    });

    expect(
      assertQueueLinkedRunDetailMatches(
        baseHandoff,
        runDetail("other-run", "completed"),
      ),
    ).toMatchObject({ status: "run_mismatch" });
    expect(assertQueueLinkedRunDetailMatches(baseHandoff, null)).toMatchObject({
      status: "invalid",
    });
  });

  it("creates finalization identity only from explicit Queue-linked handoff metadata", () => {
    expect(
      createQueueLinkedDirectWorkCompletionIdentity({
        streamEvent: streamEvent("run-1", "completed", true),
      }),
    ).toMatchObject({ status: "not_queue_linked" });

    expect(
      createQueueLinkedDirectWorkCompletionIdentity({
        handoff: baseHandoff,
        streamEvent: streamEvent("run-1", "completed", true),
      }),
    ).toMatchObject({
      status: "valid",
      identity: {
        finalStatus: "completed",
        queueItemId: "queue-1",
        runId: "run-1",
        streamRunId: "run-1",
      },
    });

    expect(
      createQueueLinkedDirectWorkCompletionIdentity({
        handoff: baseHandoff,
        streamEvent: streamEvent("other-run", "completed", true),
      }),
    ).toMatchObject({ status: "run_mismatch" });
    expect(
      createQueueLinkedDirectWorkCompletionIdentity({
        handoff: baseHandoff,
        streamEvent: streamEvent("run-1", "started", false),
      }),
    ).toMatchObject({ status: "invalid" });
  });

  it("contains no ingestion, execution, mutation, rollback, or prompt-regex hooks", () => {
    expect(metadataSource).not.toContain("smartQueueWorkerEvidenceIngestion");
    expect(metadataSource).not.toContain("queue.lifecycle.agentFinished");
    expect(metadataSource).not.toContain("onStartCodexDirectWorkStream");
    expect(metadataSource).not.toContain("onRunCodexDirectWork");
    expect(metadataSource).not.toContain("onRunDirectWorkValidation");
    expect(metadataSource).not.toContain("createGitCommit");
    expect(metadataSource).not.toContain("rollback");
    expect(metadataSource).not.toContain("Terminal");
    expect(metadataSource).not.toContain("new RegExp");
    expect(metadataSource).not.toContain(".match(");
  });
});

function streamEvent(
  runId: string,
  eventKind: DirectWorkStreamEvent["eventKind"],
  isFinal: boolean,
): DirectWorkStreamEvent {
  return {
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

function runDetail(runId: string, status: string): AgentExecutorRunDetail {
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
    summary: {
      commandKind: "codex_direct_work",
      durationMs: 1000,
      finishedAt: "2026-05-20T10:00:01.000Z",
      hasResult: true,
      logCount: 1,
      mode: "direct_work",
      repoRoot: "/repo",
      resultType: "codex_direct_work",
      runId,
      startedAt: "2026-05-20T10:00:00.000Z",
      status,
      title: "Queue task",
      validationProfile: null,
      validationStatus: null,
    },
    validationProfile: null,
    validationStatus: null,
  };
}
