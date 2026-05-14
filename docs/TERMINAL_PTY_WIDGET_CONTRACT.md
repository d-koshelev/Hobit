# Terminal PTY Widget Contract

## Purpose

This contract defines the future transition from the current one-shot Terminal
widget to a real interactive shell surface.

It is a docs/contracts-only boundary. It does not implement Terminal PTY
behavior, frontend terminal UI changes, backend commands, Tauri commands,
storage/schema changes, process/session runtime, tabs, split panes, Queue
execution, Git mutation, or changes to the current one-shot Terminal behavior.

Future implementation must preserve Hobit's Workbench-first product model:
Terminal is a widget capability inside the Workbench, not the product center,
not a hidden automation path, and not an Agent Executor replacement.

## Current State

Current Terminal is a bounded one-shot command runner.

Current Terminal:

- Is desktop-only for local process execution.
- Accepts an explicit program, argv, working directory, timeout, and output
  caps.
- Creates widget run/log/result records for persisted Terminal widget
  instances.
- Shows the final stdout/stderr result.
- Is not a PTY.
- Is not an interactive shell.
- Has no persistent shell session.
- Has no tabs.
- Has no split panes.
- Has no streaming stdin/stdout session.
- Has no command history, shell profile model, cancellation, or Agent-triggered
  execution.

The current UI must remain honest about this boundary until PTY/session support
exists.

## Target Role

Terminal: interactive shell workspace for manual operator commands.

## Future PTY Behavior

Future Terminal PTY behavior should support:

- Start a shell session.
- Stream stdout and stderr live.
- Send stdin to the active session.
- Resize the terminal and propagate size changes to the PTY.
- Close a session.
- Kill a session.
- Show exit status.
- Show working directory.
- Support multiple tabs.
- Support split panes later.
- Show session status.
- Preserve operator control.

Terminal commands must remain visible, manual, and tied to an explicit Terminal
widget session.

## Session Model

A future Terminal session should be modeled conceptually with these fields:

- `session_id`
- `workspace_id`
- `workbench_id`
- `widget_instance_id`
- `tab_id`
- `pane_id`
- `shell`
- `working_directory`
- `status`
- `started_at`
- `ended_at`
- `exit_code`
- `title`
- `is_active`

These fields define product and runtime expectations only. They do not define
a storage schema, API DTO, Rust type, TypeScript type, migration, or current
implementation.

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
- stdout and stderr stream live.
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

## Safety Boundaries

Terminal is operator-driven.

Rules:

- Terminal should not be used by agents automatically in the first PTY slice.
- No hidden command execution.
- No background shell sessions without visible status.
- No automatic Git mutation.
- No automatic commit, push, reset, or clean.
- No Queue-driven Terminal command execution.
- No Interactive Agent control of Terminal in the MVP.
- No secrets should be logged into unrelated artifacts.
- No command should run without visible session context.
- Running sessions must be visible through the owning Terminal widget.
- App-level activity may summarize running Terminal sessions, but it must not
  become a hidden scheduler.

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

## Relationship To Agent Executor

Agent Executor uses its own Codex/process execution path.

Rules:

- Terminal remains a manual operator shell.
- Agent Executor must not silently run commands in Terminal.
- Agent Executor must not depend on Terminal for Direct Work execution.
- Future UX may copy commands from Agent Executor to Terminal.
- Future UX may open a Terminal in the same repository root.
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

Git Widget and Terminal may later share visible repository-root handoff flows,
but that requires a separate implementation block.

## Relationship To Queue And Interactive Agent

Agent Queue should not run Terminal commands in the MVP.

Interactive Agent should not control Terminal in the MVP.

Future integrations require separate contracts that define:

- Operator approval.
- Visible command preview.
- Context boundaries.
- Result handling.
- Audit/log behavior.
- Failure and cancellation behavior.

No Queue, Interactive Agent, Coordinator, or agent runtime may use Terminal as a
hidden execution backend.

## First Implementation Slice

Recommended first PTY implementation:

- Backend/Tauri PTY/session foundation only.
- Start one shell session.
- Stream output.
- Write input.
- Resize.
- Stop or kill.
- Show session status through a minimal integration path.
- No tabs UI yet.
- No split panes yet.
- No persistence required yet.
- No Agent, Queue, Git, or Notes integration.

This slice should prove the PTY/session boundary before product UI grows around
it.

## Second Implementation Slice

Terminal tabs UI MVP:

- One Terminal widget with tabs.
- Create tab.
- Close tab.
- Active tab.
- Streamed output display.
- Input field or terminal surface.
- Visible status per tab.
- Running-tab close confirmation or stop behavior.

This slice should not add split panes, session history, Agent control, Queue
execution, or Git mutation.

## Later Implementation Slices

Later slices may add:

- Split panes.
- Session history.
- Multi-line paste confirmation.
- Search output.
- Copy selected output.
- Save transcript.
- Link to repository root.
- Open Terminal from Agent Executor.
- Open Terminal from Git Widget.
- Terminal transcript/history.
- Terminal search/copy refinements.
- Safe paste handling.
- Agent Executor copy-to-terminal handoff.

Each slice should remain explicit about whether it changes runtime behavior,
storage, Tauri commands, frontend UI, widget behavior, or cross-widget handoff.

## UI Direction

Future Terminal UI should match `docs/PRODUCT_UI_VISUAL_CONTRACT.md`.

Target direction:

- Dark shell surface.
- Tabs at top.
- Active pane clear.
- Status line.
- Working directory visible.
- Compact controls.
- Scrollable output.
- Monospace output.
- Clear running, exited, failed, stopped, and unsupported states.

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

The current one-shot Terminal may mention the future PTY direction in concise
copy, but must not render controls that look operational before the backing
behavior exists.

## Recommended Follow-Up Blocks

- Block 184  Terminal PTY backend foundation.
- Block 185  Terminal tabs UI MVP.
- Block 186  Terminal split panes UI.
- Later  Terminal transcript/history.
- Later  Terminal search/copy.
- Later  Safe paste handling.
- Later  Agent Executor copy-to-terminal handoff.

## Non-Goals

This contract does not implement:

- UI implementation.
- Backend implementation.
- Tauri commands.
- PTY runtime.
- Shell process management.
- Tabs implementation.
- Split panes implementation.
- Storage/schema changes.
- Git mutation.
- Queue integration.
- Agent integration.
- Direct Work runtime changes.
- Current Terminal behavior changes.
