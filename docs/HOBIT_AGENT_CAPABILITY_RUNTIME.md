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

Regex routing must not be used as the Workspace Agent product-action
architecture. Product actions must flow through raw prompt plus Hobit app
context, capability manifest, policy constraints, Action Broker validation,
internal app API invocation, and structured result/activity output. Queue item
creation is a Queue capability, not a phrase route. Codex and shell remain
restricted capabilities for explicit workspace/code execution requests only.

## Runtime Components

- App Context: structured Hobit, Workspace, surface, widget, role, prompt, and
  policy context supplied to the agent.
- Capability Registry: typed manifest of app capabilities available to the
  agent in the current context.
- Action Broker: typed invocation boundary that validates action requests,
  capability availability, policy, confirmation, dry-run requirements, and
  side-effect constraints before any handler can run.
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
- Multi-Agent Runtime: frontend-only agent instance, status, bounded history,
  typed message, and model self-test foundation documented in
  `docs/HOBIT_MULTI_AGENT_RUNTIME.md`. It does not execute broker actions or
  call shell/Codex for agent-to-agent communication.
- Agent-to-Agent SelfTest: pure model peer checks where Agent A can test Agent
  B and Agent B can test Agent A through status, history, capability manifest,
  and typed message APIs. This is the foundation for future agent-executed
  smoke through peer and widget self-tests, not a UI, broker execution path,
  Queue adapter, Codex run, shell command, or app-control action.
- Agent API Smoke Runner: first pure frontend agent-executed smoke layer over
  implemented agent runtime APIs only: `agent.status.read`,
  `agent.history.read`, `agent.message.send`, `agent.capabilities.read`, and
  `agent.selfTest.run`. It produces a structured product-facing report and
  hidden-side-effect assertions without Queue mutation, Codex/shell use,
  Terminal launch, Git mutation, rollback execution, worker start, widget/view
  creation, backend calls, or real app API execution.

## Module Ownership

Frontend agent runtime foundation code lives under
`apps/desktop/frontend/src/workbench/agents/`. New agent infrastructure must
land in the owned module folder that matches its responsibility:

- `context/`: Hobit app, Workspace, surface, role, prompt, policy-context
  models, Workspace Agent context helpers, and instruction block generation.
- `capabilities/`: typed capability metadata, capability ids, capability
  registries, the initial honest manifest, availability helpers, and policy
  helper functions.
- `broker/`: action request/result/audit/broker result contracts, policy
  validation helpers, deterministic test handlers, and the pure frontend
  Action Broker MVP. The broker validates and invokes typed handlers; app
  module behavior belongs in adapters, not the generic broker layer.
- `runtime/`: pure frontend agent instance, status, runtime-state, snapshot,
  and deterministic test-agent models for the Multi-Agent Runtime MVP.
- `messaging/`: pure frontend typed agent message, bounded history, delivery,
  and failure-result models. This folder does not implement a backend message
  bus, broker execution, or app control.
- `selfTest/`: self-test instructions, requests, cases, results, reports, and
  report summary helpers.
- `widgets/`: future Widget Agent Contract models. It does not implement widget
  contracts yet.
- `adapters/`: typed app-module adapters. The Queue Capability Adapter MVP
  lives here as the first real app-module adapter behind the Action Broker.
  Workspace Agent broker execution and additional app adapters remain later.

Workspace Agent UI components must not become the owner of agent runtime
logic. The UI may render context, proposal, and review surfaces, but typed
capability selection, policy contracts, broker request/result shapes, and
self-test models belong in the agent runtime modules above.

Regex routing is not the architecture. Do not implement product behavior as
`user text -> regex classifier -> product action`. Product actions must flow
through raw prompt plus Hobit app context, capability manifest, policy
constraints, Action Broker validation, internal app API invocation, and
structured result/activity output.

## Action Broker MVP

The frontend Action Broker MVP lives under
`apps/desktop/frontend/src/workbench/agents/broker/`. It is a pure model layer
and does not add UI, backend/Tauri/IPC commands, storage/schema changes, Queue
runtime behavior, Terminal launch, Git mutation, rollback execution, scheduler
behavior, worker runtime, or Workspace Agent broker execution.

Agents are expected to produce typed capability action requests with request
id, agent id, agent role, capability id, input, dry-run state, optional
confirmation token, reason, and creation timestamp. The broker validates the
request shape, looks up the capability in the registry, evaluates role access,
availability, restricted execution policy, confirmation requirements, dry-run
requirements, and side-effect constraints, then returns a structured action
result.

Broker results include success, failure, unavailable, policy-blocked,
needs-confirmation, dry-run-required, and invalid-input outcomes. Results carry
a product-facing message, structured output when available, the policy
decision, stable audit/activity events, and hidden-side-effect flags asserting
that safe model handlers did not run shell, Codex, Queue mutation, Terminal,
Git, rollback, or workers.

The broker MVP includes deterministic frontend test handlers only for pure
agent model APIs:

- `agent.status.read`
- `agent.capabilities.read`
- `agent.message.send` dry-run

Queue-specific behavior does not live in the generic broker layer. Queue
handlers are supplied by the Queue Capability Adapter through
`createQueueAgentActionHandlers(adapterApi)`.

Codex and shell capabilities remain restricted execute capabilities. They are
not default Hobit app-action paths, and the broker MVP blocks restricted
execute invocation unless a future explicit policy/adaptor slice deliberately
opens that path.

## Queue Capability Adapter MVP

The Queue Capability Adapter MVP is the first real app-module adapter for the
Hobit Agent Capability Runtime. It lives under
`apps/desktop/frontend/src/workbench/agents/adapters/` and exposes typed Queue
capability handlers for the Action Broker through dependency injection.

Supported Queue capabilities:

- `queue.targetSingletonQueue`
- `queue.createItem`
- `queue.createItems`
- `queue.preparePromptPackPreview`
- `queue.importPromptPack`
- `queue.selfTest`

The adapter boundary is typed and injected. It does not import React hooks,
mutate global UI state directly, create widgets/views directly, couple to the
Workspace Agent UI, route natural language, call Codex, call shell, launch
Terminal, mutate Git, execute rollback, start workers, arm Queue Autorun, or
create duplicate Queue views.

Dry-run Queue creation returns a structured preview with:

- `wouldCreateItems`
- `wouldTargetSingletonQueue: true`
- `wouldAutoRunWorkers: false`
- `wouldCreateDuplicateQueueView: false`

Invoke Queue creation uses the injected Queue adapter API and targets the
singleton Workspace Queue. It preserves title, prompt/body, source metadata,
and dependency edges where the adapter supports them. If dependency edges
cannot be represented, the handler returns a structured failed/unsupported
result instead of silently dropping them.

Prompt-pack preview uses existing prompt-pack and Smart Queue materialization
models where practical and does not create Queue tasks. Prompt-pack import
creates Queue items only through the injected adapter API after valid input and
policy approval, and it does not auto-run workers after import.

Queue self-test runs safe target and dry-run checks through the adapter. It
verifies singleton targeting, createItems preview, no auto-run, no duplicate
view, and no hidden side effects. If a production adapter has no safe mutation
sandbox, mutation checks are skipped or blocked with a product-facing reason
rather than performing real Queue mutation.

Workspace Agent UI broker execution is still later. The current Workspace
Agent surface is not wired to invoke these broker handlers.

## Widget Agent Contracts

Every Hobit widget or module must expose an agent-readable Widget Agent
Contract before it is considered complete. The contract describes product
functionality, typed agent-facing capabilities, input/output schema
descriptions, side-effect levels, confirmation and dry-run/preview
requirements, forbidden side effects, availability and unavailable reasons,
audit/activity event names, safe self-test capabilities, and the agent
self-test instruction.

Manual smoke is moving toward agent-executed smoke through widget self-tests.
The self-test contract must let an agent report `passed`, `failed`, `skipped`,
or `blocked` with structured evidence and no hidden side effects. Side-effecting
capabilities must use dry-run/model evidence or an explicit safe test sandbox;
missing or unavailable capabilities must be skipped or blocked instead of
treated as silent success.

The peer self-test foundation extends this model to multiple in-app agents:
one registered agent can check another registered agent's status, bounded
history, model-level capability manifest, and typed message receipt, then the
roles can be reversed. The peer report is product-facing and explicitly asserts
no Codex/shell usage, no Queue mutation, no Terminal launch, no Git mutation,
no rollback execution, and no hidden worker start.

The Agent API Smoke Runner is the first smoke layer built on this foundation.
It asks one agent to check another agent's implemented runtime API surface
using safe model checks for status, history, capabilities, messaging, and peer
self-test. It does not test Queue app behavior. Queue app capability smoke
requires a later real Queue adapter behind the Action Broker and remains out of
scope for the current runner.

The initial Widget Agent Contract registry lives under
`apps/desktop/frontend/src/workbench/agents/widgets/`. Initial active examples
are Agent Queue / QueueV2 and Workspace Agent. Knowledge / Skills, Notes, and
Terminal are next contract targets and may appear only as unavailable/skipped
placeholders until their full contracts exist. Finder is out of scope for the
current Widget Agent Contract foundation and is not included in the active
contract registry.

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
