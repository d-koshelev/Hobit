# Frontend Structure Contract

## Purpose

This contract defines the canonical frontend ownership and placement model for Hobit UI code before new UI primitives, overlays, or widget cleanup work is started.

It is docs-only and does not add UI behavior, runtime behavior, styling beyond existing conventions, or backend/desktop changes.

## Canonical Frontend Ownership

## Shared design-system code

- Shared UI primitives live under `apps/desktop/frontend/src/design-system/<category>`.
- Widget chrome primitives live under `apps/desktop/frontend/src/design-system/widget`.
- Overlays, popovers, and InfoTip primitives live under `apps/desktop/frontend/src/design-system/overlays`.
- Form primitives live under `apps/desktop/frontend/src/design-system/forms`.
- Layout, sections, tabs, and key-value primitives live under `apps/desktop/frontend/src/design-system/layout`.
- Feedback/status/notice primitives live under `apps/desktop/frontend/src/design-system/feedback`.
- Shared action/menu primitives live under `apps/desktop/frontend/src/design-system/actions`.
- Shared UI CSS lives under `apps/desktop/frontend/src/styles/ui`.
- Shared implementation files should be exported from the design-system barrel entrypoints.

## Widget-local ownership

- Widget-specific product components live under
  `apps/desktop/frontend/src/workbench/widgetV2/<widget>/components`.
- Widget-specific popups live under
  `apps/desktop/frontend/src/workbench/widgetV2/<widget>/popups`.
- Widget-specific debug content lives under
  `apps/desktop/frontend/src/workbench/widgetV2/<widget>/debug`.
- Pure shared domain model belongs under `apps/desktop/frontend/src/workbench/<domain>`.
- Widget-domain CSS lives under `apps/desktop/frontend/src/styles/widgets`.
- `apps/desktop/frontend/src/styles/components.css` is legacy/frozen for new shared UI styles.

## Import boundary rules

- New shared UI imports must use the design-system barrel export.
- Design-system root files are compatibility entry points only.
- No new implementation files should be added directly under design-system roots.
- Do not use cross-widget deep imports from another widget’s internals.
- Do not expose helper exports from component/popup files for cross-surface use.
- Shared helper logic used by multiple surfaces must move to model/domain modules.
- Widget files should compose behavior and UI, and should not accumulate large render/helper/debug logic.

## UI placement and surface rules

- The main widget surface is product-only.
- Default UI must not expose implementation, debug, or developer-only details.
- Use `Title + InfoTip` for explanatory context; avoid `Title + subtitle` explanatory patterns.
- Status badges should represent the real current state only.
- Duplicate or static badges are not allowed.
- Debug/runtime/internal details must be moved to `WidgetDebugPopup` or an equivalent debug surface.

## Required reading set (frontend/frontend widget/design-system work)

Before frontend UI, popup, widget cleanup, shared primitive, and debug-surface work, agents must read:

- `docs/ACTIVE_CONTRACT_INDEX.md`
- `docs/CURRENT_WIDGET_SURFACE.md`
- `docs/CODE_ORGANIZATION.md`
- `docs/UI_DESIGN_SYSTEM_CONTRACT.md`
- `docs/PRODUCT_UI_DESIGN_CONTRACT.md`
- `docs/UI_SHARED_PRIMITIVES_INDEX.md`
- `docs/AGENT_UI_IMPLEMENTATION_RULES.md`
- `docs/FRONTEND_STRUCTURE_CONTRACT.md`

