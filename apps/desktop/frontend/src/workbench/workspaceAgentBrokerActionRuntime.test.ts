import { describe, expect, it, vi } from "vitest";

import {
  createActionRequest,
  createHobitAgentActionRequestFromEnvelope,
  HOBIT_AGENT_WORKFLOW_REQUEST_ENVELOPE_TYPE,
  readHobitAgentActionRequestEnvelope,
  readHobitAgentWorkflowRequestEnvelope,
} from "./agents/broker";
import {
  createWorkspaceAgentHobitActionInvoker,
  createWorkspaceAgentQueueWorkflowInvoker,
  workspaceAgentQueueWorkflowRuntimeResultMessage,
  workspaceAgentHobitActionResultMessage,
  workspaceAgentInvalidWorkflowRequestMessage,
  workspaceAgentWorkflowRequestMessage,
} from "./workspaceAgentBrokerActionRuntime";
import runtimeSource from "./workspaceAgentBrokerActionRuntime.ts?raw";
import envelopeSource from "./agents/broker/hobitAgentActionRequestEnvelope.ts?raw";
import workflowEnvelopeSource from "./agents/broker/hobitAgentWorkflowRequestEnvelope.ts?raw";
import workflowRuntimeAdapterSource from "./agents/modules/queueWorkflowRunnerRuntimeAdapter.ts?raw";
import {
  QUEUE_MODULE_WORKFLOWS,
  type QueueWorkflowPersistencePort,
} from "./agents/modules";
import type {
  WorkspaceAgentQueueBridge,
  WorkspaceAgentQueueSetManualEnabledResult,
} from "./workspaceAgentQueueBridge";
import type {
  AgentQueueItemAggregate,
  AgentQueueWorkflowApplyRunSettingsResult,
  AgentQueueWorkflowMaterializeTaskSlotResult,
  AgentQueueWorkflowPromoteTaskSlotResult,
  AgentQueueReviewCreateMessageResult,
  AgentQueueWorkflowRun,
  AgentQueueWorkerEvidenceQueryResult,
  AgentQueueWorkerFinishedCommandResult,
  StartAssignedAgentQueueTaskResponse,
} from "../workspace/types";
import type { WidgetInstance } from "./types";
import { createWorkspaceAgentLiveWorkbenchContextSnapshot } from "./workspaceAgentLiveWorkbenchContext";
import type {
  QueueWidgetActionResult,
  QueueWidgetItemSnapshot,
  QueueWidgetSnapshot,
} from "./queue/agentQueueWidgetApiTypes";

describe("workspaceAgentBrokerActionRuntime structured action requests", () => {
  it("invokes a valid Queue lifecycle envelope through the Workspace Agent broker runtime", async () => {
    const getSnapshot = vi.fn();
    const recordWorkerFinished = vi.fn(async () =>
      workerFinishedCommandResult({
        aggregate: queueAggregate({
          evidenceState: "available",
          nextActions: [
            {
              available: true,
              code: "create_review_message",
              label: "Create review message",
              unavailableReason: null,
            },
          ],
          reviewState: "awaiting_review",
          ticketState: "awaiting_review",
          workerRunState: "completed",
        }),
      }),
    );
    const invoker = createWorkspaceAgentHobitActionInvoker({
      workspaceAgentQueueBridge: queueBridge({
        getSnapshot,
        recordWorkerFinished,
      }),
    });
    const parsed = readHobitAgentActionRequestEnvelope(
      JSON.stringify({
        capabilityId: "queue.lifecycle.agentFinished",
        dryRun: false,
        input: {
          attemptId: "attempt-1",
          finalAgentMessage: "Implemented the requested changes.",
          outcome: "completed",
          runId: "run-1",
          taskId: "task-1",
          validationSummary: "typecheck passed",
        },
        requestId: "runtime-lifecycle-valid",
        type: "hobit.action.request",
      }),
    );

    expect(parsed.status).toBe("valid");
    if (parsed.status !== "valid") {
      throw new Error("Expected valid lifecycle envelope.");
    }

    const result = await invoker(
      createHobitAgentActionRequestFromEnvelope({
        agentId: "workspace-agent",
        createdAt: "2026-06-16T12:00:00.000Z",
        envelope: parsed.envelope,
      }),
    );

    expect(result.status).toBe("succeeded");
    expect(recordWorkerFinished).toHaveBeenCalledWith(
      expect.objectContaining({
        outcome: "completed",
        runId: "run-1",
        summary: "Implemented the requested changes.",
        taskId: "task-1",
      }),
    );
    expect(result.result.output).toMatchObject({
      evidenceBundleId: "bundle-1",
      queueMutation: "backend_domain",
      ticketState: "awaiting_review",
      wouldStartWorkers: false,
    });
    expect(workspaceAgentHobitActionResultMessage(result.result)).toBe(
      "Queue lifecycle agent finished.",
    );
    expect(getSnapshot).not.toHaveBeenCalled();
  });

  it("returns compact invalid_input for an invalid lifecycle envelope", async () => {
    const getSnapshot = vi.fn();
    const invoker = createWorkspaceAgentHobitActionInvoker({
      workspaceAgentQueueBridge: queueBridge({ getSnapshot }),
    });
    const parsed = readHobitAgentActionRequestEnvelope(
      JSON.stringify({
        capabilityId: "queue.lifecycle.agentFinished",
        dryRun: false,
        input: {
          outcome: "completed",
          runId: "run-1",
          taskId: "task-1",
        },
        type: "hobit.action.request",
      }),
    );

    expect(parsed.status).toBe("valid");
    if (parsed.status !== "valid") {
      throw new Error("Expected valid envelope with invalid capability input.");
    }

    const result = await invoker(
      createHobitAgentActionRequestFromEnvelope({
        agentId: "workspace-agent",
        createdAt: "2026-06-16T12:00:00.000Z",
        envelope: parsed.envelope,
      }),
    );

    expect(result.status).toBe("invalid_input");
    expect(workspaceAgentHobitActionResultMessage(result.result)).toBe(
      "Invalid Hobit action request. finalAgentMessage is required.",
    );
    expect(getSnapshot).not.toHaveBeenCalled();
  });

  it("invokes read-only live context discovery without dryRun through the Workspace Agent broker runtime", async () => {
    const invoker = createWorkspaceAgentHobitActionInvoker({
      workspaceAgentLiveContext: {
        currentRuntimeMode: "test_renderer",
        getQueueControlState: () => ({
          backendOwned: true,
          queueEnabled: false,
          status: "disabled",
          version: 2,
          workspaceId: "workspace-1",
        }),
        workbenchSnapshot: createWorkspaceAgentLiveWorkbenchContextSnapshot({
          widgetInstances: [
            widgetInstance({
              definitionId: "agent-run",
              id: "executor-1",
              title: "Agent Executor",
            }),
          ],
          workbenchId: "workbench-1",
          workspaceId: "workspace-1",
          workspaceRootPath: "C:/repo",
        }),
      },
    });
    const parsed = readHobitAgentActionRequestEnvelope(
      JSON.stringify({
        capabilityId: "workspace.context.get",
        input: {
          includeQueueControl: true,
          includeWidgetSummary: true,
        },
        requestId: "runtime-context-read-without-dry-run",
        type: "hobit.action.request",
      }),
    );

    expect(parsed).toMatchObject({
      dryRunSource: "default_read",
      envelope: {
        dryRun: false,
      },
      status: "valid",
    });
    if (parsed.status !== "valid") {
      throw new Error("Expected valid read-only live context envelope.");
    }

    const request = createHobitAgentActionRequestFromEnvelope({
      agentId: "workspace-agent",
      createdAt: "2026-06-23T12:00:00.000Z",
      envelope: parsed.envelope,
    });
    const result = await invoker(request);

    expect(result.status).toBe("succeeded");
    expect(result.request.dryRun).toBe(false);
    expect(result.result.output).toMatchObject({
      currentWorkspaceAvailable: true,
      hiddenSideEffectFlags: {
        didMutateQueue: false,
        didStartWorkers: false,
      },
      recommendedExecutorWidgetId: "executor-1",
      widgetSummary: {
        agentExecutorCount: 1,
      },
      workspaceId: "workspace-1",
    });
  });

  it("rejects setup actions without dryRun before Queue mutation can run", () => {
    const setQueueControlManualEnabled = vi.fn();
    const parsed = readHobitAgentActionRequestEnvelope(
      JSON.stringify({
        capabilityId: "queue.control.setManualEnabled",
        input: {
          reason: "prepare_manual_queue_smoke",
        },
        requestId: "runtime-control-set-without-dry-run",
        type: "hobit.action.request",
      }),
    );

    expect(parsed).toMatchObject({
      reasons: [
        "dryRun is required for non-read capability queue.control.setManualEnabled.",
      ],
      status: "invalid",
    });
    expect(setQueueControlManualEnabled).not.toHaveBeenCalled();
  });

  it("invokes queue.lifecycle.get through backend aggregate reads without Queue snapshots", async () => {
    const getSnapshot = vi.fn();
    const getItemAggregate = vi.fn(async ({ taskId }: { taskId: string }) =>
      queueAggregate({
        blockers: [
          {
            code: "evidence_not_durable",
            message: "Evidence is not durable yet.",
          },
        ],
        commitState: "not_durable",
        dependencyState: "unknown",
        evidenceState: "not_durable",
        evidenceSummary: {
          available: false,
          notDurableReason: "Evidence is not durable yet.",
          source: "aggregate",
          summary: null,
        },
        latestRun: {
          completedAt: "2026-06-16T12:02:00.000Z",
          executorWidgetId: "executor-1",
          finalDetailAvailable: true,
          reviewStatus: "review_needed",
          runId: "run-1",
          runLinkId: "link-1",
          source: "manual",
          startedAt: "2026-06-16T12:00:00.000Z",
          status: "completed",
          validationStatus: null,
        },
        reviewState: "in_review",
        taskId,
        ticketState: "awaiting_review",
        validationState: "unknown",
        workerRunState: "completed",
      }),
    );
    const invoker = createWorkspaceAgentHobitActionInvoker({
      workspaceAgentQueueBridge: queueBridge({ getItemAggregate, getSnapshot }),
    });
    const parsed = readHobitAgentActionRequestEnvelope(
      JSON.stringify({
        capabilityId: "queue.lifecycle.get",
        dryRun: false,
        input: {
          taskId: "task-1",
        },
        requestId: "runtime-lifecycle-get",
        type: "hobit.action.request",
      }),
    );

    expect(parsed.status).toBe("valid");
    if (parsed.status !== "valid") {
      throw new Error("Expected valid lifecycle get envelope.");
    }

    const result = await invoker(
      createHobitAgentActionRequestFromEnvelope({
        agentId: "workspace-agent",
        createdAt: "2026-06-16T12:00:00.000Z",
        envelope: parsed.envelope,
      }),
    );

    expect(result.status).toBe("succeeded");
    expect(getItemAggregate).toHaveBeenCalledWith({ taskId: "task-1" });
    expect(getSnapshot).not.toHaveBeenCalled();
    expect(result.result.output).toMatchObject({
      authoritativeBackendAggregate: true,
      blockerReasons: ["Evidence is not durable yet."],
      commitState: "not_durable",
      dependencyState: "unknown",
      evidenceState: "not_durable",
      evidenceSummary: {
        available: false,
        notDurableReason: "Evidence is not durable yet.",
        source: "aggregate",
        summary: null,
      },
      latestRun: {
        runId: "run-1",
        status: "completed",
      },
      lifecycle: null,
      reviewState: "in_review",
      taskId: "task-1",
      ticketState: "awaiting_review",
      validationState: "unknown",
      workerRunState: "completed",
    });
  });

  it("invokes queue.review.getEvidenceBundle through backend evidence reads without Queue snapshots", async () => {
    const getSnapshot = vi.fn();
    const getWorkerEvidenceBundle = vi.fn(
      async ({ runId, taskId }: { runId?: string | null; taskId: string }) =>
        workerEvidenceQueryResult({
          aggregate: queueAggregate({
            evidenceState: "available",
            nextActions: [
              {
                available: true,
                code: "create_review_message",
                label: "Create review message",
                unavailableReason: null,
              },
            ],
            taskId,
            ticketState: "awaiting_review",
            workerRunState: "completed",
          }),
          runId: runId ?? "run-1",
        }),
    );
    const invoker = createWorkspaceAgentHobitActionInvoker({
      workspaceAgentQueueBridge: queueBridge({
        getSnapshot,
        getWorkerEvidenceBundle,
      }),
    });
    const parsed = readHobitAgentActionRequestEnvelope(
      JSON.stringify({
        capabilityId: "queue.review.getEvidenceBundle",
        dryRun: false,
        input: {
          runId: "run-1",
          taskId: "task-1",
        },
        requestId: "runtime-review-evidence-get",
        type: "hobit.action.request",
      }),
    );

    expect(parsed.status).toBe("valid");
    if (parsed.status !== "valid") {
      throw new Error("Expected valid evidence read envelope.");
    }

    const result = await invoker(
      createHobitAgentActionRequestFromEnvelope({
        agentId: "workspace-agent",
        createdAt: "2026-06-16T12:00:00.000Z",
        envelope: parsed.envelope,
      }),
    );

    expect(result.status).toBe("succeeded");
    expect(getWorkerEvidenceBundle).toHaveBeenCalledWith({
      runId: "run-1",
      taskId: "task-1",
    });
    expect(getSnapshot).not.toHaveBeenCalled();
    expect(result.result.output).toMatchObject({
      evidenceBundleId: "bundle-1",
      evidenceBundlePersistence: "backend_durable",
      evidenceState: "available",
      nextAction: {
        capabilityId: "queue.review.createMessage",
        input: {
          evidenceBundleId: "bundle-1",
          runId: "run-1",
          taskId: "task-1",
        },
      },
      nextSuggestedCapability: "queue.review.createMessage",
      runId: "run-1",
      taskId: "task-1",
    });
  });

  it("surfaces queue.review.createMessage backend blockers with aggregate states", async () => {
    const getSnapshot = vi.fn();
    const createReviewMessage = vi.fn(async () =>
      reviewCreateMessageBlockedResult({
        aggregate: queueAggregate({
          evidenceState: "none",
          reviewState: "not_requested",
          taskId: "task-1",
          ticketState: "draft",
          workerRunState: "not_started",
        }),
      }),
    );
    const invoker = createWorkspaceAgentHobitActionInvoker({
      workspaceAgentQueueBridge: queueBridge({
        createReviewMessage,
        getSnapshot,
      }),
    });
    const parsed = readHobitAgentActionRequestEnvelope(
      JSON.stringify({
        capabilityId: "queue.review.createMessage",
        dryRun: false,
        input: {
          taskId: "task-1",
        },
        requestId: "runtime-review-create-blocked",
        type: "hobit.action.request",
      }),
    );

    expect(parsed.status).toBe("valid");
    if (parsed.status !== "valid") {
      throw new Error("Expected valid review create envelope.");
    }

    const result = await invoker(
      createHobitAgentActionRequestFromEnvelope({
        agentId: "workspace-agent",
        createdAt: "2026-06-16T12:00:00.000Z",
        envelope: parsed.envelope,
      }),
    );

    expect(result.status).toBe("blocked_actionable");
    expect(result.result.reasonCode).toBe("task_is_draft");
    expect(createReviewMessage).toHaveBeenCalledWith({
      actorId: "workspace-agent",
      evidenceBundleId: null,
      messageBody: null,
      runId: null,
      taskId: "task-1",
    });
    expect(result.result.message).toContain("task_is_draft");
    expect(result.result.message).toContain("ticketState=draft");
    expect(result.result.output).toMatchObject({
      backendCreateMessageStatus: "precondition_failed",
      blockerCode: "task_is_draft",
      evidenceState: "none",
      reviewState: "not_requested",
      ticketState: "draft",
      workerRunState: "not_started",
    });
    expect(workspaceAgentHobitActionResultMessage(result.result)).toContain(
      "task_is_draft",
    );
    expect(workspaceAgentHobitActionResultMessage(result.result)).not.toBe(
      "Action blocked with next action. Queue review message could not be created.",
    );
    expect(getSnapshot).not.toHaveBeenCalled();
  });

  it("surfaces duplicate review create as actionable typed ACK nextAction", async () => {
    const createReviewMessage = vi.fn(async () =>
      reviewCreateMessageBlockedResult({
        aggregate: queueAggregate({
          nextActions: [
            {
              available: true,
              code: "ack_review",
              label: "Acknowledge review",
              unavailableReason: null,
            },
          ],
          reviewState: "review_message_created",
          taskId: "task-1",
          ticketState: "awaiting_review",
          workerRunState: "completed",
        }),
        blockerCode: "review_message_already_exists",
        blockerMessage: "A review message already exists.",
        existingMessageId: "queue-review-message-existing",
        nextSuggestedCapability: "queue.review.ack",
        reviewMessageAlreadyExists: true,
        status: "already_exists",
      }),
    );
    const invoker = createWorkspaceAgentHobitActionInvoker({
      workspaceAgentQueueBridge: queueBridge({ createReviewMessage }),
    });
    const parsed = readHobitAgentActionRequestEnvelope(
      JSON.stringify({
        capabilityId: "queue.review.createMessage",
        dryRun: false,
        input: { taskId: "task-1" },
        requestId: "runtime-review-create-duplicate",
        type: "hobit.action.request",
      }),
    );

    expect(parsed.status).toBe("valid");
    if (parsed.status !== "valid") {
      throw new Error("Expected valid review create envelope.");
    }

    const result = await invoker(
      createHobitAgentActionRequestFromEnvelope({
        agentId: "workspace-agent",
        createdAt: "2026-06-16T12:00:00.000Z",
        envelope: parsed.envelope,
      }),
    );

    expect(result.status).toBe("already_exists");
    expect(result.result.reasonCode).toBe("review_message_already_exists");
    const output = result.result.output as {
      nextAction?: { input: Record<string, unknown> };
    };
    expect(result.result.output).toMatchObject({
      blockerCode: "review_message_already_exists",
      existingReviewMessageId: "queue-review-message-existing",
      messageId: "queue-review-message-existing",
      nextAction: {
        capabilityId: "queue.review.ack",
        input: {
          messageId: "queue-review-message-existing",
          taskId: "task-1",
        },
      },
      nextSuggestedCapability: "queue.review.ack",
      productStatus: "already_exists",
    });
    expect(output.nextAction?.input).not.toHaveProperty(
      "reviewMessageId",
    );
  });

  it("keeps prose-only assistant responses as prose", () => {
    expect(
      readHobitAgentActionRequestEnvelope(
        "Normal assistant response without app action.",
      ),
    ).toEqual({ status: "none" });
  });

  it("formats workflow request validation results without invoking broker capabilities", () => {
    expect(
      workspaceAgentWorkflowRequestMessage({
        envelope: {
          moduleId: "queue",
          requestId: "workflow-request-1",
          type: "hobit.workflow.request",
          workflowId: "dependency_acceptance_smoke",
        },
        source: "direct_json",
        status: "valid",
        validation: {
          fieldPaths: [],
          moduleId: "queue",
          ok: true,
          reasons: [
            "Queue workflow request validated; QueueWorkflowRunner can now run supported phases when an invoker is wired.",
            "No Queue capabilities were called and no Queue state was mutated.",
          ],
          status: "workflow_valid_not_executable",
          workflowMetadata: requiredQueueWorkflowMetadata(
            "dependency_acceptance_smoke",
          ),
          workflowId: "dependency_acceptance_smoke",
        },
      }),
    ).toContain(
      "Queue workflow request validated, but no workflow runner was invoked in this context.",
    );
    expect(
      workspaceAgentWorkflowRequestMessage({
        envelope: {
          moduleId: "queue",
          requestId: "workflow-request-unknown",
          type: "hobit.workflow.request",
          workflowId: "unknown",
        },
        source: "direct_json",
        status: "valid",
        validation: {
          fieldPaths: ["$.workflowId"],
          moduleId: "queue",
          ok: false,
          reasonCode: "workflow_not_declared",
          reasons: ["unknown is not declared by module control surface queue."],
          status: "workflow_not_declared",
          workflowId: "unknown",
        },
      }),
    ).toBe(
      "Workflow request recognized, but workflow is not declared/implemented yet. unknown is not declared by module control surface queue.",
    );
    expect(
      workspaceAgentInvalidWorkflowRequestMessage([
        "$.requestId: requestId is required.",
      ]),
    ).toBe(
      "Invalid Hobit workflow request. $.requestId: requestId is required.",
    );
    expect(
      workspaceAgentInvalidWorkflowRequestMessage([
        "$.grant.runSettings: product_input_in_grant: Workflow grant cannot contain workflow data field runSettings. Put workflow data under $.inputs.",
      ]),
    ).toBe(
      "Invalid Hobit workflow request. $.grant.runSettings: product_input_in_grant: Workflow grant cannot contain workflow data field runSettings. Put workflow data under $.inputs.",
    );
  });

  it("invokes QueueWorkflowRunner through typed workflow bridge ports without lifecycle finish", async () => {
    const getItemAggregate = vi.fn(
      async ({ taskId }: { taskId: string }) => queueAggregate({ taskId }),
    );
    const listItemAggregates = vi.fn(async () => []);
    const recordWorkerFinished = vi.fn();
    const invoker = createWorkspaceAgentQueueWorkflowInvoker({
      actorId: "workspace-agent:test",
      workflowPersistence: workflowPersistence(),
      workspaceAgentQueueBridge: queueBridge({
        getItemAggregate,
        listItemAggregates,
        recordWorkerFinished,
      }),
      workspaceId: "workspace-1",
    });
    const workflowRead = readHobitAgentWorkflowRequestEnvelope(
      JSON.stringify(dependencyWorkflowRequest()),
    );

    expect(workflowRead.status).toBe("valid");
    if (workflowRead.status !== "valid") {
      throw new Error("Expected valid Queue workflow request.");
    }

    const result = await invoker(workflowRead);

    expect(result).toMatchObject({
      invoked: true,
      phase: "read",
      status: "completed",
      workflowId: "dependency_acceptance_smoke",
    });
    expect(getItemAggregate).toHaveBeenCalled();
    expect(listItemAggregates).not.toHaveBeenCalled();
    expect(recordWorkerFinished).not.toHaveBeenCalled();
    expect(workspaceAgentQueueWorkflowRuntimeResultMessage(result)).toContain(
      "Queue workflow runner report. Status: completed.",
    );
  });

  it("invokes dependency smoke workflows through canonical hobit.workflow.request create/setup/start", async () => {
    for (const scenario of [
      {
        grantMode: "queue_acceptance_smoke",
        workflowId: "dependency_acceptance_smoke",
      },
      {
        grantMode: "queue_failure_smoke",
        workflowId: "dependency_failure_smoke",
      },
    ] as const) {
      const startBridge = queueWorkflowStartBridge();
      const persistence = workflowPersistence(scenario.workflowId);
      const invoker = createWorkspaceAgentQueueWorkflowInvoker({
        actorId: "workspace-agent:test",
        workflowPersistence: persistence,
        workspaceAgentQueueBridge: startBridge.bridge,
        workspaceId: "workspace-1",
      });
      const baseRequest = dependencyWorkflowRequest();
      const workflowRead = readHobitAgentWorkflowRequestEnvelope(
        JSON.stringify({
          ...baseRequest,
          grant: {
            ...baseRequest.grant,
            confirmationToken: "operator-confirmed",
            mode: scenario.grantMode,
          },
          inputs: {
            ...baseRequest.inputs,
            phase: "create_setup_start",
          },
          requestId: `${scenario.workflowId}-initial-1`,
          workflowId: scenario.workflowId,
        }),
      );

      expect(workflowRead.status).toBe("valid");
      if (workflowRead.status !== "valid") {
        throw new Error("Expected valid Queue workflow request.");
      }

      const result = await invoker(workflowRead);

      expect(result).toMatchObject({
        invoked: true,
        phase: "create_setup_start",
        status: "paused",
        workflowId: scenario.workflowId,
        workflowRunId: "queue-workflow-run-1",
        workflowStartStatus: "succeeded",
      });
      expect(result.runnerResult?.status).toBe("awaiting_worker_completion");
      expect(result.runnerResult?.report.createSetupStart).toMatchObject({
        downstreamTaskId: "task-downstream",
        start: {
          runId: "run-upstream",
          status: "started",
          taskId: "task-upstream",
        },
        status: "worker_running",
        upstreamTaskId: "task-upstream",
      });
      expect(startBridge.materializeWorkflowTaskSlot).toHaveBeenCalledTimes(2);
      expect(startBridge.applyWorkflowRunSettings).toHaveBeenCalledTimes(1);
      expect(startBridge.promoteWorkflowTaskSlot).toHaveBeenCalledTimes(1);
      expect(startBridge.startWorkflowAssignedTask).toHaveBeenCalledWith(
        expect.objectContaining({
          approvalPolicy: "never",
          codexExecutable: "codex.cmd",
          queueItemId: "task-upstream",
          repoRoot: "C:/repo",
          sandbox: "read_only",
          workflowStartContext: expect.objectContaining({
            confirmationToken: "operator-confirmed",
            executorWidgetId: "executor-widget-1",
            taskId: "task-upstream",
            workflowRunId: "queue-workflow-run-1",
          }),
        }),
      );
      const recordRequest =
        vi.mocked(persistence.recordAgentQueueWorkflowRunnerReport).mock
          .calls[0]?.[0];
      expect(recordRequest).toBeDefined();
      expect(JSON.stringify(recordRequest)).not.toContain("operator-confirmed");
      const message = workspaceAgentQueueWorkflowRuntimeResultMessage(result);
      expect(message).toContain("Workflow run: queue-workflow-run-1.");
      expect(message).toContain(
        "Task ids: downstream=task-downstream, upstream=task-upstream.",
      );
      expect(message).toContain("Run ids: run-upstream.");
      expect(message).toContain("Action summaries:");
      expect(message).not.toContain("operator-confirmed");
    }
  });

  it("blocks canonical Queue workflow start without exact structured confirmation", async () => {
    const startBridge = queueWorkflowStartBridge();
    const persistence = workflowPersistence();
    const invoker = createWorkspaceAgentQueueWorkflowInvoker({
      actorId: "workspace-agent:test",
      workflowPersistence: persistence,
      workspaceAgentQueueBridge: startBridge.bridge,
      workspaceId: "workspace-1",
    });
    const baseRequest = dependencyWorkflowRequest();
    const workflowRead = readHobitAgentWorkflowRequestEnvelope(
      JSON.stringify({
        ...baseRequest,
        inputs: {
          ...baseRequest.inputs,
          phase: "create_setup_start",
        },
        requestId: "dependency_acceptance_smoke-missing-confirmation-1",
      }),
    );

    expect(workflowRead.status).toBe("valid");
    if (workflowRead.status !== "valid") {
      throw new Error("Expected valid Queue workflow request.");
    }

    const result = await invoker(workflowRead);

    expect(result).toMatchObject({
      invoked: true,
      phase: "create_setup_start",
      status: "blocked",
      workflowId: "dependency_acceptance_smoke",
      workflowRunId: "queue-workflow-run-1",
    });
    expect(result.blockers).toContain(
      "Queue worker start requires exact structured confirmationToken.",
    );
    expect(startBridge.startWorkflowAssignedTask).not.toHaveBeenCalled();
    expect(
      vi.mocked(persistence.recordAgentQueueWorkflowRunnerReport).mock
        .calls[0]?.[0].status,
    ).toBe("blocked");
  });

  it("handles live context discovery reads without using agent.status.read", async () => {
    const setQueueControlManualEnabled = vi.fn(async () =>
      setManualEnabledResult({ status: "succeeded" }),
    );
    const getWorkflow = vi.fn(async () => workflowDebugRun());
    const invoker = createWorkspaceAgentHobitActionInvoker({
      workspaceAgentLiveContext: {
        currentRuntimeMode: "test_renderer",
        getQueueControlState: () => ({
          backendOwned: true,
          queueEnabled: false,
          status: "disabled",
          version: 2,
          workspaceId: "workspace-1",
        }),
        workbenchSnapshot: createWorkspaceAgentLiveWorkbenchContextSnapshot({
          widgetInstances: [
            widgetInstance({
              definitionId: "interactive-agent",
              id: "workspace-agent-1",
            }),
            widgetInstance({ definitionId: "agent-run", id: "executor-1" }),
          ],
          workbenchId: "workbench-1",
          workspaceId: "workspace-1",
          workspaceRootPath: "C:/repo",
        }),
      },
      workspaceAgentQueueBridge: queueBridge({
        getWorkflow,
        getQueueControlState: () => ({
          backendOwned: true,
          queueEnabled: false,
          status: "disabled",
          version: 2,
          workspaceId: "workspace-1",
        }),
        setQueueControlManualEnabled,
      }),
    });

    const context = await invoker(
      createActionRequest({
        agentRoleId: "workspace_agent",
        capabilityId: "workspace.context.get",
        input: {
          includeQueueControl: true,
          includeWidgetSummary: true,
        },
        requestId: "runtime-workspace-context-1",
      }),
    );
    expect(context.status).toBe("succeeded");
    expect(context.result.output).toMatchObject({
      agentExecutorCount: 1,
      agentExecutors: [
        {
          definitionId: "agent-run",
          executorWidgetId: "executor-1",
          id: "executor-1",
        },
      ],
      blockers: [],
      currentRuntimeMode: "test_renderer",
      queueControlState: {
        status: "disabled",
        version: 2,
      },
      recommendedExecutorWidgetId: "executor-1",
      widgetSummary: {
        agentExecutorCount: 1,
      },
      widgetCount: 2,
      workbenchId: "workbench-1",
      workspaceId: "workspace-1",
      workspaceRootPath: "C:/repo",
    });

    const widgets = await invoker(
      createActionRequest({
        agentRoleId: "workspace_agent",
        capabilityId: "workbench.widgets.list",
        input: {
          definitionIdFilter: "agent-run",
        },
        requestId: "runtime-workbench-widgets-1",
      }),
    );
    expect(widgets.status).toBe("succeeded");
    expect(widgets.result.output).toMatchObject({
      agentExecutors: [
        {
          definitionId: "agent-run",
          executorWidgetId: "executor-1",
          id: "executor-1",
        },
      ],
      recommendedExecutorWidgetId: "executor-1",
      widgetCount: 2,
      workbenchId: "workbench-1",
    });

    const control = await invoker(
      createActionRequest({
        agentRoleId: "workspace_agent",
        capabilityId: "queue.control.get",
        input: {},
        requestId: "runtime-queue-control-1",
      }),
    );
    expect(control.status).toBe("succeeded");
    expect(control.result.output).toMatchObject({
      didMutateQueue: false,
      didStartWorkers: false,
      status: "disabled",
      version: 2,
    });

    const setManualEnabled = await invoker(
      createActionRequest({
        agentRoleId: "workspace_agent",
        capabilityId: "queue.control.setManualEnabled",
        input: {
          expectedVersion: 2,
          reason: "prepare_manual_queue_smoke",
        },
        requestId: "runtime-queue-control-set-manual-enabled-1",
      }),
    );
    expect(setManualEnabled.status).toBe("succeeded");
    expect(setManualEnabled.result.output).toMatchObject({
      didCreateRunLinks: false,
      didInvokeWorkflowRunner: false,
      didMutateEvidence: false,
      didMutateFinalization: false,
      didMutateQueueTasks: false,
      didMutateReviews: false,
      didScheduleOrAutodispatch: false,
      didStartDownstream: false,
      didStartWorkers: false,
      resultStatus: "succeeded",
    });
    expect(setQueueControlManualEnabled).toHaveBeenCalledWith(
      expect.objectContaining({
        dryRun: false,
        expectedVersion: 2,
        reason: "prepare_manual_queue_smoke",
      }),
    );
    expect(setQueueControlManualEnabled).toHaveBeenCalledTimes(1);

    const workflowRead = await invoker(
      createActionRequest({
        agentRoleId: "workspace_agent",
        capabilityId: "queue.workflow.get",
        input: {
          workflowRunId: "workflow-run-1",
        },
        requestId: "runtime-queue-workflow-get-1",
      }),
    );
    expect(workflowRead.status).toBe("succeeded");
    expect(workflowRead.result.output).toMatchObject({
      didInvokeWorkflowRunner: false,
      didMutateQueue: false,
      didStartWorkers: false,
      workflowId: "dependency_acceptance_smoke",
      workflowRunId: "workflow-run-1",
    });
    expect(getWorkflow).toHaveBeenCalledWith({
      workflowRunId: "workflow-run-1",
    });

    const statusRead = await invoker(
      createActionRequest({
        agentRoleId: "workspace_agent",
        capabilityId: "agent.status.read",
        input: {
          agentId: "workspace-agent",
        },
        requestId: "runtime-agent-status-read-1",
      }),
    );
    expect(statusRead.status).toBe("unavailable");
    expect(statusRead.result.message).toContain(
      "agent.status.read is not wired in the Workspace Agent Action Broker surface.",
    );
    expect(statusRead.policyDecision.status).toBe("unavailable");
  });

  it("does not add natural-language routing in the Workspace Agent broker runtime", () => {
    for (const source of [
      runtimeSource,
      envelopeSource,
      workflowEnvelopeSource,
      workflowRuntimeAdapterSource,
    ]) {
      expect(source).not.toContain("new RegExp");
      expect(source).not.toContain(".match(");
      expect(source).not.toContain("classifyUserIntent");
      expect(source).not.toContain(["user text", " -> regex"].join(""));
      expect(source).not.toContain("queue.workflow.invoke");
      expect(source).not.toContain("AgentQueueV2Board");
      expect(source).not.toContain("AgentQueuePlaceholderWidget");
      expect(source).not.toContain("QueueV2");
      expect(source).not.toContain("ModuleShell");
      expect(source).not.toContain("tokens.css");
      expect(source).not.toContain("widget.css");
      expect(source).not.toContain("scheduler");
      expect(source).not.toContain("autodispatch");
      expect(source).not.toContain("workspace.shell.runCommand");
      expect(source).not.toContain("Terminal");
      expect(source).not.toContain("rollback");
    }
  });
});

function requiredQueueWorkflowMetadata(workflowId: string) {
  const workflow = QUEUE_MODULE_WORKFLOWS.find(
    (candidate) => candidate.workflowId === workflowId,
  );
  if (!workflow) {
    throw new Error(`Missing Queue workflow metadata ${workflowId}`);
  }

  return workflow;
}

function workflowPersistence(
  workflowId = "dependency_acceptance_smoke",
): QueueWorkflowPersistencePort {
  return {
    planAgentQueueWorkflowResume: vi.fn(async () => null),
    recordAgentQueueWorkflowRunnerReport: vi.fn(
      async (
        request: Parameters<
          QueueWorkflowPersistencePort["recordAgentQueueWorkflowRunnerReport"]
        >[0],
      ) => ({
        actions: request.actions.map((action, index) => ({
          actionId: `workflow-action-${index + 1}`,
          actionType: action.actionType,
          attemptCount: 1,
          blockerCode: null,
          blockerMessage: null,
          completedAt: "2026-06-22T00:00:00.000Z",
          createdAt: "2026-06-22T00:00:00.000Z",
          idempotencyKey: action.idempotencyKey,
          resultRefsJson: action.resultRefs
            ? JSON.stringify(action.resultRefs)
            : null,
          startedAt: "2026-06-22T00:00:00.000Z",
          status: action.status,
          stepId: action.stepId,
          targetRefsJson: action.targetRefs
            ? JSON.stringify(action.targetRefs)
            : null,
          updatedAt: "2026-06-22T00:00:00.000Z",
          workflowRunId: request.workflowRunId,
          workspaceId: request.workspaceId,
        })),
        blocker: null,
        conflict: null,
        status: "recorded",
        workflowRun: {
          actionLogSummaryJson: null,
          actorId: "workspace-agent:test",
          blockerReason: null,
          completedAt: null,
          createdAt: "2026-06-22T00:00:00.000Z",
          currentStep: request.currentStep ?? "read_complete",
          grantSummaryJson: null,
          idempotencyKeysJson: null,
          inputsSnapshotJson: null,
          mutationRefsJson: null,
          pauseReason: null,
          phase: request.phase ?? "worker_evidence",
          requestHash: "fnv1a64:test",
          requestId: "workflow-request-1",
          schemaVersion: 1,
          slotBindingsJson: null,
          status: request.status,
          updatedAt: "2026-06-22T00:00:00.000Z",
          variablesJson: null,
          version: 2,
          workflowId,
          workflowRunId: request.workflowRunId,
          workspaceId: request.workspaceId,
        },
      }),
    ),
    startAgentQueueWorkflow: vi.fn(
      async (
        request: Parameters<
          QueueWorkflowPersistencePort["startAgentQueueWorkflow"]
        >[0],
      ) => ({
        blocker: null,
        conflict: null,
        status: "succeeded",
        workflowRun: {
          actionLogSummaryJson: null,
          actorId: "workspace-agent:test",
          blockerReason: null,
          completedAt: null,
          createdAt: "2026-06-22T00:00:00.000Z",
          currentStep: request.currentStep ?? "created",
          grantSummaryJson: null,
          idempotencyKeysJson: null,
          inputsSnapshotJson: null,
          mutationRefsJson: null,
          pauseReason: null,
          phase: request.phase ?? "intake",
          requestHash: "fnv1a64:test",
          requestId: request.requestId,
          schemaVersion: 1,
          slotBindingsJson: null,
          status: "created",
          updatedAt: "2026-06-22T00:00:00.000Z",
          variablesJson: null,
          version: 1,
          workflowId: request.workflowId,
          workflowRunId: "queue-workflow-run-1",
          workspaceId: request.workspaceId,
        },
      }),
    ),
  };
}

function dependencyWorkflowRequest() {
  return {
    grant: {
      constraints: {
        noDelete: true,
        noDownstreamAutoStart: true,
        noGit: true,
        noRollback: true,
        noTerminal: true,
        noValidationExecution: true,
      },
      mode: "queue_acceptance_smoke",
    },
    inputs: {
      phase: "read",
      runSettings: {
        approvalPolicy: "never",
        codexExecutable: "codex.cmd",
        executionPolicy: "manual",
        executorWidgetId: "executor-widget-1",
        sandbox: "read_only",
        workspaceRoot: "C:/repo",
      },
      taskIdsBySlot: {
        downstream: "task-downstream",
        upstream: "task-upstream",
      },
      tasks: [
        {
          prompt: "Complete upstream dependency smoke work.",
          slot: "upstream",
          title: "Upstream",
        },
        {
          dependsOnSlots: ["upstream"],
          prompt: "Complete downstream dependency smoke work.",
          slot: "downstream",
          title: "Downstream",
        },
      ],
    },
    moduleId: "queue",
    requestId: "workflow-request-1",
    type: HOBIT_AGENT_WORKFLOW_REQUEST_ENVELOPE_TYPE,
    workflowId: "dependency_acceptance_smoke",
  };
}

function workflowDebugRun(
  overrides: Partial<AgentQueueWorkflowRun> = {},
): AgentQueueWorkflowRun {
  return {
    actionLogSummaryJson: null,
    actorId: "workspace-agent:test",
    blockerReason: null,
    completedAt: null,
    createdAt: "2026-06-23T12:00:00.000Z",
    currentStep: "record_worker_evidence",
    grantSummaryJson: null,
    idempotencyKeysJson: null,
    inputsSnapshotJson: null,
    mutationRefsJson: null,
    pauseReason: null,
    phase: "worker_evidence",
    requestHash: "workflow-request-hash",
    requestId: "workflow-request-1",
    schemaVersion: 1,
    slotBindingsJson: JSON.stringify({
      upstream: {
        runId: "run-upstream-1",
        taskId: "task-upstream",
      },
    }),
    status: "paused",
    updatedAt: "2026-06-23T12:10:00.000Z",
    variablesJson: null,
    version: 7,
    workflowId: "dependency_acceptance_smoke",
    workflowRunId: "workflow-run-1",
    workspaceId: "workspace-1",
    ...overrides,
  };
}

function queueBridge(
  overrides: Partial<WorkspaceAgentQueueBridge> = {},
): WorkspaceAgentQueueBridge {
  return {
    createItem: vi.fn(async () => itemResult()),
    getSnapshot: vi.fn(async () => snapshotResult()),
    updateItem: vi.fn(async () => itemResult()),
    ...overrides,
  };
}

function queueWorkflowStartBridge() {
  const materializeWorkflowTaskSlot = vi.fn(
    async (
      request: Parameters<
        NonNullable<WorkspaceAgentQueueBridge["materializeWorkflowTaskSlot"]>
      >[0],
    ): Promise<AgentQueueWorkflowMaterializeTaskSlotResult> => {
      const taskId =
        request.slot === "downstream" ? "task-downstream" : "task-upstream";
      return {
        action: null,
        binding: {
          createTaskActionId: null,
          createTaskActionIdempotencyKey:
            request.actionIdempotencyKey ?? `create:${request.slot}`,
          dependencyEdgeHash: `dependency-edge:${request.slot}`,
          dependencySpecHash: `dependency-spec:${request.slot}`,
          dependencyTaskIds:
            request.slot === "downstream" ? ["task-upstream"] : [],
          dependsOnSlots: request.dependsOnSlots ?? [],
          slot: request.slot,
          taskId,
          taskSpecHash: `task-spec:${request.slot}`,
        },
        blocker: null,
        conflict: null,
        status: "created",
        task: null,
        workflowRun: null,
      };
    },
  );
  const applyWorkflowRunSettings = vi.fn(
    async (
      request: Parameters<
        NonNullable<WorkspaceAgentQueueBridge["applyWorkflowRunSettings"]>
      >[0],
    ): Promise<AgentQueueWorkflowApplyRunSettingsResult> => {
      const executionTarget = request.runSettings.executionTarget;
      const executionTargetKind = executionTarget?.kind ?? "agent_executor";
      const providerId = executionTarget?.providerId ?? "codex";
      const queueOwnerWidgetInstanceId =
        executionTarget?.kind === "queue_local"
          ? (executionTarget.queueOwnerWidgetInstanceId ?? null)
          : null;
      const executorWidgetId =
        executionTarget?.kind === "agent_executor"
          ? (executionTarget.executorWidgetId ?? "executor-widget-1")
          : (request.runSettings.executorWidgetId ??
            queueOwnerWidgetInstanceId ??
            "executor-widget-1");
      return {
        action: null,
        binding: {
          executionTargetHash: `execution-target-hash-${executionTargetKind}`,
          executionTargetKind,
          executorWidgetId,
          providerId,
          queueOwnerWidgetInstanceId,
          settingsHash: "settings-hash-upstream",
          slot: request.slot,
          taskId: request.taskId ?? "task-upstream",
          updateRunSettingsActionId: null,
          updateRunSettingsActionIdempotencyKey:
            request.actionIdempotencyKey ?? "settings:upstream",
        },
        blocker: null,
        conflict: null,
        status: "applied",
        task: null,
        workflowRun: null,
      };
    },
  );
  const promoteWorkflowTaskSlot = vi.fn(
    async (
      request: Parameters<
        NonNullable<WorkspaceAgentQueueBridge["promoteWorkflowTaskSlot"]>
      >[0],
    ): Promise<AgentQueueWorkflowPromoteTaskSlotResult> => ({
      action: null,
      binding: {
        promoteActionId: null,
        promoteActionIdempotencyKey:
          request.actionIdempotencyKey ?? "promote:upstream",
        promoted: true,
        settingsHash: request.settingsHash,
        slot: request.slot,
        taskId: request.taskId ?? "task-upstream",
        taskSpecHash: request.taskSpecHash,
        taskStatus: "queued",
      },
      blocker: null,
      conflict: null,
      status: "promoted",
      task: null,
      workflowRun: null,
    }),
  );
  const startWorkflowAssignedTask = vi.fn(
    async (
      request: Parameters<
        NonNullable<WorkspaceAgentQueueBridge["startWorkflowAssignedTask"]>
      >[0],
    ): Promise<StartAssignedAgentQueueTaskResponse> => ({
      actionIdempotencyKey:
        request.workflowStartContext?.actionIdempotencyKey ?? null,
      blocker: null,
      currentRunState: "running",
      executorWidgetInstanceId:
        request.workflowStartContext?.executorWidgetId ?? "executor-widget-1",
      queueItemId: request.queueItemId,
      runId: "run-upstream",
      settingsHash: request.workflowStartContext?.settingsHash ?? null,
      status: "started",
      workbenchId: "workbench-1",
      workflowRunId: request.workflowStartContext?.workflowRunId ?? null,
      workspaceId: "workspace-1",
    }),
  );

  return {
    applyWorkflowRunSettings,
    bridge: queueBridge({
      applyWorkflowRunSettings,
      getQueueControlState: () => ({
        backendOwned: true,
        queueEnabled: true,
        status: "manual_enabled",
        version: 7,
        workspaceId: "workspace-1",
      }),
      materializeWorkflowTaskSlot,
      promoteWorkflowTaskSlot,
      startWorkflowAssignedTask,
    }),
    materializeWorkflowTaskSlot,
    promoteWorkflowTaskSlot,
    startWorkflowAssignedTask,
  };
}

function itemResult(
  overrides: Partial<QueueWidgetItemSnapshot> = {},
): QueueWidgetActionResult<QueueWidgetItemSnapshot> {
  const item = {
    dependencies: [],
    id: "queue-created",
    prompt: "Prompt",
    status: "queued",
    title: "Queue item",
    ...overrides,
  } as QueueWidgetItemSnapshot;

  return {
    action: "queue.createItem",
    events: [],
    item,
    message: "Queue item created. No task execution started.",
    ok: true,
    safetyClass: "safe_create_update",
  };
}

function snapshotResult(
  overrides: Partial<QueueWidgetSnapshot> = {},
): QueueWidgetActionResult<QueueWidgetSnapshot> {
  const snapshot = {
    items: [],
    queueId: "workspace:workspace_1:agent-queue",
    selectedItem: null,
    selectedItemId: null,
    widgetType: "agent-queue",
    workspaceId: "workspace_1",
    ...overrides,
  } as unknown as QueueWidgetSnapshot;

  return {
    action: "queue.getSnapshot",
    events: [],
    message: "Queue snapshot returned.",
    ok: true,
    safetyClass: "safe_read",
    snapshot,
  };
}

function snapshotItem(
  overrides: Partial<QueueWidgetItemSnapshot> = {},
): QueueWidgetItemSnapshot {
  return {
    dependencies: [],
    id: "task-1",
    prompt: "Implement the request.",
    status: "queued",
    title: "Queue item",
    workspaceId: "workspace_1",
    ...overrides,
  } as QueueWidgetItemSnapshot;
}

function setManualEnabledResult(
  overrides: Partial<WorkspaceAgentQueueSetManualEnabledResult> = {},
): WorkspaceAgentQueueSetManualEnabledResult {
  const controlState = overrides.controlState ?? {
    backendOwned: true,
    queueEnabled: true,
    reason: "prepare_manual_queue_smoke",
    status: "manual_enabled" as const,
    updatedAt: "2026-06-23T12:00:00.000Z",
    updatedByActorId: "workspace-agent:test",
    version: 3,
    workspaceId: "workspace-1",
  };

  return {
    backendOwned: true,
    blockerReasons: [],
    controlState,
    didAutoRunWorkers: false,
    didCreateRunLinks: false,
    didInvokeWorkflowRunner: false,
    didMutateEvidence: false,
    didMutateFinalization: false,
    didMutateQueueControlState: true,
    didMutateQueueTasks: false,
    didMutateReviews: false,
    didScheduleOrAutodispatch: false,
    didStartDownstream: false,
    didStartWorkers: false,
    message: "Queue manual control result.",
    ok: true,
    queueEnabled: true,
    status: "succeeded",
    workspaceId: "workspace-1",
    ...overrides,
  };
}

function widgetInstance(overrides: Partial<WidgetInstance> = {}): WidgetInstance {
  return {
    config: {},
    definitionId: "notes",
    id: "widget-1",
    layout: {
      area: "main",
      height: 360,
      mode: "docked",
      order: 0,
      width: 480,
      x: 0,
      y: 0,
    },
    state: {},
    title: "Widget",
    visible: true,
    ...overrides,
  };
}

function queueAggregate(
  overrides: Partial<AgentQueueItemAggregate> = {},
): AgentQueueItemAggregate {
  return {
    blockers: [],
    commitState: "none",
    dependencyState: "none",
    durableFlags: {
      commitState: true,
      completionState: false,
      dependencyState: true,
      evidenceState: overrides.evidenceState !== "not_durable",
      failureState: false,
      frontendOverlayUsed: false,
      latestRunLink: false,
      reviewState: true,
      taskRow: true,
      validationState: true,
    },
    evidenceState: "none",
    evidenceSummary: null,
    latestRun: null,
    nextActions: [],
    reviewState: "not_requested",
    runSettings: {
      approvalPolicy: "on_request",
      assignedExecutorWidgetId: null,
      codexExecutable: "codex.cmd",
      executionPolicy: "manual",
      executionWorkspace: "C:/repo",
      sandbox: "workspace_write",
    },
    taskId: "task-1",
    ticketState: "queued",
    title: "Queue item",
    updatedAt: "2026-06-16T12:00:00.000Z",
    validationState: "not_requested",
    workerRunState: "not_started",
    workspaceId: "workspace_1",
    ...overrides,
  };
}

function workerFinishedCommandResult({
  aggregate = queueAggregate(),
}: {
  aggregate?: AgentQueueItemAggregate;
} = {}): AgentQueueWorkerFinishedCommandResult {
  return {
    aggregate,
    bundleId: "bundle-1",
    durable: true,
    evidenceBundle: {
      bundleId: "bundle-1",
      changedFiles: [],
      changedFilesCount: 0,
      changedFilesSummary: null,
      createdAt: "2026-06-16T12:01:00.000Z",
      errorSummary: null,
      executorWidgetId: "executor-1",
      metadataJson: null,
      outcome: "completed",
      runId: "run-1",
      runLinkId: "link-1",
      source: "workspace_agent",
      summary: "Implemented the requested changes.",
      taskId: aggregate.taskId,
      updatedAt: "2026-06-16T12:01:00.000Z",
      validationSummary: "typecheck passed",
      workerId: "workspace-agent",
      workspaceId: aggregate.workspaceId,
    },
    runId: "run-1",
    taskId: aggregate.taskId,
    workspaceId: aggregate.workspaceId,
  };
}

function workerEvidenceQueryResult({
  aggregate = queueAggregate(),
  runId = "run-1",
}: {
  aggregate?: AgentQueueItemAggregate;
  runId?: string;
} = {}): AgentQueueWorkerEvidenceQueryResult {
  return {
    aggregate,
    durable: true,
    evidenceBundle: {
      bundleId: "bundle-1",
      changedFiles: [],
      changedFilesCount: 0,
      changedFilesSummary: null,
      createdAt: "2026-06-16T12:01:00.000Z",
      errorSummary: null,
      executorWidgetId: "executor-1",
      metadataJson: null,
      outcome: "completed",
      runId,
      runLinkId: "link-1",
      source: "workspace_agent",
      summary: "Implemented the requested changes.",
      taskId: aggregate.taskId,
      updatedAt: "2026-06-16T12:01:00.000Z",
      validationSummary: "typecheck passed",
      workerId: "workspace-agent",
      workspaceId: aggregate.workspaceId,
    },
    runId,
    state: "available",
    taskId: aggregate.taskId,
    workspaceId: aggregate.workspaceId,
  };
}

function reviewCreateMessageBlockedResult({
  aggregate = queueAggregate({
    evidenceState: "none",
    reviewState: "not_requested",
    ticketState: "draft",
    workerRunState: "not_started",
  }),
  blockerCode = "task_is_draft",
  blockerMessage = "Draft Queue tasks cannot create review messages.",
  existingMessageId = null,
  nextSuggestedCapability = "queue.item.updateRunSettings",
  reviewMessageAlreadyExists = false,
  status = "precondition_failed",
}: {
  aggregate?: AgentQueueItemAggregate;
  blockerCode?: string;
  blockerMessage?: string;
  existingMessageId?: string | null;
  nextSuggestedCapability?: string | null;
  reviewMessageAlreadyExists?: boolean;
  status?: AgentQueueReviewCreateMessageResult["status"];
} = {}): AgentQueueReviewCreateMessageResult {
  return {
    aggregate,
    blocker: {
      blockerCode,
      blockerMessage,
      durableEvidenceRequired: false,
      evidenceBundleId: null,
      evidenceBundleIdRequired: false,
      evidenceState: aggregate.evidenceState,
      existingMessageId,
      missingRequiredField: null,
      nextSuggestedCapability,
      reviewMessageAlreadyExists,
      reviewState: aggregate.reviewState,
      runId: null,
      runIdRequired: false,
      taskId: aggregate.taskId,
      ticketState: aggregate.ticketState,
      workerRunState: aggregate.workerRunState,
    },
    durable: false,
    evidenceBundleId: null,
    messageId: null,
    reviewMessage: null,
    runId: null,
    status,
    taskId: aggregate.taskId,
    workspaceId: aggregate.workspaceId,
  };
}
