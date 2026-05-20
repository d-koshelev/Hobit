import type { AgentExecutorRunSummary } from "../../workspace/types";
import {
  formatRawPayload,
  formatRunDuration,
  historyRunMetaLine,
  previewOutput,
  runModeLabel,
  statusBadgeVariant,
  statusLabel,
  timestampToMs,
  valueOrNone,
} from "./agentExecutorRunHistoryFormatters";

describe("agent executor run history formatters", () => {
  it("preserves status labels and badge variants", () => {
    expect(statusLabel("failed_to_start")).toBe("failed to start");
    expect(statusBadgeVariant("completed")).toBe("success");
    expect(statusBadgeVariant("running")).toBe("info");
    expect(statusBadgeVariant("timed_out")).toBe("warning");
    expect(statusBadgeVariant("failed_to_start")).toBe("error");
    expect(statusBadgeVariant("unknown")).toBe("neutral");
  });

  it("formats run modes without changing validation precedence", () => {
    expect(runModeLabel(runSummary({ validationProfile: "changed" }))).toBe(
      "Validation changed",
    );
    expect(runModeLabel(runSummary({ mode: "codex direct work" }))).toBe(
      "codex direct work",
    );
    expect(
      runModeLabel(
        runSummary({
          commandKind: "direct_work",
          mode: null,
          resultType: "codex",
        }),
      ),
    ).toBe("direct_work");
    expect(
      runModeLabel(
        runSummary({ commandKind: null, mode: null, resultType: null }),
      ),
    ).toBe("Direct Work");
  });

  it("keeps duration and history meta fallback behavior", () => {
    expect(formatRunDuration(runSummary({ durationMs: 75 }))).toBe("75ms");
    expect(
      formatRunDuration(
        runSummary({
          durationMs: null,
          finishedAt: "2000",
          startedAt: "1000",
        }),
      ),
    ).toBe("16m 40s");
    expect(formatRunDuration(runSummary({ durationMs: null }))).toBe(
      "Unknown",
    );
    expect(
      historyRunMetaLine(
        runSummary({
          durationMs: null,
          finishedAt: "not-a-date",
          startedAt: "not-a-date",
        }),
      ),
    ).toBe("Started not-a-date - Completed not-a-date");
  });

  it("preserves output preview truncation and raw payload formatting", () => {
    expect(previewOutput("abc", 3)).toBe("abc");
    expect(previewOutput("abcd", 3)).toBe(
      "abc\n[Preview truncated in UI.]",
    );
    expect(formatRawPayload('{"ok":true}')).toBe('{\n  "ok": true\n}');
    expect(formatRawPayload("not-json")).toBe("not-json");
  });

  it("keeps timestamp and empty value helpers stable", () => {
    expect(timestampToMs("1000")).toBe(1_000_000);
    expect(timestampToMs("10000000001")).toBe(10_000_000_001);
    expect(timestampToMs("not-a-date")).toBeNull();
    expect(valueOrNone("value")).toBe("value");
    expect(valueOrNone("   ")).toBe("None");
    expect(valueOrNone(null)).toBe("None");
  });
});

function runSummary(
  overrides: Partial<AgentExecutorRunSummary> = {},
): AgentExecutorRunSummary {
  return {
    commandKind: null,
    durationMs: null,
    finishedAt: null,
    hasResult: true,
    logCount: null,
    mode: null,
    repoRoot: null,
    resultType: null,
    runId: "run-1",
    startedAt: "not-a-date",
    status: "completed",
    title: "Run",
    validationProfile: null,
    validationStatus: null,
    ...overrides,
  };
}
