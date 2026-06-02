import {
  formatUpdatedTimestamp,
  normalizeItemType,
  statusLabel,
} from "../../agentQueueTaskUiModel";
import type {
  AgentQueueController,
  SelectedAgentQueueTask,
  WorkerExecutionReport,
} from "./agentQueueTaskDetailsTypes";

export function compactNextActionBlocker(message: string | null | undefined) {
  if (!message) {
    return null;
  }

  if (
    /No local executor|Local executor unavailable|assigned worker unavailable|worker is disabled/i.test(
      message,
    )
  ) {
    return "Local executor unavailable.";
  }

  if (/workspace|repo root/i.test(message)) {
    return "Set workspace.";
  }

  if (/danger_full_access|sandbox/i.test(message)) {
    return "Select danger_full_access.";
  }

  if (/Draft/i.test(message)) {
    return "Promote to queued.";
  }

  if (/Enable queue|disabled/i.test(message)) {
    return "Enable queue.";
  }

  return message;
}

export function isRunSettingPrecondition(message: string) {
  return /workspace|repo root|Codex executable/i.test(message);
}

export function isReportReadyStatus(status: string) {
  return (
    status === "completed" ||
    status === "review_needed" ||
    status === "failed" ||
    status === "cancelled"
  );
}

export function previewText(value: string, maxLength: number) {
  const normalized = value.replace(/\s+/g, " ").trim();

  if (normalized.length <= maxLength) {
    return normalized;
  }

  return `${normalized.slice(0, Math.max(0, maxLength - 1)).trim()}...`;
}

export function promptSummary(prompt: string) {
  const lines = meaningfulPromptLines(prompt);

  if (lines.length === 0) {
    return "No prompt has been written for this task.";
  }

  const title = firstPromptTitle(lines);
  const mode = labeledPromptValue(lines, "mode");
  const objective = firstSentence(labeledPromptValue(lines, "objective"));
  const parts = [
    title ? previewText(title, 90) : null,
    mode ? `Mode: ${previewText(mode, 70)}` : null,
    objective ? `Objective: ${previewText(objective, 140)}` : null,
  ].filter((value): value is string => Boolean(value));

  if (parts.length > 0) {
    return parts.join(" | ");
  }

  return previewText(lines.slice(0, 2).join(" "), 180);
}

function meaningfulPromptLines(prompt: string) {
  return prompt
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .filter((line) => !/^[-*]\s+/.test(line));
}

function firstPromptTitle(lines: string[]) {
  const titleLine = lines.find((line) => /^title\s*:/i.test(line));

  if (titleLine) {
    return titleLine.replace(/^title\s*:\s*/i, "").trim();
  }

  const firstLine = lines.find((line) => !/^(mode|objective)\s*:/i.test(line));

  return firstLine?.replace(/^#+\s*/, "").trim() || null;
}

function labeledPromptValue(lines: string[], label: "mode" | "objective") {
  const labelPattern = new RegExp(`^${label}\\s*:\\s*(.*)$`, "i");
  const labelOnlyPattern = new RegExp(`^${label}\\s*:?\\s*$`, "i");

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index] ?? "";
    const inlineMatch = line.match(labelPattern);

    if (inlineMatch?.[1]?.trim()) {
      return inlineMatch[1].trim();
    }

    if (labelOnlyPattern.test(line)) {
      const next = lines
        .slice(index + 1)
        .find((entry) => !/^[A-Z][A-Za-z /-]*\s*:?\s*$/.test(entry));

      return next ?? null;
    }
  }

  return null;
}

function firstSentence(value: string | null) {
  if (!value) {
    return null;
  }

  const match = value.match(/^(.+?[.!?])(?:\s|$)/);

  return (match?.[1] ?? value).trim();
}

export function formatTimestamp(value: string) {
  return formatUpdatedTimestamp(value) ?? value;
}

export function selectedTaskStatusRailLabel(task: SelectedAgentQueueTask) {
  switch (task.status) {
    case "completed":
      return "Execution complete";
    case "failed":
      return "Run failed";
    case "cancelled":
      return "Run cancelled";
    case "review_needed":
      return "Report ready";
    default:
      return statusLabel(task.status);
  }
}

export function diffReviewHeaderLabel(
  queue: AgentQueueController,
  task: SelectedAgentQueueTask,
) {
  if (normalizeItemType(task.itemType) === "diff_review") {
    return task.diffReview?.sourceItemId
      ? `Linked to ${task.diffReview.sourceItemId}`
      : "Independent review";
  }

  return queue.diffReview.linkedReviewTasks.length > 0
    ? "Diff review requested"
    : "Not requested";
}

export function reviewModeLabel(
  reviewMode: NonNullable<SelectedAgentQueueTask["diffReview"]>["reviewMode"] |
    undefined,
) {
  switch (reviewMode) {
    case "contract_scope":
      return "Contract/scope review";
    case "general_review":
      return "General review";
    case "diff_vs_report":
    default:
      return "Diff vs report";
  }
}

export function workerNameForReport(
  queue: AgentQueueController,
  report: WorkerExecutionReport,
) {
  return (
    queue.foundation.workers.find((worker) => worker.workerId === report.workerId)
      ?.name ?? report.workerId
  );
}

export function workerReportStatusLabel(
  status: WorkerExecutionReport["reportStatus"],
) {
  switch (status) {
    case "needs_follow_up":
      return "needs follow-up";
    default:
      return status;
  }
}

export function workerReportValidationLabel(
  validationResult: WorkerExecutionReport["validationResult"],
) {
  switch (validationResult) {
    case "passed":
      return "passed";
    case "failed":
      return "failed";
    case "partial":
      return "partial";
    case "not_run":
    default:
      return "not run";
  }
}
