import { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { JdbcConnector } from "../workspace/jdbcConnectorTypes";
import type {
  JdbcReadOnlyQueryResult,
  JdbcReadOnlySqlValidation,
} from "../workspace/jdbcQueryTypes";
import { JdbcConnectorWidget } from "./JdbcConnectorWidget";
import type { WidgetInstance, WidgetRenderProps } from "./types";
import {
  getWidgetDefinition,
  JDBC_WIDGET_DEFINITION_ID,
} from "./widgetRegistry";

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
  document.body.innerHTML = "";
});

describe("JdbcConnectorWidget", () => {
  it("renders honest Preview, read-only, mock runtime, and query editor status", async () => {
    await renderJdbcWidget();

    expect(document.body.textContent).toContain("Database / JDBC Preview");
    expect(document.body.textContent).toContain("Mock read-only");
    expect(document.body.textContent).toContain(
      "No production database connection",
    );
    expect(document.body.textContent).toContain(
      "No hidden Workspace Agent SQL execution",
    );
    expect(document.body.textContent).toContain("Query editor");
    expect(
      document.querySelector('[aria-label="Read-only safety notice"]'),
    ).not.toBeNull();
    expect(document.querySelector("textarea.jdbc-sql-editor")).not.toBeNull();
    expect(buttonWithText("Run read-only query")).not.toBeNull();
    expect(
      buttonTexts().some((text) =>
        /run write|execute write|ddl|dml|drop table|alter table/i.test(text),
      ),
    ).toBe(false);
  });

  it("validates, executes through the existing callback shape, and renders mock results", async () => {
    const onValidate = vi.fn(async () => validValidation());
    const onExecute = vi.fn(async () => completedResult());
    await renderJdbcWidget({
      onExecuteJdbcReadOnlyQuery: onExecute,
      onValidateJdbcReadOnlySql: onValidate,
    });

    await clickButton("Validate SQL");
    expect(onValidate).toHaveBeenCalledWith("jdbc_widget_1", {
      connectorId: "jdbc_1",
      rowLimit: 100,
      sql: "select 1",
      timeoutMs: 10000,
    });

    await clickButton("Run read-only query");
    expect(onExecute).toHaveBeenCalledWith("jdbc_widget_1", {
      connectorId: "jdbc_1",
      rowLimit: 100,
      sql: "select 1",
      timeoutMs: 10000,
    });
    expect(document.body.textContent).toContain("Completed");
    expect(document.body.textContent).toContain("sample_index");
    expect(document.body.textContent).toContain("Deterministic mock sample");
    expect(document.body.textContent).toContain("No AI sharing");
  });

  it("renders unsupported or not-configured runtime errors clearly", async () => {
    await renderJdbcWidget({
      onExecuteJdbcReadOnlyQuery: vi.fn(async () =>
        failedResult("not_configured", "JDBC sidecar runtime is not configured."),
      ),
      onValidateJdbcReadOnlySql: vi.fn(async () => validValidation()),
    });

    await clickButton("Validate SQL");
    await clickButton("Run read-only query");

    expect(document.body.textContent).toContain(
      "Read-only query stopped: not_configured",
    );
    expect(document.body.textContent).toContain(
      "JDBC sidecar runtime is not configured.",
    );
    expect(document.body.textContent).toContain(
      "No database write, hidden execution, or AI result sharing occurred.",
    );
  });
});

async function renderJdbcWidget(
  overrides: Partial<WidgetRenderProps> = {},
) {
  await render(
    <JdbcConnectorWidget
      config={{}}
      definition={getWidgetDefinition(JDBC_WIDGET_DEFINITION_ID)!}
      instance={jdbcWidgetInstance()}
      onCreateJdbcConnector={vi.fn(async () => connector())}
      onExecuteJdbcReadOnlyQuery={vi.fn(async () => completedResult())}
      onGetJdbcConnector={vi.fn(async () => connector())}
      onListJdbcConnectors={vi.fn(async () => [connector()])}
      onLoadLogs={vi.fn(async () => [])}
      onUpdateJdbcConnector={vi.fn(async () => connector())}
      onValidateJdbcReadOnlySql={vi.fn(async () => validValidation())}
      title="Database / JDBC"
      {...overrides}
    />,
  );
}

async function render(element: ReactNode) {
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);

  await act(async () => {
    root?.render(element);
    await flushPromises();
  });
  await act(async () => {
    await flushPromises();
  });
}

async function clickButton(text: string) {
  const button = buttonWithText(text);

  if (!button) {
    throw new Error(`Button not found: ${text}`);
  }

  await act(async () => {
    button.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    await flushPromises();
  });
  await act(async () => {
    await flushPromises();
  });
}

async function flushPromises() {
  await Promise.resolve();
  await Promise.resolve();
}

function buttonWithText(text: string) {
  return Array.from(document.querySelectorAll("button")).find(
    (button) => button.textContent === text,
  );
}

function buttonTexts() {
  return Array.from(document.querySelectorAll("button")).map(
    (button) => button.textContent ?? "",
  );
}

function jdbcWidgetInstance(): WidgetInstance {
  return {
    config: {},
    definitionId: JDBC_WIDGET_DEFINITION_ID,
    id: "jdbc_widget_1",
    layout: {
      area: "main",
      height: 600,
      mode: "docked",
      order: 0,
      width: 768,
      x: 0,
      y: 0,
    },
    state: {},
    title: "Database / JDBC",
    visible: true,
  };
}

function connector(
  overrides: Partial<JdbcConnector> = {},
): JdbcConnector {
  return {
    connectorId: "jdbc_1",
    createdAt: "2026-05-20T10:00:00.000Z",
    databaseKind: "generic_jdbc",
    displayName: "Analytics readonly",
    driverKind: "jdbc",
    environment: "dev",
    jdbcUrlMasked: "jdbc:postgresql://db.example.test/app",
    lastUsedAt: null,
    notes: "Metadata only.",
    readOnlyDefault: true,
    status: "configured",
    updatedAt: "2026-05-20T10:00:01.000Z",
    workspaceId: "workspace_1",
    ...overrides,
  };
}

function validValidation(): JdbcReadOnlySqlValidation {
  return {
    isValid: true,
    normalizedPreview: "select 1",
    rejectionReason: null,
    safetyNotes: ["Mock adapter only; no database connection is opened."],
    statementKind: "SELECT",
  };
}

function completedResult(): JdbcReadOnlyQueryResult {
  return {
    ...resultBase("completed", null),
    columns: [
      { name: "sample_index", valueKind: "text" },
      { name: "sql_preview", valueKind: "text" },
    ],
    connectorDisplayName: "Analytics readonly",
    durationMs: 0,
    returnedRowCount: 1,
    rowCount: 1,
    rows: [["1", "Deterministic mock sample"]],
    statementKind: "SELECT",
  };
}

function failedResult(
  status: string,
  sanitizedError: string,
): JdbcReadOnlyQueryResult {
  return resultBase(status, sanitizedError);
}

function resultBase(
  status: string,
  sanitizedError: string | null,
): JdbcReadOnlyQueryResult {
  return {
    columns: [],
    connectorDisplayName: "Analytics readonly",
    connectorId: "jdbc_1",
    durationMs: 0,
    mockExecution: true,
    noAiContextShared: true,
    noSecretsReturned: true,
    returnedRowCount: 0,
    rowCount: 0,
    rowLimit: 100,
    rows: [],
    sanitizedError,
    statementKind: "SELECT",
    status,
    truncated: false,
    truncatedBytes: false,
    truncatedCells: false,
    truncatedColumns: false,
    truncatedRows: false,
    validation: validValidation(),
  };
}
