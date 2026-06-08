# Workspace Agent V2 Requirements Status

## Purpose

This document summarizes the current Workspace Agent V2 requirements packet and
records implementation-planning decisions.

Status: docs-only requirements status.

This document does not implement frontend UI, backend or Tauri commands,
provider adapters, storage/schema changes, Queue execution behavior, Agent
Executor behavior, Git behavior, Terminal control, Knowledge ingestion, or new
runtime behavior. Current implemented Workspace Agent behavior remains governed
by `docs/CURRENT_WIDGET_SURFACE.md` until an explicit replacement block changes
the product surface and implementation.

## Requirements Summary

The Workspace Agent V2 packet currently consists of:

- `docs/WORKSPACE_AGENT_V2_PRODUCT_REQUIREMENTS.md`
- `docs/WORKSPACE_AGENT_V2_DIRECT_RUN_REQUIREMENTS.md`
- `docs/WORKSPACE_AGENT_V2_QUEUE_RUN_REQUIREMENTS.md`
- `docs/WORKSPACE_AGENT_V2_PROVIDER_SUPPORT_PLAN.md`
- `docs/WORKSPACE_AGENT_V2_UX_CONTEXT_ACTIVITY_REQUIREMENTS.md`

The shared direction is that Workspace Agent V2 becomes the primary foreground
AI work surface for a Workspace while preserving Hobit's Workbench-first,
widget-compatible, operator-controlled product model. V2 is planned
requirements only; the existing `interactive-agent` Workspace Agent V1 remains
Compatibility until a later replacement block explicitly defines migration,
persistence, catalog, rollback, and current-surface updates.

The product requirements define Workspace Agent V2 as a Workspace Module /
Surface, not a narrow legacy chat widget. It must support planning, execution
setup, visible context selection, Direct Run, Queue Run, run visibility, result
review, and follow-up decisions without becoming hidden automation.

The UX requirements define a continuous Workspace Agent surface with a provider
/ mode / settings row, transcript, right activity pane, visible context strip,
composer, and bottom run status summary. Context must be visible before run,
activity must be grouped by run, raw logs and developer payloads stay behind
explicit inspection, and result cards should present reviewable next actions
without implying automatic execution.

The Direct Run requirements define an explicit operator-controlled foreground
execution flow. The operator chooses provider, model or reasoning setting where
supported, working directory, sandbox, tool policy, approval policy, visible
context, and launch. Direct Run requires preflight review, observable lifecycle
states, cancellation honesty, result/transcript metadata, changed-file review
where available, validation suggestions or captured results where available,
and no automatic commit, push, Queue creation, acceptance, or hidden reruns.

The Queue Run requirements define the path where Workspace Agent turns visible
prompt/context into a Queue-owned task. Queue owns durable task identity,
execution lifecycle, report/evidence surfaces, review state, follow-up
creation, and closure. Creating a Queue task does not start execution unless a
future explicit create-and-start control is separately contracted and Queue
owns the execution start.

The provider support plan keeps Workspace Agent V2 provider-neutral. Current
Workspace Agent provider behavior remains text/proposal oriented with visible
current-session context and `allowed_tools: []`. Codex is the first production
provider target through adapter extraction from existing Direct Work behavior.
Claude Code and Amp start with local CLI audits only; no adapter, settings UI,
or execution path should be added before audit findings define a safe first
slice.

## Product Decisions

- Workspace Agent V2 is a Workspace Module / Surface. It may reuse
  widget-compatible shell, identity, or persistence infrastructure, but the
  product surface must not be constrained to a small legacy chat card.
- Direct Run is first-class and must become fully functional provider execution
  from Workspace Agent V2. It does not require creating an Agent Queue task
  first.
- Queue Run is first-class and creates auditable Queue-owned tasks with visible
  prompt, context, provider/runtime preferences, safety notes, and expected
  outcome.
- The runtime model is provider-neutral. Workspace Agent V2 must not hardcode
  Codex vocabulary as the product model.
- Codex is first because existing Direct Work infrastructure already provides
  the safest production baseline for adapter extraction.
- Claude Code and Amp come after local CLI audits. Audits must establish
  command shape, auth/status safety, headless behavior, machine-readable output,
  streaming, tools, sandbox, cancellation, resume, and usage metadata before
  implementation.
- Workspace Agent V1 remains Compatibility until an explicit V2 replacement
  block updates migration, persistence, catalog, rollback, and current behavior
  documentation.

## Safety Boundaries

Workspace Agent V2 must preserve these boundaries:

- no hidden execution
- no hidden Workspace, widget, file, log, Git, Terminal, JDBC, Notes, Knowledge,
  Queue, Executor, or provider context access
- no hidden Workspace scans or broad repository scans
- no automatic Queue task creation, dispatch, assignment, run, finalization, or
  acceptance
- no auto-commit, auto-push, reset, clean, stash, checkout, restore, or broad
  Git mutation
- no hidden Terminal control, command execution, Script Runner behavior, JDBC
  execution, or widget capability use
- no provider access to secrets and no frontend-direct provider credential use
- no provider tool use unless a later explicit contract and implementation
  block enables the tool class, sandbox, approval behavior, and review surface
- no silent widening of context, sandbox, tool policy, approval policy,
  provider, model, or working directory after launch
- no raw logs, full provider payloads, or developer diagnostics in the default
  operator view
- every context inclusion, execution launch, Queue task creation, Git action,
  Terminal action, Knowledge use, and final acceptance must be explicit,
  visible, and auditable at the owning product boundary

## Recommended Next Packs

1. Provider types foundation.
   Define provider-neutral request, capability, event, lifecycle, result,
   cancellation, policy, and warning types without adding provider runtime,
   frontend UI, schema changes, or tool execution.

2. WorkspaceAgentV2 scaffold.
   Add a planned V2 surface scaffold only after an explicit implementation
   block defines how it coexists with `interactive-agent` Compatibility. Start
   with the continuous module layout, visible context strip, transcript,
   activity pane, composer, and run status summary without expanding runtime
   permissions.

3. Codex adapter extraction.
   Wrap existing Codex Direct Work behavior behind the provider adapter
   boundary. Preserve current explicit prompt, working directory, sandbox,
   approval policy, streaming/log/result visibility, cancellation where
   available, no hidden context, no auto-commit, and no auto-push.

4. Claude Code audit.
   Produce an inspect-only CLI capability report. Do not add an adapter,
   provider selection, settings UI, Tauri command, schema, or modifying run.

5. Amp audit.
   Produce an inspect-only CLI capability report. Treat review mode as a
   hypothesis until the audit proves a safe shape. Do not add hidden code
   review, Queue worker behavior, Git mutation, or repository scanning.

6. Direct Run implementation.
   Implement the first Workspace Agent V2 Direct Run path after the provider
   adapter boundary exists. Include preflight, explicit launch, visible
   lifecycle, cancellation honesty, result review, change summary where
   available, validation visibility, and no automatic follow-up actions.

7. Queue Run integration.
   Implement visible create-Queue-task flow from Workspace Agent V2 through
   Queue-owned APIs. Attach selected visible context through durable Queue
   context APIs where available; otherwise preserve context visibly in task
   text with an honest limitation. Do not auto-run after task creation.

## Manual Design Review Checklist

- Workspace Agent V2 reads as the primary Workspace Module / Surface, not as a
  small legacy chat widget or detached settings panel.
- The header remains the widget shell meta zone, and the provider/mode/settings
  row belongs inside one continuous Workspace Agent surface.
- The default view shows only operator-useful information; raw logs, provider
  payloads, and diagnostics require explicit Developer details expansion.
- Provider, mode, working directory or scope, readiness, and error state are
  visible before run.
- All selected context is visible near the composer before send or run.
- Context items show source surface, label, scope, cap/stale/unavailable
  warnings where relevant, and a remove control.
- Direct Run and Queue Run are visually and semantically distinct.
- Direct Run preflight shows provider, model/reasoning where available,
  working directory, sandbox, tool policy, approval policy, visible context,
  excluded context, caps, and warnings.
- Direct Run launch is a separate explicit operator action.
- Queue Run creates or updates Queue-owned tasks and does not imply execution.
- Queue task creation results appear as Queue cards or links, not as hidden
  execution.
- Run activity is grouped by run, collapsible, readable by default, and linked
  to matching transcript/result content.
- Bottom run status summarizes current or latest run without duplicating the
  transcript or activity pane.
- Result cards have one primary next action and group secondary actions.
- Approval of a card does not imply hidden execution, broad future permission,
  acceptance, commit, push, Queue finalization, or follow-up mutation.
- Compact layouts preserve the send/review loop and do not hide attached
  context entirely.
- The UI does not fabricate token counts, validation success, cancellation
  support, provider readiness, or persisted history.
- Codex-specific details appear as provider/runtime details, not as the product
  definition of Workspace Agent.
- Claude Code and Amp are not presented as implemented providers before their
  audits and adapter contracts exist.

