# Queue Workspace Coordination Contract

## Purpose

This contract defines Queue's target coordination vocabulary. It prevents
future Queue work from hardcoding local-single-user or local-single-agent
assumptions while preserving the current desktop MVP boundary.

Queue is a Workspace coordination layer for coordinating work between:

- local users;
- local AI agents;
- future remote AI agents;
- system workflows;
- future schedulers.

This document is contract-only. It does not add schemas, APIs, runtime
behavior, UI behavior, server behavior, permissions, remote agents, or
scheduler behavior.

## Current MVP Scope

Current Queue remains:

- single-user;
- local desktop;
- workspace-scoped;
- backed by local storage;
- able to use backend-owned `queue_local` / Codex-backed execution where the
  current contracts already allow it.

Current MVP does not implement collaborative UI, server sync, ACLs, remote
agent runtime, scheduler runtime, or a durable backend scheduler.

## Explicit Non-Goals

Do not implement from this contract alone:

- multi-user collaboration;
- server sync;
- account, organization, or ACL semantics;
- remote agent execution;
- scheduler dispatch;
- new Queue UI;
- storage/schema changes;
- new Tauri/backend APIs;
- Queue event storage;
- Queue artifact link storage;
- ActorRef code;
- replacement of existing Queue tables.

## Core Model

Queue coordination vocabulary is:

- `Task`: workspace-scoped intent or work item.
- `RunAttempt`: one concrete attempt to perform one task.
- `ActorRef`: attribution for who or what requested, changed, reviewed,
  claimed, or executed work.
- `Assignment`: expected person, agent, workflow, or system target for a task.
- `Claim`: temporary active ownership while work is in progress.
- `Executor`: the concrete actor or target that produced a run attempt.
- `ExecutorTarget`: provider-neutral execution target description.
- `QueueEvent`: bounded audit/event history entry.
- `ArtifactLink`: reference from Queue task/run output to Workspace artifacts
  or knowledge.

The data model and APIs must not assume:

- there is only one executor;
- the executor is always a local AI agent;
- Task equals RunAttempt;
- RunAttempt equals `widget_runs`;
- current user is always the actor;
- result output is only text;
- Queue truth comes from UI;
- workflow action ledger is the only audit history.

## Workspace Scope Rules

All Queue state is Workspace-scoped.

Rules:

- Queue task, run, event, artifact, workflow, decision, evidence, review, and
  control records must carry or derive `workspaceId`.
- Queue APIs must require explicit `workspaceId` or run behind a service path
  that has already resolved a single Workspace.
- Workspace ownership checks belong in backend/service boundaries, not only in
  UI.
- Cross-workspace Queue links are invalid unless a future contract explicitly
  adds them.
- Widget, run, artifact, and workflow ids must never be used as implicit
  Workspace selectors.

## Task

Task is workspace-scoped intent.

Contract fields:

- `workspaceId`;
- `taskId`;
- `title`;
- `prompt`;
- `description`;
- `status`;
- `priority` optional;
- `createdByActorRef`;
- `assignedActorRef` or `assignedExecutionTarget` optional;
- `dependencies`;
- `createdAt`;
- `updatedAt`.

Rules:

- Task is not a run.
- Task can have zero, one, or multiple run attempts.
- Task must not imply a specific local executor forever.
- Task status reflects coordination state, not one process status only.
- Task dependencies are structural Queue relationships, not UI ordering.

## RunAttempt

RunAttempt is one concrete execution or manual attempt against one task.

Contract fields:

- `workspaceId`;
- `taskId`;
- `runId`;
- `attemptNumber` or `attemptId` if later needed;
- `executorTarget`;
- `executorActorRef`;
- `status`;
- `startedAt`;
- `completedAt`;
- evidence or artifact refs.

Rules:

- Multiple runs per task must remain representable.
- Human/manual attempts must be representable later.
- Remote agent attempts must be representable later.
- `widget_runs` is not canonical Queue run identity.
- `agent_queue_task_run_links` or a future provider-neutral run attempt model
  is canonical for Queue-owned runs.

## ActorRef

ActorRef is attribution only.

Minimal model:

```text
actorType:
  local_user
  workspace_agent
  local_agent
  remote_agent
  system
  workflow
  scheduler
  unknown

actorId: optional string
displayName: optional string
source: optional string
```

Rules:

- ActorRef does not add auth, permissions, server identity, or ACL semantics.
- Existing raw `actor_id` strings are compatibility inputs until normalized.
- Executor identity and actor identity are related but not identical.
- Workflow, system, and scheduler actors must be attributable without implying
  a human user account.

## Assignment, Claim, And Executor

Assignment is the expected person, agent, system, workflow, or target for a
task.

Claim is temporary active ownership while work is in progress.

Executor is the concrete actor or target that produced one RunAttempt.

Rules:

- Do not conflate assignment with RunAttempt executor.
- Do not use `executorWidgetId` as canonical assignment.
- A task may be assigned before any claim or run exists.
- A claim may expire, be released, or be superseded without rewriting run
  history.
- A RunAttempt must record the executor target that actually produced it.
- Widget ids are presentation or compatibility attribution only.

## ExecutorTarget

ExecutorTarget describes where work should execute without requiring UI/widget
identity.

Minimal model:

```text
executorTargetKind:
  queue_local
  local_agent
  remote_agent
  human
  workflow
  scheduler
  legacy_agent_executor
  unknown

providerId: optional string
executorInstanceId: optional string
executionTargetHash: optional string
compatibilityWidgetId: optional string
```

Rules:

- `queue_local` with `providerId=codex` is the current MVP execution target.
- `executorWidgetId`, `assignedExecutorWidgetId`,
  `queueOwnerWidgetInstanceId`, and `directWorkRunId` are compatibility
  fields.
- Agent Executor widget must not be reintroduced as canonical execution truth.
- Agent Queue widget is optional UI/observability, not execution truth.
- Future remote-agent or scheduler targets require explicit future contracts
  and must not be inferred from this vocabulary.

## Queue Events

Queue needs a bounded audit/event log later. This is not full event sourcing.

Minimal future model:

- `eventId`;
- `workspaceId`;
- `taskId` optional;
- `runId` optional;
- `workflowRunId` optional;
- `actorRef`;
- `eventType`;
- bounded `payloadJson`;
- `createdAt`.

Needed event types:

- `task_created`;
- `task_updated`;
- `task_assigned`;
- `run_started`;
- `run_updated`;
- `worker_evidence_recorded`;
- `review_message_created`;
- `review_acknowledged`;
- `completion_decision_recorded`;
- `failure_decision_recorded`;
- `queue_control_changed`;
- `workflow_started`;
- `workflow_action_recorded`;
- `workflow_completed`;
- `workflow_failed`.

Later-only event types:

- `task_claimed`;
- `task_released`;
- `scheduler_selected`;
- `remote_agent_assigned`;
- `permission_changed`;
- `approval_granted`.

Rules:

- `agent_queue_workflow_actions` remains a workflow idempotency ledger.
- Workflow actions are not the general Queue event log.
- Event storage must be additive and bounded.
- Do not implement event sourcing without a separate explicit contract.

## Artifact Links

Queue results may link to Workspace artifacts and knowledge. Queue result is
not only text.

Minimal future model:

- `workspaceId`;
- `taskId`;
- `runId` optional;
- `artifactType`;
- `artifactId`;
- `relation`;
- `createdByActorRef`;
- `createdAt`.

Artifact types:

- `evidence_bundle`;
- `note`;
- `knowledge_document`;
- `report`;
- `diff`;
- `decision_record`;
- `investigation`;
- `code_map`;
- `file_ref`;
- `widget_result`;
- `validation_report`;
- `external_ref`.

Rules:

- ArtifactLink is a reference/link only.
- Do not implement a knowledge graph from this contract.
- Evidence bundles and review messages may remain text/JSON while artifact
  links are absent.
- Future result/evidence records should be artifact-linkable.

## Workflow Relation

Queue workflows are deterministic coordination procedures over Queue tasks,
run attempts, events, and artifact links.

Rules:

- WorkflowRun is not Task.
- WorkflowAction is not QueueEvent.
- Workflow action ledger is for step idempotency and recovery.
- Queue event log is for user/agent-readable audit history.
- Workflow actions may emit or derive Queue events later.
- Backend-owned workflow steps must keep using explicit typed refs and must not
  infer ids from prose, UI order, file paths, local state, or display text.

## UI Independence

Rules:

- Backend Queue APIs require `workspaceId` and typed ids.
- Queue UI widgets are not required for backend-owned `queue_local` workflows.
- Widget ids are optional presentation or compatibility attribution.
- Queue mutation APIs must not depend on mounted Queue UI.
- Frontend may render authoritative DTOs and dispatch typed commands.
- Frontend must not own Queue truth.
- Agent Queue widget is optional observability/control surface, not the
  execution or persistence authority.

## Compatibility Fields

These fields and paths are compatibility-only:

- `assigned_executor_widget_id`;
- `executor_widget_id`;
- `assignedExecutorWidgetId`;
- `executorWidgetId`;
- `queueOwnerWidgetInstanceId`;
- `direct_work_run_id` / `directWorkRunId`;
- `agent_queue_items` widget-run/result coupling;
- Agent Executor widget assignment/start paths.

Rules:

- Preserve compatibility fields for old data and current safe paths.
- Do not use them as canonical Queue coordination design.
- Do not remove them until a migration plan exists.
- New coordination vocabulary should map to them only as compatibility
  projection where needed.

## Implementation Guard For Future Blocks

QUEUE COORDINATION GUARD:

- all Queue state is workspace-scoped;
- do not conflate Task and RunAttempt;
- new mutations must carry or derive ActorRef;
- new execution logic must use ExecutorTarget, not widget identity;
- new result/evidence should be artifact-linkable;
- event-worthy changes should either emit QueueEvent or document why eventing
  is deferred;
- UI is not source of truth;
- no prose/UI/path/order ID inference;
- no server, sync, ACL, remote-agent runtime, or scheduler runtime unless
  explicitly scoped.

## Minimal Next Implementation Sequence

Future implementation should be additive and non-invasive:

1. Normalize ActorRef and ExecutorTarget vocabulary in contracts and DTOs.
2. Add provider-neutral RunAttempt projection or companion fields while
   preserving existing run-link compatibility.
3. Add bounded QueueEvent persistence and emit from existing backend
   mutations.
4. Add Queue ArtifactLink references for evidence, knowledge, notes, reports,
   diffs, and validation reports.
5. Add API/UI independence guard tests for backend-owned `queue_local`
   workflows without Queue UI, Agent Executor widget, or `widget_runs`.
6. Only after those foundations, design any collaborative/server/remote-agent
   behavior in separate explicit contracts.
