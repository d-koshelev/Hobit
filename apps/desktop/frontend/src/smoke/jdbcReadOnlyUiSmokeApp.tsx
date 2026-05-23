import React, { useMemo } from "react";
import ReactDOM from "react-dom/client";

import "../styles/hobit-theme.css";
import "../styles/tokens.css";
import "../styles/theme.css";
import "../styles/layout.css";

import type { JdbcConnector } from "../workspace/jdbcConnectorTypes";
import type {
  JdbcReadOnlyQueryResult,
  JdbcReadOnlySqlValidation,
} from "../workspace/jdbcQueryTypes";
import { WorkbenchCanvas } from "../workbench/WorkbenchCanvas";
import { DEFAULT_WORKBENCH_GRID_SIZE } from "../workbench/workbenchLayoutGeometry";
import type { WorkbenchWidgetInstanceActions } from "../workbench/useWorkbenchWidgetActions";
import type {
  WidgetInstance,
  WidgetLayout,
  WorkbenchViewState,
} from "../workbench/types";
import { JDBC_WIDGET_DEFINITION_ID } from "../workbench/widgetRegistry";

type SmokeScenario =
  | "caps"
  | "no-connectors"
  | "not-configured"
  | "unsupported"
  | "valid"
  | "validation";

type SmokeSnapshot = {
  connectorListCallCount: number;
  coordinatorCallCount: number;
  createConnectorCallCount: number;
  executeCallCount: number;
  getConnectorCallCount: number;
  lastExecutedRowLimit: number | null;
  lastExecutedSql: string | null;
  lastResultStatus: string | null;
  lastValidatedSql: string | null;
  lastValidationReason: string | null;
  lastValidationValid: boolean | null;
  scenario: SmokeScenario;
  updateConnectorCallCount: number;
  validateCallCount: number;
};

type SmokeApi = {
  secretSentinel: string;
  scenario: SmokeScenario;
  snapshot: () => SmokeSnapshot;
};

declare global {
  interface Window {
    __HOBIT_JDBC_READ_ONLY_SMOKE__?: SmokeApi;
  }
}

const WORKSPACE_ID = "workspace-jdbc-read-only-ui-smoke";
const WORKBENCH_ID = "workbench-jdbc-read-only-ui-smoke";
const JDBC_WIDGET_ID = "jdbc-read-only-ui-smoke-widget";
const SECRET_SENTINEL = "jdbc-smoke-secret-token-should-not-render";
const CREATED_AT = "2026-05-20T10:00:00.000Z";
const UPDATED_AT = "2026-05-20T10:00:01.000Z";

class JdbcReadOnlyUiSmokeRuntime {
  private connectorListCallCount = 0;
  private coordinatorCallCount = 0;
  private createConnectorCallCount = 0;
  private executeCallCount = 0;
  private getConnectorCallCount = 0;
  private lastExecutedRowLimit: number | null = null;
  private lastExecutedSql: string | null = null;
  private lastResultStatus: string | null = null;
  private lastValidatedSql: string | null = null;
  private lastValidationReason: string | null = null;
  private lastValidationValid: boolean | null = null;
  private updateConnectorCallCount = 0;
  private validateCallCount = 0;

  constructor(readonly scenario: SmokeScenario) {}

  actions(): WorkbenchWidgetInstanceActions {
    return {
      assignAgentQueueTaskToExecutor: this.unsupported,
      attachToCodexDirectWorkStream: this.unsupported,
      cancelCodexDirectWorkRun: this.unsupported,
      clearAgentQueueTaskAssignment: this.unsupported,
      closeTerminalPtySession: this.unsupported,
      createAgentQueueTask: this.unsupported,
      deleteAgentQueueTask: this.unsupported,
      createGitCommit: this.unsupported,
      createJdbcConnector: async () => {
        this.createConnectorCallCount += 1;
        return smokeConnector("created-smoke-connector", "Created smoke connector");
      },
      createTerminalPtySession: this.unsupported,
      createWorkspaceNote: this.unsupported,
      executeJdbcReadOnlyQuery: async (_widgetInstanceId, request) => {
        if (this.scenario === "unsupported") {
          throw new Error(
            "JDBC read-only query execution is only available in the Tauri desktop shell. Browser fallback cannot run JDBC queries.",
          );
        }

        this.executeCallCount += 1;
        this.lastExecutedSql = request.sql;
        this.lastExecutedRowLimit = request.rowLimit ?? null;
        const connector = this.connectorById(request.connectorId);
        const result = executeSmokeQuery({
          connector,
          rowLimit: request.rowLimit ?? 100,
          scenario: this.scenario,
          sql: request.sql,
        });
        this.lastResultStatus = result.status;
        return result;
      },
      forceKillCodexDirectWorkRun: this.unsupported,
      generateCoordinatorProviderResponse: async () => {
        this.coordinatorCallCount += 1;
        throw new Error("Coordinator provider must not run during JDBC smoke.");
      },
      getAgentExecutorDiffSummary: this.unsupported,
      getAgentExecutorRunDetail: this.unsupported,
      getAgentQueueTaskLatestRunLink: async () => null,
      getAgentQueueRunnerSnapshot: this.unsupported,
      getAgentQueueTask: this.unsupported,
      getGitRepositoryStatus: this.unsupported,
      getJdbcConnector: async (connectorId) => {
        this.getConnectorCallCount += 1;
        return this.connectorById(connectorId);
      },
      getTerminalPtySession: this.unsupported,
      getWorkspaceNote: this.unsupported,
      killTerminalPtySession: this.unsupported,
      listAgentExecutorRuns: this.unsupported,
      listAgentQueueTasks: async () => [],
      listJdbcConnectors: async () => {
        this.connectorListCallCount += 1;
        return this.connectors();
      },
      listTerminalPtySessions: async () => [],
      listWidgetLogs: async () => [],
      listWorkspaceNotes: async () => [],
      logRefreshTokens: {},
      removeWidgetInstance: async () => undefined,
      resizeTerminalPtySession: this.unsupported,
      runCodexDirectWork: this.unsupported,
      runDirectWorkValidation: this.unsupported,
      runTerminalCommand: this.unsupported,
      startAssignedAgentQueueTask: this.unsupported,
      startAgentQueueRunnerSession: this.unsupported,
      startCodexDirectWorkStream: this.unsupported,
      stopAgentQueueRunnerSession: this.unsupported,
      stopTerminalPtySession: this.unsupported,
      updateAgentQueueTask: this.unsupported,
      updateJdbcConnector: async () => {
        this.updateConnectorCallCount += 1;
        return null;
      },
      updateWidgetLayout: async () => undefined,
      updateWidgetState: async () => undefined,
      updateWorkspaceNote: this.unsupported,
      validateJdbcReadOnlySql: async (_widgetInstanceId, request) => {
        if (this.scenario === "unsupported") {
          throw new Error(
            "JDBC SQL validation is only available in the Tauri desktop shell. Browser fallback cannot validate JDBC SQL.",
          );
        }

        this.validateCallCount += 1;
        const validation = validateSmokeSql(request.sql);
        this.lastValidatedSql = request.sql;
        this.lastValidationValid = validation.isValid;
        this.lastValidationReason = validation.rejectionReason;
        return validation;
      },
      writeTerminalPtySession: this.unsupported,
    } satisfies WorkbenchWidgetInstanceActions;
  }

  snapshot(): SmokeSnapshot {
    return {
      connectorListCallCount: this.connectorListCallCount,
      coordinatorCallCount: this.coordinatorCallCount,
      createConnectorCallCount: this.createConnectorCallCount,
      executeCallCount: this.executeCallCount,
      getConnectorCallCount: this.getConnectorCallCount,
      lastExecutedRowLimit: this.lastExecutedRowLimit,
      lastExecutedSql: this.lastExecutedSql,
      lastResultStatus: this.lastResultStatus,
      lastValidatedSql: this.lastValidatedSql,
      lastValidationReason: this.lastValidationReason,
      lastValidationValid: this.lastValidationValid,
      scenario: this.scenario,
      updateConnectorCallCount: this.updateConnectorCallCount,
      validateCallCount: this.validateCallCount,
    };
  }

  private connectorById(connectorId: string) {
    return (
      this.connectors().find((connector) => connector.connectorId === connectorId) ??
      null
    );
  }

  private connectors() {
    if (this.scenario === "no-connectors") {
      return [];
    }

    if (this.scenario === "not-configured") {
      return [
        smokeConnector(
          "jdbc-smoke-not-configured",
          "Smoke not configured connector",
          "not_configured",
        ),
      ];
    }

    return [
      smokeConnector("jdbc-smoke-primary", "Smoke read-only connector"),
      smokeConnector("jdbc-smoke-analytics", "Smoke analytics connector"),
    ];
  }

  private unsupported = async (): Promise<never> => {
    throw new Error("Unsupported JDBC smoke action.");
  };
}

function SmokeWorkbench() {
  const scenario = smokeScenario();
  const runtime = useMemo(
    () => new JdbcReadOnlyUiSmokeRuntime(scenario),
    [scenario],
  );
  const viewState = useMemo(() => smokeViewState(), []);

  window.__HOBIT_JDBC_READ_ONLY_SMOKE__ = {
    scenario,
    secretSentinel: SECRET_SENTINEL,
    snapshot: () => runtime.snapshot(),
  };

  return (
    <main className="app-shell">
      <h1>JDBC read-only UI smoke</h1>
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

function executeSmokeQuery({
  connector,
  rowLimit,
  scenario,
  sql,
}: {
  connector: JdbcConnector | null;
  rowLimit: number;
  scenario: SmokeScenario;
  sql: string;
}): JdbcReadOnlyQueryResult {
  const validation = validateSmokeSql(sql);

  if (!validation.isValid) {
    return resultBase({
      connector,
      status: "validation_failed",
      validation,
      sanitizedError: validation.rejectionReason ?? "SQL was rejected.",
    });
  }

  if (!connector || connector.status !== "configured") {
    return resultBase({
      connector,
      status: "not_configured",
      validation,
      sanitizedError: "Connector runtime is not configured for mock smoke.",
    });
  }

  const effectiveLimit = Math.max(1, Math.min(100, Math.trunc(rowLimit)));
  const rowCount = scenario === "caps" ? 4 : 1;
  const returnedRowCount = Math.min(effectiveLimit, rowCount);
  const longCell =
    "bounded-long-cell-" +
    "x".repeat(scenario === "caps" ? 180 : 12);
  const rows = Array.from({ length: returnedRowCount }, (_, index) => [
    String(index + 1),
    index === 0 ? longCell : `sample-${index + 1}`,
  ]);

  return {
    ...resultBase({ connector, status: "completed", validation }),
    columns: [
      { name: "row_number", valueKind: "integer" },
      { name: "sample_value", valueKind: "text" },
    ],
    durationMs: scenario === "caps" ? 17 : 9,
    returnedRowCount,
    rowCount,
    rowLimit: effectiveLimit,
    rows,
    truncated: returnedRowCount < rowCount || scenario === "caps",
    truncatedBytes: false,
    truncatedCells: scenario === "caps",
    truncatedColumns: false,
    truncatedRows: returnedRowCount < rowCount,
  };
}

function resultBase({
  connector,
  sanitizedError = null,
  status,
  validation,
}: {
  connector: JdbcConnector | null;
  sanitizedError?: string | null;
  status: string;
  validation: JdbcReadOnlySqlValidation;
}): JdbcReadOnlyQueryResult {
  return {
    columns: [],
    connectorDisplayName: connector?.displayName ?? null,
    connectorId: connector?.connectorId ?? "missing-connector",
    durationMs: 0,
    mockExecution: true,
    noAiContextShared: true,
    noSecretsReturned: true,
    returnedRowCount: 0,
    rowCount: 0,
    rowLimit: 100,
    rows: [],
    sanitizedError,
    statementKind: validation.statementKind,
    status,
    truncated: false,
    truncatedBytes: false,
    truncatedCells: false,
    truncatedColumns: false,
    truncatedRows: false,
    validation,
  };
}

function validateSmokeSql(sql: string): JdbcReadOnlySqlValidation {
  const trimmed = sql.trim();

  if (!trimmed) {
    return rejected(sql, "SQL is required.");
  }

  if (trimmed.includes(";")) {
    return rejected(sql, "Multiple statements are not allowed.");
  }

  if (
    /\b(insert|update|delete|drop|alter|create|truncate|merge|copy|grant|revoke|call|exec|execute|set|use|begin|commit|rollback)\b/i.test(
      trimmed,
    )
  ) {
    return rejected(sql, "Only conservative read-only SQL is allowed.");
  }

  const match = /^(select|with|show|describe|explain)\b/i.exec(trimmed);
  if (!match) {
    return rejected(sql, "SQL must start with SELECT, WITH, SHOW, or DESCRIBE.");
  }

  const statementKind = match[1].toUpperCase();
  return {
    isValid: true,
    normalizedPreview: trimmed.slice(0, 120),
    rejectionReason: null,
    safetyNotes: ["Mock smoke validation only; no database connection."],
    statementKind,
  };
}

function rejected(sql: string, reason: string): JdbcReadOnlySqlValidation {
  return {
    isValid: false,
    normalizedPreview: sql.trim().slice(0, 120),
    rejectionReason: reason,
    safetyNotes: ["Rejected before mock execution."],
    statementKind: null,
  };
}

function smokeConnector(
  connectorId: string,
  displayName: string,
  status: JdbcConnector["status"] = "configured",
): JdbcConnector {
  return {
    connectorId,
    createdAt: CREATED_AT,
    databaseKind: "generic_jdbc",
    displayName,
    driverKind: "jdbc",
    environment: "smoke",
    jdbcUrlMasked: "jdbc:smoke://masked-host/***",
    lastUsedAt: null,
    notes: "Frontend smoke connector metadata only.",
    readOnlyDefault: true,
    status,
    updatedAt: UPDATED_AT,
    workspaceId: WORKSPACE_ID,
  };
}

function smokeScenario(): SmokeScenario {
  const scenario = new URLSearchParams(window.location.search).get("scenario");

  if (
    scenario === "caps" ||
    scenario === "no-connectors" ||
    scenario === "not-configured" ||
    scenario === "unsupported" ||
    scenario === "valid" ||
    scenario === "validation"
  ) {
    return scenario;
  }

  return "valid";
}

function smokeViewState(): WorkbenchViewState {
  return {
    recentEvents: [],
    sharedStateObjects: [],
    widgets: [jdbcWidget()],
    workbench: {
      id: WORKBENCH_ID,
      preset: {
        description: "JDBC read-only UI smoke",
        id: "preset-jdbc-read-only-ui-smoke",
        title: "JDBC Read-only UI Smoke",
      },
    },
    workspace: {
      description: "Mocked JDBC frontend smoke workspace",
      id: WORKSPACE_ID,
      status: "active",
      title: "JDBC Read-only UI Smoke",
    },
  };
}

function jdbcWidget(): WidgetInstance {
  return {
    config: {},
    definitionId: JDBC_WIDGET_DEFINITION_ID,
    id: JDBC_WIDGET_ID,
    layout: dockedLayout(0, 24, 24, 980, 960),
    state: {},
    title: "Database / JDBC",
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
