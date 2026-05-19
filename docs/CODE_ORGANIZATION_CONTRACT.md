# Code Organization Contract

## Purpose

This contract defines Hobit engineering rules for keeping the repository easy to
navigate as storage, app service, frontend, and future runtime modules grow.

This is a project engineering contract. It does not define product runtime
behavior, UI behavior, storage schema, Tauri commands, Terminal execution, Agent
runtime, or tool execution behavior.

## Core Rules

- Avoid giant mixed-responsibility files.
- Keep root/facade files thin.
- Split implementation by responsibility, not by incidental helper type.
- Keep helpers close to the module that uses them.
- Do not add new feature code to files that are already large when a focused
  module is a clearer home.
- Do not introduce broad repository traits or abstraction layers only to move
  code.
- Preserve public import paths and behavior when doing structure-only splits.
- Runtime-related future work must go into focused modules with explicit
  ownership boundaries.
- Prefer reusable Hobit Toolbelt scripts over one-off inspection scripts.

## Facade Files

Facade files should declare types, constants, module declarations, constructors,
and small shared helpers. They should not accumulate unrelated feature logic.

Default guidance:

- Root/facade files should stay under 300 lines when practical.
- Root/facade files over 300 lines need a reason.
- Root/facade files over 500 lines should usually be split before adding more
  behavior.

Special files with stricter expectations:

- `crates/hobit-storage-sqlite/src/store.rs` should remain a thin SQLite store
  facade and should stay at or below 300 lines.
- `crates/hobit-app/src/workspace_service.rs` should remain a thin
  WorkspaceService facade and should stay at or below 400 lines.

## Module Boundaries

Split modules by durable responsibility. Examples:

- Workspace lifecycle belongs near workspace service/storage modules.
- Workbench state loading belongs near workbench modules.
- Widget instance mutations belong near widget instance modules.
- Widget logs, runs, and results should remain separate from future process or
  agent runtime implementations.
- Git read-only status integration should remain separate from app service
  workspace and widget mutation code.
- Tests may live in focused test modules, but coverage should not be removed
  during structure-only refactors.

Future Terminal, Agent, Script Runner, Queue, or runtime work must not be added
to generic catch-all files. Add focused modules and preserve the product
contracts that forbid hidden execution and hidden automation.

## Toolbelt Use

Use `scripts/hobit/` for common repository inspection before writing temporary
helpers.

Recommended checks:

```sh
python scripts/hobit/check-file-sizes.py
python scripts/hobit/module-map.py --path crates/hobit-app/src --max-depth 3
python scripts/hobit/changed-files-summary.py
```

If a repeated inspection task is not covered, propose a small deterministic
Toolbelt script instead of creating an ad-hoc script for one block.

The current structure and contract cleanup audit is captured in
`docs/CODEBASE_AND_CONTRACT_REFACTOR_AUDIT.md`. Use it as a planning reference
for contract-index cleanup and structure-only refactor blocks.

Use `docs/ACTIVE_CONTRACT_INDEX.md` as the starting point for deciding which
contracts to read before a future block.
