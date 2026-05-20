export type JdbcReadOnlySqlValidation = {
  isValid: boolean;
  statementKind: string | null;
  normalizedPreview: string;
  rejectionReason: string | null;
  safetyNotes: string[];
};

export type JdbcQueryColumn = {
  name: string;
  valueKind: string;
};

export type JdbcReadOnlyQueryResult = {
  status: string;
  connectorId: string;
  connectorDisplayName: string | null;
  validation: JdbcReadOnlySqlValidation;
  statementKind: string | null;
  columns: JdbcQueryColumn[];
  rows: string[][];
  rowCount: number;
  returnedRowCount: number;
  rowLimit: number;
  truncated: boolean;
  truncatedRows: boolean;
  truncatedColumns: boolean;
  truncatedCells: boolean;
  truncatedBytes: boolean;
  durationMs: number;
  sanitizedError: string | null;
  noSecretsReturned: boolean;
  noAiContextShared: boolean;
  mockExecution: boolean;
};

export type ValidateJdbcReadOnlySqlRequest = {
  workspaceId: string;
  workbenchId: string;
  widgetInstanceId: string;
  connectorId: string;
  sql: string;
  rowLimit?: number | null;
  timeoutMs?: number | null;
};

export type ExecuteJdbcReadOnlyQueryRequest = {
  workspaceId: string;
  workbenchId: string;
  widgetInstanceId: string;
  connectorId: string;
  sql: string;
  rowLimit?: number | null;
  timeoutMs?: number | null;
  maxColumns?: number | null;
  maxCellChars?: number | null;
  maxResultBytes?: number | null;
};
