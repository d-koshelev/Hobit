# ADR-0007: Notes Widget Global And Workspace Scopes

## Status

Accepted

## Context

Hobit needs a simple notes tool for operator-authored Markdown text.

Notes must support personal/common reference outside a Workspace as well as task-local notes that resume with one Workspace. Notes must also remain distinct from Knowledge Catalog, Evidence, Runbooks, Shared State, and Workspace event history.

## Decision

Hobit will model Notes as a first-class widget capability with global and workspace-local scopes.

The same Notes Widget definition can be instantiated with scope configuration for global notes or Workspace notes.

Global notes persist independently of any Workspace. Workspace notes are persisted and restored with their Workspace.

## Consequences

- Notes remain separate from Knowledge Catalog.
- Workspace notes are persisted/restored with Workspace.
- Global notes persist independently.
- Promoting note content to Knowledge/Evidence must be explicit.
- Notes remain an optional widget/capability, not the product center.
