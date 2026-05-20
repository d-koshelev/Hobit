# JDBC Read-Only Sidecar Scaffold

This is the first Java sidecar scaffold for Hobit's future real JDBC runtime.
It is intentionally dependency-free and does not load JDBC drivers, credentials,
network sockets, or database connections.

Current behavior:

- reads one JSON request from stdin
- writes one JSON response to stdout
- accepts only `runtime_kind: "mock_read_only"`
- returns deterministic bounded mock rows for validated read-only requests
- returns sanitized `query_rejected`, `not_configured`, or
  `unsupported_driver` statuses for unsupported requests

Protocol request fields:

- `protocol_version`
- `request_id`
- `runtime_kind`
- `connector_id`
- `database_kind`
- `driver_kind`
- `statement_kind`
- `validated_read_only`
- `sql`
- `row_limit`
- `timeout_ms`
- `max_columns`
- `max_cell_chars`
- `max_result_bytes`

Protocol response fields:

- `protocol_version`
- `request_id`
- `status`
- `columns`
- `rows`
- `row_count`
- `returned_row_count`
- `truncated`
- `truncated_rows`
- `truncated_columns`
- `truncated_cells`
- `truncated_bytes`
- `duration_ms`
- `sanitized_error`
- `no_secrets_returned`
- `no_ai_context_shared`
- `mock_execution`

Compile and smoke when a JDK is available:

```powershell
node scripts/hobit/smoke-jdbc-sidecar.mjs
```

This scaffold is not wired into the JDBC widget by default. The active product
runtime remains `MockReadOnlyJdbcAdapter`.
