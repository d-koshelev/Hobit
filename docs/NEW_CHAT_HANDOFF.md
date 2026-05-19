# New Chat Handoff

## Purpose

This document captures the current Hobit state for the next ChatGPT/Codex
thread after Blocks 210 through 216. It is a compact orientation note, not a
new product contract and not a replacement for the active contract index.

## Current Source-Of-Truth Reading Order

Start with:

- `AGENTS.md`
- `docs/ACTIVE_CONTRACT_INDEX.md`
- `docs/CURRENT_WIDGET_SURFACE.md`
- `docs/CODE_ORGANIZATION_CONTRACT.md`
- `docs/ARCHITECTURE.md`
- `docs/AGENT_RESPONSE_CONTRACT.md`

Future prompts should start from `docs/ACTIVE_CONTRACT_INDEX.md` and add only
the domain contracts relevant to the block. Do not read deferred or
compatibility-only contracts as active implementation direction unless the
block explicitly names that surface.

## Product Model Summary

- Coordinator Chat is the primary operator-facing AI surface.
- Widgets expose controlled capabilities inside the Workbench.
- Agent Queue organizes executable tasks.
- Agent Executors execute assigned tasks and provide execution visibility.
- Git, Notes, Database / JDBC, and Terminal are controlled widgets, not hidden
  tools.
- The operator controls autonomy, approvals, execution, and context sharing.
- No hidden Coordinator tool access, hidden context reading, or hidden
  execution is part of the current product model.

## Current Widget Surface

Ready:

- Agent Executor
- Git
- Terminal
- Notes

Preview:

- Agent Queue
- Coordinator Chat
- Database / JDBC
- Runbook

Retired, hidden, or compatibility-only surfaces:

- old Agent Chat
- old Agent Monitoring
- Template Library
- Dock / Docking Station
- Agent CLI
- Script Runner
- JIRA
- Confluence
- Image Edit
- old Database/JDBC planned card if distinct from the current `database-jdbc`
  widget

Compatibility ids remain intentional. `agent-run` backs Agent Executor,
`interactive-agent` backs Coordinator Chat, and `database-jdbc` backs the
current Database / JDBC preview widget.

## Implemented Capability Summary

Agent Executor:

- Direct Work / Codex execution.
- Live logs.
- Stop/cancel.
- Final response display.
- Changed-files summary.
- Read-only diff summary.
- Validation capture.
- Run history.
- Queue-started run handoff.

Git:

- Read-only status.
- Read-only diff.
- Explicit local commit API/UI with confirmation.
- No push, reset, clean, stash, fetch, polling, watching, or automatic commit.

Notes:

- Workspace-local notes storage/API/UI.
- List, filter, create new, edit, save, and pin flows.
- No autosave, delete, tags, full Notebook model, Markdown rendering, Mermaid,
  or AI-in-Notes behavior.

Agent Queue:

- Manual task model/API/UI.
- Task assignment to a visible Agent Executor.
- Explicit Run assigned task action.
- Queue-to-Executor handoff.
- Final-status auto-refresh.
- Mocked Queue-to-Executor UI smoke harness exists and passes.

Coordinator Chat:

- User-facing Coordinator Chat title.
- Local placeholder chat only.
- No provider, runtime, tools, Queue integration, JDBC integration, hidden
  context access, or file/Git/Terminal mutation.

Database / JDBC:

- Connector metadata contract.
- Workspace-local connector metadata storage/API.
- Preview widget shell for non-secret metadata.
- No credentials, SQL execution, Java sidecar, `EXPLAIN`, result grid, SQL
  formatter, AI assistance, or Coordinator JDBC tool runtime.

Terminal:

- Desktop-only one-shot command runner for persisted Terminal widget
  instances.
- Explicit program, argv, working directory, timeout, and output caps.
- Not a shell, PTY, streaming session, stdin session, command history, Script
  Runner, or Agent-triggered execution path.

Runbook:

- Preview/minimal local procedural steps surface.
- Local step states and local notes/evidence only.
- Persistence, edit mode, builder, Queue integration, execution, and
  agent-assisted steps are deferred.

## Major Safety Boundaries

- No auto-commit.
- No push.
- No reset or clean.
- No hidden Coordinator tool use.
- No hidden context reading.
- No write SQL.
- No Terminal PTY.
- No scheduler or auto-dispatch.
- No medical or healthcare roadmap.
- Secrets never enter AI prompts.
- JDBC stores no credentials.
- Queue does not show live execution logs.
- Agent Executor owns execution visibility.

## Current Known Gaps

- Real desktop Queue-to-Executor smoke was not verified because this
  environment could not reliably drive the Tauri WebView.
- The default Tauri app-data database path was inaccessible in this
  environment; use `HOBIT_DATABASE_PATH` for desktop smoke runs.
- Coordinator Chat has no provider, runtime, or tools yet.
- Database / JDBC has no SQL execution, Java sidecar, `EXPLAIN`, result grid,
  SQL formatter, or AI assistance yet.
- Terminal PTY was blocked/deferred after the earlier crates.io/Schannel issue
  and rollback.
- Evidence/Sources is not implemented.
- AI context/token economy is not implemented.
- YouTube Analyst is not implemented.
- Workspace continuity/crash recovery is deferred.
- Queue dependencies, scheduler, and auto-dispatch are not implemented.
- Git push is not implemented.
- Notes autosave, delete, and tags are not implemented.

## Refactor Status

- `crates/hobit-app/src/workspace_service/tests.rs` was split by domain.
- `crates/hobit-tools/src/git.rs` was split into focused modules.
- Frontend Workbench action wiring was split into focused action groups.
- The recurring file-size warnings targeted by Blocks 213 through 215 were
  removed as of the last successful full validation for those blocks.
- Compatibility ids and compatibility paths were preserved.

## Recommended Next Blocks

Primary path:

- 217 - Coordinator Chat product UI polish or Coordinator runtime/provider
  contract.
- 218 - Coordinator action proposal UI pattern.
- 219 - JDBC read-only query execution backend.
- 220 - JDBC query results UI.
- 221 - Coordinator to JDBC read-only proposal flow.
- 222 - Evidence/Sources contract.
- 223 - AI context/token economy contract.
- 224 - YouTube Analyst widget contract.

Alternative stabilization path:

- Real desktop Queue-to-Executor smoke using `HOBIT_DATABASE_PATH`.
- Git commit UI real smoke.
- Workspace continuity/crash recovery contract.

## New Chat Opening Prompt

Copyable prompt:

```text
We are continuing Hobit after Block 216.
Read docs/ACTIVE_CONTRACT_INDEX.md first, then the default current-state docs
it names and only the domain contracts relevant to the next block.

Current product model: Coordinator-centered Workbench. Coordinator Chat is the
primary operator-facing AI surface. Widgets expose controlled capabilities.
Agent Queue organizes tasks. Agent Executors execute assigned tasks and own
execution visibility. Operator approval and explicit context sharing remain the
safety boundary.

Current widget surface:
Ready: Agent Executor, Git, Terminal, Notes.
Preview: Agent Queue, Coordinator Chat, Database / JDBC, Runbook.

Choose the next target from the recommended next blocks in
docs/NEW_CHAT_HANDOFF.md unless the user provides a different focused block.
Do not revive a separate superseded Interactive Agent direction.
Do not implement from Coordinator-deferred old docs.
Do not add medical or healthcare scope.
```
