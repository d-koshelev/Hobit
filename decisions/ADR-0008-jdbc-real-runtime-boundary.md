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
Workspace Agent execution, Terminal control, Git mutation, Queue dispatch, or
Agent Executor launch.

Block 267 adds inert Rust serde DTOs for this future sidecar protocol boundary.
They define envelope, health check, driver probe, prepare read-only query,
execute read-only query, non-secret profile/driver references, credential
reference ids, read-only policy caps, bounded results, safety flags, and
redacted errors. They are contract/test scaffolding only and are not called by
the current JDBC runtime.

Block 268 implements the first Experimental real read-only sidecar prototype.
This narrows, rather than replaces, the ADR: the default adapter remains
`MockReadOnlyJdbcAdapter`; real JDBC is request-scoped, opt-in, and reachable
only from an explicit Database / JDBC widget Run when the operator supplies all
runtime inputs. The prototype uses the existing flat stdin/stdout JSON process
mapping, not the full typed envelope, for runtime execution.

Block 269 adds explicit sidecar diagnostics for that Experimental boundary.
HealthCheck and DriverProbe are manual Database / JDBC widget actions using
the same runtime-only Java/sidecar/driver inputs. HealthCheck verifies that the
Java sidecar can start and answer. DriverProbe loads only the explicit driver
JAR/class. Neither diagnostic executes SQL, opens a database connection,
persists runtime config, accepts password values, scans folders, downloads
drivers, or creates Workspace Agent/Queue/Executor execution.

## Real Runtime Architecture Contract

This ADR now fixes the future real-runtime shape without implementing it.
Current product behavior remains mock-default; no JDBC drivers, credential
storage, keychain integration, real database connections, write SQL, schema
migrations, Queue/Executor behavior, or Workspace Agent automatic execution are
added by this decision. The later Experimental prototype adds only
runtime-only explicit driver/JDBC execution for one visible read-only query and
does not persist credentials or runtime configuration.

Real JDBC execution should run in a Hobit-owned Java sidecar because JDBC is
JVM-native, driver behavior is Java-first, and a separate process avoids
embedding a JVM into Rust/Tauri while isolating driver JARs. Rust/Tauri remains
the policy gate and lifecycle owner. The sidecar communicates over local stdio
JSON-RPC or an equivalently narrow local JSON protocol and accepts only
approved read-only query requests. It is not a general SQL server, remote API,
shell bridge, Java plugin host, or Workspace Agent tool endpoint.

Lifecycle contract:

- The sidecar starts only for explicit operator Run or a later approved
  widget-owned proposal.
- The MVP should prefer per-query sidecars for isolation and cleanup unless
  measured startup cost requires a long-lived process.
- Long-lived sidecars, if later accepted, require health checks, protocol
  negotiation, idle shutdown, memory/output caps, cancellation, crash recovery,
  and explicit app-shutdown cleanup.
- Rust process control and JDBC statement timeout both enforce query timeout
  when possible.
- Cancellation closes the active statement/connection when possible and
  terminates the process after a bounded grace period.
- Crashes, failed start, timeout, invalid JSON, oversized output, protocol
  mismatch, and non-zero exit map to sanitized visible statuses.
- Manual diagnostics use the same lifecycle and redaction boundary as query
  execution, but they are separate requests and do not contain SQL.
- The sidecar must not poll, schedule, reconnect for hidden work, or keep
  database work running after the visible owning query completes or cancels.

Driver loading contract:

- User/admin supplies explicit JDBC driver JAR paths.
- Hobit does not bundle proprietary drivers or download drivers in the MVP.
- The Experimental prototype loads one explicit driver JAR path for the current
  Run only; it does not scan folders or manage driver installation.
- Experimental DriverProbe loads one explicit driver JAR/class for the current
  diagnostic only and does not connect to a database.
- Profile metadata may reference non-secret driver labels, configured driver
  ids, explicit paths, version labels, or future hashes when policy allows.
- Hobit must not scan arbitrary folders for drivers.
- Driver load failures are visible and redacted, with no raw classpath dumps,
  environment values, credentials, directory listings, or secret-bearing JDBC
  URLs.
- Future allowlists, pinned hashes, signatures, or admin policy checks are
  recommended before managed production use.

Read-only enforcement is layered:

- UI presents read-only execution and visible limits.
- Rust validates widget/profile scope, explicit Run/proposal approval, SQL
  classification, row/time/result caps, and no multi-statement batch.
- The sidecar independently verifies protocol, validated-read-only flag,
  statement kind, caps, driver/profile match, and policy.
- JDBC `Connection.setReadOnly(true)` and statement/query timeout are used when
  supported.
- Database credentials must still be least-privilege read-only.
- DDL, DML, transaction control, session mutation, privilege changes, stored
  procedures, unsafe `EXPLAIN ANALYZE`, file import/export, extension loading,
  shell/program operations, and file/network side effects through SQL are
  blocked in the MVP.
- The Experimental prototype uses a stricter MVP app/sidecar guard than the
  mock path: only single-statement `SELECT` and `WITH` are allowed. `SHOW`,
  `DESCRIBE`, and mock `EXPLAIN` wrappers remain mock-path behavior.

Future real-runtime result DTOs should carry query/run id, source profile
id/name, status, columns, capped display-safe rows, returned and known total row
counts, truncation flags, elapsed time, warnings, redacted error category and
message, and safety flags. DTOs/logs/prompts must not contain credentials, raw
secret-bearing JDBC URLs, tokens, Kerberos tickets, private keys, certificates,
unbounded driver output, or hidden secret references.

Workspace Agent may draft SQL, explain visible SQL, and later create visible
proposal cards. It must not execute SQL automatically, select connectors
silently, read hidden connector/schema/result context, use credentials
invisibly, bypass caps/read-only policy, or exfiltrate results into hidden
provider context. Results become AI-visible only after visible operator review
and explicit sharing approval.

Safe future implementation phases:

1. Protocol/types only: completed as inert Rust DTOs and serde tests.
2. Sidecar health/probe with no driver loading or SQL execution.
3. Explicit driver loading with no query execution.
4. Read-only query execution against test DB only.
5. UI profile selection and runtime status.
6. Visible result preview/caps and redacted errors.
7. Workspace Agent proposal integration without automatic execution.

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

## Block 266 Mock Sidecar Activation

Block 266 proves the opt-in backend activation path for the Java sidecar
scaffold without changing the product default.

Focused activation command:

```text
cargo test -p hobit-app sidecar_config_executes_java_mock_runtime_when_jdk_available
```

The test checks for `java` and `javac` on `PATH` before compiling or launching
anything. If either tool is missing, it returns cleanly so ordinary validation
does not require a JDK. When a JDK is available, it compiles the dependency-free
sidecar source into:

```text
target/hobit-jdbc-sidecar-rust-activation/classes
```

The test then creates a normal backend Workspace, Database / JDBC widget, and
connector, installs a test-only explicit `JdbcRuntimeConfig` for that connector,
and executes `select 1` through the sidecar `mock_read_only` protocol. The
sidecar response is mapped into the existing bounded
`JdbcReadOnlyQueryResultSummary` model. A mutation statement still returns
`validation_failed` before sidecar process launch.

This remains test/dev activation only. `WorkspaceService::new(...)`, the Tauri
desktop service path, and the JDBC widget UI remain on
`MockReadOnlyJdbcAdapter` by default. No JDBC drivers, credentials, network
connections, database connections, frontend config exposure, Coordinator
execution, provider tools, or result persistence are introduced.

## Block 267 Inert Protocol DTOs

Block 267 adds typed Rust protocol shapes in
`crates/hobit-app/src/workspace_service/jdbc_sidecar_protocol.rs`.

The request envelope covers:

- `HealthCheck`
- `DriverProbe`
- `PrepareReadOnlyQuery`
- `ExecuteReadOnlyQuery`

The profile and secret boundary is reference-only. Protocol profiles may carry
non-secret profile id/name, database and driver labels, a driver JAR path
reference, masked/redacted URL label, optional policy-allowed username, and
credential reference ids. They do not carry password strings, token strings,
raw secret-bearing JDBC URLs, private keys, certificate content, or secret
value fields.

The read-only policy shape fixes `readOnly: true`,
`allowMultiStatement: false`, and `allowStoredProcedures: false`, with non-zero
caps for max rows, timeout, and max result bytes. Result DTOs carry columns,
display-safe rows, row count, truncation flags, elapsed time, warnings, safety
flags, and optional redacted errors. Error DTOs carry only kind, message, and
`redacted: true`.

These DTOs are inert. They do not start a sidecar process, load JDBC drivers,
open database connections, execute SQL, persist credentials, add keychain
integration, change schema/storage, change the mock-default runtime, or change
Workspace Agent, Queue, Executor, Codex, Terminal, Git, or frontend behavior.

## Credential Boundary

Credentials are backend-only runtime configuration.

Allowed prototype/future credential sources are:

- environment variables
- backend-only config files
- OS keyring or a future secret store
- session-only operator-provided values after a separate secret-handling
  contract

The Experimental prototype supports password environment variable names only.
Hobit does not collect or persist password values. The sidecar receives the
environment variable name in the request and reads the value from its inherited
process environment if the operator configured one outside Hobit. JDBC URLs
with obvious password/token/secret parameters are rejected by the Rust app
layer.

The frontend sees only safe connector metadata: connector id, display label,
database kind, driver kind, masked JDBC URL metadata, environment,
read-only default, status, notes, and future capability/status flags.

Credentials, raw JDBC URLs, usernames, passwords, tokens, and secret
references must not enter frontend DTOs, Coordinator context, provider prompts,
proposal cards, widget logs, persisted query results, or test snapshots.
The Block 267 typed protocol DTOs may contain non-secret credential reference
ids for future backend-only resolution, but no implemented runtime transmits or
resolves credentials through those DTOs.

## Consequences

- SQL validation remains mandatory before any adapter call.
- Real runtime errors are returned as sanitized statuses such as
  `not_configured`, `unsupported_driver`, `connection_failed`,
  `authentication_failed`, `timeout`, `query_rejected`, `execution_failed`,
  and `result_truncated`.
- Authentication failures use generic messages and never include usernames,
  passwords, tokens, raw JDBC URLs, environment values, or driver dumps.
- Mock execution remains deterministic and default until a later explicit
  production sidecar implementation block.
- The Java sidecar now has an Experimental real JDBC branch. It is not the
  default JDBC widget runtime, does not make production JDBC available, and
  requires a user-provided driver/database for manual smoke.
- Workspace Agent remains suggest/copy only for JDBC SQL and cannot invoke the
  adapter.
- No storage schema, credential UI, driver installation, broad JDBC sidecar, or
  result persistence is implied by this decision.
