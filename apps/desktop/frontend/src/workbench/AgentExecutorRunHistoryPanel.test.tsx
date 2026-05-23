import { act } from "react";
import type { ComponentProps } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

import { AgentExecutorRunHistoryPanel } from "./AgentExecutorRunHistoryPanel";
import type {
  AgentExecutorRunDetail,
  AgentExecutorRunHistory,
  AgentExecutorRunSummary,
} from "../workspace/types";

let root: Root | null = null;
let container: HTMLDivElement | null = null;

afterEach(() => {
  if (root && container) {
    act(() => {
      root?.unmount();
    });
    container.remove();
  }
  root = null;
  container = null;
  vi.restoreAllMocks();
});

describe("AgentExecutorRunHistoryPanel open-run detail handoff", () => {
  it("loads the requested run detail inside the Executor-owned UI", async () => {
    const onListAgentExecutorRuns = vi
      .fn()
      .mockResolvedValue(runHistory([runSummary("run_safe_123456")]));
    const onGetAgentExecutorRunDetail = vi
      .fn()
      .mockResolvedValue(runDetail("run_safe_123456"));

    await renderPanel({
      onGetAgentExecutorRunDetail,
      onListAgentExecutorRuns,
      openRunDetailRequest: {
        executorWidgetInstanceId: "executor_visible",
        id: 1,
        runId: "run_safe_123456",
      },
    });

    expect(onGetAgentExecutorRunDetail).toHaveBeenCalledWith(
      "executor_visible",
      "run_safe_123456",
    );
    expect(document.body.textContent).toContain("Executor-owned final response");
    expect(
      document.querySelector(".agent-executor-history-item-selected")
        ?.textContent,
    ).toContain("Requested run");
  });

  it("ignores open requests for another Executor widget", async () => {
    const onListAgentExecutorRuns = vi
      .fn()
      .mockResolvedValue(runHistory([runSummary("run_safe_123456")]));
    const onGetAgentExecutorRunDetail = vi
      .fn()
      .mockResolvedValue(runDetail("run_safe_123456"));

    await renderPanel({
      onGetAgentExecutorRunDetail,
      onListAgentExecutorRuns,
      openRunDetailRequest: {
        executorWidgetInstanceId: "executor_other",
        id: 1,
        runId: "run_safe_123456",
      },
    });

    expect(onGetAgentExecutorRunDetail).not.toHaveBeenCalled();
    expect(document.body.textContent).toContain(
      "Select a stored run to inspect",
    );
  });
});

async function renderPanel(
  overrides: Partial<
    ComponentProps<typeof AgentExecutorRunHistoryPanel>
  > = {},
) {
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);

  await act(async () => {
    root?.render(
      <AgentExecutorRunHistoryPanel
        onGetAgentExecutorRunDetail={vi.fn()}
        onListAgentExecutorRuns={vi.fn().mockResolvedValue(runHistory([]))}
        refreshToken={0}
        widgetInstanceId="executor_visible"
        {...overrides}
      />,
    );
  });
  await act(async () => {});
}

function runHistory(runs: AgentExecutorRunSummary[]): AgentExecutorRunHistory {
  return {
    runs,
    widgetInstanceId: "executor_visible",
    workbenchId: "wb_1",
    workspaceId: "ws_1",
  };
}

function runSummary(runId: string): AgentExecutorRunSummary {
  return {
    commandKind: "codex_direct_work",
    durationMs: 1200,
    finishedAt: "2026-05-22T10:01:00.000Z",
    hasResult: true,
    logCount: 2,
    mode: "direct_work",
    repoRoot: null,
    resultType: "codex_direct_work",
    runId,
    startedAt: "2026-05-22T10:00:00.000Z",
    status: "completed",
    title: "Requested run",
    validationProfile: null,
    validationStatus: null,
  };
}

function runDetail(runId: string): AgentExecutorRunDetail {
  return {
    changedFilesSummary: null,
    errorMessage: null,
    finalMessage: "Executor-owned final response",
    logs: [],
    resultContent: null,
    resultId: "result_1",
    resultPayload: null,
    resultStatus: "completed",
    resultSummary: null,
    stderrPreview: null,
    stdoutPreview: null,
    summary: runSummary(runId),
    validationProfile: null,
    validationStatus: null,
  };
}
