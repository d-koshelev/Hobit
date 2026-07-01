import type { AgentQueueTask } from "../../../workspace/types";
import {
  canQueueTaskStartByDogfoodLifecycleGate,
} from "../../queue/smartQueueDogfoodLifecycleController";
import {
  createQueueWorkerEvidenceBundle,
} from "../../queue/smartQueueWorkerEvidenceBundle";
import type { SmartQueueDogfoodLifecycleItem } from "../../queue/smartQueueDogfoodLifecycle";
import {
  createDefaultQueueAgentAdapterApi,
  createInMemoryQueueDogfoodLifecycleAdapterApi,
  createQueueAgentActionHandlers,
  type QueueAgentAdapterApi,
  type QueueAgentLifecycleGetOutput,
  type QueueAgentLifecycleTaskSeed,
  type QueueAgentReviewEvidenceBundleOutput,
} from "../adapters";
import {
  createActionRequest,
  createHobitAgentActionBroker,
  type HobitAgentBrokerResult,
} from "../broker";
import { createHobitAgentCapabilityRegistry } from "../capabilities";
import {
  DEFAULT_QUEUE_DOGFOOD_BROKER_FIXTURE,
  type BrokerSelfTestFixture,
  type QueueDogfoodBrokerSelfTestFakeStore,
} from "./hobitQueueDogfoodBrokerSelfTestTypes";

export function createQueueDogfoodBrokerSelfTestFakeStore(
  fixture: Partial<BrokerSelfTestFixture> = {},
): QueueDogfoodBrokerSelfTestFakeStore {
  const resolved = {
    ...DEFAULT_QUEUE_DOGFOOD_BROKER_FIXTURE,
    ...fixture,
    fakeCommit: {
      ...DEFAULT_QUEUE_DOGFOOD_BROKER_FIXTURE.fakeCommit,
      ...fixture.fakeCommit,
    },
  };
  const tasks = fakeQueueTasks(resolved);
  const evidenceBundle = createQueueWorkerEvidenceBundle({
    attemptId: resolved.fakeAttemptId,
    changedFiles: [
      {
        path: "apps/desktop/frontend/src/workbench/agents/selfTest/hobitQueueDogfoodBrokerSelfTest.ts",
      },
      {
        path: "apps/desktop/frontend/src/workbench/queue/smartQueueWorkerEvidenceBundle.ts",
      },
    ],
    changedFilesSummary: resolved.changedFilesSummary,
    completedAt: resolved.createdAt,
    finalAgentMessage: resolved.finalAgentMessage,
    logReference: resolved.logReference,
    outcome: "completed",
    providerId: "fake-broker-provider",
    rawProviderSummary: "Fake provider summary for Queue dogfood evidence.",
    runId: "fake-run-upstream-1",
    startedAt: "2026-06-16T11:30:00.000Z",
    taskId: resolved.taskId,
    threadId: resolved.fakeThreadId,
    validationOutputPreview: resolved.validationOutputPreview,
    validationStatus: "passed",
    validationSummary: resolved.validationSummary,
    workerId: "fake-worker:self-test",
  });
  const brokerResults: HobitAgentBrokerResult[] = [];
  const exercisedCapabilityIds: string[] = [];
  let requestSequence = 0;

  const adapterApi: QueueAgentAdapterApi = {
    ...createDefaultQueueAgentAdapterApi(),
    dogfoodLifecycle: createInMemoryQueueDogfoodLifecycleAdapterApi({
      initialTaskSeeds: lifecycleSeedsForFixture(resolved),
      now: () => resolved.createdAt,
    }),
  };
  const broker = createHobitAgentActionBroker({
    handlers: createQueueAgentActionHandlers(adapterApi),
    policy: { requireDryRunBeforeSideEffectingInvoke: false },
    registry: createHobitAgentCapabilityRegistry(),
  });

  const store: QueueDogfoodBrokerSelfTestFakeStore = {
    brokerResults,
    changedFilesSummary: resolved.changedFilesSummary,
    coordinatorAgentId: resolved.coordinatorAgentId,
    dependentTaskId: resolved.dependentTaskId,
    evidenceBundle,
    exercisedCapabilityIds,
    fakeAttemptId: resolved.fakeAttemptId,
    fakeThreadId: resolved.fakeThreadId,
    fakeCommit: resolved.fakeCommit,
    failureDependentTaskId: resolved.failureDependentTaskId,
    failureTaskId: resolved.failureTaskId,
    finalAgentMessage: resolved.finalAgentMessage,
    followUpPrompt: resolved.followUpPrompt,
    followUpTaskId: resolved.followUpTaskId,
    logReference: resolved.logReference,
    queueId: "workspace-queue",
    reviewMessageId: resolved.reviewMessageId,
    taskId: resolved.taskId,
    tasks,
    validationOutputPreview: resolved.validationOutputPreview,
    validationSummary: resolved.validationSummary,
    canDependentStart: (dependentTaskId) => {
      const dependentTask = tasks.find(
        (candidate) => candidate.queueItemId === dependentTaskId,
      );
      if (!dependentTask) {
        return false;
      }

      const upstreamLifecycles = (dependentTask.dependsOn ?? [])
        .map((taskId) => store.readLifecycle(taskId))
        .filter(
          (item): item is SmartQueueDogfoodLifecycleItem => Boolean(item),
        );

      return canQueueTaskStartByDogfoodLifecycleGate({
        lifecycles: upstreamLifecycles,
        task: dependentTask,
        tasks,
      });
    },
    invoke: <TOutput = unknown>(
      capabilityId: string,
      input: unknown,
      options: {
        readonly confirmationToken?: string;
        readonly dryRun?: boolean;
        readonly requestId?: string;
      } = {},
    ) => {
      requestSequence += 1;
      const result = broker.invoke<TOutput>(
        createActionRequest({
          agentId: "queue-dogfood-broker:self-test",
          agentRoleId: "test_harness",
          capabilityId,
          confirmationToken: options.confirmationToken ?? null,
          createdAt: resolved.createdAt,
          dryRun: options.dryRun ?? false,
          input,
          reason: "queue-dogfood-broker-self-test",
          requestId:
            options.requestId ??
            `queue-dogfood-broker:${requestSequence.toString()}:${capabilityId}`,
        }),
      );

      exercisedCapabilityIds.push(capabilityId);
      brokerResults.push(result);

      return result;
    },
    readEvidenceBundle: (taskId) => {
      const result = store.invoke<QueueAgentReviewEvidenceBundleOutput>(
        "queue.review.getEvidenceBundle",
        { taskId },
        { dryRun: true },
      );

      return result.status === "succeeded" && result.result.output
        ? result.result.output
        : null;
    },
    readLifecycle: (taskId) => {
      const result = store.invoke<QueueAgentLifecycleGetOutput>(
        "queue.lifecycle.get",
        { taskId },
        { dryRun: true },
      );
      const output = result.result.output as QueueAgentLifecycleGetOutput | undefined;

      return result.status === "succeeded" ? output?.lifecycle ?? null : null;
    },
  };

  return store;
}

function fakeQueueTasks(
  fixture: BrokerSelfTestFixture,
): readonly AgentQueueTask[] {
  return [
    fakeQueueTask({
      prompt: "Implement fake upstream Queue dogfood task.",
      queueItemId: fixture.taskId,
      status: "running",
      title: "Fake upstream dogfood task",
    }),
    fakeQueueTask({
      dependsOn: [fixture.taskId],
      prompt: "Run after fake upstream is done.",
      queueItemId: fixture.dependentTaskId,
      status: "queued",
      title: "Fake dependent dogfood task",
    }),
    fakeQueueTask({
      prompt: "Implement fake follow-up branch.",
      queueItemId: fixture.followUpTaskId,
      status: "running",
      title: "Fake follow-up dogfood task",
    }),
    fakeQueueTask({
      prompt: "Implement fake failure branch.",
      queueItemId: fixture.failureTaskId,
      status: "running",
      title: "Fake failure dogfood task",
    }),
    fakeQueueTask({
      dependsOn: [fixture.failureTaskId],
      prompt: "Remain blocked after fake upstream failure.",
      queueItemId: fixture.failureDependentTaskId,
      status: "queued",
      title: "Fake failure dependent task",
    }),
  ];
}

function fakeQueueTask(overrides: Partial<AgentQueueTask>): AgentQueueTask {
  return {
    assignedExecutorWidgetId: null,
    createdAt: "2026-06-16T11:00:00.000Z",
    dependsOn: [],
    description: "",
    executionPolicy: "manual",
    priority: 0,
    prompt: "Run fake Queue task.",
    queueItemId: "queue-dogfood-task",
    status: "queued",
    title: "Fake Queue task",
    updatedAt: "2026-06-16T11:00:00.000Z",
    workspaceId: "workspace-dogfood-self-test",
    ...overrides,
  };
}

function lifecycleSeedsForFixture(
  fixture: BrokerSelfTestFixture,
): readonly QueueAgentLifecycleTaskSeed[] {
  return fakeQueueTasks(fixture).map((task) => ({
    createdAt: task.createdAt,
    prompt: task.prompt,
    status: task.status,
    taskId: task.queueItemId,
    title: task.title,
    updatedAt: task.updatedAt,
  }));
}
