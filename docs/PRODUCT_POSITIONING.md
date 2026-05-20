# Product Positioning

## Core Statement

Hobit is an AI Workbench for precise, fast, and efficient work with AI agents.

It is not just an agent runner. Hobit is an operator-controlled environment for planning, preparing, executing, validating, reviewing, and continuing AI-assisted work.

AI agents execute focused tasks.
Hobit makes that work structured, repeatable, safe, observable, and fast.

## Positioning Rule

Future implementation must preserve Hobit as an AI Workbench, not drift toward a generic agent runner or hidden automation shell.

Hobit structures the work around AI agents. It does not replace the operator, hide decisions, or make agent execution the product center.

## Product Principles

- Operator-controlled, not hidden automation.
- Structured requests, not ad-hoc prompts.
- Focused executor tasks, not endless agent threads.
- Small efficient blocks, not over-broad multi-layer tasks by default.
- Progressive widget disclosure: Minimal first, Operational when useful, Full / Expert only when intentionally expanded.
- Reusable Request Templates and Response Templates as product direction.
- Validation and review as first-class workflow steps.
- Observable work through activity, logs, artifacts, and history.
- Resumable Workspaces for continuing work later.
- Isolated Workspaces for unrelated problems, with multiple Workbenches only as surfaces for the same problem.
- Widgets as work surfaces around agent work.
- AI suggests or executes within bounded tasks; Hobit structures and validates the work.

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

The current repository does not yet implement automatic agent execution, Request Template editing, Response Template editing, response validation, rich coordinator/executor UI, or scratch execution workspace support.

Current implemented behavior remains the Empty Workbench shell, Workspace lifecycle foundation, Widget Catalog foundation, persisted widget state/layout foundation, widget-local Logs panel foundation, workspace activity summaries, and the current user-facing widget set summarized in `docs/CURRENT_WIDGET_SURFACE.md`: Agent Executor, Agent Queue, Coordinator Chat, Database / JDBC, Runbook, Git, Terminal, and Notes. Coordinator Chat currently reuses the existing `interactive-agent` widget id/component as the Coordinator Chat compatibility surface with visible-context-only mock/local provider responses, validated provider proposal drafts, and a backend-owned configured HTTP JSON provider call path that keeps `allowed_tools: []` and sends no hidden context. Agent Executor is the Ready Direct Work / Codex surface backed by the existing `agent-run` widget identity and backend/Tauri Codex Direct Work commands that persist run/log/result artifacts without Git mutation, auto-commit, or auto-push. Current Codex Direct Work requires an explicit execution workspace path; the compatibility field remains `repo_root` and today expects an existing repository or local project folder. Terminal is a desktop PTY-first manual shell surface with Windows-only live PTY support today and a collapsed explicit one-shot command fallback for persisted Terminal widget instances. Git supports manual desktop-only read-only status refresh for an explicit transient repository root and explicit selected-file local commit support. Notes persists Workspace-local notes through explicit save. Agent Queue is a preview task surface with manual task planning, visible Executor assignment, explicit assigned-task start, `executionPolicy` fields, and a visible frontend-driven Sequential Queue Runner that is current-session-only; it has no durable backend scheduler. Database / JDBC is a Preview connector metadata and bounded mock/safe read-only query surface with conservative read-only SQL validation plus bounded mock/safe execution; it has no real external database execution or credential handling. Runbook is a local/manual steps MVP with local state and notes/evidence only. Agent Chat, Agent Monitoring, Template Library, Dock, Agent CLI, Script Runner, JIRA, Confluence, Image Edit, and separate legacy Coordinator surfaces are not current user-facing catalog surfaces. Provider settings UI, secrets UI, direct HTTPS vendor adapter, template storage/editing/request generation/response validation, durable queue scheduling, Git push/reset/clean/stash/fetch, scratch execution workspace support, and automatic agent execution are not implemented.

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
- `docs/WORKSPACE_COORDINATOR_AGENT_CONTRACT.md` defines future approved-context Coordinator behavior and controlled cross-widget action proposals.
- `docs/AGENT_QUEUE_CONTRACT.md` defines the future operator-controlled agent command queue, command history, and review inbox.
- `docs/AGENT_RESPONSE_CONTRACT.md` defines current project-agent final response requirements.
