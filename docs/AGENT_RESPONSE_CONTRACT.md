# Agent Response Contract

## Purpose

This contract defines the required final-response format for Codex and other project agents working on Hobit implementation, audit, validation, and documentation blocks.

Final responses must be easy to scan, track across numbered blocks, and paste back into the conversation.

## Header

Every final response for an implementation or audit block must start with a clear header.

If the task provides a block number, use:

```text
Block <number> — <title>
```

Examples:

- `Block 34 — Terminal placeholder widget flow`
- `Block 35 — Agent final response contract`

If no block number was provided, start with the task or commit title.

Example:

- `frontend: add terminal placeholder widget`

## Successful Implementation With Commit

A successful implementation response must include:

- Header with block number/title, or task/commit title.
- Commit hash and commit message.
- Files changed.
- What changed.
- Validation results.
- Intentionally not implemented / out of scope.
- Final git status when relevant.

## No-Code-Change Audit

If an audit finds no required changes, the final response must include:

- Header with block number/title, or task title.
- Statement that no code changes were needed.
- Statement that no commit was created.
- Validation results.
- Final git status.
- Reason why no commit was needed.

## Failed Or Blocked Work

If work failed, was blocked, or could not be committed, the final response must include:

- Header with block number/title, or task title.
- What was attempted.
- Exact failure or blocker.
- Current git status.
- Whether any files were changed.
- Recommended next action.

Do not claim success if validation, required implementation, or commit failed.

## Validation Reporting

The validation section must:

- List every requested command.
- Mark each command as passed, failed, or not run.
- Include known environmental warnings separately.
- Show failed commands instead of hiding them.
- Explain why any requested command was skipped.

## Scope Reporting

The final response must explicitly report intentional exclusions when the block constrained scope.

Examples:

- No backend changes.
- No schema changes.
- No runtime behavior changes.
- No frontend behavior changes.
- No persisted behavior changes.

Avoid vague wording such as `misc changes`.

## Style

Final responses must be concise but complete.

Use:

- Bullets.
- Short sections.
- Concrete file paths.
- Concrete command results.

Avoid:

- Long prose.
- Huge diffs.
- Unnecessary implementation details.
- Claiming manual testing that was not performed.
