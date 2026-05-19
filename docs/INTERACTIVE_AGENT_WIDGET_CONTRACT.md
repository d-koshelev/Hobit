# Interactive Agent Widget Contract

## Purpose

Interactive Agent is being repositioned into Coordinator Chat for the near-term
product direction.

The updated source of truth is
`docs/COORDINATOR_CENTERED_WORKBENCH_CONTRACT.md`: Coordinator Chat is the main
operator-facing AI chat, and Hobit should not keep separate freeform
Interactive Agent plus Coordinator concepts in the near-term product.

This contract remains as compatibility context for the existing
`interactive-agent` widget id and local chat foundation. The user-facing
surface is now Coordinator Chat.

The previous Interactive Agent direction was a separate widget for manual
long-running work with an agent in a conversational session.

It is useful when the operator wants to explore a problem, ask follow-up
questions, reason with an agent, debug an issue, review code, understand a
system, or think through design options over a longer conversation.

This contract is docs-only. It does not implement frontend UI, runtime behavior,
provider integration, Tauri commands, storage/schema changes, queue execution,
Agent Executor integration, Runbook integration, Git mutation, Terminal
execution, PTY, or an interactive process/session.

## One-Sentence Role

Coordinator Chat: understand, plan, propose controlled widget actions, and
interpret results.

## What Interactive Agent Is

Compatibility-only Interactive Agent is:

- a current Workbench widget identity that may be reused temporarily
- a manual conversation surface
- a place for operator-driven messages and agent responses
- a long-chat/work session that feels closer to working with Codex CLI on a
  problem than launching a single queued task
- useful for exploration, debugging, design thinking, code review, and issue
  understanding
- potentially backed by a current-session transcript first, with persistent
  transcript storage only when explicitly scoped
- a future minimal foundation for Coordinator Chat

The operator controls what is sent, what context is included, and what follow-up
action happens after the conversation.

Near-term product work uses the Coordinator Chat language and capability model
instead of adding a second separate chat surface.

## What Interactive Agent Is Not In V1

Interactive Agent is not:

- Agent Queue
- Agent Executor
- Runbook
- a second separate Coordinator surface
- a task scheduler
- an automatic executor
- queue dispatch
- Agent Queue run history
- an approval/apply workflow
- automatic Git, Terminal, filesystem, Notes, or workspace mutation

Interactive Agent/Coordinator Chat v1 must not automatically create queue
items, dispatch tasks, launch Agent Executor runs, execute Runbook steps, run
Terminal commands, mutate Git, read hidden filesystem context, or apply
changes.

## Relationship To Agent Executor

Agent Executor runs tasks.

Interactive Agent talks through problems.

Interactive Agent can help the operator think, discuss, refine a prompt, inspect
tradeoffs, or decide what work should happen next, but it must not execute
queued tasks in v1.

Future possible integrations:

- convert a selected conversation outcome into an Agent Queue item
- send a selected prompt to Agent Executor
- link Git Widget context to an Interactive Agent conversation

Those integrations are future work and must be explicit, operator-controlled,
and separately scoped.

Near-term Coordinator action proposal UI should start as message-associated,
inert proposal cards. The first safe handoff target is approved Queue task
creation. Agent Executor run launch remains out of the first proposal UI slice.

## Relationship To Agent Queue

Interactive Agent v1 must not:

- automatically create queue items
- write queue history
- dispatch queue tasks
- treat conversation messages as queued commands
- imply that Queue execution exists

Future behavior may allow the operator to choose `Create queue item from
conversation`, but that must be a visible handoff with a previewed queue item.
It is not part of the MVP.

## Relationship To Runbook

Interactive Agent v1 is not Runbook step execution.

Runbook remains the step-based procedural surface for explicit step state,
evidence, and future step assistance. Interactive Agent remains a manual
conversation surface.

Future behavior may allow a Runbook step to ask Interactive Agent for help, but
that must be an explicit integration and is not part of the MVP.

## Relationship To Git Widget

Near term, Git Widget stays independent.

Interactive Agent must not perform Git mutations, stage files, commit, push,
reset, clean, stash, or apply Git changes. Git Widget remains the review/control
surface for repository state and is currently read-only.

Future behavior may link Git Widget context to Interactive Agent, but that is
not part of the MVP.

## MVP Behavior

### Minimal

The first implementation target should be a minimal local chat surface:

- message list
- input box
- clear manual-session status copy
- no queue integration
- no Agent Executor integration
- no Runbook integration
- no tool execution
- no file mutation
- no Git mutation
- no persistent storage unless trivial and explicitly scoped

The Minimal UI should honestly represent whether responses are local/mock,
provider-backed, or unavailable.

### Operational Later

Operational behavior may add:

- session persistence
- explicit context selection
- Codex or agent backend integration
- transcript export
- handoff to Agent Executor

Each item requires a focused block and must preserve visible context, explicit
operator control, and no hidden mutation.

### Full / Expert Later

Full / Expert behavior may add:

- multiple sessions
- attachments or context packs
- tool proposals
- conversation-to-runbook conversion
- conversation-to-queue conversion
- raw provider/debug inspection behind explicit expansion

Full / Expert behavior must not become the default first surface.

## Safety Rules

Interactive Agent must be explicit about:

- what context is included
- whether an agent provider is connected
- whether a response is local/mock/provider-backed
- whether a transcript is persisted or current-session only
- what action, if any, the operator is about to hand off

Interactive Agent must not:

- read hidden repository, filesystem, Git, Terminal, Notes, Queue, Runbook, or
  widget context
- silently attach secrets or environment data
- execute commands
- mutate files
- mutate Git
- create queue items automatically
- launch Agent Executor automatically
- apply proposals automatically

Agent proposes; operator controls.

## UI Guidance

For the v1 placeholder or Minimal UI:

- keep the surface simple and chat-shaped
- use short copy
- show manual-session status plainly
- avoid disabled future-control clutter
- do not include queue, executor, runbook, monitoring, Git mutation, or terminal
  controls
- do not show raw debug/provider payloads by default
- do not imply tool execution or background agent work exists

The widget should follow `docs/WIDGET_PROGRESSIVE_DISCLOSURE_CONTRACT.md` and
start at Minimal unless a later prompt explicitly targets Operational or Full /
Expert.

## Recommended Next Blocks

- Coordinator local action proposal card UI, frontend-only/inert.
- Coordinator proposal to create Agent Queue task with explicit approval.
- Later Coordinator Chat session persistence.
- Later Coordinator Chat provider/Codex integration.
- Later optional handoff to Agent Executor after a separate safety/design slice.

## Non-Goals

This contract does not implement:

- frontend UI
- runtime behavior
- provider or LLM integration
- Codex execution
- Agent Executor integration
- Agent Queue integration
- Runbook integration
- storage/schema changes
- Tauri commands
- Git mutation
- Terminal execution
- commit, push, stage, reset, clean, or stash
- PTY or interactive process/session implementation
