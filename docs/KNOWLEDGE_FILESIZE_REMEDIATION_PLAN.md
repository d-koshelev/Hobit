# Knowledge / Queue / Finder File-Size Remediation Plan

Date: 2026-06-04

## Audit Basis

- Required validation command: `python scripts/hobit/check-file-sizes.py --changed-only`
- Result before this docs-only change: scanned 0 changed source files; no warnings or errors.
- Inventory source: `check-file-sizes.py --json` filtered to Knowledge / Skills, Agent Queue, and Finder widget source paths.
- Scope: audit only. No source code or tests were refactored.

## Current Changed-Only Blockers

None for this docs-only block. The changed-only checker scans source files only, and this task changes only this Markdown file.

## Current Hard Blockers In Knowledge / Queue / Finder

These are current ratchet/error findings in the filtered inventory and should be treated as the first remediation blockers before broad feature work touches them.

| Surface | File | Current lines | Threshold | Baseline | Status |
| --- | --- | ---: | ---: | ---: | --- |
| Finder | `apps/desktop/frontend/src/workbench/FinderWidget.tsx` | 2947 | 1000 | 2711 | Ratchet error |
| Queue | `apps/desktop/frontend/src/workbench/queue/useAgentQueueController.ts` | 1065 | 1000 | 981 | Ratchet error |

Legacy hard debt that is not a current changed-only blocker unless touched:

| Surface | File | Current lines | Threshold | Baseline | Status |
| --- | --- | ---: | ---: | ---: | --- |
| Queue | `apps/desktop/frontend/src/workbench/queue/useAgentQueueController.executionState.test.tsx` | 1810 | 1800 | 1810 | Legacy debt error |

## Ratchet Violations

| Surface | File | Current lines | Threshold | Baseline | Status |
| --- | --- | ---: | ---: | ---: | --- |
| Finder | `apps/desktop/frontend/src/workbench/FinderWidget.tsx` | 2947 | 1000 | 2711 | Ratchet error |
| Queue | `apps/desktop/frontend/src/workbench/workspaceAgentQueueCommandHandler.test.ts` | 1381 | 1200 | 1216 | Ratchet warning |
| Queue | `apps/desktop/frontend/src/workbench/queue/useAgentQueueController.ts` | 1065 | 1000 | 981 | Ratchet error |
| Queue | `apps/desktop/frontend/src/workbench/queue/useAgentQueueAutonomousRunner.ts` | 797 | 700 | 790 | Ratchet warning |
| Queue | `apps/desktop/src-tauri/src/agent_queue_runner_commands.rs` | 794 | 700 | 791 | Ratchet warning |
| Queue | `apps/desktop/frontend/src/workspace/tauriAgentQueueApi.ts` | 704 | 700 | 703 | Ratchet warning |

## Advisory Oversized Files

Knowledge / Skills has no hard oversized blockers. The remaining Knowledge findings are active warnings, so they should be split before or during the next edit that touches them.

| Surface | File | Current lines | Threshold | Status |
| --- | --- | ---: | ---: | --- |
| Knowledge / Skills | `apps/desktop/frontend/src/workbench/SkillLibraryWidget.test.tsx` | 1314 | 1200 | Active warning |
| Knowledge / Skills | `apps/desktop/frontend/src/workbench/skillLibraryModel.ts` | 855 | 700 | Active warning |

Queue legacy advisory debt remains concentrated in older UI/controller/test files:

| File | Current lines | Threshold | Status |
| --- | ---: | ---: | --- |
| `apps/desktop/src-tauri/src/agent_queue_runner_commands/tests.rs` | 1406 | 1200 | Legacy debt warning |
| `apps/desktop/frontend/src/workbench/InteractiveAgentQueueActions.test.tsx` | 1355 | 1200 | Legacy debt warning |
| `apps/desktop/frontend/src/workbench/queue/useAgentQueueTaskActions.ts` | 981 | 700 | Legacy debt warning |
| `apps/desktop/frontend/src/workbench/AgentQueueTaskRunPanel.tsx` | 816 | 700 | Legacy debt warning |
| `apps/desktop/frontend/src/workbench/queue/agentQueueFlowMapModel.ts` | 811 | 700 | Legacy debt warning |
| `apps/desktop/frontend/src/workbench/AgentQueueFlowMap.tsx` | 801 | 700 | Legacy debt warning |
| `apps/desktop/frontend/src/workbench/AgentQueueSidebar.tsx` | 793 | 700 | Legacy debt warning |
| `crates/hobit-app/src/workspace_service/agent_queue_tasks_tests.rs` | 788 | 700 | Legacy debt warning |
| `apps/desktop/frontend/src/smoke/queueExecutorMockSmokeApp.tsx` | 761 | 700 | Legacy debt warning |
| `apps/desktop/frontend/src/workbench/queue/agentQueueWidgetSnapshotModel.ts` | 702 | 700 | Legacy debt warning |

Finder currently has one oversized file, and it is already listed as the top hard ratchet blocker.

## Next 3 Refactor Targets

1. `apps/desktop/frontend/src/workbench/FinderWidget.tsx`
   - Goal: split Finder preview/edit state, column navigation helpers, and Finder Git plugin UI/model into focused files.
   - First acceptance: reduce below the 2711-line baseline to clear the ratchet; follow-up target below the 1000-line source error threshold.

2. `apps/desktop/frontend/src/workbench/queue/useAgentQueueController.ts`
   - Goal: move remaining orchestration clusters into existing `queue/` helper hooks/models, especially load/selection/run-status coordination.
   - First acceptance: reduce below the 981-line baseline to clear the ratchet; follow-up target below the 700-line warning threshold.

3. `apps/desktop/frontend/src/workbench/workspaceAgentQueueCommandHandler.test.ts`
   - Goal: split command-handler coverage by command family into smaller focused test files.
   - First acceptance: reduce below the 1216-line baseline to clear the ratchet; follow-up target below the 1200-line test warning threshold.

## Blocker Classification

- Changed-current blockers for this task: none.
- Current ratchet blockers for future source validation: `FinderWidget.tsx`, `useAgentQueueController.ts`, `workspaceAgentQueueCommandHandler.test.ts`, `useAgentQueueAutonomousRunner.ts`, `agent_queue_runner_commands.rs`, and `tauriAgentQueueApi.ts`.
- Legacy debt: oversized Queue files already at or below their recorded baseline.
- Knowledge / Skills: no hard blocker after the DocumentsPanel split; two active warning files should be handled before further Knowledge changes touch them.
