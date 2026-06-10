import {
  RENDER_MEMORY_CAPS,
  cappedPreviewText,
} from "../../../renderMemoryGuards";
import type {
  AgentQueueTask,
  AgentQueueWorkerExecutionReport,
} from "../../../workspace/types";
import {
  normalizeValidationStatus,
} from "../../agentQueueTaskUiModel";
import {
  summarizeQueueValidationState,
  type QueueValidationState,
} from "../../queue/queueValidationEvidenceService";

export type QueueV2ValidationCommandEvidence = {
  command: string;
  duration: string;
  errors: string[];
  exit: string;
  stderr: string;
  stdout: string;
  status: string;
  warnings: string[];
};

export type QueueV2ValidationEvidenceView = {
  commands: QueueV2ValidationCommandEvidence[];
  evidenceAt: string | null;
  marker: string;
  markerTone: "neutral" | "info" | "success" | "warning" | "error";
  state: QueueValidationState;
  summary: string;
  warnings: string[];
};

const OUTPUT_CAP = Math.min(
  1_200,
  RENDER_MEMORY_CAPS.stdoutStderrPreviewChars,
);

export function queueV2ValidationEvidenceView(
  task: AgentQueueTask,
): QueueV2ValidationEvidenceView {
  const latestReport = latestValidationReport(task);
  const stateSummary = summarizeQueueValidationState(task, latestReport);
  const commands = latestReport ? validationCommandsFromReport(latestReport) : [];
  const warnings = uniqueNonEmpty([
    ...stateSummary.warnings,
    ...(latestReport?.warnings ?? []),
    ...(latestReport?.errors ?? []),
  ]);

  return {
    commands,
    evidenceAt: stateSummary.latestEvidenceAt,
    marker: validationMarkerLabel(stateSummary.state),
    markerTone: validationMarkerTone(stateSummary.state),
    state: stateSummary.state,
    summary: stateSummary.summary,
    warnings,
  };
}

export function latestValidationReport(
  task: AgentQueueTask,
): AgentQueueWorkerExecutionReport | null {
  const reports = task.workerExecutionReports ?? [];

  return (
    [...reports]
      .reverse()
      .find((report) =>
        Boolean(
          report.validationResult ||
            report.validationCommandsRun?.length ||
            report.rawReportPreview?.includes("Validation evidence"),
        ),
      ) ?? null
  );
}

function validationCommandsFromReport(
  report: AgentQueueWorkerExecutionReport,
): QueueV2ValidationCommandEvidence[] {
  const parsed = parseValidationRawPreview(report.rawReportPreview ?? "");

  if (parsed.length > 0) {
    return parsed;
  }

  const commands = report.validationCommandsRun?.length
    ? report.validationCommandsRun
    : report.commandsRun ?? [];

  return commands.map((command) => ({
    command,
    duration: "n/a",
    errors: report.errors ?? [],
    exit: "n/a",
    stderr: "No stderr snippet recorded.",
    stdout: "No stdout snippet recorded.",
    status: report.validationResult ?? report.reportStatus,
    warnings: report.warnings ?? [],
  }));
}

function parseValidationRawPreview(
  rawPreview: string,
): QueueV2ValidationCommandEvidence[] {
  if (!rawPreview.trim()) {
    return [];
  }

  return rawPreview
    .split(/\n(?=Command: )/)
    .filter((block) => block.trim().startsWith("Command: "))
    .map(parseCommandBlock)
    .filter((command): command is QueueV2ValidationCommandEvidence =>
      Boolean(command),
    );
}

function parseCommandBlock(
  block: string,
): QueueV2ValidationCommandEvidence | null {
  const commandLine = firstLineValue(block, "Command:");
  if (!commandLine) {
    return null;
  }

  return {
    command: commandLine,
    duration: firstLineValue(block, "Duration:") ?? "n/a",
    errors: listLineValues(block, "Errors:"),
    exit: firstLineValue(block, "Exit code:") ?? "n/a",
    stderr: cappedEvidenceOutput(multilineValue(block, "Stderr preview:")),
    stdout: cappedEvidenceOutput(multilineValue(block, "Stdout preview:")),
    status: firstLineValue(block, "Status:") ?? "unknown",
    warnings: listLineValues(block, "Warnings:"),
  };
}

function firstLineValue(block: string, label: string) {
  const line = block
    .split(/\r?\n/)
    .find((entry) => entry.trim().startsWith(label));

  return line?.slice(line.indexOf(label) + label.length).trim() || null;
}

function listLineValues(block: string, label: string) {
  const value = firstLineValue(block, label);

  return value
    ? value
        .split(";")
        .map((entry) => entry.trim())
        .filter(Boolean)
    : [];
}

function multilineValue(block: string, label: string) {
  const lines = block.split(/\r?\n/);
  const startIndex = lines.findIndex((line) => line.trim().startsWith(label));

  if (startIndex < 0) {
    return "empty";
  }

  const firstLine = lines[startIndex] ?? "";
  const values = [firstLine.slice(firstLine.indexOf(label) + label.length).trim()];

  for (const line of lines.slice(startIndex + 1)) {
    if (/^(Command|Status|Exit code|Cwd|Stdout preview|Stderr preview|Full log ref|Warnings|Errors):/.test(line.trim())) {
      break;
    }

    values.push(line);
  }

  return values.join("\n").trim() || "empty";
}

function cappedEvidenceOutput(value: string) {
  return cappedPreviewText(value, OUTPUT_CAP);
}

function validationMarkerLabel(state: QueueValidationState) {
  switch (state) {
    case "not_requested":
      return "Validation not requested";
    case "running":
      return "Validation running";
    case "passed":
      return "Validation passed";
    case "failed":
      return "Validation failed";
    case "unavailable":
      return "Validation unavailable";
    case "cancelled":
      return "Validation cancelled";
    case "stale":
      return "Validation stale";
  }
}

function validationMarkerTone(state: QueueValidationState) {
  switch (state) {
    case "running":
      return "info";
    case "passed":
      return "success";
    case "failed":
      return "error";
    case "unavailable":
    case "cancelled":
    case "stale":
      return "warning";
    case "not_requested":
      return "neutral";
  }
}

function uniqueNonEmpty(values: string[]) {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const value of values) {
    const trimmed = value.trim();
    const key = trimmed.toLowerCase();

    if (!trimmed || seen.has(key)) {
      continue;
    }

    seen.add(key);
    result.push(trimmed);
  }

  return result;
}

export function validationStatusDataAttribute(task: AgentQueueTask) {
  const status = normalizeValidationStatus(task.validationStatus);
  if (status === "not_started") {
    return queueV2ValidationEvidenceView(task).state;
  }

  return status === "validating" ? "running" : status;
}
