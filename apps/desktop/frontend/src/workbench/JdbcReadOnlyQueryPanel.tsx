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
import { errorToMessage } from "./jdbcConnectorWidgetModel";

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

const DEFAULT_ROW_LIMIT = 100;
const MAX_ROW_LIMIT = 100;
const DEFAULT_TIMEOUT_MS = 10_000;

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
  const sqlInputId = useId();
  const [sql, setSql] = useState("select 1");
  const [rowLimit, setRowLimit] = useState(DEFAULT_ROW_LIMIT);
  const [validationSnapshot, setValidationSnapshot] =
    useState<ValidationSnapshot | null>(null);
  const [result, setResult] = useState<JdbcReadOnlyQueryResult | null>(null);
  const [panelError, setPanelError] = useState<string | null>(null);
  const [isValidating, setIsValidating] = useState(false);
  const [isRunning, setIsRunning] = useState(false);

  const trimmedSql = sql.trim();
  const normalizedRowLimit = clampRowLimit(rowLimit);
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
        timeoutMs: DEFAULT_TIMEOUT_MS,
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
        rowLimit: normalizedRowLimit,
        sql: trimmedSql,
        timeoutMs: DEFAULT_TIMEOUT_MS,
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
          <Badge variant="info">Mock execution</Badge>
          <Badge variant="success">Read-only</Badge>
        </div>
      </div>

      <div className="jdbc-safety-notice" aria-label="Read-only safety notice">
        <p>
          SELECT, WITH, SHOW, DESCRIBE, and mock EXPLAIN wrappers around those
          read-only forms are accepted by the current validator. Writes,
          DDL/DML, session mutation, and multi-statement batches are rejected.
          Nothing runs until you validate the visible SQL and press Run
          read-only query.
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
      </div>

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
