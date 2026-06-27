# Smart Queue Manual Smoke Checklist

## Purpose

Manual checklist for the current Smart Queue checkpoint, including the current
headless Queue workflow smoke path and the older desktop/UI smoke path. This
checklist claims only the explicitly listed backend aggregate, worker evidence,
review command, finalization, and workflow persistence contracts. It does not
claim durable backend scheduler, rollback execution, Git/file mutation,
Terminal launch, Workspace Agent runtime auto-call, or storage schema changes
beyond the narrow worker evidence, review, finalization, and workflow ledgers.

For responsibility boundaries, use
`docs/QUEUE_BACKEND_OWNERSHIP_CONTRACT.md`. Manual smoke must not treat Queue
UI overlays as product truth; backend-backed Queue behavior must remain
testable through backend/domain/Tauri/API contracts without launching the
frontend UI.

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
normalizes missing `dryRun` only for registered read-only capabilities and
then the Action Broker validates policy/schema/side effects and invokes Queue
adapter handlers. Read-only live discovery/debug actions such as
`workspace.context.get`, `workbench.widgets.list`, `queue.control.get`,
`queue.workflow.get`, `queue.workflow.list`, `queue.workflow.getReport`,
`queue.workflow.planResume`, and `queue.workflow.readActionLog` may omit
`dryRun` and are treated as `dryRun: false`. Setup/write/run/finalization
actions, including `queue.control.setManualEnabled`, `queue.createItem(s)`,
`queue.item.updateRunSettings`, `queue.item.promoteDraft`,
`queue.item.startRun`, lifecycle/review writes, `queue.item.markDone`, and
`queue.item.fail`, still require an explicit boolean `dryRun` field. Unknown
capabilities without `dryRun` are not defaulted. After an eligible successful
broker result, Workspace Agent can feed
a compact `hobit.action.result` back into the same Codex thread so the model
can emit the next single `hobit.action.request` envelope or explicit
`hobit.final.answer`. Typed-capability action mode now treats empty or
intermediate non-envelope prose as a protocol stall: one compact same-thread
repair prompt is allowed, then the run stops with visible protocol error if
the model still does not emit a valid envelope or explicit final answer.
Prose such as awaiting `queue.items.list` result is not a successful smoke
outcome, is not parsed into a capability call, and is not regex-routed into a
Queue action. The continuation loop is bounded, structured-action-only, and
stops on confirmation, policy, unavailable, dry-run-required, failed, invalid,
repeated, unsupported, restricted, protocol-error, or missing-thread cases.
Natural-language Queue phrases are not regex-routed into actions, and task ids
or executor ids are not inferred from prose.
Each emitted envelope should use a fresh requestId. If the model omits or
blanks requestId, the frontend derives a per-chain/per-action id; explicit
duplicate requestIds still stop as a replay guard. Read-only
`queue.lifecycle.get`, backend-backed read-only
`queue.review.getEvidenceBundle`, and successful backend-backed
`queue.review.ack` can continue safely after success. ACK continuation is only
to read state, normally with `queue.lifecycle.get`; ACK does not imply done,
validation approval, commit state, dependency unblock, or finalization. The
continuation budget remains 16 actions and the existing safety stops are
unchanged.

Workspace Agent live Queue smoke context discovery now has read-only typed
capabilities before any smoke execution step:

- `workspace.context.get` returns the current `workspaceId`, workspace root,
  `workbenchId`, runtime availability, optional widget summary, and optional
  Queue control state from live renderer-held typed app state plus the Queue
  control bridge. Its broker continuation result includes bounded structured
  payload fields for the model, not only the compact activity text.
  `workspaceRootPath` must come from durable Workspace data when present. For
  new live smoke setup, create/open the Workspace for the actual repository
  root, for example
  `C:/Users/Dmitry/Documents/prj/Hobit_queue_logic`, and verify discovery
  reports that path. The process current-directory fallback is legacy only and
  can point at `apps/desktop/src-tauri` when running `cargo tauri dev`.
- `workbench.widgets.list` returns bounded live widget instances and reports
  the backend-owned Queue-local execution target
  `{ "kind": "queue_local", "providerId": "codex" }` without requiring an
  Agent Queue widget. Agent Queue widgets discovered by
  `definitionId === "agent-queue"` are optional observability/control surfaces;
  when exactly one safe Queue widget exists, its `queueOwnerWidgetInstanceId`
  may be included as compatibility/display attribution. Missing Queue widgets
  may produce a non-blocking suggestion to add Agent Queue for observability,
  but this is not a smoke execution blocker. Legacy Agent Executor widgets may
  still be listed by `definitionId === "agent-run"` for compatibility, but
  `agent-run` is not required for current smoke.
- `queue.control.get` reads backend-owned Queue control state through the
  existing Queue control bridge and reports `disabled` or `manual_enabled`
  without enabling Queue, starting workers, starting Queue Autorun, creating
  tasks, or starting Direct Work. The model-visible action result includes
  backend ownership, status, version, updated metadata, reason when bounded,
  and blockers when unavailable.
- `queue.control.setManualEnabled` sets only backend Queue control state to
  `manual_enabled` through the typed Queue control bridge. It accepts optional
  exact `workspaceId`, optional `expectedVersion`, and optional bounded
  `reason`. It does not start workers, dispatch a scheduler, start Queue
  Autorun, create run links, mutate Queue tasks, record evidence, create/ACK
  reviews, finalize tasks, invoke workflows, launch shell/Terminal/Git,
  execute validation/rollback, or start downstream work.
- `queue.workflow.list` reads bounded workflow run summaries and should be
  used to recover recent `workflowRunId` values when a smoke/debug session lost
  the id.
- `queue.workflow.get` reads one workflow run summary by explicit
  `workflowRunId`, including status, phase/currentStep, timestamps, blockers,
  missing capabilities, and bounded variable/slot summaries.
- `queue.workflow.getReport` reads the bounded workflow report and exposes the
  continuation ids needed for smoke recovery: task ids, run ids, evidence
  bundle ids, review message ids, completion decision ids, and failure decision
  ids by slot. In Workspace Agent continuation context, the model-visible
  payload is `data.workflowReport` and includes persistent status, phase,
  current step, request id, bounded variables summary, slot bindings,
  execution target kind/provider/hash where present, action counts, and
  bounded action summaries. It also exposes
  `data.workflowReport.diagnostics.refMaps` and
  `data.workflowReport.diagnostics.startWorker`, including exact safe
  `start_worker` target/result refs for slot, task id, run id, settings hash,
  execution target hash, and provider id. New `start_worker` rows include
  `slot`; older rows that omitted `slot` can be recovered through an
  unambiguous `taskId -> slot` binding.
- `queue.workflow.planResume` is a read-only resume planner. Call it before
  continuation to read next phase/step, blockers, required fresh grant,
  required confirmation, worker/start-state blockers, task snapshots, and
  continuation refs. In Workspace Agent continuation context, the
  model-visible payload is `data.workflowResumePlan` and includes resume
  status, next phase/step, terminal status when applicable, missing refs,
  recovered refs, required grant/confirmation flags, task snapshots, and
  slot/action reconciliation details where available. Its diagnostics include
  exact `missingRefs`, recovered/continuation refs, worker state,
  `startWorkerRefCheck`, `safeToRecordWorkerEvidence`, and
  `reasonIfNotSafe`.
- `queue.workflow.readActionLog` reads bounded workflow action summaries for
  idempotency/action debugging, with safe target/result refs and no raw logs or
  raw confirmation token exposure. In Workspace Agent continuation context,
  the model-visible payload is `data.workflowActionLog` and includes action
  count, truncated flag, status filter, and bounded action rows with safe
  target/result refs. When called with exact filters such as
  `actionType: "start_worker"`, `slot: "upstream"`, and `includeRefs: true`,
  it returns an exact safe `focusedAction` or a structured no-match/ambiguity
  blocker instead of relying on compact action summaries. If an older
  `start_worker` row lacks a direct `targetRefs.slot`, the focused read may
  return `derivedSlot: "upstream"` and `recoveredFromTaskId: true` when the
  action `taskId` maps to exactly one workflow slot.

Use these discovery reads for live Queue smoke setup. The recommended Workspace
Agent smoke chain is `workspace.context.get`, `workbench.widgets.list`,
`queue.control.get`, `queue.control.setManualEnabled`, structured
`hobit.workflow.request`, `queue.workflow.getReport`,
`queue.workflow.planResume`, and `queue.workflow.readActionLog`. Do not use
`agent.status.read` for workspace/workbench/widget/executor/Queue-control or
workflow-debug discovery. Do not use DevTools, Queue UI text, DOM scraping,
localStorage alone, task titles, prompt text, file paths, transcript text, or
prose to infer ids. Codex shell still cannot perform live Queue smoke by itself
because it has no live Tauri renderer/IPC context. Live smoke recovery
diagnostics can now inspect workflow report, action log, and resume plan
payloads to decide whether a worker is still running, action refs are
incomplete, durable run ids are present, or evidence can be safely retried.
Actual live `dependency_acceptance_smoke` and `dependency_failure_smoke` smoke
continuation remains the next step.
`queue.workflow.invoke` is
deliberately not implemented; invocation uses only `hobit.workflow.request`.

The live smoke discovery/debug capabilities are expected to be consistent
across Workspace Agent instructions, capability manifest metadata, Action
Broker handlers, `ModuleControlSurface` metadata, and broker continuation
policy diagnostics. Read-only discovery/debug actions should continue without
grant or confirmation and should report concrete module/risk metadata rather
than `moduleId=unknown` or `riskClass=unknown`. The setup action
`queue.control.setManualEnabled` remains setup/write-gated for
auto-continuation and must require an appropriate structured Queue grant; it
must never be treated as a read-only continuation step.

To authorize bounded multi-step Queue smoke, the operator must include a
structured grant JSON object such as:

```json
{
  "type": "hobit.queue.autonomyGrant",
  "mode": "queue_acceptance_smoke",
  "maxActions": 16,
  "confirmationToken": "operator-confirmed",
  "constraints": {
    "noGit": true,
    "noValidationExecution": true,
    "noRollback": true,
    "noTerminal": true,
    "noDelete": true,
    "noDownstreamAutoStart": true
  }
}
```

The JSON object may be embedded in normal Workspace Agent prompt text, for
example after "The following JSON object is the only autonomy grant for this
run:", or inside a fenced JSON block. Only the JSON object is parsed. Prose
such as `go`, `do the rest`, or `I confirm` is not a grant or confirmation.
The parsed grant is carried in the action-chain state across continuation
turns. Inside a valid grant, Workspace Agent may follow schema-valid typed
Queue `nextAction` payloads exactly, including
`queue.control.setManualEnabled -> queue.item.startRun`, duplicate
`queue.review.createMessage ->
queue.review.ack` using `input.messageId`, and finalizer next actions allowed
by `queue_acceptance_smoke` or `queue_failure_smoke`. Backend preconditions,
dependency blockers, exact confirmations, max action budget, and unsafe
constraints remain authoritative. Transitional validation, follow-up, and block
capabilities remain blocked.
Older `queue.enable -> queue.item.startRun` typed nextActions remain a
compatibility path, but new live smoke setup should prefer
`queue.control.get` followed by `queue.control.setManualEnabled`.

When continuation stops, the visible result should include policy diagnostics:
`capabilityId`, risk class, whether a grant was active, grant mode, allowed
risk classes, reason code/message, whether `nextAction` was present, whether
its payload validated, confirmation missing/injected state, and whether
`deniedCapabilities` blocked it. For multi-item flows, use
`scope.taskIds`, `queue.items.list` with exact `taskId`, or a typed
`nextAction` that identifies one task. If multiple items remain possible, the
expected blocker is `ambiguous_next_action` with candidate task ids; the agent
must not infer the target from title, prompt text, order, UI selection, or
operator prose.

Queue action-request smoke must use the manifest schemas exactly. Do not infer
task ids, run ids, message ids, evidence ids, executor widget ids, actor ids, or
capability ids from prose or UI selection. For run settings, use only sandbox
values `read_only`, `workspace_write`, `danger_full_access` and approval policy
values `never`, `on_request`, `untrusted`. Legacy assigned Agent Executor
`queue.item.startRun` action-request smoke must include explicit
`input.taskId`, compatibility `input.executorWidgetId`, and top-level
`confirmationToken: "operator-confirmed"` after user confirmation; a prose-only
"I confirm" message remains insufficient. Current backend-owned `queue_local`
workflow smoke does not require `executorWidgetId`. `queue.importPromptPack`
uses the same top-level confirmation token. Backend-backed Queue capabilities are
`queue.control.get`, `queue.items.list`, `queue.lifecycle.get`,
`queue.review.getEvidenceBundle`, `queue.review.createMessage`,
`queue.review.ack`, and `queue.lifecycle.agentFinished`,
`queue.item.markDone`, and `queue.item.fail`.
`queue.item.markDone`
requires explicit `input.taskId`, trusted actor id from runtime/backend
context, and top-level `confirmationToken: "operator-confirmed"` after
operator confirmation. ACK and worker completion do not imply done.
`queue.item.fail` requires explicit `input.taskId`, visible `input.reason`,
trusted actor id, durable worker evidence, ACKed review, and the same top-level
confirmation token. Worker failure evidence and ACK do not imply terminal
failure.
Transitional lifecycle writes remain
non-auto-continuation-safe and policy-restricted.
`queue.review.createMessage` requires durable backend worker evidence but does
not require the model to supply `evidenceBundleId`; the backend selects the
latest durable evidence for the explicit task/run when omitted and returns the
selected id. If review creation is blocked, the smoke result must show typed
backend blocker diagnostics with ticket, worker-run, review, and evidence
states, duplicate-message state when relevant, and a next suggested capability
when available. A generic-only "could not be created" failure is not an
acceptable smoke result.
`queue.lifecycle.get` smoke results must expose backend aggregate dimensions:
`ticketState`, `workerRunState`, `reviewState`, `evidenceState`,
`validationState` when available, `commitState` when available,
`dependencyState` when available, `blockers`, `nextSuggestedCapability`,
typed `nextAction` when the next payload is schema-valid, `latestRun` when
available, `evidenceSummary` when available, and durable flags or honest
`unknown` / `not_durable` markers when available. `nextSuggestedCapability`
alone is not enough for machine execution.

Queue review smoke must verify `queue.review.ack` input uses `messageId`, not
`reviewMessageId`. When review creation reports
`review_message_already_exists`, backend `existingMessageId` must appear as
`nextAction.input.messageId` for `queue.review.ack`. Unsafe/finalizing actions,
including `queue.item.markDone` and `queue.item.fail`, remain explicit and
confirmation-gated. Under `queue_acceptance_smoke`, `queue.item.markDone` may
run only from a valid typed nextAction with exact structured confirmation and
backend preconditions; success must end or allow read-only lifecycle
inspection, not downstream auto-start. Under `queue_failure_smoke`,
`queue.item.fail` has the same exact-token and backend-precondition gate and
must leave downstream tasks in `failed_upstream` read state without starting
work.

## Headless Queue Workflow Smoke

Verdict: `ready_for_manual_headless_smoke`.

Use this section before the desktop/UI smoke when the goal is to prove durable
headless orchestration for `dependency_acceptance_smoke` and
`dependency_failure_smoke`. It must use only structured
`hobit.workflow.request` envelopes, `metadata.workflowRunId` continuations,
typed continuation inputs, backend Queue control state, backend workflow
reports, and backend resume plans. Do not use Queue UI truth, transcript/prose
inference, manual database edits, task ids copied from titles, or file paths as
workflow input.

### Fresh-Run Requirement

After the backend-owned workflow phase and Tauri launch bridge changes, manual
headless smoke evidence must come from a fresh app session and a fresh
workflow:

- Fully restart Hobit before starting the smoke.
- Use a new unique `requestId` for each acceptance or failure initial request.
- Treat the resulting backend-created `workflowRunId` as the fresh run id for
  that smoke only.
- Do not reuse a pre-bridge, pre-backend-owned, stale workflow, or old
  workflowRunId as validation evidence.
- Old stuck workflow runs may remain useful diagnostic artifacts, but they are
  not current acceptance/failure smoke proof.

Current smoke sequence requirements:

- Queue control state must be `manual_enabled` before worker start.
- `create_setup_start` starts the upstream `queue_local` worker through the
  Tauri Direct Work launch bridge for a newly-started desktop run.
- Worker evidence may be recorded only after the upstream run link reaches a
  terminal durable state.
- `workerEvidence.outcome` must match the actual durable worker run state.
- Failure workflow terminal failure is applied only in finalization through
  typed `failureReason` and backend `failItem`, not by faking a failed worker
  evidence outcome.
- Downstream work must not auto-start.

### Canonical Queue Identity

- Task is the work intent; RunAttempt is one execution attempt.
- Queue-owned run identity is the task run link and its `runId`.
- `widget_runs` and Direct Work/widget run ids are not canonical Queue
  identity.
- `executorWidgetId`, `assignedExecutorWidgetId`,
  `queueOwnerWidgetInstanceId`, and `directWorkRunId` are compatibility,
  legacy assignment, or UI attribution fields only.
- Agent Queue widgets are optional observability/control surfaces, not
  execution truth.
- Agent Executor widgets and `agent-run` are not required for current
  backend-owned `queue_local` workflow smoke.

### Typed Request Schema

Common workflow envelope:

- `type: "hobit.workflow.request"`.
- `requestId`: required on every envelope. Initial workflow start is
  idempotent by `workspaceId + requestId + stable typed request hash`; same
  request id with different typed content must conflict.
- `moduleId: "queue"`.
- `workflowId`: `dependency_acceptance_smoke` or
  `dependency_failure_smoke`.
- `grant`: generic workflow grant object with `mode`, optional
  `confirmationToken`, optional `scope`, optional `maxActions`, and required
  safety `constraints`.
- `inputs`: the only place for workflow data.
- `metadata.workflowRunId`: the only workflow continuation id. It is never
  inferred from prose.

Required grant modes:

- Acceptance: `queue_acceptance_smoke` or `queue_operator_flow`.
- Failure: `queue_failure_smoke` or `queue_operator_flow`.
- Safety constraints must set `noGit`, `noValidationExecution`, `noRollback`,
  `noTerminal`, `noDelete`, and `noDownstreamAutoStart` to exactly `true`.
- `confirmationToken` is required only for worker start/finalization phases
  that need it and must be exactly `operator-confirmed`. Do not persist or
  replay a prior token.

Initial dependency workflow inputs:

- `inputs.runSettings.codexExecutable`: non-empty executable such as
  `codex`, `codex.cmd`, or an explicit path.
- `inputs.runSettings.workspaceRoot`: explicit execution workspace/root.
  For Hobit repo smoke, use the durable Workspace root reported by
  `workspace.context.get`, not process cwd or localStorage.
- `inputs.runSettings.sandbox`: `read_only`, `workspace_write`, or
  `danger_full_access`.
- `inputs.runSettings.approvalPolicy`: `never`, `on_request`, or
  `untrusted`.
- `inputs.runSettings.executionPolicy: "manual"`.
- `inputs.runSettings.executionTarget.kind: "queue_local"`.
- `inputs.runSettings.executionTarget.providerId: "codex"`.
- `inputs.runSettings.executionTarget.queueOwnerWidgetInstanceId` is optional
  compatibility/display attribution when an Agent Queue widget already exists.
  It is not required for headless smoke.
- `inputs.runSettings.executorWidgetId` remains a legacy compatibility field
  for old `agent-run` workflows only and should not be used for current smoke.
- `inputs.tasks`: typed task specs with unique `slot`, `title`, `prompt`.
- Required slots are `upstream` and `downstream`.
- `downstream.dependsOnSlots` must explicitly include `upstream`.
- Dependencies must not be inferred from task order, title, prompt, prose, UI,
  or file paths.

Continuation inputs:

- Worker evidence: use `metadata.workflowRunId` plus
  `inputs.phase: "worker_evidence"` and
  `inputs.workerEvidence.slot: "upstream"`, `taskId`, `runId`, `outcome`,
  and bounded optional fields such as `summary`, `changedFiles`,
  `validationSummary`, `errorSummary`, `source`, `workerId`, `finishedAt`,
  and `actionIdempotencyKey`. If the workflow report or `planResume` shows a
  completed worker and a verified recovered `runId` from `start_worker`
  action refs while `slotBindings.runId` is absent, retry the same typed
  worker-evidence continuation with that exact `runId`. The backend evidence
  command reconciles the verified run ref into the slot binding when it also
  matches task/workspace ownership and settings/execution-target hashes; do
  not repair the database manually or infer the id from prose/UI text.
- Review: use `metadata.workflowRunId` plus `inputs.phase: "review"`.
  The runtime adapter delegates this phase to the backend review step; do not
  expect frontend raw review create/ACK runner actions. Normally resume
  planning supplies task/run/evidence/message bindings. The backend creates or
  reuses the durable review message, ACKs it idempotently, persists
  `messageId` into the workflow slot binding, and pauses at
  `finalization / awaiting_finalization`. ACK uses canonical `messageId`;
  stale `reviewMessageId` is not an ACK input.
- Acceptance finalization: use `metadata.workflowRunId`,
  `inputs.phase: "finalization"`, and fresh
  `grant.confirmationToken: "operator-confirmed"`. The runtime adapter
  delegates this phase to the backend finalization step; do not expect
  frontend raw `markDone` runner actions.
- Failure finalization: same as acceptance finalization, plus typed
  `inputs.failureReason`. The backend finalization step applies terminal
  failure through `failItem`; do not expect frontend raw `failItem` runner
  actions.
- Initial create/setup/start: send the structured workflow request without
  `metadata.workflowRunId`. The runtime adapter delegates this phase to the
  backend create/setup/start step; do not expect frontend raw
  materialize/settings/promote/start runner actions, frontend action-row
  synthesis, frontend slot-binding deltas, or frontend workflow status
  transitions. In the desktop shell, a newly-started backend-owned
  `queue_local` worker is handed to the Tauri Direct Work launch bridge so the
  run link has one real background Codex process; the StepResult projection
  must not expose the direct work input, prompt, stdout, or stderr.

Schematic initial request shape:

```json
{
  "type": "hobit.workflow.request",
  "requestId": "acceptance-smoke-<fresh-unique-id>",
  "moduleId": "queue",
  "workflowId": "dependency_acceptance_smoke",
  "grant": {
    "mode": "queue_acceptance_smoke",
    "confirmationToken": "operator-confirmed",
    "constraints": {
      "noGit": true,
      "noValidationExecution": true,
      "noRollback": true,
      "noTerminal": true,
      "noDelete": true,
      "noDownstreamAutoStart": true
    }
  },
  "inputs": {
    "runSettings": {
      "codexExecutable": "codex.cmd",
      "workspaceRoot": "C:/Users/Dmitry/Documents/prj/Hobit_queue_logic",
      "sandbox": "workspace_write",
      "approvalPolicy": "on_request",
      "executionPolicy": "manual",
      "executionTarget": {
        "kind": "queue_local",
        "providerId": "codex"
      }
    },
    "tasks": [
      {"slot": "upstream", "title": "Upstream smoke", "prompt": "Typed smoke upstream work."},
      {"slot": "downstream", "title": "Downstream smoke", "prompt": "Typed smoke downstream work.", "dependsOnSlots": ["upstream"]}
    ]
  }
}
```

### Queue Control Prerequisite

Before either workflow, read backend Queue control state for the workspace and
ensure it is `manual_enabled`.

- Use the typed backend/Tauri Queue control API, not frontend
  `globalExecutionState`, Queue board state, or controller session state.
- Setting `manual_enabled` must not start workers, arm Autorun, run a
  scheduler, create run links, record evidence, run validation, run Git,
  launch Terminal, or start downstream work.
- With control state `disabled`, typed worker start must block with a control
  blocker and must not auto-enable Queue.

### Required Operator Inputs

Collect these before starting:

- `workspaceId`.
- Optional Agent Queue widget id for
  `executionTarget.queueOwnerWidgetInstanceId` only when an existing Queue
  widget is being used as compatibility/display attribution. Headless smoke
  must work without it.
- `codexExecutable`.
- Explicit `workspaceRoot` / execution workspace.
- `sandbox`.
- `approvalPolicy`.
- Fresh unique initial `requestId` values for acceptance and failure workflows.
- Typed upstream/downstream task specs.
- Typed worker evidence payload for the upstream continuation.
- Fresh exact `grant.confirmationToken` when starting/finalizing requires it.
- Typed `failureReason` for `dependency_failure_smoke` finalization.

Do not require UI-derived task ids. Capture `workflowRunId`, upstream
`taskId`, downstream `taskId`, `runId`, `evidenceBundleId`, and `messageId`
from workflow reports, slot bindings, mutation refs, action ledgers, or resume
plans after the relevant phase persists them.

### Acceptance Smoke Sequence

1. Verify backend Queue control state is `manual_enabled`.
2. Send a typed `dependency_acceptance_smoke` initial request with a stable
   `requestId`, typed run settings, typed upstream/downstream task specs, and
   explicit `downstream.dependsOnSlots: ["upstream"]`.
3. Verify the backend create/setup/start step starts or reuses a durable
   `workflowRunId`, materializes both slots, creates the explicit dependency
   edge, applies upstream run settings, promotes upstream, starts only the
   upstream worker, and pauses at `awaiting_worker_completion` /
   `worker_running`. For a newly-started desktop `queue_local` run, verify the
   Tauri bridge launched exactly one background Direct Work run for the
   upstream run link; no Agent Executor widget, Agent Queue widget, or
   `widget_runs` row is required.
4. Capture `workflowRunId`, upstream `taskId`, downstream `taskId`, upstream
   `runId`, settings hash, and action counts from the workflow report.
5. After the upstream worker run link is terminal through the completion
   bridge, continue with
   `metadata.workflowRunId` and typed `inputs.workerEvidence` for the
   `upstream` slot. Use `outcome: "completed"` for acceptance. Evidence must
   remain blocked while the run link is still running and must not be recorded
   automatically by worker completion.
6. Verify durable `evidenceBundleId` is recorded/reused and the workflow pauses
   at `awaiting_review`.
7. Continue with `metadata.workflowRunId` and `inputs.phase: "review"`.
   Verify review message create and ACK use durable backend ids and canonical
   `messageId`.
8. Continue with `metadata.workflowRunId`, `inputs.phase: "finalization"`, and
   fresh exact `grant.confirmationToken: "operator-confirmed"`.
9. Verify the workflow completes, upstream is durably `done`, downstream reads
   as dependency-ready or otherwise no longer blocked by upstream, and no
   downstream worker auto-started.
10. Idempotency check: read `queue.workflow.getReport` for the completed
    `workflowRunId`, then send a continuation with only
    `metadata.workflowRunId` and verify resume planning reports
    `terminal_completed` without invoking runner work. Separately, re-submit
    the exact same initial `requestId` and typed hash only to verify
    the backend create/setup/start step returns/reuses the existing workflow
    run; do not treat UI state as the proof.

### Failure Smoke Sequence

1. Verify backend Queue control state is `manual_enabled`.
2. Send a typed `dependency_failure_smoke` initial request with a stable
   `requestId`, typed run settings, typed upstream/downstream task specs, and
   explicit `downstream.dependsOnSlots: ["upstream"]`.
3. Verify the backend create/setup/start step reaches
   `awaiting_worker_completion` / `worker_running` for only the upstream
   worker. For a newly-started desktop `queue_local` run, verify the Tauri
   bridge launched exactly one background Direct Work run and did not create
   `widget_runs` or evidence.
4. Capture `workflowRunId`, upstream `taskId`, downstream `taskId`, upstream
   `runId`, settings hash, and action counts from the workflow report.
5. Continue with `metadata.workflowRunId` and typed upstream
   `inputs.workerEvidence`. `workerEvidence.outcome` must reflect the actual
   durable worker run outcome. If the worker run completed, use
   `outcome: "completed"`; do not force `failed` unless the worker run actually
   failed.
6. Verify durable `evidenceBundleId` is recorded/reused and the workflow pauses
   at `awaiting_review`.
7. Continue with `metadata.workflowRunId` and `inputs.phase: "review"`.
   Verify review create and ACK use durable backend ids and canonical
   `messageId`.
8. Continue with `metadata.workflowRunId`, `inputs.phase: "finalization"`,
   typed `inputs.failureReason`, and fresh exact
   `grant.confirmationToken: "operator-confirmed"`. This finalization step is
   what applies the terminal failure through `failItem`.
9. Verify the workflow completes, upstream is durably `failure`, downstream
   reads `failed_upstream`, and no downstream worker auto-started.
10. Idempotency check: read `queue.workflow.getReport` for the completed
    `workflowRunId`, then send a continuation with only
    `metadata.workflowRunId` and verify resume planning reports
    `terminal_completed` without invoking runner work. Separately, re-submit
    the exact same initial `requestId` and typed hash only to verify
    the backend create/setup/start step returns/reuses the existing workflow
    run.

### Restart/Resume Checkpoints

At each reachable checkpoint of the fresh workflow, restart the app or start a
fresh session, then continue only with that fresh `metadata.workflowRunId` and
the typed continuation data required by the resume plan. Verify no UI/session
state is required and no duplicate task/start/evidence/review/ACK/finalization
is created.

- After workflow run creation before materialization, if this pause is
  reachable: expect resume to continue setup only from persisted typed inputs.
- After materialization: expect bound slot task ids to be reused; no duplicate
  tasks or dependency edges.
- After run-settings setup: expect settings hash/executor binding reuse; no
  settings overwrite.
- After promote: expect idempotent promoted upstream state; no downstream
  start.
- After `start_worker` / `worker_running`: expect the existing `runId` to be
  reused or worker state to block safely; no second worker start or second
  Tauri launch. For backend-owned `queue_local`, `planResume` and
  `readActionLog` must not require `executorWidgetId`, an Agent Queue widget,
  or a `widget_runs` row. When inspecting old diagnostic artifacts only,
  missing-slot `start_worker` actions may recover via unambiguous task-to-slot
  mapping, but those runs are not fresh smoke validation evidence.
- For current fresh smoke worker evidence, `queue.workflow.planResume` should
  report complete continuation refs for the upstream task/run, no active
  `incomplete_workflow_action_refs` blocker, and
  `safeToRecordWorkerEvidence=true` only after the durable run link is
  terminal. The backend worker-evidence StepPlan/StepResult path uses the same
  resolver for planning and mutation: it proves typed task/run refs, no
  existing `evidenceBundleId`, no completed `record_worker_evidence`, no
  review, no final decision, matching durable worker state, and no downstream
  auto-start before recording evidence. For backend-owned `queue_local` runs,
  this path must be validated through the task run link and must not require
  or synthesize a `widget_runs` row.
- After evidence recorded: expect existing `evidenceBundleId` to be reused; no
  duplicate evidence.
- After review created: expect existing canonical `messageId` to be reused for
  ACK; no duplicate message.
- After review ACKed: expect finalization to require a fresh exact
  confirmation token through the backend finalization StepPlan/StepResult path;
  ACK alone is not completion.
- After `markDone` / `failItem` before final report, if this crash window is
  reachable: expect completed decision refs to be reconciled and reported
  without duplicate finalization by the backend finalization resolver.
- After workflow completed: expect `terminal_completed` planning/report status
  and no runner invocation.

### Negative Smoke Checks

- Same initial `requestId` with different typed request hash returns conflict
  and does not invoke the runner.
- Continuation without `metadata.workflowRunId` blocks.
- Worker evidence continuation without typed `inputs.workerEvidence` remains
  paused at worker evidence.
- Worker evidence with mismatched `taskId`, `runId`, slot, or existing evidence
  blocks/conflicts. Worker evidence whose outcome conflicts with the durable
  worker run state blocks as `worker_outcome_mismatch` and can be retried with
  corrected typed input.
- Stale non-mutating worker-evidence history is retryable only while durable
  evidence/review/finalization is absent and current start-worker/run refs are
  complete. Completed `record_worker_evidence`, existing evidence bundle,
  review message, completion/failure decision, running worker, orphan worker,
  and task/run/workspace mismatch remain blockers.
- Completed, cancelled, and arbitrary failed workflow runs remain terminal for
  worker-evidence mutation unless the strict
  `retryable_worker_evidence_failure` or
  `retryable_worker_evidence_action_repair` proof above passes.
- Missing fresh exact confirmation blocks worker start and finalization.
- Missing `failureReason` blocks `dependency_failure_smoke` finalization.
- Prose confirmation, empty failure reason, stale/out-of-scope grant, opposite
  existing terminal decision, arbitrary failed workflow, cancelled workflow, or
  downstream already-started state blocks finalization with typed backend
  blockers.
- Backend Queue control `disabled` blocks worker start and does not
  auto-enable.
- Downstream never auto-starts after upstream accepted completion or terminal
  failure.
- Prose-only confirmation is ignored/invalid.
- `queue.review.ack` rejects stale `reviewMessageId`; canonical `messageId` is
  required.
- `queue.review.getEvidenceBundle` is the registered evidence read; there is
  no `queue.lifecycle.getEvidenceBundle` workflow capability.
- `globalExecutionState`, frontend overlays, Queue UI details, prompt-pack
  preview ids, titles, prompts, file paths, and transcript text are never
  workflow truth.

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
- `Frontend evidence only - not durable` (legacy/transitional UI label only)
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
- `Mark done backend required`
- `Create review message`
- `Acknowledge review`
- `Approve validation`
- `Add follow-up prompt`
- `Mark failed`
- `Block`
- `Dependent gated until backend completion`
- `Follow-up prompt returns to running`
- `Backend durability is not covered`
- `Real worker execution is not covered`
- `Real validation execution is not covered`
- `Real Git commit execution is not covered`
- `Action 1/16`
- `Action 2/16`
- `Workspace Agent action chain`
- `Protocol repair requested`
- `Workspace Agent action protocol error`
- `No broker action was executed`

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
    - Expected: dependency creation uses the exact `dependsOn` field with
      explicit upstream Queue task ids returned by typed Queue results. Do not
      use `dependencies`, `depends_on`, title text, prompt text, item order, or
      prose as dependency input.
    - Expected: Workspace Agent Queue action smoke uses an agent-emitted
      structured envelope such as
      `{"type":"hobit.action.request","capabilityId":"queue.createItems","dryRun":false,"input":{"items":[{"title":"Test Queue item","prompt":"Review the current workspace state and report one safe next step.","status":"draft"}]}}`.
    - Expected dependency smoke: first emit `queue.createItem` for upstream A,
      read the returned `createdTaskIds[0]` or created item id, then emit
      `queue.createItem` for downstream B with
      `{"dependsOn":["<upstream task id>"]}`. The downstream aggregate from
      `queue.items.list` should show `dependencyState: "waiting"` before
      upstream accepted completion and no `queue.item.startRun` suggestion.
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
      created as a hidden product-action workaround. Downstream dependency
      unblocking requires upstream backend accepted completion and does not
      auto-start downstream work. Codex/shell remain restricted capabilities
      for explicit workspace/code execution requests only.

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
      `Coordinator ACK - in review`, `Validation approved`,
      `Mark done unavailable without backend completion command`,
      `Dependent remains gated until backend accepted completion`,
      `Follow-up prompt returns to running`,
      `Queue-linked evidence event wiring available`,
      `Raw non-Queue Direct Work ingestion is blocked`,
      `Duplicate Queue-linked completion ingestion is guarded`,
      and `No hidden side effects` as passed fake broker-level checks.
    - Expected: the broker loop evidence rows show that
      `queue.lifecycle.agentFinished` consumed an explicit worker evidence
      bundle plus run id through the backend worker evidence command, the
      review message includes a bounded evidence summary,
      `queue.review.getEvidenceBundle` returns durable backend evidence when
      available, and the evidence includes a backend bundle id/state.
    - Expected: Queue backend aggregate read-model coverage is available for
      durable task/run-link/worker-evidence/review-message/completion state.
      Validation decision durability, block durability, real worker
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
      approval, legacy fake commit result attachment, compatibility done, and
      dependency gating.
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
    - Expected: backend aggregate/read-model tests cover durable task/run-link
      worker-evidence, review, and accepted-completion state, backend worker
      evidence command tests cover durable evidence record/readback, backend
      review command tests cover durable review message/ACK state, and backend
      completion command tests cover explicit accepted completion, and backend
      failure command tests cover explicit terminal failure. Real worker
      integration, real validation execution, real commit execution, durable
      block commands, and backend scheduler dependency enforcement remain not
      implemented.

20. Run the backend Queue aggregate read-model automated tests.
    - Expected:
      `crates/hobit-app/src/workspace_service/agent_queue_aggregate_tests.rs`
      proves aggregate state is derived from durable Queue task rows,
      compatibility dependency ids, latest run links, and widget run summaries.
    - Expected:
      `crates/hobit-app/src/workspace_service/agent_queue_headless_contract_tests.rs`
      proves Queue aggregate/read-model behavior headlessly through backend
      APIs and storage fixtures, including draft readiness, queued startability,
      running/completed/failed run links, dependency waiting, unknown,
      failed-upstream, completed-run-link-not-satisfied, accepted-completion
      unblock state, read-only queries, explicit task identity, no prompt regex
      routing, and explicit `not_durable` / `unknown` states.
    - Expected:
      `crates/hobit-app/src/workspace_service/agent_queue_review_tests.rs`
      proves `queue.review.createMessage` backend preconditions, Draft/Running
      rejection, explicit task id and actor id requirements, unrelated task
      isolation, durable reload of review message state, and ACK transition to
      `in_review`.
    - Expected:
      `crates/hobit-app/src/workspace_service/agent_queue_worker_evidence_tests.rs`
      proves `queue.lifecycle.agentFinished` backend preconditions, explicit
      task/run id requirements, unknown task rejection, run-link ownership
      rejection, durable successful and failed evidence storage, idempotent
      same task/run updates, no-done worker completion, aggregate
      `awaiting_review`, no-evidence/not-found readback, and reload durability.
    - Expected: Draft tasks report Draft with missing-setting blockers; queued
      tasks with settings expose `start_run`; running run links report Running;
      successful worker completion reports `awaiting_review` and not `done`;
      failed runs report failed worker evidence while the task remains review
      pending until explicit failure; completed worker state and review ACK do
      not unblock dependents; dependency `waiting`, `blocked`, `failed_upstream`,
      and `unknown` expose blockers with no `start_run` or runnable
      `promote_draft`; upstream `queue.item.markDone` clears the downstream
      dependency blocker on re-query but does not auto-start work; upstream
      `queue.item.fail` makes downstream reads report `failed_upstream`;
      aggregate reads do not mutate task or run-link state.
    - Expected:
      `apps/desktop/src-tauri/src/agent_queue_aggregate_dto_tests.rs` and
      `apps/desktop/src-tauri/src/agent_queue_aggregate_commands/tests.rs`
      prove stable DTO serialization, explicit workspace/task identity, and
      read-only command behavior without launching the frontend UI.
    - Expected:
      `apps/desktop/src-tauri/src/agent_queue_review_commands/tests.rs` proves
      review create/ACK command serialization, typed invalid-state rejection,
      actor id validation, ACK aggregate update, and frontend independence
      without launching Queue UI.
    - Expected:
      `apps/desktop/src-tauri/src/agent_queue_worker_evidence_commands/tests.rs`
      proves worker-finished and evidence-read command serialization, typed
      explicit task/run validation, frontend independence, and no hidden
      execution side effects without launching Queue UI.
    - Expected:
      `apps/desktop/src-tauri/src/agent_queue_failure_commands/tests.rs`
      proves fail command serialization, typed invalid input, default actor
      handling, backend blockers, frontend independence, and no hidden
      execution side effects without launching Queue UI.
    - Expected automated commands include
      `cargo test -p hobit-app agent_queue`,
      `cargo test -p hobit-desktop agent_queue_aggregate_commands`, and
      `cargo test -p hobit-desktop agent_queue_review_commands`, plus
      `cargo test -p hobit-desktop agent_queue_worker_evidence`, with the
      broader root `cargo test` remaining the final validation gate for this
      backend/API contract.
    - Expected: aggregate reads do not start work, run validation, mutate Git,
      execute rollback, launch Terminal, call shell/Codex, read frontend
      overlays, or infer task ids from prompt text.
    - Expected: UI overlays are treated as transitional compatibility state;
      Queue UI should render the authoritative aggregate DTO and send typed
      commands only after the migration phase.

21. In Workspace Agent, test a structured Queue dogfood lifecycle action
    request.
    - Expected: Workspace Agent can emit a valid
      `hobit.action.request` envelope for `queue.lifecycle.agentFinished`,
      `queue.review.createMessage`, `queue.review.ack`,
      `queue.coordinator.addFollowUpPrompt`, `queue.item.markDone`, or
      `queue.item.fail`. `queue.item.markDone` and `queue.item.fail` must
      include exact top-level confirmation, and fail must include a visible
      reason.
    - Expected: `queue.lifecycle.agentFinished` accepts either explicit fields
      or a structured `evidenceBundle` carrying task id, run id, attempt id,
      thread id, outcome, final agent message, changed files, validation
      summary/output preview, and log reference when available.
    - Expected: missing task id, missing run id, invalid evidence, task id
      mismatch, run id mismatch, and attempt id mismatch are rejected as typed
      invalid input before backend mutation.
    - Expected: the Action Broker validates the typed input schema. Review
      create/ACK, worker-finished/evidence-read, and markDone invoke
      backend/Tauri commands through the Workspace Agent queue bridge. Fail
      invokes the backend/Tauri terminal-failure command. Validation approval,
      follow-up, and block invoke the transitional
      injected frontend Queue lifecycle adapter where available.
    - Expected: dry-run lifecycle requests preview the transition and do not
      change lifecycle overlay state, create backend review messages, ACK
      review, mark done/fail, start workers, run validation, call Git, launch
      Terminal, execute rollback, call shell, or call Codex.
    - Expected: real worker-finished requests mutate only backend worker
      evidence plus task/run-link completion state; real review create/ACK
      requests mutate only the backend review message ledger; real markDone
      requests mutate only the backend accepted-completion ledger; real fail
      requests mutate only the backend terminal-failure decision ledger. Other
      real lifecycle requests mutate only the frontend/controller overlay. Real
      worker execution, real validation execution, real Git commit execution,
      rollback execution, and durable scheduler integration remain not
      implemented.
    - Expected: ordinary prose remains prose, and Queue lifecycle product
      actions are not triggered by natural-language phrase matching.

22. Run the Queue dogfood broker-loop automated self-test.
    - Expected:
      `apps/desktop/frontend/src/workbench/agents/selfTest/hobitQueueDogfoodBrokerSelfTest.test.ts`
      proves the fake dogfooding loop through Action Broker capability calls,
      including dry-run immutability, real fake-store execution mutation,
      wrong ACK target failure, backend-required mark-done unavailability in
      the fake store, failure-dependent blocking, and the honest
      skipped/blocked runtime gaps.
    - Expected: the main success path uses a structured worker evidence bundle
      plus explicit run id rather than only loose final-agent fields, and the
      test asserts backend worker evidence command consumption, review summary
      inclusion, durable evidence readback, no Git execution, and no dependent
      unblocking without backend accepted completion.
    - Expected: the self-test does not launch workers, run validation, execute
      Git commits, call Codex/shell, launch Terminal, execute rollback, create
      Queue views, or parse prose into actions. The fake-store loop does not
      write backend completion state; real backend writes are covered by the
      worker evidence, review message/ACK, and completion command tests.
    - Expected: the self-test report includes inventory rows stating
      Queue-linked evidence event wiring is available, raw non-Queue Direct
      Work ingestion is blocked/skipped, duplicate completion ingestion is
      guarded, and validation/commit/scheduler durability is still
      skipped/not covered.

23. Run the Queue worker evidence ingestion bridge automated test.
    - Expected:
      `apps/desktop/frontend/src/workbench/queue/smartQueueWorkerEvidenceIngestion.test.ts`
      proves an explicitly Queue-linked fake/frontend completion result builds
      a normalized evidence bundle and invokes `queue.lifecycle.agentFinished`
      through the Action Broker.
    - Expected: dry-run produces a preview and leaves backend evidence
      unchanged; real ingestion records durable backend worker evidence, moves
      the linked item to backend `Awaiting review`, and returns `Queue worker
      evidence ingested` / `Queue item awaiting review`.
    - Expected: `queue.review.getEvidenceBundle` returns durable backend
      evidence after ingestion.
    - Expected: review-message creation is still an explicit next action; after
      explicit `queue.review.createMessage`, the review message includes the
      evidence summary and returns the selected durable `evidenceBundleId` /
      `runId`. If it is blocked, the result explains the backend blocker and
      current aggregate states instead of relying on frontend overlay truth.
    - Expected: missing task id, missing run id, task id mismatch, run id
      mismatch, attempt id mismatch, invalid evidence, unavailable controller,
      and non-linked Direct Work completion return structured failure or
      skipped statuses. No task id or run id is inferred from prompt text or
      final-message text.
    - Expected: ingestion does not ACK review, approve validation, mark done,
      start dependents, start workers, run validation, execute Git/commit,
      execute rollback, call Codex/shell, launch Terminal, create Queue views,
      or persist validation/commit/follow-up/mark-done/fail/block state.
    - Expected: broad automatic real worker event wiring is not covered by this
      test and remains future work.

24. Run the Queue-linked Direct Work metadata seam and evidence event wiring
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
    - Expected: successful wiring records durable backend worker evidence for
      only the linked task/run and makes it readable for explicit backend
      review/evidence actions. It does not create a review message, ACK review,
      approve validation, mark done, start dependents, start workers, run
      validation, call Git, execute rollback, launch Terminal, call shell/Codex,
      or add validation/commit/follow-up/block durability.
    - Expected: broader lifecycle restart recovery, real validation execution,
      real Git commit execution, and scheduler behavior remain not implemented.

25. Inspect the minimal Queue review/evidence UI for a task that reached
    `Awaiting review` or `In review` through explicit Queue-linked evidence.
    - Expected: the active QueueV2 task details Result tab shows a compact
      `Dogfood review` section only for relevant review/evidence state.
    - Expected: the section shows product-facing lifecycle status, agent
      outcome, evidence availability, bounded final agent message, changed-file
      count with a capped filename preview, validation summary/output preview,
      run/log reference when available, and a compact evidence label. Until the
      Queue UI renders the authoritative aggregate/evidence DTO directly, any
      frontend-only evidence overlay label remains transitional compatibility,
      not product truth.
    - Expected: explicit review actions use broker capabilities where wired:
      `Create review message`, `Acknowledge review`, `Approve validation`,
      `Add follow-up prompt`, `Mark done`, `Mark failed`, and `Block`.
      `Mark done` must go through the backend accepted-completion command and
      exact structured confirmation; `Mark failed` must go through the backend
      terminal-failure command with exact structured confirmation and a reason;
      UI state must not fake done or failed.
    - Expected: follow-up prompt and fail/block reason inputs reject empty text
      with product-facing validation messages.
    - Expected: if broker access is unavailable, the section shows a compact
      unavailable state and does not show fake success.
    - Expected: the UI does not auto-create a review message, auto-ACK, approve
      validation by itself, mark done by itself, start dependents, start
      workers, run validation, call Git, execute rollback, launch Terminal,
      call shell/Codex, create another Queue view, or add validation/commit/
      follow-up/block durability.
    - Expected: full review/evidence UI polish, real validation execution, real
      Git commit execution, and broader lifecycle restart recovery remain
      future work.

26. Check for side effects.
    - Expected: no Git/file mutation, Terminal launch, Workspace Agent runtime
      call, rollback execution, or hidden worker start happened during preview,
      creation, retry preparation, assistance preparation, or rollback
      proposal preparation.

27. Run a Workspace Agent Direct Work prompt and inspect Direct Work request or
    log details where available.
    - Expected: the prompt sent to Codex includes Hobit capability context,
      compact Queue/agent capability names, and policy rules before the user
      request.
    - Expected: no Queue item is created, no duplicate Queue view is created,
      and no worker starts merely because context was injected or because the
      user prompt contains Queue words.
    - Expected: Queue item creation happens only when the agent emits a valid
      structured Hobit action request and the broker allows it.
    - Expected: if the model writes prose such as `Awaiting queue.items.list
      result.` without a valid `hobit.action.request`, no Queue capability is
      invoked and the run does not silently complete as successful. The
      Workspace Agent should show `Protocol repair requested` once when a
      same-thread repair is possible, or `Workspace Agent action protocol
      error` with `No broker action was executed` when repair is unavailable
      or fails.
    - Expected: a valid final user-facing answer in typed-capability action
      mode uses `{"type":"hobit.final.answer","message":"..."}` so the
      runtime can distinguish completion from an intermediate waiting state.
    - Expected: if a broker result is eligible for continuation and the Codex
      thread id is available, the next Direct Work request uses compact
      `hobit.action.result` context in the same thread, not a new visible
      operator turn or pasted prompt.
    - Expected: missing or blank model requestId values are replaced with a
      unique derived continuation id, while explicitly repeated requestIds
      still stop before duplicate execution.
    - Expected: transcript/activity show compact action-chain rows such as
      `Action 1/16: queue.targetSingletonQueue` and
      `Action 2/16: queue.items.list`; they do not dump raw JSON, logs, secrets,
      or stack traces.
    - Expected: `queue.lifecycle.get`, backend-backed read-only
      `queue.review.getEvidenceBundle`, and successful backend-backed
      `queue.review.ack` can appear in the continuation chain and proceed to
      the next envelope or explicit `hobit.final.answer` after success.
      Expected ACK path:
      `queue.review.ack -> queue.lifecycle.get -> hobit.final.answer`.
      ACK remains review state and must not auto-mark done or make
      finalization capabilities safe by default. `queue.item.markDone` and
      `queue.item.fail` remain explicit and confirmation-required; they may
      continue only inside the appropriate structured Queue autonomy grant
      with a valid typed nextAction, exact token, and backend preconditions.
    - Expected with a valid `queue_acceptance_smoke` grant for legacy assigned
      start-run reconciliation: a typed
      `queue.control.setManualEnabled -> queue.item.startRun` nextAction
      continues when `taskId`, compatibility `executorWidgetId`, and exact
      confirmation are available. Current backend-owned `queue_local` workflow
      smoke does not use this legacy field as canonical run identity. Older
      `queue.enable -> queue.item.startRun` nextActions remain
      compatibility-only. `queue.item.markDone` can run only from a valid
      final-accept nextAction, and success does not auto-start downstream work.
    - Expected with a valid `queue_failure_smoke` grant: a typed
      `queue.item.fail` nextAction can run only with explicit `taskId`,
      visible `reason`, exact confirmation, and backend preconditions; success
      does not auto-start downstream work and downstream reads report the
      backend failure/dependency state.
    - Expected: the chain stops with a visible reason on confirmation,
      policy-blocked, unavailable, dry-run-required, failed, invalid input,
      repeated request id, repeated capability/input, unsupported envelope,
      restricted capability, max action count, or unavailable thread.

## Legacy Assigned StartRun Reconciliation Smoke

This section is compatibility coverage for the older assigned Agent Executor
start path. It is not current backend-owned `queue_local` workflow smoke
validation and must not replace the fresh headless workflow smoke above.

1. In Workspace Agent, ask the agent to use typed Queue capabilities and emit
   one `hobit.action.request` envelope at a time.
   - Expected: ordinary prose is not routed by regex or phrase matching, and
     action lists are rejected.

2. Invoke `queue.items.list` and identify one explicit task id.
   - Expected: the item summary comes from the backend/Tauri authoritative
     Queue aggregate DTO, not Queue board state, selected task details,
     frontend overlays, UI hooks, or local broker lifecycle maps.
   - Expected: the item summary includes the selected task id, title,
     ticket/worker/review/evidence/validation/commit/dependency states,
     blockers, nextActions, latestRun when available, durable flags including
     honest `not_durable` / `unknown` state, readiness compatibility fields,
     and available executor targets.
   - Expected with continuation: when `nextAction` is present, the next request
     uses `nextAction.capabilityId` and `nextAction.input` exactly. If
     `nextAction` is unavailable, the agent stops or asks; it does not infer
     ids or field names from task titles, final messages, paths, repo roots, or
     the operator prompt, and it does not execute from
     `nextSuggestedCapability` alone.

3. Invoke `queue.item.updateRunSettings` for that exact `taskId` with
   `workspaceRoot`, `codexExecutable`, `sandbox`, and `approvalPolicy` where
   needed.
   - Expected: readiness moves toward `ready_to_queue`; no worker starts.

4. Invoke `queue.item.promoteDraft` for the same exact `taskId` when readiness
   permits.
   - Expected: status becomes `queued`; no worker starts.

5. Invoke `queue.control.setManualEnabled`.
   - Expected: backend Queue control state becomes `manual_enabled` or returns
     `already_in_state`; no Queue Autorun, scheduler dispatch, shell,
     Terminal, Git, validation, rollback, worker start, dependent task start,
     run-link creation, Queue task mutation, evidence/review/finalization
     mutation, or workflow invocation is triggered.
   - Use `expectedVersion` from `queue.control.get` when version-aware smoke
     setup is needed. A mismatch returns `version_conflict`.
   - If an older Queue result reported typed `nextAction.capabilityId:
     "queue.enable"` with blocker `Queue disabled.`, `queue.enable` remains a
     compatibility action. New smoke flows should use
     `queue.control.setManualEnabled`. `nextSuggestedCapability` alone remains
     informational.

6. If intentionally testing the legacy assigned Agent Executor path, invoke
   `queue.item.startRun` with the same exact `taskId` and an explicit
   compatibility `executorWidgetId`.
   - Required: backend Queue control is already `manual_enabled` and the
     request has top-level `confirmationToken: "operator-confirmed"`.
   - Expected on accepted legacy start: the result includes `taskId`,
     compatibility `executorWidgetId`, and canonical Queue run-link `runId`;
     the Queue task refreshes to `running` or the latest backend final state;
     latest run-link metadata shows the returned run id; the board/details do
     not remain stale as Ready/Queued.
   - Expected when Queue is disabled: the capability returns blocked with
     `Queue disabled.` and may expose typed `nextAction` for `queue.enable`;
     it does not auto-enable Queue.
   - Expected when start cannot actually run: the capability returns blocked
     or unavailable with a compact blocker such as local executor unavailable
     and does not claim `Queue-linked run started`.

7. If the run completes or fails while Hobit is open, refresh the task and
   result evidence.
   - Expected: matching final `AgentExecutorRunDetail` plus explicit Queue
     run-link metadata ingests durable backend worker evidence and moves the
     backend aggregate to `Awaiting review`.
   - Expected: no evidence is shown before completion/final detail exists.

8. Inspect `queue.review.getEvidenceBundle` and the Queue details Result tab.
   - Expected: durable backend evidence is available through
     `queue.review.getEvidenceBundle` when ingestion succeeded; review-message
     creation may expose typed `nextAction` when `taskId`, `runId`, and
     `evidenceBundleId` are known, but review creation, ACK, validation
     approval, mark done, and dependent starts remain explicit separate
     actions. Mark done is backend accepted completion, not a Queue UI truth
     source.
   - Expected: `queue.lifecycle.get` requires the explicit task id and reads
     the backend/Tauri aggregate DTO for lifecycle/effective state, blockers,
     nextActions, latestRun, evidenceSummary, durable flags, and
     `authoritativeBackendAggregate=true`; it does not read frontend lifecycle
     overlays or broker-local lifecycle maps as truth.
   - Expected: Queue details UI may still show transitional compatibility
     evidence labels until the UI migration renders the authoritative
     aggregate/evidence DTO directly.

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
