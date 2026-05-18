# Roadmap

This roadmap defines the intended foundation order for Hobit. Early phases establish product contracts and repository structure, and current implementation work continues to exercise those contracts through the Workbench shell.

## Coordinator-Centered Workbench Direction

The updated product model is defined in
`docs/COORDINATOR_CENTERED_WORKBENCH_CONTRACT.md`.

Coordinator Chat is the primary operator-facing AI surface. The operator uses
Coordinator Chat to describe problems, explore solutions, and ask Hobit to use
available widgets as controlled tools/proxies. Widgets expose controlled
capabilities; Agent Queue organizes executable tasks; Agent Executors execute
tasks and provide visibility; the operator controls autonomy and approvals.
The widget capability/tool boundary is defined in
`docs/WIDGET_CAPABILITY_TOOL_CONTRACT.md`.

Near-term product direction:

- keep the existing Interactive Agent implementation path repositioned as
  Coordinator Chat
- do not keep separate freeform Interactive Agent plus Coordinator concepts
- keep Agent Queue as task organization for Agent Executors, not the main chat
  or global orchestrator
- keep Agent Executor focused on task execution, live logs, result, diff,
  validation, history, and stop/cancel
- keep Runbook preview/minimal and deferred from active roadmap
- make JDBC/Database Connector a first-version scope candidate under a
  contract-gated, read-only-by-default capability model
- treat Evidence/Sources as an important future trust layer
- keep medical/healthcare workflows out of active scope due
  privacy/compliance/safety sensitivity

Recommended next blocks:

- Block 207 - Coordinator Chat minimal UI.
- Block 208 - JDBC widget contract.
- Block 209 - JDBC connector model/API foundation.
- Block 210 - JDBC query UI MVP.
- Block 211 - Coordinator action proposal UI pattern.
- Block 212 - Coordinator to JDBC read-only query proposal flow.
- Block 213 - Coordinator to Queue task creation flow.
- Block 214 - Evidence/Sources contract.
- Block 215 - AI context/token economy contract.

## Near-Term Agent Surface Model

The near-term agent/work surface model is defined in
`docs/AGENT_SURFACE_MODEL.md`.
The current post-cleanup widget inventory is summarized in
`docs/CURRENT_WIDGET_SURFACE.md`.

The model now separates Coordinator conversation/planning, Queue task
organization, Executor execution visibility, and deferred procedural Runbook
work:

- Agent Executor: run one task and show execution.
- Agent Queue: organize tasks and executor history.
- Coordinator Chat: understand, plan, propose widget actions, and interpret
  results.
- Runbook: follow and manage procedural steps.

Interactive Agent future work is now Coordinator Chat compatibility work and
must follow `docs/COORDINATOR_CENTERED_WORKBENCH_CONTRACT.md` and
`docs/INTERACTIVE_AGENT_WIDGET_CONTRACT.md`: the existing local chat foundation
is the Coordinator Chat placeholder rather than a second primary chat surface.

Runbook future work must follow `docs/RUNBOOK_WIDGET_CONTRACT.md`: it is a
step-based procedural widget, not Queue execution, Agent Executor dispatch,
Coordinator Chat behavior, Terminal automation, Git
mutation, or a hidden tool runner.

Future Agent Queue task work is contract-gated by
`docs/AGENT_QUEUE_PRODUCT_MODEL_CONTRACT.md`: Agent Queue is a Workspace-level
task and history surface with future dependencies, executor capacity, and
manual assignment. Agent Queue is not Coordinator Chat, not a scheduler, and
not a global orchestrator.
Manual Queue-to-Executor assignment is contract-gated by
`docs/QUEUE_TO_EXECUTOR_ASSIGNMENT_CONTRACT.md`; assignment is visible operator
routing only and must remain separate from execution, dispatch, scheduling,
Terminal launch, and Git mutation.
Manual run of an assigned Queue task is contract-gated by
`docs/QUEUE_ITEM_EXECUTION_CONTRACT.md`; it requires an explicit operator start
in the assigned Agent Executor and must not become auto-dispatch, scheduler
behavior, Terminal launch, auto-commit, push, or hidden execution.

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

Future explicit local commit support is contract-gated by
`docs/GIT_COMMIT_SUPPORT_CONTRACT.md`. Commit support must remain an
operator-confirmed Git review action with a visible change set and
operator-approved message; push requires a later separate contract. A narrow
backend/Tauri/frontend API foundation and confirmation-gated frontend UI now
exist for Git Widget-owned local commit creation, but auto-commit, push,
reset, and clean remain out of scope.

Future Terminal PTY work is contract-gated by
`docs/TERMINAL_PTY_WIDGET_CONTRACT.md`. Current Terminal remains a bounded
one-shot command runner until a later PTY/session implementation block adds an
interactive shell foundation.

Future multi-note Notes work is contract-gated by
`docs/NOTES_WIDGET_PRODUCT_CONTRACT.md`. The first implementation should be a
workspace-local storage/API foundation before showing a note list, search,
pinning, autosave, or other multi-note UI.

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
- Use `docs/PRODUCT_UI_VISUAL_CONTRACT.md` as the product visual target for
  canvas, grid, top bar, widget cards, controls, chips, tables, logs, preview
  widgets, and prohibited UI overclaims.
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

- No real JDBC integration until the Coordinator-centered JDBC contract and
  connector model/API blocks are completed.
- No real image editing yet.
- No full drag-and-drop layout editor yet.
- No Knowledge Catalog implementation yet.
- No Runbook engine yet.
- No attempt to make Knowledge, Stages, or Runbooks the product center.
