# Git Widget Contract

## Purpose

This contract defines the Hobit Git Widget / Git Plugin as a visual review and control surface for code changes produced during AI-assisted work.

The full future Git review cockpit is not implemented yet. This document is a
product/domain contract. The old standalone Git widget code remains as an
internal/deprecated compatibility surface with a transient explicit
repository-root input, manual desktop-only read-only status refresh through
`get_git_repository_status`, compact Changes / Diff / History / Commit
sections, grouped changed files, bounded selected-file diff review, recent
history, and an explicit local commit UI owned by Git Widget.
Local commit creation is selected-file based, uses an
operator-provided message, and requires operator confirmation. Agent Executor
also has a read-only backend/Tauri diff summary API and compact frontend diff
summary UI for an explicit repository root. These foundations do not add
repository root/status persistence, validation association, Git-response
association, storage schema changes, polling, watching, fetch, push, reset,
clean, checkout/switch branch, restore, rebase, merge, patch apply,
auto-commit, Agent Executor auto-commit, or broader runtime behavior.

Future Stable v0.1 product UX should place common Git review inside Finder
space, as defined in `docs/FINDER_UX_CONTRACT.md`: changed-file indicators and
selected-file diffs belong next to file navigation and preview. The standalone
Git Widget must not be offered as a normal product Widget Catalog entry unless
an explicit future Finder/Git migration or implementation block changes that
behavior.

Current and future explicit local commit support must also follow
`docs/GIT_COMMIT_SUPPORT_CONTRACT.md`.

## Role

The Git Widget is a first-class Workbench widget/plugin for reviewing and controlling repository state.

It should be the natural review companion after an executor agent finishes a code block. Its job is to help the operator review, validate, commit, push, revert, or request follow-up work from a clear visual surface.

The Git Widget must not be only raw `git` command output. Raw output may be available in expandable details, but the primary surface should present readable summaries, risks, and operator actions.

Rules:

- The operator remains in control.
- The widget must not perform hidden Git mutations.
- Mutating and destructive operations require explicit approval.
- The widget must make validation failures, skipped validation, dirty state, untracked files, and push-needed state visible.
- The widget should connect code changes to the agent block, response, validation results, and Workspace history when available.

## When It Should Surface

Future Hobit UI may surface or refresh the Git Widget when:

- an executor final response is received
- executor response structure is validated
- validation results are captured
- a commit is created
- a repository is dirty
- a branch is ahead or behind its upstream
- push is needed
- validation failed or was skipped
- the operator opens a Workspace with unresolved repository state

Surfacing the widget must not execute Git mutations. It only presents review state and available explicit actions.

## Visual Review Sections

### Repository Summary

The widget should summarize:

- repository path
- current branch
- clean or dirty status
- ahead/behind counts
- last commit hash, title, author, and time when available
- upstream or remote tracking state when available

### Agent Block Summary

When connected to an agent block, the widget should show:

- block title and number when known
- Agent Queue item or block status when known
- request or task id when known
- executor final response status when known
- response validation status when known
- commit hash and commit message when known
- accepted/fix/rerun/follow-up state when known

### Changed Files

The widget should group changed files by:

- staged
- unstaged
- untracked

Each changed file should indicate:

- added, modified, deleted, renamed, or copied state when available
- changed line counts when available
- whether the file appears generated when identifiable
- whether the file is potentially sensitive when identifiable without exposing secrets into prompts

### Diff Review

The widget should provide:

- compact diff summary
- per-file diff expansion
- file-level risk or attention badges when useful
- large-diff warnings
- binary-file indicators
- generated-file indicators when identifiable
- raw diff or command output only as optional detail, not the primary surface

### Validation Results

The widget should show validation associated with the current block or repository state:

- passed commands
- failed commands
- not-run commands
- warning summary
- skipped validation reason when known
- link to the executor response or block record when available

Validation failures or skipped validation must not be hidden behind a successful Git state.

### Commit / Push State

The widget should show:

- whether a commit was created
- commit hash and message when available
- branch ahead count
- branch behind count
- push reminder when local commits are not pushed
- detached HEAD or unusual branch state when known

Generated commit messages must be reviewable before commit.

### Safety / Recovery

The widget may offer recovery actions:

- discard or restore selected file
- revert commit
- stash
- reset only with strict confirmation
- clean only with strict confirmation

Destructive actions must show affected files, consequences, and confirmation state before execution.

### Follow-Up Actions

The widget may support:

- create follow-up block
- copy review summary
- prepare PR/review notes
- request fix block from failed validation
- request audit block from risky diffs

Follow-up requests should use Request Templates and Response Templates when that future capability is available.

## Repository Root Source

Before any Git status, diff, log, branch, or other Git command is executed, Hobit must have an explicit repository root selected or approved by the operator.

Repository root selection is a safety boundary:

- The repository root must be visible and reviewable in the Git Widget UI.
- Hobit must not silently infer a repository by scanning parent directories.
- Hobit must not crawl Workspace directories looking for repositories.
- Hobit must not run Git commands against arbitrary paths selected by hidden logic.
- Git read operations must not begin when no repository root is configured.

### Initial Model

The current Git implementation uses an explicit Git Widget input for the
repository root.

Rules:

- The input is transient widget-local UI state.
- The first slice does not require SQLite schema changes.
- The UI clearly shows when no repository root is configured.
- Browser/Vite fallback shows an unsupported state for real Git reads.
- The Git Widget must not present fake live repository data.

### Future Workspace Model

A future Workspace-level project path or repository root may be introduced later.

Future rules:

- A Workspace may have one or more approved repository roots.
- The Git Widget may default to a Workspace-approved repository root when one is available.
- Applying or changing a repository root must be operator-visible and auditable.
- Future persistence must not silently change historical Git review context.
- Captured Git review artifacts should preserve which repository root they used.

### Repository Root Validation

When implemented, repository root validation must be conservative.

Rules:

- The path must be explicit.
- The path must be local unless future remote repository support is explicitly designed.
- Symlinks, worktrees, and network paths must be handled conservatively.
- Windows path handling must be explicit and tested.
- The adapter must verify that the approved path is a Git repository before reading status.
- Errors must be typed and visible to the operator.

Required error categories include:

- not configured
- unsupported in browser
- path not found
- not a Git repository
- permission denied
- Git unavailable
- timed out
- output too large
- parse error

### Forbidden Repository Root Behavior

The Git Widget and Git adapter must not implement:

- hidden parent traversal
- automatic discovery by walking up directories
- Workspace-wide repository scanning
- background repository watching
- network fetch during read-only status collection
- mutating Git commands in the read-only phase
- automatic commit, push, stage, revert, reset, clean, or stash
- automatic prompt injection of repository contents, file contents, secrets, or sensitive paths

### Relation To Read-Only Adapter

The current read-only Git status adapter receives an explicit repository root from the widget. It does not choose one. The Agent Executor diff summary adapter follows the same explicit-root rule and returns bounded status, numstat, and optional capped patch previews without mutating Git.

Adapter rules:

- Use fixed read-only commands only.
- When Git CLI is used, call it through `std::process::Command` with explicit arguments only.
- Do not invoke a shell.
- Use timeouts and output caps.
- Do not fetch or contact remotes.
- Return structured status data and typed errors, not raw command output as the primary contract.

### Relation To UI

The Git Widget should make repository root state obvious.

UI rules:

- Show the configured repository root when one exists.
- Show a clear not-configured state when repository root is absent.
- Show an unsupported state when running without desktop capabilities needed for real Git reads.
- Provide a visible manual refresh path when read-only Git status is implemented.
- Do not present placeholder, stale, or fixture data as live repository state.

### Relation To Workspace

In the first implementation slice, repository root may remain Git-widget-local and transient.

Future Workspace history may link Git status snapshots, executor responses, validation results, and commits to a known repository root. If a repository root changes later, historical Git review artifacts must preserve the root they used.

Git roots and Git review state are Workspace/widget-scoped unless future Workspace-approved roots are implemented. Git review state for one Workspace must not appear in another Workspace by default. Future shared repository roots across Workspaces must be explicit and operator-approved. For the multi-Workspace and multi-Workbench boundary, see `docs/WORKSPACE_CONTRACT.md`.

## Baseline Git Operations

### Read-Only Operations

Read-only operations may be offered as status and review actions:

- `git status`
- `git diff`
- `git diff --staged`
- `git log` / last commit
- branch ahead/behind lookup
- show commit
- list changed files

Read-only operations should still be visible as widget activity/log output when they affect operator understanding.

### Mutating Operations Requiring Explicit Approval

These operations require explicit operator approval:

- stage selected files
- unstage selected files
- commit
- amend commit later
- push
- stash
- restore selected file
- revert commit

The widget must show purpose, expected effect, affected files or commits, and risk before executing these actions.

Commit creation has a dedicated safety contract in
`docs/GIT_COMMIT_SUPPORT_CONTRACT.md`. Commit support must be explicit only,
must show the included change set and operator-approved message, and must not
include push in the current local commit slice. The current Git Widget UI can
create a local commit for an explicit selected file set only after operator
confirmation. General staging/unstaging UI, push, stash, restore, revert,
reset, clean, and other broader Git controls remain future work.

### High-Risk Operations Requiring Stronger Confirmation

These operations require stronger confirmation than normal mutating actions:

- reset
- clean
- force push
- delete branch

High-risk actions must never be automatic or hidden. They should require an explicit confirmation flow that displays the exact target and consequences.

## Safety Principles

- No hidden Git mutations.
- No automatic push.
- No automatic discard, reset, or clean.
- Destructive actions must show affected files and require confirmation.
- Generated commit messages must be reviewable before commit.
- Validation failures must not be hidden.
- Skipped validation must be visible.
- Untracked files must be visible.
- Generated files should be identifiable when possible.
- Secrets or sensitive files must not be exposed into prompts automatically.
- The widget must distinguish read-only review from mutating actions.
- Agent-suggested Git actions remain proposals until approved by the operator.

## Relation To Workspace Agent / Executor Workflow

Expected future workflow:

1. Executor agent completes a focused code block.
2. Final response is parsed or validated using the selected Response Template and `docs/AGENT_RESPONSE_CONTRACT.md`.
3. Git Widget refreshes repository state.
4. Git Widget presents a review card for the block and repository.
5. Operator decides accept, fix, push, revert, or follow-up.
6. Accepted result becomes part of Workspace history when future storage supports it.

The Git Widget should help the operator or future Workspace Agent decide
whether to accept the block, request a fix, rerun validation, create a
follow-up block, push, or revert.

Future Agent Queue behavior is defined in `docs/AGENT_QUEUE_CONTRACT.md`. Code-related Queue Items may link to Git Widget review state, but the queue must not hide dirty Git state, failed validation, skipped validation, untracked files, or push-needed state.

## Relation To Direct Mode

Direct Mode is defined in `docs/DIRECT_MODE_AGENT_CONTRACT.md`. After a Direct
Work run, the Git Widget is the review surface for repository status, changed
files, compact status/diff understanding, and explicit selected-file local
commit after operator confirmation. Validation association remains future work.

MVP rules:

- Direct Work may prompt the operator to refresh Git status after the run.
- A post-run refresh must use an explicit approved repository root.
- The Git Widget must show changed files and dirty state without treating the
  run as accepted.
- No automatic stage, commit, push, restore, revert, reset, clean, stash, or
  discard behavior may be added for Direct Work MVP.
- Generated commit messages, if supported later, must remain reviewable before
  commit.
- Failed or skipped validation must remain visible next to repository state.

Explicit commit controls after Direct Work must follow
`docs/GIT_COMMIT_SUPPORT_CONTRACT.md`; Agent Executor completion must not imply
auto-commit.

## Relation To Request And Response Templates

The Git Widget may associate repository state with:

- Request Snapshot
- Response Template
- executor final response
- validation results
- commit hash and message
- block status

Follow-up blocks may be generated from:

- failed validation
- risky diffs
- uncommitted changes
- untracked files
- branch ahead/behind state
- push reminders

Generated follow-up requests must remain reviewable and operator-controlled.

## Relation To Widgets

The Git Widget is a first-class widget/plugin and must follow `docs/WIDGET_CONTRACT.md`.

It must support:

- widget-local logs/console
- structured state and result output
- layout state
- float/dock behavior and future true external popout support
- operator-controlled actions
- approval-aware mutating operations
- Workbench state/event communication rather than private widget coupling

The Git Widget may also act as a Workbench companion surface after agent work, but it must not become a permanent required product center.

## Future UI Direction

The Git Widget should feel like a polished visual Git cockpit for post-agent review.

Top-level UI should prioritize:

- readable repository and block summaries
- clear changed-file grouping
- compact diff understanding
- visible validation state
- explicit operator actions
- clear recovery paths
- low-noise review flow

Raw command output may be available in expandable detail sections or widget-local logs, but it should not be the primary operator experience.

## Non-Goals

This contract does not implement:

- Full Git show UI, commit graph, patch staging, or diff review beyond the
  current bounded selected-file diff and recent history surfaces
- storage schema or migrations
- full `hobit-core` Git domain model
- full Git review React UI beyond the current compact status, changed-files,
  diff, and explicit local commit UI
- repository root persistence or approved Workspace-level repository roots
- background Git watcher
- automatic commit
- automatic push
- destructive Git operations
- PR provider integration
- agent runtime behavior
- current widget behavior changes
- Agent Queue behavior beyond current manual task/assignment/run-link storage
  or automatic Git review actions
- product behavior changes

## Current Implementation Boundary

The current repository keeps the old standalone Git widget code registered only
as internal/deprecated compatibility implementation. It is not offered as a
normal frontend Widget Catalog product entry. The compatibility component can
render through the existing `WidgetHost`/`WidgetFrame` path when explicitly
retained internally, has a transient explicit repository-root input, and can
manually refresh a desktop-only read-only Git status snapshot through the Tauri
`get_git_repository_status` command. The result is rendered as a compact visual
status/diff surface with branch, clean/dirty state, counts, ahead/behind data
when available, warnings, last commit data when available, and a grouped
changed-files summary. The compatibility component can also read a bounded
selected-file diff and recent history through Git-widget-owned read-only Tauri
commands.

The visible Git Widget surface has read-only repository review plus explicit
local-only commit controls. The repository root and refreshed status stay in
local React state only; they are not persisted, restored, polled, watched,
validated into Workspace state, or reused after reopening. Browser/Vite
fallback cannot read local Git status, diffs, history, or create local commits.
Agent Executor has a read-only diff summary API and compact frontend diff
summary UI for an explicit repository root;
untracked file patch previews are not included in that MVP. Git review beyond
these manual status/selected-diff/history surfaces and the explicit local
commit flow remains future optional capability work.

The backend/Tauri/frontend implementation also includes an explicit local
commit flow for Git Widget ownership. It requires explicit selected files, an
operator-provided message, and operator confirmation; stages only that selected
set; rejects unrelated staged files; returns structured command output and
safety flags; and performs no push, reset, clean, checkout, restore, rebase,
merge, fetch, watch, poll, or patch apply.

Not implemented:

- repository root/status persistence
- polling or background watching
- Full commit show UI, commit graph, and patch-level diff/stage controls beyond
  the current bounded selected-file diff and recent history surfaces
- validation association or Git-response association
- general staging UI, unstaging UI, push, revert, reset, clean, stash, or other
  Git controls beyond the explicit selected-file local commit flow
- storage schema changes or broader runtime behavior
