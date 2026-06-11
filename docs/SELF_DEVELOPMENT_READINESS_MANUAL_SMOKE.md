# Self-Development Readiness Manual Smoke

## Status

Status: manual smoke checklist for
`WORKSPACE-CHAT-QUEUEV2-MANUAL-SMOKE-CHECKLIST-01`.

This document does not add automated coverage, frontend behavior,
backend/runtime behavior, storage/schema changes, Queue scheduling, Agent
Executor execution, validation automation, Diff Review execution, Git mutation,
Terminal launch, provider tools, automatic finalization, automatic commit,
push, rollback, or dependency execution. Current implemented widget behavior
remains governed by `docs/CURRENT_WIDGET_SURFACE.md`.

Use this checklist for the UI dogfooding path that cannot be fully covered by
service-level tests. Record the run date, desktop build/branch, Workspace name,
fixture source, operator choices, and any unavailable states.

## Scope

Primary fixture:

- `apps/desktop/frontend/src/workbench/promptPack/fixtures/self-development-smoke-prompt-pack/prompt-batch.json`
- `apps/desktop/frontend/src/workbench/promptPack/fixtures/self-development-smoke-prompt-pack/001-safe-docs-noop.md`
- `apps/desktop/frontend/src/workbench/promptPack/fixtures/self-development-smoke-prompt-pack/002-dependent-follow-up.md`

Fallback fixture:

- An equivalent local prompt pack with two manual/docs-only Queue items, where
  task 002 depends on task 001, validation commands are safe read/check
  commands, and the pack explicitly forbids auto-run, auto-commit, auto-push,
  rollback, destructive Git commands, Terminal launch, provider tools, and
  hidden execution.

Do not treat this checklist as proof of automated coverage. Existing
service/model tests cover parser, preview, materialization, validation
evidence attachment, Diff Review creation, coordinator finalization, and
dependency readiness in focused layers; this checklist verifies the visible
desktop UI path end to end.

## Preconditions

- The repository worktree is suitable for a smoke run and no destructive Git
  commands are needed.
- Hobit desktop can be opened in the local environment.
- A Workspace is available with Workspace Chat / Workspace Agent and Agent
  Queue / QueueV2 visible or insertable through existing product-facing paths.
- Queue Autorun is not armed unless the operator is explicitly testing its
  visible disabled/no-start state; this smoke must not rely on Autorun.
- The operator has the prompt-pack fixture content available locally.
- The operator understands that running task 001 is optional. Do not run task
  001 unless the operator explicitly chooses that step during the smoke.

## Checklist

1. Open Hobit desktop.
   - Expected: the Workspace Start Screen or a previously opened Workspace is
     visible.
   - Expected: no Queue task starts, no Agent Executor run starts, no Terminal
     command starts, and no Git commit/push occurs on launch.

2. Open or create a Workspace for this smoke.
   - Expected: the Workbench opens with widget surfaces only; Workspace Chat /
     Workspace Agent is available as a widget surface.
   - Expected: existing Workspace data, if any, is visible and not silently
     mixed with another Workspace.

3. Open Workspace Chat / Workspace Agent.
   - Expected visible state: a Workspace Chat card surface can show
     `queue.importPromptPack` / `Import prompt pack`.
   - Expected visible state: the card explains that folder/zip source is
     unavailable when only pasted/local text import is supported.
   - Expected: no prompt-pack import starts before the operator supplies source
     text and uses the visible import action.

4. Import the self-development smoke prompt pack fixture, or an equivalent
   local prompt pack.
   - Use the primary fixture manifest content from `prompt-batch.json` when
     possible.
   - If the UI only accepts pasted source, paste the manifest/source through
     the visible `Prompt-pack source` field.
   - Expected visible state: the Workspace Chat import card remains editable
     before creation and offers `Create Queue items` only after preview is
     valid.

5. Preview import before creating Queue items.
   - Expected visible state: `Prompt-pack import preview` appears.
   - Expected visible state: preview shows pack name/id, `Items`, `Selected`,
     `Dependencies`, `Unresolved deps`, `Validation commands`, and `Model
     routes`.
   - Expected visible state: selected items include task 001 and task 002.
   - Expected visible state: dependency graph summary shows one dependency
     edge, no cycles, and no unresolved dependency for the primary fixture.
   - Expected visible state: validation commands are shown as suggestions; they
     have not run.
   - Expected: preview does not create Queue items, assign workers, run tasks,
     finalize results, commit, push, roll back, or launch Terminal.

6. Confirm creation of Queue items.
   - Click `Create Queue items`.
   - Expected visible state: Workspace Chat shows `Prompt-pack import result`
     / `Created Queue items`.
   - Expected visible state: created list includes
     `001-safe-docs-noop` and `002-dependent-follow-up`, or equivalent local
     task ids.
   - Expected: created items are draft/manual Queue items through the existing
     Queue path.
   - Expected: no Queue run, Agent Executor run, validation run, coordinator
     finalization, commit, push, rollback, Terminal command, provider call, or
     Autorun start occurs during creation.

7. Open QueueV2.
   - Use `Open Queue`, `Open created task`, or the Agent Queue widget surface.
   - Expected visible state: QueueV2 is the normal Agent Queue surface.
   - Expected visible state: QueueV2 card markers are visible for lifecycle,
     validation, Diff Review, coordinator state, next action, and prompt-pack
     metadata where available.

8. Verify task 001 and task 002.
   - Expected visible state: task 001 is present with prompt-pack metadata and
     validation-required marker where available.
   - Expected visible state: task 002 is present and shows dependency blocked,
     `Depends on 001-safe-docs-noop`, or equivalent dependency/readiness cue.
   - Expected: task 002 is not ready solely because task 001 exists.
   - Expected: no task is running unless the operator explicitly started it.

9. Open task 001 details.
   - Expected visible state: `QueueV2 task details` popup opens.
   - Expected visible sections/tabs: `Overview`, `Prompt`, `Result`,
     `Agent Log`, `Coordinator`, `Context`, `Files / Validation`, and
     `Developer`.
   - Expected visible state: the details popup shows primary action and
     explicit actions; opening details does not run or finalize anything.

10. Verify validation section before running validation.
    - Open `Files / Validation`.
    - Expected visible state: `Validation evidence` shows `Not requested`,
      `Unavailable`, or existing capped evidence if this Workspace already had
      evidence.
    - Expected visible state: validation commands from the prompt pack are
      listed as commands/suggestions.
    - Expected visible state: `Request validation` is enabled only when the
      validation runner, Queue action bridge, and execution workspace are
      available. If disabled, the reason is visible.

11. Request validation evidence.
    - Click `Request validation` only when the operator chooses to verify the
      local validation runner path.
    - Expected visible state when available: request state changes through
      `Requesting validation` / running, then shows passed/failed/unavailable
      evidence.
    - Expected visible state: command status, exit, duration, stdout snippet,
      stderr snippet, warnings/errors, and capped/truncated output indicators
      are shown where applicable.
    - Expected: validation evidence attaches to task 001 through existing Queue
      report/update state.
    - Expected: validation does not finalize task 001, mark task 002 ready,
      create commits, push, roll back, launch Terminal, call providers, start
      Agent Executor, or arm/start Autorun.

12. Run or complete task 001 only if the operator explicitly chooses.
    - Optional: use the existing explicit Queue/Executor task action for task
      001 if this smoke run is intended to verify a real report-ready path.
    - Expected: any run uses existing visible Queue/Executor controls and is
      attributable to the operator's explicit action.
    - Expected: completing or reporting task 001 does not by itself make task
      002 ready. Task 002 readiness must remain gated until coordinator
      finalization.
    - If the operator skips execution, continue with available report/mock
      evidence or record that Diff Review/finalization evidence is limited.

13. Create a Diff Review item for task 001.
    - Use Workspace Chat report/action cards or QueueV2 selected-task details
      action when the source task has sufficient report/review state.
    - Expected visible state: Workspace Chat may show `Create Diff Review
      preflight` and then `Diff Review result`.
    - Expected visible state: QueueV2 shows a separate `Diff Review - ...`
      task, or a visible unavailable reason when creation prerequisites are
      missing.
    - Expected: Diff Review creation is explicit and does not run the review,
      run validation, finalize source work, unblock task 002, commit, push,
      roll back, launch Terminal, or call providers.

14. Verify the Diff Review task is read-only.
    - Open the Diff Review task details.
    - Expected visible state: the QueueV2 card/title identifies it as Diff
      Review or shows source-task linkage.
    - Expected visible state: `Diff Review` section says it is a read-only
      item that should inspect and report findings and does not edit code by
      default.
    - Expected visible state: details show source task/review task, review
      mode, source report availability, validation availability, diff/files
      availability, and warnings for missing inputs.
    - Expected: no code edit, Git mutation, rollback, run, or finalization is
      performed by opening or creating the Diff Review item.

15. Verify coordinator finalization details before acceptance.
    - Reopen task 001 details and select `Coordinator`.
    - Expected visible state: `Coordinator` section states explicit
      finalization only.
    - Expected visible state: details show `Decision state`, `Next action`,
      `Validation evidence`, `Diff Review`, `Expected commit title`, `Actual
      commit`, `Dependency gate`, and `Operator note`.
    - Expected visible state: action buttons include `Accept without commit`,
      `Accept with commit hash`, `Request changes`, `Follow-up`,
      `Mark blocked`, and `Rollback required` where currently wired.
    - Expected: validation and Diff Review are shown as evidence, not automatic
      acceptance.

16. Coordinator accept without commit.
    - Use only for a no-change/status-only smoke outcome.
    - Click `Accept without commit` and provide/confirm an explicit reason if
      the current UI asks for it.
    - Expected visible state: task 001 records coordinator-finalized /
      accepted-without-commit state, with no commit hash required.
    - Expected: no commit is created, no push occurs, no rollback executes, and
      no task starts as part of acceptance.

17. Coordinator accept with commit hash.
    - Use only when a real existing commit hash/title is intentionally supplied
      by the operator. The UI must not create the commit.
    - Click `Accept with commit hash` only when a valid existing commit hash
      and non-generic title are recorded/available.
    - Expected visible state: task 001 records commit hash/title if the current
      Queue state path can preserve them, or shows an explicit unsupported /
      unverified state.
    - Expected visible state: generic titles such as `update`, `fix`, or
      `changes` are rejected or visibly warned before acceptance.
    - Expected: no auto-commit, auto-push, fetch, reset, clean, stash,
      checkout, rollback, Terminal launch, provider call, or hidden Git lookup
      occurs.

18. Verify task 002 readiness gate.
    - Before coordinator finalization: task 002 remains blocked/not ready when
      task 001 is only created, completed, validated, or Diff Reviewed.
    - After coordinator finalization: task 002 readiness changes only because
      task 001 was explicitly accepted/finalized.
    - Expected visible state: QueueV2 task 002 card marker changes from
      dependency blocked to ready/next-action available only after
      finalization.
    - Expected visible state: task 002 details report the dependency gate
      impact or lack of blocker.
    - Expected: task 002 does not auto-run after becoming ready.

19. Verify no hidden automation occurred.
    - Expected: no Queue task auto-ran.
    - Expected: Queue Autorun was not armed or started by import, validation,
      Diff Review creation, or finalization.
    - Expected: no task auto-finalized.
    - Expected: no commit was created automatically.
    - Expected: no push occurred.
    - Expected: no rollback, reset, clean, stash, checkout, Terminal launch,
      provider tool call, hidden Workspace read, hidden file mutation, or
      hidden background execution occurred.

## Expected Visible UI States

- Workspace Chat cards:
  - `Import prompt pack` with `Prompt-pack source`.
  - `Prompt-pack import preview` with selected items, dependency graph,
    validation commands, expected commit titles, warnings, and errors.
  - `Prompt-pack import result` with created Queue item ids.
  - Validation request/result card or visible unavailable state.
  - `Create Diff Review preflight` and `Diff Review result` when applicable.
  - Coordinator finalization controls or visible unavailable state when shown
    from Workspace Chat.

- QueueV2 card markers:
  - Lifecycle/status marker such as draft, ready, running, review, blocked, or
    finalized.
  - Validation marker such as not requested, validation required, passed,
    failed, unavailable, or stale.
  - Diff Review marker such as not requested, linked review, source task, or
    read-only review.
  - Coordinator marker such as review needed, finalized, commit saved, or
    blocked/follow-up state.
  - Prompt-pack metadata marker showing dependency state and validation
    requirement where metadata is available.

- Details popup sections:
  - `Files / Validation`: changed files, validation evidence state, evidence
    timestamp, request state, warnings/errors, command status, stdout/stderr
    snippets, and expected commit title.
  - `Diff Review`: source/review task linkage, review mode, source report,
    validation, diff/files availability, warnings, and read-only review copy.
  - `Coordinator`: decision state, next action, validation evidence, Diff
    Review evidence, expected commit title, actual commit, dependency gate,
    operator note, and explicit finalization actions.

## Failure Triage

- Prompt-pack source unavailable:
  - Expected: the UI shows folder/zip unavailable or source unavailable rather
    than pretending import succeeded.
  - Action: paste the fixture manifest into `Prompt-pack source`, or use an
    equivalent local prompt pack. If preview still fails, record the exact
    preview errors and do not create Queue items.

- Validation runner unavailable:
  - Expected: `Request validation` is disabled or returns a visible
    unavailable state such as missing runner, missing Queue action bridge, or
    missing execution workspace.
  - Action: record the unavailable reason. Do not substitute Terminal, shell
    commands, Agent Executor, provider prompts, or fake evidence.

- Diff unavailable:
  - Expected: Diff Review preflight/details show missing diff/files,
    validation, source report, or source link warnings.
  - Action: create the Diff Review item only if the UI still permits explicit
    creation with warnings. Record that live diff evidence was unavailable. Do
    not run Git commands, mutate Git, or fake a diff.

- Dependency gate unsupported:
  - Expected: QueueV2 or coordinator details show dependency link/gate as
    unavailable, unverified, or preserved only through visible prompt/task
    text.
  - Action: record the unsupported state and verify no dependent task starts.
    Do not treat unsupported dependency display as a pass for readiness-gate
    behavior.

## Pass Criteria

The manual smoke passes only when all applicable UI states are visible and all
safety boundaries hold:

- Import preview happens before Queue creation.
- Queue items are created only after explicit confirmation.
- Task 001 and task 002 appear in QueueV2.
- Task 002 dependency on task 001 is visible or an explicit unsupported state
  is recorded.
- Validation evidence is requested only by explicit operator action, or the
  runner-unavailable state is visible.
- Diff Review item creation is explicit and read-only by default.
- Coordinator acceptance is explicit, either without commit for a no-change
  case or with an operator-supplied existing commit hash/title.
- Task 002 readiness changes only after coordinator finalization of task 001,
  or dependency gating is explicitly recorded as unsupported.
- No auto-run, auto-finalize, auto-commit, auto-push, rollback execution,
  Terminal launch, provider tool call, hidden context read, or hidden
  background execution occurs.

Do not mark automated coverage as passing from this checklist. This checklist
records manual UI evidence only.
