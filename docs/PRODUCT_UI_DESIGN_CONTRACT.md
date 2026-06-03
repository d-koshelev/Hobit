# Product UI Design Contract

## Purpose

This contract defines Hobit's product UI information hierarchy so production
surfaces stay operator-facing and debug information does not leak into normal
use.

It is a docs/contracts-only product contract. It does not implement frontend
UI, CSS, layout behavior, runtime behavior, backend commands, Tauri commands,
storage/schema changes, widget behavior, Queue execution, Agent Executor
behavior, Git behavior, Terminal behavior, or new widgets.

Future UI implementation must also preserve `docs/UI_CONTRACT.md`,
`docs/PRODUCT_UI_VISUAL_CONTRACT.md`, and
`docs/WIDGET_PROGRESSIVE_DISCLOSURE_CONTRACT.md`. This document governs what
information belongs in primary production UI, secondary supporting UI, and
developer-only detail surfaces.

## Product Rule

The primary UI is for the operator's work, not for implementation inspection.

Production UI must answer:

- Where am I?
- What am I working on?
- What is the current state?
- What decision or action is available now?
- What happened after the last action?

Raw implementation details may exist for troubleshooting, but they must not be
the default product experience.

## Primary UI

Primary UI is the always-visible production surface for a widget, rail, header,
list row, table row, status line, or action area.

Primary UI should include:

- Product names and operator-facing labels.
- Current object identity, such as selected Workspace, widget, Queue task,
  note, repository root, terminal session, or run summary.
- Semantic status, such as Ready, Preview, Running, Needs approval, Completed,
  Failed, Blocked, Cancelled, Not configured, Unsupported, Dirty, Clean, Passed,
  or Skipped.
- The next explicit operator action.
- Short outcome summaries.
- Bounded error summaries with an actionable next step.
- Approval state and risk when an action can mutate, execute, persist, or
  publish anything.

Primary UI must not include:

- Raw JSON payloads.
- Stack traces.
- Tauri command names.
- Rust, TypeScript, React, Vite, SQLite, or provider-internal identifiers.
- Internal enum names such as `isLoading`, `pendingPromise`, `undefined`,
  `null`, `mock`, or `debug`.
- Database primary keys, run IDs, widget instance IDs, thread IDs, or event IDs
  unless the user explicitly opens a detail surface.
- Full command output, raw logs, raw diffs, raw provider payloads, or raw
  persisted state blobs.
- Future capabilities that are not implemented and contract-gated.

Primary UI may mention that a capability is Preview, Unsupported, Not
configured, or unavailable. It must not require raw logs or developer-only
details to understand that state.

## Secondary UI

Secondary UI supports product decisions without taking over the primary
surface.

Appropriate secondary UI includes:

- Collapsed details panels.
- Details drawers.
- Widget-local tabs.
- Compact history sections.
- Summary cards for selected items.
- Validation summaries.
- Diff summaries.
- Run summaries.
- Bounded log excerpts when logs are the relevant product object.

Secondary UI may include technical information when it helps the operator make
a decision, but it must be curated and labeled in product language.

Secondary UI rules:

- Keep it out of the first visual priority unless the selected workflow needs
  it.
- Prefer summaries before raw output.
- Keep long output scrollable, collapsed, tabbed, or otherwise bounded.
- Do not duplicate another widget's primary responsibility.
- Do not turn a widget into a generic debug console.
- Do not make secondary UI the only place where failure, blocked, approval, or
  running state is visible.

Examples:

- A Queue task row shows semantic status in primary UI; the selected-task rail
  may show recent run summaries in secondary UI.
- Agent Executor may show a final response and changed-file summary before raw
  event output.
- Git may show changed-file and diff summaries before raw patch detail.
- Terminal output can be primary because terminal output is the product object.

## Developer Details

Developer details are troubleshooting surfaces for maintainers and advanced
diagnosis. They are not production primary UI.

Developer details include:

- Raw logs and event streams.
- Stack traces.
- Raw JSON, request, response, and persisted state payloads.
- Internal IDs.
- Timing traces.
- Backend command names.
- Frontend component, hook, or store names.
- Provider metadata that is not needed for operator review.
- Debug-only flags and environment-specific diagnostics.

Developer details rules:

- Hide by default behind an explicit `Developer details`, `Raw details`, or
  equivalent disclosure.
- Label the surface honestly as diagnostic or raw.
- Keep copy/export affordances explicit when useful.
- Never require developer details to complete ordinary product work.
- Never use developer details as the only explanation for an error.
- Never place developer details in empty states, primary status chips, normal
  list rows, or top-level widget headers.
- Do not expose secrets, credentials, tokens, environment variables, or private
  paths beyond what the product contract for that surface explicitly allows.

Developer details are allowed when they help support, debugging, or local
development, but the surrounding product UI must remain understandable without
opening them.

## Queue Right Rail Contract

The Agent Queue right rail is a selected-task product detail and decision
surface. It is not a debug inspector and not a hidden Agent Executor console.

Primary rail content should include:

- Selected task title.
- Semantic task status.
- Assignment state.
- Execution policy or runner state only when relevant to the selected task.
- Current operator decision or next explicit action.
- Latest run outcome summary when available.
- Review, blocked, failed, completed, or cancelled state when applicable.

Secondary rail content may include:

- Short task description.
- Task notes.
- Recent run-link history.
- Validation summary.
- Compact handoff or result summary.
- Bounded timestamps and durations.
- Explicit links or controls that open the supporting Agent Executor detail
  surface when that behavior exists.

Developer-only rail content must be collapsed or hidden by default:

- Queue item IDs.
- Executor run IDs.
- Widget instance IDs.
- Raw runner events.
- Raw Agent Executor logs.
- Raw prompt payloads.
- Raw state patches.
- Backend command names.

Queue right rail rules:

- The rail must keep the selected task and next operator action obvious.
- The rail must not imply automatic acceptance, hidden execution, hidden
  scheduling, Git mutation, Terminal launch, or Workspace Agent tool use.
- Queue Autorun or runner state must be described as operator-armed,
  current-session, and bounded when shown.
- Run history in the rail is a product summary and navigation aid, not a raw
  log dump.
- If the selected task has no runs, show an honest empty state instead of raw
  internal state.
- If run details are unavailable, say so in product language and keep raw IDs
  out of primary UI.

## State Semantics

Visible state must describe product meaning, not implementation mechanics.

Use semantic state labels when possible:

- `Ready`: configured enough for the next normal action.
- `Preview`: intentionally limited product surface.
- `Running`: active work is in progress now.
- `Needs approval`: operator approval is required before action proceeds.
- `Blocked`: progress requires user input, configuration, or external change.
- `Completed`: work finished successfully.
- `Failed`: work finished with an error or failed result.
- `Cancelled`: work was intentionally stopped before completion.
- `Timed out`: work exceeded its allowed time.
- `Not configured`: required operator configuration is missing.
- `Unsupported`: the environment cannot perform the capability.
- `Dirty`: uncommitted or unsaved changes exist.
- `Clean`: no relevant changes are present.
- `Passed`: validation or check passed.
- `Skipped`: validation or check was intentionally not run.

Avoid exposing implementation states in production UI:

- `loading=false`
- `error=null`
- `result=undefined`
- `mock`
- `dev`
- `hydrating`
- `pendingPromise`
- `mutation pending`
- `backend unavailable` without product context

State rules:

- A failed operation is not the same as an app crash.
- Unsupported environment is not the same as failure.
- Missing configuration is not the same as failure.
- Preview is not the same as disabled.
- Skipped validation is not the same as passed validation.
- Running state must identify what is running when practical.
- Blocked state must identify what input or condition is needed.
- Error state must give a short product explanation before any raw diagnostic
  detail.

## UI Review Checklist

Use this checklist before accepting production UI changes:

- Primary UI tells the operator where they are, what is selected, current
  state, next action, and latest outcome.
- No raw JSON, stack trace, internal ID, backend command, component name, or
  state blob appears in default production UI.
- Debug and raw diagnostic information is hidden behind explicit developer
  details.
- Secondary UI summarizes before showing raw output.
- Status chips use semantic product language, not implementation flags.
- Empty, loading, error, unsupported, not configured, blocked, and failed states
  are distinct and understandable.
- Approval and mutation risks are visible before execution or persistence.
- Queue right rail shows selected-task product detail and decision state, not a
  debug inspector.
- Future, deferred, compatibility, or unimplemented capabilities are not shown
  as available.
- Long logs, diffs, command output, and raw payloads are bounded, collapsed,
  tabbed, or scrollable.
- Product UI remains understandable without opening developer details.
- Secrets, credentials, tokens, and unnecessary private paths are not exposed.

## Non-Goals

This contract does not implement:

- Frontend changes.
- CSS changes.
- New components.
- New widget behavior.
- New Queue behavior.
- New Agent Executor behavior.
- New runtime behavior.
- New Tauri commands.
- Storage/schema changes.
- New validation tooling.
