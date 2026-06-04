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
- `docs/KNOWLEDGE_CATALOG_CONTRACT.md` - read for future Knowledge Catalog
  product-model or type-design work. It defines explicit global and
  workspace-local project memory, item types, required fields, scopes,
  lifecycle, operations, visible Agent/Queue context rules, and no hidden AI
  memory. It is docs/type-design only and does not add storage, schema,
  frontend UI, backend/Tauri commands, provider behavior, Queue behavior,
  Workspace Agent behavior, automatic ingestion, or runtime execution.
- `docs/KNOWLEDGE_GENERATION_WORKFLOW_CONTRACT.md` - read for future
  Queue-based Knowledge generation workflow work. It defines how Workspace
  Agent may create approved Queue tasks that analyze selected codebase,
  documentation, and coordinator/command history sources and return draft
  Knowledge packs for operator review. It is docs/type-design only and does
  not add storage, schema, frontend UI, backend/Tauri commands, provider
  tools, Queue execution, background ingestion, hidden memory, vector search,
  folder watching, or automatic activation.
- `docs/KNOWLEDGE_QUEUE_CONTEXT_CONTRACT.md` - read for future Queue task
  Knowledge / Skills attachment semantics. It defines Queue-owned attached
  context refs, bounded materialized snapshots, warnings, token budget, right
  rail visibility, and execution evidence requirements. It is docs/type-design
  only and does not add storage, schema, frontend UI, backend/Tauri commands,
  provider behavior, Queue execution, hidden memory, or automatic context
  injection.
- `docs/KNOWLEDGE_SKILLS_WIDGET_AUDIT.md` - inspect-only audit for the current
  Knowledge / Skills implementation, Stable v0.1 MVP inclusion decision,
  known gaps, and recommended next blocks. Read before future Knowledge /
  Skills scope, Queue context, or acceptance-hardening work.
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

- `docs/PRODUCT_UI_DESIGN_CONTRACT.md` - product UI information hierarchy,
  debug detail boundaries, Queue right rail contract, state semantics, and UI
  review checklist.
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
  `docs/WIDGET_CONTRACT.md`, `docs/WORKSPACE_WIDGET_API_CONTRACT.md`, and
  `docs/UNIVERSAL_WIDGET_SHELL_CONTRACT.md`; add affected widget/domain
  contracts only when changing domain behavior.
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
  `docs/PRODUCT_UI_VISUAL_CONTRACT.md`, and the affected widget contract.
- Backend/storage/API work: read the default set,
  `docs/WORKSPACE_CONTRACT.md`, and the affected domain contract.
- Finder API, UX, or implementation planning: read
  `docs/FINDER_WIDGET_API_CONTRACT.md`, `docs/FINDER_UX_CONTRACT.md`,
  `docs/WORKSPACE_WIDGET_API_CONTRACT.md`, and
  `docs/UNIVERSAL_WIDGET_SHELL_CONTRACT.md`; add `docs/GIT_WIDGET_CONTRACT.md`
  only when changing current Git behavior, Git plugin API, or Git mutation
  boundaries.
- Queue work: read `docs/AGENT_QUEUE_PRODUCT_MODEL_CONTRACT.md`; add
  `docs/QUEUE_TO_EXECUTOR_ASSIGNMENT_CONTRACT.md` for assignment and
  `docs/QUEUE_ITEM_EXECUTION_CONTRACT.md` only when execution is involved.
- Queue-based Knowledge generation work: read
  `docs/KNOWLEDGE_GENERATION_WORKFLOW_CONTRACT.md`,
  `docs/KNOWLEDGE_SKILLS_EVIDENCE_CONTRACT.md`,
  `docs/KNOWLEDGE_CATALOG_CONTRACT.md`,
  `docs/AGENT_QUEUE_PRODUCT_MODEL_CONTRACT.md`, and
  `docs/COORDINATOR_CENTERED_WORKBENCH_CONTRACT.md`.
- Queue task Knowledge / Skills context attachment work: read
  `docs/KNOWLEDGE_QUEUE_CONTEXT_CONTRACT.md`,
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
