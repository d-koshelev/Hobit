# Queue Dogfood Run 010

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
- Retry launched in 70P: no
- Retry succeeded: no

## Provider Readiness Evidence

Command used:

```powershell
node scripts/hobit/run-queue-dogfood-operator.mjs --provider-readiness codex --json
```

- Operator context source: `running_app_endpoint`
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
raw API key, token, auth header, session content, credential file content, or
credential value was printed or persisted in this report.

## Auth Context Diagnostics

Command used:

```powershell
node scripts/hobit/run-queue-dogfood-operator.mjs --provider-auth-context codex --json
```

- Status: `aligned`
- Auth source classification: `auth_source_invalid`
- Mismatch reasons: `codex_doctor_unauthorized`
- Profile mode: `dogfood`
- Used direct database path: false
- Context summaries:
  - `operator_process`: `OPENAI_API_KEY=present`; `OPENAI_BASE_URL`, `OPENAI_ORG_ID`, `OPENAI_ORGANIZATION`, `OPENAI_PROJECT`, and `CODEX_HOME` absent
  - `app_process`: `OPENAI_API_KEY=present`; `OPENAI_BASE_URL`, `OPENAI_ORG_ID`, `OPENAI_ORGANIZATION`, `OPENAI_PROJECT`, and `CODEX_HOME` absent
  - `worker_launch_context`: `OPENAI_API_KEY=present`; `OPENAI_BASE_URL`, `OPENAI_ORG_ID`, `OPENAI_ORGANIZATION`, `OPENAI_PROJECT`, and `CODEX_HOME` absent
  - `codex_doctor_context`: `OPENAI_API_KEY=present`; `OPENAI_BASE_URL`, `OPENAI_ORG_ID`, `OPENAI_ORGANIZATION`, `OPENAI_PROJECT`, and `CODEX_HOME` absent; `authStatus=unauthorized`
- Raw credentials inspected or logged: no

Diagnosis: this is not an operator-to-app propagation bug, not an
app-to-worker propagation bug, and not a dogfood profile hiding the auth
source. The app-owned contexts are aligned, but Codex doctor/readiness reports
the source as unauthorized.

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
- `auth_source_invalid`
- `provider_readiness_blocked`

70N captured transient retry evidence that real `codex.cmd` exited with code 1
after OpenAI API authentication failed with `401 Unauthorized`. 70O and 70P now
block a new retry before run-link creation while readiness remains unauthorized.

## Fix Applied

- Added app/backend-owned Codex auth-context diagnostics for `queue_local`.
- Exposed diagnostics through the local app-owned dogfood endpoint at
  `/provider_auth_context`.
- Added the Node operator command `--provider-auth-context codex --json`.
- Added secret-safe env presence summaries for operator, app, worker-launch,
  and Codex doctor contexts.
- Added focused tests for redaction and context mismatch classification.

No auth repair was applied because the aligned contexts show the auth source is
present but unauthorized. Queue is not the failing layer for this state.

Broader changes avoided:

- No provider management UI.
- No raw secret persistence.
- No scheduler/autodispatch.
- No dependent task auto-start.
- No prompt pack spec mutation.
- No direct SQLite fallback.

## Retry Evidence

No retry was launched in 70P because provider readiness returned `blocked` with
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
- real codex.cmd invoked in 70P: yes, explicit readiness/auth diagnostics only; no worker retry
- secrets logged: no
- raw credential values persisted: no

## Tests And Gates

- `cargo fmt --all`: pass
- `cargo test -p hobit-desktop prompt_pack`: pass
- `cargo test -p hobit-desktop selected_task`: pass
- `cargo test -p hobit-desktop queue_local`: pass
- `cargo test -p hobit-desktop dogfood`: pass
- `cargo test -p hobit-desktop dogfood_operator`: pass
- `cargo test -p hobit-desktop queue_workflow_headless_smoke`: pass
- `cargo test -p hobit-app queue_local_provider_readiness`: pass
- `node scripts/hobit/run-queue-smoke-gate.mjs --dogfood`: pass
- `node scripts/hobit/run-queue-smoke-gate.mjs --quick`: pass
- `node scripts/hobit/run-queue-smoke-gate.mjs --workflow`: pass
- `node scripts/hobit/run-queue-dogfood-operator.mjs --help`: pass
- `node scripts/hobit/run-queue-dogfood-operator.mjs --operator-health --json`: pass
- `node scripts/hobit/run-queue-dogfood-operator.mjs --provider-readiness codex --json`: pass; readiness status `blocked`, authStatus `unauthorized`
- `node scripts/hobit/run-queue-dogfood-operator.mjs --provider-auth-context codex --json`: pass; status `aligned`, classification `auth_source_invalid`

Validation emitted the existing Cargo warning `could not canonicalize path
C:\Users\Dmitry`; all requested commands exited successfully.

## Blockers

- Current blocker: Codex provider auth source is present but unauthorized.
- Smallest next action: configure/repair Codex CLI auth source outside Queue,
  then rerun:

```powershell
node scripts/hobit/run-queue-dogfood-operator.mjs --provider-readiness codex --json
```

Do not retry `dogfood-foundation-checkpoint` until readiness returns `ready`.

## Next Recommended Queue Task

Keep current task as `dogfood-foundation-checkpoint`. Do not advance to
`dogfood-file-import-hardening` until provider readiness passes, the explicit
retry launches, and the completion bridge terminalizes success.
