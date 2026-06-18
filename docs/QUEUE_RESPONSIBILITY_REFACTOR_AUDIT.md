# Queue Responsibility Refactor Audit

## Backend/Domain Responsibilities

- Own Queue business truth, aggregate state, lifecycle preconditions, durable
  review state, durable worker evidence state, dependency-derived read state,
  and capability/API semantics.
- Require explicit task identity for Queue reads/writes and explicit task/run
  identity for worker completion.
- Expose honest `not_durable`, `unknown`, unavailable, and blocker states
  instead of consulting frontend overlays.

## Storage Responsibilities

- Persist Queue task rows, compatibility dependency ids, run links, review
  message/ACK ledger rows, and worker evidence bundles.
- Preserve reload/headless behavior independent from frontend UI state.

## Tauri/API Responsibilities

- Serialize typed backend DTOs and command results for aggregate list/get,
  review create/ACK, worker finished, and evidence bundle readback.
- Keep commands explicit, bounded, non-hidden, and free of UI imports or React
  state.

## Workspace Agent/Broker Responsibilities

- Accept only structured `hobit.action.request` envelopes for product actions.
- Invoke typed Queue handlers and policy checks.
- Use the Queue backend API port for backend-backed capabilities.
- Never infer `taskId`, `runId`, executor ids, or capability ids from prose,
  titles, paths, final messages, repository roots, or prompt text.

## Frontend API Wrapper Responsibilities

- Provide typed wrappers over Tauri/backend APIs and browser unavailable/fallback
  behavior.
- Bridge worker evidence and review APIs into the Workspace Agent broker path.
- Avoid owning lifecycle or evidence truth.

## UI Responsibilities

- Render authoritative DTOs and local loading/selection/display state.
- Collect explicit operator input for transitional controls.
- Treat current dogfood lifecycle/evidence overlays as transitional
  compatibility only, not product truth.

## Test Responsibilities

- Rust backend tests prove aggregate/review/evidence contracts headlessly.
- Tauri tests prove typed command/DTO behavior without launching Queue UI.
- Frontend broker tests prove Queue adapters do not import Queue UI modules and
  backend-backed capabilities use backend APIs.
- Prompt/protocol tests prove structured action requests, unique request ids,
  registered capability ids, and no stale `queue.lifecycle.getEvidenceBundle`.

## Transitional Debt

| Capability | Current Owner | Why Transitional | Correct Owner | Next Block | Tests Needed |
| --- | --- | --- | --- | --- | --- |
| `queue.coordinator.approveValidation` | Frontend lifecycle overlay | No durable validation decision/evidence command. | Backend Queue validation/coordinator service. | Add typed validation approval command and aggregate state. | Service/Tauri/broker tests proving durable decision and no overlay read. |
| `queue.coordinator.addFollowUpPrompt` | Frontend lifecycle overlay | No durable follow-up prompt/attempt command. | Backend Queue coordinator/follow-up service. | Add follow-up command, storage row/read model, and broker port method. | Headless create/read tests plus adapter no-overlay test. |
| `queue.item.markDone` | Frontend overlay with fake commit placeholder | No durable accepted-completion/finalization command. | Backend Queue finalization service. | Add mark-done command requiring explicit review/validation/commit references. | Done gate/dependency tests, no Git mutation, explicit task id. |
| `queue.item.block` | Frontend lifecycle overlay | No durable coordinator block command. | Backend Queue coordinator decision service. | Add block command and aggregate blocker/dependency propagation. | Headless block and downstream blocker tests. |
| `queue.item.fail` | Frontend lifecycle overlay | No durable terminal failure command. | Backend Queue coordinator decision service. | Add fail command and aggregate failed-upstream propagation. | Headless fail/dependency tests, no rollback/Git/Terminal. |

## Overengineering List

- Long duplicated Queue ownership paragraphs across status, contract, and smoke
  docs made the true boundary harder to find.
- Broker adapter mixed backend-backed commands with transitional lifecycle
  controller wiring in one bridge adapter.
- Workspace Agent prompt text repeated intermediate-result guidance in prose
  that could be mistaken for an acceptable model output.
- Existing UI evidence overlays remain useful for compatibility but are now
  over-scoped if treated as product state.

## Text/Documentation Cleanup List

- Keep backend ownership in `docs/QUEUE_BACKEND_OWNERSHIP_CONTRACT.md`.
- Keep this audit as the short refactor status record.
- Existing Queue lifecycle/status/smoke docs should link to the ownership
  contract and avoid restating large ownership sections.
- Prompt text should say to emit a structured envelope or final marker, not to
  write intermediate waiting prose.

## Immediate Refactor Performed

- Added a typed frontend Queue backend capability port for broker adapters.
- Routed backend-backed Workspace Agent Queue capabilities through that port.
- Added missing stable broker bridge proxies for worker-finished and evidence
  bundle APIs.
- Added guard tests for Queue adapter/UI import separation, backend-port use,
  registered `nextSuggestedCapability` ids, and stale capability ids.
- Compact Workspace Agent instruction text and guarded against the stale
  intermediate-result phrase.

## Remaining Phased Cleanup Plan

1. Move validation approval to a durable backend command and aggregate readback.
2. Move follow-up prompts to backend-owned attempts/follow-up records.
3. Move mark-done/fail/block to backend coordinator/finalization commands.
4. Migrate Queue details/cards to render authoritative aggregate/evidence DTOs
   directly and remove overlay-derived product labels.
5. Split the bridge adapter further only if the transitional commands keep
   obscuring backend-backed ownership.
6. Replace repeated Queue status prose in older docs with links to the compact
   ownership contract as touched by future focused blocks.
