import type { WorkflowInputs } from "../../broker/workflowGrantInputSplit";
import type {
  QueueWorkflowEvidenceReadRequest,
  QueueWorkflowRunnerRequest,
  QueueWorkflowSlotVariables,
  QueueWorkflowVariables,
} from "./queueWorkflowRunnerTypes";

export function buildVariables(request: QueueWorkflowRunnerRequest): QueueWorkflowVariables {
  const taskIdsBySlot = stringRecord(request.inputs?.taskIdsBySlot);
  const runIdsBySlot = stringRecord(request.inputs?.runIdsBySlot);
  const evidenceBundleIdsBySlot = stringRecord(
    request.inputs?.evidenceBundleIdsBySlot,
  );
  const messageIdsBySlot = stringRecord(request.inputs?.messageIdsBySlot);
  const slots = slotVariables({
    evidenceBundleIdsBySlot,
    inputs: request.inputs,
    messageIdsBySlot,
    runIdsBySlot,
    taskIdsBySlot,
  });

  return {
    evidenceBundleIdsBySlot,
    messageIdsBySlot,
    readSnapshots: {
      aggregatesByTaskId: {},
      evidenceByKey: {},
      lifecycleByTaskId: {},
    },
    requestId: request.requestId,
    runIdsBySlot,
    scopedEvidenceBundleIds: stringArray(request.grant?.scope?.evidenceBundleIds),
    scopedMessageIds: stringArray(request.grant?.scope?.messageIds),
    scopedRunIds: stringArray(request.grant?.scope?.runIds),
    scopedTaskIds: stringArray(request.grant?.scope?.taskIds),
    slots,
    taskIdsBySlot,
    workflowId: request.workflowId,
  };
}

function slotVariables({
  evidenceBundleIdsBySlot,
  inputs,
  messageIdsBySlot,
  runIdsBySlot,
  taskIdsBySlot,
}: {
  evidenceBundleIdsBySlot: Record<string, string>;
  inputs?: WorkflowInputs;
  messageIdsBySlot: Record<string, string>;
  runIdsBySlot: Record<string, string>;
  taskIdsBySlot: Record<string, string>;
}): Record<string, QueueWorkflowSlotVariables> {
  const slots = new Set<string>();
  const taskTemplates = Array.isArray(inputs?.tasks) ? inputs.tasks : [];

  for (const task of taskTemplates) {
    if (isRecord(task) && typeof task.slot === "string" && task.slot.trim()) {
      slots.add(task.slot.trim());
    }
  }
  for (const slot of Object.keys(taskIdsBySlot)) slots.add(slot);
  for (const slot of Object.keys(runIdsBySlot)) slots.add(slot);
  for (const slot of Object.keys(evidenceBundleIdsBySlot)) slots.add(slot);
  for (const slot of Object.keys(messageIdsBySlot)) slots.add(slot);

  const variables: Record<string, QueueWorkflowSlotVariables> = {};
  for (const slot of slots) {
    variables[slot] = stripUndefined({
      evidenceBundleId: evidenceBundleIdsBySlot[slot],
      messageId: messageIdsBySlot[slot],
      runId: runIdsBySlot[slot],
      slot,
      taskId: taskIdsBySlot[slot],
    });
  }

  return variables;
}

export function setSlotVariable(
  variables: QueueWorkflowVariables,
  slot: string | undefined,
  values: Pick<
    QueueWorkflowSlotVariables,
    "evidenceBundleId" | "messageId" | "runId"
  >,
) {
  if (!slot) {
    return;
  }

  const current = variables.slots[slot] ?? { slot };
  const next = stripUndefined({
    ...current,
    evidenceBundleId: values.evidenceBundleId ?? current.evidenceBundleId,
    messageId: values.messageId ?? current.messageId,
    runId: values.runId ?? current.runId,
    slot,
  });
  variables.slots[slot] = next;
  if (next.evidenceBundleId) {
    variables.evidenceBundleIdsBySlot[slot] = next.evidenceBundleId;
  }
  if (next.messageId) {
    variables.messageIdsBySlot[slot] = next.messageId;
  }
  if (next.runId) {
    variables.runIdsBySlot[slot] = next.runId;
  }
}

export function stringRecord(value: unknown): Record<string, string> {
  if (!isRecord(value)) {
    return {};
  }

  const record: Record<string, string> = {};
  for (const [key, item] of Object.entries(value)) {
    if (typeof item === "string" && item.trim()) {
      record[key] = item.trim();
    }
  }
  return record;
}

export function booleanRecord(value: unknown): Record<string, boolean> {
  if (!isRecord(value)) {
    return {};
  }

  const record: Record<string, boolean> = {};
  for (const [key, item] of Object.entries(value)) {
    if (typeof item === "boolean") {
      record[key] = item;
    }
  }
  return record;
}

export function stringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean);
}

export function uniqueStrings(values: readonly string[]): string[] {
  return Array.from(new Set(values.filter(Boolean)));
}

export function uniqueEvidenceRequests(
  requests: readonly QueueWorkflowEvidenceReadRequest[],
): QueueWorkflowEvidenceReadRequest[] {
  const seen = new Set<string>();
  const unique: QueueWorkflowEvidenceReadRequest[] = [];
  for (const request of requests) {
    const key = evidenceKey(request);
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    unique.push(request);
  }
  return unique;
}

export function evidenceKey(request: QueueWorkflowEvidenceReadRequest): string {
  return [
    request.taskId,
    request.runId ?? "",
    request.evidenceBundleId ?? "",
  ].join("|");
}

export function evidenceRequestFromKey(key: string): QueueWorkflowEvidenceReadRequest {
  const [taskId = "", runId = "", evidenceBundleId = ""] = key.split("|");
  return stripUndefined({
    evidenceBundleId: evidenceBundleId || undefined,
    runId: runId || undefined,
    taskId,
  });
}

export function nonEmptyString(value: unknown): value is string {
  return typeof value === "string" && Boolean(value.trim());
}

export function numberInput(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

export function cleanString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

export function firstString(
  ...values: readonly (string | null | undefined)[]
): string | undefined {
  return values.find((value): value is string => Boolean(value));
}

export function recordString(
  value: unknown,
  fieldName: string,
): string | undefined {
  return isRecord(value) ? cleanString(value[fieldName]) : undefined;
}

export function recordRecord(
  value: unknown,
  fieldName: string,
): Record<string, unknown> | undefined {
  if (!isRecord(value)) {
    return undefined;
  }

  const fieldValue = value[fieldName];
  return isRecord(fieldValue) ? fieldValue : undefined;
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function stripUndefined<T extends Record<string, unknown>>(value: T): T {
  return Object.fromEntries(
    Object.entries(value).filter(([, item]) => item !== undefined),
  ) as T;
}
