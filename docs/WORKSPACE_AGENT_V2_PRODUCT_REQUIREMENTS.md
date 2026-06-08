# Workspace Agent v2 Product Requirements

## Purpose

This document defines product requirements for Workspace Agent v2.

Workspace Agent v2 is a planned product surface requirement document only. It
does not implement frontend UI, backend commands, provider integration,
storage/schema changes, Queue execution changes, Agent Executor changes,
Terminal control, Git mutation, Knowledge ingestion, or new runtime behavior.

Current implemented Workspace Agent behavior remains governed by
`docs/CURRENT_WIDGET_SURFACE.md` until an explicit replacement block updates
the product surface and implementation.

## Product Position

Workspace Agent v2 is a Workspace Module / Surface, not a legacy small widget.

It is the primary foreground AI work surface for a Workspace. It may still use
widget-compatible identity, persistence, or shell infrastructure where a later
migration requires compatibility, but its product model must not be constrained
to a narrow chat card or small legacy widget frame.

Workspace Agent v2 should support deep operator-facing work across planning,
execution setup, review, context selection, run visibility, and follow-up
decisions while preserving Workbench-first composition and operator control.

## Provider Neutrality

Workspace Agent v2 is provider-neutral.

The product surface must not be Codex-specific. Codex may remain one provider,
executor, or compatibility runtime where explicitly configured, but the v2
requirements must support multiple future providers and executor kinds without
renaming the product, changing the operator mental model, or hardcoding one
provider's vocabulary into the surface.

Provider-specific capabilities, limits, logs, and statuses should be surfaced
as provider/runtime details, not as the definition of Workspace Agent itself.

## Run Modes

Direct Run and Queue Run are both first-class Workspace Agent v2 paths.

Neither mode is a fallback for the other. The operator chooses based on the
shape of the work, urgency, expected duration, audit needs, and whether the
work should remain foreground or become organized async work.

### Direct Run

Direct Run is fully functional provider execution from Workspace Agent v2.

Direct Run is for foreground or immediately supervised work. It should let the
operator configure the provider, execution target, visible context, safety
mode, prompt/instructions, and expected output before execution begins.

Direct Run must show visible status, streamed or refreshed activity where
available, final output, errors, validation or follow-up suggestions where
available, and any relevant review material. It must not depend on creating an
Agent Queue task first.

Direct Run may use existing executor/runtime infrastructure internally where
appropriate, but the product experience is Workspace Agent-owned foreground
execution, not a hidden handoff to a legacy widget.

### Queue Run

Queue Run creates auditable Queue tasks with visible context.

Queue Run is for promoted, larger, delayed, long-running, review-heavy, or
async work. It must create or update Queue tasks through visible operator
actions, with the included prompt, selected context, provider/runtime
preferences, safety notes, and expected outcome visible before task creation or
submission.

Queue Run must preserve an auditable task boundary:

- what the task is
- why it exists
- what visible context was included
- who or what created it
- which provider/runtime settings were requested
- what safety constraints apply
- how execution and review history can be inspected

Creating a Queue task is not permission for hidden execution. Queue execution
must follow the active Queue contracts and explicit operator-controlled run
policy.

## Compatibility

Existing Workspace Agent V1 remains Compatibility until explicit replacement.

The current Workspace Agent V1 surface uses the retained `interactive-agent`
identity/component foundation and the behavior documented in
`docs/CURRENT_WIDGET_SURFACE.md`. V2 requirements do not rename, migrate,
delete, or replace V1 by themselves.

A future replacement block must explicitly define migration, persistence,
catalog, surface, compatibility, and rollback expectations before V2 becomes
the implemented current product surface.

## Safety Requirements

Workspace Agent v2 must preserve Hobit's operator-controlled safety model.

Required safety boundaries:

- no hidden execution
- no auto-commit
- no auto-push
- no automatic finalization or acceptance of work
- no hidden Terminal use
- no hidden Git reads or mutations
- no hidden Knowledge reads, ingestion, memory, or prompt injection
- no hidden Workspace scans
- no hidden widget state reads
- no hidden Queue task creation or dispatch
- no provider access to secrets
- no provider/tool action that bypasses the owning Workspace capability

All execution, context inclusion, Queue task creation, Git action, Terminal
action, Knowledge use, and final acceptance must be explicit, visible, and
auditable at the appropriate product boundary.

## Key Decisions

- Workspace Agent v2 is a Workspace Module / Surface.
- Workspace Agent v2 is provider-neutral.
- Direct Run is first-class and fully functional provider execution.
- Queue Run is first-class and creates auditable Queue tasks with visible
  context.
- Workspace Agent V1 remains Compatibility until explicitly replaced.
- Safety boundaries prohibit hidden execution, hidden context, hidden
  Terminal/Git/Knowledge use, and automatic commit/push/finalization.

