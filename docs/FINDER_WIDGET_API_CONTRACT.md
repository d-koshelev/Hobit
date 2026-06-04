# Finder Widget API Contract

## Purpose

This contract defines the Finder Widget API and Finder Git Plugin API boundary
for Stable v0.1.

Status: Current Stable v0.1 contract / docs-only / API-boundary design.

This contract does not implement frontend UI, backend or Tauri commands, Rust
or TypeScript types, storage/schema changes, additional filesystem reads or
writes, additional Git commands, additional WorkspaceGitApi runtime behavior,
Workspace Agent tools, provider tools, or semantic tests.

Current implemented behavior remains governed by
`docs/CURRENT_WIDGET_SURFACE.md`.

The implemented Stable v0.1 Finder surface includes explicit root selection,
column-based navigation with previous folders visible, bounded file content
preview, a Finder-owned floating preview pane, edit-in-place with explicit
Save / Cancel for supported uncapped text files, preview pane minimize /
maximize behavior, and a Finder Git plugin for status badges/changed files,
selected-file diff preview, Git history, manual local commit, and explicit
manual push.

Conceptual actions in this document that are not listed in the implemented
surface remain future contract vocabulary and must not be claimed as current
runtime behavior.

## Product Boundary

Finder is the operator-controlled file/project navigation surface inside the
Workbench.

The Finder API must preserve these product rules:

- every filesystem and Git read requires an explicit approved root;
- every listed, previewed, selected, attached, or edited path is constrained to
  the approved root;
- file previews and diffs are selected, bounded, typed, and visibly capped
  when needed;
- file edits use a visible draft and explicit Save / Cancel;
- Git review lives inside Finder through a Finder-owned Git plugin;
- the Finder Git plugin uses WorkspaceGitApi as its app-native Git boundary;
- Workspace Agent receives only explicitly attached visible Finder context;
- no hidden recursive scan, parent traversal, filesystem watcher, command
  execution, hidden file mutation, hidden Git mutation, or automatic context
  ingestion is allowed.

## API Identity

Conceptual identity:

```text
widgetDefinitionId: finder
widgetInstanceId: <finder widget view id>
workspaceId: <owning workspace>
workbenchId: <owning workbench>
approvedRootId: <operator-approved root reference>
providerStatus: unavailable | unsupported | ready
```

Multiple Finder widgets may exist in one Workspace if each has its own visible
approved scope. Finder state must not leak across Workspaces.

## Root And Path Model

Finder uses an approved root boundary before any operation.

Root rules:

- `openRoot` is the only API action that establishes the active root;
- the operator must explicitly select or approve the root;
- root label and safe display path remain visible in Finder state;
- implementation must resolve paths and constrain them to the approved root;
- symlinks, worktrees, network paths, and permission-denied paths require
  conservative typed handling;
- no parent-directory traversal may infer a repository or project root;
- no Workspace-wide scan may discover roots, repositories, files, or secrets.

Path rules:

- API inputs use root-relative path references after a root is open;
- returned path labels must be safe to display;
- absolute paths are not default AI-readable context;
- unsupported, binary, generated, ignored, too-large, permission-denied, or
  outside-root paths return typed visible errors or unsupported states.

## Finder API

The Finder API is app-native. These methods are conceptual action names, not
implemented function signatures.

### openRoot

Purpose: approve and open one local root for this Finder widget.

Input concepts:

- operator-selected root path or future Workspace-approved root reference;
- optional display label;
- optional runtime constraints such as max entries and max preview bytes.

Output concepts:

- root id;
- safe display path;
- provider/runtime status;
- first bounded directory listing when supported;
- cap and unsupported metadata;
- event `finder.root.opened`.

Safety:

- requires explicit operator action;
- does not persist the root unless a future storage contract adds that flow;
- does not scan parent directories or discover nested repositories.

### listDirectory

Purpose: list one directory inside the approved root.

Input concepts:

- root id;
- root-relative directory path;
- listing cap;
- optional visible filter.

Output concepts:

- bounded directory entries;
- entry type, size class, modified time where safe, and status labels;
- cap/truncation metadata;
- typed errors;
- event `finder.directory.listed`.

Safety:

- safe read only inside approved root;
- no recursive listing by default;
- no file content read.

### searchFiles

Purpose: perform a bounded operator-triggered search inside the approved root.

Input concepts:

- root id;
- search query;
- optional path scope inside the root;
- result cap and timeout cap;
- explicit include/exclude rules.

Output concepts:

- bounded result list;
- result path labels and match metadata;
- cap/truncation/timeout metadata;
- typed errors;
- event `finder.search.completed` or `finder.search.capped`.

Safety:

- explicit operator action only;
- bounded and scoped to the approved root;
- no hidden background indexing, watcher, embeddings, or broad context
  ingestion;
- result snippets are capped and not sent to Workspace Agent automatically.

### openFilePreview

Purpose: load a capped visible preview for one selected file.

Input concepts:

- root id;
- root-relative file path;
- preview mode `content` or `metadata`;
- max bytes, max lines, and encoding constraints.

Output concepts:

- preview id;
- selected file metadata;
- content preview when supported;
- redaction, truncation, binary, encoding, generated, ignored, and
  unsupported metadata;
- event `finder.file.preview_opened`.

Safety:

- sensitive read when content is included;
- requires explicit selected file or explicit path from visible search/list
  results;
- raw preview is not default AI context.

### selectPath

Purpose: update Finder selection to one visible file or folder path.

Input concepts:

- root id;
- root-relative path;
- expected current selection or revision when needed.

Output concepts:

- selected path reference;
- selected type and safe metadata;
- updated column path;
- selected Git status summary when already available;
- event `finder.path.selected`.

Safety:

- selection alone does not read file contents, refresh Git, attach context,
  write files, or create Queue/Executor work.

### attachSelectedFileToWorkspaceAgent

Purpose: attach selected Finder context to a Workspace Agent composer as
visible, editable current-session context.

Input concepts:

- root id;
- selected file path;
- attachment kind: `path_reference`, `metadata_summary`, `preview_excerpt`, or
  `diff_excerpt`;
- target Workspace Agent widget instance id;
- selected excerpt range or bounded visible preview reference when attaching
  text;
- operator approval reference.

Output concepts:

- attachment id;
- safe attachment summary;
- cap/redaction metadata;
- event `finder.file.attached_to_workspace_agent`.

Safety:

- requires explicit operator action;
- does not auto-send the Workspace Agent message;
- does not attach full large file content, full diffs, hidden files, raw
  absolute paths, secrets, Terminal output, Executor payloads, or unselected
  files;
- Workspace Agent may edit/remove the visible attachment before Send.

### editFileInPlace

Purpose: create, update, save, or cancel a visible draft for the selected
supported text file.

Input concepts:

- root id;
- selected file path;
- edit operation: `start`, `update_draft`, `save`, or `cancel`;
- draft content for update/save;
- expected file revision or content hash where available;
- operator approval reference for save.

Output concepts:

- edit session id;
- dirty/saved/error state;
- saved file metadata when save succeeds;
- conflict or unsupported state when applicable;
- events `finder.file.edit_started`, `finder.file.edit_updated`,
  `finder.file.edit_saved`, or `finder.file.edit_canceled`.

Safety:

- `start` and `update_draft` are local visible draft mutations only;
- `save` is a local file mutation and requires explicit operator action;
- save writes only the selected file inside the approved root;
- no autosave, multi-file edit, refactor tool, patch apply, command execution,
  or agent-authored hidden write is included.

## Finder Git Plugin API

The Finder Git plugin is a Finder-owned API surface for Git review and
approval-gated Git actions inside the approved Finder root.

The plugin lives in Finder and uses WorkspaceGitApi. It must not call Git CLI,
Tauri commands, shell commands, or standalone Git widget internals directly.
WorkspaceGitApi owns Git adapter routing, output caps, typed errors, and
future policy/audit integration.

Conceptual plugin identity:

```text
pluginId: finder.git
ownerWidgetDefinitionId: finder
workspaceApiBoundary: WorkspaceGitApi
rootSource: Finder approved root
```

### getGitStatus

Purpose: read bounded repository status for the Finder approved root.

Output concepts:

- repository status;
- branch and upstream summary when available;
- clean/dirty state;
- ahead/behind counts;
- changed-file counts;
- warnings and typed errors;
- event `finder.git.status_loaded`.

Safety:

- read-only;
- no fetch or network contact;
- no root inference beyond the Finder approved root.

### getChangedFiles

Purpose: list bounded changed files for the approved root.

Output concepts:

- grouped changed files such as staged, unstaged, and untracked;
- file status labels;
- selected-file-safe metadata;
- cap/truncation metadata;
- event `finder.git.changed_files_loaded`.

Safety:

- read-only;
- does not stage, unstage, restore, or inspect file contents beyond bounded
  status metadata.

### getFileDiff

Purpose: load a bounded diff for one selected changed file.

Input concepts:

- selected root-relative path;
- diff side/scope such as working tree or staged when supported;
- max bytes and max hunks.

Output concepts:

- diff preview or unsupported/binary state;
- truncation metadata;
- selected file metadata;
- event `finder.git.file_diff_loaded`.

Safety:

- sensitive read;
- selected-file only;
- raw diff is not attached to Workspace Agent unless explicitly selected and
  attached through Finder.

### getHistory

Purpose: read bounded recent repository history for the approved root.

Output concepts:

- recent commit summaries;
- current branch context;
- cap/truncation metadata;
- event `finder.git.history_loaded`.

Safety:

- read-only;
- no fetch, branch mutation, checkout, or graph-wide unbounded traversal.

### getCommitDetails

Purpose: read bounded details for one selected commit.

Input concepts:

- commit id from visible history or status metadata;
- max files and max diff bytes.

Output concepts:

- commit metadata;
- changed-file summary;
- optional bounded diff/details preview;
- cap/truncation metadata;
- event `finder.git.commit_details_loaded`.

Safety:

- read-only;
- only visible selected commit ids are valid inputs.

### manualCommit

Purpose: create an explicit local commit from an operator-approved selected
file set.

Input concepts:

- selected root-relative files;
- operator-authored or reviewed commit message;
- expected repository revision/status;
- explicit confirmation reference.

Output concepts:

- commit result;
- commit hash when successful;
- included file summary;
- rejected state and typed errors when preconditions fail;
- event `finder.git.manual_commit_completed` or
  `finder.git.manual_commit_failed`.

Safety:

- local Git mutation;
- requires explicit operator confirmation;
- must show included files and message before commit;
- must reject hidden file sets and unrelated staged changes unless a future
  contract explicitly supports broader staging policy;
- does not push.

### manualPush

Purpose: push local commits only after explicit operator review and approval.

Input concepts:

- approved root id;
- visible branch/upstream summary;
- expected ahead/behind state;
- optional remote/branch selection when WorkspaceGitApi supports it;
- explicit confirmation reference.

Output concepts:

- push result;
- pushed branch/upstream summary;
- typed error or rejected state;
- event `finder.git.manual_push_completed` or
  `finder.git.manual_push_failed`.

Safety:

- external Git/network mutation;
- requires explicit operator confirmation;
- must show branch, upstream, ahead/behind state, and expected effect before
  execution;
- no automatic push after commit or Executor completion;
- no force push in this API;
- no push when branch/upstream state is unclear, behind, detached, or
  unsupported unless a later stronger-confirmation contract explicitly allows
  it.

## State Snapshot

Safe Finder snapshots should include:

- snapshot revision;
- provider/runtime status;
- approved root label and safe display path;
- current column path;
- visible bounded entries;
- selected path reference and type;
- preview lifecycle and cap metadata;
- edit dirty/saved/error state;
- Git status summary when loaded;
- selected-file diff summary when loaded;
- visible errors and unsupported reasons.

Snapshots must not include secrets, unbounded directory listings, full large
file contents, unbounded diffs, raw Git command output, Terminal buffers,
Executor payloads, hidden Workspace context, or unapproved absolute paths as
AI-readable context.

## Capability Summary

Current Finder capabilities:

- `finder.root.open`
- `finder.directory.list`
- `finder.path.select`
- `finder.file.preview`
- `finder.file.edit_in_place`

Current Finder Git plugin capabilities:

- `finder.git.status.read`
- `finder.git.changed_files.read`
- `finder.git.file_diff.read`
- `finder.git.history.read`
- `finder.git.commit.manual`
- `finder.git.push.manual`

Future Finder capabilities described by this API vocabulary but not Stable
v0.1 current behavior include bounded file search, selected Finder context
attachment to Workspace Agent, and selected commit detail review.

Risk classes:

- root open, directory list, path select: safe read inside approved root;
- search, preview, diff, commit details: sensitive read with caps;
- edit draft: local UI mutation until save;
- edit save and manual commit: local mutation with explicit approval;
- manual push: external/network mutation with explicit approval.

## Error Categories

Finder and Finder Git plugin errors should be typed and visible:

- `not_configured`
- `unsupported_runtime`
- `path_not_found`
- `outside_approved_root`
- `permission_denied`
- `unsupported_file_type`
- `unsupported_encoding`
- `binary_file`
- `file_too_large`
- `directory_listing_capped`
- `preview_capped`
- `search_capped`
- `git_unavailable`
- `not_a_git_repository`
- `git_status_capped`
- `diff_capped`
- `history_capped`
- `commit_rejected`
- `push_rejected`
- `timed_out`
- `parse_error`

## Workspace Agent Boundary

Workspace Agent may receive Finder context only through
`attachSelectedFileToWorkspaceAgent`.

Rules:

- attachment is operator-controlled and visible;
- attachment does not auto-send;
- attached content is bounded and editable/removable before Send;
- Finder does not expose a provider tool or hidden file tool;
- Workspace Agent does not call Finder APIs for hidden reads, hidden edits,
  hidden Git review, automatic Queue creation, or automatic Git mutation.

## Semantic Test Targets

Semantic tests should use app-native Finder and WorkspaceGitApi-backed
actions, not shell commands or private component state.

Stable v0.1 acceptance targets:

- open explicit fixture root and list first directory;
- reject list, preview, edit, search, or Git operations outside approved root;
- select path without reading file content;
- open capped text preview for selected file;
- start edit, update draft, cancel, and verify no file mutation;
- start edit, update draft, save, and verify selected file mutation only;
- load Git status through Finder Git plugin for explicit root;
- list changed files and load selected-file bounded diff;
- read recent history with caps;
- require explicit confirmation for manual commit;
- require explicit confirmation and safe upstream state for manual push;
- report unsupported browser/runtime states without fake data.

Future-only test targets include bounded search, selected Finder context
attachment to Workspace Agent, and selected commit detail review.

## Non-Goals

This contract does not add:

- additional Finder implementation beyond current Stable v0.1 behavior;
- additional WorkspaceGitApi implementation beyond current Stable v0.1
  behavior;
- storage/schema changes or approved-root persistence;
- filesystem watcher or background index;
- hidden recursive scan or repository discovery;
- binary parsing, image editing, Markdown rendering, or file type plugins;
- Terminal launch or Script Runner behavior;
- Workspace Agent file tools or provider tool mode;
- Queue or Executor launch;
- automatic context ingestion;
- autosave, multi-file edit, refactor, patch apply, file create/delete/move,
  rename, restore, reset, clean, stash, rebase, merge, checkout, branch
  management, or force push.
