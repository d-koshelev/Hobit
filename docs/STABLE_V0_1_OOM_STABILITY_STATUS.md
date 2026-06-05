# Stable v0.1 OOM Stability Status

## Purpose

Record the current Stable v0.1 OOM, recovery, and suspected leak status.

This is a docs-only status record. It does not add product behavior, frontend
behavior, backend APIs, storage, runtime execution, validation requirements, or
acceptance criteria.

## Status Summary

Status: source-level diagnostics and one known render-loop fix are present;
long-session desktop smoke is still required before closing the OOM stability
block.

APP-RECOVERY-01 and APP-OOM-01 are separate findings:

- APP-RECOVERY-01 covers operator orientation after renderer refresh,
  renderer reload, or crash-like recovery. Last-open Workspace recovery exists
  for normal renderer reloads, but true OOM/crash recovery still needs manual
  desktop smoke and clearer acceptance expectations.
- APP-OOM-01 covers preventing or diagnosing memory growth that could lead to
  renderer OOM during a long session. Recovery behavior does not prove that
  memory is stable, and memory diagnostics do not prove recovery works.

## Current Observations

- Idle RAM growth has been observed during app idle/stability investigation.
  The current record does not treat that observation as fixed until a long
  desktop session can show bounded growth or identify the retaining surface.
- Renderer memory diagnostics are implemented as dev-only, opt-in diagnostics.
  They sample every 5 seconds and retain at most 120 samples in memory.
- The diagnostics panel can copy a JSON snapshot containing heap, DOM, mounted
  widget, Queue, Direct Work, and activity buckets.
- A Maximum update depth loop risk around Agent Queue run-link refresh has a
  source-level fix: `refreshAgentQueueRunLinks` keeps equivalent latest-run-link
  and run-history state references stable instead of replacing them on repeated
  equivalent refreshes.
- Focused coverage exists for that Queue helper behavior in
  `apps/desktop/frontend/src/workbench/queue/agentQueueLoadHelpers.test.ts`.

## Memory Diagnostics

Diagnostics are available only in dev builds.

Enable for a single URL/session:

```text
?hobitMemoryDiagnostics=1
```

or, for hash-based URLs:

```text
#hobitMemoryDiagnostics=1
```

Enable persistently from the renderer devtools console:

```js
localStorage.setItem("hobit:diagnostics:memory", "1");
location.reload();
```

Disable the persistent flag:

```js
localStorage.removeItem("hobit:diagnostics:memory");
location.reload();
```

The panel reports:

- JS heap values when `performance.memory` is available.
- user-agent specific memory when the browser exposes
  `measureUserAgentSpecificMemory`.
- DOM node count.
- mounted and visible widget counts.
- retained bucket counts for Agent Activity, Direct Work event text, Direct
  Work handoffs, Queue items, Queue run activity, Queue raw events, Queue run
  history, and Workspace Agent transcript fields when available.
- heap and DOM growth rates across retained samples.

## Remaining Required Smoke

Run one long-session desktop smoke pass before closing APP-OOM-01:

1. Start the Tauri desktop app in dev mode with memory diagnostics enabled.
2. Open the default Stable v0.1 surface: Workspace Agent plus Notes, then add
   Agent Queue, Agent Activity, Terminal, Knowledge / Skills, Database / JDBC,
   Runbook, and any already-supported compatibility surfaces needed for the
   smoke.
3. Capture an initial diagnostics snapshot.
4. Leave the app idle long enough to cover several sample windows; because the
   panel retains 120 samples at 5-second intervals, a 10-minute window is the
   minimum useful panel span.
5. Exercise the previously unstable Queue run-link path by selecting Queue
   tasks and letting run metadata refresh without starting hidden execution.
6. Capture mid-session and final diagnostics snapshots.
7. Record whether heap, DOM nodes, Queue run history, Direct Work raw events,
   Agent Activity events, or transcript buckets grow without operator activity.

## Known Limitations

- This record does not include a passing long-session smoke result yet.
- Diagnostics are dev-only and may not expose heap values in every browser or
  WebView runtime.
- The diagnostics panel itself retains a bounded sample list while enabled, so
  it should be considered an investigation aid rather than production
  observability.
- The Queue helper fix reduces one repeated-refresh state churn path; it does
  not prove there are no other render loops, retained event buffers, or widget
  lifecycle leaks.
- APP-RECOVERY-01 still needs separate manual confirmation for refresh/crash
  orientation. APP-OOM-01 should not be closed only because recovery is
  acceptable after reload.

## Next Blocks If Memory Grows Again

- Capture before, during, and after diagnostics snapshots from the same
  Workspace and note exact elapsed time, visible widgets, and operator actions.
- Compare retained buckets first: Queue run history, Queue raw events, Agent
  Activity events, Direct Work retained character count, Workspace Agent
  transcript count/characters, Knowledge retained count, and Finder preview
  content length.
- Re-run the idle smoke with only Workspace Agent plus Notes, then add one
  surface at a time to isolate the retaining surface.
- If Queue buckets grow while idle, inspect Queue run metadata refresh,
  current-session run activity retention, and Agent Activity merge behavior.
- If DOM nodes grow while visible widget count is stable, inspect mount/unmount
  effects and interval cleanup for the active Workbench surface.
- If heap grows while buckets and DOM are stable, use browser/WebView heap
  profiling in the same scenario and attach the copied diagnostics snapshots to
  the follow-up block.

## Intentionally Not Implemented

- No frontend behavior changes.
- No backend, Tauri, storage, or schema changes.
- No new diagnostics runtime behavior.
- No new recovery behavior.
- No Stable v0.1 acceptance status change.
