# Agent Run Observability Contract

## Purpose

This contract defines how future Hobit agent, executor, terminal-backed, or task runs should be observable to the operator.

Hobit must not expose future agent work only as raw terminal or agent output. Every agent/task execution should be understandable through three linked views:

- Raw Log
- Overview Log
- Result Report

This is a documentation and product/domain contract only. It does not implement storage, runtime execution, log parsing, response validation, Tauri commands, Workspace API changes, or agent integration.

## Current Implementation Boundary

The current repository has no real agent runtime, no executor integration, no Terminal runtime, no Agent Chat runtime, no response parser, and no agent execution log model.

The frontend has an insertable static Agent Run placeholder that previews future Overview Log, Result Report, and Raw Log sections. That placeholder is not an executable run surface and does not start runs, stream logs, persist run state, parse responses, validate results, summarize runtime events, integrate executor tasks, or call agents.

The future Script Runner Widget contract also uses Raw Log, Overview Log, and Result Report concepts for explicit operator-controlled local script actions. Script Runner is not implemented, and script runs are tool/widget actions rather than necessarily AI agent runs. See `docs/SCRIPT_RUNNER_WIDGET_CONTRACT.md`.

`docs/AGENT_QUEUE_CONTRACT.md` defines the future Agent Queue as an operator-controlled agent command queue, command history, and review inbox that may link to Agent Run observability. The frontend has a static Agent Queue placeholder preview, but queue storage, response capture, response validation, and executor integration are not implemented yet.

Implemented observability today is limited to:

- widget-local Logs panels
- persisted widget logs for widget add/state/layout mutations
- workspace-scoped Recent activity summaries

Those foundations are not agent run observability yet.

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

1. Coordinator generates an executor request from a Request Template.
2. Executor run produces raw events and logs.
3. Hobit displays Overview Log for operator comprehension.
4. Executor final response becomes the Result Report.
5. Coordinator validates Result Report against the selected Response Template.
6. Git Widget supports post-code-block review when code work is involved.
7. Coordinator decides accept, fix, rerun, or next block.

For coordinator/executor role rules, see `docs/AGENT_OPERATING_MODEL.md`.

## Relation To Agent Queue

Future Queue Items should link to Agent Run observability when a run exists. Queue cards may summarize run status or the latest Overview Log step, while Queue Item detail should expose Overview Log, Result Report, and Raw Log.

The Result Report is the main acceptance artifact for a Queue Item, but it must not hide failed raw execution, skipped validation, dirty Git state, or blocked work. Queue decisions remain explicit operator decisions.

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
- real run UI beyond the static Agent Run placeholder preview
- Tauri commands
- Workspace API changes
- runtime execution
- agent execution integration
- Terminal runtime
- Agent Chat runtime
- log parser
- overview summarizer
- response parser
- response validator
- Git association
- executable agent run widgets
- current widget behavior changes
- product behavior changes
