# Stable v0.1 File-Size Gate Audit

Date: 2026-06-04

Block: STABLE-FILESIZE-AUDIT-01

Mode: docs-producing inspect-only audit

## Status

The current whole-repository file-size gate is failing after the Stable /
Knowledge implementation pass.

The changed-only gate is clean for this audit block because no changed source
files were present when the check ran.

No frontend, backend, test, validation-script, or contract-index changes were
made.

## Commands Run

```text
python scripts/hobit/check-file-sizes.py
```

Result: failed.

- Scanned: 756 source files.
- Legacy file-size debt: 31 unchanged/improved oversized files.
- File-size ratchet violations: 6 worsened baseline files.
- New oversized files: 2 files.

```text
python scripts/hobit/check-file-sizes.py --changed-only
```

Result: passed.

- Scanned: 0 source files.
- No file-size warnings or errors.

## Current File-Size Gate Verdict

Stable v0.1 is blocked by the full file-size gate until the 6 ratchet
violations are brought back to baseline or below.

The 2 new Knowledge / Skills oversized warning files should also be remediated
before Stable v0.1 acceptance so the release does not introduce new file-size
debt, even though the current full-check script treats warning-level active
files as advisory unless `--fail-on-warning` or `--changed-only` applies.

## Finding Classification

### Hard Blockers

The hard gate failure is the 6 ratchet violations. These are non-legacy files
whose current line counts worsened against the stored baseline.

### Ratchet Violations

| File | Current | Baseline | Threshold | Kind |
| --- | ---: | ---: | ---: | --- |
| `apps/desktop/frontend/src/workbench/TerminalPtySessionPanel.tsx` | 830 | 809 | 700 | source file |
| `apps/desktop/frontend/src/workbench/queue/useAgentQueueAutonomousRunner.ts` | 797 | 790 | 700 | source file |
| `apps/desktop/frontend/src/workbench/queue/useAgentQueueController.ts` | 1065 | 981 | 1000 | source file |
| `apps/desktop/frontend/src/workbench/workspaceAgentQueueCommandHandler.test.ts` | 1381 | 1216 | 1200 | test file |
| `apps/desktop/frontend/src/workspace/tauriAgentQueueApi.ts` | 704 | 703 | 700 | source file |
| `apps/desktop/src-tauri/src/agent_queue_runner_commands.rs` | 794 | 791 | 700 | source file |

### New Oversized Files

| File | Current | Threshold | Kind | Stable disposition |
| --- | ---: | ---: | --- | --- |
| `apps/desktop/frontend/src/workbench/SkillLibraryWidget.test.tsx` | 1314 | 1200 | test file | Remediate before Stable v0.1 acceptance. |
| `apps/desktop/frontend/src/workbench/skillLibraryModel.ts` | 855 | 700 | source file | Remediate before Stable v0.1 acceptance. |

### Unchanged Legacy Debt

These files are oversized but unchanged or improved against baseline. They do
not block this Stable v0.1 gate unless touched by a future block.

- `apps/desktop/frontend/src/smoke/queueExecutorMockSmokeApp.tsx`
- `apps/desktop/frontend/src/workbench/AgentQueueFlowMap.tsx`
- `apps/desktop/frontend/src/workbench/AgentQueueSidebar.tsx`
- `apps/desktop/frontend/src/workbench/AgentQueueTaskRunPanel.tsx`
- `apps/desktop/frontend/src/workbench/FinderWidget.tsx`
- `apps/desktop/frontend/src/workbench/InteractiveAgentPlaceholderWidget.tsx`
- `apps/desktop/frontend/src/workbench/InteractiveAgentQueueActions.test.tsx`
- `apps/desktop/frontend/src/workbench/JdbcConnectorWidget.test.tsx`
- `apps/desktop/frontend/src/workbench/JdbcReadOnlyQueryPanel.tsx`
- `apps/desktop/frontend/src/workbench/coordinatorLocalProposalGeneration.ts`
- `apps/desktop/frontend/src/workbench/jdbcConnectorWidgetModel.ts`
- `apps/desktop/frontend/src/workbench/queue/agentQueueFlowMapModel.ts`
- `apps/desktop/frontend/src/workbench/queue/agentQueueWidgetSnapshotModel.ts`
- `apps/desktop/frontend/src/workbench/queue/useAgentQueueController.executionState.test.tsx`
- `apps/desktop/frontend/src/workbench/queue/useAgentQueueTaskActions.ts`
- `apps/desktop/frontend/src/workspace/memoryWorkspaceApi.ts`
- `apps/desktop/src-tauri/src/agent_queue_runner_commands/tests.rs`
- `apps/desktop/src-tauri/src/terminal_pty.rs`
- `apps/desktop/src-tauri/src/workspace_commands.rs`
- `apps/desktop/src-tauri/src/workspace_dto.rs`
- `crates/hobit-app/src/capabilities/mod.rs`
- `crates/hobit-app/src/context_packs/mod.rs`
- `crates/hobit-app/src/workspace_service/agent_executor_history_tests.rs`
- `crates/hobit-app/src/workspace_service/agent_queue_tasks_tests.rs`
- `crates/hobit-app/src/workspace_service/direct_work_stream_tests.rs`
- `crates/hobit-app/src/workspace_service/direct_work_tests.rs`
- `crates/hobit-app/src/workspace_service/jdbc_sidecar_protocol.rs`
- `crates/hobit-app/src/workspace_service/types.rs`
- `crates/hobit-storage-sqlite/src/store.rs`
- `crates/hobit-storage-sqlite/src/store/tests.rs`
- `crates/hobit-tools/src/git_diff.rs`

### Advisory Warnings

The advisory warnings are the 2 new Knowledge / Skills oversized files listed
above. They are warning-level, not error-level, but they are new debt and
should be treated as Stable v0.1 cleanup before acceptance.

## Stable v0.1 Blockers

Must fix before Stable v0.1 file-size acceptance:

1. Reduce all 6 ratchet files to no more than their baselines.
2. Prefer reducing those files under their warning thresholds where feasible,
   especially files that are only slightly above 700 lines.
3. Split the 2 new Knowledge / Skills oversized warning files so Stable v0.1
   does not ship with new file-size debt.

Post-v0.1 cleanup:

- The 31 unchanged/improved legacy debt files can remain as tracked debt for
  Stable v0.1 if they are not touched by the acceptance block.
- Large legacy surfaces such as Finder, JDBC, Terminal, Queue panels, and Rust
  workspace-service tests should be split in later focused cleanup blocks.

## Recommended Next Refactor Blocks

### STABLE-FILESIZE-QUEUE-CONTROLLER-01

- Target files: `apps/desktop/frontend/src/workbench/queue/useAgentQueueController.ts`
- Objective: remove the controller ratchet and bring the hook below its stored
  baseline, preferably below 700 lines.
- Expected split/extraction: move command-handler wiring, runner state
  derivation, worker/task action composition, or selection/update helper groups
  into narrowly named queue controller helper modules while keeping the public
  `useAgentQueueController` API stable.
- Minimal validation: `python scripts/hobit/check-file-sizes.py --changed-only`
  plus the smallest targeted Queue controller tests available.
- Acceptance criteria: file is at or below 981 lines, no new oversized helper
  files are created, and Queue controller behavior is unchanged.

### STABLE-FILESIZE-QUEUE-AUTORUN-01

- Target files:
  `apps/desktop/frontend/src/workbench/queue/useAgentQueueAutonomousRunner.ts`,
  `apps/desktop/src-tauri/src/agent_queue_runner_commands.rs`
- Objective: remove frontend and desktop Queue Autorun ratchets without
  changing current-session-only, operator-armed Autorun behavior.
- Expected split/extraction: extract pure readiness/signature helpers from the
  frontend hook; extract Rust request/runtime-config conversion, continuation
  selection, and tick/reconcile helpers into sibling modules where appropriate.
- Minimal validation: `python scripts/hobit/check-file-sizes.py --changed-only`
  plus targeted Queue Autorun frontend/Rust tests.
- Acceptance criteria: frontend file is at or below 790 lines, Rust command
  file is at or below 791 lines, no backend scheduler or durable runner
  behavior is added.

### STABLE-FILESIZE-QUEUE-BRIDGE-01

- Target files: `apps/desktop/frontend/src/workspace/tauriAgentQueueApi.ts`
- Objective: remove the 1-line ratchet and prevent the Tauri Queue bridge from
  becoming a mixed command/type/normalizer file.
- Expected split/extraction: move Tauri DTO types and normalization helpers to
  separate `tauriAgentQueueApiTypes` / `tauriAgentQueueApiNormalizers` style
  modules, leaving command functions as the bridge facade.
- Minimal validation: `python scripts/hobit/check-file-sizes.py --changed-only`
  plus targeted Queue API frontend tests/typecheck for touched files.
- Acceptance criteria: bridge file is at or below 703 lines, exported API
  behavior stays compatible, no new runtime bridge capability is added.

### STABLE-FILESIZE-QUEUE-COMMAND-TESTS-01

- Target files:
  `apps/desktop/frontend/src/workbench/workspaceAgentQueueCommandHandler.test.ts`
- Objective: remove the test ratchet while preserving command-handler coverage.
- Expected split/extraction: split fixture builders/shared helpers into a test
  helper module and separate Queue-only, multi-task, snapshot, and autonomous
  runner scenarios into focused test files.
- Minimal validation: `python scripts/hobit/check-file-sizes.py --changed-only`
  plus the split command-handler test files.
- Acceptance criteria: original test file is at or below 1216 lines, each new
  test/helper file stays under the applicable threshold, and coverage is not
  weakened.

### STABLE-FILESIZE-TERMINAL-PTY-PANEL-01

- Target files: `apps/desktop/frontend/src/workbench/TerminalPtySessionPanel.tsx`
- Objective: remove the Terminal PTY panel ratchet and reduce UI/lifecycle
  concentration in the panel.
- Expected split/extraction: extract lifecycle note rendering and stable
  settings/input sections into small presentational modules or a PTY panel
  model/helper module while preserving the current PTY-first UI and collapsed
  legacy fallback boundary.
- Minimal validation: `python scripts/hobit/check-file-sizes.py --changed-only`
  plus targeted Terminal PTY frontend tests if present.
- Acceptance criteria: file is at or below 809 lines, preferably below 700, and
  no new Terminal runtime behavior is added.

### STABLE-FILESIZE-KNOWLEDGE-MODEL-01

- Target files: `apps/desktop/frontend/src/workbench/skillLibraryModel.ts`
- Objective: eliminate new Knowledge / Skills source-file debt from the Stable
  pass.
- Expected split/extraction: move catalog relation derivation
  (`knowledgeDocumentRelations`, `skillRelations`, relation reason helpers) and
  static option/label helpers into focused model modules, keeping existing
  imports stable through a facade only if needed.
- Minimal validation: `python scripts/hobit/check-file-sizes.py --changed-only`
  plus targeted Knowledge / Skills model tests if present.
- Acceptance criteria: file is below 700 lines and no new helper file exceeds
  its threshold.

### STABLE-FILESIZE-KNOWLEDGE-WIDGET-TESTS-01

- Target files: `apps/desktop/frontend/src/workbench/SkillLibraryWidget.test.tsx`
- Objective: eliminate new Knowledge / Skills test-file debt without reducing
  Stable v0.1 behavior coverage.
- Expected split/extraction: move shared render/fixture helpers into a small
  test helper and split tests by Skill CRUD/attach, Knowledge Document CRUD,
  import/search/catalog metadata, and Queue/Finder/Workspace Agent interaction
  scenarios.
- Minimal validation: `python scripts/hobit/check-file-sizes.py --changed-only`
  plus the split Knowledge / Skills widget tests.
- Acceptance criteria: original file is below 1200 lines, new test/helper files
  stay under thresholds, and existing assertions remain covered.

## Post-v0.1 Cleanup Blocks

### POST-V0_1-FILESIZE-FINDER-01

- Target files: `apps/desktop/frontend/src/workbench/FinderWidget.tsx`
- Objective: split the large Finder widget into column navigation, file
  preview/edit, and Finder Git plugin modules.
- Minimal validation: changed-only file-size check plus Finder-focused tests.
- Acceptance criteria: Finder behavior remains within the current Stable v0.1
  explicit-root, bounded-preview, explicit-save, and manual Git boundaries.

### POST-V0_1-FILESIZE-LEGACY-WIDGETS-01

- Target files: unchanged legacy oversized Queue, JDBC, Terminal, Git, and
  workspace-service test files listed in this audit.
- Objective: retire legacy file-size debt opportunistically when those surfaces
  are next touched.
- Minimal validation: changed-only file-size check plus targeted tests for each
  touched surface.
- Acceptance criteria: no touched file remains above its baseline, no unrelated
  behavior changes are introduced, and no new oversized files are created.

## Active Index

No update to `docs/ACTIVE_CONTRACT_INDEX.md` is needed. This audit is a status
document, not a new active product or implementation contract.

