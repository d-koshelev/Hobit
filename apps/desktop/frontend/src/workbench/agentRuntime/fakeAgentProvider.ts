import { createMockProviderCapabilities } from "./agentRuntimeModel";
import type { AgentProvider, AgentProviderEvent } from "./agentProvider";

export type FakeAgentProviderScenario =
  | "cancelled"
  | "error"
  | "final_answer"
  | "invalid_action_request"
  | "invalid_workflow_request"
  | "stopped"
  | "valid_action_request"
  | "valid_workflow_request";

export type FakeAgentProviderScriptStep =
  | {
      text: string;
      type:
        | "action_request_detected"
        | "final_answer"
        | "message_delta"
        | "structured_output"
        | "text_delta"
        | "workflow_request_detected";
    }
  | {
      errorMessage: string;
      type: "error";
    }
  | {
      message?: string;
      type: "cancelled" | "stopped";
    }
  | {
      finalMessage?: string;
      status: "cancelled" | "completed" | "failed";
      type: "run_finished";
    };

export type FakeAgentProviderOptions = {
  providerDisplayName?: string;
  providerId?: string;
  providerThreadId?: string | null;
  runId?: string;
  script: readonly FakeAgentProviderScriptStep[];
};

export function createFakeAgentProvider({
  providerDisplayName = "Fake Agent Provider",
  providerId = "fake-agent-provider",
  providerThreadId = "fake-thread-1",
  runId = "fake-run-1",
  script,
}: FakeAgentProviderOptions): AgentProvider {
  return {
    capabilities: createMockProviderCapabilities(providerId),
    async cancelRun(_widgetInstanceId, activeRunId) {
      return {
        message: "Fake provider cancellation requested.",
        providerId,
        runId: activeRunId,
        status: "requested",
      };
    },
    providerDisplayName,
    providerId,
    async startTurn(request, onEvent) {
      let sequence = 1;
      const startedAtMs = Date.now();
      const activeRunId = runIdForRequest(runId, request.id);
      const threadId = request.providerThreadId ?? providerThreadId;

      onEvent({
        providerId,
        providerThreadId: threadId,
        runId: activeRunId,
        sequence: sequence++,
        timestampMs: startedAtMs,
        type: "run_started",
      });

      let terminalSeen = false;
      for (const step of script) {
        const event = fakeStepToEvent({
          providerId,
          providerThreadId: threadId,
          runId: activeRunId,
          sequence: sequence++,
          startedAtMs,
          step,
        });
        onEvent(event);
        terminalSeen =
          terminalSeen ||
          event.type === "run_finished" ||
          event.type === "cancelled" ||
          event.type === "stopped" ||
          event.type === "error";
      }

      if (!terminalSeen) {
        onEvent({
          elapsedMs: Date.now() - startedAtMs,
          providerId,
          providerThreadId: threadId,
          runId: activeRunId,
          sequence: sequence++,
          status: "completed",
          timestampMs: Date.now(),
          type: "run_finished",
        });
      }

      return {
        providerId,
        runId: activeRunId,
        stopListening: () => undefined,
      };
    },
  };
}

export function fakeAgentProviderScriptForScenario(
  scenario: FakeAgentProviderScenario,
): readonly FakeAgentProviderScriptStep[] {
  switch (scenario) {
    case "valid_action_request":
      return [
        {
          text: JSON.stringify({
            capabilityId: "queue.items.list",
            dryRun: false,
            input: { limit: 10 },
            requestId: "fake-action-request",
            type: "hobit.action.request",
          }),
          type: "action_request_detected",
        },
      ];
    case "invalid_action_request":
      return [
        {
          text: JSON.stringify({
            capabilityId: "queue.items.list",
            dryRun: false,
            type: "hobit.action.request",
          }),
          type: "action_request_detected",
        },
      ];
    case "valid_workflow_request":
      return [
        {
          text: JSON.stringify(validQueueWorkflowRequest()),
          type: "workflow_request_detected",
        },
      ];
    case "invalid_workflow_request":
      return [
        {
          text: JSON.stringify({
            grant: { runSettings: { sandbox: "workspace_write" } },
            inputs: {},
            moduleId: "queue",
            requestId: "fake-invalid-workflow-request",
            type: "hobit.workflow.request",
            workflowId: "dependency_acceptance_smoke",
          }),
          type: "workflow_request_detected",
        },
      ];
    case "error":
      return [
        {
          errorMessage: "Fake provider failed.",
          type: "error",
        },
      ];
    case "cancelled":
      return [{ message: "Fake provider cancelled.", type: "cancelled" }];
    case "stopped":
      return [{ message: "Fake provider stopped.", type: "stopped" }];
    case "final_answer":
      return [
        {
          text: JSON.stringify({
            message: "Fake provider final answer.",
            type: "hobit.final.answer",
          }),
          type: "final_answer",
        },
      ];
  }
}

function validQueueWorkflowRequest() {
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
        approvalPolicy: "on_request",
        codexExecutable: "codex.cmd",
        executionPolicy: "manual",
        executorWidgetId: "executor-widget-1",
        sandbox: "workspace_write",
        workspaceRoot: "C:/repo",
      },
      tasks: [
        {
          prompt: "Complete upstream dependency smoke work.",
          slot: "upstream",
          title: "Upstream dependency smoke",
        },
        {
          dependsOnSlots: ["upstream"],
          prompt: "Complete downstream dependency smoke work.",
          slot: "downstream",
          title: "Downstream dependency smoke",
        },
      ],
    },
    moduleId: "queue",
    requestId: "fake-workflow-request",
    type: "hobit.workflow.request",
    workflowId: "dependency_acceptance_smoke",
  };
}

function fakeStepToEvent({
  providerId,
  providerThreadId,
  runId,
  sequence,
  startedAtMs,
  step,
}: {
  providerId: string;
  providerThreadId: string | null;
  runId: string;
  sequence: number;
  startedAtMs: number;
  step: FakeAgentProviderScriptStep;
}): AgentProviderEvent {
  const base = {
    providerId,
    providerThreadId,
    runId,
    sequence,
    timestampMs: Date.now(),
  };

  if (step.type === "run_finished") {
    return {
      ...base,
      elapsedMs: Date.now() - startedAtMs,
      finalMessage: step.finalMessage,
      status: step.status,
      type: "run_finished",
    };
  }

  return {
    ...base,
    ...step,
  };
}

function runIdForRequest(baseRunId: string, requestId: string) {
  const suffix = requestId.trim();
  return suffix ? `${baseRunId}:${suffix}` : baseRunId;
}
