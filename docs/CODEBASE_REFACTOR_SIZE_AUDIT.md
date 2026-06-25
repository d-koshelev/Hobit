# Codebase Refactor Size Audit

## Purpose

This document records the Block 53 line-count audit and refactor guard.

This block adds measurement, debt tracking, and refactor planning only. It does
not change runtime behavior, Queue workflow behavior, Queue UI behavior, visual
shell behavior, storage/schema behavior, or widget behavior.

## Guard

Toolbelt script:

```powershell
node scripts/hobit/check-line-counts.mjs --mode report
node scripts/hobit/check-line-counts.mjs --mode guard
```

Frontend package scripts:

```powershell
npm.cmd run report:line-count --prefix apps/desktop/frontend
npm.cmd run check:line-count --prefix apps/desktop/frontend
npm.cmd run test:line-count --prefix apps/desktop/frontend
```

Allowlist:

- `scripts/hobit/line-count-allowlist.json`
- Specific paths only; source globs are rejected.
- Each entry records current line count, category, reason, owner/domain,
  planned refactor block, target max line count, and remove-after debt note.
- Guard mode fails when an oversized file is not allowlisted, an allowlisted
  file grows above its recorded line count, an allowlisted path disappears, or
  an allowlisted category no longer matches.

Thresholds:

| Category | Threshold | Guard intent |
| --- | ---: | --- |
| source | hard over 1000 lines | prevent new oversized source and ratcheting existing source debt |
| test | warning over 1200 lines | require explicit debt entry and split plan |
| docs | warning over 1500 lines | require explicit debt entry and docs cleanup plan |
| styles | warning over 1200 lines | require explicit debt entry and style ownership plan |
| config | warning over 1500 lines | visible category coverage, no current findings |

The script ignores generated/vendor/local build paths such as `.git`,
`node_modules`, `target`, `dist`, `build`, `.vite`, `coverage`, `gen`,
`apps/desktop/src-tauri/gen`, lockfiles, and zip archives.

## Current Inventory

Block 53 scan result after adding the guard:

- Scanned files: 1664
- Source scanned: 1003
- Test scanned: 366
- Docs scanned: 247
- Styles scanned: 32
- Config scanned: 16
- Oversized findings: 46
- Oversized source files: 25
- Oversized test files: 15
- Oversized docs files: 2
- Oversized style files: 4
- Oversized config files: 0

### Top Oversized Source Files

| Lines | Path | Owner/domain | Priority |
| ---: | --- | --- | --- |
| 5591 | `apps/desktop/frontend/src/workbench/agents/adapters/workspaceAgentQueueBridgeAdapter.ts` | Workspace Agent Queue bridge | B |
| 4940 | `apps/desktop/frontend/src/workbench/agents/modules/queueWorkflowRunner.ts` | Queue workflow runner | A |
| 3863 | `crates/hobit-app/src/workspace_service/agent_queue_workflow_resume.rs` | Queue workflow backend resume | A |
| 3390 | `apps/desktop/frontend/src/workbench/workspaceAgentBrokerContinuation.ts` | Workspace Agent broker continuation | B |
| 3366 | `crates/hobit-app/src/workspace_service/agent_queue_workflow_evidence.rs` | Queue workflow worker evidence | A |
| 2617 | `apps/desktop/frontend/src/workbench/FinderWidget.tsx` | Finder widget | C |
| 2410 | `apps/desktop/frontend/src/workbench/agents/adapters/queueAgentCapabilities.ts` | Queue agent capabilities | B |
| 2340 | `apps/desktop/frontend/src/workbench/agents/modules/queueWorkflowRunnerRuntimeAdapter.ts` | Queue workflow runtime adapter | A |
| 2033 | `crates/hobit-app/src/workspace_service/agent_queue_workflow_setup.rs` | Queue workflow backend setup | A |
| 1932 | `crates/hobit-app/src/workspace_service/agent_queue_execution.rs` | Queue backend execution | A |

### Top Oversized Test Files

| Lines | Path | Owner/domain | Priority |
| ---: | --- | --- | --- |
| 6417 | `crates/hobit-app/src/workspace_service/agent_queue_workflow_tests.rs` | Queue workflow backend tests | A |
| 5354 | `apps/desktop/frontend/src/workbench/agents/adapters/queueAgentCapabilities.test.ts` | Queue agent capability tests | B |
| 3380 | `apps/desktop/frontend/src/workbench/workspaceAgentBrokerContinuation.test.ts` | Workspace Agent broker continuation tests | B |
| 3020 | `apps/desktop/frontend/src/workbench/agents/modules/queueWorkflowRunner.test.ts` | Queue workflow runner tests | A |
| 2910 | `apps/desktop/frontend/src/workbench/agents/modules/queueWorkflowRunnerRuntimeAdapter.test.ts` | Queue workflow runtime adapter tests | A |
| 2267 | `apps/desktop/frontend/src/workbench/queue/useAgentQueueController.executionState.test.tsx` | Queue controller tests | C |
| 1751 | `apps/desktop/frontend/src/workbench/InteractiveAgentPlaceholderWidget.action-request.test.tsx` | Workspace Agent action-request tests | C |
| 1687 | `apps/desktop/frontend/src/workbench/workspaceAgentBrokerActionRuntime.test.ts` | Workspace Agent broker action runtime tests | B |
| 1673 | `crates/hobit-app/src/workspace_service/agent_queue_execution_tests.rs` | Queue backend execution tests | A |
| 1435 | `crates/hobit-storage-sqlite/src/store/tests.rs` | SQLite storage tests | C |

### Oversized Styles And Docs

| Lines | Path | Category | Priority |
| ---: | --- | --- | --- |
| 3680 | `apps/desktop/frontend/src/styles/components.css` | styles | D |
| 2362 | `apps/desktop/frontend/src/styles/agent-queue.css` | styles | D |
| 1553 | `docs/JDBC_WIDGET_CONTRACT.md` | docs | D |
| 1518 | `apps/desktop/frontend/src/styles/widget-v2-knowledge.css` | styles | D |
| 1519 | `docs/SMART_QUEUE_IMPLEMENTATION_STATUS.md` | docs | D |
| 1302 | `apps/desktop/frontend/src/styles/widget-v2-queue.css` | styles | D |

## Ownership Risk Summary

The most serious risk is not raw line count. It is split ownership hidden inside
large files.

Priority A files mix Queue workflow state-machine behavior, worker-evidence
ownership, resume/report assembly, runtime-adapter persistence, and tests. This
is the highest-risk area because live Queue smoke already exposed ownership
bugs around workflow continuation and evidence handling. Refactors here must be
behavior-preserving and should split by durable ownership boundaries before
renaming or moving public APIs.

Priority B files mix Workspace Agent protocol handling with Queue capability
validation, action routing, and continuation mapping. These should be split
after the Queue workflow ownership boundary is clearer, otherwise the bridge
may preserve the same ambiguity in smaller files.

Priority C files are large UI/controller/type surfaces. They are important for
reviewability, but they should follow the Queue workflow and bridge splits
because they are mostly consumers of those boundaries.

Priority D is style/docs cleanup. These should remain visual/docs no-op blocks
and must not be used to change Queue UI or visual-shell behavior.

## Block 54 Update

The backend Queue workflow test file
`crates/hobit-app/src/workspace_service/agent_queue_workflow_tests.rs` was
split into the `agent_queue_workflow_tests/` module directory by workflow
transition/domain: persistence, report/action ledger, materialization, setup,
start/promote, resume, worker evidence, review, finalization, and immutable
planning checks.

The old 6417-line allowlist entry was removed. No new backend workflow test
module exceeds the 1200-line test threshold.

This was a tests-only refactor: no runtime behavior, Queue workflow behavior,
storage/schema, Tauri/API, frontend behavior, Queue UI, visual-shell behavior,
smoke execution, new runtime path, or natural-language/id inference changed.

Next Priority A refactor focus remains `queueWorkflowRunner.ts` or the backend
workflow source modules according to the active plan. The
`workspaceAgentQueueBridgeAdapter.ts` bridge remains the top Priority B bridge
target after workflow ownership is clearer.

## Block 55 Update

The Workspace Agent Queue bridge adapter
`apps/desktop/frontend/src/workbench/agents/adapters/workspaceAgentQueueBridgeAdapter.ts`
was split by capability group under
`apps/desktop/frontend/src/workbench/agents/adapters/queueBridge/`.

The original adapter file is now a thin compatibility entrypoint that re-exports
the stable `createWorkspaceAgentQueueBridgeAdapterApi` API. The old oversized
source allowlist entry was removed because the facade and all new queueBridge
source modules are below the 1000-line source threshold.

This was a frontend adapter refactor only: no runtime behavior, Queue workflow
behavior, Queue UI behavior, visual-shell behavior, backend/Tauri behavior,
storage/schema behavior, smoke execution, natural-language routing, or
prose/UI/path id inference changed.

Next refactor focus remains `queueWorkflowRunner.ts` or
`agent_queue_workflow_resume.rs`, depending on whether the next priority is the
frontend runner boundary or backend workflow resume ownership.

## Refactor Priority Plan

### Priority A: Queue Workflow Ownership

Target ownership boundaries:

- Backend Queue workflow state machine and worker-evidence ownership.
- Resume planning/action ledger/report assembly in
  `agent_queue_workflow_resume.rs`.
- Worker-evidence collection/materialization in
  `agent_queue_workflow_evidence.rs`.
- Setup/materialization/facade boundaries in `agent_queue_workflow_setup.rs`,
  `agent_queue_workflow_materialization.rs`, and `agent_queue_workflow.rs`.
- Frontend runner orchestration in `queueWorkflowRunner.ts`.
- Runtime persistence/API handoff in `queueWorkflowRunnerRuntimeAdapter.ts`.
- Test files split by workflow phase, evidence ownership, resume behavior, and
  runtime adapter boundary.

Sequence:

1. Write a no-behavior-change module map for backend Queue workflow ownership.
2. Split backend tests by workflow phase while preserving test names and
   assertions. Completed in Block 54.
3. Split backend resume/evidence/setup modules behind existing public exports.
4. Split frontend runtime adapter into API access, persistence/reporting, and
   runner handoff.
5. Split frontend runner into state-machine, dependency, evidence, and report
   modules.

### Priority B: Workspace Agent Queue Bridge

Target ownership boundaries:

- `workspaceAgentQueueBridgeAdapter.ts` becomes a thin adapter facade.
- `queueAgentCapabilities.ts`, `queueAgentCapabilityTypes.ts`, and
  `queueCapabilityContracts.ts` split by capability family and protocol
  response boundary.
- `workspaceAgentBrokerContinuation.ts` splits protocol recovery, action
  replay, resume mapping, and status projection.
- Tests split by contract family rather than by current giant implementation
  file.

Sequence:

1. Freeze current public imports and compatibility IDs.
2. Split type/contract-only modules first.
3. Split validation and action mapping next.
4. Split continuation tests and then implementation.

### Priority C: UI, Controllers, And Type Surfaces

Target ownership boundaries:

- `FinderWidget.tsx`: shell, column navigation, file preview/edit, Finder Git
  review.
- `InteractiveAgentPlaceholderWidget.tsx`: composer, transcript, visible
  context, action cards.
- `useWorkspaceQueueApi.ts`: task CRUD, workflow control, run history, context
  attach.
- `useWorkspaceAgentDirectWorkController.ts`: launch, stream event handling,
  activity publishing, view-state projection.
- Queue and Workspace API type files split by domain family.

These blocks should not redesign UI, change visual shell files, or alter Queue
behavior. They should preserve public props/imports until consumers are moved.

### Priority D: Styles And Docs

Style cleanup must be visual no-op and should avoid visual shell files unless a
future block explicitly scopes them. Queue CSS cleanup must not change Queue UI
behavior.

Docs cleanup should archive or split long historical status documents without
changing current contracts. `docs/ACTIVE_CONTRACT_INDEX.md` remains the
navigation source for contract authority.

## No Behavior-Change Rule

Every refactor block that consumes this audit should state:

- No runtime behavior change.
- No Queue workflow behavior change unless explicitly requested.
- No Queue UI behavior change unless explicitly requested.
- No visual-shell behavior change unless explicitly requested.
- No storage/schema change unless explicitly requested.
- No new runtime execution path.
- No natural-language routing or prose-derived ID inference.
- No broad formatter over unrelated files.
