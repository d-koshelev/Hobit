# Git Widget Contract

## Purpose

This contract defines the future Hobit Git Widget / Git Plugin as a visual review and control surface for code changes produced during AI-assisted work.

The Git Widget runtime is not implemented yet. This document is a product/domain contract. The current frontend only has an insertable static Git placeholder widget; it does not add Git command execution, repository access, storage schema, Tauri commands, Workspace API behavior, or runtime behavior.

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

The first read-only Git implementation may use an explicit Git Widget input for the repository root.

Rules:

- The input may be transient widget-local UI state at first.
- The first slice should not require SQLite schema changes.
- The UI must clearly show when no repository root is configured.
- Browser/Vite fallback must show an unsupported or not-connected state for real Git reads.
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

The future read-only Git adapter receives an already-approved repository root. It does not choose one.

Adapter rules:

- Use fixed read-only commands only.
- If Git CLI is used, call it through `std::process::Command` with explicit arguments only.
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

## Relation To Coordinator / Executor Workflow

Expected future workflow:

1. Executor agent completes a focused code block.
2. Final response is parsed or validated using the selected Response Template and `docs/AGENT_RESPONSE_CONTRACT.md`.
3. Git Widget refreshes repository state.
4. Git Widget presents a review card for the block and repository.
5. Operator decides accept, fix, push, revert, or follow-up.
6. Accepted result becomes part of Workspace history when future storage supports it.

The Git Widget should help the coordinator decide whether to accept the block, request a fix, rerun validation, create a follow-up block, push, or revert.

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

- real Git command execution
- storage schema or migrations
- Rust domain types
- TypeScript types
- React UI
- Tauri commands
- Workspace API changes
- repository root handling implementation
- repository root picker or persistence
- background Git watcher
- automatic commit
- automatic push
- destructive Git operations
- PR provider integration
- agent runtime behavior
- current widget behavior changes
- product behavior changes

## Current Implementation Boundary

The current repository has an insertable static Git placeholder widget in the frontend Widget Catalog. It renders a planned Git review surface through the existing `WidgetHost`/`WidgetFrame` path and uses the generic widget insertion flow.

Git runtime remains a future optional capability. The current placeholder must not be shown by default, treated as a real Git integration, or wired to execution unless explicitly requested by a future implementation block.

Not implemented:

- Git command execution
- repository access or repository selection
- status, diff, branch, log, ahead/behind, or validation parsing
- staging, commit, push, revert, reset, clean, or stash
- background watching
- Tauri Git commands, backend API, storage schema, or runtime behavior
