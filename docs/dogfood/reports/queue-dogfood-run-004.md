# Queue Dogfood Run 004

## Run Summary

- Date: 2026-06-28
- Branch: `queue-dogfood-continuation`
- Pack path: `docs/dogfood/queue-prompt-packs/hobit-queue-dogfood-next.json`
- Default operator path requires `--database`: no
- Default operator path requires `--workspace-id`: no
- Direct DB probing canonical: no
- Direct DB mode retained: diagnostic/dev-only explicit override
- App/backend operator entry point: implemented as the Rust desktop helper using headless app/backend context resolution
- Real dogfood run performed: no
- Exact blocker: `Hobit app/backend operator endpoint is unavailable. Hobit database is not writable: C:\Users\Dmitry\AppData\Roaming\com.hobit.desktop\hobit.sqlite3. Parent directory: C:\Users\Dmitry\AppData\Roaming\com.hobit.desktop. Operation: open existing database for read/write. Cause: Access is denied. (os error 5).`
- Smallest next block: Start/attach app-owned dogfood operator endpoint in a runtime/session that can access the Hobit app profile.

## Real Run Attempt

Command:

```powershell
node scripts/hobit/run-queue-dogfood-operator.mjs --pack docs/dogfood/queue-prompt-packs/hobit-queue-dogfood-next.json --preview --json
```

Result:

```text
ERROR: Hobit app/backend operator endpoint is unavailable. Hobit database is not writable: C:\Users\Dmitry\AppData\Roaming\com.hobit.desktop\hobit.sqlite3. Parent directory: C:\Users\Dmitry\AppData\Roaming\com.hobit.desktop. Operation: open existing database for read/write. Cause: Access is denied. (os error 5). Likely cause: the database file or parent directory is read-only or inaccessible. Remediation: check file permissions, or set HOBIT_DATABASE_PATH to a writable SQLite file path for development.
```

Preview did not produce JSON because the app/backend context could not open the app profile database. Materialize and selected-task start were not run. No direct DB fallback was used.

## Evidence

- `packSpecHash`: not available
- selected Queue task id: not available
- `runLinkId`: not available
- completion status: not available
- real `codex.cmd` invoked: no
- `widget_runs` created: no
- scheduler/autodispatch used: no
- frontend materializer canonical: no
- frontend Queue lifecycle canonical: no

## Validation

```text
cargo fmt --all                                           PASS
cargo test -p hobit-desktop prompt_pack                   PASS, 31 passed
cargo test -p hobit-desktop selected_task                 PASS, 9 passed
cargo test -p hobit-desktop queue_local                   PASS, 10 passed
cargo test -p hobit-desktop dogfood                       PASS, 19 passed
cargo test -p hobit-desktop dogfood_operator              PASS, 15 passed
cargo test -p hobit-desktop queue_workflow_headless_smoke PASS, 3 passed
node scripts/hobit/run-queue-smoke-gate.mjs --quick       PASS
node scripts/hobit/run-queue-smoke-gate.mjs --workflow    PASS
node scripts/hobit/run-queue-smoke-gate.mjs --dogfood     PASS
node scripts/hobit/run-queue-dogfood-operator.mjs --help  PASS
```

## Boundary Checks

- Node as DB client: no
- Raw DB writes as operator implementation: no
- Direct SQLite inspection as canonical API: no
- Fallback dogfood SQLite DB counted as real dogfood: no
- Human workspace id required: no
- `HOBIT_DOGFOOD_WORKSPACE_ID` required: no
- `HOBIT_DOGFOOD_DATABASE` required: no
- App DB ACL/chmod/process killing: no
- Manual prompt copy into ChatGPT or Workspace Agent: no
- Manual Workspace Agent smoke as regression path: no
- Automated real `codex.cmd`: no
- Agent Executor / Agent Queue widget identity canonical: no
- Frontend-owned prompt-pack materialization: no
- Frontend-owned lifecycle logic: no
