# Workspace Agent V2 Direct Run Requirements

## Purpose

This document defines requirements for a future Workspace Agent V2 Direct Run
surface.

It is docs-only requirements. It does not add frontend behavior, backend or
Tauri commands, provider adapters, storage/schema changes, filesystem
mutation, validation automation, Git mutation, Queue execution, or any current
runtime behavior.

Workspace Agent V2 Direct Run is an explicit operator-controlled run flow from
the Workspace Agent surface. It executes the selected provider in the chosen
working directory under the operator-selected sandbox, tool policy, and
approval policy.

## Product Boundary

Direct Run must preserve Hobit's Workbench-first and operator-controlled model:

- Workspace Agent remains the foreground operator-facing AI surface.
- The operator chooses the provider, model/reasoning setting, working
  directory, sandbox, tool policy, approval policy, visible context, and run
  launch.
- The provider may act only within the explicit sandbox and tool policy chosen
  for that run.
- Direct Run must be visible, cancellable where supported, observable, and
  reviewable.
- Direct Run must not become hidden automation, hidden context access, hidden
  mutation, automatic Queue dispatch, or a generic terminal/script runner.

## Preflight Requirements

Before launch, Direct Run must show a preflight summary with:

- selected provider and provider kind
- selected model and reasoning setting, when supported by the provider
- chosen working directory / `cwd`
- sandbox mode and effective filesystem boundary
- tool policy, including allowed tools or an explicit no-tools state
- approval policy and whether any tool/file actions require confirmation
- visible context that will be sent to the provider
- excluded context, including hidden widget state, hidden files, logs, secrets,
  and unapproved Workspace data
- caps, including prompt/context caps, output caps, runtime caps, file/diff
  caps, and validation-output caps where available
- warnings, including unsupported cancellation, dirty working tree, unsafe
  sandbox choice, missing validation, unavailable diff detection, provider
  configuration gaps, or unsupported tool policy

The preflight must be reviewable before the run starts. Launching a Direct Run
is a separate explicit operator action.

## Execution Requirements

Direct Run executes the selected provider in the chosen working directory.

Rules:

- The working directory must be explicit and visible.
- The provider/runtime boundary owns execution; frontend code must not call
  provider APIs or local processes directly.
- The exact provider/runtime mode and effective policy must be visible in run
  metadata.
- Provider execution must use only the visible context approved for that run.
- File edits, command execution, network access, or other tools are allowed
  only when explicitly enabled by the run's sandbox/tool policy.
- If the tool policy is empty, Direct Run is text-only and must not mutate
  files, run commands, or call widget capabilities.
- If tools are enabled, every tool class and approval requirement must be
  visible before launch.
- Direct Run must not silently widen sandbox access, tool access, context, or
  approval scope after launch.

## Lifecycle States

Direct Run must expose a clear lifecycle:

- `preparing`: collecting preflight settings and checking run readiness.
- `context_materialized`: visible context has been assembled and capped for
  the provider.
- `running`: provider execution is active.
- `waiting`: the run is waiting for provider output, operator approval, tool
  approval, cancellation acknowledgement, or another explicit dependency.
- `completed`: provider execution finished and result/action cards are ready
  for review.
- `failed`: provider execution or required run infrastructure failed.
- `cancelled`: the operator cancelled the run and the provider/runtime
  confirmed or best-effort stopped execution.
- `timed_out`: the configured runtime timeout was reached.

The UI may display friendlier labels, but the underlying meaning must remain
unambiguous. Failure, cancellation, timeout, and waiting states must not be
presented as success.

## Cancellation Requirements

Direct Run supports cancel where the selected provider/runtime supports it.

Rules:

- The preflight and running view must clearly state whether cancellation is
  supported.
- Cancel must be an explicit operator action.
- If cancellation is unsupported, the UI must not show fake cancellation.
- If cancellation is best-effort, the UI must say so and continue showing the
  final observed state.
- Cancellation must not discard transcript metadata, partial result metadata,
  warnings, or known file-change state.

## Change And Validation Review

Where available, Direct Run must detect and summarize file changes after the
run.

Expected review outputs:

- changed file count and path summary
- diff summary or bounded diff references when available
- created/modified/deleted/renamed classification when available
- dirty-tree warning when the working directory already had changes
- validation suggestions based on changed files, project type, or operator
  request where available
- captured validation results only when validation was explicitly run or
  provided by the runtime

Rules:

- Diff detection is read-only.
- Validation suggestions are suggestions, not proof that validation ran.
- Failed, skipped, unavailable, or partial validation must be visible.
- Direct Run must not stage, commit, push, reset, clean, stash, restore, or
  discard changes.

## Transcript And Result Requirements

Direct Run must show transcript metadata and reviewable outputs.

Transcript metadata should include:

- run id
- Workspace and Workspace Agent widget identity
- provider and model/reasoning selection
- working directory
- sandbox, tool policy, and approval policy
- visible context summary and caps/warnings
- started/completed timestamps and duration when available
- lifecycle status
- cancellation, timeout, and error metadata when applicable

Result surfaces should include:

- assistant/result text
- lifecycle and warning cards
- file-change or diff-summary cards where available
- validation suggestion/result cards where available
- action cards for proposed follow-up actions
- raw/details view only behind explicit inspection when available

Action cards must be proposals or review surfaces unless the operator performs
a separate explicit allowed action.

## Edit And Tool Policy Requirements

Direct Run allows edits only through the explicit sandbox and tool policy.

Rules:

- No file edit may occur unless the selected provider/runtime has an explicit
  edit-capable tool policy and sandbox allowing it.
- No command may run unless the selected provider/runtime has an explicit
  command-capable tool policy and sandbox allowing it.
- No widget capability, Terminal control, JDBC execution, Git mutation, Queue
  dispatch, or Notes/Knowledge mutation may occur unless a later contract
  explicitly defines that action and the operator approves it.
- Approval decisions apply only to the current run/action scope and must not
  silently persist as broader future permission.
- Tool output that may contain secrets or sensitive data must be capped and
  surfaced with warnings where applicable.

## Non-Automation Requirements

Direct Run must never:

- auto-commit
- auto-push
- auto-finalize Queue tasks
- automatically accept its own results
- automatically create Queue tasks
- automatically apply follow-up action cards
- mutate Git outside a separately approved explicit Git action
- read hidden Workspace/widget/file context
- rerun silently
- broaden sandbox, tool, approval, provider, model, or working-directory scope
  without another explicit operator action

## Relationship To Current Contracts

This requirements document must preserve:

- `docs/CURRENT_WIDGET_SURFACE.md` for current implemented behavior.
- `docs/AI_INTEGRATION_READINESS_CONTRACT.md` for explicit visible context,
  backend-owned provider boundaries, and no hidden tool execution unless later
  contracts explicitly allow it.
- `docs/DIRECT_MODE_AGENT_CONTRACT.md` for explicit working-directory,
  sandbox, approval, observability, changed-file review, and no auto-commit or
  auto-push rules.
- `docs/AGENT_RUN_OBSERVABILITY_CONTRACT.md` for raw/details, overview, and
  result-review expectations.

If implementation work follows this document later, that work must still read
the then-current active contract index and the relevant task-specific
contracts before changing code.

## Non-Goals

This document does not implement or require:

- source code changes
- frontend UI changes
- backend or Tauri command changes
- storage or schema changes
- new provider integration
- provider tool calling by default
- automatic validation execution
- Git mutation
- Queue execution or finalization
- Terminal integration
- JDBC execution
- hidden context access
- commit or push behavior
