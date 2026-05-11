# Hobit

Hobit is an AI Workbench for precise, fast, and efficient work with AI agents.

It is not just an agent runner. Hobit is an operator-controlled environment for planning, preparing, executing, validating, reviewing, and continuing AI-assisted work.

AI agents execute focused tasks.
Hobit makes that work structured, repeatable, safe, observable, and fast.

Hobit is also a modular AI Workbench: a configurable operator workspace where AI agents, tools, context, widgets, and presets are composed into a visible, controllable working surface.

The workbench is the product surface. It is not centered on a single chat stream, script runner, terminal, IDE, runbook engine, or knowledge catalog. Those can exist as widgets or capabilities, but they do not define the product.

## What Hobit Is

Hobit is an AI Workbench for composing work surfaces around a task. Operators choose the widgets and presets that expose the capabilities needed right now, while agents propose actions, report activity, and request approval through explicit workbench surfaces.

The current frontend starts new Workspaces from an empty Workbench surface. The implemented widget foundation includes persisted Notes, a Terminal widget with an explicit desktop-only one-shot local command form, an Agent Chat local/mock proposal-only prompt with explicit current-session approved context selection, static Agent Monitoring placeholder with Raw Log, Overview Log, and Result Report previews, static Agent Queue placeholder with command queue/history/review inbox previews, a Git widget placeholder with manual desktop-only read-only status refresh, and a static Template Library placeholder with Request, Response, and Coordinator Workflow previews. The Workbench top bar also has a compact current-session activity indicator for frontend-known local Terminal runs. Terminal command runs are limited to persisted Terminal widget instances and use explicit program + argv + working directory through the Tauri backend. Agent Chat proposal previews are frontend-local only: the operator may include only safe current-view metadata such as Workspace identity, widget inventory, and current activity status. No LLM is connected, no tools execute, no hidden context is read, no Notes/Git/Terminal/log/file content is included, no Queue item is created, and no workspace state is mutated or persisted as a context snapshot. There is no shell mode, interactive terminal, PTY, streaming, cancellation, command history, background scheduler, LLM-backed Agent Chat runtime, executable Workspace-aware Coordinator proposals, Agent Run runtime/streaming/parsing/validation, Agent Queue storage/execution/response capture/validation, Git mutations/diff/log/show, Git root/status persistence, Template storage/editing/request generation/response validation, Agent CLI, or other capability widgets yet.

A future starter preset may include Terminal and Agent CLI widgets, but those are optional capabilities, not the product center.

## What Hobit Is Not

Hobit is not:

- a script executor
- a terminal wrapper
- an IDE clone
- a runbook runner
- a knowledge manager
- a chat app

These functions may appear as optional widgets, but Hobit remains workbench-first.

## Optional Widgets And Capabilities

Future Hobit capabilities may include:

- Agent CLI
- Terminal
- Script Runner
- Stages
- Knowledge
- Runbooks
- Git
- Database/JDBC
- JIRA
- Confluence
- SQL Results
- Image Edit
- Agent Activity
- Shared State

Each capability should be expressed as a widget, tool, or shared state surface that can be added, removed, configured, and composed through presets.

## Product Principles

- Workbench is the product surface.
- Every visible UI block is a Widget.
- Widgets are optional capabilities.
- Presets are saved compositions of widget instances.
- Widgets are created from reusable templates and rules, not hardcoded per customer or system.
- UI must be simple, non-duplicative, and limited to information needed right now.
- The operator must always understand what they are working on and what the agent is doing.
- Agent proposes; operator controls.
- Tools and actions must be explicit, visible, and approval-aware.

## Project Agent Instructions

Codex and other project agents must read `AGENTS.md` before making changes.
