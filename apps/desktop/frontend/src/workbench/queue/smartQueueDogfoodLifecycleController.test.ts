import { describe, expect, it } from "vitest";

import type { AgentQueueTask } from "../../workspace/types";
import type { AgentWorkerSummary } from "../agentQueueTaskUiModel";
import { selectQueueV2ViewModel } from "./queueV2ViewModel";
import controllerSource from "./smartQueueDogfoodLifecycleController.ts?raw";
import type { SmartQueueDogfoodLifecycleItem } from "./smartQueueDogfoodLifecycle";
import {
  applyAgentFinishedToQueueLifecycle,
  applyCoordinatorAckToQueueLifecycle,
  applyCoordinatorDoneDecisionToQueueLifecycle,
  applyCoordinatorFollowUpDecisionToQueueLifecycle,
  applyDogfoodLifecycleTransition,
  canQueueTaskStartByDogfoodLifecycleGate,
  createDogfoodLifecycleOverlayForQueueTask,
  createLifecycleForQueueTask,
  deriveLifecycleFromQueueTask,
  getQueueTaskDogfoodDependencyGate,
  getQueueTaskDogfoodLifecyclePresentation,
  runFakeQueueDogfoodLifecycleControllerSelfTest,
} from "./smartQueueDogfoodLifecycleController";

describe("smartQueueDogfoodLifecycleController", () => {
  it("derives a dogfood lifecycle overlay without renaming legacy Queue status", () => {
    const queueTask = task({
      queueItemId: "task-running",
      status: "running",
      title: "Running task",
    });
    const overlay = createDogfoodLifecycleOverlayForQueueTask(queueTask);

    expect(queueTask.status).toBe("running");
    expect(overlay).toMatchObject({
      lifecycle: {
        agentPromptState: "running",
        taskId: "task-running",
        ticketState: "running",
      },
      presentation: {
        agentPromptState: "running",
        ticketState: "running",
      },
      taskId: "task-running",
    });
    expect(deriveLifecycleFromQueueTask(queueTask).ticketState).toBe("running");
  });

  it("keeps ticket state and agent prompt state separate after agent completion", () => {
    const awaitingReview = awaitingReviewLifecycle(
      task({ queueItemId: "task-awaiting" }),
    );
    const presentation = getQueueTaskDogfoodLifecyclePresentation(awaitingReview);

    expect(awaitingReview).toMatchObject({
      agentPromptState: "completed",
      reviewOutcome: "completed",
      ticketState: "awaiting_review",
    });
    expect(awaitingReview.ticketState).not.toBe("done");
    expect(presentation).toMatchObject({
      awaitingReview: true,
      doneGatedForDependents: false,
      humanStatus: {
        detail: "Waiting for coordinator review",
        label: "Awaiting review",
        status: "review",
      },
      inReview: false,
    });
  });

  it("moves awaiting review to in review through the controller ACK helper", () => {
    const awaitingReview = awaitingReviewLifecycle(task({ queueItemId: "task-ack" }));
    const withReviewMessage = must(
      applyDogfoodLifecycleTransition(awaitingReview, {
        createdAt: "2026-06-16T00:11:00.000Z",
        messageId: "review-message-1",
        toCoordinatorAgentId: "coordinator-1",
        type: "create_review_message",
      }),
    );
    const inReview = must(
      applyCoordinatorAckToQueueLifecycle(withReviewMessage, {
        ackId: "ack-1",
        coordinatorAgentId: "coordinator-1",
        messageId: "review-message-1",
        receivedAt: "2026-06-16T00:12:00.000Z",
      }),
    );
    const presentation = getQueueTaskDogfoodLifecyclePresentation(inReview);

    expect(withReviewMessage.ticketState).toBe("awaiting_review");
    expect(inReview).toMatchObject({
      reviewAcks: [
        {
          ackId: "ack-1",
          coordinatorAgentId: "coordinator-1",
        },
      ],
      ticketState: "in_review",
    });
    expect(presentation).toMatchObject({
      awaitingReview: false,
      humanStatus: {
        detail: "Review acknowledged",
        label: "In review",
      },
      inReview: true,
    });
  });

  it("returns an in-review item to running for an additional follow-up prompt", () => {
    const inReview = inReviewLifecycle(task({ queueItemId: "task-follow-up" }));
    const followUp = must(
      applyCoordinatorFollowUpDecisionToQueueLifecycle(inReview, {
        createdAt: "2026-06-16T00:13:00.000Z",
        createdByCoordinatorAgentId: "coordinator-1",
        followUpPromptId: "follow-up-1",
        prompt: "Continue with a narrower follow-up.",
      }),
    );
    const presentation = getQueueTaskDogfoodLifecyclePresentation(followUp);

    expect(followUp).toMatchObject({
      additionalPromptCount: 1,
      agentPromptState: "additional_prompt_running",
      currentRunnablePrompt: "Continue with a narrower follow-up.",
      ticketState: "running",
    });
    expect(presentation).toMatchObject({
      additionalPromptCount: 1,
      followUpPromptRunning: true,
      humanStatus: {
        label: "Follow-up prompt running",
        status: "running",
      },
      secondaryLabels: ["Additional prompts: 1"],
    });
  });

  it("gates dependents until upstream dogfood lifecycle is done", () => {
    const root = task({ queueItemId: "root", status: "ready", title: "Root" });
    const dependent = task({
      dependsOn: ["root"],
      queueItemId: "dependent",
      status: "ready",
      title: "Dependent",
    });
    const awaitingReview = awaitingReviewLifecycle(root);
    const inReview = inReviewLifecycle(root);
    const done = doneLifecycle(root);

    expect(
      getQueueTaskDogfoodDependencyGate({
        lifecycles: [awaitingReview],
        task: dependent,
        tasks: [root, dependent],
      }),
    ).toMatchObject({
      canStart: false,
      gate: { gate: "waiting", waitingTaskIds: ["root"] },
    });
    expect(
      getQueueTaskDogfoodDependencyGate({
        lifecycles: [inReview],
        task: dependent,
        tasks: [root, dependent],
      }),
    ).toMatchObject({
      canStart: false,
      gate: { gate: "waiting", waitingTaskIds: ["root"] },
    });
    expect(
      getQueueTaskDogfoodDependencyGate({
        lifecycles: [done],
        task: dependent,
        tasks: [root, dependent],
      }),
    ).toMatchObject({
      canStart: true,
      gate: { gate: "satisfied", satisfiedTaskIds: ["root"] },
    });
    expect(
      canQueueTaskStartByDogfoodLifecycleGate({
        lifecycles: [done],
        task: dependent,
        tasks: [root, dependent],
      }),
    ).toBe(true);
  });

  it("feeds QueueV2 presentation and dependency gates from explicit dogfood overlays", () => {
    const root = task({ queueItemId: "root", status: "ready", title: "Root" });
    const dependent = task({
      dependsOn: ["root"],
      queueItemId: "dependent",
      status: "ready",
      title: "Dependent",
    });
    const awaitingReview = awaitingReviewLifecycle(root);
    const inReview = inReviewLifecycle(root);
    const followUp = followUpLifecycle(root);
    const done = doneLifecycle(root);

    expect(queueV2ItemFor(root, [root, dependent], [awaitingReview])).toMatchObject({
      boardLane: "review",
      dogfoodLifecycle: {
        awaitingReview: true,
        humanStatus: { label: "Awaiting review" },
      },
      humanStatus: { label: "Awaiting review", status: "review" },
      lifecycle: "review_required",
    });
    expect(queueV2ItemFor(root, [root, dependent], [inReview])).toMatchObject({
      boardLane: "review",
      dogfoodLifecycle: {
        inReview: true,
        humanStatus: { label: "In review" },
      },
      humanStatus: { label: "In review", status: "review" },
      lifecycle: "review_required",
    });
    expect(queueV2ItemFor(root, [root, dependent], [followUp])).toMatchObject({
      boardLane: "running",
      dogfoodLifecycle: {
        additionalPromptCount: 1,
        followUpPromptRunning: true,
      },
      humanStatus: { label: "Follow-up prompt running", status: "running" },
      lifecycle: "running",
    });

    const waitingDependent = queueV2ItemFor(
      dependent,
      [root, dependent],
      [awaitingReview],
    );
    const doneRoot = queueV2ItemFor(root, [root, dependent], [done]);
    const readyDependent = queueV2ItemFor(dependent, [root, dependent], [done]);

    expect(waitingDependent).toMatchObject({
      boardLane: "waiting_dependency",
      dependencySummary: { gate: "waiting" },
      eligibility: { dependencyOk: false, eligibleNow: false },
      nextAction: "resolve_dependency",
    });
    expect(doneRoot).toMatchObject({
      boardLane: "closed",
      humanStatus: { label: "Done", status: "closed" },
      lifecycle: "finalized",
    });
    expect(readyDependent).toMatchObject({
      boardLane: "ready",
      dependencySummary: { gate: "satisfied" },
      eligibility: { dependencyOk: true, eligibleNow: true },
      nextAction: "run_now",
    });
  });

  it("uses product-facing lifecycle labels instead of raw enum names", () => {
    const presentations = [
      getQueueTaskDogfoodLifecyclePresentation(
        awaitingReviewLifecycle(task({ queueItemId: "awaiting" })),
      ),
      getQueueTaskDogfoodLifecyclePresentation(
        inReviewLifecycle(task({ queueItemId: "in-review" })),
      ),
      getQueueTaskDogfoodLifecyclePresentation(
        doneLifecycle(task({ queueItemId: "done" })),
      ),
      getQueueTaskDogfoodLifecyclePresentation(
        followUpLifecycle(task({ queueItemId: "follow-up" })),
      ),
    ];

    expect(presentations.map((item) => item.humanStatus.label)).toEqual([
      "Awaiting review",
      "In review",
      "Done",
      "Follow-up prompt running",
    ]);
    for (const presentation of presentations) {
      expect(presentation.text).not.toMatch(/_/);
      expect(presentation.humanStatus.label).not.toMatch(/_/);
    }
  });

  it("runs the fake controller self-test without runtime side effects", () => {
    const report = runFakeQueueDogfoodLifecycleControllerSelfTest();

    expect(report).toMatchObject({
      additionalPromptCount: 1,
      dependentAfterDoneStartable: true,
      dependentBeforeDoneStartable: false,
      followUpReturnedToRunning: true,
      status: "passed",
    });
    expect(report.sideEffects).toEqual({
      wouldCallCodex: false,
      wouldCallShell: false,
      wouldCallWorkspaceApi: false,
      wouldExecuteCommit: false,
      wouldExecuteRollback: false,
      wouldLaunchTerminal: false,
      wouldMutateGit: false,
      wouldPersist: false,
      wouldStartWorker: false,
    });
  });

  it("does not add runtime execution or natural-language routing to the controller", () => {
    expect(controllerSource).not.toContain("createWorkspaceGitCommit");
    expect(controllerSource).not.toContain("startAssignedAgentQueueTask");
    expect(controllerSource).not.toContain("onStartAssignedAgentQueueTask");
    expect(controllerSource).not.toContain("launchTerminal");
    expect(controllerSource).not.toContain("executeRollback");
    expect(controllerSource).not.toContain("new RegExp");
    expect(controllerSource).not.toContain(".match(");
    expect(controllerSource).not.toContain("classifyUserIntent");
  });
});

function runningLifecycle(queueTask: AgentQueueTask) {
  const queued = must(
    applyDogfoodLifecycleTransition(createLifecycleForQueueTask(queueTask), {
      queuedAt: "2026-06-16T00:01:00.000Z",
      type: "queue",
    }),
  );

  return must(
    applyDogfoodLifecycleTransition(queued, {
      attemptId: `${queueTask.queueItemId}-attempt-1`,
      startedAt: "2026-06-16T00:02:00.000Z",
      threadId: `${queueTask.queueItemId}-thread-1`,
      type: "start_run",
    }),
  );
}

function awaitingReviewLifecycle(queueTask: AgentQueueTask) {
  return must(
    applyAgentFinishedToQueueLifecycle(runningLifecycle(queueTask), {
      changedFilesSummary: "Changed files: 1",
      finalAgentMessage: "Agent completed.",
      finishedAt: "2026-06-16T00:10:00.000Z",
      outcome: "completed",
      validationSummary: "Validation passed.",
    }),
  );
}

function inReviewLifecycle(queueTask: AgentQueueTask) {
  const withReviewMessage = must(
    applyDogfoodLifecycleTransition(awaitingReviewLifecycle(queueTask), {
      createdAt: "2026-06-16T00:11:00.000Z",
      messageId: `${queueTask.queueItemId}-review-message-1`,
      toCoordinatorAgentId: "coordinator-1",
      type: "create_review_message",
    }),
  );

  return must(
    applyCoordinatorAckToQueueLifecycle(withReviewMessage, {
      ackId: `${queueTask.queueItemId}-ack-1`,
      coordinatorAgentId: "coordinator-1",
      messageId: `${queueTask.queueItemId}-review-message-1`,
      receivedAt: "2026-06-16T00:12:00.000Z",
    }),
  );
}

function followUpLifecycle(queueTask: AgentQueueTask) {
  return must(
    applyCoordinatorFollowUpDecisionToQueueLifecycle(inReviewLifecycle(queueTask), {
      createdAt: "2026-06-16T00:13:00.000Z",
      createdByCoordinatorAgentId: "coordinator-1",
      followUpPromptId: `${queueTask.queueItemId}-follow-up-1`,
      prompt: "Continue with a narrower follow-up.",
    }),
  );
}

function doneLifecycle(queueTask: AgentQueueTask) {
  return must(
    applyCoordinatorDoneDecisionToQueueLifecycle(inReviewLifecycle(queueTask), {
      commitAttachedAt: "2026-06-16T00:15:00.000Z",
      commitHash: "fake123",
      commitRequestCreatedAt: "2026-06-16T00:14:00.000Z",
      commitRequestId: `${queueTask.queueItemId}-commit-request-1`,
      commitRequestReason: "Attach fake commit result.",
      commitResultId: `${queueTask.queueItemId}-commit-result-1`,
      commitResultSummary: "Fake commit result attached.",
      completedAt: "2026-06-16T00:16:00.000Z",
      coordinatorAgentId: "coordinator-1",
      decisionId: `${queueTask.queueItemId}-done-1`,
      reason: "Accepted.",
      validationApprovedAt: "2026-06-16T00:13:00.000Z",
      validationApprovalId: `${queueTask.queueItemId}-validation-1`,
      validationSummary: "Validation approved.",
    }),
  );
}

function queueV2ItemFor(
  queueTask: AgentQueueTask,
  tasks: readonly AgentQueueTask[],
  lifecycles: readonly SmartQueueDogfoodLifecycleItem[],
) {
  const viewModel = selectQueueV2ViewModel({
    dogfoodLifecycles: lifecycles,
    tasks,
    workers: [worker()],
  });

  return viewModel.tasks.find((item) => item.taskId === queueTask.queueItemId);
}

function task(overrides: Partial<AgentQueueTask> = {}): AgentQueueTask {
  return {
    approvalPolicy: "never",
    assignedExecutorWidgetId: null,
    assignedWorkerId: null,
    closureState: undefined,
    codexExecutable: "codex",
    context: undefined,
    coordinatorStatus: "not_reported",
    createdAt: "2026-06-16T00:00:00.000Z",
    dependsOn: [],
    description: "Description",
    executionPolicy: "manual",
    executionWorkspace: "C:/work",
    itemType: "implementation",
    orderIndex: 0,
    priority: 1,
    prompt: "Do the work.",
    queueItemId: "task",
    queueTagId: "default",
    queueTagName: "Default",
    sandbox: "danger_full_access",
    status: "queued",
    title: "Task",
    updatedAt: "2026-06-16T00:00:00.000Z",
    validationStatus: "not_started",
    workerExecutionReports: [],
    workspaceId: "workspace",
    ...overrides,
  };
}

function worker(overrides: Partial<AgentWorkerSummary> = {}): AgentWorkerSummary {
  return {
    currentItemId: null,
    displayOrder: 0,
    enabled: true,
    lastReportSummary: null,
    name: "Worker",
    scope: { kind: "all" },
    status: "idle",
    workerId: "worker",
    ...overrides,
  };
}

function must<TItem extends SmartQueueDogfoodLifecycleItem>(
  result:
    | {
        readonly item: TItem;
        readonly ok: true;
      }
    | {
        readonly error?: { readonly message: string };
        readonly ok: false;
      },
) {
  if (!result.ok) {
    throw new Error(result.error?.message ?? "Expected lifecycle transition success.");
  }

  return result.item;
}
