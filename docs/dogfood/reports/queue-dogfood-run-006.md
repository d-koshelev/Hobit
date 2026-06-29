# Queue Dogfood Run 006

## Run Summary

- Date: 2026-06-28
- Branch: `queue-dogfood-continuation`
- Pack path: `docs/dogfood/queue-prompt-packs/hobit-queue-dogfood-next.json`
- Pack id: `hobit-queue-dogfood-next`
- Selected pack task id: `dogfood-foundation-checkpoint`
- Operator context source: not available
- Endpoint kind: not available
- Endpoint attach/launch evidence: default operator attempted app launch with `npm.cmd run tauri:dev --prefix apps/desktop/frontend`
- Used direct database path: false
- Workspace id: not available
- Workspace method: not available
- Workspace root: `C:\Users\Dmitry\Documents\prj\Hobit_queue_logic`
- Real dogfood run performed: no
- Exact blocker: Hobit Desktop exits before the app-owned dogfood endpoint starts because the app profile database is not writable.
- Smallest next unblock block: fix app-owned profile database accessibility for Hobit Desktop startup, then rerun the default operator health, preview, materialize, idempotency, and explicit selected-task launch commands.

## Endpoint Launch Attempt

Command:

```powershell
node scripts/hobit/run-queue-dogfood-operator.mjs --operator-health --json
```

Result:

```text
ERROR: Hobit Desktop launch exited before the dogfood endpoint became available.
Command: npm.cmd run tauri:dev --prefix apps/desktop/frontend
Exit code: 101
Last endpoint error: Hobit app-owned dogfood operator endpoint is not running.
```

Diagnostic launch evidence from the same repo launch command:

```text
Failed to setup app: error encountered during setup hook: Hobit database is not writable:
C:\Users\Dmitry\AppData\Roaming\com.hobit.desktop\hobit.sqlite3.
Operation: open existing database for read/write.
Cause: Access is denied. (os error 5).
```

The operator did not fall back to direct SQLite probing, did not request a
workspace id, and did not request a database path.

## Preview

- `packSpecHash`: not available
- `runSettingsHash`: not available
- `dependencySpecHash`: not available
- `fullPreviewHash`: not available
- Preview state: not run because the app-owned endpoint was unavailable

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
cargo test -p hobit-desktop dogfood                       PASS, 34 passed
cargo test -p hobit-desktop dogfood_operator              PASS, 30 passed
cargo test -p hobit-desktop queue_workflow_headless_smoke PASS, 3 passed
node scripts/hobit/run-queue-smoke-gate.mjs --quick       PASS
node scripts/hobit/run-queue-smoke-gate.mjs --workflow    PASS
node scripts/hobit/run-queue-smoke-gate.mjs --dogfood     PASS
node scripts/hobit/run-queue-dogfood-operator.mjs --help  PASS
node scripts/hobit/run-queue-dogfood-operator.mjs --operator-health --json FAIL, app profile DB access denied
```

## Next

Make the normal Hobit Desktop app profile startup path able to open its app-owned
profile database without requiring a dogfood database path or workspace id.
Then rerun the default dogfood operator sequence through the app-owned endpoint.
