# Hobit Stable v0.1 Dogfooding Status

## Status

- Date: 2026-06-04
- Run id: DOGFOOD-RUN-01
- Mode: small real dogfooding task
- Commit under test: `ad1f9e9`
- Scope: documentation only
- Closure status: closed for this documentation task; Stable v0.1 acceptance remains open

## Stable v0.1 Goal

Stable v0.1 is the first accepted Hobit self-development loop: an
operator-controlled AI Workbench for planning, preparing, executing, observing,
reviewing, and continuing AI-assisted work inside an isolated Workspace.

The core dogfooding loop is Workspace Agent plus Agent Queue, with Agent
Executor as supporting Direct Work runtime/detail, Agent Activity for readable
current-session activity, and Notes plus Knowledge / Skills for explicit
operator-authored context. Terminal, Git, Database / JDBC, Runbook, and Finder
remain bounded widgets or preview/gap surfaces, not hidden automation paths.

## What Works Today

- The Stable v0.1 contract and acceptance gate exist:
  `docs/HOBIT_STABLE_V0_1_CONTRACT.md` and
  `docs/HOBIT_STABLE_V0_1_ACCEPTANCE.md`.
- `docs/CURRENT_WIDGET_SURFACE.md` records the current product-facing surfaces,
  preview surfaces, and supporting / compatibility surfaces.
- The current documented product surface centers the Workbench and treats
  widgets as optional capabilities.
- The current documented loop keeps Workspace Agent visible and
  operator-controlled, Queue explicit, Executor supporting, and Activity
  readable/current-session.
- This run completed a real scoped repository change through an external
  runner request without frontend, backend, test, schema, runtime, Git
  mutation, or product-surface changes.

## Remaining Blockers

- Stable v0.1 acceptance has not been run in this task.
- Finder remains a Stable v0.1 acceptance blocker unless the Stable v0.1
  surface is explicitly changed or Finder passes the accepted contract-first
  implementation gate.
- The manual and semantic checks in
  `docs/HOBIT_STABLE_V0_1_ACCEPTANCE.md` still need a recorded acceptance run.
- This task only validates the documentation change with the requested minimal
  Git checks; it does not prove desktop launch, widget behavior, runtime
  behavior, or safety assertions.

## How This Task Was Run

The external runner was given a small documentation-only task:

1. Check the starting Git status and stop if the worktree was dirty.
2. Read the smallest relevant Stable v0.1 docs:
   `docs/ACTIVE_CONTRACT_INDEX.md`,
   `docs/CURRENT_WIDGET_SURFACE.md`,
   `docs/HOBIT_STABLE_V0_1_CONTRACT.md`,
   `docs/HOBIT_STABLE_V0_1_ACCEPTANCE.md`, and
   `docs/AGENT_RESPONSE_CONTRACT.md`.
3. Create this status document only.
4. Run the requested validation commands.
5. Do not commit, push, reset, clean, stash, rollback, checkout, rebase,
   merge, or change frontend/backend/tests.

## Validation Run

Requested validation for this documentation-only task:

```text
git status --short --branch
git diff --stat
git diff --check
```

Latest recorded result:

- `git status --short --branch`: passed; branch is `main...origin/main [ahead
  22]` with this status document untracked.
- `git diff --stat`: passed; no output because the only change is an untracked
  file and it was not staged.
- `git diff --check`: passed; no whitespace errors reported for tracked
  unstaged diffs.

## Intentionally Not Implemented

- No frontend changes.
- No backend changes.
- No tests changed.
- No runtime behavior changed.
- No schema or persistence changes.
- No Stable v0.1 acceptance claim.
- No commit created.
