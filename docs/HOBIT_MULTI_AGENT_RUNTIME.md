# Hobit Multi-Agent Runtime

## Purpose

Define the frontend-only Multi-Agent Runtime MVP for Hobit in-app agents. This
model lets one Workspace host multiple addressable agent instances, inspect
agent status/history/capabilities, and exchange typed internal messages.

This contract does not implement LLM calls, Workspace Agent broker execution, Queue
capability adapters, app control actions, self-test UI, backend/Tauri/IPC
commands, storage/schema changes, shell execution, Codex execution, Terminal
runtime changes, Git behavior, scheduler behavior, worker behavior, rollback,
or Finder work.

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

## Capability Broker Boundary

App control outside the pure peer-runtime model must happen through:

`user prompt + Hobit app context + capability manifest -> typed capability selection -> Action Broker policy/schema/side-effect validation -> internal app API -> structured result/activity/audit`

App control must not be implemented as:

`user text -> regex classifier -> product action`

Codex and shell remain restricted explicit execution capabilities for
workspace/code execution requests. They are not used for agent-to-agent runtime
tests or ordinary in-app agent communication.
