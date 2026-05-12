# Demo Flow Checklist

## Purpose

This checklist defines the manual verification scope for the current Hobit
pre-AI milestone before first real AI integration.

It is a current-state and demo-readiness checklist only. It does not implement
runtime behavior, frontend UI, backend commands, storage, Agent execution, LLM
integration, tool execution, Terminal behavior, Queue behavior, or approval and
apply workflows.

## Current Implemented Demo Surfaces

- Workbench persistence through the desktop Workspace/Workbench foundation.
- Widget Catalog with Ready, Preview, and Planned sections.
- Terminal one-shot local command runner.
- Widget-local logs, widget runs, and structured widget results.
- Global idle/running/attention indicator for current-session local runs.
- Agent Chat proposal-only mock.
- Approved context selector for safe current-view metadata.
- Proposal result persistence in the desktop shell.
- Agent Monitoring read-only proposal/details viewer.
- Optional Agent Queue review inbox.
- Git read-only status widget.
- Notes persisted body draft.

## Not Implemented / Must Not Be Claimed

- No real LLM yet.
- No provider configuration.
- No tool execution by Agent.
- No Terminal execution from Agent.
- No Queue execution.
- No approval/apply workflow.
- No Git mutations.
- No Notes AI editing.
- No filesystem read/write.
- No hidden context access.
- No Script Runner execution.
- No real Dock behavior.

## Flow A - Terminal One-Shot Manual Check

- [ ] Open the desktop app in a real Tauri environment.
- [ ] Open or add a Terminal widget.
- [ ] Confirm the global indicator starts idle.
- [ ] Run a harmless successful command.
- [ ] Confirm the Run button disables while running.
- [ ] Confirm the global indicator switches to running.
- [ ] Confirm the result status is completed.
- [ ] Confirm the exit code is `0`.
- [ ] Confirm the stdout preview shows the expected output.
- [ ] Confirm lifecycle logs appear or refresh.
- [ ] Confirm the global indicator returns to idle.
- [ ] Run a harmless nonzero command.
- [ ] Confirm the result is completed with a nonzero exit code.
- [ ] Confirm the nonzero result is visually distinct from success.
- [ ] Run a clearly missing program.
- [ ] Confirm a failed state is visible.
- [ ] Confirm the error message is understandable.
- [ ] Optionally run a timeout scenario if practical and stable.
- [ ] Confirm UI copy does not claim shell, PTY, interactive stdin, streaming,
  or command history behavior.

## Flow B - Agent Proposal Manual Check

- [ ] Open or add Agent Chat.
- [ ] Confirm the primary action is asking for or generating a proposal.
- [ ] Confirm the UI does not claim LLM, tool execution, or mutation behavior.
- [ ] Confirm the approved context selector defaults to no context.
- [ ] Select allowed current-view metadata.
- [ ] Generate a proposal.
- [ ] Confirm the proposal shows which context was used.
- [ ] Confirm proposed actions are marked not executed.
- [ ] Confirm the proposal persistence run id/result is visible in the desktop
  shell when persistence succeeds.
- [ ] Open Agent Monitoring/details.
- [ ] Confirm the saved proposal artifact appears.
- [ ] Confirm Overview, Result, and Raw are read-only inspection views.
- [ ] Confirm no execution, apply, or approval behavior is implied.

## Optional Flow C - Agent Queue Review Item

This flow is optional and is not required for the first AI milestone.

- [ ] From Agent Monitoring, create a review item if the action is available.
- [ ] Confirm the action is explicit.
- [ ] Confirm the Queue item appears in Agent Queue.
- [ ] Confirm the status is `needs_review` / review-only.
- [ ] Confirm no execution or apply controls are active.
- [ ] Confirm Agent Queue is presented as an optional review inbox, not the
  primary AI path.

## Known Manual Smoke Limitation

A previous local smoke attempt could not complete manual UI verification because
the runner exposed only a hidden 16x16 `Tao Thread Event Target` window.
WebView2 CDP was unavailable.

Manual UI verification must be performed on a real desktop environment before
claiming the Terminal or Agent proposal flows are demo-ready.

## Pre-AI Readiness Criteria

Hobit is ready for first AI proposal-only integration when:

- Widget Catalog is understandable.
- Terminal one-shot flow is manually verified.
- Agent Chat -> Agent Monitoring/details flow is manually verified.
- Approved context is visible and explicit.
- Proposal artifacts are persisted and inspectable.
- Agent Queue is optional, not mandatory.
- UI does not imply hidden automation.
- Docs clearly distinguish implemented behavior from not implemented behavior.

## Follow-Up Blocks If Checklist Fails

- Terminal UI smoke fix.
- Activity indicator fix.
- Agent Chat copy fix.
- Agent Monitoring empty-state fix.
- Catalog copy fix.
- Queue optional-review copy fix.

