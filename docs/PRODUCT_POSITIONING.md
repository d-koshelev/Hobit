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

The current repository does not yet implement automatic agent execution, Request Template editing, Response Template editing, response validation, rich coordinator/executor UI, or Direct Work UI beyond the current minimal Direct Work / Codex launch surface.

Current implemented behavior remains the Empty Workbench shell, Workspace lifecycle foundation, Widget Catalog foundation, persisted widget state/layout foundation, widget-local Logs panel foundation, workspace activity summaries, and the current user-facing widget set summarized in `docs/CURRENT_WIDGET_SURFACE.md`: Agent Executor, Agent Queue, Coordinator Chat, Runbook, Git, Terminal, and Notes. Coordinator Chat currently reuses the existing `interactive-agent` widget id/component as a local-only placeholder. Agent Executor is the Ready Direct Work / Codex surface backed by the existing `agent-run` widget identity and backend/Tauri Codex Direct Work commands that persist run/log/result artifacts without Git mutation or queue execution. Terminal is limited to explicit desktop-only program + argv + working directory runs for persisted Terminal widget instances and does not provide shell mode, interactive terminal behavior, PTY, streaming, cancellation, or command history. Git supports manual desktop-only read-only status refresh for an explicit transient repository root. Notes persists one body draft. Agent Queue is a singleton preview review/history foundation with no execution or dispatch. Coordinator Chat is a local chat MVP with no provider, tools, persistence, or integrations. Runbook is a local/manual steps MVP with local state and notes/evidence only. Agent Chat, Agent Monitoring, Template Library, Dock, Agent CLI, Script Runner, Database/JDBC, JIRA, Confluence, Image Edit, and separate legacy Coordinator surfaces are not current user-facing catalog surfaces. Provider settings UI, secrets UI, HTTPS provider adapter, template storage/editing/request generation/response validation, Agent Queue execution/response capture/validation, Git mutations, and automatic agent execution are not implemented.

## Related Contracts

- `docs/PRODUCT_CONTRACT.md` defines Hobit as a modular AI Workbench.
- `docs/AI_WORKBENCH_CONTRACT.md` defines Workbench and Workspace terms.
- `docs/WORKSPACE_CONTRACT.md` defines resumable Workspace behavior, context isolation, and the multi-Workspace/multi-Workbench boundary.
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
