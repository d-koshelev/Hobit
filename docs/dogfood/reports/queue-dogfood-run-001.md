# Queue Dogfood Run 001

## Run Summary

- Date/time: 2026-06-28T02:58:08.6873932+02:00
- Branch: `queue-dogfood-continuation`
- Pack path: `docs/dogfood/queue-prompt-packs/hobit-queue-dogfood-next.json`
- Pack id: `hobit-queue-dogfood-next`
- Real dogfood run performed: no

The real selected-task `queue_local` worker launch was blocked before preview
and materialization in a real operator path. The backend/Tauri commands exist
and the headless dogfood tests pass, but there is no supported non-test
operator adapter, script, or UI flow that invokes:

- `preview_agent_queue_prompt_pack_file`
- `materialize_agent_queue_prompt_pack_file`
- `start_selected_agent_queue_task_local`

The only direct callers found for the file-based prompt-pack commands are
headless tests. Frontend search found no invocation of the new file commands or
the selected-task start command.

## Preview Evidence

- `packSpecHash`: not captured through a real operator path
- `runSettingsHash`: not captured through a real operator path
- `dependencySpecHash`: not captured through a real operator path
- `fullPreviewHash`: not captured through a real operator path
- `wouldStartWorkers`: not evaluated through a real operator path
- `wouldCreateRunLinks`: not evaluated through a real operator path
- `materializationStatus` before materialization: not evaluated through a real operator path

Headless validation did prove that the repo-owned pack parses and previews
through the backend workspace-file path.

## Materialization Evidence

- `materializationStatus`: not evaluated through a real operator path
- `createdCount`: not evaluated through a real operator path
- `reusedCount`: not evaluated through a real operator path
- `conflictCount`: not evaluated through a real operator path
- Generated Queue task ids: none from a real operator run
- Dependency remap summary: not evaluated through a real operator path

Headless validation did prove that the repo-owned pack materializes through the
backend file path, remaps dependencies to generated Queue task ids, and reuses
the same ids on repeated materialization.

## Selected-Task Run Evidence

- Selected pack task id: `dogfood-foundation-checkpoint`
- Selected Queue task id: not generated through a real operator path
- `runLinkId`: not created through a real operator path
- Launch status: blocked before real launch
- Completion status: not applicable
- Terminal Queue task state: not applicable
- Real `codex.cmd` invoked as explicit dogfood worker: no

No dependent tasks were started.

## Boundary Checks

- Frontend materializer used as canonical logic: no
- `widget_runs` created: no
- Agent Executor / Agent Queue widget identity used: no
- Scheduler/autodispatch used: no
- Dependent tasks auto-started: no
- Automated tests launched real `codex.cmd`: no

## Tests And Gates

- `cargo test -p hobit-desktop prompt_pack`: passed, 31 passed
- `cargo test -p hobit-desktop selected_task`: passed, 8 passed
- `cargo test -p hobit-desktop queue_local`: passed, 10 passed
- `cargo test -p hobit-desktop dogfood`: passed, 4 passed
- `cargo test -p hobit-desktop queue_workflow_headless_smoke`: passed, 3 passed
- `node scripts/hobit/run-queue-smoke-gate.mjs --dogfood`: passed

## Blockers

The first real dogfood run is blocked by missing operator affordance. The
backend/Tauri commands are registered, but there is no existing supported
non-test invocation path that can preview the repo pack, materialize it into a
real workspace, start the selected generated Queue task id through
`queue_local`, and observe completion evidence.

Do not treat the fake-launcher tests as a real dogfood run.

## Next Recommended Queue Task

Recommended next implementation block:

`BLOCK 70G  Queue Dogfood Thin Operator Adapter MVP`

Scope should be the smallest safe operator adapter around the existing
backend-owned commands. It should preview and materialize the repo-owned pack by
workspace-relative path, print generated Queue task ids, allow one explicit
selected-task `queue_local` start by Queue task id, and report run-link
completion state without adding scheduler/autodispatch or frontend lifecycle
ownership.
