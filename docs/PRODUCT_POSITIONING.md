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
- Reusable Request Templates and Response Templates as product direction.
- Validation and review as first-class workflow steps.
- Observable work through activity, logs, artifacts, and history.
- Resumable Workspaces for continuing work later.
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

The current repository does not yet implement real agent runtime behavior, automatic agent execution, Request Template editing, Response Template editing, response validation, or rich coordinator/executor UI.

Current implemented behavior remains the Empty Workbench shell, Workspace lifecycle foundation, Widget Catalog foundation, Notes, Terminal placeholder, Agent Chat placeholder, Git placeholder, and Template Library placeholder insertion paths, persisted widget state/layout foundation, widget-local Logs panel foundation, and workspace activity summaries described in `docs/ARCHITECTURE.md`. Template storage, editing, request generation, response validation, and agent execution are not implemented.

## Related Contracts

- `docs/PRODUCT_CONTRACT.md` defines Hobit as a modular AI Workbench.
- `docs/AI_WORKBENCH_CONTRACT.md` defines Workbench and Workspace terms.
- `docs/WORKSPACE_CONTRACT.md` defines resumable Workspace behavior.
- `docs/WIDGET_CONTRACT.md` defines widgets as first-class work surfaces.
- `docs/GIT_WIDGET_CONTRACT.md` defines the future Git review/control widget for agent-completed code work.
- `docs/TEMPLATE_CONTRACT.md` defines future Request Templates and Response Templates.
- `docs/AGENT_OPERATING_MODEL.md` defines future coordinator and executor agent roles.
- `docs/AGENT_RESPONSE_CONTRACT.md` defines current project-agent final response requirements.
