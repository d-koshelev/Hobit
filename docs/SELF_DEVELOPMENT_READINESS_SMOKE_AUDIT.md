# Self-Development Readiness Smoke Audit

## Status

Status: docs-only functional audit for
`SELF-DEVELOPMENT-READINESS-SMOKE-AUDIT-01`.

This audit defines the smallest safe smoke that can prove Hobit can start
dogfooding Hobit work through the current Workspace Agent / Workspace Chat,
Agent Queue / QueueV2, validation evidence, Diff Review, and coordinator
finalization path.

This document does not add frontend behavior, backend/runtime behavior,
storage/schema changes, Queue scheduling, Agent Executor behavior, validation
execution automation, Diff Review execution, Git mutation, Terminal launch,
provider tools, automatic finalization, automatic commit, push, rollback, or
dependency execution. Current implemented widget behavior remains governed by
`docs/CURRENT_WIDGET_SURFACE.md`.

## Inspected Status Documents

- `docs/PROMPT_PACK_IMPORT_QUEUE_STATUS.md`: prompt-pack import is explicit
  Workspace Chat / Workspace Agent UI. It parses pasted manifest or numbered
  Markdown text, previews Queue drafts, creates draft/manual Queue items only
  after confirmation, attempts dependency links through the existing Queue
  update bridge, preserves metadata in visible task text, and does not run,
  validate, finalize, commit, push, or arm Autorun.
- `docs/WORKSPACE_CHAT_QUEUE_CONTROL_STATUS.md`: Workspace Chat can use typed
  Queue action cards over existing Queue APIs. Create/open/run/review actions
  are explicit and unsupported actions return visible unavailable states.
- `docs/VALIDATION_RUNNER_EVIDENCE_STATUS.md`: validation is an explicit typed
  Queue capability. It uses structured commands, caps output, attaches
  validation evidence through existing Queue report/update state, and does not
  finalize, accept, commit, push, or start dependents.
- `docs/DIFF_REVIEW_WORKFLOW_STATUS.md`: Diff Review is an explicitly created
  independent Queue item with read-only/default review prompt scope. Creation
  does not run review, read Git automatically, finalize source work, unblock
  dependents, commit, push, or roll back.
- `docs/COORDINATOR_FINALIZATION_COMMIT_HASH_STATUS.md`: coordinator
  finalization is an explicit closure step. Validation and Diff Review are
  evidence only. Dependency readiness requires completed and coordinator
  finalized prerequisites.
- `docs/QUEUE_V2_REPLACE_V1_STATUS.md`: QueueV2 is now the Agent Queue surface
  over existing Queue API/runtime/storage semantics. It preserves explicit
  actions and does not add hidden scheduling or automation.

## Existing Coverage Summary

Prompt-pack import is covered by focused frontend tests:

- `promptPackParser.test.ts` covers JSON and numbered Markdown parsing,
  dependencies, validation commands, expected commit title, duplicate ids, and
  missing body diagnostics.
- `promptPackImportPreview.test.ts` and
  `PromptPackImportPreview.test.tsx` cover preview summaries, blocking
  diagnostics, dependency graph shape, unavailable folder/zip state, and
  no-create preview rendering.
- `promptPackMaterialization.test.ts` covers creating Queue tasks first,
  linking dependencies by created Queue ids, preserving unsupported metadata,
  not calling run/start/Autorun, partial failure, and blocking invalid or
  unconfirmed previews.
- `WorkspaceAgentPromptPackImportCard.test.tsx` and
  `InteractiveAgentPromptPackImport.test.tsx` cover the Workspace Chat import
  card, explicit confirmation, cancellation, created ids, and no Queue run.

Workspace Chat Queue control is covered by
`workspaceChatQueueControlService.test.ts`, including create-task mapping to
the existing Queue bridge, unavailable validation states, explicit validation
request, no action on service construction, no auto-run after create,
selected-task run through the existing callback, explicit Diff Review creation,
and rollback-required marker behavior.

Validation Runner / Evidence is covered in two layers:

- `crates/hobit-app/src/workspace_service/agent_queue_validation_runner_tests.rs`
  covers explicit runner invocation, output capping, failed exit codes,
  timeouts, unsupported cancellation warning, blocking unsafe commands, and
  requiring cwd inside the task execution workspace.
- `apps/desktop/src-tauri/src/validation_runner_commands.rs` has DTO mapping
  coverage for Tauri validation requests.
- `queueValidationEvidenceService.test.ts`,
  `WorkspaceAgentQueueTaskStatusCard.test.tsx`, and `QueueV2Board.test.tsx`
  cover evidence attachment, passed/failed/stale states, capped evidence,
  unsupported runner state, explicit Run validation, no finalization, and
  QueueV2 evidence display.

Diff Review is covered by focused frontend tests:

- `diffReviewInputSnapshotResolver.test.ts` covers snapshots from task,
  report, validation, prompt-pack, and diff metadata, plus explicit warnings
  for missing validation or live diff.
- `diffReviewModel.test.ts` covers the default checklist, read-only prompt,
  missing-evidence findings, and stable recommendation summaries.
- `diffReviewQueueItemCreation.test.ts` covers creating an independent
  read-only Diff Review Queue item through the existing create action,
  warnings for missing inputs, no start/accept/finalize/unblock actions, and
  Queue create failure reporting.
- `WorkspaceAgentQueueTaskStatusCard.test.tsx` and `QueueV2Board.test.tsx`
  cover explicit Diff Review creation from Workspace Chat / QueueV2 surfaces
  and linked-review display.

Coordinator finalization and dependency gating are covered by:

- `coordinatorFinalizationModel.test.ts`, including commit hash/title
  validation, generic title rejection, prompt-pack expected title checks,
  validation/Diff Review acceptance blockers, and dependent unblocking only
  for accepted finalized decisions.
- `queueCoordinatorFinalizationService.test.ts`, including storing commit
  info without mutating Git, accept-without-commit reason storage,
  request-changes and rollback-required keeping dependents blocked, all
  prerequisites finalized for readiness, unsupported field warnings, and
  explicit follow-up creation without running it.
- `useAgentQueueController.dependencies.test.tsx`, including blocked then
  allowed readiness when a dependency is coordinator accepted, blocked
  readiness for non-accepted coordinator states, dependency edits not starting
  Executor work, Autorun arming blocked when dependencies are blocked, and
  delete protection for referenced prerequisites.
- `QueueV2CoordinatorFinalization.test.tsx`,
  `WorkspaceAgentQueueTaskStatusCard.test.tsx`, and
  `AgentQueueV2ActionParity.test.tsx`, covering UI action availability,
  explicit clicks, confirmation gates, disabled reasons, and no implicit runs.

Coverage gap: there is no single service/model-level smoke test today that
drives the whole self-development path with one shared fixture from
prompt-pack import through Queue item creation, validation evidence, Diff
Review item creation, coordinator finalization, and dependent readiness.

## Minimal Safe Smoke Fixture

Use one pasted `prompt-batch.json` fixture. The fixture is intentionally
docs-only, local, deterministic, and safe.

```json
{
  "pack_id": "hobit-self-development-smoke",
  "pack_name": "Hobit Self-Development Smoke",
  "dependency_policy": "explicit",
  "items": [
    {
      "id": "001-docs-noop",
      "title": "docs: smoke no-op readiness note",
      "body": "Docs-only smoke task. Inspect the self-development readiness audit fixture and report that no source changes are required. Do not edit source code, tests, runtime, storage, or UI.",
      "priority": "normal",
      "dependencies": [],
      "model_profile": "standard",
      "reasoning_effort": "medium",
      "validator_profile": "standard",
      "execution_workspace": ".",
      "validation_commands": [
        "git status --short --branch",
        "git diff --check"
      ],
      "expected_commit_title": "docs: smoke no-op readiness note",
      "allowed_scope": [
        "docs/SELF_DEVELOPMENT_READINESS_SMOKE_AUDIT.md"
      ],
      "forbidden_scope": [
        "apps/**",
        "crates/**",
        "scripts/**",
        "Cargo.toml",
        "package.json"
      ],
      "tags": [
        "self-development",
        "smoke",
        "docs-only"
      ]
    },
    {
      "id": "002-dependent-gate",
      "title": "docs: verify dependent readiness gate",
      "body": "Dependent smoke task. Confirm this item stays blocked until task 001 is completed and explicitly coordinator-finalized. Do not run automatically and do not edit source code.",
      "priority": "normal",
      "dependencies": [
        "001-docs-noop"
      ],
      "model_profile": "standard",
      "reasoning_effort": "medium",
      "validator_profile": "standard",
      "execution_workspace": ".",
      "validation_commands": [
        "git status --short --branch",
        "git diff --check"
      ],
      "expected_commit_title": "docs: verify dependent readiness gate",
      "allowed_scope": [
        "docs/SELF_DEVELOPMENT_READINESS_SMOKE_AUDIT.md"
      ],
      "forbidden_scope": [
        "apps/**",
        "crates/**",
        "scripts/**",
        "Cargo.toml",
        "package.json"
      ],
      "tags": [
        "self-development",
        "smoke",
        "dependency"
      ]
    }
  ]
}
```

Notes:

- The validation commands are harmless read/check commands. They do not write
  files, execute application runtime, run providers, launch Terminal, mutate
  Git, commit, push, reset, clean, stash, or checkout.
- Task 001 can be finalized as `accept_without_commit` only when the smoke is
  run as a true no-op, with reason `docs-only/no-op smoke; no commit created`.
  It can be finalized as `accept_with_commit` only when a separate explicit
  human-created commit already exists and its hash/title are supplied.
- Task 002 must remain blocked until task 001 is completed and explicitly
  coordinator-finalized.

## Automated Smoke Scope

Automate the service/model-level chain in a future thin test using existing
frontend services and test doubles:

1. Parse the fixture with the prompt-pack parser and build an import preview.
2. Materialize the preview through a fake existing Queue bridge that records
   Queue create/update calls and returns stable Queue ids.
3. Assert both tasks are draft/manual, task 002 depends on task 001, and
   prompt-pack metadata is preserved for validation commands, expected commit
   title, allowed scope, forbidden scope, and execution workspace.
4. Request validation for task 001 through the Queue validation evidence
   service with a fake validation runner returning passed evidence for
   `git status --short --branch` and `git diff --check`.
5. Assert validation evidence is attached to task 001 through the existing
   Queue update/report path, with capped output and `ai_context_status:
   not_approved` where represented.
6. Create a Diff Review item for task 001 through the existing Diff Review
   Queue item creation service, using the validation/report/prompt-pack
   snapshot and a fake Queue create bridge.
7. Assert the Diff Review item is independent, manual/read-only by prompt and
   item type, linked to task 001 where the model can preserve the link, and
   not run.
8. Attempt dependent readiness before finalization and assert task 002 is
   blocked by task 001 as `not_finalized`.
9. Finalize task 001 explicitly through the coordinator finalization service
   as `accept_without_commit` with a no-commit reason, or as
   `accept_with_commit` with a supplied fake valid commit hash/title.
10. Assert the finalization result stores decision metadata, dependency impact
    reports task 002 as ready, and no task is started.

The automated smoke should stay in the existing frontend model/service test
layer unless a later block explicitly adds a backend persisted fixture. It
should not add a second Queue store, runtime, scheduler, parser, validation
runner, Diff Review runtime, finalization table, or Git integration.

## Manual Smoke Boundary

Leave these checks as manual/browser/desktop smoke unless a later e2e harness
exists:

- Opening Workspace Agent / Workspace Chat and starting prompt-pack import from
  the visible UI.
- Verifying the import preview layout, disabled states, copy summary, cancel,
  and open-task controls.
- Verifying QueueV2 visual display of prompt-pack metadata, dependency cues,
  validation evidence, Diff Review linked markers, and coordinator state.
- Running the real desktop validation runner through Tauri, because browser
  fallback cannot execute local commands and desktop process execution is
  environment-dependent.
- Verifying no visible UI action arms Queue Autorun, launches Agent Executor,
  launches Terminal, creates a commit, pushes, or runs rollback.

## Readiness Criteria

The self-development smoke passes only when all criteria are true:

- Import preview works from the pasted fixture before Queue item creation.
- Queue items are created only after explicit confirmation.
- Imported Queue items are draft/manual and use the existing Queue path.
- Task 002 carries dependency metadata for task 001, and Queue state preserves
  the dependency where the existing update bridge supports it.
- Prompt-pack metadata is visible in QueueV2 without raw JSON as the normal
  metadata display.
- Validation commands are suggestions after import and execute only after
  explicit Run validation.
- Validation evidence attaches to task 001 through existing Queue
  report/update state.
- Diff Review item creation is explicit, creates an independent read-only
  Queue item, and does not run it.
- Coordinator finalization is explicit and records decision, optional commit
  hash/title, or no-commit reason.
- Task 002 readiness changes only after task 001 is completed and explicitly
  coordinator-finalized.
- Failed or missing validation/Diff Review evidence remains visible and does
  not fake success.
- No auto-run, auto-dispatch, auto-finalization, auto-commit, auto-push,
  rollback execution, Terminal launch, provider tool call, or hidden context
  access occurs anywhere in the smoke.

## Recommendation

Automate the service/model-level happy path and the dependency-gate assertion
next. That gives deterministic proof of the dogfooding chain without needing a
desktop runtime, local command execution, or browser interaction.

Keep UI and real Tauri validation as manual smoke for now. The current pieces
already have focused tests, but the project still needs one thin integrated
smoke test using the fixture above to prove the chain works as one operator
workflow.

Do not automate Git commit lookup, commit creation, push, rollback, Terminal,
provider execution, Agent Executor launch, Queue Autorun, or hidden context
reads for this readiness smoke.
