# ADR-0008: JDBC Real Runtime Boundary

## Status

Accepted

## Context

Database / JDBC currently supports workspace-local non-secret connector
metadata, conservative read-only SQL validation, and bounded mock execution.
The next step is preparing real read-only connector execution without exposing
database secrets to the frontend, Coordinator Chat, provider prompts, logs,
tests, proposal cards, or ordinary widget state.

True JDBC coverage needs access to JDBC drivers and Java driver behavior. A
Rust-only client path would only cover selected database families and would not
be a general JDBC runtime.

## Decision

Hobit will treat real JDBC execution as a backend-owned Java sidecar runtime
behind a narrow read-only adapter boundary.

The active adapter remains `MockReadOnlyJdbcAdapter`. The real sidecar adapter
starts as a not-configured stub until sidecar process management, driver
configuration, and backend-only credential resolution are implemented in a
separate block.

The sidecar protocol will be narrow JSON owned by the backend:

- request: connector id, database kind, driver kind, backend-resolved runtime
  configuration, SQL, validator statement kind, row limit, timeout, column
  limit, cell limit, and result byte limit
- response: status, bounded display-safe columns and rows, duration,
  truncation flags, and sanitized error

The sidecar must not expose arbitrary Java execution, shell access,
unrestricted driver loading, frontend-visible credentials, provider tools,
Coordinator execution, Terminal control, Git mutation, Queue dispatch, or
Agent Executor launch.

## Block 264 Scaffold

The first sidecar scaffold lives at:

```text
sidecars/jdbc-readonly-sidecar/
```

The Java entry point is:

```text
sidecars/jdbc-readonly-sidecar/src/main/java/com/hobit/jdbc/JdbcReadOnlySidecar.java
```

It is dependency-free Java source. It does not load JDBC drivers, credentials,
network sockets, or database connections. It accepts one JSON request on stdin
and writes one JSON response on stdout.

Current request fields:

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

Current response fields:

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

The only successful runtime kind in the scaffold is `mock_read_only`.
`real_jdbc` and other runtime kinds return `not_configured`. Unsupported
driver kinds return `unsupported_driver`. Requests with
`validated_read_only: false` return `query_rejected`.

The scaffold smoke is:

```text
node scripts/hobit/smoke-jdbc-sidecar.mjs
```

The smoke compiles and runs the sidecar when `java` and `javac` are available
on `PATH`. If a JDK is absent, it reports the skip without changing product
behavior.

## Block 265 Runtime Config Loader

Block 265 adds a backend-only runtime config loader and crate-internal opt-in
adapter selection path. The default `WorkspaceService::new(...)` path still
uses `MockReadOnlyJdbcAdapter`; desktop/Tauri construction does not read these
keys or switch to sidecar by default.

Backend runtime config keys:

- `HOBIT_JDBC_RUNTIME_MODE`: `mock` by default; `sidecar` or `java_sidecar`
  selects the sidecar adapter path only inside explicit backend construction.
- `HOBIT_JDBC_SIDECAR_ENABLED`: must be true for sidecar launch configuration
  to be considered configured.
- `HOBIT_JDBC_SIDECAR_JAVA_PROGRAM`: Java launcher program; defaults to
  `java`.
- `HOBIT_JDBC_SIDECAR_JAR`: optional sidecar jar launch path.
- `HOBIT_JDBC_SIDECAR_CLASSPATH`: optional classpath launch path when not
  using a jar.
- `HOBIT_JDBC_SIDECAR_MAIN_CLASS`: Java main class; defaults to
  `com.hobit.jdbc.JdbcReadOnlySidecar`.
- `HOBIT_JDBC_SIDECAR_WORKING_DIR`: sidecar process working directory;
  defaults to `.`.
- `HOBIT_JDBC_SIDECAR_CONNECTOR_ID`: connector id allowed to use the opt-in
  sidecar runtime.
- `HOBIT_JDBC_SIDECAR_RUNTIME_KIND`: protocol runtime kind; defaults to
  `mock_read_only`.
- `HOBIT_JDBC_SIDECAR_DRIVER_KIND`: expected connector driver kind; defaults
  to `jdbc`.
- `HOBIT_JDBC_SIDECAR_TIMEOUT_MS`: sidecar process timeout, capped at 10
  seconds.
- `HOBIT_JDBC_SIDECAR_JDBC_URL_PRESENT`,
  `HOBIT_JDBC_SIDECAR_USERNAME_PRESENT`, and
  `HOBIT_JDBC_SIDECAR_PASSWORD_PRESENT`: presence-only flags. They do not
  carry credential values.

Safe status values exposed by the loader are `mock_active`,
`sidecar_configured`, `sidecar_not_configured`, and
`unsupported_runtime`. Status/debug output records connector/runtime ids,
kinds, and credential presence flags only. It does not record raw local paths,
JDBC URLs, usernames, passwords, tokens, or environment values.

The opt-in sidecar adapter still requires backend SQL validation before
process launch. Missing launch configuration returns sanitized
`not_configured`. A missing Java executable or sidecar process returns
sanitized `not_configured` without process details. Unsupported connector
driver kinds return sanitized `unsupported_driver` before process launch.
Sidecar request JSON still omits credential values and includes only the safe
runtime kind plus connector/query limits.

## Credential Boundary

Credentials are backend-only runtime configuration.

Allowed future credential sources are:

- environment variables
- backend-only config files
- OS keyring or a future secret store
- session-only operator-provided values after a separate secret-handling
  contract

The frontend sees only safe connector metadata: connector id, display label,
database kind, driver kind, masked JDBC URL metadata, environment,
read-only default, status, notes, and future capability/status flags.

Credentials, raw JDBC URLs, usernames, passwords, tokens, and secret
references must not enter frontend DTOs, Coordinator context, provider prompts,
proposal cards, widget logs, persisted query results, or test snapshots.

## Consequences

- SQL validation remains mandatory before any adapter call.
- Real runtime errors are returned as sanitized statuses such as
  `not_configured`, `unsupported_driver`, `connection_failed`,
  `authentication_failed`, `timeout`, `query_rejected`, `execution_failed`,
  and `result_truncated`.
- Authentication failures use generic messages and never include usernames,
  passwords, tokens, raw JDBC URLs, environment values, or driver dumps.
- Mock execution remains deterministic and default until a later explicit
  sidecar implementation block.
- The Block 264 Java scaffold is test-only. It is not the default JDBC widget
  runtime and does not make real database connections possible by itself.
- Coordinator Chat remains suggest/copy only for JDBC SQL and cannot invoke the
  adapter.
- No storage schema, credential UI, driver installation, broad JDBC sidecar, or
  result persistence is implied by this decision.
