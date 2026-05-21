# Queue Run History Visibility Contract

## Purpose

This contract defines how Agent Queue should show run-history visibility for
Queue tasks after manual runs, Sequential Queue Runner runs, or Queue Autorun
runs.

It is a docs/product contract only. It does not add schema, persistence,
backend behavior, Tauri commands, DTOs, frontend UI, Queue runtime behavior,
Queue Autorun behavior, Agent Executor behavior, server runtime, RBAC, or a
scheduler.

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

Missing for durable Queue run-history visibility:

- persisted Queue task to Executor run linkage;
- safe per-task run summary DTO;
- query path from Queue task to its associated Executor run summaries;
- explicit frontend open action from Queue task run ref to Executor run detail;
- retry/history model for more than one run per Queue task;
- validation association policy beyond what Agent Executor history already
  exposes per run;
- ArtifactRef-backed metadata references for later cross-surface linking.

Current-session handoff and Autorun state are not enough for morning review
after reload or app restart.

## Future Minimal DTO / Store Support

The first implementation should add the smallest durable linkage needed for
safe review. Recommended conceptual fields or record shape:

```text
queue_item_id
workspace_id
executor_widget_instance_id
executor_run_id
started_at
completed_at
run_status
validation_status
review_needed
created_at
```

This can be implemented as either:

- a minimal Queue task last-run linkage when only latest-run visibility is
  needed; or
- a separate Queue task run-link table when retries/history should be visible
  from the first slice.

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

The Queue task list may show a compact latest-run signal:

```text
Run wrun_... - completed - Review
```

The selected task detail may show:

- Latest run: status, Executor, started/completed, validation status;
- Open in Agent Executor;
- Run history count or compact rows when available;
- warning when a task is final but no durable run ref exists.

The open action should navigate or scroll to the owning Agent Executor and
select the run detail if that frontend capability exists. It must not fetch or
render raw Executor payload inside Queue.

## Recommended Implementation Slices

1. Docs accepted: keep this contract as the gate for run-history visibility.
2. Minimal backend/storage design: choose latest-run-only versus run-link row,
   with no raw payload duplication.
3. DTO/API slice: expose safe Queue task run refs and summaries without raw
   prompts/logs/results.
4. Frontend Queue visibility slice: show latest run status and Open Executor
   action in the selected task detail.
5. Smoke/test slice: cover manual run, Sequential Queue Runner, Autorun,
   failed/cancelled run, and no durable run ref states.
6. ArtifactRef slice later: replace or augment string refs with metadata
   ArtifactRefs after resolver and ownership rules are implemented.

## Non-Goals

This contract does not implement:

- schema or storage changes;
- persistence;
- backend behavior;
- Tauri commands or DTOs;
- frontend UI;
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
