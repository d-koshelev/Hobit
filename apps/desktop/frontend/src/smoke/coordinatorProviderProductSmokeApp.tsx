import React, { useMemo } from "react";
import ReactDOM from "react-dom/client";

import "../styles/hobit-theme.css";
import "../styles/tokens.css";
import "../styles/theme.css";
import "../styles/layout.css";

import type {
  AgentQueueTask,
  GenerateCoordinatorProviderResponse,
  WorkspaceNote,
} from "../workspace/types";
import { WorkbenchCanvas } from "../workbench/WorkbenchCanvas";
import { DEFAULT_WORKBENCH_GRID_SIZE } from "../workbench/workbenchLayoutGeometry";
import type { WorkbenchWidgetInstanceActions } from "../workbench/useWorkbenchWidgetActions";
import type {
  WidgetInstance,
  WidgetLayout,
  WorkbenchViewState,
} from "../workbench/types";
import { INTERACTIVE_AGENT_WIDGET_DEFINITION_ID } from "../workbench/widgetRegistry";
import type { CoordinatorProviderResponseRequest } from "../workbench/coordinatorProviderWidgetActions";

type SmokeScenario =
  | "jdbc-draft"
  | "note-draft"
  | "provider-error"
  | "queue-draft";

type SmokeSnapshot = {
  allowedToolsEmpty: boolean;
  createNoteCallCount: number;
  createQueueTaskCallCount: number;
  executorLaunchCallCount: number;
  forbiddenCallCount: number;
  gitCallCount: number;
  hiddenContextViolationCount: number;
  jdbcAccessCallCount: number;
  lastCreatedNote: WorkspaceNote | null;
  lastCreatedQueueTask: AgentQueueTask | null;
  noteReadCallCount: number;
  providerCallCount: number;
  providerRequestIncludesSecret: boolean;
  providerScenario: SmokeScenario;
  queueDispatchCallCount: number;
  terminalCallCount: number;
};

type SmokeApi = {
  scenario: SmokeScenario;
  snapshot: () => SmokeSnapshot;
};

declare global {
  interface Window {
    __HOBIT_COORDINATOR_PRODUCT_SMOKE__?: SmokeApi;
  }
}

const WORKSPACE_ID = "workspace-coordinator-provider-product-smoke";
const WORKBENCH_ID = "workbench-coordinator-provider-product-smoke";
const COORDINATOR_WIDGET_ID = "coordinator-provider-product-smoke-widget";
const SMOKE_SECRET = "sk-hobit-product-smoke-secret";

class CoordinatorProviderProductSmokeRuntime {
  private allowedToolsEmpty = true;
  private createNoteCallCount = 0;
  private createQueueTaskCallCount = 0;
  private executorLaunchCallCount = 0;
  private forbiddenCallCount = 0;
  private gitCallCount = 0;
  private hiddenContextViolationCount = 0;
  private jdbcAccessCallCount = 0;
  private lastCreatedNote: WorkspaceNote | null = null;
  private lastCreatedQueueTask: AgentQueueTask | null = null;
  private noteReadCallCount = 0;
  private providerCallCount = 0;
  private providerRequestIncludesSecret = false;
  private queueDispatchCallCount = 0;
  private terminalCallCount = 0;

  constructor(readonly scenario: SmokeScenario) {}

  actions(): WorkbenchWidgetInstanceActions {
    return {
      assignAgentQueueTaskToExecutor: this.queueDispatchUnsupported,
      attachToCodexDirectWorkStream: this.executorUnsupported,
      cancelCodexDirectWorkRun: this.executorUnsupported,
      clearAgentQueueTaskAssignment: this.queueDispatchUnsupported,
      closeTerminalPtySession: this.terminalUnsupported,
      createAgentQueueTask: async (request) => {
        this.createQueueTaskCallCount += 1;
        this.lastCreatedQueueTask = {
          assignedExecutorWidgetId: null,
          createdAt: new Date().toISOString(),
          description: request.description,
          priority: request.priority,
          prompt: request.prompt,
          queueItemId: `queue-task-smoke-${this.createQueueTaskCallCount}`,
          status: request.status,
          title: request.title,
          updatedAt: new Date().toISOString(),
          workspaceId: WORKSPACE_ID,
        };
        return this.lastCreatedQueueTask;
      },
      createGitCommit: this.gitUnsupported,
      createJdbcConnector: this.jdbcUnsupported,
      createTerminalPtySession: this.terminalUnsupported,
      createWorkspaceNote: async (request) => {
        this.createNoteCallCount += 1;
        this.lastCreatedNote = {
          archived: false,
          body: request.body,
          createdAt: new Date().toISOString(),
          noteId: `note-smoke-${this.createNoteCallCount}`,
          pinned: request.pinned,
          title: request.title,
          updatedAt: new Date().toISOString(),
          workspaceId: WORKSPACE_ID,
        };
        return this.lastCreatedNote;
      },
      executeJdbcReadOnlyQuery: this.jdbcUnsupported,
      forceKillCodexDirectWorkRun: this.executorUnsupported,
      generateCoordinatorProviderResponse: async (_widgetInstanceId, request) =>
        this.providerResponse(request),
      getAgentExecutorDiffSummary: this.executorUnsupported,
      getAgentExecutorRunDetail: this.executorUnsupported,
      getAgentQueueRunnerSnapshot: this.queueDispatchUnsupported,
      getAgentQueueTask: async () => this.lastCreatedQueueTask,
      getGitRepositoryStatus: this.gitUnsupported,
      getJdbcConnector: this.jdbcUnsupported,
      getTerminalPtySession: this.terminalUnsupported,
      getWorkspaceNote: async () => {
        this.noteReadCallCount += 1;
        return null;
      },
      killTerminalPtySession: this.terminalUnsupported,
      listAgentExecutorRuns: this.executorUnsupported,
      listAgentQueueTasks: async () =>
        this.lastCreatedQueueTask ? [this.lastCreatedQueueTask] : [],
      listJdbcConnectors: this.jdbcUnsupported,
      listTerminalPtySessions: this.terminalUnsupported,
      listWidgetLogs: async () => [],
      listWorkspaceNotes: async () => {
        this.noteReadCallCount += 1;
        return this.lastCreatedNote ? [this.lastCreatedNote] : [];
      },
      logRefreshTokens: {},
      removeWidgetInstance: async () => undefined,
      resizeTerminalPtySession: this.terminalUnsupported,
      runCodexDirectWork: this.executorUnsupported,
      runDirectWorkValidation: this.executorUnsupported,
      runTerminalCommand: this.terminalUnsupported,
      startAssignedAgentQueueTask: this.queueDispatchUnsupported,
      startAgentQueueRunnerSession: this.queueDispatchUnsupported,
      startCodexDirectWorkStream: this.executorUnsupported,
      stopAgentQueueRunnerSession: this.queueDispatchUnsupported,
      stopTerminalPtySession: this.terminalUnsupported,
      updateAgentQueueTask: async () => this.forbidden(null),
      updateJdbcConnector: this.jdbcUnsupported,
      updateWidgetLayout: async () => undefined,
      updateWidgetState: async () => undefined,
      updateWorkspaceNote: async () => this.forbidden(null),
      validateJdbcReadOnlySql: this.jdbcUnsupported,
      writeTerminalPtySession: this.terminalUnsupported,
    } satisfies WorkbenchWidgetInstanceActions;
  }

  snapshot(): SmokeSnapshot {
    return {
      allowedToolsEmpty: this.allowedToolsEmpty,
      createNoteCallCount: this.createNoteCallCount,
      createQueueTaskCallCount: this.createQueueTaskCallCount,
      executorLaunchCallCount: this.executorLaunchCallCount,
      forbiddenCallCount: this.forbiddenCallCount,
      gitCallCount: this.gitCallCount,
      hiddenContextViolationCount: this.hiddenContextViolationCount,
      jdbcAccessCallCount: this.jdbcAccessCallCount,
      lastCreatedNote: this.lastCreatedNote,
      lastCreatedQueueTask: this.lastCreatedQueueTask,
      noteReadCallCount: this.noteReadCallCount,
      providerCallCount: this.providerCallCount,
      providerRequestIncludesSecret: this.providerRequestIncludesSecret,
      providerScenario: this.scenario,
      queueDispatchCallCount: this.queueDispatchCallCount,
      terminalCallCount: this.terminalCallCount,
    };
  }

  private async providerResponse(
    request: CoordinatorProviderResponseRequest,
  ): Promise<GenerateCoordinatorProviderResponse> {
    this.providerCallCount += 1;
    const requestJson = JSON.stringify(request);
    this.providerRequestIncludesSecret = requestJson.includes(SMOKE_SECRET);
    if (hasHiddenContextKey(requestJson)) {
      this.hiddenContextViolationCount += 1;
    }

    const response = providerResponseForScenario(this.scenario, request);
    this.allowedToolsEmpty = response.allowedTools.length === 0;
    return response;
  }

  private executorUnsupported = async (): Promise<never> => {
    this.executorLaunchCallCount += 1;
    return this.unsupported();
  };

  private gitUnsupported = async (): Promise<never> => {
    this.gitCallCount += 1;
    return this.unsupported();
  };

  private jdbcUnsupported = async (): Promise<never> => {
    this.jdbcAccessCallCount += 1;
    return this.unsupported();
  };

  private queueDispatchUnsupported = async (): Promise<never> => {
    this.queueDispatchCallCount += 1;
    return this.unsupported();
  };

  private terminalUnsupported = async (): Promise<never> => {
    this.terminalCallCount += 1;
    return this.unsupported();
  };

  private unsupported(): never {
    this.forbiddenCallCount += 1;
    throw new Error("Unsupported Coordinator product smoke action.");
  }

  private forbidden<T>(value: T): T {
    this.forbiddenCallCount += 1;
    return value;
  }
}

function SmokeWorkbench() {
  const scenario = smokeScenario();
  const runtime = useMemo(
    () => new CoordinatorProviderProductSmokeRuntime(scenario),
    [scenario],
  );
  const viewState = useMemo(() => smokeViewState(), []);

  window.__HOBIT_COORDINATOR_PRODUCT_SMOKE__ = {
    scenario,
    snapshot: () => runtime.snapshot(),
  };

  return (
    <main className="app-shell">
      <h1>Coordinator provider product smoke</h1>
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

function providerResponseForScenario(
  scenario: SmokeScenario,
  request: CoordinatorProviderResponseRequest,
): GenerateCoordinatorProviderResponse {
  if (scenario === "provider-error") {
    return baseResponse(request, {
      assistantText: "Configured provider error surfaced visibly; no draft rendered.",
      providerError: "Deterministic configured provider error.",
      providerStatus: "provider_error",
      proposalDrafts: [],
    });
  }

  return baseResponse(request, {
    assistantText: `Configured fake provider returned ${scenario}; no action ran.`,
    providerError: null,
    providerStatus: "completed",
    proposalDrafts: [proposalDraftForScenario(scenario)],
  });
}

function baseResponse(
  request: CoordinatorProviderResponseRequest,
  overrides: Pick<
    GenerateCoordinatorProviderResponse,
    "assistantText" | "providerError" | "providerStatus" | "proposalDrafts"
  >,
): GenerateCoordinatorProviderResponse {
  return {
    allowedTools: [],
    noHiddenContextUsed: true,
    noMutationsPerformed: true,
    noToolsExecuted: true,
    providerKind: "hobit-http-json",
    requestId: "frontend-product-smoke-request",
    visibleContextMessageCount: request.visibleConversation.length,
    visibleProposalDraftCount: request.visibleProposalDrafts.length,
    ...overrides,
  };
}

function proposalDraftForScenario(
  scenario: Exclude<SmokeScenario, "provider-error">,
): GenerateCoordinatorProviderResponse["proposalDrafts"][number] {
  if (scenario === "queue-draft") {
    return {
      expectedResult: "A review card can create a draft task after explicit approval.",
      id: "provider-smoke-queue-draft",
      intent: "Create a draft Queue task from explicit visible chat text.",
      riskNotes: ["Draft Queue task only; no assignment, dispatch, or run."],
      targetCapability: "create Queue task",
      targetWidget: "Agent Queue",
      title: "Investigate visible provider smoke task",
      typeId: "create-agent-queue-task",
      visibleInputs: [
        { label: "Title", value: "Investigate visible provider smoke task" },
        { label: "Description", value: "Created by fake provider smoke only." },
        { label: "Prompt", value: "Use only visible Coordinator chat text." },
        { label: "Priority", value: "2" },
      ],
    };
  }

  if (scenario === "note-draft") {
    return {
      expectedResult: "A review card can create a Note after explicit approval.",
      id: "provider-smoke-note-draft",
      intent: "Create a workspace-local Note from visible provider smoke text.",
      riskNotes: ["Writes a new Note only after explicit approval and Create Note."],
      targetCapability: "create Note",
      targetWidget: "Notes",
      title: "Provider smoke note",
      typeId: "create-note",
      visibleInputs: [
        { label: "Title", value: "Provider smoke note" },
        { label: "Body", value: "This note draft came from the local fake provider." },
        { label: "Pinned", value: "false" },
      ],
    };
  }

  return {
    expectedResult: "SQL text can be reviewed or copied without execution.",
    id: "provider-smoke-jdbc-draft",
    intent: "Prepare a non-executing SQL suggestion from visible chat text.",
    riskNotes: ["Suggestion only; no connector access, SQL execution, or EXPLAIN."],
    targetCapability: "prepare query suggestion",
    targetWidget: "Database / JDBC",
    title: "Count visible rows",
    typeId: "prepare-jdbc-query-suggestion",
    visibleInputs: [
      { label: "Question", value: "Count visible smoke rows." },
      { label: "Suggested SQL text", value: "select count(*) from smoke_table;" },
    ],
  };
}

function smokeScenario(): SmokeScenario {
  const scenario = new URLSearchParams(window.location.search).get("scenario");

  if (
    scenario === "jdbc-draft" ||
    scenario === "note-draft" ||
    scenario === "provider-error" ||
    scenario === "queue-draft"
  ) {
    return scenario;
  }

  return "queue-draft";
}

function smokeViewState(): WorkbenchViewState {
  return {
    recentEvents: [],
    sharedStateObjects: [],
    widgets: [coordinatorWidget()],
    workbench: {
      id: WORKBENCH_ID,
      preset: {
        description: "Coordinator provider product smoke",
        id: "preset-coordinator-provider-product-smoke",
        title: "Coordinator Provider Product Smoke",
      },
    },
    workspace: {
      description: "Mocked frontend smoke workspace",
      id: WORKSPACE_ID,
      status: "active",
      title: "Coordinator Provider Product Smoke",
    },
  };
}

function coordinatorWidget(): WidgetInstance {
  return {
    config: {},
    definitionId: INTERACTIVE_AGENT_WIDGET_DEFINITION_ID,
    id: COORDINATOR_WIDGET_ID,
    layout: dockedLayout(0, 24, 24, 900, 860),
    state: {},
    title: "Coordinator Chat",
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

function hasHiddenContextKey(requestJson: string) {
  return [
    "terminal_output",
    "agent_executor_logs",
    "git_status",
    "git_diff",
    "jdbc_metadata",
    "jdbc_results",
    "notes_body",
    "filesystem",
    "environment_variables",
    "provider_api_key",
  ].some((key) => requestJson.includes(`"${key}"`));
}

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <SmokeWorkbench />,
);
