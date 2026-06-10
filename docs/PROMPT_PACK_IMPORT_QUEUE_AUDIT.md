# Prompt Pack Import Queue Audit

Status: docs-only functional audit.

## Purpose

Audit how Hobit can import a local prompt pack and materialize it into
dependency-aware Agent Queue items without adding a second Queue runtime,
storage path, scheduler, hidden execution path, or automatic Queue behavior.

This audit does not add frontend behavior, backend behavior, Tauri commands,
storage/schema changes, Queue execution, validation execution, diff review
execution, Git mutation, rollback behavior, auto-finalization, auto-commit, or
auto-push.

Reference prompt-pack shape:

```text
prompts/core-model-batch-001/
  README.md
  prompt-batch.json
  001-...
  002-...
```

## Prompt-Runner And Prompt-Pack Conventions Found

Current repository inspection found no implemented `prompts/` directory and no
prompt-runner import/runtime code path for local prompt packs.

Existing references:

- `docs/WORKSPACE_CHAT_QUEUE_CONTROL_STATUS.md` lists prompt pack import as a
  remaining gap and recommended next functional block.
- `docs/WORKSPACE_CHAT_QUEUE_CONTROL_AUDIT.md` recommends typed Workspace Chat
  Queue action cards over parser-first batch commands.
- `docs/AGENT_UI_IMPLEMENTATION_RULES.md` mentions future prompt packs that
  touch UI as prompt boilerplate only.
- `apps/desktop/frontend/src/workbench/workspaceAgentQueueBatchCommands.ts`
  and related parser files implement text-command batch Queue creation
  conventions, but they are compatibility/convenience behavior, not a local
  prompt-pack importer.

Conclusion: there is no current prompt-pack parser, local folder reader, zip
reader, manifest schema validator, or materialization workflow to reuse as an
implementation. A future prompt-pack import feature must define its own
frontend parse/preview layer while delegating Queue creation to existing Queue
actions.

## Current Queue Fields And Action Paths

### Persisted Queue task fields

The durable backend/Tauri Queue task path is:

```text
Queue create UI or Workspace Agent Queue bridge
  -> createAgentQueueTask
  -> create_agent_queue_task Tauri command
  -> WorkspaceService::create_agent_queue_task
  -> agent_queue_tasks SQLite table
```

Persisted fields currently available through this path:

- `queue_item_id`
- `workspace_id`
- `title`
- `description`
- `prompt`
- `status`
- `priority`
- `execution_policy`
- `execution_workspace`
- `codex_executable`
- `sandbox`
- `approval_policy`
- `context_json`
- `assigned_executor_widget_id`
- `created_at`
- `updated_at`

The Queue Widget API accepts a richer frontend create/update shape:

- title, description, prompt
- draft/queued status on create
- priority
- dependencies
- execution policy
- execution workspace
- Codex executable
- sandbox
- approval policy
- item type
- queue tag
- validation status

However, the Rust app service and SQLite `agent_queue_tasks` table do not
persist dependencies, queue tags, item type, validation status, expected commit
title, allowed scope, forbidden scope, validation commands, or arbitrary
metadata as first-class Queue task fields.

### Frontend-only or non-durable Queue fields

QueueV2 and the Queue Widget API model expose useful fields that are not fully
durable through the current task storage path:

- `dependsOn` / `dependencies`
- `itemType`
- `queueTagId` / `queueTagName`
- `validationStatus`
- `orderIndex`
- `coordinatorStatus`
- `closureState`
- `workerExecutionReports`
- `diffReview`
- execution plan previews

Some of these fields are held in Queue controller local task foundation state
or derived snapshots. They can drive current-session QueueV2 views, but they
cannot be treated as durable prompt-pack metadata without storage/API follow-up.

### Existing safe creation paths

Safe task creation paths to reuse:

- `WorkspaceAgentQueueBridge.createItem`
- `createAgentQueueWidgetApi.createItem`
- `createAgentQueueTask`
- Queue widget `queue.createTask`
- Workspace Chat Queue control service `create_task`

These paths create Queue-owned tasks and explicitly report that no Executor run,
Autorun, validation, Terminal command, Git action, or coordinator finalization
was started.

### Existing run and review paths

The existing explicit run path remains separate:

```text
Queue selected assigned task Run
  -> queue.run.onStartAssignedTask()
  -> startAssignedAgentQueueTask
  -> existing Agent Executor Direct Work stream
```

Prompt-pack import must not call this path. Imported Queue items must remain
draft or queued and unassigned/unrun unless the operator later uses existing
Queue controls.

Validation, diff review, coordinator decisions, commit, follow-up, and
rollback are not import-time behaviors. Current Workspace Chat Queue control
also records validation execution, generic diff review creation, rollback
execution, and stop/cancel as unsupported or Executor-owned actions.

## Workspace Chat To Queue Control Path

`docs/WORKSPACE_CHAT_QUEUE_CONTROL_AUDIT.md` and
`docs/WORKSPACE_CHAT_QUEUE_CONTROL_STATUS.md` establish the safest control
plane:

- use typed action cards;
- keep parser/batch commands secondary;
- create tasks through the existing Queue bridge/API;
- keep QueueV2 as the visual/model surface over canonical Queue state;
- do not create a second Queue store or runtime;
- do not auto-run, arm Autorun, validate, finalize, commit, push, rollback, or
  launch Terminal from chat cards.

The current implementation includes
`createWorkspaceChatQueueControlService`, which supports:

- create task from visible draft fields;
- open/select task when the host callback exists;
- run selected task through existing Queue controller action when available;
- coordinator decision actions where existing Queue controller support exists;
- explicit unavailable results for validation, diff review, rollback, and
  stop/cancel actions.

Prompt-pack import should follow the same pattern: parse into editable visible
Queue task drafts, preview them, and call `bridge.createItem` once per
approved item. The import feature should not use natural-language parser
commands as the authoritative materialization path.

## File And Import Capabilities

### Knowledge import

Knowledge / Skills currently supports explicit single-file import:

- Tauri desktop picker uses `@tauri-apps/plugin-dialog` with `.txt`, `.md`,
  and `.markdown` filters.
- Browser fallback can read a single selected `File` via `file.text()`.
- Desktop path read delegates to `read_knowledge_document_import_file`.
- The Tauri command accepts one path, rejects folders, rejects unsupported
  extensions, caps size at 1 MB, and requires UTF-8.
- Import creates or drafts Knowledge/Skill records through existing explicit
  Knowledge/Skill APIs.

This path cannot read a prompt-pack folder, multiple files, or zip archive.

### Tauri file/directory capabilities

Current Tauri dialog capability allows opening explicit directories or files,
but there is no general Tauri command for:

- listing arbitrary local folder entries for import;
- reading multiple prompt files from a selected folder;
- reading JSON plus sibling prompt files as one transaction;
- reading zip archives;
- recursively scanning prompt-pack directories.

The only current local path content reader in this area is the Knowledge
single-file text/Markdown import command.

### Finder

Finder can open an explicit root through the browser File System Access
directory picker when available. With a supported directory handle it can:

- list bounded, non-recursive directory columns;
- open selected folders as additional columns;
- preview one selected text file with a 100 KB cap;
- edit supported uncapped text files explicitly;
- create Knowledge-generation Queue tasks from selected Finder refs.

Finder does not provide a reusable general import API for another widget to
read a folder, read all prompt-pack files, or ingest selected files into Queue
tasks. Its approved-root handle is Finder-owned current-session state.

### Browser file input

Existing browser file import support is single-file only through the Knowledge
import hook. Browser APIs could support a future explicit multi-file picker or
directory upload where available, but Hobit does not currently expose a
prompt-pack file input or folder import surface.

## Safest Implementation Path

Target display level: Minimal / Operational hybrid only for import review.
The first implementation should remain an explicit import-review workflow, not
a full prompt-pack manager.

Recommended path:

1. Add a prompt-pack import review surface to an existing relevant surface,
   preferably Knowledge / Skills or Workspace Chat Queue control, not a new
   widget.
2. Accept explicit operator-selected text inputs first:
   `prompt-batch.json` plus the individual prompt files selected in the same
   browser file input, or a pasted/exported single JSON bundle if multi-file
   folder selection is unavailable.
3. Parse and validate in frontend only:
   title/objective/prompt, priority, task order, logical dependency keys,
   validation command text, expected commit title, allowed scope, forbidden
   scope, tags/queue tag, and metadata.
4. Show a visible preview before creation:
   item count, unsupported fields, unresolved dependencies, missing prompt
   bodies, dependency graph errors, oversized files, and what will be encoded
   into persisted Queue fields.
5. On explicit operator approval, call the existing Queue Widget API
   `createItem` for each task. Default status should be `draft`; allow `queued`
   only as an explicit import option and still do not assign or run.
6. Preserve dependency information as well as current storage allows:
   - within the current session, pass `dependencies` to `queue.createItem`
     where the Queue Widget API accepts them;
   - durably encode dependency keys and resolved Queue IDs in the prompt or
     description until a persisted dependency field exists;
   - visibly warn that first-class durable dependencies are not implemented.
7. After creation, show created Queue item IDs and open/select actions through
   existing Queue open callbacks.

Dependency materialization needs a two-phase create:

```text
parse pack logical ids
  -> preview dependency graph
  -> create tasks without durable dependency ids
  -> build logical-id to queue-item-id map
  -> update descriptions/prompts with resolved dependency ids
  -> optionally call queue.updateItem with dependencies for current-session state
```

This still does not create durable dependency storage. It only preserves
operator-visible dependency metadata and current-session Queue Widget API
snapshots where available.

## Recommended Field Mapping

Use existing durable fields first:

| Prompt-pack field | Queue field/path | Current support |
| --- | --- | --- |
| task title | `title` | Durable |
| objective/summary | `description` | Durable |
| full task prompt | `prompt` | Durable |
| priority | `priority` | Durable, 0-5 |
| initial state | `status` | Durable, use `draft` by default |
| execution policy | `execution_policy` | Durable |
| execution workspace | `execution_workspace` | Durable if explicit |
| Codex executable | `codex_executable` | Durable if explicit |
| sandbox | `sandbox` | Durable if explicit |
| approval policy | `approval_policy` | Durable if explicit |
| dependencies | `dependencies` / `dependsOn` | Frontend API/current-session only; not durable |
| tags / queue tag | `queueTag` / `queueTagName` | Frontend-only/current-session; not backend durable |
| validation commands | prompt/description text | Not first-class durable task field |
| expected commit title | prompt/description text | Not first-class durable task field |
| allowed scope | prompt/description text | Not first-class durable task field |
| forbidden scope | prompt/description text | Not first-class durable task field |
| metadata | prompt/description text or Knowledge doc refs | No arbitrary Queue metadata field |

Suggested prompt/description encoding for unsupported fields:

- add a compact `Prompt pack metadata` section to the task description;
- add explicit `Validation`, `Expected commit title`, `Allowed scope`,
  `Forbidden scope`, and `Dependencies` sections to the prompt;
- include the source prompt-pack name and logical task key;
- state that the task must not auto-finalize, auto-commit, auto-push, or run
  dependent tasks.

## Unsupported Capabilities And Gaps

Unsupported local import capabilities:

- local prompt-pack folder read;
- recursive prompt-pack directory scan;
- zip import;
- multi-file Tauri read command;
- prompt-batch manifest validation command;
- backend prompt-pack parser;
- durable prompt-pack import record;
- durable mapping from prompt-pack logical id to Queue item id;
- import rollback/delete batch action.

Unsupported Queue metadata gaps:

- durable dependencies;
- durable tags/queue tags from create/update API;
- durable item type;
- durable validation status through backend task DTO;
- first-class validation commands;
- expected commit title;
- allowed scope;
- forbidden scope;
- arbitrary metadata;
- durable coordinator/import decision state;
- dependency-aware execution based on imported dependencies.

Unsupported workflow gaps:

- validation execution;
- diff review execution;
- rollback execution;
- automatic Coordinator decision;
- automatic follow-up creation;
- automatic commit or push;
- auto-run after import;
- hidden provider/tool use;
- background scheduler or durable runner.

## Audit Conclusion

The safest near-term path is a visible prompt-pack parse and preview workflow
that materializes approved items through the existing Queue Widget API and
Queue task create path. The importer should treat local folder/zip reading and
durable dependency storage as unsupported until a later explicit bridge and
Queue storage/API slice exists.

Without backend/storage changes, prompt-pack dependencies can be preserved only
as visible task text plus current-session Queue Widget API dependency state.
That is enough for an honest first import-preview block, but not enough to
claim durable dependency-aware Queue execution.
