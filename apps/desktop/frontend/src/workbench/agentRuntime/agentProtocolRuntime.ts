import type {
  HobitAgentActionRequestEnvelopeReadResult,
  HobitAgentWorkflowRequestEnvelopeIssue,
  HobitAgentWorkflowRequestEnvelopeReadResult,
} from "../agents/broker";
import {
  classifyWorkspaceAgentActionProtocolOutput,
  formatWorkspaceAgentActionProtocolRepairPrompt,
  workspaceAgentActionProtocolErrorMessage,
  workspaceAgentActionProtocolRepairMessage,
  type WorkspaceAgentActionProtocolMode,
  type WorkspaceAgentActionProtocolOutcome,
} from "../workspaceAgentActionProtocol";

export type AgentProtocolRuntimeInput = {
  finalAnswerMarkerRequired?: boolean;
  mode: WorkspaceAgentActionProtocolMode;
  text: string;
};

export type AgentProtocolOutcomeKind =
  | "action_request"
  | "final_answer"
  | "invalid_action_request"
  | "invalid_workflow_request"
  | "mixed_action_and_workflow_request"
  | "no_action_output"
  | "protocol_stall"
  | "workflow_request";

export type AgentProtocolValidationError = {
  fieldPath?: string;
  message: string;
  reasonCode: string;
  source: "action_request" | "protocol" | "workflow_request";
};

export type AgentProtocolRepairInstruction = {
  message: string;
  prompt: string;
  required: true;
};

export type AgentProtocolRuntimeResult =
  | {
      errors: [];
      finalAnswer: string;
      kind: "final_answer";
      rawPreview: string;
    }
  | {
      actionRequest: Extract<
        HobitAgentActionRequestEnvelopeReadResult,
        { status: "valid" }
      >["envelope"];
      actionRequestRead: Extract<
        HobitAgentActionRequestEnvelopeReadResult,
        { status: "valid" }
      >;
      errors: [];
      kind: "action_request";
      rawPreview: string;
    }
  | {
      errors: [];
      kind: "workflow_request";
      rawPreview: string;
      workflowRequest: Extract<
        HobitAgentWorkflowRequestEnvelopeReadResult,
        { status: "valid" }
      >["envelope"];
      workflowRequestRead: Extract<
        HobitAgentWorkflowRequestEnvelopeReadResult,
        { status: "valid" }
      >;
    }
  | {
      actionRequestRead: Extract<
        HobitAgentActionRequestEnvelopeReadResult,
        { status: "invalid" }
      >;
      errors: AgentProtocolValidationError[];
      kind: "invalid_action_request";
      rawPreview: string;
    }
  | {
      errors: AgentProtocolValidationError[];
      kind: "invalid_workflow_request";
      rawPreview: string;
      workflowRequestRead: Extract<
        HobitAgentWorkflowRequestEnvelopeReadResult,
        { status: "invalid" }
      >;
    }
  | {
      errors: AgentProtocolValidationError[];
      kind: "mixed_action_and_workflow_request";
      rawPreview: string;
      workflowRequestRead: Extract<
        HobitAgentWorkflowRequestEnvelopeReadResult,
        { status: "invalid" }
      >;
    }
  | {
      errors: AgentProtocolValidationError[];
      kind: "protocol_stall";
      preview: string;
      rawPreview: string;
      repairInstruction: AgentProtocolRepairInstruction;
    }
  | {
      errors: AgentProtocolValidationError[];
      kind: "no_action_output";
      rawPreview: string;
      repairInstruction: AgentProtocolRepairInstruction;
    };

const RAW_PREVIEW_LIMIT = 240;

export function classifyAgentProtocolRuntimeOutput(
  input: AgentProtocolRuntimeInput,
): AgentProtocolRuntimeResult {
  const mode = input.finalAnswerMarkerRequired
    ? "typed_capability_action"
    : input.mode;
  const outcome = classifyWorkspaceAgentActionProtocolOutput({
    mode,
    text: input.text,
  });
  const rawPreview = boundText(input.text.trim(), RAW_PREVIEW_LIMIT);

  switch (outcome.kind) {
    case "final_answer":
      return {
        errors: [],
        finalAnswer: outcome.finalAnswer,
        kind: "final_answer",
        rawPreview,
      };
    case "structured_action_request":
      return {
        actionRequest: outcome.envelopeRead.envelope,
        actionRequestRead: outcome.envelopeRead,
        errors: [],
        kind: "action_request",
        rawPreview,
      };
    case "workflow_request":
      return {
        errors: [],
        kind: "workflow_request",
        rawPreview,
        workflowRequest: outcome.workflowRead.envelope,
        workflowRequestRead: outcome.workflowRead,
      };
    case "invalid_action_request":
      return {
        actionRequestRead: outcome.envelopeRead,
        errors: actionRequestErrors(outcome.envelopeRead.reasons),
        kind: "invalid_action_request",
        rawPreview,
      };
    case "invalid_workflow_request":
      return {
        errors: workflowRequestErrors(outcome.workflowRead.issues),
        kind: workflowReadIsMixedRequest(outcome.workflowRead)
          ? "mixed_action_and_workflow_request"
          : "invalid_workflow_request",
        rawPreview,
        workflowRequestRead: outcome.workflowRead,
      };
    case "protocol_stall":
      return {
        errors: [
          {
            message:
              "The model produced non-action prose while typed-capability action mode was active.",
            reasonCode: "protocol_stall",
            source: "protocol",
          },
        ],
        kind: "protocol_stall",
        preview: outcome.preview,
        rawPreview,
        repairInstruction: repairInstructionForOutcome(outcome),
      };
    case "no_action_output":
      return {
        errors: [
          {
            message: "The model produced no usable action output.",
            reasonCode: "no_action_output",
            source: "protocol",
          },
        ],
        kind: "no_action_output",
        rawPreview,
        repairInstruction: repairInstructionForOutcome(outcome),
      };
  }
}

export function formatAgentProtocolRuntimeRepairPrompt(): string {
  return formatWorkspaceAgentActionProtocolRepairPrompt();
}

export function agentProtocolRuntimeRepairMessage(
  result: Extract<
    AgentProtocolRuntimeResult,
    { kind: "no_action_output" | "protocol_stall" }
  >,
): string {
  return workspaceAgentActionProtocolRepairMessage(
    workspaceOutcomeFromRuntimeResult(result),
  );
}

export function agentProtocolRuntimeErrorMessage(
  result: Extract<
    AgentProtocolRuntimeResult,
    { kind: "no_action_output" | "protocol_stall" }
  >,
): string {
  return workspaceAgentActionProtocolErrorMessage(
    workspaceOutcomeFromRuntimeResult(result),
  );
}

function repairInstructionForOutcome(
  outcome: Extract<
    WorkspaceAgentActionProtocolOutcome,
    { kind: "no_action_output" | "protocol_stall" }
  >,
): AgentProtocolRepairInstruction {
  return {
    message: workspaceAgentActionProtocolRepairMessage(outcome),
    prompt: formatWorkspaceAgentActionProtocolRepairPrompt(),
    required: true,
  };
}

function workspaceOutcomeFromRuntimeResult(
  result: Extract<
    AgentProtocolRuntimeResult,
    { kind: "no_action_output" | "protocol_stall" }
  >,
): Extract<
  WorkspaceAgentActionProtocolOutcome,
  { kind: "no_action_output" | "protocol_stall" }
> {
  if (result.kind === "protocol_stall") {
    return {
      kind: "protocol_stall",
      preview: result.preview,
    };
  }

  return { kind: "no_action_output" };
}

function actionRequestErrors(
  reasons: readonly string[],
): AgentProtocolValidationError[] {
  return reasons.map((message) => ({
    message,
    reasonCode: "invalid_action_request",
    source: "action_request",
  }));
}

function workflowRequestErrors(
  issues: readonly HobitAgentWorkflowRequestEnvelopeIssue[],
): AgentProtocolValidationError[] {
  return issues.map((issue) => ({
    fieldPath: issue.fieldPath,
    message: issue.message,
    reasonCode: issue.code,
    source: "workflow_request",
  }));
}

function workflowReadIsMixedRequest(
  workflowRead: Extract<
    HobitAgentWorkflowRequestEnvelopeReadResult,
    { status: "invalid" }
  >,
) {
  return workflowRead.issues.some(
    (issue) => issue.code === "envelope_mixed_request_types",
  );
}

function boundText(value: string, limit: number) {
  if (value.length <= limit) {
    return value;
  }

  return `${value.slice(0, Math.max(0, limit - 3))}...`;
}
