# Dev Smoke Entrypoints

These HTML files are Vite development smoke entry points only. They are not
production routes, product surfaces, user-facing widgets, or catalog entries.
They are also not e2e automation and are not a replacement for current product
smoke checklists.

Current dev smoke files:

- `apps/desktop/frontend/smoke/dev/coordinator-provider-product-smoke.html`
- `apps/desktop/frontend/smoke/dev/jdbc-read-only-ui-smoke.html`
- `apps/desktop/frontend/smoke/dev/queue-executor-ui-smoke.html`
- `apps/desktop/frontend/smoke/dev/workspace-agent-v2-direct-run-smoke.html`

Use these Vite dev URLs:

- `/smoke/dev/coordinator-provider-product-smoke.html`
- `/smoke/dev/jdbc-read-only-ui-smoke.html`
- `/smoke/dev/queue-executor-ui-smoke.html`
- `/smoke/dev/workspace-agent-v2-direct-run-smoke.html`

Current product smoke checklists, smoke checklist discipline, and optional e2e
automation are separate work. See:

- `docs/testing/SMOKE_CHECKLIST_DISCIPLINE.md`
- `docs/testing/WORKBENCH_CURRENT_SURFACE_SMOKE_CHECKLIST.md`
