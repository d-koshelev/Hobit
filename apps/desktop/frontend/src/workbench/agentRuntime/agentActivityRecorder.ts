import type { DirectWorkStreamEvent } from "../../workspace/types";
import type {
  HobitAgentActionResult,
  HobitAgentWorkflowRequestEnvelopeReadResult,
} from "../agents/broker";
import type { QueueWorkflowRunnerRuntimeResult } from "../agents/modules";
import {
  agentActivityEventFromDirectWorkStreamEvent,
  type AgentActivityEvent,
  type AgentActivitySeverity,
  type AgentActivityStatus,
} from "../agentActivityModel";
import {
  directWorkEventText,
  type CoordinatorDirectWorkLogEntry,
  type CoordinatorDirectWorkStatus,
} from "../workspaceAgentDirectWorkModel";
import type { WorkspaceAgentRunMetadata } from "../workspaceAgentRunMetadata";
import {
  agentProtocolRuntimeErrorMessage,
  agentProtocolRuntimeRepairMessage,
  type AgentProtocolRuntimeResult,
} from "./agentProtocolRuntime";
import {
  activitySeverityForQueueWorkflowRuntimeResult,
  activitySeverityForHobitActionResult,
  activityStatusForQueueWorkflowRuntimeResult,
  activityStatusForHobitActionResult,
  workspaceAgentQueueWorkflowRuntimeActivityTitle,
  workspaceAgentQueueWorkflowRuntimeResultMessage,
  workspaceAgentHobitActionActivityTitle,
  workspaceAgentInvalidActionRequestMessage,
  workspaceAgentInvalidWorkflowRequestMessage,
  workspaceAgentWorkflowRequestMessage,
} from "./agentActivityMessages";
import { hobitActionActivityEvent } from "./agentActivityEventFactory";
import {
  formatWorkspaceAgentBrokerActionTranscript,
  formatWorkspaceAgentBrokerPolicyDiagnosticSummary,
  stopReasonLabel,
  WORKSPACE_AGENT_BROKER_CONTINUATION_MAX_ACTIONS,
  type WorkspaceAgentBrokerContinuationStopReason,
  type WorkspaceAgentBrokerPolicyDiagnostics,
} from "../workspaceAgentBrokerContinuation";

export {
  activitySeverityForQueueWorkflowRuntimeResult,
  activitySeverityForHobitActionResult,
  activityStatusForQueueWorkflowRuntimeResult,
  activityStatusForHobitActionResult,
  workspaceAgentQueueWorkflowRuntimeActivityTitle,
  workspaceAgentQueueWorkflowRuntimeResultMessage,
  workspaceAgentHobitActionActivityTitle,
  workspaceAgentHobitActionResultMessage,
  workspaceAgentInvalidActionRequestMessage,
  workspaceAgentInvalidWorkflowRequestMessage,
  workspaceAgentWorkflowRequestMessage,
} from "./agentActivityMessages";

export type AgentActivityRecorderInput = {
  event: AgentActivityRecorderEvent;
  timestampMs: number;
  widgetInstanceId: string;
  workspaceId: string;
};

export type AgentActivityRecorderEvent =
  | {
      brokerContinuationChainId?: string | null;
      streamEvent: DirectWorkStreamEvent;
      type: "provider_stream_event";
    }
  | {
      finalAnswer: string;
      runMetadata: WorkspaceAgentRunMetadata;
      runId?: string | null;
      type: "provider_final_answer";
    }
  | {
      actionIndex: number;
      capabilityId: string;
      maxActions?: number;
      runId: string;
      type: "broker_action_requested";
    }
  | {
      actionIndex?: number;
      activityRunId: string;
      capabilityId?: string;
      maxActions?: number;
      message: string;
      policyDiagnostics?: WorkspaceAgentBrokerPolicyDiagnostics;
      result?: HobitAgentActionResult;
      runMetadata: WorkspaceAgentRunMetadata;
      severity?: AgentActivitySeverity;
      status?: AgentActivityStatus;
      stopReason?: WorkspaceAgentBrokerContinuationStopReason;
      title?: string;
      type: "broker_action_result";
    }
  | {
      message: string;
      runId: string;
      runMetadata: WorkspaceAgentRunMetadata;
      severity: AgentActivitySeverity;
      status: AgentActivityStatus;
      stopReason: WorkspaceAgentBrokerContinuationStopReason;
      type: "broker_continuation_stopped";
    }
  | {
      runId: string;
      runMetadata: WorkspaceAgentRunMetadata;
      type: "invalid_action_request";
      reasons: readonly string[];
      actionIndex?: number;
    }
  | {
      runId: string;
      runMetadata: WorkspaceAgentRunMetadata;
      type: "invalid_workflow_request" | "mixed_action_and_workflow_request";
      reasons: readonly string[];
      actionIndex?: number;
    }
  | {
      runId: string;
      runMetadata: WorkspaceAgentRunMetadata;
      type: "workflow_request_recognized";
      workflowRequestRead: Extract<
        HobitAgentWorkflowRequestEnvelopeReadResult,
        { status: "valid" }
      >;
    }
  | {
      runId: string;
      runMetadata: WorkspaceAgentRunMetadata;
      type: "queue_workflow_runtime_result";
      workflowRuntimeResult: QueueWorkflowRunnerRuntimeResult;
    }
  | {
      outcome: Extract<
        AgentProtocolRuntimeResult,
        { kind: "no_action_output" | "protocol_stall" }
      >;
      runId: string;
      runMetadata: WorkspaceAgentRunMetadata;
      type: "protocol_repair_required";
    }
  | {
      outcome: Extract<
        AgentProtocolRuntimeResult,
        { kind: "no_action_output" | "protocol_stall" }
      >;
      runId: string;
      runMetadata: WorkspaceAgentRunMetadata;
      type: "protocol_error";
    }
  | {
      message: string;
      runId: string;
      runMetadata?: WorkspaceAgentRunMetadata;
      type: "provider_error";
    }
  | {
      message: string;
      runId: string;
      runMetadata?: WorkspaceAgentRunMetadata;
      type: "provider_cancelled_or_stopped";
    };

export type TranscriptAppendIntent =
  | {
      body: string;
      kind: "assistant_action";
      runMetadata?: WorkspaceAgentRunMetadata;
    }
  | {
      body: string;
      kind: "assistant";
      runMetadata?: WorkspaceAgentRunMetadata;
      status: CoordinatorDirectWorkStatus;
      useDirectBody?: boolean;
    };

export type ActivityAppendIntent = AgentActivityEvent;

export type LogAppendIntent = {
  kind: CoordinatorDirectWorkLogEntry["kind"];
  text: string;
};

export type NoticeIntent =
  | {
      kind: "direct_work_error";
      value: string | null;
    }
  | {
      kind: "direct_work_final_result";
      value: string | null;
    };

export type AgentActivityRecorderResult = {
  activityAppends: ActivityAppendIntent[];
  logAppends: LogAppendIntent[];
  notices: NoticeIntent[];
  transcriptAppends: TranscriptAppendIntent[];
};

export function recordAgentActivity(
  input: AgentActivityRecorderInput,
): AgentActivityRecorderResult {
  switch (input.event.type) {
    case "provider_stream_event":
      return recordProviderStreamEvent({ ...input, event: input.event });
    case "provider_final_answer":
      return result({
        transcriptAppends: [
          {
            body: input.event.finalAnswer,
            kind: "assistant",
            runMetadata: input.event.runMetadata,
            status: "completed",
            useDirectBody: true,
          },
        ],
      });
    case "broker_action_requested":
      return recordBrokerActionRequested({ ...input, event: input.event });
    case "broker_action_result":
      return recordBrokerActionResult({ ...input, event: input.event });
    case "broker_continuation_stopped":
      return recordBrokerContinuationStopped({ ...input, event: input.event });
    case "invalid_action_request":
      return recordInvalidActionRequest({ ...input, event: input.event });
    case "invalid_workflow_request":
    case "mixed_action_and_workflow_request":
      return recordInvalidWorkflowRequest({ ...input, event: input.event });
    case "workflow_request_recognized":
      return recordWorkflowRequestRecognized({ ...input, event: input.event });
    case "queue_workflow_runtime_result":
      return recordQueueWorkflowRuntimeResult({ ...input, event: input.event });
    case "protocol_repair_required":
      return recordProtocolRepairRequired({ ...input, event: input.event });
    case "protocol_error":
      return recordProtocolError({ ...input, event: input.event });
    case "provider_error":
      return recordProviderError({ ...input, event: input.event });
    case "provider_cancelled_or_stopped":
      return recordProviderCancelledOrStopped({ ...input, event: input.event });
  }
}

function recordProviderStreamEvent({
  event,
  timestampMs,
}: AgentActivityRecorderInput & {
  event: Extract<AgentActivityRecorderEvent, { type: "provider_stream_event" }>;
}): AgentActivityRecorderResult {
  const activityEvent = agentActivityEventFromDirectWorkStreamEvent({
    event: event.streamEvent,
    receivedAtMs: timestampMs,
    sourceKind: "workspace-agent",
    sourceLabel: "Workspace Agent",
  });
  const activityAppends =
    activityEvent && event.brokerContinuationChainId
      ? [
          {
            ...activityEvent,
            id: `${activityEvent.id}:broker-chain:${event.brokerContinuationChainId}`,
            runId: event.brokerContinuationChainId,
            runKind: "workspace-agent-broker-continuation" as const,
          },
        ]
      : activityEvent
        ? [activityEvent]
        : [];

  return result({
    activityAppends,
    logAppends: [
      {
        kind: event.streamEvent.eventKind,
        text: directWorkEventText(event.streamEvent),
      },
    ],
  });
}

function recordBrokerActionRequested({
  event,
  timestampMs,
  widgetInstanceId,
  workspaceId,
}: AgentActivityRecorderInput & {
  event: Extract<
    AgentActivityRecorderEvent,
    { type: "broker_action_requested" }
  >;
}): AgentActivityRecorderResult {
  return result({
    activityAppends: [
      hobitActionActivityEvent({
        actionIndex: event.actionIndex,
        lifecycleStage: "step",
        runId: event.runId,
        severity: "info",
        status: "running",
        summary: `Action ${event.actionIndex.toString()}/${(
          event.maxActions ?? WORKSPACE_AGENT_BROKER_CONTINUATION_MAX_ACTIONS
        ).toString()}: ${event.capabilityId}`,
        title: "Hobit action requested",
        timestampMs,
        widgetInstanceId,
        workspaceId,
      }),
    ],
    logAppends: [{ kind: "local", text: "Hobit action requested." }],
    notices: [{ kind: "direct_work_final_result", value: "Hobit action requested." }],
  });
}

function recordBrokerActionResult({
  event,
  timestampMs,
  widgetInstanceId,
  workspaceId,
}: AgentActivityRecorderInput & {
  event: Extract<AgentActivityRecorderEvent, { type: "broker_action_result" }>;
}): AgentActivityRecorderResult {
  const messageWithDiagnostics =
    event.stopReason && event.policyDiagnostics
      ? [
          event.message,
          formatWorkspaceAgentBrokerPolicyDiagnosticSummary(
            event.policyDiagnostics,
          ),
        ].join(" ")
      : event.message;
  const transcriptMessage =
    event.actionIndex && event.capabilityId
      ? formatWorkspaceAgentBrokerActionTranscript({
          actionIndex: event.actionIndex,
          capabilityId: event.capabilityId,
          maxActions:
            event.maxActions ?? WORKSPACE_AGENT_BROKER_CONTINUATION_MAX_ACTIONS,
          stopReason: event.stopReason,
          summary: messageWithDiagnostics,
        })
      : messageWithDiagnostics;

  return result({
    activityAppends: [
      hobitActionActivityEvent({
        actionIndex: event.actionIndex,
        lifecycleStage: event.stopReason
          ? event.status === "failed"
            ? "failed"
            : "completed"
          : "step",
        runId: event.activityRunId,
        severity:
          event.severity ?? activitySeverityForHobitActionResult(event.result),
        status: event.status ?? activityStatusForHobitActionResult(event.result),
        summary: transcriptMessage,
        title:
          event.title ??
          workspaceAgentHobitActionActivityTitle(
            event.result?.status ?? "failed",
            event.result?.capabilityId,
            event.result?.dryRun ?? false,
          ),
        timestampMs,
        widgetInstanceId,
        workspaceId,
      }),
    ],
    logAppends: [{ kind: "local", text: transcriptMessage }],
    notices: [{ kind: "direct_work_final_result", value: transcriptMessage }],
    transcriptAppends: [
      {
        body: transcriptMessage,
        kind: "assistant_action",
        runMetadata: event.runMetadata,
      },
    ],
  });
}

function recordBrokerContinuationStopped({
  event,
  timestampMs,
  widgetInstanceId,
  workspaceId,
}: AgentActivityRecorderInput & {
  event: Extract<
    AgentActivityRecorderEvent,
    { type: "broker_continuation_stopped" }
  >;
}): AgentActivityRecorderResult {
  const stopMessage = `${event.message} Stopped: ${stopReasonLabel(
    event.stopReason,
  )}.`;

  return result({
    activityAppends: [
      hobitActionActivityEvent({
        lifecycleStage: event.status === "failed" ? "failed" : "completed",
        runId: event.runId,
        severity: event.severity,
        status: event.status,
        summary: stopMessage,
        title:
          event.status === "failed"
            ? "Broker action chain stopped"
            : "Broker action chain completed",
        timestampMs,
        widgetInstanceId,
        workspaceId,
      }),
    ],
    logAppends: [{ kind: "local", text: stopMessage }],
    notices: [{ kind: "direct_work_final_result", value: stopMessage }],
    transcriptAppends:
      event.stopReason === "final_prose"
        ? []
        : [
            {
              body: stopMessage,
              kind: "assistant_action",
              runMetadata: event.runMetadata,
            },
          ],
  });
}

function recordInvalidActionRequest({
  event,
  timestampMs,
  widgetInstanceId,
  workspaceId,
}: AgentActivityRecorderInput & {
  event: Extract<AgentActivityRecorderEvent, { type: "invalid_action_request" }>;
}): AgentActivityRecorderResult {
  const message = workspaceAgentInvalidActionRequestMessage(event.reasons);
  const recorded = recordAgentActivity({
    event: {
      actionIndex: event.actionIndex ?? 1,
      activityRunId: event.runId,
      capabilityId: "invalid",
      message,
      runMetadata: event.runMetadata,
      severity: "error",
      status: "failed",
      stopReason: "invalid_or_unsupported_envelope",
      title: "Invalid Hobit action request",
      type: "broker_action_result",
    },
    timestampMs,
    widgetInstanceId,
    workspaceId,
  });
  return {
    ...recorded,
    notices: [
      { kind: "direct_work_error", value: message },
      ...recorded.notices,
    ],
  };
}

function recordInvalidWorkflowRequest({
  event,
  timestampMs,
  widgetInstanceId,
  workspaceId,
}: AgentActivityRecorderInput & {
  event: Extract<
    AgentActivityRecorderEvent,
    { type: "invalid_workflow_request" | "mixed_action_and_workflow_request" }
  >;
}): AgentActivityRecorderResult {
  const message = workspaceAgentInvalidWorkflowRequestMessage(event.reasons);
  const recorded = recordAgentActivity({
    event: {
      actionIndex: event.actionIndex ?? 1,
      activityRunId: event.runId,
      capabilityId: "workflow",
      message,
      runMetadata: event.runMetadata,
      severity: "error",
      status: "failed",
      stopReason: "invalid_or_unsupported_envelope",
      title: "Invalid Hobit workflow request",
      type: "broker_action_result",
    },
    timestampMs,
    widgetInstanceId,
    workspaceId,
  });
  return {
    ...recorded,
    notices: [
      { kind: "direct_work_error", value: message },
      ...recorded.notices,
    ],
  };
}

function recordWorkflowRequestRecognized({
  event,
  timestampMs,
  widgetInstanceId,
  workspaceId,
}: AgentActivityRecorderInput & {
  event: Extract<
    AgentActivityRecorderEvent,
    { type: "workflow_request_recognized" }
  >;
}): AgentActivityRecorderResult {
  const message = workspaceAgentWorkflowRequestMessage(
    event.workflowRequestRead,
  );
  return result({
    activityAppends: [
      hobitActionActivityEvent({
        lifecycleStage: "completed",
        runId: event.runId,
        severity: "warning",
        status: "completed",
        summary: message,
        title: "Workflow request recognized",
        timestampMs,
        widgetInstanceId,
        workspaceId,
      }),
    ],
    logAppends: [{ kind: "local", text: message }],
    notices: [{ kind: "direct_work_final_result", value: message }],
    transcriptAppends: [
      {
        body: message,
        kind: "assistant_action",
        runMetadata: event.runMetadata,
      },
    ],
  });
}

function recordQueueWorkflowRuntimeResult({
  event,
  timestampMs,
  widgetInstanceId,
  workspaceId,
}: AgentActivityRecorderInput & {
  event: Extract<
    AgentActivityRecorderEvent,
    { type: "queue_workflow_runtime_result" }
  >;
}): AgentActivityRecorderResult {
  const message = workspaceAgentQueueWorkflowRuntimeResultMessage(
    event.workflowRuntimeResult,
  );
  const status = activityStatusForQueueWorkflowRuntimeResult(
    event.workflowRuntimeResult,
  );
  const severity = activitySeverityForQueueWorkflowRuntimeResult(
    event.workflowRuntimeResult,
  );
  return result({
    activityAppends: [
      hobitActionActivityEvent({
        lifecycleStage:
          status === "completed"
            ? "completed"
            : status === "failed"
              ? "failed"
              : "step",
        runId: event.runId,
        severity,
        status,
        summary: message,
        title: workspaceAgentQueueWorkflowRuntimeActivityTitle(
          event.workflowRuntimeResult.status,
        ),
        timestampMs,
        widgetInstanceId,
        workspaceId,
      }),
    ],
    logAppends: [{ kind: "local", text: message }],
    notices: [{ kind: "direct_work_final_result", value: message }],
    transcriptAppends: [
      {
        body: message,
        kind: "assistant_action",
        runMetadata: event.runMetadata,
      },
    ],
  });
}

function recordProtocolRepairRequired({
  event,
  timestampMs,
  widgetInstanceId,
  workspaceId,
}: AgentActivityRecorderInput & {
  event: Extract<
    AgentActivityRecorderEvent,
    { type: "protocol_repair_required" }
  >;
}): AgentActivityRecorderResult {
  const message = agentProtocolRuntimeRepairMessage(event.outcome);

  return result({
    activityAppends: [
      hobitActionActivityEvent({
        details:
          "Repair asks for exactly one structured hobit.action.request or one explicit hobit.final.answer. No capability is inferred from prose.",
        lifecycleStage: "step",
        rawPreview:
          event.outcome.kind === "protocol_stall"
            ? event.outcome.preview
            : undefined,
        runId: event.runId,
        severity: "warning",
        status: "running",
        summary: message,
        title: "Protocol repair requested",
        timestampMs,
        widgetInstanceId,
        workspaceId,
      }),
    ],
    logAppends: [{ kind: "local", text: message }],
    transcriptAppends: [
      {
        body: message,
        kind: "assistant_action",
        runMetadata: event.runMetadata,
      },
    ],
  });
}

function recordProtocolError({
  event,
  timestampMs,
  widgetInstanceId,
  workspaceId,
}: AgentActivityRecorderInput & {
  event: Extract<AgentActivityRecorderEvent, { type: "protocol_error" }>;
}): AgentActivityRecorderResult {
  const message = agentProtocolRuntimeErrorMessage(event.outcome);
  const recorded = recordAgentActivity({
    event: {
      message,
      runId: event.runId,
      runMetadata: {
        ...event.runMetadata,
        status: "failed",
      },
      severity: "error",
      status: "failed",
      stopReason: "protocol_error",
      type: "broker_continuation_stopped",
    },
    timestampMs,
    widgetInstanceId,
    workspaceId,
  });
  return {
    ...recorded,
    notices: [
      { kind: "direct_work_error", value: message },
      ...recorded.notices,
    ],
  };
}

function recordProviderError({
  event,
  timestampMs,
  widgetInstanceId,
  workspaceId,
}: AgentActivityRecorderInput & {
  event: Extract<AgentActivityRecorderEvent, { type: "provider_error" }>;
}): AgentActivityRecorderResult {
  return result({
    activityAppends: [
      hobitActionActivityEvent({
        lifecycleStage: "failed",
        runId: event.runId,
        severity: "error",
        status: "failed",
        summary: event.message,
        title: "Failed run",
        timestampMs,
        widgetInstanceId,
        workspaceId,
      }),
    ],
    logAppends: [{ kind: "local", text: event.message }],
    notices: [
      { kind: "direct_work_error", value: event.message },
      { kind: "direct_work_final_result", value: event.message },
    ],
    transcriptAppends: event.runMetadata
      ? [
          {
            body: event.message,
            kind: "assistant",
            runMetadata: event.runMetadata,
            status: "failed",
          },
        ]
      : [],
  });
}

function recordProviderCancelledOrStopped({
  event,
  timestampMs,
  widgetInstanceId,
  workspaceId,
}: AgentActivityRecorderInput & {
  event: Extract<
    AgentActivityRecorderEvent,
    { type: "provider_cancelled_or_stopped" }
  >;
}): AgentActivityRecorderResult {
  return result({
    activityAppends: [
      hobitActionActivityEvent({
        lifecycleStage: "cancelled",
        runId: event.runId,
        severity: "warning",
        status: "cancelled",
        summary: event.message,
        title: "Cancelled run",
        timestampMs,
        widgetInstanceId,
        workspaceId,
      }),
    ],
    logAppends: [{ kind: "local", text: event.message }],
    notices: [{ kind: "direct_work_final_result", value: event.message }],
    transcriptAppends: event.runMetadata
      ? [
          {
            body: event.message,
            kind: "assistant",
            runMetadata: event.runMetadata,
            status: "cancelled",
          },
        ]
      : [],
  });
}

function result(
  patch: Partial<AgentActivityRecorderResult> = {},
): AgentActivityRecorderResult {
  return {
    activityAppends: [],
    logAppends: [],
    notices: [],
    transcriptAppends: [],
    ...patch,
  };
}
