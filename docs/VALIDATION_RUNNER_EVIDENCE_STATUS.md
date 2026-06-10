# Validation Runner Evidence Status

## Purpose

This document records the docs-only status after Validation Runner / Evidence
Block 001.

Status: docs-only status record.

This document does not add frontend behavior, backend or Tauri commands,
storage/schema changes, Queue runtime behavior, scheduler behavior, Autorun
behavior, provider tools, diff review execution, rollback execution, Git
mutation, Terminal execution, Workspace Agent replacement, QueueV2 replacement,
or KnowledgeV2 behavior. Current implemented widget behavior remains governed
by `docs/CURRENT_WIDGET_SURFACE.md`.

## Implemented In Block 001

### Audit

`docs/VALIDATION_RUNNER_EVIDENCE_AUDIT.md` recorded the safe target shape for
explicit Queue validation and evidence capture.

The audit identified the implementation boundary:

- validation must be a typed Queue capability, not Terminal/PTY reuse, Codex
  prompt execution, or a generic command prompt;
- validation must start only from explicit operator/coordinator-visible
  action;
- command specs must be structured, capped, and workspace-scoped;
- Queue evidence must attach to the existing Queue item path rather than a
  second Queue runtime or storage path;
- validation status and evidence must support review without finalizing,
  accepting, committing, pushing, or starting dependent work.

### Validation Command And Evidence Model

Block 001 added a typed validation command/suite/evidence model across the app
service, Tauri DTO boundary, and frontend validation layer.

Real behavior:

- validation requests carry Workspace id, Queue item id, requested-by surface,
  suite cwd, stop-on-first-failure, and structured command specs;
- command specs carry id/title, executable/program, args, cwd, timeout,
  stdout/stderr caps, allowed exit codes, safety category, and source;
- command results carry status, exit code, cwd, stdout/stderr previews,
  truncation flags, duration, warnings, errors, and command summary;
- evidence summaries carry run id, Queue item id, command metadata, capped
  output previews, mutation safety flags, and `ai_context_status:
  not_approved`;
- unsupported, blocked, failed-to-start, timed-out, passed, failed, and
  needs-review states are represented visibly.

Command output is capped before it is shown or copied into Queue-visible
evidence summaries. Full durable log references are not implemented as a
first-class Queue evidence store in this block.

### Runner Service / Adapter

Block 001 added a Queue validation runner service using the existing bounded
process adapter pattern.

Real behavior:

- the app service validates that the Queue task belongs to the Workspace;
- the Queue task must have an execution workspace before validation can run;
- validation suite cwd and per-command cwd must be existing directories inside
  the Queue task execution workspace;
- commands run through structured program plus args, not shell concatenation;
- allowed safety categories are limited to `read_only` and `build_or_test`;
- mutating, destructive, unknown, shell-like, or unsupported command specs are
  blocked visibly;
- the current allowlist includes common validation tools such as Cargo, Dotnet,
  Git read-only commands, Node, npm, Python, and Python 3;
- Git commands are limited to read-only subcommands such as diff, status, log,
  show, rev-parse, and branch;
- npm publish/version/adduser style commands are blocked;
- stdout/stderr caps, timeout, exit code, truncation, and error state are
  returned in the run summary.

The runner reports that cancellation is unsupported. Durable Queue evidence
ledger storage is not implemented in this slice.

### Queue Evidence Attachment

Block 001 added a frontend Queue evidence attachment service over the existing
Queue Widget API update path.

Real behavior:

- explicit validation first attempts to mark the Queue item as `validating`;
- after the runner returns, the service appends a validation-shaped worker
  execution report to the Queue item through the existing Queue update bridge;
- the Queue item validation status is updated to `passed`, `failed`, or
  `needs_review` according to the runner output;
- the attached report includes a capped raw validation evidence preview,
  commands run, suggested commands, summary, warnings, errors, and validation
  result;
- attachment failures and unsupported Queue evidence fields are surfaced as
  warnings rather than faked success;
- stale evidence can be detected when a Queue item changes after evidence was
  captured.

This is Queue item evidence attachment through existing report state, not a
new durable validation evidence table or immutable evidence ledger.

### Workspace Chat Validation Controls And Cards

Block 001 wired Workspace Chat / Workspace Agent Queue status cards to request
validation when a runner, Queue bridge, Queue task execution workspace, and
validation command source are available.

Real behavior:

- validation commands can be derived from prompt-pack metadata, execution-plan
  previews, latest worker report suggestions, or an explicit manual validation
  command field;
- the card shows selected commands and disables Run validation with a visible
  reason when prerequisites are missing;
- validation starts only after the operator clicks `Run validation`;
- unavailable runner or Queue update bridge states are visible and no
  validation starts;
- the result card shows status, command count, passed/failed counts, duration,
  exit codes, warnings, errors, and capped stdout/stderr evidence;
- the card explicitly states that validation does not finalize Queue tasks,
  start dependents, commit, push, or accept work.

Workspace Chat does not expose stop/cancel for validation in this block.

### QueueV2 Evidence Display

Block 001 added QueueV2 validation evidence display over the existing Queue
task/report state.

Real behavior:

- QueueV2 derives validation evidence from the latest validation-shaped worker
  execution report;
- QueueV2 can display not-requested, running, passed, failed, unavailable,
  cancelled, and stale validation states;
- task details can show validation evidence timestamp, summary, warnings,
  command status, exit code, duration, stdout preview, stderr preview, and
  command warnings/errors;
- output shown in QueueV2 is capped for review;
- prompt-pack validation metadata remains suggestions until an explicit
  validation run occurs.

QueueV2 does not become a validation runner, scheduler, Terminal launcher, Git
mutation surface, or separate evidence store.

## Expected Behavior Record

- Validation runs only by explicit operator/coordinator-visible action.
- Validation does not run on Queue item creation, prompt-pack import, task
  assignment, task completion, Queue selection, QueueV2 display, Sequential
  Runner ticks, or Autorun arm/start.
- Validation command output is capped and truncation is visible.
- Produced validation evidence is attached to the selected Queue item through
  existing Queue report/update state when the Queue bridge supports it.
- Validation does not finalize tasks, accept work, create commits, push, mutate
  Git, launch Terminal, start Queue dependents, or auto-run Queue tasks.
- Validation failure is review evidence. It is expected to block future
  coordinator acceptance/finalization flow, but that gating is not fully wired
  in this block and must not auto-run dependents.
- Unsupported runners, missing Queue bridges, missing execution workspaces,
  missing commands, unsupported commands, and blocked command safety categories
  are visible unavailable/failed states.
- Browser/Vite environments that cannot run local commands must show
  unavailable runner state rather than fake validation success.
- Evidence remains not approved for AI context by default.

## Manual Smoke Checklist

Use a Workspace with Workspace Agent / Workspace Chat and Agent Queue / QueueV2
available.

1. Select or import a Queue task that includes validation commands, or enter a
   manual validation command in the Workspace Chat validation card.
2. Verify the Queue task has an explicit execution workspace before validation
   is allowed.
3. Request validation from Workspace Chat by clicking `Run validation`.
4. Verify the command/suite runs when the runner is available, or verify a
   visible unavailable/blocked reason when it is not available.
5. Verify Workspace Chat shows a validation result card with status, duration,
   exit codes, warnings/errors, and capped stdout/stderr evidence.
6. Verify the selected Queue item receives validation status and evidence
   through the Queue update/report path.
7. Open QueueV2 task details and verify the validation evidence appears in the
   validation/evidence display.
8. Verify capped output or truncation warnings are visible when output exceeds
   the preview cap.
9. Verify unsupported or blocked commands show visible failure/unavailable
   state and do not run a fallback shell command.
10. Verify validation does not auto-finalize, auto-accept, auto-commit,
    auto-push, auto-run dependents, arm Autorun, or start Queue tasks.

## Remaining Gaps

- Full durable validation evidence ledger/storage is not implemented.
- Full log storage and first-class full-log reference support are not
  implemented for Queue validation evidence.
- Validation cancellation/stop controls are not implemented.
- Hard timeout/cancellation lifecycle visibility is limited to the current
  process adapter result; no long-running validation run controller exists.
- Diff review integration is not implemented.
- Coordinator finalization gating is not fully wired; validation failure should
  block future acceptance/finalization, but the current block records evidence
  and status only.
- Prompt-pack validation commands are still suggestions until explicitly run.
- Browser/Vite local command execution remains unsupported.

## Safety Record

Block 001 preserves these boundaries:

- no hidden validation execution;
- no validation on import or task creation;
- no second Queue runtime or storage path;
- no Queue scheduler or Autorun behavior changes;
- no auto-finalize, auto-accept, auto-commit, or auto-push;
- no Git mutation;
- no Terminal/PTY reuse;
- no provider tool mode;
- no hidden Workspace, file, Notes, Knowledge, Queue, Executor, Git, JDBC,
  Terminal, or Runbook context access.
