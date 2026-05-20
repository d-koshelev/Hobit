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

## Known Problem Inventory

These are known cleanup areas for follow-up tasks. Do not solve them inside a
baseline task unless the task explicitly allows that scope.

- Conflicting Notes contracts across minimal widget-state draft behavior,
  workspace-local Notes storage/API behavior, and future Notebook direction.
- Stale Architecture references that mix current behavior, compatibility paths,
  and future/deferred behavior in long narrative sections.
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
  Tauri icon assets under `apps/desktop/src-tauri/icons/`.
- Improve `scripts/hobit/validate.sh` failure reporting when frontend
  dependencies, `node_modules`, or `tsc` are missing, so bootstrap failures are
  actionable instead of opaque. Fixed by adding a frontend dependency preflight
  that reports the missing local TypeScript toolchain and the required
  `npm ci --prefix apps/desktop/frontend` bootstrap command before npm
  validation steps run.
- Verify real-repository Git portability for `.git` gitdir pointers and
  `hobit-local-git` configuration, including reviewed cases where an absolute
  Windows path broke `git status` outside the original environment. Do not edit
  `.git` as part of backlog documentation.
- Review smoke HTML files located at the frontend Vite root next to production
  `index.html`; decide whether they move under `smoke/dev` or are explicitly
  gated in Vite config.

### P1 - Align contracts with shipped code

- Inventory retired Agent Chat, Agent Monitoring, and proposal-era code paths
  that are still wired in Tauri/frontend modules, then decide whether to
  delete/retire those paths or move the active contract index/current surface
  back into alignment.
- Resolve JDBC contract drift: decide whether read-only query execution is
  current and docs should say so, or whether execution paths should be hidden,
  removed, or deferred.
- State or enforce the Terminal PTY platform boundary. The reviewed
  implementation is effectively Windows-only, so current docs/catalog behavior
  should either say that clearly or hide/disable Terminal on unsupported
  platforms.
- Normalize current vs preview vs deferred widget surface language after code
  inventory, without rewriting widget contracts ahead of evidence.

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
5. Normalize `CURRENT_WIDGET_SURFACE` against shipped code.
6. Normalize Notes contracts.
7. Clean Architecture stale references.
8. Add smoke checklist discipline.
9. Start Notes-focused refactor.
10. Then handle Coordinator / Queue / Executor.

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
