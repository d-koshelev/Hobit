# Stable v0.1 File-Size Gate Audit

## Status

Audit block: `STABLE-FILESIZE-AUDIT-01`

Mode: docs-producing inspect-only audit.

No code, backend, frontend, test, validation script, schema, runtime, Git
mutation, or commit work was performed.

## Commands Run

- `python scripts/hobit/check-file-sizes.py`
  - Result: failed.
  - Scanned 756 source files.
  - Reported 31 unchanged/improved legacy oversized files, 6 ratchet
    violations, and 2 new oversized files.
- `python scripts/hobit/check-file-sizes.py --changed-only`
  - Result: passed.
  - Scanned 0 source files.
  - Reported no warnings or errors.

## Current File-Size Gate Verdict

The repo-wide Stable v0.1 file-size gate is not clean.

The current hard failure is caused by six ratchet violations. The two
Knowledge / Skills files are new oversized warning files under the current
default script behavior, but they did not cause the full command's failing
exit by themselves because they are warnings, not active errors.

## Hard Blockers

These findings currently block a clean Stable v0.1 file-size gate because they
are ratchet violations against the existing baseline:

| File | Current | Baseline | Threshold | Classification |
| --- | ---: | ---: | ---: | --- |
| `apps/desktop/frontend/src/workbench/TerminalPtySessionPanel.tsx` | 830 | 809 | 700 | hard blocker / ratchet |
| `apps/desktop/frontend/src/workbench/queue/useAgentQueueAutonomousRunner.ts` | 797 | 790 | 700 | hard blocker / ratchet |
| `apps/desktop/frontend/src/workbench/queue/useAgentQueueController.ts` | 1065 | 981 | 1000 | hard blocker / ratchet |
| `apps/desktop/frontend/src/workbench/workspaceAgentQueueCommandHandler.test.ts` | 1381 | 1216 | 1200 | hard blocker / ratchet |
| `apps/desktop/frontend/src/workspace/tauriAgentQueueApi.ts` | 704 | 703 | 700 | hard blocker / ratchet |
| `apps/desktop/src-tauri/src/agent_queue_runner_commands.rs` | 794 | 791 | 700 | hard blocker / ratchet |

## New Oversized Files

These are active oversized warnings not present in the baseline. They should
not be folded into the baseline during Stable v0.1 cleanup.

| File | Current | Threshold | Classification |
| --- | ---: | ---: | --- |
| `apps/desktop/frontend/src/workbench/SkillLibraryWidget.test.tsx` | 1314 | 1200 | new oversized warning |
| `apps/desktop/frontend/src/workbench/skillLibraryModel.ts` | 855 | 700 | new oversized warning |

Stable v0.1 decision: these are not the immediate failing exit condition for
the default full command, but they are release-quality cleanup for Knowledge /
Skills. Treat them as the next advisory cleanup after the six ratchets unless
the Stable v0.1 gate is tightened to require zero warnings.

## Unchanged Legacy Debt

The full check reports 31 unchanged or improved oversized files as legacy debt.
They do not fail the current gate because they are at or below their recorded
baseline.

Legacy debt should remain post-v0.1 cleanup unless a focused block touches one
of those files. If touched, the changed-only gate can make the oversized file a
local blocker.

## Advisory Warnings

Current advisory warnings are the two Knowledge / Skills new oversized files.
They are important because Knowledge / Skills just moved to Stable v0.1 ready
for MVP scope, but they are smaller and less urgent than the Queue and
Terminal ratchets that fail the gate today.

## Stable v0.1 Blocking Scope

Stable v0.1 blockers:

- The six ratchet violations listed under Hard Blockers.

Post-v0.1 cleanup unless touched or explicitly promoted:

- The 31 unchanged legacy-debt files.
- The two Knowledge / Skills advisory warnings, if Stable v0.1 acceptance keeps
  the current default script behavior and does not require zero warnings.

## Recommended Refactor Blocks

### Block 1: Terminal PTY Panel Split

- Target file: `apps/desktop/frontend/src/workbench/TerminalPtySessionPanel.tsx`
- Objective: bring the Terminal PTY panel back under the ratchet baseline and
  ideally under the 700-line source warning threshold.
- Expected extraction/split: move PTY settings form helpers, session-status
  rendering, and xterm lifecycle/polling helpers into focused sibling modules
  without adding Terminal behavior.
- Minimal validation: `python scripts/hobit/check-file-sizes.py --changed-only`
  plus the narrow frontend typecheck if implementation changes require it.
- Acceptance criteria: the file is below its 809-line baseline, no new
  oversized files are introduced, and Terminal behavior remains unchanged.

### Block 2: Queue Autorun Hook Split

- Target file:
  `apps/desktop/frontend/src/workbench/queue/useAgentQueueAutonomousRunner.ts`
- Objective: remove autorun ratchet growth while preserving the
  operator-armed, current-session-only Queue Autorun boundary.
- Expected extraction/split: extract eligibility selection, reconciliation
  state transitions, and run-result normalization into pure helper modules.
- Minimal validation: `python scripts/hobit/check-file-sizes.py --changed-only`
  and the narrow Queue autorun/controller tests if available.
- Acceptance criteria: the hook is below its 790-line baseline, no hidden
  scheduler or durable runner behavior is added, and changed-only file-size
  validation passes.

### Block 3: Queue Controller Split

- Target file:
  `apps/desktop/frontend/src/workbench/queue/useAgentQueueController.ts`
- Objective: reduce the central Queue controller below the 1000-line source
  error threshold and below its 981-line baseline.
- Expected extraction/split: separate task CRUD/selection, assignment/run
  actions, context attachment, and view-state derivation into controller
  sub-hooks or pure model helpers.
- Minimal validation: `python scripts/hobit/check-file-sizes.py --changed-only`
  and focused Queue controller tests.
- Acceptance criteria: the controller is below 981 lines, no Queue API or
  runtime behavior changes are introduced, and no replacement helper exceeds
  thresholds.

### Block 4: Queue API Bridge Split

- Target file: `apps/desktop/frontend/src/workspace/tauriAgentQueueApi.ts`
- Objective: remove the one-line API bridge ratchet and create room for future
  typed API maintenance.
- Expected extraction/split: move DTO normalization or command-specific
  wrappers into a small adjacent Queue API helper module.
- Minimal validation: `python scripts/hobit/check-file-sizes.py --changed-only`
  and focused API typecheck.
- Acceptance criteria: the bridge is below its 703-line baseline and no Tauri
  command names, DTO shapes, or persistence behavior changes.

### Block 5: Rust Queue Runner Commands Split

- Target file: `apps/desktop/src-tauri/src/agent_queue_runner_commands.rs`
- Objective: remove the backend Queue runner command ratchet while preserving
  the current explicit assigned-task/Autorun command boundary.
- Expected extraction/split: move request validation, command DTO conversion,
  or runner-state helpers into sibling Rust modules under the same Tauri
  command ownership.
- Minimal validation: `python scripts/hobit/check-file-sizes.py --changed-only`
  plus `cargo fmt --all` and focused Rust checks for the touched module.
- Acceptance criteria: the command file is below its 791-line baseline, public
  command surface stays unchanged, and no Queue scheduler/runtime capability is
  added.

### Block 6: Queue Command Handler Test Split

- Target file:
  `apps/desktop/frontend/src/workbench/workspaceAgentQueueCommandHandler.test.ts`
- Objective: remove test-file ratchet growth without weakening behavior
  coverage.
- Expected extraction/split: split tests by command class, such as create task,
  update task, attach/materialize context, and error handling; move shared
  setup into a small test fixture helper.
- Minimal validation: `python scripts/hobit/check-file-sizes.py --changed-only`
  and the split test files.
- Acceptance criteria: the original test file is below its 1216-line baseline,
  no split test exceeds the 1200-line warning threshold, and coverage intent is
  preserved.

### Block 7: Knowledge Advisory Cleanup

- Target files:
  - `apps/desktop/frontend/src/workbench/skillLibraryModel.ts`
  - `apps/desktop/frontend/src/workbench/SkillLibraryWidget.test.tsx`
- Objective: remove the new Knowledge / Skills oversized warnings after the
  current hard blockers are cleared.
- Expected extraction/split: extract Knowledge document helpers, draft-review
  helpers, queue-context/materialization helpers, and test fixtures into
  focused modules.
- Minimal validation: `python scripts/hobit/check-file-sizes.py --changed-only`
  and focused Knowledge / Skills tests.
- Acceptance criteria: both files are below their warning thresholds, no new
  oversized helper files are created, and the Knowledge / Skills Stable v0.1
  MVP scope remains behaviorally unchanged.

## Do Not Do In These Blocks

- Do not update `scripts/hobit/file-size-baseline.json` to absorb ratchets or
  new warnings.
- Do not introduce new dependencies.
- Do not add Queue scheduler, hidden execution, Terminal behavior, Knowledge
  hidden ingestion, or new widget behavior while splitting files.
- Do not rename compatibility widget ids or Tauri command names.

