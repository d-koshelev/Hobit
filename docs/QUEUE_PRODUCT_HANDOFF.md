# Queue Product Handoff

## Purpose

This document freezes the current Queue state after the Queue + Workers
stabilization blocks and prepares the next phase of Hobit work.

Queue is the main orchestration surface for queue items, queue tags, workers,
the embedded executor section, worker reports, validation review, diff review,
coordinator decisions, and final results. Agent Executor as a standalone widget
may remain temporarily as a compatibility/debug surface, but the normal product
direction is to inspect and manage Queue execution through Queue.

This is a handoff document. It does not add runtime behavior, Tauri commands,
DTOs, storage/schema, frontend UI behavior, dependencies, execution wiring, or
new Queue features.

## Current Implemented Model

Current Queue behavior includes:

- Queue items with title, description, prompt, execution status, validation
  status, coordinator status, priority, stable order, execution policy, item
  type, queue tag, dependency ids, assigned worker/executor references, plan
  preview metadata, worker report metadata, and safe run-link metadata where
  available.
- Queue tags as routing/dependency-affinity groups. Tags can be created,
  renamed, manually paused/resumed, and deleted only when empty. Tag pause
  gates new eligibility and does not stop or kill existing work.
- Item editing through explicit save/cancel. Saving an edit pauses the affected
  tag for coordinator review, marks the item for review, and leaves any already
  running Executor work alone.
- Item dependencies as a frontend/model readiness layer. Dependencies block
  readiness until prerequisite items are completed and coordinator-finalized.
  Self-links, missing ids, and cycles are rejected.
- Item priority and stable order inside queue tag/priority groups. Priority and
  order select among otherwise eligible work only after safety gates pass.
- Persisted Agent Worker configuration per Workspace for worker id, name,
  enabled/disabled flag, display order, and scope to all queues or one tag.
  Worker config is durable configuration, not live process state.
- Deterministic worker assignment/routing rules. Eligibility depends on global
  START state, enabled worker, scope match, runnable item status, prompt
  presence, tag not paused, satisfied dependencies, validation/coordinator
  gates, and assignment match.
- Queue Flow Map as a visual topology view of queue tags, dependency layers,
  barriers, executor lanes, dry-run labels, result/report groups, and selected
  item navigation.
- Scheduler dry-run eligibility engine that explains available workers,
  eligible items, blocked items, best next recommendations, idle reasons, and
  global START / STOP / STOP + KILL RUNNING state.
- Global START / STOP / STOP + KILL RUNNING frontend/model state. START allows
  dry-run recommendations. STOP suppresses new recommendations. STOP + KILL
  RUNNING suppresses new recommendations and marks running items as requiring
  Agent Executor/coordinator review in model/UI only.
- Worker execution plan preview as deterministic local metadata for expected
  steps, approximate token/time ranges, validation commands, likely files or
  areas, complexity/risk, stale/ready/split-needed state, and split advice.
- Embedded executor section showing max executors, configured workers, spare
  and working executor slots, worker scopes, capacity recommendations, and safe
  result/history signals when available.
- Expanded item detail panel with queue tag, type, priority/order, execution
  status, validation status, coordinator status, submitted metadata, prompt
  preview, expected plan metadata, worker report evidence, Diff Review linkage,
  and presentation-only executor-info labels.
- Worker execution report model. Reports can record summary, worker, report
  time, changed files, commands reported, suggested validation, warnings,
  errors, optional commit/Git status, follow-up recommendation, rollback
  recommendation, and collapsed raw preview.
- Diff Review work item workflow. A coordinator/operator can explicitly create
  an independent queued Diff Review item linked to a source item/report.
- Workspace Chat queue report action cards. Worker and Diff Review report
  metadata can be shown as explicit current-session action cards with
  coordinator actions.
- Coordinator finalization actions for ready for finalization, finalized/
  accepted, needs changes, follow-up required, blocked, failed/rejected, and
  rollback required. Follow-up item creation is explicit.

## Safety Boundaries

- No hidden execution.
- No auto-run unless explicitly operator-controlled through current visible
  Queue runner/Autorun controls.
- Workers do not finalize items.
- Worker reports, validation results, and Diff Review reports are evidence
  only.
- Coordinator/operator finalization is explicit.
- Dependencies unblock only after the prerequisite is completed and
  coordinator-finalized/accepted.
- Follow-up/sub-block creation is explicit and does not run automatically.
- Rollback required is a marker/recommendation only unless a future explicit
  rollback workflow is implemented.
- STOP + KILL RUNNING model state does not currently imply process kill unless
  runtime support is added.
- Queue report action cards do not call providers, start Executor/Codex, run
  Git diff, run validation, execute rollback, kill processes, or auto-finalize
  items.
- Queue does not copy or render raw Agent Executor prompts, stdout/stderr,
  logs, final responses, diffs, repo paths, secrets, or raw payloads.

## Current Runtime Status

Implemented UI/model behavior:

- Queue item CRUD/editing through current workspace Queue APIs.
- Queue tag organization and local pause/review gates.
- Dependency readiness modeling and validation.
- Priority/order organization.
- Persisted worker configuration.
- Worker routing explanations.
- Scheduler dry-run explanations.
- Flow Map visualization.
- Worker execution plan preview metadata.
- Worker execution report evidence attachment.
- Diff Review item creation.
- Workspace Chat queue report action cards.
- Coordinator finalization markers/actions.
- Safe selected-task run-link history and explicit open/attach metadata where
  current run-link APIs provide it.

Implemented explicit runtime behavior:

- Manual assignment/clear of Queue tasks to visible Agent Executor slots where
  APIs are available.
- Explicit start of an assigned Queue task in its assigned Agent Executor with
  an operator-provided execution workspace path.
- Current-session Queue-to-Executor handoff and final-status auto-refresh.
- Frontend-driven Sequential Queue Runner and operator-armed Queue Autorun
  preview under their current session-only limits.

Dry-run/model-only behavior:

- Worker claiming and worker availability are modeled for explanations only.
- Scheduler eligibility is a dry-run plan, not a backend scheduler.
- START / STOP / STOP + KILL RUNNING are Queue model/UI gates for new work
  recommendations and do not start, stop, or kill processes by themselves.
- Max executors bounds configured worker controls and does not spawn runtime
  executors.
- Worker execution plan preview is deterministic local metadata.
- Worker report attachment is model evidence and does not prove work ran.
- Flow Map executor lanes are comprehension/selection visuals.

Future runtime behavior:

- Real worker claiming.
- Durable scheduler loop.
- Real Queue-owned Executor handoff beyond the current explicit assigned-task
  and current-session runner paths.
- Real process termination behind STOP + KILL RUNNING.
- Real Diff Review execution against Git diffs.
- Real validation execution.
- Rollback execution.
- Full Finder/Git integration for source review and changed-file navigation.
- Agent license/availability widget or capacity source.

## Coordinator Workflow

The intended current review path is:

1. Define or inspect the Queue item and queue tag.
2. Review dependencies, priority/order, worker assignment/routing, and plan
   preview.
3. Worker report evidence is attached or received for coordinator review.
4. Coordinator/operator requests Diff Review when the report needs independent
   changed-work review.
5. Validation status is reviewed or marked separately from worker execution.
6. Workspace Chat can show a Queue report action card for explicit coordinator
   decisions.
7. Coordinator/operator explicitly chooses finalization, needs changes,
   follow-up required, blocked, failed/rejected, or rollback required.

Finalization is not implied by worker completion, report attachment, validation
status, or Diff Review item creation.

## Sub-Block Policy

- If work is incomplete, over-broad, risky, or only partially validated, create
  an explicit follow-up/sub-block.
- The original item remains not finalized until the coordinator accepts the
  final state.
- Dependencies remain blocked until the prerequisite is completed and
  coordinator-finalized/accepted.
- Large requests should be split into sub-blocks before execution when possible
  and during execution when the worker/report shows scope growth.
- Follow-up/sub-block items are queued records only until explicitly assigned
  and started by the operator-controlled Queue path.

## Workspace Chat Role

Workspace Chat controls Queue functionality through explicit visible action
cards and operator clicks. It may show Queue report action cards, open linked
Queue items, create follow-up/sub-block items, create Diff Review items, and
record coordinator decision markers where safe update plumbing exists.

Workspace Chat does not perform hidden Queue actions. It must not silently
start Executor/Codex, auto-run Queue items, call providers from cards, read
hidden context, execute rollback, kill processes, mutate Git, or finalize work
without explicit operator action.

## Intentionally Not Finished

- Real worker claiming.
- Real scheduler loop.
- Real Executor handoff from Queue beyond the explicit/current-session paths
  already implemented.
- Real STOP + KILL process termination.
- Real Diff Review execution.
- Real validation execution.
- Rollback execution.
- Full Finder/Git integration.
- Agent license availability widget.
- Backend scheduler, durable reconnect/resume, server worker, retries, or
  multi-executor parallel scheduling.
- Worker-owned finalization, automatic acceptance, automatic Git mutation,
  hidden Workspace Agent automation, Notes mutation, Terminal launch, or broad
  response parser/validator behavior.

## Acceptance Checklist

- Queue items can be organized by tag.
- Tags can be paused/resumed.
- Dependencies block readiness.
- Worker routing is explainable.
- Scheduler dry-run explains next work.
- Flow Map visualizes queue topology.
- Reports can become Workspace Chat action cards.
- Coordinator finalization is explicit.
- Follow-up/sub-block policy is documented.
- Runtime gaps are explicit.

## Recommended Next Phase

Stop coding Queue features in this chat after this handoff. Start a new
ChatGPT chat for product scenario design.

The next phase should be doc-first:

- define the primary end-to-end product scenario before implementation;
- describe the operator workflow through Hobit itself plus ChatGPT in browser;
- write Queue acceptance walkthroughs before new code;
- update contracts/decisions before runtime changes;
- turn future work into explicit Queue items/sub-blocks with acceptance
  criteria before coding.
