import type {
  QueueWorkflowRuntimeJsonValue,
  QueueWorkflowRunnerRuntimePhase,
} from "./queueWorkflowRuntimeAdapterTypes";
import type { QueueWorkflowRunnerRequest } from "../queueWorkflowRunner";

export const QUEUE_MODULE_ID = "queue";
export const DEFAULT_ACTOR_ID = "workspace-agent";

export const CREATE_SETUP_START_WORKFLOWS = new Set([
  "dependency_acceptance_smoke",
  "dependency_failure_smoke",
]);

export const SUPPORTED_REVIEW_DEFERRED_WORKFLOWS = new Set([
  "review_acceptance",
]);

export function workflowRunIdFromMetadata(
  metadata: Record<string, unknown> | undefined,
): string | null {
  const value = metadata?.workflowRunId;
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export function hasTypedWorkerEvidenceInput(
  request: QueueWorkflowRunnerRequest,
): boolean {
  const workerEvidence = recordRecord(request.inputs, "workerEvidence");
  return (
    stringValue(workerEvidence.slot) === "upstream" &&
    Boolean(stringValue(workerEvidence.taskId)) &&
    Boolean(stringValue(workerEvidence.runId)) &&
    ["completed", "not_completed", "failed"].includes(
      stringValue(workerEvidence.outcome) ?? "",
    )
  );
}

export function workflowPhaseForRuntimePhase(
  phase: QueueWorkflowRunnerRuntimePhase,
) {
  if (phase === "create_setup_start") return "run_start";
  if (phase === "review") return "review";
  if (phase === "worker_evidence") return "worker_evidence";
  return "worker_evidence";
}

export function runtimePhaseFromWorkflowPhase(
  phase: string | null,
): QueueWorkflowRunnerRuntimePhase | null {
  if (phase === "decision" || phase === "closed") return "finalization";
  if (phase === "review") return "review";
  if (phase === "worker_evidence") return "worker_evidence";
  if (phase === "setup" || phase === "run_start") return "create_setup_start";
  if (phase === "intake") return "read";
  return null;
}

export function parseJsonRecord(value: string | null): Record<string, unknown> {
  if (!value) return {};
  try {
    const parsed: unknown = JSON.parse(value);
    return isRecord(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

export function sanitizeJsonValue(value: unknown): QueueWorkflowRuntimeJsonValue {
  if (value === null || value === undefined) return null;
  if (
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return value;
  }
  if (Array.isArray(value)) {
    return value.map(sanitizeJsonValue) as QueueWorkflowRuntimeJsonValue;
  }
  if (isRecord(value)) {
    const next: Record<string, QueueWorkflowRuntimeJsonValue> = {};
    for (const [key, item] of Object.entries(value)) {
      if (key === "confirmationToken" || typeof item === "undefined") continue;
      next[key] = sanitizeJsonValue(item);
    }
    return next;
  }
  return null;
}

export function stripNullish(
  value: Record<string, unknown>,
): QueueWorkflowRuntimeJsonValue {
  const next: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(value)) {
    if (item !== null && item !== undefined) next[key] = item;
  }
  return sanitizeJsonValue(next);
}

export function stripUndefined<T extends Record<string, unknown>>(value: T): T {
  const next: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(value)) {
    if (item !== undefined) next[key] = item;
  }
  return next as T;
}

export function assignString(
  target: Record<string, string>,
  key: string,
  value: unknown,
) {
  const text = stringValue(value);
  if (text) target[key] = text;
}

export function stringInput(
  inputs: QueueWorkflowRunnerRequest["inputs"],
  fieldName: string,
): string | null {
  if (!inputs || typeof inputs !== "object" || Array.isArray(inputs)) {
    return null;
  }

  const value = inputs[fieldName];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export function stringValue(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

export function isAckedReviewStatus(value: string | null): boolean {
  return value === "acked" || value === "acknowledged" || value === "done";
}

export function recordRecord(
  inputs: QueueWorkflowRunnerRequest["inputs"],
  fieldName: string,
): Record<string, unknown> {
  if (!inputs || typeof inputs !== "object" || Array.isArray(inputs)) return {};
  const value = inputs[fieldName];
  return isRecord(value) ? value : {};
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
