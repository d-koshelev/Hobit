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
