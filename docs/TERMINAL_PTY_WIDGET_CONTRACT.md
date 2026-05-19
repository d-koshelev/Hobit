# Terminal PTY Widget Contract

## Purpose

This contract defines the future transition from the current one-shot Terminal
widget to a real interactive shell surface.

This is the product/runtime contract for Terminal PTY behavior. Current
implementation status is tracked in the Current State section below.

Future implementation must preserve Hobit's Workbench-first product model:
Terminal is a widget capability inside the Workbench, not the product center,
not a hidden automation path, and not an Agent Executor replacement.

## Current State

Current Terminal has a visible PTY session mode and preserves the bounded
one-shot command runner.

Current Terminal:

- Is desktop-only for local process execution.
- In `PTY session` mode, accepts an explicit shell executable, optional shell
  argv, explicit execution workspace / working directory, columns/rows, and
  bounded output buffer cap.
- Starts a visible manual shell session through the desktop PTY backend when
  supported.
- Displays bounded session-only PTY output via frontend refresh/polling, sends
  operator stdin, resizes by columns/rows, and exposes Stop, Kill, and Close
  controls.
- In `Run command` mode, accepts an explicit program, argv, working directory,
  timeout, and output caps.
- Creates widget run/log/result records only for persisted one-shot Terminal
  command runs.
- Shows the final stdout/stderr result for one-shot command runs.
- Has no tabs.
- Has no split panes.
- Has no event-streamed PTY output bridge yet.
- Has no command history, persistent transcript, shell profile model,
  Agent-triggered execution, Queue-triggered execution, Coordinator control, or
  Script Runner behavior.

Current backend foundation:

- Desktop/Tauri owns a session-only PTY runtime registry for explicit Terminal
  widget owners.
- The backend foundation can create, write stdin, resize, stop, kill, close,
  get, and list sessions.
- Windows ConPTY is the first supported backend.
- PTY output/history remains session-only and is not persisted to storage.
- The frontend Terminal widget consumes the PTY command foundation in
  `PTY session` mode.

The current UI must remain honest that PTY sessions are desktop/manual,
session-only, and do not include tabs, split panes, persistent history, or
event-streamed output yet.

## Relationship To Current One-Shot Terminal

The current one-shot command runner remains valid and must be preserved until a
PTY implementation is available and proven.

Decision:

- Keep the current one-shot behavior as an explicit `Run command` capability
  inside the Terminal widget.
- PTY behavior is now the primary Terminal shell mode, but it must not delete
  or silently replace the existing one-shot path.
- The one-shot path may remain useful as a bounded command/result action with
  timeout and output caps.
- The PTY path is an interactive session surface. It has different lifecycle,
  output, history, and persistence expectations.

Current one-shot behavior stays unchanged:

- explicit program
- explicit argv
- explicit working directory
- explicit timeout and output caps
- widget run/log/result persistence
- final stdout/stderr result
- no stdin, no PTY, no streaming, no cancellation, no shell mode

Current UI presents this as a secondary `Run command` mode inside Terminal. It
must not create a second Terminal widget definition or use Script Runner
behavior without a separate contract.

## Target Role

Terminal: interactive shell workspace for manual operator commands.

## Minimal PTY Lifecycle

Future Terminal PTY behavior must model this minimal lifecycle before product
UI expands:

- Create session with explicit shell and working directory context.
- Attach frontend to the session.
- Stream terminal output to the owning Terminal widget.
- Send operator stdin to the active PTY session.
- Resize PTY when the terminal viewport changes.
- Stop / graceful terminate the session.
- Kill / force terminate the session.
- Close the session view after exit or explicit operator choice.
- Cleanup session resources after exit, close, widget removal, Workspace close,
  or app shutdown.
- Handle failed start, lost event subscription, app close, Workspace close, and
  widget closure without leaving hidden shells behind.

Terminal commands must remain visible, manual, and tied to an explicit Terminal
widget session.

Stop and kill are different controls:

- Stop requests graceful termination when the platform supports it.
- Kill force-terminates the shell/process tree as best effort.
- Neither stop nor kill rolls back filesystem changes made by commands already
  executed in the terminal.
- Running-session close must require an explicit stop/kill/confirm path.

## Session Model

A future Terminal session should be modeled conceptually with these fields:

- `session_id`
- `workspace_id`
- `workbench_id`
- `widget_instance_id`
- `tab_id`
- `pane_id`
- `shell`
- `shell_args`
- `working_directory`
- `execution_workspace_boundary`
- `status`
- `started_at`
- `ended_at`
- `exit_code`
- `title`
- `is_active`

These fields define product and runtime expectations only. They do not define
a storage schema, API DTO, Rust type, TypeScript type, migration, or current
implementation.

## Session Ownership And Visibility

PTY sessions are operator-visible runtime objects.

Rules:

- Every PTY session belongs to one Workspace, one Workbench, and one Terminal
  widget instance.
- A PTY session must be visible in its owning Terminal widget while running.
- No hidden or background terminal sessions are allowed.
- Session controls must be visible in the owning Terminal widget.
- Browser/Vite fallback must show unsupported state rather than pretending a
  local PTY exists.
- Coordinator Chat, Agent Queue, Agent Executor, Runbook, and other widgets
  must not create or control Terminal sessions silently.
- App-level activity may summarize that a Terminal session is running, but it
  must not become a scheduler or hidden control surface.
- A Terminal session from one Workspace must not appear in another Workspace.

## Tabs Model

One Terminal widget may have multiple tabs.

Rules:

- Each tab owns one or more terminal sessions or panes.
- Tabs show title, status, and current directory when available.
- The operator can create tabs.
- The operator can close tabs.
- Closing an exited tab should be low friction.
- Closing a running tab requires confirmation or an explicit stop/kill path.
- Active tab status must be clear.
- Tabs must not imply persistence or history unless those features exist.

Tabs are part of the Terminal widget surface. They must not create new Widget
instances unless a later contract explicitly defines a detach/split-widget
flow.

## Split Pane Model

Split panes are future work after the base PTY implementation.

Rules:

- Panes may split horizontally or vertically.
- Each pane has its own session.
- The active pane receives input.
- Pane focus must be clear.
- Resizing panes must not break PTY resize semantics.
- Split panes are not required for the first PTY implementation.

Split panes must not appear as working UI before session and resize behavior
exist.

## Input And Output Behavior

Rules:

- Operator keystrokes go to the active session.
- Terminal output streams live. When the runtime can distinguish stream kind,
  that metadata may be surfaced; the UI must also support PTY implementations
  that expose one combined terminal stream.
- Output is scrollable.
- Copy is allowed.
- Paste is allowed only when it is clear where text will go.
- Multi-line paste may require a safety confirmation in a later slice.
- Large output should be bounded, capped, or virtualized.
- Truncated or dropped output must be visibly marked.
- Terminal output is not automatically sent to agents.
- Terminal output is not automatically promoted into Notes, Git, Queue, or
  Agent Executor artifacts.

Terminal output is the primary surface for the Terminal widget, so dense
monospace display is appropriate. Raw output should still avoid breaking the
widget frame or Workbench layout.

## Execution Workspace And Working Directory

PTY sessions start inside an explicit execution workspace / working directory.

Rules:

- The operator must see the selected working directory before creating a
  session.
- Hobit must not silently default PTY sessions to `~/`, user home, Documents,
  Downloads, drive roots, or another broad filesystem root.
- If no execution workspace is selected, the Terminal PTY UI should be `Not
  configured`, not silently runnable.
- Future scratch workspace support may provide a Hobit-controlled working
  directory, but it must be an explicit operator choice and must not be created
  implicitly by PTY startup unless that slice implements and documents it.
- Current one-shot command runner working-directory behavior remains unchanged.
- Terminal does not automatically infer a repository root from Workspace,
  Agent Executor, Git Widget, or file paths.
- Future handoffs from Agent Executor or Git may prefill a working directory,
  but starting the session still requires visible operator action.

The term execution workspace here is the runtime filesystem boundary for a
terminal session. Hobit Workspace remains the product isolation boundary.

## Safety Boundaries

Terminal is operator-driven.

Rules:

- Terminal should not be used by agents automatically in the first PTY slice.
- No AI auto-execution.
- No hidden Coordinator tool access.
- No hidden command execution.
- No background shell sessions without visible status.
- No automatic Git mutation.
- No automatic commit, push, reset, or clean.
- No automatic cleanup, reset, rollback, or recovery of files changed through
  terminal commands.
- No Queue-driven Terminal command execution.
- No Coordinator Chat or Interactive Agent control of Terminal in the MVP.
- No secrets injected into prompts or commands by Hobit.
- No secrets should be logged into unrelated artifacts.
- No command should run without visible session context.
- Running sessions must be visible through the owning Terminal widget.
- App-level activity may summarize running Terminal sessions, but it must not
  become a hidden scheduler.
- Kill and stop do not roll back file changes.
- The operator is responsible for commands executed in the terminal.

Terminal may allow the operator to type any shell command in a visible shell
session when PTY exists. Hobit-owned mutations and automations still require
separate explicit contracts and UI boundaries.

## Process Lifecycle

Future PTY runtime should model these states:

- Starting session.
- Running session.
- Exited session.
- Failed-to-start session.
- Stopped or killed session.

Lifecycle rules:

- Starting a session requires visible shell and working-directory context.
- Running sessions stream output to the visible Terminal surface.
- Exited sessions show exit status and final state.
- Failed-to-start sessions show an actionable error.
- Stopped or killed sessions show who initiated the stop when available.
- Widget removal must clean up or explicitly stop owned sessions.
- App close must stop or clean up owned sessions without leaving hidden shells.
- Workspace close must stop, detach, or otherwise resolve running sessions
  through an explicit product decision before implementation.
- Output beyond configured caps must be marked as capped, dropped, or
  unavailable rather than silently lost.

The first implementation may choose conservative cleanup, such as killing
sessions on widget removal, Workspace close, or app close, if that behavior is
visible and documented in the implementation block.

## Backend And Runtime Ownership

Rust/Tauri owns PTY session lifecycle.

Intended architecture:

- Backend runtime owns PTY creation, process handles, session registry, output
  readers, resize, stdin write, stop, kill, close, and cleanup.
- Frontend requests session actions through explicit Tauri commands or typed
  workspace API methods.
- Frontend receives output and lifecycle changes through Tauri events or an
  equivalent explicit event bridge.
- PTY work must run off the UI thread.
- Output events should be chunked and capped/bounded where needed so large
  output cannot freeze the Workbench.
- Event payloads should include session id, widget instance id, sequence or
  timestamp, stream kind when available, and capped output metadata.
- Backend must reject cross-Workspace, cross-Workbench, and non-Terminal widget
  session access.
- Session registry cleanup must be deterministic on session exit, widget
  removal, Workspace close, app shutdown, and failed startup.
- Runtime modules must be focused and must not accumulate in generic
  WorkspaceService or Tauri facade files.

The first backend slice should not add storage/schema behavior unless a later
prompt explicitly chooses persistent transcripts or session history.

## Platform And Shell Expectations

Windows support is first.

Initial platform expectations:

- First implementation targets Windows desktop PTY behavior.
- Default shell must be visible before launch.
- Preferred initial Windows shell should be PowerShell when available, with
  `cmd.exe` as an explicit fallback or configured option.
- If a configured shell is added, the configured executable and any default
  args must be visible.
- Hobit should start the shell process with structured program/argv and working
  directory values, not by concatenating a command string.
- Commands typed by the operator are interpreted by the selected shell; Hobit
  does not normalize shell-specific quoting.
- Path handling should preserve literal working-directory paths and surface
  startup errors clearly.
- Non-Windows support should remain future-compatible but need not be completed
  in the Windows-first backend foundation.

## Relationship To Agent Executor

Agent Executor uses its own Codex/process execution path.

Rules:

- Terminal remains a manual operator shell.
- Agent Executor must not silently run commands in Terminal.
- Agent Executor must not depend on Terminal for Direct Work execution.
- Future UX may copy commands from Agent Executor to Terminal.
- Future UX may open a Terminal in the same execution workspace or repository
  root.
- Any handoff from Agent Executor to Terminal must be visible and
  operator-controlled.

Terminal PTY work must not change Codex Direct Work behavior, validation
behavior, run history, or Agent Executor Git handoff.

## Relationship To Git Widget

Git Widget remains the Git review surface.

Rules:

- Terminal can be used manually by the operator to run Git commands.
- Hobit-owned Git mutations should remain explicit Git Widget actions when
  implemented.
- Terminal output does not replace Git Widget state.
- Terminal output does not update Git Widget status automatically.
- Terminal must not add auto-commit, auto-push, reset, clean, checkout, rebase,
  merge, stash, or patch-apply flows.

Git Widget and Terminal may later share visible repository-root handoff flows
when the execution workspace is a Git repository, but that requires a separate
implementation block.

## Relationship To Queue And Coordinator Chat

Agent Queue should not run Terminal commands in the MVP.

Coordinator Chat / Interactive Agent should not control Terminal in the MVP.

Future integrations require separate contracts that define:

- Operator approval.
- Visible command preview.
- Context boundaries.
- Result handling.
- Audit/log behavior.
- Failure and cancellation behavior.

No Queue, Interactive Agent, Coordinator, or agent runtime may use Terminal as a
hidden execution backend.

## Frontend UX Minimum

The first PTY UI should target an Operational surface: useful for a real manual
session, but not Full / Expert terminal management.

Minimum UI:

- terminal buffer
- prompt/input focus on the active session
- command entry through PTY stdin
- running, exited, failed, stopped, and killed status
- visible shell
- visible working directory / execution workspace
- clear buffer control
- copy output control
- resize handling that propagates columns/rows to the PTY
- Stop control
- Kill control with stronger visual risk language
- close session control after exit or explicit confirmation
- unsupported state in browser/Vite fallback

The first PTY UI should not require tabs, split panes, persistent history,
profiles, search, transcript export, or Coordinator handoff.

## Persistence, Logs, And Results

Initial PTY output should be session-only unless a later block explicitly adds
transcript persistence.

Initial persistence decisions:

- PTY transcript/output is not persisted by default.
- PTY command history is not persisted by default.
- Shell scrollback is frontend/runtime session state only.
- Widget-local logs may record bounded lifecycle entries such as `Session
  started`, `Session exited`, `Session stopped`, `Session killed`, and startup
  errors.
- If WidgetRun records are used in the first runtime slice, they should model a
  session-level run, not a per-command history.
- PTY session output must not be stored in one-shot command result fields.
- Terminal output must not be sent to AI, Notes, Queue, Git, Agent Executor, or
  Evidence/Sources automatically.

Difference from current one-shot command runner:

- One-shot command runner persists a bounded final stdout/stderr result for one
  explicit program/argv execution.
- PTY is an interactive session and should initially keep transcript and
  command history session-only.
- A later transcript/history feature requires a separate storage and privacy
  decision.

## Staged Implementation Plan

### Slice 1: PTY Backend Foundation

- Add a focused Windows-first PTY runtime/session module. Implemented as a
  desktop runtime registry backed by Windows ConPTY.
- Add create/write/resize/stop/kill/close primitives behind internal service
  boundaries. Implemented with session get/list state.
- Keep sessions Workspace/Workbench/Terminal-widget scoped.
- Keep transcript and command history session-only.
- No Coordinator, Queue, Agent Executor, Git, Notes, Evidence/Sources, or
  storage integration.

### Slice 2: Tauri Event Bridge Hardening

- Typed desktop-only commands for create, write stdin, resize, stop, kill,
  close, get, and list now exist.
- Add or harden bounded output/lifecycle events when the frontend needs live
  push updates instead of inspect/list polling.
- Reject browser fallback and cross-owner access clearly.
- Keep the bridge independent from the current one-shot `run_terminal_command`
  path.

### Slice 3: Frontend Terminal PTY UI

- Add the minimal Operational PTY UI in the existing Terminal widget.
  Implemented as a visible `PTY session` mode.
- Show buffer, input focus, working directory, shell, status, clear/copy,
  resize, stop, kill, and close controls. Implemented through scoped
  WorkspaceApi/Tauri calls with bounded buffer refresh.
- Preserve current one-shot `Run command` behavior. Implemented as a secondary
  visible mode.
- No tabs or split panes in this slice unless the prompt explicitly narrows and
  approves that expansion.

### Slice 4: Stop/Kill Hardening

- Harden graceful terminate vs force kill behavior.
- Verify process-tree cleanup on Windows.
- Make close/app/workspace/widget cleanup behavior visible and deterministic.
- Add tests around duplicate stop/kill, already-exited sessions, and failed
  startup.

### Slice 5: Smoke And Manual Verification

- Add deterministic smoke coverage for session create, output event, stdin,
  resize, stop, kill, and close if automation can do so reliably.
- Add manual desktop verification checklist for PowerShell/cmd behavior,
  resizing, copy, clear, session closure, and no hidden sessions.

### Slice 6: Optional One-Shot Fallback Integration

- Decide whether `Run command` remains in the same Terminal surface as a
  secondary mode, moves behind a details panel, or becomes a compact fallback.
- Keep one-shot widget run/log/result behavior compatible.
- Do not remove one-shot behavior until the PTY path is stable and a separate
  compatibility decision is made.

Later slices may add tabs, split panes, session history, multi-line paste
confirmation, search output, copy selected output, save transcript, open
Terminal from Agent Executor, open Terminal from Git Widget, safe paste
handling, and Agent Executor copy-to-terminal handoff.

Each slice must state whether it changes runtime behavior, storage, Tauri
commands, frontend UI, widget behavior, or cross-widget handoff.

## UI Direction

Future Terminal UI should match `docs/PRODUCT_UI_VISUAL_CONTRACT.md`.

Target direction:

- Dark shell surface.
- Tabs at top when tabs are implemented.
- Active pane clear when panes are implemented.
- Status line.
- Working directory visible.
- Shell visible.
- Compact controls.
- Scrollable output.
- Monospace output.
- Clear running, exited, failed, stopped, and unsupported states.
- Stop and kill controls are visible only when lifecycle support exists.

Do not show fake PTY UI before backend PTY/session support exists.

## Prohibited Overclaims

Do not show:

- Tabs as working before tabs exist.
- Split panes before split panes exist.
- Interactive shell before PTY exists.
- Agent-controlled Terminal before contract and implementation exist.
- Persistent history before persistence exists.
- Streaming output before streaming exists.
- Kill/stop controls before lifecycle support exists.
- Shell profile controls before shell profile support exists.

Terminal may mention later PTY direction such as tabs, splits, event streaming,
or history in concise copy, but must not render controls that look operational
before the backing behavior exists.

## Recommended Follow-Up Blocks

- Block 240  Terminal PTY backend foundation.
- Block 241  Terminal PTY frontend shell UI.
- Later  Terminal PTY output/lifecycle event bridge hardening.
- Block 243  Terminal stop/kill hardening.
- Block 244  Terminal PTY smoke/manual verification.
- Later  One-shot `Run command` fallback integration polish.
- Later  Terminal tabs UI.
- Later  Terminal split panes UI.
- Later  Terminal transcript/history.
- Later  Terminal search/copy.
- Later  Safe paste handling.
- Later  Agent Executor copy-to-terminal handoff.

## Non-Goals

The current PTY foundation still does not implement:

- Event-streamed output/lifecycle bridge hardening.
- Tabs implementation.
- Split panes implementation.
- Storage/schema changes.
- Git mutation.
- Queue integration.
- Agent integration.
- Direct Work runtime changes.
- Current Terminal behavior changes.
- Scratch workspace creation.
- Persistent PTY transcripts or command history.
- Shell profile management.
