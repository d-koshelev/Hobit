# Hobit Desktop Smoke Checklist

## Purpose

This checklist is for real manual Tauri desktop smoke runs of the current
implemented Hobit surface using an isolated `HOBIT_DATABASE_PATH`.

It is not an automated smoke harness. Do not mark a step as passed unless it
was actually verified in the desktop UI. The mocked Queue-to-Executor smoke
remains separate and does not prove the real Tauri/WebView path.

## Scope

Covered current surfaces:

- Workspace basics
- Agent Queue to Agent Executor
- Git
- Notes
- Database / JDBC
- Coordinator Chat
- Terminal
- Runbook

Safety boundaries:

- Use a disposable Workspace and disposable repository.
- Do not use secrets, production repositories, or production database metadata.
- Do not claim a full pass unless each relevant UI step was manually observed.
- Do not treat app launch readiness as real UI verification.
- Do not perform Git commit smoke outside a disposable repository.
- Do not expect push, reset, clean, JDBC SQL execution, Terminal PTY,
  Coordinator tools, scheduler, auto-dispatch, or hidden automation.

## Prepare Isolated Desktop State

From the repository root:

```powershell
scripts/hobit/desktop-smoke-readiness.ps1 -Reset
$env:HOBIT_DATABASE_PATH = 'C:\Users\Dmitry\Documents\prj\Hobit\target\hobit-smoke\desktop\hobit-desktop-smoke.sqlite3'
npm.cmd run tauri:dev --prefix apps/desktop/frontend
```

If local PowerShell execution policy blocks direct `.ps1` invocation, run the
same helper through PowerShell with an execution-policy bypass for this process:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/hobit/desktop-smoke-readiness.ps1 -Reset
```

If using a different clone path, run
`scripts/hobit/desktop-smoke-readiness.ps1 -Reset` and copy the printed
`HOBIT_DATABASE_PATH` assignment.

Expected readiness:

- The helper reports the database parent directory is writable.
- Tauri dev startup uses the explicit `HOBIT_DATABASE_PATH`.
- The desktop window opens.
- Manual WebView interaction is available.

If the desktop window cannot be launched or interacted with, record the blocker
and leave the manual UI items unchecked.

## Manual Result Legend

- `[ ]` not attempted
- `[x]` passed
- `[~]` partial or blocked; add notes
- `[!]` failed; add exact behavior and any console output

## Recorded Attempts

### Block 222 - 2026-05-19

Scope: first real desktop smoke checklist plus bounded launch attempt using the
documented isolated `HOBIT_DATABASE_PATH` workflow.

- Readiness reset:
  `[~]` Direct `scripts/hobit/desktop-smoke-readiness.ps1 -Reset` invocation
  was blocked by the local PowerShell execution policy. The equivalent
  `powershell -NoProfile -ExecutionPolicy Bypass -File scripts/hobit/desktop-smoke-readiness.ps1 -Reset`
  command passed and reset
  `target\hobit-smoke\desktop\hobit-desktop-smoke.sqlite3`.
- Desktop launch:
  `[~]` `powershell -NoProfile -ExecutionPolicy Bypass -File scripts/hobit/desktop-smoke-readiness.ps1 -Launch`
  reached Vite ready, completed the Tauri dev build, and printed the
  `Running ...\target\debug\hobit-desktop.exe` launch marker. The command was
  stopped by a 45-second command timeout because `tauri dev` remains active
  while the desktop app is open.
- Isolated database:
  `[x]` `target\hobit-smoke\desktop\hobit-desktop-smoke.sqlite3` was created
  by the launch attempt.
- WebView interaction:
  `[~]` Not verified from the Codex tool session. This environment can run the
  launch command, but it does not provide a reliable way for Codex to manually
  drive or observe the Tauri WebView. This is not a real desktop UI smoke pass.
- Manual checklist items verified:
  `[ ]` None. Leave the Workspace, Queue-to-Executor, Git, Notes, JDBC,
  Coordinator Chat, Terminal, and Runbook UI items unchecked until an operator
  verifies them in the real desktop window.

## Workspace Basics

- `[ ]` Create a new disposable Workspace.
- `[ ]` Open the Workspace Workbench.
- `[ ]` Open the Widget Catalog.
- `[ ]` Add current widgets from the catalog.
- `[ ]` Verify retired surfaces are not shown as current insertable widgets:
  Agent Chat, Agent Monitoring, Template Library, Dock, Agent CLI, Script
  Runner, JIRA, Confluence, Image Edit.

Notes:

```text
```

## Queue-To-Executor Smoke

Use a disposable repository root. Use a non-mutating prompt such as:

```text
Return exactly: Hobit Queue to Executor smoke. Do not edit files.
```

- `[ ]` Add Agent Queue.
- `[ ]` Add Agent Executor.
- `[ ]` Create a Queue task with title, description, prompt, status, and
  priority.
- `[ ]` Save the task.
- `[ ]` Assign the task to the visible Agent Executor slot.
- `[ ]` Confirm assignment is visible in Agent Queue.
- `[ ]` Run the assigned task with an explicit repository root.
- `[ ]` Verify Agent Executor receives the queue-started run.
- `[ ]` Verify Agent Executor shows run visibility: live log, stop/cancel while
  running when applicable, final response, and final status.
- `[ ]` Verify Agent Queue refreshes the final task status after completion,
  failure, or cancellation.
- `[ ]` Verify Agent Queue does not duplicate live execution logs and does not
  auto-dispatch additional work.

Notes:

```text
```

## Git Smoke

Use a disposable Git repository. For commit smoke, use a repo created only for
this test.

- `[ ]` Add Git widget.
- `[ ]` Enter an explicit repository root.
- `[ ]` Refresh status.
- `[ ]` Verify branch, clean/dirty state, and changed-file groups render.
- `[ ]` If using a disposable repo, make a harmless local file change and
  refresh status again.
- `[ ]` Perform explicit local commit only after reviewing selected files and
  confirming the commit action in the UI.
- `[ ]` Verify commit result appears if commit was attempted.
- `[ ]` Verify no push, reset, clean, stash, polling, watching, or hidden Git
  mutation is presented as implemented.

Notes:

```text
```

## Notes Smoke

- `[ ]` Add Notes.
- `[ ]` Create a note.
- `[ ]` Edit the note body/title where available.
- `[ ]` Save explicitly.
- `[ ]` Refresh or reopen the Workspace if practical.
- `[ ]` Verify the note persists.
- `[ ]` Verify autosave, delete, tags, Markdown rendering, Mermaid, and
  AI-in-Notes are not presented as implemented.

Notes:

```text
```

## Database / JDBC Shell Smoke

Use non-secret placeholder metadata only.

- `[ ]` Add Database / JDBC.
- `[ ]` Verify connector metadata shell is visible.
- `[ ]` Create or edit a connector descriptor using non-secret masked metadata.
- `[ ]` Verify no passwords, tokens, secret references, driver jars, SQL query
  execution, `EXPLAIN`, result grid, formatter, or AI assistance is presented
  as implemented.

Notes:

```text
```

## Coordinator Chat Smoke

- `[ ]` Add Coordinator Chat.
- `[ ]` Send a local placeholder message.
- `[ ]` Verify the assistant response is local placeholder behavior only.
- `[ ]` Verify no provider, tools, hidden context access, Queue integration,
  JDBC integration, Git mutation, file mutation, or Terminal execution is
  claimed.

Notes:

```text
```

## Terminal Smoke

Use a harmless command only.

Example Windows one-shot command:

```text
program: cmd
args:
/c
echo hobit-terminal-smoke
```

- `[ ]` Add Terminal.
- `[ ]` Run a harmless one-shot command with explicit program, args, working
  directory, timeout, and output caps.
- `[ ]` Verify stdout/stderr/result rendering.
- `[ ]` Verify no shell session, PTY, stdin, streaming session, command
  history, environment/secrets support, or Agent-triggered execution is
  presented as implemented.

Notes:

```text
```

## Runbook Smoke

- `[ ]` Add Runbook.
- `[ ]` Verify the preview/minimal local steps surface.
- `[ ]` Toggle or inspect local step state if available.
- `[ ]` Verify persistence, edit mode, builder, Queue integration, step
  execution, Terminal execution, Git mutation, and agent-assisted steps are not
  presented as implemented.

Notes:

```text
```

## Final Smoke Result

Overall status:

- `[ ]` not attempted
- `[ ]` partial
- `[ ]` passed
- `[ ]` failed

Summary:

```text
```

Environment:

```text
HOBIT_DATABASE_PATH:
Desktop launch:
WebView interaction:
Mocked Queue-to-Executor smoke:
Real Queue-to-Executor smoke:
Git local commit smoke:
```
