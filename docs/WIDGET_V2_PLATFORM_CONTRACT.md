# Widget V2 Platform Contract

## Purpose

This contract defines Widget V2 as a clean new widget architecture for future
ideal Hobit widgets.

It is docs-only. It does not add frontend behavior, backend behavior, storage
schema, runtime execution, Workspace API changes, WidgetHost rewrites, or
current widget migration.

## Status

Widget V2 is Planned architecture.

Current implemented widgets remain governed by `docs/CURRENT_WIDGET_SURFACE.md`
and their task-specific contracts. This document must not be used to reinterpret
current V1 behavior as already migrated.

## Product Decision

Hobit will not migrate V1 widgets in this tranche.

Existing widgets remain V1 / compatibility surfaces. Their current widget ids,
component keys, persistence shapes, WidgetHost mapping, WorkbenchCanvas behavior,
Workspace API bridge, storage paths, and runtime behavior remain unchanged unless
a later task explicitly scopes a focused migration or compatibility cleanup.

New ideal widgets should be designed as Widget V2 widgets.

Widget V2 is the target architecture for new product-quality widget surfaces
that need clearer anatomy, typed action boundaries, domain-owned behavior, and a
consistent shell model. It is not a requirement to retrofit current widgets
before new V2 planning can begin.

## Platform Non-Goals

This tranche does not include:

- WidgetHost rewrite.
- WorkbenchCanvas rewrite.
- WorkspaceApi split.
- storage or schema changes.
- runtime behavior changes.
- current widget migration.
- V1 compatibility id renames.
- new widget catalog insertion behavior.
- new hidden execution paths.
- new agent, Queue, Terminal, Git, Finder, Knowledge, JDBC, or provider
  capabilities.

## Widget V2 Anatomy

Widget V2 separates product identity, runtime context, shell composition, and
domain behavior.

### WidgetV2Manifest

`WidgetV2Manifest` is the static product contract for a Widget V2 definition.

It should describe:

- stable V2 widget kind.
- user-facing name.
- product role.
- supported display levels.
- owned domain service boundary.
- supported typed actions.
- supported typed events.
- required shell regions.
- optional shell regions.
- safe context exposure summary.
- runtime and platform limitations.
- non-goals and forbidden behavior.

The manifest is not a runtime executor. It does not grant hidden access to
Workspace state, files, Terminal sessions, Git repositories, databases, provider
tools, Queue tasks, or other widgets.

### WidgetV2RuntimeContext

`WidgetV2RuntimeContext` is the host-provided scoped runtime context for one
Widget V2 instance.

It should provide only explicit, bounded instance context such as:

- workspace id.
- workbench id.
- widget instance id.
- display level.
- presentation state.
- current theme tokens.
- feature flags or platform capability flags.
- typed action dispatch.
- widget-local log/report affordances where available.

It must not provide hidden cross-widget reads, hidden filesystem access, hidden
provider access, hidden Terminal control, hidden Git mutation, hidden Queue
dispatch, hidden JDBC execution, or hidden runtime execution.

### WidgetV2Shell

`WidgetV2Shell` is the continuous widget surface that owns the shared visual and
interaction frame for a Widget V2 instance.

It should compose the header, toolbar, primary surface, optional rails,
inspector, drawer, and popup/overlay surfaces without creating box-inside-box
visual clutter. The widget header remains the top meta zone of the same
continuous widget surface.

The shell owns presentation structure only. It does not own domain behavior.

### WidgetV2Header

`WidgetV2Header` presents identity and immediate state.

It should include:

- widget title.
- compact domain status.
- instance-level presentation controls that are already supported by the
  Workbench.
- concise pending-approval or attention indicators when relevant.

It must not duplicate the toolbar, inspector, logs, or primary content.

### WidgetV2Toolbar

`WidgetV2Toolbar` presents the primary explicit operator actions for the current
display level and selection.

Toolbar controls send typed actions. They do not directly run hidden behavior or
reach into other widgets. Actions that mutate local files, repositories,
databases, Queue execution, provider calls, or runtime state must remain visible,
bounded, and approval-aware according to the owning domain contract.

### WidgetV2PrimarySurface

`WidgetV2PrimarySurface` is the main working area for the widget.

It renders the selected domain state and supports the core operator workflow.
It should be the first place a user can understand what the widget is for and
what action is available next.

The primary surface renders state. It does not own domain services, hidden
execution, or cross-widget mutation.

### Optional LeftRail

`LeftRail` is an optional navigation or collection rail.

Use it for durable domain navigation such as queues, catalogs, folders, roots,
threads, or grouped records when the widget's core workflow needs a stable
selection model.

Do not add a LeftRail for decorative grouping, duplicate filters, or debug
state.

### Optional RightInspector

`RightInspector` is an optional detail and review surface for the current
selection.

Use it for metadata, review state, dependencies, safe previews, validation
warnings, approvals, and focused edit controls that would overcrowd the primary
surface.

The inspector must not become an automatic execution console.

### Optional BottomDrawer

`BottomDrawer` is an optional secondary surface for bounded activity, logs,
history, diagnostics, or output summaries.

It should stay collapsed or compact by default unless the widget's primary
workflow depends on it. It must not hide required approvals or become the only
place where mutation results are visible.

### Popup / Overlay Surfaces

Popup and overlay surfaces are temporary, focused surfaces for explicit
operator tasks such as selection, preview, confirmation, command review, or
bounded editing.

They must be owned by the widget instance that opened them. Opening a popup or
overlay must not create a new widget instance, silently read new context, run
commands, mutate files, dispatch Queue work, or change runtime behavior.

## Responsibility Model

Widget V2 follows a strict responsibility split.

The widget renders state and sends explicit typed actions.

The domain service owns behavior, validation, persistence orchestration,
runtime calls where a domain contract allows them, and state transitions.

The Workbench owns widget identity, placement, presentation state, and host
context.

The platform shell owns shared visual structure and action dispatch wiring.

Typed actions must be visible and operator-intentional. They should include
enough structured input for the domain service to validate the request without
reading hidden state.

Domain services may reject actions when required context, approval, capability,
runtime support, or safety policy is missing. Rejections should return visible,
bounded errors instead of silently falling back to hidden behavior.

Widget V2 must not add hidden runtime execution. No Widget V2 surface may
secretly run Terminal commands, agent runs, Queue dispatch, Git operations,
JDBC queries, provider calls, filesystem mutation, network calls, or
cross-widget mutation outside its explicit domain contract.

## Domain Boundaries

Widget V2 names define future ideal product surfaces. They do not rename,
migrate, or replace current V1 compatibility ids by themselves.

### QueueV2

QueueV2 is the operating console UI for promoted async work.

It should focus on board-first task organization, assignment, review,
dependencies, capacity, status, and visible next actions. QueueV2 is not a
hidden scheduler, automatic dispatcher, response acceptor, Git mutator,
Terminal launcher, or provider runtime.

### KnowledgeV2

KnowledgeV2 is the catalog UI.

It should focus on explicit operator-authored or operator-approved Knowledge
items, source/provenance review, lifecycle, enablement, search, attach, and
catalog maintenance. KnowledgeV2 is not hidden memory, automatic ingestion,
folder watching, embeddings, vector search, team/server sharing, or automatic
prompt injection unless a later contract explicitly scopes those behaviors.

### WorkspaceAgentV2

WorkspaceAgentV2 is the conversation/provider UI.

It should focus on foreground operator conversation, visible context review,
provider response review, safe proposal cards, and explicit promotion of work
to other visible surfaces. WorkspaceAgentV2 is not hidden context access,
hidden widget reading, hidden mutation, automatic Queue creation, Terminal
control, Git mutation, JDBC execution, or provider tool execution unless a
later contract explicitly scopes a visible and approval-aware capability.

### TerminalV2

TerminalV2 is the manual shell UI.

It should focus on explicit operator-controlled terminal sessions, bounded
visible runtime state, and manual shell interaction. TerminalV2 is not Script
Runner, Queue execution infrastructure, Workspace Agent execution, hidden
automation, persistent transcript storage, or an arbitrary background command
runner unless later contracts explicitly add those behaviors.

### FinderV2

FinderV2 is the file browser UI.

It should focus on explicit root approval, navigation, bounded preview, safe
selection, and explicit file operations where allowed. FinderV2 is not hidden
workspace scanning, broad automatic indexing, context ingestion, Terminal
launch, Queue creation, Git control surface, or IDE replacement unless a later
contract explicitly scopes those behaviors.

### Git UI

Git UI is deferred.

Git remains an internal service first. Future Git product behavior should be
planned through Finder-owned Git affordances, Workspace Git APIs, or a later
explicit Git UI contract. This document does not add standalone Git Widget V2,
Git catalog insertion, repository scanning, polling, fetch, branch management,
reset, clean, stash, automatic commit, automatic push, or Agent/Queue-driven
Git mutation.

## Implementation Order

Recommended implementation order:

1. V2 platform skeleton.
2. QueueV2 first.
3. KnowledgeV2 second.
4. WorkspaceAgentV2 third.
5. TerminalV2 and FinderV2 later.

### V2 Platform Skeleton

Start with a minimal platform skeleton that defines the shared V2 vocabulary,
manifest shape, runtime context shape, shell anatomy, typed action dispatch
boundary, and no-op compatibility with existing Workbench hosting.

This skeleton must not rewrite WidgetHost, split WorkspaceApi, change storage,
add runtime behavior, or migrate existing widgets.

### QueueV2 First

QueueV2 is the first recommended product pilot because Queue is the operating
console for promoted async work and benefits most from a consistent board,
inspector, activity, and explicit action model.

The first QueueV2 implementation block should be planned from Queue contracts
and must not add hidden execution, backend scheduling, automatic acceptance,
Git mutation, Terminal launch, or provider tool behavior.

### KnowledgeV2 Second

KnowledgeV2 should follow after QueueV2 so catalog review, lifecycle,
provenance, and Queue-related Knowledge workflows can use the same V2 shell and
typed action model.

The first KnowledgeV2 implementation block should preserve explicit
operator-authored and operator-approved Knowledge boundaries.

### WorkspaceAgentV2 Third

WorkspaceAgentV2 should follow after QueueV2 and KnowledgeV2 so conversation,
visible context, proposal cards, and work promotion can integrate with the
clearer V2 surfaces without creating hidden cross-widget behavior.

The first WorkspaceAgentV2 implementation block should remain visible-context
only and keep provider/tool behavior within current approved boundaries.

### TerminalV2 And FinderV2 Later

TerminalV2 and FinderV2 should come later because they touch high-trust local
system boundaries: shell sessions, filesystem navigation, file editing, and Git
adjacent review. They should start only after the V2 shell and typed action
model have been proven by QueueV2 and KnowledgeV2.

## Compatibility Notes

Widget V2 does not invalidate V1.

V1 compatibility surfaces may continue to ship while V2 widgets are introduced
beside them through explicit product decisions. A later migration tranche must
define one widget at a time, with compatibility ids, persistence handling,
operator-visible behavior, validation, and rollback/fallback expectations
planned before implementation.

Until that later tranche exists, current widgets remain V1 / compatibility and
must not be silently converted to Widget V2.
