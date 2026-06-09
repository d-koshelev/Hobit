# Workspace Agent V2 Queue Run Status

## Purpose

This document records the implementation status after WorkspaceAgentV2 Queue
Run Block 001.

Status: docs-only status record.

This document does not add frontend behavior, backend or Tauri commands,
storage/schema changes, Queue runtime behavior, scheduler behavior, Autorun
behavior, provider adapters, Direct Run behavior, Git mutation, Terminal
execution, Knowledge ingestion, or Workspace Agent V1 replacement. Current
implemented Workspace Agent V1 behavior remains governed by
`docs/CURRENT_WIDGET_SURFACE.md` until an explicit replacement block updates
the product surface and implementation.

## Implemented In Block 001

### Queue Run Audit

`docs/WORKSPACE_AGENT_V2_QUEUE_RUN_IMPLEMENTATION_AUDIT.md` records the
inspect-only audit of existing Queue task creation, QueueV2 action plumbing,
Workspace Agent V1 Queue behavior, durable Knowledge / Skill context attach
APIs, and the WorkspaceAgentV2 Queue Run scaffold.

The audit identifies the safe implementation path:

- reuse the existing typed Queue Widget API / Workspace Agent Queue bridge;
- create Queue-owned tasks only;
- attach only eligible visible saved Knowledge / Skill refs through typed
  Queue context APIs;
- request existing Queue open/select behavior when the host supplies it;
- keep Queue execution, review, closure, run history, Autorun, and
  finalization owned by Queue.

### Typed Queue Run Service

`apps/desktop/frontend/src/workbench/widgetV2/workspaceAgentV2/workspaceAgentV2QueueRunService.ts`
implements a thin typed Queue Run service for WorkspaceAgentV2.

Real behavior:

- builds a typed Queue Run request from the visible composer prompt and
  selected visible context items;
- requires a non-empty prompt;
- creates a Queue task through the supplied typed Queue bridge
  `createItem` path;
- maps `intake` and `draft` desired status to Queue `draft`, and maps
  `queued` to Queue `queued`;
- uses actor `workspace_agent`;
- derives the Queue task title from the first prompt line;
- records WorkspaceAgentV2 source metadata and visible context ref count in
  the task description;
- returns a structured created, failed, or unsupported result.

The service does not call Queue run/start APIs, Agent Executor APIs, Terminal,
Git, JDBC, provider tools, storage directly, or any natural-language Queue
command parser.

### Queue Run Controller

`apps/desktop/frontend/src/workbench/widgetV2/workspaceAgentV2/useWorkspaceAgentV2QueueRun.ts`
implements the current-session Queue Run controller.

Real behavior:

- starts from the current visible prompt only;
- transitions through preparing, attaching-context, and creating-task states;
- prevents duplicate Queue Run starts while creation is already in progress;
- reports unsupported host/create-bridge state visibly;
- emits one result to the WorkspaceAgentV2 transcript result path.

The controller does not persist V2 run history, start Direct Run, start Queue
execution, launch Agent Executor, or alter Queue runner/Autorun behavior.

### UI Wiring

`apps/desktop/frontend/src/workbench/widgetV2/workspaceAgentV2/WorkspaceAgentV2Widget.tsx`
wires Queue Run into the experimental WorkspaceAgentV2 surface.

Real behavior:

- Queue Run is visible as a distinct first-class action from Direct Run;
- Queue Run is enabled only when the host supplies Queue create support and the
  prompt is non-empty;
- preflight text states that a Queue task will be created, not run;
- the created task result appears as a WorkspaceAgentV2 result card;
- the result card shows created task id/title, created-not-started state,
  Queue lane/status, attached/skipped context counts, warnings, safety copy,
  and follow-up actions where supported;
- Open Queue and Open Queue task actions call host callbacks when supplied;
- Copy task id copies only the created task id;
- Create another Queue task clears the composer after the result.

The UI wiring does not replace Workspace Agent V1, does not change Direct Run,
and does not make Queue Run a provider execution path.

### Visible Context Attachment

Queue Run context attachment is explicit and bounded to visible context already
present in WorkspaceAgentV2.

Real behavior:

- saved Knowledge Document context items attach through
  `attachKnowledgeToQueueTask` when the Queue bridge supplies it;
- saved Skill context items attach through `attachSkillToQueueTask` when the
  Queue bridge supplies it;
- disabled, rejected, and secret-bearing context is skipped with visible
  warnings;
- stale and large context can be attached by ref/API with visible warnings;
- unsupported context types such as files, notes/manual context, and Queue
  task context refs are skipped with explicit reasons;
- no full unsupported context body is copied into the Queue prompt.

The created Queue task owns its durable context refs after attach. Queue
materialization before execution remains Queue-owned and is not triggered by
WorkspaceAgentV2 Queue Run.

### Queue Task Created Card And Open Action

The Queue Run result is rendered as a WorkspaceAgentV2 transcript result card,
not as a Queue-owned execution report.

Real behavior:

- successful creation shows `Queue task created`;
- the result records the created Queue task id and title;
- the safety message states that only a task was created;
- Open Queue opens the Queue surface when the host callback is supplied;
- Open Queue task requests the existing Queue task open/select path when the
  host callback is supplied;
- the card keeps review and execution follow-up in Queue.

Open/select depends on a visible Queue host path. If the host does not supply
open/select callbacks, task creation can still succeed without opening Queue.

## Exact Behavior Record

- Queue Run creates Queue tasks explicitly from the WorkspaceAgentV2 operator
  action.
- Created Queue tasks are not auto-run.
- Queue owns task execution, review, closure, run history, Autorun, and
  finalization.
- Direct Run remains unchanged and remains a separate explicit action.
- Workspace Agent V1 remains unchanged through the existing `interactive-agent`
  compatibility surface.
- Queue Run without a Queue create bridge is unsupported/inert and reports that
  Queue task creation is unavailable.
- Queue Run with an empty prompt is blocked before task creation.
- Queue Run creates through typed Queue bridge APIs rather than private Queue
  component state, direct storage writes, or parser-based V1 command handling.

## Safety Record

The implemented Queue Run slice preserves the required safety boundaries:

- no hidden execution;
- no hidden context access;
- no hidden Workspace scans, file reads, widget reads, or provider-private
  content;
- no automatic Queue run, scheduler dispatch, Sequential Runner start, or
  Autorun start;
- no Agent Executor run launch;
- no Direct Run launch;
- no auto-commit, auto-push, auto-finalize, or automatic result acceptance;
- no hidden Terminal action;
- no hidden Git read or mutation;
- no JDBC action;
- no Notes mutation;
- no arbitrary context JSON through generic Queue task creation;
- no full unsupported context body copied into prompts.

## Manual Smoke Checklist

Use the experimental WorkspaceAgentV2 host path that supplies Queue create
support and, where available, a visible Queue widget.

1. Open WorkspaceAgentV2.
2. Enter a prompt.
3. Attach visible context if the UI supports it.
4. Click Queue Run / Create Queue Task.
5. Verify a Queue task created card appears in the WorkspaceAgentV2 transcript.
6. Verify the created task appears in QueueV2 Intake / Draft or the expected
   draft lane.
7. Verify the task did not auto-run.
8. Verify context counts and warnings on the created task card.
9. Verify attached Knowledge / Skill refs appear in Queue task context where
   eligible.
10. Verify skipped unsupported/blocked context reports visible reasons.
11. Use Open Queue or Open Queue task if present and verify it selects or opens
    the created task without running it.
12. Verify Direct Run still works as a separate explicit action.
13. Verify Workspace Agent V1 still loads and behaves unchanged.

## Remaining Gaps

- Queue Run polish and hardening for result copy, unavailable host callbacks,
  warning clarity, and edge cases around failed partial context attachment.
- Queue task open/select deep link hardening if any host path does not yet
  select the created task reliably.
- Direct Run file-change and diff hardening if WorkspaceAgentV2 needs stronger
  direct review before broader use.
- Claude Code CLI audit before any Claude adapter or provider option.
- Amp CLI audit before any Amp adapter or provider option.
- No durable WorkspaceAgentV2 Queue Run history or reconnect/resume model.
- No generalized Evidence / Context Pack record is created for Queue Run
  context; current behavior remains Queue-owned refs/snapshots and visible
  warnings.

## Recommended Next Blocks

1. Queue Run polish/hardening.
   Tighten unsupported-host messaging, partial attach failure display, result
   card action states, and smoke coverage without changing Queue execution.

2. Queue task open/select deep link.
   Harden the host open/select callback path where incomplete so a created
   task can reliably open in QueueV2 without running.

3. Direct Run file-change/diff hardening.
   Improve WorkspaceAgentV2 Direct Run result review only through explicit
   read-only run detail/diff paths, preserving no auto-commit and no Git
   mutation.

4. Claude Code CLI audit.
   Produce an inspect-only CLI capability and safety audit before any adapter,
   provider option, or execution path.

5. Amp CLI audit.
   Produce an inspect-only CLI capability and safety audit before any adapter,
   provider option, or execution path.
