# Hobit Multi-Agent Runtime

## Purpose

Define the frontend-only Multi-Agent Runtime MVP for Hobit in-app agents. This
model lets one Workspace host multiple addressable agent instances, inspect
agent status/history/capabilities, and exchange typed internal messages.

This runtime contract does not implement LLM calls, Workspace Agent broker
execution, Queue capability adapters, app control actions, backend/Tauri/IPC
commands, storage/schema changes, shell execution, Codex execution, Terminal
runtime changes, Git behavior, scheduler behavior, worker behavior, rollback,
or Finder work. The Workspace Agent UI can expose safe reports produced from
these runtime helpers, but the multi-agent runtime remains a pure frontend
model layer.

## Runtime Model

- A Workspace runtime can contain multiple in-app agent instances.
- Each agent is addressable by a stable `agentId`.
- Agent registration is deterministic. Duplicate agent ids return a structured
  runtime error instead of replacing an existing agent implicitly.
- Agent status is a pure runtime field and may be read or updated through
  typed runtime helpers.
- Runtime snapshots expose registered agents, bounded histories, runtime
  events, and workspace id without mutating product state.
- Missing agents return structured not-found results.

Supported MVP statuses are:

- `idle`
- `running`
- `waiting`
- `blocked`
- `failed`
- `stopped`

## Messaging And History

Agents communicate through typed internal message APIs. They must not inspect
each other through UI scraping, regex phrase routing, shell commands, Codex
runs, Terminal output, or hidden widget reads.

Messages include:

- `messageId`
- `fromAgentId`
- `toAgentId`
- `body`
- `createdAt`
- `status`
- `kind`: `system`, `agent`, `self_test`, or `capability_result`
- optional `correlationId`
- optional `threadId`

Agent histories are bounded, deterministic, and audit-oriented. Sending a
message appends a sender event and, when the receiver exists, a receiver event.
A missing receiver returns a structured failure and records the failed sender
event only.

## Agent APIs

The MVP exposes model-level APIs for:

- agent status read
- bounded agent history read
- agent message send
- agent capability manifest read
- agent self-test run

The deterministic test agents `test.agentA` and `test.agentB` expose these
capability manifest entries:

- `agent.status.read`
- `agent.history.read`
- `agent.message.send`
- `agent.capabilities.read`
- `agent.selfTest.run`

These are model-level/test capabilities only. They do not invoke real app APIs,
do not execute broker actions, do not call Codex, and do not run shell
commands.

## Self-Test Boundary

Self-tests are safe and dry-run/model-first by default. They can inspect
runtime registration, status reads, bounded history reads, capability manifest
reads, and typed message exchange. They must report structured evidence and
must not create product side effects.

## Agent-To-Agent SelfTest

The Agent-to-Agent SelfTest MVP is a pure frontend model under
`apps/desktop/frontend/src/workbench/agents/selfTest/`. It lets Agent A test
Agent B and Agent B test Agent A through typed internal agent APIs only.

Each peer self-test performs the same deterministic checks:

- read the target agent status;
- read the target capability manifest;
- verify the target exposes only the required model-level peer capabilities:
  `agent.status.read`, `agent.history.read`, `agent.message.send`,
  `agent.capabilities.read`, and `agent.selfTest.run`;
- send one typed internal `self_test` message to the target;
- mark delivery through the pure messaging helper;
- verify the target bounded history contains the received message.

The peer self-test report includes the report id, tester agent id, target
agent id, instruction id, checked capabilities, created message id when one was
created, status/capability/message/history check results, final status,
product-facing summary, hidden-side-effect flags, and created timestamp. The
final status is one of `passed`, `failed`, `skipped`, or `blocked`.

Expected non-happy paths are structured results, not thrown errors. A missing
target agent reports `blocked`; a missing required capability reports
`failed`; message delivery failure reports `failed`; missing target-history
evidence for a delivered message reports `failed`; policy or unavailable
conditions report `blocked` or `skipped` with the product-facing reason.

Peer self-tests assert no hidden side effects: no Codex run, shell command,
Queue mutation, Terminal launch, Git mutation, rollback execution, hidden
worker start, Action Broker execution, or app control action. Codex and shell
are not used by agent-to-agent self-tests.

## Agent API Smoke Runner

The Agent API Smoke Runner MVP is a pure frontend model under
`apps/desktop/frontend/src/workbench/agents/selfTest/`. It is the first
agent-executed smoke layer over implemented agent runtime APIs. A tester agent
receives a safe smoke instruction, lists the target agent capability manifest,
creates smoke cases only for supported `agent.*` APIs, runs safe model checks,
and returns a structured product-facing report.

Current coverage is limited to the implemented runtime APIs:

- `agent.status.read`
- `agent.history.read`
- `agent.message.send`
- `agent.capabilities.read`
- `agent.selfTest.run`

The smoke runner reads target status, reads bounded history, reads the
capability manifest, sends one typed `self_test` message, verifies bounded
target-history evidence for that message, and invokes the peer self-test helper
when the target exposes `agent.selfTest.run`. Results are `passed`, `failed`,
`skipped`, or `blocked`; normal smoke failures return structured results
instead of throwing.

The report includes report id, instruction id, tester/target agent ids,
checked capabilities, per-case results, summary counts, product-facing
summary, created timestamp, and hidden-side-effect assertions. Those assertions
cover no Codex run, shell command, Queue mutation, Terminal launch, Git
mutation, rollback execution, worker start, or widget/view creation.

Capabilities outside the implemented agent runtime API set are not smoke
targets. If a future `agent.*` capability is present but no safe smoke case
exists yet, it is marked `skipped`. Queue app capability smoke is later adapter
work and is not covered by this runner.

The Workspace Agent `Run Agent Self-Test` action now makes the peer/API smoke
foundation visible through a structured Workspace Agent report. That UI action
also layers current capability-context, manifest, widget-contract, Queue
dry-run, and restricted Codex/shell checks outside this pure multi-agent
runtime model.

## Agent-Executed Smoke Inputs

The unified Agent-executed Smoke Report foundation may use this runtime's
agent APIs and peer self-test as safe inputs. It can read agent status,
bounded history, capability manifests, send typed internal self-test messages,
and invoke the peer self-test helper as model evidence. These inputs remain
pure frontend checks: they do not execute broker actions, call shell or Codex,
mutate Queue, launch Terminal, mutate Git, execute rollback, start workers, or
parse user prompts through natural-language regex routing.

## Capability Broker Boundary

App control outside the pure peer-runtime model must happen through:

`user prompt + Hobit app context + capability manifest -> typed capability selection -> Action Broker policy/schema/side-effect validation -> internal app API -> structured result/activity/audit`

Broker/module action results use the module-neutral action status taxonomy
(`succeeded`, `invalid_input`, `needs_confirmation`, `policy_blocked`,
`blocked`, `blocked_actionable`, `already_exists`, `already_done`,
`already_failed`, `precondition_failed`, `unavailable`, `paused`, and
`failed_unexpected`) plus typed `reasonCode` where practical. These statuses
are distinct from pure multi-agent runtime statuses such as `idle` or
`running`. Future workflow runners must use structured status/reason fields
and validated generic `nextAction`, not prose reason strings or agent message
text. `nextSuggestedCapability` is human/UI compatibility context only and is
not executable without a schema-valid `nextAction`; missing, ambiguous, or
invalid follow-ups use structured `nextActionUnavailable` metadata.

App control must not be implemented as:

`user text -> regex classifier -> product action`

Module functionality exposed to agents must be described through a
`ModuleControlSurface` before it becomes part of the generic control plane.
The surface is metadata only: it names the module, typed capabilities, future
typed workflows, risk and confirmation policy, actor/default context,
backend-backed versus transitional backing status, and UI dependency policy.
Queue is the reference rich-metadata module: its generic capability metadata is
adapted from the Queue capability contract inventory, not from Queue UI, and
preserves risk, confirmation, actor context, and transitional labels without
changing execution behavior. Queue is also the first reference module for
generic `nextAction` validation. Queue workflows remain future/empty until
typed workflow request contracts exist.
`ModuleControlSurfaceRegistry` is the discovery layer for these agent-facing
module surfaces. Queue is the first registered module. The registry is
metadata only, is not runtime behavior, and must stay UI-independent. Widgets
are render/control surfaces, not executable module APIs. Knowledge, Notes,
Terminal, and future modules should register later without importing UI
components or React state.

Codex and shell remain restricted explicit execution capabilities for
workspace/code execution requests. They are not used for agent-to-agent runtime
tests or ordinary in-app agent communication.
