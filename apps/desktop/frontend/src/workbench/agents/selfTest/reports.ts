import { createSelfTestInstruction } from "./instructions";
import type {
  HobitAgentSelfTestReport,
  HobitAgentSelfTestResult,
} from "./types";

export function createSelfTestReport({
  instruction = createSelfTestInstruction(),
  request,
  results,
}: {
  instruction?: HobitAgentSelfTestReport["instruction"];
  request: HobitAgentSelfTestReport["request"];
  results: readonly HobitAgentSelfTestResult[];
}): HobitAgentSelfTestReport {
  const stableResults = [...results].sort((left, right) =>
    left.caseId.localeCompare(right.caseId),
  );

  return {
    instruction,
    request,
    results: stableResults,
    summary: summarizeSelfTestReport(stableResults),
  };
}

export function summarizeSelfTestReport(
  reportOrResults: HobitAgentSelfTestReport | readonly HobitAgentSelfTestResult[],
): HobitAgentSelfTestReport["summary"] {
  const results = isSelfTestReport(reportOrResults)
    ? reportOrResults.results
    : reportOrResults;

  return {
    blocked: results.filter(
      (result: HobitAgentSelfTestResult) => result.status === "blocked",
    ).length,
    failed: results.filter(
      (result: HobitAgentSelfTestResult) => result.status === "failed",
    ).length,
    hiddenSideEffectFlags: results.reduce(
      (count: number, result: HobitAgentSelfTestResult) =>
        count + result.hiddenSideEffectFlags.length,
      0,
    ),
    passed: results.filter(
      (result: HobitAgentSelfTestResult) => result.status === "passed",
    ).length,
    skipped: results.filter(
      (result: HobitAgentSelfTestResult) => result.status === "skipped",
    ).length,
    total: results.length,
  };
}

function isSelfTestReport(
  value: HobitAgentSelfTestReport | readonly HobitAgentSelfTestResult[],
): value is HobitAgentSelfTestReport {
  return !Array.isArray(value);
}
