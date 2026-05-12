# Product Simplification Audit

## Purpose

This audit reviews the current Hobit Workbench surface after the recent Terminal
and Agent proposal milestones.

The review question is:

Are we overcomplicating Hobit right now?

Short answer: yes, the product is beginning to show too much future surface
before the core demo flow has been manually validated. The implemented safety
boundaries are generally honest, but the visible UI now contains several
placeholder and planned surfaces that compete with the two flows Hobit most
needs to prove next.

## Current Milestone Summary

The current product surface is still Workbench-first and starts new Workspaces
with an empty Workbench. The Widget Catalog can add Notes, Terminal, Agent Chat,
Agent Monitoring, Agent Queue, Git, and Template Library widget instances. The
Workbench also shows Recent activity, a static Dock preview, layout lock/edit
controls, a local activity indicator, widget frame actions, floating/docking,
and widget-local Logs panels.

The two real demo flows now present in the product are:

1. Terminal one-shot command:
   Terminal widget -> run explicit program + argv -> see result/logs -> global
   activity indicator changes during the current-session run.
2. Agent proposal review:
   Agent Chat -> choose approved current-view context -> generate/persist
   proposal -> view persisted artifact in Agent Monitoring -> create review
   item -> view item in Agent Queue.

The Agent flow remains proposal-only. It can call only the explicit backend AI
provider boundary when configured, or use local/mock fallback. It does not
execute tools, run Terminal commands, read hidden context, create Queue items
from Agent Chat directly, or execute Queue items.

## What Is Working Well

- The default empty Workbench still protects the Workbench-first product model.
- Terminal copy is explicit about program + argv, no shell mode, no PTY, no
  streaming, no stdin, and no command history.
- The global activity indicator is compact and correctly scoped to
  current-session frontend-known local Terminal runs.
- Agent Chat is honest that it is a proposal-only preview with explicit provider
  configuration or local/mock fallback, no tools, mutations, hidden context, or
  Queue creation by itself.
- Approved context selection is explicit and limited to visible current-view
  metadata.
- Agent Monitoring's Overview / Result / Raw structure is the right read-only
  pattern for stored artifacts.
- Agent Queue persisted review items are correctly review-only and sourced from
  valid proposal artifacts.
- Browser fallback copy is mostly honest about unsupported desktop-only
  persistence and local process capabilities.

## Where Hobit Risks Over-Complexity

### Widget Catalog

The catalog shows too much product future at once. Available cards include
several partially implemented or placeholder-heavy widgets, while planned cards
include Agent CLI, Script Runner, Database/JDBC, JIRA, Confluence, and Image
Edit. This makes the catalog feel like a broad roadmap instead of a simple path
to the current demo.

Planned widgets are separated with badges, but the operator still has to scan
many future capabilities before understanding which widgets matter today.

The current demo path is not obvious. Terminal, Agent Chat, Agent Monitoring,
and Agent Queue are scattered across categories, and the Agent proposal flow is
not presented as a single sequence.

Some catalog descriptions are stale relative to implementation. Agent
Monitoring and Agent Queue are no longer only static previews; they now have
narrow persisted proposal-artifact and review-inbox behavior.

### Workbench Surface

The top-level Workbench currently shows several always-visible concepts before
the operator adds a widget:

- Recent activity
- static Dock preview
- layout lock/edit controls
- local preview badge
- global activity indicator
- Add Widget

Recent activity is useful. The global activity indicator is useful for Terminal
smoke. The static Dock preview is the biggest noise source because it looks like
a real product surface but is not part of either current demo flow.

Layout lock/edit, float/dock, widget Logs, and widget frame actions are valuable
foundation behavior, but together they add many controls before the core runtime
flows have been manually proven. This is especially risky when demoing Agent
Chat, Monitoring, and Queue together.

### Terminal Widget

Terminal is mostly demo-ready in copy and behavior, with two caveats:

- The form is dense for a first demo because timeout and output caps are always
  visible.
- Manual desktop smoke remains incomplete, so the product should not assume the
  Terminal demo is ready until a real Tauri desktop window has been verified.

The one-shot boundary is clear and should stay.

### Agent Chat

Agent Chat is honest but verbose. The operator sees prompt input, safety copy,
approved context controls, context preview, proposal output, persistence status,
local activity, and a disabled "Apply proposal planned" button.

The proposal-only boundary is clear. The risk is that the amount of safety copy
and repeated "no execution" language can make the widget feel like a contract
reader rather than a simple proposal generator.

The disabled apply button is especially likely to confuse the demo because it
introduces an action the product explicitly does not support yet.

### Agent Monitoring

Agent Monitoring now has a useful role: read persisted Agent Chat proposal
artifacts and expose Overview / Result / Raw.

The risk is naming. "Agent Monitoring" sounds like real Agent runtime
monitoring, but the current viewer only monitors stored proposal-only mock
artifacts. Copy currently clarifies this, but the distinction must remain
prominent in the next demo.

The "Create review item" action belongs here for the current flow, but it makes
Monitoring partially a bridge into Queue. That is acceptable for now if the UI
continues to say it creates only review metadata and executes nothing.

### Agent Queue

Agent Queue is where the current UI most visibly drifts toward future product.
When no persisted review items exist, the widget still shows a broad static
preview with planned command queue, history, review, Git, artifacts, notes, and
decision actions.

Once real proposal-review items exist, the persisted review item detail is
understandable. The empty/demo fallback is too large for the next milestone.

Planned disabled actions such as accept, needs fix, rerun, follow-up, archive,
Git review, and monitoring links add noise because none of those workflows are
implemented.

### Template Library, Dock, And Other Placeholders

Template Library is valuable for long-term product direction but is not needed
for the two immediate demo flows. Its generated request preview and disabled
planned actions can distract from the more concrete Agent proposal flow.

The static Dock preview is useful as a contract demonstration, but it should be
demoted or hidden for the next milestone. It is not part of Terminal smoke or
Agent proposal review.

Git is useful as a read-only placeholder, but its planned review areas and
planned actions should not be part of the next simplified demo unless the demo
is specifically about Git.

## What Should Stay Visible For The Next Demo

- Empty Workbench start state.
- Add Widget and a smaller, clearer set of available demo widgets.
- Terminal widget.
- Agent Chat widget.
- Agent Monitoring widget.
- Agent Queue widget, but focused on persisted proposal-review items.
- Widget-local Logs buttons, because logs are part of the widget contract and
  Terminal/Agent proposal lifecycle verification.
- Recent activity, if it stays compact.
- Global activity indicator, because it proves current-session Terminal run
  status.
- Layout lock/edit and float/dock basics, but they should be secondary to the
  main flow and not explained as a feature-heavy demo.

## What Should Be Hidden, Demoted, Or Postponed

- Static Dock preview should be hidden, collapsed, or moved behind a "planned"
  affordance before the next manual demo.
- Planned catalog cards should be collapsed or filtered behind a "Show planned"
  control so the current demo path is obvious.
- Template Library should be excluded from the next primary demo unless the demo
  is specifically about request/response template direction.
- Agent Queue static preview content should be shortened when there are no real
  persisted review items.
- Disabled planned controls should be reduced. Report planned decisions in copy
  rather than showing many disabled buttons.
- Git planned review cards/actions should be demoted unless the Git widget is
  the demo focus.
- Agent Chat's disabled "Apply proposal planned" button should be removed or
  replaced with copy only until an approval/apply workflow exists.

## Copy And UX Issues To Fix

- Catalog descriptions for Agent Monitoring and Agent Queue should reflect the
  current narrow persisted behavior, not only "static preview" behavior.
- Agent Chat, Agent Monitoring, and Agent Queue need one short shared
  explanation of the sequence so operators understand why three Agent-labeled
  widgets exist.
- Agent Chat should reduce repeated safety copy while preserving the key
  boundary: proposal-only provider call when explicitly configured, no tools,
  no hidden context, no mutations.
- Agent Queue empty state should say what to do next: generate a proposal in
  Agent Chat, view it in Agent Monitoring, then create a review item.
- Terminal could move timeout and output caps behind an advanced/details area in
  a later UI block, after manual desktop smoke is complete.
- The Workbench should avoid showing future Dock rails as if they are part of
  the current product.

## Demo Flow Audit

### Flow A: Terminal

Flow:

Terminal widget -> run one-shot command -> see result/logs -> global activity
indicator changes.

Unclear or risky steps:

- The operator must know to enter a working directory manually.
- Timeout and cap fields are useful but visually compete with program/args.
- Manual Tauri smoke has not been completed, so result/log/global indicator
  behavior should be verified before treating this as demo-ready.

Recommended simplification:

- Keep Terminal visible.
- Keep one-shot/no-shell copy.
- Do not add Terminal features before desktop smoke.
- Consider a later UI-only block that makes timeout/output caps secondary.

### Flow B: Agent Proposal

Flow:

Agent Chat -> choose approved context -> generate proposal -> persist proposal
-> view in Agent Monitoring -> create review item -> view in Agent Queue.

Unclear or risky steps:

- Three Agent widgets are required to understand one proposal-review story.
- "Agent Monitoring" can sound like real runtime monitoring.
- "Agent Queue" can sound executable even though items are review-only.
- Agent Chat repeats many safety boundaries and includes a disabled apply
  button.
- Queue empty/demo content is much larger than the real persisted review item
  path.

Recommended simplification:

- Keep the flow, but make it the only Agent demo story for now.
- Rename/copy within the UI should emphasize "proposal artifact viewer" and
  "review inbox" until real runtime exists.
- Remove or demote disabled planned controls.
- Keep Raw / Overview / Result, but avoid adding more sections before manual
  demo validation.

## Docs And Current-State Consistency

The major current-state docs are broadly honest about the implementation and
non-goals. They correctly state that the AI path is proposal-only and
explicitly configured, with no tool execution, no Queue execution, no hidden
context access, and no Terminal shell/runtime beyond one-shot commands.

The main consistency gap is UI copy, not contracts: some catalog and placeholder
labels still describe Agent Monitoring and Agent Queue as static previews even
though they now have narrow persisted proposal-artifact behavior.

No copy was found that intentionally claims real LLM, tool, Agent Queue
execution, or Terminal shell behavior exists.

## Recommended Next Blocks

Follow-up simplification blocks should apply
`docs/WIDGET_PROGRESSIVE_DISCLOSURE_CONTRACT.md`: decide whether each widget
surface is Minimal, Operational, or Full / Expert before changing UI, and keep
the next demo focused on Minimal or Operational surfaces unless deeper
inspection is explicitly needed.

1. Manual desktop smoke first:
   Verify the Terminal one-shot path and the Agent proposal -> Monitoring ->
   Queue path in a real Tauri desktop window. Fix only concrete smoke failures.

2. Catalog simplification:
   Make the current demo path obvious. Demote planned catalog cards behind a
   "Show planned" affordance or a separate planned section. Correct stale
   Agent Monitoring and Agent Queue catalog descriptions.

3. Workbench surface simplification:
   Hide or collapse the static Dock preview and keep Recent activity/global
   activity compact. Do not add real Dock behavior.

4. Agent flow copy cleanup:
   Reduce repeated safety prose, remove disabled planned controls that suggest
   unavailable apply/execute behavior, and make Chat vs Monitoring vs Queue
   responsibilities clearer.

5. Queue empty-state reduction:
   Replace the large static Agent Queue demo preview with a compact empty state
   plus the next action in the proposal-review flow.

## Explicit Non-Goals For The Next Milestone

- No executable Agent Chat runtime beyond the explicit proposal-only provider
  boundary.
- No Agent execution.
- No Queue execution.
- No Terminal shell mode, PTY, streaming, stdin, cancellation, or command
  history.
- No new Tauri commands.
- No storage/schema changes unless a smoke failure proves one is necessary.
- No new widgets.
- No Template Library implementation.
- No real Dock implementation.
- No Git mutations.
- No Notes mutation beyond the existing explicit save behavior.
- No broad visual redesign.
- No hidden context access.
- No approval/apply workflow.

## Final Recommendation

Pause feature expansion and simplify before adding more Agent runtime pieces.

The next milestone should prepare and run a real manual desktop demo/smoke of
the two existing flows. After that, apply small UI/copy simplification blocks
that reduce planned surfaces and make Terminal plus Agent proposal review the
obvious product story.
