import type {
  DirectWorkApprovalPolicy,
  DirectWorkSandbox,
  DirectWorkStreamEvent,
} from "../../workspace/types";
import type {
  AgentProviderCapabilities,
  AgentProviderId,
} from "./agentRuntimeTypes";

export type AgentProviderTurnRequest = {
  approvalPolicy: DirectWorkApprovalPolicy;
  createdAtMs: number;
  id: string;
  mode: "direct";
  prompt: string;
  providerThreadId?: string | null;
  sandbox: DirectWorkSandbox;
  widgetInstanceId: string;
  workingDirectory: string;
  workspaceId: string;
};

export type AgentProviderRunHandle = {
  providerId: AgentProviderId;
  runId: string;
  stopListening: () => void;
};

export type AgentProviderCancelResult = {
  message: string;
  providerId: AgentProviderId;
  runId: string;
  status: "cancelled" | "not_supported" | "requested" | "stopped";
};

export type AgentProviderEventType =
  | "run_started"
  | "text_delta"
  | "message_delta"
  | "structured_output"
  | "action_request_detected"
  | "workflow_request_detected"
  | "final_answer"
  | "error"
  | "run_finished"
  | "cancelled"
  | "stopped";

type AgentProviderEventBase = {
  providerId: AgentProviderId;
  providerThreadId?: string | null;
  rawDirectWorkEvent?: DirectWorkStreamEvent;
  runId: string;
  sequence: number;
  timestampMs: number;
};

export type AgentProviderEvent =
  | (AgentProviderEventBase & {
      type: "run_started";
    })
  | (AgentProviderEventBase & {
      text: string;
      type: "text_delta" | "message_delta" | "structured_output";
    })
  | (AgentProviderEventBase & {
      text: string;
      type: "action_request_detected" | "workflow_request_detected" | "final_answer";
    })
  | (AgentProviderEventBase & {
      errorMessage: string;
      type: "error";
    })
  | (AgentProviderEventBase & {
      elapsedMs: number | null;
      finalMessage?: string;
      status: "cancelled" | "completed" | "failed";
      type: "run_finished";
    })
  | (AgentProviderEventBase & {
      message?: string;
      type: "cancelled" | "stopped";
    });

export type AgentProviderStartOptions = {
  signal?: AbortSignal;
};

export type AgentProvider = {
  capabilities: AgentProviderCapabilities;
  providerDisplayName: string;
  providerId: AgentProviderId;
  cancelRun?: (
    widgetInstanceId: string,
    runId: string,
  ) => Promise<AgentProviderCancelResult>;
  startTurn: (
    request: AgentProviderTurnRequest,
    onEvent: (event: AgentProviderEvent) => void,
    options?: AgentProviderStartOptions,
  ) => Promise<AgentProviderRunHandle | null>;
};

export function isAgentProviderRunHandle(
  value: AgentProviderRunHandle | null | undefined,
): value is AgentProviderRunHandle {
  return Boolean(value?.runId && value.providerId && value.stopListening);
}
