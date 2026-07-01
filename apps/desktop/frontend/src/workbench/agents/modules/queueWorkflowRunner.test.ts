import runnerFacadeSource from "./queueWorkflowRunner.ts?raw";
import runnerIndexSource from "./queueWorkflowRunner/index.ts?raw";
import readSnapshotsSource from "./queueWorkflowRunner/queueWorkflowRunnerReadSnapshots.ts?raw";

import { describe, expect, it } from "vitest";

import type {
  AgentQueueItemAggregate,
  AgentQueueWorkerEvidenceQueryResult,
} from "../../../workspace/types";
import type {
  QueueWorkflowEvidenceReadRequest,
  QueueWorkflowReadPort,
  QueueWorkflowRunnerRequest,
} from "./queueWorkflowRunner";
import { runQueueWorkflowReadOnlyRunner } from "./queueWorkflowRunner";
import { validateQueueWorkflowRequest } from "./queueWorkflowRequestValidation";

describe("QueueWorkflowRunner", () => {
  it("pauses dependency smoke inspection without explicit task ids and performs no reads", async () => {
    const readPort = fakeReadPort();
    const request = workflowRequest();

    const result = await runQueueWorkflowReadOnlyRunner({
      readPort,
      request,
      validation: validateQueueWorkflowRequest(request),
    });

    expect(result).toMatchObject({
      blockers: expect.arrayContaining([
        expect.objectContaining({
          reasonCode: "read_only_runner_requires_existing_tasks",
        }),
        expect.objectContaining({
          fieldPath: "$.inputs.taskIdsBySlot.upstream",
          reasonCode: "missing_explicit_task_ids",
        }),
        expect.objectContaining({
          fieldPath: "$.inputs.taskIdsBySlot.downstream",
          reasonCode: "missing_explicit_task_ids",
        }),
      ]),
      report: {
        mutationSummary: expect.objectContaining({
          didMutateQueue: false,
          didStartWorker: false,
        }),
        readOnly: true,
      },
      status: "paused",
      workflowId: "dependency_acceptance_smoke",
    });
    expect(readPort.calls).toEqual([]);
  });

  it("reads explicit scoped task ids without assigning dependency slots by order", async () => {
    const readPort = fakeReadPort({
      aggregates: {
        "task-downstream": aggregate({
          taskId: "task-downstream",
          title: "Downstream title",
        }),
        "task-upstream": aggregate({
          taskId: "task-upstream",
          title: "Upstream title",
        }),
      },
    });
    const request = workflowRequest({
      grant: {
        ...validGrant("queue_acceptance_smoke"),
        scope: { taskIds: ["task-downstream", "task-upstream"] },
      },
    });

    const result = await runQueueWorkflowReadOnlyRunner({
      readPort,
      request,
      validation: validateQueueWorkflowRequest(request),
    });

    expect(result.status).toBe("paused");
    expect(result.variables.taskIdsBySlot).toEqual({});
    expect(result.variables.scopedTaskIds).toEqual([
      "task-downstream",
      "task-upstream",
    ]);
    expect(result.blockers).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          fieldPath: "$.inputs.taskIdsBySlot.upstream",
          reasonCode: "missing_explicit_task_ids",
        }),
        expect.objectContaining({
          fieldPath: "$.inputs.taskIdsBySlot.downstream",
          reasonCode: "missing_explicit_task_ids",
        }),
      ]),
    );
    expect(readPort.calls).toEqual([
      { method: "getQueueItemAggregate", taskId: "task-downstream" },
      { method: "getLifecycle", taskId: "task-downstream" },
      { method: "getQueueItemAggregate", taskId: "task-upstream" },
      { method: "getLifecycle", taskId: "task-upstream" },
    ]);
  });

  it("completes read-only dependency inspection when slot task ids are explicit", async () => {
    const readPort = fakeReadPort({
      aggregates: {
        "task-downstream": aggregate({
          dependencyState: "waiting",
          taskId: "task-downstream",
        }),
        "task-upstream": aggregate({
          dependencyState: "none",
          taskId: "task-upstream",
        }),
      },
    });
    const request = workflowRequest({
      inputs: {
        ...validInputs(),
        taskIdsBySlot: {
          downstream: "task-downstream",
          upstream: "task-upstream",
        },
      },
    });

    const result = await runQueueWorkflowReadOnlyRunner({
      readPort,
      request,
      validation: validateQueueWorkflowRequest(request),
    });

    expect(result.status).toBe("completed");
    expect(result.variables.readSnapshots.aggregatesByTaskId).toMatchObject({
      "task-downstream": {
        dependencyState: "waiting",
        taskId: "task-downstream",
      },
      "task-upstream": {
        dependencyState: "none",
        taskId: "task-upstream",
      },
    });
    expect(result.report.nextMutatingPhase).toContain(
      "Create/setup/start can materialize dependency slots",
    );
    expect(result.report.mutationSummary).toEqual(
      expect.objectContaining({
        didAckReview: false,
        didCreateReviewMessage: false,
        didFail: false,
        didFollowUp: false,
        didLaunchTerminal: false,
        didMarkDone: false,
        didMutateGit: false,
        didMutateQueue: false,
        didRollback: false,
        didStartWorker: false,
        didValidate: false,
      }),
    );
  });

  it("reads only explicitly supplied evidence refs", async () => {
    const evidence = evidenceQuery({
      bundleId: "bundle-upstream",
      runId: "run-upstream",
      taskId: "task-upstream",
    });
    const readPort = fakeReadPort({
      aggregates: {
        "task-downstream": aggregate({ taskId: "task-downstream" }),
        "task-upstream": aggregate({ taskId: "task-upstream" }),
      },
      evidence: {
        [evidenceKey({
          runId: "run-upstream",
          taskId: "task-upstream",
        })]: evidence,
      },
    });
    const request = workflowRequest({
      inputs: {
        ...validInputs(),
        runIdsBySlot: { upstream: "run-upstream" },
        taskIdsBySlot: {
          downstream: "task-downstream",
          upstream: "task-upstream",
        },
      },
    });

    const result = await runQueueWorkflowReadOnlyRunner({
      readPort,
      request,
      validation: validateQueueWorkflowRequest(request),
    });

    expect(result.status).toBe("completed");
    expect(result.variables.readSnapshots.evidenceByKey).toEqual({
      "task-upstream|run-upstream|": evidence,
    });
    expect(readPort.calls).toContainEqual({
      method: "getEvidenceBundle",
      runId: "run-upstream",
      taskId: "task-upstream",
    });
  });

  it("keeps the frontend runner package read-only for legacy compatibility", () => {
    expect(runnerFacadeSource).toContain(
      'export * from "./queueWorkflowRunner/index";',
    );
    expect(runnerIndexSource).toContain("runQueueWorkflowReadOnlyRunner");

    for (const forbidden of [
      "runQueueWorkflowCreateSetupStartRunner",
      "runQueueWorkflowWorkerEvidenceRunner",
      "runQueueWorkflowReviewRunner",
      "runQueueWorkflowFinalizationRunner",
      "QueueWorkflowCreateSetupStartPort",
      "QueueWorkflowWorkerEvidencePort",
      "QueueWorkflowReviewPort",
      "QueueWorkflowFinalizationPort",
    ]) {
      expect(runnerIndexSource).not.toContain(forbidden);
    }

    for (const forbidden of [
      "materializeTaskSlot",
      "applyRunSettings",
      "promoteTaskSlot",
      "startWorkerForSlot",
      "recordWorkerEvidenceForSlot",
      "createReviewMessage",
      "ackReviewMessage",
      "markDone",
      "failItem",
      "slotBindings:",
      "currentStep:",
      "queue.workflow.runner",
      "AgentQueueV2Board",
      "ModuleShell",
    ]) {
      expect(readSnapshotsSource).not.toContain(forbidden);
    }
  });
});

type FakeReadPort = QueueWorkflowReadPort & {
  calls: Array<
    | { method: "getLifecycle"; taskId: string }
    | { method: "getQueueItemAggregate"; taskId: string }
    | {
        evidenceBundleId?: string;
        method: "getEvidenceBundle";
        runId?: string;
        taskId: string;
      }
    | { method: "listQueueItemAggregates" }
  >;
};

function fakeReadPort({
  aggregates = {},
  evidence = {},
}: {
  aggregates?: Record<string, AgentQueueItemAggregate>;
  evidence?: Record<string, AgentQueueWorkerEvidenceQueryResult>;
} = {}): FakeReadPort {
  const calls: FakeReadPort["calls"] = [];
  return {
    calls,
    getEvidenceBundle: async (request) => {
      calls.push({
        ...(request.evidenceBundleId
          ? { evidenceBundleId: request.evidenceBundleId }
          : {}),
        method: "getEvidenceBundle",
        ...(request.runId ? { runId: request.runId } : {}),
        taskId: request.taskId,
      });
      return evidence[evidenceKey(request)] ?? null;
    },
    getLifecycle: async (taskId) => {
      calls.push({ method: "getLifecycle", taskId });
      return aggregates[taskId] ?? null;
    },
    getQueueItemAggregate: async (taskId) => {
      calls.push({ method: "getQueueItemAggregate", taskId });
      return aggregates[taskId] ?? null;
    },
    listQueueItemAggregates: async () => {
      calls.push({ method: "listQueueItemAggregates" });
      return Object.values(aggregates);
    },
  };
}

function workflowRequest(
  overrides: Partial<QueueWorkflowRunnerRequest> = {},
): QueueWorkflowRunnerRequest {
  return {
    grant: validGrant("queue_acceptance_smoke"),
    inputs: validInputs(),
    moduleId: "queue",
    requestId: "workflow-request-1",
    workflowId: "dependency_acceptance_smoke",
    ...overrides,
  };
}

function validGrant(mode: string) {
  return {
    constraints: {
      noDelete: true,
      noDownstreamAutoStart: true,
      noGit: true,
      noRollback: true,
      noTerminal: true,
      noValidationExecution: true,
    },
    maxActions: 16,
    mode,
  };
}

function validInputs() {
  return {
    runSettings: {
      approvalPolicy: "never",
      codexExecutable: "codex.cmd",
      executionPolicy: "manual",
      executionTarget: {
        kind: "queue_local",
        providerId: "codex",
      },
      sandbox: "read_only",
      workspaceRoot: "C:/work/hobit",
    },
    tasks: [
      {
        prompt: "Read-only upstream smoke task.",
        slot: "upstream",
        title: "Upstream task",
      },
      {
        dependsOnSlots: ["upstream"],
        prompt: "Read-only downstream smoke task.",
        slot: "downstream",
        title: "Downstream task",
      },
    ],
  };
}

function aggregate({
  dependencyState = "none",
  durableFlags = {},
  reviewState = "none",
  taskId,
  ticketState = "queued",
  title = "Queue task",
  workerRunState = "not_started",
}: {
  dependencyState?: string;
  durableFlags?: Partial<AgentQueueItemAggregate["durableFlags"]>;
  reviewState?: string;
  taskId: string;
  ticketState?: string;
  title?: string;
  workerRunState?: string;
}): AgentQueueItemAggregate {
  const defaultDurableFlags: AgentQueueItemAggregate["durableFlags"] = {
    commitState: false,
    completionState: false,
    dependencyState: true,
    evidenceState: false,
    failureState: false,
    frontendOverlayUsed: false,
    latestRunLink: false,
    reviewState: false,
    taskRow: true,
    validationState: false,
  };

  return {
    blockers: [],
    commitState: "none",
    dependencyState,
    durableFlags: {
      ...defaultDurableFlags,
      ...durableFlags,
    },
    evidenceState: "none",
    evidenceSummary: null,
    latestRun: null,
    nextActions: [],
    reviewState,
    runSettings: {
      approvalPolicy: "never",
      assignedExecutorWidgetId: null,
      codexExecutable: "codex.cmd",
      executionPolicy: "manual",
      executionWorkspace: "C:/work/hobit",
      sandbox: "read_only",
    },
    taskId,
    ticketState,
    title,
    updatedAt: "2026-06-22T00:00:00.000Z",
    validationState: "not_requested",
    workerRunState,
    workspaceId: "workspace-1",
  };
}

function evidenceQuery({
  bundleId,
  runId,
  taskId,
}: {
  bundleId: string;
  runId: string;
  taskId: string;
}): AgentQueueWorkerEvidenceQueryResult {
  return {
    aggregate: aggregate({ taskId }),
    durable: true,
    evidenceBundle: {
      bundleId,
      changedFiles: [],
      changedFilesCount: 0,
      changedFilesSummary: null,
      createdAt: "2026-06-22T00:00:00.000Z",
      errorSummary: null,
      executorWidgetId: null,
      metadataJson: null,
      outcome: "completed",
      runId,
      runLinkId: null,
      source: "workflow",
      summary: "Worker completed.",
      taskId,
      updatedAt: "2026-06-22T00:01:00.000Z",
      validationSummary: null,
      workerId: "queue_local:codex",
      workspaceId: "workspace-1",
    },
    runId,
    state: "available",
    taskId,
    workspaceId: "workspace-1",
  };
}

function evidenceKey(request: QueueWorkflowEvidenceReadRequest): string {
  return [
    request.taskId,
    request.runId ?? "",
    request.evidenceBundleId ?? "",
  ].join("|");
}
