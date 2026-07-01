# Queue Dogfood Operator Loop

Canonical pack:

`docs/dogfood/queue-prompt-packs/hobit-queue-dogfood-next.json`

## Intended Lifecycle

1. Preview the pack through the backend prompt-pack preview API.
2. Materialize the pack through the backend prompt-pack materialization API.
3. Start one selected task manually by generated Queue task id.
4. The worker runs through the `queue_local` Direct Work bridge.
5. The completion bridge terminalizes the Queue-owned run link.
6. Start the next task manually only after dependencies are satisfied.

## Thin Operator Adapter

The supported non-test operator path is:

```powershell
node scripts/hobit/run-queue-dogfood-operator.mjs --operator-health --json
node scripts/hobit/run-queue-dogfood-operator.mjs --provider-readiness codex --json
node scripts/hobit/run-queue-dogfood-operator.mjs --provider-auth-context codex --json
node scripts/hobit/run-queue-dogfood-operator.mjs --run-detail --run-link-id queue_run_link_1782673319681359700_4 --json
node scripts/hobit/run-queue-dogfood-operator.mjs --pack docs/dogfood/queue-prompt-packs/hobit-queue-dogfood-next.json --preview --json
node scripts/hobit/run-queue-dogfood-operator.mjs --pack docs/dogfood/queue-prompt-packs/hobit-queue-dogfood-next.json --materialize --json
node scripts/hobit/run-queue-dogfood-operator.mjs --pack docs/dogfood/queue-prompt-packs/hobit-queue-dogfood-next.json --materialize --start-pack-task dogfood-foundation-checkpoint --allow-real-worker --json --report docs/dogfood/reports/queue-dogfood-run-007.md
node scripts/hobit/run-queue-dogfood-operator.mjs --pack docs/dogfood/queue-prompt-packs/hobit-queue-dogfood-next.json --retry-pack-task dogfood-foundation-checkpoint --allow-real-worker --json --report docs/dogfood/reports/queue-dogfood-run-009.md
```

The default path is app/backend-owned. The Node script first attaches to a
local loopback JSON endpoint exposed by a running Hobit Desktop process. If the
endpoint is missing, stale, or unreachable, it launches Hobit Desktop through
the supported repo dev command:

```powershell
npm.cmd run tauri:dev --prefix apps/desktop/frontend
```

The operator then waits for the app-owned rendezvous file and endpoint health.
For dogfood launches, the operator sets:

- `HOBIT_DOGFOOD_OPERATOR_ENDPOINT=1`
- `HOBIT_DOGFOOD_PROFILE=1`
- `HOBIT_DOGFOOD_PROFILE_DIR=<repo>/.hobit/dogfood-profile`
- `HOBIT_DOGFOOD_WORKSPACE_ROOT=<repo>`

The dogfood profile directory is persistent, ignored by Git, outside Cargo
`target`, and opened by Hobit app/backend startup. It is not a Node database
fallback and it does not repair, chmod, or overwrite the normal app profile
database. In unrestricted desktop environments, the app profile selector can
also use a per-user local app data dogfood profile directory; the repo-local
profile dir is used by the dogfood launcher so restricted dev environments can
start the app-owned endpoint without touching the normal profile.

The running app writes the rendezvous file in the selected app-owned profile
data directory with the loopback port, process id, endpoint kind, creation
time, and auth token. The endpoint binds only to `127.0.0.1`, requires the
token, and exposes only the dogfood operator operations.

The endpoint uses app/backend Workspace context. When the app starts without a
current Workspace, the Node operator sends the current repo root to the
endpoint's `ensure_workspace_for_root` operation. The endpoint canonicalizes
that root, asks `WorkspaceService` to create or reuse the dogfood Workspace
binding, opens that Workspace through backend APIs, and returns the Workspace
id and resolution method. This does not require a human Workspace id and does
not select among database rows by title, order, prose, or path similarity.

The default path does not require:

- `--database`
- `--workspace-id`
- `HOBIT_DOGFOOD_DATABASE`
- `HOBIT_DOGFOOD_WORKSPACE_ID`
- direct SQLite probing as the operator contract

`--operator-health --json` checks the running endpoint and returns
`operatorContext.contextSource=running_app_endpoint` or
`launched_app_endpoint`, endpoint metadata, launch evidence, `profileMode`,
workspace id, workspace root, workspace resolution method, and
`usedDirectDatabasePath=false`.

`--no-launch-app` disables auto-launch and fails if no endpoint is reachable.
`--launch-app-if-needed` is accepted as an explicit spelling of the default
auto-launch behavior.

`--run-detail` is a read-only app-owned status/detail query. Use it with
`--run-link-id <id>` or `--queue-task-id <id>` to inspect the selected-task run
link status, Queue task status, completion terminalization, retryability, and
dependent-task eligibility evidence. It does not start workers, create run
links, create `widget_runs`, or mutate Queue state.

`--provider-readiness codex` checks the app/backend-owned `queue_local` Codex
execution target before a real selected-task start or retry. The readiness
output reports executable presence/version, auth status, env-var names with
present/absent state, blockers, and warnings. It must not print raw API keys,
tokens, auth headers, credential file contents, or secret values. Real
`--start-pack-task` and `--retry-pack-task` launches are gated by this check; a
blocked or unauthorized provider returns `provider_readiness_blocked` without
creating a run link or launching `codex.cmd`. Unknown readiness is blocked by
default unless the diagnostic-only `--allow-unknown-provider-readiness` flag is
passed with an explicit selected-task start/retry.

`--provider-auth-context codex` compares the operator process, app process,
worker launch context, and Codex doctor/readiness context. It reports only
environment variable names and present/absent booleans, plus a bounded
classification such as `auth_source_invalid`, `auth_source_absent`,
`auth_env_not_propagated_to_app`, or
`auth_env_not_propagated_to_worker`. It must not print raw API keys, tokens,
auth headers, credential file contents, credential file paths, or
secret-bearing environment values. If auth is absent or invalid while the
contexts are aligned, Queue is not the failing layer; repair the Codex CLI
auth source outside Queue, then rerun provider readiness.

`--retry-pack-task <packTaskId>` is the explicit retry path for a terminal
failed selected queue_local task. It must be paired with `--allow-real-worker`
for a real retry. Retry preserves previous failed run links, creates a new
backend-owned run link, reuses the materialized pack mapping, rejects
successful/completed and active/running tasks, and does not auto-start
dependent tasks.

`--direct-database-diagnostic --database <sqlite>` is a diagnostic/dev-only
override. `--workspace-id`, `--workspace-root`, `--list-workspaces`, and
`--resolve-workspace` are accepted only in that explicit diagnostic mode. They
are not the canonical dogfood operator API and must not be used to claim a real
dogfood run when the app-owned endpoint is unavailable.

The adapter reuses the backend-owned file preview, backend-owned file
materialization, and selected-task `queue_local` start services. It does not
parse Prompt Pack semantics, write Queue state directly, infer task ids, launch
workers without `--allow-real-worker`, use the frontend materializer, use
frontend-owned lifecycle state, create `widget_runs`, or use Agent Executor /
Agent Queue widget identity as canonical execution identity.

The final command is the real worker command. Do not run it from automated
tests. Use it only for an explicit operator dogfood run and capture the JSON
output for the evidence report.

## Boundaries

- No scheduler or autodispatch.
- No frontend-owned lifecycle state machine.
- No `widget_runs` identity for Queue dogfood execution.
- No Agent Executor widget or Agent Queue widget as canonical identity.
- No real `codex.cmd` in automated tests.
- No changes to `apps/desktop/src-tauri/Cargo.toml`.
- No fallback dogfood SQLite database counts as real dogfood.
- No direct DB path workflow is canonical.

## Evidence Checklist

- `packSpecHash`
- materialization status
- generated `queueTaskIds`
- selected `queueTaskId`
- `runLinkId`
- completion status
- tests and gates run
- blockers

This document defines the operator loop. It does not claim that a real manual
dogfood run has occurred.

## Current Operator Status

BLOCK 75A records the current milestone in
`docs/dogfood/reports/queue-dogfood-milestone-001.md`. The Hobit-side
coordinator loop is stable through dependency acceptance/finalization, but
dogfood continuation is currently blocked by an external Codex provider issue:
`system_schannel_acquire_credentials_failure`. Do not continue TLS diagnostics
inside Hobit or bypass provider readiness. Resume only after
`codex.cmd doctor --json` is healthy and
`node scripts/hobit/run-queue-dogfood-operator.mjs --provider-readiness codex --json`
returns `status=ready`, using:

```powershell
node scripts/hobit/run-queue-dogfood-operator.mjs --resume-dogfood --allow-real-worker --json --report docs/dogfood/reports/queue-dogfood-run-016.md
```

`docs/dogfood/reports/queue-dogfood-run-001.md` records the first 70F
attempt. It was blocked before a real worker launch because the backend/Tauri
commands were registered but no supported non-test operator adapter or UI path
invoked the file preview, file materialize, and selected-task `queue_local`
start commands together.

BLOCK 70G adds a thin operator adapter for that path. BLOCK 70H uses it for
the first real selected-task dogfood run attempt and records the result in
`docs/dogfood/reports/queue-dogfood-run-002.md`. If workspace selection is
ambiguous, the report records the blocker instead of claiming a real run.

BLOCK 70I added workspace auto-resolution, but the operator still exposed a
DB-path contract. `docs/dogfood/reports/queue-dogfood-run-003.md` records that
blocked attempt.

BLOCK 70J replaces the default DB-path workflow with an app/backend-owned
headless operator entry point. It records the next real-run attempt in
`docs/dogfood/reports/queue-dogfood-run-004.md`.

BLOCK 70K replaces the headless default with a running app-owned local endpoint
inside Hobit Desktop. It records the next real-run attempt in
`docs/dogfood/reports/queue-dogfood-run-005.md`.

BLOCK 70L adds self-service attach-or-launch behavior and endpoint workspace
ensure/open from the operator repo root. It records the next real-run attempt
in `docs/dogfood/reports/queue-dogfood-run-006.md`. That attempt was blocked
before preview because Hobit Desktop could not open its app-owned profile
database for read/write, so the app-owned endpoint never started.

BLOCK 70M adds app-owned dogfood profile launch mode. The Node operator now
launches Hobit Desktop with dogfood endpoint mode, dogfood profile mode, a
persistent repo-local dogfood profile directory, and an explicit repo workspace
root. `docs/dogfood/reports/queue-dogfood-run-007.md` records the first real
run through that path: endpoint health succeeded with `profileMode=dogfood`,
preview succeeded, materialization created and then idempotently reused the
pack tasks, the selected `dogfood-foundation-checkpoint` Queue task launched a
real `queue_local` worker only through `--allow-real-worker`, and a run link was
captured. The completion bridge terminalized the selected run as failed, no
dependent task auto-started, and the next block is to inspect and rerun the
failed foundation checkpoint rather than advance to `dogfood-file-import-hardening`.

BLOCK 70N adds read-only run detail and explicit failed-task retry. It records
the inspection and retry in `docs/dogfood/reports/queue-dogfood-run-008.md`.
The previous failed run was retryable, but historical stdout/stderr had not
been persisted before run-detail capture. The retry launched a real queue_local
worker only through `--allow-real-worker`, preserved the previous failed run
link, created a new run link, and terminalized as failed because Codex could
not authenticate to OpenAI (`401 Unauthorized`). The dependent
`dogfood-file-import-hardening` task stayed blocked and did not auto-start.

BLOCK 70O adds the app/backend-owned Codex provider readiness gate for
`queue_local`. It records provider readiness and the blocked retry decision in
`docs/dogfood/reports/queue-dogfood-run-009.md`. The selected foundation task
remains current until provider auth is repaired and the retry succeeds.

BLOCK 70P adds the app-owned provider auth-context diagnostic and records the
diagnosis in `docs/dogfood/reports/queue-dogfood-run-010.md`. The operator,
app, worker-launch, and Codex doctor contexts were aligned and saw only
non-secret auth-source presence, but provider readiness remained blocked with
`authStatus=unauthorized`. No retry was launched, no new run link was created,
and `dogfood-foundation-checkpoint` remains the current task until Codex CLI
auth is repaired outside Queue and readiness returns `ready`.

BLOCK 70Q is a conditional resume checkpoint recorded in
`docs/dogfood/reports/queue-dogfood-run-011.md`. The operator must check
`--provider-readiness codex --json` before retrying
`dogfood-foundation-checkpoint`. If readiness is blocked or unknown, no
selected-task retry is launched, no run link is created, and the next action
remains repairing Codex CLI auth outside Queue before rerunning readiness.

Headless tests use fake workers. A real dogfood run must use an explicit
selected Queue task start through the backend-owned `queue_local` bridge.
