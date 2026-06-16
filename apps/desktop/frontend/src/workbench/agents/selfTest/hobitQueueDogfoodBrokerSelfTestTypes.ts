import type { AgentQueueTask } from "../../../workspace/types";
import type { SmartQueueDogfoodLifecycleItem } from "../../queue/smartQueueDogfoodLifecycle";
import type { QueueWorkerEvidenceBundle } from "../../queue/smartQueueWorkerEvidenceBundle";
import type { HobitAgentBrokerResult } from "../broker";

export const QUEUE_DOGFOOD_BROKER_SELF_TEST_REQUIRED_CAPABILITY_IDS = [
  "queue.lifecycle.agentFinished",
  "queue.review.createMessage",
  "queue.review.ack",
  "queue.coordinator.approveValidation",
  "queue.item.markDone",
  "queue.coordinator.addFollowUpPrompt",
] as const;

export type QueueDogfoodBrokerSelfTestStatus =
  | "passed"
  | "failed"
  | "skipped"
  | "blocked";

export type QueueDogfoodBrokerSelfTestCase = {
  readonly capabilityIds: readonly string[];
  readonly caseId: string;
  readonly evidence: readonly string[];
  readonly message: string;
  readonly reason?: string;
  readonly required: boolean;
  readonly status: QueueDogfoodBrokerSelfTestStatus;
  readonly title: string;
};

export type QueueDogfoodBrokerSelfTestSideEffectAssertion = {
  readonly assertionId: string;
  readonly label: string;
  readonly passed: boolean;
};

export type QueueDogfoodBrokerSelfTestReport = {
  readonly cases: readonly QueueDogfoodBrokerSelfTestCase[];
  readonly coverageBoundary: string;
  readonly createdAt: string;
  readonly exercisedCapabilityIds: readonly string[];
  readonly productSummary: string;
  readonly reportId: string;
  readonly sideEffectAssertions: readonly QueueDogfoodBrokerSelfTestSideEffectAssertion[];
  readonly status: QueueDogfoodBrokerSelfTestStatus;
  readonly summary: {
    readonly blocked: number;
    readonly failed: number;
    readonly passed: number;
    readonly skipped: number;
    readonly total: number;
  };
};

export type QueueDogfoodBrokerSelfTestFakeStore = {
  readonly brokerResults: HobitAgentBrokerResult[];
  readonly changedFilesSummary: string;
  readonly coordinatorAgentId: string;
  readonly dependentTaskId: string;
  readonly exercisedCapabilityIds: string[];
  readonly evidenceBundle: QueueWorkerEvidenceBundle;
  readonly fakeAttemptId: string;
  readonly fakeThreadId: string;
  readonly fakeCommit: {
    readonly commitHash: string;
    readonly commitResultId: string;
    readonly commitTitle: string;
  };
  readonly failureDependentTaskId: string;
  readonly failureTaskId: string;
  readonly finalAgentMessage: string;
  readonly followUpPrompt: string;
  readonly followUpTaskId: string;
  readonly logReference: string;
  readonly queueId: "workspace-queue";
  readonly reviewMessageId: string;
  readonly taskId: string;
  readonly tasks: readonly AgentQueueTask[];
  readonly validationSummary: string;
  readonly validationOutputPreview: string;
  canDependentStart(dependentTaskId: string): boolean;
  invoke<TOutput = unknown>(
    capabilityId: string,
    input: unknown,
    options?: {
      readonly dryRun?: boolean;
      readonly requestId?: string;
    },
  ): HobitAgentBrokerResult<TOutput>;
  readEvidenceBundle(taskId: string): unknown | null;
  readLifecycle(taskId: string): SmartQueueDogfoodLifecycleItem | null;
};

export type BrokerSelfTestFixture = {
  readonly changedFilesSummary: string;
  readonly coordinatorAgentId: string;
  readonly createdAt: string;
  readonly dependentTaskId: string;
  readonly fakeAttemptId: string;
  readonly fakeThreadId: string;
  readonly fakeCommit: QueueDogfoodBrokerSelfTestFakeStore["fakeCommit"];
  readonly failureDependentTaskId: string;
  readonly failureTaskId: string;
  readonly finalAgentMessage: string;
  readonly followUpPrompt: string;
  readonly followUpTaskId: string;
  readonly logReference: string;
  readonly reviewMessageId: string;
  readonly taskId: string;
  readonly validationSummary: string;
  readonly validationOutputPreview: string;
};

export const QUEUE_DOGFOOD_BROKER_COVERAGE_BOUNDARY =
  "Fake frontend model/controller/broker-level Queue dogfood lifecycle self-test. Backend durability, real worker execution, real validation execution, and real Git commit execution are not covered.";

export const DEFAULT_QUEUE_DOGFOOD_BROKER_FIXTURE: BrokerSelfTestFixture = {
  changedFilesSummary:
    "Changed files: apps/desktop/frontend/src/workbench/agents/selfTest/hobitQueueDogfoodBrokerSelfTest.ts",
  coordinatorAgentId: "queue-coordinator:self-test",
  createdAt: "2026-06-16T12:00:00.000Z",
  dependentTaskId: "queue-dogfood-dependent",
  fakeAttemptId: "attempt-upstream-1",
  fakeThreadId: "thread-upstream-1",
  fakeCommit: {
    commitHash: "fake-broker-loop-hash",
    commitResultId: "fake-commit-result-upstream",
    commitTitle: "frontend: fake queue dogfood broker loop",
  },
  failureDependentTaskId: "queue-dogfood-failure-dependent",
  failureTaskId: "queue-dogfood-failure",
  finalAgentMessage:
    "Implemented the fake Queue dogfood task and produced review evidence.",
  followUpPrompt:
    "Continue the same Queue item with one narrower follow-up prompt.",
  followUpTaskId: "queue-dogfood-follow-up",
  logReference: "frontend://queue-dogfood-broker-self-test/logs/upstream",
  reviewMessageId: "review-message-upstream-1",
  taskId: "queue-dogfood-upstream",
  validationOutputPreview: "Fake validation output preview: typecheck passed.",
  validationSummary: "Fake validation summary: typecheck passed.",
};
