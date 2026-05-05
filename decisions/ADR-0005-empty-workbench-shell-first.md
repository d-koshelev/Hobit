# ADR-0005: Empty Workbench Shell First

## Status

Accepted

## Context

The product direction shifted from proving Hobit through two mock widgets to first making the AI Workbench shell itself correct. Mock widgets created visual noise and made it harder to judge the shell, layout, theme, and composition model.

## Decision

The default frontend milestone is an empty Workbench surface with no concrete visible widgets.

The Workbench still keeps the preset and widget-host architecture, but the default preset contains zero widget instances and the registry contains no concrete widget definitions until real widgets are introduced intentionally.

## Consequences

- The shell, theme, spacing, and empty canvas can be perfected before widget UI is added.
- Mock Terminal and Agent CLI widgets are removed from the codebase for now.
- Terminal and Agent CLI may return later as real widgets or as a starter preset.
- Widget contracts remain first-class and are defined before concrete widget implementation.
