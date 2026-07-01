import type { DirectWorkSandbox, DirectWorkStreamEvent } from "../../workspace/types";
import { createWorkspaceAgentPromptWithCapabilityContext } from "../agents/context";
import { shortCodexThreadId } from "../workspaceAgentDirectWorkThreads";
import type { AgentProvider } from "./agentProvider";
import type { AgentProtocolRuntimeResult } from "./agentProtocolRuntime";
import { classifyAgentProtocolRuntimeOutput } from "./agentProtocolRuntime";
import type {
  AgentRuntimeEvent,
  AgentRuntimeInput,
} from "./agentRuntime";

export type WorkspaceAgentRuntimeTurnBuildInput = {
  attachCapabilityContext: boolean;
  brokerContinuationActive: boolean;
  currentWorkspaceRoot?: string | null;
  directWorkSandbox: DirectWorkSandbox;
  instanceId: string;
  isBrokerContinuationTurn: boolean;
  operatorPrompt: string;
  provider: AgentProvider;
  providerThreadId: string | null;
  repoRoot: string;
  requestCreatedAtMs: number;
  requestId: string;
  signal?: AbortSignal;
  workspaceScopeId: string;
};

export type WorkspaceAgentRuntimeTurnBuildResult = {
  contextLogText: string;
  runtimeInput: AgentRuntimeInput;
  startSummaryLabel: string;
  threadStartText: string;
};

export function buildWorkspaceAgentRuntimeTurnInput({
  attachCapabilityContext,
  brokerContinuationActive,
  currentWorkspaceRoot,
  directWorkSandbox,
  instanceId,
  isBrokerContinuationTurn,
  operatorPrompt,
  provider,
  providerThreadId,
  repoRoot,
  requestCreatedAtMs,
  requestId,
  signal,
  workspaceScopeId,
}: WorkspaceAgentRuntimeTurnBuildInput): WorkspaceAgentRuntimeTurnBuildResult {
  const threadStartText = providerThreadId
    ? `Continuing ${providerThreadLabel(provider)} ${shortCodexThreadId(
        providerThreadId,
      )}.`
    : `Starting new ${providerThreadLabel(provider)}.`;
  const contextLogText = attachCapabilityContext
    ? "Hobit capability context attached. Capability manifest attached. Knowledge is not searched automatically; only visible composer text plus capability instructions are sent."
    : "Compact Hobit action result context attached for same-thread continuation. No manual user turn was added.";
  const prompt = attachCapabilityContext
    ? createWorkspaceAgentPromptWithCapabilityContext({
        currentPrompt: operatorPrompt,
        widgetInstanceId: instanceId,
        workspaceId: workspaceScopeId,
        workspaceRoot: currentWorkspaceRoot?.trim() || repoRoot,
      })
    : operatorPrompt;

  return {
    contextLogText,
    runtimeInput: {
      provider,
      ...(signal ? { providerOptions: { signal } } : {}),
      protocol: {
        mode: brokerContinuationActive ? "typed_capability_action" : "normal",
      },
      request: {
        approvalPolicy: "never",
        createdAtMs: requestCreatedAtMs,
        id: requestId,
        mode: "direct",
        prompt,
        providerThreadId,
        sandbox: directWorkSandbox,
        widgetInstanceId: instanceId,
        workingDirectory: repoRoot,
        workspaceId: workspaceScopeId,
      },
    },
    startSummaryLabel: isBrokerContinuationTurn
      ? "Continuing broker action chain"
      : providerThreadId
        ? "Starting agent turn"
        : "Starting Codex thread",
    threadStartText,
  };
}

export type AgentRuntimeDirectWorkEventFallback = {
  providerStoppedMessage: string;
  widgetInstanceId: string;
  workspaceId: string;
};

export function directWorkStreamEventFromAgentRuntimeEvent(
  runtimeEvent: Extract<AgentRuntimeEvent, { type: "provider_event" }>,
  fallback: AgentRuntimeDirectWorkEventFallback,
): DirectWorkStreamEvent | null {
  const event = runtimeEvent.providerEvent;
  if (event.rawDirectWorkEvent) {
    return event.rawDirectWorkEvent;
  }

  const base = {
    codexThreadId: event.providerThreadId ?? null,
    elapsedMs: 0,
    errorMessage: null,
    exitCode: null,
    failedStage: null,
    finalStatus: null,
    isFinal: false,
    line: null,
    parsedCodexEventType: null,
    runId: event.runId,
    status: null,
    stderrPreview: null,
    text: null,
    widgetInstanceId: fallback.widgetInstanceId,
    workbenchId: "workspace-agent-provider",
    workspaceId: fallback.workspaceId,
  } satisfies Omit<DirectWorkStreamEvent, "eventKind">;

  if (event.type === "run_started") {
    return {
      ...base,
      eventKind: "started",
      status: "running",
    };
  }

  if (
    event.type === "text_delta" ||
    event.type === "message_delta" ||
    event.type === "structured_output" ||
    event.type === "action_request_detected" ||
    event.type === "workflow_request_detected" ||
    event.type === "final_answer"
  ) {
    return {
      ...base,
      eventKind: event.type === "text_delta" ? "stdout_line" : "final_message",
      line: event.type === "text_delta" ? event.text : null,
      text: event.text,
    };
  }

  if (event.type === "error") {
    return {
      ...base,
      errorMessage: event.errorMessage,
      eventKind: "failed",
      finalStatus: "failed",
      isFinal: true,
      status: "failed",
      text: event.errorMessage,
    };
  }

  if (event.type === "cancelled" || event.type === "stopped") {
    return {
      ...base,
      eventKind: "cancelled",
      finalStatus: "cancelled",
      isFinal: true,
      status: "cancelled",
      text: event.message ?? fallback.providerStoppedMessage,
    };
  }

  if (event.type === "run_finished") {
    return {
      ...base,
      elapsedMs: event.elapsedMs ?? 0,
      eventKind: event.status,
      finalStatus: event.status,
      isFinal: true,
      status: event.status,
      text: event.finalMessage ?? null,
    };
  }

  return null;
}

export function resolveAgentRuntimeProtocolOutcome({
  fallbackMode,
  fallbackText,
  runtimeProtocolOutcome,
}: {
  fallbackMode: "normal" | "typed_capability_action";
  fallbackText: string;
  runtimeProtocolOutcome: AgentProtocolRuntimeResult | null;
}): AgentProtocolRuntimeResult {
  return (
    runtimeProtocolOutcome ??
    classifyAgentProtocolRuntimeOutput({
      mode: fallbackMode,
      text: fallbackText,
    })
  );
}

function providerThreadLabel(provider: AgentProvider) {
  return provider.providerId === "codex-direct-work"
    ? "Codex thread"
    : `${provider.providerDisplayName} thread`;
}
