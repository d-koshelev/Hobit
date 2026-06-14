import { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { JdbcConnector } from "../workspace/jdbcConnectorTypes";
import type {
  JdbcConnectionProfile,
  JdbcReadOnlyQueryResult,
  JdbcReadOnlySqlValidation,
  JdbcSidecarDiagnostic,
} from "../workspace/jdbcQueryTypes";
import { JdbcBoundaryFinderPanel } from "./JdbcBoundaryFinderPanel";
import { JdbcConnectorWidget } from "./JdbcConnectorWidget";
import {
  findJdbcBoundary,
  renderJdbcBoundarySql,
  validateJdbcBoundaryPreset,
  type JdbcBoundaryPreset,
} from "./jdbcConnectorWidgetModel";
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
  Object.defineProperty(navigator, "clipboard", {
    configurable: true,
    value: undefined,
  });
  document.body.innerHTML = "";
});

describe("JdbcConnectorWidget", () => {
  it("renders honest read-only mock runtime and query editor status", async () => {
    await renderJdbcWidget();

    expect(document.body.textContent).toContain(
      "No production database connection",
    );
    expect(document.body.textContent).toContain(
      "No hidden Workspace Agent SQL execution",
    );
    expect(document.body.textContent).toContain("Query editor");
    expect(document.body.textContent).toContain("Real JDBC sidecar settings");
    expect(document.body.textContent).toContain("Runtime diagnostics");
    expect(document.body.textContent).toContain("Connection profiles");
    expect(document.body.textContent).toContain("Check sidecar");
    expect(document.body.textContent).toContain("Probe driver");
    expect(document.body.textContent).toContain("Password env var name");
    expect(document.body.textContent).toContain("password value");
    expect(document.body.textContent).not.toContain("Database / JDBC Preview");
    expect(document.body.textContent).not.toContain("Mock read-only");
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

  it("renders the Boundary Finder preset UI and typed filter inputs", async () => {
    await renderJdbcWidget();

    expect(document.body.textContent).toContain("Boundary Finder");
    expect(document.body.textContent).toContain("Numeric threshold sample");
    expect(document.body.textContent).toContain("Timestamp window sample");
    expect(selectByLabel("Boundary Finder preset")).not.toBeNull();
    expect(inputByLabel<HTMLInputElement>("Tenant required")).not.toBeNull();
    expect(
      inputByLabel<HTMLInputElement>("Business date required"),
    ).not.toBeNull();
    expect(selectByLabel("Active required")).not.toBeNull();
    expect(
      inputByLabel<HTMLInputElement>("Minimum score required"),
    ).not.toBeNull();
    expect(
      inputByLabel<HTMLInputElement>("Minimum shard required"),
    ).not.toBeNull();
    expect(inputByLabel<HTMLInputElement>("States required")).not.toBeNull();
    expect(inputByLabel<HTMLInputElement>("Shard ids required")).not.toBeNull();
    expect(inputByLabel<HTMLInputElement>("Range min")).not.toBeNull();
    expect(inputByLabel<HTMLInputElement>("Range max")).not.toBeNull();
    expect(inputByLabel<HTMLInputElement>("Precision")).not.toBeNull();
    expect(inputByLabel<HTMLInputElement>("Sample probe value")).not.toBeNull();
    expect(
      document.querySelector('[aria-label="Boundary Finder SQL preview"]'),
    ).not.toBeNull();
  });

  it("renders Boundary Finder required filter validation", async () => {
    await renderJdbcWidget();

    await changeInputByLabel("Tenant required", "");

    expect(document.body.textContent).toContain(
      "Missing required boundary filter value: tenant.",
    );
    expect(sqlPreviewText()).toContain(
      "Fix validation errors to render the SQL preview.",
    );
  });

  it("renders Boundary Finder invalid typed value validation", async () => {
    await renderJdbcWidget();

    await changeInputByLabel("Shard ids required", "1, nope");

    expect(document.body.textContent).toContain(
      "Boundary filter shards must be a finite number.",
    );
  });

  it("renders Boundary Finder SQL preview with typed literal values", async () => {
    await renderJdbcWidget();

    await changeInputByLabel("Tenant required", "Ada's team");

    const previewText = sqlPreviewText();
    expect(previewText).toContain("select count(*) > 0 as found");
    expect(previewText).toContain("tenant = 'Ada''s team'");
    expect(previewText).toContain("business_date = '2026-05-01'");
    expect(previewText).toContain("active = TRUE");
    expect(previewText).toContain("score >= 10.5");
    expect(previewText).toContain("shard_id in (1, 2)");
    expect(previewText).toContain("event_id >= 50");
  });

  it("renders Boundary Finder unknown placeholder errors", async () => {
    await render(
      <JdbcBoundaryFinderPanel
        presets={[
          boundaryPreset({
            description: "Broken placeholder test preset.",
            sqlTemplate:
              "select count(*) > 0 as found from events where tenant = {{tenant}} and region = {{region}} and event_id >= {{value}}",
          }),
        ]}
      />,
    );

    expect(document.body.textContent).toContain(
      "Boundary SQL template contains unknown placeholder: region.",
    );
    expect(sqlPreviewText()).toContain(
      "Fix validation errors to render the SQL preview.",
    );
  });

  it("renders Boundary Finder SQL fragment rejection without executing queries", async () => {
    const onExecute = vi.fn(async () => completedResult());
    await renderJdbcWidget({
      onExecuteJdbcReadOnlyQuery: onExecute,
    });

    await changeInputByLabel("Tenant required", "x' OR 1=1 --");

    expect(document.body.textContent).toContain(
      "Boundary filter tenant must be a scalar value, not a SQL fragment.",
    );
    expect(onExecute).not.toHaveBeenCalled();
  });

  it("keeps Boundary Finder execution unavailable and not wired to Workspace Agent", async () => {
    const onExecute = vi.fn(async () => completedResult());
    await renderJdbcWidget({
      onExecuteJdbcReadOnlyQuery: onExecute,
    });

    expect(buttonWithText("Run boundary search")).toBeUndefined();
    expect(document.body.textContent).toContain(
      "No Boundary Finder probes, JDBC queries, sidecar calls, Queue tasks, Agent Executor runs, or Workspace Agent actions",
    );
    expect(document.body.textContent).not.toContain("Attach to Workspace Agent");
    expect(onExecute).not.toHaveBeenCalled();
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
    expect(document.body.textContent).toContain("1 row");
    expect(document.body.textContent).toContain("2 columns");
    expect(document.body.textContent).toContain("Truncated: no");
    expect(document.body.textContent).toContain("Max rows 100");
    expect(document.body.textContent).toContain("Max result bytes 256 KiB");
    expect(document.body.textContent).toContain("No AI sharing");
  });

  it("renders result summary row, column, elapsed, caps, and truncation state", async () => {
    await renderJdbcWidget({
      onExecuteJdbcReadOnlyQuery: vi.fn(async () =>
        completedResult({
          columns: [
            { name: "id", valueKind: "number" },
            { name: "name", valueKind: "text" },
            { name: "active", valueKind: "boolean" },
            { name: "notes", valueKind: "text" },
          ],
          durationMs: 18,
          returnedRowCount: 2,
          rowCount: 4,
          rowLimit: 2,
          rows: [
            ["1", "Ada", "true", "first"],
            ["2", "Ben", "false", "second"],
          ],
          truncated: true,
          truncatedRows: true,
        }),
      ),
      onValidateJdbcReadOnlySql: vi.fn(async () => validValidation()),
    });

    await clickButton("Validate SQL");
    await clickButton("Run read-only query");

    expect(document.body.textContent).toContain("2 rows shown of 4 total");
    expect(document.body.textContent).toContain("4 columns");
    expect(document.body.textContent).toContain("18 ms");
    expect(document.body.textContent).toContain("Truncated: yes");
    expect(document.body.textContent).toContain("Max rows 2");
    expect(document.body.textContent).toContain("Timeout 10000 ms");
    expect(document.body.textContent).toContain("Max rows cap reached.");
  });

  it("renders a clear empty result state", async () => {
    await renderJdbcWidget({
      onExecuteJdbcReadOnlyQuery: vi.fn(async () =>
        completedResult({
          columns: [{ name: "id", valueKind: "number" }],
          returnedRowCount: 0,
          rowCount: 0,
          rows: [],
        }),
      ),
      onValidateJdbcReadOnlySql: vi.fn(async () => validValidation()),
    });

    await clickButton("Validate SQL");
    await clickButton("Run read-only query");

    expect(document.body.textContent).toContain(
      "No rows returned query completed",
    );
    expect(document.body.textContent).toContain("No rows returned.");
    expect(document.body.textContent).toContain(
      "Query completed with a visible empty result.",
    );
  });

  it("renders NULL and long values safely in the result grid", async () => {
    const longValue =
      "This is a long database value that should remain inspectable by title while the visible cell stays clipped.";
    await renderJdbcWidget({
      onExecuteJdbcReadOnlyQuery: vi.fn(async () =>
        completedResult({
          columns: [
            { name: "nullable_name", valueKind: "text" },
            { name: "long_note", valueKind: "text" },
          ],
          rows: [[null, longValue]],
        }),
      ),
      onValidateJdbcReadOnlySql: vi.fn(async () => validValidation()),
    });

    await clickButton("Validate SQL");
    await clickButton("Run read-only query");

    expect(document.body.textContent).toContain("NULL");
    expect(
      document.querySelector<HTMLElement>(".jdbc-result-null")?.textContent,
    ).toBe("NULL");
    expect(
      document.querySelector<HTMLElement>(".jdbc-result-cell-value")?.title,
    ).toBe(longValue);
  });

  it("copies visible results as TSV and renders copy feedback", async () => {
    const writeText = vi.fn(async () => undefined);
    stubClipboard(writeText);
    await renderJdbcWidget({
      onExecuteJdbcReadOnlyQuery: vi.fn(async () =>
        completedResult({
          columns: [
            { name: "id", valueKind: "number" },
            { name: "name", valueKind: "text" },
          ],
          rows: [["1", "Ada"], [null, "Ben"]],
        }),
      ),
      onValidateJdbcReadOnlySql: vi.fn(async () => validValidation()),
    });

    await clickButton("Validate SQL");
    await clickButton("Run read-only query");
    await clickButton("Copy results");

    expect(writeText).toHaveBeenCalledWith("id\tname\n1\tAda\nNULL\tBen");
    expect(document.body.textContent).toContain("Results copied as TSV.");
  });

  it("renders compact copy failure feedback", async () => {
    const writeText = vi.fn(async () => {
      throw new Error("clipboard denied");
    });
    stubClipboard(writeText);
    await renderJdbcWidget({
      onExecuteJdbcReadOnlyQuery: vi.fn(async () => completedResult()),
      onValidateJdbcReadOnlySql: vi.fn(async () => validValidation()),
    });

    await clickButton("Validate SQL");
    await clickButton("Run read-only query");
    await clickButton("Copy results");

    expect(document.body.textContent).toContain("Copy failed.");
  });

  it("copies the selected query text when requested", async () => {
    const writeText = vi.fn(async () => undefined);
    stubClipboard(writeText);
    await renderJdbcWidget();

    await clickButton("Copy SQL");

    expect(writeText).toHaveBeenCalledWith("select 1");
    expect(document.body.textContent).toContain("SQL copied.");
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

  it("renders redacted compact error details without raw secret text", async () => {
    const writeText = vi.fn(async () => undefined);
    stubClipboard(writeText);
    await renderJdbcWidget({
      onExecuteJdbcReadOnlyQuery: vi.fn(async () =>
        failedResult(
          "connection_failed",
          "Connection failed password=supersecret\n    at driver stack line",
        ),
      ),
      onValidateJdbcReadOnlySql: vi.fn(async () => validValidation()),
    });

    await clickButton("Validate SQL");
    await clickButton("Run read-only query");

    expect(document.body.textContent).toContain("password=[redacted]");
    expect(document.body.textContent).not.toContain("supersecret");
    expect(document.body.textContent).not.toContain("driver stack line");
    expect(
      document.querySelector<HTMLDetailsElement>(".jdbc-error-details")?.open,
    ).toBe(false);

    await clickButton("Copy error");

    expect(writeText).toHaveBeenCalledWith(
      expect.stringContaining("password=[redacted]"),
    );
    const copiedError = String(
      (writeText.mock.calls as unknown as Array<[unknown]>)[0]?.[0] ?? "",
    );
    expect(copiedError).not.toContain("supersecret");
    expect(document.body.textContent).toContain("Error details copied.");
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

    await setCheckboxByLabel("Enable real JDBC sidecar for the next Run", true);
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
    expect(document.body.textContent).toContain("Sidecar");
    expect(document.body.textContent).not.toContain("Attach to Workspace Agent");
  });

  it("saves valid non-secret profiles with password env var names only", async () => {
    const onCreateProfile = vi.fn(async (request) =>
      profile({
        description: request.description,
        driverClassName: request.driverClassName,
        driverJarPath: request.driverJarPath,
        jdbcUrl: request.jdbcUrl,
        maxResultBytes: request.maxResultBytes,
        maxRows: request.maxRows,
        name: request.name,
        passwordEnvVarName: request.passwordEnvVarName,
        timeoutMs: request.timeoutMs,
        username: request.username,
      }),
    );
    await renderJdbcWidget({
      onCreateJdbcConnectionProfile: onCreateProfile,
      onDeleteJdbcConnectionProfile: vi.fn(async () => true),
      onListJdbcConnectionProfiles: vi.fn(async () => []),
      onUpdateJdbcConnectionProfile: vi.fn(async () => profile()),
    });

    await changeInputByLabel("Profile name", "Analytics readonly");
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
    await clickButton("Save as new profile");

    expect(onCreateProfile).toHaveBeenCalledWith({
      description: "",
      driverClassName: "org.postgresql.Driver",
      driverJarPath: "C:\\drivers\\postgres.jar",
      jdbcUrl: "jdbc:postgresql://localhost/app",
      maxResultBytes: 262144,
      maxRows: 100,
      name: "Analytics readonly",
      passwordEnvVarName: "HOBIT_READONLY_DB_PASSWORD",
      readOnly: true,
      timeoutMs: 10000,
      username: "readonly_user",
    });
    expect(document.querySelector('input[type="password"]')).toBeNull();
    expect(document.body.textContent).toContain(
      "Profile saved. Select does not connect or run.",
    );
  });

  it("selects profiles without running diagnostics or queries", async () => {
    const onCheck = vi.fn(async () => diagnosticResult());
    const onProbe = vi.fn(async () => diagnosticResult());
    const onExecute = vi.fn(async () => completedResult());
    const savedProfile = profile({
      driverClassName: "org.postgresql.Driver",
      driverJarPath: "C:\\drivers\\postgres.jar",
      jdbcUrl: "jdbc:postgresql://localhost/app",
      name: "Analytics readonly",
      passwordEnvVarName: "HOBIT_READONLY_DB_PASSWORD",
      username: "readonly_user",
    });
    await renderJdbcWidget({
      onCheckJdbcSidecarHealth: onCheck,
      onCreateJdbcConnectionProfile: vi.fn(async () => savedProfile),
      onDeleteJdbcConnectionProfile: vi.fn(async () => true),
      onExecuteJdbcReadOnlyQuery: onExecute,
      onListJdbcConnectionProfiles: vi.fn(async () => [savedProfile]),
      onProbeJdbcDriver: onProbe,
      onUpdateJdbcConnectionProfile: vi.fn(async () => savedProfile),
    });

    await changeSelectByLabel("Saved profile", savedProfile.profileId);

    expect(inputByLabel<HTMLInputElement>("Driver JAR path").value).toBe(
      "C:\\drivers\\postgres.jar",
    );
    expect(inputByLabel<HTMLInputElement>("Driver class").value).toBe(
      "org.postgresql.Driver",
    );
    expect(inputByLabel<HTMLInputElement>("Runtime JDBC URL").value).toBe(
      "jdbc:postgresql://localhost/app",
    );
    expect(inputByLabel<HTMLInputElement>("Username").value).toBe(
      "readonly_user",
    );
    expect(inputByLabel<HTMLInputElement>("Password env var name").value).toBe(
      "HOBIT_READONLY_DB_PASSWORD",
    );
    expect(onCheck).not.toHaveBeenCalled();
    expect(onProbe).not.toHaveBeenCalled();
    expect(onExecute).not.toHaveBeenCalled();
  });

  it("requires explicit confirmation before deleting a profile", async () => {
    const onDeleteProfile = vi.fn(async () => true);
    const savedProfile = profile();
    await renderJdbcWidget({
      onCreateJdbcConnectionProfile: vi.fn(async () => savedProfile),
      onDeleteJdbcConnectionProfile: onDeleteProfile,
      onListJdbcConnectionProfiles: vi.fn(async () => [savedProfile]),
      onUpdateJdbcConnectionProfile: vi.fn(async () => savedProfile),
    });

    await changeSelectByLabel("Saved profile", savedProfile.profileId);
    await clickButton("Delete profile");

    expect(onDeleteProfile).not.toHaveBeenCalled();
    expect(document.body.textContent).toContain(
      "Click Confirm delete to remove this profile.",
    );

    await clickButton("Confirm delete");

    expect(onDeleteProfile).toHaveBeenCalledWith({
      profileId: savedProfile.profileId,
    });
  });

  it("rejects secret-bearing profile URLs before save", async () => {
    const onCreateProfile = vi.fn(async () => profile());
    await renderJdbcWidget({
      onCreateJdbcConnectionProfile: onCreateProfile,
      onDeleteJdbcConnectionProfile: vi.fn(async () => true),
      onListJdbcConnectionProfiles: vi.fn(async () => []),
      onUpdateJdbcConnectionProfile: vi.fn(async () => profile()),
    });

    await changeInputByLabel("Profile name", "Bad profile");
    await changeInputByLabel("Driver JAR path", "C:\\drivers\\postgres.jar");
    await changeInputByLabel("Driver class", "org.postgresql.Driver");
    await changeInputByLabel(
      "Runtime JDBC URL",
      "jdbc:postgresql://localhost/app?password=secret",
    );
    await clickButton("Save as new profile");

    expect(onCreateProfile).not.toHaveBeenCalled();
    expect(document.body.textContent).toContain(
      "JDBC URL must not contain password, token, secret, or key parameters.",
    );
  });

  it("rejects invalid profile caps before save", async () => {
    const onCreateProfile = vi.fn(async () => profile());
    await renderJdbcWidget({
      onCreateJdbcConnectionProfile: onCreateProfile,
      onDeleteJdbcConnectionProfile: vi.fn(async () => true),
      onListJdbcConnectionProfiles: vi.fn(async () => []),
      onUpdateJdbcConnectionProfile: vi.fn(async () => profile()),
    });

    await changeInputByLabel("Profile name", "Bad caps");
    await changeInputByLabel("Driver JAR path", "C:\\drivers\\postgres.jar");
    await changeInputByLabel("Driver class", "org.postgresql.Driver");
    await changeInputByLabel(
      "Runtime JDBC URL",
      "jdbc:postgresql://localhost/app",
    );
    await changeInputByLabel("Row limit", "0");
    await clickButton("Save as new profile");

    expect(onCreateProfile).not.toHaveBeenCalled();
    expect(document.body.textContent).toContain(
      "Max rows must be between 1 and 100.",
    );
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

describe("JDBC Boundary Finder preset model", () => {
  it("renders SQL with arbitrary typed filters", () => {
    expect(
      renderJdbcBoundarySql(
        boundaryPreset(),
        {
          active: true,
          createdAfter: "2026-05-01",
          maxScore: "19.5",
          minShard: "7",
          tenant: "Ada's team",
          updatedBefore: "2026-05-29T10:30:00Z",
        },
        42,
      ),
    ).toBe(
      "select count(*) > 0 as found from events where tenant = 'Ada''s team' and active = TRUE and created_at >= '2026-05-01' and updated_at < '2026-05-29T10:30:00Z' and score <= 19.5 and shard_id >= 7 and event_id >= 42",
    );
  });

  it("renders list filters as typed literal lists", () => {
    const preset = boundaryPreset({
      filters: [
        { key: "states", label: "States", required: true, type: "stringList" },
        { key: "shards", label: "Shards", required: true, type: "integerList" },
      ],
      sqlTemplate:
        "select exists(select 1 from events where state in ({{states}}) and shard_id in ({{shards}}) and event_id >= {{value}}) as found",
    });

    expect(
      renderJdbcBoundarySql(
        preset,
        {
          shards: [1, 2, 3],
          states: ["ready", "needs review"],
        },
        10,
      ),
    ).toBe(
      "select exists(select 1 from events where state in ('ready', 'needs review') and shard_id in (1, 2, 3) and event_id >= 10) as found",
    );
  });

  it("rejects unknown placeholders", () => {
    const preset = boundaryPreset({
      sqlTemplate:
        "select count(*) > 0 as found from events where tenant = {{tenant}} and region = {{region}} and event_id >= {{value}}",
    });

    expect(() =>
      renderJdbcBoundarySql(preset, validBoundaryValues(), 10),
    ).toThrow("unknown placeholder: region");
  });

  it("rejects missing required filters", () => {
    expect(() =>
      renderJdbcBoundarySql(
        boundaryPreset(),
        {
          active: true,
          createdAfter: "2026-05-01",
          maxScore: 10,
          minShard: 7,
          updatedBefore: "2026-05-29T10:30:00Z",
        },
        10,
      ),
    ).toThrow("Missing required boundary filter value: tenant");
  });

  it("rejects invalid number and date values", () => {
    expect(() =>
      renderJdbcBoundarySql(
        boundaryPreset(),
        { ...validBoundaryValues(), maxScore: "not-a-number" },
        10,
      ),
    ).toThrow("maxScore must be a finite number");

    expect(() =>
      renderJdbcBoundarySql(
        boundaryPreset(),
        { ...validBoundaryValues(), createdAfter: "2026-02-31" },
        10,
      ),
    ).toThrow("createdAfter must be a valid ISO date");
  });

  it("rejects SQL fragment filter values", () => {
    expect(() =>
      renderJdbcBoundarySql(
        boundaryPreset(),
        { ...validBoundaryValues(), tenant: "x' OR 1=1 --" },
        10,
      ),
    ).toThrow("tenant must be a scalar value, not a SQL fragment");
  });

  it("validates preset JSON has no secret fields", () => {
    const unsafePreset = {
      ...boundaryPreset(),
      token: "must-not-store",
    } as unknown as JdbcBoundaryPreset;

    expect(validateJdbcBoundaryPreset(unsafePreset)).toEqual({
      errors: [
        "Boundary preset JSON must not contain password, token, secret, or secretValue fields.",
      ],
      isValid: false,
    });
  });

  it("finds a false to true boundary", async () => {
    const result = await findJdbcBoundary(
      boundaryPreset().range,
      boundaryPreset().executionPolicy,
      async (value) => value >= 64,
    );

    expect(result.status).toBe("boundary_found");
    expect(result.direction).toBe("false_to_true");
    expect(result.lowerResult).toBe(false);
    expect(result.upperResult).toBe(true);
    expect(result.lowerValue).toBeLessThan(64);
    expect(result.upperValue).toBeGreaterThanOrEqual(64);
    expect((result.upperValue ?? 0) - (result.lowerValue ?? 0)).toBeLessThanOrEqual(1);
  });

  it("finds a true to false boundary", async () => {
    const result = await findJdbcBoundary(
      boundaryPreset().range,
      boundaryPreset().executionPolicy,
      async (value) => value < 37,
    );

    expect(result.status).toBe("boundary_found");
    expect(result.direction).toBe("true_to_false");
    expect(result.lowerResult).toBe(true);
    expect(result.upperResult).toBe(false);
    expect(result.lowerValue).toBeLessThan(37);
    expect(result.upperValue).toBeGreaterThanOrEqual(37);
  });

  it("returns no boundary when min and max evaluate the same", async () => {
    const result = await findJdbcBoundary(
      boundaryPreset().range,
      boundaryPreset().executionPolicy,
      async () => true,
    );

    expect(result.status).toBe("no_boundary");
    expect(result.direction).toBeNull();
    expect(result.probes).toHaveLength(2);
  });

  it("enforces the max probe cap", async () => {
    const result = await findJdbcBoundary(
      boundaryPreset().range,
      { maxIterations: 100, maxProbes: 2, timeoutMs: 1000 },
      async (value) => value >= 64,
    );

    expect(result.status).toBe("probe_cap_reached");
    expect(result.direction).toBe("false_to_true");
    expect(result.probes).toHaveLength(2);
  });
});

function boundaryPreset(
  overrides: Partial<JdbcBoundaryPreset> = {},
): JdbcBoundaryPreset {
  return {
    booleanResult: {
      column: "found",
      falseValues: ["false", "0"],
      kind: "firstRowColumn",
      trueValues: ["true", "1"],
    },
    executionPolicy: {
      maxIterations: 100,
      maxProbes: 64,
      timeoutMs: 1000,
    },
    filters: [
      { key: "tenant", label: "Tenant", required: true, type: "string" },
      { key: "active", label: "Active", required: true, type: "boolean" },
      {
        key: "createdAfter",
        label: "Created after",
        required: true,
        type: "date",
      },
      {
        key: "updatedBefore",
        label: "Updated before",
        required: true,
        type: "timestamp",
      },
      {
        key: "maxScore",
        label: "Max score",
        required: true,
        type: "decimal",
      },
      {
        key: "minShard",
        label: "Min shard",
        required: true,
        type: "integer",
      },
    ],
    name: "Event id boundary",
    presetId: "event_id_boundary",
    range: {
      max: 100,
      min: 0,
      precision: 1,
      variable: "value",
    },
    sqlTemplate:
      "select count(*) > 0 as found from events where tenant = {{tenant}} and active = {{active}} and created_at >= {{createdAfter}} and updated_at < {{updatedBefore}} and score <= {{maxScore}} and shard_id >= {{minShard}} and event_id >= {{value}}",
    ...overrides,
  };
}

function validBoundaryValues() {
  return {
    active: true,
    createdAfter: "2026-05-01",
    maxScore: 19.5,
    minShard: 7,
    tenant: "analytics",
    updatedBefore: "2026-05-29T10:30:00Z",
  };
}

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

async function changeSelectByLabel(labelText: string, value: string) {
  const select = selectByLabel(labelText);

  await act(async () => {
    setNativeSelectValue(select, value);
    select.dispatchEvent(new Event("change", { bubbles: true }));
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

function setNativeSelectValue(element: HTMLSelectElement, value: string) {
  const valueSetter = Object.getOwnPropertyDescriptor(
    HTMLSelectElement.prototype,
    "value",
  )?.set;
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

function selectByLabel(labelText: string): HTMLSelectElement {
  const label = Array.from(document.querySelectorAll("label")).find((element) =>
    (element.textContent ?? "").includes(labelText),
  );

  if (!label) {
    throw new Error(`Label not found: ${labelText}`);
  }

  const select = label.querySelector("select");

  if (!select) {
    throw new Error(`Select not found for label: ${labelText}`);
  }

  return select;
}

async function flushPromises() {
  await Promise.resolve();
  await Promise.resolve();
}

function stubClipboard(writeText: ReturnType<typeof vi.fn>) {
  Object.defineProperty(navigator, "clipboard", {
    configurable: true,
    value: { writeText },
  });
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

function sqlPreviewText() {
  const preview = document.querySelector<HTMLElement>(
    '[aria-label="Boundary Finder SQL preview"]',
  );

  if (!preview) {
    throw new Error("Boundary Finder SQL preview not found");
  }

  return preview.textContent ?? "";
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

function profile(
  overrides: Partial<JdbcConnectionProfile> = {},
): JdbcConnectionProfile {
  return {
    createdAt: "2026-05-20T10:00:00.000Z",
    description: "",
    driverClassName: "org.postgresql.Driver",
    driverJarPath: "C:\\drivers\\postgres.jar",
    jdbcUrl: "jdbc:postgresql://localhost/app",
    maxResultBytes: 262144,
    maxRows: 100,
    name: "Analytics readonly",
    passwordEnvVarName: null,
    profileId: "jdbc_profile_1",
    readOnly: true,
    timeoutMs: 10000,
    updatedAt: "2026-05-20T10:00:01.000Z",
    username: null,
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
