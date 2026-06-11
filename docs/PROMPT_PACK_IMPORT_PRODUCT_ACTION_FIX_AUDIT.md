# Prompt Pack Import Product Action Fix Audit

## Status

Docs-only blocker audit for the failed manual prompt-pack import product smoke.

No source code, tests, frontend behavior, backend behavior, Tauri commands,
SQLite schema, Queue runtime behavior, scheduler behavior, Autorun behavior,
Agent Executor behavior, validation execution, Git mutation, Terminal launch,
provider tools, automatic finalization, automatic commit, push, rollback, or
dependency execution is changed by this document.

## Objective

Audit why the prompt-pack import preview could be shown during manual
self-development smoke, but no actionable Queue item creation path was
available from the real operator flow.

Observed failure:

- prompt-pack import preview displayed 2 items and dependency `002 -> 001`;
- preview appeared as plain Markdown/text in Workspace Agent / Workspace Chat
  output rather than as a product action card;
- no `Create Queue items` or `Cancel import` controls were rendered;
- text confirmation was routed to Workspace Agent / Codex;
- the agent then reverse-engineered shell/SQLite/grep paths and correctly
  refused raw DB insertion because no typed product action bridge was exposed
  in that path and live durable Queue dependency storage was missing;
- no Queue items were created.

## Inspected Areas

- Workspace Agent transcript rendering:
  `apps/desktop/frontend/src/workbench/WorkspaceAgentTranscript.tsx`.
- Workspace Agent import state entry:
  `apps/desktop/frontend/src/workbench/useWorkspaceAgentPromptPackImport.ts`.
- Workspace Agent widget orchestration:
  `apps/desktop/frontend/src/workbench/InteractiveAgentPlaceholderWidget.tsx`.
- Prompt-pack preview and card:
  `apps/desktop/frontend/src/workbench/promptPack/promptPackImportPreview.ts`,
  `apps/desktop/frontend/src/workbench/promptPack/promptPackImportPreviewComponent.tsx`,
  and `apps/desktop/frontend/src/workbench/promptPack/WorkspaceAgentPromptPackImportCard.tsx`.
- Prompt-pack materialization service:
  `apps/desktop/frontend/src/workbench/promptPack/promptPackMaterialization.ts`.
- Workspace Agent Queue bridge:
  `apps/desktop/frontend/src/workbench/workspaceAgentQueueBridge.ts`.
- Queue Widget API frontend adapter:
  `apps/desktop/frontend/src/workbench/queue/agentQueueWidgetApi.ts` and
  `apps/desktop/frontend/src/workbench/queue/agentQueueWidgetApiTypes.ts`.
- Frontend Queue task/dependency model:
  `apps/desktop/frontend/src/workspace/types/agentQueue.ts` and
  `apps/desktop/frontend/src/workbench/agentQueueDependencyUi.ts`.
- Tauri Queue task DTO:
  `apps/desktop/src-tauri/src/agent_queue_task_dto.rs`.
- App service Queue task model:
  `crates/hobit-app/src/workspace_service/agent_queue_tasks.rs` and
  `crates/hobit-app/src/workspace_service/mapping.rs`.
- SQLite Queue task schema/store:
  `crates/hobit-storage-sqlite/src/schema.rs`,
  `crates/hobit-storage-sqlite/src/inputs.rs`,
  `crates/hobit-storage-sqlite/src/rows.rs`, and
  `crates/hobit-storage-sqlite/src/store/agent_queue_tasks.rs`.
- Existing status/audit docs:
  `docs/PROMPT_PACK_IMPORT_QUEUE_STATUS.md`,
  `docs/SELF_DEVELOPMENT_READINESS_STATUS.md`, and
  `docs/COORDINATOR_FINALIZATION_COMMIT_HASH_AUDIT.md`.

## Root Cause

The failed smoke used a real Workspace Agent text path, but prompt-pack import
creation is only wired to the typed import card path.

The typed path exists:

- `WorkspaceAgentHeaderStatus` exposes the `Import pack` button.
- `useWorkspaceAgentPromptPackImport.start()` creates a transcript message
  with `promptPackImportId`.
- `WorkspaceAgentTranscript` renders
  `WorkspaceAgentPromptPackImportCard` only when that message has a
  `promptPackImportId` and matching import state.
- `WorkspaceAgentPromptPackImportCard` renders the source textarea, preview,
  `Create Queue items`, and `Cancel import`.
- `Create Queue items` calls `materializePromptPackPreviewToQueue(...)` with
  `confirmed: true`.

The text path does not exist:

- plain assistant/provider/Codex text that looks like an import preview is
  rendered by `WorkspaceAgentMessageBubble` as normal message body;
- no parser promotes that text into a `promptPackImportId`;
- no composer command intercepts "confirm import" and binds it to a specific
  preview/card state;
- no typed product action is available when the operator replies in natural
  language;
- therefore confirmation is sent through normal Workspace Agent/Codex handling
  instead of calling a Queue import action.

The real product path failed because the actionable action card was not the
thing being previewed or confirmed.

## Product Path Gaps

1. Actionable preview card is not the canonical import surface for all import
   previews.

   The import card exists and has the right controls, but only the header
   `Import pack` action creates it. If a provider, Codex run, pasted transcript,
   or manual chat flow emits a preview as text/Markdown, the transcript does
   not attach an import state or action card.

2. Confirmation is natural-language, not typed product action.

   `Create Queue items` is a button on `WorkspaceAgentPromptPackImportCard`.
   The composer send path treats operator text as chat, queue command text, or
   direct work. It does not map a confirmation phrase to a specific
   pending import preview, and it should not rely on natural language for this
   mutation.

3. The Queue import bridge is generic and partial.

   Prompt-pack materialization calls generic `bridge.createItem` and then
   `bridge.updateItem({ dependencies })`. This is good for an early service
   test, but the product action should be a typed import bridge that creates
   the batch and dependency edges as one explicit app action with visible
   result semantics.

4. Result/open actions are current-session only.

   The card can show created ids and open created tasks when the frontend
   callback exists, but there is no durable import record, batch id, logical
   prompt-pack item to Queue item mapping, or reload-safe import result.

5. Unsupported states are not forcefully product-visible in the failed path.

   The card reports unavailable folder/zip readers and bridge absence. Plain
   text previews do not get those typed disabled states, so the operator can
   mistakenly treat the text as an actionable preview.

## Storage And Dependency Gaps

Frontend Queue task types include dependency fields:

- `CreateAgentQueueTaskRequest.dependsOn?: string[]`;
- `UpdateAgentQueueTaskRequest.dependsOn?: string[]`;
- `AgentQueueTask.dependsOn?: string[]`;
- Queue Widget API request patches use `dependencies: string[]`;
- `agentQueueDependencyUi.ts` derives ready/blocked/invalid dependency states
  from `task.dependsOn`.

The durable Rust/Tauri/SQLite path does not persist them:

- `apps/desktop/src-tauri/src/agent_queue_task_dto.rs` create/update requests
  and task DTOs have no dependency field;
- `CreateAgentQueueTaskInput`, `UpdateAgentQueueTaskInput`, and
  `AgentQueueTaskSummary` in the app service have no dependency field;
- `NewAgentQueueTask`, `AgentQueueTaskUpdate`, and `AgentQueueTaskRow` in the
  SQLite store have no dependency field;
- `agent_queue_tasks` in `schema.rs` has no `depends_on` column and no
  dependency edge table;
- the storage mapper cannot return dependency refs because the row has none.

This means dependency behavior can pass frontend/mock service tests where the
test bridge preserves `dependsOn`, but the desktop durable Queue path cannot
authoritatively store or reload imported dependency edges.

QueueV2 readiness and dependency gating are currently frontend-derived. The
rule is directionally correct: a dependent is blocked until the prerequisite
is `completed` and `coordinatorStatus === "finalized"`. The blocker is that
the dependency refs and coordinator/finalization fields are not durable
authoritative data in the current Queue task DTO/storage shape.

## Why Tests Passed

The focused tests exercised frontend service and component boundaries, not the
full desktop product path:

- `WorkspaceAgentPromptPackImportCard.test.tsx` renders the card directly and
  supplies a mock `WorkspaceAgentQueueBridge`.
- `promptPackMaterialization.test.ts` supplies a mock bridge whose
  `createItem` and `updateItem` accept dependency updates.
- `InteractiveAgentPromptPackImport.test.tsx` clicks the header `Import pack`
  action, so it follows the typed card path rather than a text preview path.
- Queue tests commonly preserve `dependsOn` in frontend test helpers.

Those tests prove that the typed card and frontend materialization service can
work when they are invoked and when the bridge preserves dependencies. They do
not prove that:

- a plain Workspace Agent text preview becomes an actionable product card;
- text confirmation calls a typed import action;
- dependencies persist through the Tauri/Rust/SQLite path;
- a reload or real desktop Queue snapshot preserves imported dependency
  edges.

## Why Confirmation Went To Codex

Workspace Agent has a normal composer send path. It checks explicit Queue
commands and Knowledge commands, then records an operator message and drafts a
local/provider response, or in Direct Work mode starts Codex.

Prompt-pack import confirmation is not registered as a typed composer command,
and the import preview state is not associated with plain message text. A
reply such as "confirm" or "create the items" is therefore just another
Workspace Agent message. That is the correct behavior for ordinary chat, but
it is the wrong product path for a mutation that must be explicit, visible,
and approval-aware.

The fix is not to teach Codex to perform the import. The fix is to keep
confirmation on a product action card or a typed app command that calls the
Queue import bridge directly.

## Raw Storage / Tool Loop Guardrails

Agents must not reverse-engineer SQLite to perform product actions. The
manual failure shows why: the agent spent excessive steps inspecting storage,
correctly found no durable dependency model, and refused raw insertion. That
refusal was right, but the product should prevent the loop earlier.

Guardrails needed:

- Workspace Agent import cards must show a disabled/unsupported product state
  when the typed Queue bridge is unavailable.
- The composer must not suggest natural-language confirmation for product
  mutations. Confirmation must be a button/action on the card or a registered
  typed command with a preview id.
- Agent/system instructions for self-development must say: if a typed Queue
  creation/import bridge is unavailable, stop and report the unsupported
  product path; do not inspect or mutate SQLite.
- Workspace Agent/Codex prompts for this workflow should explicitly forbid raw
  SQLite inserts/updates, schema probing as a substitute for product APIs, and
  command-line mutation of Queue records.
- Smoke docs should define failure criteria: no `Create Queue items` button
  means the import path is not wired; do not continue by asking Codex to
  create records.
- Future implementation should expose one typed app action for import so the
  agent and UI never need to infer storage internals.

## Recommended Implementation Path

### Phase 1: Actionable Preview Card

Make the actionable card the only accepted import preview surface.

- Add or route an explicit "Import prompt pack" command/action that always
  creates `WorkspaceAgentPromptPackImportState` and a transcript message with
  `promptPackImportId`.
- If provider/Codex text contains a recognizable import preview, render it as
  inert text plus a visible "Open import card" action rather than treating the
  text as confirmable.
- Keep `Create Queue items` and `Cancel import` on the card.
- Show bridge-unavailable and unsupported source states in the card, not only
  in prose.
- Do not auto-create, auto-run, assign, validate, finalize, commit, push, or
  rollback.

### Phase 2: Typed Queue Import Bridge

Add a typed product action for prompt-pack import instead of relying on a loop
of generic create/update calls from the card.

Suggested frontend/app API shape:

```text
queue.importPromptPackPreview({
  workspaceId,
  previewId/importId,
  pack,
  selectedItems,
  confirmed: true
})
```

The bridge should:

- validate the confirmed preview;
- create all Queue draft/manual items;
- preserve metadata in current visible fields and future first-class fields;
- create dependency edges through typed dependency persistence when available;
- return created task ids, skipped links, warnings, errors, and no-run safety
  flags;
- refresh/open Queue state after success.

This action must not expose provider tools, raw SQL/SQLite, hidden context
reads, Terminal commands, Git mutation, Executor start, Autorun arm/start, or
validation execution.

### Phase 3: Durable Dependency Persistence And Gating

Add the minimal typed dependency persistence required for Queue imports and
QueueV2 gates.

Recommended storage shape:

- a dedicated `agent_queue_task_dependencies` edge table with
  `workspace_id`, `dependent_queue_item_id`, `dependency_queue_item_id`,
  `created_at`, and `updated_at`;
- foreign keys to `agent_queue_tasks(queue_item_id)` with cascade behavior
  suitable for task deletion safeguards;
- an index by workspace/dependent and workspace/dependency.

Recommended API shape:

- create/update Queue task accepts typed dependency refs only through Queue
  task/dependency APIs;
- app service validates same-workspace refs, missing refs, self-dependency,
  and cycles;
- Tauri DTOs include `depends_on`/`dependsOn` consistently;
- frontend snapshots continue to derive ready/blocked/invalid state from
  typed refs;
- backend service prevents obviously invalid dependency graphs before storage.

Do not add dependency execution, backend scheduler claiming, hidden Autorun,
automatic dependent task start, or automatic acceptance.

### Phase 4: Import Result And Open Actions

Make import result navigation and review reliable.

- Persist or reconstruct a batch result with pack id/name, import id, created
  task ids, dependency links, skipped links, warnings, and errors.
- Add explicit `Open Queue`, `Open first created task`, and per-task open
  actions that work after Queue refresh.
- In QueueV2, show imported dependency refs from typed Queue state, not only
  parsed prompt text.
- Keep unsupported metadata visible and honest until first-class prompt-pack
  metadata fields exist.

### Phase 5: Raw-Storage / Tool-Loop Guard

Make the unsupported path explicit in product and docs.

- Add manual smoke failure language: if the card controls are absent, the
  product path failed; stop.
- Add Workspace Agent workflow copy/instructions: Queue creation must use
  typed app actions only.
- Ensure future provider/system prompts for this workflow include
  `allowed_tools: []` for drafting and no raw storage mutation language.
- Consider a small docs-only guard section in self-development smoke docs that
  bans SQLite/manual DB insertion as remediation.

### Phase 6: Regression And Manual Smoke Docs

Add regression coverage after implementation:

- UI test for the real header/action path rendering `Create Queue items` and
  `Cancel import`.
- UI test that plain text "confirm" does not create Queue items and instead
  points to the card/product action when a pending import exists.
- Bridge test through real Queue frontend adapter proving dependency refs are
  returned by the same task after create/update.
- Tauri DTO/app/storage tests for create/list/get/update preserving
  dependencies.
- QueueV2 test after reload-shaped data proving the dependent task is blocked
  until prerequisite finalization.
- Manual desktop smoke checklist that records pass/fail for actionable card,
  typed creation, dependency persistence, no auto-run, no Autorun arm, no
  Git/Terminal mutation, and unsupported-state handling.

## Acceptance Criteria For The Fix

- The operator can start prompt-pack import from Workspace Agent and always
  sees an actionable card, not only Markdown text.
- `Create Queue items` is a typed product action and is disabled when the
  bridge or preview is unavailable.
- Natural-language confirmation in the composer does not create Queue items
  and does not send Codex on a storage-reverse-engineering task.
- Imported Queue items are created as draft/manual only.
- Dependencies from the import are durably stored and visible after refresh.
- QueueV2 blocks dependents based on typed dependencies and current
  finalization gates.
- No import path starts Executor, Queue Autorun, validation, Diff Review,
  finalization, Git commit/push, rollback, Terminal, or provider tools.
- If any capability is missing, the UI reports unsupported state rather than
  faking success.
