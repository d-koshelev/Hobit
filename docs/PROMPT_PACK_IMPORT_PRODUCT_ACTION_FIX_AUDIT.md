# Prompt Pack Import Product Action Fix Audit

## Status

Status: docs-only blocker audit after failed manual self-development smoke.

This audit does not add frontend behavior, backend/Rust/Tauri commands,
storage/schema changes, Queue runtime behavior, scheduler behavior, Autorun
behavior, provider tools, validation execution, Diff Review execution,
rollback execution, Git mutation, Terminal execution, automatic finalization,
automatic commit, automatic push, or automatic rollback.

Current implemented widget behavior remains governed by
`docs/CURRENT_WIDGET_SURFACE.md`. Queue and Workspace Agent action boundaries
remain governed by `docs/AGENT_QUEUE_WIDGET_API_CONTRACT.md`,
`docs/AGENT_QUEUE_PRODUCT_MODEL_CONTRACT.md`, and
`docs/COORDINATOR_CENTERED_WORKBENCH_CONTRACT.md`.

## Observed Failure

The manual smoke proved the preview parser/model can recognize a two-item
prompt pack and show dependency metadata such as `002 -> 001`, but the real UI
path failed at the product action boundary:

- preview appeared as plain Workspace Agent / Workspace Chat markdown text;
- no actionable `Create Queue items` or `Cancel import` controls appeared;
- the operator's textual confirmation was routed as a normal Workspace Agent
  / Codex message;
- the agent tried to infer product behavior by inspecting shell output,
  SQLite, and repository text;
- the agent correctly refused raw SQLite insertion because no typed product
  action connector was exposed in that path;
- no Queue items were created.

## Inspected Paths

- Workspace Agent transcript and card rendering:
  `apps/desktop/frontend/src/workbench/InteractiveAgentPlaceholderWidget.tsx`,
  `apps/desktop/frontend/src/workbench/WorkspaceAgentTranscript.tsx`,
  `apps/desktop/frontend/src/workbench/useWorkspaceAgentPromptPackImport.ts`,
  and
  `apps/desktop/frontend/src/workbench/promptPack/WorkspaceAgentPromptPackImportCard.tsx`.
- Prompt-pack parser, preview, and materialization:
  `apps/desktop/frontend/src/workbench/promptPack/promptPackParser.ts`,
  `promptPackImportPreview.ts`, `promptPackImportPreviewComponent.tsx`, and
  `promptPackMaterialization.ts`.
- Workspace Chat / Workspace Agent Queue bridge:
  `apps/desktop/frontend/src/workbench/workspaceAgentQueueBridge.ts`,
  `apps/desktop/frontend/src/workbench/queue/agentQueueWidgetApi.ts`, and
  `apps/desktop/frontend/src/workbench/queue/useWorkspaceQueueApi.ts`.
- Frontend Queue model and QueueV2 readiness/dependency display:
  `apps/desktop/frontend/src/workspace/types/agentQueue.ts`,
  `apps/desktop/frontend/src/workbench/queue/useAgentQueueController.dependencies.test.tsx`,
  `apps/desktop/frontend/src/workbench/queue/queueV2LifecycleModel.ts`, and
  `apps/desktop/frontend/src/workbench/widgetV2/queueV2/QueueV2PromptPackImportSection.tsx`.
- Desktop/Tauri DTOs and commands:
  `apps/desktop/frontend/src/workspace/tauriAgentQueueApi.ts`,
  `apps/desktop/frontend/src/workspace/tauriAgentQueueDto.ts`,
  `apps/desktop/src-tauri/src/agent_queue_task_dto.rs`, and
  `apps/desktop/src-tauri/src/agent_queue_task_commands.rs`.
- App service and SQLite storage:
  `crates/hobit-app/src/workspace_service/agent_queue_task_types.rs`,
  `crates/hobit-app/src/workspace_service/agent_queue_tasks.rs`,
  `crates/hobit-app/src/workspace_service/mapping.rs`,
  `crates/hobit-storage-sqlite/src/schema.rs`, and
  `crates/hobit-storage-sqlite/src/store/agent_queue_tasks.rs`.

## Root Cause

The implementation split preview/action behavior across two different product
paths.

The actionable path exists only when Workspace Agent creates a
`promptPackImportId` message via the explicit `Import pack` header action. That
message renders `WorkspaceAgentPromptPackImportCard`, which provides source
editing, preview, `Create Queue items`, and `Cancel import` controls. Its
create action calls `materializePromptPackPreviewToQueue`, which calls the
typed `WorkspaceAgentQueueBridge.createItem` and `updateItem` methods.

The failed smoke used a different path: the preview was rendered as ordinary
assistant markdown/text in the Workspace Agent transcript. A plain message body
does not carry `promptPackImportId`, does not render
`WorkspaceAgentPromptPackImportCard`, and therefore cannot expose the typed
Queue import actions. A later textual confirmation is just another chat
message, so it is routed to Workspace Agent / Codex instead of a product
action handler.

In short: service-level prompt-pack import logic exists, but the preview shown
in the failed real UI path was not connected to an actionable product card.

## Why Tests Passed

The focused tests cover the explicit-card path and service functions with fake
or injected bridges:

- `InteractiveAgentPromptPackImport.test.tsx` clicks `Import pack`, pastes
  source into the card, and clicks `Create Queue items`.
- `WorkspaceAgentPromptPackImportCard.test.tsx` mounts the card directly with
  a fake `WorkspaceAgentQueueBridge`.
- `promptPackMaterialization.test.ts` validates create/update calls at the
  service boundary.

Those tests do not cover the failed path where the preview is emitted as
markdown/plain assistant text and the operator confirms by typing natural
language. They also do not exercise the desktop Tauri/SQLite Queue dependency
round trip.

## Product Path Gaps

1. Plain-text preview is not an action surface.

   Workspace Agent message body markdown cannot become Queue items. It must
   render a typed import state/card with explicit controls, or it must clearly
   say import actions are unavailable from that message.

2. Text confirmation has no product-action binding.

   The current command parser can handle explicit Queue commands, but there is
   no scoped pending import confirmation model that maps "create these" or a
   similar reply to a specific prompt-pack preview. Routing that text to Codex
   is expected under the current implementation, but it is wrong for a
   rendered product preview that asks for confirmation.

3. Workspace Agent lacks a typed import bridge for preview text produced by an
   agent/provider.

   Provider or Codex output can draft text, but provider tools remain
   `allowed_tools: []`. Product mutation must happen through a typed app
   action, not through natural-language execution or storage inference.

4. Unsupported action states are not explicit enough.

   If a prompt-pack preview is not attached to a typed card, the UI should not
   imply that textual confirmation can create Queue items. It should expose a
   visible "Open actionable import card" action or a visible unsupported state.

## Storage And Dependency Gaps

Frontend Queue types and the first Widget API slice already contain dependency
fields:

- `CreateAgentQueueTaskRequest.dependsOn`;
- `UpdateAgentQueueTaskRequest.dependsOn`;
- `QueueCreateItemRequest.dependencies`;
- `QueueUpdateItemPatch.dependencies`;
- `AgentQueueTask.dependsOn`;
- `QueueWidgetItemSnapshot.dependencies`.

However the desktop durable path does not carry them:

- `tauriAgentQueueApi.ts` does not send `depends_on`;
- `tauriAgentQueueDto.ts` does not define `depends_on`;
- `agent_queue_task_dto.rs` does not accept or return dependencies;
- `CreateAgentQueueTaskInput`, `UpdateAgentQueueTaskInput`, and
  `AgentQueueTaskSummary` do not include dependency ids;
- `agent_queue_tasks` SQLite schema has no dependency column or edge table;
- storage create/list/get/update SQL has no dependency persistence;
- app-service mapping cannot round-trip dependency data.

The current QueueV2 dependency/readiness model can reason over `task.dependsOn`
when it is present in frontend state, and controller tests prove that blocked
dependencies should wait for accepted/finalized prerequisites. That does not
make dependency links durable in the desktop product path.

The failed smoke's "live SQLite schema did not show durable dependency
field/table" observation is correct.

## Confirmation Routing Gap

Workspace Agent confirmation is currently card/action specific, not a general
chat reply protocol. Approval and creation flows work when controls are
rendered on proposal cards or Queue action cards. Prompt-pack import likewise
works only when `WorkspaceAgentPromptPackImportCard` is present.

When the preview is plain assistant text, the transcript has no pending
`importId`, no typed preview object, no create/cancel handlers, and no
confirmation target. The composer therefore treats the operator's confirmation
as an ordinary message and, depending on mode, sends it through local parsing,
provider drafting, or Codex Direct Work.

This must not be fixed by teaching Codex to inspect SQLite and insert rows.
The fix is a typed Workspace Agent product action that owns the preview,
confirmation, creation, result, and unsupported states.

## Guardrails Needed

- Workspace Agent must not ask Codex, shell, or a provider to perform Queue
  creation by reverse-engineering SQLite, local files, React state, DOM state,
  or private component internals.
- When a requested product action lacks a typed bridge, Workspace Agent should
  stop with a visible unsupported action message and point to the required
  product bridge.
- Prompt-pack import confirmation must be button/action based for the first
  fix. If a later text-confirmation flow is added, it must bind to a specific
  pending import id and call the same typed app action.
- Tests and manual smoke docs must assert that no raw SQLite insert, shell
  storage mutation, Codex natural-language execution, Queue run, Autorun,
  Terminal launch, Git mutation, finalization, commit, or push occurs.

## Recommended Implementation Path

### Phase 1: Actionable Preview Card

- Ensure every prompt-pack import preview shown in Workspace Agent is a typed
  `WorkspaceAgentPromptPackImportCard` or an equivalent typed card state, not
  markdown-only assistant text.
- Add an explicit "Open import card" fallback if a provider/Codex response
  includes prompt-pack preview text but no typed import state.
- Keep display level Minimal: source, preview facts, blocking errors,
  warnings, `Create Queue items`, `Cancel import`, and unsupported bridge
  state.

Acceptance:

- The failed smoke path renders `Create Queue items` and `Cancel import`.
- Typing "confirm" does not create items unless a future typed confirmation
  handler is explicitly implemented.

### Phase 2: Typed Queue Import Bridge

- Add a typed app-level import action that accepts one confirmed
  `PromptPackImportPreviewModel` and calls Queue create/update through the
  existing Queue Widget API.
- Return structured created-task ids, skipped dependency links, errors,
  warnings, and no-auto-run safety flags.
- Keep provider and Codex tool access disabled; the bridge is a frontend/app
  product action invoked by visible UI controls.

Acceptance:

- Import creates only draft/manual Queue tasks.
- Import result shows created ids and open actions.
- Import does not assign, start, validate, finalize, commit, push, rollback,
  launch Terminal, or arm Autorun.

### Phase 3: Durable Dependency Persistence And Gating

- Add the minimal durable dependency model required by Queue:
  either a validated `depends_on_json` column for small MVP lists or a
  normalized `agent_queue_task_dependencies` edge table.
- Prefer an edge table if dependency validation, reverse lookups, delete
  blocking, and future cycle checks are part of the same implementation block.
- Carry dependency ids through TypeScript Tauri requests/responses, Rust DTOs,
  app-service inputs/summaries, storage inputs/rows/mappers, and Queue Widget
  snapshots.
- Validate same-workspace dependency ids, reject self-dependencies, reject
  missing dependency ids where appropriate, and reject cycles before storing.
- Preserve current Queue runtime semantics: dependencies affect readiness and
  Autorun eligibility only; they do not execute dependents.

Acceptance:

- A desktop-created `002 depends on 001` import survives list/get/reload.
- QueueV2 shows linked Queue dependencies, not only prompt-pack text metadata.
- Queue run/readiness gates block dependent tasks until prerequisite tasks are
  explicitly finalized/accepted according to current Queue rules.

### Phase 4: Import Result And Open Actions

- After creation, show a result card with created Queue ids, dependency links
  created/skipped, warnings, errors, and `Open Queue` / `Open task` actions.
- Ensure open actions select/focus visible Queue state only; they must not run
  tasks or mutate task state.

Acceptance:

- Operator can jump from Workspace Agent import result to the created Queue
  task.
- Result copy/open actions remain non-mutating.

### Phase 5: Raw-Storage And Tool-Loop Guard

- Add Workspace Agent/Direct Work prompt and UI copy that product actions must
  use typed app services/actions and must stop on missing bridges.
- Add regression tests or smoke assertions that a failed/unsupported import
  bridge reports an explicit unsupported result instead of sending the agent
  into SQLite/schema reverse-engineering.
- Keep `allowed_tools: []` for provider-backed Workspace Agent drafts.

Acceptance:

- No Workspace Agent product-action path instructs Codex to inspect or mutate
  SQLite for Queue creation.
- Unsupported import create shows a short actionable blocker.

### Phase 6: Regression And Manual Smoke Docs

- Add/extend tests for the failed UI path:
  markdown/plain preview cannot masquerade as confirmation-ready;
  actionable preview card creates through the typed bridge;
  Tauri DTO/storage dependency round trip succeeds;
  QueueV2 readiness blocks dependency-gated tasks after reload.
- Update manual smoke docs with exact desktop steps, expected controls,
  expected no-auto-run safety checks, and unsupported states.

Acceptance:

- The self-development prompt-pack fixture imports two draft Queue tasks in
  desktop UI.
- `002` depends on the created Queue id for `001`.
- No Queue task starts automatically.
- The smoke records pass/fail with date, branch, and known unsupported states.

## Implementation Non-Goals

- Do not add prompt-pack folder or zip readers in this blocker fix.
- Do not add provider tools or let Codex execute Queue creation.
- Do not add hidden Workspace context reads.
- Do not add Queue scheduling, dependency execution, or durable background
  runner behavior.
- Do not auto-run imported tasks.
- Do not auto-finalize, auto-commit, auto-push, auto-rollback, or mutate Git.
- Do not use raw SQLite inserts as product behavior.

## Conclusion

The blocker is not a parser failure. It is a product-action wiring and
durability failure.

The correct fix is to make the real Workspace Agent preview path render an
actionable typed import card, route creation through a typed Queue import
bridge, and add minimal durable dependency persistence/gating through the
Queue API/storage stack. Natural-language confirmation and raw SQLite
reverse-engineering must remain outside product behavior.
