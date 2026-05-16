import type { AgentExecutorRunDetail } from "../workspace/types";
import type { CodexDirectWorkLiveRun } from "./CodexDirectWorkLiveLog";
import type { CodexDirectWorkRequestDraft } from "./CodexDirectWorkTypes";

export function handoffStartedAtMs(startedAt: string) {
  const parsedStartedAt = Date.parse(startedAt);

  return Number.isFinite(parsedStartedAt) ? parsedStartedAt : Date.now();
}

export function queueHandoffRequestDraft(
  repoRoot: string,
): CodexDirectWorkRequestDraft {
  return {
    approvalPolicy: "never",
    codexExecutable: "codex",
    operatorPrompt: "",
    repoRoot,
    sandbox: "read_only",
  };
}

export function queueHandoffLiveRun(
  runId: string,
  startedAtMs: number,
): CodexDirectWorkLiveRun {
  return {
    completedAtMs: null,
    durationMs: null,
    errorMessage: null,
    exitCode: null,
    failedStage: null,
    finalMessage: null,
    finalStatus: null,
    runId,
    startedAtMs,
    status: "running",
    stderrPreview: "",
    stdoutPreview: "",
  };
}

export function queueHandoffLiveRunFromDetail(
  detail: AgentExecutorRunDetail,
  fallbackStartedAtMs: number | null,
  receivedAtMs = Date.now(),
): CodexDirectWorkLiveRun {
  const payload = queueHandoffResultPayload(detail.resultPayload);
  const startedAtMs =
    timestampToMs(detail.summary.startedAt) ?? fallbackStartedAtMs;
  const completedAtMs =
    timestampToMs(detail.summary.finishedAt) ?? receivedAtMs;

  return {
    completedAtMs,
    durationMs:
      detail.summary.durationMs ??
      durationFromTimestamps(startedAtMs, completedAtMs),
    errorMessage: detail.errorMessage ?? payload.errorMessage,
    exitCode: payload.exitCode,
    failedStage: payload.failedStage,
    finalMessage: detail.finalMessage ?? detail.resultContent,
    finalStatus: detail.resultStatus ?? payload.finalStatus,
    runId: detail.summary.runId,
    startedAtMs,
    status: detail.summary.status,
    stderrPreview: detail.stderrPreview ?? "",
    stdoutPreview: detail.stdoutPreview ?? "",
  };
}

function timestampToMs(value: string | null) {
  if (!value) {
    return null;
  }

  const parsedValue = Date.parse(value);
  return Number.isFinite(parsedValue) ? parsedValue : null;
}

function durationFromTimestamps(
  startedAtMs: number | null,
  completedAtMs: number | null,
) {
  if (startedAtMs === null || completedAtMs === null) {
    return null;
  }

  return Math.max(0, completedAtMs - startedAtMs);
}

function queueHandoffResultPayload(payload: string | null) {
  if (!payload) {
    return emptyQueueHandoffResultPayload();
  }

  try {
    const value = JSON.parse(payload) as Record<string, unknown>;

    return {
      errorMessage: stringField(value.error_message),
      exitCode: numberField(value.exit_code),
      failedStage: stringField(value.failed_stage),
      finalStatus: stringField(value.status),
    };
  } catch {
    return emptyQueueHandoffResultPayload();
  }
}

function emptyQueueHandoffResultPayload() {
  return {
    errorMessage: null,
    exitCode: null,
    failedStage: null,
    finalStatus: null,
  };
}

function numberField(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function stringField(value: unknown) {
  return typeof value === "string" && value.trim() ? value : null;
}
