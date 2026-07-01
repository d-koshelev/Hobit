import type {
  AgentProvider,
  AgentProviderCancelResult,
  AgentProviderEvent,
  AgentProviderRunHandle,
  AgentProviderStartOptions,
  AgentProviderTurnRequest,
} from "./agentProvider";
import {
  classifyAgentProtocolRuntimeOutput,
  type AgentProtocolRuntimeInput,
  type AgentProtocolRuntimeResult,
} from "./agentProtocolRuntime";
import type { AgentProviderId } from "./agentRuntimeTypes";

export type AgentRuntimeInput = {
  provider: AgentProvider;
  providerOptions?: AgentProviderStartOptions;
  protocol?: AgentRuntimeProtocolOptions;
  request: AgentProviderTurnRequest;
};

export type AgentRuntimeProtocolOptions = {
  classifyFinalOutput?: boolean;
  finalAnswerMarkerRequired?: boolean;
  mode: AgentProtocolRuntimeInput["mode"];
};

export type AgentRuntimeStopReason =
  | "cancelled"
  | "completed"
  | "not_accepted"
  | "provider_error"
  | "provider_failed"
  | "running"
  | "stopped";

export type AgentRuntimeRunHandle = {
  cancel: () => Promise<AgentProviderCancelResult>;
  getResult: () => AgentRuntimeResult;
  providerId: AgentProviderId;
  providerRunHandle: AgentProviderRunHandle;
  requestId: string;
  runId: string;
  stopListening: () => void;
};

export type AgentRuntimeResult = {
  completedAtMs: number | null;
  events: readonly AgentRuntimeEvent[];
  finalOutputText: string | null;
  protocolResult: AgentProtocolRuntimeResult | null;
  providerId: AgentProviderId;
  providerThreadId: string | null;
  requestId: string;
  runHandle: AgentProviderRunHandle | null;
  runId: string;
  startedAtMs: number;
  stopReason: AgentRuntimeStopReason;
};

type AgentRuntimeEventBase = {
  providerId: AgentProviderId;
  providerThreadId: string | null;
  requestId: string;
  runId: string;
  timestampMs: number;
};

export type AgentRuntimeEvent =
  | (AgentRuntimeEventBase & {
      providerEvent: Extract<AgentProviderEvent, { type: "run_started" }>;
      type: "run_started";
    })
  | (AgentRuntimeEventBase & {
      providerEvent: AgentProviderEvent;
      type: "provider_event";
    })
  | (AgentRuntimeEventBase & {
      protocolResult: AgentProtocolRuntimeResult;
      text: string;
      type: "protocol_output_classified";
    })
  | (AgentRuntimeEventBase & {
      finalAnswer: string;
      protocolResult: Extract<
        AgentProtocolRuntimeResult,
        { kind: "final_answer" }
      >;
      type: "final_answer";
    })
  | (AgentRuntimeEventBase & {
      protocolResult: Extract<
        AgentProtocolRuntimeResult,
        { kind: "action_request" }
      >;
      type: "action_request";
    })
  | (AgentRuntimeEventBase & {
      protocolResult: Extract<
        AgentProtocolRuntimeResult,
        { kind: "workflow_request" }
      >;
      type: "workflow_request";
    })
  | (AgentRuntimeEventBase & {
      protocolResult: Extract<
        AgentProtocolRuntimeResult,
        {
          kind:
            | "invalid_action_request"
            | "invalid_workflow_request"
            | "mixed_action_and_workflow_request"
            | "no_action_output"
            | "protocol_stall";
        }
      >;
      type: "invalid_protocol_output";
    })
  | (AgentRuntimeEventBase & {
      errorMessage: string;
      providerEvent?: Extract<AgentProviderEvent, { type: "error" }>;
      type: "provider_error";
    })
  | (AgentRuntimeEventBase & {
      elapsedMs: number | null;
      finalMessage?: string;
      providerEvent: Extract<AgentProviderEvent, { type: "run_finished" }>;
      status: "cancelled" | "completed" | "failed";
      type: "run_finished";
    })
  | (AgentRuntimeEventBase & {
      message?: string;
      providerEvent: Extract<
        AgentProviderEvent,
        { type: "cancelled" | "stopped" }
      >;
      type: "cancelled";
    })
  | (AgentRuntimeEventBase & {
      message?: string;
      providerEvent: Extract<
        AgentProviderEvent,
        { type: "cancelled" | "stopped" }
      >;
      type: "stopped";
    });

export async function startAgentRuntimeTurn(
  input: AgentRuntimeInput,
  onEvent: (event: AgentRuntimeEvent) => void,
): Promise<AgentRuntimeRunHandle | null> {
  const state: AgentRuntimeMutableState = {
    completedAtMs: null,
    events: [],
    finalOutputText: null,
    protocolResult: null,
    providerId: input.provider.providerId,
    providerRunHandle: null,
    providerThreadId: input.request.providerThreadId ?? null,
    requestId: input.request.id,
    runId: input.request.id,
    startedAtMs: Date.now(),
    stopReason: "running",
  };

  const emit = (event: AgentRuntimeEvent) => {
    state.events.push(event);
    onEvent(event);
  };

  const providerRunHandle = await input.provider.startTurn(
    input.request,
    (event) => {
      recordProviderEvent({
        emit,
        event,
        protocol: input.protocol,
        state,
      });
    },
    input.providerOptions,
  );

  state.providerRunHandle = providerRunHandle;
  if (!providerRunHandle) {
    state.stopReason =
      state.stopReason === "running" ? "not_accepted" : state.stopReason;
    return null;
  }

  state.runId = providerRunHandle.runId;

  return {
    cancel: () => cancelRuntimeRun(input.provider, input.request, state),
    getResult: () => snapshotRuntimeResult(state),
    providerId: input.provider.providerId,
    providerRunHandle,
    requestId: input.request.id,
    runId: providerRunHandle.runId,
    stopListening: providerRunHandle.stopListening,
  };
}

type AgentRuntimeMutableState = {
  completedAtMs: number | null;
  events: AgentRuntimeEvent[];
  finalOutputText: string | null;
  protocolResult: AgentProtocolRuntimeResult | null;
  providerId: AgentProviderId;
  providerRunHandle: AgentProviderRunHandle | null;
  providerThreadId: string | null;
  requestId: string;
  runId: string;
  startedAtMs: number;
  stopReason: AgentRuntimeStopReason;
};

function recordProviderEvent({
  emit,
  event,
  protocol,
  state,
}: {
  emit: (event: AgentRuntimeEvent) => void;
  event: AgentProviderEvent;
  protocol?: AgentRuntimeProtocolOptions;
  state: AgentRuntimeMutableState;
}) {
  state.runId = event.runId || state.runId;
  state.providerThreadId = event.providerThreadId ?? state.providerThreadId;

  const text = outputTextFromProviderEvent(event);
  if (text !== null) {
    state.finalOutputText = text;
  }

  if (event.type === "run_started") {
    emit({
      ...eventBase(state, event.timestampMs),
      providerEvent: event,
      type: "run_started",
    });
  }

  if (event.type === "run_finished") {
    if (event.finalMessage !== undefined && state.finalOutputText === null) {
      state.finalOutputText = event.finalMessage;
    }
    if (event.status === "completed") {
      classifyFinalOutput({ emit, protocol, state });
    }
    state.completedAtMs = event.timestampMs;
    state.stopReason = stopReasonFromRunFinishedStatus(event.status);
    emit({
      ...eventBase(state, event.timestampMs),
      providerEvent: event,
      type: "provider_event",
    });
    emit({
      ...eventBase(state, event.timestampMs),
      elapsedMs: event.elapsedMs,
      finalMessage: event.finalMessage,
      providerEvent: event,
      status: event.status,
      type: "run_finished",
    });
    return;
  }

  if (event.type === "error") {
    state.completedAtMs = event.timestampMs;
    state.stopReason = "provider_error";
    emit({
      ...eventBase(state, event.timestampMs),
      errorMessage: event.errorMessage,
      providerEvent: event,
      type: "provider_error",
    });
  } else if (event.type === "cancelled") {
    state.completedAtMs = event.timestampMs;
    state.stopReason = "cancelled";
    emit({
      ...eventBase(state, event.timestampMs),
      message: event.message,
      providerEvent: event,
      type: "cancelled",
    });
  } else if (event.type === "stopped") {
    state.completedAtMs = event.timestampMs;
    state.stopReason = "stopped";
    emit({
      ...eventBase(state, event.timestampMs),
      message: event.message,
      providerEvent: event,
      type: "stopped",
    });
  }

  emit({
    ...eventBase(state, event.timestampMs),
    providerEvent: event,
    type: "provider_event",
  });
}

function classifyFinalOutput({
  emit,
  protocol,
  state,
}: {
  emit: (event: AgentRuntimeEvent) => void;
  protocol?: AgentRuntimeProtocolOptions;
  state: AgentRuntimeMutableState;
}) {
  if (protocol?.classifyFinalOutput === false || state.finalOutputText === null) {
    return;
  }

  const protocolResult = classifyAgentProtocolRuntimeOutput({
    finalAnswerMarkerRequired: protocol?.finalAnswerMarkerRequired,
    mode: protocol?.mode ?? "normal",
    text: state.finalOutputText,
  });
  state.protocolResult = protocolResult;
  emit({
    ...eventBase(state),
    protocolResult,
    text: state.finalOutputText,
    type: "protocol_output_classified",
  });

  if (protocolResult.kind === "final_answer") {
    emit({
      ...eventBase(state),
      finalAnswer: protocolResult.finalAnswer,
      protocolResult,
      type: "final_answer",
    });
    return;
  }

  if (protocolResult.kind === "action_request") {
    emit({
      ...eventBase(state),
      protocolResult,
      type: "action_request",
    });
    return;
  }

  if (protocolResult.kind === "workflow_request") {
    emit({
      ...eventBase(state),
      protocolResult,
      type: "workflow_request",
    });
    return;
  }

  emit({
    ...eventBase(state),
    protocolResult,
    type: "invalid_protocol_output",
  });
}

async function cancelRuntimeRun(
  provider: AgentProvider,
  request: AgentProviderTurnRequest,
  state: AgentRuntimeMutableState,
): Promise<AgentProviderCancelResult> {
  const runId = state.providerRunHandle?.runId ?? state.runId;
  if (!provider.cancelRun) {
    return {
      message: `${provider.providerDisplayName} cancellation is unavailable.`,
      providerId: provider.providerId,
      runId,
      status: "not_supported",
    };
  }

  return provider.cancelRun(request.widgetInstanceId, runId);
}

function snapshotRuntimeResult(
  state: AgentRuntimeMutableState,
): AgentRuntimeResult {
  return {
    completedAtMs: state.completedAtMs,
    events: [...state.events],
    finalOutputText: state.finalOutputText,
    protocolResult: state.protocolResult,
    providerId: state.providerId,
    providerThreadId: state.providerThreadId,
    requestId: state.requestId,
    runHandle: state.providerRunHandle,
    runId: state.providerRunHandle?.runId ?? state.runId,
    startedAtMs: state.startedAtMs,
    stopReason: state.stopReason,
  };
}

function eventBase(
  state: AgentRuntimeMutableState,
  timestampMs = Date.now(),
): AgentRuntimeEventBase {
  return {
    providerId: state.providerId,
    providerThreadId: state.providerThreadId,
    requestId: state.requestId,
    runId: state.runId,
    timestampMs,
  };
}

function outputTextFromProviderEvent(event: AgentProviderEvent): string | null {
  switch (event.type) {
    case "action_request_detected":
    case "final_answer":
    case "message_delta":
    case "structured_output":
    case "text_delta":
    case "workflow_request_detected":
      return event.text;
    default:
      return null;
  }
}

function stopReasonFromRunFinishedStatus(
  status: Extract<AgentProviderEvent, { type: "run_finished" }>["status"],
): AgentRuntimeStopReason {
  if (status === "completed") {
    return "completed";
  }

  if (status === "cancelled") {
    return "cancelled";
  }

  return "provider_failed";
}
