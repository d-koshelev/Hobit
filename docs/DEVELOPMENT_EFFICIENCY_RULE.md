# Development Efficiency Rule

## Purpose

This process rule makes token-efficient development mandatory for Hobit work.

The goal is to keep each block focused on the current blocker, use the smallest
necessary context, and validate only what is needed to prove the change. This is
a docs-only process rule. It does not add product behavior, runtime behavior,
frontend UI, backend APIs, storage/schema changes, validation tooling, or agent
automation.

## Core Rule

Work on the current blocker only.

Each development block must prefer:

- the smallest necessary file set
- directly relevant contracts and process docs only
- targeted inspection before broad search
- targeted tests or checks for changed files
- the smallest validation that proves the task
- short final reports

## Context Discipline

Agents must read only the files directly needed for the current task.

Do not read broad docs unless the task changes:

- architecture
- contracts
- product surface
- public API
- explicit documentation

Do not inspect unrelated widgets, modules, crates, packages, or docs. Do not run
broad searches unless targeted search fails or the target file/location is not
known.

## Validation Discipline

Validation must match the scope and risk of the change.

Prefer targeted tests and checks for the changed files or affected surface. Do
not run full validation unless the task changes:

- cross-cutting architecture
- Rust workspace-wide APIs
- build configuration
- validation tooling
- behavior with broad product or runtime risk

Documentation-only blocks should usually use documentation-safe checks such as:

- `git status --short --branch`
- `git diff --stat`
- `git diff --check`

If a prompt explicitly requests a validation set, use that set and report any
blockers honestly.

## Reporting Discipline

Final reports should be short and include only what is needed:

- status
- files changed
- root cause, when relevant
- what changed
- validation results
- git status
- blockers, when relevant

Do not include broad implementation narratives, unrelated findings, or next-step
roadmaps unless the task explicitly asks for them.

## Safety Boundary

Efficiency must not be used to hide failures, skip required approvals, weaken
contracts, ignore relevant source-of-truth docs, or avoid validation that is
needed to prove the task.
