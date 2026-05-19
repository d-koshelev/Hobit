# Active Contract Index

## Purpose

This index tells future agents which Hobit contracts to read for each kind of
work. It is a navigation document, not a new product contract.

Use it to reduce prompt context size and to avoid implementing from stale or
superseded discovery-era documents. When a block needs deeper detail, read the
small default set first, then only the relevant domain contracts.

## Default Reading Set

Read this set for almost every future block:

- `AGENTS.md` - repository instructions and hard safety rules.
- `docs/ACTIVE_CONTRACT_INDEX.md` - current contract navigation.
- `docs/CURRENT_WIDGET_SURFACE.md` - current user-facing widget inventory and
  implementation boundaries.
- `docs/CODE_ORGANIZATION_CONTRACT.md` - repository structure and refactor
  rules.
- `docs/ARCHITECTURE.md` - current implemented architecture and bridge
  boundaries.
- `docs/AGENT_RESPONSE_CONTRACT.md` - final response format only; this is not a
  product reasoning contract.

## Core Active Contracts

- `docs/COORDINATOR_CENTERED_WORKBENCH_CONTRACT.md` - read for Coordinator,
  cross-widget, autonomy, context, or product-model work.
- `docs/WIDGET_CAPABILITY_TOOL_CONTRACT.md` - read when Coordinator or future
  AI surfaces use widgets through controlled capabilities.
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

- `docs/NOTES_WIDGET_PRODUCT_CONTRACT.md` - near-term workspace-local Notes
  product direction and storage/UI boundaries.

### JDBC

- `docs/JDBC_WIDGET_CONTRACT.md` - Database / JDBC connector, read-only SQL,
  secrets, EXPLAIN, AI assistance, and Coordinator capability boundaries.

### UI / Product

- `docs/PRODUCT_UI_VISUAL_CONTRACT.md` - current product visual direction.
- `docs/WIDGET_PROGRESSIVE_DISCLOSURE_CONTRACT.md` - Minimal, Operational, and
  Full / Expert display-level guidance when a widget surface grows.

### Terminal

- `docs/TERMINAL_PTY_WIDGET_CONTRACT.md` - deferred PTY/manual shell direction;
  read only for explicitly Terminal PTY work.

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
- Older Agent Chat and Agent Monitoring proposal-era text in
  `docs/AI_INTEGRATION_READINESS_CONTRACT.md`,
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
  `docs/JDBC_WIDGET_CONTRACT.md`.
- Refactor-only work: read `docs/CODE_ORGANIZATION_CONTRACT.md` and this
  index; read domain contracts only if behavior boundaries could be affected.

## Stale Doc Rule

If any document conflicts with this index, `docs/CURRENT_WIDGET_SURFACE.md`, or
`docs/COORDINATOR_CENTERED_WORKBENCH_CONTRACT.md`, treat the conflicting text as
stale. Do not implement from stale guidance. Update the stale reference in a
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
