# Architecture

This document describes the intended future architecture for Hobit. It is a plan, not an implemented code structure.

No Tauri, Rust, React, Vite, database schema, agents, widgets, or app code exists yet.

## Intended Repository Layout

Future implementation may use a monorepo structure similar to:

```text
apps/
  desktop/

crates/
  hobit-core/
  hobit-storage-sqlite/
  hobit-agent/
  hobit-tools/
  hobit-app/

frontend/
  design-system/
  workbench/
  widgets/
```

## Intended Responsibilities

`apps/desktop` is intended to host the desktop shell when the app implementation begins.

`crates/hobit-core` is intended to hold core domain contracts and shared models.

`crates/hobit-storage-sqlite` is intended to hold local persistence when storage is introduced.

`crates/hobit-agent` is intended to hold agent runtime integration.

`crates/hobit-tools` is intended to hold structured tool capabilities and action execution boundaries.

`crates/hobit-app` is intended to hold application orchestration.

`frontend/design-system` is intended to hold reusable UI primitives and interaction rules.

`frontend/workbench` is intended to hold the workbench shell and state coordination.

`frontend/widgets` is intended to hold widget implementations and templates.

## Current Boundary

The current repository state is documentation and hygiene only. Implementation directories should be created in later phases when their contracts are ready to be exercised by real code.
