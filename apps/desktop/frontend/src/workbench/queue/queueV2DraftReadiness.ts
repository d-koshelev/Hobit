import type {
  AgentQueueTask,
  DirectWorkApprovalPolicy,
  DirectWorkSandbox,
} from "../../workspace/types";

export type QueueV2DraftReadiness = {
  disabledReason: string | null;
  isDraft: boolean;
  missingFields: string[];
  readyToQueue: boolean;
  statusLabel: "Draft task";
  summary: "Not runnable yet" | "Ready to queue";
};

const VALID_SANDBOXES = new Set<DirectWorkSandbox>([
  "danger_full_access",
  "read_only",
  "workspace_write",
]);

const VALID_APPROVAL_POLICIES = new Set<DirectWorkApprovalPolicy>([
  "never",
  "on_request",
  "untrusted",
]);

export function queueV2DraftReadinessForTask(
  task: AgentQueueTask,
): QueueV2DraftReadiness {
  const missingFields =
    task.status === "draft" ? queueV2DraftMissingFields(task) : [];
  const readyToQueue = task.status === "draft" && missingFields.length === 0;

  return {
    disabledReason: readyToQueue
      ? null
      : missingFields.length > 0
        ? `Complete draft before queuing: ${missingFields.join(", ")}.`
        : task.status === "draft"
          ? "Complete draft before queuing."
          : null,
    isDraft: task.status === "draft",
    missingFields,
    readyToQueue,
    statusLabel: "Draft task",
    summary: readyToQueue ? "Ready to queue" : "Not runnable yet",
  };
}

export function queueV2DraftReadinessCardLine(
  readiness: QueueV2DraftReadiness,
) {
  if (!readiness.isDraft) {
    return null;
  }

  if (readiness.readyToQueue) {
    return "Ready to queue";
  }

  if (readiness.missingFields.length === 0) {
    return "Not runnable yet";
  }

  return `Not runnable yet: ${compactMissingFields(readiness.missingFields)}`;
}

function queueV2DraftMissingFields(task: AgentQueueTask) {
  const missingFields: string[] = [];

  if (!task.title.trim()) {
    missingFields.push("Missing title");
  }

  if (!task.prompt.trim()) {
    missingFields.push("Missing prompt");
  }

  if (!task.executionWorkspace?.trim()) {
    missingFields.push("Missing workspace");
  }

  if (!task.codexExecutable?.trim()) {
    missingFields.push("Missing Codex executable");
  }

  if (!task.sandbox || !VALID_SANDBOXES.has(task.sandbox)) {
    missingFields.push("Missing sandbox");
  }

  if (
    !task.approvalPolicy ||
    !VALID_APPROVAL_POLICIES.has(task.approvalPolicy)
  ) {
    missingFields.push("Missing approval policy");
  }

  return missingFields;
}

function compactMissingFields(missingFields: readonly string[]) {
  const visible = missingFields.slice(0, 2).join(", ");
  const extraCount = missingFields.length - 2;

  return extraCount > 0 ? `${visible} +${extraCount.toString()}` : visible;
}
