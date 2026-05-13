import type {
  DirectWorkStreamEvent,
  RunCodexDirectWorkResponse,
} from "../workspace/types";

export function directWorkResultFromStreamEvent(
  event: DirectWorkStreamEvent,
): RunCodexDirectWorkResponse {
  return {
    runId: event.runId,
    resultId: "",
    resultType: "codex_direct_work_result",
    executorKind: "codex_cli",
    mode: "direct_work",
    repoRoot: "",
    sandbox: "read_only",
    approvalPolicy: "never",
    commandSummary: [],
    status: event.status ?? event.eventKind,
    exitCode: event.exitCode,
    stdout: "",
    stderr: event.stderrPreview ?? "",
    stdoutTruncated: false,
    stderrTruncated: false,
    finalMessage: null,
    durationMs: event.elapsedMs,
    errorMessage:
      event.eventKind === "failed" || event.eventKind === "timed_out"
        ? (event.errorMessage ?? event.text ?? event.line ?? event.status)
        : null,
    noAutoCommit: true,
    noAutoPush: true,
    gitMutationsPerformedByHobit: false,
  };
}
