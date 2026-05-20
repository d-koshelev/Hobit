# Hobit Toolbelt

The Hobit Toolbelt is a small repo-local set of deterministic scripts for common
repository inspection and validation tasks.

Codex and other agents should check `scripts/hobit/` before writing one-off
inspection scripts. If a repeated inspection need is missing, propose a reusable
Toolbelt script instead of leaving temporary helper scripts in the repository.

The Toolbelt supports `docs/AGENT_WORK_EFFICIENCY_CONTRACT.md` by making fast
iteration checks, changed-file validation, full acceptance validation, file-size
inspection, and changed-file summaries cheap and repeatable.

## Rules

- Run scripts from the repository root.
- Scripts use predictable exit codes: `0` ok, `1` check failed, `2`
  usage/environment error.
- Scripts avoid external Python dependencies.
- Scripts ignore generated, vendor, and local archive artifacts such as `.git`,
  `target`, `node_modules`, `dist`, `apps/desktop/src-tauri/gen`, and `*.zip`.
- Inspection scripts are read-only. `validate.ps1` and `validate.sh` run
  validation profiles. The `full` profile includes `cargo fmt --all`.

## Scripts

### `validate.ps1`

Windows/PowerShell validation wrapper:

```powershell
scripts/hobit/validate.ps1
scripts/hobit/validate.ps1 -Profile fast
scripts/hobit/validate.ps1 -Profile changed
scripts/hobit/validate.ps1 -Profile full
scripts/hobit/validate.ps1 --help
```

Runs the selected validation profile and prints per-step timings plus a final
timing summary. It stops on the first failure. The default profile is `full`, so
calling `scripts/hobit/validate.ps1` preserves the full validation path.
On Windows machines where `python.exe` is only the Microsoft Store alias, set
`HOBIT_PYTHON` to a real Python executable if auto-detection cannot find one.

### `validate.sh`

Unix/Linux validation wrapper:

```sh
scripts/hobit/validate.sh
scripts/hobit/validate.sh --profile fast
scripts/hobit/validate.sh --profile changed
scripts/hobit/validate.sh --profile full
scripts/hobit/validate.sh --help
```

Uses `npm` instead of `npm.cmd` and supports the same profiles as the
PowerShell wrapper.

## Validation Profiles

### `fast`

Quick local iteration check. Target runtime is approximately one minute when
caches are warm.

Runs:

- frontend typecheck
- `cargo check --workspace`
- changed-only file-size check
- `git diff --check`

Does not run frontend production build, Rust tests, `cargo fmt --all`, or a full
file-size scan. Use this while iterating, not as final acceptance for a block.

### `changed`

Git-changed-file based validation for focused edits.

Behavior:

- frontend changes run typecheck
- frontend source/config changes also run production build
- Rust changes run `cargo check --workspace`
- a single inferred Rust package runs `cargo test -p <package>`
- multiple Rust packages, Cargo manifest changes, or `Cargo.lock` changes run
  `cargo test --workspace`
- docs/scripts-only changes run the relevant Toolbelt checks without Rust tests
- always runs changed-only file-size check and `git diff --check`

### `full`

Commit/high-risk validation profile and the default when no profile is passed.

Runs:

- frontend typecheck
- frontend production build
- `cargo fmt --all`
- `cargo check --workspace`
- `cargo test --workspace`
- full file-size check
- `git diff --check`
- `git status --short --branch`

Codex and other agents should use `fast` during iteration, `changed` after
focused edits, and `full` before commits unless a prompt explicitly says
otherwise. The `fast` profile is not final acceptance.

Avoid duplicating the full profile with repeated individual npm/cargo commands
when `full` already covers them, unless a prompt explicitly asks for the
duplicates or a failure needs focused diagnosis.

### `check-file-sizes.py`

Checks source file line counts against Hobit code organization thresholds:

```sh
python scripts/hobit/check-file-sizes.py
python scripts/hobit/check-file-sizes.py --changed-only
python scripts/hobit/check-file-sizes.py --fail-on-warning
python scripts/hobit/check-file-sizes.py --json
```

Use this before adding to existing large files. It has explicit facade limits for
`crates/hobit-storage-sqlite/src/store.rs` and
`crates/hobit-app/src/workspace_service.rs`.

### `module-map.py`

Prints a compact directory/module map with line counts:

```sh
python scripts/hobit/module-map.py
python scripts/hobit/module-map.py --path crates/hobit-app/src --max-depth 3
python scripts/hobit/module-map.py --path crates/hobit-storage-sqlite/src --json
```

Use this to understand module shape before moving or adding code.

### `changed-files-summary.py`

Summarizes changed files by repository area and suggests validation:

```sh
python scripts/hobit/changed-files-summary.py
python scripts/hobit/changed-files-summary.py --json
```

Use this before final validation and in final-report preparation.

### `desktop-smoke-readiness.ps1`

Prepares the `HOBIT_DATABASE_PATH` workflow for manual Tauri desktop smoke
runs in constrained environments:

```powershell
scripts/hobit/desktop-smoke-readiness.ps1
scripts/hobit/desktop-smoke-readiness.ps1 -Reset
scripts/hobit/desktop-smoke-readiness.ps1 -Launch
scripts/hobit/desktop-smoke-readiness.ps1 -DatabasePath target/hobit-smoke/desktop/custom.sqlite3
```

If the local PowerShell execution policy blocks direct `.ps1` invocation, use
`powershell -NoProfile -ExecutionPolicy Bypass -File scripts/hobit/desktop-smoke-readiness.ps1 -Reset`
for the same helper call.

By default, it uses
`target/hobit-smoke/desktop/hobit-desktop-smoke.sqlite3`, creates and checks the
parent directory, and prints the exact `HOBIT_DATABASE_PATH` and
`npm.cmd run tauri:dev --prefix apps/desktop/frontend` commands. `-Launch`
runs that command with the environment variable set. `-Reset` deletes the
selected smoke database files only when they are under `target/hobit-smoke`.
`-Launch` is expected to remain active while the desktop app is open; a launch
marker or running command is not a real desktop UI smoke pass.

This helper verifies database path readiness and launch-command readiness only.
It does not automate WebView interaction, create Queue tasks, run Agent
Executors, mutate Git, or claim a full real desktop smoke pass.

### `DESKTOP_SMOKE_CHECKLIST.md`

Manual checklist for real Tauri desktop smoke runs using the
`desktop-smoke-readiness.ps1` `HOBIT_DATABASE_PATH` workflow. It covers
Workspace basics, Queue-to-Executor, Git, Notes, Database / JDBC, Coordinator
Chat, Terminal, and Runbook. It must be filled from actual desktop UI
observation; app launch readiness and mocked smoke results are not a real
desktop UI pass.

### `smoke-queue-executor-ui.mjs`

Runs the mocked frontend Queue-to-Agent Executor UI smoke:

```powershell
node scripts/hobit/smoke-queue-executor-ui.mjs
node scripts/hobit/smoke-queue-executor-ui.mjs --scenario event-final
node scripts/hobit/smoke-queue-executor-ui.mjs --scenario reconciliation-final
```

The script starts the Vite frontend, opens the committed smoke page in a local
Chrome/Edge browser through Chrome DevTools Protocol, and uses mocked frontend
actions only. It does not call Tauri commands, start Codex, use SQLite, launch a
Terminal widget, or mutate Git.

### `fake-coordinator-provider.mjs`

Runs a deterministic local HTTP provider for the configured Coordinator
`hobit-http-json` provider contract:

```powershell
node scripts/hobit/fake-coordinator-provider.mjs
node scripts/hobit/fake-coordinator-provider.mjs --scenario queue-draft
node scripts/hobit/fake-coordinator-provider.mjs --port 8765 --delay-ms 2500
```

The helper serves `POST /coordinator-provider` and supports deterministic
scenarios: `text`, `queue-draft`, `note-draft`, `jdbc-draft`,
`provider-error`, `invalid-json`, `timeout`, and `oversized-response`. It checks
that provider requests keep `allowed_tools: []` and do not include known hidden
context keys. It is a local smoke provider only, not a production LLM provider,
and it does not require real credentials.

To route the desktop Coordinator provider path to the helper manually:

```powershell
$env:HOBIT_COORDINATOR_PROVIDER="external"
$env:HOBIT_COORDINATOR_PROVIDER_KIND="hobit-http-json"
$env:HOBIT_COORDINATOR_PROVIDER_ENDPOINT="http://127.0.0.1:8765/coordinator-provider?scenario=queue-draft"
$env:HOBIT_COORDINATOR_PROVIDER_API_KEY="local-smoke-placeholder"
$env:HOBIT_COORDINATOR_PROVIDER_TIMEOUT_MS="5000"
```

Credentials are still backend-only configuration; do not use real provider
credentials with this fake local helper.

### `smoke-coordinator-provider.mjs`

Runs the configured Coordinator provider product smoke against the local fake
HTTP provider:

```powershell
node scripts/hobit/smoke-coordinator-provider.mjs
node scripts/hobit/smoke-coordinator-provider.mjs --scenario jdbc-draft
```

The smoke starts the fake provider, configures the real desktop backend
`hobit-http-json` path through environment variables, and runs the focused
backend command smoke test. It verifies text responses, safe proposal drafts,
provider errors, invalid JSON, timeout, and oversized response behavior. Drafts
are validated by the existing backend pipeline before they can become
Coordinator review cards; no actions are executed.
