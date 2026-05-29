# JDBC Widget Contract

## Purpose

Contract status: Current Preview.

Source of truth for:

- Database / JDBC Current Preview behavior and boundaries
- workspace-local non-secret connector metadata behavior
- bounded mock/safe read-only SQL validation/execution behavior
- JDBC safety boundaries and Deferred production-runtime scope

Not source of truth for:

- production JDBC runtime
- Workspace Agent SQL execution
- broad database automation
- future credential workflows

This contract defines the Database / JDBC widget product model and safety
boundary. Current behavior is a Preview surface, not a production database
runtime.

The JDBC widget is a controlled database work surface. Future Workspace Agent
integration may work with databases only through explicit, visible widget
capabilities while keeping secrets, permissions, execution, and AI-context
sharing controlled. Older contracts may still use Coordinator Chat as a
compatibility name for this surface. Current Workspace Agent can suggest SQL
text only; it cannot execute SQL or inspect JDBC metadata/results.

This document is the controlling contract for JDBC work. The current
implementation foundation is intentionally limited to workspace-local connector
metadata storage/API, a Preview frontend connector metadata shell, and a
widget-owned mock/safe read-only SQL validation/execution path with bounded
sample results. Block 264 adds a dependency-free Java sidecar scaffold and
backend protocol runner for opt-in tests only. Block 265 adds a backend-only
runtime config loader and crate-internal opt-in sidecar adapter selection path;
the product default remains the mock adapter. Block 266 adds a JDK-gated
backend activation test that routes one explicit service-owned connector
through the Java sidecar `mock_read_only` protocol when a JDK is available.
Block 267 adds inert Rust serde DTOs for the future sidecar protocol envelope,
profile/driver/credential-reference shape, read-only policy caps, bounded
result DTOs, and redacted error DTOs. Those types are not wired into runtime
execution.
Block 268 adds an Experimental real read-only Java sidecar prototype for one
explicit operator-triggered JDBC widget Run. The product default remains mock.
The prototype does not persist credentials or runtime config, does not bundle
or download drivers, and does not add SQL execution for Workspace Agent, Queue,
Agent Executor, Terminal, Git, providers, or background automation.
It does not implement production JDBC, SQL formatting, `EXPLAIN`
visualization, AI provider integration, Workspace Agent runtime, widget tool
execution, credential storage, Terminal or PTY behavior, Git mutation, Queue
behavior, Agent Executor behavior, or Runbook work.

## One-Sentence Role

JDBC Widget: manage connector metadata and preview bounded mock/safe read-only
SQL validation/execution.

## Current Runtime Status

Current product runtime status: Preview, mock-default.

- `WorkspaceService::new(...)` and the current Tauri desktop command path use
  the backend `MockReadOnlyJdbcAdapter` by default.
- `ReadOnlyJdbcAdapter` is the backend boundary for current/future read-only
  execution adapters.
- `MockReadOnlyJdbcAdapter` is the active product adapter. It validates
  conservative read-only SQL, applies row/timeout/result caps, and returns
  deterministic bounded mock results.
- The current validator recognizes `EXPLAIN` only as a mock-path wrapper around
  otherwise supported read-only statements. A real `EXPLAIN` runner,
  visualization, and production database plan workflow remain Deferred.
- `SidecarReadOnlyJdbcAdapter` and `JdbcRuntimeConfig` exist for opt-in
  backend tests, future wiring, and the explicit Experimental sidecar runtime.
  They do not make a production JDBC runtime active in the Database / JDBC
  widget by default.
- Experimental real JDBC is request-scoped and per-run. It requires the
  operator to enable the Experimental sidecar section and supply runtime-only
  values: Java executable, sidecar classpath or JAR, explicit driver JAR path,
  optional driver class name, explicit JDBC URL, optional username, password
  environment variable name, and row/time/result caps.
- Missing or unsupported sidecar/real runtime paths must surface visible
  `not_configured` or `unsupported_driver` style errors; they must not fake a
  production connection.
- No credentials, passwords, tokens, raw JDBC URLs, driver jars, or secret
  references are persisted by the current widget. Experimental runtime values
  are local UI/request inputs for one explicit Run only, and password values
  are never entered into Hobit.
- Workspace Agent may prepare JDBC SQL suggestion text only. It has no
  automatic or hidden JDBC execution path, no JDBC tool, and no access to JDBC
  metadata/results as hidden context.

## Current Implementation Audit

Current active adapter path:

- The product construction path uses `WorkspaceService::new(...)`, whose JDBC
  runtime configuration defaults to `JdbcRuntimeConfig::mock()`.
- The current Tauri JDBC commands open the SQLite store and construct
  `WorkspaceService::new(...)`, so desktop product calls use the mock runtime.
- `ReadOnlyJdbcAdapter` is the backend adapter boundary. The active adapter is
  `MockReadOnlyJdbcAdapter`.
- `SidecarReadOnlyJdbcAdapter`, `JdbcRuntimeConfig`, and sidecar process
  protocol code are reachable only through explicit backend test/future wiring.

Current mock behavior:

- Connector metadata is workspace-local, non-secret, and persisted as display
  name, database kind, driver kind, masked JDBC URL metadata, environment,
  read-only default, status, notes, and timestamps.
- SQL validation strips comments for classification, rejects empty SQL,
  ambiguous statements, mutating/session/file-like tokens, and multi-statement
  batches, and accepts only conservative read-only forms plus mock `EXPLAIN`
  wrappers.
- Mock execution returns deterministic bounded rows, applies row, column, cell,
  and response-size caps, marks `mock_execution`, `no_secrets_returned`, and
  `no_ai_context_shared`, and returns sanitized errors for rejected input.

Current sidecar/unsupported behavior:

- Sidecar runtime selection requires explicit backend construction/configuration
  for tests/future wiring or explicit operator per-run Experimental runtime
  input; it is not the product default.
- Missing launch configuration, missing Java/process support, connector
  mismatches, or unsupported drivers produce sanitized `not_configured` or
  `unsupported_driver` style results.
- Sidecar config status is presence-only and must not expose raw paths, JDBC
  URLs, usernames, passwords, tokens, or environment values to frontend DTOs.
- The dependency-free Java sidecar now includes a happy-path Experimental real
  JDBC branch in addition to the mock protocol smoke target. It supports
  HealthCheck, DriverProbe, ExecuteReadOnlyQuery, explicit driver JAR/class
  loading, JDBC `Connection.setReadOnly(true)` where supported, statement
  timeout, max rows, capped display-safe results, and redacted errors.
- The typed protocol DTOs in `hobit-app` remain contract/test scaffolding, but
  the existing flat sidecar process JSON mapping can now carry request-scoped
  real JDBC runtime fields for the Experimental path. It carries no password
  value, token value, private key, certificate content, or `secretValue` field.
  Real DB smoke requires a user-provided driver and database.

Current request/result types:

- Connector create/update inputs carry only non-secret metadata:
  workspace id, connector id when updating, display name, database kind, driver
  kind, `jdbc_url_masked`, environment, read-only default, status, and notes.
- Validation requests carry workspace id, workbench id, widget instance id,
  connector id, SQL, row limit, and timeout.
- Execution requests add max columns, max cell characters, max result bytes,
  and an optional request-scoped Experimental sidecar runtime config. The
  Experimental config is not stored in SQLite or widget state.
- Validation results carry validity, statement kind, normalized preview,
  rejection reason, and safety notes.
- Execution results carry status, connector id/display name, validation,
  statement kind, display-safe columns/rows, row counts, limits, truncation
  flags, duration, sanitized error, and the no-secrets/no-AI-sharing flags.

Current frontend assumptions:

- The widget is a Database / JDBC Preview surface with explicit connection
  profile selection and a visible mock read-only runtime status.
- The profile editor accepts only metadata and warns operators not to enter
  passwords or tokens.
- Query execution is blocked until the selected visible SQL has been validated
  for the selected connector and row limit.
- Results/errors render visibly inside the JDBC widget. There is no result
  sharing control and no Workspace Agent execution control.

Current tests:

- Storage tests cover workspace-scoped connector metadata, cross-workspace
  isolation, workspace deletion cleanup, and rejection of secret-bearing URL
  metadata.
- Application service tests cover connector validation, SQL classification,
  mock execution caps/results, widget-owner enforcement, cross-workspace
  connector rejection, Workspace Agent execution rejection, and
  redaction/no-secret result behavior.
- Runtime/config/protocol tests cover mock-default selection, sidecar
  not-configured and unsupported statuses, debug redaction, secret-presence
  markers, and JDK-gated Java sidecar mock activation when a JDK exists.
- Tauri DTO tests cover connector and query DTO mapping. Frontend tests cover
  honest preview copy, callback request shape, mock results, and visible
  unsupported/not-configured errors.

Current docs claims:

- `docs/CURRENT_WIDGET_SURFACE.md` defines Database / JDBC as a Current Preview
  metadata and bounded mock/safe read-only query surface.
- `docs/ARCHITECTURE.md` states the app has storage/API/DTO/UI support for
  non-secret connector metadata and mock read-only query execution only.
- `docs/ARCHITECTURE_MILESTONE_STATUS.md` records the current JDBC runtime
  audit: mock-default, sidecar/future test boundary, no credentials, no writes,
  and no Workspace Agent JDBC execution path.

## What The JDBC Widget Is In Current Preview

The current JDBC widget is:

- a database connector list
- a selected connector workspace
- a SQL editor surface
- a bounded mock/safe read-only SQL validator and execution preview
- a bounded mock result grid / sanitized error surface

Future JDBC work may add:

- production read-only query execution after explicit credential/runtime design
- an `EXPLAIN` runner after dialect-specific safety rules are accepted
- a future `EXPLAIN` visualization surface
- a future AI SQL explanation and optimization surface
- a controlled capability provider for Workspace Agent

The widget owns database interaction. Workspace Agent may propose SQL text,
but it must not execute SQL, select connectors silently, inspect metadata, or
receive results unless a later approved capability flow exists.

## What The JDBC Widget Is Not In Current Preview

The Current Preview JDBC widget is not:

- a hidden database agent
- automatic database crawling
- write SQL execution
- production JDBC execution
- a production mutation tool
- a BI dashboard replacement
- a secrets manager
- a scheduler
- a Terminal proxy
- a way for Workspace Agent to bypass approval

## Connector Model

Future connector records should describe an operator-visible database
connection without exposing raw secrets.

Conceptual connector fields:

- `connector_id`
- `workspace_id`
- `display_name`
- `database_kind`
- `driver_kind`
- `jdbc_url_masked`
- `environment`
- `read_only_default`
- `created_at`
- `updated_at`
- `last_used_at`
- `status`
- `notes`

The current implementation stores this as connector metadata, not a production
connection profile. A future real connector profile may extend the metadata
model only after a separate storage/runtime block accepts the schema and secret
handling design.

## Future Connection Profile Boundary

A future JDBC connection profile is the operator-visible, non-secret descriptor
for a database target. It may tell Hobit what database shape to connect to and
which read-only limits to enforce, but it is not a credential record and not a
secret container.

Safe-to-store profile metadata may include:

- stable profile id and display name
- database kind and driver kind/type label
- JDBC URL only when it is known to be non-secret; otherwise store a masked or
  redacted URL descriptor
- username only when the accepted profile policy allows it and it is treated as
  non-secret metadata for that deployment
- default database, schema, or catalog when needed for operator orientation
- read-only flag/default
- row limit
- query timeout
- created and updated timestamps when later stored
- optional tags and description

Values that must not be stored in the workspace DB:

- password
- API token
- Kerberos ticket
- private key
- client certificate or certificate private material
- full connection string when it contains a password, token, key, certificate
  material, or other secret

Profile metadata must remain export-safe. A workspace export may include only
the non-secret profile metadata above and must never include runtime secrets,
raw secret-bearing JDBC URLs, or hidden secret references.

The current metadata model already enforces part of this boundary by storing
`jdbc_url_masked` and rejecting obvious secret-bearing URL parameters. That is
not a complete production secret scanner and must not be treated as permission
to paste raw connection strings into workspace data.

Possible `database_kind` values include:

- `vertica`
- `postgres`
- `trino`
- `mysql`
- `generic_jdbc`

The Current Preview does not need to support all database kinds. Each future
production-supported kind must define its connection, read-only detection,
query limits, and `EXPLAIN` behavior before real external execution is
implemented.

Current foundation status:

- workspace-local connector metadata create/list/read/update APIs exist
- a Preview Database / JDBC widget can create, list, select, and update
  connector metadata
- stored metadata includes only masked/non-secret connector descriptors
- widget-owned read-only SQL validation and mock/safe execution APIs exist
- the Preview widget can validate SQL, run the mock adapter, and display
  bounded sample results or sanitized errors
- passwords, tokens, secret references, driver jars, and runtime credentials are
  not stored
- no real database query execution, test connection, production Java sidecar,
  SQL formatter, real `EXPLAIN` execution/visualization, AI assistance,
  credential input, or Workspace Agent capability runtime exists
- Block 263 adds the backend adapter boundary only: mock remains the active
  execution adapter, and the real sidecar adapter is a not-configured stub with
  sanitized runtime statuses and no credential exposure
- Block 264 adds a dependency-free Java sidecar scaffold at
  `sidecars/jdbc-readonly-sidecar/` plus `scripts/hobit/smoke-jdbc-sidecar.mjs`;
  the scaffold returns deterministic mock/read-only protocol responses and is
  not active in the JDBC widget by default
- Block 265 adds backend-only sidecar runtime config parsing and opt-in
  adapter selection for tests/future desktop wiring; `WorkspaceService::new`
  and the current Tauri bridge still use the mock adapter by default
- Block 266 adds a JDK-gated backend activation test for
  `mock_read_only` sidecar execution through explicit `JdbcRuntimeConfig`;
  it skips without a JDK and still does not enable the sidecar by default

## Secrets Policy

Secrets must remain outside normal widget state, logs, AI prompts, and
Workspace Agent context.

Rules:

- passwords and tokens must not enter AI prompts
- connection strings shown in UI must be masked
- future credentials must be backend-only or session-only
- future persistent credentials may be stored only through a separate OS secret
  store/keychain integration contract; this block does not add that integration
- secrets should not be logged
- secrets should not be stored in ordinary widget state
- secrets should not be stored in workspace SQLite tables, widget state,
  Workbench events, widget logs/results, Queue tasks, Agent Executor artifacts,
  Knowledge / Skills, Notes, or workspace exports
- Workspace Agent never receives raw credentials
- connector metadata returned to Workspace Agent must be non-secret or redacted
- errors, runtime status, debug output, and logs must redact passwords, tokens,
  usernames when policy treats them as sensitive, raw JDBC URLs, environment
  values, private keys, and certificate material

Future runtime secrets must be provided at execution time, resolved through a
future backend-owned OS secret store/keychain integration, or otherwise kept
session-only. A `secret reference` may be introduced later only if it is a
non-secret pointer that cannot reveal or reconstruct the secret from workspace
data or exports.

The Current Preview does not collect credentials. Session-only credentials and
persistent secret storage are Deferred and require a separate contract before
implementation.

## Driver And Runtime Direction

Two implementation directions are possible:

- Option A: Java JDBC sidecar using JDBC driver jars.
- Option B: native Rust database connectors for a limited set of database
  types.

For true JDBC coverage, the recommended direction is a Java sidecar with a
narrow JSON protocol. That protocol should expose only connector management,
read-only query execution, `EXPLAIN`, limits, errors, and result summaries. It
must not expose arbitrary Java execution, shell access, unrestricted driver
loading, or raw credentials to the frontend.

Block 263 decision:

- true JDBC execution should be hosted by a backend-owned Java sidecar rather
  than a frontend runtime or Workspace Agent tool
- the sidecar protocol is narrow JSON for read-only query requests and bounded
  result/error responses
- the backend resolves runtime configuration and credentials before invoking
  the sidecar
- `MockReadOnlyJdbcAdapter` remains the default active adapter
- `SidecarReadOnlyJdbcAdapter` exists only as a not-configured/unsupported
  boundary stub until a later explicit sidecar block
- no driver download, driver installation, sidecar process lifecycle, or real
  database connection is implemented by the boundary slice

The sidecar request shape should include only:

- connector id
- database kind
- driver kind
- backend-only runtime connector config
- SQL text after backend validation
- validator statement kind
- row limit
- timeout
- maximum columns
- maximum cell characters
- maximum result bytes

The sidecar response shape should include only:

- status
- display-safe column summaries
- bounded display-safe row values
- returned row count
- known total row count when available
- truncation flags
- duration
- sanitized error
- `no_secrets_returned`
- `no_ai_context_shared`

The sidecar must not expose arbitrary Java execution, shell commands, driver
jar browsing, raw driver dumps, frontend credential values, Workspace Agent tools,
Terminal control, Git mutation, Queue dispatch, or Agent Executor launch.

Block 264 scaffold:

- source location:
  `sidecars/jdbc-readonly-sidecar/src/main/java/com/hobit/jdbc/JdbcReadOnlySidecar.java`
- smoke command: `node scripts/hobit/smoke-jdbc-sidecar.mjs`
- transport: one JSON request on stdin, one JSON response on stdout
- accepted runtime kind: `mock_read_only`
- implemented statuses: `completed`, `query_rejected`, `not_configured`, and
  `unsupported_driver`
- no JDBC driver loading, no credentials, no network, and no database
  connection
- backend integration remains opt-in/test-only through the sidecar process
  runner; the product service still uses `MockReadOnlyJdbcAdapter`

Block 265 runtime config loader:

- backend-only module:
  `crates/hobit-app/src/workspace_service/jdbc_runtime_config.rs`
- default runtime config: `mock_active`, using `MockReadOnlyJdbcAdapter`
- opt-in sidecar selection requires explicit backend construction plus
  `HOBIT_JDBC_RUNTIME_MODE=sidecar` or `java_sidecar`
- `HOBIT_JDBC_SIDECAR_ENABLED=true` must be present before sidecar launch
  config is considered configured
- sidecar launch keys:
  `HOBIT_JDBC_SIDECAR_JAVA_PROGRAM`, `HOBIT_JDBC_SIDECAR_JAR`,
  `HOBIT_JDBC_SIDECAR_CLASSPATH`, `HOBIT_JDBC_SIDECAR_MAIN_CLASS`, and
  `HOBIT_JDBC_SIDECAR_WORKING_DIR`
- connector/runtime keys:
  `HOBIT_JDBC_SIDECAR_CONNECTOR_ID`,
  `HOBIT_JDBC_SIDECAR_RUNTIME_KIND`,
  `HOBIT_JDBC_SIDECAR_DRIVER_KIND`, and
  `HOBIT_JDBC_SIDECAR_TIMEOUT_MS`
- credential presence keys:
  `HOBIT_JDBC_SIDECAR_JDBC_URL_PRESENT`,
  `HOBIT_JDBC_SIDECAR_USERNAME_PRESENT`, and
  `HOBIT_JDBC_SIDECAR_PASSWORD_PRESENT`
- safe runtime statuses: `mock_active`, `sidecar_configured`,
  `sidecar_not_configured`, and `unsupported_runtime`
- status/debug output is presence-only and omits raw paths, raw JDBC URLs,
  usernames, passwords, tokens, and environment values
- sidecar request JSON still contains no credentials; it contains only the
  safe runtime kind, connector/query identifiers, SQL, and bounded execution
  caps
- missing sidecar launch configuration and missing Java/process execution
  return sanitized `not_configured` results rather than panics or raw process
  output
- unsupported connector driver kinds return sanitized `unsupported_driver`
  before process launch

Block 266 mock sidecar activation:

- backend activation smoke command:
  `cargo test -p hobit-app sidecar_config_executes_java_mock_runtime_when_jdk_available`
- the test checks `java` and `javac` first; if either tool is absent, it
  returns cleanly so normal validation does not require a JDK
- when a JDK is available, the test compiles the dependency-free Java sidecar
  into `target/hobit-jdbc-sidecar-rust-activation/classes`
- the test creates a normal Workspace, Database / JDBC widget, and connector,
  then explicitly installs a test-only `JdbcRuntimeConfig` for that connector
- valid read-only SQL reaches the Java sidecar `mock_read_only` protocol and
  maps back into the existing bounded query result model
- invalid SQL returns `validation_failed` from the backend validator before
  the sidecar process can be launched
- the protocol remains credential-free and status/debug output remains
  sanitized and path/secret-value free
- `WorkspaceService::new(...)`, the Tauri production path, and the JDBC widget
  default remain on `MockReadOnlyJdbcAdapter`

Block 267 inert sidecar protocol DTOs:

- module: `crates/hobit-app/src/workspace_service/jdbc_sidecar_protocol.rs`
- request envelope types define `HealthCheck`, `DriverProbe`,
  `PrepareReadOnlyQuery`, and `ExecuteReadOnlyQuery` shapes for future IPC
- profile/driver fields are non-secret descriptors only: profile id/name,
  database/driver labels, driver JAR path reference, masked/redacted URL label,
  optional policy-allowed username, and credential reference ids
- credential references are non-secret pointers; no password, token, private
  key, certificate content, or secret value field exists in the protocol DTOs
- read-only policy DTO construction fixes `readOnly: true`,
  `allowMultiStatement: false`, `allowStoredProcedures: false`, and non-zero
  row/timeout/result-byte caps
- result/error DTOs include display-safe columns/rows, row count, truncation,
  elapsed time, warnings, safety flags, and redacted errors
- tests cover JSON shape, redaction shape, policy caps, safety/truncation
  flags, and absence of forbidden secret field names
- these DTOs are inert: no sidecar process is started, no JDBC driver is loaded,
  no database connection is opened, no SQL is executed, and no current frontend,
  Tauri command, Workspace Agent, Queue, or Executor behavior changes

## Planned Real Runtime Architecture

This section is a future design contract only. It does not implement real JDBC
execution, add JDBC drivers, add sidecar process code that connects to
databases, store credentials, add keychain integration, add schema/storage
migrations, enable write SQL, or give Workspace Agent an automatic JDBC tool.
The current product runtime remains mock-default.

Recommended real-runtime shape:

- Hobit desktop owns a Java JDBC sidecar process.
- Rust/Tauri remains the policy gate, request validator, lifecycle owner, and
  only process launcher.
- The local IPC is stdio JSON-RPC or an equivalently narrow local JSON protocol.
- The sidecar accepts only approved read-only query requests from Hobit.
- The sidecar is not a general SQL server, remote API, shell bridge, Java
  plugin host, schema crawler, or Workspace Agent tool endpoint.

This shape is preferred because JDBC is JVM-native, driver behavior is already
defined around Java `DriverManager`/`DataSource` semantics, embedding a JVM
inside Rust/Tauri would increase lifecycle and packaging risk, and a separate
process provides driver/JAR isolation while leaving Hobit desktop in control of
policy, request caps, process lifetime, logging, and shutdown.

### Sidecar Lifecycle Contract

Future implementation must choose between per-query and long-lived sidecar
lifetimes explicitly:

- Per-query sidecar: simpler isolation and cleanup, easier cancellation by
  process kill, less risk of stale credentials or leaked connection/session
  state, but higher startup cost.
- Long-lived sidecar: better latency and optional connection pooling, but
  requires explicit health checks, idle shutdown, connection cleanup, memory
  caps, protocol version negotiation, and stronger crash recovery.

The MVP should prefer per-query execution unless measurement proves startup
cost is unacceptable for supported databases. A later long-lived sidecar may be
accepted only after its health, idle timeout, cancellation, and cleanup rules
are documented and tested.

Lifecycle requirements:

- Hobit starts the sidecar only after an explicit operator Run or a later
  approved widget-owned proposal flow.
- Hobit passes one bounded request containing a query id/run id, selected
  profile identity, validated SQL, caps, protocol version, and backend-resolved
  runtime configuration.
- Hobit stops a per-query sidecar after one response, timeout, cancellation, or
  crash.
- A long-lived sidecar must be owned by the desktop runtime state, not storage,
  and must stop on app shutdown, profile disable, protocol mismatch, repeated
  crash, or explicit operator disconnect.
- Query timeout is mandatory and must be enforced by Rust process control and,
  when possible, JDBC statement timeout.
- Cancellation must close the active statement/connection when possible and
  must terminate the sidecar process when a graceful cancel does not complete
  within a bounded grace period.
- Sidecar stderr/stdout must be capped. Logs must redact raw JDBC URLs,
  usernames when policy treats them as sensitive, passwords, tokens,
  environment values, private keys, certificates, SQL result values, and driver
  dumps.
- Crash, invalid JSON, protocol mismatch, failed start, non-zero exit, timeout,
  and oversized response must map to sanitized visible statuses such as
  `not_configured`, `unsupported_driver`, `connection_failed`, `timeout`, or
  `execution_failed`.
- Protocol negotiation must include a protocol version and sidecar runtime kind
  before any real query runs. Unknown versions or runtime kinds fail closed.
- The sidecar must not run in hidden background mode, poll databases, watch
  profiles, schedule queries, auto-reconnect for hidden work, or continue work
  after the visible owning query is canceled or completed.

### Driver Loading Contract

Future real JDBC execution depends on operator/admin-provided JDBC driver JARs.
Hobit must not bundle proprietary drivers in the MVP and must not download
drivers automatically.

Driver rules:

- Driver location is explicit and selected/configured by the operator or admin.
- Profile metadata may reference non-secret driver metadata such as driver kind,
  display label, configured driver id, version label, explicit path, or future
  content hash when those values are allowed by policy.
- Workspace DB/export data must not contain embedded driver binaries or
  credentials.
- Hobit must not scan arbitrary folders looking for JARs or infer driver paths
  from hidden filesystem traversal.
- The sidecar must load only the configured driver path(s) for the selected
  profile/request.
- Driver load failures must be visible and redacted. They must not print raw
  local directory listings, classpaths, environment values, usernames,
  passwords, tokens, or full secret-bearing JDBC URLs.
- Future allowlist, pinned hash, signature, or admin policy checks are
  recommended before production use in managed environments.

### Real Read-Only Enforcement Layers

Future real execution must use layered controls. No single validator or JDBC
setting is enough.

Required layers:

- The UI presents the action as read-only and shows selected profile, SQL, row
  cap, query timeout, result cap, and risk notes before Run.
- Rust/app service validates widget ownership, connector/profile scope,
  profile status, explicit operator Run/proposal approval, SQL classification,
  row limit, timeout, column/cell/result caps, and no multi-statement batch.
- Rust/Tauri sends only approved read-only requests to the sidecar.
- The sidecar independently checks request protocol version, validated
  read-only flag, SQL statement kind, caps, driver/profile match, and
  read-only policy before opening or using a connection.
- JDBC connection `setReadOnly(true)` must be called when supported, and
  statement/query timeout must be set when supported.
- Real database credentials should be least-privilege and read-only; Hobit's
  validator is defense in depth, not a permissions substitute.
- DDL, DML, transaction control, session mutation, privilege changes, stored
  procedure execution, unsafe `EXPLAIN ANALYZE` variants, file import/export,
  extension loading, shell/program operations, and SQL forms with database-side
  file/network side effects are blocked in the MVP.
- Multi-statement execution remains disabled in the MVP.
- Row cap, timeout, result byte cap, column cap, and cell cap are mandatory.
- Result truncation must be explicit in the returned DTO and visible UI.

### Future Result And Error DTO Boundary

Current runtime DTOs stay unchanged in this block. A future real-runtime DTO
must remain display-safe and secret-free.

Future result DTO fields should include:

- query id or run id
- source profile id and display name
- status
- columns with display name and value kind/type label
- rows as capped display-safe scalar strings
- returned row count
- known total row count when available
- truncated flag plus row/column/cell/byte truncation details
- row limit, timeout, and result byte cap used
- elapsed time/duration
- warnings
- redacted error code/category and redacted message
- `no_secrets_returned`
- `no_ai_context_shared` until a separate approved sharing flow exists

DTOs, logs, errors, warnings, frontend state, widget logs/results, Workspace
events, Queue tasks, Agent Executor artifacts, Knowledge / Skills, Notes,
provider prompts, and workspace exports must not contain credentials, raw
secret-bearing JDBC URLs, tokens, Kerberos tickets, private keys, client
certificates, unbounded driver output, or hidden secret references.

### Future AI / JDBC Capability Contract

Current Workspace Agent may draft SQL suggestion text only. That remains true
after this block.

Future AI/JDBC behavior may allow Workspace Agent to:

- draft SQL from visible operator-provided context
- explain visible SQL
- create a visible JDBC proposal card with connector intent, SQL preview, row
  limit, timeout, risk notes, and result-sharing intent
- explain results only after the result is visible in the JDBC widget and the
  operator explicitly approves the result sample/schema as AI-readable context

Workspace Agent must not:

- execute SQL automatically
- select connectors silently
- read connector metadata, schemas, errors, or result rows as hidden context
- use credentials invisibly
- bypass row/time/result caps or read-only checks
- create Queue/Executor work that runs SQL outside the JDBC widget boundary
- exfiltrate result data into hidden provider context
- retain database results as ambient memory

The user must explicitly press Run in the JDBC widget or approve a later
widget-owned proposal that still routes through the JDBC policy gate. Query
results become AI-visible only after visible operator review and explicit
sharing. Approval for one query does not grant future hidden connector access,
schema crawling, credential use, or autonomous SQL execution.

### Future Implementation Phases

Safe implementation phases:

1. Protocol/types only: inert Rust DTOs and serde tests now exist for
   request/response envelopes, profile/driver/credential references,
   read-only policy, results, and redacted errors. They are not wired into
   execution.
2. Sidecar health/probe: start the sidecar for version/health only, with no
   driver loading and no SQL execution.
3. Driver loading with no query execution: load explicitly configured test
   driver paths, report redacted driver status, and avoid folder scanning.
4. Read-only query execution against test DB only: use test fixtures and
   read-only credentials, enforce SQL/caps/timeouts in Rust and sidecar, and
   keep production profiles disabled.
5. UI connection profile selection: expose profile selection and runtime status
   without credential persistence.
6. Result preview/caps: show visible bounded results, truncation, elapsed time,
   warnings, and redacted errors; no AI sharing by default.
7. Workspace Agent proposal integration: add visible proposal/copy/apply flow
   only after real execution and visible result review are stable; no automatic
   SQL execution.

## SQL Editor Behavior

Current Preview JDBC UI includes:

- connector selector
- connection / runtime status
- SQL editor
- read-only safety notice
- Run
- row limit
- timeout
- result area
- error area
- collapsed runtime details

Deferred UI capabilities include Format SQL, `EXPLAIN`, saved query history,
tabs, charts, schema browser, AI analysis, and write-mode controls. Monaco or
CodeMirror is optional later and must not be required for the Current Preview
or the first production-runtime slice.

## SQL Formatting

SQL formatting is a local helper capability:

- format SQL text
- no database execution
- no AI required
- operator can edit formatted SQL before running it

Formatting must not send SQL to a provider unless a later AI-review action is
explicitly approved. This contract does not implement a formatter.

## Read-Only Execution Policy

Default JDBC execution mode must be read-only.

The Current Preview execution path is conservative. It validates SQL before
mock/safe execution, and it must reject ambiguous input rather than trying to
repair or reinterpret it.

Future real connector runtime must preserve at least this safety floor:

- SELECT/read-only execution only.
- Statement timeout is required.
- Row cap is required.
- Result byte, column, and cell caps are required.
- Multi-statement execution is disabled unless a later implementation uses a
  safe parser that proves every statement is read-only and still preserves the
  same caps.
- DDL, DML, transaction control, session mutation, privilege changes, and file
  or program operations are rejected.
- Stored procedure execution is not part of the MVP.
- SQL forms with possible file, network, extension loading, shell, copy/import,
  export, privilege, or database-side side effects are rejected unless a later
  dialect-specific policy explicitly proves they are safe.
- Read-only database credentials, read-only transaction/session settings, or
  connector-level read-only enforcement should be used as defense in depth
  when real execution exists.
- Errors are visible to the operator and redacted before frontend/log return.
- Query results are visible in the JDBC widget before they can be copied,
  exported, or shared as AI context by a later approved flow.
- Hidden query execution by AI, Queue, Agent Executor, Terminal, Git, Runbook,
  provider tools, or background runtime is forbidden.
- Explicit user Run from the JDBC widget is required until a later approved
  capability contract defines a visible proposal/approval flow.

The Current Preview should allow only safe query forms such as:

- `SELECT`
- `WITH`
- `SHOW`
- `DESCRIBE`

`EXPLAIN` workflows remain Deferred unless a later explicit implementation
defines and accepts dialect-specific safety rules, including blocking
`EXPLAIN ANALYZE` or variants that may execute work beyond plan inspection.

The Current Preview should reject or block SQL forms such as:

- `INSERT`
- `UPDATE`
- `DELETE`
- `DROP`
- `ALTER`
- `CREATE`
- `TRUNCATE`
- `MERGE`
- `COPY`
- `GRANT`
- `REVOKE`
- `CALL`
- `EXECUTE`
- `SET` when it changes session state in unsafe ways

If a database dialect requires exceptions, those exceptions must be documented
before implementation. SQL classification must be conservative; ambiguous
statements should require explicit rejection or a later stronger policy rather
than executing silently.

Additional Current Preview validator rules:

- Strip leading comments and whitespace only for classification.
- Reject empty SQL.
- Reject multiple statements until a stronger parser exists.
- Reject semicolon-delimited batches even when each statement appears read-only.
- Reject transaction control and session mutation keywords such as `BEGIN`,
  `COMMIT`, `ROLLBACK`, `USE`, `LOCK`, `UNLOCK`, `VACUUM`, `ANALYZE`, and
  `PRAGMA` unless a later dialect-specific policy explicitly allows them.
- Reject SQL containing obvious file, program, extension, or privilege
  operations.
- Treat validation success as a precondition, not a guarantee of database
  safety; connector-level read-only credentials or transaction mode should be
  used when real execution exists.
- The Experimental real sidecar path has a stricter MVP guard than the mock
  path: only `SELECT` and `WITH` single statements are allowed before sidecar
  launch. `SHOW`, `DESCRIBE`, and mock `EXPLAIN` wrappers remain mock-path
  behavior only.

## First Read-Only Execution Slice

The first read-only execution slice is shipped as Current Preview. It is a
backend-owned, widget-scoped bounded mock/safe query foundation. It must be
executable only from the Database / JDBC widget after visible operator review,
and it must not be represented as production JDBC runtime or real database
results.

Execution boundary:

- The operator triggers execution from the JDBC widget.
- The operator must see the selected connector, SQL text, validation state,
  row limit, timeout, and risk notes before running.
- Workspace Agent may suggest SQL text, but cannot execute it.
- Workspace Agent provider requests must continue to use `allowed_tools: []`.
- No provider, Queue, Agent Executor, Terminal, Git, Runbook, or hidden runtime
  path may invoke JDBC execution.

Connector boundary:

- Use an explicit selected connector id.
- Connector display metadata may be visible; raw credentials must remain
  backend-only or unavailable.
- The Current Preview uses a mock/safe execution adapter that proves
  validation, DTOs, caps, and UI behavior without opening a database
  connection.
- Future production runtime with credentials or sidecar execution remains
  Deferred. Missing connector runtime or missing credentials in a future
  production path should return a visible `not_configured` or `unsupported`
  execution error, not a fake success.

Current Preview API shape:

```text
validate_jdbc_read_only_sql(request)
  workspace_id
  workbench_id
  widget_instance_id
  connector_id
  sql
  row_limit
  timeout_ms
  -> validation_status
     statement_kind
     normalized_preview
     rejection_reason?
     risk_notes[]

execute_jdbc_read_only_query(request)
  workspace_id
  workbench_id
  widget_instance_id
  connector_id
  sql
  row_limit
  timeout_ms
  max_columns
  max_cell_chars
  max_result_bytes
  -> status
     connector_id
     connector_display_name
     statement_kind
     columns[]
     rows[][]
     returned_row_count
     total_row_count_known?
     truncated_rows
     truncated_columns
     truncated_cells
     truncated_bytes
     duration_ms
     sanitized_error?
     no_secrets_returned
     no_ai_context_shared
```

The API may expose separate app-service and Tauri DTO names, but the fields
above are the minimum behavior contract. Result rows should be represented as
display-safe scalar values; binary or driver-specific values must be converted
to capped strings or returned as redacted placeholders.

Current Preview frontend shape:

- connector selector using existing connector metadata APIs
- visible connection/runtime status that says the current product runtime is
  mock-only and that a selected connection profile is required
- SQL textarea/editor
- row limit and timeout controls with conservative defaults
- validation status near the Run action
- explicit `Run read-only query` button
- result table/grid with column headers and compact rows
- duration, returned row count, and truncation notices
- sanitized error panel
- collapsed runtime details for mock/unsupported runtime state
- no AI execution, no Workspace Agent execution, no schema crawler, no production
  JDBC runtime, and no result sharing controls until a later Evidence/Sources
  or AI-context slice exists

The Current Preview UI may be operationally simple. It should not show
production-grade features such as saved query history, tabs, charts, schema
browser, `EXPLAIN` visualization, AI analysis, or write-mode controls.

## Query Execution Limits

The widget must not return unbounded result sets.

Mandatory execution limits:

- query timeout
- maximum rows
- maximum columns
- maximum cell length
- maximum result bytes
- result truncation marker
- error capture
- duration
- row count when available

Limit values should be visible to the operator before execution. They should
be included in future action proposals only when a later explicit Workspace
Agent JDBC capability flow exists.

Recommended Current Preview defaults:

- row limit: 100
- maximum columns: 50
- maximum cell length: 2,000 characters
- maximum result bytes: 256 KiB
- timeout: 10 seconds

These values may be adjusted by implementation constraints, but the chosen
defaults must remain conservative, visible, and tested. Large results should be
rejected or truncated with explicit flags rather than streamed without bounds.

Error handling:

- Driver, network, timeout, validation, unsupported, and not-configured errors
  must be distinct enough for the operator to understand what happened.
- Error text must be sanitized before returning to frontend.
- Errors must not include credentials, authorization headers, raw JDBC URLs,
  environment variables, or unbounded driver output.
- Query text may be shown back to the operator because the operator supplied it,
  but it must not be logged or sent to AI by default.

Sanitized real-runtime status values:

- `not_configured`
- `unsupported_driver`
- `connection_failed`
- `authentication_failed`
- `timeout`
- `query_rejected`
- `execution_failed`
- `result_truncated`

`authentication_failed` must use generic text and must not reveal username,
password, token, raw JDBC URL, secret reference, environment variable, or
driver-specific credential detail.

## EXPLAIN Behavior

`EXPLAIN` is Deferred in the Current Preview.

Future `EXPLAIN` output should be:

- captured
- displayed
- capped
- available for AI explanation only after explicit approval or an approved
  policy

Future visualization may include:

- plan tree
- cost highlights
- row estimates
- expensive nodes
- operator summaries

This contract does not implement `EXPLAIN` execution or visualization.

## Result Grid Behavior

Current Preview results should show:

- columns
- rows
- duration
- row count
- truncation state
- errors
- connector name
- query status

Large results should be capped and must not be automatically sent to AI.
Operator-visible truncation must make it clear that the result is a sample or
bounded output rather than the complete dataset.

For the Current Preview execution slice, results are session/UI state unless a
later block explicitly adds widget run/result persistence. Do not add
Evidence/Sources capture, AI context sharing, saved query history, or storage
migrations as part of the Current Preview foundation.

## Workspace Agent / AI Capability Boundary

Current Workspace Agent behavior:

- It may prepare visible JDBC SQL suggestion text only.
- JDBC suggestion cards are review/copy text. They do not select connectors,
  inspect schemas, run SQL, call providers with results, launch Queue or Agent
  Executor, or mutate any database state.
- Provider requests must continue to use `allowed_tools: []` and must not
  include connector metadata, schemas, SQL results, JDBC errors, credentials,
  or hidden database context.

Allowed for a future approved AI/JDBC capability flow:

- read visible schema metadata only after the operator explicitly connects or
  selects a profile and approves that metadata exposure
- draft SQL suggestions
- explain query results that are already visible in the JDBC widget and
  explicitly approved for AI context
- propose a query for user review

Not allowed:

- auto-run a query
- hidden database access
- database mutation
- bypass row, timeout, result-size, or read-only caps
- use credentials invisibly
- read or crawl schemas silently
- exfiltrate result data into hidden provider context
- treat connector metadata, schemas, errors, or results as ambient Workspace
  Agent memory

Approval model:

- AI may create a visible proposal card with SQL, connector intent, row limit,
  timeout, risk notes, and whether result data would be shared with AI.
- The user must explicitly copy, apply, or run the SQL through the JDBC widget
  or a later approved widget-owned capability flow.
- Results must be visible to the operator before any result sample, schema, or
  explanation becomes AI-readable context.
- Approval of one proposal does not grant future hidden connector access,
  credential use, broader schema reads, or autonomous execution.

## AI SQL Assistance

Future AI SQL assistance may help with:

- explain this query
- optimize this query
- explain this `EXPLAIN` plan
- find risky SQL
- suggest a safer diagnostic query
- summarize a result sample

AI must not:

- execute SQL
- choose a connector silently
- receive secrets
- receive full uncapped results by default
- generate and run write SQL automatically

AI output should be suggestions and explanations. Current Preview has no AI
query assistance, no AI result sharing, and no Workspace Agent execution.
Execution remains through the JDBC widget capability and policy.

## Workspace Agent Capability Model

Future JDBC capabilities for Workspace Agent:

- list connectors
- get selected connector summary
- run approved read-only SQL
- run `EXPLAIN`
- return capped result sample
- return capped explain output
- ask AI to explain SQL
- ask AI to optimize SQL
- ask AI to explain a plan

Each capability must define risk level and approval requirements.

Risk defaults:

- listing connectors is `external_read` if it queries configured external
  systems, otherwise `read_only` for stored non-secret metadata
- reading selected connector summary is `read_only` when it returns only
  masked metadata
- running read-only SQL is `external_read`
- running `EXPLAIN` is `external_read`
- AI-only explanation of selected SQL is `analysis_only`
- write SQL is `external_write` and out of first scope
- secret-bearing operations are `secret_sensitive`

Workspace Agent can request these capabilities only through the JDBC widget
boundary. It must not bypass connector selection, SQL approval, query limits,
or result-sharing policy.

Current Workspace Agent relationship for the Current Preview:

- Workspace Agent JDBC proposals remain non-executing SQL suggestion cards.
- A later bridge may copy a reviewed SQL suggestion into the JDBC widget after
  explicit operator action.
- Workspace Agent must not run SQL, select connectors silently, inspect
  connector metadata, read query results, or receive database errors as hidden
  context.
- Provider requests must not include connector metadata, SQL results, schemas,
  credentials, JDBC errors, or result samples unless a later approved
  Evidence/Sources or context-sharing flow exists.

## Action Approval Model

Future Workspace Agent JDBC actions should be proposed as action cards.

The action card should show:

- connector
- environment
- SQL preview
- query type
- risk level
- row limit
- timeout
- what data may be returned
- whether result data may be shared with AI

The operator can approve, edit, or cancel.

Guided or autonomous modes may later allow low-risk read-only queries within
explicit policy, but they are Deferred. Write SQL is not allowed in the Current
Preview and remains out of scope for first production JDBC slices.

## Context Sharing With AI

Current Preview does not share JDBC metadata, SQL results, schemas, database
errors, or result samples with AI.

Future approved AI context-sharing flows may receive:

- SQL text
- connector type and non-secret metadata
- approved `EXPLAIN` summary
- result schema
- small capped sample
- row count and duration
- error message

AI must not receive:

- passwords
- tokens
- raw connection string
- full unbounded result
- all database schemas
- all rows
- unapproved result data

The operator or an explicit approved context-sharing policy must control
whether a query result, sample, schema, or `EXPLAIN` output becomes AI context.

## Schema Metadata

Future JDBC widget behavior may support:

- list schemas
- list tables
- describe table
- column names and types

Schema introspection should be explicit and capped. Workspace Agent must not
crawl a whole database silently.

## Audit And Observability

Future JDBC actions should record or expose:

- who requested the action
- connector
- SQL hash or SQL text according to policy
- query type
- approval mode
- `started_at`
- duration
- row count
- status
- error
- whether result data was shared with AI

This contract does not implement audit storage.

## Safety Boundaries

The JDBC widget safety boundary is:

- read-only by default
- Current Preview only for bounded mock/safe read-only SQL
  validation/execution
- no production JDBC execution in Current Preview
- no write SQL
- no hidden queries
- no secret exposure
- no credential expansion
- no schema mutation
- no uncapped result streaming
- no `EXPLAIN` workflow in Current Preview
- no automatic AI execution
- no hidden Workspace Agent-triggered SQL execution
- no Terminal launch
- no Git mutation
- no file mutation
- no scheduler
- no production write mode

## Relationship To Workspace Agent

Current Workspace Agent can suggest JDBC SQL text only. Future Workspace Agent
may use JDBC only through explicit widget capabilities after a later approved
capability flow exists.

Workspace Agent may currently:

- propose read-only SQL
- ask clarifying questions before a query
- suggest safer diagnostics as text

Future approved flows may allow Workspace Agent to interpret an approved bounded
result or `EXPLAIN` output and create Queue tasks based on findings.

Workspace Agent must not:

- choose a connector silently
- run SQL
- receive raw credentials
- bypass JDBC widget limits
- inspect connector metadata or query results as hidden context
- treat database data as hidden workspace context

## Relationship To Agent Queue And Agent Executor

JDBC investigation may produce Agent Queue tasks.

Agent Executors can later execute engineering follow-up tasks when the
operator starts them through the Queue-to-Executor path. The JDBC widget itself
does not run Agent Executor, and Agent Queue does not run SQL directly.

## Relationship To Evidence And Sources

SQL results and `EXPLAIN` output can become evidence candidates later.
The evidence trust boundary is defined in
`docs/EVIDENCE_SOURCES_CONTRACT.md`.

Evidence should record:

- connector
- query
- timestamp
- result summary
- approval state
- whether AI saw the evidence

AI interpretation is not evidence unless it is marked as AI interpretation.

## First Practical Implementation Slices

Recommended implementation slices:

1. Current Preview JDBC read-only backend foundation: completed for bounded
   mock/safe execution, SQL validator, bounded result model, sanitized errors,
   and no Workspace Agent execution.
2. Current Preview JDBC result UI: completed for connector selector, SQL
   textarea, Run read-only query, validation status, result grid,
   caps/truncation notices, and error panel.
3. Decision follow-up: decide whether to promote the preview path, hide/remove
   it, implement production runtime, or connect Workspace Agent only through
   explicit approved actions later.
4. Real connector execution adapter after credential/runtime handling is
   explicitly designed.
5. SQL formatter.
6. `EXPLAIN` backend/API with dialect-specific safety rules.
7. `EXPLAIN` UI.
8. AI SQL review contract.
9. Workspace Agent to JDBC read-only action proposal/copy flow after JDBC
   execution and result review exist.
10. JDBC result and `EXPLAIN` evidence capture after the Evidence/Sources
   foundation exists.

Each slice must remain narrow and preserve the read-only, approval-aware,
secret-isolated boundary.

## Non-Goals For Current Preview

The Current Preview does not add:

- write SQL
- credential expansion
- persistent secret storage
- production JDBC execution
- production Java sidecar runtime
- hidden Workspace Agent-triggered SQL execution
- `EXPLAIN` workflows
- schema crawler
- schema mutation
- dashboard builder
- scheduled queries
- automatic AI-run queries
- production mutation
- Terminal execution
- Git mutation

## Non-Goals For This Block

This contract does not implement:

- storage/schema changes
- production Java sidecar implementation
- production JDBC execution
- write SQL
- SQL formatter implementation
- `EXPLAIN` execution or visualization implementation
- AI provider integration
- Workspace Agent runtime
- widget tool execution
- database credentials handling
- secrets storage
- Terminal or PTY work
- Git mutation
- Queue behavior changes
- Agent Executor behavior changes
- Runbook work
