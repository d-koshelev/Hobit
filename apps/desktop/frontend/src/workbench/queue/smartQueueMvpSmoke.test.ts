import { describe, expect, it } from "vitest";

import type { AgentQueueTask, WorkerStuckReport } from "../../workspace/types";
import { buildPromptPackImportPreview } from "../promptPack/promptPackImportPreview";
import { parsePromptPackImportPlan } from "../promptPack/promptPackParser";
import { decideQueueCoordinatorAction } from "./queueCoordinatorDecisionModel";
import {
  WORKSPACE_QUEUE_SINGLETON_ID,
  buildQueueBatchMaterializationResult,
  type PromptPackImportInput,
  type QueueTaskDraft,
} from "./queuePromptPackMaterializationModel";
import {
  computeDependencyGate,
  computeHumanQueueTaskStatus,
  computeTaskEligibility,
  type QueueTaskGraphState,
} from "./queueDependencyEligibilityModel";

describe("Smart Queue MVP smoke", () => {
  it("covers prompt-pack import, pause/active eligibility, dependency closure, failure blocking, and coordinator validation decisions", () => {
    const pausedMaterialization = materializeLinearPromptPack("paused");

    expect(pausedMaterialization.wouldStartWorkers).toBe(false);
    expect(pausedMaterialization.batch.queue).toEqual({
      id: WORKSPACE_QUEUE_SINGLETON_ID,
      isActive: false,
      state: "paused",
    });
    expect(pausedMaterialization.batch.tasks.map((task) => task.source.itemId)).toEqual([
      "001",
      "002",
      "003",
    ]);
    expect(pausedMaterialization.batch.dependencies).toMatchObject([
      {
        downstreamTaskId: "queue-task-smart-queue-smoke-002",
        upstreamTaskId: "queue-task-smart-queue-smoke-001",
      },
      {
        downstreamTaskId: "queue-task-smart-queue-smoke-003",
        upstreamTaskId: "queue-task-smart-queue-smoke-002",
      },
    ]);

    const pausedTasks = pausedMaterialization.batch.tasks.map(taskFromDraft);
    expect(eligibilityFor(pausedTasks[0], pausedTasks, "paused")).toMatchObject({
      canAutoStart: false,
      dependencyGate: "none",
      humanStatus: "ready",
      reason: "Queue Paused",
    });
    expect(eligibilityFor(pausedTasks[1], pausedTasks, "paused")).toMatchObject({
      canAutoStart: false,
      dependencyGate: "waiting",
      humanStatus: "waiting_dependency",
      reason: "Queue Paused",
    });
    expect(eligibilityFor(pausedTasks[2], pausedTasks, "paused")).toMatchObject({
      canAutoStart: false,
      dependencyGate: "waiting",
      humanStatus: "waiting_dependency",
      reason: "Queue Paused",
    });

    const activeTasks = materializeLinearPromptPack("active").batch.tasks.map(taskFromDraft);
    expect(eligibilityFor(activeTasks[0], activeTasks, "active")).toMatchObject({
      canAutoStart: true,
      dependencyGate: "none",
      humanStatus: "ready",
      reason: "Eligible",
    });
    expect(humanStatusFor(activeTasks[1], activeTasks, "active")).toMatchObject({
      status: "waiting_dependency",
      text: "Waiting for queue-task-smart-queue-smoke-001",
    });
    expect(humanStatusFor(activeTasks[2], activeTasks, "active")).toMatchObject({
      status: "waiting_dependency",
      text: "Waiting for queue-task-smart-queue-smoke-002",
    });

    const with001Closed = activeTasks.map((task) =>
      task.queueItemId === "queue-task-smart-queue-smoke-001"
        ? { ...task, status: "completed" as const, coordinatorStatus: "finalized" as const }
        : task,
    );
    expect(eligibilityFor(with001Closed[1], with001Closed, "active")).toMatchObject({
      canAutoStart: true,
      dependencyGate: "satisfied",
      humanStatus: "ready",
      reason: "Eligible",
    });

    const with002Failed = with001Closed.map((task) =>
      task.queueItemId === "queue-task-smart-queue-smoke-002"
        ? { ...task, status: "failed" as const, coordinatorStatus: "failed" as const }
        : task,
    );
    expect(humanStatusFor(with002Failed[2], with002Failed, "active")).toEqual({
      status: "blocked",
      text: "Blocked: dependency failed",
    });
    expect(eligibilityFor(with002Failed[2], with002Failed, "active")).toMatchObject({
      canAutoStart: false,
      dependencyGate: "failed",
      humanStatus: "blocked",
      blockers: [
        {
          kind: "dependency_failed",
          taskId: "queue-task-smart-queue-smoke-003",
          upstreamTaskId: "queue-task-smart-queue-smoke-002",
        },
      ],
    });

    expect(
      decideQueueCoordinatorAction({
        createdAt: "2026-06-14T00:01:00.000Z",
        decisionId: "decision-validation-smoke",
        report: validationFailureReport(),
      }),
    ).toMatchObject({
      action: "request_human_input",
      blockerKind: "validation_requires_decision",
      requiresApproval: true,
      status: "needs_decision",
    });
  });
});

function materializeLinearPromptPack(queueState: PromptPackImportInput["queue"]["state"]) {
  return buildQueueBatchMaterializationResult({
    defaults: {
      approvalPolicy: "never",
      executionWorkspace: "C:/repo",
      provider: "codex",
      sandbox: "workspace_write",
    },
    preview: buildPromptPackImportPreview(
      parsePromptPackImportPlan([
        {
          path: "prompt-batch.json",
          text: JSON.stringify({
            dependencyPolicy: "explicit_only",
            id: "smart-queue-smoke",
            items: [
              {
                id: "001",
                model: "gpt-5.5",
                order: 1,
                prompt: "Implement the first Smart Queue smoke task.",
                title: "Foundation task",
              },
              {
                dependencies: ["001"],
                id: "002",
                model: "gpt-5.5",
                order: 2,
                prompt: "Implement the dependent Smart Queue smoke task.",
                title: "Dependent task",
              },
              {
                dependencies: ["002"],
                id: "003",
                model: "gpt-5.5",
                order: 3,
                prompt: "Implement the final Smart Queue smoke task.",
                title: "Final task",
              },
            ],
            name: "Smart Queue Smoke",
          }),
        },
      ]),
    ),
    queue: {
      id: WORKSPACE_QUEUE_SINGLETON_ID,
      state: queueState,
    },
  });
}

function taskFromDraft(draft: QueueTaskDraft): AgentQueueTask {
  return {
    assignedExecutorWidgetId: null,
    codexExecutable: "codex",
    createdAt: "2026-06-14T00:00:00.000Z",
    dependsOn: draft.upstreamTaskIds,
    description: draft.prompt,
    executionWorkspace: draft.settings.executionWorkspace ?? "C:/repo",
    priority: draft.priority,
    prompt: draft.prompt,
    queueItemId: draft.taskId,
    status: "ready",
    title: draft.title,
    updatedAt: "2026-06-14T00:00:00.000Z",
    workspaceId: "workspace-smart-queue-smoke",
  };
}

function eligibilityFor(
  task: AgentQueueTask | undefined,
  tasks: readonly AgentQueueTask[],
  queueState: "active" | "paused",
) {
  if (!task) {
    throw new Error("Missing smoke task");
  }

  return computeTaskEligibility(
    task,
    { state: queueState },
    graphFor(task, tasks),
    { availableSlots: 1 },
  );
}

function humanStatusFor(
  task: AgentQueueTask | undefined,
  tasks: readonly AgentQueueTask[],
  queueState: "active" | "paused",
) {
  if (!task) {
    throw new Error("Missing smoke task");
  }

  return computeHumanQueueTaskStatus(task, { state: queueState }, graphFor(task, tasks));
}

function graphFor(
  task: AgentQueueTask,
  tasks: readonly AgentQueueTask[],
): QueueTaskGraphState {
  return {
    dependencyGate: computeDependencyGate(task, tasks),
  };
}

function validationFailureReport(): WorkerStuckReport {
  return {
    createdAt: "2026-06-14T00:00:00.000Z",
    kind: "validation_failure",
    maxRetryCount: 3,
    queueId: WORKSPACE_QUEUE_SINGLETON_ID,
    reportId: "report-validation-smoke",
    retryCount: 0,
    summary: "Validation failed in the smoke workflow.",
    taskId: "queue-task-smart-queue-smoke-002",
    validationSummary: "npm run test -- --run Queue failed.",
    workerId: "worker-smart-queue-smoke",
    workspaceId: "workspace-smart-queue-smoke",
  };
}
