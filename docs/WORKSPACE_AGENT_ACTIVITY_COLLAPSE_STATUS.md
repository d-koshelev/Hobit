# Workspace Agent Activity Collapse Status

## Purpose

This is a docs-only status record for the Workspace Agent Activity collapse and
layout polish follow-up. It records completed UI behavior and manual smoke
coverage expectations. It does not add product behavior, runtime behavior,
backend APIs, storage, schema, automatic execution, or Git behavior.

## Status

Completed.

The Workspace Agent Activity surface now treats collapse as a real layout
change instead of leaving a blank reserved side panel.

Implemented polish:

- The Activity toggle is placed with the Workspace Agent header controls near
  Examples, so the operator can collapse or expand Activity from the same
  control area used for the current agent surface.
- Collapsed Activity no longer leaves an empty right-side panel.
- When Activity is collapsed, the conversation area expands into the space
  previously used by the Activity panel.
- When Activity is expanded, it remains a right-side, top-aligned activity
  surface beside the conversation.
- Activity events continue to read top-to-bottom when expanded.
- Full logs and run details remain available through their separate existing
  surfaces and controls.

## Manual Smoke Checklist

Run this checklist after the Workspace Agent Activity collapse polish is built
locally:

1. Open a Workspace Agent widget.
2. Start a safe Direct Run, or use existing run history if a safe run is
   already available.
3. Verify the Activity toggle appears near Examples and the header controls.
4. Collapse Activity and verify the conversation area expands.
5. Verify no empty right-side panel remains after collapse.
6. Expand Activity and verify activity events appear top-to-bottom.
7. Verify Direct Run still works.
8. Verify Logs and Run details still open through their existing separate
   surfaces.

## Non-Goals

This follow-up intentionally did not implement:

- Runtime or provider changes.
- Backend or storage changes.
- Automatic execution.
- Git mutations.
- New widget insertion behavior.
- New Queue, Executor, Terminal, Finder, JDBC, Notes, Knowledge, or Runbook
  behavior.

## Active Index Note

`docs/ACTIVE_CONTRACT_INDEX.md` was not updated for this status record. This
document is a narrow docs-only polish status note, not a new active product
contract or domain navigation entry.
