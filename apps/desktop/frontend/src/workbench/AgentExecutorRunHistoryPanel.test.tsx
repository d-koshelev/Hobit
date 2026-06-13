import { act } from "react";
import type { ComponentProps } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

import { AgentExecutorRunHistoryPanel } from "./AgentExecutorRunHistoryPanel";
import {
  AGENT_EXECUTOR_SELECTED_EXCERPT_LIMIT,
  boundAgentExecutorSelectedExcerpt,
} from "./executor/agentExecutorSelectedExcerpt";
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

  it("attaches safe Executor history metadata without raw run detail", async () => {
    const onAttachContextToCoordinator = vi.fn();

    await renderPanel({
      onAttachContextToCoordinator,
      onListAgentExecutorRuns: vi
        .fn()
        .mockResolvedValue(runHistory([runSummary("run_safe_123456")])),
    });

    clickButtonAt("Attach to Workspace Agent", 0);

    expect(onAttachContextToCoordinator).toHaveBeenCalledTimes(1);
    const request = onAttachContextToCoordinator.mock.calls[0][0];
    expect(request.sourceLabel).toBe("Executor run history row");
    expect(request.contextText).toContain("Executor run metadata");
    expect(request.contextText).toContain("run_safe_123456");
    expect(request.contextText).toContain("Status: completed");
    expect(request.contextText).not.toContain("Executor-owned final response");
    expect(request.contextText).not.toMatch(
      /stdout|stderr|final response|diff|repoRoot|repo_root|payload|secret/i,
    );
  });

  it("attaches safe Executor detail metadata without raw output fields", async () => {
    const onAttachContextToCoordinator = vi.fn();

    await renderPanel({
      onAttachContextToCoordinator,
      onGetAgentExecutorRunDetail: vi
        .fn()
        .mockResolvedValue(runDetail("run_safe_123456")),
      onListAgentExecutorRuns: vi
        .fn()
        .mockResolvedValue(runHistory([runSummary("run_safe_123456")])),
      openRunDetailRequest: {
        executorWidgetInstanceId: "executor_visible",
        id: 1,
        runId: "run_safe_123456",
      },
    });

    clickButtonAt("Attach to Workspace Agent", 1);

    expect(onAttachContextToCoordinator).toHaveBeenCalledTimes(1);
    const request = onAttachContextToCoordinator.mock.calls[0][0];
    expect(request.sourceLabel).toBe("Executor run detail");
    expect(request.contextText).toContain("Executor run metadata");
    expect(request.contextText).toContain("Result status: completed");
    expect(request.contextText).not.toContain("Executor-owned final response");
    expect(request.contextText).not.toMatch(
      /stdout|stderr|final response|diff|repoRoot|repo_root|payload|secret/i,
    );
  });

  it("attaches only selected visible Executor detail text", async () => {
    const onAttachContextToCoordinator = vi.fn();

    await renderPanel({
      onAttachContextToCoordinator,
      onGetAgentExecutorRunDetail: vi
        .fn()
        .mockResolvedValue(runDetail("run_safe_123456")),
      onListAgentExecutorRuns: vi
        .fn()
        .mockResolvedValue(runHistory([runSummary("run_safe_123456")])),
      openRunDetailRequest: {
        executorWidgetInstanceId: "executor_visible",
        id: 1,
        runId: "run_safe_123456",
      },
    });

    selectVisibleText("Executor-owned final response");
    clickButtonAt("Attach selected excerpt", 0);

    expect(onAttachContextToCoordinator).toHaveBeenCalledTimes(1);
    const request = onAttachContextToCoordinator.mock.calls[0][0];
    expect(request.sourceLabel).toBe("Executor selected excerpt");
    expect(request.contextText).toContain("Executor selected excerpt");
    expect(request.contextText).toContain("Run: run_safe_123456");
    expect(request.contextText).toContain("Excerpt:");
    expect(request.contextText).toContain("Executor-owned final response");
    expect(request.contextText).not.toContain("stdout secret");
    expect(request.contextText).not.toContain("hidden raw payload");
  });

  it("attaches the visible final response preview without hidden raw detail", async () => {
    const onAttachContextToCoordinator = vi.fn();
    const hiddenTail = "hidden final response tail";

    await renderPanel({
      onAttachContextToCoordinator,
      onGetAgentExecutorRunDetail: vi.fn().mockResolvedValue(
        runDetail("run_safe_123456", {
          finalMessage: `${"a".repeat(3050)}${hiddenTail}`,
          resultPayload: "hidden raw payload",
          stdoutPreview: "hidden stdout should not attach",
          stderrPreview: "hidden stderr should not attach",
        }),
      ),
      onListAgentExecutorRuns: vi
        .fn()
        .mockResolvedValue(runHistory([runSummary("run_safe_123456")])),
      openRunDetailRequest: {
        executorWidgetInstanceId: "executor_visible",
        id: 1,
        runId: "run_safe_123456",
      },
    });

    clickButtonAt("Attach response", 0);

    expect(onAttachContextToCoordinator).toHaveBeenCalledTimes(1);
    const request = onAttachContextToCoordinator.mock.calls[0][0];
    expect(request.sourceLabel).toBe("Executor Final response preview");
    expect(request.contextText).toContain("Executor visible preview");
    expect(request.contextText).toContain("Run: run_safe_123456");
    expect(request.contextText).toContain("Section: Final response preview");
    expect(request.contextText).toContain("Status: completed");
    expect(request.contextText).toContain("[Preview truncated in UI.]");
    expect(request.contextText).not.toContain(hiddenTail);
    expect(request.contextText).not.toContain("hidden stdout should not attach");
    expect(request.contextText).not.toContain("hidden stderr should not attach");
    expect(request.contextText).not.toContain("hidden raw payload");
  });

  it("attaches stdout, stderr, and validation previews from visible preview text only", async () => {
    const onAttachContextToCoordinator = vi.fn();

    await renderPanel({
      onAttachContextToCoordinator,
      onGetAgentExecutorRunDetail: vi.fn().mockResolvedValue(
        runDetail("run_validation_123456", {
          finalMessage: "final response should stay out",
          stderrPreview: "validation stderr visible",
          stdoutPreview: "validation stdout visible",
          summary: runSummary("run_validation_123456", {
            commandKind: "direct_work_validation",
            mode: "direct_work_validation",
            title: "Validation failed",
            validationProfile: "changed",
            validationStatus: "failed",
          }),
          validationProfile: "changed",
          validationStatus: "failed",
        }),
      ),
      onListAgentExecutorRuns: vi
        .fn()
        .mockResolvedValue(runHistory([runSummary("run_validation_123456")])),
      openRunDetailRequest: {
        executorWidgetInstanceId: "executor_visible",
        id: 1,
        runId: "run_validation_123456",
      },
    });

    clickButtonAt("Attach stdout", 0);
    clickButtonAt("Attach stderr", 0);
    clickButtonAt("Attach validation", 0);

    expect(onAttachContextToCoordinator).toHaveBeenCalledTimes(3);
    const stdoutRequest = onAttachContextToCoordinator.mock.calls[0][0];
    const stderrRequest = onAttachContextToCoordinator.mock.calls[1][0];
    const validationRequest = onAttachContextToCoordinator.mock.calls[2][0];

    expect(stdoutRequest.contextText).toContain("Section: stdout preview");
    expect(stdoutRequest.contextText).toContain("validation stdout visible");
    expect(stdoutRequest.contextText).not.toContain("validation stderr visible");
    expect(stdoutRequest.contextText).not.toContain(
      "final response should stay out",
    );

    expect(stderrRequest.contextText).toContain("Section: stderr preview");
    expect(stderrRequest.contextText).toContain("validation stderr visible");
    expect(stderrRequest.contextText).not.toContain("validation stdout visible");
    expect(stderrRequest.contextText).not.toContain(
      "final response should stay out",
    );

    expect(validationRequest.contextText).toContain(
      "Section: Validation output preview",
    );
    expect(validationRequest.contextText).toContain("stdout preview:");
    expect(validationRequest.contextText).toContain("validation stdout visible");
    expect(validationRequest.contextText).toContain("stderr preview:");
    expect(validationRequest.contextText).toContain("validation stderr visible");
    expect(validationRequest.contextText).not.toContain(
      "final response should stay out",
    );
  });

  it("does not show section attach actions for empty preview sections", async () => {
    await renderPanel({
      onAttachContextToCoordinator: vi.fn(),
      onGetAgentExecutorRunDetail: vi.fn().mockResolvedValue(
        runDetail("run_safe_123456", {
          errorMessage: null,
          finalMessage: null,
          resultContent: null,
          resultSummary: null,
          stderrPreview: null,
          stdoutPreview: null,
        }),
      ),
      onListAgentExecutorRuns: vi
        .fn()
        .mockResolvedValue(runHistory([runSummary("run_safe_123456")])),
      openRunDetailRequest: {
        executorWidgetInstanceId: "executor_visible",
        id: 1,
        runId: "run_safe_123456",
      },
    });

    expect(buttonsWithText("Attach response")).toHaveLength(0);
    expect(buttonsWithText("Attach stdout")).toHaveLength(0);
    expect(buttonsWithText("Attach stderr")).toHaveLength(0);
    expect(buttonsWithText("Attach validation")).toHaveLength(0);
    expect(buttonsWithText("Attach error summary")).toHaveLength(0);
  });

  it("caps section attachments and preserves a visible truncation note", async () => {
    const onAttachContextToCoordinator = vi.fn();
    const hiddenTail = "hidden error summary tail";

    await renderPanel({
      onAttachContextToCoordinator,
      onGetAgentExecutorRunDetail: vi.fn().mockResolvedValue(
        runDetail("run_safe_123456", {
          errorMessage: `${"x".repeat(4200)}${hiddenTail}`,
        }),
      ),
      onListAgentExecutorRuns: vi
        .fn()
        .mockResolvedValue(runHistory([runSummary("run_safe_123456")])),
      openRunDetailRequest: {
        executorWidgetInstanceId: "executor_visible",
        id: 1,
        runId: "run_safe_123456",
      },
    });

    clickButtonAt("Attach error summary", 0);

    expect(onAttachContextToCoordinator).toHaveBeenCalledTimes(1);
    const request = onAttachContextToCoordinator.mock.calls[0][0];
    const attachedPreview = request.contextText.split("Preview:\n")[1];
    expect(attachedPreview.length).toBeLessThanOrEqual(
      AGENT_EXECUTOR_SELECTED_EXCERPT_LIMIT,
    );
    expect(attachedPreview).toContain("[Preview capped:");
    expect(attachedPreview).not.toContain(hiddenTail);
  });

  it("does not attach when the selection is empty or outside the run detail", async () => {
    const onAttachContextToCoordinator = vi.fn();

    await renderPanel({
      onAttachContextToCoordinator,
      onGetAgentExecutorRunDetail: vi
        .fn()
        .mockResolvedValue(runDetail("run_safe_123456")),
      onListAgentExecutorRuns: vi
        .fn()
        .mockResolvedValue(runHistory([runSummary("run_safe_123456")])),
      openRunDetailRequest: {
        executorWidgetInstanceId: "executor_visible",
        id: 1,
        runId: "run_safe_123456",
      },
    });

    const outside = document.createElement("p");
    outside.textContent = "outside visible text";
    document.body.append(outside);
    selectTextNode(outside.firstChild, "outside visible text");

    clickButtonAt("Attach selected excerpt", 0);

    expect(onAttachContextToCoordinator).not.toHaveBeenCalled();
    expect(document.body.textContent).toContain(
      "Select visible text inside this run detail first.",
    );
  });

  it("caps selected excerpts and preserves a visible truncation note", () => {
    const excerpt = boundAgentExecutorSelectedExcerpt("x".repeat(4100));

    expect(excerpt).not.toBeNull();
    expect(excerpt?.wasTruncated).toBe(true);
    expect(excerpt?.text.length).toBeLessThanOrEqual(
      AGENT_EXECUTOR_SELECTED_EXCERPT_LIMIT,
    );
    expect(excerpt?.text).toContain(
      "[Excerpt truncated to 4000 characters.]",
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

function runSummary(
  runId: string,
  overrides: Partial<AgentExecutorRunSummary> = {},
): AgentExecutorRunSummary {
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
    ...overrides,
  };
}

function runDetail(
  runId: string,
  overrides: Partial<AgentExecutorRunDetail> = {},
): AgentExecutorRunDetail {
  return {
    changedFilesSummary: null,
    errorMessage: null,
    finalMessage: "Executor-owned final response",
    logs: [],
    resultContent: null,
    resultId: "result_1",
    resultPayload: "hidden raw payload",
    resultStatus: "completed",
    resultSummary: null,
    stderrPreview: "stdout secret should not be attached by selection",
    stdoutPreview: "stdout secret should not be attached by selection",
    summary: runSummary(runId),
    validationProfile: null,
    validationStatus: null,
    ...overrides,
  };
}

function clickButtonAt(text: string, index: number) {
  const buttons = buttonsWithText(text);
  const button = buttons[index];

  if (!button) {
    throw new Error(`Button not found: ${text} at ${index}`);
  }

  act(() => {
    button.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });
}

function buttonsWithText(text: string) {
  return Array.from(document.querySelectorAll("button")).filter(
    (button) => button.textContent === text,
  );
}

function selectVisibleText(text: string) {
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  let node = walker.nextNode();

  while (node) {
    if (node.textContent?.includes(text)) {
      selectTextNode(node, text);
      return;
    }

    node = walker.nextNode();
  }

  throw new Error(`Text not found: ${text}`);
}

function selectTextNode(node: Node | null, text: string) {
  if (!node?.textContent) {
    throw new Error(`Selection text node not found: ${text}`);
  }

  const start = node.textContent.indexOf(text);
  if (start < 0) {
    throw new Error(`Selection text not found in node: ${text}`);
  }

  const range = document.createRange();
  range.setStart(node, start);
  range.setEnd(node, start + text.length);

  const selection = window.getSelection();
  selection?.removeAllRanges();
  selection?.addRange(range);
}
