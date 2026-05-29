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

export type JdbcSidecarDiagnostic = {
  action: string;
  ok: boolean;
  status: string;
  message: string;
  details: string | null;
  durationMs: number;
  noSecretsReturned: boolean;
  noAiContextShared: boolean;
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
  experimentalSidecar?: JdbcExperimentalSidecarRuntime | null;
};

export type CheckJdbcSidecarHealthRequest = {
  workspaceId: string;
  workbenchId: string;
  widgetInstanceId: string;
  experimentalSidecar: JdbcExperimentalSidecarRuntime;
};

export type ProbeJdbcDriverRequest = {
  workspaceId: string;
  workbenchId: string;
  widgetInstanceId: string;
  experimentalSidecar: JdbcExperimentalSidecarRuntime;
};

export type JdbcExperimentalSidecarRuntime = {
  enabled: boolean;
  javaProgram?: string | null;
  sidecarJarPath?: string | null;
  sidecarClasspath?: string | null;
  sidecarMainClass?: string | null;
  driverJarPath: string;
  driverClassName?: string | null;
  jdbcUrl: string;
  username?: string | null;
  credentialEnvVarName?: string | null;
  maxRows?: number | null;
  timeoutMs?: number | null;
  maxResultBytes?: number | null;
};
