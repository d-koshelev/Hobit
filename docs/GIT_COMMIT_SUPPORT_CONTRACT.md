# Git Commit Support Contract

## Purpose

This contract defines how Hobit supports explicit local Git commit creation
while preserving operator control.

It is the product and safety contract for explicit commit support. The current
backend/Tauri/frontend implementation provides a narrow explicit local commit
path for Git Widget ownership only, including selected-file UI and operator
confirmation. It does not implement push, reset, clean, stash, fetch, polling,
watching, queue execution, PTY, or interactive sessions.

## Current Implementation Boundary

Hobit has a backend/Tauri/frontend implementation for explicit local Git commit
creation. It is owned by Git Widget, validates workspace/workbench/widget
ownership, requires an explicit repo root, requires an operator-provided commit
message, requires an explicit non-empty included file list, and requires
operator confirmation before creating the commit.

The current foundation:

- stages only the selected included files with fixed `git add --` arguments
- rejects pre-existing staged files outside the selected commit set
- re-reads staged files after add and rejects if anything outside the selected
  set would be committed
- runs `git commit -m` with the supplied message
- reads the commit hash with `git rev-parse HEAD` after success
- returns structured stdout, stderr, exit code, duration, command summary,
  commit hash, branch, included files, message, status, and safety flags

It does not persist a Git action artifact yet. Git Widget commit UI is
local-only and selected-file based; it does not push, reset, clean, stash,
fetch, poll, watch, or auto-commit.

## One-Sentence Rule

Commit support is explicit only.

Hobit may create a commit only after the operator reviews changes and confirms
the commit action.

## What Commit Support Is

Commit support means:

- an explicit operator action
- a local Git commit
- a visible commit message
- an operator-approved commit message
- a visible included change set
- a recorded commit result
- no push in the current local commit slice

Commit support is a review and control capability. It is not acceptance by
default, background cleanup, or proof that the work is correct.

## What Commit Support Is Not

Commit support is not:

- auto-commit after an Agent Executor run
- auto-push
- force push
- auto-stage everything without visibility
- reset
- clean
- undo
- queue execution
- hidden Git mutation
- file cleanup
- arbitrary approval/apply workflow

Commit support must not become a shortcut around review, validation visibility,
or operator confirmation.

## Preconditions Before Commit

Current and future commit UI or API should require or strongly surface:

- repo root
- current branch
- changed files summary
- diff summary or reviewed change set
- validation status
- commit message preview
- operator confirmation
- no active Direct Work run for the same repo or executor if practical

Recommended validation policy:

- If validation passed, allow normal commit confirmation.
- If validation failed, show a warning or require explicit override.
- If validation timed out, show a warning or require explicit override.
- If validation was not run, show a warning or require explicit override.
- Do not silently hide validation risk.

Validation status is decision context. It does not automatically commit and
does not automatically block every possible operator action unless a later
implementation explicitly chooses that policy.

## Change Set Policy

Commit support must make the included change set visible before commit.

The current Git Widget commit UI uses selected files. Acceptable future
enhancements include:

- staged-only mode
- patch-level selection
- commit all currently changed tracked and untracked files only after
  displaying them clearly and requiring confirmation

Future blocks must document any change to the current selected-file policy
before coding.

Rules:

- Never surprise-stage hidden files.
- Untracked files must be visible before they can be included.
- Generated or large files should be called out when identifiable.
- Staging, when needed for commit creation, must be limited to the confirmed
  included change set.
- A separate general-purpose staging UI is not required for the current local
  commit slice unless a future block explicitly chooses it.

## Commit Message Policy

The commit message should be:

- visible before commit
- editable by the operator
- not generated silently
- possibly suggested by Agent Executor later
- operator-approved before use

Agent-suggested commit messages remain suggestions until the operator accepts
or edits them.

## Push Policy

For first commit support:

- no push
- no force push
- no remote mutation

Push support must have its own later contract and implementation. Commit
support must not imply that local commits are published.

## Git Command Safety

Commit implementation must:

- use program plus args only
- avoid shell command string concatenation
- run fixed Git commands
- capture stdout, stderr, and exit code
- surface errors clearly
- not log secrets
- not run outside the explicit repo root
- validate repo root

Allowed Git commands for the current local commit slice may include:

- `git status`
- `git add` with an explicit file list or clearly defined selected set
- `git commit -m` with an operator-approved message

Forbidden in the current local commit slice:

- `git push`
- `git reset`
- `git clean`
- `git checkout`
- `git restore`
- `git apply`
- `git rebase`
- `git merge`
- force options

The current implementation must use fixed command construction and bounded
outputs. It must not expose arbitrary Git command execution.

## Relationship To Agent Executor

Agent Executor may produce changes.

Agent Executor may suggest a commit message in the future.

Agent Executor must not auto-commit.

Commit remains an operator action after review. A completed Direct Work run can
lead the operator to Git review, validation review, and commit confirmation,
but it must not silently create a commit.

## Relationship To Git Widget

Git Widget remains the review surface:

- changed files
- diff summary
- validation status if available
- selected-file local commit controls

Git Widget owns the current commit UI. Future commit controls can also be
linked from Agent Executor after review.

Commit controls must preserve the Git Widget role as a visual,
approval-aware review/control surface. They must not reduce Git review to raw
command output.

## Relationship To Validation Capture

Commit UI should surface validation result:

- passed
- failed
- timed out
- not run

Validation does not automatically commit.

Commit does not automatically run validation in the current local commit slice
unless explicitly implemented later.

Validation failure, timeout, or absence must remain visible at the point of
commit confirmation.

## Observability

Future commit action should record:

- repo root
- branch
- files included
- commit message
- commit hash if successful
- stdout
- stderr
- status
- timestamp
- related Agent Executor run id if applicable

This can be a widget result, workspace event, or future Git action artifact
depending on implementation.

The recorded result must distinguish:

- commit action started
- commit succeeded
- commit failed
- commit was blocked by validation or confirmation policy
- commit was cancelled by the operator before execution

## Required Follow-Up Implementation Blocks

Recommended follow-up blocks:

- Git commit UI smoke and hardening
- Optional commit message suggestion
- Push contract later
- Push backend/API later
- Push UI later

Each block should stay focused and preserve the explicit approval boundary.

## Non-Goals For The Next Implementation Block

The next implementation block should not add:

- push
- force push
- reset
- clean
- auto-commit
- background commit
- queue execution
- arbitrary shell commands

Future commit-hardening blocks should preserve the smallest safe explicit local
commit path and stop before remote or destructive Git behavior.
