# Smoke Checklist Discipline

## Purpose

This document defines how Phase 1 smoke checklists are organized.

It is a testing/process guide only. It does not override
`docs/CURRENT_WIDGET_SURFACE.md`, add product behavior, add automation, or make
dev-only smoke HTML entry points into product surfaces.

## Authority

- `docs/CURRENT_WIDGET_SURFACE.md` remains the source of truth for current
  widget behavior.
- Task-specific widget contracts remain authoritative for widget details.
- Smoke checklists should verify documented current or preview behavior. They
  must not promote Planned, Deferred, Compatibility, or Deprecated behavior into
  current behavior.
- Dev-only smoke HTML entry points are not product routes, production widget
  surfaces, or catalog entries.

## Categories

### A. Current Product Smoke Checklists

Current product smoke checklists cover manual or semi-manual checks for shipped
Current behavior.

Rules:

- Use `docs/CURRENT_WIDGET_SURFACE.md` as the current-behavior inventory.
- Include only implemented behavior that is safe to rely on.
- Do not include Deferred features as current smoke requirements.
- Do not treat Compatibility or Deprecated paths as preferred product smoke
  targets unless a task explicitly targets compatibility.

### B. Preview Smoke Checklists

Preview smoke checklists cover shipped behavior that is visible but limited or
not production-complete.

Rules:

- Label preview checks explicitly.
- Keep limitations visible in the checklist.
- Do not treat Preview behavior as production-complete.
- Do not expand preview behavior during smoke documentation work.

Examples include Database / JDBC Current Preview and Agent Queue Preview, as
defined by `docs/CURRENT_WIDGET_SURFACE.md`.

### C. Dev-Only Smoke HTML Entry Points

Dev-only smoke HTML entry points live under:

```text
apps/desktop/frontend/smoke/dev/
```

They are useful for targeted Vite development checks. They are not product
routes, production widget surfaces, current product surfaces, catalog entries,
or e2e automation.

See `docs/testing/DEV_SMOKE_ENTRYPOINTS.md`.

### D. Validation / Bootstrap Checks

Validation/bootstrap checks verify repository readiness and known environment
failure modes.

Current Phase 1 baseline checks include:

- `git status --short --branch`
- `cargo check --workspace`
- `cargo test --workspace`
- `bash -n scripts/hobit/validate.sh`
- `bash scripts/hobit/validate.sh`
- missing frontend dependency behavior when `node_modules` or local `tsc` is
  absent
- direct `scripts/hobit/validate.sh` execution caveat when local filesystem
  mode causes `Permission denied`
- scoped `git diff --check` for the files touched by a focused task when
  pre-existing unrelated dirty files exist

See `docs/testing/CURRENT_VALIDATION_SMOKE_CHECKLIST.md`.

### E. Future Automation

Future e2e automation may be added later, but it is not current validation
unless an explicit later task adds it and documents it as current.

Rules:

- Do not treat future Playwright, Cypress, or other e2e plans as current
  validation.
- Do not use dev-only smoke HTML entry points as a substitute for current
  product smoke checklists.
- Do not add e2e setup as part of smoke checklist documentation work.

## Current Phase 1 Checklist Docs

- `docs/testing/CURRENT_VALIDATION_SMOKE_CHECKLIST.md`
- `docs/testing/NOTES_SMOKE_CHECKLIST.md`
- `docs/testing/WORKBENCH_CURRENT_SURFACE_SMOKE_CHECKLIST.md`
- `docs/testing/DEV_SMOKE_ENTRYPOINTS.md`
