# Queue Dogfood Run 008

## Run Summary

- Date: 2026-06-28
- Branch: `queue-dogfood-continuation`
- Pack path: `docs/dogfood/queue-prompt-packs/hobit-queue-dogfood-next.json`
- Pack id: `hobit-queue-dogfood-next`
- Selected pack task: `dogfood-foundation-checkpoint`
- Selected Queue task: `queue_task_prompt_pack_1782673287717627000_5`
- Previous failed runLinkId: `queue_run_link_1782673319681359700_4`
- Retry runLinkId: `queue_run_link_1782676554256662500_4`
- Reran selected task in this block: yes
- Retry succeeded: no

## Previous Failure Inspection

Command used:

```powershell
node scripts/hobit/run-queue-dogfood-operator.mjs --run-detail --run-link-id queue_run_link_1782673319681359700_4 --json
```

- Operator context source: `launched_app_endpoint`
- Endpoint kind: `loopback_http_json`
- Profile mode: `dogfood`
- Used direct database path: false
- Workspace id: `ws_1782673266575011500_1`
- Workspace method: `persisted_dogfood_binding`
- Previous run link status: `failed`
- Previous Queue task status: `failed`
- Completion status: `failed`
- Completion bridge terminalized run: true
- Direct Work run id: `queue-run_1782673319681312400_3`
- Review status: `review_needed`
- Failure reason: historical backend-owned queue_local worker stdout/stderr was not persisted before run-detail capture
- Worker exit code: unavailable
- Worker stdout/stderr summary: unavailable for the 70M run
- Retryability: `retryable_failed_task`
- Dependent task ids: `queue_task_prompt_pack_1782673287717489200_4`
- Dependent eligibility: `blocked_failed_upstream`
- Dependent auto-started: false

Failure classification:

- Previous run: `status_visibility_missing`
- Retry run: `codex_environment_failure`, because `codex exec --json` exited with code 1 after OpenAI API authentication failed with 401 Unauthorized.

## Fix Applied

- Added read-only app-owned endpoint/operator run detail via `--run-detail` / `--status`.
- Added explicit backend-owned retry for terminal failed selected queue_local tasks only.
- Preserved old failed run links and created a new run link for retry attempts.
- Kept successful/completed and active/running tasks non-retryable.
- Fixed prompt-pack materialization reuse after Queue lifecycle status changes, so rematerializing an already-materialized pack after a task fails reuses the mapped Queue task instead of treating lifecycle status drift as a spec conflict.
- Added transient worker exit/output fields to the selected-task operator response for newly launched runs.

Broader changes avoided:

- No scheduler/autodispatch.
- No Queue reset/rerun semantics for successful tasks.
- No prompt pack spec mutation.
- No widget run persistence.
- No frontend materialization or lifecycle ownership.

## Retry Evidence

Command used:

```powershell
node scripts/hobit/run-queue-dogfood-operator.mjs --pack docs/dogfood/queue-prompt-packs/hobit-queue-dogfood-next.json --retry-pack-task dogfood-foundation-checkpoint --allow-real-worker --json --report docs/dogfood/reports/queue-dogfood-run-008.md
```

- Operator context source: `launched_app_endpoint`
- Endpoint kind: `loopback_http_json`
- Endpoint pid: `19712`
- Profile mode: `dogfood`
- Used direct database path: false
- App launch attempted: true
- App launch command: `npm.cmd run tauri:dev --prefix apps/desktop/frontend`
- Workspace root: `C:\Users\Dmitry\Documents\prj\Hobit_queue_logic`
- packSpecHash: `prompt_pack_spec:e5eefb88706b622e`
- Materialization status: `reused`
- Materialization counts: created 0, reused 5, conflicts 0
- Selected Queue task id: `queue_task_prompt_pack_1782673287717627000_5`
- Previous failed runLinkId preserved: `queue_run_link_1782673319681359700_4`
- Retry runLinkId: `queue_run_link_1782676554256662500_4`
- Launch status: `launched`
- Completion status: `failed`
- Terminal Queue task state: `failed`
- Worker exit code: 1
- Worker error: `codex exec --json exited with code 1`
- Worker stderr summary: OpenAI Responses WebSocket returned `401 Unauthorized`; no final message file was produced.
- Worker stdout summary: Codex started a thread, retried transport, fell back from WebSockets to HTTPS, then failed with `stream disconnected before completion`.
- Completion bridge terminalized retry run: true
- `dogfood-file-import-hardening` became eligible: no
- `dogfood-file-import-hardening` auto-started: no

Retry run detail command:

```powershell
node scripts/hobit/run-queue-dogfood-operator.mjs --run-detail --run-link-id queue_run_link_1782676554256662500_4 --json
```

- Run link status: `failed`
- Queue task status: `failed`
- Completion status: `failed`
- Retryability after retry failure: `retryable_failed_task`
- Dependent eligibility: `blocked_failed_upstream`
- Dependent auto-started: false

## Boundary Checks

- usedDirectDatabasePath: false
- frontend materializer canonical: no
- frontend lifecycle state: no
- widget_runs: no
- Agent Executor / Agent Queue widget identity: no
- scheduler/autodispatch: no
- dependent tasks auto-started: no
- automated tests launched real codex.cmd: no
- real codex.cmd invoked only by explicit selected-task dogfood retry: yes

## Tests And Gates

- `cargo fmt --all`: pass
- `cargo test -p hobit-desktop prompt_pack`: pass
- `cargo test -p hobit-desktop selected_task`: pass
- `cargo test -p hobit-desktop queue_local`: pass
- `cargo test -p hobit-desktop dogfood`: pass
- `cargo test -p hobit-desktop dogfood_operator`: pass
- `cargo test -p hobit-desktop queue_workflow_headless_smoke`: pass
- `node scripts/hobit/run-queue-smoke-gate.mjs --quick`: pass
- `node scripts/hobit/run-queue-smoke-gate.mjs --workflow`: pass
- `node scripts/hobit/run-queue-smoke-gate.mjs --dogfood`: pass
- `node scripts/hobit/run-queue-dogfood-operator.mjs --help`: pass
- `node scripts/hobit/run-queue-dogfood-operator.mjs --operator-health --json`: pass

## Blockers

- Current blocker: Codex authentication/environment failure. The explicit retry launched real `codex.cmd`, but Codex could not authenticate to OpenAI and exited with code 1 after repeated `401 Unauthorized` responses.
- Smallest next block: fix the Codex/OpenAI authentication environment used by Hobit queue_local worker launches, then retry `dogfood-foundation-checkpoint` again through `--retry-pack-task`.

## Next Recommended Queue Task

Keep current task as `dogfood-foundation-checkpoint`. Do not advance to `dogfood-file-import-hardening` until the foundation checkpoint completes successfully and the completion bridge terminalizes success.
