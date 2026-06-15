# Hobit Agent Capability Runtime

## Purpose

Define the target runtime contract for in-app Hobit agents. This is a
frontend architecture foundation and contract. It does not implement backend
runtime, storage schema, Tauri/IPC commands, scheduler behavior, workers,
Terminal launch, Git mutation, Finder changes, or full Workspace Agent
behavior.

## Agent Role

An in-app agent is a Hobit product operator/orchestrator first. It receives the
raw user prompt, Hobit app context, current Workspace/surface/widget context,
role instructions, a capability manifest, policy constraints, and self-test
capabilities.

Code execution, shell commands, and Codex Direct Work are restricted
capabilities. They are not the default path for product actions such as Queue
item creation, prompt-pack import, Notes changes, Knowledge actions, widget
state changes, or app navigation.

## Runtime Components

- App Context: structured Hobit, Workspace, surface, widget, role, prompt, and
  policy context supplied to the agent.
- Capability Registry: typed manifest of app capabilities available to the
  agent in the current context.
- Action Broker: future invocation boundary that maps typed action requests to
  app APIs.
- Policy Layer: central enforcement for role, availability, permission,
  confirmation, dry-run, scope, and side-effect constraints.
- Preview/Dry-run: safe capability mode for planning, import preview, and
  self-tests before mutation.
- Confirmation Model: capability metadata declares whether confirmation is
  none, recommended, or required.
- Audit/Activity Events: every action produces structured events, including
  unavailable and policy-blocked attempts.
- Structured Results: all action outcomes return typed success, failure,
  unavailable, blocked, dry-run-required, or confirmation-required results.
- SelfTest Runtime: safe test harness that checks capability availability and
  policy without hidden mutation.

## Capability Metadata

Each capability has:

- `id`
- `title`
- `ownerSurface`
- `description`
- `inputSchemaDescription`
- `outputSchemaDescription`
- `sideEffectLevel`: `read | write | execute | destructive`
- `confirmationRequirement`: `none | recommended | required`
- `supportsDryRun`
- `allowedAgentRoles`
- `forbiddenSideEffects`
- `auditEventNames`
- `availability` and unavailable reason
- `supportsSelfTest`

## Initial Capability Manifest

Current honest foundation capabilities:

- `queue.createItem`: in-app Queue item creation through the singleton
  Workspace Queue path; write side effect; no duplicate Queue view; no worker
  start.
- `queue.createItems`: in-app batch Queue item creation; write side effect;
  supports dry-run/preview where a preview exists; no duplicate Queue view; no
  Queue Autorun or worker start.
- `queue.preparePromptPackPreview`: safe prompt-pack preview/materialization;
  read side effect; targets the singleton Workspace Queue; no Queue items are
  created.
- `queue.importPromptPack`: explicit Queue item creation from a confirmed
  prompt-pack preview; write side effect; uses existing Queue bridge paths; no
  auto-run workers.
- `queue.targetSingletonQueue`: read-only capability that resolves the single
  Workspace Queue target and forbids duplicate Queue views.
- `queue.selfTest`: safe Queue capability self-test surface.
- `workspaceAgent.selfTest`: safe Workspace Agent capability self-test surface.
- `codex.runTask`: restricted execute capability for explicit Codex Direct
  Work; not a product-action default.
- `workspace.shell.runCommand`: restricted execute capability for explicit
  shell command execution where a future safe shell capability is available;
  not a product-action default.

No Knowledge, Notes, Terminal-open, backend scheduler, durable worker, Git
mutation, or Finder capability is claimed by this foundation.

## Policy Rules

- App actions must use typed app capabilities before Codex or shell.
- Product actions must not inspect source files to discover or mutate product
  state.
- Product actions must not use shell unless an explicit shell capability is
  selected and permitted.
- Product actions must not use Codex unless an explicit Codex capability is
  selected and permitted.
- Queue item creation must use Queue capabilities and the singleton Queue
  target.
- No action may create duplicate Queue views.
- No action may auto-run workers unless that capability explicitly allows it.
- Destructive actions require confirmation.
- Unavailable actions return structured unavailable results.
- Policy-blocked actions return structured blocked results.
- All actions produce audit/activity events.

## Self-Test Rules

- Self-tests use safe or dry-run capabilities.
- Side-effecting capabilities require dry-run or an explicit test sandbox.
- Self-test status is `passed`, `failed`, `skipped`, or `blocked`.
- Self-tests must assert no hidden side effects.
- Self-tests must not call shell or Codex unless a self-test capability
  explicitly allows it.
- Capabilities without a safe self-test are marked skipped, not executed.
- Policy-blocked self-tests report blocked with the policy reason.
