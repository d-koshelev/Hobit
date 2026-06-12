# Prompt-Pack Authoring Efficiency Rules

## Purpose

This docs-only rule defines the faster prompt-pack authoring standard for
Hobit self-development work.

It does not add frontend behavior, backend/runtime behavior, storage/schema
changes, Queue scheduling, Agent Executor execution, validation automation,
Git mutation, Terminal launch, provider tools, automatic finalization,
automatic commit, push, rollback, or dependency execution.

## Prompt Budget

- Bugfix or smoke-blocker packs should prefer one prompt.
- Use at most two prompts when the fix and validation wiring must be split.
- Do not run a full audit unless the affected area is unknown.
- Do not add or update status docs unless the strategic behavior, readiness
  boundary, or operator workflow changed.

## Validation Budget

- Each prompt should include targeted tests plus typecheck for the affected
  surface.
- Run full frontend build, `cargo check`, or broader Rust validation only at
  the end of the pack or when backend, storage, schema, dependency, or Tauri
  behavior was touched.
- Use strong/high reasoning only for runtime, storage, schema, dependency,
  dirty-worktree repair, or other broad-risk changes.
- Keep docs-only prompts on documentation-safe checks unless the prompt
  explicitly needs product tests.

## Product-Action Boundary

- Product-action failures must fail fast with a visible typed-action error.
- Do not route product actions through Codex natural-language exploration.
- Prompt-pack import must not auto-run Queue tasks.
- Queue task run and validation must require explicit typed product actions.
- Unsupported capabilities must be explicit and visible; do not fake success.

## Pack Shape

Each prompt should state:

- the current blocker;
- the smallest expected changed layer;
- the exact typed product action or test path being hardened;
- the targeted validation commands;
- the forbidden behavior that must remain forbidden.
