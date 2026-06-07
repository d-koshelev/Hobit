# Queue Widget v2 Product Contract

## 1. Product goal

Queue Widget v2 is the operator console for many incoming Workspace tasks and
parallel independent execution.

It helps the operator answer five questions quickly:

- What work has arrived?
- What can run now?
- What is already running?
- What needs review or approval?
- What is blocked, dependent, or finished?

Queue v2 remains a Workbench widget and a Workspace-level task surface. It is
not a scheduler, hidden automation layer, Git automation layer, Terminal
launcher, chat surface, or Agent Executor replacement.

The product posture is operational: the board is the primary view, task details
open in a secondary popup or drawer, and raw execution detail stays collapsed
until the operator asks for it.

## 2. Layout model

Queue v2 uses one continuous widget surface with five zones:

- Top command bar: global queue actions, capacity summary, arming state, and
  compact create/import controls.
- Main Queue Board / Flow Map: the primary lane-based task operating surface.
- Left filters/workers/capacity rail: filtering, worker availability, and
  capacity pressure without taking over the board.
- Task details popup/drawer: details and one primary next action for the
  selected task. This is not a permanent right inspector.
- Bottom collapsible activity/history stream: high-level activity and history
  by default, with lower-level detail hidden until requested.

The board must remain usable when the left rail, task details surface, or
bottom stream are closed. The operator should never need the bottom stream to
understand the next product action.

## 3. Task lifecycle lanes

Queue v2 uses these required board lanes:

- Intake / Draft: new, imported, or proposed tasks that are not ready to run.
- Ready: tasks with enough information and no unsatisfied dependencies.
- Running: tasks currently assigned to an active worker/provider run.
- Review: tasks with report output, validation result, or proposed completion
  that needs operator review.
- Blocked: tasks waiting on dependencies, missing inputs, capacity, failed
  prerequisites, or operator decisions.
- Closed: accepted, cancelled, archived, or intentionally abandoned tasks.

Lane placement is the visible lifecycle truth. Avoid duplicating the same state
as large repeated text inside the card. Use compact chips only when they add
information not already obvious from the lane.

`Review` is not final acceptance. A report-ready task remains review-required
until the operator explicitly accepts, rejects, reopens, or closes it.

## 4. Parallel execution visualization

Queue v2 must make parallelism visible without implying hidden scheduling.

The UI shows independent ready tasks as separate cards in `Ready`, with a clear
eligible-to-run indicator when all of these are true:

- required inputs are present;
- dependencies are satisfied;
- task policy allows execution;
- a compatible worker/provider slot is available or can be explicitly chosen;
- Autorun, if used, is explicitly armed.

Worker capacity is shown in the left rail and summarized in the top command
bar. The summary should distinguish:

- total configured workers/providers;
- available capacity;
- running tasks;
- blocked or unavailable workers;
- tasks eligible to run now.

Current parallel running tasks appear in `Running` as separate cards with their
worker/provider identity and elapsed status. The board must not collapse
multiple active runs into a single generic spinner.

Dependent tasks that cannot run stay in `Blocked` or remain visually attached
to their dependency chain in the Flow Map. They show the dependency or blocker
summary, not a misleading run action.

Completed or finalized tasks move to `Closed`. Tasks with output awaiting
operator decision move to `Review`, even when execution succeeded.

Autorun may highlight the next eligible tasks it would start while armed, but
it must not obscure that the operator armed it and can stop it.

## 5. Task card contract

Task cards are compact, uniform, and optimized for scan density.

Each card shows:

- title;
- lifecycle state when needed beyond the lane;
- next action;
- dependency or blocker summary when applicable;
- worker/provider when running;
- Knowledge/attachments count when present;
- compact chips only.

Cards should not show raw prompts, full reports, full logs, complete
dependency lists, large timestamps, duplicate state labels, or developer
payloads. Those details belong in the task details popup/drawer or Developer
tab.

The next action label must be concrete, such as `Review report`, `Run now`,
`Assign worker`, `Resolve blocker`, `Add missing input`, `Accept result`, or
`Close task`.

Cards should use consistent height bands where possible. Long titles truncate
or wrap within the card's reserved title area without resizing neighboring
cards unpredictably.

## 6. Task details popup/drawer contract

The task details popup/drawer is the task decision surface. It opens from a
card or explicit details action instead of occupying a permanent right rail.
Its default width should be around 55-65 percent of the Queue widget. If the
shared popup shell supports movement and resizing, Queue details should use
that shared behavior.

It shows:

- selected task title and concise objective;
- current lane/status and priority;
- one primary next action;
- secondary safe actions where needed;
- dependency and blocker explanation;
- assignment/worker details;
- run/report summary;
- Knowledge, attachment, and source-reference summary;
- review decision controls when report output exists;
- links to raw detail in the Developer tab or bottom stream.

There must be one primary next action per selected task. Secondary actions must
not compete visually with the primary action and should be grouped under More.

Required detail tabs are Overview, Prompt, Result, Agent Log, Context, Files /
Validation, and Developer. Agent Log is high-level and readable by default; raw
logs, bounded stdout/stderr previews, raw event previews, IDs, payload
metadata, and diagnostic detail belong in Developer.

Report-ready output can be reviewed, accepted, rejected, reopened, or closed
only through explicit operator controls. Acceptance must be distinct from run
success.

Destructive or externally mutating follow-up actions must remain explicit,
visible, confirmation-aware, and outside the normal card click path.

## 7. Left rail contract

The left rail is for scope and capacity, not task detail.

It may show:

- lane/status filters;
- priority filters;
- source filters;
- assigned worker/provider filters;
- dependency/blocker filters;
- ready-now count;
- review-required count;
- worker/provider capacity;
- running count and available slots;
- Autorun armed/off state.

The rail should use compact controls and counts. It must not duplicate the
task details popup/drawer, render full task cards, or expose raw execution
logs.

Capacity indicators are descriptive unless the operator explicitly starts a
manual run or arms Autorun.

## 8. Activity/history stream contract

The bottom activity/history stream is collapsed by default.

It shows high-level recent activity and history by default. When expanded or
when linked from the Developer tab, it may contain lower-level detail such as:

- task lifecycle events;
- run links and executor history;
- worker/provider messages;
- validation excerpts;
- raw error previews;
- bounded stdout/stderr or structured event previews when available;
- developer/debug metadata.

The stream is for diagnosis and audit, not ordinary operation. The board and
task details popup/drawer must remain sufficient for normal queue management.

Stream content must be bounded, clearly labeled, and safe to collapse without
losing the operator's place in the board.

## 9. Color/copy rules

Queue v2 uses restrained visual language.

Rules:

- Board first.
- Task details popup/drawer second.
- Activity/logs hidden by default.
- One primary next action per selected task.
- No duplicate state text.
- Strong color only for blocker/action/status priority.
- Cards are compact and uniform.
- Raw/developer details stay behind drawer or popup.
- Report ready is not final acceptance.

Copy should describe concrete operator decisions. Prefer action labels such as
`Run now`, `Assign worker`, `Review report`, `Accept result`, and `Resolve
blocker`.

Avoid copy that implies hidden automation, such as `handled automatically`,
`finished and accepted`, `auto-commit`, `auto-push`, or `background finalized`.

## 10. Safety boundaries

Queue v2 must preserve existing operator-control boundaries.

- Manual run remains explicit.
- Autorun must be explicitly armed.
- No hidden auto-run.
- No auto-commit.
- No auto-push.
- No auto-finalize.
- No hidden destructive actions.
- No silent dependency execution.
- No Terminal launch from Queue without an explicit future contract.
- No Git mutation from Queue.
- No provider/tool execution hidden behind card movement.
- No acceptance based only on successful execution.

Queue v2 may organize, visualize, and prepare work. Execution, review,
acceptance, commits, pushes, and destructive actions require visible operator
intent and the relevant owning surface or contract.

## 11. Non-goals

This contract does not implement or require:

- frontend code changes;
- backend or Rust changes;
- storage or schema changes;
- a new scheduler;
- durable background worker behavior;
- automatic dependency execution;
- automatic worker assignment;
- automatic report acceptance;
- response parsing or validation engines;
- Git commit or push behavior;
- Terminal execution;
- Workspace Agent hidden context access;
- Agent Executor runtime changes;
- Runbook engine integration;
- new widget insertion behavior.

## 12. Implementation blocks

Queue v2 should be implemented only through focused future blocks.

Recommended block sequence:

1. Product shell and board layout: introduce the five-zone visual structure
   over existing Queue data without changing runtime behavior.
2. Lane mapping and compact cards: map current task statuses into the required
   lanes and define uniform card content.
3. Task details popup/drawer: move task decisions into the secondary details
   surface with one primary next action.
4. Capacity rail: expose worker/provider capacity and ready-now counts without
   adding scheduling behavior.
5. Dependency visualization: show blocked/dependent tasks and dependency
   summaries after dependency data exists.
6. Review lane hardening: distinguish report-ready from accepted/closed work.
7. Activity drawer: move raw run history and developer details behind the
   collapsed drawer.
8. Autorun visualization: show explicit armed/off state and eligible tasks
   without changing safety boundaries.

Each block must state whether it is docs-only, frontend-only, API/storage,
runtime, or validation work. Runtime, schema, scheduler, dependency execution,
or Git behavior changes require separate explicit contracts before
implementation.
