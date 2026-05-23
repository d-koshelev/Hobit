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

4. Agent Executor history has an N+1 pattern for results and log counts.
   - `list_agent_executor_runs` lists widget runs, then for each candidate run calls `list_widget_results`, then `list_widget_logs` to count logs (`agent_executor_history.rs:51`, `:55`, `:65`).
   - This is bounded by a default limit of 20 and max of 100, but the loop can scan many non-executor runs before collecting the requested count.

5. Agent Executor run detail reads recent logs and then reads all logs again for count.
   - Detail loads recent logs with `list_recent_widget_logs_for_run` and separately loads all logs with `list_widget_logs` for `log_count` (`agent_executor_history.rs:132`, `:137`).
   - For runs with many logs, the count path is the larger read.

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

## Ranked Refactor Opportunities

1. Stabilize Queue action/render props to stop unrelated shell re-renders from reloading the queue.
   - Impact: high for perceived slowness because shell interactions, Activity drawer state, global activity changes, and layout control changes should not reload task data.
   - Risk: moderate. Needs focused React tests proving Activity toggle or unrelated shell state does not call `listAgentQueueTasks`.
   - Shape: memoize `useWorkbenchWidgetActions` output and/or queue-specific render props, or make `useAgentQueueController` use stable refs for handler callbacks so the initial load effect is not tied to handler identity.

2. Replace full queue reloads after single-task mutations with local state reconciliation.
   - Impact: high for Queue-heavy workflows.
   - Risk: moderate. Must preserve sorting, selected-task state, dirty protection, and edge cases when backend returns `None`.
   - Shape: after create/update/assign/clear/start, update `tasks` and `selectedTask` locally using the returned task, then reserve full reload for delete, manual Refresh, and error reconciliation.

3. Add a bounded history request or list limit for Queue run links.
   - Impact: medium now, higher if one task accumulates many runs.
   - Risk: low to moderate but requires DTO/API compatibility care. Existing DTOs can remain compatible if a new optional limit is added carefully, but schema changes are not required.
   - Shape: keep current command names; consider optional limit in request DTO later, or add service/store helper that returns latest N for UI.

4. Optimize Agent Executor history with aggregate log counts and bounded run query.
   - Impact: medium to high for executors with many runs/logs.
   - Risk: moderate backend refactor, but behavior can stay identical.
   - Shape: add store helpers that fetch recent widget runs in descending order with limit and count logs per run with grouped SQL, instead of per-run `list_widget_logs`.

5. Optimize Agent Executor detail log count.
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

