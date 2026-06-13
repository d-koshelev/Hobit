# Code Organization

## Purpose

This document is the current-facing navigation note for code organization work.
It keeps Phase 1 cleanup tasks from needing to read broad historical contracts
by default.

Detailed refactor rules remain in `docs/CODE_ORGANIZATION_CONTRACT.md`; read
that contract only when a task changes code structure, module boundaries, file
ownership, or file-size/refactor policy.

## Current Boundaries

- Rust domain contracts belong in `hobit-core`.
- Storage, app orchestration, tools, agent support, and the Tauri shell remain
  separate crates or layers.
- Frontend structure, placement, and import boundaries for new UI code must
  follow `docs/FRONTEND_STRUCTURE_CONTRACT.md`.
- Frontend widget rendering remains registry-driven through `WidgetHost`.
- Workbench state, widget state, and workspace APIs should stay explicit and
  visible.
- Compatibility names and persistence IDs must not be renamed casually.

## Phase 1 Rule

For Phase 1 stabilization, code organization work is inventory and contract
cleanup only unless a task explicitly allows code changes.

Do not use this document as permission to refactor components, rename widget
ids, change DTOs, alter storage, or add runtime behavior.
