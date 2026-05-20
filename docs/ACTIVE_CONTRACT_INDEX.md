# Active Contract Index

## Purpose

This index tells future agents which Hobit contracts to read for each kind of
work. It is a navigation document, not a new product contract.

Use it to reduce prompt context size and to avoid implementing from stale or
superseded discovery-era documents. When a block needs deeper detail, read the
small default set first, then only the relevant domain contracts.

## Phase 1 Stabilization Baseline

`docs/CURRENT_CODEBASE_STABILIZATION_PLAN.md` is the working baseline for
Phase 1 cleanup tasks.

Phase 1 is about stabilizing the current codebase and contracts, not adding new
product functionality. It covers documentation authority cleanup,
current/planned/deferred separation, stale contract detection, current widget
surface cleanup, known coupling/problem inventory, validation/smoke checklist
preparation, and reducing Codex ambiguity.

The `AMP review findings` section in
`docs/CURRENT_CODEBASE_STABILIZATION_PLAN.md` is an official Phase 1 backlog
input for validation, repository portability, contract drift, and change
amplification cleanup. AMP findings are not product contracts by themselves:
current behavior still must be confirmed against code before contracts are
changed or implementation follow-up work begins.

`docs/CONTRACT_DRIFT_DECISION_MATRIX.md` is the Phase 1 stabilization decision
document for remaining drift areas. It is not the source of truth for current
widget behavior and is not a future product roadmap. It guides cleanup
sequencing, scope boundaries, and follow-up task direction. Current widget
behavior remains governed by `docs/CURRENT_WIDGET_SURFACE.md`.

`docs/development/FEATURE_SLICE_CHECKLIST.md` is the development/process
checklist for future Codex-driven feature slices. It does not override product
contracts, does not expand the global mandatory read set, and does not make
Planned or Deferred behavior current.

`docs/PHASE_1_STABILIZATION_CLOSEOUT.md` is the Phase 1 closeout report. It is
a process/status document only. It does not override product contracts,
`docs/CURRENT_WIDGET_SURFACE.md`, or task-specific domain contracts.

`docs/AGENT_CHAT_MONITORING_COMPATIBILITY_CONTRACT.md` is the Compatibility /
pending-retirement source of truth for retained Agent Chat, Agent Monitoring,
and proposal-era API status. It is not the source of truth for current widget
behavior, current preferred widget names, or Coordinator / Queue / Executor
naming. Current widget behavior remains governed by
`docs/CURRENT_WIDGET_SURFACE.md`, and Coordinator / Queue / Executor naming
cleanup remains deferred.

Testing and smoke checklist docs are process docs only. They do not override
product contracts, do not add current behavior, and do not expand the global
mandatory read set. `docs/CURRENT_WIDGET_SURFACE.md` remains the source of
truth for current widget behavior.

Development/process and closeout docs are also process docs only. They guide
task discipline and reporting, but `docs/CURRENT_WIDGET_SURFACE.md` remains
the current widget behavior truth and task-specific contracts remain the source
of truth for their domains.

- `docs/testing/SMOKE_CHECKLIST_DISCIPLINE.md` - index and category rules for
  current product smoke, preview smoke, dev-only smoke HTML entry points,
  validation/bootstrap checks, and future automation.
- `docs/testing/CURRENT_VALIDATION_SMOKE_CHECKLIST.md` - Phase 1 validation
  baseline and reporting labels for passing checks, expected environment
  failures, known warnings, unresolved blockers, and not-run checks.
- `docs/testing/NOTES_SMOKE_CHECKLIST.md` - current Notes behavior smoke
  checklist; Deferred Notebook behavior remains out of current smoke scope.
- `docs/NOTES_DEV_MEMORY_API_DECISION.md` - Phase 2 Notes decision document
  for the implemented dev-only browser in-memory Notes API. It documents
  dev/browser fallback behavior only and does not override desktop/Tauri Notes
  persistence, production browser persistence deferral, the current Notes
  contracts, or `docs/CURRENT_WIDGET_SURFACE.md`.
- `docs/testing/WORKBENCH_CURRENT_SURFACE_SMOKE_CHECKLIST.md` - high-level
  current Workbench surface smoke map tied to
  `docs/CURRENT_WIDGET_SURFACE.md`.
- `docs/testing/DEV_SMOKE_ENTRYPOINTS.md` - dev-only Vite HTML smoke entry
  points under `apps/desktop/frontend/smoke/dev/`; these are not product
  routes, production widget surfaces, or e2e automation.
- `docs/development/FEATURE_SLICE_CHECKLIST.md` - process checklist for
  docs-only, frontend-only, dev/mock/fallback, persisted workspace,
  runtime/tooling, and compatibility/deprecation feature slices.
- `docs/PHASE_1_STABILIZATION_CLOSEOUT.md` - Phase 1 completion status,
  validation baseline, deferred/backlog items, and recommended Phase 2 start.

Phase 1 does not include new Notes features, Notebook features, Coordinator /
Queue / Executor redesign, component renames, storage migrations, runtime
behavior changes, or automatic agent orchestration changes.

For Phase 1 cleanup work, read:

- `docs/CURRENT_CODEBASE_STABILIZATION_PLAN.md`
- `docs/CONTRACT_DRIFT_DECISION_MATRIX.md` when the task touches remaining
  contract drift cleanup or follow-up sequencing
- `docs/CURRENT_WIDGET_SURFACE.md`
- `docs/CODE_ORGANIZATION.md`
- `docs/ARCHITECTURE.md`

## Default Reading Set

Read this set for almost every future block:

- `AGENTS.md` - repository instructions and hard safety rules.
- `docs/ACTIVE_CONTRACT_INDEX.md` - current contract navigation.
- `docs/CURRENT_WIDGET_SURFACE.md` - current user-facing widget inventory and
  implementation boundaries.
- `docs/CODE_ORGANIZATION.md` - current code organization navigation and Phase
  1 boundaries.
- `docs/ARCHITECTURE.md` - current implemented architecture and bridge
  boundaries.

Do not expand the default reading set. Add task-specific contracts only when
the requested work needs them.

## Contract Statuses

- Current: implemented behavior that exists in the codebase and is safe to
  rely on.
- Preview: implemented behavior that is visible, intentionally limited, and
  not yet a complete product surface.
- Planned: approved next-step behavior, but not necessarily implemented yet.
- Deferred: future behavior that must not be implemented unless a task
  explicitly requests it.
- Compatibility: legacy names, persistence IDs, old component names, old state
  shapes, or aliases that may still exist for backward compatibility but are
  not preferred product/domain names.
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

## Core Active Contracts

- `docs/COORDINATOR_CENTERED_WORKBENCH_CONTRACT.md` - read for Coordinator,
  cross-widget, autonomy, context, or product-model work.
- `docs/WIDGET_CAPABILITY_TOOL_CONTRACT.md` - read when Coordinator or future
  AI surfaces use widgets through controlled capabilities.
- `docs/EVIDENCE_SOURCES_CONTRACT.md` - read for evidence, source
  provenance, AI-readable context approval, citations, or trust-layer work.
- `docs/CURRENT_WIDGET_SURFACE.md` - read before changing catalog, widgets, or
  user-facing current-state language.
- `docs/WIDGET_CONTRACT.md` - read for widget identity, lifecycle,
  presentation, registry, and Workbench composition rules.
- `docs/WORKSPACE_CONTRACT.md` - read for Workspace isolation, Workbench
  boundaries, and persistence-scope decisions.
- `docs/CODE_ORGANIZATION_CONTRACT.md` - read for code structure, module
  splits, and file-size/refactor guidance.
- `docs/PRODUCT_POSITIONING.md` - read for product positioning and to prevent
  drift into hidden automation or a generic script runner.
- `docs/PRODUCT_UI_VISUAL_CONTRACT.md` - read for frontend UI, widget layout,
  and visual polish blocks.
- `docs/TOOL_ACTION_CONTRACT.md` - read for explicit, visible, approval-aware
  action modeling.
- `docs/AI_INTEGRATION_READINESS_CONTRACT.md` - read before Coordinator
  provider/runtime work; it defines the first provider slice boundary with
  explicit visible context only and `allowed_tools: []`.

## Active Domain Contracts

### Agent Executor / Direct Work

- `docs/DIRECT_MODE_AGENT_CONTRACT.md` - Direct Work execution boundary,
  Codex CLI rules, logs/results, and no hidden execution.
- `docs/AGENT_RUN_OBSERVABILITY_CONTRACT.md` - run logs, result, validation,
  history, and observability expectations.
- `docs/GIT_COMMIT_SUPPORT_CONTRACT.md` - read only when Direct Work touches
  commit/review integration.

### Agent Queue

- `docs/AGENT_QUEUE_CONTRACT.md` - older queue/review boundary context.
- `docs/AGENT_QUEUE_PRODUCT_MODEL_CONTRACT.md` - current task organization,
  status, assignment, and future dependency model.
- `docs/QUEUE_TO_EXECUTOR_ASSIGNMENT_CONTRACT.md` - manual assignment from
  Queue tasks to visible Agent Executor slots.
- `docs/QUEUE_ITEM_EXECUTION_CONTRACT.md` - explicit manual run of an assigned
  task in its assigned Executor.

### Git

- `docs/GIT_WIDGET_CONTRACT.md` - Git Widget read/review/control boundaries.
- `docs/GIT_COMMIT_SUPPORT_CONTRACT.md` - explicit local commit support and
  confirmation requirements.

### Notes

- `docs/NOTES_WIDGET_CONTRACT.md` - authoritative current Notes widget
  behavior, current boundaries, Compatibility/Deprecated legacy state, and
  non-goals.
- `docs/NOTES_WIDGET_PRODUCT_CONTRACT.md` - Notes product planning and
  next-slice boundaries for workspace-local Notes and Deferred Notebook
  behavior.
- `docs/NOTES_DEV_MEMORY_API_DECISION.md` - Phase 2 decision for the
  dev-only, non-persistent, frontend-only browser memory Notes API. It is
  current dev/browser fallback behavior only.

### JDBC

- `docs/JDBC_WIDGET_CONTRACT.md` - Database / JDBC Current Preview behavior
  and boundaries, including connector metadata, bounded mock/safe read-only SQL
  validation/execution, secret isolation, production-runtime deferrals, and
  Coordinator SQL execution boundaries. It is not a source of truth for
  production JDBC runtime, broad database automation, or hidden Coordinator
  execution.

### Evidence / Sources

- `docs/EVIDENCE_SOURCES_CONTRACT.md` - future Evidence/Sources trust layer,
  source provenance, evidence lifecycle, capping/redaction, and AI context
  approval boundary.

### UI / Product

- `docs/PRODUCT_UI_VISUAL_CONTRACT.md` - current product visual direction.
- `docs/WIDGET_PROGRESSIVE_DISCLOSURE_CONTRACT.md` - Minimal, Operational, and
  Full / Expert display-level guidance when a widget surface grows.

### Terminal

- `docs/TERMINAL_PTY_WIDGET_CONTRACT.md` - Terminal PTY behavior, safety
  boundaries, and current platform limitations. It is the source of truth for
  the Windows-only shipped live PTY backend limitation, non-Windows
  unsupported-platform behavior, the collapsed one-shot fallback compatibility
  boundary, and Deferred catalog gating / Linux/macOS PTY follow-ups.

## Reference Handoff

- `docs/NEW_CHAT_HANDOFF.md` - compact current-state handoff for starting a
  fresh chat/thread after Blocks 210 through 216. This is a reference note, not
  a default active contract or a replacement for this index.

## Deferred Contracts

These are valid contracts, but they are not active implementation targets
unless a block explicitly names the area:

- `docs/RUNBOOK_WIDGET_CONTRACT.md`
- `docs/TERMINAL_PTY_WIDGET_CONTRACT.md`
- `docs/SCRIPT_RUNNER_WIDGET_CONTRACT.md`
- `docs/TEMPLATE_CONTRACT.md`
- `docs/AGENT_RUNTIME_CONTRACT.md`
- `docs/WORKSPACE_COORDINATOR_AGENT_CONTRACT.md`

Do not read deferred contracts for ordinary Coordinator, Queue, Executor, Git,
Notes, JDBC, or refactor work unless the requested block depends on that
surface.

## Superseded Or Compatibility References

These documents should not override the Coordinator-centered model or
`docs/CURRENT_WIDGET_SURFACE.md`:

- `docs/INTERACTIVE_AGENT_WIDGET_CONTRACT.md` - superseded as a product
  direction by Coordinator Chat, but still useful for compatibility with the
  existing `interactive-agent` widget id/component.
- `docs/AGENT_CHAT_MONITORING_COMPATIBILITY_CONTRACT.md` - source of truth
  only for Agent Chat / Agent Monitoring / proposal-era API Compatibility /
  pending-retirement status and cleanup boundaries.
- Older Agent Chat and Agent Monitoring proposal-era text in
  `docs/WORKSPACE_COORDINATOR_AGENT_CONTRACT.md`,
  `docs/AGENT_RUN_OBSERVABILITY_CONTRACT.md`,
  `docs/WORKSPACE_CONTRACT.md`, and
  `docs/WIDGET_PROGRESSIVE_DISCLOSURE_CONTRACT.md` - useful historical or
  compatibility context, not the current primary user-facing model.
- `docs/PRODUCT_SIMPLIFICATION_AUDIT.md` - historical audit/reference.
- `docs/DEMO_FLOW_CHECKLIST.md` and `docs/DIRECT_MODE_MVP_CHECKLIST.md` -
  reference checklists, not current source-of-truth inventory.

## Choosing Docs Per Block

- Docs-only product model work: read the default set plus the affected domain
  contract.
- Frontend widget UI work: read the default set,
  `docs/PRODUCT_UI_VISUAL_CONTRACT.md`, and the affected widget contract.
- Backend/storage/API work: read the default set,
  `docs/WORKSPACE_CONTRACT.md`, and the affected domain contract.
- Queue work: read `docs/AGENT_QUEUE_PRODUCT_MODEL_CONTRACT.md`; add
  `docs/QUEUE_TO_EXECUTOR_ASSIGNMENT_CONTRACT.md` for assignment and
  `docs/QUEUE_ITEM_EXECUTION_CONTRACT.md` only when execution is involved.
- Coordinator/JDBC work: read
  `docs/COORDINATOR_CENTERED_WORKBENCH_CONTRACT.md`,
  `docs/WIDGET_CAPABILITY_TOOL_CONTRACT.md`, and
  `docs/JDBC_WIDGET_CONTRACT.md`. Add
  `docs/EVIDENCE_SOURCES_CONTRACT.md` when the work touches result sharing,
  citations, AI-readable context, or evidence capture.
- Refactor-only work: read `docs/CODE_ORGANIZATION_CONTRACT.md` and this
  index; read domain contracts only if behavior boundaries could be affected.

## Stale Doc Rule

If any document conflicts with this index or `docs/CURRENT_WIDGET_SURFACE.md`,
treat the conflicting text as stale unless the current task explicitly says
otherwise. Do not implement from stale guidance. Update the stale reference in a
cleanup block or report it explicitly.

## Medical Domain Note

Medical and healthcare workflows are out of the active roadmap due to
privacy, compliance, and safety sensitivity. Do not use medical workflows as a
near-term demo or design driver.

## Maintenance Rule

Update this index when:

- a new major domain contract is added;
- a domain becomes deferred;
- a contract is superseded;
- the current widget surface changes;
- the Coordinator-centered model changes.

Do not update this index for every small UI or code change.
