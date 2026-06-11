# Self-Development Product Path Fix Audit

## Status

Status: docs-only blocker audit for
`SELF-DEVELOPMENT-PRODUCT-PATH-FAILURE-AUDIT-01`.

This document audits the current manual self-development smoke blockers and
defines the exact implementation path needed to continue from the broken
product path. It does not add frontend behavior, backend/runtime behavior,
storage/schema changes, Queue scheduling, Agent Executor execution, validation
automation, Diff Review execution, Git mutation, Terminal launch, provider
tools, automatic finalization, automatic commit, push, rollback, or dependency
execution. Current implemented widget behavior remains governed by
`docs/CURRENT_WIDGET_SURFACE.md`.

## Observed Manual Smoke State

- Import-start intent now opens an actionable prompt-pack import card.
- Pasting only `prompt-batch.json` parses the manifest and dependency
  relationship, but `Create Queue items` is disabled when item prompt bodies
  live in separate numbered Markdown files that were not read into the preview.
- Pasting a single numbered Markdown prompt imports successfully into QueueV2
  Intake / Draft and does not invoke Codex, shell, SQLite, Queue execution, or
  Autorun.
- Imported Queue task details expose draft review/edit affordances, but the
  visible QueueV2 details path does not provide the complete draft-to-runnable
  product path for the imported item.
- Validation controls render as unavailable from QueueV2 with:
  `Validation runner is unavailable for this Queue surface.`

## Inspected Surfaces

Prompt-pack import:

- `apps/desktop/frontend/src/workbench/promptPack/promptPackSourceAdapter.ts`
- `apps/desktop/frontend/src/workbench/promptPack/promptPackImportPreview.ts`
- `apps/desktop/frontend/src/workbench/promptPack/WorkspaceAgentPromptPackImportCard.tsx`
- `apps/desktop/frontend/src/workbench/promptPack/promptPackParser.ts`
- `apps/desktop/frontend/src/workbench/promptPack/promptPackMaterialization.ts`
- `apps/desktop/frontend/src/workbench/useWorkspaceAgentPromptPackImport.ts`

Safe file/folder reads:

- `apps/desktop/src-tauri/src/knowledge_document_import_commands.rs`
- `apps/desktop/src-tauri/src/lib.rs`
- `apps/desktop/frontend/src/workspace/workspaceApiKnowledgeDocumentImport.ts`
- `apps/desktop/frontend/src/workbench/WorkspaceAgentDirectModePanel.tsx`

Queue state/actions:

- `apps/desktop/frontend/src/workbench/queue/useAgentQueueTaskActions.ts`
- `apps/desktop/frontend/src/workbench/queue/useAgentQueueRunActions.ts`
- `apps/desktop/frontend/src/workbench/queue/agentQueueWidgetApi.ts`
- `apps/desktop/frontend/src/workbench/AgentQueuePlaceholderWidget.tsx`
- `apps/desktop/frontend/src/workbench/AgentQueueV2Board.tsx`
- `apps/desktop/frontend/src/workbench/widgetV2/queueV2/QueueV2TaskDetailsPopup.tsx`
- `apps/desktop/frontend/src/workbench/widgetV2/queueV2/queueV2TaskDetailsActions.ts`
- `apps/desktop/frontend/src/workbench/WorkspaceAgentQueueTaskStatusCard.tsx`
- `apps/desktop/frontend/src/workbench/workspaceChatQueueControlService.ts`

Validation runner/evidence:

- `crates/hobit-app/src/workspace_service/agent_queue_validation_runner.rs`
- `apps/desktop/src-tauri/src/validation_runner_commands.rs`
- `apps/desktop/src-tauri/src/validation_runner_dto.rs`
- `apps/desktop/frontend/src/workbench/validation/validationRunner.ts`
- `apps/desktop/frontend/src/workbench/queue/queueValidationEvidenceService.ts`
- `apps/desktop/frontend/src/workbench/widgetV2/queueV2/QueueV2ValidationEvidenceSection.tsx`
- `apps/desktop/frontend/src/workbench/widgetProps/queueExecutorWidgetProps.ts`
- `apps/desktop/frontend/src/workbench/widgetProps/workspaceAgentWidgetProps.ts`

Relevant status docs:

- `docs/PROMPT_PACK_IMPORT_QUEUE_STATUS.md`
- `docs/PROMPT_PACK_IMPORT_INTENT_ROUTING_FIX_STATUS.md`
- `docs/PROMPT_PACK_IMPORT_PRODUCT_ACTION_FIX_STATUS.md`
- `docs/VALIDATION_RUNNER_EVIDENCE_STATUS.md`
- `docs/SELF_DEVELOPMENT_READINESS_STATUS.md`

## Root Causes

### 1. Prompt-pack local folder reader is intentionally unavailable

`promptPackSourceAdapter.ts` exports
`PROMPT_PACK_FOLDER_OR_ZIP_SOURCE_STATUS` as the unavailable source adapter.
`WorkspaceAgentPromptPackImportCard.tsx` tells the operator that folder and zip
readers are unavailable. `promptPackPreviewFromSourceText` creates exactly one
in-memory parser entry: JSON becomes `prompt-batch.json`; otherwise the text is
treated as `001-pasted-prompt.md`.

That explains the observed pasted-manifest failure: the parser can see manifest
items and dependency metadata, but it cannot load the referenced Markdown
prompt bodies from the local folder, so each manifest item without inline
`prompt` / `body` / `text` / `content` becomes `missing_body`.

### 2. Existing safe read helpers are single-file or picker-only, not prompt-pack folder readers

The existing Knowledge import command reads one explicit `.txt`, `.md`, or
`.markdown` file with a 1 MB cap and UTF-8 validation. The Workspace Agent
working-directory picker selects a directory path but does not read files from
that directory. Finder has an explicit root/file preview model, but it is not a
prompt-pack import service and should not be repurposed as hidden ingestion.

There is no typed product command today that takes an explicit prompt-pack
folder path and returns bounded entries for `README.md`, `prompt-batch.json`,
and numbered Markdown prompt files.

### 3. Imported items are created as safe drafts, but QueueV2 details do not expose the full promotion/run path

Prompt-pack materialization intentionally creates Queue items with `status:
"draft"` and `executionPolicy: "manual"`. This is correct for safety and must
remain true: import must not auto-run tasks.

The Queue controller already has a safe promotion path:
`promoteSelectedDraftToQueued` updates a selected draft to `queued` and reports
that no Executor run, validation, Git action, or finalization was started.
The Queue run controller already exposes explicit selected-task run through
`run.onStartAssignedTask`, gated by assignment, execution workspace, Codex
settings, dependency readiness, and runnable status.

The product gap is in QueueV2 details/action exposure. `queueV2TaskDetailsActions.ts`
only adds a run action for `queued`, `ready`, or `review_needed` items. Draft
items get the next action `Edit draft`, but the popup action list does not
surface a `Promote to queued` action from the existing controller. As a result,
an imported draft can be inspected, but the manual smoke cannot continue from
QueueV2 details into the explicit ready/run path.

Workspace Chat Queue task status cards have similar selected-task gating for
run actions. They can call the existing queue run action only when the task is
selected/open and `queue.run.canStart` is true. They do not provide a dedicated
draft promotion action for imported prompt-pack tasks.

### 4. Validation runner backend exists, but product-surface runner wiring is missing

The app/Tauri validation runner exists:

- `run_queue_validation_suite` is registered in `apps/desktop/src-tauri/src/lib.rs`.
- The app service validates workspace/task ownership, execution workspace,
  cwd containment, structured program/args, allowed safety categories, output
  caps, and no Git mutation / no commit-push flags.
- Frontend validation models and Queue evidence attachment services exist.

The QueueV2 details popup requires two props before enabling validation:
`validationRunner` and `onRequestValidation`. The normal Agent Queue widget
path in `AgentQueuePlaceholderWidget.tsx` renders `AgentQueueV2Board` without
either prop. `agentQueueWidgetProps` likewise passes Queue controller and
Knowledge actions only; it does not provide a desktop validation runner adapter
or a Queue validation request handler.

Workspace Chat cards follow the same pattern: validation controls work only if
a `ValidationRunner` prop is supplied. `workspaceAgentWidgetProps` does not
wire one, so the visible chat surface also reports runner unavailability.

## Product Path Gaps

1. Typed prompt-pack folder import cannot collect a complete multi-file pack.
   The product can parse multi-entry prompt-pack data, but the UI can only
   supply one pasted entry today.

2. QueueV2 details do not expose an explicit `Promote to queued` action for
   imported drafts, even though the controller already supports the operation.

3. Workspace Chat Queue action cards can show/open/run selected Queue tasks,
   but they cannot promote an imported draft to queued before run.

4. QueueV2 validation request UI exists, but the normal Agent Queue surface
   does not provide the runner/request props needed to enable it.

5. Workspace Chat validation cards exist, but the normal Workspace Agent
   surface does not provide a validation runner.

6. The Tauri validation command returns runner output, while the current
   frontend Queue evidence attachment service expects a `ValidationRunner`
   interface. A small adapter layer is missing between the Tauri command DTO
   and the existing frontend runner/evidence model.

## Recommended Implementation Path

### Block 1: Minimal typed prompt-pack folder reader

Add a narrow desktop-only Tauri command and frontend API for prompt-pack source
reading.

Expected behavior:

- Input: one explicit operator-provided folder path, selected through the
  existing directory picker or typed/pasted visibly in the prompt-pack import
  card.
- Reads only direct children named `README.md`, `prompt-batch.json`, and
  numbered Markdown prompt files matching the existing numbered prompt pattern.
- Does not recurse.
- Does not read zip archives.
- Rejects non-direct child traversal, invalid UTF-8, missing directories,
  oversized files, oversized total pack content, and unsupported extensions.
- Returns `PromptPackFileEntry[]`-shaped DTOs with relative path, file name,
  byte size, source label, and text.
- Does not parse, create Queue items, validate, run, assign, finalize, commit,
  push, or invoke Codex.

Implementation sketch:

- Add Tauri DTO/command files similar to
  `knowledge_document_import_commands.rs`, but specific to prompt-pack folder
  import and with pack-level caps.
- Register the command in `apps/desktop/src-tauri/src/lib.rs`.
- Add frontend `workspaceApiPromptPackImport` / Tauri adapter.
- Replace the hard unavailable folder path branch in the prompt-pack import
  card with an explicit `Read folder preview` action that calls the typed API,
  then feeds returned entries into `parsePromptPackImportPlan`.
- Keep pasted manifest/Markdown import as the browser-safe fallback.

Acceptance:

- The real smoke folder containing `README.md`, `prompt-batch.json`,
  `001-*.md`, and `002-*.md` previews with prompt bodies present.
- The pasted-manifest-only path still honestly blocks with `missing_body`
  unless the manifest contains inline bodies.
- No import action creates Queue items until `Create Queue items` is clicked.

### Block 2: QueueV2 draft promotion action

Expose the existing draft promotion controller in QueueV2 details.

Expected behavior:

- For selected draft tasks, QueueV2 details shows `Promote to queued`.
- The action calls the existing `queue.taskActions.onPromote` /
  `promoteSelectedDraftToQueued` path.
- It is disabled with visible reasons when the task is not selected, Queue API
  is unavailable, edits are dirty, saving/creating is in progress, prompt/title
  validation fails, or dependency validation fails.
- Promotion does not run, assign, validate, finalize, commit, push, arm
  Autorun, or start dependents.
- After promotion, existing `Run task` remains separately gated and explicit.

Implementation sketch:

- Extend `buildQueueV2TaskDetailsActions` with a `promote-to-queued` action
  for `task.status === "draft"`.
- Route to the existing Queue controller task action rather than adding a new
  backend path.
- Ensure the action only affects the selected task or asks the operator to
  open/select it first.

Acceptance:

- Imported task details show `Promote to queued`.
- Clicking it changes status to `queued`.
- `Run task` appears only after promotion and only when run prerequisites are
  satisfied.

### Block 3: Workspace Chat draft promotion action card

Add the same explicit promotion affordance to Workspace Chat Queue task status
cards.

Expected behavior:

- A Workspace Chat task card for an imported draft can promote the selected
  task to queued through the Queue controller.
- If the card is not for the selected Queue task, it first requires `Open
  Queue` / selection.
- It does not run the task.

Implementation sketch:

- Add a typed `promote_task` action to `workspaceChatQueueControlService`.
- Call the existing Queue controller promotion action when available.
- Add a `Promote to queued` button in `WorkspaceAgentQueueTaskStatusCard` for
  draft tasks.

Acceptance:

- Workspace Chat can continue from imported draft to queued without direct
  source edits or raw storage behavior.

### Block 4: Desktop validation runner adapter for QueueV2 and Workspace Chat

Wire the existing Tauri `run_queue_validation_suite` command into the existing
frontend `ValidationRunner` contract and request handlers.

Expected behavior:

- QueueV2 details receives both `validationRunner` and `onRequestValidation`
  in the normal Agent Queue widget path.
- Workspace Chat Queue validation cards receive the same runner.
- Browser/Vite fallback uses an unavailable runner with visible unsupported
  reason; it does not fake success.
- Desktop validation still requires explicit operator click, existing Queue
  task execution workspace, structured commands, and allowed safety.
- Validation output attaches to Queue state through the existing Queue update
  evidence service.
- Validation does not finalize, run dependents, commit, push, mutate Git, or
  launch Terminal.

Implementation sketch:

- Add frontend Tauri validation API mapping for `run_queue_validation_suite`.
- Implement a `ValidationRunner` adapter that converts
  `ValidationRunRequest` into the Tauri DTO and maps DTO output back to
  `ValidationRunnerOutput`.
- Add a Queue validation request handler that builds a request from selected
  task prompt-pack metadata/manual command and calls
  `requestValidationForQueueItem`.
- Pass `validationRunner` and `onRequestValidation` through:
  `useWorkbenchWidgetActions` or a small validation action module,
  `agentQueueWidgetProps`,
  `AgentQueuePlaceholderWidget`,
  `AgentQueueV2Board`,
  and Workspace Agent props/transcript.

Acceptance:

- QueueV2 no longer shows `Validation runner is unavailable for this Queue
  surface` in desktop when the task has an execution workspace and commands.
- Validation remains unavailable with an honest reason in browser/Vite.
- Running validation attaches capped evidence to the Queue item.

### Block 5: Focused manual smoke rerun

Run the manual product path only after Blocks 1-4 are complete.

Required pass path:

1. Start prompt-pack import from Workspace Agent with an explicit local folder
   path.
2. Read folder through the typed prompt-pack reader.
3. Preview both tasks with bodies and dependency `002 -> 001`.
4. Click `Create Queue items`.
5. Verify imported tasks are draft/manual and dependency state is visible.
6. Promote task 001 to queued from QueueV2 or Workspace Chat.
7. Explicitly run task 001 only through existing Queue run controls.
8. Explicitly request validation only through QueueV2 or Workspace Chat.
9. Continue Diff Review / coordinator finalization only through existing
   explicit controls.

Failure conditions:

- Any path uses Codex, shell commands, raw SQLite, or hidden file reads to
  perform product actions.
- Prompt-pack import auto-runs tasks.
- Promotion starts execution.
- Validation runs automatically.
- Queue Autorun arms or starts without explicit operator action.
- Any automatic finalization, commit, push, rollback, Terminal launch, or
  provider tool call occurs.

## Intentionally Not Implemented By This Audit

- No source code changes.
- No tests changed.
- No Tauri commands added.
- No local folder reader implemented.
- No Queue action wiring changed.
- No validation runner wiring changed.
- No storage/schema changes.
- No Queue runtime, scheduler, Autorun, or dependency execution semantic
  changes.
- No Agent Executor, Terminal, Git, Diff Review, finalization, commit, push,
  rollback, or provider behavior changes.

