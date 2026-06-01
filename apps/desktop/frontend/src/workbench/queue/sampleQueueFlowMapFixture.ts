import type { AgentQueueTask } from "../../workspace/types";
import {
  queueDependencyStatesByTask,
  type AgentWorkerSummary,
} from "../agentQueueTaskUiModel";
import { getAssignedWorkerRoutingStates } from "./agentQueueRoutingModel";
import {
  buildAgentQueueEmbeddedExecutorSection,
  buildAgentQueueSchedulerPlan,
  type AgentQueueEmbeddedExecutorSectionModel,
  type AgentQueueSchedulerPlan,
} from "./agentQueueSchedulerModel";
import {
  buildQueueFlowMap,
  type QueueFlowMap,
} from "./agentQueueFlowMapModel";

export type SampleQueueFlowMapTopology = {
  embeddedExecutor: AgentQueueEmbeddedExecutorSectionModel;
  flowMap: QueueFlowMap;
  taskCount: number;
  tasks: AgentQueueTask[];
  schedulerPlan: AgentQueueSchedulerPlan;
};

const SAMPLE_CREATED_AT = "2026-05-20T10:00:00.000Z";
const SAMPLE_UPDATED_AT = "2026-05-20T10:05:00.000Z";

export function buildSampleQueueFlowMapTopology(): SampleQueueFlowMapTopology {
  const tasks = sampleQueueFlowMapTasks();
  const workers = sampleQueueFlowMapWorkers();
  const pausedQueueTagIds = new Set<string>();
  const dependencyStates = queueDependencyStatesByTask(tasks);
  const routingStates = getAssignedWorkerRoutingStates(tasks, workers, {
    dependencyStates,
    pausedQueueTagIds,
    tasks,
  });
  const schedulerPlan = buildAgentQueueSchedulerPlan({
    dependencyStates,
    globalExecutionState: "started",
    pausedQueueTagIds,
    tasks,
    workers,
  });
  const embeddedExecutor = buildAgentQueueEmbeddedExecutorSection({
    dependencyStates,
    maxExecutors: 3,
    schedulerPlan,
    tasks,
    workers,
  });

  return {
    embeddedExecutor,
    flowMap: buildQueueFlowMap({
      dependencyStates,
      pausedQueueTagIds,
      routingStates,
      schedulerPlan,
      tasks,
      workers,
    }),
    schedulerPlan,
    taskCount: tasks.length,
    tasks,
  };
}

function sampleQueueFlowMapTasks(): AgentQueueTask[] {
  return [
    sampleTask({
      description: "Default backlog sample for the Flow Map intake lane.",
      orderIndex: 0,
      priority: 1,
      queueItemId: "sample-backlog-default",
      queueTagId: "default-6",
      queueTagName: "Default",
      title: "IN-01",
    }),
    sampleTask({
      description: "Ready implementation work with a visible dependency follower.",
      orderIndex: 1,
      priority: 3,
      queueItemId: "sample-backlog-implementation",
      queueTagId: "implementation-2",
      queueTagName: "Implementation",
      status: "ready",
      title: "API-00",
    }),
    sampleTask({
      description: "High-priority work used to review P0 lane color treatment.",
      orderIndex: 2,
      priority: 10,
      queueItemId: "sample-backlog-p0",
      queueTagId: "priority-p0-4",
      queueTagName: "Priority P0",
      title: "FIX-00",
    }),
    sampleTask({
      description: "Docs/review backlog work that should stay in the work lane.",
      orderIndex: 3,
      priority: 2,
      queueItemId: "sample-backlog-docs",
      queueTagId: "docs-review-6",
      queueTagName: "Docs/Review",
      status: "ready",
      title: "DOC-00",
      validationStatus: "needs_review",
    }),
    ...sampleDenseLaneTasks({
      orderIndexStart: 4,
      queueItemIdPrefix: "sample-dense-lane-a",
      queueTagId: "dense-lane-a-15-stack",
      queueTagName: "Dense lane A / 15-task stack",
      titlePrefix: "Q",
    }),
    sampleTask({
      description: "Draft sample for not-runnable work.",
      orderIndex: 20,
      prompt: "Draft the stabilization plan before this becomes runnable.",
      queueItemId: "sample-waiting-draft",
      queueTagId: "default-6",
      queueTagName: "Default",
      status: "draft",
      title: "PLAN-01",
    }),
    sampleTask({
      assignedExecutorWidgetId: "sample-worker-spare",
      assignedWorkerId: "sample-worker-spare",
      description: "Assigned sample with no prompt so the lane shows plan-needed work.",
      orderIndex: 21,
      prompt: "",
      queueItemId: "sample-waiting-plan-needed",
      queueTagId: "docs-review-6",
      queueTagName: "Docs/Review",
      title: "PLAN-02",
    }),
    ...sampleDenseLaneTasks({
      orderIndexStart: 22,
      queueItemIdPrefix: "sample-dense-lane-b",
      queueTagId: "dense-lane-b-15-stack",
      queueTagName: "Dense lane B / 15-task stack",
      status: "draft",
      titlePrefix: "API",
    }),
    sampleTask({
      dependsOn: ["sample-backlog-implementation"],
      description: "Dependency-gated sample that waits on an unfinished item.",
      orderIndex: 37,
      priority: 2,
      queueItemId: "sample-blocked-dependency",
      queueTagId: "implementation-2",
      queueTagName: "Implementation",
      status: "ready",
      title: "DEP-01",
    }),
    sampleTask({
      assignedExecutorWidgetId: "sample-worker-docs",
      assignedWorkerId: "sample-worker-docs",
      description: "Routing-gated sample assigned to a worker scoped to another lane.",
      orderIndex: 38,
      priority: 1,
      queueItemId: "sample-blocked-routing",
      queueTagId: "follow-up-routing-1",
      queueTagName: "Follow-up/Routing",
      title: "BLK-01",
    }),
    sampleTask({
      assignedExecutorWidgetId: "sample-worker-running",
      assignedWorkerId: "sample-worker-running",
      description: "Running implementation sample shown in the Executor section.",
      orderIndex: 39,
      priority: 4,
      queueItemId: "sample-running-worker",
      queueTagId: "implementation-2",
      queueTagName: "Implementation",
      status: "running",
      title: "RUN-01",
      validationStatus: "validating",
    }),
    sampleTask({
      assignedExecutorWidgetId: "sample-worker-docs",
      assignedWorkerId: "sample-worker-docs",
      description: "Second working lane sample for assigned/in-progress review work.",
      itemType: "diff_review",
      orderIndex: 40,
      priority: 3,
      queueItemId: "sample-assigned-progress",
      queueTagId: "docs-review-6",
      queueTagName: "Docs/Review",
      status: "running",
      title: "RUN-02",
    }),
    sampleTask({
      coordinatorStatus: "finalized",
      description: "Finalized completed sample for result grouping.",
      orderIndex: 41,
      priority: 0,
      queueItemId: "sample-completed-finalized",
      queueTagId: "default-6",
      queueTagName: "Default",
      status: "completed",
      title: "OUT-01",
      validationStatus: "passed",
    }),
    sampleTask({
      coordinatorStatus: "awaiting_coordinator_review",
      description: "Reported sample that is not finalized yet.",
      orderIndex: 42,
      priority: 2,
      queueItemId: "sample-reported-awaiting-review",
      queueTagId: "docs-review-6",
      queueTagName: "Docs/Review",
      status: "review_needed",
      title: "OUT-02",
      workerExecutionReports: [
        {
          changedFiles: ["docs/testing/CURRENT_VALIDATION_SMOKE_CHECKLIST.md"],
          commandsRun: ["npm.cmd run typecheck --prefix apps/desktop/frontend"],
          createdAt: "2026-05-20T10:12:00.000Z",
          errors: [],
          itemId: "sample-reported-awaiting-review",
          reportId: "sample-report-awaiting-review",
          reportStatus: "reported",
          summary: "Sample report is waiting for operator review.",
          validationCommandsSuggested: [
            "npm.cmd run test --prefix apps/desktop/frontend",
          ],
          validationResult: "partial",
          warnings: ["Sample warning for visual density review."],
          workerId: "sample-worker-docs",
        },
      ],
    }),
    sampleTask({
      coordinatorStatus: "needs_changes",
      description: "Failed sample for result/error treatment.",
      orderIndex: 43,
      priority: 4,
      queueItemId: "sample-failed-needs-changes",
      queueTagId: "follow-up-routing-1",
      queueTagName: "Follow-up/Routing",
      status: "failed",
      title: "FIX-01",
      validationStatus: "failed",
    }),
  ];
}

function sampleDenseLaneTasks({
  orderIndexStart,
  queueItemIdPrefix,
  queueTagId,
  queueTagName,
  status = "queued",
  titlePrefix,
}: {
  orderIndexStart: number;
  queueItemIdPrefix: string;
  queueTagId: string;
  queueTagName: string;
  status?: AgentQueueTask["status"];
  titlePrefix: string;
}): AgentQueueTask[] {
  return Array.from({ length: 15 }, (_, index) => {
    const sequence = (index + 1).toString().padStart(2, "0");

    return sampleTask({
      description: "Compact stress-test sample for dense Queue map readability.",
      orderIndex: orderIndexStart + index,
      priority: 0,
      queueItemId: `${queueItemIdPrefix}-${sequence}`,
      queueTagId,
      queueTagName,
      status,
      title: `${titlePrefix}-${sequence}`,
    });
  });
}

function sampleQueueFlowMapWorkers(): AgentWorkerSummary[] {
  return [
    {
      currentItemId: "sample-running-worker",
      displayOrder: 0,
      enabled: true,
      lastReportSummary: "Running implementation work",
      name: "Executor A",
      scope: { kind: "all" },
      status: "running",
      workerId: "sample-worker-running",
    },
    {
      currentItemId: "sample-assigned-progress",
      displayOrder: 1,
      enabled: true,
      lastReportSummary: "Assigned review work",
      name: "Executor B",
      scope: {
        kind: "queue_tag",
        queueTagId: "docs-review-6",
        queueTagName: "Docs/Review",
      },
      status: "running",
      workerId: "sample-worker-docs",
    },
    {
      currentItemId: null,
      displayOrder: 2,
      enabled: true,
      lastReportSummary: null,
      name: "Executor C",
      scope: { kind: "all" },
      status: "idle",
      workerId: "sample-worker-spare",
    },
  ];
}

function sampleTask(overrides: Partial<AgentQueueTask>): AgentQueueTask {
  return {
    assignedExecutorWidgetId: null,
    createdAt: SAMPLE_CREATED_AT,
    dependsOn: [],
    description: "",
    executionPolicy: "manual",
    itemType: "implementation",
    priority: 0,
    prompt: "Sample prompt for visual topology review only.",
    queueItemId: "sample-task",
    queueTagId: "default-6",
    queueTagName: "Default",
    status: "queued",
    title: "Sample task",
    updatedAt: SAMPLE_UPDATED_AT,
    validationStatus: "not_started",
    workspaceId: "sample-workspace",
    ...overrides,
  };
}
