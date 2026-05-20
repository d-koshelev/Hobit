import React, { useMemo } from "react";
import ReactDOM from "react-dom/client";

import "../styles/hobit-theme.css";
import "../styles/tokens.css";
import "../styles/theme.css";
import "../styles/layout.css";

import type {
  AgentExecutorRunDetail,
  AgentExecutorRunHistory,
  AgentQueueTask,
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

type SmokeSnapshot = {
  attachCallCount: number;
  executorRunDetailCallCount: number;
  finalEventEmitCallCount: number;
  finalStatusAvailable: boolean;
  forbiddenCallCount: number;
  listExecutorRunsCallCount: number;
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
const REPO_ROOT = "C:\\Users\\Dmitry\\Documents\\prj\\Hobit";
const TASK_TITLE = "Queue to Executor smoke";
const LIVE_LOG_TEXT = "executor-only live log line";
const FINAL_RESPONSE_TEXT = "executor-only final response body";

class QueueExecutorSmokeRuntime {
  private attachCallCount = 0;
  private executorRunDetailCallCount = 0;
  private finalEventEmitCallCount = 0;
  private finalStatusAvailable = false;
  private forbiddenCallCount = 0;
  private listExecutorRunsCallCount = 0;
  private queueListCallsAfterFinal = 0;
  private startCallCount = 0;
  private terminalRunCallCount = 0;
  private streamListeners = new Map<string, (event: DirectWorkStreamEvent) => void>();
  private task: AgentQueueTask = {
    assignedExecutorWidgetId: EXECUTOR_WIDGET_ID,
    createdAt: "2026-05-18T10:00:00.000Z",
    description: "Real desktop smoke for assigned Queue task execution.",
    priority: 0,
    prompt: "Return exactly: Hobit Queue to Executor smoke. Do not edit files.",
    queueItemId: QUEUE_ITEM_ID,
    status: "queued",
    title: TASK_TITLE,
    updatedAt: "2026-05-18T10:00:00.000Z",
    workspaceId: WORKSPACE_ID,
  };

  constructor(readonly scenario: SmokeScenario) {}

  actions(): WorkbenchWidgetInstanceActions {
    return {
      assignAgentQueueTaskToExecutor: async () => this.cloneTask(),
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
      clearAgentQueueTaskAssignment: async () => this.cloneTask(),
      createAgentQueueTask: async () => this.cloneTask(),
      createGitCommit: async () => this.forbidden(null),
      createJdbcConnector: this.unsupported,
      createTerminalPtySession: async () => this.forbidden(null),
      createWorkspaceNote: this.unsupported,
      executeJdbcReadOnlyQuery: this.unsupported,
      generateCoordinatorProviderResponse: async () => this.forbidden(null),
      getAgentExecutorDiffSummary: async () => null,
      getAgentExecutorRunDetail: async () => {
        this.executorRunDetailCallCount += 1;

        if (this.scenario === "reconciliation-final") {
          this.markFinalAvailable();
          return this.runDetail();
        }

        return this.finalStatusAvailable ? this.runDetail() : null;
      },
      getAgentQueueTask: async () => this.cloneTask(),
      getGitRepositoryStatus: async () => null,
      getJdbcConnector: this.unsupported,
      getTerminalPtySession: async () => this.forbidden(null),
      getWorkspaceNote: async () => null,
      killTerminalPtySession: async () => this.forbidden(null),
      listAgentExecutorRuns: async () => {
        this.listExecutorRunsCallCount += 1;
        return this.executorRunHistory();
      },
      listAgentQueueTasks: async () => {
        if (this.finalStatusAvailable) {
          this.queueListCallsAfterFinal += 1;
        }

        return [this.cloneTask()];
      },
      listJdbcConnectors: this.unsupported,
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
      startCodexDirectWorkStream: async () => this.forbidden(null),
      stopTerminalPtySession: async () => this.forbidden(null),
      updateAgentQueueTask: async () => this.cloneTask(),
      updateJdbcConnector: this.unsupported,
      updateWidgetLayout: async () => undefined,
      updateWidgetState: async () => undefined,
      updateWorkspaceNote: async () => null,
      validateJdbcReadOnlySql: this.unsupported,
      writeTerminalPtySession: async () => this.forbidden(null),
    } satisfies WorkbenchWidgetInstanceActions;
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
      finalEventEmitCallCount: this.finalEventEmitCallCount,
      finalStatusAvailable: this.finalStatusAvailable,
      forbiddenCallCount: this.forbiddenCallCount,
      listExecutorRunsCallCount: this.listExecutorRunsCallCount,
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

  private executorRunHistory(): AgentExecutorRunHistory {
    const runs = this.startCallCount > 0 ? [this.runDetail().summary] : [];

    return {
      runs,
      widgetInstanceId: EXECUTOR_WIDGET_ID,
      workbenchId: WORKBENCH_ID,
      workspaceId: WORKSPACE_ID,
    };
  }

  private forbidden<T>(value: T): T {
    this.forbiddenCallCount += 1;
    return value;
  }

  private markFinalAvailable() {
    this.finalStatusAvailable = true;
    this.task = {
      ...this.task,
      status: "completed",
      updatedAt: new Date().toISOString(),
    };
  }

  private runDetail(): AgentExecutorRunDetail {
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
      resultPayload: JSON.stringify({ exit_code: 0, status: "completed" }),
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
        runId: RUN_ID,
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
  const runtime = useMemo(() => new QueueExecutorSmokeRuntime(scenario), [scenario]);
  const viewState = useMemo(() => smokeViewState(), []);

  window.__HOBIT_QUEUE_EXECUTOR_SMOKE__ = {
    emitExecutorFinalEvents: () => runtime.emitExecutorFinalEvents(),
    finalResponseText: FINAL_RESPONSE_TEXT,
    liveLogText: LIVE_LOG_TEXT,
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

function smokeViewState(): WorkbenchViewState {
  return {
    recentEvents: [],
    sharedStateObjects: [],
    widgets: [queueWidget(), executorWidget()],
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
