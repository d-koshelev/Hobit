# Agent Run Observability Contract

## Purpose

This contract defines how future Hobit agent, executor, terminal-backed, or task runs should be observable to the operator.

For current contract navigation, read `docs/ACTIVE_CONTRACT_INDEX.md`. Older
Agent Chat / Agent Monitoring language in this document is retained for
compatibility/reference; the current user-facing execution surface is Agent
Executor, and the current widget inventory is defined in
`docs/CURRENT_WIDGET_SURFACE.md`.

Product role boundary: Coordinator is the primary foreground AI agent and
central operator-facing work surface for interactive Workspace work through
approved capabilities. Agent Executor is the async/background worker for
bounded Queue task prompts. Executor owns queued execution logs, results, run
history, cancellation, and review visibility, but it does not define the
maximum capability set available to Coordinator.

Hobit must not expose future agent work only as raw terminal or agent output. Every agent/task execution should be understandable through three linked views:

- Raw Log
- Overview Log
- Result Report

This is a documentation and product/domain contract only. It does not implement storage, runtime execution, log parsing, response validation, Tauri commands, Workspace API changes, or agent integration.

## Current Implementation Boundary

The current repository has a narrow frontend/backend Codex Direct Work run artifact foundation, but no full agent runtime, no interactive Terminal runtime, no executable Coordinator runtime, no response parser, and no agent execution log model. The Terminal widget has only a bounded desktop one-shot command path with widget-local lifecycle logs and structured results. Coordinator Chat has a proposal-only preview with explicit current-session visible context and, in the desktop shell, can request a backend provider response when an explicit HTTP provider is configured or use local/mock fallback. Current Coordinator provider requests keep `allowed_tools: []`. Coordinator Chat does not stream logs, execute tools, read Terminal output, create Queue items by itself, or mutate Workspace content.

The frontend has an insertable Direct Work / Codex surface that reuses the existing `agent-run` definition id. Its secondary Agent Monitoring details can read persisted Agent Chat proposal-only result artifacts for the current Workspace Workbench, display read-only Overview, Result, and Raw sections for the selected stored proposal artifact, and explicitly create a review-only Agent Queue item from a selected valid local mock proposal result. This viewer does not display persisted Direct Work artifacts, stream logs, monitor Terminal results, read arbitrary widget results, parse responses, validate results, summarize runtime events, execute Queue items, apply proposals, or call agents.

The future Script Runner Widget contract also uses Raw Log, Overview Log, and Result Report concepts for explicit operator-controlled local script actions. Script Runner is not implemented, and script runs are tool/widget actions rather than necessarily AI agent runs. See `docs/SCRIPT_RUNNER_WIDGET_CONTRACT.md`.

`docs/AGENT_QUEUE_CONTRACT.md` defines Agent Queue as an operator-controlled agent command queue, command history, and review inbox that may link to Agent Run observability. Current Agent Queue can explicitly start assigned tasks in Agent Executor, record safe Queue task to Executor run-link metadata, show selected-task latest run and compact history rows, and run eligible assigned tasks through the explicit operator-armed Queue Autorun preview while Hobit remains open. Queue still does not own raw run details, response capture, response validation, durable scheduling, reconnect/resume, or backend worker behavior.

Implemented observability today is limited to:

- Agent Activity widget current-session readable timeline events for Workspace
  Agent Codex runs and Agent Executor streaming Direct Work runs
- widget-local Logs panels
- persisted widget logs for widget add/state/layout mutations
- Terminal one-shot command run/result artifacts
- Codex Direct Work run/result artifacts stored for an allowed `agent-run` widget owner
- a read-only Agent Executor run history API for stored Direct Work and Direct
  Work validation run/result/log summaries
- a read-only Agent Executor diff summary API for explicit repository roots,
  with bounded changed-file, numstat, and optional capped patch-preview data
- Agent Chat proposal-only mock run/result artifacts
- Agent Monitoring read-only Overview/Result/Raw display for those Agent Chat proposal artifacts
- explicit Agent Queue review items created from those proposal artifacts
- workspace-scoped Recent activity summaries

Those foundations are not full agent run observability yet.

The Agent Activity MVP is frontend-only and current-session only. It maps
existing Direct Work stream events into readable timeline entries such as run
started, thread started, turn started, command running, command finished or
failed, response prepared, and run completed or failed. It does not change
Codex execution, thread resume, Queue/Executor runtime behavior, backend DTOs,
storage schema, or persistence. Raw JSON/event previews and technical details
remain collapsed by default.

First real AI/provider calls must follow
`docs/AI_INTEGRATION_READINESS_CONTRACT.md`: every call should produce a
visible run/result artifact when persistence is available, Agent Monitoring
should expose Overview / Result / Raw inspection, and raw provider data must not
expose secrets or unsafe metadata.

Direct Work runs must follow `docs/DIRECT_MODE_AGENT_CONTRACT.md`. The current
Direct Work / Codex launch surface can persist Codex Direct Work widget
run/log/result artifacts for an allowed Agent Monitoring (`agent-run`) widget
instance. A read-only Agent Executor history API can list recent stored Direct
Work and Direct Work validation artifacts for that owning widget and fetch
their stored result/log summaries. The Agent Executor frontend has a compact
read-only history/detail panel for those artifacts. A separate read-only Agent
Executor diff summary API can summarize explicit-root Git changes for future
UI without creating runs, results, queue items, or Git mutations. Full Raw /
Overview / Result views remain future work. Codex CLI is the first planned
executor kind, but the observability model must remain executor-agnostic.

Workspace Agent Direct Work keeps the chat transcript final-conversation
focused: normal chat shows operator messages and final Codex responses, while
the live one-line activity summary and Agent Activity timeline show execution
progress separately. Agent Activity is the readable current-session timeline;
raw Direct Work details remain collapsed in their owning surfaces.

## Core Model

A future `AgentRun` or `ExecutorRun` should expose three linked views:

```text
AgentRun
  -> Raw Log
  -> Overview Log
  -> Result Report
```

The views have different jobs:

- Raw Log preserves exact traceability.
- Overview Log explains live progress in human-readable steps.
- Result Report is the final structured review artifact.

The views must be linked where practical, but they must not replace each other.

## Raw Log

### Purpose

Raw Log exists for:

- exact traceability
- debugging
- audit trail
- preserving complete agent, tool, and runtime output

### Contents

Raw Log should include, when available:

- raw agent output
- tool calls
- stdout
- stderr
- command output
- validation command output
- timestamps
- errors
- cancellation events
- timeout events
- raw structured events from the runtime

### Rules

- Raw Log must not be silently discarded.
- Raw Log may be hidden or collapsed by default.
- Raw Log should not be the primary operator view.
- Raw Log may contain noisy output, but it preserves traceability.
- Raw Log entries should keep enough ordering and timestamp information to reconstruct what happened.
- Sensitive data handling must be explicit in future implementation.
- Redaction policy, if introduced, must be visible and auditable.

## Overview Log

### Purpose

Overview Log exists for:

- live operator comprehension
- readable progress
- high-level activity grouped into logical steps

### Contents

Overview Log should include concise human-readable steps such as:

- inspecting code
- reading contracts
- adding file `xyz`
- editing file `xyz`
- adding function or component `abc`
- implementing feature `abc`
- updating docs
- running validation
- fixing validation error
- creating commit
- blocked
- waiting
- failed
- completed

### Rules

- Overview Log summarizes activity; it does not replace Raw Log.
- Overview Log should be concise.
- Overview Log should preserve ordering and timestamps when practical.
- Overview events may be derived from structured runtime events, tool events, or later summarization.
- Overview events should link to related Raw Log entries when practical.
- Overview must not invent success when raw execution failed.
- Generated summaries must not fabricate events, files, commands, or results.
- Failed, blocked, cancelled, and waiting states must be explicit.

## Result Report

### Purpose

Result Report exists as:

- final acceptance/review artifact
- response contract output
- coordinator decision support

Result Report is tied to Response Templates and `docs/AGENT_RESPONSE_CONTRACT.md`.

### Contents

Result Report should include, when relevant:

- block number/title
- status
- files changed
- what changed
- validation results
- warnings
- commit hash/message
- out-of-scope or intentionally not implemented items
- final git status
- next recommended action
- links or references to Git Widget review when available

### Rules

- Result Report is not a raw log.
- Result Report should be structured and concise.
- Result Report must honestly report failed validation.
- Result Report must honestly report skipped validation.
- Result Report must not claim success if commit or validation failed.
- Result Report should distinguish implementation success, validation success, commit success, and acceptance state.
- Result Report should be suitable for coordinator accept, fix, rerun, or next-block decisions.

## Future UI Direction

Future Agent Run, Executor Run, Agent Chat, Agent CLI, or Terminal-backed task UI should expose clear views or sections:

- Overview
- Result
- Raw

Recommended default:

- while running: show Overview by default
- after completion: show Result by default, with Overview still available
- for debugging/audit: make Raw available through an explicit tab, drawer, or expandable section

Future UI should provide:

- current status card
- progress or step list
- final result report
- expandable raw log
- links to Git Widget review after code work
- clear failed, blocked, cancelled, and waiting states

The UI must keep Raw Log available without making raw output the primary operator experience.

## Relation To Coordinator And Executor Workflow

Expected future flow:

1. Coordinator works foreground in the active Workspace through approved
   capabilities when the work is interactive, bounded, and operator-facing.
2. Coordinator promotes larger, delayed, long-running, or overnight work to
   Queue when async/background execution is appropriate.
3. Executor receives a bounded Queue task prompt and produces raw events and
   logs.
4. Hobit displays Overview Log for operator comprehension.
5. Executor final response becomes the Result Report.
6. Coordinator reviews approved Result Report, Overview Log, Raw Log excerpt,
   validation output, or Git review context.
7. Coordinator decides accept, fix, rerun, continue foreground, or delegate the
   next block.

For coordinator/executor role rules, see `docs/AGENT_OPERATING_MODEL.md`.

Future Workspace-aware Coordinator Agent behavior may use approved Agent Run Result Report, Overview Log, or Raw Log context to propose follow-up actions. Raw trace, failed validation, and skipped validation must remain reviewable. For approved context and proposal rules, see `docs/WORKSPACE_COORDINATOR_AGENT_CONTRACT.md`.

## Relation To Agent Queue

Future Queue Items should link to Agent Run observability when a run exists. Queue cards may summarize run status or the latest Overview Log step, while Queue Item detail should expose Overview Log, Result Report, and Raw Log.

The Result Report is the main acceptance artifact for a Queue Item, but it must not hide failed raw execution, skipped validation, dirty Git state, or blocked work. Queue decisions remain explicit operator decisions.

Queue/Executor observability is for async/background work. It must not force
every Coordinator foreground action through Queue, and it must not imply that
Executor is the only agent allowed to perform work.

## Relation To Request And Response Templates

Request Templates define requested work and required validation.

Response Templates define expected Result Report structure.

Rules:

- Overview Log may help monitor execution before the final response exists.
- Result Report should be checked against the selected Response Template when future response validation exists.
- Raw Log remains available independently of template validation.
- Template validation must not hide raw failures.
- Response Template conformance does not prove the underlying work succeeded.

For template asset rules, see `docs/TEMPLATE_CONTRACT.md`.

## Relation To Widget Logs And Workspace Activity

Agent run observability may use widget-local logs, but it is more structured than the current generic Logs panel.

Rules:

- Agent Chat, Terminal, Agent CLI, and future Executor widgets should expose Raw Log, Overview Log, and Result Report views when they run agent/task execution.
- Future Script Runner should expose Raw Log, Overview Log, and Result Report views for script task execution while remaining an explicit operator-controlled tool/widget action.
- Raw Log, Overview Log, and Result Report are distinct from generic workspace activity.
- Workspace activity may summarize run lifecycle events at a higher level.
- Widget-local logs can record run lifecycle and operator-relevant events.
- Runtime log streaming/polling is future work and is not implemented by this contract.

## Relation To Git Widget

After code work, Result Report should link to Git review context when available.

The Git Widget can show:

- repository status
- changed files
- validation association when future support exists
- commit state
- push state

Rules:

- Git Widget does not replace Result Report.
- Result Report must not hide dirty Git state.
- Result Report must not hide failed or skipped validation.
- Git review remains operator-controlled.
- Git mutations remain explicit and approval-aware.

For Git review rules, see `docs/GIT_WIDGET_CONTRACT.md`.

Future explicit commit actions should follow
`docs/GIT_COMMIT_SUPPORT_CONTRACT.md` and record enough result detail for the
operator to distinguish run success, validation status, commit success, and
remaining Git review state.

## Relation To Direct Mode

Direct Work runs are executor/task runs and must be observable here. Current
implementation persists the raw stdout/stderr, final message, command summary,
status, duration, and no-auto-commit/no-auto-push flags as widget result JSON,
with lifecycle widget logs. The Agent Activity MVP maps current-session
streaming Direct Work events from Workspace Agent and Agent Executor into a
readable timeline without persisting that timeline. A dedicated persisted full
Raw / Overview / Result Direct Work view remains future work.

Expected Direct Work mapping:

- executor command, raw Codex CLI output, stderr/stdout where applicable, and
  validation command output feed Raw Log
- started, inspecting, editing, validating, blocked, failed, and completed
  steps feed Overview Log when available
- final Codex response and required block report feed Result Report
- changed files and validation summaries remain visible and link to Git Widget
  review when available

Direct Work observability must not hide failed validation, skipped validation,
dirty Git state, blocked execution, or warnings. Proposal-only artifacts and
Direct Work artifacts must be visually distinguishable when shown together in
Agent Monitoring.

## Future Event And Data Concepts

Future implementation may introduce concepts such as:

- `AgentRun`
- `AgentRunStatus`
- `RawLogEntry`
- `OverviewLogEntry`
- `ResultReport`
- `ValidationResult`
- `RunArtifact`
- `RunStep`
- `RunWarning`
- `RunError`

Suggested status values:

- queued
- waiting_for_approval
- running
- blocked
- failed
- cancelled
- timed_out
- completed
- result_ready
- accepted
- fix_requested
- rerun_requested

These are conceptual only. This contract does not define Rust types, TypeScript types, storage schema, or API DTOs.

## Safety Principles

- No hidden execution.
- No hidden mutation.
- No discarded raw trace.
- Overview summaries should link to raw trace where practical.
- Failed validation must be visible.
- Skipped validation must be visible.
- User/operator approval remains required for applying changes when applicable.
- Secrets and sensitive output handling must be explicit in future implementation.
- Generated summaries must not fabricate events.
- Raw Log availability must not be used as an excuse to make the primary UI unreadable.
- Result Report must not claim success when required execution, validation, or commit steps failed.

## Non-Goals

This contract does not implement:

- storage schema or migrations
- Rust domain types
- TypeScript types
- real run UI beyond the read-only Agent Chat proposal artifact viewer in Agent Monitoring
- Tauri commands
- Agent Monitoring Direct Work UI/display
- agent execution integration
- Terminal runtime
- executable Agent Chat runtime
- log parser
- overview summarizer
- response parser
- response validator
- Git association
- executable agent run widgets
- current widget behavior changes
- product behavior changes
