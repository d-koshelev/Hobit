import type { AgentExecutorSlot } from "./types";
import type { AgentQueueLatestRunLinkController } from "./queue/useAgentQueueController";
import type {
  AgentQueueExecutionPlanPreview,
  AgentQueueReportActionCard,
  AgentExecutorRunDetail,
  AgentQueueTask,
  AgentQueueWorkerExecutionReport,
} from "../workspace/types";

export function runDetail(
  overrides: Partial<AgentExecutorRunDetail> = {},
): AgentExecutorRunDetail {
  const summary = {
    commandKind: "codex_direct_work",
    durationMs: 1000,
    finishedAt: "2026-05-22T10:01:00.000Z",
    hasResult: true,
    logCount: 4,
    mode: "Codex Direct Work",
    repoRoot: "C:\\repo",
    resultType: "codex_direct_work",
    runId: "run_done_123456",
    startedAt: "2026-05-22T10:00:00.000Z",
    status: "completed",
    title: "Codex Direct Work stream completed",
    validationProfile: null,
    validationStatus: null,
  };

  return {
    changedFilesSummary: null,
    errorMessage: null,
    finalMessage: "Final Direct Work response.",
    logs: [],
    resultContent: null,
    resultId: "result-1",
    resultPayload: "{\"status\":\"completed\"}",
    resultStatus: "completed",
    resultSummary: "Codex Direct Work stream completed",
    stderrPreview: null,
    stdoutPreview: "stdout preview",
    validationProfile: null,
    validationStatus: null,
    ...overrides,
    summary: {
      ...summary,
      ...overrides.summary,
    },
  };
}

export function workerReport(
  overrides: Partial<AgentQueueWorkerExecutionReport> = {},
): AgentQueueWorkerExecutionReport {
  return {
    changedFiles: [],
    commandsRun: [],
    createdAt: "2026-05-20T10:02:00.000Z",
    errors: [],
    itemId: "queue-1",
    rawReportPreview: "Raw worker report preview",
    reportId: "report-1",
    reportStatus: "reported",
    summary: "Worker report summary",
    validationCommandsSuggested: [],
    validationResult: "not_run",
    warnings: [],
    workerId: "executor_visible",
    ...overrides,
  };
}

export function reportActionCard(
  overrides: Partial<AgentQueueReportActionCard> = {},
): AgentQueueReportActionCard {
  return {
    cardId: "queue-report-card-task-1-report-1",
    changedFiles: ["apps/desktop/frontend/src/workbench/QueueReport.tsx"],
    createdAt: "2026-05-22T10:02:00.000Z",
    errors: ["One focused test still fails."],
    linkedFollowUpItemIds: [],
    recommendedActions: [
      {
        actionId: "open_source_item",
        description: "Open source item.",
        enabled: true,
        label: "Open source item",
        type: "open_source_item",
      },
    ],
    reportKind: "worker_execution",
    reportStatus: "reported",
    reportSummary: "Worker report summary",
    sourceItemId: "task_1",
    sourceItemPriority: 1,
    sourceItemPrompt: "Prompt",
    sourceItemStatus: "queued",
    sourceItemTitle: "Task",
    sourceItemType: "implementation",
    sourceQueueTag: "Default",
    sourceQueueTagId: "default",
    sourceReportId: "report-1",
    sourceValidationStatus: "not_started",
    warnings: ["Diff review is still required."],
    ...overrides,
  };
}

export function planPreview(
  overrides: Partial<AgentQueueExecutionPlanPreview> = {},
): AgentQueueExecutionPlanPreview {
  return {
    complexity: "low",
    estimatedMinutesMax: 12,
    estimatedMinutesMin: 6,
    estimatedTokenMax: 2000,
    estimatedTokenMin: 1000,
    expectedValidationCommands: [
      "npm.cmd run test --prefix apps/desktop/frontend",
    ],
    generatedAt: "2026-05-22T10:00:00.000Z",
    itemId: "task_1",
    likelyFilesOrAreas: ["frontend UI"],
    notes: "Local deterministic estimate only.",
    planId: "plan-1",
    risk: "low",
    source: "heuristic",
    status: "planned",
    steps: ["Inspect the current implementation"],
    workerId: "executor_visible",
    ...overrides,
  };
}

export function queueTask(): AgentQueueTask {
  return {
    assignedExecutorWidgetId: "executor_visible",
    createdAt: "2026-05-22T10:00:00.000Z",
    description: "",
    executionPolicy: "manual",
    priority: 1,
    prompt: "Prompt",
    queueItemId: "task_1",
    status: "ready",
    title: "Task",
    updatedAt: "2026-05-22T10:00:00.000Z",
    workspaceId: "ws_1",
  };
}

export function runLink(
  overrides: Partial<NonNullable<AgentQueueLatestRunLinkController["link"]>> = {},
): NonNullable<AgentQueueLatestRunLinkController["link"]> {
  return {
    completedAt: "2026-05-22T10:01:00.000Z",
    createdAt: "2026-05-22T10:00:00.000Z",
    directWorkRunId: "run_safe_123456",
    executorWidgetId: "executor_visible",
    linkId: "link_1",
    queueTaskId: "task_1",
    reviewStatus: null,
    source: "manual",
    startedAt: "2026-05-22T10:00:00.000Z",
    status: "completed",
    updatedAt: "2026-05-22T10:01:00.000Z",
    validationStatus: null,
    workspaceId: "ws_1",
    ...overrides,
  };
}

export function executorSlots(): AgentExecutorSlot[] {
  return [
    { label: "Local executor visible", widgetInstanceId: "executor_visible" },
  ];
}
