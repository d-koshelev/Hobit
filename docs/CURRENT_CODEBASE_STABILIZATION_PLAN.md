# Current Codebase Stabilization Plan

## Purpose

This is the Phase 1 working baseline for stabilizing the current Hobit
codebase and contracts before new feature or widget work continues.

Phase 1 is about bringing the existing codebase and documentation into order.
It is not a product feature phase.

## Phase 1 Objective

Phase 1 stabilizes the current codebase and contracts so future Codex-driven
fixes can be small, explicit, and low ambiguity.

Phase 1 includes:

- documentation authority cleanup
- current vs planned/deferred behavior separation
- stale contract detection
- current widget surface cleanup
- known coupling/problem inventory
- validation/smoke checklist preparation
- reducing Codex ambiguity

Phase 1 does not include:

- new Notes features
- Notebook features
- Coordinator / Queue / Executor redesign
- component renames
- storage migrations
- runtime behavior changes
- automatic agent orchestration changes

## Contract Statuses

- Current: implemented behavior that exists in the codebase and is safe to rely
  on.
- Preview: implemented behavior that is visible, intentionally limited, and not
  yet a complete product surface.
- Planned: approved next-step behavior, but not necessarily implemented yet.
- Deferred: future behavior that must not be implemented unless a task
  explicitly requests it.
- Compatibility: legacy names, persistence IDs, old component names, old state
  shapes, or aliases that may still exist for backward compatibility but are not
  preferred product/domain names.
- Deprecated: old behavior or terminology that should not be used for new work.

Do not implement Planned, Deferred, Compatibility, or Deprecated behavior
unless the task explicitly requests it.

## Source-Of-Truth Priority

1. `AGENTS.md` for workflow rules and validation expectations.
2. `docs/ACTIVE_CONTRACT_INDEX.md` for active/authoritative contracts.
3. `docs/CURRENT_WIDGET_SURFACE.md` for current implemented widget behavior.
4. Task-specific contracts for the relevant widget/domain.
5. `docs/ARCHITECTURE.md` for structural guidance unless it conflicts with
   active current contracts.
6. Older or broader docs are non-authoritative when they conflict with active
   contracts.

If a document conflicts with `docs/ACTIVE_CONTRACT_INDEX.md` or
`docs/CURRENT_WIDGET_SURFACE.md`, treat the conflicting section as stale unless
the current task explicitly says otherwise.

## Phase 1 Scope

In scope:

- contract authority cleanup
- stale documentation cleanup
- current widget surface normalization
- Notes contract consistency preparation
- Architecture stale reference cleanup
- validation/smoke checklist planning
- frontend coupling inventory
- WorkspaceApi / WidgetRenderProps / action bag coupling inventory
- browser fallback / dev workflow gaps
- DTO duplication / Rust-TS boundary risks
- feature-slice checklist planning

Out of scope:

- Coordinator / Queue / Executor fixes
- Notebook features
- Markdown features
- AI-in-Notes
- storage migrations
- component rename PRs
- new runtime behavior
- hidden automation changes

## Contract Drift Decision Matrix

`docs/CONTRACT_DRIFT_DECISION_MATRIX.md` records the Phase 1 decisions for the
remaining contract drift areas. It is a stabilization decision document, not a
current widget behavior contract or product roadmap.

Status:

- Contract drift decision matrix: completed / created.
- Remaining follow-ups now have clearer decisions, scope boundaries, and
  "must not do yet" constraints.
- Current widget behavior remains governed by `docs/CURRENT_WIDGET_SURFACE.md`.

# Current validation baseline

Baseline recorded on 2026-05-20 after the Phase 1 P0 bootstrap fixes.

- Passing: `cargo check --workspace` passes after restoring the Tauri icon
  validation assets.
- Known warning: `cargo check --workspace` reports four pre-existing
  `hobit-desktop` dead-code warnings in
  `apps/desktop/src-tauri/src/terminal_pty.rs`: unused
  `TERMINAL_STREAM_KIND`, unused `SharedOutputBuffer::push_terminal_output`,
  unread `TerminalPtyOutputBuffer::next_sequence`, and unused
  `TerminalPtyOutputBuffer::push`.
- Fixed blocker: `cargo test --workspace` now passes on this Linux checkout
  after the three long-lived Terminal PTY lifecycle tests were gated to
  Windows-only support and non-Windows creation now asserts the existing
  unsupported-platform error without registering a session. The previously
  failing tests were `terminal_pty_rejects_cross_scope_session_actions`,
  `terminal_pty_resize_write_kill_and_close_lifecycle`, and
  `terminal_pty_stop_marks_session_stopping_without_targeting_pid`.
- Passing: `bash -n scripts/hobit/validate.sh` passes.
- Expected environment failure: `bash scripts/hobit/validate.sh` exits
  non-zero before validation because frontend dependencies are missing. The
  failure is actionable and prints the required bootstrap command:
  `npm ci --prefix apps/desktop/frontend`.
- Expected environment failure: direct `scripts/hobit/validate.sh` execution
  fails with `Permission denied` in this checkout. Git records the script as
  executable mode `100755`, but the local filesystem mode is currently
  `-rw-rw-rw-`, so this is an execution-mode/materialization issue in this
  checkout, not a tracked script-mode change.
- Expected environment failure: frontend dependency state is missing
  `apps/desktop/frontend/node_modules` and local
  `node_modules/.bin/tsc`. Do not treat frontend validation as a code failure
  until dependencies are installed and `validate.sh` proceeds past the
  preflight.
- Known warning: the worktree has pre-existing unrelated dirty files across
  docs, frontend, Rust, and decision records. Phase 1 validation baseline work
  must not stage or modify those unrelated files.
- Not run: frontend typecheck/build were not run directly because this
  validation/reporting block explicitly must not install frontend
  dependencies.

## Known Problem Inventory

These are known cleanup areas for follow-up tasks. Do not solve them inside a
baseline task unless the task explicitly allows that scope.

- Conflicting Notes contracts across minimal widget-state draft behavior,
  workspace-local Notes storage/API behavior, and future Notebook direction.
  Completed for the active Notes contracts:
  `docs/NOTES_WIDGET_CONTRACT.md` now owns current Notes behavior and
  Compatibility/Deprecated legacy state, while
  `docs/NOTES_WIDGET_PRODUCT_CONTRACT.md` owns Notes product planning and
  Deferred Notebook boundaries.
- Stale Architecture references that mix current behavior, compatibility paths,
  and future/deferred behavior in long narrative sections. Completed for
  `docs/ARCHITECTURE.md`: architecture is now framed as structural guidance,
  Notes language defers to the normalized Notes contracts, JDBC language
  acknowledges the shipped mock/safe read-only Preview path, Terminal PTY
  language states the Windows-only live backend limitation, and older Agent
  Chat / Agent Monitoring paths are framed as Compatibility or
  pending-retirement.
- Agent Chat / Agent Monitoring compatibility alignment. Completed for docs:
  `docs/AGENT_CHAT_MONITORING_COMPATIBILITY_CONTRACT.md` now owns the
  Compatibility / pending-retirement status and lists the retained
  proposal-era commands/modules found during the targeted inventory. Future
  optional cleanup remains either retire/delete the old backend/frontend code
  paths or formally keep narrowed compatibility APIs.
- JDBC Preview contract alignment. Completed for docs:
  `docs/JDBC_WIDGET_CONTRACT.md` now owns the Database / JDBC Current Preview
  boundary for connector metadata plus bounded mock/safe read-only SQL
  validation/execution. Production JDBC execution, hidden
  Coordinator-triggered SQL execution, credential expansion, write SQL,
  `EXPLAIN` workflows, broad database automation, and production sidecar
  runtime remain Deferred. Future JDBC decisions remain whether to later
  promote the preview path, hide/remove it, implement production runtime, or
  connect it to Coordinator only through explicit approved actions.
- Current vs preview vs deferred widget confusion, especially around agent
  surfaces and older proposal-review paths.
- Broad `AGENTS.md` default read set causing unnecessary context load and
  contradictory contract readings.
- Global `WidgetRenderProps` coupling across widget components.
- Broad `WorkspaceApi` coupling across unrelated widget domains.
- Global workbench action bag coupling that exposes more actions than a widget
  slice should need.
- Notes component size/state complexity.
- Browser fallback not supporting fast Notes UI iteration where persistence is
  needed for realistic smoke checks.
- Manual Rust/Tauri/TypeScript DTO duplication and drift risk.
- Compatibility names and IDs such as `interactive-agent` and `agent-run` that
  must not be renamed casually.
- Missing smoke checklist discipline for focused widget and browser/desktop
  flows.
- Feature work starting before contract cleanup.

## AMP review findings

The AMP review findings are Phase 1 stabilization backlog inputs. They do not
change product contracts by themselves, do not approve behavior changes, and
must be confirmed against current code before follow-up contract or
implementation changes.

### P0 - Restore validation and repo portability

- Fix the clean-checkout `cargo check --workspace` blocker where the Tauri
  desktop shell expects missing icon assets such as
  `apps/desktop/src-tauri/icons/icon.png`. Fixed by restoring valid generated
  Tauri icon assets under `apps/desktop/src-tauri/icons/`. Closed for
  `cargo check --workspace`; the command now passes with only known
  Terminal PTY dead-code warnings.
- Improve `scripts/hobit/validate.sh` failure reporting when frontend
  dependencies, `node_modules`, or `tsc` are missing, so bootstrap failures are
  actionable instead of opaque. Fixed by adding a frontend dependency preflight
  that reports the missing local TypeScript toolchain and the required
  `npm ci --prefix apps/desktop/frontend` bootstrap command before npm
  validation steps run. Mitigated; missing dependencies remain an expected
  environment failure until `npm ci --prefix apps/desktop/frontend` is run.
- Verify real-repository Git portability for `.git` gitdir pointers and
  `hobit-local-git` configuration, including reviewed cases where an absolute
  Windows path broke `git status` outside the original environment. Do not edit
  `.git` as part of backlog documentation. Current checkout verification:
  `.git` is a gitdir pointer to `hobit-local-git`, `hobit-local-git` exists
  but is ignored and untracked, `core.worktree` is relative (`..`), and
  `git status` works. Classify the reviewed absolute-path failure as a local
  metadata/export artifact unless a clean clone or source archive reproduces
  tracked `hobit-local-git` contents or an absolute `core.worktree`. Verified
  local-only in this checkout.
- Review smoke HTML files located at the frontend Vite root next to production
  `index.html`; decide whether they move under `smoke/dev` or are explicitly
  gated in Vite config.

### P1 - Align contracts with shipped code

- Inventory retired Agent Chat, Agent Monitoring, and proposal-era code paths
  that are still wired in Tauri/frontend modules, then decide whether to
  delete/retire those paths or move the active contract index/current surface
  back into alignment. Completed for docs-only alignment: compatibility status
  and retained wired paths are documented in
  `docs/AGENT_CHAT_MONITORING_COMPATIBILITY_CONTRACT.md`; future optional
  cleanup remains either retire/delete old backend/frontend paths or formally
  keep narrowed compatibility APIs.
- Resolve JDBC contract drift: decide whether read-only query execution is
  current and docs should say so, or whether execution paths should be hidden,
  removed, or deferred. Completed for docs: the bounded mock/safe read-only
  path is Current Preview, while production JDBC execution and hidden
  Coordinator-triggered SQL remain Deferred.
- State or enforce the Terminal PTY platform boundary. The reviewed
  implementation is effectively Windows-only, so current docs/catalog behavior
  should either say that clearly or hide/disable Terminal on unsupported
  platforms.
- Normalize current vs preview vs deferred widget surface language after code
  inventory, without rewriting widget contracts ahead of evidence. Completed in
  `docs/CURRENT_WIDGET_SURFACE.md`; remaining decisions are Agent Chat / Agent
  Monitoring retire vs contract realignment, Terminal non-Windows catalog
  gating vs docs-only limitation, and smoke HTML root cleanup.

### P2 - Reduce change amplification

- Split or refactor large widget files that are roughly 500-700 lines once
  validation and contract alignment are stable.
- Resolve placeholder naming mismatches where placeholder-named widgets already
  contain real product UI.
- Reduce `WorkbenchCanvas` size and responsibility breadth.
- Narrow broad `WorkspaceApi` usage across unrelated widget domains.
- Narrow broad `WidgetRenderProps` coupling.
- Reduce the global workbench action bag so widget slices receive only the
  actions they need.
- Plan a safer approach for manual Rust/Tauri/TypeScript DTO duplication and
  drift risk.

### P3 - Feature cleanup after stabilization

- Continue Notes stabilization and refactor only after the P0/P1 baseline is
  stable.
- Clean up Coordinator / Queue / Executor naming and responsibility boundaries
  after current contracts and Notes stabilization are settled.
- Start new feature work only after the validation, portability, and contract
  baseline above is stable.

## Recommended Follow-Up Task Order

1. Complete Phase 1 authority model baseline.
2. Incorporate AMP findings into stabilization plan.
3. Fix validation/bootstrap blockers.
4. Fix repo portability / git hygiene if applicable.
5. Normalize `CURRENT_WIDGET_SURFACE` against shipped code. Completed; see
   the remaining drift decisions in `docs/CURRENT_WIDGET_SURFACE.md`.
6. Normalize Notes contracts. Completed for the active Notes contracts; known
   remaining follow-ups are Notes smoke checklist coverage, Notes UI/controller
   refactor, dev-only memory Notes API decision, and future delete/archive and
   autosave decisions.
7. Clean Architecture stale references. Completed for
   `docs/ARCHITECTURE.md`; remaining architecture-related decisions are Agent
   Chat / Agent Monitoring retire vs contract realignment, JDBC read-only
   execution current Preview vs hidden/deferred, Terminal non-Windows catalog
   gating vs docs-only limitation, smoke HTML root cleanup, and deferred
   Coordinator / Queue / Executor cleanup.
8. Create the Phase 1 contract drift decision matrix. Completed; see
   `docs/CONTRACT_DRIFT_DECISION_MATRIX.md`.
9. Agent Chat / Agent Monitoring compatibility alignment. Completed for
   docs-only alignment; future optional cleanup remains either old-path
   removal or narrowed compatibility API retention.
10. JDBC Preview contract alignment.
11. Terminal platform limitation decision confirmation.
12. Smoke HTML root cleanup.
13. Smoke checklist discipline.
14. Feature-slice checklist.
15. Phase 1 closeout.
16. Notes UI/controller refactor.
17. Notes dev-only memory API.
18. WorkspaceApi / WidgetRenderProps / action bag cleanup.
19. Coordinator / Queue / Executor naming and responsibility cleanup.

Coordinator / Queue / Executor cleanup is intentionally deferred until current
codebase cleanup and Notes stabilization work are complete, unless a task is
limited to inventory or deferral documentation.

## Codex Working Rules

- One task = one type of change.
- Prefer docs-only tasks before code changes when contracts are unclear.
- Keep diffs small.
- Allowed files must be explicit.
- Do not touch unrelated widgets.
- Do not implement deferred behavior.
- Do not rename persistence IDs unless explicitly requested.
- Summarize changed files and remaining ambiguity in final responses.
