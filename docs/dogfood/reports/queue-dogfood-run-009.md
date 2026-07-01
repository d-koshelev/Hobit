# Queue Dogfood Run 009

## Run Summary

- Date: 2026-06-28
- Branch: `queue-dogfood-continuation`
- Pack path: `docs/dogfood/queue-prompt-packs/hobit-queue-dogfood-next.json`
- Pack id: `hobit-queue-dogfood-next`
- Selected pack task: `dogfood-foundation-checkpoint`
- Selected Queue task: `queue_task_prompt_pack_1782673287717627000_5`
- Previous failed run links:
  - `queue_run_link_1782673319681359700_4`
  - `queue_run_link_1782676554256662500_4`
- Retry launched in 70O: no
- Retry succeeded: no

## Provider Readiness Evidence

Command used:

```powershell
node scripts/hobit/run-queue-dogfood-operator.mjs --provider-readiness codex --json
```

- Operator context source: `launched_app_endpoint`
- Endpoint kind: `loopback_http_json`
- Profile mode: `dogfood`
- Used direct database path: false
- Workspace id: `ws_1782673266575011500_1`
- Workspace method: `persisted_dogfood_binding`
- Provider id: `codex`
- Execution target: `queue_local`
- Status: `blocked`
- Codex executable resolved: true
- Codex executable summary: `codex.cmd`
- Codex version: `0.142.3`
- Auth status: `unauthorized`
- Auth source summary: `environment_present`
- Readiness check method: `auth_status_command`
- Blockers: `codex_auth_unauthorized`
- Warnings: none
- Last known provider failure: `codex_auth_unauthorized`
- Secrets logged: no

Environment evidence is limited to variable names and present/absent state. No
raw API key, token, auth header, session content, or credential value was
printed or persisted in this report.

## Current Failure Classification

Run detail command used:

```powershell
node scripts/hobit/run-queue-dogfood-operator.mjs --run-detail --run-link-id queue_run_link_1782676554256662500_4 --json
```

- Previous retry runLink status: `failed`
- Queue task status: `failed`
- Completion status: `failed`
- Direct Work run id: `queue-run_1782676554256620200_3`
- Review status: `review_needed`
- Failure reason: run link terminalized as failed; historical backend-owned queue_local worker stdout/stderr was not persisted before run-detail capture
- Worker exit code from read-only run detail: unavailable
- Worker stdout/stderr from read-only run detail: unavailable
- Retryability: `retryable_failed_task`
- Completion bridge terminalized run: true
- Dependent task ids: `queue_task_prompt_pack_1782673287717489200_4`
- Dependent eligibility: `blocked_failed_upstream`
- Dependent auto-started: false

Classification:

- `codex_environment_failure`
- `auth_unauthorized`
- `provider_readiness_blocked`

70N captured the transient selected-task worker evidence for this retry: real
`codex.cmd` exited with code 1 after OpenAI API authentication failed with
`401 Unauthorized`. 70O readiness now catches that provider/auth state before a
new selected-task retry can create another run link.

## Fix Applied

- Added app/backend-owned Codex provider readiness for `queue_local`.
- Exposed readiness through the local app-owned dogfood endpoint at
  `/provider_readiness`.
- Added the Node operator command `--provider-readiness codex --json`.
- Gated app-owned selected-task start/retry on provider readiness.
- Blocked provider readiness returns `provider_readiness_blocked` without
  creating a run link or launching a worker.
- Kept preview and materialization unaffected by the readiness gate.
- Added focused fake/headless tests; automated tests do not invoke real
  `codex.cmd`.

Broader changes avoided:

- No provider management UI.
- No auth secret persistence.
- No scheduler/autodispatch.
- No dependent task auto-start.
- No prompt pack spec mutation.
- No direct SQLite fallback.

## Retry Evidence

No retry was launched in 70O because provider readiness returned `blocked` with
`authStatus=unauthorized` and blocker `codex_auth_unauthorized`.

- New runLinkId: not created
- Launch status: `provider_readiness_blocked`
- Completion status: not run
- Terminal Queue task state: remains `failed`
- `dogfood-file-import-hardening` became eligible: no
- `dogfood-file-import-hardening` auto-started: no

## Boundary Checks

- usedDirectDatabasePath: false
- frontend materializer canonical: no
- frontend lifecycle state: no
- widget_runs: no
- Agent Executor / Agent Queue widget identity: no
- scheduler/autodispatch: no
- dependent tasks auto-started: no
- automated tests launched real codex.cmd: no
- real codex.cmd invoked in 70O: no
- secrets logged: no

## Tests And Gates

- `cargo fmt --all`: pass
- `cargo test -p hobit-desktop prompt_pack`: pass
- `cargo test -p hobit-desktop selected_task`: pass
- `cargo test -p hobit-desktop queue_local`: pass
- `cargo test -p hobit-desktop dogfood`: pass
- `cargo test -p hobit-desktop dogfood_operator`: pass
- `cargo test -p hobit-desktop queue_workflow_headless_smoke`: pass
- `cargo test -p hobit-app queue_local_provider_readiness`: pass
- `node scripts/hobit/run-queue-smoke-gate.mjs --quick`: pass
- `node scripts/hobit/run-queue-smoke-gate.mjs --workflow`: pass
- `node scripts/hobit/run-queue-smoke-gate.mjs --dogfood`: pass
- `node scripts/hobit/run-queue-dogfood-operator.mjs --help`: pass
- `node scripts/hobit/run-queue-dogfood-operator.mjs --operator-health --json`: pass
- `node scripts/hobit/run-queue-dogfood-operator.mjs --provider-readiness codex --json`: pass; readiness status `blocked`, authStatus `unauthorized`

## Blockers

- Current blocker: app-owned `queue_local` Codex provider readiness is blocked
  by unauthorized OpenAI auth.
- Smallest next block: Configure/repair app-owned Codex provider auth source.

## Next Recommended Queue Task

Keep current task as `dogfood-foundation-checkpoint`. Do not advance to
`dogfood-file-import-hardening` until provider readiness passes, the explicit
retry launches, and the completion bridge terminalizes success.
