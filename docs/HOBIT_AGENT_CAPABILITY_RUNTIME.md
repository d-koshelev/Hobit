# Hobit Agent Capability Runtime

## Purpose

Define the target runtime contract for in-app Hobit agents. This is a
frontend architecture foundation and contract. It does not implement backend
runtime, storage schema, Tauri/IPC commands, scheduler behavior, workers,
Terminal launch, Git mutation, Finder changes, or full Workspace Agent
behavior beyond the current frontend structured action-request boundary.

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
- Agent-executed Smoke Report Foundation: shared pure frontend aggregation
  under `selfTest/` that combines Agent API smoke, peer self-test evidence,
  active Widget Agent Contract checks, brokered Queue `queue.selfTest`
  dry-run evidence through the injected Queue adapter, the fake Queue dogfood
  broker loop, and hidden-side-effect assertions. Queue rows cover singleton
  targeting, createItems preview, prompt-pack preview, no real Queue mutation,
  no worker start, and no Queue view creation. Queue dogfood broker rows cover
  agent finished, review message, ACK, validation approval, mark done,
  done-gated dependent unblock, follow-up prompt return to running, failure
  dependent blocking, and honest backend/worker/validation/Git not-covered
  rows. It is the foundation for replacing parts of manual smoke with
  structured agent-executed smoke reports. It does not add natural-language
  routing, backend/Tauri/IPC/storage behavior, real Terminal command
  execution, Git mutation, rollback execution, worker dispatch, Queue view
  creation, or new Knowledge / Skills, Notes, or Terminal adapters.
- Agent Self-Test Runner UI MVP: implemented as a visible secondary Workspace
  Agent action, `Run Agent Self-Test`. It uses the aggregate
  agent-executed smoke report foundation over the safe agent API smoke runner,
  peer self-test, Workspace Agent capability-context checks, capability
  manifest checks, active Widget Agent Contract checks, Queue
  `queue.selfTest` dry-run checks through the Action Broker, the fake Queue
  dogfood broker-loop self-test, and restricted Codex/shell capability
  assertions. It renders a structured report instead of raw JSON.
- Workspace Agent Capability Context Injection: the active Workspace Agent
  Codex Direct Work prompt path now attaches Hobit app context, Workspace
  Agent role instructions, a compact capability manifest, and policy rules
  before Codex execution. When the agent returns a valid
  `hobit.action.request` envelope, the frontend parses that structured machine
  request, invokes the Action Broker, and renders a compact product-facing
  result. The compact manifest includes field-level schema and examples for
  Queue create action requests and Queue dogfood lifecycle action requests
  without dumping the raw registry. Normal assistant prose remains prose.

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
  Workspace Agent broker execution is wired for structured Queue action
  requests; additional app adapters remain later.

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
behavior, worker runtime, or hidden Workspace Agent execution.

The Workspace Agent structured action-request protocol is implemented in the
frontend direct-run result path. Agents may emit a minimal JSON envelope:

```json
{
  "type": "hobit.action.request",
  "capabilityId": "queue.createItems",
  "dryRun": false,
  "input": {
    "items": [
      {
        "title": "Test Queue item",
        "prompt": "Review the current workspace state and report one safe next step.",
        "status": "draft"
      }
    ]
  },
  "reason": "optional",
  "requestId": "optional",
  "confirmationToken": "optional"
}
```

Only this structured envelope is parsed as an app action request. User prompt
text and ordinary assistant prose are not classified or regex-routed into
product actions. Invalid envelopes produce a product-facing invalid action
request result. Unknown capabilities still go through the broker and return
structured unavailable results.

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
- `queue.lifecycle.agentFinished`
- `queue.review.createMessage`
- `queue.review.ack`
- `queue.coordinator.approveValidation`
- `queue.coordinator.addFollowUpPrompt`
- `queue.item.markDone`
- `queue.item.block`
- `queue.item.fail`
- `queue.lifecycle.get`
- `queue.review.getEvidenceBundle`

The adapter boundary is typed and injected. It does not import React hooks,
mutate global UI state directly, create widgets/views directly, couple to the
Workspace Agent UI, route natural language, call Codex, call shell, launch
Terminal, mutate Git, execute rollback, start workers, arm Queue Autorun, or
create duplicate Queue views.

Queue create action input is intentionally strict at the adapter boundary.
`queue.createItem` requires `title` and `prompt`. `queue.createItems` requires
a non-empty `items` array, and every item requires `title` and `prompt`. The
`prompt` field is the runnable task instruction, not a display-only
description. Optional adapter fields are `status`, `description`,
`dependencies`, `source`, `sourceMetadata`, and `id`; unsupported aliases such
as `body`, `text`, `content`, `operatorPrompt`, `initialState`, `dependsOn`,
`queueTag`, and `priority` do not satisfy Queue create input.

Workspace Agent capability instructions may tell the model that explicit
test, dummy, or example Queue item requests can use a safe placeholder prompt,
for example "Review the current workspace state and report one safe next
step." If a user asks to create a real Queue item without providing runnable
task content, the agent should ask a concise clarification instead of emitting
an invalid action request. This is model guidance in the capability context,
not app-side natural-language routing.

Dry-run Queue creation returns a structured preview with:

- `wouldCreateItems`
- `wouldTargetSingletonQueue: true`
- `wouldAutoRunWorkers: false`
- `wouldCreateDuplicateQueueView: false`

Invoke Queue creation uses the injected Queue adapter API and targets the
singleton Workspace Queue. It preserves title, prompt, source metadata,
and dependency edges where the adapter supports them. If dependency edges
cannot be represented, the handler returns a structured failed/unsupported
result instead of silently dropping them.

Prompt-pack preview uses existing prompt-pack and Smart Queue materialization
models where practical and does not create Queue tasks. Prompt-pack import
creates Queue items only through the injected adapter API after valid input and
policy approval, and it does not auto-run workers after import.

Queue self-test through the Action Broker and Queue adapter is implemented as a
safe dry-run/model check. The broker invokes the typed `queue.selfTest`
capability handler supplied by `createQueueAgentActionHandlers(adapterApi)`;
the default handler calls only `getSingletonQueueTarget`, `previewCreateItems`,
and `previewPromptPack`. It verifies singleton targeting, createItems preview,
`wouldTargetSingletonQueue: true`, `wouldAutoRunWorkers: false`,
`wouldCreateDuplicateQueueView: false`, prompt-pack preview materialization,
no Queue mutation, no worker start, no duplicate Queue view, and no hidden
side effects. If real target inspection is unavailable, that specific
sub-check is reported as skipped or blocked with a product-facing reason such
as `Adapter not available`, while safe dry-run/model-level checks still run
against the represented singleton Queue target. Queue self-test does not call
Queue create/import APIs, create Queue tasks, create Queue views, enable or
auto-run Queue workers, call Codex/shell, launch Terminal, mutate Git, execute
rollback, or modify backend/storage/schema.

Queue dogfood lifecycle capabilities are typed frontend/controller overlay
capabilities. They let Workspace Agent or Coordinator Agent report an agent
finish, create and ACK review messages, record validation approval
placeholders, add follow-up prompts, mark an item done, block/fail an item,
and read lifecycle/evidence data through structured `hobit.action.request`
envelopes. They do not parse user prompts, route natural-language phrases,
start workers, run validation, execute Git commits, launch Terminal, execute
rollback, call shell, call Codex, create Queue views, or persist backend state.

Lifecycle dry-runs preview the intended transition and do not mutate the
frontend lifecycle overlay. Lifecycle invocation with `dryRun: false` mutates
only the current frontend/controller overlay when the injected lifecycle
adapter or Queue bridge can provide the task seed. `queue.item.markDone` may
attach model-only validation approval and fake commit result metadata to
satisfy the pure lifecycle gate, but no Git command or commit capability is
implemented in this block.

The current Workspace Agent direct-run result path can invoke these Queue
handlers through the Action Broker when the agent emits a valid structured
Hobit action request envelope. The Queue bridge adapter targets the singleton
Queue, does not create duplicate Queue views, and does not start workers,
Codex, shell, Terminal, Git, or rollback behavior.

`apps/desktop/frontend/src/workbench/agents/selfTest/hobitQueueDogfoodBrokerSelfTest.ts`
now runs the full fake dogfooding loop through the real Action Broker and
registered Queue lifecycle handlers. It is fake/model/controller/broker-level
only and explicitly reports backend durability as skipped plus real worker
execution, real validation execution, and real Git commit execution as blocked
or not covered.

Backend durability for lifecycle records, real worker lifecycle integration,
real validation evidence execution, and real Git commit execution remain
future work.

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
self-test. It does not test Queue app behavior. Queue app capability smoke is
covered separately by the Queue adapter and Workspace Agent structured
action-request tests.

The Agent-executed Smoke Report foundation is the unified report layer above
those pieces. It creates a product-facing smoke instruction and plan, then
aggregates Agent API smoke, peer self-test evidence, active Widget Agent
Contract checks, Queue singleton/create-items/prompt-pack dry-run rows through
the brokered Queue self-test, fake Queue dogfood broker-loop rows, skipped or
blocked metadata-only execution checks, and hidden-side-effect assertions.
Knowledge / Skills, Notes, and Terminal execution adapters remain future work;
their contracts can pass while adapter/runtime execution reports
`Adapter not implemented yet`, `Runtime execution not implemented yet`, or
`Restricted capability`.

The smoke report does not perform hidden side effects. It does not call Codex,
run shell commands, mutate Queue, start Queue workers, create Queue views,
launch Terminal, run Terminal commands, mutate Git, execute rollback, create
or update Notes/Knowledge, attach context, add adapters, or parse user prompts
with natural-language regex routing. Any product action path remains
structured action request plus Action Broker validation.

The Workspace Agent `Run Agent Self-Test` UI action now exposes this smoke
foundation in-product. The visible report uses `Passed`, `Failed`, `Skipped`,
and `Blocked` statuses, summary counts, per-check rows, product-facing skipped
or blocked reasons, and a `No hidden side effects` assertion summary. Hidden
side-effect assertions cover no Codex run, shell command, Queue mutation,
Queue worker start, Queue view creation, Terminal launch, Git mutation, or
rollback execution.

This UI runner is safe/dry-run only. It does not call Codex, call shell,
launch Terminal, mutate Git, execute rollback, start Queue workers, auto-run
Queue, create Queue views, or perform unsupported widget APIs. If a brokered
self-test path requires confirmation, requires dry-run, is policy blocked, or
is unavailable, the UI reports that check as blocked or skipped and does not
auto-confirm it.

Queue and Widget smoke expansion is incremental. The MVP checks the current
Agent API smoke runner, active Agent Queue, Workspace Agent, Knowledge /
Skills, Notes, and Terminal widget contracts, adapter-unavailable or
restricted execution checks for Knowledge / Skills, Notes, and Terminal, and
Finder exclusion from active contract scope. It does not yet replace full
manual Queue UI smoke until broader Queue widget self-test coverage exists.

The initial Widget Agent Contract registry lives under
`apps/desktop/frontend/src/workbench/agents/widgets/`. Active contracts are
Agent Queue / QueueV2, Workspace Agent, Knowledge / Skills, Notes, and
Terminal. Knowledge / Skills, Notes, and Terminal contracts are metadata-only
in this block: their widget product behavior is described honestly, their safe
self-test instructions exist, and their non-self-test agent actions remain
unavailable or restricted until explicit adapters/execution blocks are
implemented. Terminal execute/destructive capabilities are restricted, require
confirmation where declared, and must never be default product-action paths.
Finder is out of scope for the current active Widget Agent Contract registry.

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
- `restricted`
- `supportsDryRun`
- `allowedAgentRoles`
- `forbiddenSideEffects`
- `auditEventNames`
- `availability` and unavailable reason
- `supportsSelfTest`

## Initial Capability Manifest

Current honest foundation capabilities:

- `agent.status.read`: model-level in-app agent status read.
- `agent.history.read`: model-level bounded in-app agent history read.
- `agent.message.send`: typed in-app agent message send through the pure
  Multi-Agent Runtime model.
- `agent.capabilities.read`: model-level in-app agent capability manifest
  read.
- `agent.selfTest.run`: safe model-level in-app agent self-test.
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
- `queue.selfTest`: safe dry-run Queue capability self-test surface through
  the Action Broker and injected Queue adapter.
- `workspaceAgent.selfTest`: safe Workspace Agent capability self-test surface.
- `codex.runTask`: restricted execute capability for explicit Codex Direct
  Work; not a product-action default.
- `workspace.shell.runCommand`: restricted execute capability for explicit
  shell command execution where a future safe shell capability is available;
  not a product-action default.

No brokered Knowledge / Skills, Notes, Terminal-open, backend scheduler,
durable worker, Git mutation, or Finder capability is claimed by the initial
global capability manifest. Knowledge / Skills, Notes, and Terminal now have
Widget Agent Contracts and metadata-only self-tests, but their real adapters
and execution paths remain future blocks.

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
