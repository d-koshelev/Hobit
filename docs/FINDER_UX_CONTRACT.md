# Finder UX Contract

## Purpose

This contract defines the Finder user experience for Hobit.

Finder is the Stable v0.1 file/project navigation surface. It provides an
operator-controlled Workspace/project view for files, folders, previews,
in-place text edits, and Git-aware review without becoming a shell, hidden
filesystem scanner, broad context-ingestion path, or standalone IDE clone.

Status: Current Stable v0.1 contract / docs-only.

This contract does not implement frontend UI, backend or Tauri commands, Rust
or TypeScript types, storage/schema changes, additional file watching, Git
mutations beyond current Finder Git manual commit/push behavior, Workspace
Agent tools, provider tools, hidden reads, or hidden writes.

Current implemented behavior remains governed by
`docs/CURRENT_WIDGET_SURFACE.md`.

## Product Principle

Finder is the operator's visible Workspace/project navigation surface.

Git review belongs in the Finder space for the Stable v0.1 product direction:
changed files, selected-file diffs, and Git-aware file status should appear
where the operator is already navigating files. The current standalone Git
surface may remain as deprecated/internal compatibility behavior, but Stable
v0.1 product UX should not treat Git as a separate Workbench center.

Finder must preserve these rules:

- explicit approved root before any filesystem or Git read;
- visible selected context before any file preview;
- capped, typed previews with redaction/truncation metadata;
- explicit Save / Cancel for edits;
- no hidden recursive scans;
- no automatic Workspace Agent context ingestion;
- no command execution;
- no hidden Git mutation.

## Primary User

Primary user: the operator working inside one Workspace.

Primary decision: inspect, edit, or review the project file that is relevant to
the current task.

What they need to see:

- the approved root or project scope;
- the current path as visible columns;
- previous folders that led to the selected item;
- selected file metadata and bounded preview;
- whether the selected file has Git changes;
- a selected-file diff when Git data is available.

What they must control:

- which root is approved;
- which folder/file is selected;
- whether a preview opens;
- whether text changes are saved or canceled;
- whether any manual Git commit or push is requested.

## Product Scenario

Scenario: review and edit a project file during a focused Workspace task.

Starting condition: a Workspace is open, and Finder has no approved root or has
one visible approved project root.

User intent: navigate through folders, select a file, inspect its current
content or Git diff, edit it in place when needed, and save or cancel the edit.

Expected outcome: the operator can keep file navigation, file preview, edit
state, and selected-file Git diff together in one Finder widget.

Why this belongs in a widget: Finder is an optional Workbench capability with
its own approved scope, state snapshot, action boundaries, logs, layout, pane
composition, and Widget API boundary.

## Widget Identity

```text
widgetDefinitionId: finder
widgetInstanceId: <finder widget view id>
workspaceId: <owning workspace>
workbenchId: <owning workbench>
user-facing title: Finder
status: Current Stable v0.1
singleton or multiple: multiple Finder widgets may exist if each has visible approved scope
provider status: unavailable | unsupported | ready
```

Multiple Finder widgets may point at different approved roots inside the same
Workspace where current behavior allows it. Finder state must not leak across
Workspaces.

## Scope And Root Model

Finder requires an approved local root before listing, previewing, editing, or
reading Git status.

Approved root rules:

- the root is selected or approved explicitly by the operator;
- the root label and safe display path remain visible;
- paths are resolved and constrained to the approved root;
- symlinks, worktrees, and network paths require conservative handling;
- unsupported browser/dev runtime states must be visible;
- no parent traversal or Workspace-wide scanning may infer a root;
- no hidden folder scan may discover repositories, secrets, or project files.

The current implementation uses a transient approved root. Persistence of
approved roots remains a separate future storage/API decision.

## UX Layout

Target display level for this contract: Operational.

First implementation should still start with the smallest useful Finder slice.
The full Operational UX defined here may be split across later blocks.

Finder shell sections:

- Scope: approved root label, current path summary, unsupported/error state.
- Columns: macOS-like folder navigation with previous folders visible.
- Selection: selected file/folder metadata and safe status.
- Floating Preview: content preview, edit-in-place, or Git diff for selection.
- Logs: widget-local bounded activity summaries where the Widget shell provides them.

Finder should avoid box-inside-box composition. The column strip and preview
are one continuous widget surface, not separate widgets.

## Column Navigation

Finder uses column-based navigation as the primary file navigation model.

Column rules:

- each folder level is a column;
- selecting a folder opens its children in the next column;
- previous folders remain visible as earlier columns;
- the selected item is highlighted in its owning column;
- the visible path can be inferred from the column chain;
- horizontal overflow may scroll columns rather than replacing the whole view;
- columns show bounded directory entries and visible cap metadata when capped;
- binary, unsupported, ignored, permission-denied, or too-large entries use visible states;
- changing column selection does not create a new widget instance.

Columns may show compact Git indicators when Git status is available for the
approved root. Indicators are read-only status, not Git actions.

## Floating Preview Pane

Finder has one Finder-owned floating preview pane.

The floating preview is a pane presentation inside the Finder widget model. It
is not a new WidgetInstance, not a hidden Dock item, not a true external OS
window, and not permission to expose raw or sensitive content.

Preview modes:

- `content`: capped selected-file text preview;
- `edit`: editable text for explicitly selected supported files;
- `diff`: selected-file Git diff preview;
- `metadata`: selected item details, caps, redactions, and unsupported reasons.

The same preview pane can switch between normal file preview and Git diff for
the selected item. This avoids separate Git review surfaces for the common
case of "what changed in this file?"

Pane states follow `docs/UNIVERSAL_WIDGET_SHELL_CONTRACT.md`:

- `normal`: preview participates in the Finder layout;
- `minimized`: compact preview strip remains visible;
- `maximized`: preview takes the primary Finder area for focused reading or editing;
- `collapsed`: preview header/status remains visible and body is hidden;
- `hidden`: preview is not relevant or unsupported for the current selection.

Pane state changes are presentation only. They do not read extra content,
write files, refresh Git, create Queue tasks, or send context to Workspace
Agent by themselves.

## Edit In Place

Finder supports edit-in-place for selected supported text files.

Edit rules:

- editing starts only from an explicitly selected file preview;
- the editor works on a visible draft;
- Save and Cancel are explicit controls;
- unsaved changes are visible in the preview/header state;
- changing selection with unsaved edits must require a visible decision:
  save, discard/cancel, or stay;
- Save writes only the selected file inside the approved root through the
  current approved file handle/API path where available;
- Cancel discards the draft and returns to the last loaded preview;
- autosave is not part of this contract;
- formatting, refactors, multi-file edits, and agent-authored patches are out
  of scope for this UX contract.

Supported first edit targets should be plain text files with conservative size
and encoding limits. Binary files, generated files, large files, unsupported
encodings, permission-denied files, and files outside the approved root must
be read-only or unsupported with visible reasons.

## Git Diff Preview

Finder shows Git-aware review for the approved root where Git data is
available.

Git-in-Finder rules:

- Git status and diff reads require the same explicit approved root boundary;
- no repository root is inferred through hidden parent traversal;
- no Workspace-wide repository scan is allowed;
- status indicators may appear in columns and selection metadata;
- selecting a changed file may load a bounded selected-file diff into the same
  floating preview pane;
- diff preview must show truncation, binary, generated-file, and unsupported
  states when applicable;
- raw diff is not default AI context;
- Git status/diff/history reads are read-only;
- manual local commit and manual push are explicit approval-gated Finder Git
  plugin actions;
- stage, unstage, restore, reset, clean, stash, rebase, merge, checkout,
  branch management, force push, push-all, automatic push, and hidden push
  remain out of scope unless a later explicit Finder/Git mutation contract
  adds them.

Current standalone Git Widget behavior remains governed by
`docs/GIT_WIDGET_CONTRACT.md` and `docs/CURRENT_WIDGET_SURFACE.md`.

## State Snapshot

Safe Finder snapshots should include:

- snapshot revision;
- provider/runtime status;
- approved root label and safe display path;
- current column path;
- visible columns with bounded entries;
- selected item id/path label/type;
- preview mode and preview lifecycle state;
- edit dirty/saved/error state;
- Git status summary when available;
- selected-file diff summary when loaded;
- caps, redactions, truncation, and unsupported reasons;
- visible errors.

Snapshots must not include secret values, hidden files by default, full large
file contents, unbounded diffs, raw repository scans, Terminal output, Executor
payloads, or hidden Workspace context.

## Capabilities

Current Finder capabilities:

```text
finder.root.select
finder.directory.list
finder.item.select
finder.file.preview_selected
finder.file.edit_selected
finder.file.save_selected
finder.file.cancel_edit
finder.git.status_read
finder.git.diff_selected
finder.git.history_read
finder.git.commit_manual
finder.git.push_manual
```

Capability risk:

- root selection, directory listing, item selection: safe read when inside an
  approved root;
- file preview: sensitive read when selected, capped, and visible;
- edit draft: local UI mutation only until saved;
- save selected file: local file mutation and requires explicit operator action;
- Git status/diff/history: safe or sensitive read depending on content, always
  capped and selected;
- manual commit: local Git mutation with explicit operator approval;
- manual push: external/network Git mutation with explicit operator approval,
  no force push, no push-all, no hidden push, and no automatic push.

## Actions

Current app-native actions:

- `finder.root.select`: approve a root and load its first bounded column.
- `finder.directory.list`: list one selected directory inside the approved root.
- `finder.item.select`: select a file or folder from a visible column.
- `finder.file.preview_selected`: load a capped preview for the selected file.
- `finder.file.edit_selected`: enter edit mode for a supported selected file.
- `finder.file.save_selected`: write the visible draft to the selected file.
- `finder.file.cancel_edit`: discard the visible draft.
- `finder.git.status_read`: read bounded Git status for the approved root.
- `finder.git.diff_selected`: load bounded diff for the selected changed file.
- `finder.git.history_read`: read bounded Git history for the approved root.
- `finder.git.commit_manual`: create an explicit local commit from selected
  files and an operator-provided message.
- `finder.git.push_manual`: push local commits only after visible
  branch/upstream/ahead-behind review and explicit operator confirmation.

Actions must use Workspace/widget APIs. They must not be implemented as shell
strings, DOM clicks, direct storage edits, hidden filesystem operations,
localStorage mutation, provider tool calls, or private React state access.

## Events

Finder events:

- root selected;
- directory listed;
- column selection changed;
- item selected;
- preview loaded;
- preview capped;
- edit started;
- edit saved;
- edit canceled;
- save failed;
- Git status loaded;
- Git diff loaded;
- Git history loaded;
- manual commit completed or failed;
- manual push completed or failed;
- unsupported runtime or file state shown.

Events should include compact summaries, previous/next lifecycle state when
useful, action id, timestamp, and evidence/log references where appropriate.

## State Machine

Finder lifecycle states:

- `No approved root`: Finder cannot list files.
- `Root selected`: a root is visible and approved.
- `Listing`: a directory column is loading.
- `Listed`: one or more columns are visible.
- `Item selected`: a file/folder is selected.
- `Preview loading`: selected preview or diff is loading.
- `Preview ready`: selected preview or diff is visible.
- `Editing`: selected supported text file has an editable draft.
- `Dirty`: draft differs from loaded file content.
- `Saving`: explicit save is in progress.
- `Saved`: save succeeded and preview reflects saved content.
- `Capped`: listing, preview, or diff hit a cap but remains usable.
- `Unsupported`: selected action/runtime/file is not supported.
- `Failed`: selected action failed with a visible typed error.

Invalid transitions:

- preview without selected item;
- edit without loaded supported selected file;
- save without dirty selected draft;
- Git diff without approved root and selected changed file;
- any read or write outside approved root;
- any file or Git mutation caused only by pane visibility changes.

## Safety Policy

Finder safety boundaries:

- file/folder listing is bounded and scoped to the approved root;
- file preview is selected, capped, and visible;
- edits are draft-first and require explicit Save;
- Git diff is selected-file and capped;
- no hidden recursive scan;
- no file watcher;
- no Terminal command execution;
- no Script Runner behavior;
- no arbitrary command prompt;
- no automatic Queue, Executor, or Workspace Agent action;
- no automatic inclusion of file content or diff in AI prompts;
- no secret detection claims beyond explicit future redaction/capping rules;
- no destructive file operations in this contract.

Future Workspace Agent use of Finder must read only visible or explicitly
approved Finder context through app-native capability boundaries.

## Semantic Tests

Semantic tests should use app-native Finder actions and safe snapshots.

Stable v0.1 test scenarios:

- select fixture root, list first column, and assert cap metadata;
- navigate nested folders and assert previous columns remain visible;
- select fixture text file and read capped content preview;
- minimize, maximize, collapse, and restore preview without changing selection;
- enter edit mode, modify draft, cancel, and assert no file mutation;
- enter edit mode, modify draft, save, and assert selected fixture file changed;
- load Git status for an explicit fixture repository root;
- select changed fixture file and load bounded diff in the same preview pane;
- read bounded Git history;
- require explicit confirmation for manual commit;
- require explicit confirmation and safe upstream state for manual push;
- reject preview, edit, save, status, or diff outside approved root;
- report unsupported browser/runtime state without fake data.

Tests must not use shell commands, DOM scraping, direct SQLite edits, or hidden
filesystem rewrites as product behavior substitutes.

## Future Slice Guidance

Future Finder work should stay contract-first and narrow. Candidate future
slices include approved-root persistence, bounded search/indexing, explicit
Workspace Agent attachment of visible selected context, commit detail review,
and any broader Git/file mutation workflows.

## Out Of Scope

This contract does not add:

- additional Finder implementation beyond current Stable v0.1 behavior;
- storage/schema changes;
- approved root persistence;
- hidden filesystem access;
- unbounded file search;
- folder watching;
- binary parsing;
- image editing;
- Markdown rendering;
- Terminal launch;
- Script Runner behavior;
- Workspace Agent file tools;
- provider tools;
- Queue or Executor launch;
- automatic context ingestion;
- multi-file refactor tools;
- patch apply;
- staging, push-all, force push, automatic push, restoring, resetting,
  cleaning, stashing, rebasing, merging, checking out branches, branch
  management, or any hidden Git mutation.
