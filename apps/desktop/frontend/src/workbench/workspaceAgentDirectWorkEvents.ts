import type {
  DirectWorkStreamEvent,
  DirectWorkStreamEventKind,
} from "../workspace/types";
import { shortCodexThreadId } from "./workspaceAgentDirectWorkThreads";

export type CoordinatorDirectWorkStatus =
  | "idle"
  | "running"
  | "completed"
  | "failed"
  | "cancelled";

export type CoordinatorDirectWorkLogEntry = {
  id: string;
  kind: DirectWorkStreamEventKind | "local";
  text: string;
};

export function coordinatorDirectWorkStatusFromEvent(
  event: DirectWorkStreamEvent,
): CoordinatorDirectWorkStatus {
  const status = event.finalStatus ?? event.status ?? event.eventKind;

  if (status === "completed") {
    return "completed";
  }

  if (status === "cancelled") {
    return "cancelled";
  }

  return "failed";
}

export function directWorkEventText(event: DirectWorkStreamEvent): string {
  if (event.eventKind === "started") {
    return `Run ${event.runId} started.`;
  }

  if (event.codexThreadId) {
    return `Codex thread active: ${shortCodexThreadId(event.codexThreadId)}.`;
  }

  if (event.eventKind === "final_message") {
    return "Final response received.";
  }

  if (event.isFinal) {
    return `Run ended with ${event.finalStatus ?? event.status ?? event.eventKind}.`;
  }

  return (
    event.text ??
    event.line ??
    event.parsedCodexEventType ??
    event.eventKind.replace(/_/g, " ")
  );
}

export function codexAgentMessageFromEvent(
  event: DirectWorkStreamEvent,
): string | null {
  if (event.eventKind !== "codex_json_event") {
    return null;
  }

  if (
    event.text?.trim() &&
    (event.parsedCodexEventType === "agent_message" ||
      event.parsedCodexEventType === "item.completed")
  ) {
    return event.text.trim();
  }

  if (!event.line?.trim()) {
    return null;
  }

  try {
    const value = JSON.parse(event.line) as unknown;
    return codexAgentMessageFromJson(value);
  } catch {
    return null;
  }
}

function codexAgentMessageFromJson(value: unknown): string | null {
  if (!isRecord(value)) {
    return null;
  }

  if (value.type === "agent_message") {
    return stringFromUnknown(value.text) ?? stringFromUnknown(value.message);
  }

  if (value.type !== "item.completed" || !isRecord(value.item)) {
    return null;
  }

  if (value.item.type !== "agent_message") {
    return null;
  }

  return (
    stringFromUnknown(value.item.text) ??
    stringFromUnknown(value.item.message) ??
    stringFromUnknown(value.item.content) ??
    textFromCodexContentArray(value.item.content)
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function stringFromUnknown(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function textFromCodexContentArray(value: unknown): string | null {
  if (!Array.isArray(value)) {
    return null;
  }

  const text = value
    .map((entry) =>
      isRecord(entry)
        ? stringFromUnknown(entry.text) ?? stringFromUnknown(entry.content)
        : stringFromUnknown(entry),
    )
    .filter((entry): entry is string => Boolean(entry))
    .join("\n")
    .trim();

  return text || null;
}
