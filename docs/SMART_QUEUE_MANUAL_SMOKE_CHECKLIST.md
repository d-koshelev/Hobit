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
handlers. After an eligible successful broker result, Workspace Agent can feed
a compact `hobit.action.result` back into the same Codex thread so the model
can emit the next single `hobit.action.request` envelope or final prose. The
continuation loop is bounded, structured-action-only, and stops on
confirmation, policy, unavailable, dry-run-required, failed, invalid, repeated,
unsupported, restricted, or missing-thread cases. Natural-language Queue
phrases are not regex-routed into actions, and task ids or executor ids are
not inferred from prose.

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
- `Failed`
- `Agent completed`
- `Agent did not complete`
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
- `Queue worker evidence ingested`
- `Queue item awaiting review`
- `Queue evidence ingestion failed`
- `Queue evidence ingestion skipped`
- `Set Codex executable`
- `Codex executable saved`
- `Queue needs a Codex executable on at least one task.`
- `Draft task`
- `Not runnable yet`
- `Missing prompt`
- `Missing workspace`
- `Missing Codex executable`
- `Missing sandbox`
- `Missing approval policy`
- `Ready to queue`
- `Queue for run`
- `Queue-linked evidence event wiring available`
- `Raw non-Queue Direct Work ingestion is blocked`
- `Duplicate Queue-linked completion ingestion is guarded`
- `Queue dogfood broker loop`
- `Agent finished - awaiting review`
- `Review message created`
- `Coordinator ACK - in review`
- `Validation approved`
- `Mark done`
- `Create review message`
- `Acknowledge review`
- `Approve validation`
- `Add follow-up prompt`
- `Mark failed`
- `Block`
- `Dependent unblocked after done`
- `Follow-up prompt returns to running`
- `Backend durability is not covered`
- `Real worker execution is not covered`
- `Real validation execution is not covered`
- `Real Git commit execution is not covered`
- `Action 1/8`
- `Action 2/8`
- `Workspace Agent action chain`

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
   - If Queue Board is `Disabled` and `Enable Queue` is disabled because the
     task is missing Codex setup, click `Set Codex executable`.
   - Expected: the selected or first missing-config task details opens with a
     task-scoped `Codex executable` input, `Save Codex executable`, and
     `Cancel`.
   - Enter the executable path, for example `codex.cmd` on Windows, and click
     `Save Codex executable`.
   - Expected: `Codex executable saved` appears or the board updates so
     `Enable Queue` is available when other active gates permit it.
   - Expected: saving Codex executable does not enable Queue automatically,
     start a worker, promote a Draft task, run validation, call Git, launch
     Terminal, execute rollback, or create review/evidence actions.
   - If an existing Queue item is in `Intake / Draft`, open its details.
   - Expected: Draft details show `Draft task` and either `Not runnable yet`
     with compact blockers such as `Missing prompt`, `Missing workspace`,
     `Missing Codex executable`, `Missing sandbox`, and
     `Missing approval policy`, or `Ready to queue` when required fields are
     present.
   - Expected: missing Codex setup continues to use the task-scoped
     `Set Codex executable` / `Save Codex executable` affordance; saving it
     updates readiness but the task remains Draft.
   - Expected: a valid Draft exposes `Queue for run`; clicking it promotes the
     task through the existing Queue update path and does not enable Queue,
     start a worker, run validation, call Git, launch Terminal, execute
     rollback, create review/evidence actions, or change dogfood lifecycle
     review state.
   - Expected: invalid Draft tasks keep `Queue for run` disabled or
     unavailable with compact missing-field reasons.

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
      `Queue-linked evidence event wiring available`,
      `Raw non-Queue Direct Work ingestion is blocked`,
      `Duplicate Queue-linked completion ingestion is guarded`,
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
    - Expected: the self-test report includes inventory rows stating
      Queue-linked evidence event wiring is available, raw non-Queue Direct
      Work ingestion is blocked/skipped, duplicate completion ingestion is
      guarded, and backend durability is still skipped/not covered.

22. Run the Queue worker evidence ingestion bridge automated test.
    - Expected:
      `apps/desktop/frontend/src/workbench/queue/smartQueueWorkerEvidenceIngestion.test.ts`
      proves an explicitly Queue-linked fake/frontend completion result builds
      a normalized evidence bundle and invokes `queue.lifecycle.agentFinished`
      through the Action Broker.
    - Expected: dry-run produces a preview and leaves the lifecycle overlay in
      `Running`; real ingestion moves the linked item to `Awaiting review` and
      returns `Queue worker evidence ingested` / `Queue item awaiting review`.
    - Expected: `queue.review.getEvidenceBundle` returns normalized
      frontend-only evidence after ingestion.
    - Expected: review-message creation is still an explicit next action; after
      explicit `queue.review.createMessage`, the review message includes the
      evidence summary.
    - Expected: missing task id, task id mismatch, attempt id mismatch, invalid
      evidence, unavailable controller, and non-linked Direct Work completion
      return structured failure or skipped statuses. No task id is inferred from
      prompt text or final-message text.
    - Expected: ingestion does not ACK review, approve validation, mark done,
      start dependents, start workers, run validation, execute Git/commit,
      execute rollback, call Codex/shell, launch Terminal, create Queue views,
      or persist backend/storage/schema state.
    - Expected: broad automatic real worker event wiring is not covered by this
      test and remains future work.

23. Run the Queue-linked Direct Work metadata seam and evidence event wiring
    automated tests.
    - Expected:
      `apps/desktop/frontend/src/workbench/queueLinkedDirectWorkMetadata.test.ts`,
      `apps/desktop/frontend/src/workbench/queueLinkedDirectWorkEvidenceWiring.test.ts`,
      `apps/desktop/frontend/src/workbench/useDirectWorkRunHandoff.test.tsx`,
      and `apps/desktop/frontend/src/workbench/useCodexDirectWorkQueueHandoff.test.tsx`
      prove Queue-linked handoffs carry explicit Queue item id, Direct Work run
      id, Agent Executor widget id, source, optional future attempt id, and a
      stable current-session idempotency key.
    - Expected: missing Queue item id, missing run id, missing executor widget
      id, mismatched Agent Executor run detail, and mismatched final stream
      events are rejected without ingestion.
    - Expected: a Queue-linked final stream event plus matching final
      `AgentExecutorRunDetail` calls the ingestion bridge once with
      `taskId = queueItemId`, run id, executor widget id, final agent message,
      changed-files summary, validation summary when available, and a
      log/run-detail reference.
    - Expected: recovered final detail and repeated final notifications for the
      same Queue item/run are ignored after the first current-session bridge
      attempt. Different explicit run ids or Queue item ids can ingest
      separately.
    - Expected: no task id is inferred from prompt text, task title, repository
      path, final agent message, changed files, validation output, or other
      natural-language content.
    - Expected: the metadata seam remains pure and does not call the Queue
      worker evidence ingestion bridge itself. The handoff controller wiring
      calls only the injected ingestion bridge callback, which invokes
      `queue.lifecycle.agentFinished` through the Action Broker.
    - Expected: successful wiring moves only the linked task to
      `Awaiting review` and makes normalized frontend-only evidence readable
      for explicit review/evidence actions. It does not create a review
      message, ACK review, approve validation, mark done, start dependents,
      start workers, run validation, call Git, execute rollback, launch
      Terminal, call shell/Codex, or add backend durability.
    - Expected: backend durability, real validation execution, real Git commit
      execution, and full app restart recovery remain not implemented.

24. Inspect the minimal Queue review/evidence UI for a task that reached
    `Awaiting review` or `In review` through explicit Queue-linked evidence.
    - Expected: the active QueueV2 task details Result tab shows a compact
      `Dogfood review` section only for relevant review/evidence state.
    - Expected: the section shows product-facing lifecycle status, agent
      outcome, evidence availability, bounded final agent message, changed-file
      count with a capped filename preview, validation summary/output preview,
      run/log reference when available, and a compact frontend-only/not durable
      evidence label.
    - Expected: explicit review actions use broker capabilities where wired:
      `Create review message`, `Acknowledge review`, `Approve validation`,
      `Add follow-up prompt`, `Mark done`, `Mark failed`, and `Block`.
    - Expected: follow-up prompt and fail/block reason inputs reject empty text
      with product-facing validation messages.
    - Expected: if broker access is unavailable, the section shows a compact
      unavailable state and does not show fake success.
    - Expected: the UI does not auto-create a review message, auto-ACK, approve
      validation by itself, mark done by itself, start dependents, start
      workers, run validation, call Git, execute rollback, launch Terminal,
      call shell/Codex, create another Queue view, or add backend durability.
    - Expected: full review/evidence UI polish, backend persistence, real
      validation execution, real Git commit execution, and restart recovery
      remain future work.

25. Check for side effects.
    - Expected: no Git/file mutation, Terminal launch, Workspace Agent runtime
      call, rollback execution, or hidden worker start happened during preview,
      creation, retry preparation, assistance preparation, or rollback
      proposal preparation.

26. Run a Workspace Agent Direct Work prompt and inspect Direct Work request or
    log details where available.
    - Expected: the prompt sent to Codex includes Hobit capability context,
      compact Queue/agent capability names, and policy rules before the user
      request.
    - Expected: no Queue item is created, no duplicate Queue view is created,
      and no worker starts merely because context was injected or because the
      user prompt contains Queue words.
    - Expected: Queue item creation happens only when the agent emits a valid
      structured Hobit action request and the broker allows it.
    - Expected: if a broker result is eligible for continuation and the Codex
      thread id is available, the next Direct Work request uses compact
      `hobit.action.result` context in the same thread, not a new visible
      operator turn or pasted prompt.
    - Expected: transcript/activity show compact action-chain rows such as
      `Action 1/8: queue.targetSingletonQueue` and
      `Action 2/8: queue.items.list`; they do not dump raw JSON, logs, secrets,
      or stack traces.
    - Expected: the chain stops with a visible reason on confirmation,
      policy-blocked, unavailable, dry-run-required, failed, invalid input,
      repeated request id, repeated capability/input, unsupported envelope,
      restricted capability, max action count, or unavailable thread.

## Typed StartRun Reconciliation Smoke

1. In Workspace Agent, ask the agent to use typed Queue capabilities and emit
   one `hobit.action.request` envelope at a time.
   - Expected: ordinary prose is not routed by regex or phrase matching, and
     action lists are rejected.

2. Invoke `queue.items.list` and identify one explicit task id.
   - Expected: the item summary includes the selected task id, current status,
     readiness, and available executor targets.
   - Expected with continuation: the next action uses task ids and executor ids
     returned in `hobit.action.result`, not ids inferred from task titles,
     final messages, paths, repo roots, or the operator prompt.

3. Invoke `queue.item.updateRunSettings` for that exact `taskId` with
   `workspaceRoot`, `codexExecutable`, `sandbox`, and `approvalPolicy` where
   needed.
   - Expected: readiness moves toward `ready_to_queue`; no worker starts.

4. Invoke `queue.item.promoteDraft` for the same exact `taskId` when readiness
   permits.
   - Expected: status becomes `queued`; no worker starts.

5. Invoke `queue.enable`.
   - Expected: Queue is enabled; no Queue Autorun, shell, Terminal, Git,
     validation, rollback, or dependent task start is triggered.

6. Invoke `queue.item.startRun` with the same exact `taskId` and an explicit
   `executorWidgetId`.
   - Expected on accepted start: the result includes `taskId`,
     `executorWidgetId`, and `runId`; the Queue task refreshes to `running` or
     the latest backend final state; latest run-link metadata shows the
     returned run id; the board/details do not remain stale as Ready/Queued.
   - Expected when start cannot actually run: the capability returns blocked
     or unavailable with a compact blocker such as local executor unavailable
     and does not claim `Queue-linked run started`.

7. If the run completes or fails while Hobit is open, refresh the task and
   result evidence.
   - Expected: matching final `AgentExecutorRunDetail` plus explicit Queue
     run-link metadata ingests frontend-only evidence and moves the dogfood
     lifecycle overlay to `Awaiting review`.
   - Expected: no evidence is shown before completion/final detail exists.

8. Inspect `queue.review.getEvidenceBundle` and the Queue details Result tab.
   - Expected: normalized frontend-only evidence is available when ingestion
     succeeded; review-message creation, ACK, validation approval, mark done,
     and dependent starts remain explicit separate actions.

9. Check side effects.
   - Expected: no raw `codex.runTask` fallback, shell invocation, Terminal
     launch, Git mutation, validation execution, rollback execution, duplicate
     Queue view, task-id inference, auto-review, auto-ACK, auto-done, or
     dependent auto-start occurred.

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

1. Durable backend persistence design.
2. Backend scheduler/runtime ownership design.
3. Durable attempt/coordinator decision/review ACK/evidence persistence.
4. Worker result, validation evidence, and commit result integration.
5. Safe Workspace Agent handoff integration.
6. Rollback execution design only after the approval/safety contract.
