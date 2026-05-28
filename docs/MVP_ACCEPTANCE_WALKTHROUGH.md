# MVP Acceptance Walkthrough

## Purpose

This checklist prepares a manual MVP acceptance walkthrough for the current
Workspace Agent Hobit flow.

It is a validation checklist only. It does not add product behavior, backend
behavior, Tauri commands, DTOs, schema/storage changes, Queue Autorun behavior,
Agent Executor runtime behavior, hidden context, Context Packs, tool
execution, server runtime, or RBAC.

Use this walkthrough with the current surface documented in
`docs/CURRENT_WIDGET_SURFACE.md`. For broader desktop smoke setup and existing
surface checks, see `scripts/hobit/DESKTOP_SMOKE_CHECKLIST.md`. For the
Queue-specific readiness checkpoint, see
`docs/AGENT_QUEUE_DESKTOP_MVP_READINESS.md`.

The target architecture treats Workspace Agent as the foreground interactive AI
agent widget for Workspace work through controlled capabilities. Multiple
Workspace Agent widgets can exist in one Workspace, each with independent
context/thread/working-directory state. This walkthrough verifies only the
current MVP subset: Start Screen/recent Workspace flow, Workspace Agent
foreground Codex run behavior, Agent Activity timeline, Knowledge / Skills
workspace/global documents, visible attachments, Queue/Executor metadata and
preview attach, Git diff/history/local commit review, Terminal xterm PTY,
theme/UI scale preferences, movable widgets, pasted result review, and explicit
Queue/Executor async execution. It must not be read as proof that hidden
Workspace Agent filesystem scanning, SSH, JDBC, Git, Terminal control, or
provider tool execution exists.

## Result Legend

- `[ ]` not attempted
- `[x]` passed
- `[~]` partial or blocked; add notes
- `[!]` failed; add exact behavior

## A. Setup

- [ ] Launch Hobit desktop in a manual Tauri/WebView environment.
- [ ] Use an isolated database when needed:
  `scripts/hobit/desktop-smoke-readiness.ps1 -Reset`, then launch with the
  printed `HOBIT_DATABASE_PATH`.
- [ ] On Linux, use `scripts/hobit/validate.sh --profile full` for repository
  validation and launch the Tauri desktop shell with the same isolated
  `HOBIT_DATABASE_PATH` idea. Codex Direct Work should use `codex` by default
  on Unix/Linux; Windows should keep `codex.cmd`.
- [ ] Verify the Start Screen shows recent Workspaces when present, with safe
  counts only and no raw prompts, logs, stdout/stderr, or Executor payloads.
- [ ] Create a disposable Workspace from the Start Screen.
- [ ] Close the Workspace from the Workbench top bar and reopen it from the
  recent Workspace list.
- [ ] Add or open Workspace Agent.
- [ ] Add or open Agent Activity.
- [ ] Add or open Knowledge / Skills.
- [ ] Add or open Agent Queue.
- [ ] Add or open Agent Executor.
- [ ] Add or open Git.
- [ ] Add or open Terminal.
- [ ] Add or open Notes.

Notes:

```text
```

## B. Workspace Agent Planning

- [ ] In Workspace Agent, use the suggested planning prompt or type an
  explicit planning request.
- [ ] Verify a Plan card appears from visible chat text.
- [ ] Verify Queue task draft cards appear when the planning prompt calls for
  promoted/larger async work.
- [ ] Verify approving draft cards is local review only.
- [ ] Verify each `Create Queue task` action is separate and explicit.
- [ ] Verify Queue task creation creates a draft/manual task only and does not
  assign, start, run, or arm Queue Autorun.

Notes:

```text
```

## C. Knowledge / Skills Support

- [ ] Create a Skill with title, when-to-use, prerequisites, steps,
  validation, risks, tags, and review status.
- [ ] Save the Skill.
- [ ] Edit the selected Skill but leave at least one change unsaved.
- [ ] Attach the saved Skill to Workspace Agent.
- [ ] Verify unsaved edits are not attached.
- [ ] Verify visible attached Skill context appears in the Workspace Agent
  composer.
- [ ] Verify attached context is editable or removable before Send.
- [ ] Verify attaching a Skill does not automatically Send.
- [ ] Create a workspace-scoped Knowledge Document with enabled checked.
- [ ] Create a global Knowledge Document with enabled checked.
- [ ] Import one `.txt`, `.md`, or `.markdown` file explicitly into a
  workspace-scoped or global Knowledge Document.
- [ ] Disable one document and verify disabled documents are not shown as used
  retrieval context for Workspace Agent Codex runs.
- [ ] Run Workspace Agent with a prompt that should match enabled workspace and
  global documents.
- [ ] Verify retrieval snippets are capped, visible in Direct Work details, and
  labeled Workspace or Global.
- [ ] Verify global means local desktop DB/global across local Workspaces, not
  team/enterprise/server knowledge.

Notes:

```text
```

## D. Workspace Agent Codex Run

- [ ] Set Workspace Agent working directory by typing a path.
- [ ] Use Browse to choose one directory where the desktop dialog is available.
- [ ] Verify Browse only updates the visible working-directory field and does
  not scan the folder or start a run.
- [ ] Run with Codex from the visible composer.
- [ ] Verify Workspace Agent shows a compact one-line live activity summary
  while the run is active.
- [ ] Verify the final assistant response appears in chat while raw Direct Work
  details remain collapsed.
- [ ] Verify follow-up Run with Codex resumes only the current widget's explicit
  thread id.
- [ ] Verify New thread clears the current thread id without clearing visible
  chat.
- [ ] Verify changing the working directory clears the current thread id for
  the next run.

Notes:

```text
```

## E. Agent Activity Timeline

- [ ] While Workspace Agent or Agent Executor Direct Work runs, open Agent
  Activity.
- [ ] Verify current-session events appear as readable one-line timeline rows.
- [ ] Verify rows can expand to show details/raw previews when present.
- [ ] Verify raw event previews remain collapsed by default.
- [ ] Verify the timeline does not claim to show persisted history after app
  reload/reopen unless a later implementation adds stored history.

Notes:

```text
```

## F. Queue Execution

- [ ] Create a Queue task from a Workspace Agent draft through the explicit
  `Create Queue task` action.
- [ ] Verify the task appears in Agent Queue.
- [ ] Assign the task to a visible Agent Executor slot.
- [ ] Configure the explicit execution workspace/repository root, Codex
  executable, sandbox, and approval policy.
- [ ] Run the selected assigned task, or explicitly start Queue Autorun from
  the visible Queue controls.
- [ ] Verify Queue execution is operator-triggered and visible.
- [ ] Verify Agent Executor owns live execution state, raw run details, logs,
  final response, stop/cancel controls, and run history.
- [ ] Verify Queue does not silently dispatch tasks from Workspace Agent.

Notes:

```text
```

## G. Run Review

- [ ] Verify the selected Queue task shows latest run metadata when available.
- [ ] Verify Queue run history shows only safe metadata: link/run refs, source,
  status, timestamps, and review status.
- [ ] Open or focus the Agent Executor run detail from the safe Queue link.
- [ ] Attach safe run metadata to Workspace Agent.
- [ ] Attach a selected Agent Executor excerpt or visible preview section to
  Workspace Agent.
- [ ] Verify attached run context is visible in the Workspace Agent composer.
- [ ] Verify attached run context is editable or removable before Send.
- [ ] Paste or send visible result text to Workspace Agent.
- [ ] Verify Workspace Agent can review only the pasted or attached visible result
  text.

Notes:

```text
```

## H. Git Review

- [ ] Enter an explicit repository root in Git.
- [ ] Refresh Git status manually.
- [ ] Verify Changes shows grouped changed files.
- [ ] Select a changed file and verify Diff shows a bounded read-only diff.
- [ ] Verify History shows recent commits.
- [ ] Verify Commit requires selected files, an operator-provided message, and
  explicit confirmation.
- [ ] Verify Git does not fetch, push, reset, clean, stash, checkout, watch,
  poll, or persist the repository root.

Notes:

```text
```

## I. Terminal PTY

- [ ] Start a Terminal PTY session from an explicit shell and working
  directory.
- [ ] Verify xterm renders normal output and ANSI/control-sequence behavior.
- [ ] Send keyboard input through the terminal surface.
- [ ] Resize the widget or terminal dimensions and verify the session remains
  usable.
- [ ] Stop or Kill the session through visible controls.
- [ ] Verify PTY output is session-only and not persisted as widget
  logs/results.
- [ ] Verify the one-shot fallback remains collapsed and explicit.
- [ ] On Linux, manually smoke live PTY creation, stdin, rendering, resize, and
  Stop/Kill before claiming Linux runtime verified.
- [ ] On macOS, verify live PTY is unsupported/deferred unless a future macOS
  PTY implementation exists.

Notes:

```text
```

## J. Theme, Scale, And Layout

- [ ] Change built-in theme presets, including Discord Dark.
- [ ] Edit a custom HEX color and verify the local UI updates.
- [ ] Change UI scale to at least one non-default value.
- [ ] Verify theme and UI scale are frontend-local preferences, not Workspace
  data or backend/runtime state.
- [ ] Move a docked widget by its header/top area.
- [ ] Resize a widget with the right, bottom, and corner handles.
- [ ] Enable layout lock and verify movement/resize handles are frozen.
- [ ] Remove a widget and verify confirmation is required.

Notes:

```text
```

## K. Safety Assertions

- [ ] Workspace Agent does not auto-read Skills.
- [ ] Workspace Agent does not auto-read Queue history.
- [ ] Workspace Agent does not auto-read Agent Executor logs.
- [ ] Workspace Agent provider requests keep `allowed_tools: []`.
- [ ] No hidden Context Pack context is sent.
- [ ] No hidden Artifact, Knowledge, Notes, Git, JDBC, Terminal, or filesystem
  context is sent.
- [ ] No raw stdout/stderr, full final responses, diffs, prompts, repository
  paths, secrets, or raw payloads are attached automatically.
- [ ] Skill attachments include only visible selected Skill fields and remain
  editable/removable before Send.
- [ ] Queue and Executor attachments include only safe visible metadata,
  selected excerpts, or explicitly attached visible preview sections.
- [ ] Workspace Agent does not launch Agent Executor.
- [ ] Workspace Agent does not assign Queue tasks.
- [ ] Workspace Agent does not start Queue tasks.
- [ ] Workspace Agent does not arm or start Queue Autorun.
- [ ] Queue Autorun starts only from explicit visible Queue controls.
- [ ] No tool execution, Terminal control, Git mutation, JDBC execution, file
  mutation outside explicit foreground Codex Direct Work, server runtime, or
  RBAC behavior is presented as implemented.
- [ ] Executor is presented as the async/background worker for Queue tasks, not
  as the only agent that can ever do Workspace work.
- [ ] Widgets are presented as current UI surfaces and future capability
  providers, without implying current hidden Workspace Agent capability access.

Notes:

```text
```

## L. Known Limitations

- [ ] Queue Autorun requires Hobit to remain open and the machine to remain
  awake.
- [ ] Queue Autorun is current-session-only.
- [ ] No durable Queue runner reconnect or resume exists.
- [ ] No backend scheduler exists.
- [ ] No server runtime exists.
- [ ] No RBAC exists.
- [ ] Manual visible Tauri WebView smoke is still required if the current
  environment cannot operate or observe the desktop UI.
- [ ] Linux desktop compatibility is a baseline only until a real Linux
  Tauri/WebView smoke confirms launch, Codex Direct Work, Knowledge import,
  Queue/Executor handoff, Git review, Terminal PTY, Agent Activity, theme/UI
  scale, and movable-widget behavior on Linux.
- [ ] macOS live Terminal PTY support is deferred/unsupported.

Notes:

```text
```

## Pass/Fail Report Template

```text
Date:
Tester:
Commit under test:
HOBIT_DATABASE_PATH:
Desktop launch:
WebView interaction:

A. Setup / Start Screen: [ ] pass [ ] partial [ ] fail [ ] not attempted
B. Workspace Agent planning: [ ] pass [ ] partial [ ] fail [ ] not attempted
C. Knowledge / Skills support: [ ] pass [ ] partial [ ] fail [ ] not attempted
D. Workspace Agent Codex run: [ ] pass [ ] partial [ ] fail [ ] not attempted
E. Agent Activity timeline: [ ] pass [ ] partial [ ] fail [ ] not attempted
F. Queue execution: [ ] pass [ ] partial [ ] fail [ ] not attempted
G. Run review: [ ] pass [ ] partial [ ] fail [ ] not attempted
H. Git review: [ ] pass [ ] partial [ ] fail [ ] not attempted
I. Terminal PTY: [ ] pass [ ] partial [ ] fail [ ] not attempted
J. Theme, scale, and layout: [ ] pass [ ] partial [ ] fail [ ] not attempted
K. Safety assertions: [ ] pass [ ] partial [ ] fail [ ] not attempted
L. Known limitations acknowledged: [ ] yes [ ] no

Overall result: [ ] pass [ ] partial [ ] fail

Failures or blockers:

Follow-up blocks:
```
