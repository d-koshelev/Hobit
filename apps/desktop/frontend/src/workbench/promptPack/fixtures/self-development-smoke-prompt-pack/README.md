# Hobit Self-Development Smoke Prompt Pack

Small deterministic prompt-pack fixture for automated and manual
self-development readiness smoke tests.

The pack is intentionally local, docs-only, and safe. It is for parser,
Queue import, validation metadata, dependency-gating, Diff Review, and
coordinator-finalization smoke coverage. It must not run automatically, commit,
push, roll back, launch Terminal, start Agent Executor, arm Queue Autorun, or
use hidden execution.

Files:

- `prompt-batch.json` - manifest and metadata for both fixture tasks.
- `001-safe-docs-noop.md` - validation-safe docs-only/no-op task.
- `002-dependent-follow-up.md` - dependent follow-up task blocked on task 001.

Manual smoke expectation:

- Import the pack explicitly through the visible prompt-pack import flow.
- Create Queue items only after confirmation.
- Keep both items manual/draft after import.
- Run validation only through explicit operator action.
- Finalize task 001 explicitly before task 002 becomes ready.
