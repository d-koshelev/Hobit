# Agent Queue Widget API Implementation Plan

Contract status: docs-only implementation plan for the first Agent Queue Widget
API slice.

This plan narrows `docs/AGENT_QUEUE_WIDGET_API_CONTRACT.md` into the smallest
implementation-facing DTO/API block. It does not implement frontend behavior,
backend or Tauri commands, Rust or TypeScript runtime types, tests,
storage/schema changes, provider tools, Queue execution, Agent Executor
execution, autonomous Coordinator behavior, or semantic test runner behavior.

## 1. Purpose

Define how the first Queue Widget API slice will be implemented app-natively so
Workspace Agent can inspect and mutate Agent Queue state without shell commands,
filesystem edits, ad hoc SQLite writes, localStorage mutation, DOM scraping, or
private component calls.

The first implementation should be an adapter over the current Workspace-scoped
Queue task APIs. It should expose a stable Queue Widget API shape to Workspace
Agent while preserving the current product boundary:

- Queue is a singleton Workspace task ledger.
- Queue CRUD is app-native and Workspace-scoped.
- Queue item creation/update does not start Agent Executor, Codex, Terminal,
  Git, validation, Queue Autorun, or autonomous work.
- Provider-backed Workspace Agent remains tool-disabled unless a later contract
  explicitly adds provider tool execution.

## 2. First API Slice

Include only:

- `queue.getSnapshot`
- `queue.createItem`
- `queue.updateItem`

Explicitly out of scope:

- `queue.deleteItem`
- `queue.runTask`
- `queue.runAutonomousQueue`
- Coordinator finalization
- report/evidence API
- semantic test harness
- multi-Coordinator conflict handling
- backend schema changes unless already needed by the existing Queue item model

The first slice may compose existing reads, task create, task update, runner
snapshot, worker config, and run-link summary APIs when those APIs already
exist. It must not add execution or destructive behavior.

## 3. Current Implementation Surfaces

Likely current surfaces to connect in the implementation block:

- Frontend Queue controller:
  `apps/desktop/frontend/src/workbench/queue/useAgentQueueController.ts`,
  `apps/desktop/frontend/src/workbench/queue/useAgentQueueTaskActions.ts`,
  `apps/desktop/frontend/src/workbench/queue/agentQueueLoadHelpers.ts`, and
  `apps/desktop/frontend/src/workbench/AgentQueuePlaceholderWidget.tsx`.
- Existing Queue widget action wrapper:
  `apps/desktop/frontend/src/workbench/agentQueueTaskWidgetActions.ts`.
- Tauri/browser Workspace API boundary:
  `apps/desktop/frontend/src/workspace/workspaceApiAgentQueue.ts`,
  `apps/desktop/frontend/src/workspace/workspaceApiTypes.ts`,
  `apps/desktop/frontend/src/workspace/tauriAgentQueueApi.ts`,
  `apps/desktop/frontend/src/workspace/memoryWorkspaceApi.ts`, and
  `apps/desktop/frontend/src/workspace/memoryUnsupportedWorkspaceApi.ts`.
- Frontend Workspace Agent bridge:
  `apps/desktop/frontend/src/workbench/widgetRenderProps.ts`,
  `apps/desktop/frontend/src/workbench/widgetProps/workspaceAgentWidgetProps.ts`,
  `apps/desktop/frontend/src/workbench/InteractiveAgentPlaceholderWidget.tsx`,
  `apps/desktop/frontend/src/workbench/workspaceAgentProposalCreationActions.ts`,
  `apps/desktop/frontend/src/workbench/coordinatorProposalHandoffs.ts`, and
  `apps/desktop/frontend/src/workbench/WorkspaceAgentQueueReportActionCard.tsx`.
- Existing Queue TypeScript DTOs:
  `apps/desktop/frontend/src/workspace/types/agentQueue.ts`.
- Existing Tauri Queue task DTO/commands:
  `apps/desktop/src-tauri/src/agent_queue_task_dto.rs` and
  `apps/desktop/src-tauri/src/agent_queue_task_commands.rs`.
- Existing storage-backed Queue task service:
  `crates/hobit-app/src/workspace_service/agent_queue_task_types.rs`,
  `crates/hobit-app/src/workspace_service/agent_queue_tasks.rs`, and
  `crates/hobit-storage-sqlite/src/store/agent_queue_tasks.rs`.
- Existing safe run-link / runner state sources:
  `apps/desktop/frontend/src/workspace/types/agentQueue.ts`,
  `apps/desktop/src-tauri/src/agent_queue_runner_commands.rs`,
  `crates/hobit-app/src/workspace_service/agent_queue_run_links.rs`, and
  `crates/hobit-storage-sqlite/src/store/agent_queue_task_run_links.rs`.

Current durable Queue task fields include task id, Workspace id, title,
description, prompt, status, priority, execution policy, task-scoped Direct
Work settings, assigned Executor widget id, and timestamps. Existing frontend
Queue UI/controller fields such as dependency lists, queue tag labels,
order/index, item type, validation status, Coordinator status, execution plan
preview, worker reports, and report action card state are currently richer
frontend/controller model fields. The first adapter should return those fields
as available, derived, empty, or `unknown`/`null` rather than adding schema in
this block.

## 4. DTO Shapes

Conceptual TypeScript DTOs for the first implementation:

```ts
type QueueSafetyClass = "safe_read" | "safe_create_update";

type QueueWidgetSnapshot = {
  queueId: string;
  workspaceId: string;
  widgetType: "agent-queue";
  coordinatorId: "primary";
  revision: string | null;
  snapshotGeneratedAt: string;
  items: QueueWidgetItemSnapshot[];
  counts: Record<string, number>;
  blockers: QueueWidgetBlocker[];
  autonomousState: QueueWidgetAutonomousState;
  localExecutorState: QueueWidgetLocalExecutorState;
  selectedItemId?: string | null;
  events?: QueueWidgetEvent[];
  capsAndRedactions: string[];
};

type QueueWidgetItemSnapshot = {
  id: string;
  workspaceId: string;
  queueId: string;
  title: string;
  description: string;
  prompt: string;
  status: string;
  itemType?: string | null;
  queueTag?: { id?: string | null; name?: string | null };
  priority: number;
  order?: number | null;
  index?: number | null;
  dependencies: string[];
  blockers: QueueWidgetBlocker[];
  executionPolicy: "manual" | "auto" | "after_previous_success";
  executionWorkspace?: string | null;
  codexExecutable?: string | null;
  sandbox?: "read_only" | "workspace_write" | "danger_full_access" | null;
  approvalPolicy?: "never" | "on_request" | "untrusted" | null;
  coordinatorStatus?: string | null;
  validationStatus?: string | null;
  reportSummary?: QueueWidgetReportSummary;
  evidenceSummary?: QueueWidgetEvidenceSummary;
  runLinks?: QueueWidgetRunLinkSummary[];
  createdAt?: string;
  updatedAt?: string;
};

type QueueWidgetActionResult<T = QueueWidgetItemSnapshot> = {
  ok: boolean;
  action: "queue.getSnapshot" | "queue.createItem" | "queue.updateItem";
  safetyClass: QueueSafetyClass;
  item?: T;
  snapshot?: QueueWidgetSnapshot;
  events: QueueWidgetEvent[];
  message: string;
  error?: { code: string; message: string };
};

type QueueCreateItemRequest = {
  workspaceId: string;
  queueId?: string;
  title: string;
  description?: string;
  prompt?: string;
  status?: "draft" | "queued";
  queueTag?: { id?: string | null; name?: string | null };
  priority?: number;
  order?: number | null;
  index?: number | null;
  dependencies?: string[];
  executionPolicy?: "manual" | "auto" | "after_previous_success";
  executionWorkspace?: string | null;
  codexExecutable?: string | null;
  sandbox?: "read_only" | "workspace_write" | "danger_full_access" | null;
  approvalPolicy?: "never" | "on_request" | "untrusted" | null;
  actor?: "operator" | "workspace_agent" | "test_harness";
};

type QueueUpdateItemRequest = {
  workspaceId: string;
  queueId?: string;
  itemId: string;
  patch: Partial<{
    title: string;
    description: string;
    prompt: string;
    status: string;
    queueTag: { id?: string | null; name?: string | null };
    priority: number;
    order: number | null;
    index: number | null;
    dependencies: string[];
    executionPolicy: "manual" | "auto" | "after_previous_success";
    executionWorkspace: string | null;
    codexExecutable: string | null;
    sandbox: "read_only" | "workspace_write" | "danger_full_access" | null;
    approvalPolicy: "never" | "on_request" | "untrusted" | null;
    coordinatorStatus: string | null;
    validationStatus: string | null;
  }>;
  actor?: "operator" | "workspace_agent" | "test_harness";
  reason?: string;
};
```

Supporting conceptual DTOs:

```ts
type QueueWidgetBlocker = {
  itemId?: string;
  code:
    | "missing_prompt"
    | "missing_execution_workspace"
    | "missing_executor"
    | "dependency_blocked"
    | "manual_policy"
    | "unsupported_runtime"
    | "validation_failed"
    | "operator_decision_required";
  message: string;
};

type QueueWidgetAutonomousState = {
  available: boolean;
  status: string;
  isActive: boolean;
  isSessionOnly: boolean;
  activeItemId?: string | null;
  waitingRunId?: string | null;
  stopReason?: string | null;
};

type QueueWidgetLocalExecutorState = {
  available: boolean;
  executorCount: number;
  assignedCount: number;
  activeRunCount: number;
  unsupportedReason?: string | null;
};

type QueueWidgetReportSummary = {
  status: "none" | "pending" | "report_ready" | "evidence_missing" | "unknown";
  summary?: string;
  changedFilesCount?: number;
  warningsCount?: number;
  errorsCount?: number;
};

type QueueWidgetEvidenceSummary = {
  status: "none" | "available" | "missing" | "unknown";
  runRefs: string[];
  validationStatus?: string | null;
  reviewStatus?: string | null;
};

type QueueWidgetRunLinkSummary = {
  linkId: string;
  executorWidgetId: string;
  directWorkRunId: string;
  source: string;
  status: string;
  startedAt: string;
  completedAt?: string | null;
  validationStatus?: string | null;
  reviewStatus?: string | null;
};

type QueueWidgetEvent = {
  type: "queueSnapshotRead" | "itemCreated" | "itemUpdated" | "actionFailed";
  itemId?: string;
  summary: string;
  timestamp: string;
};
```

Implementation notes:

- `QueueUpdateItemRequest.patch` is partial. Omitted fields mean preserve the
  current value. Explicit `null` is a requested clear only for nullable fields.
- If the existing lower-level `updateAgentQueueTask` API still requires a full
  task update, the first adapter must read the current item, merge the patch,
  and submit a complete request. It must not use default values to overwrite
  unspecified fields.
- Snapshot fields that are not currently durable should be derived from visible
  controller/API state where already available, otherwise returned as empty,
  `null`, or `unknown` with capping/redaction notes.
- The first block should avoid schema changes. If a required field is not in the
  existing Queue item model, represent it as derived/advisory in the adapter
  result or leave it unavailable.

## 5. Action Behavior

### `queue.getSnapshot`

Behavior:

- Returns the singleton Queue snapshot for the Workspace.
- Includes all Queue task items visible through the current app-native Queue
  task API.
- Includes counts by task status.
- Includes blockers such as missing prompt, dependency block, missing execution
  workspace, missing executor, unsupported runtime, failed validation, or
  operator decision requirement when those facts are available.
- Includes autonomous state from the current Queue runner snapshot when
  available.
- Includes local executor state when available through visible Executor slots,
  Queue worker config, assignments, or safe run-link metadata.
- Read-only and safe.
- Does not read raw Executor logs, stdout/stderr, full final responses, full
  diffs, Terminal output, Git state, Notes, files, secrets, or hidden widget
  state.

Implementation direction:

- Prefer composing from `listAgentQueueTasks`, `getAgentQueueRunnerSnapshot`,
  `listAgentQueueWorkers`, and safe run-link reads where the current adapter
  already exposes them.
- The existing `getAgentQueueSnapshot` name in `workspaceApiAgentQueue.ts` is
  currently a proposal-review compatibility snapshot. The first Queue Widget
  API adapter should not treat that compatibility shape as the canonical task
  snapshot without adapting it to `QueueWidgetSnapshot`.
- `queueSnapshotRead` is optional/no event in this slice.

### `queue.createItem`

Behavior:

- Creates a Queue item through the app-native Queue task API.
- Accepts title, prompt, description, draft/queued status, priority, execution
  policy, and task-scoped run settings.
- Can create a draft item or queued item.
- Returns the created item as `QueueWidgetItemSnapshot`.
- Emits `itemCreated`.
- Does not assign an Executor.
- Does not start Agent Executor, Codex Direct Work, Queue Autorun, validation,
  Terminal, Git, or any other runtime work.

Implementation direction:

- Map to the existing `createAgentQueueTask` / `create_agent_queue_task` path
  where possible.
- The adapter should supply existing API defaults only for fields required by
  the current create API. Defaults must be visible and deterministic:
  `status: "draft"` unless explicitly provided, `priority: 0` unless provided,
  `executionPolicy: "manual"` unless provided.
- Empty prompt is valid only for draft items under the existing backend rule.

### `queue.updateItem`

Behavior:

- Updates selected mutable fields on one Queue item.
- Must not overwrite unspecified fields.
- Returns the updated item as `QueueWidgetItemSnapshot`.
- Emits `itemUpdated`.
- Does not assign an Executor unless a later API slice explicitly adds
  assignment.
- Does not start Agent Executor, Codex Direct Work, Queue Autorun, validation,
  Terminal, Git, or any other runtime work.
- Does not apply Coordinator finalization unless a later API slice explicitly
  updates Coordinator decisions.

Implementation direction:

- The first adapter should read the current item, merge `patch`, and call the
  existing full update API if the lower-level API still requires a full update
  request.
- Preserve task-scoped run settings when not provided: `executionWorkspace`,
  `codexExecutable`, `sandbox`, and `approvalPolicy`.
- Preserve prompt, execution policy, status, title, description, and priority
  when not provided.
- For non-durable fields such as dependencies, queue tag, validation status,
  Coordinator status, order/index, and report/evidence summaries, only update
  them when the existing current model supports the change. Otherwise return a
  clear unsupported/action-failed result rather than silently pretending the
  mutation persisted.

## 6. Safety Classes

- `queue.getSnapshot`: safe read.
- `queue.createItem`: safe create/update.
- `queue.updateItem`: safe create/update for ordinary field patches.
- Later confirmation may be required for updates that change run settings,
  make a task runnable, remove blockers, or affect Coordinator decision state.
- Destructive operations are out of scope.
- Execution and autonomous execution are out of scope.
- Coordinator finalization is out of scope.

## 7. Workspace Agent Integration

Workspace Agent will use the first slice to:

- inspect Queue state;
- summarize tasks, blockers, counts, run settings, and safe report/evidence
  availability;
- create Queue tasks from an explicit user request;
- update prompts, status, priority, execution policy, and task-scoped run
  settings;
- report the action result to the operator in the visible Workspace Agent
  transcript or action result surface.

Workspace Agent must not:

- use shell, Codex, filesystem writes, localStorage, DOM scraping, or direct
  SQLite writes to mutate Queue state;
- edit Queue persistence directly;
- start Agent Executor, Codex Direct Work, validation, Queue Autorun, Terminal,
  Git, or any other execution path in this API slice;
- create hidden Queue work;
- finalize Coordinator decisions through `queue.updateItem`;
- rely on provider tool calls to bypass the app-native Queue action bridge.

The first implementation should add a small frontend Workspace Agent action
bridge over `queue.getSnapshot`, `queue.createItem`, and `queue.updateItem`.
Provider requests remain `allowed_tools: []`; provider output may draft or
suggest Queue changes, but actual mutations must go through the app-native
bridge and visible UI/action handling.

## 8. Events

Minimal first-slice events:

- `queueSnapshotRead`: optional/no event. Use only if the implementation needs
  local action-result observability for read actions.
- `itemCreated`: emitted after successful `queue.createItem`.
- `itemUpdated`: emitted after successful `queue.updateItem`.
- `actionFailed`: emitted or returned after failed read/create/update.

Events may be frontend-local action-result records in the first implementation.
They must be safe summaries and must not include raw Executor payloads,
secrets, filesystem data, Git diffs, Terminal output, or hidden widget state.

## 9. Tests For Implementation Block

Future implementation tests should cover:

- `queue.getSnapshot` returns the singleton Queue snapshot.
- `queue.getSnapshot` includes all Queue items and counts.
- `queue.createItem` creates a task with title, prompt, and task-scoped run
  settings.
- `queue.createItem` can create a draft item.
- `queue.createItem` can create a queued item when prompt requirements are
  satisfied.
- `queue.createItem` does not start execution.
- `queue.updateItem` updates only requested fields.
- `queue.updateItem` preserves task-scoped run settings when not provided.
- `queue.updateItem` preserves prompt/status/priority when not provided.
- Workspace Agent can call `queue.createItem` through the app-native action
  bridge.
- Workspace Agent can report a create/update action result visibly.
- No shell, Codex, Terminal, direct SQLite write, filesystem edit, or provider
  tool invocation is used for Queue CRUD.

## 10. Implementation Block Plan

Next coding block:

`QUEUE-API-03` - Implement `getSnapshot` / `createItem` / `updateItem`
adapter.

Expected code scope:

- Frontend Queue Widget API adapter.
- Workspace Agent bridge to the adapter.
- Focused tests for adapter behavior and Workspace Agent bridge use.
- No backend changes unless the existing Tauri Queue API lacks required
  create/update support for already persisted Queue item fields.

Expected changed layers:

- `apps/desktop/frontend/src/workbench/` for the Workspace Agent bridge and
  any Queue Widget API adapter placement.
- `apps/desktop/frontend/src/workspace/` only if the adapter needs a small
  typed wrapper around existing Workspace API calls.
- Tests near the changed frontend adapter/bridge files.

Avoid in `QUEUE-API-03`:

- Queue execution.
- Queue Autorun start/stop.
- Agent Executor launch.
- Provider tool execution.
- Backend schema changes for non-durable UI/controller fields.
- Destructive actions.
- Coordinator finalization.

## 11. Acceptance Criteria

This docs/type-design block is complete when:

- The minimal API slice is defined.
- DTO shapes are defined.
- Action behavior is defined.
- Safety boundaries are defined.
- Workspace Agent usage is defined.
- Implementation tests are listed.
- `docs/ACTIVE_CONTRACT_INDEX.md` points future agents to this implementation
  plan.
- No runtime code changed.
- No frontend source changed.
- No backend/Rust source changed.
- No tests changed.
- No schemas changed.
