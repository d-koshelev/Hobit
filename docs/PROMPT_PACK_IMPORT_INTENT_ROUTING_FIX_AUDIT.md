# Prompt Pack Import Intent Routing Fix Audit

## Status

Docs-only blocker audit for `IMPORT-INTENT-ROUTING-REGRESSION-AUDIT-01`.

No source code, tests, frontend behavior, backend/runtime behavior, Tauri
commands, storage/schema changes, Queue scheduling, Agent Executor execution,
validation automation, Git mutation, Terminal launch, provider tools,
automatic finalization, automatic commit, push, rollback, or dependency
execution is changed by this document.

## Observed Regression

The operator entered this initial Workspace Chat request:

```text
Import this prompt pack into Queue, show preview first, do not create Queue items until I confirm:

C:\Users\Dmitry\Documents\prj\hobit-realistic-dogfooding-smoke-pack
```

Workspace Chat returned:

```text
typed product action unavailable: there is no active prompt-pack import preview
to confirm. No Codex run, shell command, SQLite write, Queue Autorun, Terminal
command, commit, or push was started.
```

The raw SQLite/tool-loop guard worked: no Codex run, shell command, SQLite
write, Queue Autorun, Terminal command, commit, or push was started. The
regression is intent routing: an initial import-start request was classified as
confirmation of an already-existing preview.

## Inspected Areas

- Product-action guard:
  `apps/desktop/frontend/src/workbench/workspaceAgentProductActionGuards.ts`.
- Product-action guard tests:
  `apps/desktop/frontend/src/workbench/workspaceAgentProductActionGuards.test.ts`.
- Workspace Agent send ordering:
  `apps/desktop/frontend/src/workbench/InteractiveAgentPlaceholderWidget.tsx`.
- Prompt-pack import state hook:
  `apps/desktop/frontend/src/workbench/useWorkspaceAgentPromptPackImport.ts`.
- Prompt-pack import card:
  `apps/desktop/frontend/src/workbench/promptPack/WorkspaceAgentPromptPackImportCard.tsx`.
- Prompt-pack preview service:
  `apps/desktop/frontend/src/workbench/promptPack/promptPackImportPreview.ts`.
- Prompt-pack source adapter:
  `apps/desktop/frontend/src/workbench/promptPack/promptPackSourceAdapter.ts`.
- Prompt-pack import status and prior audit docs:
  `docs/PROMPT_PACK_IMPORT_QUEUE_STATUS.md`,
  `docs/PROMPT_PACK_IMPORT_PRODUCT_ACTION_FIX_STATUS.md`, and
  `docs/PROMPT_PACK_IMPORT_PRODUCT_ACTION_FIX_AUDIT.md`.

## Root Cause

`runWorkspaceAgentProductActionConfirmation(...)` only understands one
prompt-pack intent: confirmation. It calls
`isPromptPackImportConfirmationText(text, hasPendingImport)` before normal
Workspace Agent chat/Queue/Knowledge routing.

`isPromptPackImportConfirmationText(...)` is overbroad:

- it treats any text with a confirmation verb and `prompt-pack`, `queue
  items`, or `import` as a prompt-pack import confirmation;
- `import` itself is considered a confirmation verb;
- the function can return `true` even when `hasPendingImport` is false;
- therefore an initial request that says `Import this prompt pack into Queue`
  is classified as confirmation.

Once that happens, `runWorkspaceAgentProductActionConfirmation(...)` looks for
the latest import state. With no active preview in
`promptPackImport.imports`, it returns the unavailable message:
`there is no active prompt-pack import preview to confirm`.

The guard correctly prevents fallback Codex/raw-storage execution. It is wrong
because it has no separate start intent and treats import-start language as a
confirm intent.

## Intent Classification Path

Current path for the observed request:

1. `InteractiveAgentPlaceholderWidget.sendCoordinatorMessage()` trims the
   composer text.
2. It calls `sendProductActionConfirmationFromDraft(...)` before Queue command,
   Knowledge command, local proposal, or provider routing.
3. `sendProductActionConfirmationFromDraft(...)` calls
   `runWorkspaceAgentProductActionConfirmation(...)`.
4. `runWorkspaceAgentProductActionConfirmation(...)` computes
   `pendingImport` from `promptPackImport.imports`.
5. Because no import card exists yet, `pendingImport` is null.
6. `isPromptPackImportConfirmationText(...)` still returns true for the initial
   import request because it contains `import` and import/prompt-pack terms.
7. The guard handles the message as a confirmation and returns the active
   preview missing error.
8. The message never reaches an import-start preview creation path.

This ordering is intentional for product-action safety, but the classifier
must be precise enough to separate start, confirm, cancel, and unknown intents.

## Required Intent Model

Prompt-pack import routing should return an explicit intent before performing
any action:

```text
start_prompt_pack_import_preview
confirm_prompt_pack_import_preview
cancel_prompt_pack_import_preview
unavailable/unknown
```

### start_prompt_pack_import_preview

Meaning: the operator is asking to begin an import preview from explicit
operator-supplied source, and no Queue items should be created yet.

Examples:

- `Import this prompt pack into Queue, show preview first...`
- `Start prompt-pack import`
- `Preview this prompt pack before creating Queue items`
- `Import prompt pack from C:\path\to\pack, wait for confirmation`

Required behavior:

- create a prompt-pack import state and transcript card;
- if source text is supplied inline and is parseable, initialize
  `sourceText`;
- if only a filesystem path/folder is supplied, show an explicit unavailable
  folder/path source state unless a typed reader is implemented;
- do not confirm creation, call Queue materialization, route through Codex,
  inspect SQLite, read arbitrary folders, start Queue Autorun, run validation,
  launch Terminal, mutate Git, commit, push, or rollback.

### confirm_prompt_pack_import_preview

Meaning: the operator is confirming an existing active preview.

Examples when an active preview exists:

- `confirm`
- `confirm import`
- `create Queue items`
- `looks good, create them`

Required behavior:

- require a non-cancelled, non-completed active preview;
- require a preview that parses and has `importAvailable === true`;
- call the typed Queue creation/materialization action only;
- create draft/manual Queue items only;
- do not auto-run tasks, arm/start Autorun, run validation, finalize, commit,
  push, rollback, launch Terminal, or call provider tools.

Without an active preview, confirmation text should report that confirmation
requires an active preview and should offer the explicit start path. It must
not reinterpret the request as raw storage work.

### cancel_prompt_pack_import_preview

Meaning: the operator wants to cancel the active preview.

Examples when an active preview exists:

- `cancel import`
- `cancel prompt-pack import`
- `discard this preview`
- `stop this import`

Required behavior:

- require a non-completed active preview;
- set the current-session import state to cancelled through the import hook;
- do not create or delete Queue items, run Codex, inspect SQLite, launch
  Terminal, mutate Git, commit, push, rollback, or touch Autorun.

### unavailable/unknown

Meaning: the text is not a prompt-pack product action, or it requests a source
or capability that the current typed product path does not support.

Required behavior:

- return `handled: false` for ordinary chat/code tasks so normal Workspace
  Agent routing can proceed;
- return a visible unavailable product-action message for raw SQLite/DB bypass
  attempts;
- return a visible unsupported source message for folder/path import if the
  product chooses to intercept that as start intent but no typed source reader
  exists.

## Active Preview State Behavior

Active preview state is current-session React state in
`useWorkspaceAgentPromptPackImport(...)`:

- `imports: Record<string, WorkspaceAgentPromptPackImportState>`;
- import ids are generated as `prompt-pack-import-${nextMessageId.current}`;
- `start()` creates an import state with `sourceText: ""`;
- `start()` appends a transcript message with `promptPackImportId`;
- `WorkspaceAgentTranscript` renders
  `WorkspaceAgentPromptPackImportCard` only when the message has
  `promptPackImportId` and matching import state;
- `patch(importId, patchValue)` updates source/result/cancel state;
- `cancel(importId)` sets `isCancelled: true`;
- `reset()` clears current-session import state.

The preview itself is derived from `importState.sourceText` by
`promptPackPreviewFromSourceText(...)`.

Current source support:

- pasted prompt-batch JSON or one numbered Markdown prompt can become
  in-memory parser entries;
- local folder/zip/path reading is explicitly unavailable;
- `PROMPT_PACK_UNAVAILABLE_SOURCE_ADAPTER` says no safe prompt-pack folder or
  zip reader is wired;
- `WorkspaceAgentPromptPackImportCard` tells the operator that folder and zip
  readers are unavailable.

Therefore the observed path request cannot currently be fulfilled by silently
reading `C:\Users\Dmitry\Documents\prj\hobit-realistic-dogfooding-smoke-pack`.
The correct current behavior is to start an import card with a visible
unsupported folder/path source state or ask the operator to paste the manifest
content into the card. It must not be classified as confirmation.

## Recommended Implementation Path

1. Replace confirmation-only classification with an explicit intent parser.

   Add a small pure helper, for example:

   ```text
   classifyPromptPackImportIntent(text, { hasPendingImport })
   ```

   returning:

   ```text
   start_prompt_pack_import_preview
   confirm_prompt_pack_import_preview
   cancel_prompt_pack_import_preview
   unavailable/unknown
   ```

   Keep it deterministic and frontend-local. Do not call providers, Codex,
   shell commands, SQLite, or filesystem readers from classification.

2. Make confirmation require pending-preview context unless the text is a
   precise confirmation command plus a prompt-pack-specific existing preview
   reference.

   The existing broad rule should be narrowed. In particular, initial phrases
   such as `import this prompt pack`, `show preview first`, and `do not create
   Queue items until I confirm` are start intent, not confirm intent.

3. Add a typed start handler to `useWorkspaceAgentPromptPackImport`.

   Suggested shape:

   ```text
   start({ sourceText?: string, sourcePath?: string, unavailableReason?: string })
   ```

   For pasted JSON/Markdown source, initialize `sourceText` so the card can
   preview immediately. For a filesystem path/folder source, create the card
   with visible unsupported source metadata/copy. Do not read the path unless a
   later typed, explicit prompt-pack source reader is implemented.

4. Add a start-routing branch before confirmation materialization.

   `InteractiveAgentPlaceholderWidget.sendProductActionConfirmationFromDraft`
   should become a product-action intent router, or delegate to one. For
   `start_prompt_pack_import_preview`, it should call the import start handler
   and append a visible assistant response/card. It should not call
   `createQueueItemsFromPromptPackPreview`.

5. Add a cancel branch.

   For `cancel_prompt_pack_import_preview`, find the latest pending import and
   call `promptPackImport.cancel(importId)`. If no pending import exists, show
   a visible no-active-preview message.

6. Preserve raw product-action bypass guard behavior.

   The SQLite/tool-loop guard should remain separate. It should continue to
   block raw storage work, but it should not be the only product-action
   classifier.

7. Keep folder/path support honest.

   The current contract/status documents say local prompt-pack folder import,
   zip import, recursive scanning, and multi-file Tauri prompt-pack reads are
   not implemented. A path-only start request should not fake success. It can
   create an import card explaining that folder/path source is unavailable and
   asking for pasted manifest/Markdown source, or it can return a typed
   unavailable message. The stronger product UX is to create the card so the
   operator has the correct place to paste source.

## Recommended Test Changes

Add focused tests without changing runtime semantics beyond routing:

- `workspaceAgentProductActionGuards.test.ts`:
  - `classifyPromptPackImportIntent("Import this prompt pack into Queue, show preview first...", false)` returns `start_prompt_pack_import_preview`;
  - the same text does not return confirmation;
  - `confirm import` without pending preview returns confirmation intent but
    produces the no-active-preview message, not raw/Codex routing;
  - `yes` returns confirmation only when `hasPendingImport` is true;
  - `cancel import` with pending preview returns cancel;
  - ordinary code prompts containing `import` such as TypeScript imports or
    implementation tasks return unknown.

- `InteractiveAgentPromptPackImport.test.tsx`:
  - sending the observed initial text creates or opens a prompt-pack import
    card rather than returning `there is no active prompt-pack import preview
    to confirm`;
  - path-only source shows a visible unsupported folder/path state and does not
    create Queue items;
  - pasted manifest/source start initializes the card source and renders a
    preview;
  - confirm text after a valid pending preview calls
    `createQueueItemsFromPromptPackPreview`;
  - cancel text after a pending preview marks the card cancelled.

- `WorkspaceAgentPromptPackImportCard.test.tsx`:
  - path/folder unavailable state is visible and `Create Queue items` remains
    disabled until parseable source is supplied;
  - no Queue create callback fires from preview/start/cancel alone.

Regression assertions should explicitly verify that no Codex Direct Work,
shell command, SQLite write, Queue Autorun, Terminal command, commit, or push
is invoked from start, unsupported path, or cancel routing.

## Acceptance Criteria

- Initial import-start text is not classified as confirmation.
- The operator can begin prompt-pack import from Workspace Agent text or the
  existing header action and receive the same product card boundary.
- Confirmation only materializes Queue items when an active valid preview
  exists and the typed Queue create action is available.
- Cancel only cancels the current-session preview.
- Unsupported path/folder source is explicit and visible; success is not
  faked.
- Queue items created by import remain draft/manual and do not auto-run.
- No prompt-pack import path routes product actions through Codex, shell,
  SQLite, Terminal, Git, Queue Autorun, provider tools, commit, push, rollback,
  validation execution, or hidden Workspace context reads.

## Intentionally Not Implemented In This Audit

- No code changes.
- No tests changed.
- No local folder reader, zip reader, recursive scan, or multi-file Tauri
  prompt-pack import.
- No backend/Rust/Tauri/storage/schema changes.
- No durable prompt-pack import records.
- No Queue dependency persistence change.
- No Queue scheduler, Autorun semantic change, Agent Executor launch,
  validation execution, Diff Review execution, finalization, Git mutation,
  Terminal launch, commit, push, or rollback.
