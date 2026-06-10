# Validation Runner Evidence Audit

## Purpose

This audit records the safest path for explicit validation command execution and
structured validation evidence attachment to Queue items.

Status: docs-only functional audit.

This document does not add frontend behavior, backend or Tauri commands,
storage/schema changes, Queue runtime behavior, scheduler behavior, Autorun
behavior, provider tools, Git mutation, Terminal execution, Workspace Agent
runtime changes, or validation execution.

## Scope

The target dogfooding flow is:

```text
Queue item -> explicit validation request -> validation command(s) run
-> evidence captured -> Queue/Workspace Chat show result -> coordinator decides
```

Required boundaries:

- validation runs must start only from explicit operator/coordinator-visible
  actions;
- validation must not run on Queue item creation, prompt-pack import, task
  assignment, task completion, Autorun arm, or Queue scheduler tick;
- Queue runtime, Sequential Runner, and Autorun semantics must remain unchanged;
- Queue must not create a second runtime/storage path;
- validation output must be capped, timestamped, and visibly incomplete when
  truncated;
- validation evidence must support review and coordinator decision without
  auto-finalizing, auto-accepting, auto-committing, or auto-pushing.

## Existing Execution Paths

### Terminal / PTY

Current Terminal has two local execution paths:

- desktop PTY sessions for visible manual shell work;
- a collapsed legacy one-shot command fallback for Terminal widget instances.

The PTY path is session-only. PTY output is not persisted as widget
logs/results and must not be sent to Queue, Workspace Agent, Agent Executor,
Git, Notes, or Evidence automatically.

The one-shot Terminal fallback uses `run_process_once` with explicit program,
argv, working directory, timeout, stdout/stderr caps, and persists Terminal
widget run/log/result records.

Audit decision: do not use Terminal/PTY as the Queue validation runner.
Terminal is a manual operator shell surface, not a Queue or Workspace Chat
execution backend. Reusing it would blur product ownership and would make
validation look like hidden Terminal execution.

### Direct Work / Codex

Agent Executor owns Codex Direct Work execution. Current Direct Work supports:

- one-shot and streaming Codex execution for explicit Workspace, Workbench,
  widget, execution workspace, prompt, sandbox, approval policy, timeout, and
  output caps;
- persisted widget run/log/result artifacts for `agent-run` owners and
  Queue-owned local executor slots;
- explicit Queue assigned-task starts through the existing Direct Work stream
  path;
- run history/detail APIs for stored Direct Work and Direct Work validation
  artifacts.

Direct Work validation already exists as a separate app/Tauri path:

- `hobit-tools::toolbelt::run_toolbelt_validation`;
- `WorkspaceService::run_direct_work_validation`;
- Tauri command `run_direct_work_validation`;
- frontend API/action `runDirectWorkValidation`;
- persisted widget run/log/result artifacts with result type
  `direct_work_validation_result`.

Current validation support is limited to Hobit's repository-local Toolbelt
profiles: `fast`, `changed`, and `full`. It captures profile, status, exit
code, stdout, stderr, truncation flags, duration, error message, command
summary, and repository root.

Audit decision: reuse this pattern and low-level bounded process adapter, but
do not treat the existing Toolbelt-only Direct Work validation API as sufficient
for Queue validation evidence. It cannot run arbitrary explicit validation
specs such as `dotnet build SuperOverlay3.sln -m:1` or `git diff --check`
unless those commands are represented by a new typed validation command/suite
model.

### Tauri Command Runners

Existing Tauri-visible process execution is scoped:

- `run_terminal_command` for Terminal widget fallback only;
- `run_direct_work_validation` for Agent Executor / Direct Work validation;
- Codex Direct Work commands for Agent Executor / Queue assigned-task runs;
- Git/JDBC commands for their bounded widget-specific capabilities.

There is no generic "run arbitrary command" Tauri bridge for Queue or
Workspace Chat. That absence is good: a validation runner should be a typed,
scoped capability, not a generic shell prompt.

### Prompt-Runner / External Runner Docs

Prompt Pack Import preserves validation command metadata in Queue task text and
QueueV2 display, but it does not execute validation. Workspace Chat Queue
Control keeps `request_validation` explicitly unavailable. Existing prompt
templates mention external runner summaries only as selected/pasted visible
context, not as a Hobit runtime.

Audit decision: external runner summaries may remain visible pasted/attached
context, but they are not structured Hobit validation evidence unless captured
through a future validation evidence model.

### Validation Helpers / Scripts

The repo-local Toolbelt provides deterministic Hobit validation profiles:

- `scripts/hobit/validate.ps1`;
- `scripts/hobit/validate.sh`;
- helper scripts for file size, module map, changed files, and desktop smoke
  readiness.

The Toolbelt runner is useful for Hobit self-validation, but it is not a
general external-project validation runner.

## Queue Evidence And Status Fields

Current Queue task data has:

- `status`;
- `validationStatus` in frontend task state and local task metadata;
- `workerExecutionReports` as frontend/current-session structured report data;
- `context_json` for durable Knowledge/Skill context only, intentionally not
  exposed through generic Queue create/update paths;
- run-link records with `validation_status` but only for Direct Work run links.

Current persisted Queue task storage does not have first-class fields for:

- validation command specs;
- validation suite definitions;
- validation evidence records;
- validation run ids;
- per-command stdout/stderr previews;
- validation timestamps/durations;
- validation cwd;
- validation command exit codes;
- evidence approval or AI-context state.

Current run-link validation status is not enough for this feature. It records a
summary value on a Direct Work run link and currently validates only
`codex_direct_work` runs as Queue run links. Direct Work validation artifacts
are separate `direct_work_validation` widget runs and cannot be safely attached
to a Queue task as durable evidence without a new association.

## QueueV2 And Workspace Chat Surfaces

QueueV2 already has places to show validation-related information:

- compact task/card validation badges through `validationStatus`;
- task details `Files / Validation` tab;
- task details `Result` tab through `AgentQueueTaskResultEvidenceSection`;
- developer details for raw/capped run and report metadata;
- prompt-pack validation command metadata display.

Workspace Chat / Workspace Agent queue cards already show:

- Queue task status;
- coordinator status;
- validation status;
- report readiness;
- explicit Queue actions;
- unavailable `Request validation` action with a visible reason.

Audit decision: these surfaces can display validation state and evidence once a
typed validation action and evidence attachment exist. The current Workspace
Chat card should continue to show unsupported validation until that bridge is
implemented.

## Recommended Model

### Validation Command Spec

Add a typed validation command spec, not a shell string:

```text
ValidationCommandSpec
  id
  label
  program
  args[]
  cwd
  timeout_ms
  stdout_cap_bytes
  stderr_cap_bytes
  risk_level
  source
```

Rules:

- `program` and `args[]` must be structured values;
- no shell concatenation by default;
- `cwd` must be explicit and existing;
- `cwd` must be operator-approved per validation request;
- command preview must show program, args, cwd, timeout, caps, and source;
- commands must be allowlisted or explicitly confirmed when imported from
  prompt-pack text;
- no destructive commands by default;
- command output is evidence candidate data, not automatic AI context.

### Validation Suite

Add a suite as an ordered list of command specs:

```text
ValidationSuiteRequest
  workspace_id
  queue_item_id
  requested_by_surface
  cwd
  commands[]
  stop_on_first_failure
  created_at
```

Supported first suites should be conservative:

- Hobit Toolbelt profile suite (`fast`, `changed`, `full`);
- explicit structured local command suite for operator-confirmed commands such
  as `npm.cmd`, `cargo`, `dotnet`, and `git diff --check`.

Prompt-pack-imported validation commands should start as suggestions. They
must become editable structured specs and require an explicit run action before
execution.

### Validation Evidence Ledger

Add a Queue-owned validation evidence ledger rather than overloading task
description, prompt text, or Knowledge context.

Minimal item:

```text
QueueValidationEvidence
  evidence_id
  workspace_id
  queue_item_id
  validation_run_id
  command_id
  command_label
  program
  args[]
  cwd
  started_at
  completed_at
  duration_ms
  status
  exit_code
  stdout_preview
  stderr_preview
  stdout_truncated
  stderr_truncated
  error_message
  command_summary
  source
  no_git_mutations
  no_commit_push
  ai_context_status
```

The ledger can be a new table/API in a later implementation block. A
frontend-only fake ledger should not be treated as durable evidence.

### Status Mapping

Recommended Queue task validation statuses:

- `not_started`;
- `validating`;
- `passed`;
- `failed`;
- `needs_review`.

Recommended per-command statuses:

- `queued`;
- `running`;
- `passed`;
- `failed`;
- `failed_to_start`;
- `timed_out`;
- `cancelled`.

Task-level mapping should be conservative:

- all commands exit `0` -> `passed`;
- any command exits non-zero, fails to start, or times out -> `failed`;
- partial, cancelled, or capped/manual-review cases -> `needs_review`;
- while a validation run is active -> `validating`.

Validation status must not change Queue execution status by itself. It must not
finalize, accept, or close the task.

## Recommended Runner Path

The safest implementation path is backend/Tauri required, using existing
foundations:

1. Reuse `hobit-tools::process::run_process_once` as the low-level bounded
   process adapter.
2. Keep `hobit-tools::toolbelt::run_toolbelt_validation` for Hobit Toolbelt
   profile suites.
3. Add a new typed validation runner adapter for structured command specs.
4. Add a narrow app service method scoped to Workspace + Queue item + explicit
   cwd + command specs.
5. Add a Tauri command such as `run_queue_validation_suite`.
6. Persist validation evidence through a Queue-owned ledger and update the
   Queue task validation status.
7. Expose read APIs for latest/list validation evidence by Queue item.
8. Wire QueueV2 and Workspace Chat to the same Queue-owned evidence state.

Frontend-only is not sufficient for real command execution. Browser/Vite
fallback cannot run local processes and must show unsupported validation
execution. Frontend-only work can parse prompt-pack validation suggestions and
render review cards, but it cannot safely execute or durably capture evidence.

Do not reuse Terminal/PTY for Queue validation. Do not route validation through
Codex prompts. Do not create a second Queue runtime. Do not start validation
from Queue Autorun or Sequential Runner ticks.

## Minimal Backend / Tauri Boundary

If implemented, the bridge should be minimal and typed:

```text
run_queue_validation_suite(request)
  workspace_id
  queue_item_id
  cwd
  commands[]
  stop_on_first_failure
  stdout_cap_bytes
  stderr_cap_bytes
  timeout_ms
```

Response:

```text
validation_run_id
queue_item_id
status
started_at
completed_at
duration_ms
commands[]
task_validation_status
no_git_mutations
no_commit_push
```

Command response:

```text
command_id
status
exit_code
stdout_preview
stderr_preview
stdout_truncated
stderr_truncated
duration_ms
error_message
command_summary
cwd
started_at
completed_at
```

Safety boundaries:

- validate Queue task belongs to Workspace;
- require explicit cwd, no silent Workspace/root guessing;
- reject missing cwd and non-directory cwd;
- use structured program/args;
- no shell unless a later shell-specific spec adds explicit risk confirmation;
- cap stdout/stderr separately;
- record truncation visibly;
- no environment/secrets injection;
- no Git commit/push/reset/clean/stash/revert;
- no Queue scheduler/Autorun coupling;
- no automatic rerun;
- no automatic AI-context approval.

## Phased Implementation Recommendation

### Phase 1: Validation Model And Evidence Ledger

- Define typed validation command/suite/evidence models.
- Add durable Queue-owned validation evidence storage/API.
- Add read APIs for latest/list evidence by Queue item.
- Keep AI context approval out of this slice.
- Do not run commands yet unless the runner bridge is also in scope.

### Phase 2: Runner Service / Adapter

- Reuse `run_process_once` and Toolbelt runner patterns.
- Implement structured command spec execution with caps/timeouts.
- Add Toolbelt profile suite support as a first safe preset.
- Add unsupported states for browser/Vite fallback.
- Keep command execution explicit and visible.

### Phase 3: Queue Item Attachment / State Update

- Add explicit `Run validation` action from selected Queue task details.
- Store evidence rows and update task `validationStatus`.
- Link validation evidence to Queue item, not to a second Queue task store.
- Do not modify Queue execution status except optional visible
  validation-only state.

### Phase 4: Workspace Chat Request / Status Cards

- Replace unavailable `Request validation` only after the typed Queue
  validation bridge exists.
- Show editable command preview and required confirmation.
- Show running/result cards from Queue-owned evidence.
- Keep stop/cancel unavailable unless a separate validation cancellation bridge
  is implemented.

### Phase 5: QueueV2 Evidence Display

- Show validation run summary in `Files / Validation`.
- Show latest evidence in `Result / Evidence` when relevant.
- Keep raw stdout/stderr collapsed and capped in Developer details.
- Preserve prompt-pack validation commands as suggestions until executed.

### Phase 6: Status Docs

- Add a status record describing implemented behavior and unsupported gaps.
- Update current surface docs only after behavior exists.
- Keep Prompt Pack Import and Workspace Chat Queue Control status docs honest
  about any remaining unsupported validation actions.

## Unsupported Today

Unsupported in the current codebase:

- arbitrary validation command specs for Queue items;
- running `npm.cmd`, `cargo`, `dotnet`, or `git diff --check` from Queue /
  Workspace Chat as first-class validation commands;
- durable Queue validation evidence ledger;
- durable association from a Direct Work validation artifact to a Queue task;
- Workspace Chat validation execution;
- QueueV2 validation execution control;
- validation cancellation/stop controls;
- browser/Vite local command execution;
- automatic validation after Prompt Pack Import;
- automatic validation after Queue task execution;
- automatic Queue finalization based on validation;
- automatic commit/push or Git mutation based on validation.

Supported today:

- Terminal manual PTY and one-shot fallback inside Terminal only;
- Codex Direct Work execution and Queue assigned-task start through Agent
  Executor/Queue-owned local executor paths;
- Toolbelt profile validation capture as Direct Work validation artifacts for
  Direct Work owners;
- Queue task validation status display in frontend state;
- Queue run-link validation status field, currently tied to Direct Work run
  links and not a general validation evidence ledger;
- QueueV2 and Workspace Chat display surfaces that can later render validation
  evidence.

## Audit Decision

This block cannot be frontend-only for real validation execution. Frontend-only
work can review suggested validation commands and render unsupported cards, but
local command execution and durable evidence capture require a minimal backend
/ Tauri bridge.

The recommended path is a new typed Queue validation runner/evidence bridge
that reuses existing process and artifact patterns, remains Workspace-scoped
and Queue-owned, and preserves all Queue scheduler/Autorun semantics.

