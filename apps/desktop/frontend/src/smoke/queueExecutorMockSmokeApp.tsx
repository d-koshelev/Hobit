import React, { useMemo } from "react";
import ReactDOM from "react-dom/client";

import "../styles/hobit-theme.css";
import "../styles/tokens.css";
import "../styles/theme.css";
import "../styles/layout.css";

import type {
  AgentExecutorRunDetail,
  AgentExecutorRunHistory,
  AgentQueueRunnerSnapshot,
  AgentQueueTask,
  AgentQueueTaskRunLinkSummary,
  DirectWorkStreamEvent,
  StartAssignedAgentQueueTaskResponse,
} from "../workspace/types";
import { WorkbenchCanvas } from "../workbench/WorkbenchCanvas";
import { DEFAULT_WORKBENCH_GRID_SIZE } from "../workbench/workbenchLayoutGeometry";
import type { WorkbenchWidgetInstanceActions } from "../workbench/useWorkbenchWidgetActions";
import type {
  WidgetInstance,
  WidgetLayout,
  WorkbenchViewState,
} from "../workbench/types";
import {
  AGENT_QUEUE_WIDGET_DEFINITION_ID,
  AGENT_RUN_WIDGET_DEFINITION_ID,
} from "../workbench/widgetRegistry";

type SmokeScenario = "event-final" | "reconciliation-final";
type SmokeViewMode =
  | "standard"
  | "no-executor"
  | "empty"
  | "load-error"
  | "loading"
  | "delete-error"
  | "autorun-unsupported";

type SmokeSnapshot = {
  attachCallCount: number;
  executorRunDetailCallCount: number;
  executorRunDetailRunIds: string[];
  finalEventEmitCallCount: number;
  finalStatusAvailable: boolean;
  forbiddenCallCount: number;
  listExecutorRunsCallCount: number;
  listQueueRunLinksCallCount: number;
  queueListCallsAfterFinal: number;
  runId: string | null;
  scenario: SmokeScenario;
  startCallCount: number;
  streamListenerCount: number;
  taskStatus: AgentQueueTask["status"];
  terminalRunCallCount: number;
};

type SmokeApi = {
  emitExecutorFinalEvents: () => void;
  liveLogText: string;
  finalResponseText: string;
  rawQueueForbiddenText: string;
  scenario: SmokeScenario;
  snapshot: () => SmokeSnapshot;
};

declare global {
  interface Window {
    __HOBIT_QUEUE_EXECUTOR_SMOKE__?: SmokeApi;
  }
}

const WORKSPACE_ID = "workspace-queue-executor-smoke";
const WORKBENCH_ID = "workbench-queue-executor-smoke";
const QUEUE_WIDGET_ID = "agent-queue-smoke-widget";
const EXECUTOR_WIDGET_ID = "agent-executor-smoke-widget";
const QUEUE_ITEM_ID = "queue-task-smoke";
const RUN_ID = "queue-executor-smoke-run";
const HISTORY_RUN_ID = "queue-executor-smoke-history-run";
const REPO_ROOT = "C:\\Users\\Dmitry\\Documents\\prj\\Hobit";
const TASK_TITLE = "Queue to Executor smoke";
const LIVE_LOG_TEXT = "executor-only live log line";
const FINAL_RESPONSE_TEXT = "executor-only final response body";
const RAW_QUEUE_FORBIDDEN_TEXT =
  "queue smoke raw executor payload must stay executor-owned";

class QueueExecutorSmokeRuntime {
  private attachCallCount = 0;
  private executorRunDetailCallCount = 0;
  private executorRunDetailRunIds: string[] = [];
  private finalEventEmitCallCount = 0;
  private finalStatusAvailable = false;
  private forbiddenCallCount = 0;
  private listExecutorRunsCallCount = 0;
  private listQueueRunLinksCallCount = 0;
  private queueListCallsAfterFinal = 0;
  private startCallCount = 0;
  private terminalRunCallCount = 0;
  private streamListeners = new Map<
    string,
    (event: DirectWorkStreamEvent) => void
  >();
  private task: AgentQueueTask;
  private readonly extraTasks: AgentQueueTask[];

  constructor(
    readonly scenario: SmokeScenario,
    readonly viewMode: SmokeViewMode,
  ) {
    this.task = smokeTask({
      assignedExecutorWidgetId:
        viewMode === "no-executor" ? null : EXECUTOR_WIDGET_ID,
      description: "Real desktop smoke for assigned Queue task execution.",
      executionPolicy: "manual",
      priority: 0,
      prompt: "Return exactly: Hobit Queue to Executor smoke. Do not edit files.",
      queueItemId: QUEUE_ITEM_ID,
      status: "queued",
      title: TASK_TITLE,
      updatedAt: "2026-05-18T10:00:00.000Z",
    });
    this.extraTasks = smokeQueueDensityTasks(viewMode);
  }

  actions(): WorkbenchWidgetInstanceActions {
    const actions = {
      assignAgentQueueTaskToExecutor: async (request) => {
        const task = this.findTask(request.queueItemId);

        return task
          ? {
              ...task,
              assignedExecutorWidgetId: request.executorWidgetInstanceId,
            }
          : this.cloneTask();
      },
      attachToCodexDirectWorkStream: async (_widgetInstanceId, runId, onEvent) => {
        this.attachCallCount += 1;
        this.streamListeners.set(runId, onEvent);
        return {
          runId,
          status: "attached",
          stopListening: () => this.streamListeners.delete(runId),
        };
      },
      cancelCodexDirectWorkRun: async () => this.forbidden(null),
      closeTerminalPtySession: async () => this.forbidden(null),
      forceKillCodexDirectWorkRun: async () => this.forbidden(null),
      clearAgentQueueTaskAssignment: async (request) => {
        const task = this.findTask(request.queueItemId);

        return task
          ? { ...task, assignedExecutorWidgetId: null }
          : this.cloneTask();
      },
      createAgentQueueTask: async () => this.cloneTask(),
      deleteAgentQueueTask: async () => {
        if (this.viewMode === "delete-error") {
          throw new Error("Mock delete failure for Queue UI state.");
        }

        return false;
      },
      deleteSkill: this.unsupported,
      createGitCommit: async () => this.forbidden(null),
      createJdbcConnector: this.unsupported,
      createSkill: this.unsupported,
      createTerminalPtySession: async () => this.forbidden(null),
      createWorkspaceNote: this.unsupported,
      executeJdbcReadOnlyQuery: this.unsupported,
      generateCoordinatorProviderResponse: async () => this.forbidden(null),
      getAgentExecutorDiffSummary: async () => null,
      getAgentExecutorRunDetail: async (_widgetInstanceId, runId) => {
        this.executorRunDetailCallCount += 1;
        this.executorRunDetailRunIds.push(runId);

        if (this.scenario === "reconciliation-final" && runId === RUN_ID) {
          this.markFinalAvailable();
          return this.runDetail(runId);
        }

        return this.finalStatusAvailable ? this.runDetail(runId) : null;
      },
      getAgentQueueTask: async (queueItemId) =>
        this.findTask(queueItemId) ?? this.cloneTask(),
      getGitFileDiff: async () => null,
      getGitLog: async () => null,
      getGitRepositoryStatus: async () => null,
      getJdbcConnector: this.unsupported,
      getSkill: this.unsupported,
      getTerminalPtySession: async () => this.forbidden(null),
      getWorkspaceNote: async () => null,
      killTerminalPtySession: async () => this.forbidden(null),
      listAgentExecutorRuns: async () => {
        this.listExecutorRunsCallCount += 1;
        return this.executorRunHistory();
      },
      listAgentQueueTasks: async () => {
        if (this.viewMode === "loading") {
          return new Promise<AgentQueueTask[]>(() => undefined);
        }

        if (this.viewMode === "load-error") {
          throw new Error("Mock Queue API error for UI state.");
        }

        if (this.finalStatusAvailable) {
          this.queueListCallsAfterFinal += 1;
        }

        if (this.viewMode === "empty") {
          return [];
        }

        return this.queueTasks();
      },
      listJdbcConnectors: this.unsupported,
      listSkills: this.unsupported,
      listTerminalPtySessions: async () => [],
      listWidgetLogs: async () => [],
      listWorkspaceNotes: async () => [],
      logRefreshTokens: {},
      removeWidgetInstance: async () => undefined,
      runCodexDirectWork: async () => this.forbidden(null),
      runDirectWorkValidation: async () => this.forbidden(null),
      runTerminalCommand: async () => {
        this.terminalRunCallCount += 1;
        return this.forbidden(null);
      },
      resizeTerminalPtySession: async () => this.forbidden(null),
      selectWorkspaceDirectory: async () => null,
      startAssignedAgentQueueTask: async (request) => {
        this.startCallCount += 1;
        this.task = {
          ...this.task,
          status: "running",
          updatedAt: new Date().toISOString(),
        };
        return {
          executorWidgetInstanceId: EXECUTOR_WIDGET_ID,
          queueItemId: request.queueItemId,
          runId: RUN_ID,
          status: "started",
          workbenchId: WORKBENCH_ID,
          workspaceId: WORKSPACE_ID,
        } satisfies StartAssignedAgentQueueTaskResponse;
      },
      startAgentQueueRunnerSession: async () => this.runnerSnapshot("armed"),
      startCodexDirectWorkStream: async () => this.forbidden(null),
      stopAgentQueueRunnerSession: async () => this.runnerSnapshot("stopped"),
      stopTerminalPtySession: async () => this.forbidden(null),
      getAgentQueueTaskLatestRunLink: async () => this.queueRunLinks()[0] ?? null,
      getAgentQueueRunnerSnapshot: async () => this.runnerSnapshot("idle"),
      listAgentQueueTaskRunLinks: async () => {
        this.listQueueRunLinksCallCount += 1;
        return this.queueRunLinks();
      },
      updateAgentQueueTask: async (request) =>
        this.findTask(request.queueItemId) ?? this.cloneTask(),
      updateJdbcConnector: this.unsupported,
      updateSkill: this.unsupported,
      updateWidgetLayout: async () => undefined,
      updateWidgetState: async () => undefined,
      updateWorkspaceNote: async () => null,
      validateJdbcReadOnlySql: this.unsupported,
      writeTerminalPtySession: async () => this.forbidden(null),
    } satisfies WorkbenchWidgetInstanceActions;

    if (this.viewMode === "autorun-unsupported") {
      return {
        ...actions,
        getAgentQueueRunnerSnapshot: undefined,
        startAgentQueueRunnerSession: undefined,
        stopAgentQueueRunnerSession: undefined,
      } as unknown as WorkbenchWidgetInstanceActions;
    }

    return actions;
  }

  emitExecutorFinalEvents() {
    const listener = this.streamListeners.get(RUN_ID);

    if (!listener) {
      throw new Error("Queue-started run is not attached to Agent Executor.");
    }

    this.finalEventEmitCallCount += 1;
    this.markFinalAvailable();
    listener(this.streamEvent("stdout_line", { line: LIVE_LOG_TEXT }));
    listener(this.streamEvent("final_message", { text: FINAL_RESPONSE_TEXT }));
    listener(
      this.streamEvent("completed", {
        exitCode: 0,
        finalStatus: "completed",
        isFinal: true,
        status: "completed",
      }),
    );
  }

  snapshot(): SmokeSnapshot {
    return {
      attachCallCount: this.attachCallCount,
      executorRunDetailCallCount: this.executorRunDetailCallCount,
      executorRunDetailRunIds: [...this.executorRunDetailRunIds],
      finalEventEmitCallCount: this.finalEventEmitCallCount,
      finalStatusAvailable: this.finalStatusAvailable,
      forbiddenCallCount: this.forbiddenCallCount,
      listExecutorRunsCallCount: this.listExecutorRunsCallCount,
      listQueueRunLinksCallCount: this.listQueueRunLinksCallCount,
      queueListCallsAfterFinal: this.queueListCallsAfterFinal,
      runId: this.startCallCount > 0 ? RUN_ID : null,
      scenario: this.scenario,
      startCallCount: this.startCallCount,
      streamListenerCount: this.streamListeners.size,
      taskStatus: this.task.status,
      terminalRunCallCount: this.terminalRunCallCount,
    };
  }

  private cloneTask() {
    return { ...this.task };
  }

  private queueTasks() {
    return [this.cloneTask(), ...this.extraTasks.map((task) => ({ ...task }))];
  }

  private findTask(queueItemId: string) {
    return this.queueTasks().find((task) => task.queueItemId === queueItemId);
  }

  private executorRunHistory(): AgentExecutorRunHistory {
    const runs =
      this.startCallCount > 0
        ? [
            this.runDetail(RUN_ID).summary,
            {
              ...this.runDetail(HISTORY_RUN_ID).summary,
              finishedAt: "2026-05-18T09:00:03.000Z",
              startedAt: "2026-05-18T09:00:00.000Z",
              title: "Previous Queue-linked run",
            },
          ]
        : [];

    return {
      runs,
      widgetInstanceId: EXECUTOR_WIDGET_ID,
      workbenchId: WORKBENCH_ID,
      workspaceId: WORKSPACE_ID,
    };
  }

  private queueRunLinks(): AgentQueueTaskRunLinkSummary[] {
    if (this.startCallCount === 0 && this.viewMode !== "no-executor") {
      return [];
    }

    const latestStatus: AgentQueueTaskRunLinkSummary["status"] =
      this.finalStatusAvailable || this.viewMode === "no-executor"
        ? "completed"
        : "running";
    const latestCompletedAt =
      this.finalStatusAvailable || this.viewMode === "no-executor"
        ? "2026-05-18T10:00:03.000Z"
        : null;

    return [
      {
        completedAt: latestCompletedAt,
        createdAt: "2026-05-18T10:00:00.000Z",
        directWorkRunId: RUN_ID,
        executorWidgetId: EXECUTOR_WIDGET_ID,
        linkId: "queue-smoke-link-latest",
        queueTaskId: QUEUE_ITEM_ID,
        reviewStatus: latestCompletedAt ? "review_needed" : null,
        source: "manual",
        startedAt: "2026-05-18T10:00:00.000Z",
        status: latestStatus,
        updatedAt: latestCompletedAt ?? "2026-05-18T10:00:00.000Z",
        validationStatus: null,
        workspaceId: WORKSPACE_ID,
      },
      {
        completedAt: "2026-05-18T09:00:03.000Z",
        createdAt: "2026-05-18T09:00:00.000Z",
        directWorkRunId: HISTORY_RUN_ID,
        executorWidgetId: EXECUTOR_WIDGET_ID,
        linkId: "queue-smoke-link-history",
        queueTaskId: QUEUE_ITEM_ID,
        reviewStatus: "review_needed",
        source: "autorun",
        startedAt: "2026-05-18T09:00:00.000Z",
        status: "completed",
        updatedAt: "2026-05-18T09:00:03.000Z",
        validationStatus: "not_run",
        workspaceId: WORKSPACE_ID,
      },
    ];
  }

  private forbidden<T>(value: T): T {
    this.forbiddenCallCount += 1;
    return value;
  }

  private runnerSnapshot(status: string): AgentQueueRunnerSnapshot {
    return {
      activeQueueItemId: null,
      isActive: status === "armed",
      isSessionOnly: true,
      policy: {
        allowHiddenExecution: false,
        durableResume: false,
        oneTaskAtATime: true,
        requireOperatorStart: true,
        stopOnCancel: true,
        stopOnFailure: true,
        stopOnReviewNeeded: true,
      },
      finalRunStatus: null,
      lastReconciledAt: null,
      sessionId: status === "idle" ? null : "queue-smoke-runner-session",
      status,
      stopReason: status === "stopped" ? "operator_stopped" : null,
      waitingRunId: null,
    };
  }

  private markFinalAvailable() {
    this.finalStatusAvailable = true;
    this.task = {
      ...this.task,
      status: "completed",
      updatedAt: new Date().toISOString(),
    };
  }

  private runDetail(runId = RUN_ID): AgentExecutorRunDetail {
    const finishedAt = this.finalStatusAvailable
      ? "2026-05-18T10:00:03.000Z"
      : null;

    return {
      changedFilesSummary: null,
      errorMessage: null,
      finalMessage: this.finalStatusAvailable ? FINAL_RESPONSE_TEXT : null,
      logs: [],
      resultContent: this.finalStatusAvailable ? FINAL_RESPONSE_TEXT : null,
      resultId: this.finalStatusAvailable ? "result-smoke" : null,
      resultPayload: JSON.stringify({
        exit_code: 0,
        raw_output: RAW_QUEUE_FORBIDDEN_TEXT,
        status: "completed",
      }),
      resultStatus: this.finalStatusAvailable ? "completed" : null,
      resultSummary: this.finalStatusAvailable ? "Completed" : null,
      stderrPreview: null,
      stdoutPreview: this.finalStatusAvailable ? LIVE_LOG_TEXT : null,
      summary: {
        commandKind: "direct_work",
        durationMs: finishedAt ? 3000 : null,
        finishedAt,
        hasResult: this.finalStatusAvailable,
        logCount: this.finalStatusAvailable ? 2 : 0,
        mode: "direct_work",
        repoRoot: REPO_ROOT,
        resultType: this.finalStatusAvailable ? "codex_direct_work" : null,
        runId,
        startedAt: "2026-05-18T10:00:00.000Z",
        status: this.finalStatusAvailable ? "completed" : "running",
        title: TASK_TITLE,
        validationProfile: null,
        validationStatus: null,
      },
      validationProfile: null,
      validationStatus: null,
    };
  }

  private streamEvent(
    eventKind: DirectWorkStreamEvent["eventKind"],
    overrides: Partial<DirectWorkStreamEvent> = {},
  ): DirectWorkStreamEvent {
    return {
      elapsedMs: eventKind === "completed" ? 3000 : 1000,
      errorMessage: null,
      eventKind,
      exitCode: null,
      failedStage: null,
      finalStatus: null,
      isFinal: false,
      line: null,
      parsedCodexEventType: null,
      runId: RUN_ID,
      status: eventKind === "stdout_line" || eventKind === "final_message" ? "running" : null,
      stderrPreview: null,
      text: null,
      widgetInstanceId: EXECUTOR_WIDGET_ID,
      workbenchId: WORKBENCH_ID,
      workspaceId: WORKSPACE_ID,
      ...overrides,
    };
  }

  private unsupported = async (): Promise<never> => {
    throw new Error("This mocked smoke harness does not support that action.");
  };
}

function SmokeWorkbench() {
  const scenario = smokeScenario();
  const viewMode = smokeViewMode();
  const runtime = useMemo(
    () => new QueueExecutorSmokeRuntime(scenario, viewMode),
    [scenario, viewMode],
  );
  const viewState = useMemo(() => smokeViewState(viewMode), [viewMode]);

  window.__HOBIT_QUEUE_EXECUTOR_SMOKE__ = {
    emitExecutorFinalEvents: () => runtime.emitExecutorFinalEvents(),
    finalResponseText: FINAL_RESPONSE_TEXT,
    liveLogText: LIVE_LOG_TEXT,
    rawQueueForbiddenText: RAW_QUEUE_FORBIDDEN_TEXT,
    scenario,
    snapshot: () => runtime.snapshot(),
  };

  return (
    <main className="app-shell">
      <div className="workbench">
        <div className="workbench-content">
          <WorkbenchCanvas
            gridSize={DEFAULT_WORKBENCH_GRID_SIZE}
            layoutMode="locked"
            onOpenWidgetCatalog={() => undefined}
            viewState={viewState}
            widgetActions={runtime.actions()}
          />
        </div>
      </div>
    </main>
  );
}

function smokeScenario(): SmokeScenario {
  const scenario = new URLSearchParams(window.location.search).get("scenario");

  return scenario === "reconciliation-final"
    ? "reconciliation-final"
    : "event-final";
}

function smokeViewMode(): SmokeViewMode {
  const view = new URLSearchParams(window.location.search).get("view");

  if (
    view === "no-executor" ||
    view === "empty" ||
    view === "load-error" ||
    view === "loading" ||
    view === "delete-error" ||
    view === "autorun-unsupported"
  ) {
    return view;
  }

  return "standard";
}

function smokeViewState(viewMode: SmokeViewMode): WorkbenchViewState {
  return {
    recentEvents: [],
    sharedStateObjects: [],
    widgets:
      viewMode === "no-executor"
        ? [queueWidget()]
        : [queueWidget(), executorWidget()],
    workbench: {
      id: WORKBENCH_ID,
      preset: {
        description: "Queue to Executor mocked UI smoke",
        id: "preset-queue-executor-smoke",
        title: "Queue Executor Smoke",
      },
    },
    workspace: {
      description: "Mocked frontend smoke workspace",
      id: WORKSPACE_ID,
      status: "active",
      title: "Queue Executor Smoke",
    },
  };
}

function smokeTask(
  overrides: Omit<AgentQueueTask, "createdAt" | "workspaceId">,
): AgentQueueTask {
  return {
    createdAt: "2026-05-18T10:00:00.000Z",
    workspaceId: WORKSPACE_ID,
    ...overrides,
  };
}

function smokeQueueDensityTasks(viewMode: SmokeViewMode): AgentQueueTask[] {
  const assignedExecutorWidgetId =
    viewMode === "no-executor" ? null : EXECUTOR_WIDGET_ID;

  return [
    smokeTask({
      assignedExecutorWidgetId: null,
      description:
        "Long title and unassigned queued task used to inspect row truncation.",
      executionPolicy: "manual",
      priority: 5,
      prompt:
        "Review the workspace for stale task copy, summarize the safest edits, and stop before changing files.",
      queueItemId: "queue-task-long-unassigned",
      status: "queued",
      title:
        "Audit the onboarding workspace setup for stale queue copy before the demo review window closes",
      updatedAt: "2026-05-18T10:04:00.000Z",
    }),
    smokeTask({
      assignedExecutorWidgetId,
      description: "Running task keeps assignment and delete controls locked.",
      executionPolicy: "auto",
      priority: 2,
      prompt: "Continue the current verification run and report final status.",
      queueItemId: "queue-task-running",
      status: "running",
      title: "Verify direct work result handoff",
      updatedAt: "2026-05-18T10:08:00.000Z",
    }),
    smokeTask({
      assignedExecutorWidgetId,
      description: "Needs operator review before follow-up execution.",
      executionPolicy: "after_previous_success",
      priority: 1,
      prompt: "Prepare the next validation step after the review decision.",
      queueItemId: "queue-task-review",
      status: "review_needed",
      title: "Review generated validation notes",
      updatedAt: "2026-05-18T10:12:00.000Z",
    }),
    smokeTask({
      assignedExecutorWidgetId,
      description: "Completed task verifies final-status density.",
      executionPolicy: "manual",
      priority: 0,
      prompt: "No action required.",
      queueItemId: "queue-task-completed",
      status: "completed",
      title: "Capture baseline screenshot",
      updatedAt: "2026-05-18T10:16:00.000Z",
    }),
    smokeTask({
      assignedExecutorWidgetId: null,
      description: "Failed unassigned task checks badge spacing.",
      executionPolicy: "manual",
      priority: 4,
      prompt: "Retry only after the operator reviews the failure.",
      queueItemId: "queue-task-failed",
      status: "failed",
      title: "Retry smoke after missing workspace path",
      updatedAt: "2026-05-18T10:20:00.000Z",
    }),
  ];
}

function queueWidget(): WidgetInstance {
  return {
    config: {},
    definitionId: AGENT_QUEUE_WIDGET_DEFINITION_ID,
    id: QUEUE_WIDGET_ID,
    layout: dockedLayout(0, 24, 24, 610, 850),
    state: {},
    title: "Agent Queue",
    visible: true,
  };
}

function executorWidget(): WidgetInstance {
  return {
    config: {},
    definitionId: AGENT_RUN_WIDGET_DEFINITION_ID,
    id: EXECUTOR_WIDGET_ID,
    layout: dockedLayout(1, 660, 24, 660, 850),
    state: {},
    title: "Agent Executor",
    visible: true,
  };
}

function dockedLayout(
  order: number,
  x: number,
  y: number,
  width: number,
  height: number,
): WidgetLayout {
  return {
    area: "main",
    height,
    mode: "docked",
    order,
    width,
    x,
    y,
  };
}

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <SmokeWorkbench />,
);
