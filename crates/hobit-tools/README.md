# hobit-tools

Structured tool and action adapter layer for Hobit.

The current milestone includes a narrow read-only Git status parser/CLI adapter
for `git status --porcelain=v1 -b` against an explicit repository root. It uses
fixed read-only arguments, no shell, timeouts, output caps, no fetch, and no Git
mutations.

## Belongs Here

- Tool action boundaries.
- Future adapters for terminal, database, image, and other capabilities.
- Approval-aware execution interfaces once the contracts are ready.
- Read-only Git status data shaped for visual review surfaces.

## Does Not Belong Here Yet

- Real terminal execution.
- Git mutations, diff/log/show, staging, commit, push, revert/reset, clean, or stash.
- Real JDBC or database access.
- Real image editing.
- Widget UI.
