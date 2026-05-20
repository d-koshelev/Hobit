# Phase 1 Stabilization Closeout

## Status

Phase 1 stabilization is completed and ready to transition to Phase 2, with
the remaining items below explicitly classified as deferred or backlog work.

This closeout is a process/reporting document only. It does not override
`docs/CURRENT_WIDGET_SURFACE.md`, task-specific product contracts, or the
source-of-truth order in `docs/ACTIVE_CONTRACT_INDEX.md`.

## Completed Stabilization Items

- Authority model established.
- AMP findings added to the stabilization backlog.
- Tauri icon / `cargo check --workspace` blocker fixed.
- `validate.sh` missing frontend dependency message fixed so the failure is
  actionable.
- Repository portability verified as a local-only artifact in this checkout.
- Current validation baseline recorded.
- Terminal PTY Linux `cargo test --workspace` blocker fixed.
- `docs/CURRENT_WIDGET_SURFACE.md` normalized.
- Notes contracts normalized.
- Architecture stale references cleaned.
- Contract drift decision matrix created.
- Agent Chat / Agent Monitoring compatibility aligned.
- JDBC Preview contract aligned.
- Terminal PTY platform limitation confirmed.
- Smoke HTML entry points moved out of the Vite root.
- Smoke checklist discipline added.
- Feature-slice checklist added for future Codex-driven changes.

## Current Validation Baseline

Expected Phase 1 validation state:

- `cargo check --workspace` should pass.
- `cargo test --workspace` should pass.
- `bash -n scripts/hobit/validate.sh` should pass.
- `bash scripts/hobit/validate.sh` may fail with an expected actionable
  missing frontend dependency message when `apps/desktop/frontend/node_modules`
  or local `node_modules/.bin/tsc` is absent.
- Direct `scripts/hobit/validate.sh` execution may fail with local
  `Permission denied` when filesystem executable mode is not materialized even
  though Git records mode `100755`.
- Broad `git diff --check` may still fail because pre-existing unrelated dirty
  files exist in this checkout.
- Scoped diff checks are required for Codex tasks while unrelated dirty files
  remain.

Do not claim full `validate.sh` passes unless the command actually completes
successfully in the local environment.

## Remaining Deferred / Backlog Items

- Frontend dependencies are not installed in this checkout.
- Pre-existing unrelated dirty files can still create broad diff-check noise.
- Optional clean clone or source archive portability proof later.
- Optional e2e automation later.
- Optional Terminal catalog gating or Linux/macOS PTY implementation later.
- Optional retire/delete Agent Chat / Agent Monitoring code paths later.
- Optional JDBC promote/hide/remove/production runtime decision later.
- Widget bloat and Placeholder naming mismatch after Notes stabilization.
- WorkspaceApi / WidgetRenderProps / action bag cleanup after Notes
  stabilization.
- DTO shape tests or generation later.
- Coordinator / Queue / Executor cleanup deferred until after Notes
  stabilization.

## Recommended Next Phase

Phase 2 should be Notes stabilization and refactor.

Recommended order:

1. Notes UI/controller refactor without behavior change.
2. Notes component split.
3. Notes dev-only memory API decision/implementation.
4. Notes DTO/contract smoke checks if useful.
5. Small Notes feature slice, likely delete/archive or autosave decision.
6. WorkspaceApi / WidgetRenderProps / action bag cleanup.
7. Coordinator / Queue / Executor naming/responsibility cleanup.

## Definition Of Done

Phase 1 is complete when the following evidence is present:

- The active contract index defines the authority model and source-of-truth
  order.
- Current, Preview, Deferred, Compatibility, and Deprecated statuses are
  defined and applied to the current surface.
- Current widget behavior is normalized in `docs/CURRENT_WIDGET_SURFACE.md`.
- Notes, JDBC, Terminal, and Agent Chat / Agent Monitoring drift is documented
  with current boundaries and deferred follow-ups.
- Validation blockers from missing Tauri icons and unsupported non-Windows
  Terminal PTY tests are fixed.
- Missing frontend dependency validation failure is actionable.
- Repository portability in this checkout is classified as a local metadata
  artifact.
- Smoke checklist discipline separates current product smoke, Preview smoke,
  dev-only smoke entry points, validation/bootstrap checks, and future
  automation.
- Future feature slices have a standard process checklist.
- Remaining broad cleanup is explicitly deferred to Phase 2 or later.
