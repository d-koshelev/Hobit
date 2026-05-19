# JDBC Widget Contract

## Purpose

This contract defines the future Database / JDBC widget product model and
safety boundary.

The JDBC widget is a controlled database work surface and database proxy for
Coordinator Chat. It lets the operator and Coordinator work with databases
through explicit connector and SQL capabilities while keeping secrets,
permissions, execution, and AI-context sharing controlled.

This document is the controlling contract for JDBC work. The current
implementation foundation is intentionally limited to workspace-local connector
metadata storage/API and a Preview frontend connector metadata shell. It does
not implement a Java sidecar, JDBC execution, SQL formatting, `EXPLAIN`
visualization, AI provider integration, Coordinator runtime, widget tool
execution, database credential handling, secret storage, Terminal or PTY
behavior, Git mutation, Queue behavior, Agent Executor behavior, or Runbook
work.

## One-Sentence Role

JDBC Widget: run and review approved SQL through configured database
connectors.

## What The JDBC Widget Is

The JDBC widget is:

- a database connector list
- a selected connector workspace
- a SQL editor surface
- a read-only query runner by default
- a result grid
- an `EXPLAIN` runner
- a future `EXPLAIN` visualization surface
- a future AI SQL explanation and optimization surface
- a controlled capability provider for Coordinator Chat

The widget owns database interaction. Coordinator Chat may propose database
actions, but execution must go through this widget's connector, SQL, approval,
limit, and result-sharing policy.

## What The JDBC Widget Is Not In The First Version

The first JDBC widget version is not:

- a hidden database agent
- automatic database crawling
- write SQL execution
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

The first implementation does not need to support all database kinds. Each
supported kind must define its connection, read-only detection, query limits,
and `EXPLAIN` behavior before execution is implemented.

Current foundation status:

- workspace-local connector metadata create/list/read/update APIs exist
- a Preview Database / JDBC widget can create, list, select, and update
  connector metadata
- stored metadata includes only masked/non-secret connector descriptors
- passwords, tokens, secret references, driver jars, and runtime credentials are
  not stored
- no query execution, test connection, Java sidecar, SQL formatter, `EXPLAIN`,
  AI assistance, credential input, or Coordinator capability runtime exists

## Secrets Policy

Secrets must remain outside normal widget state, logs, AI prompts, and
Coordinator context.

Rules:

- passwords and tokens must not enter AI prompts
- connection strings shown in UI must be masked
- credentials are backend-only or session-only
- secrets should not be logged
- secrets should not be stored in ordinary widget state
- first implementation may use session-only credentials if persistent secret
  storage is not ready
- Coordinator Chat never receives raw credentials
- connector metadata returned to Coordinator must be non-secret or redacted

Persistent secret storage requires a separate contract before implementation.

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

This runtime is not implemented yet and must remain contract-gated before
coding.

## SQL Editor Behavior

Future JDBC UI should include:

- connector selector
- SQL editor
- Format SQL
- Run
- Explain
- row limit
- timeout
- result area
- error area
- AI review actions later

The MVP editor may start as a textarea. Monaco or CodeMirror is optional later
and must not be required for the first safe slice.

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

The first practical slice should allow only safe query forms such as:

- `SELECT`
- `WITH`
- `SHOW`
- `DESCRIBE`
- `EXPLAIN`

The first slice should reject or block SQL forms such as:

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

Limit values should be visible to the operator before execution and included
in action proposals when Coordinator Chat requests a JDBC capability.

## EXPLAIN Behavior

`EXPLAIN` is read-only and should be allowed in the first practical JDBC
slice.

`EXPLAIN` output should be:

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

This contract does not implement `EXPLAIN` visualization.

## Result Grid Behavior

Results should show:

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

## AI SQL Assistance

AI can help with:

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

AI output should be suggestions and explanations. Execution remains through
the JDBC widget capability and policy.

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

## Action Approval Model

Coordinator should propose JDBC actions as action cards.

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
explicit policy, but write SQL is not allowed in the first JDBC slices.

## Context Sharing With AI

By default, AI may receive:

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

The operator or an explicit autonomy policy controls whether a query result,
sample, schema, or `EXPLAIN` output becomes AI context.

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
- no write SQL in the first slice
- no hidden queries
- no secret exposure
- no uncapped result streaming
- no automatic AI execution
- no Terminal launch
- no Git mutation
- no file mutation
- no scheduler
- no production write mode

## Relationship To Coordinator Chat

Coordinator Chat can use JDBC only through widget capabilities.

Coordinator may:

- propose read-only SQL
- ask clarifying questions before a query
- interpret an approved result or `EXPLAIN` output
- suggest safer diagnostics
- create Queue tasks based on findings

Coordinator must not:

- choose a connector silently
- run SQL without approval or policy
- receive raw credentials
- bypass JDBC widget limits
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

1. JDBC read-only query execution backend.
2. JDBC result grid UI.
3. SQL formatter.
4. `EXPLAIN` backend/API.
5. `EXPLAIN` UI.
6. AI SQL review contract.
7. Coordinator to JDBC read-only action proposal flow.
8. JDBC result and `EXPLAIN` evidence capture after the Evidence/Sources
   foundation exists.

Each slice must remain narrow and preserve the read-only, approval-aware,
secret-isolated boundary.

## Non-Goals For First Implementation

The first implementation should not add:

- write SQL
- persistent secret storage unless separately designed
- schema crawler
- dashboard builder
- scheduled queries
- automatic AI-run queries
- production mutation
- Terminal execution
- Git mutation

## Non-Goals For This Block

This contract does not implement:

- frontend UI
- backend or Tauri commands
- storage/schema changes
- Java sidecar implementation
- JDBC execution
- SQL formatter implementation
- `EXPLAIN` visualization implementation
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
