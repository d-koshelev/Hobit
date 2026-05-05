# ADR-0003: Minimal Hobit Is Terminal + Agent CLI

## Status

Superseded by `ADR-0005-empty-workbench-shell-first.md`.

## Context

Hobit should prove the AI Workbench foundation before building optional capability widgets such as Knowledge, Stages, Runbooks, Git, JDBC, SQL Results, or Image Edit.

Earlier planning treated Terminal Widget + Agent CLI Widget as the smallest useful product slice.

## Decision

The earlier decision was that a minimal starter product would include:

- Terminal Widget
- Agent CLI Widget

## Superseding Decision

The implementation now starts with an empty Workbench shell first. Terminal and Agent CLI remain valid future starter widgets, but they are no longer present by default while the workbench shell, theme, layout, and widget contract are being finalized.
