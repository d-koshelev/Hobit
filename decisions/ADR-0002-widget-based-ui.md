# ADR-0002: Widget-Based UI

## Status

Accepted

## Context

Hobit needs a modular workbench surface that can support different tasks without becoming a cluttered collection of fixed panels. UI blocks must have clear responsibilities and avoid duplicated information.

## Decision

Every visible UI block is a widget.

Widgets are created from definitions, instances, templates, and rules. Presets compose widget instances and layout into reusable workbench setups.

## Consequences

- Workbench UI is modular.
- Presets compose widgets instead of selecting hardcoded product modes.
- Widgets must not duplicate responsibilities.
- Widgets can be added, removed, configured, and instantiated from reusable templates.
- Widgets communicate through workbench state and events rather than direct coupling.
