import adapterSource from "./queueWorkflowRunnerRuntimeAdapter.ts?raw";
import dispatcherSource from "./queueWorkflowBackendStepDispatcher.ts?raw";
import finalizationPhaseSource from "./queueWorkflowRunnerBackendFinalizationPhase.ts?raw";

import { describe, expect, it, vi } from "vitest";

import type {
  AgentQueueWorkflowFinalizationStepResult,
  ExecuteAgentQueueWorkflowFinalizationStepRequest,
} from "../../../workspace/types";
import {
  backendOwnedQueueWorkflowPhases,
  legacyFrontendQueueWorkflowPhases,
} from "./queueWorkflowBackendStepDispatcher";
import {
  executeBackendOwnedFinalizationStep,
  projectFinalizationStepResultToRunnerResult,
} from "./queueWorkflowRunnerBackendFinalizationPhase";
import type { QueueWorkflowPersistencePort } from "./queueWorkflowRunnerRuntimeAdapter";
import type { QueueWorkflowRunnerRequest } from "./queueWorkflowRunner";

describe("QueueWorkflowRunner backend finalization phase", () => {
  it("declares finalization as backend-owned and outside legacy frontend phases", () => {
    expect(backendOwnedQueueWorkflowPhases).toContain("finalization");
    expect(legacyFrontendQueueWorkflowPhases).not.toContain("finalization");
  });

  it("dispatches finalization to the backend step and projects the StepResult", async () => {
    const executeFinalization = vi.fn(
      async (request: ExecuteAgentQueueWorkflowFinalizationStepRequest) =>
        finalizationStepResult({ request }),
    );
    const persistence = workflowPersistence({
      executeAgentQueueWorkflowFinalizationStep: executeFinalization,
    });

    const result = await executeBackendOwnedFinalizationStep({
      actorId: "workspace-agent",
      persistenceStatus: null,
      persistentStatus: "paused",
      request: workflowRequest(),
      validationReasons: [],
      validationStatus: "valid",
      workflowPersistence: persistence,
      workflowRunId: "workflow-run-1",
      workspaceId: "workspace-1",
      workflowStartStatus: null,
    });

    expect(executeFinalization).toHaveBeenCalledWith(
      expect.objectContaining({
        confirmationToken: "operator-confirmed",
        failureReason: "typed failure reason",
        workflowRunId: "workflow-run-1",
        workspaceId: "workspace-1",
      }),
    );
    expect(result).toMatchObject({
      finalizationStepResult: {
        failureDecisionId: "failure-1",
        status: "executed",
      },
      phase: "finalization",
      status: "completed",
    });
    expect(result.runnerResult?.report.finalization).toMatchObject({
      decisionId: "failure-1",
      finalizationAction: "fail",
      status: "finalization_completed",
    });
    expect(JSON.stringify(result)).not.toContain("operator-confirmed");
  });

  it("surfaces typed finalization blockers unchanged", () => {
    const runnerResult = projectFinalizationStepResultToRunnerResult({
      request: workflowRequest(),
      result: finalizationStepResult({
        blocker: {
          blockerCode: "review_not_acked",
          blockerMessage: "The durable review message must be ACKed.",
          missingRequiredField: "messageId",
        },
        status: "blocked_precondition",
      }),
    });

    expect(runnerResult.status).toBe("finalization_blocked");
    expect(runnerResult.blockers[0]).toMatchObject({
      fieldPath: "messageId",
      message: "The durable review message must be ACKed.",
      reasonCode: "review_not_acked",
    });
  });

  it("keeps the backend-owned finalization path free of raw Queue mutations and UI/shell behavior", () => {
    const activeFinalizationSources = `${dispatcherSource}\n${finalizationPhaseSource}`;
    for (const fragment of [
      "AgentQueueV2Board",
      "AgentQueuePlaceholderWidget",
      "ModuleShell",
      "tokens.css",
      "widget.css",
      "markItemDone",
      "failItem",
      "queue.item.markDone",
      "queue.item.fail",
      "recordAgentQueueWorkflowRunnerReport",
      "slotBindings:",
      "currentStep:",
      "queue.workflow.runner",
      "runValidation",
      "mutateGit",
      "startWorkflowAssignedTask",
      "rollback",
    ]) {
      expect(activeFinalizationSources).not.toContain(fragment);
    }
    expect(adapterSource).not.toContain("finalizationPort");
    expect(adapterSource).not.toContain("runQueueWorkflowFinalizationRunner");
    expect(adapterSource).not.toContain("queue.item.markDone");
    expect(adapterSource).not.toContain("queue.item.fail");
  });
});

function workflowRequest(): QueueWorkflowRunnerRequest {
  return {
    grant: {
      confirmationToken: "operator-confirmed",
      constraints: { noDownstreamAutoStart: true },
      mode: "queue_failure_smoke",
    },
    inputs: {
      failureReason: "typed failure reason",
      phase: "finalization",
    },
    moduleId: "queue",
    requestId: "request-1",
    workflowId: "dependency_failure_smoke",
  };
}

function workflowPersistence(
  overrides: Partial<QueueWorkflowPersistencePort> = {},
): QueueWorkflowPersistencePort {
  return {
    planAgentQueueWorkflowResume: vi.fn(async () => null),
    recordAgentQueueWorkflowRunnerReport: vi.fn(async () => ({
      actions: [],
      blocker: null,
      conflict: null,
      status: "recorded",
      workflowRun: null,
    })),
    startAgentQueueWorkflow: vi.fn(async () => ({
      blocker: null,
      conflict: null,
      status: "succeeded",
      workflowRun: null,
    })),
    ...overrides,
  };
}

function finalizationStepResult({
  blocker,
  request,
  status = "executed",
}: {
  blocker?: AgentQueueWorkflowFinalizationStepResult["blockers"][number];
  request?: ExecuteAgentQueueWorkflowFinalizationStepRequest;
  status?: AgentQueueWorkflowFinalizationStepResult["status"];
} = {}): AgentQueueWorkflowFinalizationStepResult {
  return {
    action: {
      actionId: "action-1",
      actionType: "queue.item.fail",
      attemptCount: 1,
      blockerCode: null,
      blockerMessage: null,
      completedAt: "7",
      createdAt: "7",
      idempotencyKey: "workflow-run-1:fail_item:upstream:task-upstream",
      resultRefsJson: '{"confirmationAccepted":true}',
      startedAt: "7",
      status: "completed",
      stepId: "finalization.fail",
      targetRefsJson: '{"taskId":"task-upstream"}',
      updatedAt: "7",
      workflowRunId: "workflow-run-1",
      workspaceId: "workspace-1",
    },
    binding: {
      actionIdempotencyKey: "workflow-run-1:fail_item:upstream:task-upstream",
      completionDecisionId: null,
      evidenceBundleId: "bundle-1",
      failureDecisionId: status === "executed" ? "failure-1" : null,
      finalizationActionId: status === "executed" ? "action-1" : null,
      finalizedAt: status === "executed" ? "7" : null,
      messageId: "message-1",
      runId: "run-1",
      slot: "upstream",
      taskId: "task-upstream",
      terminalStatus: status === "executed" ? "completed" : "blocked",
    },
    blockers: blocker ? [blocker] : [],
    completionDecisionId: null,
    conflict: null,
    downstreamVerification: {
      dependencyState: status === "executed" ? "failed_upstream" : null,
      dependencyVerified: status === "executed",
      downstreamTaskId: "task-downstream",
      expectedDependencyState: "failed_upstream",
      latestRunId: null,
      notAutoStartedVerified: true,
      ticketState: "blocked",
      verificationMissing: false,
      workerRunState: "not_started",
    },
    failureDecisionId: status === "executed" ? "failure-1" : null,
    nextPhase: status === "executed" ? "closed" : "finalization",
    nextStep: status === "executed" ? "finalization_complete" : "finalization_blocked",
    status,
    terminalStatus: status === "executed" ? "completed" : null,
    transition: "finalize_fail",
    workflowId: "dependency_failure_smoke",
    workflowRun: null,
    workflowRunId: request?.workflowRunId ?? "workflow-run-1",
  };
}
