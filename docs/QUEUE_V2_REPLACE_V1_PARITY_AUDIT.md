# Queue V2 Replace V1 Parity Audit

## Status

Inspect-only docs audit for `QUEUE-V2-V1-PARITY-AUDIT-01`.

QueueV2 is not yet action-parity with the current Agent Queue V1 product
surface. The current saved-widget-compatible Agent Queue implementation is
`AgentQueuePlaceholderWidget`, which owns the `WidgetFrame`, Refresh/New task
actions, create dialog, controller wiring, V1 Flow Map/details path, and an
embedded QueueV2 board toggle.

The standalone Widget V2 `QueueV2Widget` is explicitly scaffold/read-only:
its status copy says it is experimental, not catalog-available, and has no
task mutation or execution actions wired. The QueueV2 board and details popup
render useful task status, lanes, context counts, result facts, activity, and
developer tabs, but popup next-action buttons are disabled and do not call
Queue controller actions.

## Targeted Files Inspected

- `apps/desktop/frontend/src/workbench/AgentQueuePlaceholderWidget.tsx`
- `apps/desktop/frontend/src/workbench/AgentQueueTaskDetailsPanel.tsx`
- `apps/desktop/frontend/src/workbench/queue/details/AgentQueueTaskActionSurface.tsx`
- `apps/desktop/frontend/src/workbench/queue/details/AgentQueueTaskResultEvidenceSection.tsx`
- `apps/desktop/frontend/src/workbench/queue/details/AgentQueueTaskContextSection.tsx`
- `apps/desktop/frontend/src/workbench/queue/details/AgentQueueTaskActivityTimelineSection.tsx`
- `apps/desktop/frontend/src/workbench/queue/details/AgentQueueTaskDeveloperDetailsSection.tsx`
- `apps/desktop/frontend/src/workbench/widgetV2/queueV2/QueueV2Widget.tsx`
- `apps/desktop/frontend/src/workbench/widgetV2/queueV2/QueueV2TopBar.tsx`
- `apps/desktop/frontend/src/workbench/widgetV2/queueV2/QueueV2Board.tsx`
- `apps/desktop/frontend/src/workbench/widgetV2/queueV2/QueueV2TaskCard.tsx`
- `apps/desktop/frontend/src/workbench/widgetV2/queueV2/QueueV2TaskDetailsPopup.tsx`
- `apps/desktop/frontend/src/workbench/queue/useAgentQueueController.ts`
- `apps/desktop/frontend/src/workbench/queue/useAgentQueueTaskActions.ts`
- `apps/desktop/frontend/src/workbench/queue/useAgentQueueRunActions.ts`
- `apps/desktop/frontend/src/workbench/queue/useAgentQueuePlanningActions.ts`
- `apps/desktop/frontend/src/workbench/queue/useAgentQueueReportActionCards.ts`
- `apps/desktop/frontend/src/workbench/queue/agentQueueReportActionCardModel.ts`
- `apps/desktop/frontend/src/workbench/AgentQueuePlaceholderWidget.test.tsx`
- `apps/desktop/frontend/src/workbench/widgetV2/queueV2/QueueV2Widget.test.tsx`
- `apps/desktop/frontend/src/workbench/widgetV2/queueV2/QueueV2Board.test.tsx`
- `apps/desktop/frontend/src/workbench/queue/queueV2ViewModel.test.ts`
- `apps/desktop/frontend/src/workbench/queue/useAgentQueueController.taskActions.test.tsx`
- `apps/desktop/frontend/src/workbench/queue/useAgentQueueController.planningReports.test.tsx`

## Parity Matrix

| V1 action / feature | V1 source | QueueV2 current support | QueueV2 gap / action to wire before replacement |
| --- | --- | --- | --- |
| Refresh | `AgentQueuePlaceholderWidget` frame action calls `refreshTasks`; controller blocks refresh with dirty edits. | Missing in standalone `QueueV2Widget`; embedded V2 board only inherits V1 frame Refresh. | Keep saved-widget frame action or add QueueV2 command-bar Refresh wired to `queue.refreshTasks` with dirty-edit guard. |
| New task | V1 frame New task opens `AgentQueueNewTaskDialog`; creates draft or queued task without starting work. | Missing in standalone QueueV2; embedded V2 board inherits V1 frame New task. | Preserve dialog or equivalent QueueV2 create flow wired to `createTask`, including run setup fields, draft/queued modes, insert position, and no auto-run. |
| Selection | V1 Flow Map and embedded V2 board call `selectTask`, which fetches task detail and blocks unsaved selection changes. | Board cards select visually and call optional `onSelectedTaskChange`; popup opens detail. Standalone V2 has local selection only, no detail fetch. | QueueV2 replacement must call controller `selectTask` and honor dirty-edit guard. Avoid local-only selected task state as source of truth. |
| Run selected task | V1 details action surface uses `AgentQueueTaskRunPanel` and `queue.run.onStartAssignedTask`; handles assignment, run settings, readiness, run links, and no hidden start. | Missing. QueueV2 next-action button can label `Run now` but is disabled by design. | Wire explicit run action through controller run panel/actions, including executor selection, assignment, settings, readiness/preconditions, handoff, and run-link refresh. |
| Review report | V1 result/developer sections build worker/diff review report action cards, show report evidence, and can show card in Workspace Chat. | Partial display only. QueueV2 result tab shows latest report summary, changed-file count, validation, and raw preview in Developer. | Add explicit review report action surface for report cards and Workspace Chat handoff, preserving no execution/finalization side effects. |
| Accept without commit | V1 controller supports `coordinatorFinalization.onAcceptWithoutCommit`; tests verify no commit/runtime start. | Missing. QueueV2 next-action label can be `Accept`, but no handler exists. | Wire only for valid no-change/report-ready state through controller finalization; keep no Git commit, no auto-run. |
| Finalize / accept | V1 controller supports mark ready and finalize; changed-file reports can remain `commit_required` instead of auto-finalizing. | Missing. QueueV2 can derive `accept_result` but button is disabled. | Wire explicit finalization actions and preserve commit-required gating. Do not auto-finalize report-ready tasks. |
| Request changes | V1 controller supports needs-changes, rollback-required, blocked, failed/rejected model decisions. | Missing. QueueV2 view model can derive `request_changes`; no mutation action. | Wire explicit coordinator decision actions to existing controller methods and keep them model-only. |
| Create follow-up | V1 controller creates queued follow-up item from selected task and leaves source unfinalized. | Missing. QueueV2 next-action label can be `Follow-up`; no handler. | Wire follow-up creation through existing controller finalization action, preserving queued/manual/no auto-run behavior. |
| Attach report | V1 result/developer sections can attach demo/structured worker report evidence through `workerReport.onAttachDemoReport`; no finalization/start. | Missing. QueueV2 displays latest report if already present. | Decide whether replacement must keep current attach-report dev/demo action. If yes, expose it in QueueV2 Developer/Result actions and keep it explicit. |
| Developer details | V1 developer popup includes diff-review linkage, worker report panel, advanced run details, raw run activity, submitted metadata, and task edit metadata. | Partial. QueueV2 Developer tab shows task id, workspace id, latest report id, compatible workers, raw report preview. | Preserve advanced run/autorun/run-history/diff-review/linkage/task-edit metadata or keep V1 developer components internally and mount them from QueueV2 details. |
| Context / Knowledge display | V1 context section shows prompt, attached Knowledge/Skill refs, detach buttons, snapshots, warnings, materialized prompt preview, token budget. Result evidence shows context used. | Partial. QueueV2 Context tab shows counts, warning count/list, token budget/status. Prompt tab only says materialized prompt preview is placeholder-only. | Add ref lists, detach actions, snapshots, materialized context preview, context-used evidence, and preserve Knowledge draft accept/reject review from report output. |
| Activity / run details | V1 activity section shows current event, recent events, refresh status, run result refresh, run evidence, advanced run details, and raw capped events. | Partial. QueueV2 Agent Log tab shows high-level synthetic events from task/report. Activity stream is compact. | Wire `queue.latestRun.onRefresh`, run activity snapshots, run evidence refresh, open Executor run, attach visible run context, and advanced run history/details. |
| Tag / capacity / worker display | V1 sidebar/foundation surfaces show autonomous state, queue tags, workers, capacity, global execution state, paused tags, and Flow Map routing. | Mostly supported visually. QueueV2 top bar/left rail/board show counts, capacity, workers, tag legend, paused/running groups. | Keep visual display. Wire tag/capacity management actions only where V1 product actions must remain; avoid adding hidden scheduler behavior. |

## QueueV2 Supported Today

- Board lanes for Intake, Ready, Running, Review, Blocked, and collapsed Closed.
- Compact task cards with tag color, title, lifecycle/status, next action label,
  worker/running progress, selection, and Details popup entry.
- View model mapping for statuses, closure states, review-needed tasks,
  blocked reasons, next action labels, counts, capacity, and inspector
  snapshots.
- Top-bar display for queue mode, Ready/Running/Review/Blocked counts, and
  available/total capacity.
- Left-rail display for tag legend, worker/capacity summaries, and compact
  planning/worker data.
- Details popup tabs for Overview, Prompt, Result, Agent Log, Context,
  Files / Validation, and Developer.
- Read-only safety posture: popup primary action is disabled, and tests assert
  no run/start/finalize controls are exposed in standalone QueueV2.

## QueueV2 Missing / Actions To Wire

- Replace standalone experimental copy with normal Agent Queue copy only after
  it is rendered through the existing saved-widget-compatible Agent Queue path.
- Pass the real `AgentQueueController` into QueueV2 replacement components
  instead of using local-only selection and read-only props.
- Wire command-bar actions for Refresh and New task.
- Wire selected-task action popup/drawer controls to existing controller
  actions for edit/save/delete, promote draft, assignment, run selected task,
  autorun status/arm/stop where already supported, report review, finalization,
  request changes, follow-up, diff review, attach report, context detach, run
  evidence refresh, and open Executor run.
- Preserve Knowledge / Skills context attach/detach/materialization display and
  Knowledge draft review acceptance from worker report output.
- Preserve run-link history and activity refresh surfaces; QueueV2 must not
  reduce selected-task Executor visibility to synthetic task events only.
- Remove the Board v2 / Flow Map product toggle only after the replacement path
  carries the V1 action surface.

## Tests To Update

- `AgentQueuePlaceholderWidget.test.tsx`
  - Replace assertions that Board v2 is behind a view toggle and Flow Map keeps
    run controls available.
  - Add/adjust saved-widget-compatible Agent Queue render assertions so the
    existing Agent Queue id/component renders QueueV2 directly.
  - Move New task dialog, Refresh, selection, run selected task, Knowledge draft
    acceptance, and no-auto-run assertions onto the QueueV2 replacement path.
- `QueueV2Widget.test.tsx`
  - Retire or rewrite tests that assert experimental/read-only copy, no run
    actions, and no replacement behavior.
  - Keep pure display tests for top-bar counts, workers, tag legend, compact
    activity, and no hidden scheduler controls.
- `QueueV2Board.test.tsx`
  - Change disabled primary-action assertions after action wiring.
  - Add controller-callback tests for selection, Details action buttons, review
    actions, context display/removal, and explicit run wiring.
  - Keep tests for lanes, closed collapse, report-ready vs finalized lanes, and
    no raw prompt text on compact cards.
- `queueV2ViewModel.test.ts`
  - Keep as model coverage; add cases only if finalization/action wiring needs
    new derived action states.
- `useAgentQueueController.taskActions.test.tsx`
  - Keep as controller contract coverage for create/save/delete/refresh/context
    attach/detach/run request behavior; QueueV2 UI tests should call these via
    controller instead of duplicating internals.
- `useAgentQueueController.planningReports.test.tsx`
  - Keep as controller contract coverage for attach report, diff review,
    finalization, commit-required, accept without commit, needs changes, and
    follow-up. QueueV2 replacement tests should verify these actions are
    reachable from the new surface.

## V1 Visual Components: Delete vs Keep

Safe to delete or deproductize after QueueV2 action parity is proven:

- Board v2 / Flow Map toggle in `AgentQueuePlaceholderWidget`.
- Normal product rendering of `AgentQueueFlowMap`.
- `AgentQueueLayout` split rail behavior for normal Agent Queue operation.
- V1 dense sidebar/right-rail normal layout once QueueV2 has equivalent
  command, worker/tag/capacity, details, and action paths.
- Flow-map rail resize tests once the Flow Map is no longer a normal product
  path.

Keep as internal compatibility or reusable action/detail components until
QueueV2 owns equivalent behavior:

- `AgentQueuePlaceholderWidget` identity/render bridge, or a compatibility
  wrapper with the same Agent Queue definition/component key for saved layouts.
- `AgentQueueNewTaskDialog` unless QueueV2 implements an equivalent create
  dialog.
- `AgentQueueTaskRunPanel` and `AgentQueueTaskRunAdvancedDetails` until
  QueueV2 has full run/assignment/run-history UI parity.
- `AgentQueueTaskResultEvidenceSection` behavior or reusable subcomponents for
  report evidence, Knowledge draft review, result refresh, and Workspace Chat
  report handoff.
- `AgentQueueTaskContextSection` behavior or reusable subcomponents for
  attached refs, snapshots, detach, warnings, and materialized context preview.
- `AgentQueueTaskDeveloperDetailsSection` behavior or reusable subcomponents
  for advanced run details, raw capped events, diff-review linkage, worker
  report action controls, and task edit metadata.
- Controller hooks and action modules under `workbench/queue/`; these are not
  V1 visuals and should remain the behavior boundary for QueueV2.

## Replacement Risks

- Saved workspace compatibility risk if the existing Agent Queue definition id
  or component key is renamed instead of routing the current identity to
  QueueV2.
- Action regression risk because QueueV2 currently renders disabled next
  actions and does not call controller mutations.
- Runtime safety risk if replacement reimplements run/finalization logic
  instead of using existing explicit controller actions and guards.
- Knowledge context regression risk because QueueV2 only shows summary counts
  and warning/token facts, not full refs, detach, snapshots, materialized
  preview, or draft review acceptance.
- Executor observability regression risk because QueueV2 Agent Log is currently
  synthetic/high-level and lacks selected-task run-link/evidence refresh and
  advanced run details.
- Product cleanup risk if Flow Map/V1 components are deleted before QueueV2 can
  perform Refresh, New task, run selected task, report review/finalization,
  context, activity, and developer detail workflows.

## Intentionally Not Implemented

- No source code changes.
- No tests changed.
- No backend, runtime, storage, schema, Queue API, Git, Terminal, Knowledge, or
  Agent Executor behavior changed.
- No QueueV2 replacement render-path change.
- No auto-run, auto-commit, auto-push, or auto-finalize behavior.

