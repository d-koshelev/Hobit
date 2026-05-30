import type {
  JdbcReadOnlyQueryResult,
  JdbcReadOnlySqlValidation,
} from "../workspace/jdbcQueryTypes";
import type { JdbcConnector } from "../workspace/jdbcConnectorTypes";

export function resultSummaryText(result: JdbcReadOnlyQueryResult) {
  if (result.returnedRowCount === 0) {
    return "No rows returned query completed";
  }

  if (result.truncatedRows || result.returnedRowCount < result.rowCount) {
    return `${result.returnedRowCount.toString()} rows shown of ${result.rowCount.toString()} total`;
  }

  const rowLabel = result.returnedRowCount === 1 ? "row" : "rows";
  return `${result.returnedRowCount.toString()} ${rowLabel}`;
}

export function resultToTsv(result: JdbcReadOnlyQueryResult) {
  const header = result.columns.map((column) => tsvCell(column.name)).join("\t");
  const rows = result.rows.map((row) =>
    result.columns
      .map((_column, columnIndex) =>
        tsvCell(displayCellValue(row[columnIndex] ?? null)),
      )
      .join("\t"),
  );

  return [header, ...rows].filter((line) => line.length > 0).join("\n");
}

export function errorDetailsText(result: JdbcReadOnlyQueryResult) {
  return [
    `Status: ${result.status}`,
    result.sanitizedError
      ? `Error: ${redactJdbcErrorDetails(result.sanitizedError)}`
      : null,
    result.validation.rejectionReason
      ? `Validation: ${redactJdbcErrorDetails(result.validation.rejectionReason)}`
      : null,
    `Duration: ${result.durationMs.toString()} ms`,
    "No database write, hidden execution, or AI result sharing occurred.",
  ]
    .filter(Boolean)
    .join("\n");
}

export function compactErrorSummary(value: string) {
  return redactJdbcText(
    value
      .split(/\r?\n/u)
      .find((line) => !/^\s*(at\s|stack\b|caused by:)/iu.test(line)) ??
      value,
  );
}

export function redactJdbcErrorDetails(value: string) {
  return redactJdbcText(value)
    .split(/\r?\n/u)
    .filter((line) => !/^\s*(at\s|stack\b|caused by:)/iu.test(line))
    .join("\n");
}

export function displayCellValue(value: string | null) {
  return value === null ? "NULL" : redactJdbcText(value);
}

export function valueKindClass(valueKind: string) {
  const normalized = valueKind.trim().toLowerCase();

  if (/^(bool|boolean)$/u.test(normalized)) {
    return "boolean";
  }

  if (
    /^(int|integer|bigint|smallint|decimal|double|float|numeric|number|real)$/u.test(
      normalized,
    )
  ) {
    return "number";
  }

  return "text";
}

export function formatBytes(value: number) {
  if (value >= 1024 && value % 1024 === 0) {
    return `${(value / 1024).toString()} KiB`;
  }

  return `${value.toString()} bytes`;
}

export function redactJdbcText(value: string) {
  return value
    .replace(
      /\b(password|passwd|pwd|token|access_token|secret|api_key|apikey|private_key|key)=([^;&\s]+)/giu,
      "$1=[redacted]",
    )
    .replace(
      /\b(password|passwd|pwd|token|access_token|secret|api_key|apikey|private_key|key):\s*([^\s,;]+)/giu,
      "$1: [redacted]",
    );
}

export async function copyTextToClipboard(value: string) {
  if (!navigator.clipboard?.writeText) {
    return false;
  }

  try {
    await navigator.clipboard.writeText(value);
    return true;
  } catch {
    return false;
  }
}

export function describeRunBlocker({
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

function tsvCell(value: string) {
  return value.replace(/\r?\n/gu, " ").replace(/\t/gu, " ");
}
