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

## Recommended Follow-Up Task Order

1. Contract authority cleanup.
2. Current widget surface cleanup.
3. Notes contract normalization.
4. Architecture stale reference cleanup.
5. Notes smoke checklist.
6. Feature-slice checklist.
7. Notes UI/controller refactor.
8. Notes dev-only memory API.
9. WorkspaceApi/domain API cleanup.
10. WidgetRenderProps/action bag cleanup.
11. DTO contract checks.
12. Coordinator / Queue / Executor naming and responsibility cleanup.

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
