import { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { JdbcConnector } from "../workspace/jdbcConnectorTypes";
import type {
  JdbcReadOnlyQueryResult,
  JdbcReadOnlySqlValidation,
  JdbcSidecarDiagnostic,
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
    expect(document.body.textContent).toContain("Experimental sidecar runtime");
    expect(document.body.textContent).toContain("Runtime diagnostics");
    expect(document.body.textContent).toContain("Check sidecar");
    expect(document.body.textContent).toContain("Probe driver");
    expect(document.body.textContent).toContain("Password env var name");
    expect(document.body.textContent).toContain("password value");
    expect(
      document.querySelector('[aria-label="Read-only safety notice"]'),
    ).not.toBeNull();
    expect(document.querySelector("textarea.jdbc-sql-editor")).not.toBeNull();
    expect(document.querySelector('input[type="password"]')).toBeNull();
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
      experimentalSidecar: null,
      maxResultBytes: 262144,
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

  it("passes explicit non-secret experimental sidecar runtime values only on Run", async () => {
    const onValidate = vi.fn(async () => validValidation());
    const onExecute = vi.fn(async () =>
      completedResult({ mockExecution: false, rows: [["1", "real sample"]] }),
    );
    await renderJdbcWidget({
      onExecuteJdbcReadOnlyQuery: onExecute,
      onValidateJdbcReadOnlySql: onValidate,
    });

    await setCheckboxByLabel(
      "Enable experimental real JDBC sidecar for the next Run",
      true,
    );
    await changeInputByLabel("Sidecar classpath or classes dir", "target/jdbc/classes");
    await changeInputByLabel("Driver JAR path", "C:\\drivers\\postgres.jar");
    await changeInputByLabel("Driver class", "org.postgresql.Driver");
    await changeInputByLabel(
      "Runtime JDBC URL",
      "jdbc:postgresql://localhost/app",
    );
    await changeInputByLabel("Username", "readonly_user");
    await changeInputByLabel(
      "Password env var name",
      "HOBIT_READONLY_DB_PASSWORD",
    );

    await clickButton("Validate SQL");
    await clickButton("Run read-only query");

    expect(onExecute).toHaveBeenCalledWith("jdbc_widget_1", {
      connectorId: "jdbc_1",
      experimentalSidecar: {
        credentialEnvVarName: "HOBIT_READONLY_DB_PASSWORD",
        driverClassName: "org.postgresql.Driver",
        driverJarPath: "C:\\drivers\\postgres.jar",
        enabled: true,
        javaProgram: "java",
        jdbcUrl: "jdbc:postgresql://localhost/app",
        maxResultBytes: 262144,
        maxRows: 100,
        sidecarClasspath: "target/jdbc/classes",
        sidecarJarPath: null,
        sidecarMainClass: "com.hobit.jdbc.JdbcReadOnlySidecar",
        timeoutMs: 10000,
        username: "readonly_user",
      },
      maxResultBytes: 262144,
      rowLimit: 100,
      sql: "select 1",
      timeoutMs: 10000,
    });
    expect(document.body.textContent).toContain("Completed");
    expect(document.body.textContent).not.toContain("Attach to Workspace Agent");
  });

  it("runs explicit sidecar health diagnostics and renders collapsed details", async () => {
    const onCheck = vi.fn(async () =>
      diagnosticResult({
        action: "health_check",
        details: "sidecar=healthy",
        message: "JDBC sidecar started and answered HealthCheck.",
        ok: true,
        status: "ok",
      }),
    );
    await renderJdbcWidget({
      onCheckJdbcSidecarHealth: onCheck,
    });

    await clickButton("Check sidecar");

    expect(onCheck).toHaveBeenCalledWith("jdbc_widget_1", {
      experimentalSidecar: expect.objectContaining({
        enabled: true,
        javaProgram: "java",
        sidecarClasspath: null,
        sidecarJarPath: null,
      }),
    });
    expect(document.body.textContent).toContain("OK");
    expect(document.body.textContent).toContain(
      "JDBC sidecar started and answered HealthCheck.",
    );
    expect(
      document.querySelector<HTMLDetailsElement>(".jdbc-diagnostic-details")
        ?.open,
    ).toBe(false);
  });

  it("runs explicit driver probe diagnostics without running SQL", async () => {
    const onProbe = vi.fn(async () =>
      diagnosticResult({
        action: "driver_probe",
        details: "driver=loaded",
        message: "JDBC driver probe loaded the explicit driver JAR/class.",
        ok: true,
        status: "ok",
      }),
    );
    const onExecute = vi.fn(async () => completedResult());
    await renderJdbcWidget({
      onExecuteJdbcReadOnlyQuery: onExecute,
      onProbeJdbcDriver: onProbe,
    });

    await changeInputByLabel("Driver JAR path", "C:\\drivers\\postgres.jar");
    await changeInputByLabel("Driver class", "org.postgresql.Driver");
    await clickButton("Probe driver");

    expect(onProbe).toHaveBeenCalledWith("jdbc_widget_1", {
      experimentalSidecar: expect.objectContaining({
        driverClassName: "org.postgresql.Driver",
        driverJarPath: "C:\\drivers\\postgres.jar",
        enabled: true,
        jdbcUrl: "",
      }),
    });
    expect(onExecute).not.toHaveBeenCalled();
    expect(document.body.textContent).toContain("JDBC driver probe loaded");
  });

  it("renders diagnostic failures without expanding error details", async () => {
    await renderJdbcWidget({
      onProbeJdbcDriver: vi.fn(async () =>
        diagnosticResult({
          action: "driver_probe",
          details: null,
          message: "JDBC driver JAR path is required for driver probe.",
          ok: false,
          status: "not_configured",
        }),
      ),
    });

    await clickButton("Probe driver");

    expect(document.body.textContent).toContain("Failed");
    expect(document.body.textContent).toContain(
      "JDBC driver JAR path is required for driver probe.",
    );
    const details = document.querySelector<HTMLDetailsElement>(
      ".jdbc-diagnostic-details",
    );
    expect(details?.textContent).toContain("Error details");
    expect(details?.open).toBe(false);
  });

  it("shows rejected write SQL and keeps Workspace Agent out of execution", async () => {
    const onValidate = vi.fn(async () => ({
      ...validValidation(),
      isValid: false,
      rejectionReason: "SQL contains unsupported or mutating token: UPDATE.",
      statementKind: null,
    }));
    const onExecute = vi.fn(async () => completedResult());
    await renderJdbcWidget({
      onExecuteJdbcReadOnlyQuery: onExecute,
      onValidateJdbcReadOnlySql: onValidate,
    });

    await changeSql("update accounts set balance = 0");
    await clickButton("Validate SQL");

    expect(document.body.textContent).toContain("Rejected");
    expect(document.body.textContent).toContain(
      "SQL contains unsupported or mutating token: UPDATE.",
    );
    expect(buttonWithText("Run read-only query")?.disabled).toBe(true);
    expect(onExecute).not.toHaveBeenCalled();
    expect(document.body.textContent).toContain("Workspace Agent cannot run SQL");
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
      onCheckJdbcSidecarHealth={vi.fn(async () => diagnosticResult())}
      onExecuteJdbcReadOnlyQuery={vi.fn(async () => completedResult())}
      onGetJdbcConnector={vi.fn(async () => connector())}
      onListJdbcConnectors={vi.fn(async () => [connector()])}
      onLoadLogs={vi.fn(async () => [])}
      onProbeJdbcDriver={vi.fn(async () => diagnosticResult())}
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

async function changeSql(value: string) {
  const textarea = document.querySelector<HTMLTextAreaElement>(
    "textarea.jdbc-sql-editor",
  );

  if (!textarea) {
    throw new Error("SQL textarea not found");
  }

  await act(async () => {
    setNativeValue(textarea, value);
    textarea.dispatchEvent(new Event("input", { bubbles: true }));
    await flushPromises();
  });
}

async function changeInputByLabel(labelText: string, value: string) {
  const input = inputByLabel<HTMLInputElement>(labelText);

  await act(async () => {
    setNativeValue(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
    await flushPromises();
  });
}

function setNativeValue(
  element: HTMLInputElement | HTMLTextAreaElement,
  value: string,
) {
  const prototype =
    element instanceof HTMLTextAreaElement
      ? HTMLTextAreaElement.prototype
      : HTMLInputElement.prototype;
  const valueSetter = Object.getOwnPropertyDescriptor(prototype, "value")?.set;
  valueSetter?.call(element, value);
}

async function setCheckboxByLabel(labelText: string, checked: boolean) {
  const input = inputByLabel<HTMLInputElement>(labelText);

  await act(async () => {
    if (input.checked !== checked) {
      input.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    }
    await flushPromises();
  });
}

function inputByLabel<T extends HTMLInputElement | HTMLTextAreaElement>(
  labelText: string,
): T {
  const label = Array.from(document.querySelectorAll("label")).find((element) =>
    (element.textContent ?? "").includes(labelText),
  );

  if (!label) {
    throw new Error(`Label not found: ${labelText}`);
  }

  const input = label.querySelector("input, textarea") as T | null;

  if (!input) {
    throw new Error(`Input not found for label: ${labelText}`);
  }

  return input;
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

function completedResult(
  overrides: Partial<JdbcReadOnlyQueryResult> = {},
): JdbcReadOnlyQueryResult {
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
    ...overrides,
  };
}

function failedResult(
  status: string,
  sanitizedError: string,
): JdbcReadOnlyQueryResult {
  return resultBase(status, sanitizedError);
}

function diagnosticResult(
  overrides: Partial<JdbcSidecarDiagnostic> = {},
): JdbcSidecarDiagnostic {
  return {
    action: "health_check",
    details: "sidecar=healthy",
    durationMs: 1,
    message: "JDBC sidecar started and answered HealthCheck.",
    noAiContextShared: true,
    noSecretsReturned: true,
    ok: true,
    status: "ok",
    ...overrides,
  };
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
