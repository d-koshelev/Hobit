# Hobit Stable v0.1 Acceptance

## Purpose

This document defines the acceptance gate for Hobit Stable v0.1.

Acceptance verifies that the product behaves as the operator-controlled AI
Workbench defined in `docs/HOBIT_STABLE_V0_1_CONTRACT.md`. It is a manual and
semantic validation checklist. It does not implement automation, frontend UI,
backend behavior, storage/schema changes, runtime behavior, Finder, provider
tools, Queue scheduling, or new widgets.

## Acceptance Result Model

Use these result labels:

- `[ ]` not attempted.
- `[x]` passed.
- `[~]` partial or environment-blocked; include exact notes.
- `[!]` failed; include exact observed behavior.

Stable v0.1 passes only when all required checks are `[x]` and every blocker is
resolved or explicitly accepted as out of Stable v0.1 scope by a contract
update.

## Required Evidence

Every Stable v0.1 acceptance run must record:

- date;
- tester;
- commit under test;
- OS/platform;
- desktop launch method;
- `HOBIT_DATABASE_PATH` or database isolation notes;
- validation commands run;
- manual smoke notes;
- failures and follow-up blocks.

## A. Documentation And Surface Gate

- [ ] `docs/HOBIT_STABLE_V0_1_CONTRACT.md` exists and is the canonical Stable
  v0.1 contract.
- [ ] `docs/HOBIT_STABLE_V0_1_ACCEPTANCE.md` exists and is the canonical Stable
  v0.1 acceptance gate.
- [ ] `docs/CURRENT_WIDGET_SURFACE.md` still matches the accepted current
  product surface.
- [ ] Widget Catalog exposes only Workspace Agent, Agent Queue, Terminal, Agent
  Activity, Notes, Knowledge / Skills, Database / JDBC, Runbook, and allowed
  supporting/compatibility Agent Executor and Git entries.
- [ ] Old Agent Chat, Agent Monitoring, Template Library, Dock, Agent CLI,
  Script Runner, JIRA, Confluence, Image Edit, Knowledge Catalog, Stages, and
  separate legacy Coordinator surfaces are not presented as current product
  widgets.
- [ ] Compatibility ids `interactive-agent`, `agent-run`, and `skill-library`
  do not leak as preferred user-facing names.

## B. Workspace Start And Isolation

- [ ] Launch Hobit desktop with an isolated database when needed.
- [ ] Create a new Workspace.
- [ ] Verify the default Workspace opens to Workspace Agent plus Notes.
- [ ] Verify Empty Workbench remains available only as an advanced/manual start
  mode where current behavior supports it.
- [ ] Close the Workspace from the Workbench top bar and return to the Start
  Screen.
- [ ] Reopen the Workspace from recent Workspaces.
- [ ] Verify recent Workspace summaries expose safe counts only and no raw
  prompts, logs, stdout/stderr, result payloads, secrets, or repository paths.
- [ ] Verify creating a second unrelated Workspace does not mix notes, tasks,
  runs, widgets, Knowledge, Git state, Terminal sessions, or JDBC metadata.

## C. Workbench And Widget Shell

- [ ] Add each accepted product-facing widget where implemented.
- [ ] Move a docked widget by its header/top area.
- [ ] Resize a widget with available resize handles.
- [ ] Enable layout lock and verify movement/resize handles are disabled.
- [ ] Float a widget and verify a ghost placeholder remains.
- [ ] Dock the widget back without creating a new widget instance.
- [ ] Remove a widget and verify confirmation is required.
- [ ] Open widget-local Logs and verify logs are widget-owned, bounded, and not
  confused with Terminal PTY transcripts or Agent Activity history.
- [ ] Verify WorkbenchCanvas does not bypass WidgetHost/registry-driven
  rendering for current widgets.

## D. Workspace Agent

- [ ] Open or use Workspace Agent.
- [ ] Send an explicit planning prompt.
- [ ] Verify planning or proposal output uses only visible chat text.
- [ ] Verify Queue task drafts, Note drafts, Knowledge Document drafts, Skill
  drafts, or JDBC suggestion drafts are inert review cards until separately
  acted on.
- [ ] Approve a draft and verify approval alone does not execute, create Queue
  tasks, mutate Notes, run SQL, launch Terminal, mutate Git, or start Executor.
- [ ] Create a Queue task from an approved draft through a separate explicit
  action.
- [ ] Create a Note, Knowledge Document, or Skill from an approved draft only
  through the separate explicit create action where current behavior supports
  it.
- [ ] Run Workspace Agent with Codex from a visible working directory and
  prompt where current behavior supports it.
- [ ] Verify provider requests use visible/current-session context only and
  `allowed_tools: []`.
- [ ] Verify multiple Workspace Agent widgets keep independent current-session
  chat, thread id, and working directory state.
- [ ] Verify changing Workspace Agent working directory clears or isolates the
  relevant thread state according to current contract.

## E. Agent Queue

- [ ] Create a Queue task manually.
- [ ] Create a Queue task from Workspace Agent through the explicit create
  action.
- [ ] Edit title, prompt, priority, status, and execution policy where current
  APIs expose them.
- [ ] Save changes explicitly.
- [ ] Delete a task only through an explicit delete flow where implemented.
- [ ] Assign a selected task to a visible Agent Executor slot.
- [ ] Clear assignment explicitly.
- [ ] Start an assigned task only from visible Queue controls.
- [ ] Verify Queue does not silently dispatch tasks after Workspace Agent draft
  creation.
- [ ] Verify Queue Autorun, if used, requires explicit operator arming/starting
  and runs only current-session/local behavior.
- [ ] Verify Queue selected-task run history shows only safe metadata and never
  raw prompts, stdout/stderr, full logs, full final responses, diffs, repo
  paths, secrets, or raw JSON payloads.

## F. Agent Executor Support

- [ ] Open Agent Executor as a supporting/compatibility surface.
- [ ] Start one explicit Direct Work run from visible operator inputs.
- [ ] Verify executable, execution workspace path, prompt, sandbox, approval
  policy, timeout/output caps, and owner widget are explicit.
- [ ] Verify live logs/streaming appear where available.
- [ ] Verify stop/cancel/kill controls are visible where available.
- [ ] Verify final result and validation capture are Executor-owned.
- [ ] Verify successful execution does not imply Queue acceptance, Git commit,
  push, or automatic follow-up.
- [ ] Verify Executor cannot silently dispatch Queue tasks or become Terminal
  shell mode.

## G. Agent Activity

- [ ] Open Agent Activity before or during Workspace Agent / Executor runs.
- [ ] Verify current-session events appear as readable timeline rows.
- [ ] Verify rows can expand for available detail/raw previews.
- [ ] Verify raw details are collapsed by default.
- [ ] Reload or reopen as needed and verify Agent Activity does not claim
  persisted timeline history unless a future contract implements it.
- [ ] Verify Agent Activity cannot execute work or alter Queue/Executor state.

## H. Notes

- [ ] Create a Note.
- [ ] Select/read the Note.
- [ ] Edit title/body/pinned fields.
- [ ] Save explicitly.
- [ ] Filter the Notes list.
- [ ] Reopen the Workspace in desktop mode and verify persistence where desktop
  Notes APIs are available.
- [ ] Verify browser/dev fallback behavior is labeled correctly if used.
- [ ] Verify existing Notes are not silently read, summarized, searched, or sent
  to Workspace Agent.
- [ ] Verify Notes does not present full Notebook, Markdown rendering, Mermaid,
  checklists, formatting tools, autosave, AI-in-Notes, or hidden ingestion as
  implemented.

## I. Knowledge / Skills

- [ ] Create, edit, save, and delete a Skill.
- [ ] Verify Skill fields include title, when-to-use, prerequisites, steps,
  validation, risks, tags, and review status.
- [ ] Attach the selected saved Skill to Workspace Agent.
- [ ] Verify attached Skill context is visible, editable/removable before Send,
  and does not auto-send.
- [ ] Create workspace-local and local-global Knowledge Documents.
- [ ] Import one explicit `.txt`, `.md`, or `.markdown` file.
- [ ] Search/list Knowledge Documents.
- [ ] Verify enabled-only Workspace/Global snippets are visible and capped when
  included in Workspace Agent Codex runs.
- [ ] Verify disabled documents and Skills are not silently injected.
- [ ] Verify no folder scan, binary parsing, embeddings, Evidence, Context
  Pack, team/server sharing, or hidden memory is presented as implemented.

## J. Terminal

- [ ] Start a desktop PTY session with explicit shell executable and working
  directory on a supported platform.
- [ ] Verify xterm renders normal output, ANSI/control sequences, and keyboard
  input.
- [ ] Resize and verify the PTY remains usable.
- [ ] Stop, Kill, and Close through visible controls.
- [ ] Verify PTY output is session-only and not persisted as widget
  logs/results.
- [ ] Verify collapsed one-shot fallback requires explicit program, argv,
  working directory, timeout, and output caps.
- [ ] Verify Workspace Agent, Queue, and Executor cannot control Terminal.
- [ ] Verify unsupported platforms report visible unsupported behavior rather
  than pretending live PTY works.

## K. Git

- [ ] Enter an explicit repository root.
- [ ] Refresh status manually.
- [ ] Verify grouped changed files render.
- [ ] Select a changed file and verify bounded read-only diff renders.
- [ ] Verify recent history renders.
- [ ] Commit only selected files with an operator-provided message and explicit
  confirmation.
- [ ] Verify Git does not persist repository root/status as Workspace state.
- [ ] Verify Git does not fetch, push, reset, clean, stash, checkout/switch,
  watch, poll, scan parent directories, or auto-commit Executor output.

## L. Database / JDBC Preview

- [ ] Create, list, read, update, and select connector metadata.
- [ ] Verify connector/profile metadata stores no password values, tokens,
  private keys, certificates, or secret-bearing JDBC URLs.
- [ ] Run a supported bounded read-only mock/safe query.
- [ ] Verify result caps, timeout caps, result-byte caps, and visible errors are
  shown.
- [ ] Verify unsupported or unsafe SQL is rejected visibly.
- [ ] Verify production external database execution is not presented as the
  default Stable v0.1 path.
- [ ] Verify Workspace Agent cannot execute JDBC queries.
- [ ] Verify Boundary Finder preview, if visible, does not execute probes or
  persist presets.

## M. Runbook Preview

- [ ] Open Runbook.
- [ ] Verify built-in/manual step list renders.
- [ ] Change local step states where current behavior supports it.
- [ ] Add local notes/evidence text where current behavior supports it.
- [ ] Verify Runbook does not persist runbooks, edit/build templates, execute
  steps, launch Terminal, create Queue items, mutate Git, or integrate with
  Workspace Agent.

## N. Finder Gap

- [ ] Verify Finder is either implemented under an accepted Finder contract or
  recorded as a blocking Stable v0.1 gap.
- [ ] Verify Finder is not silently added as a generic file browser, hidden
  scanner, Git surface, Terminal launcher, broad context ingestion path, or
  Workspace Agent hidden context source.

Stable v0.1 cannot pass while this section remains `[ ]`, `[~]`, or `[!]`.

## O. UI And Product Rules

- [ ] Workbench is the visual center.
- [ ] Every capability surface is a widget.
- [ ] Widget header is the top meta zone of one continuous widget surface.
- [ ] No box-inside-box composition or duplicated information dominates the
  current surface.
- [ ] Preview surfaces look intentionally limited and do not overclaim.
- [ ] Theme colors come from the locked theme/design system.
- [ ] No gradients or raw one-off colors are introduced.
- [ ] Operator can always identify Workspace, current work, agent activity, and
  pending approvals.
- [ ] Approval, execution, and acceptance remain separate visible states.

## P. Safety Assertions

- [ ] Workspace Agent does not silently read Notes.
- [ ] Workspace Agent does not silently read Queue history.
- [ ] Workspace Agent does not silently read Executor logs/results.
- [ ] Workspace Agent does not silently read Terminal output.
- [ ] Workspace Agent does not silently read Git status/diffs/history.
- [ ] Workspace Agent does not silently read JDBC connector/query data.
- [ ] Workspace Agent does not silently read files or folders.
- [ ] Workspace Agent provider requests keep `allowed_tools: []`.
- [ ] No hidden Context Pack, Evidence, Artifact, Knowledge, Note, Git, JDBC,
  Terminal, filesystem, Queue, or Executor context is sent.
- [ ] No secrets, raw stdout/stderr, full final responses, diffs, prompts, repo
  paths, or raw payloads are attached automatically.
- [ ] Queue does not auto-accept work.
- [ ] Executor success does not imply acceptance.
- [ ] No hidden execution, hidden mutation, hidden Queue dispatch, Terminal
  launch, Git mutation, JDBC execution, or broad file mutation is presented as
  implemented.

## Q. Required Validation Commands

Run the repository validation commands required by the block under test. For a
docs-only Stable v0.1 acceptance update, the minimum command set is:

```text
git status --short --branch
git diff --stat
git diff --check
```

For implementation blocks that claim Stable v0.1 readiness, also run the
appropriate Hobit Toolbelt profile and platform smoke checks required by the
changed surface. Do not claim Stable v0.1 acceptance from docs-only validation.

## Stable v0.1 Pass/Fail Report Template

```text
Date:
Tester:
Commit under test:
Platform:
HOBIT_DATABASE_PATH:
Desktop launch:
Validation commands:

A. Documentation and surface gate: [ ] pass [ ] partial [ ] fail [ ] not attempted
B. Workspace start and isolation: [ ] pass [ ] partial [ ] fail [ ] not attempted
C. Workbench and widget shell: [ ] pass [ ] partial [ ] fail [ ] not attempted
D. Workspace Agent: [ ] pass [ ] partial [ ] fail [ ] not attempted
E. Agent Queue: [ ] pass [ ] partial [ ] fail [ ] not attempted
F. Agent Executor support: [ ] pass [ ] partial [ ] fail [ ] not attempted
G. Agent Activity: [ ] pass [ ] partial [ ] fail [ ] not attempted
H. Notes: [ ] pass [ ] partial [ ] fail [ ] not attempted
I. Knowledge / Skills: [ ] pass [ ] partial [ ] fail [ ] not attempted
J. Terminal: [ ] pass [ ] partial [ ] fail [ ] not attempted
K. Git: [ ] pass [ ] partial [ ] fail [ ] not attempted
L. Database / JDBC Preview: [ ] pass [ ] partial [ ] fail [ ] not attempted
M. Runbook Preview: [ ] pass [ ] partial [ ] fail [ ] not attempted
N. Finder gap: [ ] pass [ ] partial [ ] fail [ ] not attempted
O. UI and product rules: [ ] pass [ ] partial [ ] fail [ ] not attempted
P. Safety assertions: [ ] pass [ ] partial [ ] fail [ ] not attempted
Q. Required validation commands: [ ] pass [ ] partial [ ] fail [ ] not attempted

Overall result: [ ] pass [ ] partial [ ] fail

Blockers:

Follow-up blocks:
```
