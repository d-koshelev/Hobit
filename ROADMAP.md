# Roadmap

This roadmap defines the intended foundation order for Hobit. Early phases establish product contracts and repository structure, and current implementation work continues to exercise those contracts through the Workbench shell.

## Near-Term Agent Surface Model

The near-term agent/work surface model is defined in
`docs/AGENT_SURFACE_MODEL.md`.
The current post-cleanup widget inventory is summarized in
`docs/CURRENT_WIDGET_SURFACE.md`.

The model keeps four surfaces separate:

- Agent Executor: run one task and show execution.
- Agent Queue: organize tasks and executor history.
- Interactive Agent: manually chat/work with an agent.
- Runbook: follow and manage procedural steps.

Interactive Agent future work must follow
`docs/INTERACTIVE_AGENT_WIDGET_CONTRACT.md`: it is a manual long-chat widget,
not Queue execution, Agent Executor dispatch, Runbook execution, Coordinator
behavior, or a hidden mutation path.

Runbook future work must follow `docs/RUNBOOK_WIDGET_CONTRACT.md`: it is a
step-based procedural widget, not Queue execution, Agent Executor dispatch,
Interactive Agent chat, Coordinator behavior, Terminal automation, Git
mutation, or a hidden tool runner.

Coordinator is deferred. It should not be required for Agent Executor, Agent
Queue, Interactive Agent, or Runbook work until a later block explicitly
reintroduces it.

## Near-Term Direction: Direct Mode With Codex CLI

After the proposal-only AI provider slice, the near-term executor direction is
Direct Mode with Codex CLI as the first planned executor kind. Direct Mode is
the current Agent Executor implementation direction and is
the controlled path for small approved work where the operator explicitly
chooses the repository root, prompt, sandbox/mode, and review flow.

Direct Mode must remain agent-agnostic for future executors and must follow
`docs/DIRECT_MODE_AGENT_CONTRACT.md`. Backend/tooling-only Codex CLI
foundations now exist in `hobit-tools`: availability/version probing and a
one-shot Direct Work runner for an explicit repository root and operator
prompt. The app/Tauri boundary now exposes a focused one-shot
`run_codex_direct_work` command that persists Direct Work widget run/log/result
artifacts for an allowed Agent Executor (`agent-run`) widget instance.
Direct Work / Codex is now surfaced as a Ready Widget Catalog surface while
reusing the existing `agent-run` widget identity. The frontend lets the
operator paste a prompt, repository root, and Codex executable in Advanced; on
Windows the backend resolver tries `codex`, `codex.exe`, `codex.cmd`, and
`codex.bat` from PATH without invoking a shell. Direct Mode product integration
is still intentionally narrow: no retired Agent Monitoring surface or persisted
Direct Work reader, storage/schema change, queue execution, Git mutation,
auto-commit, auto-push, embedded PTY, interactive session, or hidden background
execution is part of the current roadmap slice.

## Phase 0: Contracts And Repository Foundation

- Define the AI Workbench product contract.
- Define widget, preset, UI, runtime, tool action, and event contracts.
- Establish repository hygiene with `.gitignore` and documentation structure.

## Phase 1: Clean Monorepo Skeleton

- Create the initial repository layout for staged product implementation.
- Establish workspace boundaries for desktop app, core crates, storage, agent runtime, tools, app orchestration, and frontend modules.
- Keep the desktop shell and core crates in the root validation path.

## Phase 2: Design System

- Define the visual and interaction rules for workbench UI.
- Create reusable components for panels, toolbars, approvals, activity, and widget containers.
- Keep UI simple, readable, and non-duplicative.

## Phase 3: Workbench Shell

- Implement the base workbench surface.
- Support visible widget regions, current task context, operator awareness, and approval surfaces.
- Keep the shell independent from any single capability.

## Phase 4: Widget Registry And Presets

- Define widget registration and instantiation.
- Support reusable widget templates and rules.
- Save and load presets as compositions of widget instances and layout.

## Phase 5: Minimal Workbench With Terminal + Agent CLI

- Implement the minimal valid product.
- Provide a Terminal Widget and Agent CLI Widget.
- Prove that the workbench can host an agent-facing and operator-facing task surface without overbuilding optional capabilities.

## Phase 6: Shared State And Event Model

- Add shared workbench state.
- Route widget events, agent activity, action proposals, decision requests, and tool results through a common event model.
- Keep widgets decoupled from each other.

## Phase 7: Agent Runtime Integration

- Connect the agent runtime to workbench context, available capabilities, activity events, proposals, tool requests, and results.
- Preserve the rule that the agent does not own the UI.
- Make approval requirements explicit.

## Phase 8: Optional Capability Widgets

- Add capability widgets as needed:
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

## Early Non-Goals

- No real JDBC integration yet.
- No real image editing yet.
- No full drag-and-drop layout editor yet.
- No Knowledge Catalog implementation yet.
- No Runbook engine yet.
- No attempt to make Knowledge, Stages, or Runbooks the product center.
