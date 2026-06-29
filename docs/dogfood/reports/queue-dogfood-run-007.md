# Queue Dogfood Run 007

## Run Summary

- Date: 2026-06-28T19:02:35.276Z
- Branch: `queue-dogfood-continuation`
- Pack path: `docs/dogfood/queue-prompt-packs/hobit-queue-dogfood-next.json`
- Pack id: `hobit-queue-dogfood-next`
- Operator context source: `launched_app_endpoint`
- Endpoint kind: `loopback_http_json`
- Endpoint pid: `21092`
- Profile mode: `dogfood`
- App launch attempted: true
- App launch command: `npm.cmd run tauri:dev --prefix apps/desktop/frontend`
- Used direct database path: false
- Workspace id: `ws_1782673266575011500_1`
- Workspace method: `persisted_dogfood_binding`
- Workspace root: `C:\Users\Dmitry\Documents\prj\Hobit_queue_logic`
- Real dogfood run performed: true
- Blocker: `selected task terminalized as failed`

## Command

```powershell
node scripts/hobit/run-queue-dogfood-operator.mjs --pack docs/dogfood/queue-prompt-packs/hobit-queue-dogfood-next.json --materialize --start-pack-task dogfood-foundation-checkpoint --allow-real-worker --json --report docs/dogfood/reports/queue-dogfood-run-007.md
```

## Endpoint Attach Or Launch

- endpoint file: `C:\Users\Dmitry\Documents\prj\Hobit_queue_logic\.hobit\dogfood-profile\dogfood-operator-endpoint.json`
- launch log: `C:\Users\Dmitry\Documents\prj\Hobit_queue_logic\target\hobit-dogfood\operator-launch\hobit-desktop-11920-2026-06-28T19-01-58-143Z.log`
- command summary: `npm.cmd run tauri:dev --prefix apps/desktop/frontend`

## Preview

- packSpecHash: `prompt_pack_spec:e5eefb88706b622e`
- runSettingsHash: `prompt_pack_run_settings:5c913b45372cd5f7`
- dependencySpecHash: `prompt_pack_dependency_spec:3cfc0b1ddfa58a8c`
- fullPreviewHash: `prompt_pack_preview:b681515f52dd5c7f`

## Materialization

- first materialization status: `created`
- first materialization created: 5
- first materialization reused: 0
- first materialization conflicts: 0
- repeated materialization status: `reused`
- repeated materialization created: 0
- repeated materialization reused: 5
- repeated materialization conflicts: 0

- `dogfood-foundation-checkpoint` -> `queue_task_prompt_pack_1782673287717627000_5` (reused)
- `dogfood-file-import-hardening` -> `queue_task_prompt_pack_1782673287717489200_4` (reused)
- `dogfood-selected-task-run-report` -> `queue_task_prompt_pack_1782673287717821400_7` (reused)
- `dogfood-next-implementation-block` -> `queue_task_prompt_pack_1782673287717719200_6` (reused)
- `dogfood-docs-loop` -> `queue_task_prompt_pack_1782673287717234500_3` (reused)

## Selected Task

- selected pack task id: `dogfood-foundation-checkpoint`
- selected Queue task id: `queue_task_prompt_pack_1782673287717627000_5`
- runLinkId: `queue_run_link_1782673319681359700_4`
- launch status: `launched`
- completion status: `failed`
- completion bridge terminalized run: true
- dependent task became eligible: no
- dependent task auto-started: false

## Boundary Checks

- frontend materializer canonical: no
- frontend lifecycle state: no
- widget_runs: no
- Agent Executor / Agent Queue widget identity: no
- scheduler/autodispatch: no
- automated tests launched real codex.cmd: no
- real codex.cmd invoked only by explicit selected-task launch: true

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

## Next

- Smallest next unblock block: inspect the failed selected-task run and rerun `dogfood-foundation-checkpoint` through the explicit operator command.
