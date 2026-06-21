import { describe, expect, it, vi } from "vitest";

import type { DirectWorkStreamEvent } from "../../workspace/types";
import mappingSource from "../queue/workerProviderEvidenceMapping.ts?raw";
import {
  mapWorkerProviderFinalResultToQueueEvidenceIngestion,
} from "../queue/workerProviderEvidenceMapping";
import workerProviderSource from "./workerProvider.ts?raw";
import fakeWorkerProviderSource from "./fakeWorkerProvider.ts?raw";
import codexWorkerProviderAdapterSource from "./codexWorkerProviderAdapter.ts?raw";
import {
  CODEX_WORKER_PROVIDER_ID,
  createCodexWorkerProvider,
  createFakeWorkerProvider,
  fakeWorkerProviderScriptForScenario,
  type WorkerProviderEvent,
  type WorkerProviderFinalResult,
  type WorkerProviderWorkRequest,
} from ".";

describe("WorkerProvider", () => {
  it("fake provider emits a completed worker run with normalized evidence", async () => {
    const provider = createFakeWorkerProvider({
      providerRunId: "provider-run-1",
      runId: "run-1",
      script: fakeWorkerProviderScriptForScenario("completed_with_evidence"),
    });
    const events: WorkerProviderEvent[] = [];

    const handle = await provider.startWork(workerRequest(), (event) =>
      events.push(event),
    );

    expect(handle).toMatchObject({
      providerRunId: "provider-run-1",
      runId: "run-1",
      taskId: "task-1",
    });
    expect(events.map((event) => event.type)).toEqual([
      "worker_run_started",
      "worker_log_delta",
      "worker_output_delta",
      "worker_evidence_available",
      "worker_completed",
    ]);
    expect(events[3]).toMatchObject({
      evidence: {
        status: "completed",
      },
      taskId: "task-1",
    });
    expect(events[4]).toMatchObject({
      result: {
        status: "completed",
        taskId: "task-1",
      },
      type: "worker_completed",
    });
    await expect(provider.getRun?.("run-1")).resolves.toMatchObject({
      finalResult: { status: "completed" },
      status: "completed",
    });
  });

  it("fake provider emits a failed worker run with normalized evidence", async () => {
    const provider = createFakeWorkerProvider({
      runId: "run-failed",
      script: fakeWorkerProviderScriptForScenario("failed_with_evidence"),
    });
    const events: WorkerProviderEvent[] = [];

    await provider.startWork(workerRequest(), (event) => events.push(event));

    expect(events.map((event) => event.type)).toEqual([
      "worker_run_started",
      "worker_log_delta",
      "worker_evidence_available",
      "worker_failed",
    ]);
    expect(events[events.length - 1]).toMatchObject({
      result: {
        failureReason: "Fake validation failed.",
        status: "failed",
      },
      type: "worker_failed",
    });
  });

  it("fake provider covers cancellation stopped and provider error paths", async () => {
    const scenarios = ["cancelled", "stopped", "provider_error"] as const;

    for (const scenario of scenarios) {
      const events: WorkerProviderEvent[] = [];
      await createFakeWorkerProvider({
        runId: `run-${scenario}`,
        script: fakeWorkerProviderScriptForScenario(scenario),
      }).startWork(workerRequest({ id: scenario }), (event) =>
        events.push(event),
      );

      expect(events[0]).toMatchObject({ type: "worker_run_started" });
      expect(events[events.length - 1]?.type).toBe(
        scenario === "provider_error"
          ? "worker_error"
          : scenario === "cancelled"
            ? "worker_cancelled"
            : "worker_stopped",
      );
    }
  });

  it("maps WorkerProvider final results to Queue worker evidence ingestion shape without UI", () => {
    const result: WorkerProviderFinalResult = {
      changedFiles: [
        {
          additions: 4,
          deletions: 1,
          path: "apps/desktop/frontend/src/workbench/agentRuntime/workerProvider.ts",
          status: "modified",
        },
      ],
      completedAtMs: Date.parse("2026-06-21T08:10:00.000Z"),
      evidenceBundleId: "bundle-1",
      executorWidgetId: "executor-1",
      finalMessage: "Worker completed the implementation.",
      providerId: "fake-worker-provider",
      providerMetadata: {
        model: "fake-worker",
      },
      providerRunId: "provider-run-1",
      providerThreadId: "provider-thread-1",
      runId: "run-1",
      startedAtMs: Date.parse("2026-06-21T08:00:00.000Z"),
      status: "completed",
      summary: "Completed with one changed file.",
      taskId: "task-1",
      validation: {
        exitCode: 0,
        outputPreview: "typecheck passed",
        status: "passed",
        summary: "typecheck passed",
      },
      workerId: "worker-1",
    };

    const mapping = mapWorkerProviderFinalResultToQueueEvidenceIngestion(
      result,
      { requestId: "request-1" },
    );

    expect(mapping).toMatchObject({
      evidenceBundleId: "bundle-1",
      ingestionInput: {
        changedFiles: [
          {
            path: "apps/desktop/frontend/src/workbench/agentRuntime/workerProvider.ts",
            status: "modified",
          },
        ],
        completedAt: "2026-06-21T08:10:00.000Z",
        finalAgentMessage: "Worker completed the implementation.",
        outcome: "completed",
        providerId: "fake-worker-provider",
        requestId: "request-1",
        runId: "run-1",
        startedAt: "2026-06-21T08:00:00.000Z",
        taskId: "task-1",
        threadId: "provider-thread-1",
        validationStatus: "passed",
        workerId: "worker-1",
      },
      providerMetadata: {
        evidenceBundleId: "bundle-1",
        providerId: "fake-worker-provider",
        providerRunId: "provider-run-1",
        providerThreadId: "provider-thread-1",
        workerStatus: "completed",
      },
    });
  });

  it("wraps Codex Direct Work as a WorkerProvider without changing Queue start behavior", async () => {
    const startCodexDirectWorkStream = vi.fn(
      async (
        _widgetInstanceId: string,
        _request: unknown,
        onEvent: (event: DirectWorkStreamEvent) => void,
      ) => {
        onEvent(streamEvent({ eventKind: "started" }));
        onEvent(streamEvent({ eventKind: "stdout_line", line: "working" }));
        onEvent(
          streamEvent({
            eventKind: "completed",
            finalStatus: "completed",
            isFinal: true,
            text: "Done.",
          }),
        );
        return {
          runId: "codex-run-1",
          status: "started",
          stopListening: vi.fn(),
        };
      },
    );
    const provider = createCodexWorkerProvider({
      codexExecutable: "codex.cmd",
      startCodexDirectWorkStream,
    });
    const events: WorkerProviderEvent[] = [];

    const handle = await provider.startWork(
      workerRequest({ providerThreadId: "codex-thread-1" }),
      (event) => events.push(event),
    );

    expect(provider.providerId).toBe(CODEX_WORKER_PROVIDER_ID);
    expect(handle?.runId).toBe("codex-run-1");
    expect(startCodexDirectWorkStream).toHaveBeenCalledWith(
      "executor-1",
      expect.objectContaining({
        approvalPolicy: "never",
        codexExecutable: "codex.cmd",
        codexThreadId: "codex-thread-1",
        operatorPrompt: "Implement the explicit Queue task.",
        repoRoot: "C:/repo",
        sandbox: "workspace_write",
      }),
      expect.any(Function),
      undefined,
    );
    expect(events.map((event) => event.type)).toEqual([
      "worker_run_started",
      "worker_output_delta",
      "worker_evidence_available",
      "worker_completed",
    ]);
    expect(events[events.length - 1]).toMatchObject({
      result: {
        providerRunId: "codex-run-1",
        status: "completed",
        taskId: "task-1",
      },
    });
  });

  it("keeps WorkerProvider files independent from Queue UI and visual shell modules", () => {
    const sources = [
      workerProviderSource,
      fakeWorkerProviderSource,
      codexWorkerProviderAdapterSource,
      mappingSource,
    ];
    const forbiddenFragments = [
      "AgentQueueV2Board",
      "AgentQueuePlaceholderWidget",
      "queueV2/",
      "QueueV2",
      "ModuleShell",
      "tokens.css",
      "widget.css",
    ];

    for (const source of sources) {
      for (const fragment of forbiddenFragments) {
        expect(source).not.toContain(fragment);
      }
    }
  });

  it("does not add hidden worker auto-start, scheduler, or prose routing hooks", () => {
    const sources = [
      workerProviderSource,
      fakeWorkerProviderSource,
      codexWorkerProviderAdapterSource,
      mappingSource,
    ];
    const forbiddenFragments = [
      "startAssignedAgentQueueTask",
      "startQueueLinkedRun",
      "runAutonomousQueue",
      "setInterval(",
      "new RegExp",
      ".match(",
      "queue.item.startRun",
    ];

    for (const source of sources) {
      for (const fragment of forbiddenFragments) {
        expect(source).not.toContain(fragment);
      }
    }
  });
});

function workerRequest(
  overrides: Partial<WorkerProviderWorkRequest> = {},
): WorkerProviderWorkRequest {
  return {
    approvalPolicy: "never",
    createdAtMs: Date.parse("2026-06-21T08:00:00.000Z"),
    executionWorkspace: "C:/repo",
    executorWidgetId: "executor-1",
    id: "worker-request-1",
    prompt: "Implement the explicit Queue task.",
    providerThreadId: null,
    sandbox: "workspace_write",
    source: "queue_manual_start",
    taskId: "task-1",
    workbenchId: "workbench-1",
    workerId: "worker-1",
    workspaceId: "workspace-1",
    ...overrides,
  };
}

function streamEvent(
  overrides: Partial<DirectWorkStreamEvent> = {},
): DirectWorkStreamEvent {
  return {
    codexThreadId: null,
    elapsedMs: 100,
    errorMessage: null,
    eventKind: "started",
    exitCode: null,
    failedStage: null,
    finalStatus: null,
    isFinal: false,
    line: null,
    parsedCodexEventType: null,
    runId: "codex-run-1",
    status: "running",
    stderrPreview: null,
    text: null,
    widgetInstanceId: "executor-1",
    workbenchId: "workbench-1",
    workspaceId: "workspace-1",
    ...overrides,
  };
}
