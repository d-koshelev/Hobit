# Workspace Agent Coordinator Model

## Purpose

This contract defines the Workspace Agent Coordinator model for Hobit's
workspace-centered architecture.

The MVP coordination model has one canonical Workspace Agent Coordinator per
Workspace for Queue and Widget API coordination. Future architecture should
allow multiple independent Workspace Agent Coordinators, but this document does
not implement multi-coordinator runtime, scheduling, persistence, provider
tools, frontend UI, backend or Tauri commands, storage/schema changes, Queue
runtime changes, or widget action execution.

For current implemented Workspace Agent behavior, use
`docs/CURRENT_WIDGET_SURFACE.md`. For widget APIs, use
`docs/WORKSPACE_WIDGET_API_CONTRACT.md`. For broader Workspace Agent target
behavior, use `docs/COORDINATOR_CENTERED_WORKBENCH_CONTRACT.md` and
`docs/WORKSPACE_COORDINATOR_AGENT_CONTRACT.md`.

## MVP Model: One Workspace Agent Coordinator

For the MVP, each Workspace has one primary Workspace Agent Coordinator.

The primary Coordinator is the canonical coordination authority for:

- analyzing the Workspace Agent-visible Queue state;
- creating Queue tasks through app-native Queue APIs;
- updating Queue tasks through app-native Queue APIs;
- deleting stale Queue tasks through app-native Queue APIs when explicitly
  allowed;
- creating follow-up tasks from explicit evidence or operator instructions;
- running semantic widget tests through Widget APIs;
- reporting findings and recommended next steps.

This Coordinator model is logical architecture. It does not require the
current UI to remove compatibility Workspace Agent widgets or existing
`interactive-agent` identity. Current visible Workspace Agent behavior remains
bounded by `docs/CURRENT_WIDGET_SURFACE.md`.

## Current Compatibility Note

Current Hobit can have multiple Workspace Agent widget instances in one
Workspace, each with independent current-session chat/thread state and working
directory. That remains current behavior until explicitly changed.

This contract defines a future/MVP coordination role: one canonical
Coordinator for Queue and Widget API coordination. Additional Workspace Agent
views may exist as chat/work surfaces, but they do not create multiple
canonical Queue coordinators in the MVP.

## Future-Compatible Model

Future Hobit may support multiple independent Workspace Agent Coordinators in
one Workspace.

Examples:

- one Coordinator focused on code review;
- one Coordinator focused on database investigation;
- one Coordinator focused on Queue triage;
- one Coordinator focused on documentation cleanup.

That future model must preserve:

- explicit Coordinator identity;
- scope boundaries;
- optimistic revisions;
- conflict detection;
- an event stream;
- operator-visible ownership and approval;
- one canonical Agent Queue state per Workspace.

Multi-coordinator runtime is not implemented by this contract.

## Queue Singleton Rule

There is exactly one canonical Agent Queue per Workspace.

Rules:

- The canonical Queue state is Workspace-scoped.
- Multiple Workbenches in one Workspace may show the same Queue.
- Multiple UI views may exist later, but they must point to the same canonical
  Queue state.
- Queue views must not fork task state, history, assignment, run links, or
  review decisions.
- Existing persisted duplicate Queue widgets, where present, are a
  compatibility concern and do not define multiple canonical Queues.

Agent Queue is the shared task ledger for the Workspace. It is not the
Coordinator, not a chat surface, not a hidden scheduler, and not an acceptance
engine.

## Coordinator Identity

The MVP Coordinator has a primary identity.

Conceptual identity:

```text
coordinatorId: primary
workspaceId: <workspace id>
scope: workspace
revision: <latest observed workspace/queue revision>
```

The implementation may choose different field names, but future work should
preserve these concepts:

- a stable Coordinator id;
- the Workspace it belongs to;
- its scope;
- the latest observed revision;
- the current task/action/evidence references it used.

MVP `coordinatorId` is `primary` by convention. It does not create a new
storage schema in this block.

## Future Coordinator Identity Model

Future multi-coordinator support should extend the MVP identity model:

```text
coordinatorId: <stable coordinator id>
workspaceId: <workspace id>
scope: <workspace | queue-tag | widget | repository | note-set | task-set>
revision: <latest observed state revision>
displayName: <operator-visible name>
status: <active | paused | blocked | retired>
```

Future scopes should be explicit and operator-visible. A scoped Coordinator
must not assume authority over unrelated Queue tags, widgets, repositories,
notes, logs, or task sets.

## Queue As Shared Task Ledger

The Agent Queue is the shared Workspace task ledger.

It stores or represents:

- task identity;
- prompt or work description;
- status;
- priority and order;
- queue tag or scope where implemented;
- dependencies where implemented;
- assignment to Agent Executor where implemented;
- run-link history;
- review/finalization state where implemented;
- follow-up relationships;
- stale/blocked/deleted decisions.

The Queue is not the executor. Executors run tasks. The Queue records and
organizes the work and its state.

## Workspace Agent Coordinator Responsibilities

Workspace Agent Coordinator may coordinate through app-native Widget APIs.

Responsibilities:

- Analyze Queue tasks, status, blockers, duplicate work, stale tasks, and
  missing follow-ups.
- Create tasks when work should become async/background or separately tracked.
- Update tasks when scope, prompt, priority, status, dependency, assignment,
  evidence, or review state changes.
- Delete stale tasks only through explicit Queue APIs and only when allowed by
  policy or operator instruction.
- Create follow-ups from explicit evidence, reports, validation failures,
  blocked tasks, or operator decisions.
- Run semantic widget tests by calling widget actions, observing state/events,
  asserting behavior, and producing evidence/report.
- Start autonomous Queue behavior only when the operator explicitly requests it
  or a future explicit autonomy policy allows the exact behavior.
- Produce final reports that distinguish implemented facts, observed evidence,
  recommendations, and out-of-scope future work.

Coordinator should prefer compact summaries, selected evidence, capped logs,
and safe state snapshots over raw payloads.

## Boundary: Coordinate Versus Execute

Workspace Agent Coordinator can coordinate.

Agent Executors run tasks.

Widgets own their own app-native actions, state, logs, evidence, and safety
policy.

Coordinator may:

- propose actions;
- request approved actions through widget APIs;
- update the Queue task ledger;
- run semantic tests where a test hook exists and is allowed;
- summarize and report.

Coordinator must not:

- run tasks directly through hidden shell commands;
- mutate widget records through filesystem or database hacks;
- bypass Executor for queued/background execution;
- bypass Git, Notes, JDBC, Terminal, Finder, or Queue widget APIs;
- auto-finalize task output without explicit operator action unless a future
  autonomous coordinator mode exists;
- auto-accept work, auto-commit, auto-push, or hide failed validation.

Coordinator finalization remains explicit unless a future autonomous
Coordinator mode is defined with visible scope, policy, evidence, and rollback
expectations.

## Queue Task Coordination Actions

Coordinator Queue actions should be app-native and revision-aware.

Conceptual actions:

- `queue.analyze`
- `queue.task.create`
- `queue.task.update`
- `queue.task.delete_stale`
- `queue.task.create_follow_up`
- `queue.task.mark_needs_review`
- `queue.task.mark_blocked`
- `queue.task.mark_ready_for_operator_finalization`
- `queue.autorun.start_when_explicitly_requested`
- `queue.autorun.stop`

These actions must preserve the current Queue contracts:

- no hidden dispatch;
- no hidden execution;
- no automatic acceptance;
- no Git mutation;
- no Terminal launch;
- no Notes mutation outside explicit Notes APIs;
- no raw Executor payload copying into Queue or AI context by default.

## Semantic Widget Tests

Workspace Agent Coordinator may run semantic widget tests only through Widget
APIs.

Required model:

1. Select target widget and test scope.
2. Call app-native action or test hook.
3. Observe event stream and/or safe state snapshot.
4. Assert behavior and safety metadata.
5. Produce evidence/report.

Semantic tests are not:

- shell scripts pretending to use the product API;
- direct SQLite row mutation;
- DOM scraping;
- raw filesystem edits to widget state;
- hidden provider tool calls;
- an excuse to bypass operator approval for risky actions.

## Explicit Autonomous Queue Start

Workspace Agent Coordinator may start autonomous Queue behavior only when the
operator explicitly requests it, such as:

```text
Start Queue Autorun for this Workspace using these visible bounds.
```

The request must identify:

- Workspace;
- canonical Queue;
- allowed task scope or queue tag when applicable;
- allowed executor(s);
- execution workspace path or approved runtime target when required;
- stop conditions;
- validation/reporting expectations;
- approval policy.

Current Queue Autorun remains current-session and operator-armed as defined in
`docs/CURRENT_WIDGET_SURFACE.md` and Queue-specific contracts. This document
does not add durable scheduler behavior or hidden auto-dispatch.

## Future Multi-Coordinator Compatibility

Future multi-coordinator runtime should use a QueuePatch model.

### QueuePatch

A QueuePatch is an app-native proposed or applied mutation to the canonical
Queue ledger.

Conceptual shape:

```text
queuePatchId: <id>
workspaceId: <workspace id>
queueId: canonical
coordinatorId: <coordinator id>
baseRevision: <observed queue revision>
scope: <workspace | queue-tag | task-set | widget>
operations:
  - create_task | update_task | delete_task | create_follow_up | attach_evidence
intent: <why this patch exists>
evidenceRefs: <safe evidence references>
approvalState: draft | approved | rejected | applied | conflicted
```

QueuePatch is conceptual in this contract. It does not define storage, DTOs,
or runtime behavior.

### Optimistic Revisions

Future Queue mutations should include the revision observed by the Coordinator.

If the canonical Queue changed after that revision, Hobit should detect a
conflict or require rebasing instead of silently overwriting another
Coordinator's changes.

### Scopes

Future Coordinators should declare scope.

Examples:

- entire Workspace Queue;
- one queue tag;
- one selected task;
- one widget's test plan;
- one repository review flow;
- one database investigation.

Scope reduces accidental conflicts but does not grant permission to hidden
state or unrelated widgets.

### Conflict Detection

Conflicts should be detected when:

- two Coordinators update the same task field from different base revisions;
- one Coordinator deletes a task another Coordinator updates;
- follow-up tasks duplicate the same evidence or source task;
- task dependencies or ordering would become invalid;
- a scoped Coordinator tries to modify out-of-scope Queue state.

Conflict resolution must be operator-visible. Silent last-writer-wins behavior
is not acceptable for Coordinator-owned Queue mutations.

### Event Stream

Future multi-coordinator support should expose a Workspace event stream with:

- QueuePatch proposed;
- QueuePatch approved/rejected/applied/conflicted;
- task created/updated/deleted;
- follow-up created;
- semantic widget test started/completed/failed;
- Coordinator paused/resumed/retired;
- evidence/report attached.

Events should carry safe summaries and references, not raw hidden payloads.

## Relationship To Widget APIs

The Coordinator model depends on `docs/WORKSPACE_WIDGET_API_CONTRACT.md`.

Coordinator can analyze and control widgets only by:

- reading safe state snapshots;
- discovering approved capabilities;
- proposing or calling app-native actions;
- observing events;
- using evidence/log references;
- running semantic tests through test hooks;
- respecting widget safety policy.

Coordinator must not treat shell access, filesystem access, repository access,
or provider tools as substitutes for Widget APIs.

## Relationship To Current Contracts

- `docs/CURRENT_WIDGET_SURFACE.md` remains authoritative for current behavior.
- `docs/AGENT_QUEUE_PRODUCT_MODEL_CONTRACT.md` and related Queue contracts
  define current and future Queue behavior.
- `docs/WIDGET_CAPABILITY_TOOL_CONTRACT.md` defines widget capability policy.
- `docs/WORKSPACE_CONTRACT.md` defines Workspace isolation.
- `docs/AGENT_RESPONSE_CONTRACT.md` defines final reporting format for
  implementation, audit, validation, and documentation blocks.

## Non-Goals

This contract does not implement:

- multi-coordinator runtime;
- Coordinator storage or schema;
- QueuePatch storage or schema;
- backend scheduler;
- hidden Queue dispatch;
- hidden Executor launch;
- frontend UI;
- backend or Tauri commands;
- provider tools;
- semantic widget test runner;
- widget API runtime;
- autonomous finalization;
- Git, Notes, Finder, JDBC, Terminal, Queue, or Executor behavior changes.
