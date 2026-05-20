# Workbench Current Surface Smoke Checklist

## Purpose

This checklist gives a high-level smoke map for the current Workbench surface.

`docs/CURRENT_WIDGET_SURFACE.md` remains the source of truth for current widget
behavior. This document should stay concise and should not invent detailed
flows that are not documented as current behavior.

## Ready Surfaces

Ready surfaces are Current product smoke targets.

### Notes

- [ ] Notes can be added/opened from the current widget catalog.
- [ ] Current Notes behavior is checked through
  `docs/testing/NOTES_SMOKE_CHECKLIST.md`.
- [ ] Deferred Notebook behavior is not checked as current Notes behavior.

### Agent Executor

- [ ] Agent Executor can be added/opened as the current explicit Codex Direct
  Work execution surface.
- [ ] Smoke checks stay limited to visible operator-provided task inputs, run
  state/log/result visibility, explicit controls, and read-only review/history
  surfaces documented in `docs/CURRENT_WIDGET_SURFACE.md`.
- [ ] Smoke checks do not require auto-dispatch, auto-commit, auto-push, hidden
  background work, shell mode, or a general agent runtime.

### Git

- [ ] Git can be added/opened as the current desktop Git review/control widget.
- [ ] Smoke checks use an explicit operator-provided repository root.
- [ ] Smoke checks stay limited to manual read-only status/diff review and the
  explicit selected-file local commit path with operator confirmation.
- [ ] Browser/Vite fallback is allowed to be insertable but cannot perform real
  Git reads.

### Terminal

- [ ] Terminal can be added/opened as the current desktop Terminal widget.
- [ ] PTY smoke checks account for the current Windows-only shipped live PTY
  backend limitation.
- [ ] Non-Windows live PTY creation returning unsupported-platform is current
  behavior until platform support or catalog gating is implemented.
- [ ] The collapsed one-shot command fallback is Compatibility behavior, not
  the normal Terminal product smoke target.

## Preview Surfaces

Preview surfaces are smoke targets only when labeled as Preview.

### Agent Queue Preview

- [ ] Smoke manual task create/list/read/update/filter/select/save behavior.
- [ ] Smoke policy model persistence only when scoped: Queue tasks default
  `executionPolicy` to `manual`, and create/update/list/read preserve the
  stored value without changing execution behavior.
- [ ] Smoke visible manual assignment or clear of a task to an Agent Executor
  slot when APIs are available.
- [ ] Smoke explicit start of an assigned task only through operator action and
  documented current-session handoff behavior.
- [ ] Do not smoke auto-dispatch, scheduling, automatic acceptance, response
  validation, Terminal launch, Git mutation, or Notes mutation as current.

Planned future smoke for Sequential Queue Runner, after implementation:

- [ ] Smoke `manual`, `auto`, and `after_previous_success` policy selection.
- [ ] Smoke ordered single-Executor automatic starts using existing
  Queue-to-Executor handoff.
- [ ] Smoke runner stop on `manual` task, failed/cancelled/timed-out previous
  task, missing prompt, missing execution workspace, missing executable, or
  busy executor.
- [ ] Do not treat this Planned runner smoke as current behavior.

### Coordinator Chat Preview

- [ ] Smoke explicit chat send and deterministic/local proposal card behavior
  for safe preview proposal types.
- [ ] Smoke approved Queue task or Note creation only through a separate
  explicit create action when available.
- [ ] Smoke JDBC suggestions as review/copy text only.
- [ ] Do not smoke hidden context access, widget state reads, Terminal control,
  Git mutation, SQL execution, Agent Executor launch, or Queue auto-dispatch as
  current.

### Database / JDBC Current Preview

- [ ] Smoke connector metadata create/list/read/update/selection behavior.
- [ ] Smoke bounded mock/safe read-only SQL validation/execution behavior.
- [ ] Do not smoke credentials, real database connections, production JDBC
  execution, `EXPLAIN`, write SQL, AI query assistance, Coordinator SQL
  execution, or production sidecar behavior as current.

### Runbook Preview

- [ ] Smoke the local/manual sample runbook, selectable step details, step
  states, and local notes/evidence text for the current widget session.
- [ ] Do not smoke persisted runbooks, edit/build mode, step execution, Agent
  Executor launch, Queue creation, Coordinator integration, Terminal commands,
  file mutation, or Git mutation as current.

## Compatibility, Deprecated, And Deferred Surfaces

- Compatibility and Deprecated surfaces are not preferred current product smoke
  targets unless a task explicitly scopes compatibility verification.
- Deferred surfaces are not checked as current behavior.
- Dev-only smoke HTML entry points are not product routes and are documented in
  `docs/testing/DEV_SMOKE_ENTRYPOINTS.md`.
