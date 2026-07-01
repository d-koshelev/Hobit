# Queue System Architecture Reset

## Purpose

This document resets the Queue / Workspace Agent architecture after repeated
one-step dogfooding failures. It is an architecture correction and planning
document, not a UI migration, scheduler design, validation runner, Git flow,
rollback flow, Terminal integration, or hidden automation grant.

Use this together with `docs/QUEUE_WORKFLOW_ORCHESTRATION_CONTRACT.md`.
`docs/QUEUE_BACKEND_OWNERSHIP_CONTRACT.md` remains the current ownership
boundary for implemented backend-backed Queue capabilities.

## Root Causes

The failures were not independent defects. They came from the same design
shape:

- Queue truth was split across backend aggregate state, frontend bridge
  summaries, frontend lifecycle overlays, Queue UI view models, and prompt
  instructions.
- The system had capability-local rules but no workflow-level orchestration
  contract for action phases, risk classes, continuation, confirmation,
  blockers, and durable state.
- `nextSuggestedCapability` was treated as almost executable in places even
  though it lacks target input and schema validation.
- `nextAction` existed but was not the single machine continuation contract
  everywhere.
- Auto-continuation policy duplicated capability metadata through a static
  allowlist, so valid actions had to be patched in one at a time.
- Result statuses mixed ordinary failure, blocked-but-actionable state,
  confirmation-required state, duplicate-action state, and invalid-input state.
- The Workspace Agent prompt carried too much procedural prose, which made the
  model guess field names and workflow steps instead of following executable
  schema.
- Canonical field names were inconsistent at boundaries, especially
  `messageId` versus compatibility `reviewMessageId`, and `approvalPolicy`
  enum spelling.
- Frontend controller state still represented Queue enablement and transitional
  lifecycle decisions while backend aggregate state owned durable review,
  evidence, completion, failure, and dependencies.
- Tests proved many local handlers but did not yet prove the whole Queue
  workflow invariant from typed result to typed next action to backend
  precondition.

## Correct Layer Responsibilities

Backend/domain:

- Own Queue aggregate truth, legal transitions, command preconditions,
  blockers, durable evidence, review, completion, failure, and dependency
  state.
- Build next actions from backend-readable state without UI assumptions.
- Reject missing ids, wrong ids, unsupported enum values, unsafe transitions,
  and invalid confirmation tokens.

Storage:

- Persist durable Queue rows and ledgers: tasks, dependencies, run links,
  worker evidence, review messages/ACKs, completion decisions, and failure
  decisions.
- Store facts only. Do not infer product state outside domain services.

Tauri/API:

- Expose typed DTOs and commands over backend services.
- Avoid React, Queue UI modules, frontend overlays, and view models.

Broker/capability adapters:

- Translate typed `hobit.action.request` input into typed backend or bridge API
  calls.
- Validate schema, canonical fields, enum values, confirmation shape, and
  registered capability ids.
- Propagate validated `nextAction` payloads when all required target input is
  known.
- Never invent domain truth, ids, confirmation, or lifecycle state.

Workspace Agent runtime:

- Accept product actions only from structured `hobit.action.request`.
- Continue only from structured `hobit.action.result`, validated `nextAction`,
  and policy.
- Require `hobit.final.answer` for final action-mode completion.
- Never route natural language phrases into Queue actions.

Frontend/UI:

- Render authoritative DTOs and collect explicit operator input.
- Own only loading, selection, focus, display, and transitional compatibility
  presentation state.
- Never use overlays, selected-task detail, board lanes, or local UI state as
  product truth for backend-backed behavior.

Docs/tests:

- Prefer executable contracts and guard tests over repeated narrative examples.
- Keep one compact source for exact capability contracts and reference it from
  prompts and status docs.

## Current Violations And Debt

- `queue.coordinator.approveValidation`,
  `queue.coordinator.addFollowUpPrompt`, and `queue.item.block` remain
  frontend/controller overlay writes.
- Queue enable/active state is still exposed through the typed frontend Queue
  bridge, not a durable backend Queue state command.
- Some DTOs keep compatibility `reviewMessageId` guards for completion/failure
  while `messageId` is the canonical ACK and next-action field.
- Queue UI still has transitional evidence/lifecycle labels that must not be
  treated as product truth.
- Older status and smoke docs repeat boundary rules that should now point to
  the ownership and workflow contracts.

## Overengineering

- Too many docs restated the same Queue truth rule with slightly different
  wording.
- Capability descriptions were repeated in manifests, prompts, status docs,
  smoke checklists, and tests instead of being generated or asserted from a
  compact contract inventory.
- Frontend adapter code mixed backend-backed commands and transitional overlay
  commands in one broad bridge.
- Prompt text compensated for missing workflow contract by listing long
  step-by-step instructions.
- Static auto-continuation allowlists duplicated capability metadata and
  encouraged one-off patches.
- Fake/self-test stores modeled product flows deeply enough to blur whether
  backend durability was real.

## Under-Designed Contracts

- Queue workflow phases and legal transition categories.
- Queue action risk classes and continuation policy.
- Bounded Queue autonomy grant shape.
- Canonical id field dictionary.
- Domain result status taxonomy, especially `blocked_actionable` versus
  `failed`.
- First-class typed `nextAction` validation and agreement with
  `nextSuggestedCapability`.
- Headless workflow tests for success, failure, blocked dependency, and
  downstream unblocking paths.

## Target Workflow Model

The dogfooding workflow should converge to this shape:

1. Read backend aggregate state.
2. Emit or select one typed next action.
3. Validate action schema and risk class.
4. Require structured confirmation or structured grant where policy demands it.
5. Execute the typed backend or bridge command.
6. Return typed result with updated aggregate state and a validated
   `nextAction` only when the next target input is complete and safe.
7. Stop with `hobit.final.answer` or a typed blocker when no safe continuation
   exists.

No step may infer ids, permission, confirmation, or action choice from prose.

## Current Backend-Backed Capabilities

- `queue.items.list`
- `queue.lifecycle.get`
- `queue.lifecycle.agentFinished`
- `queue.review.getEvidenceBundle`
- `queue.review.createMessage`
- `queue.review.ack`
- `queue.item.markDone`
- `queue.item.fail`

These must use backend/domain/Tauri APIs or the typed backend capability port.

## Current Transitional Capabilities

- `queue.item.block`
- `queue.coordinator.addFollowUpPrompt`
- `queue.coordinator.approveValidation`

These are not backend truth, not auto-continuation safe, and must remain
explicitly classified until durable backend commands replace them.

## Risk-Class Policy Proposal

Queue capabilities are classified as:

- `read`: non-mutating aggregate/evidence/self-test reads.
- `setup`: task creation, run settings, draft promotion, Queue enablement.
- `run_start`: explicit start of one Queue-linked Direct Work run.
- `worker_evidence`: durable worker evidence recording.
- `review`: review message create/ACK.
- `final_accept`: accepted completion.
- `terminal_fail`: terminal failure.
- `block`: task block decision.
- `follow_up`: follow-up prompt/attempt creation.
- `validation_decision`: validation approval/rejection decision.
- `forbidden`: prohibited or unsupported action.

Default auto-continuation may only consider registered capabilities whose
contract says `autoContinuationSafe=true`, whose risk class is safe for the
current policy, whose payload validates, and whose action requires no
confirmation. A structured workflow grant may narrow or extend allowed risk
classes later, but it must be typed, bounded, auditable, and unable to bypass
backend preconditions or structured confirmation.

## Immediate Next Implementation Blocks

1. Workspace Agent Queue Bounded Autonomy Policy MVP.
   - Replace remaining ad hoc continuation decisions with a typed grant model
     that is explicit, bounded, current-session scoped, and schema-only.
2. Queue Backend Block Command Contract MVP.
   - Move `queue.item.block` out of frontend overlays and into durable backend
     decision state, including dependency blocker propagation.
3. Queue Backend Follow-Up Attempt Model Audit / Contract MVP.
   - Decide the durable attempt/follow-up record shape before moving
     `queue.coordinator.addFollowUpPrompt` out of frontend overlays.

## What Must Not Be Done Anymore

- Do not add one-off allowlist entries for each newly valid Queue action.
- Do not execute from `nextSuggestedCapability` without a schema-valid
  `nextAction`.
- Do not rename or repair input fields in the runtime.
- Do not infer `taskId`, `runId`, `messageId`, `evidenceBundleId`, or
  `executorWidgetId` from prose, titles, prompts, UI selection, file paths,
  final messages, or repository roots.
- Do not treat prose such as "I confirm" as confirmation.
- Do not use frontend overlays, Queue board state, or selected UI detail as
  backend-backed product truth.
- Do not add hidden Git mutation, validation execution, rollback execution,
  Terminal launch, raw shell/Codex fallback, hidden worker start, or scheduler
  redesign as a Queue workflow workaround.
- Do not add another Queue UI surface. Queue remains singleton per Workspace.

