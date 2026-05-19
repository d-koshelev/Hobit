# Codebase And Contract Refactor Audit

## Summary

This audit captures the current contract and codebase state after the
Coordinator-centered product update and the first JDBC implementation slices.

The main finding is that Hobit now has a clear current product model, but the
contract set still carries older discovery-era language. Future agents should
not be asked to read every historical contract for every block. The next docs
slice should add an active contract index and then update stale pointers in a
focused cleanup block.

Code structure is generally modular in backend storage, app service, Tauri DTOs,
and recent frontend widgets. The main refactor pressure is not correctness; it
is cognitive load from large test files, frontend action prop wiring, broad API
facades, and older compatibility names that remain necessary but can leak into
prompts.

This document is audit-only. It does not change runtime behavior, frontend UI,
backend commands, storage schema, widget behavior, or compatibility paths.

## Contract Inventory

### Core Active

These should be read by most future implementation blocks, or indexed by a new
active contract index:

- `AGENTS.md`
- `docs/ACTIVE_CONTRACT_INDEX.md` after it exists
- `docs/CODE_ORGANIZATION_CONTRACT.md`
- `docs/CURRENT_WIDGET_SURFACE.md`
- `docs/ARCHITECTURE.md`
- `docs/COORDINATOR_CENTERED_WORKBENCH_CONTRACT.md`
- `docs/WIDGET_CAPABILITY_TOOL_CONTRACT.md`
- `docs/WIDGET_CONTRACT.md`
- `docs/WORKSPACE_CONTRACT.md`
- `docs/AGENT_RESPONSE_CONTRACT.md`
- `ROADMAP.md`

`AGENTS.md` is currently core active by instruction, but parts of it are stale:
it still says Coordinator is deferred, Interactive Agent is separate, and
Database/JDBC is not part of the current catalog. It should be cleaned after an
active contract index exists.

### Active Domain

These remain current source-of-truth documents for specific blocks:

- Agent Executor and Direct Work:
  `docs/DIRECT_MODE_AGENT_CONTRACT.md`,
  `docs/AGENT_RUN_OBSERVABILITY_CONTRACT.md`.
- Agent Queue:
  `docs/AGENT_QUEUE_PRODUCT_MODEL_CONTRACT.md`,
  `docs/QUEUE_TO_EXECUTOR_ASSIGNMENT_CONTRACT.md`,
  `docs/QUEUE_ITEM_EXECUTION_CONTRACT.md`.
- Git:
  `docs/GIT_WIDGET_CONTRACT.md`,
  `docs/GIT_COMMIT_SUPPORT_CONTRACT.md`.
- Notes:
  `docs/NOTES_WIDGET_CONTRACT.md`,
  `docs/NOTES_WIDGET_PRODUCT_CONTRACT.md`.
- JDBC:
  `docs/JDBC_WIDGET_CONTRACT.md`.
- Frontend/UI:
  `docs/PRODUCT_UI_VISUAL_CONTRACT.md`,
  `docs/DESIGN_SYSTEM_CONTRACT.md`,
  `docs/UI_CONTRACT.md`,
  `docs/WIDGET_PROGRESSIVE_DISCLOSURE_CONTRACT.md`,
  `docs/PRESET_CONTRACT.md`.
- Tool/action modeling:
  `docs/TOOL_ACTION_CONTRACT.md`,
  `docs/STATE_AND_EVENTS_CONTRACT.md`.
- Agent work process:
  `docs/AGENT_WORK_EFFICIENCY_CONTRACT.md`,
  `docs/AGENT_OPERATING_MODEL.md`.

### Deferred

These are valid contracts, but should not be treated as active implementation
targets unless a block explicitly names them:

- `docs/RUNBOOK_WIDGET_CONTRACT.md`
- `docs/TERMINAL_PTY_WIDGET_CONTRACT.md`
- `docs/SCRIPT_RUNNER_WIDGET_CONTRACT.md`
- `docs/TEMPLATE_CONTRACT.md`
- `docs/WORKSPACE_COORDINATOR_AGENT_CONTRACT.md`
- `docs/AGENT_RUNTIME_CONTRACT.md`
- JIRA/Confluence/Image Edit references inside broader product docs

Medical/healthcare workflows are out of active scope and should not drive demos
or near-term implementation.

### Superseded Or Compatibility-Only

These should remain available, but future prompts should not treat them as the
primary product model:

- `docs/INTERACTIVE_AGENT_WIDGET_CONTRACT.md`: compatibility context for the
  existing `interactive-agent` id/component now presented as Coordinator Chat.
- Older Agent Chat and Agent Monitoring paths in
  `docs/AI_INTEGRATION_READINESS_CONTRACT.md`,
  `docs/WORKSPACE_COORDINATOR_AGENT_CONTRACT.md`,
  `docs/AGENT_RUN_OBSERVABILITY_CONTRACT.md`,
  `docs/WORKSPACE_CONTRACT.md`, and
  `docs/WIDGET_PROGRESSIVE_DISCLOSURE_CONTRACT.md`: useful history and
  compatibility context, not the current user-facing product model.
- `docs/PRODUCT_SIMPLIFICATION_AUDIT.md`: historical audit/reference.
- `docs/DEMO_FLOW_CHECKLIST.md` and `docs/DIRECT_MODE_MVP_CHECKLIST.md`:
  reference checklists, not current source-of-truth inventory.

### Reference

These are still useful as broad positioning or terminology references:

- `README.md`
- `docs/PRODUCT_POSITIONING.md`
- `docs/PRODUCT_CONTRACT.md`
- `docs/AI_WORKBENCH_CONTRACT.md`
- `docs/GLOSSARY.md`

`README.md` currently omits Database / JDBC from the current widget list and
still says Database/JDBC is absent from the user-facing surface. It should be
updated during the pointer cleanup block, not ad hoc during unrelated feature
work.

## Recommended Active Contract Index Structure

Add `docs/ACTIVE_CONTRACT_INDEX.md` as the next docs block.

Recommended reading strategy:

1. Every block reads:
   `AGENTS.md`, `docs/ACTIVE_CONTRACT_INDEX.md`,
   `docs/CURRENT_WIDGET_SURFACE.md`,
   `docs/CODE_ORGANIZATION_CONTRACT.md`, and
   `docs/AGENT_RESPONSE_CONTRACT.md`.
2. UI/frontend blocks additionally read:
   `docs/PRODUCT_UI_VISUAL_CONTRACT.md` and the relevant widget/domain
   contract.
3. Backend/storage/Tauri blocks read only the relevant domain contract plus
   `docs/ARCHITECTURE.md`.
4. Agent Queue blocks read the Queue product, assignment, and execution
   contracts only when the block touches those areas.
5. Deferred contracts are read only when the block explicitly names the deferred
   surface.

The index should classify docs as core active, active domain, deferred,
superseded, and reference. It should also point future agents away from stale
discovery-era docs unless the block needs historical context.

## Contract Cleanup Candidates

### Must Clean Soon

- `AGENTS.md` current product direction still says Coordinator is deferred,
  Interactive Agent is separate, and Database/JDBC is not current.
- `README.md` current surface still excludes Database / JDBC and describes
  Agent Queue as review/history only.
- `docs/WORKSPACE_CONTRACT.md` still describes Agent Chat, Agent Monitoring,
  Template Library insertion, and proposal-review queue paths as current
  foundation in several places.
- `docs/AGENT_SURFACE_MODEL.md` recommended next blocks still include completed
  JDBC foundation/UI block numbers.

### Should Clean Soon

- `docs/AGENT_QUEUE_PRODUCT_MODEL_CONTRACT.md`,
  `docs/QUEUE_ITEM_EXECUTION_CONTRACT.md`, and
  `docs/QUEUE_TO_EXECUTOR_ASSIGNMENT_CONTRACT.md` still recommend old Block
  200/201 parallel planner and auto-dispatch contract names.
- `docs/AI_INTEGRATION_READINESS_CONTRACT.md` and
  `docs/AGENT_RUN_OBSERVABILITY_CONTRACT.md` still center older Agent Chat /
  Agent Monitoring proposal artifacts. Keep as compatibility references, but
  mark them as not the current Coordinator-centered product path.
- `docs/PRODUCT_POSITIONING.md` and `docs/PRODUCT_UI_VISUAL_CONTRACT.md` need
  small current-surface updates for Database / JDBC.

### Can Defer

- Contract deletion or large rewrites.
- Removing retained proposal/review compatibility paths.
- Renaming internal compatibility ids such as `interactive-agent`,
  `agent-chat`, or `agent-run`.
- Consolidating all agent-era contracts into one document.

## Block 220 Compatibility Path Audit

This audit reviewed retained Agent Chat proposal, Agent Monitoring snapshot,
and proposal-review Agent Queue paths after the current surface moved to
Coordinator Chat, Agent Executor, and manual Agent Queue tasks.

### Reference Map

- Agent Chat proposal persistence:
  - Rust service: `crates/hobit-app/src/workspace_service/agent_proposals.rs`.
  - Rust AI proposal generation:
    `crates/hobit-app/src/workspace_service/agent_ai_proposals.rs`.
  - Tauri commands: `persist_agent_chat_proposal` and
    `generate_agent_chat_ai_proposal`.
  - Frontend Workspace API: `workspaceApiAgentChat.ts`,
    `tauriAgentChatProposalPersistenceApi.ts`, `tauriAgentChatAiApi.ts`, and
    unsupported browser fallback methods.
  - Tests: `agent_proposal_tests.rs`, `agent_ai_proposal_tests.rs`,
    `workspace_dto_tests.rs`, and `agent_chat_ai_dto_tests.rs`.
- Agent Monitoring snapshot:
  - Rust service: `crates/hobit-app/src/workspace_service/agent_monitoring.rs`,
    including `proposal_result_summary`, which is still shared by the
    proposal-review Agent Queue path.
  - Tauri command: `get_agent_monitoring_snapshot`.
  - Frontend Workspace API: `tauriAgentMonitoringApi.ts`,
    `workspaceApiAgentChat.ts`, and unsupported browser fallback methods.
  - Tests: `agent_monitoring_tests.rs` and `workspace_dto_tests.rs`.
- Proposal-review Agent Queue:
  - Rust service: `crates/hobit-app/src/workspace_service/agent_queue.rs`.
  - Storage: the schema-backed `agent_queue_items` table and indexes,
    `store/agent_queue_items.rs`, `AgentQueueItemRow`, `NewAgentQueueItem`,
    workspace deletion cleanup, and widget deletion reference checks.
  - Tauri commands and DTOs: `create_agent_queue_item_from_proposal`,
    `get_agent_queue_snapshot`, and `agent_queue_dto.rs`.
  - Frontend Workspace API: `tauriAgentQueueApi.ts`,
    `workspaceApiAgentQueue.ts`, and unsupported browser fallback methods.
  - Tests: `agent_queue_tests.rs`, `agent_queue_dto_tests.rs`,
    `insert_and_list_agent_queue_items`, and workspace deletion tests.

Current Workbench components do not call the old proposal persistence,
Agent Monitoring snapshot, or proposal-review Queue APIs directly. That is not
enough to delete the paths because they remain typed, registered, tested, and
schema-backed compatibility surfaces.

### Removal Decision

No code removal was safe in Block 220. These paths are no longer current
catalog surfaces, but they are not definitely dead:

- They are registered Tauri commands and typed Workspace API methods.
- They are covered by app, Tauri DTO, and storage compatibility tests.
- They use persisted widget run/result artifacts and the schema-backed
  `agent_queue_items` table.
- Proposal-review queue items can reference source widget results, so deletion
  interacts with storage cleanup and widget/workspace deletion safety.
- Removing them would require a schema/API compatibility decision and broad
  test and documentation updates.

### Required Before Deletion

- Decide whether existing `agent_queue_items` data may be dropped, migrated, or
  preserved read-only.
- Decide whether the Tauri command names remain as compatibility no-ops, return
  unsupported errors, or are removed.
- Decide whether frontend `WorkspaceApi` methods remain for compatibility or
  are removed in a breaking API cleanup.
- Update or retire app, Tauri, frontend, and storage tests intentionally instead
  of weakening assertions.
- Update stale docs that still describe Agent Chat, Agent Monitoring, or
  proposal-review Queue as current behavior.

### Recommended Cleanup Slices

1. Frontend API compatibility policy: decide whether unused frontend wrappers
   remain compatibility-only methods or can be removed in a breaking cleanup.
2. Tauri/app compatibility policy: decide command-level fate for
   `persist_agent_chat_proposal`, `generate_agent_chat_ai_proposal`,
   `get_agent_monitoring_snapshot`, `create_agent_queue_item_from_proposal`,
   and `get_agent_queue_snapshot`.
3. Storage/schema cleanup: design a migration, archival, or preservation policy
   for `agent_queue_items`.
4. Docs cleanup: mark old Agent Chat, Agent Monitoring, and proposal-review
   Queue docs as historical compatibility where they still read like current
   behavior.

## Codebase Hotspots

### Must Refactor Before Large New Runtime Work

- `crates/hobit-app/src/workspace_service/tests.rs` is 1541 lines and exceeds
  the Toolbelt test-file warning threshold. It still covers workspace
  lifecycle, workbench state, widget mutations, Git status, logs, runs, and run
  results. Split it by existing domain boundaries before adding more service
  tests.
- `crates/hobit-tools/src/git.rs` is 821 lines and exceeds the source-file
  warning threshold. It combines public status types, porcelain parsing,
  process execution, capped IO, error classification, and tests. Split types,
  parser, command adapter, capped reader, and tests before adding more Git
  behavior.

### Should Refactor Soon

- `apps/desktop/frontend/src/workbench/useWorkbenchWidgetActions.ts` is 644
  lines and acts as a broad cross-widget action facade. Recent focused action
  helper files are a good pattern, but core executor, Git, Terminal, layout,
  and log actions still live in one hook.
- `apps/desktop/frontend/src/workbench/WidgetHost.tsx` is 445 lines and gates
  many widget-specific props by component key. A per-widget render adapter or
  capability-prop adapter would reduce cross-widget prop drilling.
- `apps/desktop/frontend/src/workbench/types.ts` is 393 lines and
  `WidgetRenderProps` carries every optional widget action. Split render prop
  types or create per-widget prop bundles when action wiring is refactored.
- `apps/desktop/frontend/src/workspace/workspaceApi.ts` is 461 lines and
  `apps/desktop/frontend/src/workspace/tauriWorkspaceApi.ts` is 700 lines.
  The focused Tauri API modules are useful, but the public facade still grows
  with every feature.
- `apps/desktop/frontend/src/workspace/memoryWorkspaceApi.ts` is 696 lines.
  Browser fallback behavior is honest, but unsupported capability methods now
  dominate the file.
- `apps/desktop/frontend/src/styles/components.css` is 2060 lines. Newer
  `agent-queue.css`, `notes.css`, and `jdbc.css` show the better direction:
  feature styles should live in focused files.

### Can Defer

- `apps/desktop/frontend/src/workbench/AgentExecutorRunHistoryPanel.tsx`,
  `AgentQueuePlaceholderWidget.tsx`, `CodexDirectWorkPanel.tsx`,
  `CodexDirectWorkLiveLog.tsx`, `GitWidgetCommitPanel.tsx`,
  `TerminalPlaceholderWidget.tsx`, `NotesPlaceholderWidget.tsx`, and
  `JdbcConnectorWidget.tsx` are near the source-file threshold but still
  internally coherent enough to defer until behavior changes.
- `crates/hobit-storage-sqlite/src/store.rs` is a healthy 218-line facade.
  Storage module split is already in good shape.
- `crates/hobit-app/src/workspace_service.rs` is a healthy 168-line facade.
  It can remain the public module/export hub.
- Tauri focused command modules for notes, JDBC, queue execution, queue tasks,
  and executor history are acceptable. `workspace_commands.rs` and
  `workspace_dto.rs` are larger, but not urgent unless new generic workspace
  commands are added.

## Recent Focused Modules That Should Be Preserved

- Agent Queue task/assignment/execution frontend panels and API action helpers.
- Queue-to-Executor current-session handoff and auto-refresh hooks.
- Agent Executor Direct Work panels split around form, live log, result,
  validation, diff, and history.
- Notes product UI and action helpers.
- JDBC connector metadata API modules, widget action helper, model helper,
  status helper, SQL placeholder, and focused CSS.
- Tauri JDBC connector command/DTO modules.
- Storage JDBC connector module and tests.

## Recommended Refactor Block Sequence

1. Block 211 - Active contract index.
2. Block 212 - Contract pointer cleanup.
3. Block 213 - Split `workspace_service/tests.rs` by domain.
4. Block 214 - Split `hobit-tools/src/git.rs`.
5. Block 215 - Frontend workbench action wiring cleanup.
6. Block 216 - Final current-state and new-chat handoff.

Optional later blocks:

- Split `components.css` into focused feature/style files.
- Split frontend workspace API facade and browser fallback by domain.
- Introduce per-widget render prop adapters after action wiring is split.
- Rename compatibility-only UI/CSS names only when it can be done without
  storage migration or user-facing churn.

## Risk Notes

- Stale contract text is now the highest prompt-risk. Future agents may follow
  AGENTS.md or older Workspace/Agent Chat contracts and incorrectly exclude
  Coordinator Chat or Database / JDBC from the current surface.
- Compatibility ids are intentional. `agent-run`, `interactive-agent`, and
  proposal/review compatibility paths should remain until a migration is
  explicitly designed.
- The codebase has several large files, but most risk is organizational rather
  than behavioral. Refactor blocks should be structure-only with full
  validation.
- Avoid combining contract cleanup with runtime implementation; stale pointer
  cleanup can create wide diffs if done opportunistically.

## Validation Strategy

For docs-only cleanup:

- `scripts/hobit/validate.ps1 -Profile fast` during audit or before edits.
- `scripts/hobit/validate.ps1 -Profile changed` after docs edits.
- `python scripts/hobit/changed-files-summary.py` with the local Python
  fallback if the Windows launcher fails.
- `scripts/hobit/validate.ps1 -Profile full` before commit/final response.

For structure-only refactors:

- Run focused module maps before and after the split.
- Keep public import paths stable where practical.
- Prefer moving tests without changing assertions.
- Run `full` validation before commit and report existing file-size warnings
  separately from new warnings.

## New-Chat Handoff Preparation Checklist

- Add `docs/ACTIVE_CONTRACT_INDEX.md`.
- Update stale root and contract pointers after the index exists.
- Record current widget inventory in one source of truth and point other docs to
  it instead of duplicating long current-state lists.
- Split the two recurring Toolbelt warning files.
- Document compatibility ids and retained proposal/review paths in the active
  index so future prompts do not treat them as current product surfaces.
- Confirm final `git status --short --branch` is clean after the handoff block.
