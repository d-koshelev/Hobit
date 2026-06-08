# Workspace Agent V2 UX Context Activity Requirements

## Purpose

This document defines docs-only UX requirements for a future Workspace Agent V2
surface focused on visible context, readable run activity, and clear operator
control.

It does not implement frontend UI, backend behavior, Tauri commands, storage or
schema changes, provider integration, Workspace Agent runtime changes, Queue
execution, Finder behavior, Git behavior, Notes behavior, Knowledge behavior,
or new widget insertion behavior.

Workspace Agent remains the foreground operator-facing AI surface. The operator
must be able to see what context is selected before a run, follow what happened
during a run without reading raw logs by default, and decide the next action
from grouped result controls.

## Status

Status: Planned requirements.

These requirements describe a future V2 UX target. They do not change the
current Workspace Agent implementation described in
`docs/CURRENT_WIDGET_SURFACE.md`.

## Product Boundary

Workspace Agent V2 must preserve the current product rules:

- Workbench remains the product center.
- Workspace Agent is a widget, not a hidden global runtime.
- Context is visible, explicit, removable, and inspectable before a run.
- Agent work is visible and approval-aware.
- Raw logs and developer payloads are not normal operator-facing content.
- Tools, mutations, Queue work, Terminal commands, Git actions, SQL execution,
  and file edits remain unavailable unless a later explicit contract and
  implementation block enables them.

## Layout Requirements

The Workspace Agent V2 module should be composed as one continuous widget
surface with these regions:

- Provider, mode, and settings row.
- Transcript.
- Right activity pane.
- Visible context strip.
- Composer.
- Bottom run status summary.

The widget header remains the top meta zone of the widget shell. The provider,
mode, and settings row belongs inside the Workspace Agent surface below the
header and must not become a detached settings widget.

### Provider, Mode, And Settings Row

The top row should show only the controls needed to understand and start the
current interaction:

- selected provider or local/mock state
- selected interaction mode
- working directory or execution scope when applicable
- compact settings access
- provider readiness and error state when relevant

Provider details, raw request configuration, and developer diagnostics belong
behind an explicit settings or Developer details expansion, not in the default
row.

### Transcript

The transcript is the primary conversation and result-review area. It should
show operator messages, assistant messages, proposal or result cards, and
message metadata that helps the operator understand source and status.

Transcript metadata should include:

- message author or source
- timestamp
- provider or local/mock source when relevant
- run association when a message is produced by a run
- status such as draft, sending, complete, failed, or cancelled
- context-used summary when the message is tied to a run

Token counts must appear only when the provider reports them. Workspace Agent
V2 must not fabricate prompt, completion, cached, or total token numbers.

### Right Activity Pane

The right activity pane should show run activity grouped by run. It is an
operator-readable activity surface, not a raw log console.

Activity requirements:

- group activity by run
- make each run group collapsible
- default to a high-level summary
- show lifecycle steps such as queued, started, context prepared, provider
  request, response received, proposal/result prepared, completed, failed, or
  cancelled when available
- show timestamps and status
- keep command, provider, or stream internals out of the default view
- expose raw logs only through explicit Developer details

When no run is selected, the pane may show the latest run summary or a compact
current-session activity list. It must not imply persisted history unless a
later implementation provides it.

### Visible Context Strip

The visible context strip should sit near the composer so the operator can
review context immediately before sending or running.

Each context item should show:

- source surface
- short label
- scope
- estimated size when available
- warning state when context is capped, stale, unavailable, or future-only
- remove control

The context strip should not hide selected context inside menus. Collapsed
views may compress items, but the operator must still have a visible signal
that context is attached before a run.

### Composer

The composer should contain the operator's next instruction and any explicit
run action. It should be close to the visible context strip and bottom run
status summary so the operator can see selected context and current run state
before sending.

The primary composer action should be singular and clear for the current mode.
Secondary actions should be grouped under compact controls.

### Bottom Run Status Summary

The bottom run status summary should provide persistent run feedback without
competing with the transcript.

It should show:

- current or latest run status
- provider or local/mock source
- elapsed time when available
- cancellation or stop availability when in scope
- compact error summary when failed
- link or focus affordance to the matching activity group

It should not duplicate the full activity pane or transcript result content.

## Context Visible Before Run

Workspace Agent V2 must show all selected run context before the operator sends
or starts a run. Context must be visible even when it was attached from another
widget.

Supported or planned context categories:

- Knowledge
- Skills
- files and Finder selection
- Queue context
- Notes
- attachments
- future Git review metadata

### Knowledge

Knowledge context should identify selected Knowledge Documents, snippets, or
materialized summaries with Workspace or local-global scope labels when
available. Disabled, rejected, or unavailable Knowledge must not appear as
silently included context.

### Skills

Skill context should identify the selected Skill and show enough summary to
confirm which guidance is attached. Skills must remain explicit attachments,
not automatic hidden prompt injections.

### Files And Finder Selection

Finder or file context must be selected explicitly by the operator from an
approved Finder/file surface. The context strip should show root-relative file
labels, preview/cap state when available, and whether content, metadata, or
selection-only context is attached.

Workspace Agent V2 must not silently scan folders, read unselected files, or
turn Finder into hidden context ingestion.

### Queue Context

Queue context should identify selected Queue tasks, task summaries, assigned
run links, or materialized task context. Attaching Queue context must not
start, assign, update, or auto-dispatch Queue work.

### Notes

Notes context must be attached through an explicit operator action. The context
strip should identify selected saved Notes and whether the attached content is
a summary, excerpt, or full selected visible text. Existing Notes must not be
read, summarized, or sent to providers automatically.

### Attachments

Attachments should be visible as first-class context items with source, label,
size/cap state, and remove control. Unsupported or oversized attachments should
show an honest warning instead of being silently dropped or silently included.

### Future Git Review Metadata

Future Git review metadata may include selected repository status summaries,
changed-file summaries, selected diffs, commit metadata, or review notes only
when attached explicitly through the owning Git/Finder review surface.

Git metadata context must not imply hidden repository scanning, branch
mutation, commit creation, push, reset, clean, stash, checkout, or automatic
post-run Git behavior.

## Activity Requirements

Activity is grouped by run because operators need to understand which visible
context and provider interaction produced each transcript result.

Each run group should include:

- run title or compact identifier
- provider or local/mock source
- start and end timestamps when available
- current status
- context summary
- high-level lifecycle events
- result summary
- failure summary when failed

Run groups should be collapsible. The default collapsed state should preserve
enough information to answer what ran, with what context, and what happened.

Developer details may include:

- raw provider request/response preview when allowed and redacted
- raw stream events
- raw logs
- timing breakdowns
- diagnostic metadata

Developer details must be explicitly expanded and must not be shown as the
default operator view.

## Result Cards

Result cards should help the operator decide what to do next without turning
the transcript into a dense control panel.

Each result card should have one primary next action. Examples include:

- Review proposal
- Create Queue task
- Create Note
- Attach to composer
- Open run details
- Copy result

Secondary actions should be grouped by purpose, such as:

- Review
- Attach
- Create
- Copy
- Developer details

Cards should show the proposal/result status, target surface when relevant,
input summary, visible risk notes, and outcome summary. Approval of a card must
not imply hidden execution or broad future autonomy.

## Responsive Requirements

Workspace Agent V2 must work across large, medium, and compact module surfaces
without overlapping controls or hiding critical context.

### Large Surface

Large surfaces should support:

- transcript as the main center area
- persistent right activity pane
- visible context strip above the composer
- bottom run status summary
- provider/mode/settings row at the top

The activity pane may remain open by default when there is enough horizontal
space.

### Medium Surface

Medium surfaces should prioritize the transcript and composer while keeping
context visible.

Expected behavior:

- activity pane may collapse into a side drawer or tab
- context strip remains visible before run
- provider/mode/settings row stays compact
- bottom run status summary remains visible
- result card secondary actions group more aggressively

### Compact Surface

Compact surfaces should preserve the send/review loop with minimal chrome.

Expected behavior:

- transcript and composer are primary
- context strip compresses into visible chips or a compact expandable row
- activity pane becomes a collapsible panel, drawer, or tab
- bottom run status summary remains a compact single-line or two-line summary
- provider/mode/settings row may reduce to labels and compact controls
- result cards show one primary action, with secondary actions in a menu

Compact behavior must not hide attached context entirely before run.

## Non-Goals

This requirements document does not add:

- frontend implementation
- backend implementation
- storage or schema changes
- new provider capabilities
- provider tools
- hidden context access
- automatic context selection
- Queue auto-dispatch
- Agent Executor launch behavior
- Terminal control
- Git mutation
- JDBC execution
- Finder implementation changes
- Notes reads or summaries
- raw logs in the default operator view
