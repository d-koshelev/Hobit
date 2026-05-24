# Hobit Performance Refactor Audit

Date: 2026-05-23

Scope: investigation-first audit of slow request candidates after moving Recent Activity to the app shell. No product behavior, schema, Tauri command names, or DTO compatibility changed.

## Inspected Surfaces

- Frontend Workspace API wrappers:
  - `apps/desktop/frontend/src/workspace/tauriWorkspaceApi.ts`
  - `apps/desktop/frontend/src/workspace/tauriAgentQueueApi.ts`
  - `apps/desktop/frontend/src/workspace/tauriAgentExecutorHistoryApi.ts`
- Queue selected-task refresh and run metadata:
  - `apps/desktop/frontend/src/workbench/queue/useAgentQueueController.ts`
  - `apps/desktop/frontend/src/workbench/useQueueTaskAutoRefreshFromExecutor.ts`
  - `apps/desktop/frontend/src/workbench/queue/useAgentQueueSequentialRunner.ts`
  - `apps/desktop/frontend/src/workbench/widgetHostRenderProps.ts`
- Recent Activity shell placement:
  - `apps/desktop/frontend/src/workbench/WorkbenchShell.tsx`
  - `apps/desktop/frontend/src/workbench/WorkbenchActivity.tsx`
  - `apps/desktop/frontend/src/workbench/useCurrentSessionActivity.ts`
- Workbench/workspace load:
  - `crates/hobit-app/src/workspace_service/workbenches.rs`
  - `crates/hobit-storage-sqlite/src/store/events.rs`
  - `crates/hobit-storage-sqlite/src/store/widget_instances.rs`
  - `crates/hobit-storage-sqlite/src/store/shared_state.rs`
- Tauri command handlers:
  - `apps/desktop/src-tauri/src/workspace_commands.rs`
  - `apps/desktop/src-tauri/src/agent_queue_task_commands.rs`
  - `apps/desktop/src-tauri/src/agent_queue_execution_commands.rs`
  - `apps/desktop/src-tauri/src/agent_queue_runner_commands.rs`
- SQLite query and index definitions:
  - `crates/hobit-storage-sqlite/src/schema.rs`
  - `crates/hobit-storage-sqlite/src/store/agent_queue_tasks.rs`
  - `crates/hobit-storage-sqlite/src/store/agent_queue_task_run_links.rs`
  - `crates/hobit-storage-sqlite/src/store/widget_runs.rs`
  - `crates/hobit-storage-sqlite/src/store/widget_logs.rs`

## Likely Slow Request Candidates

1. Queue reload can be triggered by unrelated shell re-renders.
   - `useAgentQueueController` reloads tasks in an effect keyed by `loadTasks` (`useAgentQueueController.ts:321`).
   - `loadTasks` depends on handler props and performs `listAgentQueueTasks` plus `getAgentQueueTask` (`useAgentQueueController.ts:246`, `:274`, `:290`).
   - Queue handler props are rebuilt in `widgetHostRenderProps` (`widgetHostRenderProps.ts:35`, `:122`, `:126`, `:142`, `:194`), and `useWorkbenchWidgetActions` returns a fresh action object each shell render (`useWorkbenchWidgetActions.ts:81`).
   - Shell state changes such as Activity drawer toggle can therefore re-render the widget tree and plausibly cause a full queue reload.

2. Queue mutation paths frequently reload the whole queue after a single-row response.
   - Create, save, assign, clear assignment, delete, start selected task, sequential runner start, and autorun start all call `loadTasks` after an operation (`useAgentQueueController.ts:532`, `:632`, `:706`, `:712`, `:761`, `:790`, `:837`, `:917`).
   - Backend mutation commands already return the affected task for create/update/assign/clear/start paths, but the frontend often discards that locality and asks for the full list plus selected detail.

3. Latest run and run history are intentionally coalesced, but refreshes still add extra calls around queue reloads.
   - The current controller uses one `refreshLatestRunLink` function for both latest run and history, preferring `listAgentQueueTaskRunLinks` over `getAgentQueueTaskLatestRunLink` (`useAgentQueueController.ts:369`, `:396`, `:1046`, `:1056`).
   - Starting a selected task calls both `loadTasks` and `refreshLatestRunLink` (`useAgentQueueController.ts:837`, `:838`).
   - Autorun snapshot refresh may also refresh run links for the active or selected task (`useAgentQueueController.ts:853`, `:870`).

4. Agent Executor history had an N+1 pattern for results and log counts.
   - `list_agent_executor_runs` lists widget runs, then for each candidate run calls `list_widget_results`, then `list_widget_logs` to count logs (`agent_executor_history.rs:51`, `:55`, `:65`).
   - This is bounded by a default limit of 20 and max of 100, but the loop can scan many non-executor runs before collecting the requested count.
   - Status: inspected and fixed on 2026-05-24. History now uses one grouped metadata-only log-count query for the returned Executor runs instead of reading full log rows for each returned run, and one batched latest-result query for compatible Direct Work / validation result types instead of one result read per scanned run. The batched result query still loads the existing result payload internally because current history DTO fields derive `duration_ms`, mode/repo fallbacks, and validation fields from the stored payload; it does not expose additional raw payloads or change DTO shape. A future metadata-only JSON field extraction query could reduce payload bytes if timings prove that necessary.

5. Agent Executor run detail read recent logs and then read all logs again for count.
   - Detail loads recent logs with `list_recent_widget_logs_for_run` and separately loads all logs with `list_widget_logs` for `log_count` (`agent_executor_history.rs:132`, `:137`).
   - For runs with many logs, the count path is the larger read.
   - Status: fixed on 2026-05-24. Detail now keeps the capped recent-log preview and gets `log_count` from a metadata-only count query instead of loading all logs.

6. SQLite indexes mostly exist, but a few ordering/query patterns are only partially covered.
   - Queue task ordering uses `workspace_id, priority, updated_at, created_at` index, while SQL additionally orders by `queue_item_id DESC` (`schema.rs:219`, `agent_queue_tasks.rs:59`).
   - Queue run links order by `started_at DESC, created_at DESC, link_id DESC`, while index is only `(workspace_id, queue_task_id, started_at)` (`schema.rs:257`, `agent_queue_task_run_links.rs:86`, `:109`).
   - Widget runs list by `widget_instance_id` and order by `started_at, id`, but only `widget_instance_id` is indexed (`schema.rs:201`, `widget_runs.rs:52`).
   - Run log reads by `run_id` and order by `created_at`, but only `run_id` is indexed (`schema.rs:248`, `widget_logs.rs:48`, `:60`).

7. Workbench state load is compact but bundled.
   - `workspace_workbench_state_from_store` loads widget instances, shared state objects, and up to 100 recent events every time it returns state (`workbenches.rs:36`, `:44`, `:51`, `:57`; `workspace_service.rs:172`).
   - This is acceptable for initial load, but widget layout/state mutations also return the whole state through the same path.

8. Recent Activity rendering itself is low risk.
   - Backend caps recent events at 100 (`workspace_service.rs:172`).
   - Frontend reverses a small event array on drawer render (`WorkbenchActivity.tsx:15`).
   - Recent Activity is only mounted when the drawer is open (`WorkbenchShell.tsx`), so closed drawer rendering should not consume widget body space.

## Evidence And Timings

No temporary production timing or test-only timing was added. Evidence is static code-path inspection plus the existing UI smoke behavior from the prior visual block.

Observed call-shape evidence:

- Initial Queue load path is at least two frontend/backend calls: list tasks, then get selected task detail.
- Several single-task mutations return an affected task but are followed by a full queue reload.
- Latest run and run history share one metadata request when the selected task changes, so they are not two automatic calls.
- Agent Executor history performs per-run result reads and per-run log-count reads.
- Agent Executor detail performs one recent-log read and one full log read for count.
- Store indexes cover the leading filters, but several `ORDER BY` suffixes are not fully covered.

Existing validation context from the visual block:

- `node scripts/hobit/smoke-queue-executor-ui.mjs` passed and asserts Queue run-link metadata is requested at least once.
- The smoke also confirms Queue does not display raw executor payload/log content in its body, so any refactor should preserve the current Queue/Executor data boundary.

## SQLite Query/Index Audit - 2026-05-24

Scope: static inspection of likely hot SQLite reads after the Queue mutation and
Agent Executor history/result batching refactors. No query plans or production
timings were captured in this block.

Inspected tables and current indexes:

- `agent_queue_tasks`: `idx_agent_queue_tasks_workspace_id`,
  `idx_agent_queue_tasks_workspace_ordering(workspace_id, priority, updated_at, created_at)`,
  and `idx_agent_queue_tasks_assigned_executor_widget_id`.
- `agent_queue_task_run_links`:
  `idx_agent_queue_task_run_links_task_started(workspace_id, queue_task_id, started_at)`
  and `idx_agent_queue_task_run_links_run_id(direct_work_run_id)`.
- `widget_runs`: `idx_widget_runs_widget_instance_id`.
- `widget_results`: `idx_widget_results_run_id`.
- `widget_logs`: `idx_widget_logs_widget_instance_id`,
  `idx_widget_logs_run_id`, and
  `idx_widget_logs_widget_instance_created_at(widget_instance_id, created_at)`.
- Workbench load/activity tables: `idx_widget_instances_workspace_id`,
  `idx_widget_instances_workbench_id`, `idx_workbench_events_workspace_id`,
  `idx_workbench_events_workspace_created_at(workspace_id, created_at)`,
  `idx_workspace_workbenches_workspace_id`, and
  `idx_shared_state_objects_workspace_id`.

Query/index match:

- Queue task list reads `WHERE workspace_id = ?` and orders by
  `priority DESC, updated_at DESC, created_at DESC, queue_item_id DESC`.
  The existing workspace ordering index covers the filter and the first three
  ordering columns. The final primary-key tie breaker is not part of the index,
  but task lists are Workspace-scoped and currently bounded by operator-created
  task volume.
- Queue task single-row reads, updates, deletes, and workspace access checks
  are primary-key or workspace-plus-primary-key lookups. Existing primary-key
  and workspace indexes are sufficient.
- Queue task run-link list/latest reads filter by `workspace_id` and
  `queue_task_id`, order by `started_at DESC, created_at DESC, link_id DESC`,
  and latest adds `LIMIT 1`. The existing task-started index covers the filter
  and leading ordering column, but not `created_at` or `link_id`. This is the
  narrowest future index candidate if one task accumulates many run links and
  latest/history reads become measurable.
- Queue run-link final-status updates filter by `workspace_id`,
  `queue_task_id`, and `direct_work_run_id`; direct run id is unique and indexed
  through `idx_agent_queue_task_run_links_run_id`, so the path is adequately
  covered.
- Agent Executor history now reads bounded newest-first run pages via
  `WHERE widget_instance_id = ? ORDER BY started_at DESC, id DESC LIMIT ? OFFSET ?`
  and batches compatible result reads with
  `WHERE run_id IN (...) AND result_type IN (...) ORDER BY run_id, created_at, id`.
  Existing run/result indexes cover the filters, but not all ordering suffixes.
  The previous unbounded all-runs list and in-memory reverse path was removed
  on 2026-05-24 without schema or DTO changes.
- Agent Executor detail reads one run by primary key, all results for that run,
  capped recent logs for that run, and a metadata-only log count scoped by
  run/widget. Existing `run_id` and `widget_instance_id` log indexes cover the
  filters. `ORDER BY created_at, id` and recent-log descending order are only
  partially covered, but detail is explicit and capped for log preview.
- Widget-local Logs panel reads `WHERE widget_instance_id = ? ORDER BY
  created_at DESC, id DESC LIMIT ?`; the existing
  `(widget_instance_id, created_at)` index covers the hot filter and leading
  ordering column.
- Recent Activity reads `WHERE workspace_id = ? ORDER BY created_at DESC,
  id DESC LIMIT ?`; the existing `(workspace_id, created_at)` index covers the
  hot filter and leading ordering column, and the result is capped at 100.
- Workspace/workbench state loading reads widgets, shared state, workbenches,
  and recent events by workspace/workbench. Existing indexes cover the leading
  scope filters; remaining ordering suffixes are low risk for current
  Workbench-sized data.

Risks found:

- No single index is justified from static inspection alone. All current hot
  reads have leading filter coverage, and several paths are capped or
  operator-scoped.
- The strongest future schema candidate is a covering Queue run-link ordering
  index such as `(workspace_id, queue_task_id, started_at, created_at, link_id)`
  if selected-task run history grows large enough to show sorting cost.
- The strongest future query-helper candidate was Agent Executor history. It
  now has a descending run-page helper, so no schema/index change is justified
  from static inspection alone.

Recommended next action:

- Do not add a schema index in this block. Keep behavior and schema unchanged.
- If performance remains visible after the completed Queue and Executor
  refactors, capture `EXPLAIN QUERY PLAN` or fixture-backed timings for Queue
  run-link latest/history and Agent Executor history before adding one narrow
  index or a metadata-only history result summary query.

## Ranked Refactor Opportunities

1. Stabilize Queue action/render props to stop unrelated shell re-renders from reloading the queue.
   - Impact: high for perceived slowness because shell interactions, Activity drawer state, global activity changes, and layout control changes should not reload task data.
   - Risk: moderate. Needs focused React tests proving Activity toggle or unrelated shell state does not call `listAgentQueueTasks`.
   - Shape: memoize `useWorkbenchWidgetActions` output and/or queue-specific render props, or make `useAgentQueueController` use stable refs for handler callbacks so the initial load effect is not tied to handler identity.

2. Replace full queue reloads after single-task mutations with local state reconciliation.
   - Status: partially addressed on 2026-05-23 for create, save/update, assign, and clear assignment.
   - Impact: high for Queue-heavy workflows.
   - Risk: moderate. Must preserve sorting, selected-task state, dirty protection, and edge cases when backend returns `None`.
   - Shape: after create/update/assign/clear, update `tasks` and `selectedTask` locally using the returned task, then reserve full reload for delete, manual Refresh, run start, Autorun snapshot reconciliation, and error reconciliation.

3. Add a bounded history request or list limit for Queue run links.
   - Impact: medium now, higher if one task accumulates many runs.
   - Risk: low to moderate but requires DTO/API compatibility care. Existing DTOs can remain compatible if a new optional limit is added carefully, but schema changes are not required.
   - Shape: keep current command names; consider optional limit in request DTO later, or add service/store helper that returns latest N for UI.

4. Optimize Agent Executor history with aggregate log counts and bounded run query.
   - Status: completed on 2026-05-24 for aggregate log counts, batched compatible result reads, and bounded newest-first run pages.
   - Impact: medium to high for executors with many runs/logs.
   - Risk: moderate backend refactor, but behavior can stay identical.
   - Shape: store helpers fetch widget runs in descending ordered pages and count logs per run with grouped SQL, instead of materializing all widget runs or reading per-run logs.
   - Remaining follow-up: consider metadata-only JSON field extraction for history result summaries only if timings show result payload bytes remain a bottleneck.

5. Optimize Agent Executor detail log count.
   - Status: completed on 2026-05-24.
   - Impact: medium for very chatty runs.
   - Risk: low.
   - Shape: add `count_widget_logs_for_run(run_id, widget_instance_id)` and use it instead of loading all logs just to count.

6. Review narrow covering indexes before schema changes.
   - Impact: medium only after data grows.
   - Risk: schema/index changes require explicit recommendation and migration consideration.
   - Candidate indexes:
     - `agent_queue_task_run_links(workspace_id, queue_task_id, started_at, created_at, link_id)`
     - `widget_runs(widget_instance_id, started_at, id)`
     - `widget_logs(run_id, created_at, id)`
   - Do not add these until query plans or timings show need.

7. Split workbench state refresh from Recent Activity if widget layout/state updates become slow.
   - Impact: currently low to medium because recent events are capped.
   - Risk: moderate because API shape changes could affect frontend state assumptions.
   - Shape: keep existing command compatible, but consider an internal service helper that can skip recent events for high-frequency layout/state saves if a future UI path does not need them.

## Recommended Next Single Fix

Add a focused frontend regression test around the Queue widget proving an unrelated shell re-render does not call `listAgentQueueTasks` again, then implement the smallest stabilization needed to make that pass.

Suggested target:

- Test setup: render `WorkbenchShell` or a focused `WidgetHost`/Queue harness with counted `listAgentQueueTasks` and `getAgentQueueTask` callbacks.
- Action: toggle the global Activity drawer or update a shell-only state.
- Expected: no additional Queue task list/detail calls after initial Queue load.

This is the best next block because it directly targets the most likely user-visible duplicate request introduced by moving Activity into the shell, while avoiding backend, schema, DTO, Queue Autorun, Queue-to-Executor, Agent Executor, Direct Work, Git, JDBC, Terminal, Coordinator, and Notes behavior changes.

## Follow-Up Status

- 2026-05-23: Completed the recommended frontend-only regression block. `WorkbenchShell.test.tsx` now mounts Agent Queue with mocked Workspace API reads and proves Activity drawer open/close does not call `listAgentQueueTasks` or `getAgentQueueTask` beyond the initial load. Queue task actions are memoized across unchanged `viewState` renders in `useWorkbenchWidgetActions`, preserving manual Refresh and existing mutation-triggered reload behavior.
- 2026-05-23: Partially completed the Queue mutation reload block. `useAgentQueueController` now reconciles returned task summaries locally for create, save/update, assign, and clear assignment while preserving backend-equivalent task ordering and selected-task draft state. Manual Refresh, delete, manual run start, Sequential Queue Runner run start, Executor-driven task auto-refresh, and Autorun active-task refresh still perform full task reloads because those paths either need deletion/next-selection reconciliation or do not return an updated `AgentQueueTask` summary.
- 2026-05-24: Inspected Agent Executor history/detail query overhead. Added SQLite metadata-only log-count helpers, switched run detail from capped recent logs plus full log read to capped recent logs plus count query, and switched history from per-run full log reads to one grouped count query for returned runs. Behavior and DTO shape are unchanged: detail still returns the same result payload fields, recent log preview remains capped, history keeps safe summary fields, and Queue run-link visibility remains metadata-only.
- 2026-05-24: Completed the remaining Agent Executor history result-read inspection. Added a SQLite helper to fetch the latest compatible result per run id in batched `IN` queries, then mapped those results in `list_agent_executor_runs`. History ordering, missing-result handling, result-type filtering, summary fields, log counts, and DTO shape remain unchanged. Raw result payload remains exposed only through Executor-owned detail reads; history still parses existing payload internally only to preserve current visible summary fields.
- 2026-05-24: Completed the SQLite query/index audit after the Queue and Executor performance refactors. The audit found leading-index coverage on the likely hot reads and did not find enough evidence for a behavior-free schema/index change in this block. Recommended follow-up is query-plan or fixture timing evidence before adding one narrow Queue run-link ordering index or metadata-only Agent Executor history result summary query.
- 2026-05-24: Completed the Agent Executor history run-page helper block. Added a bounded newest-first SQLite run-page helper ordered by `started_at DESC, id DESC`, then updated history scanning to advance through run pages until the requested compatible summaries are filled or no runs remain. History still uses the existing batched latest compatible result lookup and grouped log counts. Behavior, DTO shape, raw-payload ownership, Direct Work execution, Queue execution, and schema remain unchanged.
