# Queue Dogfood Run 005

## Run Summary

- Date: 2026-06-28
- Branch: `queue-dogfood-continuation`
- Pack path: `docs/dogfood/queue-prompt-packs/hobit-queue-dogfood-next.json`
- Pack id: not available
- Selected pack task id: `dogfood-foundation-checkpoint`
- Operator context source: not available
- Endpoint kind: not available
- Used direct database path: false
- Workspace id: not available
- Workspace method: not available
- Real dogfood run performed: no
- Exact blocker: `running Hobit app-owned dogfood operator endpoint is unavailable.`
- Observed command error: `Hobit app-owned dogfood operator endpoint is not running.`
- Smallest next unblock block: `start/launch Hobit Desktop with dogfood operator endpoint enabled`

## Endpoint Check

Command:

```powershell
node scripts/hobit/run-queue-dogfood-operator.mjs --operator-health --json
```

Result:

```text
ERROR: Hobit app-owned dogfood operator endpoint is not running.
```

The default Node dogfood operator did not fall back to direct SQLite probing.
Preview, materialization, idempotency, and selected-task start were not run
because the running app-owned endpoint was unavailable.

## Preview

- `packSpecHash`: not available
- `runSettingsHash`: not available
- `dependencySpecHash`: not available
- `fullPreviewHash`: not available
- Preview state: not run

## Materialization

- First materialization status: not run
- Repeated materialization/idempotency status: not run
- Generated Queue task ids: not available

## Selected Task

- selected pack task id: `dogfood-foundation-checkpoint`
- selected Queue task id: not available
- `runLinkId`: not available
- launch status: not launched
- completion status: not available
- completion bridge terminalized run: no
- dependent task became eligible: not verified
- dependent task auto-started: no

## Boundary Checks

- frontend materializer canonical: no
- frontend lifecycle state: no
- `widget_runs`: no
- Agent Executor / Agent Queue widget identity: no
- scheduler/autodispatch: no
- automated tests launched real `codex.cmd`: no
- real `codex.cmd` invoked only by explicit selected-task launch: no
- direct DB fallback used: no
- fallback dogfood SQLite DB counted as real dogfood: no

## Tests And Gates

```text
cargo fmt --all                                           PASS
cargo test -p hobit-desktop prompt_pack                   PASS, 31 passed
cargo test -p hobit-desktop selected_task                 PASS, 9 passed
cargo test -p hobit-desktop queue_local                   PASS, 10 passed
cargo test -p hobit-desktop dogfood                       PASS, 29 passed
cargo test -p hobit-desktop dogfood_operator              PASS, 25 passed
cargo test -p hobit-desktop queue_workflow_headless_smoke PASS, 3 passed
node scripts/hobit/run-queue-smoke-gate.mjs --quick       PASS
node scripts/hobit/run-queue-smoke-gate.mjs --workflow    PASS
node scripts/hobit/run-queue-smoke-gate.mjs --dogfood     PASS
node scripts/hobit/run-queue-dogfood-operator.mjs --help  PASS
```

## Next

Start or launch Hobit Desktop with the dogfood operator endpoint enabled, open
the intended Workspace in the app, then rerun the default health, preview,
materialize, idempotency, and explicit selected-task launch commands.
