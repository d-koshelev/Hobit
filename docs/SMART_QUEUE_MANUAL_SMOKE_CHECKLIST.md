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
- `Awaiting review`
- `In review`
- `Done`
- `Failure`
- `Agent completed`
- `Agent not completed`
- `Agent failed`
- `Follow-up prompt running`
- `Review acknowledged`
- `Waiting for coordinator review`
- `Agent did not complete`
- `N changed files`
- `Validation passed`
- `Validation failed`
- `Validation not run`
- `Final report available`
- `Logs available`
- `Frontend evidence only - not durable`
- `Queue dogfood broker loop`
- `Agent finished - awaiting review`
- `Review message created`
- `Coordinator ACK - in review`
- `Validation approved`
- `Mark done`
- `Dependent unblocked after done`
- `Follow-up prompt returns to running`
- `Backend durability is not covered`
- `Real worker execution is not covered`
- `Real validation execution is not covered`
- `Real Git commit execution is not covered`

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
      `{"type":"hobit.action.request","capabilityId":"queue.createItems","dryRun":false,"input":{"items":[{"title":"Test Queue item","prompt":"Review the current workspace state and report one safe next step.","status":"draft"}]}}`.
    - Expected: In Workspace Agent, prompts such as `create test queue item`
      or `create dummy prompt` can produce a structured Queue action request
      with both `title` and runnable `prompt`, or ask for missing real task
      content when the request is not explicitly test/dummy/example.
    - Expected: the successful structured request creates the Queue item
      through the broker with no shell fallback, no Codex fallback, no worker
      start, and no duplicate Queue view.
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
      safe injected path is available, Queue prompt-pack preview dry-run, the
      fake Queue dogfood broker loop, no Queue mutation, no Queue worker start,
      no Queue view creation, skipped or blocked adapter/execution checks for
      Knowledge / Skills, Notes, and Terminal, Finder excluded from active smoke
      scope, restricted Codex/shell capabilities, and `No hidden side effects`.
    - Expected: the report uses `Passed`, `Failed`, `Skipped`, and `Blocked`
      counts plus per-check product-facing reasons such as `Capability
      unavailable`, `Adapter not implemented yet`, `Dry-run unavailable`,
      `Restricted capability`, and `Self-test metadata only`.
    - Expected: Knowledge / Skills, Notes, and Terminal contract checks can
      pass while unsupported adapter/runtime execution remains skipped or
      blocked until adapters exist.
    - Expected: Queue dogfood broker loop rows show
      `Agent finished - awaiting review`, `Review message created`,
      `Coordinator ACK - in review`, `Validation approved`, `Mark done`,
      `Dependent unblocked after done`, `Follow-up prompt returns to running`,
      and `No hidden side effects` as passed fake broker-level checks.
    - Expected: the broker loop evidence rows show that
      `queue.lifecycle.agentFinished` consumed a frontend worker evidence
      bundle, the review message includes a bounded evidence summary,
      `queue.review.getEvidenceBundle` returns normalized frontend evidence
      when available, and the evidence is labeled frontend-only / not durable.
    - Expected: Queue dogfood backend durability is skipped, and real worker
      execution, real validation execution, and real Git commit execution are
      blocked/not covered with explicit reasons.
    - Expected: after Run Agent Self-Test completes, Agent Activity must not
      show a stale duplicate `Running` row for that self-test run.
    - Expected: no raw JSON appears in the default report; Queue checks are
      product-facing rows rather than one opaque blocked result.
    - Expected: this does not replace all manual Queue UI smoke until widget
      execution adapters and broader Queue widget self-test coverage exist.

19. Run the Queue dogfood lifecycle model and frontend controller/view-model
    self-tests through automated frontend tests.
    - Expected: `smartQueueDogfoodLifecycle.test.ts` covers create, queue,
      start, agent completion, review message, coordinator ACK, validation
      approval, fake commit result attachment, done, and dependent startability
      only after done.
    - Expected: `smartQueueDogfoodLifecycleController.test.ts` covers applying
      the model to existing Queue task objects, preserving legacy task status,
      distinct ticket and agent/prompt states, controller ACK from
      `Awaiting review` to `In review`, controller follow-up returning to
      `Running`, `additionalPromptCount`, QueueV2 lifecycle/status
      presentation, and frontend dependency eligibility only after dogfood
      `Done`.
    - Expected: the follow-up branch returns the same item to `Running`,
      reports `Follow-up prompt running`, increments `additionalPromptCount`,
      and does not mark the ticket done.
    - Expected: the self-test is model-only; it does not start workers, call
      Codex or shell, launch Terminal, mutate Git, execute rollback, create
      Queue views, or write backend/storage/schema state.
    - Expected: backend durability, real worker integration, real validation
      execution, real commit execution, and backend scheduler dependency
      enforcement remain not implemented.

20. In Workspace Agent, test a structured Queue dogfood lifecycle action
    request.
    - Expected: Workspace Agent can emit a valid
      `hobit.action.request` envelope for `queue.lifecycle.agentFinished`,
      `queue.review.ack`, `queue.coordinator.addFollowUpPrompt`, or
      `queue.item.markDone`.
    - Expected: `queue.lifecycle.agentFinished` accepts either explicit fields
      or a structured `evidenceBundle` carrying task id, attempt id, thread id,
      outcome, final agent message, changed files, validation summary/output
      preview, and log reference when available.
    - Expected: invalid evidence, task id mismatch, and attempt id mismatch are
      rejected as typed invalid input before lifecycle mutation.
    - Expected: the Action Broker validates the typed input schema, invokes the
      injected frontend Queue lifecycle adapter where available, and renders a
      compact product-facing result such as `Queue lifecycle agent finished.`
    - Expected: dry-run lifecycle requests preview the transition and do not
      change lifecycle overlay state, create review messages, mark done/fail,
      start workers, run validation, call Git, launch Terminal, execute
      rollback, call shell, or call Codex.
    - Expected: real lifecycle requests mutate only the frontend/controller
      overlay. Backend durability, real worker execution, real validation
      execution, real Git commit execution, rollback execution, and durable
      scheduler integration remain not implemented.
    - Expected: ordinary prose remains prose, and Queue lifecycle product
      actions are not triggered by natural-language phrase matching.

21. Run the Queue dogfood broker-loop automated self-test.
    - Expected:
      `apps/desktop/frontend/src/workbench/agents/selfTest/hobitQueueDogfoodBrokerSelfTest.test.ts`
      proves the fake dogfooding loop through Action Broker capability calls,
      including dry-run immutability, real fake-store execution mutation,
      wrong ACK target failure, mark-done review-state gating, failure-dependent
      blocking, and the honest skipped/blocked runtime gaps.
    - Expected: the main success path uses a fake frontend worker evidence
      bundle rather than only loose final-agent fields, and the test asserts
      broker consumption, review summary inclusion, normalized evidence
      readback, no Git execution, and done-gated dependent unblocking.
    - Expected: the self-test does not create backend records, launch workers,
      run validation, execute Git commits, call Codex/shell, launch Terminal,
      execute rollback, create Queue views, or parse prose into actions.

22. Check for side effects.
    - Expected: no Git/file mutation, Terminal launch, Workspace Agent runtime
      call, rollback execution, or hidden worker start happened during preview,
      creation, retry preparation, assistance preparation, or rollback
      proposal preparation.

23. Run a Workspace Agent Direct Work prompt and inspect Direct Work request or
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

1. Audit whether to connect real worker result events to the frontend evidence
   bundle path next or to add durable persistence first.
2. Durable backend persistence design.
3. Backend scheduler/runtime ownership design.
4. Durable attempt/coordinator decision/review ACK/evidence persistence.
5. Worker result, validation evidence, and commit result integration.
6. Safe Workspace Agent handoff integration.
7. Rollback execution design only after the approval/safety contract.
