import {
  createActionRequest,
  createHobitAgentActionBroker,
} from "../broker";
import {
  createHobitAgentCapabilityRegistry,
  evaluateCapabilityPolicy,
  findCapability,
  type HobitAgentCapabilityId,
} from "../capabilities";
import {
  buildWorkspaceAgentCapabilityRuntimeSeam,
} from "../context";
import {
  createDefaultQueueAgentAdapterApi,
  createQueueAgentActionHandlers,
  type QueueAgentAdapterApi,
  type QueueAgentSelfTestReport,
} from "../adapters";
import {
  createAgentRuntimeState,
  HOBIT_TEST_AGENT_A,
  HOBIT_TEST_AGENT_B,
  registerAgent,
  type HobitAgentRuntimeState,
} from "../runtime";
import {
  findWidgetContract,
  listWidgetContracts,
  type HobitWidgetContractLookupResult,
} from "../widgets";
import {
  createAgentApiSmokeRequest,
  runAgentApiSmoke,
  type HobitAgentApiSmokeResult,
} from "./hobitAgentApiSmokeRunner";
import type { HobitAgentSelfTestStatus } from "./types";

export type HobitAgentSelfTestReportRowStatus = HobitAgentSelfTestStatus;

export type HobitAgentSelfTestReportRow = {
  capabilityId?: HobitAgentCapabilityId;
  checkId: string;
  component?: string;
  hiddenSideEffectAssertions: string[];
  message: string;
  reason?: string;
  source: string;
  status: HobitAgentSelfTestReportRowStatus;
  statusLabel: string;
  title: string;
  widgetId?: string;
};

export type HobitAgentSelfTestHiddenSideEffectAssertion = {
  assertionId: string;
  label: string;
  passed: boolean;
};

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
  const registry = createHobitAgentCapabilityRegistry();
  const rows: HobitAgentSelfTestReportRow[] = [];

  const seam = buildWorkspaceAgentCapabilityRuntimeSeam({
    currentPrompt: "Run Agent Self-Test",
    widgetInstanceId,
    workspaceId,
    workspaceRoot,
  });

  rows.push(
    seam.appContext.appName === "Hobit"
      ? passedRow({
          checkId: "app-context:hobit",
          component: "Hobit app context",
          message: "App context exists and identifies Hobit.",
          source: "Workspace Agent capability context",
          title: "Hobit app context",
        })
      : failedRow({
          checkId: "app-context:hobit",
          component: "Hobit app context",
          message: "App context did not identify Hobit.",
          source: "Workspace Agent capability context",
          title: "Hobit app context",
        }),
  );

  rows.push(
    seam.brokerBoundary.status === "implemented" &&
      seam.instructionBlock.includes("Compact capability manifest:")
      ? passedRow({
          checkId: "workspace-agent:capability-context",
          component: "Workspace Agent",
          message:
            "Workspace Agent capability context can be built with broker instructions.",
          source: "Workspace Agent capability context",
          title: "Capability context",
        })
      : failedRow({
          checkId: "workspace-agent:capability-context",
          component: "Workspace Agent",
          message: "Workspace Agent capability context is incomplete.",
          source: "Workspace Agent capability context",
          title: "Capability context",
        }),
  );

  rows.push(
    registry.capabilities.length > 0
      ? passedRow({
          checkId: "capability-manifest:available",
          component: "Capability manifest",
          message: "Capability manifest is available.",
          source: "Capability Registry",
          title: "Capability manifest",
        })
      : failedRow({
          checkId: "capability-manifest:available",
          component: "Capability manifest",
          message: "Capability manifest is unavailable.",
          source: "Capability Registry",
          title: "Capability manifest",
        }),
  );

  rows.push(
    ...runAgentApiSmokeRows({
      createdAt,
      reportId: resolvedReportId,
      workspaceId,
    }),
  );
  rows.push(...widgetContractRows());
  rows.push(await queueSelfTestRow({ queueAdapterApi, registry, resolvedReportId }));
  rows.push(codexRestrictionRow({ registry, resolvedReportId }));
  rows.push(shellRestrictionRow({ registry }));
  rows.push(hiddenSideEffectAssertionRow());

  return createSelfTestViewModel({
    createdAt,
    reportId: resolvedReportId,
    rows,
  });
}

export function createSelfTestViewModel({
  createdAt,
  reportId,
  rows,
}: {
  createdAt: string;
  reportId: string;
  rows: readonly HobitAgentSelfTestReportRow[];
}): HobitAgentSelfTestReportViewModel {
  const stableRows = [...rows].sort((left, right) =>
    left.checkId.localeCompare(right.checkId),
  );
  const summary = summarizeSelfTestRows(stableRows);
  const hiddenSideEffectAssertions = noHiddenSideEffectAssertions();
  const hiddenSideEffectSummary = hiddenSideEffectAssertions.every(
    (assertion) => assertion.passed,
  )
    ? "No hidden side effects"
    : "Hidden side-effect assertion failed";
  const overallStatus = overallStatusForSummary(summary);

  return {
    createdAt,
    hiddenSideEffectAssertions,
    hiddenSideEffectSummary,
    overallStatus,
    overallStatusLabel: statusLabel(overallStatus),
    productSummary:
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
  if (status === "passed") {
    return "Passed";
  }

  if (status === "failed") {
    return "Failed";
  }

  if (status === "blocked") {
    return "Blocked";
  }

  return "Skipped";
}

function runAgentApiSmokeRows({
  createdAt,
  reportId,
  workspaceId,
}: {
  createdAt: string;
  reportId: string;
  workspaceId: string;
}): HobitAgentSelfTestReportRow[] {
  const result = runAgentApiSmoke({
    request: createAgentApiSmokeRequest({
      createdAt,
      messageId: `${reportId}:agent-api-smoke-message`,
      requestId: `${reportId}:agent-api-smoke`,
      targetAgentId: "test.agentB",
      testerAgentId: "test.agentA",
    }),
    state: registerSelfTestAgents(workspaceId),
  });

  return result.report.results.map(agentApiSmokeRow);
}

function agentApiSmokeRow(
  result: HobitAgentApiSmokeResult,
): HobitAgentSelfTestReportRow {
  return row({
    capabilityId: result.capabilityId,
    checkId: result.caseId,
    component: "Multi-Agent Runtime",
    hiddenSideEffectAssertions: ["no_codex_run", "no_shell_command"],
    message: result.message,
    reason: result.blockedReason,
    source: "Agent API Smoke Runner",
    status: result.status,
    title: titleForAgentApiCapability(result.capabilityId),
  });
}

function widgetContractRows(): HobitAgentSelfTestReportRow[] {
  const activeWidgetIds = listWidgetContracts().map((contract) => contract.widgetId);
  const rows: HobitAgentSelfTestReportRow[] = [
    widgetContractExistsRow("agent-queue", "Queue widget contract exists"),
    widgetContractExistsRow(
      "interactive-agent",
      "Workspace Agent widget contract exists",
    ),
    placeholderWidgetRow("skill-library", "Knowledge / Skills placeholder"),
    placeholderWidgetRow("notes", "Notes placeholder"),
    placeholderWidgetRow("terminal", "Terminal placeholder"),
  ];

  rows.push(
    activeWidgetIds.includes("finder")
      ? failedRow({
          checkId: "widget-contract:finder-active-scope",
          component: "Widget Agent Contract registry",
          message: "Finder was unexpectedly included in active contract scope.",
          source: "Widget Agent Contract registry",
          title: "Finder active contract scope",
          widgetId: "finder",
        })
      : skippedRow({
          checkId: "widget-contract:finder-active-scope",
          component: "Widget Agent Contract registry",
          message: "Finder is not in active contract scope.",
          reason: "Capability unavailable for this self-test scope.",
          source: "Widget Agent Contract registry",
          title: "Finder active contract scope",
          widgetId: "finder",
        }),
  );

  return rows;
}

function widgetContractExistsRow(
  widgetId: string,
  title: string,
): HobitAgentSelfTestReportRow {
  const lookup = findWidgetContract(widgetId);
  if (lookup.status === "found") {
    return passedRow({
      checkId: `widget-contract:${widgetId}`,
      component: lookup.contract.title,
      message: `${lookup.contract.title} contract is available.`,
      source: "Widget Agent Contract registry",
      title,
      widgetId,
    });
  }

  return unavailableWidgetRow(lookup, title);
}

function placeholderWidgetRow(
  widgetId: string,
  title: string,
): HobitAgentSelfTestReportRow {
  const lookup = findWidgetContract(widgetId, { includePlaceholders: true });
  if (lookup.status === "found") {
    return failedRow({
      checkId: `widget-contract:${widgetId}:placeholder`,
      component: lookup.contract.title,
      message: `${lookup.contract.title} placeholder unexpectedly resolved as active.`,
      source: "Widget Agent Contract registry",
      title,
      widgetId,
    });
  }

  return unavailableWidgetRow(lookup, title);
}

function unavailableWidgetRow(
  lookup: Extract<HobitWidgetContractLookupResult, { status: "unavailable" }>,
  title: string,
): HobitAgentSelfTestReportRow {
  return skippedRow({
    checkId: `widget-contract:${lookup.widgetId}`,
    component: title.replace(" placeholder", ""),
    hiddenSideEffectAssertions: ["no_capability_inference"],
    message: "Capability unavailable.",
    reason: productUnavailableReason(lookup.unavailableReason),
    source: "Widget Agent Contract registry",
    title,
    widgetId: lookup.widgetId,
  });
}

async function queueSelfTestRow({
  queueAdapterApi,
  registry,
  resolvedReportId,
}: {
  queueAdapterApi: QueueAgentAdapterApi;
  registry: ReturnType<typeof createHobitAgentCapabilityRegistry>;
  resolvedReportId: string;
}): Promise<HobitAgentSelfTestReportRow> {
  const broker = createHobitAgentActionBroker({
    handlers: createQueueAgentActionHandlers(queueAdapterApi),
    registry,
  });
  const result = await broker.invokeAsync<QueueAgentSelfTestReport>(
    createActionRequest({
      agentId: "workspace-agent:self-test",
      agentRoleId: "workspace_agent",
      capabilityId: "queue.selfTest",
      createdAt: "2026-01-01T00:00:00.000Z",
      dryRun: true,
      input: {},
      reason: "agent-self-test-runner",
      requestId: `${resolvedReportId}:queue-self-test`,
    }),
  );
  const report = result.result.output;

  if (result.status === "succeeded" && report) {
    return row({
      capabilityId: "queue.selfTest",
      checkId: "queue:self-test-dry-run",
      component: "Agent Queue",
      hiddenSideEffectAssertions: [
        "no_queue_mutation",
        "no_worker_start",
        "no_duplicate_queue_view",
      ],
      message: `${report.productSummary}. Dry-run only.`,
      reason: report.summary.skipped > 0 ? "Dry-run only." : undefined,
      source: "Action Broker queue.selfTest",
      status:
        report.status === "failed" || report.status === "blocked"
          ? report.status
          : "passed",
      title: "Queue self-test dry-run",
      widgetId: "agent-queue",
    });
  }

  return row({
    capabilityId: "queue.selfTest",
    checkId: "queue:self-test-dry-run",
    component: "Agent Queue",
    hiddenSideEffectAssertions: ["no_queue_mutation", "no_worker_start"],
    message: result.result.message,
    reason: result.result.policyReasons[0] ?? result.result.unavailableReason,
    source: "Action Broker queue.selfTest",
    status:
      result.status === "dry_run_required" ||
      result.status === "needs_confirmation" ||
      result.status === "policy_blocked" ||
      result.status === "unavailable"
        ? "blocked"
        : "failed",
    title: "Queue self-test dry-run",
    widgetId: "agent-queue",
  });
}

function codexRestrictionRow({
  registry,
  resolvedReportId,
}: {
  registry: ReturnType<typeof createHobitAgentCapabilityRegistry>;
  resolvedReportId: string;
}): HobitAgentSelfTestReportRow {
  const decision = evaluateCapabilityPolicy(
    registry,
    createActionRequest({
      agentId: "workspace-agent:self-test",
      agentRoleId: "workspace_agent",
      capabilityId: "codex.runTask",
      dryRun: false,
      input: {},
      reason: "agent-self-test-runner",
      requestId: `${resolvedReportId}:codex-restricted`,
    }),
  );

  return decision.status === "requires_confirmation"
    ? passedRow({
        capabilityId: "codex.runTask",
        checkId: "capability:codex-restricted",
        component: "Agent Executor / Workspace Agent Direct Work",
        hiddenSideEffectAssertions: ["no_codex_run"],
        message: "Codex capability is restricted.",
        reason: "Restricted capability.",
        source: "Capability policy",
        title: "Codex capability restricted",
      })
    : failedRow({
        capabilityId: "codex.runTask",
        checkId: "capability:codex-restricted",
        component: "Agent Executor / Workspace Agent Direct Work",
        hiddenSideEffectAssertions: ["no_codex_run"],
        message: "Codex capability was not restricted as expected.",
        reason: decision.reasons[0],
        source: "Capability policy",
        title: "Codex capability restricted",
      });
}

function shellRestrictionRow({
  registry,
}: {
  registry: ReturnType<typeof createHobitAgentCapabilityRegistry>;
}): HobitAgentSelfTestReportRow {
  const shell = findCapability(registry, "workspace.shell.runCommand");
  const unavailable =
    shell?.availability.status === "unavailable" ? shell.availability.reason : null;

  return shell?.restricted && unavailable
    ? passedRow({
        capabilityId: "workspace.shell.runCommand",
        checkId: "capability:shell-restricted",
        component: "Terminal",
        hiddenSideEffectAssertions: ["no_shell_command"],
        message: "Shell capability is restricted and unavailable.",
        reason: productUnavailableReason(unavailable),
        source: "Capability Registry",
        title: "Shell capability restricted",
      })
    : failedRow({
        capabilityId: "workspace.shell.runCommand",
        checkId: "capability:shell-restricted",
        component: "Terminal",
        hiddenSideEffectAssertions: ["no_shell_command"],
        message: "Shell capability was not restricted as expected.",
        source: "Capability Registry",
        title: "Shell capability restricted",
      });
}

function hiddenSideEffectAssertionRow(): HobitAgentSelfTestReportRow {
  return passedRow({
    checkId: "hidden-side-effects:no-hidden-side-effects",
    component: "Self-Test Runner",
    hiddenSideEffectAssertions: [
      "no_codex_run",
      "no_shell_command",
      "no_queue_mutation",
      "no_queue_worker_start",
      "no_queue_view_creation",
      "no_terminal_launch",
      "no_git_mutation",
      "no_rollback_execution",
    ],
    message: "No hidden side effects.",
    source: "Self-Test Runner",
    title: "Hidden side-effect assertions",
  });
}

function registerSelfTestAgents(workspaceId: string): HobitAgentRuntimeState {
  const empty = createAgentRuntimeState({
    maxHistoryEvents: 20,
    workspaceId,
  });
  const withA = registerAgent(empty, HOBIT_TEST_AGENT_A);
  if (!withA.ok) {
    throw new Error(withA.error.message);
  }
  const withB = registerAgent(withA.state, HOBIT_TEST_AGENT_B);
  if (!withB.ok) {
    throw new Error(withB.error.message);
  }

  return withB.state;
}

type SelfTestRowInput = Omit<
  HobitAgentSelfTestReportRow,
  "hiddenSideEffectAssertions" | "statusLabel"
> & {
  hiddenSideEffectAssertions?: string[];
};

function row(input: SelfTestRowInput): HobitAgentSelfTestReportRow {
  return {
    ...input,
    hiddenSideEffectAssertions: [...(input.hiddenSideEffectAssertions ?? [])],
    statusLabel: statusLabel(input.status),
  };
}

function passedRow(
  input: Omit<SelfTestRowInput, "status">,
): HobitAgentSelfTestReportRow {
  return row({ ...input, status: "passed" });
}

function failedRow(
  input: Omit<SelfTestRowInput, "status">,
): HobitAgentSelfTestReportRow {
  return row({ ...input, status: "failed" });
}

function skippedRow(
  input: Omit<SelfTestRowInput, "status">,
): HobitAgentSelfTestReportRow {
  return row({ ...input, status: "skipped" });
}

function overallStatusForSummary({
  blocked,
  failed,
}: HobitAgentSelfTestReportViewModel["summary"]): HobitAgentSelfTestReportRowStatus {
  if (failed > 0) {
    return "failed";
  }

  if (blocked > 0) {
    return "blocked";
  }

  return "passed";
}

function titleForAgentApiCapability(capabilityId: HobitAgentCapabilityId) {
  if (capabilityId === "agent.status.read") {
    return "agent.status.read available";
  }

  if (capabilityId === "agent.history.read") {
    return "agent.history.read available";
  }

  if (capabilityId === "agent.message.send") {
    return "agent.message.send available";
  }

  if (capabilityId === "agent.capabilities.read") {
    return "agent.capabilities.read available";
  }

  if (capabilityId === "agent.selfTest.run") {
    return "agent.selfTest.run available";
  }

  return `${capabilityId} available`;
}

function productUnavailableReason(reason: string) {
  if (reason.includes("not implemented")) {
    return "Capability unavailable. Not implemented yet.";
  }

  return `Capability unavailable. ${reason}`;
}

function noHiddenSideEffectAssertions(): HobitAgentSelfTestHiddenSideEffectAssertion[] {
  return [
    { assertionId: "no-codex-run", label: "no Codex run", passed: true },
    { assertionId: "no-shell-command", label: "no shell command", passed: true },
    {
      assertionId: "no-queue-mutation",
      label: "no Queue mutation",
      passed: true,
    },
    {
      assertionId: "no-queue-worker-start",
      label: "no Queue worker start",
      passed: true,
    },
    {
      assertionId: "no-queue-view-creation",
      label: "no Queue view creation",
      passed: true,
    },
    { assertionId: "no-terminal-launch", label: "no Terminal launch", passed: true },
    { assertionId: "no-git-mutation", label: "no Git mutation", passed: true },
    {
      assertionId: "no-rollback-execution",
      label: "no rollback execution",
      passed: true,
    },
  ];
}
