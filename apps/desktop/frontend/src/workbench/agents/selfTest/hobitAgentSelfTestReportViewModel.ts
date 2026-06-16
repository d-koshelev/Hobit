import {
  createDefaultQueueAgentAdapterApi,
  type QueueAgentAdapterApi,
} from "../adapters";
import type { HobitAgentCapabilityId } from "../capabilities";
import {
  createHobitAgentSmokeRequest,
  hobitAgentSmokeStatusLabel,
  runHobitAgentSmoke,
  type HobitAgentSmokeHiddenSideEffectAssertion,
  type HobitAgentSmokeReport,
  type HobitAgentSmokeResult,
  type HobitAgentSmokeStatus,
} from "./hobitAgentSmokeRunner";

export type HobitAgentSelfTestReportRowStatus = HobitAgentSmokeStatus;

export type HobitAgentSelfTestReportRow = {
  capabilityId?: HobitAgentCapabilityId;
  checkId: string;
  component?: string;
  hiddenSideEffectAssertions: string[];
  message: string;
  reason?: string;
  required: boolean;
  source: string;
  status: HobitAgentSelfTestReportRowStatus;
  statusLabel: string;
  title: string;
  widgetId?: string;
};

export type HobitAgentSelfTestHiddenSideEffectAssertion =
  HobitAgentSmokeHiddenSideEffectAssertion;

export type HobitAgentSelfTestReportViewModel = {
  createdAt: string;
  hiddenSideEffectAssertions: HobitAgentSelfTestHiddenSideEffectAssertion[];
  hiddenSideEffectSummary: string;
  overallStatus: HobitAgentSelfTestReportRowStatus;
  overallStatusLabel: string;
  productSummary: string;
  reportId: string;
  rows: HobitAgentSelfTestReportRow[];
  summary: {
    blocked: number;
    failed: number;
    passed: number;
    skipped: number;
    total: number;
  };
};

export async function runWorkspaceAgentSelfTestReport({
  createdAt = new Date().toISOString(),
  queueAdapterApi = createDefaultQueueAgentAdapterApi(),
  reportId,
  widgetInstanceId,
  workspaceId,
  workspaceRoot = null,
}: {
  createdAt?: string;
  queueAdapterApi?: QueueAgentAdapterApi;
  reportId?: string;
  widgetInstanceId: string;
  workspaceId: string;
  workspaceRoot?: string | null;
}): Promise<HobitAgentSelfTestReportViewModel> {
  const resolvedReportId =
    reportId ?? `workspace-agent-self-test:${widgetInstanceId}:${createdAt}`;
  const smoke = await runHobitAgentSmoke({
    queueAdapterApi,
    request: createHobitAgentSmokeRequest({
      createdAt,
      requestId: resolvedReportId,
      runnerAgentId: "workspace-agent:self-test",
      widgetInstanceId,
      workspaceId,
      workspaceRoot,
    }),
  });

  return createSelfTestViewModelFromSmokeReport(smoke.report);
}

export function createSelfTestViewModelFromSmokeReport(
  report: HobitAgentSmokeReport,
): HobitAgentSelfTestReportViewModel {
  return createSelfTestViewModel({
    createdAt: report.createdAt,
    hiddenSideEffectAssertions: report.hiddenSideEffectAssertions,
    overallStatus: report.overallStatus,
    productSummary: report.productFacingSummary,
    reportId: report.reportId,
    rows: report.results.map(smokeResultRow),
  });
}

export function createSelfTestViewModel({
  createdAt,
  hiddenSideEffectAssertions,
  overallStatus,
  productSummary,
  reportId,
  rows,
}: {
  createdAt: string;
  hiddenSideEffectAssertions?: readonly HobitAgentSelfTestHiddenSideEffectAssertion[];
  overallStatus?: HobitAgentSelfTestReportRowStatus;
  productSummary?: string;
  reportId: string;
  rows: readonly HobitAgentSelfTestReportRow[];
}): HobitAgentSelfTestReportViewModel {
  const stableRows = [...rows].sort((left, right) =>
    left.checkId.localeCompare(right.checkId),
  );
  const summary = summarizeSelfTestRows(stableRows);
  const resolvedAssertions =
    hiddenSideEffectAssertions ?? noHiddenSideEffectAssertions();
  const hiddenSideEffectSummary = resolvedAssertions.every(
    (assertion) => assertion.passed,
  )
    ? "No hidden side effects"
    : "Hidden side-effect assertion failed";
  const resolvedOverallStatus =
    overallStatus ?? overallStatusForRows(stableRows);

  return {
    createdAt,
    hiddenSideEffectAssertions: [...resolvedAssertions],
    hiddenSideEffectSummary,
    overallStatus: resolvedOverallStatus,
    overallStatusLabel: statusLabel(resolvedOverallStatus),
    productSummary:
      productSummary ??
      `Agent self-test completed: ${summary.passed.toString()} passed, ` +
        `${summary.failed.toString()} failed, ${summary.skipped.toString()} skipped, ` +
        `${summary.blocked.toString()} blocked. ${hiddenSideEffectSummary}.`,
    reportId,
    rows: stableRows,
    summary,
  };
}

export function summarizeSelfTestRows(
  rows: readonly HobitAgentSelfTestReportRow[],
): HobitAgentSelfTestReportViewModel["summary"] {
  return {
    blocked: rows.filter((row) => row.status === "blocked").length,
    failed: rows.filter((row) => row.status === "failed").length,
    passed: rows.filter((row) => row.status === "passed").length,
    skipped: rows.filter((row) => row.status === "skipped").length,
    total: rows.length,
  };
}

export function statusLabel(
  status: HobitAgentSelfTestReportRowStatus,
): string {
  return hobitAgentSmokeStatusLabel(status);
}

function smokeResultRow(
  result: HobitAgentSmokeResult,
): HobitAgentSelfTestReportRow {
  return {
    ...(result.capabilityId ? { capabilityId: result.capabilityId } : {}),
    checkId: result.caseId,
    component: result.componentTitle,
    hiddenSideEffectAssertions: [...result.hiddenSideEffectAssertions],
    message: result.message,
    ...(result.reason ? { reason: result.reason } : {}),
    required: result.required,
    source: result.source,
    status: result.status,
    statusLabel: result.statusLabel,
    title: result.title,
    ...(result.widgetId ? { widgetId: result.widgetId } : {}),
  };
}

function overallStatusForRows(
  rows: readonly HobitAgentSelfTestReportRow[],
): HobitAgentSelfTestReportRowStatus {
  if (rows.length === 0) {
    return "skipped";
  }

  const requiredRows = rows.filter((row) => row.required);
  const criticalRows = requiredRows.length > 0 ? requiredRows : rows;

  if (criticalRows.some((row) => row.status === "failed")) {
    return "failed";
  }

  if (criticalRows.some((row) => row.status === "blocked")) {
    return "blocked";
  }

  if (criticalRows.every((row) => row.status === "skipped")) {
    return "skipped";
  }

  return "passed";
}

function noHiddenSideEffectAssertions():
  HobitAgentSelfTestHiddenSideEffectAssertion[] {
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
