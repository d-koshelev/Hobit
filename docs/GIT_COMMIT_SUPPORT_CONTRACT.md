# Git Commit Support Contract

## Purpose

This contract defines how Hobit may support Git commit creation in the future
while preserving operator control.

It is a product and safety contract only. It does not implement commit UI,
backend commands, Tauri commands, storage, schema, Git mutations, staging,
push, reset, clean, queue execution, PTY, or interactive sessions.

## One-Sentence Rule

Commit support is explicit only.

Hobit may create a commit only after the operator reviews changes and confirms
the commit action.

## What Commit Support Is

Future commit support means:

- an explicit operator action
- a local Git commit
- a visible commit message
- an operator-approved commit message
- a visible included change set
- a recorded commit result
- no push in the first commit slice

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

Future commit UI or API should require or strongly surface:

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

Future commit support must make the included change set visible before commit.

Acceptable future approaches:

- MVP option: commit all currently changed tracked and untracked files only
  after displaying them clearly and requiring confirmation.
- Safer later option: selected files.
- Safer later option: staged-only mode.
- Safer later option: patch-level selection.

For the first implementation, choose the smallest safe behavior and document it
before coding.

Rules:

- Never surprise-stage hidden files.
- Untracked files must be visible before they can be included.
- Generated or large files should be called out when identifiable.
- Staging, when needed for commit creation, must be limited to the confirmed
  included change set.
- A separate general-purpose staging UI is not required for the first commit
  slice unless that slice explicitly chooses it.

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

Future commit implementation must:

- use program plus args only
- avoid shell command string concatenation
- run fixed Git commands
- capture stdout, stderr, and exit code
- surface errors clearly
- not log secrets
- not run outside the explicit repo root
- validate repo root

Allowed future Git commands for the first commit slice may include:

- `git status`
- `git add` with an explicit file list or clearly defined selected set
- `git commit -m` with an operator-approved message

Forbidden in the first commit slice:

- `git push`
- `git reset`
- `git clean`
- `git checkout`
- `git restore`
- `git apply`
- `git rebase`
- `git merge`
- force options

The first implementation must use fixed command construction and bounded
outputs. It must not expose arbitrary Git command execution.

## Relationship To Agent Executor

Agent Executor may produce changes.

Agent Executor may suggest a commit message in the future.

Agent Executor must not auto-commit.

Commit remains an operator action after review. A completed Direct Work run can
lead the operator to Git review, validation review, and commit confirmation,
but it must not silently create a commit.

## Relationship To Git Widget

Git Widget should remain the review surface:

- changed files
- diff summary
- validation status if available
- commit controls later

Git Widget is the natural place for commit UI, but commit controls can also be
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

Commit does not automatically run validation in the first slice unless
explicitly implemented later.

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

- Git commit backend/API foundation
- Git commit UI with confirmation
- Commit smoke and hardening
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

The first implementation block should create the smallest safe explicit local
commit path and stop before remote or destructive Git behavior.

