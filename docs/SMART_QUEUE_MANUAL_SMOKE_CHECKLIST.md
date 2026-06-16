# Smart Queue Manual Desktop Smoke Checklist

## Purpose

Manual desktop checklist for the current Smart Queue frontend checkpoint. This
checklist does not claim durable backend Smart Queue runtime, scheduler,
rollback execution, Git/file mutation, Terminal launch, Workspace Agent
runtime auto-call, backend migrations, or storage schema changes.

Queue manual smoke should move toward peer, widget, and agent-executed smoke
models under `apps/desktop/frontend/src/workbench/agents/`. Those contracts can
describe safe self-tests and expected evidence. Workspace Agent now exposes a
visible `Run Agent Self-Test` action backed by the Agent-executed Smoke Report
foundation. It aggregates agent API smoke, peer self-test evidence, active
Widget Agent Contracts, Queue safe dry-run/self-test checks when available,
and hidden-side-effect assertions. Full Queue UI smoke is still manual until
broader Queue widget adapters and self-test coverage exist.

The current Agent API Smoke Runner remains only one input to the aggregate
report. By itself it checks only the implemented in-app agent runtime APIs for
status, bounded history, messaging, capabilities, and peer self-test. Queue,
Workspace Agent, Knowledge / Skills, Notes, Terminal, Finder exclusion, and no
hidden side effects are reported by the aggregate Workspace Agent self-test
surface.

Queue capability adapter smoke can now include the frontend Action Broker
handler boundary with an injected Queue adapter API and Workspace Agent
structured action-request path:

- `queue.targetSingletonQueue` resolves the singleton Queue target.
- `queue.createItems` dry-run returns a preview with no task creation.
- `queue.preparePromptPackPreview` returns Smart Queue materialization without
  mutation.
- `queue.selfTest` runs through the Action Broker and injected Queue adapter,
  reports singleton target, createItems dry-run, prompt-pack preview dry-run,
  no Queue mutation, no Queue worker start, no Queue view creation, and no
  hidden-side-effect evidence as separate rows.

Workspace Agent Codex Direct Work now receives Hobit capability context before
execution. The context tells the agent it is inside Hobit, operating from the
Workspace Agent surface, should use typed Hobit capabilities for app/product
actions, and should treat Codex/shell as restricted execution capabilities.
When the agent emits a valid `hobit.action.request` envelope, the frontend
Action Broker validates policy/schema/side effects and invokes Queue adapter
handlers. Natural-language Queue phrases are not regex-routed into actions.

## Setup

- Start Hobit from `C:\Users\Dmitry\Documents\prj\Hobit_fixed`.
- Open or create a Workspace.
- Keep screenshots available for any failed step.

## Expected Labels

During the smoke, verify these product labels appear where applicable:

- `Ready`
- `Waiting dependency`
- `Blocked: dependency failed`
- `Blocked: dependency blocked`
- `Needs decision: validation failed`
- `Retry available`
- `Approval required`
- `Destructive`
- `No rollback executed`
- `Queue self-test passed`
- `Queue dry-run preview prepared`
- `Singleton Queue target verified`
- `No Queue mutation`
- `No Queue worker start`
- `No Queue view creation`
- `Dry-run only`
- `Adapter not available`
- `Safe check skipped`

## Smoke Flow

1. Open the Widget Catalog and add Agent Queue.
   - Expected: exactly one Queue view is visible.

2. Try to add Agent Queue again.
   - Expected: the existing Queue view is reused or restored; no duplicate
     Queue view is created.

3. Import a prompt pack with at least one root task and one dependent task.
   - Expected: the import preview shows Smart Queue materialization, singleton
     Workspace Queue targeting, dependency counts, and no task auto-run.

4. Click `Create Queue items`.
   - Expected: Queue tasks are created from the materialized graph, but no
     worker starts.

5. Inspect the created tasks.
   - Expected: root task is `Ready`; dependent tasks are
     `Waiting dependency`.

6. Set Queue to Paused or keep it paused.
   - Expected: Paused prevents task pickup.

7. Set Queue to Active.
   - Expected: only eligible root `Ready` tasks can be picked up; dependent,
     blocked, failed, closed, cancelled, and needs-decision tasks are not
     picked up.

8. Produce or load a dependency-failed scenario.
   - Expected: downstream task shows `Blocked: dependency failed`; deeper
     downstream task shows `Blocked: dependency blocked`.

9. Recover the upstream task to accepted/closed state.
   - Expected: dependency-derived blockers clear and downstream eligible tasks
     return to `Ready` or remain `Waiting dependency` only when another
     unfinished dependency still exists.

10. Produce or load a validation-failure worker report.
    - Expected: the selected task details show a Coordinator Decision Card with
      `Needs decision: validation failed`, `Retry available`, and visible
      allowed next actions.

11. Click Retry same.
    - Expected: a new attempt is recorded, previous evidence remains visible,
      task returns to `Ready`, and no worker starts immediately.

12. Click Retry with changes.
    - Expected: the modified prompt editor opens; empty prompt is rejected;
      saving a changed prompt updates the next runnable prompt, preserves prior
      evidence, records a new attempt, and does not start a worker.

13. Click Ask Workspace Agent.
    - Expected: a handoff prompt is prepared for the operator; Workspace Agent
      is not started or called automatically.

14. Click Prepare rollback proposal.
    - Expected: proposal shows `Approval required`, `Destructive`, affected
      files/base revision where available, and `No rollback executed`.

15. Recheck Queue view count.
    - Expected: no duplicate Queue view exists.

16. In the Queue capability adapter smoke, test Queue item creation through the
    Hobit Agent Capability Runtime handler boundary, not a phrase route.
    - Expected: Queue item creation is represented by Queue capabilities such
      as `queue.createItem` / `queue.createItems` in the capability manifest
      and broker handlers supplied by `createQueueAgentActionHandlers`.
    - Expected: Workspace Agent Queue action smoke uses an agent-emitted
      structured envelope such as
      `{"type":"hobit.action.request","capabilityId":"queue.createItems","dryRun":false,"input":{"items":[...]}}`.
    - Expected: Typing phrases such as `add example queue items to queue`,
      `create queue items`, or `add tasks to queue` must not be treated as
      `user text -> regex -> Queue action`.
    - Expected: Queue item creation targets the singleton Queue; no duplicate
      Queue view is created; no Queue Autorun, worker start, shell command,
      extra Codex run, Terminal action, Git action, or rollback execution is
      created as a hidden product-action workaround. Codex/shell remain
      restricted capabilities for explicit workspace/code execution requests
      only.

17. Run Queue adapter dry-run/self-test coverage.
    - Expected: `queue.createItems` dry-run reports `wouldCreateItems`,
      singleton targeting, no duplicate Queue view, and no worker auto-run.
    - Expected: prompt-pack preview dry-run reports Smart Queue materialization
      without creating Queue items.
    - Expected: `queue.selfTest` reports product-facing passed/skipped/blocked
      rows for `Queue self-test passed`, `Queue dry-run preview prepared`,
      `Singleton Queue target verified`, `No Queue mutation`,
      `No Queue worker start`, `No Queue view creation`, `Dry-run only`, and
      `No hidden side effects`.
    - Expected: unavailable unsafe adapter checks are skipped or blocked
      individually with product-facing reasons such as `Adapter not available`
      or `Safe check skipped`; the report does not collapse safe Queue dry-run
      checks into one opaque blocked Queue row.
    - Expected: self-test does not create tasks, create views, start workers,
      enable Queue, launch Codex/shell/Terminal, mutate Git, execute rollback,
      or modify backend/storage/schema.

18. In Workspace Agent, click `Run Agent Self-Test`.
    - Expected: a compact structured Agent-executed Smoke Report appears in
      Workspace Agent showing agent APIs, peer self-test evidence, capability
      context, capability manifest, Agent Queue / QueueV2 and Workspace Agent
      widget contracts, Knowledge / Skills, Notes, and Terminal widget
      contracts, Queue singleton/create-items dry-run/self-test checks when a
      safe injected path is available, Queue prompt-pack preview dry-run, no
      Queue mutation, no Queue worker start, no Queue view creation, skipped or
      blocked adapter/execution checks for Knowledge / Skills, Notes, and
      Terminal, Finder excluded from active smoke scope, restricted Codex/shell
      capabilities, and `No hidden side effects`.
    - Expected: the report uses `Passed`, `Failed`, `Skipped`, and `Blocked`
      counts plus per-check product-facing reasons such as `Capability
      unavailable`, `Adapter not implemented yet`, `Dry-run unavailable`,
      `Restricted capability`, and `Self-test metadata only`.
    - Expected: Knowledge / Skills, Notes, and Terminal contract checks can
      pass while unsupported adapter/runtime execution remains skipped or
      blocked until adapters exist.
    - Expected: after Run Agent Self-Test completes, Agent Activity must not
      show a stale duplicate `Running` row for that self-test run.
    - Expected: no raw JSON appears in the default report; Queue checks are
      product-facing rows rather than one opaque blocked result.
    - Expected: this does not replace all manual Queue UI smoke until widget
      execution adapters and broader Queue widget self-test coverage exist.

19. Check for side effects.
    - Expected: no Git/file mutation, Terminal launch, Workspace Agent runtime
      call, rollback execution, or hidden worker start happened during preview,
      creation, retry preparation, assistance preparation, or rollback
      proposal preparation.

20. Run a Workspace Agent Direct Work prompt and inspect Direct Work request or
    log details where available.
    - Expected: the prompt sent to Codex includes Hobit capability context,
      compact Queue/agent capability names, and policy rules before the user
      request.
    - Expected: no Queue item is created, no duplicate Queue view is created,
      and no worker starts merely because context was injected or because the
      user prompt contains Queue words.
    - Expected: Queue item creation happens only when the agent emits a valid
      structured Hobit action request and the broker allows it.

## Failure Capture

For every failed smoke step, capture:

- screenshot;
- task title/id if visible;
- Queue mode: Active or Paused;
- current lane/status;
- action clicked;
- expected vs actual result;
- whether any worker, Git, Terminal, Workspace Agent, or rollback side effect
  occurred.

## Next Engineering Blocks

1. Manual smoke fixes first.
2. Durable backend persistence design.
3. Backend scheduler/runtime ownership design.
4. Durable attempt/coordinator decision persistence.
5. Safe Workspace Agent handoff integration.
6. Rollback execution design only after the approval/safety contract.
