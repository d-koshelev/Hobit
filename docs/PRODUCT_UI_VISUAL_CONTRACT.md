# Product UI Visual Contract

## Purpose

This contract defines Hobit's product UI visual direction so future UI polish
blocks converge on one visual system instead of adding ad-hoc styling per
screen or widget.

It is a docs/contracts-only product contract. It does not implement frontend
UI, CSS, layout behavior, grid snapping, runtime behavior, backend commands,
Tauri commands, storage/schema changes, widget behavior, Git mutation,
Terminal PTY behavior, Notes storage, Queue execution, or new widgets.

Future implementation must preserve `docs/DESIGN_SYSTEM_CONTRACT.md`,
`docs/UI_CONTRACT.md`, `docs/WIDGET_CONTRACT.md`, and
`docs/WIDGET_PROGRESSIVE_DISCLOSURE_CONTRACT.md`. This document narrows those
contracts into the target product look and interaction rules for the current
Workbench direction.

## Product UI Principles

- Hobit is an engineering workbench.
- The canvas is the primary workspace.
- Widgets are independent work surfaces.
- UI should be dense but readable.
- Chrome should be minimal.
- Controls should be visible only when useful.
- No fake future functionality should be shown as working.
- Preview widgets must look intentionally limited.

The product should feel like a precise dark operator workbench, not an IDE
clone, generic dashboard, terminal wrapper, chat app, runbook runner, hidden
automation shell, or demo page.

## Stable v0.1 Product Surface

The Stable v0.1 product-facing widgets are:

Core dogfooding loop:

- Workspace Agent
- Agent Queue

Ready / MVP capabilities:

- Terminal
- Agent Activity
- Notes
- Knowledge / Skills

Preview:

- Database / JDBC
- Runbook

Required gap:

- Finder, not implemented yet

Supporting / compatibility surfaces:

- Agent Executor, for Direct Work runtime detail and diagnostics
- Git, for explicit repository review/control

Old or future surfaces such as Agent Chat, Agent Monitoring, Template Library,
Dock, Agent CLI, Script Runner, JIRA, Confluence, Image Edit,
separate legacy Coordinator previews, and Validation must not appear as current
product surfaces unless a later block explicitly reintroduces them under the
relevant contract.

## Canvas Visual Direction

The Workbench canvas should be the visual center of Hobit.

Target direction:

- Use a dark workbench canvas.
- Use a subtle dotted background.
- Dots should align to the layout grid.
- The dotted background is not decoration only; it communicates placement,
  scale, and future layout snapping.
- Canvas padding should be minimal.
- The canvas should feel like the main workspace, not a card inside a page.
- The outer frame should be subtle.
- Avoid large empty chrome around the canvas.
- Avoid page-section styling that makes the Workbench look like a dashboard
  panel.

The dotted grid should become part of the real layout system in a later
implementation block. Until grid snapping is implemented, the UI must not imply
that snapping already exists.

## Grid And Layout Direction

Future layout work should use a single product grid step for outer widget
geometry.

Future rules:

- Widget x position snaps to the grid step.
- Widget y position snaps to the grid step.
- Widget width is a multiple of the grid step.
- Widget height is a multiple of the grid step.
- Resize snaps to the grid step.
- Minimum widget sizes are multiples of the grid step.
- Internal widget padding may use smaller spacing tokens.
- Outer widget geometry follows the grid.

The grid step should be a design-system/layout token or equivalent shared
primitive when implemented. Widget internals do not need to expose every small
spacing value on the same grid; the rule is specifically about canvas geometry.

Do not implement these rules in this block. Grid snapping and grid-backed
layout behavior belong in Block 179 or later.

## Top Bar Direction

The Workbench top bar should be thin and quiet.

Rules:

- The top bar should not dominate vertical space.
- Only core workspace actions should appear in the top bar.
- Future polish should reduce top bar height.
- Actions should be compact.
- Workspace identity should be clear but not oversized.
- The top bar may show product status.
- Product status must not turn the top bar into a dashboard.
- The top bar must not become a hidden run launcher, Queue scheduler, Git
  automation surface, or global command center.

Appropriate top bar content includes workspace identity, core navigation,
layout mode, Add Widget, and compact current-session/product status when it is
honest about what is observed.

## Widget Card Direction

Widgets should share one product-grade card language.

Target direction:

- Dark glass-like panel.
- Subtle border.
- Soft shadow or glow.
- Consistent border radius.
- Header with title, status badge, and compact actions.
- Body with consistent padding.
- Footer or status line only when useful.
- Internal scroll where needed.
- Clear empty, loading, and error states.
- No excessive nested cards.
- No detached toolbar-like widget headers.

The glass-like direction means a dark raised surface with restrained
translucent or reflective feel when supported by tokens. It does not authorize
random blur effects, gradients, raw colors, or one-off per-widget visual
language.

Widget header, body, and optional footer must read as one continuous work
surface. The header is the top meta zone of the widget, not a separate block.

## Color System Direction

Colors communicate semantic state and must stay consistent.

Target semantic colors:

- Primary blue for main action.
- Green for success, passed, or completed.
- Red for failed, destructive, or stop.
- Amber for warning, attention, or blocked.
- Muted gray for inactive or secondary.
- Purple may be used for preview, agent identity, or provider identity.

Rules:

- Avoid random one-off colors.
- Do not use raw colors outside token/theme/style files.
- Use semantic design-system variables for components and widgets.
- Do not create a separate palette per widget.
- Do not use gradients in the base product UI.
- Do not make every surface read as one saturated hue family.

If a new semantic color is needed, update the design-system contract and theme
tokens before using it in product UI.

## Typography And Spacing

Typography and spacing should support repeated engineering work.

Rules:

- Use compact but readable typography.
- Maintain a clear title hierarchy.
- Use monospace only for Terminal, logs, code, command output, hashes, and
  paths.
- Use a consistent spacing scale.
- Tables should use compact row height.
- Forms should have consistent labels, help text, and errors.
- Long technical output should be behind details, tabs, or scrollable areas.
- Avoid dense walls of copy in default widget views.
- Avoid oversized marketing-style headings inside Workbench or widget surfaces.

Technical precision is allowed. Unstructured visual noise is not.

## Status Chips And Badges

Status chips and badges should be small, consistent, and color-coded by
semantic state.

Standard status language:

- Ready
- Preview
- Running
- Idle
- Completed
- Failed
- Cancelled
- Blocked
- Dirty
- Clean
- Passed
- Timed out
- Not configured
- Unsupported

Status wording should be plain and operator-facing. Widgets may add specialized
status detail, but the visible chip language should remain aligned with these
shared terms when possible.

## Buttons And Actions

Action styling must reflect action risk and importance.

Rules:

- Primary action uses blue.
- Danger action uses red.
- Secondary actions are muted.
- Destructive actions require confirmation.
- Disabled controls should explain why when practical.
- Do not show disabled future controls unless they clarify product state.
- Prefer hiding future controls over showing noisy disabled controls.
- Stop, cancel, delete, discard, reset, clean, push, and destructive Git actions
  must not be visually understated.
- Actions that execute, mutate, or persist state must be explicit and visible.

Future controls must not appear active until the backing behavior, contract,
and safety boundary exist.

## Tabs And Sections

Tabs are appropriate inside complex widgets when they reduce clutter.

Rules:

- Tabs are appropriate inside complex widgets such as Agent Executor and Git.
- Tabs should not overflow badly in small widget sizes.
- Important status should remain visible even when tabs change.
- Details and raw sections should be collapsed by default.
- Tab labels should be short.
- Tabs must not hide failure, running, blocked, dirty, or validation states.

Tabs organize a widget's own work surface. They must not turn one widget into a
container for unrelated widget responsibilities.

## Tables And Lists

Tables and lists should be compact and readable.

Appropriate uses:

- Agent Queue task tables.
- Git changed files.
- Agent Executor run history.
- Validation command summaries.
- Terminal or Agent history when implemented.

Rules:

- Tables should have compact rows.
- Status chips in rows should be clear.
- Overflow should be handled with scroll or compact details.
- Do not show huge raw payloads in main rows.
- Keep row actions compact and contextual.
- Show the current operator decision point clearly.

Raw JSON, raw logs, full diffs, and long command output belong in details,
dedicated tabs, or scrollable output areas, not in the main table row.

## Logs And Terminal Output

Logs should be useful to the operator before they are useful to debugging.

Rules:

- Agent Executor live log is not raw debug by default.
- Logs should show operator-facing messages first.
- Raw events stay in details.
- Timestamps and durations should be readable.
- Failed, timed out, cancelled, and blocked states should be visible without
  scanning raw output.
- Terminal output may use monospace and dense layout because output is the
  primary surface.

Terminal target direction is a real shell widget with tabs and split panes
later. The current PTY-first Terminal must not imply event-streamed output,
tabs, split panes, persistent shell history, environment profile support, or
Agent/Queue/Coordinator control until those capabilities are contract-gated and
implemented.

## Widget-Specific Visual Direction

### Agent Executor

Agent Executor is a supporting execution-detail and diagnostics surface, not a
Stable v0.1 product widget. Queue owns the product-facing execution management
loop.

Target direction:

- Show execution status clearly in the header.
- Use tabs for live log, final response, changed files, diff summary,
  validation, and run history when the surface reaches the appropriate
  maturity.
- Keep Stop run visible only while a run is running.
- Show the review package after completion.
- Make failed, cancelled, timed out, validation failed, validation skipped, and
  dirty Git review states visible.
- Show the selected execution workspace boundary. Repository root is the
  current Git-capable workspace kind, not the whole product model.
- Keep advanced executor settings compact or behind details.

Validation belongs inside Agent Executor as part of run review and result
quality. It is not a separate current widget.

### Git

Git is a supporting visual review and explicit local commit surface, not a
Stable v0.1 product widget.

Target direction:

- Show repository root.
- Show branch.
- Show ahead/behind when available.
- Show clean or dirty status.
- Show changed files.
- Show diff summary.
- Show validation status if available.
- Show a commit panel when explicit commit UI is implemented.
- Do not show push controls until push has a contract, API, and UI.

Git must remain approval-aware. It must not auto-stage, auto-commit, auto-push,
reset, clean, stash, or mutate repositories without explicit operator action.

### Terminal

Terminal is the explicit operator command surface. A fuller shell with tabs
and split panes remains future work.

Rules:

- PTY behavior is contract-gated by
  `docs/TERMINAL_PTY_WIDGET_CONTRACT.md`.
- PTY/session behavior must be contract-gated before implementation.
- Do not show full shell UI beyond implemented PTY/session support.
- Legacy one-shot command behavior must remain visually honest and demoted from
  the normal Terminal surface.
- PTY UI must show shell, running/closed status, and explicit working
  directory / execution workspace.
- Stop and kill controls must not appear active outside the implemented
  lifecycle path.
- Current Terminal must not imply event-streaming, tabs, split panes,
  persistent shell history, environment profile support, Agent/Queue/Coordinator
  control, or Script Runner behavior until those features exist.

### Notes

Notes target direction is a multi-note writing surface.

Future multi-note behavior is contract-gated by
`docs/NOTES_WIDGET_PRODUCT_CONTRACT.md`.

Target direction:

- Multi-note list.
- Search.
- New note.
- Editor.
- Autosave when storage/API exists.

Current implementation may lag behind this target until the needed storage and
API model exists. Until then, Notes must remain honest about the minimal saved
body draft behavior.

### Agent Queue

Agent Queue target direction is a task table and review/history surface.

Target direction:

- Task table.
- Status.
- Dependencies.
- Assigned executor.
- Capacity.
- Review state.
- Run history summary.

Automatic dispatch, automatic scheduler behavior, and automatic acceptance
must not be implied. Explicit assigned-task starts belong behind visible
operator controls and Agent Executor ownership.

### Workspace Agent

Workspace Agent is the primary operator-facing AI work surface. The current
implementation uses the existing Interactive Agent compatibility component.

Rules:

- Keep the surface manual and conversation-shaped.
- Do not claim workspace inspection, hidden context access, tools, actions,
  file mutation, Git mutation, Terminal execution, Queue integration, or Agent
  Executor launch until provider/tool integration and explicit handoff contracts
  exist.
- Be honest about local/mock/provider-backed status.
- Future action proposal cards should sit with the message that produced them,
  show the target widget/capability, visible inputs, risk/safety notes,
  expected result, approval state, execution state, and result summary, and use
  compact Approve, Reject, Edit, and Copy controls.
- Proposal cards are review surfaces. They must not look like hidden execution,
  broad workspace inspection, Terminal control, Git mutation, SQL execution, or
  Agent Executor launch unless that exact capability is implemented and
  approval-gated.

### Runbook

Runbook is a manual step-based procedure surface.

Target direction:

- States and evidence first.
- Manual step progression.
- Clear current step and next action.
- Builder, persistence, templates, and agent assistance later.

Runbook must not imply Queue execution, Agent Executor dispatch, Interactive
Agent launch, Terminal automation, Git mutation, file mutation, or hidden tool
execution.

## Empty, Loading, And Error States

Shared state language:

- Empty state tells what to do next.
- Loading state says what is loading.
- Error state shows actionable error.
- Unsupported state is honest.
- Not configured state is honest.
- Failure should not look like an app crash when an operation completed with
  failure.

Examples:

- Git without a repository root is `Not configured`, not broken.
- Browser Git or Terminal execution is `Unsupported`, not broken.
- Failed validation is a completed operation with a failed result, not a
  crashed widget.
- A preview widget with no real backend is `Preview`, not silently disabled.

## Preview Widget Rules

Preview widgets should look intentional and limited.

Rules:

- Preview widgets should not imply production capability.
- Preview copy must be short and honest.
- Preview widgets should not contain many disabled future buttons.
- Preview widgets can have minimal useful local interaction.
- Preview status should remain visible in the header or primary status line.
- Preview widgets should use the same visual card language as Ready widgets,
  with a clear Preview badge or equivalent state.

Preview does not mean visually unfinished. It means limited behavior is stated
clearly.

## Prohibited UI Overclaims

Current product UI must not overclaim capability.

Explicit prohibitions:

- No separate Validation widget in the current model.
- No separate legacy Coordinator surface beyond Workspace Agent.
- No Terminal full shell UI until PTY/session support exists.
- No Notes multi-note UI until storage/API exists.
- No Queue scheduler UI until task model/dispatch exists.
- No Git push controls until push contract/API/UI exists.
- No auto-commit or hidden Git mutation.
- No fake provider/tool claims in Workspace Agent.
- No hidden Queue execution.
- No background scheduler implied by status chips.
- No Git mutations hidden behind refresh, review, or completion states.
- No raw command prompt that behaves like Script Runner under another name.

Validation belongs inside Agent Executor and Git review/commit flow when those
capabilities are implemented. It is not a separate current widget.

## Recommended Implementation Blocks

Current follow-up references:

- Terminal PTY follow-up blocks are defined in
  `docs/TERMINAL_PTY_WIDGET_CONTRACT.md` and start with the backend
  foundation slice.
- Notes, Git, Agent Queue, Workspace Agent, JDBC, and other widget follow-up blocks
  should use their focused domain contracts and `docs/CURRENT_WIDGET_SURFACE.md`
  as the current-surface inventory.

Each block should remain focused. If implementation pressure crosses into
runtime behavior, schema changes, new Tauri commands, new widgets, Git
mutation, PTY behavior, Notes storage, or Queue execution, split the work into
a separate contract or implementation block.

## Non-Goals

This contract does not implement:

- UI implementation.
- CSS changes.
- Layout behavior changes.
- Grid snapping.
- Backend changes.
- Tauri changes.
- Storage/schema changes.
- Widget behavior changes.
- New widgets.
- Git mutation.
- Terminal PTY.
- Notes storage.
- Queue execution.
