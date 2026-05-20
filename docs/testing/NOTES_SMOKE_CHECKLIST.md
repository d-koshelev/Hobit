# Notes Smoke Checklist

## Purpose

This checklist covers current Notes behavior only.

Authoritative behavior remains in `docs/CURRENT_WIDGET_SURFACE.md` and
`docs/NOTES_WIDGET_CONTRACT.md`. This checklist does not add Notes features and
does not make Deferred Notebook behavior current.

## Desktop / Tauri Current Behavior

Use this checklist in a desktop/Tauri workspace where Workspace Notes APIs are
available.

- [ ] Open or create a Workspace.
- [ ] Add or open the Notes widget from the current widget catalog.
- [ ] Confirm the Notes list area loads or shows an honest empty state.
- [ ] Create a note from the Notes widget.
- [ ] Confirm the created note appears in the notes list.
- [ ] Select the note and confirm the title/body are readable in the editor.
- [ ] Edit the note title.
- [ ] Edit the note body as plain source text.
- [ ] Save explicitly with the Notes save control.
- [ ] Confirm the saved state is visible after save completes.
- [ ] Use frontend filter/search across loaded note title/body.
- [ ] Pin or unpin the selected note through the pinned control and explicit
  save.
- [ ] Confirm pinned notes sort before unpinned notes after reload/refresh when
  storage returns the list.
- [ ] Reload or reopen the desktop Workspace.
- [ ] Confirm the saved note title/body/pinned state persists through the
  SQLite-backed Workspace Notes APIs.

## Browser / Vite Fallback Current Behavior

Use this checklist only for browser/Vite fallback behavior.

- [ ] Open the Workbench through the in-memory Workspace fallback.
- [ ] Add or open the Notes widget.
- [ ] Confirm the widget remains insertable.
- [ ] Confirm Notes persistence reads/writes surface visible
  unsupported-runtime errors.
- [ ] Do not treat browser fallback as persistent Notes behavior.

## Deferred / Not Current

These are not current Notes smoke checks:

- Notebook tabs or a full Notebook document model
- Markdown preview or Markdown rendering
- Mermaid or diagram rendering
- rich formatting controls
- structured checklists/todos
- tags or folders
- archive/delete UI
- autosave
- AI-in-Notes
- sync/import/export
- attachments or collaborative editing
- automatic context ingestion
- Agent Executor, Agent Queue, Runbook, Terminal, Git, JDBC, or hidden
  Coordinator integration
