# Prompt Pack Import Queue Status

## Purpose

This document records the docs-only status after Prompt Pack Import -> Queue
Items Block 001.

Status: docs-only status record.

This document does not add frontend behavior, backend or Tauri commands,
storage/schema changes, Queue runtime behavior, scheduler behavior, Autorun
behavior, provider tools, validation execution, diff review execution, rollback
execution, Git mutation, Terminal execution, Workspace Agent V1 replacement,
Workspace Agent V2 replacement, QueueV2 replacement, or KnowledgeV2 behavior.
Current implemented widget behavior remains governed by
`docs/CURRENT_WIDGET_SURFACE.md`.

## Implemented In Block 001

### Audit

`docs/PROMPT_PACK_IMPORT_QUEUE_AUDIT.md` records the inspect-only audit of the
safe prompt-pack import shape.

The audit identified the safe path:

- parse explicit operator-provided prompt-pack text into editable Queue drafts;
- show a visible preview before Queue creation;
- create Queue-owned tasks only through existing Queue bridge/API actions;
- keep QueueV2 as the visual/model surface over canonical Queue state;
- preserve unsupported prompt-pack metadata in visible task text when Queue has
  no first-class durable field;
- do not add a second Queue runtime, storage path, scheduler, hidden execution
  path, or automatic Queue behavior.

### Parser And Model

Block 001 added a frontend prompt-pack parser/model under the Workspace Agent
surface.

Real behavior:

- accepts explicit in-memory entries supplied by the import card;
- recognizes a `prompt-batch.json` manifest or one numbered Markdown prompt;
- derives pack metadata from manifest, README-style headings, or safe fallback
  identity;
- parses item id/title/body, priority, dependencies, model profile, reasoning
  effort, validator profile, validation commands, expected commit title,
  allowed scope, forbidden scope, tags, and execution workspace when supplied;
- validates duplicate ids, invalid JSON, missing bodies, unresolved
  dependencies, unselected dependencies, and dependency cycles;
- defaults imported Queue drafts to `draft` status and `manual` execution
  policy.

The parser/model is frontend-only. It does not read local folders, read zip
archives, scan directories, call providers, or create Queue items by itself.

### Preview Service

The preview service builds an import preview before materialization.

Real behavior:

- shows selected item count and item details;
- summarizes dependency graph counts, roots/leaves, max depth, unresolved
  dependencies, and cycle status;
- reports blocking errors and warnings visibly;
- summarizes model/validator routing, validation commands, and expected commit
  titles;
- marks the source adapter honestly as in-memory entries;
- reports folder and zip import as unavailable.

Preview does not create Queue items, update Queue state, start validation, run
Codex, arm Autorun, mutate Git, launch Terminal, or finalize work.

### Queue Materialization

The materialization service creates Queue items from a confirmed preview.

Real behavior:

- requires an explicit confirmed preview before creating anything;
- blocks materialization when the preview has errors or the Workspace Agent
  Queue bridge is unavailable;
- calls the existing Workspace Agent Queue bridge create action for each
  selected item;
- creates draft Queue items only;
- creates dependency links only after selected items have been created, through
  the existing Queue update bridge where available;
- preserves prompt-pack metadata in the Queue description and prompt body,
  including pack name/id, block id, source path, model/validator hints,
  dependencies, validation commands, expected commit title, allowed scope, and
  forbidden scope;
- returns created Queue item ids, dependency-link results, warnings, and
  errors for visible review.

Materialization does not assign tasks, start Executor runs, arm or start
Autorun, run validation, create diff review items, finalize tasks, accept work,
commit, push, rollback, mutate Git, launch Terminal, call providers, or read
hidden Workspace context.

### Workspace Chat Import Flow

Workspace Agent / Workspace Chat exposes an explicit prompt-pack import card.

Real behavior:

- the operator starts import from the visible Workspace Agent status/action
  surface;
- the card accepts pasted source text only;
- the card renders the parser preview and warnings before creation;
- `Create Queue items` is disabled until the preview can import and the Queue
  bridge is available;
- Queue creation requires an explicit click;
- the result shows created Queue item ids, warnings, errors, open-task actions,
  and a copyable import summary;
- cancel, copy summary, preview editing, and open-task actions do not create,
  run, assign, validate, finalize, commit, or push.

Folder and zip readers are intentionally unavailable in this block and are
shown as unavailable instead of being faked.

### QueueV2 Metadata Display

QueueV2 reads prompt-pack metadata from the imported Queue task title,
description, and prompt text.

Real behavior:

- compact cards can show prompt-pack block/dependency/validation cues;
- task details can show prompt-pack metadata without rendering raw JSON;
- details preserve validation commands, expected commit title, allowed scope,
  forbidden scope, dependency labels, pack name/id, and block id where present;
- metadata display is derived from visible Queue task text and current Queue
  state.

QueueV2 does not become a prompt-pack store, parser, scheduler, validation
runner, dependency executor, Git surface, or Terminal launcher.

## Expected Behavior Record

- Import starts only from an explicit operator action in Workspace Chat /
  Workspace Agent.
- The operator pastes a manifest or numbered Markdown prompt and reviews the
  preview.
- Preview shows items, dependencies, model/validator hints, validation
  commands, expected commit titles, warnings, and blocking errors.
- Queue items are created only after explicit confirmation.
- Imported Queue items are created as draft/manual items.
- Metadata that lacks first-class Queue fields is preserved in the task
  description and prompt body with visible warnings.
- Dependency links are attempted only through existing Queue update actions
  after item creation.
- Imported Queue items do not auto-run.
- Import does not arm Autorun, start Executor, run validation, create diff
  review items, finalize tasks, accept work, commit, push, rollback, launch
  Terminal, call providers, or read hidden context.
- Workspace Agent V1/V2, QueueV2, KnowledgeV2, Agent Executor, and Queue
  runtime behavior remain otherwise unchanged.

## Safety Record

Block 001 preserves these boundaries:

- no hidden prompt-pack import;
- no hidden Queue item creation;
- no second Queue runtime or storage path;
- no backend/Rust/Tauri/storage/schema change;
- no local folder reader, recursive scan, or zip import;
- no hidden Queue execution;
- no hidden Queue scheduler or Autorun start;
- no direct Agent Executor launch outside existing Queue run controls;
- no validation execution;
- no diff review execution;
- no rollback execution;
- no auto-finalize, auto-accept, auto-commit, or auto-push;
- no Git mutation;
- no Terminal launch;
- no provider tool mode;
- no hidden Workspace, file, Notes, Knowledge, Queue, Executor, Git, JDBC,
  Terminal, or Runbook context access.

## Manual Smoke Checklist

Use a Workspace with Workspace Agent / Workspace Chat and Agent Queue / QueueV2
available.

1. Start prompt-pack import from Workspace Chat / Workspace Agent.
2. Paste a fixture manifest or numbered Markdown prompt.
3. Verify the preview shows selected items, dependencies, warnings, validation
   commands, expected commit titles, and model/validator routing where present.
4. Verify folder/zip import is visibly unavailable.
5. Confirm create with `Create Queue items`.
6. Verify created Queue item ids appear in the import result.
7. Open QueueV2 and verify the imported tasks appear as draft/manual Queue
   items.
8. Verify QueueV2 cards/details show prompt-pack block id, dependency cues,
   validation commands, expected commit title, allowed scope, forbidden scope,
   and pack metadata where present.
9. Verify dependency links are shown when the existing Queue update bridge can
   preserve them, or that skipped links are reported visibly.
10. Verify no Queue item auto-runs after import.
11. Verify Queue Autorun is not armed or started by import.
12. Verify task details metadata does not show raw prompt-pack JSON as the
    normal metadata display.
13. Verify copy summary and open-task actions do not create, run, assign,
    validate, finalize, commit, or push.

## Remaining Limitations

- Local prompt-pack folder import is not implemented.
- Zip import is not implemented.
- Recursive directory scanning is not implemented.
- Multi-file Tauri prompt-pack read is not implemented.
- Backend prompt-pack parser and manifest validation command are not
  implemented.
- Durable prompt-pack import records are not implemented.
- Durable prompt-pack logical-id to Queue item id mapping is not implemented.
- Durable first-class Queue dependency storage remains limited to the existing
  Queue API/state behavior; prompt-pack dependency metadata is also preserved
  in visible task text.
- Durable first-class Queue fields for model profile, reasoning effort,
  validator profile, validation commands, expected commit title, allowed
  scope, forbidden scope, source path, and arbitrary metadata are not
  implemented.
- Import rollback/delete-batch workflow is not implemented.
- Dependency-aware execution from imported dependencies is not implemented.
- Validation execution is not implemented by import.
- Diff review item workflow is not implemented by import.
- Coordinator finalization, acceptance, and commit hash workflow remain
  separate follow-up work.
- Self-development readiness smoke remains manual/future validation work.

## Recommended Next Functional Blocks

1. Validation runner/evidence.
   Add an explicit validation request/evidence workflow that records validation
   output without auto-accepting work.

2. Diff review item workflow.
   Define and implement explicit Diff Review Queue item creation/review
   without automatic diff execution, Git mutation, or hidden rollback behavior.

3. Coordinator finalization plus commit hash workflow.
   Connect explicit coordinator acceptance/finalization with visible commit
   hash recording where a separate approved Git/commit path supplies it.

4. Self-development readiness smoke.
   Run and document the manual dogfooding smoke for prompt-pack import ->
   QueueV2 -> Executor/manual review -> explicit decision flow.
