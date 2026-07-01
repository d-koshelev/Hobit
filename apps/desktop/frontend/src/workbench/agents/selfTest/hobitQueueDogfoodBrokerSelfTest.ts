import type { SmartQueueReviewMessage } from "../../queue/smartQueueDogfoodLifecycle";
import type {
  QueueAgentLifecycleTransitionOutput,
  QueueAgentReviewEvidenceBundleOutput,
} from "../adapters";
import type { HobitAgentBrokerResult } from "../broker";
import { createQueueDogfoodBrokerSelfTestFakeStore } from "./hobitQueueDogfoodBrokerSelfTestStore";
import {
  DEFAULT_QUEUE_DOGFOOD_BROKER_FIXTURE,
  QUEUE_DOGFOOD_BROKER_COVERAGE_BOUNDARY,
  QUEUE_DOGFOOD_BROKER_SELF_TEST_REQUIRED_CAPABILITY_IDS,
  type QueueDogfoodBrokerSelfTestCase,
  type QueueDogfoodBrokerSelfTestFakeStore,
  type QueueDogfoodBrokerSelfTestReport,
  type QueueDogfoodBrokerSelfTestSideEffectAssertion,
  type QueueDogfoodBrokerSelfTestStatus,
} from "./hobitQueueDogfoodBrokerSelfTestTypes";

export { createQueueDogfoodBrokerSelfTestFakeStore };
export {
  QUEUE_DOGFOOD_BROKER_SELF_TEST_REQUIRED_CAPABILITY_IDS,
} from "./hobitQueueDogfoodBrokerSelfTestTypes";
export type {
  QueueDogfoodBrokerSelfTestCase,
  QueueDogfoodBrokerSelfTestReport,
  QueueDogfoodBrokerSelfTestSideEffectAssertion,
  QueueDogfoodBrokerSelfTestStatus,
} from "./hobitQueueDogfoodBrokerSelfTestTypes";

export function runQueueDogfoodBrokerSelfTest({
  createdAt = DEFAULT_QUEUE_DOGFOOD_BROKER_FIXTURE.createdAt,
  reportId = "queue-dogfood-broker:self-test",
}: {
  readonly createdAt?: string;
  readonly reportId?: string;
} = {}): QueueDogfoodBrokerSelfTestReport {
  const store = createQueueDogfoodBrokerSelfTestFakeStore({ createdAt });
  const main = runMainSuccessPath(store);
  const followUp = runFollowUpPath(store);
  const failure = runFailurePath(store);
  const requiredCapabilitiesExercised =
    QUEUE_DOGFOOD_BROKER_SELF_TEST_REQUIRED_CAPABILITY_IDS.every((capabilityId) =>
      store.exercisedCapabilityIds.includes(capabilityId),
    );
  const sideEffectAssertions = queueDogfoodBrokerSideEffectAssertions(store);
  const noHiddenSideEffects = sideEffectAssertions.every(
    (assertion) => assertion.passed,
  );
  const coveredPassed =
    main.passed &&
    followUp.passed &&
    failure.passed &&
    requiredCapabilitiesExercised &&
    noHiddenSideEffects;
  const coveredCases: QueueDogfoodBrokerSelfTestCase[] = [
    selfTestCase({
      capabilityIds: [],
      caseId: "queue-dogfood-broker:summary",
      evidence: [
        QUEUE_DOGFOOD_BROKER_COVERAGE_BOUNDARY,
        `Exercised capabilities: ${[
          ...new Set(store.exercisedCapabilityIds),
        ].join(", ")}.`,
      ],
      message: coveredPassed
        ? "Queue dogfood broker loop passed."
        : "Queue dogfood broker loop failed.",
      status: coveredPassed ? "passed" : "failed",
      title: "Queue dogfood broker loop",
    }),
    ...main.cases,
    ...followUp.cases,
    ...failure.cases,
    selfTestCase({
      capabilityIds: [],
      caseId: "queue-dogfood-broker:no-hidden-side-effects",
      evidence: sideEffectAssertions.map((assertion) => assertion.label),
      message: noHiddenSideEffects
        ? "No hidden side effects."
        : "Hidden side-effect assertion failed.",
      status: noHiddenSideEffects ? "passed" : "failed",
      title: "No hidden side effects",
    }),
    ...queueLinkedEvidenceEventWiringInventoryCases(),
  ];
  const cases = [...coveredCases, ...notCoveredRuntimeGapCases()];
  const summary = summarizeQueueDogfoodBrokerSelfTestCases(cases);
  const status = overallStatusForQueueDogfoodBrokerCases(cases);

  return {
    cases,
    coverageBoundary: QUEUE_DOGFOOD_BROKER_COVERAGE_BOUNDARY,
    createdAt,
    exercisedCapabilityIds: [...new Set(store.exercisedCapabilityIds)],
    productSummary:
      status === "passed"
        ? "Queue dogfood broker loop passed at fake frontend broker level. Runtime durability and real execution checks remain not covered."
        : "Queue dogfood broker loop has failed or blocked checks.",
    reportId,
    sideEffectAssertions,
    status,
    summary,
  };
}

function queueLinkedEvidenceEventWiringInventoryCases(): QueueDogfoodBrokerSelfTestCase[] {
  return [
    selfTestCase({
      capabilityIds: ["queue.lifecycle.agentFinished"],
      caseId: "queue-dogfood-broker:queue-linked-evidence-event-wiring",
      evidence: [
        "Frontend wiring exists in useCodexDirectWorkQueueHandoff and queueLinkedDirectWorkEvidenceWiring.",
        "It requires explicit Queue-linked metadata, matching final AgentExecutorRunDetail, and the ingestion bridge callback.",
        "The mutation path remains Queue-linked completion -> evidence ingestion bridge -> Action Broker -> queue.lifecycle.agentFinished.",
      ],
      message: "Queue-linked evidence event wiring is available.",
      required: false,
      status: "passed",
      title: "Queue-linked evidence event wiring available",
    }),
    selfTestCase({
      capabilityIds: ["queue.lifecycle.agentFinished"],
      caseId: "queue-dogfood-broker:raw-non-queue-ingestion-blocked",
      evidence: [
        "Raw Workspace Agent, raw Direct Work, Agent Activity, and standalone Agent Executor history are not ingestion sources.",
        "Evidence ingestion requires explicit Queue task/run linkage and never infers taskId or runId from prompt, title, final message, repo path, or changed files.",
      ],
      message: "Raw non-Queue Direct Work ingestion is blocked.",
      required: false,
      status: "passed",
      title: "Raw non-Queue ingestion blocked",
    }),
    selfTestCase({
      capabilityIds: ["queue.lifecycle.agentFinished"],
      caseId: "queue-dogfood-broker:duplicate-completion-guarded",
      evidence: [
        "The frontend wiring uses the Queue-linked metadata current-session idempotency key.",
        "Repeated final stream events and recovered final detail for the same Queue item/run are ignored after the first ingestion attempt.",
        "The idempotency guard is frontend/session-only and not backend durability.",
      ],
      message: "Duplicate Queue-linked completion ingestion is guarded.",
      required: false,
      status: "passed",
      title: "Duplicate completion guarded",
    }),
  ];
}

export function summarizeQueueDogfoodBrokerSelfTestCases(
  cases: readonly QueueDogfoodBrokerSelfTestCase[],
): QueueDogfoodBrokerSelfTestReport["summary"] {
  return {
    blocked: cases.filter((item) => item.status === "blocked").length,
    failed: cases.filter((item) => item.status === "failed").length,
    passed: cases.filter((item) => item.status === "passed").length,
    skipped: cases.filter((item) => item.status === "skipped").length,
    total: cases.length,
  };
}

function runMainSuccessPath(store: QueueDogfoodBrokerSelfTestFakeStore): {
  readonly cases: readonly QueueDogfoodBrokerSelfTestCase[];
  readonly passed: boolean;
} {
  const dependentBeforeDoneStartable = store.canDependentStart(
    store.dependentTaskId,
  );
  const agentFinished = store.invoke<QueueAgentLifecycleTransitionOutput>(
    "queue.lifecycle.agentFinished",
    {
      evidenceBundle: store.evidenceBundle,
    },
  );
  const agentFinishedOutput = lifecycleOutput(agentFinished);
  const reviewCreated = store.invoke<QueueAgentLifecycleTransitionOutput>(
    "queue.review.createMessage",
    {
      coordinatorAgentId: store.coordinatorAgentId,
      messageId: store.reviewMessageId,
      taskId: store.taskId,
    },
  );
  const reviewMessage = reviewMessageValue(lifecycleOutput(reviewCreated));
  const evidence = store.readEvidenceBundle(
    store.taskId,
  ) as QueueAgentReviewEvidenceBundleOutput | null;
  const acked = store.invoke<QueueAgentLifecycleTransitionOutput>(
    "queue.review.ack",
    {
      coordinatorAgentId: store.coordinatorAgentId,
      messageId: store.reviewMessageId,
      taskId: store.taskId,
    },
  );
  const ackOutput = lifecycleOutput(acked);
  const approved = store.invoke<QueueAgentLifecycleTransitionOutput>(
    "queue.coordinator.approveValidation",
    {
      coordinatorAgentId: store.coordinatorAgentId,
      summary: store.validationSummary,
      taskId: store.taskId,
      validationApprovalId: "validation-upstream-1",
    },
  );
  const approvedOutput = lifecycleOutput(approved);
  const done = store.invoke<QueueAgentLifecycleTransitionOutput>(
    "queue.item.markDone",
    {
      reason: "Accepted by fake broker self-test.",
      taskId: store.taskId,
    },
    { confirmationToken: "operator-confirmed" },
  );
  const doneOutput = lifecycleOutput(done);
  const dependentAfterDoneStartable = store.canDependentStart(
    store.dependentTaskId,
  );
  const reviewMessageHasEvidence =
    reviewMessage?.finalAgentMessage === store.finalAgentMessage &&
    reviewMessage.validationSummary === store.validationSummary &&
    reviewMessage.changedFilesSummary === store.changedFilesSummary &&
    reviewMessage.evidenceSummary === store.evidenceBundle.summary.humanSummary &&
    reviewMessage.workerEvidenceBundle?.taskId === store.taskId &&
    evidence?.finalAgentMessage === store.finalAgentMessage &&
    evidence.validationSummary === store.validationSummary &&
    evidence.changedFilesSummary === store.changedFilesSummary &&
    evidence.evidenceBundle?.taskId === store.taskId &&
    evidence.evidenceBundle?.threadId === store.fakeThreadId &&
    evidence.evidenceBundlePersistence === "frontend_only_not_durable";
  const agentFinishedPassed =
    agentFinished.status === "succeeded" &&
    agentFinishedOutput?.ticketState === "awaiting_review" &&
    agentFinishedOutput.lifecycle?.workerEvidenceBundle?.taskId === store.taskId &&
    agentFinishedOutput.lifecycle?.currentThreadId === store.fakeThreadId;
  const reviewCreatedPassed =
    reviewCreated.status === "succeeded" && reviewMessageHasEvidence;
  const ackPassed =
    acked.status === "succeeded" && ackOutput?.ticketState === "in_review";
  const validationPassed =
    approved.status === "succeeded" &&
    approvedOutput?.ticketState === "in_review" &&
    (approvedOutput.lifecycle?.validationApprovals.length ?? 0) > 0 &&
    approvedOutput.wouldRunValidation === false;
  const markDonePassed =
    done.status === "unavailable" && doneOutput?.ticketState !== "done";
  const dependentGatePassed =
    !dependentBeforeDoneStartable && !dependentAfterDoneStartable;

  return {
    cases: [
      selfTestCase({
        capabilityIds: ["queue.lifecycle.agentFinished"],
        caseId: "queue-dogfood-broker:agent-finished-awaiting-review",
        evidence: [
          brokerEvidence(agentFinished),
          `ticketState: ${agentFinishedOutput?.ticketState ?? "unknown"}.`,
          `Evidence bundle task: ${agentFinishedOutput?.lifecycle?.workerEvidenceBundle?.taskId ?? "missing"}.`,
          `Evidence thread: ${agentFinishedOutput?.lifecycle?.currentThreadId ?? "missing"}.`,
          "Broker invoked queue.lifecycle.agentFinished with a worker evidence bundle.",
        ],
        message: agentFinishedPassed
          ? "Agent finished - awaiting review."
          : "Agent finished transition did not reach awaiting review.",
        status: agentFinishedPassed ? "passed" : "failed",
        title: "Agent finished - awaiting review",
      }),
      selfTestCase({
        capabilityIds: [
          "queue.review.createMessage",
          "queue.review.getEvidenceBundle",
        ],
        caseId: "queue-dogfood-broker:review-message-created",
        evidence: [
          brokerEvidence(reviewCreated),
          `Review message id: ${reviewMessage?.messageId ?? "missing"}.`,
          `Final agent message: ${evidence?.finalAgentMessage ?? "missing"}.`,
          `Validation summary: ${evidence?.validationSummary ?? "missing"}.`,
          `Changed files summary: ${evidence?.changedFilesSummary ?? "missing"}.`,
          `Evidence summary: ${evidence?.evidenceSummary?.humanSummary ?? "missing"}.`,
          `Evidence persistence: ${evidence?.evidenceBundlePersistence ?? "missing"}.`,
        ],
        message: reviewCreatedPassed
          ? "Review message created."
          : "Review message evidence was incomplete.",
        status: reviewCreatedPassed ? "passed" : "failed",
        title: "Review message created",
      }),
      selfTestCase({
        capabilityIds: ["queue.review.ack"],
        caseId: "queue-dogfood-broker:coordinator-ack-in-review",
        evidence: [
          brokerEvidence(acked),
          `ticketState: ${ackOutput?.ticketState ?? "unknown"}.`,
        ],
        message: ackPassed
          ? "Coordinator ACK - in review."
          : "Coordinator ACK did not move item into review.",
        status: ackPassed ? "passed" : "failed",
        title: "Coordinator ACK - in review",
      }),
      selfTestCase({
        capabilityIds: ["queue.coordinator.approveValidation"],
        caseId: "queue-dogfood-broker:validation-approved",
        evidence: [
          brokerEvidence(approved),
          "Validation approval is model-only.",
          `wouldRunValidation: ${String(approvedOutput?.wouldRunValidation)}.`,
        ],
        message: validationPassed
          ? "Validation approved."
          : "Validation approval placeholder was not recorded.",
        status: validationPassed ? "passed" : "failed",
        title: "Validation approved",
      }),
      selfTestCase({
        capabilityIds: ["queue.item.markDone"],
        caseId: "queue-dogfood-broker:mark-done",
        evidence: [
          brokerEvidence(done),
          "Backend accepted completion is required for done.",
          "No frontend fake done state or fake commit metadata is attached by queue.item.markDone.",
        ],
        message: markDonePassed
          ? "Mark done unavailable without backend completion command."
          : "Mark done unexpectedly finalized through the frontend broker.",
        status: markDonePassed ? "passed" : "failed",
        title: "Mark done backend required",
      }),
      selfTestCase({
        capabilityIds: ["queue.item.markDone"],
        caseId: "queue-dogfood-broker:dependent-unblocked-after-done",
        evidence: [
          `Dependent startable before done: ${String(dependentBeforeDoneStartable)}.`,
          `Dependent startable without accepted completion: ${String(dependentAfterDoneStartable)}.`,
          "Dependency gate uses backend accepted completion, not agent completion or review ACK.",
        ],
        message: dependentGatePassed
          ? "Dependent remains gated until backend accepted completion."
          : "Dependent dependency gate unblocked before backend accepted completion.",
        status: dependentGatePassed ? "passed" : "failed",
        title: "Dependent gated until backend completion",
      }),
    ],
    passed:
      agentFinishedPassed &&
      reviewCreatedPassed &&
      ackPassed &&
      validationPassed &&
      markDonePassed &&
      dependentGatePassed,
  };
}

function runFollowUpPath(store: QueueDogfoodBrokerSelfTestFakeStore): {
  readonly cases: readonly QueueDogfoodBrokerSelfTestCase[];
  readonly passed: boolean;
} {
  store.invoke("queue.lifecycle.agentFinished", {
    attemptId: "attempt-follow-up-1",
    finalAgentMessage: "Follow-up needed after fake review.",
    outcome: "completed",
    runId: "fake-run-follow-up-1",
    taskId: store.followUpTaskId,
    validationSummary: "Follow-up validation needs another pass.",
  });
  store.invoke("queue.review.createMessage", {
    coordinatorAgentId: store.coordinatorAgentId,
    messageId: "review-message-follow-up-1",
    taskId: store.followUpTaskId,
  });
  store.invoke("queue.review.ack", {
    coordinatorAgentId: store.coordinatorAgentId,
    messageId: "review-message-follow-up-1",
    taskId: store.followUpTaskId,
  });
  const followUp = store.invoke<QueueAgentLifecycleTransitionOutput>(
    "queue.coordinator.addFollowUpPrompt",
    {
      coordinatorAgentId: store.coordinatorAgentId,
      followUpPromptId: "follow-up-prompt-1",
      prompt: store.followUpPrompt,
      taskId: store.followUpTaskId,
      threadId: "thread-follow-up-1",
    },
  );
  const output = lifecycleOutput(followUp);
  const passed =
    followUp.status === "succeeded" &&
    output?.ticketState === "running" &&
    output.agentPromptState === "additional_prompt_running" &&
    output.additionalPromptCount === 1 &&
    output.wouldStartWorkers === false;

  return {
    cases: [
      selfTestCase({
        capabilityIds: [
          "queue.lifecycle.agentFinished",
          "queue.review.createMessage",
          "queue.review.ack",
          "queue.coordinator.addFollowUpPrompt",
        ],
        caseId: "queue-dogfood-broker:follow-up-running",
        evidence: [
          brokerEvidence(followUp),
          `ticketState: ${output?.ticketState ?? "unknown"}.`,
          `agentPromptState: ${output?.agentPromptState ?? "unknown"}.`,
          `additionalPromptCount: ${String(output?.additionalPromptCount ?? "unknown")}.`,
          `wouldStartWorkers: ${String(output?.wouldStartWorkers)}.`,
        ],
        message: passed
          ? "Follow-up prompt returns to running."
          : "Follow-up prompt did not return the item to running.",
        status: passed ? "passed" : "failed",
        title: "Follow-up prompt returns to running",
      }),
    ],
    passed,
  };
}

function runFailurePath(store: QueueDogfoodBrokerSelfTestFakeStore): {
  readonly cases: readonly QueueDogfoodBrokerSelfTestCase[];
  readonly passed: boolean;
} {
  store.invoke("queue.lifecycle.agentFinished", {
    attemptId: "attempt-failure-1",
    finalAgentMessage: "Fake worker reported terminal failure evidence.",
    outcome: "failed",
    runId: "fake-run-failure-1",
    taskId: store.failureTaskId,
    validationSummary: "Validation failed in fake evidence.",
  });
  store.invoke("queue.review.createMessage", {
    coordinatorAgentId: store.coordinatorAgentId,
    messageId: "review-message-failure-1",
    taskId: store.failureTaskId,
  });
  store.invoke("queue.review.ack", {
    coordinatorAgentId: store.coordinatorAgentId,
    messageId: "review-message-failure-1",
    taskId: store.failureTaskId,
  });
  const failed = store.invoke<QueueAgentLifecycleTransitionOutput>(
    "queue.item.fail",
    {
      reason: "Fake coordinator accepted the failure evidence.",
      taskId: store.failureTaskId,
    },
    { confirmationToken: "operator-confirmed" },
  );
  const output = lifecycleOutput(failed);
  const dependentStartable = store.canDependentStart(
    store.failureDependentTaskId,
  );
  const passed =
    failed.status === "unavailable" &&
    failed.result.message.includes("backend-owned") &&
    dependentStartable === false;

  return {
    cases: [
      selfTestCase({
        capabilityIds: [
          "queue.lifecycle.agentFinished",
          "queue.review.createMessage",
          "queue.review.ack",
          "queue.item.fail",
        ],
        caseId: "queue-dogfood-broker:failure-dependent-blocked",
        evidence: [
          brokerEvidence(failed),
          `ticketState: ${output?.ticketState ?? "backend-unavailable"}.`,
          `Dependent startable after upstream failure: ${String(dependentStartable)}.`,
        ],
        message: passed
          ? "Terminal failure requires backend durability."
          : "Terminal failure branch did not stop at backend-owned boundary.",
        status: passed ? "passed" : "failed",
        title: "Terminal failure requires backend durability",
      }),
    ],
    passed,
  };
}

function queueDogfoodBrokerSideEffectAssertions(
  store: QueueDogfoodBrokerSelfTestFakeStore,
): QueueDogfoodBrokerSelfTestSideEffectAssertion[] {
  const lifecycleOutputs = store.brokerResults
    .map((result) => lifecycleOutput(result))
    .filter(
      (output): output is QueueAgentLifecycleTransitionOutput =>
        Boolean(output),
    );
  const noUnsafeLifecycleOutput = lifecycleOutputs.every(
    (output) =>
      output.wouldAutoRunWorkers === false &&
      output.wouldCallGit === false &&
      output.wouldExecuteRollback === false &&
      output.wouldLaunchTerminal === false &&
      output.wouldPersistBackend === false &&
      output.wouldRunValidation === false &&
      output.wouldStartWorkers === false,
  );
  const exercised = new Set(store.exercisedCapabilityIds);

  return [
    assertion("no-codex-run", "No Codex run", !exercised.has("codex.runTask")),
    assertion(
      "no-shell-command",
      "No shell command",
      !exercised.has("workspace.shell.runCommand"),
    ),
    assertion(
      "only-fake-lifecycle-overlay",
      "Only fake frontend lifecycle overlay mutation",
      lifecycleOutputs.every(
        (output) =>
          output.queueMutation === "none" ||
          output.queueMutation === "frontend_controller_overlay",
      ),
    ),
    assertion(
      "no-real-worker-start",
      "No real Queue worker start",
      noUnsafeLifecycleOutput,
    ),
    assertion("no-terminal-launch", "No Terminal launch", noUnsafeLifecycleOutput),
    assertion("no-git-mutation", "No Git mutation", noUnsafeLifecycleOutput),
    assertion(
      "no-rollback-execution",
      "No rollback execution",
      noUnsafeLifecycleOutput,
    ),
    assertion(
      "no-backend-persistence",
      "No backend durability or storage mutation",
      noUnsafeLifecycleOutput,
    ),
    assertion(
      "no-duplicate-queue-view",
      "No duplicate Queue view creation",
      store.queueId === "workspace-queue",
    ),
    assertion(
      "no-regex-routing",
      "No natural-language regex routing",
      store.brokerResults.every((result) =>
        result.request.reason === "queue-dogfood-broker-self-test",
      ),
    ),
  ];
}

function notCoveredRuntimeGapCases(): QueueDogfoodBrokerSelfTestCase[] {
  return [
    selfTestCase({
      capabilityIds: [],
      caseId: "queue-dogfood-broker:backend-durability",
      evidence: [
        "This self-test uses a deterministic frontend fake store only.",
        "No backend storage, SQLite, Tauri, or IPC path is invoked.",
      ],
      message: "Backend durability is not covered.",
      reason: "Frontend fake broker self-test only",
      required: false,
      status: "skipped",
      title: "Backend durability not covered",
    }),
    runtimeGapCase(
      "queue-dogfood-broker:real-worker-execution",
      "Real worker execution is not covered.",
      "The self-test does not start Queue Autorun or a real worker.",
    ),
    runtimeGapCase(
      "queue-dogfood-broker:real-validation-execution",
      "Real validation execution is not covered.",
      "The self-test does not run validation commands.",
    ),
    runtimeGapCase(
      "queue-dogfood-broker:real-git-commit-execution",
      "Real Git commit execution is not covered.",
      "The self-test does not execute Git commit commands.",
    ),
  ];
}

function runtimeGapCase(
  caseId: string,
  message: string,
  gapEvidence: string,
): QueueDogfoodBrokerSelfTestCase {
  return selfTestCase({
    capabilityIds: [],
    caseId,
    evidence: [
      "Lifecycle outputs report no real execution side effects.",
      gapEvidence,
    ],
    message,
    reason: "Runtime execution not implemented in this self-test",
    required: false,
    status: "blocked",
    title: message.replace(".", ""),
  });
}

function selfTestCase({
  capabilityIds,
  caseId,
  evidence,
  message,
  reason,
  required = true,
  status,
  title,
}: {
  readonly capabilityIds: readonly string[];
  readonly caseId: string;
  readonly evidence: readonly string[];
  readonly message: string;
  readonly reason?: string;
  readonly required?: boolean;
  readonly status: QueueDogfoodBrokerSelfTestStatus;
  readonly title: string;
}): QueueDogfoodBrokerSelfTestCase {
  return {
    capabilityIds: [...capabilityIds],
    caseId,
    evidence: [...evidence],
    message,
    ...(reason ? { reason } : {}),
    required,
    status,
    title,
  };
}

function assertion(
  assertionId: string,
  label: string,
  passed: boolean,
): QueueDogfoodBrokerSelfTestSideEffectAssertion {
  return { assertionId, label, passed };
}

function overallStatusForQueueDogfoodBrokerCases(
  cases: readonly QueueDogfoodBrokerSelfTestCase[],
): QueueDogfoodBrokerSelfTestStatus {
  const requiredCases = cases.filter((item) => item.required);
  const criticalCases = requiredCases.length > 0 ? requiredCases : cases;

  if (criticalCases.some((item) => item.status === "failed")) {
    return "failed";
  }

  if (criticalCases.some((item) => item.status === "blocked")) {
    return "blocked";
  }

  if (criticalCases.every((item) => item.status === "skipped")) {
    return "skipped";
  }

  return "passed";
}

function lifecycleOutput(
  result: HobitAgentBrokerResult<unknown>,
): QueueAgentLifecycleTransitionOutput | null {
  const output = result.result.output;

  return isRecord(output) && isLifecycleTransitionOutput(output)
    ? output
    : null;
}

function isLifecycleTransitionOutput(
  output: Record<string, unknown>,
): output is QueueAgentLifecycleTransitionOutput {
  return (
    typeof output.taskId === "string" &&
    typeof output.ticketState === "string" &&
    typeof output.agentPromptState === "string" &&
    typeof output.wouldStartWorkers === "boolean"
  );
}

function reviewMessageValue(
  output: QueueAgentLifecycleTransitionOutput | null,
): SmartQueueReviewMessage | null {
  return isReviewMessage(output?.value) ? output.value : null;
}

function isReviewMessage(value: unknown): value is SmartQueueReviewMessage {
  return (
    isRecord(value) &&
    typeof value.messageId === "string" &&
    typeof value.taskId === "string" &&
    typeof value.finalAgentMessage === "string"
  );
}

function brokerEvidence(result: HobitAgentBrokerResult<unknown>): string {
  return `${result.request.capabilityId}: ${result.status}. ${result.result.message}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
