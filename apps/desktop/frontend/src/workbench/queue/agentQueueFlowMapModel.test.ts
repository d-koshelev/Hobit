import { describe, expect, it } from "vitest";

import type { AgentQueueTask } from "../../workspace/types";
import { queueDependencyStatesByTask } from "../agentQueueTaskUiModel";
import { getAssignedWorkerRoutingStates } from "./agentQueueRoutingModel";
import {
  buildQueueFlowMap,
  queueTagColorToken,
} from "./agentQueueFlowMapModel";

describe("agent queue flow map model", () => {
  it("groups work item blocks by queue tag with stable tag color tokens", () => {
    const tasks = [
      queueTask({ queueItemId: "impl-1", queueTagId: "impl", queueTagName: "Implementation" }),
      queueTask({ queueItemId: "review-1", queueTagId: "review", queueTagName: "Review" }),
    ];
    const map = buildMap(tasks);

    expect(map.columns[0]?.groups.map((group) => group.queueTagName)).toEqual([
      "Implementation",
      "Review",
    ]);
    expect(map.columns[0]?.label).toBe("Backlog lane");
    expect(map.columns[0]?.groups[0]?.colorToken).toBe(
      queueTagColorToken("impl"),
    );
    expect(map.columns[0]?.groups[0]?.items[0]?.colorToken).toBe(
      queueTagColorToken("impl"),
    );
  });

  it("derives dependency layers and barrier rows for dependent work", () => {
    const tasks = [
      queueTask({
        coordinatorStatus: "finalized",
        queueItemId: "foundation",
        status: "completed",
        title: "Foundation",
      }),
      queueTask({
        dependsOn: ["foundation"],
        queueItemId: "follow-up",
        status: "ready",
        title: "Follow-up",
      }),
    ];
    const map = buildMap(tasks);

    expect(map.columns).toHaveLength(1);
    expect(map.columns[0]?.depth).toBe(1);
    expect(map.resultGroups[0]?.items[0]?.queueItemId).toBe("foundation");
  });

  it("shows blocked dependency reasons on dependent item blocks", () => {
    const tasks = [
      queueTask({ queueItemId: "blocker", status: "queued", title: "Blocker" }),
      queueTask({ queueItemId: "unrelated", status: "queued", title: "Unrelated" }),
      queueTask({
        dependsOn: ["blocker"],
        queueItemId: "blocked",
        status: "ready",
        title: "Blocked",
      }),
    ];
    const map = buildMap(tasks);
    const blockedBlock = map.columns[1]?.groups[0]?.items[0];

    expect(map.columns[0]?.barriersAfter[0]?.label).toContain(
      "Dependency barrier",
    );
    expect(map.columns[0]?.barriersAfter[0]?.blockingSummary).toContain(
      "Blocker",
    );
    expect(map.columns[0]?.barriersAfter[0]?.blockingSummary).not.toContain(
      "Unrelated",
    );
    expect(map.columns[0]?.barriersAfter[0]?.blockedSummary).toContain(
      "Blocked",
    );
    expect(map.columns[1]?.label).toBe("Dependency lane 1");
    expect(map.blockedColumns[0]?.label).toBe("Dependency lane 1");
    expect(blockedBlock?.dependencyStatus).toBe("blocked");
    expect(blockedBlock?.blockedReasons.join(" ")).toContain(
      "Blocked by: Blocker",
    );
    expect(map.workColumns[0]?.groups[0]?.items[0]?.queueItemId).toBe("blocker");
    expect(map.blockedColumns[0]?.groups[0]?.items[0]?.queueItemId).toBe(
      "blocked",
    );
  });

  it("separates waiting draft work from ready backlog and blocked work", () => {
    const tasks = [
      queueTask({ queueItemId: "ready", status: "queued", title: "Ready" }),
      queueTask({ queueItemId: "draft", status: "draft", title: "Draft" }),
      queueTask({
        coordinatorStatus: "blocked",
        queueItemId: "blocked",
        status: "queued",
        title: "Blocked",
      }),
    ];
    const map = buildMap(tasks);

    expect(map.workColumns[0]?.groups[0]?.items[0]?.queueItemId).toBe("ready");
    expect(map.workColumns[0]?.groups[0]?.items[0]?.primaryZone).toBe("work");
    expect(map.waitingColumns[0]?.groups[0]?.items[0]?.queueItemId).toBe("draft");
    expect(map.waitingColumns[0]?.groups[0]?.items[0]?.primaryZone).toBe(
      "waiting",
    );
    expect(map.blockedColumns[0]?.groups[0]?.items[0]?.queueItemId).toBe(
      "blocked",
    );
    expect(map.blockedColumns[0]?.groups[0]?.items[0]?.primaryZone).toBe(
      "blocked",
    );
  });

  it("assigns every queue item to one primary flow-map zone", () => {
    const tasks = [
      queueTask({ queueItemId: "ready", status: "queued", title: "Ready" }),
      queueTask({ queueItemId: "draft", status: "draft", title: "Draft" }),
      queueTask({
        coordinatorStatus: "blocked",
        queueItemId: "blocked",
        status: "queued",
        title: "Blocked",
      }),
      queueTask({
        assignedExecutorWidgetId: "worker-working",
        assignedWorkerId: "worker-working",
        queueItemId: "running",
        status: "running",
        title: "Running",
      }),
      queueTask({
        queueItemId: "completed",
        status: "completed",
        title: "Completed",
      }),
    ];
    const map = buildMap(tasks);
    const zoneItems = [
      ...itemsInColumns(map.workColumns),
      ...itemsInColumns(map.waitingColumns),
      ...itemsInColumns(map.blockedColumns),
      ...map.executorLanes.flatMap((lane) =>
        lane.activeItem ? [lane.activeItem] : [],
      ),
      ...map.resultGroups.flatMap((group) => group.items),
    ];

    expect(zoneItems.map((item) => item.queueItemId).sort()).toEqual(
      tasks.map((task) => task.queueItemId).sort(),
    );
    expect(new Set(zoneItems.map((item) => item.queueItemId)).size).toBe(
      tasks.length,
    );
    expect(map.workColumns[0]?.groups[0]?.items[0]?.queueItemId).toBe("ready");
    expect(map.waitingColumns[0]?.groups[0]?.items[0]?.queueItemId).toBe(
      "draft",
    );
    expect(map.blockedColumns[0]?.groups[0]?.items[0]?.queueItemId).toBe(
      "blocked",
    );
    expect(
      map.executorLanes.find((lane) => lane.activeItem?.queueItemId === "running")
        ?.activeItem?.queueItemId,
    ).toBe("running");
    expect(map.resultGroups[0]?.items[0]?.queueItemId).toBe("completed");
  });

  it("chooses blocked over waiting when a draft has a real dependency blocker", () => {
    const tasks = [
      queueTask({ queueItemId: "blocker", status: "queued", title: "Blocker" }),
      queueTask({
        dependsOn: ["blocker"],
        queueItemId: "draft-blocked",
        status: "draft",
        title: "Draft blocked by dependency",
      }),
    ];
    const map = buildMap(tasks);

    expect(itemsInColumns(map.waitingColumns).map((item) => item.queueItemId)).not.toContain(
      "draft-blocked",
    );
    expect(itemsInColumns(map.blockedColumns).map((item) => item.queueItemId)).toContain(
      "draft-blocked",
    );
  });

  it("keeps validation status on blocks separately from tag color", () => {
    const tasks = [
      queueTask({
        queueItemId: "validate-1",
        queueTagId: "validation",
        queueTagName: "Validation",
        status: "running",
        validationStatus: "validating",
      }),
    ];
    const map = buildMap(tasks);
    const block = map.executorLanes.find(
      (lane) => lane.activeItem?.queueItemId === "validate-1",
    )?.activeItem;

    expect(block?.colorToken).toBe(queueTagColorToken("validation"));
    expect(block?.assignedWorkerLabel).toBeNull();
    expect(block?.statusLabel).toBe("Running");
    expect(block?.validationStatus).toBe("validating");
    expect(block?.validationStatusLabel).toBe("Validating");
  });

  it("derives spare and working executor lanes without scheduling work", () => {
    const tasks = [
      queueTask({
        assignedExecutorWidgetId: "worker-working",
        assignedWorkerId: "worker-working",
        queueItemId: "running-task",
        status: "running",
      }),
    ];
    const map = buildQueueFlowMap({
      dependencyStates: queueDependencyStatesByTask(tasks),
      routingStates: getAssignedWorkerRoutingStates(tasks, workers(), { tasks }),
      tasks,
      workers: workers(),
    });

    expect(map.executorLanes).toHaveLength(2);
    expect(map.executorLanes[0]).toMatchObject({
      activeItem: expect.objectContaining({ queueItemId: "running-task" }),
      isWorking: true,
      workerId: "worker-working",
    });
    expect(map.executorLanes[0]?.activeItem?.assignedWorkerLabel).toBe(
      "Worker working",
    );
    expect(map.executorLanes[1]).toMatchObject({
      activeItem: null,
      isWorking: false,
      workerId: "worker-spare",
    });
  });

  it("groups final result blocks by queue tag", () => {
    const tasks = [
      queueTask({
        queueItemId: "done-1",
        queueTagId: "impl",
        queueTagName: "Implementation",
        status: "completed",
      }),
      queueTask({
        queueItemId: "failed-1",
        queueTagId: "review",
        queueTagName: "Review",
        status: "failed",
      }),
    ];
    const map = buildMap(tasks);

    expect(map.columns).toHaveLength(0);
    expect(map.resultGroups.map((group) => group.queueTagName)).toEqual([
      "Implementation",
      "Review",
    ]);
  });

  it("groups reported non-final blocks in results without changing status", () => {
    const tasks = [
      queueTask({
        coordinatorStatus: "awaiting_coordinator_review",
        queueItemId: "reported-1",
        status: "queued",
        workerExecutionReports: [
          {
            changedFiles: [],
            commandsRun: [],
            createdAt: "2026-05-20T10:02:00.000Z",
            errors: [],
            itemId: "reported-1",
            reportId: "report-1",
            reportStatus: "reported",
            summary: "Worker report summary",
            validationCommandsSuggested: [],
            validationResult: "not_run",
            warnings: [],
            workerId: "worker-spare",
          },
        ],
      }),
    ];
    const map = buildMap(tasks);

    expect(map.columns).toHaveLength(0);
    expect(map.resultGroups[0]?.items[0]).toMatchObject({
      hasWorkerReport: true,
      queueItemId: "reported-1",
      status: "queued",
      statusLabel: "Queued",
    });
  });
});

function buildMap(tasks: AgentQueueTask[]) {
  return buildQueueFlowMap({
    dependencyStates: queueDependencyStatesByTask(tasks),
    pausedQueueTagIds: new Set(),
    routingStates: getAssignedWorkerRoutingStates(tasks, workers(), { tasks }),
    tasks,
    workers: workers(),
  });
}

function itemsInColumns(columns: ReturnType<typeof buildMap>["columns"]) {
  return columns.flatMap((column) =>
    column.groups.flatMap((group) => group.items),
  );
}

function queueTask(overrides: Partial<AgentQueueTask> = {}): AgentQueueTask {
  return {
    assignedExecutorWidgetId: null,
    createdAt: "2026-05-20T10:00:00.000Z",
    dependsOn: [],
    description: "",
    executionPolicy: "manual",
    itemType: "implementation",
    priority: 0,
    prompt: "Prompt",
    queueItemId: "queue-1",
    queueTagId: "default",
    queueTagName: "Default",
    status: "queued",
    title: "Queue task",
    updatedAt: "2026-05-20T10:00:00.000Z",
    validationStatus: "not_started",
    workspaceId: "workspace-1",
    ...overrides,
  };
}

function workers() {
  return [
    {
      currentItemId: "running-task",
      displayOrder: 0,
      enabled: true,
      lastReportSummary: null,
      name: "Worker working",
      scope: { kind: "all" as const },
      status: "running" as const,
      workerId: "worker-working",
    },
    {
      currentItemId: null,
      displayOrder: 1,
      enabled: true,
      lastReportSummary: null,
      name: "Worker spare",
      scope: { kind: "all" as const },
      status: "idle" as const,
      workerId: "worker-spare",
    },
  ];
}
