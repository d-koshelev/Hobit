import {
  readHobitAgentActionRequestEnvelope,
  type HobitAgentActionRequestEnvelopeReadResult,
} from "./agents/broker";

export const HOBIT_AGENT_FINAL_ANSWER_ENVELOPE_TYPE =
  "hobit.final.answer" as const;

export type HobitAgentFinalAnswerEnvelope = {
  message: string;
  type: typeof HOBIT_AGENT_FINAL_ANSWER_ENVELOPE_TYPE;
};

export type HobitAgentFinalAnswerEnvelopeReadResult =
  | {
      envelope: HobitAgentFinalAnswerEnvelope;
      message: string;
      status: "valid";
    }
  | {
      reasons: string[];
      status: "invalid";
    }
  | {
      status: "none";
    };

export type WorkspaceAgentActionProtocolMode =
  | "normal"
  | "typed_capability_action";

export type WorkspaceAgentActionProtocolOutcome =
  | {
      envelopeRead: Extract<
        HobitAgentActionRequestEnvelopeReadResult,
        { status: "valid" }
      >;
      kind: "structured_action_request";
    }
  | {
      envelopeRead: Extract<
        HobitAgentActionRequestEnvelopeReadResult,
        { status: "invalid" }
      >;
      kind: "invalid_action_request";
    }
  | {
      finalAnswer: string;
      kind: "final_answer";
    }
  | {
      kind: "protocol_stall";
      preview: string;
    }
  | {
      kind: "no_action_output";
    };

const REPAIR_PROMPT_LIMIT = 1600;
const PREVIEW_LIMIT = 240;

export function classifyWorkspaceAgentActionProtocolOutput({
  mode,
  text,
}: {
  mode: WorkspaceAgentActionProtocolMode;
  text: string;
}): WorkspaceAgentActionProtocolOutcome {
  const envelopeRead = readHobitAgentActionRequestEnvelope(text);
  if (envelopeRead.status === "valid") {
    return {
      envelopeRead,
      kind: "structured_action_request",
    };
  }

  if (envelopeRead.status === "invalid") {
    return {
      envelopeRead,
      kind: "invalid_action_request",
    };
  }

  const finalAnswerRead = readHobitAgentFinalAnswerEnvelope(text);
  if (finalAnswerRead.status === "valid") {
    return {
      finalAnswer: finalAnswerRead.message,
      kind: "final_answer",
    };
  }

  const trimmed = text.trim();
  if (!trimmed) {
    return { kind: "no_action_output" };
  }

  if (mode === "typed_capability_action") {
    return {
      kind: "protocol_stall",
      preview: boundText(trimmed, PREVIEW_LIMIT),
    };
  }

  return {
    finalAnswer: trimmed,
    kind: "final_answer",
  };
}

export function readHobitAgentFinalAnswerEnvelope(
  text: string,
): HobitAgentFinalAnswerEnvelopeReadResult {
  const trimmed = text.trim();
  if (!looksLikeJsonObject(trimmed)) {
    return { status: "none" };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed) as unknown;
  } catch {
    return trimmed.includes(HOBIT_AGENT_FINAL_ANSWER_ENVELOPE_TYPE)
      ? {
          reasons: ["Final answer JSON is invalid."],
          status: "invalid",
        }
      : { status: "none" };
  }

  if (!isRecord(parsed)) {
    return { status: "none" };
  }

  if (parsed.type !== HOBIT_AGENT_FINAL_ANSWER_ENVELOPE_TYPE) {
    return { status: "none" };
  }

  const message = typeof parsed.message === "string" ? parsed.message.trim() : "";
  if (!message) {
    return {
      reasons: ["Final answer message is required."],
      status: "invalid",
    };
  }

  return {
    envelope: {
      message,
      type: HOBIT_AGENT_FINAL_ANSWER_ENVELOPE_TYPE,
    },
    message,
    status: "valid",
  };
}

export function formatWorkspaceAgentActionProtocolRepairPrompt(): string {
  return boundText(
    [
      "[Hobit action protocol repair]",
      "The previous assistant turn did not emit a valid structured Hobit action request or explicit final answer.",
      "No broker action was executed from that turn.",
      "Emit exactly one JSON object now:",
      '{"type":"hobit.action.request","requestId":"fresh-unique-id","capabilityId":"<id>","dryRun":false,"input":{}}',
      "or",
      '{"type":"hobit.final.answer","message":"<final user-facing answer or blocker>"}',
      "Do not write awaiting capability result. Awaiting result prose is not a capability call.",
      "Do not emit action lists. Do not infer taskId, runId, executorWidgetId, or capability id from prose.",
      "Do not use shell, Git, validation, rollback, Terminal, or hidden execution.",
    ].join("\n"),
    REPAIR_PROMPT_LIMIT,
  );
}

export function workspaceAgentActionProtocolRepairMessage(
  outcome: WorkspaceAgentActionProtocolOutcome,
): string {
  return [
    "Workspace Agent action protocol repair requested.",
    actionProtocolOutcomeSummary(outcome),
    "No broker action was executed.",
  ].join(" ");
}

export function workspaceAgentActionProtocolErrorMessage(
  outcome: WorkspaceAgentActionProtocolOutcome,
): string {
  return [
    "Workspace Agent action protocol error.",
    actionProtocolOutcomeSummary(outcome),
    "No broker action was executed.",
  ].join(" ");
}

function actionProtocolOutcomeSummary(
  outcome: WorkspaceAgentActionProtocolOutcome,
) {
  if (outcome.kind === "no_action_output") {
    return "The model produced no usable action output.";
  }

  if (outcome.kind === "protocol_stall") {
    return "The model produced non-action prose while typed-capability action mode was active.";
  }

  if (outcome.kind === "invalid_action_request") {
    return "The model produced an invalid Hobit action request.";
  }

  if (outcome.kind === "structured_action_request") {
    return "The model produced a valid Hobit action request.";
  }

  return "The model produced an explicit final answer.";
}

function boundText(value: string, limit: number) {
  if (value.length <= limit) {
    return value;
  }

  return `${value.slice(0, Math.max(0, limit - 3))}...`;
}

function looksLikeJsonObject(text: string) {
  return text.startsWith("{") && text.endsWith("}");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
