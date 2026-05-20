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
- Coordinator SQL execution
- broad database automation
- future credential workflows

This contract defines the Database / JDBC widget product model and safety
boundary. Current behavior is a Preview surface, not a production database
runtime.

The JDBC widget is a controlled database work surface. Future Coordinator Chat
integration may work with databases only through explicit, visible widget
capabilities while keeping secrets, permissions, execution, and AI-context
sharing controlled. Current Coordinator Chat can suggest SQL text only; it
cannot execute SQL or inspect JDBC metadata/results.

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
It does not implement real database JDBC execution, SQL formatting, `EXPLAIN`
visualization, AI provider integration, Coordinator runtime, widget tool
execution, database credential handling, secret storage, Terminal or PTY
behavior, Git mutation, Queue behavior, Agent Executor behavior, or Runbook
work.

## One-Sentence Role

JDBC Widget: manage connector metadata and preview bounded mock/safe read-only
SQL validation/execution.

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
- a controlled capability provider for Coordinator Chat

The widget owns database interaction. Coordinator Chat may propose SQL text,
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
- a way for Coordinator Chat to bypass approval

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
  SQL formatter, `EXPLAIN`, AI assistance, credential input, or Coordinator
  capability runtime exists
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
Coordinator context.

Rules:

- passwords and tokens must not enter AI prompts
- connection strings shown in UI must be masked
- future credentials must be backend-only or session-only
- secrets should not be logged
- secrets should not be stored in ordinary widget state
- Coordinator Chat never receives raw credentials
- connector metadata returned to Coordinator must be non-secret or redacted

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
  than a frontend runtime or Coordinator tool
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
jar browsing, raw driver dumps, frontend credential values, Coordinator tools,
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

## SQL Editor Behavior

Current Preview JDBC UI includes:

- connector selector
- SQL editor
- Run
- row limit
- timeout
- result area
- error area

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
- Coordinator may suggest SQL text, but cannot execute it.
- Coordinator provider requests must continue to use `allowed_tools: []`.
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
- SQL textarea/editor
- row limit and timeout controls with conservative defaults
- validation status near the Run action
- explicit `Run read-only query` button
- result table/grid with column headers and compact rows
- duration, returned row count, and truncation notices
- sanitized error panel
- no AI execution, no Coordinator execution, no schema crawler, no production
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
be included in future action proposals only when a later explicit Coordinator
JDBC capability flow exists.

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
query assistance, no AI result sharing, and no Coordinator execution.
Execution remains through the JDBC widget capability and policy.

## Coordinator Capability Model

Future JDBC capabilities for Coordinator Chat:

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

Coordinator can request these capabilities only through the JDBC widget
boundary. It must not bypass connector selection, SQL approval, query limits,
or result-sharing policy.

Current Coordinator relationship for the Current Preview:

- Coordinator JDBC proposals remain non-executing SQL suggestion cards.
- A later bridge may copy a reviewed SQL suggestion into the JDBC widget after
  explicit operator action.
- Coordinator must not run SQL, select connectors silently, inspect connector
  metadata, read query results, or receive database errors as hidden context.
- Provider requests must not include connector metadata, SQL results, schemas,
  credentials, JDBC errors, or result samples unless a later approved
  Evidence/Sources or context-sharing flow exists.

## Action Approval Model

Future Coordinator JDBC actions should be proposed as action cards.

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

Schema introspection should be explicit and capped. Coordinator Chat must not
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
- no hidden Coordinator-triggered SQL execution
- no Terminal launch
- no Git mutation
- no file mutation
- no scheduler
- no production write mode

## Relationship To Coordinator Chat

Current Coordinator Chat can suggest JDBC SQL text only. Future Coordinator
Chat may use JDBC only through explicit widget capabilities after a later
approved capability flow exists.

Coordinator may currently:

- propose read-only SQL
- ask clarifying questions before a query
- suggest safer diagnostics as text

Future approved flows may allow Coordinator to interpret an approved bounded
result or `EXPLAIN` output and create Queue tasks based on findings.

Coordinator must not:

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
   and no Coordinator execution.
2. Current Preview JDBC result UI: completed for connector selector, SQL
   textarea, Run read-only query, validation status, result grid,
   caps/truncation notices, and error panel.
3. Decision follow-up: decide whether to promote the preview path, hide/remove
   it, implement production runtime, or connect Coordinator only through
   explicit approved actions later.
4. Real connector execution adapter after credential/runtime handling is
   explicitly designed.
5. SQL formatter.
6. `EXPLAIN` backend/API with dialect-specific safety rules.
7. `EXPLAIN` UI.
8. AI SQL review contract.
9. Coordinator to JDBC read-only action proposal/copy flow after JDBC
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
- hidden Coordinator-triggered SQL execution
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
- Coordinator runtime
- widget tool execution
- database credentials handling
- secrets storage
- Terminal or PTY work
- Git mutation
- Queue behavior changes
- Agent Executor behavior changes
- Runbook work
