import type {
  HobitAgentActionRequest,
  HobitAgentActionResult,
  HobitAgentBrokerResult,
} from "../agents/broker/types";
import { createHobitAgentActionRequestFromEnvelope } from "../agents/broker/hobitAgentActionRequestEnvelope";
import type { AgentProtocolRuntimeResult } from "./agentProtocolRuntime";
import { formatAgentProtocolRuntimeRepairPrompt } from "./agentProtocolRuntime";
import {
  applyWorkspaceAgentQueueAutonomyGrantToActionRequest,
  createWorkspaceAgentBrokerActionResultContext,
  createWorkspaceAgentBrokerContinuationState,
  decideWorkspaceAgentBrokerActionContinuation,
  deriveWorkspaceAgentBrokerContinuationRequestId,
  evaluateWorkspaceAgentBrokerContinuationAttempt,
  formatWorkspaceAgentBrokerContinuationPrompt,
  prepareWorkspaceAgentBrokerContinuationStateForResult,
  recordWorkspaceAgentBrokerContinuationAttempt,
  recordWorkspaceAgentBrokerContinuationProtocolRepair,
  stopReasonLabel,
  type WorkspaceAgentBrokerContinuationResultContext,
  type WorkspaceAgentBrokerContinuationState,
  type WorkspaceAgentBrokerContinuationStopReason,
  type WorkspaceAgentBrokerPolicyDiagnostics,
} from "../workspaceAgentBrokerContinuation";

export type BrokerContinuationStopReason =
  WorkspaceAgentBrokerContinuationStopReason;

export type BrokerContinuationRuntimeInput =
  | {
      activeChainId?: string | null;
      agentId: string;
      continuationThreadId?: string | null;
      createdAt: string;
      derivedChainId: string;
      kind: "provider_protocol_result";
      protocolOutcome: AgentProtocolRuntimeResult;
      state: WorkspaceAgentBrokerContinuationState | null;
    }
  | {
      actionIndex: number;
      brokerResult: HobitAgentBrokerResult;
      confirmationInjected: boolean;
      continuationThreadId?: string | null;
      kind: "broker_action_result";
      message: string;
      request: HobitAgentActionRequest;
      state: WorkspaceAgentBrokerContinuationState | null;
    };

export type BrokerContinuationTurnIntent = {
  actionIndex?: number;
  chainId: string;
  prompt: string;
  resumeThreadId: string;
  turnKind: "continuation" | "protocol_repair";
};

export type BrokerActionInvocationIntent = {
  actionIndex: number;
  chainId: string;
  confirmationInjected: boolean;
  request: HobitAgentActionRequest;
};

export type BrokerContinuationRuntimeEffect =
  | {
      chainId: string | null;
      completionKind: "final_answer";
      finalAnswer: string;
      stopReason: "final_prose" | null;
      type: "complete";
    }
  | {
      chainId: string | null;
      completionKind: "workflow_request";
      protocolOutcome: Extract<AgentProtocolRuntimeResult, { kind: "workflow_request" }>;
      type: "complete";
    }
  | {
      actionIndex?: number;
      capabilityId?: string;
      chainId: string;
      logMessage?: string;
      message?: string;
      protocolOutcome?: Extract<
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
      stopReason: BrokerContinuationStopReason;
      title?: string;
      type: "stop";
    }
  | {
      actionIndex: number;
      activityRunId: string;
      capabilityId: string;
      message: string;
      policyDiagnostics?: WorkspaceAgentBrokerPolicyDiagnostics;
      result?: HobitAgentActionResult;
      stopReason?: BrokerContinuationStopReason;
      type: "record_broker_action_result";
    }
  | {
      message: string;
      type: "queue_structured_confirmation_injected";
    }
  | {
      intent: BrokerActionInvocationIntent;
      state: WorkspaceAgentBrokerContinuationState;
      type: "invoke_next_action";
    }
  | {
      intent: BrokerContinuationTurnIntent;
      outcome: Extract<
        AgentProtocolRuntimeResult,
        { kind: "no_action_output" | "protocol_stall" }
      >;
      state: WorkspaceAgentBrokerContinuationState;
      type: "request_repair_turn";
    }
  | {
      intent: BrokerContinuationTurnIntent;
      resultContext: WorkspaceAgentBrokerContinuationResultContext;
      state: WorkspaceAgentBrokerContinuationState;
      type: "request_continuation_turn";
    };

export type BrokerContinuationRuntimeResult = {
  effects: BrokerContinuationRuntimeEffect[];
  handled: boolean;
  nextState: WorkspaceAgentBrokerContinuationState | null;
};

export function runBrokerContinuationRuntime(
  input: BrokerContinuationRuntimeInput,
): BrokerContinuationRuntimeResult {
  return input.kind === "provider_protocol_result"
    ? runProviderProtocolResult(input)
    : runBrokerActionResult(input);
}

function runProviderProtocolResult(
  input: Extract<
    BrokerContinuationRuntimeInput,
    { kind: "provider_protocol_result" }
  >,
): BrokerContinuationRuntimeResult {
  const outcome = input.protocolOutcome;

  if (outcome.kind === "final_answer") {
    return {
      effects: [
        {
          chainId: input.activeChainId ?? input.state?.chainId ?? null,
          completionKind: "final_answer",
          finalAnswer: outcome.finalAnswer,
          stopReason: input.activeChainId ? "final_prose" : null,
          type: "complete",
        },
      ],
      handled: true,
      nextState: null,
    };
  }

  if (outcome.kind === "protocol_stall" || outcome.kind === "no_action_output") {
    return runProtocolStallResult(input, outcome);
  }

  if (outcome.kind === "workflow_request") {
    return {
      effects: [
        {
          chainId: input.state?.chainId ?? input.activeChainId ?? null,
          completionKind: "workflow_request",
          protocolOutcome: outcome,
          type: "complete",
        },
      ],
      handled: true,
      nextState: null,
    };
  }

  if (
    outcome.kind === "invalid_workflow_request" ||
    outcome.kind === "mixed_action_and_workflow_request" ||
    outcome.kind === "invalid_action_request"
  ) {
    const state = input.state;
    return {
      effects: [
        {
          actionIndex: state ? state.actionCount + 1 : 1,
          chainId: state?.chainId ?? input.activeChainId ?? input.derivedChainId,
          protocolOutcome: outcome,
          stopReason: "invalid_or_unsupported_envelope",
          type: "stop",
        },
      ],
      handled: true,
      nextState: null,
    };
  }

  return runActionRequestResult(input, outcome);
}

function runProtocolStallResult(
  input: Extract<
    BrokerContinuationRuntimeInput,
    { kind: "provider_protocol_result" }
  >,
  outcome: Extract<
    AgentProtocolRuntimeResult,
    { kind: "no_action_output" | "protocol_stall" }
  >,
): BrokerContinuationRuntimeResult {
  const state = input.state;
  if (!state) {
    return {
      effects: [],
      handled: false,
      nextState: null,
    };
  }

  const continuationThreadId = input.continuationThreadId?.trim() || null;
  if (!state.protocolRepairAttempted && continuationThreadId) {
    const repairState = recordWorkspaceAgentBrokerContinuationProtocolRepair(state);
    return {
      effects: [
        {
          intent: {
            chainId: repairState.chainId,
            prompt: formatAgentProtocolRuntimeRepairPrompt(),
            resumeThreadId: continuationThreadId,
            turnKind: "protocol_repair",
          },
          outcome,
          state: repairState,
          type: "request_repair_turn",
        },
      ],
      handled: true,
      nextState: repairState,
    };
  }

  return {
    effects: [
      {
        chainId: state.chainId,
        logMessage: continuationThreadId
          ? "Protocol repair was already attempted once."
          : "Protocol repair unavailable because the Codex thread id is unavailable.",
        protocolOutcome: outcome,
        stopReason: "protocol_error",
        type: "stop",
      },
    ],
    handled: true,
    nextState: null,
  };
}

function runActionRequestResult(
  input: Extract<
    BrokerContinuationRuntimeInput,
    { kind: "provider_protocol_result" }
  >,
  outcome: Extract<AgentProtocolRuntimeResult, { kind: "action_request" }>,
): BrokerContinuationRuntimeResult {
  const state =
    input.state ??
    createWorkspaceAgentBrokerContinuationState({
      chainId: input.derivedChainId,
    });
  const actionIndex = state.actionCount + 1;
  const envelopeRead = outcome.actionRequestRead;
  const baseActionRequest = createHobitAgentActionRequestFromEnvelope({
    agentId: input.agentId,
    createdAt: input.createdAt,
    derivedRequestId:
      envelopeRead.requestIdSource === "explicit"
        ? null
        : deriveWorkspaceAgentBrokerContinuationRequestId({
            actionIndex,
            capabilityId: envelopeRead.envelope.capabilityId,
            chainId: state.chainId,
          }),
    envelope: envelopeRead.envelope,
  });
  const autonomyApplied =
    applyWorkspaceAgentQueueAutonomyGrantToActionRequest(
      state,
      baseActionRequest,
    );
  const actionRequest = autonomyApplied.request;
  const effects: BrokerContinuationRuntimeEffect[] =
    autonomyApplied.confirmationInjected
      ? [
          {
            message:
              "Structured Queue autonomy grant supplied exact confirmation for the typed nextAction.",
            type: "queue_structured_confirmation_injected",
          },
        ]
      : [];
  const attempt = evaluateWorkspaceAgentBrokerContinuationAttempt(
    state,
    actionRequest,
  );

  if (!attempt.ok) {
    effects.push({
      actionIndex: attempt.actionIndex,
      capabilityId: actionRequest.capabilityId,
      chainId: state.chainId,
      message: `Broker action continuation stopped. ${stopReasonLabel(
        attempt.stopReason,
      )}.`,
      stopReason: attempt.stopReason,
      title: "Broker action continuation stopped",
      type: "stop",
    });
    return {
      effects,
      handled: true,
      nextState: null,
    };
  }

  const nextState = recordWorkspaceAgentBrokerContinuationAttempt(
    state,
    actionRequest,
    attempt.fingerprint,
  );
  effects.push({
    intent: {
      actionIndex: attempt.actionIndex,
      chainId: nextState.chainId,
      confirmationInjected: autonomyApplied.confirmationInjected,
      request: actionRequest,
    },
    state: nextState,
    type: "invoke_next_action",
  });

  return {
    effects,
    handled: true,
    nextState,
  };
}

function runBrokerActionResult(
  input: Extract<BrokerContinuationRuntimeInput, { kind: "broker_action_result" }>,
): BrokerContinuationRuntimeResult {
  const state = input.state;
  const continuationDecision = state
    ? decideWorkspaceAgentBrokerActionContinuation({
        capability: input.brokerResult.policyDecision.capability,
        confirmationInjected: input.confirmationInjected,
        request: input.request,
        result: input.brokerResult.result,
        state,
      })
    : {
        diagnostics: null,
        shouldContinue: false as const,
        stopReason: "thread_unavailable" as const,
      };
  const continuationThreadId =
    continuationDecision.shouldContinue && state
      ? input.continuationThreadId?.trim() || null
      : null;
  const stopReason = continuationDecision.shouldContinue
    ? continuationThreadId
      ? undefined
      : "thread_unavailable"
    : continuationDecision.stopReason;
  const effects: BrokerContinuationRuntimeEffect[] = [
    {
      actionIndex: input.actionIndex,
      activityRunId: state?.chainId ?? input.request.requestId,
      capabilityId: input.request.capabilityId,
      message: input.message,
      policyDiagnostics: continuationDecision.diagnostics ?? undefined,
      result: input.brokerResult.result,
      stopReason,
      type: "record_broker_action_result",
    },
  ];

  if (!state) {
    return {
      effects,
      handled: true,
      nextState: null,
    };
  }

  const resultContext = createWorkspaceAgentBrokerActionResultContext({
    policyDiagnostics: continuationDecision.diagnostics ?? undefined,
    request: input.request,
    result: input.brokerResult.result,
    stopReason,
    summary: input.message,
  });

  if (!continuationDecision.shouldContinue || !continuationThreadId) {
    return {
      effects,
      handled: true,
      nextState: null,
    };
  }

  const continuationState = prepareWorkspaceAgentBrokerContinuationStateForResult({
    result: input.brokerResult.result,
    state,
  });
  effects.push({
    intent: {
      actionIndex: input.actionIndex,
      chainId: continuationState.chainId,
      prompt: formatWorkspaceAgentBrokerContinuationPrompt({
        actionIndex: input.actionIndex,
        context: resultContext,
        maxActions: continuationState.maxActions,
      }),
      resumeThreadId: continuationThreadId,
      turnKind: "continuation",
    },
    resultContext,
    state: continuationState,
    type: "request_continuation_turn",
  });

  return {
    effects,
    handled: true,
    nextState: continuationState,
  };
}
