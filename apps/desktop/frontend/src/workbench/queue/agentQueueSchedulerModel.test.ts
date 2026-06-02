import type { AgentQueueTask } from "../../workspace/types";
import type { AgentWorkerSummary } from "../agentQueueTaskUiModel";
import {
  buildAgentQueueEmbeddedExecutorSection,
  buildAgentQueueSchedulerPlan,
  schedulerBlockedReasonLabel,
} from "./agentQueueSchedulerModel";

describe("agent queue scheduler model", () => {
  it("recommends the next item for an enabled all-queues worker when queue scheduling is enabled", () => {
    const plan = buildPlan({
      globalExecutionState: "started",
      tasks: [queueTask({ prompt: "Run this", status: "ready" })],
    });

    expect(plan.globalState.code).toBe("started");
    expect(plan.workerPlans[0]?.bestNextItem?.queueItemId).toBe("queue-1");
    expect(plan.recommendations).toHaveLength(1);
    expect(plan.schedulableItemCount).toBe(1);
  });

  it("keeps disabled workers from receiving recommendations", () => {
    const plan = buildPlan({
      globalExecutionState: "started",
      tasks: [queueTask({ prompt: "Run this", status: "ready" })],
      workers: [agentWorker({ enabled: false })],
    });

    expect(plan.workerPlans[0]?.bestNextItem).toBeNull();
    expect(plan.workerPlans[0]?.idleReason).toBe("Worker is disabled");
    expect(plan.blockedItems[0]?.reasonCodes.includes("worker_disabled")).toBe(
      true,
    );
  });

  it("limits scoped workers to matching queue tag items", () => {
    const plan = buildPlan({
      globalExecutionState: "started",
      tasks: [
        queueTask({
          prompt: "Review",
          queueItemId: "review",
          queueTagId: "review",
          queueTagName: "Review",
          status: "ready",
        }),
        queueTask({
          prompt: "Implementation",
          queueItemId: "impl",
          queueTagId: "impl",
          queueTagName: "Implementation",
          status: "ready",
        }),
      ],
      workers: [
        agentWorker({
          scope: { kind: "queue_tag", queueTagId: "review", queueTagName: "Review" },
        }),
      ],
    });

    expect(plan.workerPlans[0]?.bestNextItem?.queueItemId).toBe("review");
    expect(plan.itemEligibility.find((item) => item.queueItemId === "impl")?.blockedReasons[0]?.code)
      .toBe("worker_scope_mismatch");
  });

  it("honors explicit worker assignment", () => {
    const plan = buildPlan({
      globalExecutionState: "started",
      tasks: [
        queueTask({
          assignedWorkerId: "worker-2",
          prompt: "Assigned",
          status: "ready",
        }),
      ],
      workers: [
        agentWorker({ workerId: "worker-1" }),
        agentWorker({ name: "Worker 2", workerId: "worker-2" }),
      ],
    });

    expect(plan.workerPlans[0]?.bestNextItem).toBeNull();
    expect(plan.workerPlans[1]?.bestNextItem?.queueItemId).toBe("queue-1");
    expect(plan.itemEligibility[0]?.eligibleWorkerIds).toEqual(["worker-2"]);
  });

  it("blocks paused tags, unsatisfied dependencies, invalid graphs, missing prompts, coordinator review, and validation", () => {
    const prerequisite = queueTask({
      coordinatorStatus: "not_reported",
      queueItemId: "prereq",
      status: "completed",
      title: "Prerequisite",
    });
    const dependencyBlocked = queueTask({
      dependsOn: ["prereq"],
      prompt: "Depends",
      queueItemId: "dependency-blocked",
      status: "ready",
    });
    const missingDependency = queueTask({
      dependsOn: ["missing"],
      prompt: "Missing dep",
      queueItemId: "invalid-dependency",
      status: "ready",
    });
    const missingPrompt = queueTask({
      prompt: "",
      queueItemId: "missing-prompt",
      status: "ready",
    });
    const coordinatorReview = queueTask({
      coordinatorStatus: "awaiting_coordinator_review",
      prompt: "Review me",
      queueItemId: "review",
      status: "ready",
    });
    const validating = queueTask({
      prompt: "Validate me",
      queueItemId: "validating",
      status: "ready",
      validationStatus: "validating",
    });
    const paused = queueTask({
      prompt: "Paused",
      queueItemId: "paused",
      queueTagId: "paused",
      queueTagName: "Paused",
      status: "ready",
    });
    const plan = buildPlan({
      globalExecutionState: "started",
      pausedQueueTagIds: new Set(["paused"]),
      tasks: [
        prerequisite,
        dependencyBlocked,
        missingDependency,
        missingPrompt,
        coordinatorReview,
        validating,
        paused,
      ],
    });

    expect(
      reasonCodes(plan, "dependency-blocked").includes(
        "waiting_for_dependencies",
      ),
    ).toBe(true);
    expect(
      reasonCodes(plan, "invalid-dependency").includes(
        "item_dependency_graph_invalid",
      ),
    ).toBe(true);
    expect(
      reasonCodes(plan, "missing-prompt").includes("item_missing_prompt"),
    ).toBe(true);
    expect(
      reasonCodes(plan, "review").includes("item_awaiting_coordinator_review"),
    ).toBe(true);
    expect(
      reasonCodes(plan, "validating").includes("item_validation_in_progress"),
    ).toBe(true);
    expect(reasonCodes(plan, "paused").includes("queue_tag_paused")).toBe(true);
  });

  it("shows dependent work eligible only after prerequisite is coordinator finalized", () => {
    const reportedPrerequisite = queueTask({
      coordinatorStatus: "awaiting_coordinator_review",
      queueItemId: "prereq",
      status: "completed",
      title: "Reported prerequisite",
      workerExecutionReports: [
        {
          changedFiles: [],
          commandsRun: [],
          createdAt: "2026-05-20T10:02:00.000Z",
          errors: [],
          itemId: "prereq",
          reportId: "report-1",
          reportStatus: "completed",
          summary: "Report only.",
          validationCommandsSuggested: [],
          warnings: [],
          workerId: "worker-1",
        },
      ],
    });
    const dependent = queueTask({
      dependsOn: ["prereq"],
      prompt: "Run dependent",
      queueItemId: "dependent",
      status: "ready",
    });
    const blocked = buildPlan({
      globalExecutionState: "started",
      tasks: [reportedPrerequisite, dependent],
    });
    const unblocked = buildPlan({
      globalExecutionState: "started",
      tasks: [
        { ...reportedPrerequisite, coordinatorStatus: "finalized" },
        dependent,
      ],
    });

    expect(
      reasonCodes(blocked, "dependent").includes("waiting_for_dependencies"),
    ).toBe(true);
    expect(
      unblocked.itemEligibility.find((item) => item.queueItemId === "dependent")
        ?.isSchedulable,
    ).toBe(true);
    expect(unblocked.recommendations[0]?.queueItemId).toBe("dependent");
  });

  it("does not recommend new work while disabled or STOP + KILL RUNNING is active", () => {
    const stopped = buildPlan({
      globalExecutionState: "stopped",
      tasks: [queueTask({ prompt: "Run this", status: "ready" })],
    });
    const killRequested = buildPlan({
      globalExecutionState: "stop_kill_requested",
      tasks: [queueTask({ prompt: "Run this", status: "ready" })],
    });

    expect(stopped.globalState.label).toBe("Disabled");
    expect(stopped.recommendations).toHaveLength(0);
    expect(
      stopped.blockedItems[0]?.reasonLabels.includes("Queue is disabled"),
    ).toBe(true);
    expect(killRequested.globalState.label).toBe("STOP + KILL RUNNING");
    expect(killRequested.recommendations).toHaveLength(0);
    expect(
      killRequested.blockedItems[0]?.reasonLabels.includes(
        "Stop + kill running requested",
      ),
    ).toBe(true);
    expect(killRequested.explanation.includes("no work is started")).toBe(true);
  });

  it("tracks running items affected by STOP + KILL RUNNING as review-only state", () => {
    const plan = buildPlan({
      globalExecutionState: "stop_kill_requested",
      tasks: [
        queueTask({
          prompt: "Already running",
          queueItemId: "running-task",
          status: "running",
        }),
      ],
    });

    expect(plan.globalState.affectedRunningItemIds).toEqual(["running-task"]);
    expect(plan.globalState.explanation.includes("coordinator review")).toBe(
      true,
    );
    expect(plan.recommendations).toHaveLength(0);
  });

  it("chooses priority and order only among eligible items", () => {
    const plan = buildPlan({
      globalExecutionState: "started",
      pausedQueueTagIds: new Set(["paused"]),
      tasks: [
        queueTask({
          priority: 5,
          prompt: "Blocked high",
          queueItemId: "blocked-high",
          queueTagId: "paused",
          queueTagName: "Paused",
          status: "ready",
        }),
        queueTask({
          orderIndex: 2,
          priority: 4,
          prompt: "Later",
          queueItemId: "later",
          status: "ready",
        }),
        queueTask({
          orderIndex: 1,
          priority: 4,
          prompt: "First",
          queueItemId: "first",
          status: "ready",
        }),
      ],
    });

    expect(plan.workerPlans[0]?.bestNextItem?.queueItemId).toBe("first");
  });

  it("provides stable blocked reason labels for UI explanations", () => {
    expect(schedulerBlockedReasonLabel("queue_stopped")).toBe("Queue is disabled");
    expect(schedulerBlockedReasonLabel("queue_stop_kill_requested")).toBe(
      "Stop + kill running requested",
    );
    expect(schedulerBlockedReasonLabel("queue_tag_paused")).toBe("Tag is paused");
    expect(schedulerBlockedReasonLabel("waiting_for_dependencies")).toBe(
      "Waiting for dependencies",
    );
    expect(schedulerBlockedReasonLabel("item_missing_prompt")).toBe(
      "Missing prompt",
    );
    expect(schedulerBlockedReasonLabel("worker_scope_mismatch")).toBe(
      "Worker scoped to another tag",
    );
  });

  it("recommends adding worker capacity only below max executors", () => {
    const tasks = [
      queueTask({
        prompt: "Run first",
        queueItemId: "queue-1",
        status: "ready",
      }),
      queueTask({
        prompt: "Run second",
        queueItemId: "queue-2",
        status: "ready",
      }),
    ];
    const workers = [agentWorker()];
    const plan = buildPlan({
      globalExecutionState: "started",
      tasks,
      workers,
    });
    const model = buildAgentQueueEmbeddedExecutorSection({
      maxExecutors: 2,
      schedulerPlan: plan,
      tasks,
      workers,
    });

    expect(model.spareExecutorSlots).toBe(1);
    expect(model.capacityRecommendation.code).toBe("can_add_worker");
    expect(model.capacityRecommendation.label).toBe("Can add 1 worker");

    const maxReached = buildAgentQueueEmbeddedExecutorSection({
      maxExecutors: 1,
      schedulerPlan: plan,
      tasks,
      workers,
    });

    expect(maxReached.capacityRecommendation.code).toBe("max_reached");
    expect(maxReached.capacityRecommendation.canAddWorker).toBe(false);
  });

  it("suppresses add-capacity recommendations while queue is stopped", () => {
    const tasks = [
      queueTask({ prompt: "Run first", queueItemId: "queue-1", status: "ready" }),
      queueTask({ prompt: "Run second", queueItemId: "queue-2", status: "ready" }),
    ];
    const workers = [agentWorker()];
    const plan = buildPlan({
      globalExecutionState: "stopped",
      tasks,
      workers,
    });
    const model = buildAgentQueueEmbeddedExecutorSection({
      maxExecutors: 3,
      schedulerPlan: plan,
      tasks,
      workers,
    });

    expect(model.capacityRecommendation.code).toBe("queue_stopped");
    expect(model.capacityRecommendation.canAddWorker).toBe(false);
  });

  it("reports tag or dependency blockers when no independent work is eligible", () => {
    const tasks = [
      queueTask({
        prompt: "Paused",
        queueItemId: "queue-1",
        queueTagId: "paused",
        queueTagName: "Paused",
        status: "ready",
      }),
    ];
    const workers = [agentWorker()];
    const plan = buildPlan({
      globalExecutionState: "started",
      pausedQueueTagIds: new Set(["paused"]),
      tasks,
      workers,
    });
    const model = buildAgentQueueEmbeddedExecutorSection({
      maxExecutors: 3,
      schedulerPlan: plan,
      tasks,
      workers,
    });

    expect(model.capacityRecommendation.code).toBe(
      "blocked_by_tags_or_dependencies",
    );
  });
});

function reasonCodes(
  plan: ReturnType<typeof buildAgentQueueSchedulerPlan>,
  queueItemId: string,
) {
  return (
    plan.itemEligibility.find((item) => item.queueItemId === queueItemId)
      ?.blockedReasons.map((reason) => reason.code) ?? []
  );
}

function buildPlan(
  overrides: Partial<Parameters<typeof buildAgentQueueSchedulerPlan>[0]> = {},
) {
  return buildAgentQueueSchedulerPlan({
    globalExecutionState: "started",
    pausedQueueTagIds: new Set(),
    tasks: [queueTask({ prompt: "Run this", status: "ready" })],
    workers: [agentWorker()],
    ...overrides,
  });
}

function queueTask(overrides: Partial<AgentQueueTask> = {}): AgentQueueTask {
  return {
    assignedExecutorWidgetId: null,
    createdAt: "2026-05-20T10:00:00.000Z",
    dependsOn: [],
    description: "",
    executionPolicy: "manual",
    priority: 0,
    prompt: "",
    queueItemId: "queue-1",
    status: "draft",
    title: "Queue task",
    updatedAt: "2026-05-20T10:00:00.000Z",
    workspaceId: "workspace-1",
    ...overrides,
  };
}

function agentWorker(overrides: Partial<AgentWorkerSummary> = {}): AgentWorkerSummary {
  return {
    currentItemId: null,
    displayOrder: 0,
    enabled: true,
    lastReportSummary: null,
    name: "Agent Worker",
    scope: { kind: "all" },
    status: "idle",
    workerId: "worker-1",
    ...overrides,
  };
}
