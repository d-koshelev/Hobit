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
current MVP subset: Workspace Agent planning/review, visible
attachments, Skill attach, Queue/Executor metadata and preview attach, pasted
result review, and explicit Queue/Executor async execution. It must not be
read as proof that direct Workspace Agent filesystem, command, SSH, JDBC, Git, or
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
- [ ] Create or open a disposable Workspace.
- [ ] Add or open Workspace Agent.
- [ ] Add or open Skill Library.
- [ ] Add or open Agent Queue.
- [ ] Add or open Agent Executor.

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

## C. Skill Library Support

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

Notes:

```text
```

## D. Queue Execution

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

## E. Run Review

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

## F. Safety Assertions

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
  mutation, server runtime, or RBAC behavior is presented as implemented.
- [ ] Executor is presented as the async/background worker for Queue tasks, not
  as the only agent that can ever do Workspace work.
- [ ] Widgets are presented as current UI surfaces and future capability
  providers, without implying current hidden Workspace Agent capability access.

Notes:

```text
```

## G. Known Limitations

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
  Queue/Executor handoff, and unsupported Terminal PTY behavior on Linux.

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

A. Setup: [ ] pass [ ] partial [ ] fail [ ] not attempted
B. Workspace Agent planning: [ ] pass [ ] partial [ ] fail [ ] not attempted
C. Skill Library support: [ ] pass [ ] partial [ ] fail [ ] not attempted
D. Queue execution: [ ] pass [ ] partial [ ] fail [ ] not attempted
E. Run review: [ ] pass [ ] partial [ ] fail [ ] not attempted
F. Safety assertions: [ ] pass [ ] partial [ ] fail [ ] not attempted
G. Known limitations acknowledged: [ ] yes [ ] no

Overall result: [ ] pass [ ] partial [ ] fail

Failures or blockers:

Follow-up blocks:
```
