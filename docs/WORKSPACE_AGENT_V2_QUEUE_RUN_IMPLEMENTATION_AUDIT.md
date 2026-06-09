# Workspace Agent V2 Queue Run Implementation Audit

## Status

Docs-only audit for WorkspaceAgentV2 Queue Run reuse.

No source code, tests, Queue runtime, scheduler, Autorun, Direct Run, provider,
storage schema, or Workspace Agent V1 behavior was changed.

## Scope Inspected

- Frontend Agent Queue task creation, selection, update, run, and QueueV2
  action plumbing.
- Workspace Agent V1 Queue proposal and Queue command behavior.
- Queue Widget API first-slice adapter and Workspace Agent bridge.
- Durable Knowledge / Skill context attachment APIs exposed through the
  frontend workspace API.
- WorkspaceAgentV2 current Direct Run scaffold and disabled Queue Run control.

## Existing Queue Integration Points Found

### Workspace API

The durable workspace API already exposes normal Queue task and context
mutation paths:

- `createAgentQueueTask`
- `listAgentQueueTasks`
- `getAgentQueueTask`
- `updateAgentQueueTask`
- `deleteAgentQueueTask`
- `attachKnowledgeToQueueTask`
- `detachKnowledgeFromQueueTask`
- `attachSkillToQueueTask`
- `detachSkillFromQueueTask`
- assignment, explicit assigned-task start, run-link, worker, and runner APIs

These are typed in `apps/desktop/frontend/src/workspace/workspaceApiTypes.ts`
and wrapped in `apps/desktop/frontend/src/workspace/workspaceApiAgentQueue.ts`.

### Queue Widget API First Slice

`apps/desktop/frontend/src/workbench/queue/agentQueueWidgetApi.ts` implements a
typed Agent Queue Widget API over the workspace Queue APIs:

- `queue.getSnapshot`
- `queue.createItem`
- `queue.updateItem`

`queue.createItem` validates workspace/queue scope, title, status, prompt
requirements for queued tasks, supported execution policy, item type, sandbox,
and approval policy. On success it returns a `QueueWidgetActionResult` with a
created item snapshot, an `itemCreated` event, and a safety message stating
that no execution, Agent Executor run, Queue Autorun, Terminal command, Git
action, validation, or coordinator finalization was started.

`queue.updateItem` similarly validates scope and safe mutable fields, rejects
unsupported order/index updates in this slice, loads the current task, persists
through `updateAgentQueueTask`, and returns an `itemUpdated` event plus the
same no-execution safety message.

This API is the safest existing typed path for WorkspaceAgentV2 Queue task
creation because it is already the app-native Queue API boundary rather than a
private UI callback, parser, raw workspace API call, storage write, or runtime
path.

### Workspace Agent Queue Bridge

`apps/desktop/frontend/src/workbench/workspaceAgentQueueBridge.ts` wraps
`AgentQueueWidgetApi` for Workspace Agent use. It scopes calls to the open
Workspace, defaults actor to `workspace_agent`, and refreshes Queue state after
successful create/update mutations through `refreshAfterMutation`.

`apps/desktop/frontend/src/workbench/queue/useWorkspaceQueueApi.ts` builds this
bridge from the existing Queue controller and exposes:

- `createItem`
- `getSnapshot`
- `updateItem`
- `getRunSettingsDefaults`
- current autonomous controls, where present

WorkspaceAgentV2 Queue Run should reuse this bridge shape or a narrow service
wrapping it. It should not call the natural-language command parser.

### QueueV2 Surface And Action Parity

QueueV2 is already the normal Agent Queue visual surface through the saved
Agent Queue widget identity. `AgentQueuePlaceholderWidget` renders
`AgentQueueV2Board`, while `widgetV2/queueV2/QueueV2Widget.tsx` is a
frontend-only shell/reference surface.

Action parity is covered by `AgentQueueV2ActionParity.test.tsx`. The tested
surface confirms:

- selecting/opening details does not run work;
- `Run task` only starts through explicit QueueV2 details action;
- `New task` opens the existing New task dialog;
- follow-up creation uses existing create callbacks and does not start work;
- review/closure actions use existing update callbacks;
- details popup exposes Prompt, Result, Agent Log, Context, Files /
  Validation, and Developer tabs.

The existing open/select path is `WorkbenchCanvas.openAgentQueueItem`, which
scrolls to the Queue widget and publishes `agentQueueItemOpenRequest`.
`AgentQueuePlaceholderWidget` consumes that request and calls controller
`selectTask(queueItemId)`.

### Workspace Agent V1 Queue Behavior

Workspace Agent V1 uses the compatibility `interactive-agent` surface.

Queue creation exists in two forms:

- approved proposal creation via `runCreateQueueTaskProposal`, which calls
  `onCreateAgentQueueTask(queueTaskRequestFromProposal(proposal))` only after
  the proposal is approved;
- Queue command handling via
  `runWorkspaceAgentQueueCommand`, which parses natural language but ultimately
  calls the typed `WorkspaceAgentQueueBridge.createItem`, `getSnapshot`, or
  `updateItem`.

The V1 parser path is useful compatibility evidence, but it should not be the
WorkspaceAgentV2 implementation path. WorkspaceAgentV2 can avoid parser risk by
using typed create/action inputs directly.

### Durable Knowledge / Skill Context Attachment

Durable Queue-owned context attachment is already exposed through typed
frontend workspace APIs:

- `attachKnowledgeToQueueTask({ workspaceId, queueItemId, knowledgeId })`
- `detachKnowledgeFromQueueTask({ workspaceId, queueItemId, knowledgeId })`
- `attachSkillToQueueTask({ workspaceId, queueItemId, skillId })`
- `detachSkillFromQueueTask({ workspaceId, queueItemId, skillId })`

`agentQueueKnowledgeContext.ts` defines the frontend context vocabulary and
materialization model:

- durable refs for Knowledge Documents and Skills;
- bounded snapshots;
- visible warnings;
- token estimate/budget;
- prompt materialization with a visible `Knowledge / Skills context` section
  and a `Context used` section.

`agentQueueSelectedTaskActions.ts` persists selected-task context attachment
through the typed attach/detach APIs, blocks disabled/rejected/deprecated
context, applies persisted task context back into Queue state, and explicitly
reports that no prompt was materialized and no work was started.

For WorkspaceAgentV2 Queue Run, visible context attachment should therefore be
a post-create typed attach step for selected context refs that map to saved
Knowledge Documents or Skills. Generic Queue create/update should not accept
arbitrary context JSON as a product path.

## Recommended Implementation Path

Implement a thin WorkspaceAgentV2 queue-run service that wraps the existing
Queue Widget API bridge and typed durable context APIs.

Recommended service responsibilities:

1. Accept a typed WorkspaceAgentV2 Queue Run request:
   - title;
   - prompt;
   - optional description;
   - initial status, normally `draft` unless the operator explicitly chooses a
     queued task and required run settings are present;
   - task-scoped run settings when visible and explicitly provided;
   - selected visible context refs.
2. Call `WorkspaceAgentQueueBridge.createItem` / `queue.createItem`.
3. Attach only eligible visible Knowledge / Skill refs through
   `attachKnowledgeToQueueTask` and `attachSkillToQueueTask`.
4. Refresh Queue state through the bridge refresh path.
5. Request opening/selecting the created task through the existing
   `openAgentQueueItem(queueItemId)` path when a visible Queue widget exists.
6. Append a WorkspaceAgentV2 transcript result card summarizing the create
   result, attached context counts, warnings, open/select outcome, and safety
   boundaries.

This keeps WorkspaceAgentV2 Queue Run as task creation only. Queue continues to
own execution, review, closure, run history, Autorun, and finalization.

## Rejected Paths

- Do not create a second Queue runtime, storage path, scheduler path, or
  WorkspaceAgentV2-owned task ledger.
- Do not mutate SQLite, localStorage, DOM, private React component state, or
  Queue controller internals directly.
- Do not call `startAssignedAgentQueueTask`, Sequential Runner, or Autorun from
  WorkspaceAgentV2 Queue Run.
- Do not use the Workspace Agent V1 natural-language queue command parser if a
  typed create/action request is available.
- Do not pass arbitrary context JSON through generic Queue create/update.
- Do not inject hidden Notes, Terminal output, Git state, JDBC state, files,
  logs, Executor raw payloads, or provider-private content.

## Context Attachment Path

Supported now:

- Saved Knowledge Document refs can attach to the created Queue task by id.
- Saved Skill refs can attach to the created Queue task by id.
- Attachment stores durable Queue-owned refs, bounded snapshots, warnings,
  materialized-at metadata, and token estimates.
- Context is visible in Queue task context UI and can be materialized before
  explicit Queue execution.

Recommended WorkspaceAgentV2 behavior:

- Convert only visible WorkspaceAgentV2 context items that carry a safe saved
  Knowledge Document id or Skill id into attach requests.
- Show unsupported context items in the transcript result card as not attached.
- Treat transient/freeform WorkspaceAgentV2 visible context as transcript-only
  metadata unless a future typed snapshot/ref API is added.
- Do not attach disabled, rejected, deprecated, or blocked context.
- Do not materialize a run prompt during Queue Run creation.

## Open / Select Path

The existing open/select path is UI-owned:

- `WorkbenchCanvas.openAgentQueueItem(queueItemId)` scrolls to the visible
  Queue widget and sets `agentQueueItemOpenRequest`.
- `AgentQueuePlaceholderWidget` receives the request and calls
  `selectTask(queueItemId)`.

WorkspaceAgentV2 Queue Run should request this existing open/select behavior
after successful creation if the host supplies an `onOpenAgentQueueItem`
callback or equivalent. If no visible Queue widget exists, the transcript
result card should state that the task was created but not opened.

## WorkspaceAgentV2 Transcript Result Card

A useful result card can show:

- action: `queue.createItem`;
- created Queue task id and title;
- status, item type, queue tag, and priority;
- execution policy and run settings presence;
- attached Knowledge count and Skill count;
- blocked or skipped context refs with reasons;
- open/select result, such as `Opened in Agent Queue` or `Queue widget not
  visible`;
- safety message: task created only, no Executor run, no Queue Autorun, no
  Terminal command, no Git action, no validation, no finalization.

This should be a WorkspaceAgentV2 transcript result, not a Queue-owned report
or execution result.

## Unsupported / Blockers

- WorkspaceAgentV2 currently exposes `onQueueTaskCreate?: () => void` only and
  keeps Queue Run disabled. It does not yet accept a typed Queue Run request or
  return a result card.
- WorkspaceAgentV2 context items do not currently guarantee durable Knowledge
  Document or Skill ids. A small mapping contract is needed before automatic
  attach can be reliable.
- The Queue Widget API first slice does not include typed context attach in
  `AgentQueueWidgetApi`; context attach lives beside it on the workspace API /
  Queue selected-task actions. The thin service should compose both rather than
  expanding generic `queue.createItem`.
- `queue.createItem` supports only `draft` and `queued` creation statuses.
- `queue.updateItem` does not support order/index updates in this first slice.
- Opening a task depends on a visible Queue widget and the existing
  `openAgentQueueItem` host callback.
- Durable Evidence / Context Pack records are not implemented. Current context
  evidence is Queue-owned refs/snapshots plus prompt/report text.
- Queue execution prompt materialization still has documented hardening needs;
  WorkspaceAgentV2 Queue Run must not execute or materialize execution prompts.

## Safety Record

- Queue Run creates Queue tasks only.
- Queue owns execution, review, closure, run history, Autorun, and finalization.
- No auto-run is allowed unless a future explicit separate mode is designed.
- No hidden context injection.
- No hidden Workspace reads.
- No Terminal, Git, JDBC, Notes, Executor, provider-tool, or filesystem action.
- No automatic Knowledge attachment except explicit visible saved refs selected
  by the operator.
- No natural-language parser dependency when typed request/action data exists.
- No new Queue runtime/storage path.

