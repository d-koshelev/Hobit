# ADR-0006: Workspace Session Resumable Work

## Status

Accepted

## Context

Hobit must support resumable work. A user should be able to start work, close Hobit, return later, and continue from the same place.

The existing contracts define the AI Workbench, widgets, presets, state, and events, but they need a durable user-facing container that owns saved work over time.

## Decision

Hobit uses Workspace as the durable resumable work unit and WorkspaceSession as the runtime opening of that Workspace.

A user opens an existing Workspace or creates a new Workspace. Opening or creating a Workspace starts a WorkspaceSession.

The Workbench lives inside the Workspace. Presets are reusable templates copied into a Workspace; after instantiation, the Workspace owns the actual widget instances, layout, state, logs, results, and event history.

## Consequences

- User-facing UX should expose New Workspace and Recent/Continue Workspace.
- Workbench lives inside Workspace.
- Presets are templates copied into Workspace.
- Future storage must persist widget instances, layout, state, logs, results, and events.
- Session is internal/runtime terminology, not the primary durable product object.
