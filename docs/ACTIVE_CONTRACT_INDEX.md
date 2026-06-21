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

`docs/DEVELOPMENT_EFFICIENCY_RULE.md` is the mandatory docs-only process rule
for token-efficient development. It requires current-blocker-only work,
smallest necessary file/context sets, targeted inspection, smallest sufficient
validation, and short reports. It does not override product contracts or permit
agents to skip validation that is needed to prove a task.

`docs/WIDGET_IMPLEMENTATION_PLAYBOOK.md` is the docs-only process contract for
contract-first new widget and major widget change work. It requires product
scenario, Widget API, state machine, UI composition, action/event, semantic
test, file/component budget, and out-of-scope planning before implementation.
It does not add runtime behavior, frontend UI, backend APIs, storage/schema,
semantic test runner behavior, or new widgets.

`docs/AGENT_UI_IMPLEMENTATION_RULES.md` is the docs-only process contract for
future agent UI implementation and polish work. It requires agents to read the
UI design system contract, inspect shared primitives, identify the target
surface and current pattern, run mandatory UI acceptance checks, use focused
validation, and report shared primitive usage, CSS rationale, responsive and
overflow behavior, action states, and manual smoke results. It does not add
frontend behavior, CSS, backend APIs, storage/schema, tests, validation
automation, or new widgets.

`docs/UI_STANDARDS_STATUS.md` is the docs-only status record for the
project-level UI standards block. It summarizes the UI current-state audit,
design system contract, shared primitives index, agent UI implementation rules,
review/self-test backlog, hard UI product decisions, recommended next
implementation blocks, and manual review checklist. It does not add frontend
behavior, CSS, backend APIs, storage/schema, tests, validation automation, or
new widgets.

`docs/UI_STANDARDS_ENFORCEMENT_STATUS.md` is the docs-only status record for
the project-level UI standards enforcement block. It records implementation
audit status, spacing/token expectations, popup shell enforcement, topbar/action
menu/confirmation normalization, high-traffic surface adoption, manual smoke
checklists, and remaining enforcement follow-ups. It does not add frontend
behavior, CSS, backend APIs, storage/schema, tests, validation automation, or
new widgets.

`docs/MANUAL_SMOKE_UI_FOLLOWUP_PLAN.md` is the docs-only checkpoint for current
manual smoke UI follow-up findings and exclusions. It records the next
QueueV2, Workspace Agent, Knowledge / Skills, Notes, Terminal, and
Coordinator/agents UI direction, explicitly keeps Finder out of scope, and
documents warning-only file-size validation policy for that follow-up track. It
does not add frontend behavior, CSS, backend APIs, storage/schema, runtime
behavior, validation automation, or new widgets.

`docs/FRONTEND_ORGANIZATION_CLEANUP_PLAN.md` is the docs-only checkpoint for
the frontend organization cleanup track from the static audit. It records the
Queue active-surface and CSS ownership findings, workbench root overload,
compatibility-surface isolation, shared confirmation migration, design-system
barrel import policy, active Workspace Agent path audit, Queue root-file split,
warning-only dead-code audit direction, and explicit Finder exclusion. It does
not add frontend behavior, CSS, backend APIs, storage/schema, runtime behavior,
validation automation, widget id changes, or new widgets.

`docs/WIDGET_CONTRACT_TEMPLATE.md` is the reusable docs-only template for
authoring widget contracts before implementation. It includes Queue and Finder
examples for planning vocabulary only; current Finder behavior is governed by
the explicitly scoped Stable v0.1 Finder surface in
`docs/CURRENT_WIDGET_SURFACE.md`.

`docs/PHASE_1_STABILIZATION_CLOSEOUT.md` is the Phase 1 closeout report. It is
a process/status document only. It does not override product contracts,
`docs/CURRENT_WIDGET_SURFACE.md`, or task-specific domain contracts.

`docs/ARCHITECTURE_MILESTONE_STATUS.md` is the current checkpoint after the
desktop/server-ready, runtime artifact, audit, capability, artifact,
knowledge/evidence, Context Pack foundation refactor series, and Minimal Skill
Library MVP. It is a status/roadmap note and does not add behavior beyond that
MVP, Workspace Agent context wiring, audit emission, server runtime, or RBAC.

`docs/AGENT_CHAT_MONITORING_COMPATIBILITY_CONTRACT.md` is the Compatibility /
pending-retirement source of truth for retained Agent Chat, Agent Monitoring,
and proposal-era API status. It is not the source of truth for current widget
behavior, current preferred widget names, or Workspace Agent / Queue / Executor
naming. Current widget behavior remains governed by
`docs/CURRENT_WIDGET_SURFACE.md`. Legacy Coordinator compatibility names may
remain in code and filenames until explicit migration/refactor work.

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
- `docs/MVP_ACCEPTANCE_WALKTHROUGH.md` - manual Workspace Agent MVP
  acceptance walkthrough covering Start Screen/recent Workspaces, Workspace
  Agent runs, Knowledge / Skills, Git, Terminal, Agent Activity, theme/UI
  scale, movable widgets, Queue execution, Executor review, and visible-context
  safety checks.
- `docs/KNOWLEDGE_SKILLS_STABLE_V0_1_STATUS.md` - docs-only Knowledge /
  Skills Stable v0.1 acceptance status record after focused automated
  implementation/tests. It records automated pass/manual-smoke-pending status
  for Skill CRUD/attach, Document CRUD/import/search, quick summaries,
  Queue-based Knowledge generation drafts, draft review, Queue context attach,
  prompt materialization, and safety/non-goals. It does not add behavior or
  override current widget contracts.
- `docs/KNOWLEDGE_POST_RUN_AUDIT.md` - inspect-only post-run audit for the
  Knowledge Catalog implementation queue. It records implemented partial
  Catalog fields, Queue-based generation task creation, draft review,
  Queue-context attach/materialization, Finder/Notes integrations, safety
  status, docs drift, and file-size blockers. It does not add behavior or
  override current widget contracts.
- `docs/KNOWLEDGE_PRODUCTION_STATUS.md` - docs-only production-readiness
  status record for Knowledge / Skills. It records the current MVP versus
  production gaps for fields/API, draft ledger, Queue context durability,
  source refs, search/safety, limitations, and future exclusions. It does not
  add behavior or override current widget contracts.
- `docs/KNOWLEDGE_PRODUCTION_SMOKE_CHECKLIST.md` - docs-only manual and
  automated smoke checklist for Knowledge production readiness. It records
  smoke steps for Knowledge, Skills, generation, draft review, provenance,
  Workspace Agent attach, Queue attach/materialization, disabled/rejected/
  stale behavior, caps/secret warnings, and no hidden context. It does not add
  behavior, validation automation, or acceptance status by itself.
- `docs/KNOWLEDGE_PRODUCTION_POST_RUN_AUDIT.md` - inspect-only post-run audit
  after the Knowledge production implementation pack. It records readiness,
  implemented durable Knowledge fields/versioning, draft review ledger, durable
  Queue context, context materialization/evidence, source refs, safety status,
  docs drift, maintainability risks, and remaining manual smoke. It does not
  add behavior or override current widget contracts.
- `docs/KNOWLEDGE_MODULE_CLEANUP_AUDIT.md` - docs-only reference cleanup
  contract for the current Knowledge module route, compatibility constraints,
  legacy/V2 inventory, API/storage map, agent capability direction, regex
  routing warning, target source structure, and ordered cleanup blocks. It is
  not a product runtime contract and does not add frontend behavior,
  backend/Rust/Tauri/storage/schema changes, widget id changes, Queue behavior,
  Workspace Agent behavior, or Knowledge data changes.
- `docs/KNOWLEDGE_V2_STATUS.md` - docs-only status record for KnowledgeV2
  Foundation Block 001. It records the experimental frontend KnowledgeV2
  manifest/shell, unified Documents plus Skills catalog model, browse/preview
  surface, explicit action popups, partial data/action bridges, safe context
  affordances, limitations, smoke checklist, and next blocks. It does not add
  behavior or replace current Knowledge / Skills.
- `docs/KNOWLEDGE_V2_VISUAL_TARGET_CONTRACT.md` - docs-only visual/product
  target contract for future KnowledgeV2 UI hardening. It records the accepted
  dark Hobit module surface, dense unified catalog list, selected-item preview,
  explicit action popups, target-based context attach safety, catalog statuses,
  and non-goals. It does not add frontend behavior, backend/storage/schema
  changes, hidden context injection, auto-import/create/run behavior, or
  replace current Knowledge / Skills.
- `docs/KNOWLEDGE_V2_VISUAL_HARDENING_STATUS.md` - docs-only status record
  for KnowledgeV2 Visual Hardening Block 001. It records the completed visual
  target alignment, dense catalog layout, preview details, action popups,
  target-based context picker, lifecycle/empty/unavailable state polish,
  manual smoke checklist, remaining bridge/import/draft-review gaps, and the
  decision not to replace legacy Knowledge / Skills yet. It does not add
  behavior or override current Knowledge / Skills.
- `docs/KNOWLEDGE_V2_EXPOSURE_STATUS.md` - docs-only status record for routing
  the user-facing Knowledge / Skills product surface to KnowledgeV2 through
  the saved-compatible `skill-library` identity. It records catalog/registry
  routing, existing props/action bridge reuse, legacy containment, manual
  smoke steps, and remaining import/action/full-replacement gaps. It does not
  add frontend behavior, backend/Rust/Tauri/storage/schema changes, or
  Knowledge data changes.
- `docs/KNOWLEDGE_V2_BRIDGE_CLEANUP_STATUS.md` - docs-only status record for
  KnowledgeV2 bridge completion and UX cleanup. It records bridge audit, data
  bridge completion, compact partial-state UX, table/preview polish,
  per-action availability cleanup, manual smoke steps, and remaining bridge,
  file picker import, and legacy-removal gaps. It does not add frontend
  behavior, backend/Rust/Tauri/storage/schema changes, Queue/Agent runtime
  behavior, or Knowledge data changes.
- `docs/KNOWLEDGE_V2_SURFACE_POLISH_STATUS.md` - docs-only status record for
  KnowledgeV2 final surface polish after manual screenshot review. It records
  table row/action polish, clean Overview behavior, compact warning/status
  presentation, small catalog/responsive layout polish, manual smoke steps,
  and remaining bridge, summary-generation, and legacy-removal gaps. It does
  not add frontend behavior, backend/Rust/Tauri/storage/schema changes,
  Queue/Agent runtime behavior, or Knowledge data changes.
- `docs/KNOWLEDGE_V2_POPUP_ONLY_LAYOUT_STATUS.md` - docs-only status record
  for the KnowledgeV2 popup-only layout transition. It records the default
  removal/default-hiding of the permanent right preview, item details popup,
  bounded Use as Context popup, shared popup header/body/footer behavior, row
  action menu states, topbar spacing, manual smoke checklist, and remaining
  follow-ups. It does not add frontend behavior, backend/Rust/Tauri/storage/
  schema changes, Queue/Workspace Agent runtime behavior, automatic context
  injection, or Knowledge data changes.
- `docs/KNOWLEDGE_V2_PRODUCT_SURFACE_CORRECTION_STATUS.md` - docs-only status
  record for the KnowledgeV2 product-surface correction after popup-only
  manual smoke. It records the catalog-only main surface, wide/bounded item
  details popup, simplified copy and warnings, row actions product menu,
  topbar/catalog layout correction, manual smoke checklist, and remaining
  follow-ups. It does not add frontend behavior, backend/Rust/Tauri/storage/
  schema changes, Queue/Workspace Agent runtime behavior, hidden context
  injection, automatic create/import/attach/run behavior, or a route back to
  the legacy Knowledge / Skills surface.
- `docs/testing/DEV_SMOKE_ENTRYPOINTS.md` - dev-only Vite HTML smoke entry
  points under `apps/desktop/frontend/smoke/dev/`; these are not product
  routes, production widget surfaces, or e2e automation.
- `docs/DEVELOPMENT_EFFICIENCY_RULE.md` - mandatory process rule for
  token-efficient development: current blocker only, smallest relevant context,
  targeted inspection, smallest sufficient validation, and short reports.
- `docs/development/FEATURE_SLICE_CHECKLIST.md` - process checklist for
  docs-only, frontend-only, dev/mock/fallback, persisted workspace,
  runtime/tooling, and compatibility/deprecation feature slices.
- `docs/WIDGET_IMPLEMENTATION_PLAYBOOK.md` - contract-first widget
  implementation process, Definition of Ready/Done, Widget API, state machine,
  UI composition, semantic testing, block hygiene, and file/component budget
  rules for new widgets and major widget changes.
- `docs/AGENT_UI_IMPLEMENTATION_RULES.md` - process contract for future agent
  UI implementation and polish work, including shared primitive inspection,
  mandatory acceptance checks, focused validation, and required UI task report
  fields.
- `docs/FRONTEND_STRUCTURE_CONTRACT.md` - canonical frontend ownership and
  placement model for shared primitives, widget-local components, popups,
  and debug surfaces.
- `docs/WIDGET_CONTRACT_TEMPLATE.md` - reusable widget contract template for
  planning purpose, user, scenario, Widget API shape, state machine, UI
  composition, safety, semantic tests, file plan, validation, acceptance, and
  future compatibility notes.
- `docs/PHASE_1_STABILIZATION_CLOSEOUT.md` - Phase 1 completion status,
  validation baseline, deferred/backlog items, and recommended Phase 2 start.
- `docs/ARCHITECTURE_MILESTONE_STATUS.md` - foundation refactor checkpoint,
  type-only/contract-only boundaries, non-goals, and next roadmap groupings.

Phase 1 does not include new Notes features, Notebook features, Workspace Agent /
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

- `docs/COORDINATOR_CENTERED_WORKBENCH_CONTRACT.md` - legacy-named active
  contract for Workspace Agent, cross-widget, autonomy, context, or
  product-model work. Coordinator was the previous name for the Workspace
  Agent surface. Workspace Agent is a foreground interactive AI agent widget;
  multiple Workspace Agents may exist in one Workspace. Queue organizes
  promoted async work. Agent Executor is internal/compatibility Direct Work
  runtime detail; Queue owns the operator-facing local executor flow.
- `docs/WORKSPACE_COORDINATOR_AGENT_CONTRACT.md` - legacy-named contract for
  target Workspace Agent capability architecture, agent modes,
  safety/action levels, widget capability use, and Queue/Executor role
  boundaries. It is docs-only target architecture and does not add current
  runtime behavior.
- `docs/WORKSPACE_AGENT_COORDINATOR_MODEL.md` - active docs-only architecture
  contract for the MVP single Workspace Agent Coordinator model, the canonical
  per-Workspace Agent Queue ledger, Coordinator identity, explicit
  coordinate-versus-execute boundaries, semantic widget testing, and future
  multi-coordinator compatibility. It does not add multi-coordinator runtime,
  Queue runtime behavior, storage/schema, provider tools, or widget action
  execution.
- `docs/WORKSPACE_WIDGET_API_CONTRACT.md` - active docs-only architecture
  contract for Widget APIs as app-native Workspace capability boundaries:
  identity, safe state snapshots, capabilities, actions, events, evidence/logs,
  test hooks, safety policy, app-native action rules, and semantic widget
  testing. It does not add runtime APIs, Finder, storage/schema, backend/Tauri
  commands, provider tools, or widget behavior changes.
- `docs/UNIVERSAL_WIDGET_SHELL_CONTRACT.md` - active docs-only type-design
  contract for universal widget shell and pane layout vocabulary. It defines
  Widget as shell/container, Workspace API as logic/state/action owner, and
  Pane as visualization, including pane states and pane types. It does not add
  frontend UI, backend/Tauri commands, storage/schema, Finder implementation,
  Terminal split panes, runtime behavior, or widget behavior changes.
- `docs/WIDGET_UNIFICATION_CONTRACT.md` - active docs-only shared widget shell
  and layout contract for future WidgetFrame, WidgetInfo, WidgetPopupShell,
  layout-zone, responsibility-model, and migration-order work. It does not add
  frontend UI, backend/Tauri commands, storage/schema, WidgetHost rewrites,
  WorkbenchCanvas rewrites, Workspace API splits, runtime behavior, or broad
  visual redesign.
- `docs/WIDGET_UNIFICATION_STATUS.md` - docs-only status record for the first
  widget unification foundation block. It summarizes the unification contract,
  shell/runtime audit, info/popup primitive pilot, WidgetRuntimeContext design,
  safe next migrations, blocked areas, and recommended implementation blocks.
  It does not override the active unification contract or current widget
  surface.
- `docs/WIDGET_V2_PLATFORM_CONTRACT.md` - docs-only Widget V2 platform
  contract for future ideal widgets. It defines Widget V2 as a clean new
  architecture, not a current widget migration; existing widgets remain V1 /
  compatibility surfaces, with QueueV2 recommended as the first V2 pilot. It
  does not add frontend UI, backend/Tauri commands, storage/schema,
  WidgetHost rewrites, WorkspaceApi splits, runtime behavior, or current widget
  migration.
- `docs/WIDGET_V2_RUNTIME_INTENTS_CONTRACT.md` - docs-only Widget V2 action
  intent and domain service boundary contract. It defines typed Widget V2
  intents, QueueService, KnowledgeService, WorkspaceAgentService,
  TerminalService, FinderService, and later internal WorkspaceGitService
  boundaries. It does not add frontend UI, backend/Tauri commands,
  storage/schema, WorkspaceApi splits, runtime behavior, current widget
  migration, or new capabilities.
- `docs/WIDGET_RUNTIME_CONTEXT_STATUS.md` - docs-only status record for the
  Block 003 minimal WidgetRuntimeContext foundation and Knowledge / Skills
  pilot. It records compatibility status, focused tests, remaining host/canvas/
  API risks, and recommends the next Queue v2 runtime-context board-shell
  pilot or a lower-risk WidgetInfo migration batch. It does not add behavior or
  override the active unification contract or current widget surface.
- `docs/AGENT_QUEUE_WIDGET_API_CONTRACT.md` - first concrete Workspace Widget
  API contract for Agent Queue. It defines the singleton Queue identity,
  snapshot, item shape, app-native actions, QueuePatch model, events,
  evidence/report semantics, state machine, autonomous Queue boundary, safety
  classes, semantic test hooks, and Workspace Agent Coordinator integration.
  It is docs-only and does not add runtime APIs, frontend behavior,
  storage/schema changes, provider tools, Git automation, or hidden execution.
- `docs/AGENT_QUEUE_WIDGET_API_IMPLEMENTATION_PLAN.md` - docs-only
  implementation-facing plan for the first Queue Widget API slice:
  `queue.getSnapshot`, `queue.createItem`, and `queue.updateItem`. Read before
  implementing the first adapter/Workspace Agent bridge. It does not add
  runtime APIs, frontend behavior, backend/Tauri commands, storage/schema
  changes, tests, provider tools, Queue execution, or hidden automation.
- `docs/WIDGET_IMPLEMENTATION_PLAYBOOK.md` - read before any new widget or
  major widget change. It defines the contract-first planning packet,
  Definition of Ready/Done, state machine, UI composition, semantic testing,
  block hygiene, refactor, and file/component budget rules.
- `docs/WIDGET_CONTRACT_TEMPLATE.md` - use when drafting a new widget contract
  or major widget change contract. It is a reusable process/template document,
  not a current behavior contract by itself.
- `docs/WIDGET_CAPABILITY_TOOL_CONTRACT.md` - read when Workspace Agent or future
  AI surfaces use widgets through controlled capabilities.
- `docs/WORKSPACE_CAPABILITY_BOUNDARY_CONTRACT.md` - read for Workspace
  Capability Boundary v0 vocabulary. It is type scaffolding only and does not
  add capability execution, permission checks, audit emission, server runtime,
  RBAC, storage, DTO, Tauri, frontend, or widget behavior changes.
- `docs/HOBIT_AGENT_CAPABILITY_RUNTIME.md` - read before changing agent
  capability metadata, Action Broker behavior, Widget Agent Contracts, or
  Module Control Surface metadata. `ModuleControlSurface` is the generic
  agent-facing module contract for typed module capabilities and future typed
  workflows. `ModuleControlSurfaceRegistry` is the UI-independent discovery
  layer for registered agent-facing module surfaces; Queue is the first
  registered module, and Queue capability metadata is adapted from the Queue
  capability contract inventory for the generic surface. Registry metadata is
  not runtime behavior. UI widgets are not executable module APIs, and Codex
  is a provider/worker implementation rather than the module integration
  architecture.
- `docs/EVIDENCE_SOURCES_CONTRACT.md` - read for evidence, source
  provenance, AI-readable context approval, citations, or trust-layer work.
- `docs/EVENT_AUDIT_ENVELOPE_CONTRACT.md` - read for Event/Audit Envelope v0
  vocabulary work; it is type scaffolding only and does not add audit
  persistence, server runtime, organizations, or RBAC.
- `docs/AUDIT_EVENT_MAPPING_PLAN.md` - read for future audit adoption
  readiness across current Workspace, widget, Queue, Direct Work, Terminal,
  Git, JDBC, Workspace Agent, Notes, and Runbook surfaces. It is a mapping plan
  only and does not add audit persistence or event emission.
- `docs/ARTIFACT_REFERENCE_OWNERSHIP_CONTRACT.md` - read for Artifact
  Reference / Ownership v0 vocabulary. It is type scaffolding only and does
  not add an artifact store, artifact persistence, schema changes, audit
  emission, evidence store, knowledge store, runtime wiring, frontend
  behavior, server runtime, or RBAC.
- `docs/KNOWLEDGE_SKILLS_EVIDENCE_CONTRACT.md` - read for Knowledge, Skills,
  Evidence, Context Pack, and Runbook boundaries. The current Knowledge /
  Skills MVP includes workspace-local Skill CRUD plus workspace-local and
  local-global plain-text/Markdown Knowledge Document CRUD/search/import,
  enabled-only visible retrieval for Workspace Agent Codex runs, and selected
  Skill attach. Current Rust refs live in `crates/hobit-app/src/knowledge/`
  and `crates/hobit-app/src/context_packs/` partly as type scaffolding. They do
  not add an evidence store, Context Pack store, hidden ingestion, team/server
  knowledge, server runtime, or RBAC.
- `docs/KNOWLEDGE_CATALOG_CONTRACT.md` - read for full Knowledge Catalog
  product-model or type-design work and for the current partial
  catalog-shaped Knowledge Document fields. It defines explicit global and
  workspace-local project memory, item types, required fields, scopes,
  lifecycle, operations, visible Agent/Queue context rules, and no hidden AI
  memory. The full Catalog remains future; the current Knowledge / Skills
  implementation has partial document fields only and this contract does not
  add storage, schema, frontend UI, backend/Tauri commands, provider behavior,
  Queue behavior, Workspace Agent behavior, automatic ingestion, or runtime
  execution.
- `docs/KNOWLEDGE_PRODUCTION_CONTRACT.md` - production-readiness readiness
  contract for explicit Knowledge / Skills architecture before implementation.
  It defines production item model completeness, durable Queue-owned draft
  context linkage, required version/provenance fields, and explicit safety
  boundaries (no hidden memory, no vector search, no auto-ingest).
- `docs/KNOWLEDGE_GENERATION_WORKFLOW_CONTRACT.md` - read for Queue-based
  Knowledge generation workflow work. It records the current partial behavior
  for visible/manual Queue task creation and draft-pack review, and defines the
  future structured source-ref/generation workflow. It does not add storage,
  schema, frontend UI, backend/Tauri commands, provider tools, Queue
  execution, background ingestion, hidden memory, vector search, folder
  watching, or automatic activation.
- `docs/KNOWLEDGE_DRAFT_REVIEW_PERSISTENCE_DECISION.md` - read with
  `docs/KNOWLEDGE_GENERATION_WORKFLOW_CONTRACT.md` before proposing durable
  draft review storage, accepted/rejected draft handling, Queue task review
  linkage, audit readiness, or Evidence linkage. It decides that Stable v0.1
  persists accepted drafts only through explicit Knowledge Document acceptance
  while rejected draft decisions remain review-local unless recorded through an
  existing explicit Queue surface.
- `docs/KNOWLEDGE_QUEUE_CONTEXT_CONTRACT.md` - read for Queue task Knowledge /
  Skills attachment semantics. It records current durable Queue-owned attach /
  detach context refs, bounded materialized snapshots, warnings, token budget,
  prompt materialization, and remaining future execution evidence requirements.
  It does not add new storage, schema, frontend UI, backend/Tauri commands,
  provider behavior, Queue execution, hidden memory, or automatic context
  injection.
- `docs/QUEUE_KNOWLEDGE_CONTEXT_DURABILITY_DECISION.md` - read with
  `docs/KNOWLEDGE_QUEUE_CONTEXT_CONTRACT.md` only for historical decision
  context. Its original frontend-local/current-session deferral was superseded
  by the Knowledge production pack; current behavior is governed by
  `docs/KNOWLEDGE_QUEUE_CONTEXT_CONTRACT.md` and
  `docs/CURRENT_WIDGET_SURFACE.md`.
- `docs/KNOWLEDGE_SKILLS_WIDGET_AUDIT.md` - inspect-only audit for the current
  Knowledge / Skills implementation, Stable v0.1 MVP inclusion decision,
  known gaps, and recommended next blocks. Read before future Knowledge /
  Skills scope, Queue context, or acceptance-hardening work.
- `docs/KNOWLEDGE_POST_RUN_AUDIT.md` - inspect-only post-run audit after the
  Knowledge Catalog prompt queue. Read before future Knowledge Catalog,
  Queue-context durability, Finder/Notes Knowledge integration, or
  Knowledge-related docs drift cleanup work.
- `docs/ARCHITECTURE_MILESTONE_STATUS.md` - read before beginning Knowledge,
  Skills, Evidence, Artifact, or Context Pack UI/storage work. It summarizes
  what the recent foundation series completed, what remains type-only, and
  which future steps are safe docs/inspect-first blocks.
- `docs/CURRENT_WIDGET_SURFACE.md` - read before changing catalog, widgets, or
  user-facing current-state language. Stable v0.1 product-surface language
  treats Workspace Agent plus Agent Queue as the core dogfooding loop, Terminal
  as the explicit command surface, Finder as the file/project navigation
  surface, and Agent Executor plus Git as supporting/compatibility surfaces
  rather than product widgets.
- `docs/WIDGET_CONTRACT.md` - read for widget identity, lifecycle,
  presentation, registry, and Workbench composition rules.
- `docs/WORKSPACE_CONTRACT.md` - read for Workspace isolation, Workbench
  boundaries, and persistence-scope decisions.
- `docs/CODE_ORGANIZATION_CONTRACT.md` - read for code structure, module
  splits, and file-size/refactor guidance.
- `docs/DESKTOP_FIRST_SERVER_READY_ARCHITECTURE_CONTRACT.md` - read for
  deployment-host boundaries, future server-ready architecture guardrails,
  runtime adapter rules, artifact/event/audit readiness, and
  Knowledge/Skills/Evidence/Artifact separation.
- `docs/PRODUCT_POSITIONING.md` - read for product positioning and to prevent
  drift into hidden automation or a generic script runner.
- `docs/PRODUCT_UI_DESIGN_CONTRACT.md` - read for frontend UI information
  hierarchy, production/debug detail boundaries, state semantics, Queue right
  rail design, and UI review checklist.
- `docs/PRODUCT_UI_VISUAL_CONTRACT.md` - read for frontend UI, widget layout,
  and visual polish blocks.
- `docs/TOOL_ACTION_CONTRACT.md` - read for explicit, visible, approval-aware
  action modeling.
- `docs/AI_INTEGRATION_READINESS_CONTRACT.md` - read before Workspace Agent
  provider/runtime work; it defines the first provider slice boundary with
  explicit visible context only and `allowed_tools: []`.
- `docs/WORKSPACE_AGENT_V2_FOUNDATION_STATUS.md` - docs-only status record for
  the completed Workspace Agent v2 foundation scaffold. It records the
  AgentRuntime provider types foundation, WorkspaceAgentV2 experimental
  manifest/shell, transcript/composer scaffold, activity pane scaffold,
  context strip scaffold, current limits, safety boundaries, recommended next
  implementation blocks, and manual visual smoke checklist. It does not add
  runtime behavior or replace Workspace Agent V1.
- `docs/WORKSPACE_AGENT_V2_DIRECT_RUN_STATUS.md` - docs-only status record for
  WorkspaceAgentV2 Direct Run Block 001. It records the Direct Run audit,
  Codex provider adapter, Direct Run controller, UI wiring, result review
  cards, experimental smoke path, what is real versus inert, safety boundaries,
  manual smoke checklist, and recommended next blocks. It does not add runtime
  behavior, Queue Run behavior, Claude/Amp providers, or replace Workspace
  Agent V1.
- `docs/WORKSPACE_AGENT_V2_QUEUE_RUN_STATUS.md` - docs-only status record for
  WorkspaceAgentV2 Queue Run Block 001. It records the Queue Run audit, typed
  Queue Run service, Queue Run controller, UI wiring, visible context
  attachment, created-task result card/open actions, exact no-auto-run
  behavior, safety boundaries, manual smoke checklist, and recommended next
  blocks. It does not add runtime behavior, Queue scheduler/Autorun behavior,
  Direct Run behavior, Claude/Amp providers, or replace Workspace Agent V1.
- `docs/WORKSPACE_CHAT_QUEUE_CONTROL_STATUS.md` - docs-only status record for
  Workspace Chat -> Queue Control Block 001. It records the audit, typed Queue
  action model/service, create-task-from-chat behavior, Queue status/report
  cards, explicit Queue control actions, unsupported validation/diff review/
  rollback states, unchanged Queue runtime/scheduler semantics, manual smoke
  checklist, and recommended next functional blocks. It does not add frontend
  behavior, backend/runtime behavior, storage/schema changes, Queue scheduling,
  validation execution, diff review execution, rollback execution, Git
  mutation, Terminal launch, provider tools, or Workspace Agent/KnowledgeV2
  replacement behavior.
- `docs/PROMPT_PACK_IMPORT_QUEUE_STATUS.md` - docs-only status record for
  Prompt Pack Import -> Queue Items Block 001. It records the prompt-pack
  audit, frontend parser/model, preview service, confirmed Queue
  materialization through existing Queue bridge actions, Workspace Chat import
  card, QueueV2 prompt-pack metadata display, no-auto-run behavior, manual
  smoke checklist, remaining limitations, and recommended next functional
  blocks. It does not add frontend behavior, backend/runtime behavior,
  storage/schema changes, Queue scheduling, validation execution, diff review
  execution, rollback execution, Git mutation, Terminal launch, provider
  tools, or Workspace Agent/QueueV2/KnowledgeV2 replacement behavior.
- `docs/PROMPT_PACK_IMPORT_PRODUCT_ACTION_FIX_STATUS.md` - docs-only status
  record for the failed self-development prompt-pack import manual smoke and
  product-action wiring fix expectation. It records that preview passed but
  create/cancel controls were missing, confirmation routed through Codex text,
  no tasks were created, raw SQLite/shell investigation occurred, and no run,
  finalization, commit, or push occurred. It also records the fixed expected
  behavior, rerun procedure from import preview, pass/fail criteria, and next
  work. It does not add frontend behavior, backend/runtime behavior,
  storage/schema changes, Queue scheduling, dependency execution, Git
  mutation, Terminal launch, provider tools, automatic finalization, commit,
  push, rollback, or Workspace Agent/QueueV2 replacement behavior.
- `docs/SELF_DEVELOPMENT_PRODUCT_PATH_FIX_STATUS.md` - docs-only status record
  for the self-development product path blocker rerun after prompt-pack import
  product-action and intent-routing fixes. It records observed blockers
  including folder path source unavailable, missing prompt bodies after
  `prompt-batch.json` parse, pasted Markdown importing one draft task, missing
  ready/run action, and Queue validation unavailable; fixed expected behavior;
  exact rerun steps; and pass/fail criteria. It does not add frontend
  behavior, backend/runtime behavior, storage/schema changes, Queue
  scheduling, Agent Executor execution, validation automation, Diff Review
  execution, Git mutation, Terminal launch, provider tools, automatic
  finalization, commit, push, rollback, or dependency execution.
- `docs/VALIDATION_RUNNER_EVIDENCE_STATUS.md` - docs-only status record for
  Validation Runner / Evidence Block 001. It records the validation audit,
  typed command/evidence model, runner service/adapter, Queue evidence
  attachment through existing Queue report state, Workspace Chat validation
  controls/cards, QueueV2 evidence display, explicit-only run behavior,
  output caps, unsupported states, manual smoke checklist, and remaining
  durable evidence ledger, full log ref, cancellation/timeout, diff review,
  and coordinator finalization gating gaps. It does not add frontend behavior,
  backend/runtime behavior, storage/schema changes, Queue scheduling,
  dependency execution, Git mutation, Terminal launch, provider tools, or
  Workspace Agent/QueueV2 replacement behavior.
- `docs/DIFF_REVIEW_WORKFLOW_STATUS.md` - docs-only status record for Diff
  Review Item Workflow Block 001. It records the audit, model/checklist, input
  snapshot resolver, explicit Queue item creation, Workspace Chat action/card,
  QueueV2 display, expected no-auto-run/read-only behavior, manual smoke
  checklist, remaining execution/report-parsing/finalization/rollback/live-diff
  gaps, and recommended next blocks. It does not add frontend behavior,
  backend/runtime behavior, storage/schema changes, Queue scheduling, Agent
  Executor execution, Git mutation, Terminal launch, provider tools,
  automatic finalization, commit, push, rollback, or dependency unblocking.
- `docs/COORDINATOR_FINALIZATION_COMMIT_HASH_STATUS.md` - docs-only status
  record for Coordinator Finalization + Commit Hash Workflow Block 001. It
  records the audit, explicit coordinator decision and commit hash/title model,
  Queue finalization service and dependency gates, Workspace Chat controls,
  QueueV2 display/actions, manual smoke checklist, and remaining Git lookup,
  rollback workflow, self-development readiness smoke, dependency graph
  visualization, and durability gaps. It does not add frontend behavior,
  backend/runtime behavior, storage/schema changes, Queue scheduling, Agent
  Executor execution, Git mutation, Terminal launch, provider tools,
  automatic finalization, commit, push, rollback, or dependency execution.
- `docs/SELF_DEVELOPMENT_READINESS_STATUS.md` - docs-only readiness status
  record after the self-development prompt-pack fixture, import-to-Queue
  smoke, validation plus Diff Review smoke, coordinator finalization and
  dependency gate smoke, and manual UI checklist definition. It records the
  safe dogfooding boundary, manual operator confirmations, unsupported or
  unverified areas, safety guarantees, recommended next work, and exact status
  and focused frontend smoke commands. It does not add frontend behavior,
  backend/runtime behavior, storage/schema changes, Queue scheduling, Agent
  Executor execution, validation automation, Diff Review execution, Git
  mutation, Terminal launch, provider tools, automatic finalization, commit,
  push, rollback, or dependency execution.
- `docs/SMART_QUEUE_IMPLEMENTATION_STATUS.md` - docs-only implementation
  status record for the current Smart Queue foundation. It records the
  Queue UI singleton create guard, persisted duplicate Queue view repair,
  active Queue product surface ownership, dependency/eligibility pure model,
  prompt-pack materialization pure model, coordinator decision pure model,
  QueueV2 Smart status presentation, Smart Queue runtime direction, and the
  recommended next implementation order. It also records that durable
  backend/storage Smart Queue models, prompt-pack persistence wiring,
  Active/Pause scheduler gates, worker stuck report integration, retry,
  rollback, Workspace Agent assistance runtime calls, durable dependency
  failure propagation, and actual auto-start are not implemented. It does not
  add frontend behavior, backend/runtime behavior, storage/schema changes,
  Queue scheduling, Agent Executor execution, Finder behavior, Git mutation,
  Terminal launch, provider tools, automatic finalization, commit, push,
  rollback, or dependency execution.
- `docs/WORKSPACE_AGENT_UI_POLISH_STATUS.md` - docs-only status record for
  movable popup, Agent Activity alignment, and compact Workspace Agent run
  summary polish. It records manual smoke steps, non-goals, and follow-ups
  without adding frontend behavior, backend behavior, runtime behavior,
  Queue scheduling behavior, automatic execution, or Git mutation.

## Active Domain Contracts

### Stable v0.1 / Dogfooding

- `docs/HOBIT_STABLE_V0_1_CONTRACT.md` - canonical Stable v0.1 product and
  architecture contract. Read before Stable v0.1 product-surface, acceptance,
  milestone, release-readiness, or cross-surface scope work. It does not
  override `docs/CURRENT_WIDGET_SURFACE.md` for current implemented behavior.
- `docs/HOBIT_STABLE_V0_1_ACCEPTANCE.md` - canonical Stable v0.1 acceptance
  gate and manual/semantic validation checklist. Read when preparing, running,
  or reviewing Stable v0.1 acceptance.

### Agent Executor / Direct Work

- `docs/DIRECT_MODE_AGENT_CONTRACT.md` - Direct Work execution boundary,
  Codex CLI rules, logs/results, and no hidden execution.
- `docs/AGENT_RUN_OBSERVABILITY_CONTRACT.md` - run logs, result, validation,
  history, and observability expectations.
- `docs/GIT_COMMIT_SUPPORT_CONTRACT.md` - read only when Direct Work touches
  commit/review integration.

Agent Executor uses the retained `agent-run` compatibility identity for Direct
Work runtime detail. It is not a normal Stable v0.1 product widget; Queue owns
the local executor flow visible to operators.

### Agent Queue

- `docs/QUEUE_SINGLETON_CONTRACT.md` - current strict Workspace Queue
  singleton invariant. Read before Queue, Smart Queue, prompt-pack import,
  Queue registry metadata, Queue view insertion/focus, or Queue surface work.
  It requires exactly one logical Queue and exactly one Queue UI view per
  Workspace. `agent-queue` is the saved-compatible singleton Queue widget
  identity, and `queue-v2` must not become a second Queue widget/view.
- `docs/QUEUE_BACKEND_OWNERSHIP_CONTRACT.md` - current Queue responsibility
  boundary. Read before Queue backend/domain/storage/Tauri/API, Workspace
  Agent broker adapter, or frontend API boundary work. It states that Queue
  business truth lives in backend/domain/storage and frontend UI may only
  render authoritative DTOs plus local loading/display state.
- `docs/QUEUE_SYSTEM_ARCHITECTURE_RESET.md` - current Queue / Workspace Agent
  architecture correction note. Read before broad Queue dogfooding,
  continuation-policy, capability-contract, or responsibility-boundary cleanup.
  It records the root causes, corrected layer responsibilities, current debt,
  overengineering, under-designed contracts, and next implementation sequence.
- `docs/QUEUE_WORKFLOW_ORCHESTRATION_CONTRACT.md` - current Queue workflow
  orchestration contract. Read before changing Workspace Agent Queue
  continuation, typed `nextAction`, risk-class policy, structured
  confirmation, bounded grants, result statuses, dependency satisfaction, or
  backend-backed broker capability behavior.
- `docs/QUEUE_RESPONSIBILITY_REFACTOR_AUDIT.md` - focused audit/status note
  for the Queue backend ownership refactor, transitional capability debt, and
  phased cleanup plan.
- `docs/SMART_QUEUE_WORKFLOW_CONTRACT.md` - planned Smart Queue prompt-pack
  workflow contract. Read before prompt-pack driven QueueBatch/QueueTask
  modeling, Smart Queue eligibility, Queue lifecycle state, or role-boundary
  work. It separates Queue Importer, Queue Coordinator, Queue Scheduler,
  Worker Agent, Workspace Agent assistance, and human/operator approval.
- `docs/QUEUE_DOGFOOD_LIFECYCLE_CONTRACT.md` - current frontend pure model
  contract for the dogfooding Queue lifecycle. Read before implementing
  ticket state, agent/prompt state, awaiting review, in review, review
  message/ACK, coordinator decision, follow-up prompt, validation approval,
  fake commit result, or done-gated dependency model work. It does not add
  backend durability, storage/schema, real worker execution, scheduler
  redesign, Git commit execution, rollback, or UI redesign.
- `docs/QUEUE_COORDINATOR_CONTRACT.md` - planned Queue Coordinator decision
  contract. Read before retry/block/fail/review/close/drain/stop decision
  modeling or Workspace Agent assistance escalation work. Queue Coordinator
  owns Queue lifecycle; Workspace Agent assists only when asked.
- `docs/QUEUE_DEPENDENCY_STATE_CONTRACT.md` - planned dependency state
  contract. Read before dependency gate, downstream blocker, or dependent task
  semantics work. Structural dependency, Waiting dependency, and Blocked are
  distinct states.
- `docs/QUEUE_ASSISTANCE_PROTOCOL_CONTRACT.md` - planned assistance protocol
  contract. Read before adding request/response models for Queue Coordinator
  assistance from Workspace Agent or human/operator review.
- `docs/AGENT_QUEUE_WIDGET_API_CONTRACT.md` - first concrete Workspace Widget
  API contract for Agent Queue. Read for Queue app-native API identity,
  snapshots, actions, events, evidence, state machine, QueuePatch proposals,
  semantic tests, Workspace Agent Coordinator integration, singleton Queue
  rules, task-scoped run settings, autonomous Queue semantics, and safety
  policy.
- `docs/AGENT_QUEUE_WIDGET_API_IMPLEMENTATION_PLAN.md` - first implementation
  plan for the minimal Queue Widget API adapter over `queue.getSnapshot`,
  `queue.createItem`, and `queue.updateItem`. Read before coding
  `QUEUE-API-03` or any first-slice Workspace Agent Queue action bridge.
- `docs/QUEUE_PRODUCT_HANDOFF.md` - Queue product handoff after Block 026. It
  freezes the current Queue + Workers UI/model/runtime boundaries, identifies
  future runtime gaps, and directs the next phase toward product scenario
  design and doc-first Queue planning rather than more feature coding in the
  current chat.
- `docs/AGENT_QUEUE_CONTRACT.md` - older queue/review boundary context.
- `docs/AGENT_QUEUE_PRODUCT_MODEL_CONTRACT.md` - current task organization,
  status, assignment, and future dependency model. Queue is for
  promoted/larger async work blocks, not every Workspace Agent idea or small
  operator action.
- `docs/QUEUE_V2_PRODUCT_CONTRACT.md` - docs-only Queue Widget v2 product and
  visual contract for a board-first operating console with lanes, capacity,
  dependency, review, task details popup/drawer, and collapsed
  activity/history guidance. It does not add frontend behavior,
  backend/runtime behavior, storage/schema, scheduling, dependency execution,
  Git mutation, or hidden automation.
- `docs/QUEUE_V2_VISUAL_TARGET.md` - docs-only Queue Widget v2 visual target
  for the accepted board-first popup-details model. It defines the command
  bar, left rail, board lanes, collapsed activity/history stream, task details
  popup/drawer, compact card rules, tab model, and safety checklist before
  implementation. It does not add frontend behavior, backend/runtime behavior,
  storage/schema, scheduling, dependency execution, Git mutation, Terminal
  launch, or hidden automation.
- `docs/QUEUE_V2_STATE_MODEL.md` - docs-only Queue v2 lifecycle, closure,
  dependency, eligibility, worker capacity, parallel run group, next action,
  board lane, inspector snapshot, activity grouping, migration, and
  implementation-block model. It does not add frontend behavior,
  backend/runtime behavior, storage/schema, scheduling, dependency execution,
  Git mutation, Terminal launch, or hidden automation.
- `docs/QUEUE_V2_REPLACE_V1_CONTRACT.md` - docs-only product decision that
  the old Agent Queue V1 visual surface can be removed and QueueV2 becomes the
  Agent Queue widget implementation. It preserves saved Agent Queue widget
  compatibility, Queue domain API/storage/runtime/Autorun semantics,
  Knowledge context attach/materialization, and component id/key compatibility
  while deproductizing the Board v2 / Flow Map toggle, old V1 Flow Map normal
  UI, and old dense sidebar/right-rail UI. It does not add frontend behavior,
  backend/runtime behavior, storage/schema changes, scheduling, dependency
  execution, Git mutation, Terminal launch, or hidden automation.
- `docs/QUEUE_V2_REPLACE_V1_STATUS.md` - docs-only status record that QueueV2
  is now the Agent Queue surface through the existing saved-widget-compatible
  Agent Queue identity. It records that saved widgets still load, the V1 Flow
  Map toggle is absent from normal UI, runtime/backend/storage/API behavior is
  unchanged, explicit run/review/finalize/Knowledge/log/new-task/refresh flows
  are preserved where wired, and old V1 visual paths are removed or deferred.
- `docs/QUEUE_TO_EXECUTOR_ASSIGNMENT_CONTRACT.md` - manual assignment from
  Queue tasks to visible Agent Executor slots.
- `docs/QUEUE_ITEM_EXECUTION_CONTRACT.md` - explicit manual run of an assigned
  task in its assigned Executor.
- `docs/QUEUE_ITEM_EXECUTION_POLICY_CONTRACT.md` - Queue item
  `executionPolicy` naming and Sequential Queue Runner semantics. Current
  implementation includes a visible frontend-driven, current-session-only
  Sequential Queue Runner with `manual`, `auto`, and
  `after_previous_success` policy behavior. It is not a durable backend
  scheduler; `docs/CURRENT_WIDGET_SURFACE.md` remains the source of truth for
  current Queue behavior.
- `docs/AGENT_QUEUE_DESKTOP_MVP_READINESS.md` - Queue desktop MVP readiness
  checkpoint. Read before Queue UX hardening, runner reliability work, run
  visibility/history work, dependency modeling, or durable runner design.
- `docs/AGENT_QUEUE_AUTORUN_CONTRACT.md` - current boundary for the
  implemented operator-armed desktop-local Queue Autorun preview. It defines
  explicit Start / Arm semantics, current-app-session limits,
  one-task-at-a-time sequencing, stop conditions, and Agent Executor / Direct
  Work ownership. The implemented preview remains desktop-local and
  session-only; it does not add a backend scheduler, durable runner, schema,
  hidden execution, server runtime, or RBAC.
- `docs/QUEUE_RUN_HISTORY_VISIBILITY_CONTRACT.md` - Queue task to Agent
  Executor run-history visibility contract. It defines implemented safe
  per-task run-link metadata, selected-task latest run and compact history
  visibility, ownership boundaries, raw-output non-goals, and remaining future
  slices such as a fuller history browser and ArtifactRef-backed references.

### Git

- `docs/GIT_WIDGET_CONTRACT.md` - deprecated/internal Git Widget compatibility
  boundary plus Workspace Git / Finder Git product direction.
- `docs/GIT_COMMIT_SUPPORT_CONTRACT.md` - explicit local commit support and
  confirmation requirements.

### Finder

- `docs/FINDER_WIDGET_API_CONTRACT.md` - Finder Widget API and Finder Git
  Plugin API contract for Stable v0.1. It defines
  open-root/list/search/preview/select/attach/edit API boundaries plus
  WorkspaceGitApi-backed Git status, changed-file, diff, history, commit
  detail, manual commit, and manual push boundaries. Current behavior is the
  implemented subset described in `docs/CURRENT_WIDGET_SURFACE.md`; future
  vocabulary in this contract does not add runtime behavior by itself.
- `docs/FINDER_UX_CONTRACT.md` - Finder UX contract for macOS-like
  column navigation, Finder-owned floating preview, edit-in-place with
  explicit Save / Cancel, selected-file Git diff preview, pane presentation
  states, and the Stable v0.1 direction that Git review lives in Finder space.

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
  Workspace Agent SQL execution boundaries. It is not a source of truth for
  production JDBC runtime, broad database automation, or hidden Workspace Agent
  execution.

### Evidence / Sources

- `docs/EVIDENCE_SOURCES_CONTRACT.md` - future Evidence/Sources trust layer,
  source provenance, evidence lifecycle, capping/redaction, and AI context
  approval boundary.

### UI / Product

- `docs/AGENT_UI_IMPLEMENTATION_RULES.md` - read before frontend UI,
  widget UI, popup, visual polish, responsive layout, component, CSS, or
  action-surface implementation work. It defines the agent workflow checklist,
  mandatory UI acceptance checks, validation expectations, required UI report
  section, and reusable prompt boilerplate.
- `docs/FRONTEND_STRUCTURE_CONTRACT.md` - mandatory frontend placement and
  import boundary model for shared primitives, widget components, popups,
  and debug content.
- `docs/FRONTEND_ORGANIZATION_CLEANUP_PLAN.md` - docs-only frontend
  organization cleanup plan from the static audit. Read before implementing
  Queue active-surface cleanup, Queue CSS ownership cleanup, compatibility
  surface isolation, confirmation primitive migration, design-system barrel
  import migration, Workspace Agent path audit, Queue root-file extraction, or
  dead-code audit blocks. Preserve its explicit Finder exclusion unless a
  later prompt scopes Finder work.
- `docs/PRODUCT_UI_DESIGN_CONTRACT.md` - product UI information hierarchy,
  debug detail boundaries, Queue right rail contract, state semantics, and UI
  review checklist.
- `docs/UI_DESIGN_SYSTEM_CONTRACT.md` - project-level UI standards and hard
  rules for dense operator-focused dark-theme-first product surfaces,
  spacing, layout, popups, lists, actions, status, context attachment, and
  agent-generated UI.
- `docs/UI_STANDARDS_STATUS.md` - docs-only status record for the completed
  project-level UI standards block, hard UI decisions, recommended next
  implementation blocks, and manual review checklist.
- `docs/UI_STANDARDS_ENFORCEMENT_STATUS.md` - docs-only status record for the
  project-level UI standards enforcement block, expected shared primitive/
  token behavior, manual smoke checklist, and enforcement follow-ups.
- `docs/MANUAL_SMOKE_UI_FOLLOWUP_PLAN.md` - docs-only manual smoke UI
  follow-up checkpoint. Read before implementing the recorded QueueV2,
  Workspace Agent, Knowledge / Skills, Notes, Terminal, or Coordinator/agents
  follow-up blocks, and preserve its explicit Finder exclusion unless a later
  prompt scopes Finder work.
- `docs/PRODUCT_UI_VISUAL_CONTRACT.md` - current product visual direction.
- `docs/WIDGET_PROGRESSIVE_DISCLOSURE_CONTRACT.md` - Minimal, Operational, and
  Full / Expert display-level guidance when a widget surface grows.

### Terminal

- `docs/TERMINAL_PTY_WIDGET_CONTRACT.md` - Terminal PTY behavior, safety
  boundaries, and current platform limitations. It is the source of truth for
  the shipped Windows and Linux live PTY backend support, macOS
  unsupported-platform behavior, the collapsed one-shot fallback compatibility
  boundary, and Deferred catalog gating / macOS PTY follow-ups.

## Reference Handoff

- `docs/NEW_CHAT_HANDOFF.md` - compact current-state handoff for starting a
  fresh chat/thread after Blocks 210 through 216. This is a reference note, not
  a default active contract or a replacement for this index.
- `docs/NEW_CHAT_PRODUCT_SCENARIO_HANDOFF.md` - compact Block 026 handoff for
  the next ChatGPT chat. It directs the next phase toward product scenario
  design, Queue acceptance walkthroughs, contracts/decisions, and an
  implementation Queue plan before coding.

## Deferred Contracts

These are valid contracts, but they are not active implementation targets
unless a block explicitly names the area:

- `docs/RUNBOOK_WIDGET_CONTRACT.md`
- `docs/SCRIPT_RUNNER_WIDGET_CONTRACT.md`
- `docs/TEMPLATE_CONTRACT.md`
- `docs/AGENT_RUNTIME_CONTRACT.md`

Do not read deferred contracts for ordinary Workspace Agent, Queue, Executor, Git,
Notes, JDBC, or refactor work unless the requested block depends on that
surface.

## Superseded Or Compatibility References

These documents should not override the Workspace Agent model or
`docs/CURRENT_WIDGET_SURFACE.md`:

- `docs/INTERACTIVE_AGENT_WIDGET_CONTRACT.md` - superseded as a product
  direction by Workspace Agent, but still useful for compatibility with the
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

- New widget or major widget change planning: read
  `docs/WIDGET_IMPLEMENTATION_PLAYBOOK.md`, use
  `docs/WIDGET_CONTRACT_TEMPLATE.md`, then add
  `docs/WORKSPACE_WIDGET_API_CONTRACT.md`,
  `docs/UNIVERSAL_WIDGET_SHELL_CONTRACT.md`,
  `docs/WIDGET_PROGRESSIVE_DISCLOSURE_CONTRACT.md`, and the affected
  widget/domain contract when one exists. Implementation should not start until
  the contract packet reaches Definition of Ready.
- Universal widget shell, pane layout, or pane type/state work: read
  `docs/WIDGET_CONTRACT.md`, `docs/WORKSPACE_WIDGET_API_CONTRACT.md`,
  `docs/UNIVERSAL_WIDGET_SHELL_CONTRACT.md`, and
  `docs/WIDGET_UNIFICATION_CONTRACT.md`; add affected widget/domain contracts
  only when changing domain behavior.
- Docs-only product model work: read the default set plus the affected domain
  contract.
- Workspace Widget API or semantic widget testing model work: read
  `docs/WORKSPACE_WIDGET_API_CONTRACT.md`,
  `docs/UNIVERSAL_WIDGET_SHELL_CONTRACT.md`,
  `docs/WIDGET_CAPABILITY_TOOL_CONTRACT.md`, and the affected widget/domain
  contract.
- Workspace Agent Coordinator, Queue coordination, or multi-coordinator
  compatibility work: read `docs/WORKSPACE_AGENT_COORDINATOR_MODEL.md`,
  `docs/WORKSPACE_WIDGET_API_CONTRACT.md`, and the affected Queue/Executor or
  widget/domain contract.
- Frontend widget UI work: read the default set,
  `docs/AGENT_UI_IMPLEMENTATION_RULES.md`,
  `docs/FRONTEND_STRUCTURE_CONTRACT.md`,
  `docs/UI_DESIGN_SYSTEM_CONTRACT.md`,
  `docs/PRODUCT_UI_VISUAL_CONTRACT.md`, and the affected widget contract.
- Backend/storage/API work: read the default set,
  `docs/WORKSPACE_CONTRACT.md`, and the affected domain contract.
- Finder API, UX, or implementation planning: read
  `docs/FINDER_WIDGET_API_CONTRACT.md`, `docs/FINDER_UX_CONTRACT.md`,
  `docs/WORKSPACE_WIDGET_API_CONTRACT.md`, and
  `docs/UNIVERSAL_WIDGET_SHELL_CONTRACT.md`; add `docs/GIT_WIDGET_CONTRACT.md`
  only when changing current Git behavior, Git plugin API, or Git mutation
  boundaries.
- Queue work: read `docs/QUEUE_SINGLETON_CONTRACT.md`,
  `docs/QUEUE_BACKEND_OWNERSHIP_CONTRACT.md`, and
  `docs/AGENT_QUEUE_PRODUCT_MODEL_CONTRACT.md`; add
  `docs/QUEUE_TO_EXECUTOR_ASSIGNMENT_CONTRACT.md` for assignment and
  `docs/QUEUE_ITEM_EXECUTION_CONTRACT.md` only when execution is involved.
- Smart Queue work: read `docs/QUEUE_SINGLETON_CONTRACT.md`,
  `docs/SMART_QUEUE_WORKFLOW_CONTRACT.md`,
  `docs/QUEUE_DOGFOOD_LIFECYCLE_CONTRACT.md`,
  `docs/QUEUE_COORDINATOR_CONTRACT.md`,
  `docs/QUEUE_DEPENDENCY_STATE_CONTRACT.md`, and
  `docs/QUEUE_ASSISTANCE_PROTOCOL_CONTRACT.md` before any Queue surface,
  registry, import, focus/open, dependency, coordinator, assistance, or
  Queue-domain modeling work.
- Queue-based Knowledge generation work: read
  `docs/KNOWLEDGE_PRODUCTION_CONTRACT.md`,
  `docs/KNOWLEDGE_GENERATION_WORKFLOW_CONTRACT.md`,
  `docs/KNOWLEDGE_DRAFT_REVIEW_PERSISTENCE_DECISION.md`,
  `docs/KNOWLEDGE_SKILLS_EVIDENCE_CONTRACT.md`,
  `docs/KNOWLEDGE_CATALOG_CONTRACT.md`,
  `docs/AGENT_QUEUE_PRODUCT_MODEL_CONTRACT.md`, and
  `docs/COORDINATOR_CENTERED_WORKBENCH_CONTRACT.md`.
- Queue task Knowledge / Skills context attachment work: read
  `docs/KNOWLEDGE_QUEUE_CONTEXT_CONTRACT.md`,
  `docs/QUEUE_KNOWLEDGE_CONTEXT_DURABILITY_DECISION.md`,
  `docs/KNOWLEDGE_SKILLS_EVIDENCE_CONTRACT.md`,
  `docs/KNOWLEDGE_CATALOG_CONTRACT.md`, and
  `docs/AGENT_QUEUE_PRODUCT_MODEL_CONTRACT.md`.
- Workspace Agent/JDBC work: read
  `docs/COORDINATOR_CENTERED_WORKBENCH_CONTRACT.md`,
  `docs/WORKSPACE_COORDINATOR_AGENT_CONTRACT.md`,
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
- the Workspace Agent model changes.

Do not update this index for every small UI or code change.
