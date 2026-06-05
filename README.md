# Hobit

Hobit is an AI Workbench for precise, fast, and efficient work with AI agents.

It is not just an agent runner. Hobit is an operator-controlled environment for planning, preparing, executing, validating, reviewing, and continuing AI-assisted work.

AI agents execute focused tasks.
Hobit makes that work structured, repeatable, safe, observable, and fast.

Hobit is also a modular AI Workbench: a configurable operator workspace where AI agents, tools, context, widgets, and presets are composed into a visible, controllable working surface.

The workbench is the product surface. It is not centered on a single chat stream, script runner, terminal, IDE, runbook engine, or knowledge catalog. Those can exist as widgets or capabilities, but they do not define the product.

## What Hobit Is

Hobit is an AI Workbench for composing work surfaces around a task. Operators choose the widgets and presets that expose the capabilities needed right now, while agents propose actions, report activity, and request approval through explicit workbench surfaces.

The current frontend opens new Workspaces into the Workspace Agent MVP surface, with Empty Workbench still available as an advanced/manual start mode. Stable v0.1 is centered on the Workspace Agent + Agent Queue dogfooding loop: Workspace Agent is the foreground planning/review/coding surface, and Agent Queue is the operator-controlled task organization and execution-follow-up surface. Terminal is the explicit operator command surface, not hidden automation. Agent Activity, Notes, Knowledge / Skills, Database / JDBC Preview, and Runbook Preview remain workbench capabilities. Finder is a required Stable v0.1 product gap and is not implemented yet. Agent Executor and Git remain implemented/supporting compatibility surfaces for Direct Work execution detail and explicit repository review, but they are not Stable v0.1 product widgets. Workspace Agent reuses the existing `interactive-agent` widget id/component for compatibility, can run foreground Codex Direct Work with current-session thread scoping and an explicit working directory, and keeps visible-context-only provider/fallback boundaries with `allowed_tools: []`. Multiple Workspace Agent widgets can exist independently in one Workspace. Agent Activity is a current-session readable timeline for Workspace Agent and Direct Work events; it is not persisted history. Knowledge / Skills supports Skills plus workspace-local and local-global Knowledge Documents, explicit text/Markdown import, enabled-only visible retrieval for Workspace Agent Codex runs, and local scope labels. Agent Queue can manage manual tasks, visible worker/execution assignment, explicit assigned-task start, selected-task safe run-link history, and an explicit operator-armed Queue Autorun path that runs at most one eligible assigned task at a time while Hobit remains open. Queue still has no backend scheduler, durable reconnect/resume, server worker, or hidden auto-dispatch. Database / JDBC is a Preview connector metadata and bounded mock/safe read-only query surface, with no credentials or real external database execution. Runbook is a Preview local/manual steps surface only. There is no background scheduler, broad Workspace Agent widget-tool runtime, Agent Chat proposal surface, Agent Monitoring surface, Template Library, Agent CLI, Script Runner, JIRA, Confluence, Image Edit, Finder implementation, unarmed automatic queue dispatch, Git push/reset/clean/stash/fetch/checkout, provider settings UI, direct HTTPS vendor adapter, or secrets UI in the current user-facing workbench surface. The current widget inventory is summarized in `docs/CURRENT_WIDGET_SURFACE.md`, and contract-reading navigation is in `docs/ACTIVE_CONTRACT_INDEX.md`.

## Desktop Development Baseline

Windows remains the most-tested desktop development path. Hobit also has a Linux desktop compatibility baseline for the current local desktop model: Rust/Tauri code compiles on non-Windows, Direct Work uses `codex` by default on Unix/Linux, Windows keeps `codex.cmd` support and `.cmd`/`.bat` launch through `cmd.exe /D /C`, and repo validation can be run with `scripts/hobit/validate.sh`.

This baseline is not a Linux packaging or release claim. Real Linux manual desktop smoke is still required before calling a Linux runtime verified. Terminal live PTY sessions are implemented for Windows and Linux desktop builds; macOS remains unsupported/deferred for live PTY creation while the one-shot fallback stays an explicit program-plus-argv process path.

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

The Stable v0.1 product-facing workbench surface is:

- Workspace Agent
- Agent Queue
- Terminal
- Agent Activity
- Knowledge / Skills
- Database / JDBC
- Runbook
- Notes
- Finder, required gap, not implemented

Agent Executor and Git are supporting/compatibility surfaces, not Stable v0.1 product widgets. Each capability should be expressed as a widget, tool, or shared state surface that can be added, removed, configured, and composed through presets.

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
