import type { DirectWorkStreamEvent } from "../../workspace/types";
import { previewLiveOutput } from "./codexDirectWorkLogFormatters";
import {
  cappedLiveLogEntries,
  liveLogEntryFromEvent,
  liveRunFromEvent,
  syntheticStartedLogEntry,
} from "./codexDirectWorkLogViewModel";

describe("codex direct work log view model", () => {
  it("formats stdout and stderr stream events without changing labels or tones", () => {
    const stdoutEntry = liveLogEntryFromEvent(
      streamEvent({ eventKind: "stdout_line", line: "built ok" }),
      1_000,
    );
    const stderrEntry = liveLogEntryFromEvent(
      streamEvent({ eventKind: "stderr_line", line: "compile failed" }),
      1_100,
    );
    const informationalStderrEntry = liveLogEntryFromEvent(
      streamEvent({
        eventKind: "stderr_line",
        line: "Reading additional input from stdin...",
      }),
      1_200,
    );

    expect(stdoutEntry.label).toBe("Runtime output");
    expect(stdoutEntry.text).toBe("built ok");
    expect(stdoutEntry.tone).toBe("stdout");
    expect(stderrEntry.label).toBe("Error output");
    expect(stderrEntry.text).toBe("compile failed");
    expect(stderrEntry.tone).toBe("stderr");
    expect(informationalStderrEntry.label).toBe("Runtime note");
    expect(informationalStderrEntry.tone).toBe("info");
  });

  it("keeps final failure detail formatting for log rows", () => {
    const entry = liveLogEntryFromEvent(
      streamEvent({
        elapsedMs: 2400,
        errorMessage: "Command failed",
        eventKind: "failed",
        exitCode: 1,
        failedStage: "codex_exec",
        finalStatus: "failed",
        isFinal: true,
        status: "failed",
        stderrPreview: "fatal error",
      }),
      5_000,
    );

    expect(entry.label).toBe("Run failed");
    expect(entry.text).toBe("Command failed");
    expect(entry.detail).toBe(
      "final status: failed; stage: codex_exec; exit code: 1; stderr: fatal error",
    );
    expect(entry.tone).toBe("error");
  });

  it("deduplicates started entries and computes visible event deltas", () => {
    const entries = cappedLiveLogEntries([
      syntheticStartedLogEntry("run-1", 1_000),
      syntheticStartedLogEntry("run-1", 1_100),
      liveLogEntryFromEvent(
        streamEvent({ elapsedMs: 75, eventKind: "stdout_line", line: "one" }),
        1_200,
      ),
      liveLogEntryFromEvent(
        streamEvent({ elapsedMs: 125, eventKind: "stdout_line", line: "two" }),
        1_300,
      ),
    ]);

    expect(entries.map((entry) => entry.id)).toEqual([
      "run-1-synthetic-started",
      "run-1-75-stdout_line-one",
      "run-1-125-stdout_line-two",
    ]);
    expect(entries.map((entry) => entry.deltaMs)).toEqual([null, 75, 50]);
  });

  it("updates live run previews and final state from stream events", () => {
    const startedRun = liveRunFromEvent(
      null,
      streamEvent({ elapsedMs: 0, eventKind: "started" }),
      10_000,
    );
    const outputRun = liveRunFromEvent(
      startedRun,
      streamEvent({ elapsedMs: 50, eventKind: "stdout_line", line: "line 1" }),
      10_050,
    );
    const finalRun = liveRunFromEvent(
      outputRun,
      streamEvent({
        elapsedMs: 100,
        eventKind: "completed",
        finalStatus: "completed",
        isFinal: true,
        status: "completed",
      }),
      10_100,
    );

    expect(outputRun.stdoutPreview).toBe("line 1");
    expect(finalRun.status).toBe("completed");
    expect(finalRun.completedAtMs).toBe(10_100);
    expect(finalRun.durationMs).toBe(100);
    expect(finalRun.finalStatus).toBe("completed");
  });

  it("preserves live output preview truncation text", () => {
    const preview = previewLiveOutput("x".repeat(4001));

    expect(preview.startsWith("x".repeat(4000))).toBe(true);
    expect(preview.endsWith("\n[Preview truncated in UI.]")).toBe(true);
  });
});

function streamEvent(
  overrides: Partial<DirectWorkStreamEvent>,
): DirectWorkStreamEvent {
  return {
    elapsedMs: 0,
    errorMessage: null,
    eventKind: "started",
    exitCode: null,
    failedStage: null,
    finalStatus: null,
    isFinal: false,
    line: null,
    parsedCodexEventType: null,
    runId: "run-1",
    status: null,
    stderrPreview: null,
    text: null,
    widgetInstanceId: "executor-1",
    workbenchId: "workbench-1",
    workspaceId: "workspace-1",
    ...overrides,
  };
}
