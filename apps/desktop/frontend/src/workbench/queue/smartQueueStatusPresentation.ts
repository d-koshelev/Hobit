import type { SmartQueueTaskHumanStatus } from "../../workspace/types/smartQueue";
import type {
  SmartQueueBlocker,
  SmartQueueDependencyGate,
  SmartQueueEligibility,
} from "./smartQueueEligibility";
import type { SmartQueueCoordinatorDecision } from "./smartQueueCoordinatorDecision";

export type SmartQueueDependencyLabel = {
  readonly taskId: string;
  readonly label: string;
};

type SmartQueueHumanStatusSource = {
  readonly label: string;
  readonly reason?: string;
  readonly status: SmartQueueTaskHumanStatus;
  readonly text: string;
};

export type SmartQueueStatusPresentation = {
  readonly status: SmartQueueTaskHumanStatus;
  readonly label: string;
  readonly detail: string | null;
  readonly text: string;
};

export type SmartQueueStatusPresentationInput = {
  readonly blockers?: readonly SmartQueueBlocker[];
  readonly coordinatorDecision?: Pick<
    SmartQueueCoordinatorDecision,
    "humanStatus" | "productLabel" | "shortReason"
  >;
  readonly dependencyGate?: SmartQueueDependencyGate;
  readonly dependencyLabels?: readonly SmartQueueDependencyLabel[];
  readonly eligibility?: Pick<SmartQueueEligibility, "blockers" | "dependencyGate" | "humanStatus">;
  readonly humanStatus?: SmartQueueHumanStatusSource;
};

export function presentSmartQueueStatus({
  blockers = [],
  coordinatorDecision,
  dependencyGate,
  dependencyLabels = [],
  eligibility,
  humanStatus,
}: SmartQueueStatusPresentationInput): SmartQueueStatusPresentation {
  const source =
    coordinatorDecision?.humanStatus ?? eligibility?.humanStatus ?? humanStatus;
  const gate = eligibility?.dependencyGate ?? dependencyGate;
  const allBlockers = [...(eligibility?.blockers ?? []), ...blockers];

  if (!source) {
    return presentation("blocked", "Blocked");
  }

  switch (source.status) {
    case "ready":
      return presentation("ready", "Ready");
    case "waiting_dependency":
      return presentation(
        "waiting_dependency",
        "Waiting dependency",
        waitingDependencyDetail(gate, dependencyLabels, source),
      );
    case "running":
      return presentation("running", "Running");
    case "review":
      return presentation("review", "Review");
    case "needs_decision":
      return presentation(
        "needs_decision",
        needsDecisionLabel(coordinatorDecision?.productLabel ?? source.label ?? source.text, source),
      );
    case "blocked":
      return presentation(
        "blocked",
        blockedLabel(source, allBlockers),
        blockedDependencyDetail(gate, dependencyLabels),
      );
    case "failed":
      return presentation("failed", "Failed");
    case "closed":
      return presentation("closed", "Closed");
    case "cancelled":
      return presentation("cancelled", "Closed");
  }
}

function presentation(
  status: SmartQueueTaskHumanStatus,
  label: string,
  detail: string | null = null,
): SmartQueueStatusPresentation {
  return {
    detail,
    label,
    status,
    text: label,
  };
}

function waitingDependencyDetail(
  gate: SmartQueueDependencyGate | undefined,
  dependencyLabels: readonly SmartQueueDependencyLabel[],
  source: Pick<SmartQueueHumanStatusSource, "reason" | "text">,
) {
  const waitingIds = gate?.waitingTaskIds ?? [];
  const detail = dependencyDetail("Waiting for", waitingIds, dependencyLabels);

  if (detail) {
    return detail;
  }

  return waitingText(source.reason ?? source.text);
}

function blockedDependencyDetail(
  gate: SmartQueueDependencyGate | undefined,
  dependencyLabels: readonly SmartQueueDependencyLabel[],
) {
  if (!gate) {
    return null;
  }

  if (gate.gate !== "failed" && gate.gate !== "blocked") {
    return null;
  }

  const blockerIds =
    gate.gate === "failed" ? gate.failedTaskIds : gate.blockedTaskIds;

  return dependencyDetail("Blocked by", blockerIds, dependencyLabels);
}

function dependencyDetail(
  prefix: "Blocked by" | "Waiting for",
  taskIds: readonly string[],
  dependencyLabels: readonly SmartQueueDependencyLabel[],
) {
  if (taskIds.length === 0) {
    return null;
  }

  return `${prefix}: ${taskIds
    .map((taskId) => dependencyLabel(taskId, dependencyLabels))
    .join(", ")}`;
}

function dependencyLabel(
  taskId: string,
  dependencyLabels: readonly SmartQueueDependencyLabel[],
) {
  const explicitLabel = dependencyLabels.find((item) => item.taskId === taskId)?.label;

  return explicitLabel?.trim() || formatTaskId(taskId);
}

function waitingText(text: string | undefined) {
  const trimmed = text?.trim() ?? "";

  if (trimmed.startsWith("Waiting for:")) {
    return trimmed;
  }

  return null;
}

function needsDecisionLabel(
  preferred: string | undefined,
  source: Pick<SmartQueueHumanStatusSource, "reason" | "text">,
) {
  const candidate = cleanLabel(preferred ?? source.text);

  if (candidate.startsWith("Needs decision:")) {
    return candidate;
  }

  if (candidate === "Retry available") {
    return candidate;
  }

  const reason = cleanReason(source.reason ?? source.text);

  if (reason) {
    return `Needs decision: ${reason}`;
  }

  return "Needs decision";
}

function blockedLabel(
  source: Pick<SmartQueueHumanStatusSource, "label" | "text">,
  blockers: readonly SmartQueueBlocker[],
) {
  const sourceLabel = cleanLabel(source.label || source.text);

  if (sourceLabel === "Blocked: dependency failed") {
    return sourceLabel;
  }

  if (sourceLabel === "Blocked: dependency blocked") {
    return sourceLabel;
  }

  if (sourceLabel === "Blocked: missing config") {
    return sourceLabel;
  }

  const blocker = blockers[0];

  switch (blocker?.kind) {
    case "dependency_failed":
      return "Blocked: dependency failed";
    case "dependency_blocked":
      return "Blocked: dependency blocked";
    case "missing_config":
      return "Blocked: missing config";
    default:
      return sourceLabel.startsWith("Blocked:") ? sourceLabel : "Blocked";
  }
}

function cleanLabel(label: string | undefined) {
  return label?.trim().replace(/_/g, " ") || "";
}

function cleanReason(reason: string | undefined) {
  const cleaned = cleanLabel(reason);

  if (!cleaned || cleaned === "Needs decision") {
    return "";
  }

  return cleaned.replace(/^Needs decision:\s*/i, "");
}

function formatTaskId(taskId: string) {
  const trimmed = taskId.trim();
  const numericSuffix = trimmed.match(/(?:task|queue)?[-_]?(\d+)$/i)?.[1];

  if (numericSuffix) {
    return `Task ${numericSuffix}`;
  }

  return trimmed || "dependency";
}
