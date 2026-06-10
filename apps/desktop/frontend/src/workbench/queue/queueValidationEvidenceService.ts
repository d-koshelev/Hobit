import type {
  AgentQueueTask,
  AgentQueueTaskValidationStatus,
  AgentQueueWorkerExecutionReport,
  AgentQueueWorkerExecutionReportValidationResult,
} from "../../workspace/types";
import type {
  ValidationEvidence,
  ValidationRunner,
  ValidationRunnerOutput,
  ValidationRunRequest,
  ValidationRunStatus,
  ValidationSuiteResult,
} from "../validation";
import {
  capValidationOutput,
  summarizeValidationResult,
} from "../validation";
import type {
  AgentQueueWidgetApi,
  QueueWidgetActionResult,
  QueueWidgetItemSnapshot,
} from "./agentQueueWidgetApiTypes";

export type QueueValidationState =
  | "not_requested"
  | "running"
  | "passed"
  | "failed"
  | "unavailable"
  | "cancelled"
  | "stale";

export type QueueValidationAttachmentWarning = {
  code:
    | "queue_update_failed"
    | "queue_item_not_found"
    | "queue_evidence_field_unavailable"
    | "queue_validation_status_unavailable"
    | "summary_capped";
  message: string;
};

export type QueueValidationStateSummary = {
  evidenceCount: number;
  latestEvidenceAt: string | null;
  queueItemId: string | null;
  state: QueueValidationState;
  summary: string;
  warnings: string[];
};

export type QueueValidationEvidenceAttachmentResult = {
  attached: boolean;
  report: AgentQueueWorkerExecutionReport;
  state: QueueValidationState;
  summary: QueueValidationStateSummary;
  updateResult: QueueWidgetActionResult | null;
  warnings: QueueValidationAttachmentWarning[];
};

export type QueueValidationRunResult = {
  attachment: QueueValidationEvidenceAttachmentResult;
  runnerOutput: ValidationRunnerOutput;
  started: boolean;
  startUpdate: QueueWidgetActionResult | null;
  warnings: QueueValidationAttachmentWarning[];
};

export type RequestValidationForQueueItemInput = {
  queueApi: Pick<AgentQueueWidgetApi, "getSnapshot" | "updateItem">;
  request: ValidationRunRequest;
  runner: ValidationRunner;
};

export type AttachValidationEvidenceToQueueItemInput = {
  queueApi: Pick<AgentQueueWidgetApi, "getSnapshot" | "updateItem">;
  output: ValidationRunnerOutput;
  request: ValidationRunRequest;
};

const RAW_REPORT_PREVIEW_CAP = 1_800;

export async function requestValidationForQueueItem({
  queueApi,
  request,
  runner,
}: RequestValidationForQueueItemInput): Promise<QueueValidationRunResult> {
  const queueItemId = request.queueItemId?.trim();
  if (!queueItemId) {
    const output = await runner.run(request);
    const attachment = await attachValidationEvidenceToQueueItem({
      queueApi,
      output,
      request,
    });

    return {
      attachment,
      runnerOutput: output,
      started: false,
      startUpdate: null,
      warnings: [
        {
          code: "queue_item_not_found",
          message:
            "Validation request did not include a Queue item id; evidence could not be attached to Queue state.",
        },
        ...attachment.warnings,
      ],
    };
  }

  const startUpdate = await queueApi.updateItem({
    actor: "operator",
    itemId: queueItemId,
    patch: {
      validationStatus: "validating",
    },
    reason: "Explicit Queue validation requested.",
    workspaceId: request.workspaceId,
  });
  const startWarnings = startUpdate.ok
    ? []
    : [
        {
          code: "queue_update_failed" as const,
          message:
            startUpdate.error?.message ??
            "Queue item could not be marked as running validation.",
        },
      ];
  const output = await runner.run(request);
  const attachment = await attachValidationEvidenceToQueueItem({
    queueApi,
    output,
    request,
  });

  return {
    attachment,
    runnerOutput: output,
    started: startUpdate.ok,
    startUpdate,
    warnings: [...startWarnings, ...attachment.warnings],
  };
}

export async function attachValidationEvidenceToQueueItem({
  queueApi,
  output,
  request,
}: AttachValidationEvidenceToQueueItemInput): Promise<QueueValidationEvidenceAttachmentResult> {
  const queueItemId = request.queueItemId?.trim();
  const report = validationReportForQueueItem({ output, request });
  const state = queueValidationStateForOutput(output);

  if (!queueItemId) {
    return {
      attached: false,
      report,
      state,
      summary: summarizeQueueValidationState(null, report),
      updateResult: null,
      warnings: [
        {
          code: "queue_item_not_found",
          message:
            "Validation evidence was produced, but no Queue item id was available for attachment.",
        },
      ],
    };
  }

  const validationStatus = queueValidationStatusForOutput(output);
  const updateResult = await queueApi.updateItem({
    actor: "operator",
    itemId: queueItemId,
    patch: {
      appendWorkerExecutionReport: report,
      validationStatus,
    },
    reason: "Attach explicit validation evidence to Queue item.",
    workspaceId: request.workspaceId,
  });

  if (!updateResult.ok) {
    return {
      attached: false,
      report,
      state,
      summary: summarizeQueueValidationState(null, report),
      updateResult,
      warnings: [
        {
          code: "queue_update_failed",
          message:
            updateResult.error?.message ??
            "Queue update failed; validation evidence was not attached.",
        },
      ],
    };
  }

  const item = updateResult.item ?? null;
  const warnings = evidenceAttachmentWarnings({
    expectedValidationStatus: validationStatus,
    item,
    report,
  });
  const attached = !warnings.some(
    (warning) => warning.code === "queue_evidence_field_unavailable",
  );

  return {
    attached,
    report,
    state,
    summary: summarizeQueueValidationState(item, report),
    updateResult,
    warnings,
  };
}

export function summarizeQueueValidationState(
  item: AgentQueueTask | QueueWidgetItemSnapshot | null,
  latestReport?: AgentQueueWorkerExecutionReport | null,
): QueueValidationStateSummary {
  const queueItemId = queueItemIdFor(item) ?? latestReport?.itemId ?? null;
  const report = latestReport ?? latestWorkerReport(item);
  const latestEvidenceAt = report?.createdAt ?? null;
  const stale = isEvidenceStale(item, latestEvidenceAt);
  const state = stale
    ? "stale"
    : stateFromReport(report) ?? stateFromQueueStatus(validationStatusFor(item));
  const evidenceCount = report
    ? 1
    : "workerExecutionReports" in (item ?? {})
      ? ((item as AgentQueueTask).workerExecutionReports?.length ?? 0)
      : 0;

  return {
    evidenceCount,
    latestEvidenceAt,
    queueItemId,
    state,
    summary: validationStateSummaryText({ item, report, state }),
    warnings: report?.warnings ?? [],
  };
}

function validationReportForQueueItem({
  output,
  request,
}: {
  output: ValidationRunnerOutput;
  request: ValidationRunRequest;
}): AgentQueueWorkerExecutionReport {
  const summary = output.summary ?? summarizeValidationResult(output.result, output.evidence);
  const rawPreview = cappedRawReportPreview(output);

  return {
    changedFiles: [],
    commandsRun: output.result.commandResults.map(commandLabel),
    createdAt: output.result.completedAt ?? output.result.startedAt ?? request.createdAt,
    errors: [...output.result.errors, ...summary.errors],
    itemId: request.queueItemId ?? "",
    rawReportPreview: rawPreview.text,
    reportId: `validation-report-${output.result.runId}`,
    reportStatus: reportStatusFor(output),
    summary: compactReportSummary(output),
    validationCommandsRun: output.result.commandResults.map(commandLabel),
    validationCommandsSuggested: request.suite.commands.map((command) => command.title),
    validationResult: validationResultFor(output),
    warnings: [
      ...output.result.warnings,
      ...summary.warnings,
      ...(rawPreview.truncated
        ? [
            `Validation report preview capped at ${rawPreview.capBytes.toString()} bytes; full logs were not copied into Queue state.`,
          ]
        : []),
    ],
    workerId: "queue-validation",
  };
}

function cappedRawReportPreview(output: ValidationRunnerOutput) {
  return capValidationOutput(rawReportPreview(output), RAW_REPORT_PREVIEW_CAP);
}

function rawReportPreview(output: ValidationRunnerOutput) {
  const result = output.result;
  const summary = output.summary;
  const commandBlocks = result.commandResults.map((command) => {
    const evidence = output.evidence.find(
      (candidate) => candidate.commandId === command.commandId,
    );
    const fullLogRef = command.fullLogRef ?? evidence?.fullLogRef;

    return [
      `Command: ${command.title} (${command.commandId})`,
      `Status: ${command.status}`,
      `Exit code: ${typeof command.exitCode === "number" ? command.exitCode.toString() : "none"}`,
      `Cwd: ${command.cwd}`,
      command.stdout.text ? `Stdout preview:\n${command.stdout.text}` : "Stdout preview: empty",
      command.stderr.text ? `Stderr preview:\n${command.stderr.text}` : "Stderr preview: empty",
      fullLogRef ? `Full log ref: ${fullLogRef}` : null,
      command.warnings.length ? `Warnings: ${command.warnings.join("; ")}` : null,
      command.errors.length ? `Errors: ${command.errors.join("; ")}` : null,
    ]
      .filter(Boolean)
      .join("\n");
  });

  return [
    "Validation evidence",
    `Run: ${result.runId}`,
    `Queue item: ${result.queueItemId ?? "none"}`,
    `Suite: ${result.suiteId}`,
    `Status: ${result.status}`,
    `Summary: ${summary.summary}`,
    "",
    ...commandBlocks,
  ].join("\n");
}

function compactReportSummary(output: ValidationRunnerOutput) {
  const summary = output.summary;
  const status = output.unavailable ? "unavailable" : summary.status;
  return `Validation ${status}: ${summary.summary || "no command summary available"}.`;
}

function reportStatusFor(
  output: ValidationRunnerOutput,
): AgentQueueWorkerExecutionReport["reportStatus"] {
  if (output.summary.status === "passed") {
    return "completed";
  }

  if (output.summary.status === "failed") {
    return "failed";
  }

  return "needs_follow_up";
}

function validationResultFor(
  output: ValidationRunnerOutput,
): AgentQueueWorkerExecutionReportValidationResult {
  if (output.unavailable) {
    return "partial";
  }

  switch (output.summary.status) {
    case "passed":
      return "passed";
    case "failed":
      return "failed";
    case "queued":
    case "running":
    case "needs_review":
    case "cancelled":
      return "partial";
  }
}

function queueValidationStatusForOutput(
  output: ValidationRunnerOutput,
): AgentQueueTaskValidationStatus {
  if (output.summary.status === "passed") {
    return "passed";
  }

  if (output.summary.status === "failed") {
    return "failed";
  }

  return "needs_review";
}

function queueValidationStateForOutput(output: ValidationRunnerOutput): QueueValidationState {
  if (output.unavailable) {
    return "unavailable";
  }

  return stateFromRunStatus(output.summary.status);
}

function stateFromRunStatus(status: ValidationRunStatus): QueueValidationState {
  switch (status) {
    case "queued":
    case "running":
      return "running";
    case "passed":
      return "passed";
    case "failed":
      return "failed";
    case "cancelled":
      return "cancelled";
    case "needs_review":
      return "unavailable";
  }
}

function stateFromReport(
  report: AgentQueueWorkerExecutionReport | null,
): QueueValidationState | null {
  if (!report) {
    return null;
  }

  switch (report.validationResult) {
    case "passed":
      return "passed";
    case "failed":
      return "failed";
    case "partial":
      return report.reportStatus === "failed" ? "failed" : "unavailable";
    case "not_run":
    case undefined:
      return "not_requested";
  }
}

function stateFromQueueStatus(
  status: AgentQueueTaskValidationStatus | null,
): QueueValidationState {
  switch (status) {
    case "validating":
      return "running";
    case "passed":
      return "passed";
    case "failed":
      return "failed";
    case "needs_review":
      return "unavailable";
    case "not_started":
    case null:
      return "not_requested";
  }
}

function evidenceAttachmentWarnings({
  expectedValidationStatus,
  item,
  report,
}: {
  expectedValidationStatus: AgentQueueTaskValidationStatus;
  item: QueueWidgetItemSnapshot | null;
  report: AgentQueueWorkerExecutionReport;
}): QueueValidationAttachmentWarning[] {
  const warnings: QueueValidationAttachmentWarning[] = [];

  if (!item || item.reportSummary.status !== "report_ready") {
    warnings.push({
      code: "queue_evidence_field_unavailable",
      message:
        "Queue update path accepted the request but did not return attached validation report evidence; current runtime may not support Queue evidence fields.",
    });
  } else if (!item.reportSummary.validationSummary?.includes(report.validationResult ?? "")) {
    warnings.push({
      code: "queue_evidence_field_unavailable",
      message:
        "Queue update path returned report evidence, but the validation result summary was not preserved.",
    });
  }

  if (item && item.validationStatus !== expectedValidationStatus) {
    warnings.push({
      code: "queue_validation_status_unavailable",
      message:
        "Queue update path did not preserve the requested validation status.",
    });
  }

  if ((report.rawReportPreview ?? "").length >= RAW_REPORT_PREVIEW_CAP) {
    warnings.push({
      code: "summary_capped",
      message:
        "Validation evidence summary was capped before storing it in Queue state.",
    });
  }

  return warnings;
}

function validationStateSummaryText({
  item,
  report,
  state,
}: {
  item: AgentQueueTask | QueueWidgetItemSnapshot | null;
  report: AgentQueueWorkerExecutionReport | null;
  state: QueueValidationState;
}) {
  if (report?.summary) {
    return report.summary;
  }

  const status = validationStatusFor(item);
  if (status) {
    return `Queue validation status is ${status}.`;
  }

  return `Queue validation state is ${state}.`;
}

function latestWorkerReport(
  item: AgentQueueTask | QueueWidgetItemSnapshot | null,
): AgentQueueWorkerExecutionReport | null {
  if (!item || !("workerExecutionReports" in item)) {
    return null;
  }

  const reports = item.workerExecutionReports ?? [];
  return reports[reports.length - 1] ?? null;
}

function validationStatusFor(
  item: AgentQueueTask | QueueWidgetItemSnapshot | null,
): AgentQueueTaskValidationStatus | null {
  const status = item?.validationStatus ?? null;
  return status === "not_started" ||
    status === "validating" ||
    status === "passed" ||
    status === "failed" ||
    status === "needs_review"
    ? status
    : null;
}

function queueItemIdFor(item: AgentQueueTask | QueueWidgetItemSnapshot | null) {
  if (!item) {
    return null;
  }

  return "queueItemId" in item ? item.queueItemId : item.id;
}

function isEvidenceStale(
  item: AgentQueueTask | QueueWidgetItemSnapshot | null,
  evidenceAt: string | null,
) {
  if (!item?.updatedAt || !evidenceAt) {
    return false;
  }

  return Date.parse(evidenceAt) < Date.parse(item.updatedAt);
}

function commandLabel(
  command: ValidationSuiteResult["commandResults"][number],
) {
  return `${command.title} (${command.status})`;
}
