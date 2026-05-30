import type { AgentQueueTask } from "../../workspace/types";
import type { AgentWorkerSummary } from "../agentQueueTaskUiModel";
import {
  canWorkerTakeQueueItem,
  getAssignedWorkerRoutingState,
  getBestNextItemForWorker,
  getWorkerItemBlockedReasons,
  getWorkerRoutingSummary,
} from "./agentQueueRoutingModel";

describe("agent queue worker routing model", () => {
  it("allows an enabled all-queues worker to take an eligible item", () => {
    const worker = agentWorker();
    const item = queueTask({ prompt: "Run this", status: "ready" });

    expect(canWorkerTakeQueueItem(worker, item, { tasks: [item] })).toBe(true);
  });

  it("blocks disabled workers", () => {
    const worker = agentWorker({ enabled: false });
    const item = queueTask({ prompt: "Run this", status: "ready" });

    expect(reasonCodes(getWorkerItemBlockedReasons(worker, item, { tasks: [item] }))).toEqual([
      "worker_disabled",
    ]);
  });

  it("can report a stopped queue as a worker routing blocker", () => {
    const item = queueTask({ prompt: "Run this", status: "ready" });

    expect(
      reasonCodes(
        getWorkerItemBlockedReasons(agentWorker(), item, {
        globalStatus: "stopped",
        tasks: [item],
        }),
      ).includes("queue_stopped"),
    ).toBe(true);
  });

  it("allows scoped workers to take matching tag items", () => {
    const worker = agentWorker({
      scope: { kind: "queue_tag", queueTagId: "review", queueTagName: "Review" },
    });
    const item = queueTask({
      prompt: "Run this",
      queueTagId: "review",
      queueTagName: "Review",
      status: "queued",
    });

    expect(canWorkerTakeQueueItem(worker, item, { tasks: [item] })).toBe(true);
  });

  it("blocks scoped workers from different tag items", () => {
    const worker = agentWorker({
      scope: { kind: "queue_tag", queueTagId: "review", queueTagName: "Review" },
    });
    const item = queueTask({
      prompt: "Run this",
      queueTagId: "default",
      queueTagName: "Default",
      status: "queued",
    });

    expect(
      reasonCodes(getWorkerItemBlockedReasons(worker, item, { tasks: [item] }))
        .includes("worker_scope_mismatch"),
    ).toBe(true);
  });

  it("blocks paused queue tags", () => {
    const item = queueTask({
      prompt: "Run this",
      queueTagId: "review",
      queueTagName: "Review",
      status: "ready",
    });

    expect(
      reasonCodes(
        getWorkerItemBlockedReasons(agentWorker(), item, {
        pausedQueueTagIds: new Set(["review"]),
        tasks: [item],
        }),
      ).includes("queue_tag_paused"),
    ).toBe(true);
  });

  it("blocks unsatisfied dependencies and invalid dependency graphs", () => {
    const prerequisite = queueTask({
      queueItemId: "queue-1",
      status: "queued",
      title: "Prerequisite",
    });
    const dependent = queueTask({
      dependsOn: ["queue-1"],
      prompt: "Run dependent",
      queueItemId: "queue-2",
      status: "ready",
      title: "Dependent",
    });
    const cyclic = queueTask({
      dependsOn: ["queue-4"],
      prompt: "Run cycle",
      queueItemId: "queue-3",
      status: "ready",
    });
    const cyclicDependency = queueTask({
      dependsOn: ["queue-3"],
      queueItemId: "queue-4",
      status: "completed",
    });

    expect(
      reasonCodes(
        getWorkerItemBlockedReasons(agentWorker(), dependent, {
        tasks: [prerequisite, dependent],
        }),
      ).includes("waiting_for_dependencies"),
    ).toBe(true);
    expect(
      reasonCodes(
        getWorkerItemBlockedReasons(agentWorker(), cyclic, {
        tasks: [cyclic, cyclicDependency],
        }),
      ).includes("item_dependency_graph_invalid"),
    ).toBe(true);
  });

  it("restricts assigned items to the assigned worker", () => {
    const item = queueTask({
      assignedWorkerId: "worker-1",
      prompt: "Run this",
      status: "ready",
    });

    expect(canWorkerTakeQueueItem(agentWorker({ workerId: "worker-1" }), item, {
      tasks: [item],
    })).toBe(true);
    expect(
      reasonCodes(
        getWorkerItemBlockedReasons(agentWorker({ workerId: "worker-2" }), item, {
        tasks: [item],
        }),
      ).includes("assigned_to_another_worker"),
    ).toBe(true);
  });

  it("reports an item assigned to a disabled worker as blocked", () => {
    const item = queueTask({
      assignedWorkerId: "worker-1",
      prompt: "Run this",
      status: "ready",
    });
    const state = getAssignedWorkerRoutingState(
      item,
      [agentWorker({ enabled: false, workerId: "worker-1" })],
      { tasks: [item] },
    );

    expect(state.canTake).toBe(false);
    expect(reasonCodes(state.blockedReasons).includes("worker_disabled")).toBe(
      true,
    );
  });

  it("chooses the best next item by priority, order, creation time, and id", () => {
    const worker = agentWorker();
    const items = [
      queueTask({
        createdAt: "2026-05-20T10:00:00.000Z",
        orderIndex: 0,
        priority: 1,
        prompt: "Low",
        queueItemId: "low",
        status: "ready",
      }),
      queueTask({
        createdAt: "2026-05-20T10:01:00.000Z",
        orderIndex: 2,
        priority: 5,
        prompt: "Later high",
        queueItemId: "later-high",
        status: "ready",
      }),
      queueTask({
        createdAt: "2026-05-20T10:02:00.000Z",
        orderIndex: 1,
        priority: 5,
        prompt: "First high",
        queueItemId: "first-high",
        status: "ready",
      }),
    ];

    expect(getBestNextItemForWorker(worker, items, { tasks: items })?.queueItemId)
      .toBe("first-high");
  });

  it("does not let priority bypass dependency or paused tag gates", () => {
    const worker = agentWorker();
    const blockedHigh = queueTask({
      dependsOn: ["missing"],
      priority: 5,
      prompt: "Blocked",
      queueItemId: "blocked-high",
      status: "ready",
    });
    const pausedHigh = queueTask({
      priority: 5,
      prompt: "Paused",
      queueItemId: "paused-high",
      queueTagId: "paused",
      queueTagName: "Paused",
      status: "ready",
    });
    const eligibleLow = queueTask({
      priority: 1,
      prompt: "Eligible",
      queueItemId: "eligible-low",
      status: "ready",
    });
    const items = [blockedHigh, pausedHigh, eligibleLow];

    expect(
      getBestNextItemForWorker(worker, items, {
        pausedQueueTagIds: new Set(["paused"]),
        tasks: items,
      })?.queueItemId,
    ).toBe("eligible-low");
  });

  it("summarizes eligible count, next item, and blocked reasons", () => {
    const disabledWorker = agentWorker({ enabled: false });
    const item = queueTask({ prompt: "Run this", status: "ready" });

    expect(
      getWorkerRoutingSummary(agentWorker(), [item], { tasks: [item] })
        .eligibleItemCount,
    ).toBe(1);
    expect(
      getWorkerRoutingSummary(agentWorker(), [item], { tasks: [item] })
        .nextItem?.queueItemId,
    ).toBe("queue-1");
    expect(
      getWorkerRoutingSummary(disabledWorker, [item], { tasks: [item] })
        .blockedReasonSummary?.includes("Worker is disabled"),
    ).toBe(true);
  });
});

function reasonCodes(
  reasons: ReturnType<typeof getWorkerItemBlockedReasons>,
) {
  return reasons.map((blockedReason) => blockedReason.code);
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
