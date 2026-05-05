# ADR-0004: Design System Contract

## Status

Accepted

## Context

Hobit will grow through widgets, presets, and capability surfaces. Without a shared visual contract, each widget could introduce its own colors, density, status patterns, and surface hierarchy.

That would weaken the workbench-first product direction and make the UI feel inconsistent as the widget catalog grows.

## Decision

Hobit will treat visual design rules as an architectural contract.

The design system contract defines baseline visual semantics, widget anatomy, surface hierarchy, and render-quality expectations for future UI work.

## Consequences

- Future widgets must follow shared design primitives and visual semantics.
- One-off styling is discouraged.
- Visual changes should flow through design-system primitives and tokens.
- Render-quality direction is preserved as the widget catalog grows.
