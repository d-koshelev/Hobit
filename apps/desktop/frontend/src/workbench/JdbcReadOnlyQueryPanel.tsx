import { useId, useMemo, useState } from "react";
import { Badge } from "../design-system/Badge";
import { Button } from "../design-system/Button";
import type { JdbcConnector } from "../workspace/jdbcConnectorTypes";
import type {
  JdbcReadOnlyQueryResult,
  JdbcReadOnlySqlValidation,
} from "../workspace/jdbcQueryTypes";
import type {
  JdbcReadOnlyQueryExecutionRequest,
  JdbcReadOnlySqlValidationRequest,
} from "./jdbcConnectorWidgetActions";
import {
  errorToMessage,
  type JdbcExperimentalRuntimeDraft,
} from "./jdbcConnectorWidgetModel";

type JdbcReadOnlyQueryPanelProps = {
  connectors: JdbcConnector[];
  isConnectorSelectionDisabled?: boolean;
  onExecuteQuery?: (
    request: JdbcReadOnlyQueryExecutionRequest,
  ) => Promise<JdbcReadOnlyQueryResult>;
  onSelectConnector: (connectorId: string) => Promise<void> | void;
  onValidateSql?: (
    request: JdbcReadOnlySqlValidationRequest,
  ) => Promise<JdbcReadOnlySqlValidation>;
  selectedConnector: JdbcConnector | null;
};

type ValidationSnapshot = {
  connectorId: string;
  rowLimit: number;
  sql: string;
  validation: JdbcReadOnlySqlValidation;
};

type ExperimentalRuntimeTextField =
  | "credentialEnvVarName"
  | "driverClassName"
  | "driverJarPath"
  | "javaProgram"
  | "jdbcUrl"
  | "sidecarClasspath"
  | "sidecarMainClass"
  | "username";

const DEFAULT_ROW_LIMIT = 100;
const MAX_ROW_LIMIT = 100;
const DEFAULT_TIMEOUT_MS = 10_000;
const DEFAULT_MAX_RESULT_BYTES = 256 * 1024;
const DEFAULT_SIDECAR_MAIN_CLASS = "com.hobit.jdbc.JdbcReadOnlySidecar";

export function JdbcReadOnlyQueryPanel({
  connectors,
  isConnectorSelectionDisabled = false,
  onExecuteQuery,
  onSelectConnector,
  onValidateSql,
  selectedConnector,
}: JdbcReadOnlyQueryPanelProps) {
  const connectorInputId = useId();
  const rowLimitInputId = useId();
  const timeoutInputId = useId();
  const maxResultBytesInputId = useId();
  const sqlInputId = useId();
  const experimentalEnabledInputId = useId();
  const javaProgramInputId = useId();
  const sidecarClasspathInputId = useId();
  const sidecarMainClassInputId = useId();
  const driverJarPathInputId = useId();
  const driverClassNameInputId = useId();
  const jdbcUrlInputId = useId();
  const usernameInputId = useId();
  const credentialEnvVarNameInputId = useId();
  const [sql, setSql] = useState("select 1");
  const [rowLimit, setRowLimit] = useState(DEFAULT_ROW_LIMIT);
  const [timeoutMs, setTimeoutMs] = useState(DEFAULT_TIMEOUT_MS);
  const [maxResultBytes, setMaxResultBytes] = useState(DEFAULT_MAX_RESULT_BYTES);
  const [experimentalRuntime, setExperimentalRuntime] =
    useState<JdbcExperimentalRuntimeDraft>({
      credentialEnvVarName: "",
      driverClassName: "",
      driverJarPath: "",
      enabled: false,
      javaProgram: "java",
      jdbcUrl: "",
      maxResultBytes: DEFAULT_MAX_RESULT_BYTES,
      maxRows: DEFAULT_ROW_LIMIT,
      sidecarClasspath: "",
      sidecarMainClass: DEFAULT_SIDECAR_MAIN_CLASS,
      timeoutMs: DEFAULT_TIMEOUT_MS,
      username: "",
    });
  const [validationSnapshot, setValidationSnapshot] =
    useState<ValidationSnapshot | null>(null);
  const [result, setResult] = useState<JdbcReadOnlyQueryResult | null>(null);
  const [panelError, setPanelError] = useState<string | null>(null);
  const [isValidating, setIsValidating] = useState(false);
  const [isRunning, setIsRunning] = useState(false);

  const trimmedSql = sql.trim();
  const normalizedRowLimit = clampRowLimit(rowLimit);
  const normalizedTimeoutMs = clampTimeoutMs(timeoutMs);
  const normalizedMaxResultBytes = clampMaxResultBytes(maxResultBytes);
  const selectedConnectorId = selectedConnector?.connectorId ?? "";
  const isValidationCurrent = Boolean(
    validationSnapshot &&
      validationSnapshot.sql === trimmedSql &&
      validationSnapshot.connectorId === selectedConnectorId &&
      validationSnapshot.rowLimit === normalizedRowLimit,
  );
  const currentValidation = isValidationCurrent
    ? validationSnapshot?.validation
    : null;
  const runBlockedReason = useMemo(
    () =>
      describeRunBlocker({
        currentValidation,
        hasExecuteApi: Boolean(onExecuteQuery),
        isValidationCurrent,
        selectedConnector,
        trimmedSql,
      }),
    [
      currentValidation,
      isValidationCurrent,
      onExecuteQuery,
      selectedConnector,
      trimmedSql,
    ],
  );

  async function handleValidate() {
    if (!selectedConnector) {
      setPanelError("Select a connector before validating SQL.");
      return;
    }

    if (!trimmedSql) {
      setPanelError("Enter SQL before validation.");
      return;
    }

    if (!onValidateSql) {
      setPanelError(
        "JDBC SQL validation is unavailable in this runtime.",
      );
      return;
    }

    setIsValidating(true);
    setPanelError(null);
    setResult(null);

    try {
      const validation = await onValidateSql({
        connectorId: selectedConnector.connectorId,
        rowLimit: normalizedRowLimit,
        sql: trimmedSql,
        timeoutMs: normalizedTimeoutMs,
      });
      setValidationSnapshot({
        connectorId: selectedConnector.connectorId,
        rowLimit: normalizedRowLimit,
        sql: trimmedSql,
        validation,
      });
    } catch (error) {
      setPanelError(errorToMessage(error, "Unable to validate JDBC SQL."));
    } finally {
      setIsValidating(false);
    }
  }

  async function handleRun() {
    if (!selectedConnector || runBlockedReason || !onExecuteQuery) {
      setPanelError(runBlockedReason ?? "JDBC query execution is unavailable.");
      return;
    }

    setIsRunning(true);
    setPanelError(null);

    try {
      const executionResult = await onExecuteQuery({
        connectorId: selectedConnector.connectorId,
        experimentalSidecar: experimentalRuntime.enabled
          ? {
              credentialEnvVarName: emptyToNull(
                experimentalRuntime.credentialEnvVarName,
              ),
              driverClassName: emptyToNull(experimentalRuntime.driverClassName),
              driverJarPath: experimentalRuntime.driverJarPath.trim(),
              enabled: true,
              javaProgram: emptyToNull(experimentalRuntime.javaProgram),
              jdbcUrl: experimentalRuntime.jdbcUrl.trim(),
              maxResultBytes: normalizedMaxResultBytes,
              maxRows: normalizedRowLimit,
              sidecarClasspath: emptyToNull(
                experimentalRuntime.sidecarClasspath,
              ),
              sidecarMainClass: emptyToNull(
                experimentalRuntime.sidecarMainClass,
              ),
              timeoutMs: normalizedTimeoutMs,
              username: emptyToNull(experimentalRuntime.username),
            }
          : null,
        maxResultBytes: normalizedMaxResultBytes,
        rowLimit: normalizedRowLimit,
        sql: trimmedSql,
        timeoutMs: normalizedTimeoutMs,
      });
      setResult(executionResult);
      setValidationSnapshot({
        connectorId: selectedConnector.connectorId,
        rowLimit: normalizedRowLimit,
        sql: trimmedSql,
        validation: executionResult.validation,
      });
    } catch (error) {
      setPanelError(
        errorToMessage(error, "Unable to run JDBC read-only query."),
      );
    } finally {
      setIsRunning(false);
    }
  }

  return (
    <section aria-label="Read-only JDBC query workspace" className="jdbc-query-panel">
      <div className="jdbc-sql-header">
        <div>
          <p className="jdbc-pane-title">Query editor</p>
          <p className="jdbc-pane-subtitle">
            Operator-triggered mock execution only. Workspace Agent suggestions
            can be copied here, but Workspace Agent cannot run SQL.
          </p>
        </div>
        <div className="jdbc-summary-badges">
          <Badge variant={experimentalRuntime.enabled ? "warning" : "info"}>
            {experimentalRuntime.enabled ? "Experimental sidecar" : "Mock execution"}
          </Badge>
          <Badge variant="success">Read-only</Badge>
        </div>
      </div>

      <div className="jdbc-safety-notice" aria-label="Read-only safety notice">
        <p>
          The mock validator accepts SELECT, WITH, SHOW, DESCRIBE, and mock
          EXPLAIN wrappers. Experimental real sidecar execution accepts only
          SELECT or WITH. Writes, DDL/DML, stored procedures, session mutation,
          and multi-statement batches are rejected. Nothing runs until you
          validate the visible SQL and press Run read-only query.
        </p>
      </div>

      <div className="jdbc-query-controls">
        <label className="jdbc-field" htmlFor={connectorInputId}>
          <span className="field-label">Connection profile</span>
          <select
            className="select"
            disabled={isConnectorSelectionDisabled || connectors.length === 0}
            id={connectorInputId}
            onChange={(event) => {
              const connectorId = event.currentTarget.value;
              if (connectorId) {
                void onSelectConnector(connectorId);
              }
            }}
            value={selectedConnectorId}
          >
            <option value="">Select connector</option>
            {connectors.map((connector) => (
              <option
                key={connector.connectorId}
                value={connector.connectorId}
              >
                {connector.displayName || "Untitled connector"}
              </option>
            ))}
          </select>
        </label>
        <label className="jdbc-field jdbc-query-limit-field" htmlFor={rowLimitInputId}>
          <span className="field-label">Row limit</span>
          <input
            className="input"
            id={rowLimitInputId}
            max={MAX_ROW_LIMIT}
            min={1}
            onChange={(event) => {
              setRowLimit(clampRowLimit(Number(event.currentTarget.value)));
              setPanelError(null);
            }}
            type="number"
            value={rowLimit}
          />
          <span className="jdbc-query-hint">Backend cap: 100 rows</span>
        </label>
        <label className="jdbc-field jdbc-query-limit-field" htmlFor={timeoutInputId}>
          <span className="field-label">Timeout ms</span>
          <input
            className="input"
            id={timeoutInputId}
            max={DEFAULT_TIMEOUT_MS}
            min={1}
            onChange={(event) => {
              const nextValue = clampTimeoutMs(Number(event.currentTarget.value));
              setTimeoutMs(nextValue);
              setExperimentalRuntime((current) => ({
                ...current,
                timeoutMs: nextValue,
              }));
              setPanelError(null);
            }}
            type="number"
            value={timeoutMs}
          />
          <span className="jdbc-query-hint">Backend cap: 10000 ms</span>
        </label>
        <label
          className="jdbc-field jdbc-query-limit-field"
          htmlFor={maxResultBytesInputId}
        >
          <span className="field-label">Max result bytes</span>
          <input
            className="input"
            id={maxResultBytesInputId}
            max={DEFAULT_MAX_RESULT_BYTES}
            min={1}
            onChange={(event) => {
              const nextValue = clampMaxResultBytes(
                Number(event.currentTarget.value),
              );
              setMaxResultBytes(nextValue);
              setExperimentalRuntime((current) => ({
                ...current,
                maxResultBytes: nextValue,
              }));
              setPanelError(null);
            }}
            type="number"
            value={maxResultBytes}
          />
          <span className="jdbc-query-hint">Backend cap: 256 KiB</span>
        </label>
      </div>

      <details className="jdbc-experimental-runtime">
        <summary>
          <span>Experimental sidecar runtime</span>
          <Badge variant="warning">Preview</Badge>
        </summary>
        <div className="jdbc-experimental-copy">
          <p>
            Opt-in only. Real JDBC requires an explicit sidecar classpath or
            JAR, explicit driver JAR, explicit JDBC URL, and explicit Run.
            Hobit does not store these values. Enter a password environment
            variable name only; never enter a password value.
          </p>
        </div>
        <label
          className="jdbc-readonly-toggle"
          htmlFor={experimentalEnabledInputId}
        >
          <input
            checked={experimentalRuntime.enabled}
            id={experimentalEnabledInputId}
            onChange={(event) =>
              setExperimentalRuntime((current) => ({
                ...current,
                enabled: event.currentTarget.checked,
              }))
            }
            type="checkbox"
          />
          Enable experimental real JDBC sidecar for the next Run
        </label>
        <div className="jdbc-experimental-grid">
          <label className="jdbc-field" htmlFor={javaProgramInputId}>
            <span className="field-label">Java executable</span>
            <input
              className="input"
              id={javaProgramInputId}
              onChange={(event) =>
                updateExperimentalRuntime("javaProgram", event.currentTarget.value)
              }
              value={experimentalRuntime.javaProgram}
            />
          </label>
          <label className="jdbc-field" htmlFor={sidecarClasspathInputId}>
            <span className="field-label">Sidecar classpath or classes dir</span>
            <input
              className="input"
              id={sidecarClasspathInputId}
              onChange={(event) =>
                updateExperimentalRuntime(
                  "sidecarClasspath",
                  event.currentTarget.value,
                )
              }
              placeholder="target/hobit-jdbc-sidecar/classes"
              value={experimentalRuntime.sidecarClasspath}
            />
          </label>
          <label className="jdbc-field" htmlFor={sidecarMainClassInputId}>
            <span className="field-label">Sidecar main class</span>
            <input
              className="input"
              id={sidecarMainClassInputId}
              onChange={(event) =>
                updateExperimentalRuntime(
                  "sidecarMainClass",
                  event.currentTarget.value,
                )
              }
              value={experimentalRuntime.sidecarMainClass}
            />
          </label>
          <label className="jdbc-field" htmlFor={driverJarPathInputId}>
            <span className="field-label">Driver JAR path</span>
            <input
              className="input"
              id={driverJarPathInputId}
              onChange={(event) =>
                updateExperimentalRuntime(
                  "driverJarPath",
                  event.currentTarget.value,
                )
              }
              placeholder="C:\\path\\to\\driver.jar"
              value={experimentalRuntime.driverJarPath}
            />
          </label>
          <label className="jdbc-field" htmlFor={driverClassNameInputId}>
            <span className="field-label">Driver class</span>
            <input
              className="input"
              id={driverClassNameInputId}
              onChange={(event) =>
                updateExperimentalRuntime(
                  "driverClassName",
                  event.currentTarget.value,
                )
              }
              placeholder="org.postgresql.Driver"
              value={experimentalRuntime.driverClassName}
            />
          </label>
          <label className="jdbc-field" htmlFor={jdbcUrlInputId}>
            <span className="field-label">Runtime JDBC URL</span>
            <input
              className="input"
              id={jdbcUrlInputId}
              onChange={(event) =>
                updateExperimentalRuntime("jdbcUrl", event.currentTarget.value)
              }
              placeholder="jdbc:postgresql://localhost/app"
              value={experimentalRuntime.jdbcUrl}
            />
          </label>
          <label className="jdbc-field" htmlFor={usernameInputId}>
            <span className="field-label">Username</span>
            <input
              className="input"
              id={usernameInputId}
              onChange={(event) =>
                updateExperimentalRuntime("username", event.currentTarget.value)
              }
              value={experimentalRuntime.username}
            />
          </label>
          <label className="jdbc-field" htmlFor={credentialEnvVarNameInputId}>
            <span className="field-label">Password env var name</span>
            <input
              className="input"
              id={credentialEnvVarNameInputId}
              onChange={(event) =>
                updateExperimentalRuntime(
                  "credentialEnvVarName",
                  event.currentTarget.value,
                )
              }
              placeholder="HOBIT_READONLY_DB_PASSWORD"
              value={experimentalRuntime.credentialEnvVarName}
            />
          </label>
        </div>
      </details>

      <label className="jdbc-field jdbc-field-wide" htmlFor={sqlInputId}>
        <span className="field-label">SQL</span>
        <textarea
          className="input jdbc-sql-editor"
          id={sqlInputId}
          onChange={(event) => {
            setSql(event.currentTarget.value);
            setPanelError(null);
          }}
          placeholder="select 1"
          value={sql}
        />
      </label>

      <div className="jdbc-query-actions">
        <JdbcValidationStatus
          isValidationCurrent={isValidationCurrent}
          validation={validationSnapshot?.validation}
        />
        <div className="jdbc-sql-actions">
          <Button
            disabled={isValidating || isRunning}
            onClick={() => void handleValidate()}
            variant="secondary"
          >
            {isValidating ? "Validating" : "Validate SQL"}
          </Button>
          <Button
            disabled={Boolean(runBlockedReason) || isRunning}
            onClick={() => void handleRun()}
            title={runBlockedReason ?? undefined}
            variant="primary"
          >
            {isRunning ? "Running" : "Run read-only query"}
          </Button>
        </div>
      </div>

      {panelError ? (
        <p className="jdbc-message jdbc-message-error" role="alert">
          {panelError}
        </p>
      ) : null}

      {result ? (
        <JdbcReadOnlyQueryResultView result={result} />
      ) : (
        <div className="jdbc-results-placeholder">
          <p className="jdbc-empty-title">Visible query results appear here.</p>
          <p className="jdbc-empty-text">
            Validate read-only SQL, then run it through the bounded mock
            adapter. No real database connection or credentials are used.
          </p>
        </div>
      )}
    </section>
  );

  function updateExperimentalRuntime(
    field: ExperimentalRuntimeTextField,
    value: string,
  ) {
    setExperimentalRuntime((current) => ({
      ...current,
      [field]: value,
    }));
    setPanelError(null);
  }
}

function JdbcValidationStatus({
  isValidationCurrent,
  validation,
}: {
  isValidationCurrent: boolean;
  validation: JdbcReadOnlySqlValidation | null | undefined;
}) {
  if (!validation) {
    return (
      <div className="jdbc-validation-status">
        <Badge variant="neutral">Review</Badge>
        <span>Validate SQL before running.</span>
      </div>
    );
  }

  if (!isValidationCurrent) {
    return (
      <div className="jdbc-validation-status jdbc-validation-warning">
        <Badge variant="warning">Stale</Badge>
        <span>SQL, connector, or row limit changed after validation.</span>
      </div>
    );
  }

  return (
    <div
      className={
        validation.isValid
          ? "jdbc-validation-status jdbc-validation-valid"
          : "jdbc-validation-status jdbc-validation-error"
      }
    >
      <Badge variant={validation.isValid ? "success" : "error"}>
        {validation.isValid ? "Valid" : "Rejected"}
      </Badge>
      <span>
        {validation.isValid
          ? `${validation.statementKind ?? "Read-only"} statement accepted.`
          : validation.rejectionReason ?? "SQL did not pass read-only validation."}
      </span>
    </div>
  );
}

function JdbcReadOnlyQueryResultView({
  result,
}: {
  result: JdbcReadOnlyQueryResult;
}) {
  if (result.status !== "completed") {
    return (
      <div className="jdbc-query-error-panel" role="alert">
        <p className="jdbc-empty-title">
          Read-only query stopped: {result.status}
        </p>
        <p className="jdbc-empty-text">
          {result.sanitizedError ??
            result.validation.rejectionReason ??
            `Backend returned status ${result.status}.`}
        </p>
        <p className="jdbc-empty-text">
          No database write, hidden execution, or AI result sharing occurred.
        </p>
      </div>
    );
  }

  return (
    <div className="jdbc-result-shell">
      <div className="jdbc-result-meta">
        <Badge variant="success">Completed</Badge>
        <span>{result.connectorDisplayName ?? result.connectorId}</span>
        <span>{result.statementKind ?? "read-only"}</span>
        <span>
          {result.returnedRowCount.toString()} of {result.rowCount.toString()} rows
        </span>
        <span>{result.durationMs.toString()} ms</span>
        {result.mockExecution ? <Badge variant="info">Mock</Badge> : null}
        {result.noSecretsReturned ? (
          <Badge variant="neutral">No secrets</Badge>
        ) : null}
        {result.noAiContextShared ? (
          <Badge variant="neutral">No AI sharing</Badge>
        ) : null}
      </div>
      {result.truncated ? <JdbcTruncationNotice result={result} /> : null}
      <div className="jdbc-result-table-wrap">
        <table className="jdbc-result-table">
          <thead>
            <tr>
              {result.columns.map((column) => (
                <th key={column.name} scope="col">
                  <span>{column.name}</span>
                  <span>{column.valueKind}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {result.rows.map((row, rowIndex) => (
              <tr key={rowIndex}>
                {result.columns.map((column, columnIndex) => (
                  <td key={`${column.name}-${columnIndex.toString()}`}>
                    {row[columnIndex] ?? ""}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function JdbcTruncationNotice({
  result,
}: {
  result: JdbcReadOnlyQueryResult;
}) {
  const caps = [
    result.truncatedRows ? "rows" : null,
    result.truncatedColumns ? "columns" : null,
    result.truncatedCells ? "cell values" : null,
    result.truncatedBytes ? "response size" : null,
  ].filter(Boolean);

  const capText = caps.length > 0 ? caps.join(", ") : "backend";

  return (
    <p className="jdbc-message jdbc-message-warning">
      Result capped by {capText} limits. Showing bounded sample only.
    </p>
  );
}

function clampRowLimit(value: number) {
  if (!Number.isFinite(value)) {
    return DEFAULT_ROW_LIMIT;
  }

  return Math.min(MAX_ROW_LIMIT, Math.max(1, Math.trunc(value)));
}

function clampTimeoutMs(value: number) {
  if (!Number.isFinite(value)) {
    return DEFAULT_TIMEOUT_MS;
  }

  return Math.min(DEFAULT_TIMEOUT_MS, Math.max(1, Math.trunc(value)));
}

function clampMaxResultBytes(value: number) {
  if (!Number.isFinite(value)) {
    return DEFAULT_MAX_RESULT_BYTES;
  }

  return Math.min(DEFAULT_MAX_RESULT_BYTES, Math.max(1, Math.trunc(value)));
}

function emptyToNull(value: string) {
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function describeRunBlocker({
  currentValidation,
  hasExecuteApi,
  isValidationCurrent,
  selectedConnector,
  trimmedSql,
}: {
  currentValidation: JdbcReadOnlySqlValidation | null | undefined;
  hasExecuteApi: boolean;
  isValidationCurrent: boolean;
  selectedConnector: JdbcConnector | null;
  trimmedSql: string;
}) {
  if (!hasExecuteApi) {
    return "JDBC read-only query execution is unavailable in this runtime.";
  }

  if (!selectedConnector) {
    return "Select a connector before running SQL.";
  }

  if (!trimmedSql) {
    return "Enter SQL before running.";
  }

  if (!isValidationCurrent || !currentValidation) {
    return "Validate the current SQL before running.";
  }

  if (!currentValidation.isValid) {
    return currentValidation.rejectionReason ?? "SQL was rejected.";
  }

  return null;
}
