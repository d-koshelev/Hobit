# Hobit

Hobit is an AI Workbench for precise, fast, and efficient work with AI agents.

It is not just an agent runner. Hobit is an operator-controlled environment for planning, preparing, executing, validating, reviewing, and continuing AI-assisted work.

AI agents execute focused tasks.
Hobit makes that work structured, repeatable, safe, observable, and fast.

Hobit is also a modular AI Workbench: a configurable operator workspace where AI agents, tools, context, widgets, and presets are composed into a visible, controllable working surface.

The workbench is the product surface. It is not centered on a single chat stream, script runner, terminal, IDE, runbook engine, or knowledge catalog. Those can exist as widgets or capabilities, but they do not define the product.

## What Hobit Is

Hobit is an AI Workbench for composing work surfaces around a task. Operators choose the widgets and presets that expose the capabilities needed right now, while agents propose actions, report activity, and request approval through explicit workbench surfaces.

The current frontend starts new Workspaces from an empty Workbench surface. The implemented widget foundation includes persisted Notes, a Terminal widget with an explicit desktop-only one-shot local command form, an Agent Chat proposal-only prompt with explicit current-session approved context selection, a first backend AI proposal provider boundary, Direct Work / Codex as a Ready workbench surface that reuses the existing `agent-run` widget identity while keeping secondary read-only Agent Chat proposal artifact details available, Agent Queue as a narrow persisted review inbox for local mock proposal results, a Git widget placeholder with manual desktop-only read-only status refresh, and a static Template Library placeholder with Request, Response, and Coordinator Workflow previews. The Workbench top bar also has a compact current-session activity indicator for frontend-known local Terminal and Direct Work runs. Terminal command runs are limited to persisted Terminal widget instances and use explicit program + argv + working directory through the Tauri backend. Codex Direct Work now has a frontend operator surface and a backend/Tauri one-shot command for explicit Workspace, Workbench, owning `agent-run` widget instance, Codex executable, repository root, operator prompt, sandbox, approval policy, timeout, and output caps; it persists widget run/log/result artifacts and no-auto-commit/no-auto-push safety flags. When the executable is `codex` on Windows, the backend resolver also checks `codex.exe`, `codex.cmd`, and `codex.bat` from PATH without invoking a shell. Agent Chat can request a proposal through the desktop backend when `HOBIT_AI_PROVIDER_ENDPOINT` and `HOBIT_AI_PROVIDER_MODEL` are configured for an explicit `http://` JSON chat-compatible provider endpoint; `HOBIT_AI_PROVIDER_API_KEY` is optional and is used only as an Authorization bearer token. The provider receives only the operator prompt, the explicitly approved context snapshot, a concise contract pack summary, `allowed_tools: []`, safety constraints, expected response format, and validation plan. If provider configuration is absent or the browser fallback is used, the local/mock proposal fallback remains available. If a provider response is returned, it is normalized into the existing structured proposal shape and stored as a proposal-only widget run/result artifact. The secondary Agent Monitoring details read proposal-only Agent Chat result artifacts for the current Workspace Workbench and show provider status, safety flags, and raw stored payloads. No tools execute through Agent Chat, no Terminal command is run by AI, no hidden context is read, no Notes/Git/Terminal/log/file content is included, no Queue execution is created, no approval/apply behavior exists, and no Workspace content is mutated or persisted as a reusable context snapshot. There is no Agent Monitoring persisted Direct Work reader, shell mode, interactive terminal, PTY, streaming, cancellation, command history, background scheduler, executable Workspace-aware Coordinator proposals, Agent Run runtime/streaming/parsing/validation beyond persisted Direct Work artifacts, Terminal result monitoring, Agent Queue execution/response capture/validation, Git mutations/diff/log/show, Git root/status persistence, Template storage/editing/request generation/response validation, Agent CLI, provider configuration UI, secrets UI, HTTPS provider adapter, or other capability widgets yet.

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
