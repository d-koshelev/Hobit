import type { AgentExecutorRunDetail } from "../../../workspace/types";
import {
  RENDER_MEMORY_CAPS,
  cappedPreviewText,
  cappedRawDetailsText,
} from "../../../renderMemoryGuards";
import { previewText, isReportReadyStatus } from "./agentQueueTaskDetailsFormatters";
import type {
  AgentQueueController,
  DirectWorkEvidence,
  FinalResponseEvidence,
  ResultEvidenceState,
  SelectedAgentQueueTask,
} from "./agentQueueTaskDetailsTypes";

const FINAL_RESPONSE_PREVIEW_LENGTH = 720;
const FINAL_RESPONSE_FULL_PREVIEW_LENGTH = RENDER_MEMORY_CAPS.evidenceRawDetailsChars;

export function resultEvidenceState(
  queue: AgentQueueController,
  selectedTask: SelectedAgentQueueTask,
  report: unknown | null,
  runEvidence: DirectWorkEvidence | null,
): ResultEvidenceState {
  const failed = isFailedRunEvidence(queue, selectedTask);
  const hasEvidence = Boolean(report || runEvidence);

  if (isSelectedTaskRunning(queue, selectedTask)) {
    return {
      badge: "Running",
      badgeVariant: "info",
      copy: "Result will appear here when the run completes.",
      title: "Result pending",
    };
  }

  if (hasEvidence) {
    return {
      badge: failed ? "Run failed" : "Report ready",
      badgeVariant: failed ? "error" : "success",
      copy: "",
      title: failed ? "Run failed" : "Report ready",
    };
  }

  if (hasFinishedRunLink(queue) || isReportReadyStatus(selectedTask.status)) {
    return {
      badge: failed ? "Failure evidence missing" : "Evidence missing",
      badgeVariant: "warning",
      copy: "Execution finished without loaded worker report or Direct Work result evidence.",
      title: failed ? "Failure evidence missing" : "Evidence missing",
    };
  }

  return {
    badge: "No run evidence",
    badgeVariant: "neutral",
    copy: "Run the task or attach a report before coordinator review.",
    title: "No run evidence attached",
  };
}

export function directWorkEvidenceForQueue(
  queue: AgentQueueController,
): DirectWorkEvidence | null {
  const detail = queue.runEvidence.detail;

  if (!detail) {
    return null;
  }

  const failed = isFailedStatus(
    detail.summary.status || detail.resultStatus || queue.latestRun.link?.status,
  );
  const error = firstNonEmpty([
    detail.errorMessage,
    failed ? detail.stderrPreview : null,
    failed ? detail.resultSummary : null,
  ]);
  const finalText = firstNonEmpty([
    detail.finalMessage,
    detail.resultContent,
    failed ? error : null,
    detail.resultSummary,
    detail.stdoutPreview,
    "Direct Work finished without a captured final response.",
  ]);
  const summary = firstNonEmpty([
    failed ? error : null,
    detail.finalMessage,
    detail.resultSummary,
    detail.resultContent,
    failed ? "Direct Work failed." : "Direct Work completed.",
  ]);
  const resultPayload = directWorkResultPayloadObject(detail);
  const commandSummary = commandSummaryLabel(resultPayload?.command_summary);
  const changedFilesSummary = firstNonEmpty([
    detail.changedFilesSummary,
    changedFilesSummaryLabel(resultPayload?.changed_files_summary),
    changedFilesSummaryLabel(resultPayload?.changed_files),
    changedFilesSummaryLabel(resultPayload?.git_changed_files_summary),
  ]);
  const allText = [detail.finalMessage, detail.resultSummary, detail.resultContent]
    .filter((value): value is string => Boolean(value))
    .join("\n");
  const workingDirectory =
    firstNonEmpty([
      stringPayloadValue(resultPayload, [
        "working_directory",
        "workingDirectory",
        "repo_root",
        "repoRoot",
        "cwd",
      ]),
      detail.summary.repoRoot,
    ]) || null;
  const agentsSummary =
    firstNonEmpty([
      stringPayloadValue(resultPayload, [
        "agents_md",
        "agentsMd",
        "agents_summary",
      ]),
      extractAgentsSummary(allText),
    ]) || null;
  const gitStatusSummary =
    firstNonEmpty([
      stringPayloadValue(resultPayload, [
        "git_status_summary",
        "gitStatusSummary",
        "final_git_status",
        "finalGitStatus",
      ]),
      summarizeGitStatusText(
        stringPayloadValue(resultPayload, ["git_status", "gitStatus"]),
      ),
      extractGitStatusSummary(allText),
    ]) || null;
  const developerDetails = directWorkDeveloperDetails(detail);
  const outputExcerpt = previewText(
    failed
      ? firstNonEmpty([
          detail.stdoutPreview,
          detail.resultSummary,
          detail.resultContent,
          detail.stderrPreview,
          error,
          "Direct Work failed.",
        ])
      : firstNonEmpty([
          detail.resultSummary,
          detail.resultContent,
          detail.stdoutPreview,
          detail.finalMessage,
          "Direct Work completed.",
        ]),
    260,
  );
  const visibleSummary = previewText(summary, 260);

  return {
    agentsSummary,
    changedFilesSummary: summarizeChangedFilesText(changedFilesSummary),
    commandSummary,
    developerDetails,
    error,
    finalText,
    gitStatusSummary,
    outputExcerpt,
    status: failed ? "failed" : "completed",
    summary,
    visibleSummary,
    workingDirectory,
  };
}

export function finalResponseEvidence(
  value: string | null | undefined,
): FinalResponseEvidence | null {
  const text = value?.trim();

  if (!text) {
    return null;
  }

  if (text.length <= FINAL_RESPONSE_PREVIEW_LENGTH) {
    return {
      isLong: false,
      preview: text,
      text,
    };
  }

  return {
    isLong: true,
    preview: `${text.slice(0, FINAL_RESPONSE_PREVIEW_LENGTH).trim()}...\n[Preview capped]`,
    text: cappedPreviewText(
      text,
      FINAL_RESPONSE_FULL_PREVIEW_LENGTH,
      "Preview capped",
    ),
  };
}

export function directWorkDeveloperDetails(detail: AgentExecutorRunDetail) {
  const sections = [
    detail.resultPayload
      ? `Result payload:\n${cappedRawDetailsText(
          detail.resultPayload,
          RENDER_MEMORY_CAPS.rawJsonPreviewChars,
        )}`
      : null,
    detail.stdoutPreview
      ? `Stdout preview:\n${cappedPreviewText(
          detail.stdoutPreview,
          RENDER_MEMORY_CAPS.stdoutStderrPreviewChars,
        )}`
      : null,
    detail.stderrPreview
      ? `Stderr preview:\n${cappedPreviewText(
          detail.stderrPreview,
          RENDER_MEMORY_CAPS.stdoutStderrPreviewChars,
        )}`
      : null,
  ].filter((value): value is string => Boolean(value));

  return sections.length > 0
    ? cappedRawDetailsText(
        sections.join("\n\n"),
        RENDER_MEMORY_CAPS.evidenceRawDetailsChars,
      )
    : null;
}

function directWorkResultPayloadObject(
  detail: AgentExecutorRunDetail,
): Record<string, unknown> | null {
  if (!detail.resultPayload) {
    return null;
  }

  try {
    const parsed = JSON.parse(detail.resultPayload);

    return parsed && typeof parsed === "object"
      ? (parsed as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

function commandSummaryLabel(value: unknown) {
  if (typeof value === "string") {
    return value.trim() || null;
  }

  if (Array.isArray(value)) {
    return (
      value
        .map((entry) => (typeof entry === "string" ? entry.trim() : null))
        .filter((entry): entry is string => Boolean(entry))
        .join(" ") || null
    );
  }

  return null;
}

function changedFilesSummaryLabel(value: unknown) {
  if (typeof value === "string") {
    return value.trim() || null;
  }

  if (Array.isArray(value)) {
    return (
      value
        .map((entry) => {
          if (typeof entry === "string") {
            return entry.trim();
          }

          if (entry && typeof entry === "object") {
            const path = (entry as { path?: unknown }).path;
            return typeof path === "string" ? path.trim() : null;
          }

          return null;
        })
        .filter((entry): entry is string => Boolean(entry))
        .join(", ") || null
    );
  }

  return null;
}

function stringPayloadValue(payload: Record<string, unknown> | null, keys: string[]) {
  if (!payload) {
    return null;
  }

  for (const key of keys) {
    const value = payload[key];

    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }

  return null;
}

function extractAgentsSummary(text: string) {
  const line = text
    .split(/\r?\n/)
    .map((entry) => entry.trim())
    .find((entry) => /AGENTS\.md/i.test(entry));

  if (!line) {
    return null;
  }

  const match = line.match(/AGENTS\.md\s*:?\s*(.+)$/i);

  return previewText(match?.[1] ?? line, 120);
}

function extractGitStatusSummary(text: string) {
  const lines = text
    .split(/\r?\n/)
    .map((entry) => entry.trim())
    .filter(Boolean);
  const gitLine = lines.find((entry) => /git status/i.test(entry));

  if (gitLine) {
    return summarizeGitStatusText(gitLine);
  }

  const branchLine = lines.find((entry) => /^On branch\b/i.test(entry));
  const shortStatusCount = lines.filter((entry) =>
    /^(M|A|D|R|C|\?\?|!!|AM|MM|UU|DD|DU|UD|UA|AU)\s/.test(entry),
  ).length;

  if (branchLine && shortStatusCount > 0) {
    return `${branchLine}; ${shortStatusCount.toString()} changed path${
      shortStatusCount === 1 ? "" : "s"
    }.`;
  }

  return branchLine ? `${branchLine}; clean or no changes reported.` : null;
}

export function summarizeGitStatusText(value: string | null | undefined) {
  if (!value?.trim()) {
    return null;
  }

  const text = value.trim();
  const lines = text
    .split(/\r?\n/)
    .map((entry) => entry.trim())
    .filter(Boolean);
  const branchLine = lines.find((entry) => /^On branch\b/i.test(entry));
  const shortStatusCount = lines.filter((entry) =>
    /^(M|A|D|R|C|\?\?|!!|AM|MM|UU|DD|DU|UD|UA|AU)\s/.test(entry),
  ).length;
  const clean = /nothing to commit|working tree clean|clean/i.test(text);

  if (branchLine) {
    if (shortStatusCount > 0) {
      return `${branchLine}; ${shortStatusCount.toString()} changed path${
        shortStatusCount === 1 ? "" : "s"
      }.`;
    }

    return clean ? `${branchLine}; clean.` : previewText(branchLine, 160);
  }

  if (shortStatusCount > 0) {
    return `${shortStatusCount.toString()} changed path${
      shortStatusCount === 1 ? "" : "s"
    } reported.`;
  }

  return previewText(text, 180);
}

function summarizeChangedFilesText(value: string | null | undefined) {
  if (!value?.trim()) {
    return null;
  }

  const normalized = value.trim();

  if (/^(none|no changed files|no files changed)$/i.test(normalized)) {
    return "none";
  }

  const files = normalized
    .split(/[,;\r\n]+/)
    .map((entry) => entry.trim())
    .filter(Boolean);

  if (files.length === 0) {
    return null;
  }

  return `${files.length.toString()} reported; see Developer details.`;
}

export function firstNonEmpty(values: Array<string | null | undefined>) {
  return values.find((value) => value && value.trim())?.trim() ?? "";
}

export function hasFinishedRunLink(queue: AgentQueueController) {
  const status = queue.latestRun.link?.status;

  return Boolean(status && status !== "running" && status !== "unknown");
}

export function isSelectedTaskRunning(
  queue: AgentQueueController,
  selectedTask: SelectedAgentQueueTask,
) {
  return (
    selectedTask.status === "running" || queue.latestRun.link?.status === "running"
  );
}

export function hasReviewEvidenceForTask(
  queue: AgentQueueController,
  selectedTask: SelectedAgentQueueTask,
) {
  return (
    (selectedTask.workerExecutionReports?.length ?? 0) > 0 ||
    Boolean(directWorkEvidenceForQueue(queue))
  );
}

export function isFailedRunEvidence(
  queue: AgentQueueController,
  selectedTask: SelectedAgentQueueTask,
) {
  return (
    isFailedStatus(selectedTask.status) ||
    isFailedStatus(queue.latestRun.link?.status) ||
    directWorkEvidenceForQueue(queue)?.status === "failed"
  );
}

export function isFailedStatus(status: string | null | undefined) {
  return (
    status === "failed" ||
    status === "timed_out" ||
    status === "cancelled" ||
    status === "failed_to_start"
  );
}

export function latestReportLabel(
  queue: AgentQueueController,
  task: SelectedAgentQueueTask,
) {
  if (task.workerExecutionReports && task.workerExecutionReports.length > 0) {
    return "Reported / awaiting coordinator review";
  }

  if (directWorkEvidenceForQueue(queue)) {
    return isFailedRunEvidence(queue, task)
      ? "Run failed / awaiting coordinator review"
      : "Run result available";
  }

  if (hasFinishedRunLink(queue) || isReportReadyStatus(task.status)) {
    return isFailedRunEvidence(queue, task)
      ? "Failure evidence missing"
      : "Evidence missing";
  }

  return "No worker report";
}
