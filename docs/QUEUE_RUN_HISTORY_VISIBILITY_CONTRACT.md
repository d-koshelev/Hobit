# Queue Run History Visibility Contract

## Purpose

This contract defines how Agent Queue should show run-history visibility for
Queue tasks after manual runs, Sequential Queue Runner runs, or Queue Autorun
runs.

It began as a docs/product contract. Hobit now has the first minimal
backend/storage foundation for durable Queue task to Agent Executor run
linkage, plus narrow safe DTO/API visibility for the selected task latest run
and compact recent run-history rows. It still does not add a full frontend
run-history browser, Queue-owned raw run detail display, scheduler behavior,
retries, server runtime, RBAC, or Agent Executor ownership changes.

## Product Need

After Queue Autorun runs several tasks while Hobit is open, the operator needs
a morning review surface:

- which Queue tasks ran;
- which Agent Executor run belongs to each task;
- whether the run finished, failed, cancelled, or needs review;
- where to open the Executor-owned run details.

Queue must make this discoverable without becoming a raw log or result viewer.

## Ownership Rule

Agent Executor owns execution detail.

Agent Queue owns task lifecycle and run references.

ArtifactRef later owns metadata-only references across records.

The Queue task may point to an Executor run, but raw execution content remains
inside Executor-owned run/log/result artifacts.

## Per-Task Queue Visibility

For each Queue task with run history, Queue should show safe metadata:

- latest Executor run id or compact run ref;
- assigned Executor widget id or compact Executor label;
- run status;
- started time when available;
- completed time when available;
- duration when available;
- validation status when available;
- result/review state such as `review needed`, `failed`, `cancelled`,
  `completed`, or `validation failed`;
- link or frontend action to open the owning Agent Executor run detail;
- optional count of historical runs for that task when retry/history exists.

The default Queue list should stay compact. Detailed run-history rows can live
behind task details, a small "Run history" section, or an explicit expand
control.

## Queue Must Not Show

Queue run-history visibility must not copy or render:

- raw stdout;
- raw stderr;
- full final response;
- raw prompts;
- raw diffs, patches, or file contents;
- full widget logs;
- raw result payload JSON;
- raw command payload JSON;
- secrets, tokens, credentials, local path dumps, or unredacted provider text;
- large logs or large result bodies.

Queue may show short safe labels and statuses, but the operator must open the
Agent Executor run detail to inspect raw or full result material.

## Review Needed Semantics

`review needed` in Queue is a routing signal, not acceptance state.

A task should be considered review-needed when any of these apply:

- the Executor run completed and produced output that has not been accepted by
  the operator;
- the Executor run failed, timed out, was cancelled, or was force-killed;
- validation failed, timed out, or has not been run when expected;
- Git changes exist and require explicit Agent Executor or Git review;
- the final status is unknown or ambiguous.

A successful run must not imply acceptance, Git commit, push, Notes mutation,
or Queue task approval.

## Current Implementation Gap

Already available today:

- Queue task rows persist title, description, prompt, status, priority,
  execution policy, assignment, and timestamps.
- Starting an assigned Queue task returns the Agent Executor `run_id`.
- Queue start creates a normal Agent Executor Direct Work run owned by the
  assigned `agent-run` widget.
- Queue status can move to `running` and later to `completed`, `failed`, or
  `cancelled` from Direct Work final status.
- Agent Executor history APIs can list run summaries and read run details for
  a specific Executor widget instance.
- Agent Executor run summaries include run id, status, started/finished time,
  duration, result type, validation profile/status, and result availability.
- Agent Executor run details can include raw/full result fields; those are not
  safe for Queue display.

Still missing for full durable Queue run-history visibility:

- full historical run-list UI for a Queue task;
- deep-link selection of a specific Executor-owned run detail;
- validation association policy beyond what Agent Executor history already
  exposes per run;
- ArtifactRef-backed metadata references for later cross-surface linking.

Current-session handoff and Autorun state are not enough for morning review
after reload or app restart.

Implemented foundation:

- persisted Queue task to Executor run linkage in a separate run-link record;
- more than one run-link row can exist for one Queue task, preserving retry and
  rerun history;
- manual assigned-task starts record `manual` run-link source metadata;
- desktop Queue Autorun starts and final-status observation record/update
  `autorun` run-link metadata;
- final status updates store safe status/timestamp/review metadata only.
- a desktop Tauri command exposes the latest run-link summary for one Queue
  task using safe metadata only;
- a desktop Tauri command exposes safe recent run-link summaries for one Queue
  task using the same metadata-only DTO;
- the frontend Workspace API exposes that latest-link summary and the selected
  Queue task detail renders a compact Latest run section with status, source,
  Executor ref, timestamps, review status, refresh, and Open Executor scroll;
- the selected Queue task detail renders a compact Run history section showing
  the latest three safe run links plus a total count when available.

Queue still does not own raw Executor run details. Agent Executor remains the
owner for logs, results, final responses, validation detail, diffs, and
artifacts.

## Minimal DTO / Store Support

The first implementation adds the smallest durable linkage needed for safe
review. Current record shape:

```text
link_id
workspace_id
queue_task_id
executor_widget_instance_id
direct_work_run_id
source
status
started_at
completed_at
validation_status
review_status
created_at
updated_at
```

The run-link is a separate table, not latest-run fields on the Queue task row.
Latest-run visibility can be derived by querying the newest link for a task.
The current APIs expose the derived latest link and recent safe run-link rows
for one selected task. They do not expose raw Executor run detail and do not
provide a full history browser.

Do not store raw prompt, stdout, stderr, final response, diffs, logs, or result
payload in Queue linkage records.

## ArtifactRef Direction

When ArtifactRef resolution is implemented, Queue should reference runtime
artifacts through metadata refs such as:

- Queue task owner ref;
- Executor widget run ref;
- Executor widget result ref;
- validation run ref;
- future Git diff/status artifact refs.

ArtifactRef membership or ownership must not make raw content AI-readable,
evidence, or safe to share. Queue-facing refs should default to safe metadata,
local/workspace visibility, and explicit non-eligibility for AI context unless
a later evidence/context approval flow changes that.

## UI Direction

The selected Queue task detail now shows a compact latest-run signal and a
small recent run-history list. The Queue task list may later show a compact
latest-run signal:

```text
Run wrun_... - completed - Review
```

The selected task detail may show:

- Latest run: status, Executor, started/completed, validation status;
- Open in Agent Executor;
- Run history count and compact recent rows when available;
- warning when a task is final but no durable run ref exists.

The current open action scrolls to the owning Agent Executor widget when it is
visible. It does not fetch or render raw Executor payload inside Queue.

## Recommended Implementation Slices

1. Docs accepted: keep this contract as the gate for run-history visibility.
2. Minimal backend/storage design: implemented as a separate run-link row with
   no raw payload duplication.
3. DTO/API slice: implemented for the selected task latest run-link summary
   without raw prompts/logs/results.
4. Frontend Queue visibility slice: implemented as selected-task latest run
   status/source/timestamp metadata and a frontend-only Open Executor scroll
   action.
5. Compact history slice: implemented as selected-task recent run-link rows
   capped to a small list/count without rendering raw Executor payloads.
6. Smoke/test slice: cover manual run, Sequential Queue Runner, Autorun,
   failed/cancelled run, and no durable run ref states.
7. ArtifactRef slice later: replace or augment string refs with metadata
   ArtifactRefs after resolver and ownership rules are implemented.

## Non-Goals

Current implementation still does not implement:

- full run-history browser;
- Queue-owned raw run detail storage or rendering;
- Queue task row latest-run fields;
- Queue runtime changes;
- Queue Autorun changes;
- Agent Executor or Direct Work changes;
- raw output display in Queue;
- response capture outside Executor-owned artifacts;
- validation auto-run;
- retry behavior;
- acceptance workflow;
- Git mutation, auto-commit, or push;
- scheduler, durable runner, reconnect/resume, server runtime, or RBAC.
