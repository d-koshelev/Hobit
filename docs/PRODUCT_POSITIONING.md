# Product Positioning

## Core Statement

Hobit is an AI Workbench for precise, fast, and efficient work with AI agents.

It is not just an agent runner. Hobit is an operator-controlled environment for planning, preparing, executing, validating, reviewing, and continuing AI-assisted work.

Workspace Agent is the foreground interactive AI agent widget. It is chat-based
as an interaction model, but chat is not its capability limit: the target
Workspace Agent can perform interactive Workspace work through controlled
capabilities for reading, coding, review, file edits, commands and validation,
database work, task orchestration, evidence review, and delegation. Multiple
Workspace Agent widgets can exist in one Workspace, each with independent
context, thread, and working directory.

Agent Executor is the async/background execution worker for bounded Queue
tasks. Queue is for promoted, larger, delayed, or overnight work. Executor does
not define the outer limit of what Workspace Agent can eventually do in the
foreground.

AI agents execute focused tasks.
Hobit makes that work structured, repeatable, safe, observable, and fast.

## Positioning Rule

Future implementation must preserve Hobit as an AI Workbench, not drift toward a generic agent runner or hidden automation shell.

Hobit structures the work around AI agents. It does not replace the operator, hide decisions, or make agent execution the product center.

## Product Principles

- Operator-controlled, not hidden automation.
- Structured requests, not ad-hoc prompts.
- Workspace Agent foreground work: plan, reason, read approved Workspace
  context, propose or apply approved edits, run approved validation, review
  results, and orchestrate next steps from the central work surface.
- Focused executor tasks for async/background Queue work, not endless agent
  threads.
- Queue for promoted/larger async work blocks, not every idea or small
  operation.
- Agent Executor as the runtime slot that owns run detail, logs, final
  responses, and execution visibility for Queue/Executor work.
- Small efficient blocks, not over-broad multi-layer tasks by default.
- Progressive widget disclosure: Minimal first, Operational when useful, Full / Expert only when intentionally expanded.
- Reusable Request Templates and Response Templates as product direction.
- Validation and review as first-class workflow steps.
- Observable work through activity, logs, artifacts, and history.
- Resumable Workspaces for continuing work later.
- Isolated Workspaces for unrelated problems, with multiple Workbenches only as surfaces for the same problem.
- Widgets as work surfaces and capability providers around agent work.
- AI suggests or executes through visible, bounded, policy-aware capabilities;
  Hobit structures and validates the work.

## What Hobit Is Not

Hobit is not:

- a generic chatbot shell
- only an agent runner
- hidden autonomous automation
- a replacement for operator approval
- a place to inject secrets into prompts
- a runtime that silently mutates user work
- a script executor, terminal wrapper, IDE clone, runbook runner, or knowledge manager

These capabilities may exist as explicit widgets, tools, templates, or workflow surfaces, but they must remain bounded, visible, and operator-controlled.

## Current Implementation Boundary

This positioning is a product contract and direction statement.

The current repository does not implement hidden automatic agent execution, Request Template editing, Response Template editing, response validation, rich Workspace Agent/Executor UI, or scratch execution workspace support.

Current implemented behavior remains the Empty Workbench shell, Workspace lifecycle foundation, Widget Catalog foundation, persisted widget state/layout foundation, widget-local Logs panel foundation, app-shell Recent Activity drawer, and the current user-facing widget set summarized in `docs/CURRENT_WIDGET_SURFACE.md`: Workspace Agent, Agent Queue, Terminal, Agent Activity, Notes, Knowledge / Skills, Finder, Database / JDBC Preview, and Runbook Preview. Agent Executor and Git remain supporting/compatibility surfaces, not Stable v0.1 product widgets. Workspace Agent currently reuses the existing `interactive-agent` widget id/component as the legacy Coordinator compatibility surface and is a foreground chat-based agent widget for planning, task drafting, review, and decision-making. It has visible-context-only mock/local provider responses, validated provider proposal drafts, visible attachments, Skill attach, Queue/Executor result metadata attach, Executor selected excerpt / preview attach, pasted result review, and a backend-owned configured HTTP JSON provider call path that keeps `allowed_tools: []` and sends no hidden context. Multiple Workspace Agent widgets may exist in one Workspace; each owns its current-session context/thread/working-directory state. Agent Queue is the explicit operator-controlled async execution pipeline for promoted/larger work blocks; it is not the default destination for every idea or small operation. Agent Executor is the supporting Direct Work / Codex runtime slot backed by the existing `agent-run` widget identity and backend/Tauri Codex Direct Work commands that own run detail, logs, final responses, and persisted run/log/result artifacts without Git mutation, auto-commit, or auto-push. Current Codex Direct Work requires an explicit execution workspace path; the compatibility field remains `repo_root` and today expects an existing repository or local project folder. Terminal is a desktop PTY-first manual shell surface with Windows and Linux live PTY support today and a collapsed explicit one-shot command fallback for persisted Terminal widget instances; macOS PTY support remains deferred. Finder supports explicit root approval, bounded column navigation, bounded file preview/edit-in-place, and Finder-owned Git status, diff, history, manual local commit, and safe manual push actions. The standalone Git compatibility surface supports manual desktop-only read-only status refresh for an explicit transient repository root and explicit selected-file local commit support. Notes persists Workspace-local notes through explicit save. Agent Queue has manual task planning, visible Executor assignment, explicit assigned-task start, safe selected-task Executor run-link history, `executionPolicy` fields, a visible frontend-driven Sequential Queue Runner, and explicit operator-armed Queue Autorun. Queue runner behavior is current-session-only; it has no durable backend scheduler, reconnect/resume, server worker, hidden unarmed dispatch, or Workspace Agent-triggered execution. Database / JDBC is a Preview connector metadata and bounded mock/safe read-only query surface with conservative read-only SQL validation plus bounded mock/safe execution; it has no real external database execution or credential handling. Runbook is a Preview local/manual steps surface with local state and notes/evidence only. Agent Chat, Agent Monitoring, Template Library, Dock, Agent CLI, Script Runner, JIRA, Confluence, Image Edit, and separate legacy Coordinator surfaces are not current user-facing catalog surfaces. Direct Workspace Agent filesystem read/write capability, command or SSH execution, JDBC capability execution, hidden Git mutation, unified permission/policy UI, full provider tool mode, audit emission/persistence, provider settings UI, secrets UI, direct HTTPS vendor adapter, template storage/editing/request generation/response validation, durable queue scheduling, force push, push-all, reset/clean/stash/fetch/checkout, scratch execution workspace support, and hidden automatic agent execution are not implemented. Coordinator was the previous user-facing name for the Workspace Agent surface and remains only a legacy compatibility term.

## Related Contracts

- `docs/PRODUCT_CONTRACT.md` defines Hobit as a modular AI Workbench.
- `docs/AI_WORKBENCH_CONTRACT.md` defines Workbench and Workspace terms.
- `docs/WORKSPACE_CONTRACT.md` defines resumable Workspace behavior, context isolation, and the multi-Workspace/multi-Workbench boundary.
- `docs/DESKTOP_FIRST_SERVER_READY_ARCHITECTURE_CONTRACT.md` defines
  desktop-first host boundaries and future server-ready architecture guardrails
  without implementing server or enterprise runtime behavior.
- `docs/WIDGET_CONTRACT.md` defines widgets as first-class work surfaces.
- `docs/WIDGET_PROGRESSIVE_DISCLOSURE_CONTRACT.md` defines Minimal, Operational, and Full / Expert widget display levels.
- `docs/SCRIPT_RUNNER_WIDGET_CONTRACT.md` defines the future Script Runner Widget as an explicit operator-controlled configured local script action, not a hidden automation path or current runtime behavior.
- `docs/GIT_WIDGET_CONTRACT.md` defines the future Git review/control widget for agent-completed code work.
- `docs/TEMPLATE_CONTRACT.md` defines future Request Templates and Response Templates.
- `docs/AGENT_OPERATING_MODEL.md` defines future coordinator and executor agent roles.
- `docs/AGENT_WORK_EFFICIENCY_CONTRACT.md` defines small-block execution budgets, validation profiles, and stop/split rules.
- `docs/WORKSPACE_COORDINATOR_AGENT_CONTRACT.md` is the legacy-named contract for future approved-context Workspace Agent behavior and controlled cross-widget action proposals.
- `docs/AGENT_QUEUE_CONTRACT.md` defines the future operator-controlled agent command queue, command history, and review inbox.
- `docs/AGENT_RESPONSE_CONTRACT.md` defines current project-agent final response requirements.
