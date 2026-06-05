# Stable v0.1 Queue Polish Status

Status record date: 2026-06-05

## Purpose

Record the Queue-focused polish work and the remaining manual smoke items after
the Stable v0.1 Queue UI pass.

This is a docs-only status record. It does not add frontend behavior, backend
APIs, storage, schema, scheduling, execution, validation requirements, or
Stable v0.1 acceptance status. Current implemented behavior remains governed by
`docs/CURRENT_WIDGET_SURFACE.md` and Queue-specific contracts.

Manual desktop smoke was not run in this docs-only block.

## Source Inputs

- `docs/CURRENT_WIDGET_SURFACE.md`
- `docs/AGENT_QUEUE_PRODUCT_MODEL_CONTRACT.md`
- `docs/PRODUCT_UI_DESIGN_CONTRACT.md`
- `docs/PRODUCT_UI_VISUAL_CONTRACT.md`
- `docs/STABLE_V0_1_QUEUE_UI_SMOKE_CHECKLIST.md`
- Recent focused Queue polish commits:
  - `6bb892c frontend: calm Agent Queue visual language`
  - `0f977de frontend: simplify queue task detail rail`
  - `c5d3c1c frontend: compact Agent Queue sidebar`
  - `04acca5 frontend: fix queue flow map tag colors`
  - `3e009ad docs: add Queue UI smoke checklist`

## Recorded Queue Polish

### Color And Copy Reduction

- Queue visual language was calmed so status, review state, and tag color are
  accents rather than full-surface color treatments.
- Queue copy was reduced toward product-state language and away from raw debug
  wording in the normal Flow Map and selected-task rail.
- Completed-without-loaded-evidence states now use honest result/review copy,
  such as execution complete and result not loaded, instead of implying final
  acceptance or contradictory missing-evidence states.
- Raw ids, raw logs, backend command names, and long prompt/result payloads
  remain out of primary UI and behind collapsed detail where present.

### Right Rail Structure

The selected-task right rail is recorded as the task detail and decision
surface, not a debug inspector or hidden Executor console.

Expected order:

1. Overview.
2. Next action.
3. Context.
4. Result / Evidence.
5. Activity.
6. Developer details collapsed by default.

The rail should keep the selected task, status, assignment state, and next
explicit operator action visible without implying hidden execution, acceptance,
Terminal launch, Git mutation, or Workspace Agent tool use.

### Left Sidebar Structure

The left Queue rail is recorded as the compact Queue and worker controls
surface.

Expected structure:

1. Queue control with Enable, Disable, and Stop + kill running controls.
2. Scheduler summary with dry-run status and compact counts.
3. Autonomous Queue section with explicit operator action.
4. Capacity section with max executors and compact capacity facts.
5. Tags section with tag status, pause/resume, validation counts, and collapsed
   management controls.
6. Workers section with worker status, scope, dry-run next item, and collapsed
   management controls.

The sidebar remains management-oriented. Tag, worker, capacity, dry-run,
resize, and selection interactions must not start hidden execution.

### Flow Map Card And Order Fix

- Flow Map is the normal Queue surface.
- Queue cards are selection controls only. Selecting a card must not start
  executor work, scheduler work, Autorun, Terminal, Git, or Workspace Agent
  behavior.
- Repeatedly clicking a Flow Map card must preserve card order.
- Sample topology remains a visual QA aid only and must not duplicate sample
  nodes across primary Flow Map zones.
- Execution-complete unfinalized results use review/evidence language such as
  execution complete and awaiting review, not final acceptance language such as
  done.

### Tag Colors

- Tag colors are editable from Manage tags through the color select.
- Available color choices are Blue, Cyan, Green, Amber, Red, and Gray.
- Tag color changes are current-session only because Queue tag color is not
  persisted in the current model.
- Sidebar swatches, Flow Map groups, and Flow Map blocks reflect selected tag
  color tokens.
- Tag color remains separate from execution status and validation status; text
  labels and status badges still carry the state.

## Adjacent Follow-Up Runs Touched

Recent branch history also shows these adjacent Stable v0.1 polish follow-ups:

- Terminal follow-up: `063450f frontend: improve terminal pane responsiveness`.
- Finder follow-up: `2e77876 frontend: improve Finder path and Git UX`.
- Knowledge / Skills follow-up:
  `1e92802 frontend: refine Knowledge catalog import IA`.
- Workspace Agent follow-up:
  `7accfed frontend: add workspace agent activity side pane`.

These are recorded as adjacent follow-up work touched after the Queue polish
sequence. They are not revalidated by this docs-only status block.

## Remaining Manual Smoke Steps

Run these against a desktop candidate with Agent Queue visible:

1. Select a task with no evidence and confirm the right rail order is Overview,
   Next action, Context, Result / Evidence, Activity, and Developer details;
   confirm the evidence state is honest and Developer details are collapsed.
2. Select a completed task with evidence and confirm it appears in Results /
   Reports / Completed work; confirm review state does not automatically
   finalize or accept the task.
3. Select a task with Knowledge context and confirm the Context section says the
   attached Knowledge or Skill refs are current-session only and shows a bounded
   visible prompt context preview.
4. Click the same Flow Map task card several times and confirm selection changes
   do not reorder cards or start executor, scheduler, or Autorun work.
5. Change a tag color from Manage tags and confirm sidebar swatches plus Flow
   Map groups/blocks update while status and validation labels remain readable.
6. Select a runnable task and confirm explicit run controls remain visible when
   prerequisites are met, while missing prerequisites show setup blockers
   instead of hiding the run area.
7. Confirm creating, selecting, tagging, pausing, resizing rails, opening
   details, and reviewing evidence do not start hidden execution.

## Status

- Queue polish status is recorded.
- Manual desktop smoke remains pending.
- Automated validation was intentionally limited to the requested docs-only
  commands for this block.

## Intentionally Not Implemented

- No code changes.
- No backend, Tauri, storage, schema, or runtime execution changes.
- No new Queue behavior.
- No new widget insertion behavior.
- No manual smoke result or Stable v0.1 acceptance result change.
