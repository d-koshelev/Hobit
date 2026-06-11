# Self-Development Readiness Status

## Status

Status: docs-only readiness record after the self-development smoke fixture,
focused tests, and manual checklist definition.

This document does not add frontend behavior, backend/runtime behavior,
storage/schema changes, Queue scheduling, Agent Executor execution, validation
automation, Diff Review execution, Git mutation, Terminal launch, provider
tools, automatic finalization, automatic commit, push, rollback, or dependency
execution. Current implemented widget behavior remains governed by
`docs/CURRENT_WIDGET_SURFACE.md`.

## Implemented Readiness Pieces

- Prompt-pack fixture:
  `apps/desktop/frontend/src/workbench/promptPack/fixtures/self-development-smoke-prompt-pack/`
  contains a small local deterministic pack with `prompt-batch.json`, a
  docs-only task, and a dependent follow-up task. The fixture includes
  validation command suggestions, expected commit titles, allowed/forbidden
  scope metadata, manual execution policy intent, and explicit dependency
  metadata.
- Import-to-Queue smoke: focused frontend tests parse the fixture, preview the
  import, create draft/manual Queue items only after confirmation, preserve
  prompt-pack metadata in visible Queue task text, link dependencies through
  the existing Queue update bridge where supported, and assert no Queue run,
  start, or Autorun control is called.
- Validation plus Diff Review smoke:
  `diffReviewValidationEvidenceSmoke.test.ts` drives the fixture through
  Queue materialization, mock implementation report attachment, explicit
  validation evidence attachment, Diff Review input snapshot resolution, and
  creation of an independent read-only Diff Review Queue item without starting
  execution or finalization.
- Coordinator finalization plus dependency gate smoke: coordinator model,
  finalization service, dependency controller, and QueueV2 tests cover commit
  hash/title validation, generic title rejection, validation/Diff Review
  acceptance blockers, explicit accept-without-commit, request-changes and
  rollback-required states, and dependent readiness only after accepted
  coordinator finalization.
- Manual UI checklist:
  `docs/SELF_DEVELOPMENT_READINESS_MANUAL_SMOKE.md` defines the desktop UI
  smoke from Workspace Agent prompt-pack import through QueueV2 metadata,
  validation evidence, Diff Review creation, coordinator finalization, and
  dependency gate verification.

## Current Readiness Level

Hobit is ready for narrow self-development dogfooding on small, low-risk
Hobit doc/test tasks where the operator keeps control of every step.

Safe now:

- use Workspace Agent / Workspace Chat to explicitly import the smoke
  prompt-pack fixture or an equivalent small local prompt pack;
- create Queue items through the existing Queue path only after preview and
  confirmation;
- use QueueV2 to inspect imported tasks, dependency cues, validation metadata,
  Diff Review state, coordinator state, and next-action guidance;
- request validation explicitly when the desktop validation runner and
  execution workspace are available;
- create a read-only Diff Review Queue item explicitly from visible
  report/evidence state;
- finalize a source task explicitly as accepted without commit for a true
  no-change/status-only task, or accepted with an operator-supplied existing
  commit hash/title.

Still needs manual operator confirmation:

- prompt-pack import preview and Queue item creation;
- any Queue run or Agent Executor start;
- validation request and review of capped validation output;
- Diff Review item creation and any later execution of that review item;
- coordinator finalization decision, no-commit reason, or supplied commit
  hash/title;
- readiness of dependent tasks after finalization;
- any Git review, commit creation, push, rollback, or follow-up task creation.

Unsupported or unverified:

- full desktop manual smoke has not been recorded as passed in this status
  document;
- live Git diff snapshot support may be unavailable without an explicit repo
  root/execution workspace or where untracked patch previews are needed;
- real Git commit lookup for supplied commit hashes remains a follow-up when
  unavailable;
- rollback remains a visible decision/follow-up marker, not an executable
  rollback workflow;
- durable first-class Queue fields for prompt-pack, validation, Diff Review,
  finalization, dependency, and commit metadata remain limited by the current
  Queue DTO/storage shape;
- browser/Vite fallback cannot run local validation commands;
- no end-to-end desktop e2e automation exists for the visible UI path.

## Safety Guarantees

- No auto-run: imported Queue tasks are draft/manual and do not start on
  import, validation, Diff Review creation, or coordinator finalization.
- No auto-commit or auto-push: commit hashes are supplied/reviewed metadata
  only; Hobit does not create commits or push from this smoke path.
- No hidden background execution: Queue execution, validation, Diff Review,
  and Executor work require visible operator action through existing controls.
- Coordinator finalization is required: validation and Diff Review are evidence
  only and do not accept/finalize work by themselves.
- Dependent tasks are gated: a dependent task is not ready merely because the
  prerequisite exists, completed, passed validation, or has a Diff Review item;
  it becomes ready only after accepted coordinator finalization of the
  prerequisite.

## Recommended Next Work

1. Run the manual smoke in the Tauri desktop shell and record date, branch,
   Workspace, unavailable states, and pass/fail notes.
2. Add rollback/follow-up hardening so rollback-required and requested-changes
   outcomes can create explicit follow-up records without executing rollback.
3. Add live Git diff snapshot support where missing, using only explicit
   repository roots and read-only Git operations.
4. Pilot self-development on one small Hobit doc/test task using the same
   boundary: prompt-pack import, explicit Queue review, explicit validation,
   explicit Diff Review, explicit coordinator finalization, and no automatic
   commit/push/run behavior.

## Relevant Commands

Repository status and patch checks:

```powershell
git status --short --branch
git diff --stat
git diff --check
```

Focused frontend smoke tests:

```powershell
npm.cmd run test --prefix apps/desktop/frontend -- src/workbench/promptPack/promptPackMaterialization.test.ts src/workbench/InteractiveAgentPromptPackImport.test.tsx src/workbench/diffReview/diffReviewValidationEvidenceSmoke.test.ts src/workbench/coordinator/coordinatorFinalizationModel.test.ts src/workbench/queue/queueCoordinatorFinalizationService.test.ts src/workbench/queue/useAgentQueueController.dependencies.test.tsx src/workbench/widgetV2/queueV2/QueueV2CoordinatorFinalization.test.tsx
```

Broader frontend checks when preparing acceptance:

```powershell
npm.cmd run typecheck --prefix apps/desktop/frontend
npm.cmd run test --prefix apps/desktop/frontend
```

## Current Conclusion

Self-development readiness is partial but usable for controlled dogfooding.
The safe boundary is explicit, operator-driven Queue work on small Hobit
doc/test tasks with visible validation and review evidence. The project should
not treat this as autonomous self-development, durable scheduler readiness,
automatic acceptance, rollback readiness, or Git automation readiness.
