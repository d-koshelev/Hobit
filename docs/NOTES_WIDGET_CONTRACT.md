# Hobit Notes Widget Contract

## Purpose

Notes is a first-class widget/capability for Markdown-based operator notes inside Hobit.

Notes gives the operator a simple place to write, organize, and resume freeform text without turning that text into structured Knowledge, Evidence, Runbooks, or agent memory by default.

## Product Role

- Notes provide freeform writing inside Hobit.
- Notes can be global or workspace-local.
- Notes support lightweight memory, observations, snippets, manual notes, checklists, and scratch documentation.
- Notes are optional widgets/capabilities, not the product center.

## Non-Goals

- Notes are not Knowledge Catalog.
- Notes are not Runbooks.
- Notes are not Evidence by default.
- Notes are not structured validated operational knowledge.
- Notes are not an agent memory system by default.
- Notes are not a replacement for Workspace event history.

## Scopes

### Global Notes

Global Notes are independent of any Workspace.

They are available across Workspaces and are useful for personal or common reference.

Examples:

- command cheat sheets
- personal DBA notes
- VICO endpoints
- design notes

### Workspace Notes

Workspace Notes are bound to one Workspace.

They are persisted as part of resumable Workspace state and are restored when the Workspace is reopened.

Workspace Notes are useful for task-local observations, hypotheses, manual notes, pasted snippets, and decisions-in-progress.

The same Notes Widget definition can be instantiated with different scope configuration:

- Notes Widget instance with `scope=global`
- Notes Widget instance with `scope=workspace`

## Data Model

Conceptual note model:

- `NoteFolder`: an organizational folder in a note tree.
- `NoteDocument`: a Markdown text document.
- `NotePath`: the resolved folder/document path within a note scope.
- `NoteScope`: global or workspace.
- `NoteContentMarkdown`: the Markdown storage/editing content.
- `NoteMetadata`: timestamps, authorship, tags, and optional links.

Conceptual fields:

- `id`
- `scope`
- `workspace_id` optional for workspace notes
- `folder_id` optional
- `title`
- `path`
- `markdown_content`
- `created_at`
- `updated_at`
- `created_by`
- `updated_by`
- `tags` optional
- `linked_workspace_objects` optional

## Folder System

Notes support hierarchical folders.

Expected folder behavior:

- rename/move/delete folders
- move notes between folders within the same scope
- keep global and workspace folder trees separate
- do not silently move workspace notes into global notes or global notes into workspace notes

Cross-scope moves, copies, or links must be explicit operator actions.

## Markdown Editing

Markdown is the storage and editing format.

The editor may support preview later. A plain text editing fallback is acceptable.

Embedded files/images are not required initially.

Backlinks and wiki-style links are future optional capabilities.

## Widget Behavior

Notes Widget must follow the base widget contract:

- WidgetDefinition / WidgetInstance separation
- input/action/result lifecycle where relevant
- widget-local console/logs
- resize/reposition
- pop-out/detach
- ghost placeholder
- optional always-on-top in popout mode
- communicates through Workbench state/events, not direct coupling

## Actions

Future note actions may include:

- create folder
- rename folder
- delete folder
- create note
- rename note
- edit note
- move note
- delete note
- switch note
- save note
- search notes
- link note to Workspace object
- promote note fragment to Knowledge candidate
- attach note excerpt as Evidence candidate

Promoting note content to Knowledge or Evidence must be an explicit operator action.

There is no automatic promotion.

## Agent Interaction

Agent interaction with notes is capability and context bound:

- Agent may read notes only when notes are in available context/capability.
- Global notes are not automatically sent to agent.
- Workspace notes are not automatically sent to agent unless included in context or exposed through widget/capability rules.
- Agent may propose note edits or summaries, but operator controls saving.
- Agent may propose "promote this note to Knowledge candidate" but must not do it silently.

## Persistence And Resume

Global notes persist independently.

Workspace notes persist with Workspace.

Workspace notes must be restored when Workspace is reopened.

Current open note, selected folder, editor dirty state, and cursor/selection may be persisted as widget state if useful.

## Relationship To Other Concepts

### Notes vs Knowledge

Notes are freeform/operator-authored Markdown text. Knowledge is structured, reviewed, or validated context. Notes may be promoted to Knowledge candidates only through explicit operator action.

### Notes vs Evidence

Notes are not Evidence by default. A note excerpt may become an Evidence candidate only through explicit operator action.

### Notes vs Runbook

Notes may contain instructions or checklists, but they do not define executable or governed runbook behavior.

### Notes vs To-do List

Notes may contain Markdown checklists, but a dedicated To-do List widget would own structured task state, filters, assignment, and completion workflows.

### Notes vs Shared State

Notes are documents. Shared State is named structured state available to the Workbench and relevant widgets.

### Notes vs Event Log

Notes are operator-authored text. Event Log is the structured history of Workspace and Workbench events. Notes do not replace event history.

## Initial Implementation Direction

Initial implementation should be simple:

- Markdown documents
- folders
- global/workspace scope
- no sync
- no collaborative editing
- no rich embedded media
- no automatic Knowledge ingestion
- no complex graph/backlinks

## Future Extensions

- search
- tags
- markdown preview
- backlinks
- templates
- note-to-knowledge review flow
- note-to-evidence attachment
- export/import
- sync
