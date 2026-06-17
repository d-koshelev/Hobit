import { act } from "react";
import { describe, expect, it, vi } from "vitest";

import type {
  AgentExecutorRunDetail,
  DirectWorkStreamEvent,
} from "../../workspace/types";
import type { DirectWorkRunHandoff } from "../types";
import type { QueueWorkerEvidenceIngestionResult } from "../queue/smartQueueWorkerEvidenceIngestion";
import {
  flushHookEffects,
  renderHook,
} from "../test-utils/renderHook";
import { useAgentExecutorController } from "./useAgentExecutorController";

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

describe("useAgentExecutorController Queue handoff finalization", () => {
  it("ingests Queue-linked evidence without requesting Git review", async () => {
    const gitReviewRequested = vi.fn();
    const ingestEvidence = vi.fn(async () => successIngestionResult());
    let attachedEventHandler: ((event: DirectWorkStreamEvent) => void) | null =
      null;

    const hook = renderHook(
      () =>
        useAgentExecutorController({
          directWorkRunHandoff: baseHandoff,
          onAttachToCodexDirectWorkStream: async (
            _widgetInstanceId,
            _runId,
            onEvent,
          ) => {
            attachedEventHandler = onEvent;
            return {
              runId: "run-1",
              status: "running",
              stopListening: () => undefined,
            };
          },
          onDirectWorkGitReviewRequested: gitReviewRequested,
          onGetAgentExecutorRunDetail: async (_widgetInstanceId, runId) =>
            runDetail(runId, "completed"),
          onIngestQueueLinkedDirectWorkEvidence: ingestEvidence,
          widgetInstanceId: "executor-1",
        }),
      undefined,
    );

    await flushHookEffects();

    await act(async () => {
      attachedEventHandler?.(streamEvent("run-1", "completed", true));
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(ingestEvidence).toHaveBeenCalledTimes(1);
    expect(gitReviewRequested).not.toHaveBeenCalled();

    hook.unmount();
  });
});

function successIngestionResult(): QueueWorkerEvidenceIngestionResult {
  return {
    activityTitle: "Queue worker evidence ingested",
    dryRun: false,
    message: "Queue item moved to awaiting review.",
    productStatusLabel: "Queue item awaiting review",
    reasons: [],
    status: "success",
    taskId: "queue-1",
  };
}

function streamEvent(
  runId: string,
  eventKind: DirectWorkStreamEvent["eventKind"],
  isFinal: boolean,
): DirectWorkStreamEvent {
  return {
    codexThreadId: null,
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
    },
    validationProfile: null,
    validationStatus: null,
  };
}
