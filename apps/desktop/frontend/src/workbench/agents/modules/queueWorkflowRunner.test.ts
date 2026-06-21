import runnerSource from "./queueWorkflowRunner.ts?raw";

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
import {
  runQueueWorkflowReadOnlyRunner,
} from "./queueWorkflowRunner";
import { validateQueueWorkflowRequest } from "./queueWorkflowRequestValidation";

describe("QueueWorkflowRunner", () => {
  it("pauses dependency_acceptance_smoke without explicit task ids and performs no reads", async () => {
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

  it("pauses dependency_failure_smoke without explicit task ids and performs no reads", async () => {
    const readPort = fakeReadPort();
    const request = workflowRequest({
      grant: validGrant("queue_failure_smoke"),
      inputs: {
        ...validInputs(),
        failureReason: "Simulated failure for read-only workflow runner smoke.",
      },
      workflowId: "dependency_failure_smoke",
    });

    const result = await runQueueWorkflowReadOnlyRunner({
      readPort,
      request,
      validation: validateQueueWorkflowRequest(request),
    });

    expect(result.status).toBe("paused");
    expect(result.blockers).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          reasonCode: "read_only_runner_requires_existing_tasks",
        }),
      ]),
    );
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
        scope: {
          taskIds: ["task-downstream", "task-upstream"],
        },
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
    expect(result.report.nextMutatingPhase).toContain("only reads");
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

  it("reads evidence only when explicit task and run or evidence ids are supplied", async () => {
    const readPort = fakeReadPort({
      aggregates: {
        "task-downstream": aggregate({ taskId: "task-downstream" }),
        "task-upstream": aggregate({ taskId: "task-upstream" }),
      },
      evidence: {
        "task-upstream|run-upstream|bundle-upstream": evidenceQuery({
          bundleId: "bundle-upstream",
          runId: "run-upstream",
          taskId: "task-upstream",
        }),
      },
    });
    const request = workflowRequest({
      inputs: {
        ...validInputs(),
        evidenceReads: [
          { taskId: "task-upstream" },
          {
            evidenceBundleId: "bundle-upstream",
            runId: "run-upstream",
            taskId: "task-upstream",
          },
        ],
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

    expect(result.status).toBe("paused");
    expect(result.blockers).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          reasonCode: "missing_explicit_evidence_ids",
          taskId: "task-upstream",
        }),
      ]),
    );
    expect(readPort.calls).toEqual(
      expect.arrayContaining([
        {
          evidenceBundleId: "bundle-upstream",
          method: "getEvidenceBundle",
          runId: "run-upstream",
          taskId: "task-upstream",
        },
      ]),
    );
    expect(
      readPort.calls.filter((call) => call.method === "getEvidenceBundle"),
    ).toHaveLength(1);
  });

  it("returns validation-deferred for review_acceptance without Queue reads", async () => {
    const readPort = fakeReadPort();
    const request = workflowRequest({
      grant: validGrant("queue_acceptance_smoke"),
      workflowId: "review_acceptance",
    });

    const result = await runQueueWorkflowReadOnlyRunner({
      readPort,
      request,
      validation: validateQueueWorkflowRequest(request),
    });

    expect(result.status).toBe("paused");
    expect(result.blockers).toEqual([
      expect.objectContaining({
        reasonCode: "input_validation_deferred",
      }),
    ]);
    expect(readPort.calls).toEqual([]);
  });

  it("returns validation-deferred for terminal_failure without Queue reads", async () => {
    const readPort = fakeReadPort();
    const request = workflowRequest({
      grant: validGrant("queue_failure_smoke"),
      workflowId: "terminal_failure",
    });

    const result = await runQueueWorkflowReadOnlyRunner({
      readPort,
      request,
      validation: validateQueueWorkflowRequest(request),
    });

    expect(result.status).toBe("paused");
    expect(result.blockers).toEqual([
      expect.objectContaining({
        reasonCode: "input_validation_deferred",
      }),
    ]);
    expect(readPort.calls).toEqual([]);
  });

  it("does not infer task ids from task title, prompt prose, or task order", async () => {
    const readPort = fakeReadPort({
      aggregates: {
        "task-downstream": aggregate({ taskId: "task-downstream" }),
        "task-upstream": aggregate({ taskId: "task-upstream" }),
      },
    });
    const request = workflowRequest({
      inputs: {
        ...validInputs(),
        tasks: [
          {
            prompt:
              "The explicit-looking prose mentions task-upstream, but it is not workflow input.",
            slot: "upstream",
            title: "task-upstream",
          },
          {
            dependsOnSlots: ["upstream"],
            prompt: "The second task title mentions task-downstream.",
            slot: "downstream",
            title: "task-downstream",
          },
        ],
      },
    });

    const result = await runQueueWorkflowReadOnlyRunner({
      readPort,
      request,
      validation: validateQueueWorkflowRequest(request),
    });

    expect(result.status).toBe("paused");
    expect(result.variables.taskIdsBySlot).toEqual({});
    expect(readPort.calls).toEqual([]);
  });

  it("uses only read port methods and never calls mutating methods present on the fake object", async () => {
    let mutatingCalls = 0;
    const readPort = {
      ...fakeReadPort({
        aggregates: {
          "task-downstream": aggregate({ taskId: "task-downstream" }),
          "task-upstream": aggregate({ taskId: "task-upstream" }),
        },
      }),
      failItem: () => {
        mutatingCalls += 1;
        throw new Error("mutating failItem must not be called");
      },
      markItemDone: () => {
        mutatingCalls += 1;
        throw new Error("mutating markItemDone must not be called");
      },
      recordWorkerFinished: () => {
        mutatingCalls += 1;
        throw new Error("mutating recordWorkerFinished must not be called");
      },
    };
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
    expect(mutatingCalls).toBe(0);
    expect(readPort.calls.map((call) => call.method)).toEqual([
      "getQueueItemAggregate",
      "getLifecycle",
      "getQueueItemAggregate",
      "getLifecycle",
    ]);
  });

  it("does not import Queue UI, visual shell, providers, Tauri, or WorkerProvider", () => {
    expect(runnerSource).not.toContain("@tauri-apps");
    expect(runnerSource).not.toContain("AgentProvider");
    expect(runnerSource).not.toContain("WorkerProvider");
    expect(runnerSource).not.toContain("AgentQueueV2Board");
    expect(runnerSource).not.toContain("AgentQueuePlaceholderWidget");
    expect(runnerSource).not.toContain("ModuleShell");
    expect(runnerSource).not.toContain("widget.css");
    expect(runnerSource).not.toContain("queueV2");
  });
});

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
      sandbox: "read_only",
      workspaceRoot: "C:/work/hobit",
    },
    tasks: validTasks(),
  };
}

function validTasks() {
  return [
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
  ];
}

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

function evidenceKey(request: QueueWorkflowEvidenceReadRequest): string {
  return [
    request.taskId,
    request.runId ?? "",
    request.evidenceBundleId ?? "",
  ].join("|");
}

function aggregate({
  dependencyState = "none",
  taskId,
  title = "Queue task",
}: {
  dependencyState?: string;
  taskId: string;
  title?: string;
}): AgentQueueItemAggregate {
  return {
    blockers: [],
    commitState: "none",
    dependencyState,
    durableFlags: {
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
    },
    evidenceState: "none",
    evidenceSummary: null,
    latestRun: null,
    nextActions: [],
    reviewState: "none",
    runSettings: {
      approvalPolicy: "never",
      assignedExecutorWidgetId: null,
      codexExecutable: "codex.cmd",
      executionPolicy: "manual",
      executionWorkspace: "C:/work/hobit",
      sandbox: "read_only",
    },
    taskId,
    ticketState: "queued",
    title,
    updatedAt: "2026-06-22T00:00:00.000Z",
    validationState: "not_requested",
    workerRunState: "not_started",
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
      executorWidgetId: "executor-1",
      metadataJson: null,
      outcome: "completed",
      runId,
      runLinkId: "run-link-1",
      source: "test",
      summary: "Worker evidence available.",
      taskId,
      updatedAt: "2026-06-22T00:00:00.000Z",
      validationSummary: null,
      workerId: "worker-1",
      workspaceId: "workspace-1",
    },
    runId,
    state: "available",
    taskId,
    workspaceId: "workspace-1",
  };
}
