# Hobit

Hobit is an AI Workbench for precise, fast, and efficient work with AI agents.

It is not just an agent runner. Hobit is an operator-controlled environment for planning, preparing, executing, validating, reviewing, and continuing AI-assisted work.

AI agents execute focused tasks.
Hobit makes that work structured, repeatable, safe, observable, and fast.

Hobit is also a modular AI Workbench: a configurable operator workspace where AI agents, tools, context, widgets, and presets are composed into a visible, controllable working surface.

The workbench is the product surface. It is not centered on a single chat stream, script runner, terminal, IDE, runbook engine, or knowledge catalog. Those can exist as widgets or capabilities, but they do not define the product.

## What Hobit Is

Hobit is an AI Workbench for composing work surfaces around a task. Operators choose the widgets and presets that expose the capabilities needed right now, while agents propose actions, report activity, and request approval through explicit workbench surfaces.

The current frontend starts new Workspaces from an empty Workbench surface. The user-facing widget set is Agent Executor, Agent Queue, Interactive Agent, Runbook, Git, Terminal, and Notes. Agent Executor reuses the existing `agent-run` widget identity and keeps the current Codex CLI Direct Work behavior: explicit Workspace, Workbench, owning widget instance, executable, repository root, operator prompt, sandbox, approval policy, timeout, and output caps. It persists widget run/log/result artifacts and no-auto-commit/no-auto-push safety flags without changing Git or executing queued work. Terminal remains a desktop-only one-shot local command widget for persisted Terminal instances. Git remains manual and read-only for an explicit transient repository root. Agent Queue is only a review/history foundation; dispatch and queue execution are not implemented. Interactive Agent is a local chat MVP only, and Runbook is a local/manual steps MVP only. There is no shell mode, interactive terminal, PTY, background scheduler, Coordinator surface, Agent Chat proposal surface, Agent Monitoring surface, Template Library, Agent CLI, Script Runner, Database/JDBC, JIRA, Confluence, Image Edit, queue execution, Git mutation, provider settings UI, or secrets UI in the current user-facing workbench surface. The current widget inventory is summarized in `docs/CURRENT_WIDGET_SURFACE.md`.

Future starter presets may include only explicit widgets selected for the product surface, but widgets remain optional capabilities rather than the product center.

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

The current user-facing widget set is:

- Agent Executor
- Agent Queue
- Interactive Agent
- Runbook
- Git
- Terminal
- Notes

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
