# Stable v0.1 Queue UI Smoke Checklist

Status record date: 2026-06-05

## Purpose

Record the manual Queue UI smoke checklist and expected visual state after the
Queue polish pass.

This is a docs-only smoke checklist. It does not add frontend behavior,
backend APIs, storage, scheduling, execution, validation requirements, or Stable
v0.1 acceptance status. Current implemented behavior remains governed by
`docs/CURRENT_WIDGET_SURFACE.md` and Queue-specific contracts.

Manual desktop smoke was not run in this block.

## Source Inputs

- `docs/CURRENT_WIDGET_SURFACE.md`
- `docs/AGENT_QUEUE_PRODUCT_MODEL_CONTRACT.md`
- `docs/PRODUCT_UI_DESIGN_CONTRACT.md`
- `apps/desktop/frontend/src/workbench/AgentQueuePlaceholderWidget.tsx`
- `apps/desktop/frontend/src/workbench/AgentQueueV2Board.tsx`
- `apps/desktop/frontend/src/workbench/AgentQueueTagColorControl.tsx`
- `apps/desktop/frontend/src/workbench/AgentQueueTaskRunPanel.tsx`
- `apps/desktop/frontend/src/workbench/widgetV2/queueV2/QueueV2TaskDetailsPopup.tsx`
- `apps/desktop/frontend/src/workbench/queue/details/AgentQueueTaskContextSection.tsx`
- Focused Queue tests for the QueueV2 board path, selected-task details,
  run panel evidence, and Knowledge context.

## Expected Visual State

### Queue Layout

- Agent Queue opens in the QueueV2 board surface through the existing saved
  Agent Queue widget identity.
- The old Board v2 / Flow Map toggle, Flow Map canvas, dense task list, and
  permanent sidebar/right-rail shell are absent from the normal render path.
- The board lanes remain usable without opening the details popup.
- The selected-task popup remains the place for task detail and next action,
  not a raw Executor console.

### Board And Summary

Expected board structure:

- Top Queue Board summary with Queue state, Ready now, Running, Review, and
  Capacity facts.
- Lane columns for Intake / Draft, Ready, Running, Review, Blocked, and Closed.
- Compact cards showing title, next action, relevant blocker/worker/context
  summary, and a separate Details control.
- Collapsed activity/raw execution drawer.

Board controls and card clicks must not imply or trigger hidden execution.

### Details Popup

Expected selected-task details structure:

- Overview.
- Next action.
- Context.
- Result / Evidence.
- Activity.
- Developer details collapsed by default.

The rail should make the selected task, current status, assignment state, and
next explicit operator action obvious. Raw ids, raw logs, prompt payloads, and
backend command names stay out of primary UI.

For a completed task with no loaded evidence, the expected state is "Execution
complete" with "Result not loaded" / "Review is not ready" copy. It should not
show contradictory "Evidence missing" or "Awaiting coordinator review" primary
labels when the result evidence is unavailable.

For a task with Knowledge context, the Context section should show that the
attached Knowledge or Skill refs are current-session only, not saved as durable
Queue task context, and should show a visible bounded prompt context preview.

### QueueV2 Board

Expected QueueV2 board behavior:

- The QueueV2 board is the default and only normal user-facing Queue mode.
- Work appears in the lane model once: Intake / Draft, Ready, Running, Review,
  Blocked, or Closed.
- QueueV2 task cards are selection controls only. Clicking a task card updates
  selection and selected styling without starting executor or scheduler work.
- Repeatedly clicking a QueueV2 card must not reorder cards.
- Execution-complete unfinalized results should use review/evidence language
  such as "Execution complete" and "Awaiting review", not final acceptance
  language such as "Done".

### Tag Colors

Expected tag color behavior:

- Tag colors are editable from Manage tags through the Color select.
- Color changes are current-session only because Queue tag color is not
  persisted in the current model.
- Tag color tokens should remain available to current Queue detail/card surfaces
  that use queue tags.
- Tag colors remain separate from execution status and validation status.
  Status badges and text labels must still communicate state.
- The available color choices are Blue, Cyan, Green, Amber, Red, and Gray.

### Copy And Color Restraints

No duplicate text expectations:

- The same Queue task should not appear more than once across QueueV2 lanes.
- QueueV2 selection should not duplicate, move, or reorder cards.
- The details popup should not repeat full prompt/report text in multiple
  primary locations. Full prompt and developer detail stay collapsed where
  available.
- Completed-without-evidence and report-ready states should avoid conflicting
  status copy.

No excessive color expectations:

- Tag colors should be accents on swatches or cards, not a full-surface color
  wash.
- Semantic status color should stay limited to badges, borders, or compact
  state markers.
- The Queue surface should continue to use shared theme tokens and avoid
  raw-color or gradient drift.
- Color must not be the only signal; status and review state remain readable as
  text.

## Manual Smoke Steps

Run these against a desktop candidate with Agent Queue visible.

1. Select a task with no evidence.
   - Confirm the details popup/tab order is Overview, Prompt, Result,
     Agent Log, Context, Files / Validation, and Developer.
   - Confirm Result / Evidence shows an honest no-evidence or result-not-loaded
     state.
   - Confirm Developer details are collapsed by default.

2. Select a completed task with evidence.
   - Confirm the task appears in the Review lane until explicitly closed.
   - Confirm the details popup shows report/result evidence and review state
     without automatically finalizing or accepting the task.
   - Confirm run history/detail links remain product summaries, not raw logs.

3. Select a task with Knowledge context.
   - Confirm Context shows current-session-only Knowledge or Skill context.
   - Confirm the visible bounded prompt context preview is present.
   - Confirm the UI does not claim durable Queue-owned context storage.

4. Click a QueueV2 task repeatedly and verify no reorder.
   - Record the visible card order before clicking.
   - Click the same task card several times.
   - Confirm the same card remains selected and the card order is unchanged.
   - Confirm no executor, scheduler, or Autorun action starts from selection.

5. Change tag color and verify display.
   - Open Manage tags.
   - Change a tag color.
   - Confirm the sidebar swatch updates.
   - Confirm any visible tag swatches or card accents for that tag update.
   - Confirm status/validation labels remain readable and separate from color.

6. Verify run controls still present.
   - Select a runnable task.
   - Confirm Next action and Queue task execution still expose explicit run
     controls such as Run task / Run selected task when prerequisites are met.
   - Confirm missing prerequisites show setup blockers instead of hiding the run
     area.
   - Confirm creating, selecting, tagging, pausing, or opening details does not
     start a run.

## Intentionally Not Covered

- No code changes.
- No backend, Tauri, storage, schema, or runtime execution changes.
- No automated smoke result is recorded here.
- No Stable v0.1 acceptance result change.
