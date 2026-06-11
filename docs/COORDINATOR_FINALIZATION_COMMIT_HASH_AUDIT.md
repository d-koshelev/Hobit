# Coordinator Finalization Commit Hash Audit

## Status

Docs-only functional audit for explicit coordinator finalization and commit-hash
workflow.

No source code, tests, backend behavior, frontend behavior, storage schema,
runtime execution, Git mutation, Queue scheduler, Autorun semantics, dependent
task execution, rollback execution, or provider behavior is changed by this
document.

## Objective

Audit how Hobit can explicitly finalize Queue items after implementation,
validation evidence, and Diff Review, while storing commit information and
gating dependent tasks.

The target decisions are:

- accept without commit;
- accept with commit hash;
- request changes;
- follow-up required;
- blocked;
- failed;
- rollback required;
- manual review required.

Validation evidence and Diff Review output are review inputs. They must not
automatically accept work, create commits, push, rollback, or start dependent
tasks.

## Inspected Areas

- Queue task lifecycle, coordinator status, closure state, report, dependency,
  validation, and Diff Review frontend types.
- Queue Widget API create/update/read model.
- Tauri Queue task DTO and SQLite task storage shape.
- Workspace Chat Queue control service and report action cards.
- QueueV2 task details, actions, validation evidence display, and Diff Review
  display.
- Prompt-pack parser/materialization metadata.
- Validation runner/evidence attachment model.
- Diff Review request/checklist/linkage models.
- Workspace Git status, diff, log, and commit APIs.
- Git commit adapter behavior.

## Existing Lifecycle And Finalization Fields

The frontend Queue task model in `apps/desktop/frontend/src/workspace/types/agentQueue.ts`
already defines these useful finalization-adjacent fields:

- `AgentQueueTaskStatus`: `draft`, `queued`, `ready`, `running`, `completed`,
  `failed`, `cancelled`, `review_needed`.
- `AgentQueueTaskValidationStatus`: `not_started`, `validating`, `passed`,
  `failed`, `needs_review`.
- `AgentQueueCoordinatorStatus`: `not_reported`, `worker_reported`,
  `awaiting_validation`, `awaiting_coordinator_review`,
  `ready_for_finalization`, `finalized`, `needs_changes`,
  `follow_up_required`, `blocked`, `failed`, `rollback_required`.
- `AgentQueueClosureState`: `closure_required`, `commit_required`,
  `commit_created`, `no_change_accepted`, `follow_up_created`,
  `closure_blocked`.
- `AgentQueueWorkerExecutionReport.commitHash`, `finalGitStatus`,
  `changedFiles`, validation fields, warnings, errors, and follow-up/rollback
  recommendations.
- `AgentQueueDiffReviewMetadata` for source item, source report, source commit,
  review mode, and target summary.

The frontend action helpers already implement a provisional explicit decision
mapping in `agentQueueTaskCoordinatorActions.ts`:

- `mark_ready_for_finalization` moves the task to review-needed closure.
- `finalize_accept_item` finalizes only when the latest report is no-change or
  already carries a commit hash; changed files without a commit stay
  `commit_required`.
- `accept_without_commit` finalizes only no-change reports.
- `mark_needs_changes`, `mark_follow_up_required`, `mark_blocked`,
  `mark_failed_rejected`, and `mark_rollback_required` mark visible
  non-accepted states without running hidden work.

The Queue details surface in
`AgentQueueTaskCoordinatorDecisionSection.tsx` and QueueV2 details actions in
`queueV2TaskDetailsActions.ts` expose explicit finalization controls:

- accept result;
- commit result;
- accept without commit;
- request changes;
- create follow-up;
- mark ready for finalization;
- mark blocked;
- mark failed/rejected;
- mark rollback required.

The important gap is durability. The Tauri Queue task DTO and SQLite table only
persist:

- id/workspace/title/description/prompt;
- status/priority;
- execution policy/workspace/Codex executable/sandbox/approval policy;
- context JSON;
- assigned executor;
- timestamps.

They do not persist first-class coordinator status, closure state, dependencies,
item type, queue tag, validation status, worker reports, Diff Review metadata,
prompt-pack metadata, or commit metadata. Current frontend code preserves many
of those fields in local task-foundation state or visible task text, but that
is not a durable authoritative finalization record.

## Workspace Chat And QueueV2 Surfaces

Workspace Chat Queue control already routes selected-task coordinator decisions
through `workspaceChatQueueControlService.ts` when the Queue controller is
available and the selected Queue item matches the requested item. It supports
selected-task decisions for:

- accept without commit;
- create follow-up;
- finalize/accept;
- mark blocked;
- mark failed/rejected;
- mark follow-up required;
- mark needs changes;
- mark ready for finalization.

`mark_rollback_required` is intentionally not exposed by that typed Workspace
Chat service even though the report action card can mark rollback required.
This should be made consistent in a finalization block.

`WorkspaceAgentQueueReportActionCard.tsx` can update a source Queue item or,
when update plumbing is unavailable, mark only current-session card state. It
can create follow-up and Diff Review items through existing Queue create
actions and can do read-only Workspace Git status/diff summary review. It does
not auto-run, auto-finalize, commit, push, rollback, or unblock dependents.

QueueV2 task details show validation evidence, prompt-pack metadata, Diff
Review linkage, result evidence, and action buttons. QueueV2 is already the
right display/action surface for explicit finalization, but its finalization
buttons currently depend on frontend controller state rather than a durable
Queue finalization service.

## Validation Evidence Availability

Validation has a typed command/evidence model and a frontend Queue evidence
attachment service. It can:

- mark a Queue item as `validating`;
- run explicit structured validation commands through an available runner;
- append a validation-shaped worker execution report;
- update validation status to `passed`, `failed`, or `needs_review`;
- display capped evidence in Workspace Chat and QueueV2.

Known limitations for finalization:

- there is no durable immutable validation evidence ledger;
- full log references are not first-class durable Queue evidence;
- validation status/report attachment depends on the Queue Widget API update
  bridge preserving frontend-only fields;
- validation failure is not yet enforced by a single finalization service;
- validation evidence is not approved for AI context by default.

## Diff Review Availability

Diff Review has a good review model:

- source task ref includes commit hash, expected commit title, prompt-pack block
  id, item type, status, execution workspace, and report id where available;
- input snapshot includes actual diff summary, allowed/forbidden scope,
  validation commands/evidence, prompt-pack metadata, dependent task ids, and
  unsupported states;
- checklist explicitly checks report-vs-diff, scope, validation, expected
  commit title, no hidden commit/push/finalize, and dependent unblock state;
- recommendation supports `accept_ready`, `request_changes`,
  `validation_required`, `blocked`, `rollback_required`, and
  `manual_review_required`.

Diff Review linkage is mostly frontend/current-session or visible-text based.
There is no durable typed Diff Review result parser and no authoritative
source-task finalization gate based on the Diff Review recommendation.

## Prompt-Pack Metadata Availability

Prompt-pack import parses:

- block/item id;
- dependencies;
- expected commit title;
- validation commands;
- allowed scope;
- forbidden scope;
- execution workspace;
- model profile;
- reasoning effort;
- validator profile;
- tags;
- priority;
- source path.

Materialization creates draft/manual Queue items through the existing Queue
bridge and preserves unsupported metadata in the task description/prompt body.
QueueV2 derives metadata back out of visible title/description/prompt text.

This is sufficient for visible review and a frontend-only first slice, but not
for reliable coordinator finalization because there are no durable first-class
fields for expected commit title, block id, validation command list,
allowed/forbidden scope, prompt-pack dependency ids, or prompt-pack logical id
to Queue item id mapping.

## Git And Commit Metadata Availability

Available Git capabilities:

- read-only workspace Git status can expose the last commit hash/title through
  `GitRepositoryStatus.lastCommit`;
- read-only diff summary, file diff, and log APIs exist;
- explicit local commit support exists through `createWorkspaceGitCommit`;
- the Git commit adapter validates an explicit repository root, non-empty
  commit message, explicit repo-relative included files, no staged files
  outside selection, and returns a commit hash after `git rev-parse HEAD`;
- commit result flags state no push, force push, reset, clean, or auto-commit.

Missing or unsafe for the requested finalization workflow:

- no dedicated read-only `resolve/validate commit hash and title for Queue
  item` service exists;
- no helper validates that an operator-entered hash exists in the selected
  repo and has the expected title;
- no helper validates that the commit contains exactly or at least the reported
  changed files;
- no durable Queue commit metadata field exists;
- current `commitSelectedResult` creates a commit with `[QUEUE <id>] <title>`,
  not the prompt-pack expected commit title;
- creating a commit from Queue is a Git mutation and should remain separate
  from the finalization service unless explicitly requested by the operator.

The safest near-term path is to support `accept with existing commit hash`
first, using operator-provided or prior commit-result metadata, and to treat
commit creation as a separate explicit Git action.

## Dependency Gating Capabilities

Frontend dependency logic exists in `agentQueueDependencyUi.ts`:

- normalizes `dependsOn`;
- detects missing/self/cycle blockers;
- requires dependency task status `completed`;
- additionally requires dependency `coordinatorStatus === "finalized"`;
- blocks run readiness while dependencies are not ready;
- blocks Autorun arming when any dependency state is not ready.

This is the right product rule: dependent tasks should unlock only after the
prerequisite is completed and explicitly finalized.

Current gaps:

- dependency refs are not persisted by the Tauri Queue task DTO/storage shape;
- prompt-pack dependency materialization attempts Queue update bridge links,
  but durable support is limited and also preserved in visible prompt text;
- dependency gating is frontend-derived, not a backend/service invariant;
- no dependent task is automatically started, which is correct and should be
  preserved;
- no explicit "manual override dependency blocker" model exists.

## Recommended Implementation Path

### 1. Coordinator Decision / Finalization Model

Create a small canonical frontend model first, then persist it only after the
field contract is stable.

Suggested decision vocabulary:

- `accepted_no_commit`;
- `accepted_with_commit`;
- `request_changes`;
- `follow_up_required`;
- `blocked`;
- `failed`;
- `rollback_required`;
- `manual_review_required`.

Suggested derived closure mapping:

- `accepted_no_commit` -> `coordinatorStatus: finalized`,
  `closureState: no_change_accepted`, `status: completed`;
- `accepted_with_commit` -> `coordinatorStatus: finalized`,
  `closureState: commit_created`, `status: completed`;
- `follow_up_required` with created follow-up ids -> `closureState:
  follow_up_created` only when follow-up creation succeeds; otherwise
  `closure_blocked`;
- non-accepted outcomes -> `closure_blocked` and visible review/blocked/failed
  task status.

Do not overload validation status as finalization. Validation remains evidence.

### 2. Commit Title / Hash Validation

For the first safe slice, validate shape and provenance without Git mutation:

- require explicit repository root from the Queue item execution workspace or
  visible operator-selected repo root;
- accept either an existing report `commitHash` or an operator-entered hash;
- validate hash format locally before any Git call;
- compare expected commit title from prompt-pack metadata when available;
- if no read-only lookup service exists, record `commit_validation_status:
  unverified` visibly rather than faking success.

If stronger validation is required, add a minimal explicit read-only Git bridge
that runs fixed commands against an explicit repo root:

- `git show -s --format=%H%x00%s <hash>`;
- optionally `git diff-tree --no-commit-id --name-only -r <hash>`.

This bridge must not fetch, push, stage, commit, reset, clean, stash, checkout,
or discover repositories.

### 3. Queue Finalization Action Service

Introduce one service boundary instead of spreading finalization across cards:

- input: task id, decision, optional commit hash/title/source, optional
  validation evidence refs, optional Diff Review item/report ref, optional
  follow-up ids, visible note;
- preconditions: selected task exists; no unsaved edit; result/report evidence
  loaded for acceptance; validation passed or explicit override reason present;
  Diff Review accepted/manual override where required; commit decision matches
  changed-file/no-change state;
- output: updated task patch plus warnings/unsupported gaps;
- hard guarantees: no auto-run, no auto-commit, no push, no rollback, no
  dependent task start.

Initially this can wrap the existing Queue update bridge. Durable fields should
be added only after the finalization contract is accepted.

### 4. Dependency Readiness / Gating

Reuse existing dependency derivation:

- dependencies are ready only when prerequisite task is `completed` and
  `coordinatorStatus === finalized`;
- `accepted_no_commit` and `accepted_with_commit` can satisfy dependencies;
- `follow_up_required`, `request_changes`, `blocked`, `failed`,
  `rollback_required`, and `manual_review_required` keep dependents blocked;
- follow-up creation should not auto-run or unblock dependents.

Move the rule into a shared model/service before any backend scheduler or
Autorun behavior depends on it. Do not add dependency execution.

### 5. Workspace Chat Controls / Cards

Unify Workspace Chat report cards with the same finalization service:

- show current evidence: latest report, validation state, Diff Review state,
  expected commit title, commit hash verification state, dependent blockers;
- expose explicit decision buttons only when the selected task/action context
  matches;
- add a visible "manual review required" decision;
- make rollback-required handling consistent between report cards and typed
  Workspace Chat control service;
- report unsupported states as card warnings.

### 6. QueueV2 Display / Actions

QueueV2 should remain the primary review/finalization surface:

- add a compact finalization summary to task details;
- show decision, closure state, commit hash/title/status, validation evidence
  status, Diff Review recommendation/status, and dependent readiness;
- keep raw evidence in Result / Files-Validation / Developer sections;
- use one primary next action: validate, create Diff Review, finalize, request
  changes, create follow-up, or resolve blocker;
- do not duplicate raw prompt/report/log content on cards.

## Unsupported Gaps And Follow-Ups

- Git lookup unavailable as a dedicated finalization-safe service. Existing Git
  status/log/diff reads and commit creation exist, but no typed commit
  hash/title validation helper exists.
- Dependency model missing from durable backend Queue DTO/storage. Frontend
  dependency logic exists, but persistence is not authoritative.
- Diff Review status unavailable as durable typed source-task state. Linkage and
  status are derived from frontend task metadata, visible text, and current
  Queue state.
- Validation evidence missing as an immutable durable ledger. Current evidence
  is attached as a worker execution report through Queue update state.
- Commit metadata missing from durable Queue fields. Commit hash exists on
  frontend worker reports/cards when supplied, but is not an authoritative
  Queue finalization field.
- Prompt-pack metadata missing as durable first-class Queue fields. It is
  preserved and re-parsed from visible title/description/prompt text.
- Coordinator finalization fields are not persisted by Tauri Queue DTO/storage.
  Current frontend state can show decisions, but reload can lose local
  finalization details.
- `manual_review_required` is present as a Diff Review recommendation but not
  yet a Queue coordinator status/closure action.
- Existing `commitSelectedResult` creates a commit through Git. That is useful
  but should remain a separate explicit Git action and should not be conflated
  with "accept with existing commit hash".

## Safest Next Block

Recommended next implementation block: frontend-first finalization service and
UI unification, with no schema changes and no new Git mutation.

Scope:

- define `CoordinatorFinalizationDecision` and `CoordinatorFinalizationInput`;
- centralize the existing decision mapping;
- add `manual_review_required`;
- support `accept_with_existing_commit_hash` as a non-mutating decision using
  existing report/card commit hash when present;
- surface unsupported verification as visible warnings;
- reuse current Queue update bridge and local task fields;
- preserve dependency gating derivation over `coordinatorStatus === finalized`;
- update Workspace Chat cards and QueueV2 to call the same service.

Do not implement automatic dependent task start, automatic finalization,
automatic commit, push, rollback, backend scheduler behavior, or a second Queue
runtime/storage path.

Follow-up after that block: minimal durable finalization fields or a typed
Queue finalization storage/API bridge, if the frontend-first service proves the
state shape.
