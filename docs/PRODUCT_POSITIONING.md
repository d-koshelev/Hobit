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

The current repository does not yet implement frontend Direct Work UI, automatic agent execution, Request Template editing, Response Template editing, response validation, or rich coordinator/executor UI.

Current implemented behavior remains the Empty Workbench shell, Workspace lifecycle foundation, Widget Catalog foundation, Notes, a Terminal one-shot local command widget, a backend/Tauri Codex Direct Work one-shot command that persists run/log/result artifacts for an allowed Agent Monitoring widget owner, Agent Chat proposal-only preview with explicit current-session approved context selection, a first backend AI proposal provider boundary with local/mock fallback, proposal-only run/result persistence, Agent Monitoring read-only proposal artifact viewer with explicit review-item creation for existing local mock artifacts, Agent Queue proposal-review inbox, Git widget placeholder, and Template Library placeholder insertion paths, persisted widget state/layout foundation, widget-local Logs panel foundation, and workspace activity summaries described in `docs/ARCHITECTURE.md`. The Terminal widget is limited to explicit desktop-only program + argv + working directory runs for persisted Terminal widget instances and does not provide shell mode, interactive terminal behavior, PTY, streaming, cancellation, or command history. Agent Chat can turn an operator prompt and explicitly selected safe current-view metadata into a structured proposal preview. In the desktop shell, Agent Chat can request a backend AI proposal when `HOBIT_AI_PROVIDER_ENDPOINT` and `HOBIT_AI_PROVIDER_MODEL` configure an explicit `http://` JSON chat-compatible provider endpoint; otherwise it remains fallback-safe. The generated proposal is stored as a structured proposal-only widget run/log/result artifact for the Agent Chat widget. Browser fallback keeps the preview local and does not call providers directly. Agent Monitoring can read stored proposal-only Agent Chat artifacts for the current Workspace Workbench and render Overview, Result, and Raw sections with provider status and safety flags; it does not display Direct Work artifacts yet. Agent Queue reads `needs_review` / `pending_review` local mock review items and shows read-only details. Agent Chat, Agent Monitoring, and Agent Queue do not read hidden Workspace context, read Notes body, read Git status, read Terminal output, read widget logs as Coordinator context, read files, execute tools, execute Queue items, persist chat messages, persist reusable approved context snapshots, approve/apply proposals, or mutate Workspace content. The Git widget placeholder supports manual desktop-only read-only status refresh for an explicit transient repository root, and the Template Library placeholder shows static Request, Response, and Coordinator Workflow previews. Provider settings UI, secrets UI, HTTPS provider adapter, Template storage, editing, request generation, response validation, Agent Monitoring Direct Work display, Agent Queue execution/response capture/validation, Git mutations, Direct Work UI, and automatic agent execution are not implemented.

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
