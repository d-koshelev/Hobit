# Direct Mode Agent Contract

## Purpose

Direct Mode is Hobit's controlled path for letting an agent perform small
approved work directly.

It exists for focused operator-approved work such as code edits, validation,
and concise documentation changes where an executor agent can act inside an
approved Workspace and repository boundary.

Direct Mode does not replace Proposal Mode. It adds a future execution path for
bounded work while preserving Hobit's core rule:

- Agent proposes or works within the approved boundary.
- Operator chooses the mode, prompt, repository root, sandbox, and review.
- Hobit makes the work visible, logged, observable, and reviewable.

This is a documentation and product/domain contract only. It does not implement
runtime behavior, frontend UI, Tauri commands, storage/schema changes, Codex
execution, queue execution, Git mutations, commits, pushes, an embedded PTY, or
interactive agent sessions.

## Current Status

Hobit currently has:

- a Terminal widget with an explicit desktop-only one-shot local command path
  for persisted Terminal widget instances
- Agent Chat proposal-only artifacts with explicit approved current-view
  metadata and no tool execution
- a first backend HTTP AI provider proposal boundary when explicitly configured
- Agent Monitoring for read-only Overview / Result / Raw inspection of stored
  proposal artifacts
- Agent Queue as a narrow review inbox for explicitly created proposal review
  items
- Git widget placeholder support for manual read-only status refresh from an
  explicit transient repository root

Hobit does not currently run Codex CLI, run executor agents, execute Queue
items, perform file-changing agent work, persist Direct Work run artifacts, or
provide Direct Work UI.

The repository now includes a backend/tooling-only Codex CLI
availability/version probe in `hobit-tools`. That probe runs only
`codex --version` or `<explicit-program> --version`, captures stdout, stderr,
duration, version text when available, and a structured availability result. It
is not wired to frontend UI, Tauri commands, storage, Agent Monitoring, Agent
Queue, Git Widget, or Direct Work execution.

The near-term direction is to make Codex CLI the first practical executor for
Direct Mode because it is available locally. The model must remain
agent-agnostic so future executors can be added later.

## Executor Model

Direct Mode is executor-agnostic.

Rules:

- Executor kind must be recorded for every Direct Mode run.
- `codex_cli` is the first planned executor kind.
- Future executor kinds may include other local agent CLIs, provider-backed
  executor services, or manual/operator execution records.
- Executor selection must be explicit and visible to the operator.
- Executor-specific behavior must be behind the backend/runtime boundary, not
  called directly from the frontend.
- Executor output must be captured as run artifacts, not treated as hidden
  application state.

Conceptual executor fields:

```text
executor_kind: codex_cli
executor_version: optional version string when detected
executor_command: explicit command and argv used
executor_runtime: local_cli | future_provider | future_remote
```

These fields are conceptual only. They do not define a Rust type, TypeScript
type, API DTO, or storage schema in this block.

## Modes

### Proposal Mode

Proposal Mode is plan/proposal only.

Rules:

- no file edits
- no command execution by the agent
- no Git mutations
- no Workspace mutations beyond explicit proposal artifact persistence
- no hidden context access
- `allowed_tools: []` unless a later proposal-only tool contract changes this
- suitable for Agent Chat and Coordinator proposal flows

Current Agent Chat provider behavior remains Proposal Mode.

### Direct Work Mode

Direct Work Mode may let an approved executor edit files and run validation
inside an approved Workspace and repository root.

Rules:

- operator chooses Direct Work explicitly
- repository root must be explicit and approved
- operator prompt must be explicit and captured
- sandbox/mode must be explicit and captured
- normal sandbox for coding work is `workspace-write`
- run is one-shot in the MVP
- run status, raw log, final response, validation, and changed files must be
  reviewable
- no automatic commit
- no automatic push
- no hidden background execution

Direct Work Mode is powerful and must be treated as a high-power executor/tool
mode under `docs/TOOL_ACTION_CONTRACT.md`.

### Dangerous Mode

Dangerous Mode represents broad/full access such as `danger-full-access`.

Rules:

- not the default
- not part of the MVP
- strongly discouraged
- requires explicit manual confirmation when implemented
- must clearly show the risks and effective access before launch
- must never be started silently or from queue automation
- must still produce observable raw logs, final response, changed files, and
  review artifacts

Dangerous Mode must not be used to bypass repository approval, Git review,
validation visibility, or operator control.

## Direct Work MVP Boundary

The first Direct Work implementation should be the smallest useful slice:

- one-shot run first, not an embedded interactive PTY
- explicit Workspace and Workbench context
- explicit approved repository root
- explicit operator prompt
- explicit executor kind, starting with `codex_cli`
- explicit sandbox/mode, normally `workspace-write`
- explicit approval policy
- visible run status
- captured raw log
- captured final response
- changed files and diff review after the run
- validation summary when validation is requested or detected
- warnings for skipped validation, blocked execution, failed execution, and
  dirty Git state
- no auto-commit
- no auto-push
- no hidden background execution
- no queue execution in the MVP

The first implementation should stop before adding interactivity, background
scheduling, broad queue execution, Git mutations, schema-heavy history, or
multi-executor orchestration.

## Codex CLI Expectations

Codex CLI is the first planned Direct Mode executor.

Rules:

- Codex must run through a backend/runtime boundary, not directly from the
  frontend.
- The exact command and argv used to run Codex must be explicit and logged.
- Hobit must not silently run Codex.
- `workspace-write` is the normal Direct Work sandbox for small coding tasks.
- `danger-full-access` is not default and is not part of the MVP.
- The approved repository root must be passed as an explicit working boundary.
- The operator prompt must be captured as the user-approved task input.
- Raw output, final response, status, duration, changed files, and validation
  results must be visible after completion.
- Codex execution must not imply automatic commit, push, queue item acceptance,
  or Git mutation.

Codex CLI availability detection and version smoke checks have a
backend/tooling-only foundation in `hobit-tools`. Command construction for
Direct Work, process execution for tasks, output capture as run artifacts,
frontend UI, Tauri exposure, storage, Agent Monitoring integration, and Git
review wiring all require later implementation blocks.

## Widget Integration

### Agent Monitoring

Agent Monitoring is the primary run monitor for Direct Mode.

Future Direct Work runs should appear with:

- Overview
- Result
- Raw
- executor kind
- mode
- status
- duration
- final response
- validation summary
- changed files summary
- warnings

Agent Monitoring may show Direct Work run artifacts alongside existing
proposal-only artifacts, but it must clearly distinguish proposal-only runs
from Direct Work runs.

### Git Widget

Git Widget is the read-only review surface after Direct Work.

MVP rules:

- show repository status and changed files after a Direct Work run
- support a post-run refresh or a prompt to refresh
- do not stage automatically
- do not commit automatically
- do not push automatically
- do not reset, clean, restore, stash, or discard automatically
- preserve explicit repository-root boundaries

Diff review, commit, push, and recovery controls remain future explicit
approval-gated Git work.

### Global Activity

Global Activity should show Direct Work running, idle, and attention states when
Direct Work runtime exists.

Attention states should include failed, blocked, timed out, validation failed,
validation skipped, and review needed.

Global Activity must not become a hidden run launcher.

### Terminal

Terminal remains a manual operator command widget.

Direct Mode does not require the Terminal widget and must not disguise Codex
execution as a Terminal command started by the operator. Terminal may remain
useful for manual validation or diagnosis, but Direct Work run artifacts belong
to Agent Monitoring and Direct Mode observability.

### Agent Queue

Agent Queue may become an optional future source of approved Direct Work tasks.

MVP rules:

- no queue execution unless explicitly added in a later block
- no automatic launch
- no automatic acceptance
- no automatic commit or push
- no background queue runner

Queue-created Direct Work tasks, when implemented later, must still require
visible request preview, explicit mode/sandbox/repository approval, run
observability, Git review, and operator decision.

## Safety Rules

- Operator must choose Direct Work explicitly.
- Approved repository root is required.
- The task should be small and focused.
- The operator prompt must be visible before launch.
- The sandbox/mode must be visible before launch.
- Executor kind must be visible before launch.
- No secrets dumping.
- No production commands by default.
- No automatic external mutations.
- No automatic Git mutations.
- No commit or push without a separate explicit future feature.
- No hidden background execution.
- No silent reruns.
- No queue-driven execution in the MVP.
- Raw logs and final response must be visible.
- Failed, blocked, timed out, skipped-validation, dirty-Git, and warning states
  must be visible.

Direct Work should preserve `docs/AGENT_WORK_EFFICIENCY_CONTRACT.md`: small
focused blocks, declared changed layers, explicit validation plan, and
stop/split behavior when scope grows.

## Artifact Expectations

A future Direct Work run artifact should eventually capture:

```text
run_id
workspace_id
workbench_id
source_widget_instance_id when applicable
executor_kind
executor_version when available
mode
repo_root
operator_prompt
sandbox
approval_policy
executor_command
started_at
completed_at
duration_ms
status
raw_log
overview_steps if available
final_response
changed_files_summary
diff_summary or diff_reference when available
validation_summary
warnings
commit_status
```

Conceptual statuses may include:

- pending_approval
- starting
- running
- completed
- failed
- blocked
- timed_out
- cancelled
- validation_failed
- review_needed

These fields and statuses are conceptual only. They do not define storage,
schema, Rust domain types, TypeScript types, API DTOs, or current behavior.

## Relationship To Existing Contracts

Direct Mode must preserve:

- `docs/AGENT_RUN_OBSERVABILITY_CONTRACT.md`: Direct Work runs must expose
  Overview, Result, and Raw views.
- `docs/TOOL_ACTION_CONTRACT.md`: Direct Work is a high-power explicit
  executor/tool mode because it may edit files and run commands.
- `docs/GIT_WIDGET_CONTRACT.md`: Git review after Direct Work is read-only in
  the MVP and Git mutations remain explicit, visible, and approval-gated.
- `docs/AGENT_WORK_EFFICIENCY_CONTRACT.md`: Direct Work tasks should be small,
  focused, budgeted, validated, and split when broad.
- `docs/WIDGET_PROGRESSIVE_DISCLOSURE_CONTRACT.md`: first Direct Work UI should
  start with the smallest useful surface and move raw/debug detail behind
  explicit inspection.
- `docs/AGENT_OPERATING_MODEL.md`: Direct Work is an executor path for focused
  blocks, not a long-lived hidden autonomous agent.
- `docs/WORKSPACE_CONTRACT.md`: runs, logs, artifacts, repository roots, and
  review state belong to the owning Workspace and Workbench.
- `docs/WORKSPACE_COORDINATOR_AGENT_CONTRACT.md`: Coordinator proposals do not
  execute Direct Work until the operator explicitly approves the concrete run.
- `docs/AGENT_QUEUE_CONTRACT.md`: Queue items do not automatically execute,
  accept, commit, or push Direct Work in the MVP.

## Near-Term Implementation Plan

Follow-up blocks should stay small and focused:

1. Codex CLI detection / version smoke.
   - Detect whether Codex CLI is available through a backend/runtime boundary.
   - Capture version/status only.
   - Do not run tasks.

2. Codex direct-run backend foundation.
   - Add a one-shot backend execution boundary for an explicit prompt,
     repository root, sandbox, and approval policy.
   - Capture raw output and final status.
   - Do not add UI, queue execution, commits, pushes, or Git mutations.

3. Direct Work minimal UI.
   - Add the smallest useful operator surface for prompt, repo root, mode,
     sandbox, and run launch.
   - Follow Minimal or narrow Operational widget disclosure.
   - Do not add Full / Expert controls by default.

4. Agent Monitoring direct-run view.
   - Show Direct Work runs with Overview / Result / Raw.
   - Include executor kind, mode, status, duration, final response, warnings,
     changed files, and validation summary.

5. Git Widget post-run review link.
   - Let the operator refresh or open read-only repository status after a
     Direct Work run.
   - Do not stage, commit, push, reset, clean, restore, or stash.

6. Validation capture.
   - Capture requested validation commands and pass/fail/skipped state.
   - Keep raw validation output available without making it the primary view.

7. Hardening.
   - Tighten path validation, timeouts, output caps, cancellation strategy,
     sensitive-output warnings, and failure states.
   - Keep Dangerous Mode out of MVP unless explicitly requested and designed.

## Non-Goals

This contract does not implement:

- Codex execution
- CLI detection implementation
- frontend UI
- backend/Tauri commands
- storage/schema changes
- queue execution
- commit or push behavior
- Git mutations
- embedded PTY
- interactive agent session
- hidden background execution
- automatic external mutations
- provider-backed executor calls
- new dependencies
- current product behavior changes
