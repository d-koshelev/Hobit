# Diff Review Workflow Audit

## Status

Status: docs-only functional audit.

This audit inspects how Hobit can create an independent Diff Review Queue item
after an implementation task has produced report/evidence. It does not add
frontend behavior, backend commands, Tauri commands, storage/schema changes,
Queue runtime behavior, scheduler behavior, Autorun behavior, validation
execution, Git mutation, Terminal execution, provider tools, automatic
finalization, automatic commit, automatic push, or rollback behavior.

Current implemented widget behavior remains governed by
`docs/CURRENT_WIDGET_SURFACE.md`.

## Scope Inspected

- Queue task model and action paths for source/parent links, follow-up
  creation, prompt-pack metadata, validation evidence, result/report text,
  lifecycle, review, and finalization state.
- Workspace Chat Queue control cards/actions and QueueV2 task details/actions.
- Git/diff data sources from Workspace Git, retained Git compatibility,
  Agent Executor diff summary, Direct Work run detail, and validation evidence.
- Existing Diff Review frontend model and creation hooks.

## Integration Points Found

### Queue Task Model

Current frontend Queue task types already include a Diff Review vocabulary:

- `AgentQueueTaskItemType` includes `diff_review`.
- `AgentQueueDiffReviewMetadata` includes `sourceItemId`,
  `sourceReportId`, `sourceCommitHash`, `reviewMode`, and
  `reviewTargetSummary`.
- `AgentQueueTask.diffReview` can hold the metadata in frontend state.
- `AgentQueueWorkerExecutionReport` can carry report summary, changed files,
  commands run, suggested validation, validation result, commit hash, final Git
  status, warnings, errors, follow-up recommendation, rollback recommendation,
  and raw report preview.
- `AgentQueueReportActionType` includes `create_diff_review`,
  `open_linked_diff_review`, `review_changes`, `create_follow_up`,
  coordinator decision actions, and finalization markers.

Important limitation: the desktop/Tauri Queue task DTO and app input/output
shape persist only the core task fields: title, description, prompt, status,
priority, execution policy/workspace, Codex executable, sandbox, approval
policy, context JSON, assignment, and timestamps. First-class frontend fields
such as `itemType`, `diffReview`, `validationStatus`,
`workerExecutionReports`, `coordinatorStatus`, and `closureState` are not
durably represented in the current Tauri Queue task DTO.

### Existing Diff Review Model

`apps/desktop/frontend/src/workbench/queue/agentQueueDiffReviewModel.ts`
already provides the main model helpers:

- `canCreateDiffReviewItem(task)` permits creation only for non-Diff Review
  tasks with a latest worker report, `awaiting_coordinator_review`, or
  `review_needed`.
- `latestWorkerExecutionReport(task)` selects the newest report.
- `buildDiffReviewMetadata(...)` creates source item/report/commit metadata.
- `buildDiffReviewPrompt(...)` builds a bounded review prompt that instructs
  the reviewer to inspect actual Git diff, compare it to report and declared
  scope, verify contracts/tests/validation, and recommend coordinator action.
- `linkedDiffReviewTasks(...)` can find frontend-linked review tasks by
  `diffReview.sourceItemId`.

This model is useful, but its metadata is currently durable only when copied
into task title/description/prompt. The typed `diffReview` object itself is
not persisted through the current desktop Queue DTO.

### QueueV2 Task Action Path

`useAgentQueueTaskActions.createDiffReviewTask()` already creates an explicit
independent Queue task from the selected source task:

- Uses the existing `onCreateAgentQueueTask` bridge.
- Copies source task run settings such as execution workspace, Codex
  executable, sandbox, approval policy, priority, and queue tag.
- Creates a new item with `itemType: "diff_review"`, `status: "queued"`,
  `executionPolicy: "manual"`, and `validationStatus: "not_started"`.
- Builds a Diff Review prompt from the source task and latest report.
- Stores `diffReview` metadata in local frontend task foundation state.
- Reports that no Executor, Codex, validation, or source finalization started.

This is the closest existing implementation path. The main gap is persistence:
the source link and review metadata must be preserved in durable prompt and
description text unless a later minimal typed bridge/storage field is approved.

### Workspace Chat Queue Report Card Path

`WorkspaceAgentQueueReportActionCard` can already render a Queue report action
card and perform report-level actions:

- `review_changes` reads Workspace Git status plus diff summary through
  read-only Workspace Git APIs using the source task execution workspace.
- `create_diff_review` creates a separate Queue task through the existing
  `onCreateQueueTask` callback and records `linkedDiffReviewItemId` on the
  card state.
- `open_linked_diff_review` opens the linked task when the card has an id.
- Coordinator actions can update source task status when the update bridge is
  available, or mark only the current card when it is not.

This path is current-session card state, not a durable Diff Review ledger. It
is still useful as the Workspace Chat control surface because it preserves
explicit creation and avoids direct runtime calls.

### Follow-Up Task Creation

`createFollowUpTaskFromSelectedTask()` creates independent follow-up Queue
items from selected task/report state using the existing Queue create/update
bridges. It shows the pattern Diff Review should follow:

- Create a new manual Queue item through the existing Queue API.
- Keep the source task in review state.
- Do not start work.
- Store source/report refs in visible prompt text when first-class durable
  fields are unavailable.

Diff Review should reuse this pattern rather than introduce a second Queue
runtime or storage path.

### Prompt-Pack Metadata

Prompt-pack import materialization already preserves unsupported metadata in
Queue title, description, and prompt body:

- Pack name/id, block id, source path, model profile, reasoning effort,
  validator profile, dependencies, validation commands, expected commit title,
  allowed scope, and forbidden scope are written into visible task text.
- QueueV2 derives prompt-pack metadata from visible Queue task text through
  `getQueuePromptPackImportMetadata(...)`.
- Unsupported first-class fields are reported as warnings.

Diff Review should use the same durable-text strategy for source item id,
source report id, source commit hash, expected commit title, validation
commands, allowed/forbidden scope, and review target summary until Queue has a
durable typed metadata field.

### Validation Evidence

Validation Runner / Evidence currently attaches evidence through existing
Queue report/update state:

- The runner produces structured command/evidence summaries.
- Frontend attachment appends a validation-shaped
  `AgentQueueWorkerExecutionReport` with capped raw evidence preview.
- Queue validation status is updated through the existing Queue Widget API
  update path.
- Attachment failures or unsupported evidence fields are surfaced as warnings.

Important limitation: there is no first-class durable validation evidence
ledger. Evidence is reviewable where the existing Queue report state preserves
it, but the desktop DTO does not persist worker execution reports as typed
fields.

### Direct Work Result / Report Text

Queue task details can display completed Direct Work output as report evidence
without finalizing the task:

- Latest run links provide safe run refs and review status.
- Run detail can expose final message, result summary, changed files from
  payload, validation status, and Git status summary in the Queue details UI.
- Raw payloads stay collapsed/developer-facing.

Important limitation: Diff Review creation should not assume source task
report text is always present. If worker reports are absent or not durable, the
review prompt must say report unavailable and ask the reviewer to compare
against visible scope, run refs, validation evidence, and live diff where
available.

## Diff Data Source Status

### Available

- Workspace Git status: `getWorkspaceGitStatus({ repoRoot })`.
- Workspace Git diff summary:
  `getWorkspaceGitDiffSummary({ repoRoot, maxFiles, maxPatchBytesPerFile,
  includePatchPreview })`.
- Workspace Git file diff: `getWorkspaceGitFileDiff({ repoRoot, path,
  maxPatchBytes })`.
- Retained Git compatibility widget status/diff/log APIs for explicit widget
  and repository root.
- Agent Executor diff summary API for an explicit Agent Executor widget and
  repository root.
- Direct Work result detail may contain bounded final response, payload,
  changed-files summary, validation profile/status, stdout/stderr previews, and
  error summary.
- Validation evidence can list commands run and capped stdout/stderr previews
  when explicitly run and attached.

### Boundaries

- All Git reads require an explicit repository root or execution workspace.
- Git diff APIs are read-only and use fixed Git commands without shell
  invocation.
- Workspace Git diff summary is not tied durably to a Queue item by default.
- Untracked file patch previews are not available in the read-only file-diff
  MVP.
- Browser/Vite cannot read local Git status/diffs and must show unavailable
  state.

### Unsupported Or Missing

- Live Git diff is unavailable when the source task has no execution
  workspace/repository root, when browser fallback is active, when Git is
  unavailable, or when the path is not a Git repository.
- Source task report is unavailable when no worker report exists, when Direct
  Work run detail cannot be loaded, or when report fields were not persisted
  through the current Queue DTO.
- Validation evidence is missing when validation was not explicitly run,
  failed to attach, or is only present in current-session/local frontend state.
- Commit title metadata is missing unless prompt-pack text supplied
  `Expected commit title`, the worker report includes a commit hash/message
  equivalent, or a later Git/commit flow records it visibly.
- Durable source/parent task links are limited. `dependsOn` exists in
  frontend/API paths, but the current Tauri task DTO does not expose a durable
  first-class Diff Review source link.
- Durable linked Diff Review ids are not guaranteed. Workspace Chat report
  card `linkedDiffReviewItemId` is current-session card state unless copied
  into Queue text or later persisted by a typed field.

## Safest Implementation Path

### 1. Treat Diff Review As A Queue Task Type, Not A Runtime

Use existing Queue task creation only. A Diff Review item should be a normal
independent Queue item with:

- `title`: `Diff review: <source title>`.
- `status`: `queued` or `draft` depending on readiness; use `queued` only when
  prompt and execution workspace are present enough for manual run.
- `executionPolicy`: `manual`.
- `itemType`: `diff_review` in frontend state where supported.
- `priority`, `queueTag`, `executionWorkspace`, sandbox, approval policy, and
  Codex executable copied from the source task where visible.
- No automatic assignment, Executor start, validation run, finalization, commit,
  push, rollback, or dependency unblocking.

### 2. Preserve Source Metadata In Durable Text First

Because the current desktop Queue DTO does not persist first-class Diff Review
metadata, the first implementation should embed a stable metadata block in the
Diff Review task prompt and a short summary in the description:

- Source Queue item id.
- Source title.
- Source status/coordinator status when known.
- Source report id when available.
- Source commit hash when available.
- Source execution workspace/repository root when available.
- Prompt-pack block id/pack id if derivable from source task text.
- Expected commit title if derivable from prompt-pack metadata or report text.
- Validation commands and latest validation status/evidence summary when
  available.
- Report summary and reported changed files when available.
- Explicit unsupported states: no live diff, no source report, no validation
  evidence, no commit title metadata.

This mirrors prompt-pack import and avoids schema work in the first slice.

### 3. Reuse Existing Prompt Builder, Then Add Evidence Sections

Start from `buildDiffReviewPrompt(...)` and extend its input model to accept
optional derived evidence:

- Prompt-pack metadata from `getQueuePromptPackImportMetadata(sourceTask)`.
- Validation evidence summary from the latest validation-shaped worker report.
- Direct Work run detail summary when the selected task has a latest run link
  and details are loaded.
- Read-only Git status/diff summary if the operator explicitly requests
  review context from Workspace Chat/QueueV2 and the source execution workspace
  is a repository.

The prompt must remain a review request, not a command to edit code. It should
state that the Diff Review item must not modify code by default and should
recommend follow-up, blocked/finalization, or rollback discussion only as a
report.

### 4. Use Existing Queue Creation Surfaces

Preferred creation points:

- QueueV2 selected-task details action:
  `createDiffReviewTask()` from `useAgentQueueTaskActions`.
- Workspace Chat report action card:
  `create_diff_review` through `WorkspaceAgentQueueReportActionCard`.

Both should call the existing Queue create bridge/API. Neither should call
Agent Executor, validation runner, Workspace Git mutation, Terminal, provider
tools, or Autorun directly.

### 5. Derive Status Cards From Existing Queue State

Status display should be derived from existing task text/state:

- Source item id and report id from the Diff Review metadata block.
- Linked source task by searching current Queue tasks for the source id.
- Validation evidence state from latest validation-shaped report when present.
- Prompt-pack metadata from source task prompt/description.
- Git/diff availability from source execution workspace and explicit read-only
  Workspace Git calls.

Unsupported states must be visible and specific instead of silently omitted:

- `Live git diff unavailable`.
- `Source task report unavailable`.
- `Validation evidence missing`.
- `Commit title metadata missing`.

### 6. Defer Typed Persistence Until Needed

A minimal typed bridge/storage change is not required for the first safe
workflow if metadata is preserved in task text and current-session local fields
continue to improve UI behavior.

If later acceptance requires durable typed linking and filtering, the minimal
approved bridge would be one Queue task metadata field or context payload owned
by Queue, not a second Queue store. It should carry:

- `itemType`.
- `sourceItemId`.
- `sourceReportId`.
- `sourceCommitHash`.
- `reviewMode`.
- `reviewTargetSummary`.
- optional `expectedCommitTitle`.

That later bridge must preserve Queue runtime/scheduler/Autorun semantics and
must not add execution behavior.

## Recommended Workflow

1. Source implementation Queue item reaches `completed`, `review_needed`, or
   `awaiting_coordinator_review` with available report/evidence or an explicit
   operator decision to review scope anyway.
2. Operator clicks `Create Diff Review` from QueueV2 details or Workspace Chat
   report card.
3. Hobit builds a review prompt from source task text, latest report, validation
   evidence, prompt-pack metadata, and visible unsupported-gap markers.
4. Hobit creates an independent manual Queue item through the existing Queue
   create path.
5. No dependent tasks are unblocked. No Executor run starts.
6. Operator may open the Diff Review item, inspect the prompt, assign it, and
   start it through existing Queue controls.
7. Reviewer returns a report recommending accept, follow-up, rollback
   discussion, or block finalization.
8. Coordinator/operator uses existing report/coordinator action cards to
   finalize, request changes, create follow-up, or mark blocked/failed.

## Unsupported Gaps And Follow-Ups

- Live Git diff unavailable unless an explicit source execution workspace /
  repository root exists and desktop Git APIs can read it.
- Source task report unavailable when worker report or Direct Work run detail
  is missing, not loaded, or not preserved by current Queue persistence.
- Validation evidence missing when validation was not explicitly run or could
  not attach to Queue report state.
- Commit title metadata missing unless prompt-pack import preserved
  `Expected commit title`, the report contains commit metadata, or a future
  explicit commit/finalization flow records it.
- Durable typed Diff Review source links are not implemented through the
  current desktop Queue DTO.
- Durable linked Diff Review id from Workspace Chat report cards is not
  implemented.
- Durable validation evidence ledger/storage is not implemented.
- Durable prompt-pack import record and first-class prompt-pack metadata fields
  are not implemented.
- Diff Review does not have a dedicated response parser/validator.
- Diff Review does not gate coordinator finalization automatically.
- Diff Review does not auto-run, auto-finalize, auto-commit, auto-push,
  auto-rollback, or unblock dependents.

## Non-Goals For The First Implementation Slice

- No second Queue runtime/storage path.
- No backend scheduler or durable runner changes.
- No Queue Autorun semantic changes.
- No automatic dependent task unblocking.
- No default code edits from Diff Review.
- No automatic Diff Review execution.
- No automatic finalization, acceptance, commit, push, rollback, reset, clean,
  stash, or checkout.
- No Terminal launch.
- No hidden Workspace/file/Notes/Knowledge/Git/JDBC/Terminal context access.
- No backend/Rust/Tauri/storage/schema change unless durable typed links become
  explicitly required by a later implementation block.

## Acceptance Checks For A Future Implementation Block

- Creating a Diff Review item requires an explicit operator action.
- The created item appears in QueueV2 through canonical Queue state.
- The created item is manual and does not run automatically.
- The prompt includes source item id, source report id when available, declared
  scope, reported changed files, validation evidence summary, prompt-pack
  metadata, expected commit title when available, and unsupported-gap markers.
- Missing live diff, missing report, missing validation evidence, and missing
  commit title are visible.
- QueueV2 and Workspace Chat can open the Diff Review item without starting it.
- Source implementation task remains review/finalization-controlled; no
  dependency is auto-unblocked.
- Browser fallback shows Git/diff unavailable rather than fake data.
- Validation, Git reads, and Direct Work runs remain explicit existing actions.
