# Script Runner Widget Contract

## Purpose

This contract defines the future Script Runner Widget for Hobit.

Script Runner is a configured, operator-controlled widget for running an explicit local script with reviewable configuration. It exists to make a narrow script action repeatable, visible, logged, and auditable inside the Workbench.

This is a documentation and product/domain contract only. It does not implement UI, backend execution, Tauri commands, storage, process spawning, script runtime behavior, or an insertable catalog path.

## Current Status

There is no Script Runner Widget today.

The frontend Widget Catalog may list Script Runner as a planned/display-only item to expose the future direction. That catalog item is not insertable and does not create a WidgetInstance, configuration UI, Run button, backend call, storage record, or script runtime behavior.

The current repository has no general command or script execution runtime. The Terminal widget has a bounded desktop-only one-shot command form for persisted Terminal widget instances, but no shell mode, interactive terminal, streaming, PTY, cancellation, command history, or Script Runner behavior. Agent Chat is static. Agent Monitoring is a static observability preview for future Agent Run concepts. Git has only a manual desktop-only read-only status refresh for an explicit transient repository root.

Any future Script Runner implementation must preserve Hobit's rule that tools and actions are explicit, visible, and approval-aware. Script Runner must not make Hobit a script executor as a product category.

## Definition

Script Runner is a WidgetDefinition for one configured local script action.

It is:

- a first-class Workbench widget
- configured by explicit script path, working directory, arguments, and execution limits
- started only by an explicit operator Run action
- repeatable and reviewable before each run
- observable through widget-local logs and structured results
- eligible to align with Raw Log, Overview Log, and Result Report concepts

It is not:

- a general interactive terminal
- a shell prompt
- hidden automation
- an agent deciding to execute arbitrary commands
- a runbook engine
- a scheduler or cron system
- a remote execution system
- a way to bypass operator approval for risky tool actions

## Difference From Terminal

Terminal and Script Runner are separate capabilities.

Terminal is a future interactive session surface. It is command-oriented and may expose shell/runtime state when explicitly implemented.

Script Runner is a configured action surface. It runs one known local script path with explicit arguments and an explicit working directory after the operator presses Run. It is easier to review and audit because the executable, arguments, environment summary, limits, and result are visible as a bounded action.

Script Runner must not become a disguised terminal input box. It must not accept arbitrary command snippets as its first implementation model.

## Core Configuration

A future Script Runner widget configuration should include:

- `displayName`: operator-visible name.
- `description`: concise purpose and expected use.
- `scriptPath`: explicit local script or executable path.
- `workingDirectory`: explicit or clearly defaulted working directory.
- `arguments`: argv array, with one argument per entry.
- `environment`: optional explicit environment variable entries.
- `secretReferences`: optional future references only, not raw secret values.
- `timeout`: required maximum run duration.
- `outputCap`: required output size cap for captured stdout/stderr.
- `runProfile` or `permissionProfile`: optional future permission profile.
- `riskLabel` or `dangerLevel`: optional risk label for operator review.
- `enabled`: disabled/enabled state for the configured action.

These fields are conceptual only. This contract does not define Rust types, TypeScript types, DTOs, storage schema, or current widget state.

## Script Path Rules

The script path must be explicit.

Rules:

- No hidden script discovery.
- No first-implementation PATH-based implicit script selection unless explicitly designed in a later contract update.
- No shell string concatenation.
- No automatic script execution on widget load.
- No automatic script execution after configuration changes.
- No background execution in the initial model.
- Future file picker support may help select a script, but the selected path must remain visible and operator-approved.
- Platform-specific execution semantics for Windows, Linux, and macOS must be designed explicitly before implementation.

If a future implementation supports interpreter-bound scripts, such as shell scripts or PowerShell scripts, the interpreter model must be explicit and reviewable. It must not be inferred through hidden shell invocation.

## Arguments Model

Arguments must be modeled as an argv array.

Rules:

- Each argument is a separate value.
- Arguments must not be joined into a shell string.
- The UI should show each argument separately or as reviewable tokens.
- Future variable substitution must be explicit and previewable.
- There must be no hidden Workspace context injection into arguments.
- There must be no secret injection unless a future secret-reference model is explicitly designed.

The review surface must show the effective argument list before execution.

## Working Directory Model

The working directory must be explicit or clearly defaulted.

Rules:

- The selected working directory must be visible to the operator.
- No hidden Workspace-wide scanning.
- No hidden parent traversal.
- No automatic repository discovery.
- Path handling must be careful on Windows, Linux, and macOS when implemented.
- A missing or inaccessible working directory must produce a visible typed error.

If a Workspace later stores Script Runner configuration, that configuration is Workspace/widget-scoped and must not silently follow unrelated Workspaces.

## Run Behavior

A script run happens only when the operator presses an explicit Run button.

Before running, the widget should show:

- script path
- working directory
- arguments
- environment summary
- timeout
- output cap
- risk or safety notes

Rules:

- Script Runner must never auto-run as part of Workspace restore.
- Script Runner must never auto-run because configuration changed.
- Future approval flow may require an additional confirmation for dangerous scripts.
- The Run action should be disabled when required configuration is missing or invalid.
- Runs should be cancellable when possible.
- Each run should produce status, exit code when available, duration, and a result summary.
- Errors must be visible and must not be swallowed.

Suggested conceptual run statuses:

- idle
- not_configured
- ready
- waiting_for_approval
- running
- completed
- failed
- timed_out
- cancelled
- needs_review

## Output, Logs, And Results

Script Runner should expose three linked views when it runs:

- Raw Log: stdout, stderr, exact execution output, timestamps, cancellation, timeout, and raw process events.
- Overview Log: high-level run steps such as preparing script, starting process, streaming output, completed, failed, cancelled, or timed out.
- Result Report: final status, exit code, duration, validation or result summary when available, warnings, and next actions.

This model aligns with `docs/AGENT_RUN_OBSERVABILITY_CONTRACT.md`.

Script Runner is still a tool/widget action, not necessarily an AI agent run. Agent Run observability concepts may be reused for task execution visibility without making the script run an agent run.

## Widget-Local Logs And Structured Results

Script runs should emit widget-local logs.

Requirements:

- Each run should have an identifiable run id.
- Raw stdout and stderr should be captured separately when possible.
- Captured output must respect output caps.
- Structured result should include run id, status, exit code when available, duration, summary, warnings, and typed error when relevant.
- Future run history may be shown in the widget.
- Workspace Activity may summarize script lifecycle events.

Widget-local logs are not a substitute for the structured result. The operator must be able to tell whether a run passed, failed, timed out, or was cancelled without reading all raw output.

## Safety Boundaries

Script execution is powerful and risky. Future implementation must preserve these boundaries:

- No hidden execution.
- No automatic execution.
- No arbitrary command prompt.
- No shell string concatenation.
- No destructive action without operator confirmation.
- No background unattended execution initially.
- No network or remote execution unless explicitly designed later.
- No secret exposure in logs, prompts, previews, or results by default.
- Output caps are required.
- Timeouts are required.
- Cancellation should be planned before broad execution support.
- Permission profiles should be considered before broad execution support.
- Errors must be visible and not swallowed.

Script Runner should assume that scripts can mutate local files or external systems. Risk labels, confirmations, and permission profiles should be designed before expanding beyond narrow explicit local scripts.

## Future Execution Adapter Principles

If Script Runner is implemented with process execution, the adapter should:

- use `std::process::Command` or an equivalent safe process API
- pass the executable/script path and args separately
- avoid invoking a shell by default
- set `current_dir` explicitly
- set environment variables explicitly
- enforce timeout
- enforce output caps
- capture stdout and stderr separately
- return typed errors
- avoid unbounded streaming or buffering
- avoid arbitrary shell snippets in the first implementation

Execution adapter code must live behind the appropriate Rust/tool/application boundaries. `hobit-core` should remain pure domain contracts and must not depend on Tauri, React, SQLite, or frontend code.

## Future Typed Errors

Future implementation should use typed errors rather than opaque strings where practical.

Suggested error categories:

- not configured
- script path empty
- script not found
- permission denied
- working directory missing
- invalid arguments
- timed out
- cancelled
- output too large
- non-zero exit
- spawn failed
- non-UTF8 output when relevant
- unknown failure

Typed errors should render as operator-visible status and be available to widget-local logs, structured results, and Workspace Activity summaries when implemented.

## UI Direction

Script Runner UI must follow `docs/UI_CONTRACT.md`, `docs/WIDGET_CONTRACT.md`, and `docs/DESIGN_SYSTEM_CONTRACT.md`.

Full view should show:

- configuration fields
- visible Run button
- pre-run review summary
- last result
- Raw Log, Overview Log, and Result Report views or tabs
- bounded run history later

Compact view should show:

- script name
- last status
- Run button when safe
- last duration and exit code when available

Indicator view should show:

- script name
- status badge
- last result or running/error indicator

Future Dock behavior:

- Script Runner in Indicator view should show concise status only, such as `Idle`, `Running`, `Failed`, `Passed`, or `Needs review`.
- Dock status must not trigger hidden script execution, refresh, mutation, or approval bypass.

## Relationship To Agent Queue

Agent Queue may later reference Script Runner actions as operator-approved tools.

A Queue Item may ask the operator to run a configured script. Script execution results may become artifacts or validation evidence. Agent Queue must not silently run scripts without operator approval.

Script Runner remains the execution/review surface for the script action. Agent Queue remains the command queue, history, and review inbox for agent work.

## Relationship To Agent Run

A script run can be represented using Agent Run observability concepts:

- Raw Log
- Overview Log
- Result Report

Script Runner itself is a tool/widget action, not necessarily an AI agent run. The Result Report for a script run should not be confused with an executor final response unless a future Queue Item explicitly links them.

## Relationship To Notes And Notebook

Notebook may document script usage, parameters, output interpretation, or follow-up notes.

Notebook must not auto-run scripts from code blocks. Any future "run script from note" action must go through Script Runner or another approval-gated execution widget.

## Relationship To Git Widget

If a script modifies repository files, Git Widget can help review changes afterward.

Script Runner should not silently commit, stage, push, reset, clean, stash, or discard changes. Git mutations remain separate approval-gated actions in the relevant future Git surface.

## Relationship To Workspace

Script Runner configuration is widget/Workspace-scoped when persistence is implemented.

Rules:

- Different Workspaces should not accidentally share configured script paths, arguments, environment entries, run history, or results.
- Multi-workspace isolation applies.
- Script paths may be machine-specific and should be treated carefully if a Workspace is moved or shared.
- Workspace Activity may summarize lifecycle events, but the Script Runner widget owns detailed script configuration, logs, and results.

## Future Persistence

First implementation may start with transient/local configuration or widget state.

If Script Runner configuration is persisted:

- persisted configuration must be reviewable
- persisted configuration should not include raw secrets
- future secrets must be stored as references, not values
- run history persistence must be bounded
- stored output must respect output caps and sensitive-data policy
- Workspace restore must not start a script run

Persisted Script Runner state must not introduce schema, API, or runtime behavior without an explicit implementation block.

## Non-Goals

This contract does not implement:

- Script Runner UI
- backend execution
- Tauri commands
- Workspace API changes
- storage schema or migrations
- process spawning
- shell execution
- Terminal runtime
- Agent Chat runtime
- Agent Run runtime
- Agent Queue execution
- insertable widget catalog path
- widget runtime behavior
- secret management
- unattended execution
- scheduling or cron
- remote execution
- network execution
- Git mutations
- current product behavior changes

## Architecture Boundary

Future implementation must preserve existing Hobit boundaries:

- Workbench remains the product center.
- Script Runner is an optional widget/capability, not the product category.
- Tools and actions remain explicit, visible, and approval-aware.
- Agent proposes; operator controls.
- Widgets communicate through Workbench state and events, not direct coupling.
- Script execution must not create a hidden automation path.
