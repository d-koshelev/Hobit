# Frontend Organization Cleanup Plan

## Purpose

This document records the frontend organization cleanup direction from the
static audit before implementation blocks continue.

It is a docs-only planning checkpoint. It does not implement frontend behavior,
CSS, runtime behavior, backend commands, Tauri commands, IPC changes,
storage/schema changes, widget behavior, Queue execution, Agent Executor
behavior, Git behavior, Terminal behavior, provider behavior, or new widgets.

Future implementation blocks must still read the active contract index, current
widget surface, frontend structure contract, code organization contract, UI
design system contract, and the affected widget/domain contract before coding.

## Hard Constraints

- Finder is explicitly out of scope for this cleanup track. Do not modify
  Finder files, Finder product behavior, Finder Git behavior, or Finder UI as
  part of these organization cleanup blocks.
- Preserve widget ids, component ids, persisted ids, registry ids, IPC
  contracts, storage/schema, and runtime semantics unless a later prompt
  explicitly scopes a behavior or migration change.
- Prefer small precise organization changes over broad rewrites.
- Do not perform UI redesign unless a later prompt explicitly asks for it.
- Keep product surfaces polished and product-only. Debug, runtime, raw payload,
  and development details belong in explicit debug/details surfaces.
- File-size checks for this track are warning-only by default:

```sh
python scripts/hobit/check-file-sizes.py --changed-only
```

Do not use `--fail-on-warning` unless a later prompt explicitly requests it.

## Current Findings

- Queue currently has parallel product surfaces. Active rendering appears to
  route through `WidgetHost` to `AgentQueuePlaceholderWidget` to the root
  `AgentQueueV2Board`, while a separate
  `widgetV2/queueV2/QueueV2Widget` also exists and is exported.
- Queue CSS ownership is split between `.agent-queue-v2-*` and `.queue-v2-*`
  selector families.
- The workbench root contains overloaded domain code that should be moved into
  focused domain modules as cleanup proceeds.
- Box-inside-box composition exists. Finder is still excluded from this track
  and must not be touched for this finding.
- Confirmation UX is fragmented despite the shared
  `DestructiveConfirmationPopup` primitive.
- A design-system barrel exists, but deep compatibility imports remain
  widespread.
- Compatibility and deprecated widgets remain in main registry and host paths
  and should be isolated as compatibility surfaces without renaming persisted
  identities.
- `WorkspaceAgentV2` appears smoke/dev-only, while the active product
  Workspace Agent uses `InteractiveAgentPlaceholderWidget`.
- Dead-code detection is weak and should start warning-only.

## Recommended Cleanup Order

1. Queue active surface decision.
2. Queue CSS ownership cleanup.
3. Compatibility surface isolation.
4. Shared confirmation primitive migration for active widgets.
5. Design-system barrel import policy.
6. Active Workspace Agent path audit.
7. Queue root-file split/domain extraction.
8. Dead-code audit warning-only.

## Cleanup Notes

### Queue Active Surface Decision

Decide and document which Queue component is the active Agent Queue product
surface before moving files or deleting exports. The decision must preserve the
saved-widget-compatible Agent Queue identity and current Queue runtime,
storage, IPC, and execution semantics.

### Queue CSS Ownership Cleanup

After the active surface decision, consolidate Queue CSS ownership so active
Queue product styles have one clear selector namespace and one clear file
home. This should be a structure/style-ownership cleanup, not a visual
redesign.

### Compatibility Surface Isolation

Move compatibility and deprecated widget wiring behind explicit compatibility
modules or exports where possible. Do not rename compatibility ids such as
`interactive-agent`, `agent-run`, or `skill-library`, and do not remove saved
widget compatibility unless a later migration task explicitly scopes it.

### Shared Confirmation Primitive Migration

Migrate active widget destructive confirmations toward the shared
`DestructiveConfirmationPopup` primitive in focused blocks. Preserve existing
confirmation gates and mutation semantics.

### Design-System Barrel Import Policy

New shared UI imports should use design-system barrel entrypoints. Existing
deep compatibility imports can be migrated incrementally when files are already
being touched for focused cleanup. Do not turn this into a broad mechanical
rewrite unless a later task explicitly scopes it.

### Active Workspace Agent Path Audit

Confirm the active Workspace Agent product path and keep smoke/dev-only
`WorkspaceAgentV2` paths isolated from current product routing unless a later
task explicitly promotes or replaces the active surface.

### Queue Root-File Split / Domain Extraction

Split overloaded Queue root files by durable responsibility only after the
active surface and CSS ownership decisions are settled. Preserve public import
paths where practical and keep behavior unchanged.

### Dead-Code Audit Warning-Only

Start with warning-only dead-code detection and inventory. Do not delete
ambiguous code paths until their product, compatibility, smoke/dev, or
deferred status is confirmed against active contracts and current routing.

## Non-Goals

This cleanup track does not implement:

- Finder cleanup, polish, or refactors.
- UI redesign.
- New product/runtime/frontend behavior.
- New widget insertion behavior.
- Widget id, component id, registry id, persisted id, IPC, or schema changes.
- Queue scheduling, execution, dependency, Autorun, or Agent Executor behavior
  changes.
- Workspace Agent provider/tool execution changes.
- Git, Terminal, JDBC, Knowledge, Notes, or Finder behavior changes.
- Broad dead-code deletion.
