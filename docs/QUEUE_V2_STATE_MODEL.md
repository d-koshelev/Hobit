# Queue v2 State Model

## 1. Summary

Queue v2 needs a state and view model that can represent many incoming tasks,
parallel independent execution, dependency blocking, review/finalization, worker
capacity, and explicit operator control.

This document is type/design only. It does not add frontend behavior, backend
runtime behavior, storage/schema changes, scheduling, dependency execution,
Agent Executor changes, Git mutation, Terminal launch, or hidden automation.

Queue v2 remains a Workspace-scoped Agent Queue widget model. It organizes and
visualizes work; it does not silently run, accept, commit, push, or finalize
work. Manual run remains explicit, and Autorun, when present, must be explicitly
operator-armed.

Core model concepts:

- `QueueTaskLifecycle`: the visible task lifecycle state.
- `QueueTaskClosureState`: the explicit closure/finalization outcome.
- `QueueTaskDependencyState`: dependency graph and blocking summary.
- `QueueTaskEligibility`: the computed "can run now" decision.
- `QueueWorkerCapacity`: current worker/provider slot availability.
- `QueueParallelRunGroup`: a set of tasks that can run together without
  blocking each other.
- `QueueNextAction`: the single primary operator action for a task.
- `QueueBoardLane`: the board placement derived from lifecycle and blockers.
- `QueueInspectorSnapshot`: selected-task detail and decision model.
- `QueueActivityEventGroup`: grouped activity for the collapsed detail drawer.

## 2. Lifecycle states

`QueueTaskLifecycle` is the task's operational state. It is not the same as
closure acceptance. A successful run can produce a reviewable report without
being finalized.

Required lifecycle states:

- `draft`: the task exists but lacks enough reviewed inputs, settings, context,
  or operator intent to enter the executable queue.
- `queued`: the task has been accepted into Queue but has not yet been proven
  ready to run.
- `ready`: the task has valid settings and context, no open blocking
  dependencies, and can be considered for manual run or armed Autorun.
- `running`: a worker/provider is actively executing the task.
- `report_ready`: execution produced a report, result summary, validation
  output, artifact, or final response that is ready for operator inspection.
- `review_required`: the task cannot close until the operator makes an explicit
  review decision.
- `finalized`: the operator explicitly closed the task with a closure outcome.
- `blocked`: the task cannot proceed because at least one visible blocker is
  open.
- `failed`: execution, validation, handoff, required context preparation, or a
  required post-run step failed.
- `cancelled`: the operator cancelled the task or stopped it before completion.

Lifecycle rules:

- `draft`, `queued`, and `ready` are pre-run states.
- `running` must include a visible worker/provider/run reference when one
  exists.
- `report_ready` means output exists; it does not imply acceptance.
- `review_required` means the next product decision belongs to the operator.
- `finalized` requires an explicit `QueueTaskClosureState`.
- `blocked` must carry at least one visible blocked reason.
- `failed` may still require review if partial output or artifacts exist.
- `cancelled` may close immediately or move to review when cancellation creates
  output that the operator must inspect.

## 3. Closure states

`QueueTaskClosureState` records why a task is closed or why closure could not
complete. It is only meaningful for finalized tasks or attempted-finalization
flows.

Required closure outcomes:

- `commit_created`: the operator accepted the task and a separate explicit Git
  commit flow created a local commit. Queue records the closure outcome only;
  Queue does not create commits by itself.
- `no_change_accepted`: the operator accepted the result with no code/data
  changes requiring a commit.
- `follow_up_created`: the operator closed this task by creating one or more
  explicit follow-up Queue tasks.
- `closure_blocked`: the operator attempted to close the task, but closure is
  blocked by unresolved review, failed validation, dirty/unknown state, missing
  output, missing decision, or another visible safety condition.
- `rejected`: the operator rejected the result and closed the task without
  accepting it.
- `request_changes`: the operator requested changes and either reopened the
  task or created a follow-up. Use this when the current model needs a review
  decision distinct from outright rejection.

Closure rules:

- A task must not become `finalized` because execution succeeded.
- A closure outcome must be operator-visible and auditable when persistence
  exists.
- `commit_created` is a closure label for Queue history, not permission for
  Queue to mutate Git.
- `follow_up_created` should reference the created task ids when storage/API
  support exists.
- `closure_blocked` keeps the task in `review_required`, `report_ready`,
  `blocked`, or `failed` until the blocker is resolved.

## 4. Dependency model

`QueueTaskDependencyState` summarizes prerequisite relationships and whether
they block eligibility.

Conceptual shape:

```text
QueueTaskDependencyState
  task_id
  prerequisites: QueueTaskDependencyRef[]
  dependents: task_id[]
  open_blocking_dependencies: QueueTaskDependencyRef[]
  satisfied_dependencies: QueueTaskDependencyRef[]
  failed_or_rejected_dependencies: QueueTaskDependencyRef[]
  dependency_blocked_reason: string | null
  graph_validity: valid | cycle_detected | missing_task | stale_ref
```

Dependency refs should include:

- prerequisite task id;
- prerequisite title summary;
- prerequisite lifecycle;
- prerequisite closure state when present;
- blocking mode;
- reason shown to the operator.

Dependency rules:

- A dependency is open when the prerequisite is not closed with an acceptable
  closure outcome.
- A dependent task is not eligible while any blocking dependency is open.
- A prerequisite closed as `rejected`, `closure_blocked`, `failed`, or
  `cancelled` may either block dependents or require operator override,
  depending on future policy.
- Dependency graphs must reject cycles before any runtime scheduling uses them.
- Missing or stale dependency refs are safety blockers, not silent skips.
- Dependency state must be visible before any dependency-aware execution block.

## 5. Eligibility model

`QueueTaskEligibility` is a computed read model. It answers whether a task can
run now and explains every blocker. It must be derived, not hand-edited as the
source of truth.

A task is eligible only if all required conditions are true:

- Queue is enabled.
- Task lifecycle is `ready` or `queued`.
- No blocking dependency is open.
- Worker/provider capacity exists.
- Task run settings are valid.
- Required context is valid.
- Required tag/worker is not paused.
- No safety blocker exists.

Conceptual shape:

```text
QueueTaskEligibility
  task_id
  eligible_now: boolean
  lifecycle_ok: boolean
  queue_enabled: boolean
  dependency_ok: boolean
  capacity_ok: boolean
  run_settings_ok: boolean
  context_ok: boolean
  tag_or_worker_ok: boolean
  safety_ok: boolean
  compatible_worker_ids: string[]
  blocked_reasons: QueueBlockedReason[]
  dry_run_position: number | null
```

Blocked reason categories:

- `queue_disabled`
- `not_ready_lifecycle`
- `dependency_open`
- `dependency_failed_or_rejected`
- `dependency_graph_invalid`
- `capacity_unavailable`
- `run_settings_invalid`
- `context_missing`
- `context_invalid`
- `worker_paused`
- `tag_paused`
- `safety_blocker`
- `operator_review_required`
- `runtime_unavailable`

Eligibility rules:

- `queued` can derive as eligible only when all readiness checks pass. The UI
  may then show it in `Ready` while preserving the persisted lifecycle if
  needed.
- `ready` is not eligible if capacity, context, pause, dependency, or safety
  checks fail.
- `running`, `report_ready`, `review_required`, `finalized`, `failed`, and
  `cancelled` are not eligible to start a new run unless a future explicit rerun
  model creates a new run attempt.
- Eligibility does not start execution. It only supports board indicators,
  explicit `Run now`, and scheduler dry-run previews.

## 6. Parallel run model

`QueueParallelRunGroup` represents a set of eligible tasks that can run
together because they do not block each other and compatible worker/provider
capacity exists.

Conceptual shape:

```text
QueueParallelRunGroup
  group_id
  candidate_task_ids: task_id[]
  runnable_task_ids: task_id[]
  deferred_task_ids: task_id[]
  required_worker_kinds: string[]
  assigned_worker_ids: string[]
  capacity_required
  capacity_available
  conflicts: QueueParallelConflict[]
  dry_run_summary
```

Parallel grouping rules:

- Independent tasks can be in the same run group.
- A task and its blocking prerequisite cannot be in the same runnable set.
- Tasks competing for the same exclusive worker, paused tag, or exclusive
  resource must be ordered or deferred.
- A group is a planner/view concept unless a future explicit runtime contract
  implements parallel dispatch.
- The board may show a group as "eligible together" or "would start together"
  only when the operator has armed the relevant control or requested a dry run.
- Parallel groups must not imply hidden scheduling or hidden worker assignment.

Scheduler dry-run summary should include:

- number of eligible tasks that would start now;
- number deferred because of capacity;
- number blocked by dependencies;
- number blocked by invalid settings/context/safety;
- worker slots that would be consumed;
- tasks that need operator review before any next run.

## 7. Worker/capacity model

`QueueWorkerCapacity` summarizes worker/provider availability without
transferring live execution ownership from Agent Executor or the provider
surface into Queue.

Conceptual shape:

```text
QueueWorkerCapacity
  queue_enabled: boolean
  autorun_armed: boolean
  total_slots: number
  available_slots: number
  running_slots: number
  paused_slots: number
  unavailable_slots: number
  workers: QueueWorkerSnapshot[]
  paused_tags: string[]
  eligible_now_count: number
  review_needed_count: number
```

Worker snapshot:

```text
QueueWorkerSnapshot
  worker_id
  label
  kind
  capacity
  running_count
  available_count
  paused
  unavailable_reason
  compatible_tags
  current_task_ids
```

Capacity rules:

- Capacity is descriptive until the operator starts a manual run or explicitly
  arms an allowed Autorun mode.
- Zero available capacity blocks eligibility even for otherwise ready tasks.
- Paused workers or tags are visible blockers.
- Worker/provider compatibility should be explicit enough to explain why one
  ready task is eligible and another is not.
- Queue capacity summaries must not hide the fact that live logs, stop/cancel,
  and run detail remain owned by Agent Executor or the relevant execution
  surface.

## 8. Next action model

`QueueNextAction` is the single primary action derived for a task card and the
selected-task inspector. Secondary actions may exist, but one primary action
must be clear.

Suggested next actions:

- `edit_draft`: complete or revise a draft task.
- `queue_task`: move a draft into the queue.
- `validate_readiness`: check required settings, context, dependencies, and
  safety conditions.
- `run_now`: explicitly start an eligible task.
- `assign_worker`: choose a compatible worker/provider.
- `wait_for_capacity`: no compatible capacity exists right now.
- `resolve_dependency`: inspect or close a prerequisite task.
- `resolve_blocker`: fix a non-dependency blocker.
- `review_report`: inspect report output.
- `accept_result`: finalize with an accepted closure outcome.
- `request_changes`: reopen or create a follow-up for changes.
- `create_follow_up`: create a dependent follow-up task.
- `reject_result`: reject and close.
- `retry_or_rerun`: create an explicit rerun attempt after failure.
- `close_cancelled`: close a cancelled task.
- `view_history`: inspect finalized task history.

Derivation rules:

- `draft` normally maps to `edit_draft` or `queue_task`.
- Eligible `queued` or `ready` tasks map to `run_now`.
- Ready-looking tasks without capacity map to `wait_for_capacity`.
- Dependency-blocked tasks map to `resolve_dependency`.
- Safety/context/settings blockers map to `resolve_blocker` or
  `validate_readiness`.
- `running` maps to viewing run status/history; stop/cancel remains a secondary
  explicit control owned by the appropriate surface.
- `report_ready` and `review_required` map to `review_report`.
- Reviewed output can map to `accept_result`, `request_changes`,
  `create_follow_up`, or `reject_result`.
- `failed` maps to `retry_or_rerun` or `review_report` when output exists.
- `cancelled` maps to `close_cancelled` unless review output exists.
- `finalized` maps to `view_history`.

## 9. Board/inspector view model

`QueueBoardLane` is the visible board grouping derived from lifecycle,
dependency state, review state, and closure state.

Required lanes:

- `intake_draft`: `draft` tasks and newly imported/proposed tasks needing
  operator preparation.
- `ready`: `queued` or `ready` tasks with no blockers, plus eligible-now
  indicators when capacity exists.
- `running`: `running` tasks, each with worker/provider identity and elapsed
  status.
- `review`: `report_ready` and `review_required` tasks.
- `blocked`: tasks with dependency, capacity, context, settings, pause, safety,
  or closure blockers.
- `closed`: `finalized`, terminal `cancelled`, and intentionally closed
  rejected/no-change/follow-up outcomes.

Lane derivation priority:

1. `finalized` -> `closed`.
2. `running` -> `running`.
3. `report_ready` or `review_required` -> `review`.
4. any open blocker -> `blocked`.
5. `draft` -> `intake_draft`.
6. eligible or ready-like `queued`/`ready` -> `ready`.
7. `failed` -> `blocked` or `review`, depending on whether reviewable output
   exists.
8. `cancelled` -> `closed` or `review`, depending on whether reviewable output
   exists.

`QueueInspectorSnapshot` is the selected-task decision model.

Conceptual shape:

```text
QueueInspectorSnapshot
  task_id
  title
  objective
  lifecycle
  closure_state
  board_lane
  priority
  next_action
  secondary_actions
  dependency_state
  eligibility
  blocked_reasons
  worker_assignment
  run_summary
  report_summary
  review_decision_state
  context_summary
  attachment_summary
  source_ref_summary
  activity_group_ids
```

Required UI derivations:

- board lane per task;
- next action per task;
- parallel run group;
- blocked reason;
- capacity summary;
- review-needed count;
- eligible-now count;
- scheduler dry-run summary.

View-model rules:

- The board is the primary operating view.
- The inspector owns task decisions and shows one primary next action.
- Raw logs, executor events, validation excerpts, and developer details belong
  in the collapsed activity drawer or a detail popup.
- Task cards should show compact title, lane-relevant chips, next action,
  blocker/dependency summary, worker/provider when running, and attachment
  counts when useful.
- Cards must not duplicate raw prompts, full reports, full logs, or complete
  dependency lists.

`QueueActivityEventGroup` groups lower-level events for the activity drawer.

Conceptual shape:

```text
QueueActivityEventGroup
  group_id
  task_id
  title
  kind
  severity
  started_at
  ended_at
  event_count
  latest_summary
  linked_run_ids
  collapsed_by_default: true
```

Activity group kinds:

- `lifecycle`
- `dependency`
- `eligibility`
- `run`
- `validation`
- `review`
- `closure`
- `capacity`
- `safety`

Activity rules:

- Activity groups support diagnosis and audit, not normal board operation.
- Content must be bounded and safe to collapse.
- Activity summaries must not replace task lifecycle, next action, or review
  state.

## 10. Migration from current Queue

Current Queue has manual task storage/API, status editing, visible assignment,
explicit assigned-task start, current-session handoff, final-status
auto-refresh, safe run-link visibility, and operator-armed desktop-local
Autorun preview. It does not have dependency management, multi-executor
parallel scheduling, durable scheduler behavior, automatic acceptance, response
validation, Git mutation, Terminal launch, or hidden execution.

Migration should be additive and staged:

1. Map existing statuses into `QueueTaskLifecycle` without changing persisted
   storage.
2. Add derived `QueueBoardLane`, `QueueNextAction`, and blocked-reason view
   logic over current task records.
3. Treat existing assignment/run-link metadata as partial worker/run summary
   input.
4. Introduce dependency refs only after a focused dependency data contract and
   storage/API block.
5. Introduce capacity summaries over visible Executor/provider slots without
   adding scheduling behavior.
6. Add review/finalization states before any automatic closure or validation
   claim.
7. Add parallel run-group dry-run planning before any parallel runtime block.

Compatibility mapping:

- current `draft` -> `draft`;
- current `queued` -> `queued`;
- current `ready` -> `ready`;
- current `running` -> `running`;
- current `completed` -> `report_ready` until reviewed/finalized;
- current `review_needed` -> `review_required`;
- current `blocked` -> `blocked`;
- current `failed` -> `failed`;
- current `cancelled` -> `cancelled`.

If current data only says "completed", Queue v2 must not infer acceptance.
It should show `report_ready` or `review_required` until the operator closes
the item with a `QueueTaskClosureState`.

## 11. Implementation blocks

Future work should remain focused and contract-driven:

1. Docs/type block: finalize lifecycle, closure, dependency, eligibility,
   capacity, parallel group, next action, lane, inspector, and activity
   vocabulary.
2. Frontend-only view derivation block: derive lanes, next actions, counts, and
   blocked summaries over existing Queue data without storage/runtime changes.
3. Board shell block: render Queue v2 lanes/cards using current data only.
4. Inspector block: move selected-task decision display into a compact
   inspector with one primary next action.
5. Review/finalization model block: add explicit review and closure decisions
   only after storage/API contracts are approved.
6. Dependency model block: add dependency refs, graph validation, blocked
   reasons, and cycle rejection.
7. Capacity model block: summarize visible worker/provider slots and paused
   tags without dispatch changes.
8. Scheduler dry-run block: compute eligible-now and parallel run groups as a
   preview only.
9. Runtime block: only after separate approval, implement any parallel or
   dependency-aware execution behavior with explicit operator controls.

Each block must state whether it is docs-only, frontend-only, API/storage,
runtime, or validation work. Runtime, storage/schema, scheduler,
dependency-execution, Git, Terminal, or provider behavior changes require
their own explicit contracts and implementation prompts.

## 12. Risks

- Lifecycle and closure can be conflated. Mitigation: keep run success,
  report-ready, review-required, and finalized as separate concepts.
- Eligibility can be mistaken for execution. Mitigation: label it as a dry-run
  or "can run now" derivation, never a hidden dispatch action.
- Parallel groups can imply hidden scheduling. Mitigation: present groups as
  planner output unless an explicit operator-controlled runtime block exists.
- Capacity can drift from real Executor state. Mitigation: treat capacity as a
  snapshot with visible timestamps/source when implemented.
- Dependencies can hide failed prerequisite decisions. Mitigation: expose
  failed/rejected/cancelled prerequisites as visible blockers.
- Review states can become cluttered. Mitigation: board first, inspector
  second, activity drawer collapsed by default.
- Closure outcomes can imply Git mutation. Mitigation: Queue records
  `commit_created` only after a separate explicit Git flow has done the work.
- Migration can overclaim current behavior. Mitigation: derive Queue v2 views
  over current data first and do not add runtime, storage, or scheduler
  behavior in view-only blocks.
