# AGENTS.md

## Purpose

This file gives Codex mandatory project instructions for working on Hobit.

Hobit is a modular AI Workbench. The Workbench is the product surface. Widgets, presets, tools, knowledge, stages, runbooks, terminal, database, image editing, and agent interaction are capabilities inside the Workbench.

Codex must not treat Hobit as a script executor, terminal wrapper, IDE clone, runbook runner, knowledge manager, or chat app.

Future agent work must preserve `docs/PRODUCT_POSITIONING.md` and avoid implementing Hobit as a generic hidden automation or agent-runner system.

Near-term agent surface work must follow `docs/AGENT_SURFACE_MODEL.md` and `docs/COORDINATOR_CENTERED_WORKBENCH_CONTRACT.md`. Coordinator Chat is the primary operator-facing AI surface; the existing `interactive-agent` id/component is retained only as the local Coordinator Chat compatibility foundation. Agent Executor is the user-facing execution surface and uses the existing `agent-run`/Codex Direct Work implementation internally. Agent Queue organizes tasks and executor history. Runbook and Terminal PTY remain deferred unless explicitly targeted.

The older Workspace-aware Coordinator Agent contract is retained as a deferred/reference document. Current Coordinator work must read only explicitly approved context and propose previewed actions through widget capabilities; it must not become hidden context access, direct mutation, hidden execution, or automatic queue creation.

Future Script Runner Widget work must preserve `docs/SCRIPT_RUNNER_WIDGET_CONTRACT.md`. Script Runner is a planned explicit operator-controlled configured local script action, not a general terminal, hidden automation path, arbitrary command prompt, or current runtime behavior.

## Mandatory contract reading

Before making changes, Codex must read the relevant project contracts.

Current contract navigation is defined in `docs/ACTIVE_CONTRACT_INDEX.md`.
Use it to choose the smallest relevant reading set for future blocks. If older
guidance conflicts with the active index, `docs/CURRENT_WIDGET_SURFACE.md`, or
`docs/COORDINATOR_CENTERED_WORKBENCH_CONTRACT.md`, treat the older text as
stale and report or update it in a focused cleanup block.

Always read:
- README.md
- docs/PRODUCT_POSITIONING.md
- ROADMAP.md
- docs/PRODUCT_CONTRACT.md
- docs/AI_WORKBENCH_CONTRACT.md
- docs/WORKSPACE_CONTRACT.md
- docs/UI_CONTRACT.md
- docs/WIDGET_CONTRACT.md
- docs/WIDGET_PROGRESSIVE_DISCLOSURE_CONTRACT.md
- docs/PRESET_CONTRACT.md
- docs/DESIGN_SYSTEM_CONTRACT.md
- docs/ARCHITECTURE.md
- docs/CODE_ORGANIZATION_CONTRACT.md
- docs/GLOSSARY.md

For agent/runtime work, also read:
- docs/AGENT_SURFACE_MODEL.md
- docs/AGENT_OPERATING_MODEL.md
- docs/AI_INTEGRATION_READINESS_CONTRACT.md
- docs/DIRECT_MODE_AGENT_CONTRACT.md
- docs/AGENT_WORK_EFFICIENCY_CONTRACT.md
- docs/WORKSPACE_COORDINATOR_AGENT_CONTRACT.md
- docs/AGENT_QUEUE_CONTRACT.md
- docs/AGENT_RUN_OBSERVABILITY_CONTRACT.md
- docs/AGENT_RUNTIME_CONTRACT.md
- docs/STATE_AND_EVENTS_CONTRACT.md
- docs/TOOL_ACTION_CONTRACT.md

For Script Runner widget work, also read:
- docs/SCRIPT_RUNNER_WIDGET_CONTRACT.md

For design/frontend/widget work, always read:
- docs/DESIGN_SYSTEM_CONTRACT.md
- docs/UI_CONTRACT.md
- docs/WIDGET_CONTRACT.md
- docs/WIDGET_PROGRESSIVE_DISCLOSURE_CONTRACT.md
- docs/PRESET_CONTRACT.md

For architectural decisions, inspect:
- decisions/

For request/response template work, also read:
- docs/AGENT_OPERATING_MODEL.md
- docs/TEMPLATE_CONTRACT.md
- docs/AGENT_RESPONSE_CONTRACT.md

Request Templates and Response Templates are future product assets, not only conversation prompt conventions.

Agent/executor work should follow `docs/AGENT_OPERATING_MODEL.md`, `docs/DIRECT_MODE_AGENT_CONTRACT.md`, and `docs/AGENT_WORK_EFFICIENCY_CONTRACT.md`; each new executor block should start from a fresh thread/task, remain small and focused, and stop/split when scope grows beyond the prompt or budget. Future Agent Queue work should follow `docs/AGENT_QUEUE_CONTRACT.md` and remain an operator-controlled agent command queue, command history, and review inbox, not hidden automation. Future agent/task execution observability should follow `docs/AGENT_RUN_OBSERVABILITY_CONTRACT.md`. Final responses should follow `docs/AGENT_RESPONSE_CONTRACT.md`.

For Git widget/plugin work, also read `docs/GIT_WIDGET_CONTRACT.md`. Git must be a visual, approval-aware review/control surface, not only raw command output. Future Git reads must use an explicit operator-approved repository root; do not add hidden parent traversal, Workspace-wide repository scanning, network fetch during read-only status collection, or mutating Git behavior.

## Hobit Toolbelt

Hobit has a repo-local Toolbelt under `scripts/hobit/` for deterministic repository inspection and validation tasks.

Codex and other agents must check `scripts/hobit/` before writing ad-hoc helper scripts for repeated inspection work. Prefer the Toolbelt for validation, file-size checks, module maps, and changed-file summaries.

Current Toolbelt entry points:
- `scripts/hobit/validate.ps1`
- `scripts/hobit/validate.sh`
- `scripts/hobit/check-file-sizes.py`
- `scripts/hobit/module-map.py`
- `scripts/hobit/changed-files-summary.py`
- `scripts/hobit/desktop-smoke-readiness.ps1`

If a repeated inspection need is missing, propose a small deterministic Toolbelt script instead of leaving temporary Python, Bash, or PowerShell helpers in the repository.

Code organization work must follow `docs/CODE_ORGANIZATION_CONTRACT.md`.

Agent work efficiency must follow `docs/AGENT_WORK_EFFICIENCY_CONTRACT.md`: use small focused blocks, name expected changed layers, use fast/changed/full validation profiles appropriately, and stop with a split plan when a block becomes broad or conflicts with contracts.

First real AI/provider work must follow `docs/AI_INTEGRATION_READINESS_CONTRACT.md`: start with a proposal-only Agent Chat slice, use only explicitly approved context, persist visible artifacts, keep `allowed_tools: []`, and do not add hidden execution, mutations, frontend-direct provider calls, or Agent Queue execution.

Widget work must follow `docs/WIDGET_PROGRESSIVE_DISCLOSURE_CONTRACT.md`: declare the target display level, usually start with Minimal, avoid adding Full / Expert UI during Minimal blocks, and split or simplify when one widget surface starts mixing Minimal, Operational, and Full / Expert complexity.

## Current product direction

Current foundation target:
- Empty AI Workbench shell first.
- The default Workbench is the Empty Workbench with zero real widget instances.
- Workspace Start Screen exists and can create or open a Workspace.
- In the Tauri desktop shell, workspace lifecycle/state loading, widget mutations/log reads, and explicit Git status reads use the Tauri workspace API bridge and local SQLite storage where applicable.
- In browser/Vite development, workspace lifecycle/state loading uses an in-memory workspace API fallback.
- Different problem = different Workspace. Different surface for the same problem = additional Workbench. Future multi-open Workspace UI and multi-Workbench UI must follow `docs/WORKSPACE_CONTRACT.md` and must not mix unrelated Workspace context, queues, runs, Git roots, notes, templates, logs, artifacts, or decisions.
- Add Widget opens the Widget Catalog drawer. The current user-facing widget set is Agent Executor, Agent Queue, Coordinator Chat, Database / JDBC, Runbook, Git, Terminal, and Notes. Old Agent Chat, Agent Monitoring, Template Library, Dock, Agent CLI, Script Runner, JIRA, Confluence, Image Edit, and separate legacy Coordinator preview surfaces must not appear in the current catalog or workbench surface.
- The near-term agent surface model is defined in `docs/AGENT_SURFACE_MODEL.md`: Coordinator Chat is the primary conversation/planning surface; Agent Executor runs one task and shows execution; Agent Queue organizes tasks and executor history; Runbook is deferred procedural step work.
- The Notes placeholder persists a minimal widget-state draft shaped as `{ "body": "..." }`; the full Notebook/Notes document model, multi-tab state, Markdown rendering, Mermaid or diagram rendering, checklists/todos, snippets, review notes, formatting tools, and AI-in-Notes behavior are not implemented yet. Future Notes/Notebook work must preserve `docs/NOTES_WIDGET_CONTRACT.md`, keep source text as the source of truth, avoid hidden rendering/network/command side effects, and treat ordinary To-do List use cases as Notebook scope unless a separate structured task widget is explicitly requested.
- The Terminal widget has a desktop-only PTY-first manual shell surface for persisted Terminal widget instances. It uses explicit shell executable, optional argv, explicit execution workspace / working directory, bounded session-only output, stdin send, resize, Stop, Kill, and Close through the Tauri PTY backend. The older one-shot local command runner remains available only as a collapsed legacy fallback with explicit program + argv + working directory, widget run/log/result records, and final stdout/stderr output. Terminal has no tabs, split panes, persistent command history, persistent transcripts, environment/secrets support, Agent-triggered execution, Queue-triggered execution, Coordinator control, or Script Runner behavior. Browser/Vite fallback cannot run local processes.
- Coordinator-centered direction is contract-first in `docs/COORDINATOR_CENTERED_WORKBENCH_CONTRACT.md` and `docs/WIDGET_CAPABILITY_TOOL_CONTRACT.md`; persisted approved context models, executable action proposal cards, proposal approval/apply flow, Notebook editing, Git follow-up, and cross-widget mutation are not implemented. Older Workspace-aware Coordinator Agent and proposal-review paths are compatibility/reference only.
- Agent Executor reuses the existing `agent-run` definition id for persistence compatibility. It can launch one explicit desktop Codex Direct Work run from an operator-provided prompt, repository root, sandbox, approval policy, and Codex executable, then persists widget run/log/result artifacts without auto-commit, auto-push, Git mutation, Queue execution, shell mode, PTY, or hidden background execution. In Advanced, the default executable is `codex`; on Windows, Hobit also tries `codex.exe`, `codex.cmd`, and `codex.bat` from PATH without invoking a shell.
- The Agent Queue preview is a manual task organization surface with task create/list/read/update, visible Executor assignment, explicit assigned-task start, current-session handoff, and final-status auto-refresh. It has no scheduler, auto-dispatch, approval/apply behavior, automatic launch, automatic acceptance, response capture/parser/validator, Git association, Notes mutation, or Terminal launch.
- Coordinator Chat is the user-facing title for the existing `interactive-agent` local chat compatibility surface. It has a backend-owned mock/local provider text response path for explicit chat sends with `allowed_tools: []`, visible current-session chat context only, no external LLM call, no provider credentials, no structured provider proposals yet, and no hidden context access. It has no widget tool execution, Terminal control, Git mutation, JDBC execution, Agent Executor launch, Queue auto-dispatch, or agent runtime.
- The Runbook placeholder is a procedural step surface direction only. It has no edit mode, builder, Queue integration, step execution, or agent-assisted steps.
- The Git widget has a transient explicit repository-root input, manual desktop-only read-only status/diff review backed by `get_git_repository_status`, grouped changed files, and explicit selected-file local commit UI with an operator-provided message and operator confirmation. Repository root/status persistence, polling, watching, fetch, log/show UI, validation association, push, revert/reset, clean, stash, Agent Executor auto-commit, and broader Git mutations are not implemented.
- Direct Mode is the current explicit operator-controlled executor path for small approved Codex CLI work, with future executor kinds kept agent-agnostic. Hobit can start Direct Work runs from Agent Executor and through the explicit assigned Queue task path in the desktop shell. It does not auto-dispatch Queue items, auto-commit, auto-push, mutate Git, add an embedded PTY, or run hidden background agent work.
- The Script Runner Widget is contract-only future work. It is not implemented, not available for widget insertion, and does not add script execution, backend execution, Tauri commands, storage, or runtime behavior.
- The Workbench has a frontend-only layout lock/edit-mode foundation. Docked widgets stay fixed in locked mode; edit mode allows docked widgets to be moved by dragging the widget header/top area and resized with right, bottom, and bottom-right handles, with final docked position and size persisted through `update_widget_instance_layout`. Snapping, collision detection, auto-reflow, floating overlay resize, true external Tauri/OS popout windows, persisted external popout geometry, always-on-top, and preset editing are not implemented yet. Widgets also have frontend-only floating widget mode with an in-app overlay, a ghost placeholder, and Dock back behavior.
- Future Dock and widget Full/Compact/Indicator view mode work must follow `docs/WIDGET_CONTRACT.md`. Dock rails, Compact view from Dock items, persisted widget presence zones, Indicator status providers, and drag-and-drop between Canvas, Dock, Float, and future external windows are not implemented yet.
- Widget frames include a widget-local Logs panel backed by persisted widget logs. Existing widget add/state/layout mutations emit basic logs; Terminal one-shot fallback commands and Codex Direct Work runs emit bounded lifecycle logs. Terminal PTY output uses session-only frontend polling of the bounded backend buffer and is not persisted as widget logs/results. Event-streamed Terminal output is not implemented.
- Widgets are first-class entities, not just React components.
- Existing Widget Registry, Preset model, and WidgetHost architecture must be preserved.

Interactive Terminal runtime, LLM-backed or executable Agent Chat runtime, Agent Run runtime, and Agent CLI widgets may exist later, but they must not be shown by default or implemented unless explicitly requested.

JIRA and Confluence are future read-only-first widget/integration candidates for work tracking and documentation context. They are not implemented, and operator-approved updates belong only in later explicit integration work.

## Hard product rules

- Workbench is the product center.
- Every visible UI block is a widget.
- Widgets are optional capabilities.
- Presets compose widget instances and layouts.
- Knowledge is a widget/capability, not the product center.
- Stages are a widget/capability, not the product center.
- Runbooks are a widget/capability, not the product center.
- Tools/actions must be explicit, visible, and approval-aware.
- Agent proposes; operator controls.

## Widget contract summary

A widget is a first-class Workbench entity.

A widget has:
- definition/template
- instance/config
- input data
- input command/action
- run/loading state
- widget-local logs/console
- structured result output
- layout state
- docked/floating presentation state
- future view mode and presence zone state

Every widget must support:
- widget-local console/logs
- resize/reposition inside Workbench
- float in workspace / detach
- ghost placeholder when detached
- return/dock behavior
- optional always-on-top in future true external popout mode

Moving, docking, floating, parking in a future Dock, or changing Full/Compact/Indicator view mode must not create a new widget instance. It is only a presentation/layout state change.

Widgets must communicate through Workbench state/events, not by directly coupling to each other.

## UI/design rules

- UI must be simple.
- No clutter.
- No duplicated information.
- Only show what is needed right now.
- Every UI block has one responsibility.
- The operator must always understand where they are, what they are working on, what the agent is doing, and what needs approval.
- Widget header is not a detached block. It is the top meta zone of one continuous widget surface.
- Avoid box-inside-box composition.
- Avoid unnecessary internal subdivision.
- Use the locked theme palette.
- No gradients.
- No raw colors outside the dedicated theme file.
- Do not create one-off visual language per widget.

## Frontend rules

- Preserve preset-driven rendering.
- Preserve widgetRegistry.
- Preserve WidgetHost as the mapping layer from widget instance to React component.
- Do not hardcode widget components directly into WorkbenchCanvas.
- Do not add new real widgets unless explicitly requested.
- Do not add widget insertion behavior beyond the current Agent Executor, Agent Queue, Coordinator Chat, Database / JDBC, Runbook, Git, Terminal, and Notes catalog paths unless explicitly requested.
- Do not add UI frameworks or icon libraries unless explicitly requested.
- Do not add drag-and-drop until explicitly requested.
- Do not add real Dock UI, widget view mode behavior, presence-zone persistence, drag-and-drop, snapping, collision detection, auto-reflow, floating overlay resize, true external popout behavior, preset editing, or new persistence flows unless explicitly requested.

## Rust/core rules

- hobit-core owns pure domain contracts and types.
- hobit-core must not depend on Tauri, React, SQLite, or frontend code.
- storage, agent, tools, and app orchestration must remain separate crates.
- The root Rust workspace includes `apps/desktop/src-tauri`; `cargo check --workspace` validates the Tauri desktop crate as well as the core crates.
- Do not over-model prematurely.
- Prefer small explicit types and clear contracts.

## Forbidden unless explicitly requested

Do not add:
- Terminal runtime behavior beyond the current visible PTY session API/UI and
  collapsed legacy one-shot fallback
- script execution or Script Runner runtime behavior
- real agent calls
- new Tauri bridge capabilities beyond existing workspace lifecycle/state loading, widget mutation/log reads, explicit read-only Git status reads, the Terminal PTY session API, and the persisted Terminal widget one-shot fallback path
- JDBC SQL execution, credentials, Java sidecar, or database behavior beyond the current connector metadata API/UI
- JIRA or Confluence integration
- real Git integration
- Knowledge Catalog implementation
- Stages implementation
- Runbook engine
- Image Edit implementation
- real widget implementation
- additional widget insertion behavior beyond the current Agent Executor, Agent Queue, Coordinator Chat, Database / JDBC, Runbook, Git, Terminal, and Notes paths
- full drag-and-drop layout editor
- real Dock UI, widget view mode behavior, presence-zone persistence, snapping, collision detection, auto-reflow, floating overlay resize, true external popout behavior, or preset editor behavior
- unplanned SQLite schema changes
- new runtime execution behavior
- new dependencies

## Validation

Use Hobit Toolbelt validation profiles when possible:

- `scripts/hobit/validate.ps1 -Profile fast` during iteration.
- `scripts/hobit/validate.ps1 -Profile changed` after focused edits.
- `scripts/hobit/validate.ps1 -Profile full` before commits/final acceptance unless a prompt explicitly says otherwise.

The default Toolbelt validation profile is `full`; do not silently weaken final validation.

For most changes, run:

- cargo fmt --all
- cargo check --workspace
- cargo test --workspace
- npm.cmd run typecheck --prefix apps/desktop/frontend

For frontend changes, also try:

- npm.cmd run build --prefix apps/desktop/frontend

If build fails due to environment-specific Vite/Rolldown spawn limitations, report it clearly.

Always run:

- git status --short --branch

## Commit discipline

Each task should create one focused commit.

Good commit examples:
- docs: add Codex project instructions
- frontend: show empty workbench surface
- frontend: fix responsive workbench topbar layout
- core: define widget runtime contract types

Bad commit examples:
- update UI
- add widgets and backend
- fix everything

## Final report format

Final responses must follow `docs/AGENT_RESPONSE_CONTRACT.md`.

At the end of every task, report:
- files changed
- what changed
- validation commands and results
- commit hash
- what was intentionally not implemented
