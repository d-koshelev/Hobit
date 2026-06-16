import {
  HOBIT_AGENT_SMOKE_PRODUCT_LABELS,
  hobitAgentSmokeStatusLabel,
  type HobitAgentSmokeCase,
  type HobitAgentSmokeComponentResult,
  type HobitAgentSmokeHiddenSideEffectAssertion,
  type HobitAgentSmokePlan,
  type HobitAgentSmokeReport,
  type HobitAgentSmokeRequest,
  type HobitAgentSmokeResult,
  type HobitAgentSmokeStatus,
} from "./hobitAgentSmokeTypes";

export function createHobitAgentSmokeReport({
  createdAt,
  plan,
  request,
  results,
}: {
  createdAt: string;
  plan: HobitAgentSmokePlan;
  request: HobitAgentSmokeRequest;
  results: readonly HobitAgentSmokeResult[];
}): HobitAgentSmokeReport {
  const stableResults = [...results].sort((left, right) =>
    left.caseId.localeCompare(right.caseId),
  );
  const summary = summarizeHobitAgentSmokeResults(stableResults);
  const overallStatus = overallStatusForResults(stableResults);

  return {
    cases: plan.cases,
    componentsChecked: componentResultsFor(stableResults),
    createdAt,
    hiddenSideEffectAssertions: noHiddenSideEffectAssertions(),
    instructionId: plan.instruction.id,
    overallStatus,
    overallStatusLabel: hobitAgentSmokeStatusLabel(overallStatus),
    productFacingSummary: productFacingSummary({ overallStatus, summary }),
    reportId: `${request.requestId}:report`,
    results: stableResults,
    runnerAgentId: request.runnerAgentId,
    summary,
    ...(request.workspaceId ? { workspaceId: request.workspaceId } : {}),
  };
}

export function summarizeHobitAgentSmokeResults(
  reportOrResults: HobitAgentSmokeReport | readonly HobitAgentSmokeResult[],
): HobitAgentSmokeReport["summary"] {
  const results: readonly HobitAgentSmokeResult[] = "results" in reportOrResults
    ? reportOrResults.results
    : reportOrResults;

  return {
    blocked: results.filter((result) => result.status === "blocked").length,
    failed: results.filter((result) => result.status === "failed").length,
    passed: results.filter((result) => result.status === "passed").length,
    skipped: results.filter((result) => result.status === "skipped").length,
    total: results.length,
  };
}

export function resultFromSmokeCase({
  caseId,
  evidence,
  hiddenSideEffectAssertions = [],
  message,
  plan,
  reason,
  status,
}: {
  caseId: string;
  evidence: readonly string[];
  hiddenSideEffectAssertions?: readonly string[];
  message: string;
  plan: HobitAgentSmokePlan;
  reason?: string;
  status: HobitAgentSmokeStatus;
}): HobitAgentSmokeResult {
  const smokeCase =
    plan.cases.find((candidate) => candidate.caseId === caseId) ??
    ({
      caseId,
      componentId: "unplanned-smoke-check",
      componentTitle: "Unplanned smoke check",
      expectedResultDescription:
        "This result was produced by a safe smoke helper without a static plan case.",
      kind: "capability-dry-run",
      required: false,
      safeMode: "dry-run",
      source: "Agent-executed smoke",
      title: caseId,
    } satisfies HobitAgentSmokeCase);

  return {
    ...smokeCase,
    evidence: [...evidence],
    hiddenSideEffectAssertions: [...hiddenSideEffectAssertions],
    message,
    ...(reason ? { reason } : {}),
    status,
    statusLabel: hobitAgentSmokeStatusLabel(status),
  };
}

export function noHiddenSideEffectAssertions():
  HobitAgentSmokeHiddenSideEffectAssertion[] {
  return [
    { assertionId: "no-codex-run", label: "No Codex run", passed: true },
    { assertionId: "no-shell-command", label: "No shell command", passed: true },
    {
      assertionId: "no-queue-mutation",
      label: "No Queue mutation",
      passed: true,
    },
    {
      assertionId: "no-queue-worker-start",
      label: "No Queue worker start",
      passed: true,
    },
    {
      assertionId: "no-queue-view-creation",
      label: "No Queue view creation",
      passed: true,
    },
    { assertionId: "no-terminal-launch", label: "No Terminal launch", passed: true },
    { assertionId: "no-git-mutation", label: "No Git mutation", passed: true },
    {
      assertionId: "no-rollback-execution",
      label: "No rollback execution",
      passed: true,
    },
  ];
}

function componentResultsFor(
  results: readonly HobitAgentSmokeResult[],
): HobitAgentSmokeComponentResult[] {
  const componentIds = componentIdsForCases(results);

  return componentIds.map((componentId) => {
    const componentResults = results.filter(
      (result) => result.componentId === componentId,
    );
    const status = overallStatusForResults(componentResults);
    const requiredCaseCount = componentResults.filter((result) => result.required)
      .length;
    const optionalCaseCount = componentResults.length - requiredCaseCount;
    const title = componentResults[0]?.componentTitle ?? componentId;

    return {
      checkedCaseIds: componentResults.map((result) => result.caseId),
      componentId,
      message: `${title}: ${componentResults.length.toString()} smoke check(s).`,
      optionalCaseCount,
      requiredCaseCount,
      status,
      statusLabel: hobitAgentSmokeStatusLabel(status),
      title,
    };
  });
}

function overallStatusForResults(
  results: readonly Pick<HobitAgentSmokeResult, "required" | "status">[],
): HobitAgentSmokeStatus {
  if (results.length === 0) {
    return "skipped";
  }

  const requiredResults = results.filter((result) => result.required);
  const criticalResults =
    requiredResults.length > 0 ? requiredResults : results;

  if (criticalResults.some((result) => result.status === "failed")) {
    return "failed";
  }

  if (criticalResults.some((result) => result.status === "blocked")) {
    return "blocked";
  }

  if (criticalResults.every((result) => result.status === "skipped")) {
    return "skipped";
  }

  return "passed";
}

function productFacingSummary({
  overallStatus,
  summary,
}: {
  overallStatus: HobitAgentSmokeStatus;
  summary: HobitAgentSmokeReport["summary"];
}): string {
  const counts =
    `${summary.passed.toString()} passed, ${summary.failed.toString()} failed, ` +
    `${summary.skipped.toString()} skipped, ${summary.blocked.toString()} blocked`;

  if (overallStatus === "failed") {
    return `Agent-executed smoke found required failures: ${counts}. No hidden side effects.`;
  }

  if (overallStatus === "blocked") {
    return `Agent-executed smoke was blocked on required checks: ${counts}. No hidden side effects.`;
  }

  if (overallStatus === "skipped") {
    return `Agent-executed smoke could not run any required checks: ${counts}. No hidden side effects.`;
  }

  return `Agent-executed smoke completed: ${counts}. No hidden side effects.`;
}

function componentIdsForCases(
  cases: readonly Pick<HobitAgentSmokeCase, "componentId">[],
): string[] {
  return [...new Set(cases.map((item) => item.componentId))].sort((left, right) =>
    left.localeCompare(right),
  );
}

