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
import { buildWorkspaceAgentCapabilityRuntimeSeam } from "../context";
import {
  createDefaultQueueAgentAdapterApi,
  createQueueAgentActionHandlers,
  type QueueAgentAdapterApi,
  type QueueAgentSelfTestCaseResult,
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
import type {
  HobitAgentSmokeInstruction,
  HobitAgentSmokePlan,
  HobitAgentSmokeRequest,
  HobitAgentSmokeResult,
  HobitAgentSmokeRunResult,
  HobitAgentSmokeStatus,
} from "./hobitAgentSmokeTypes";
import {
  HOBIT_AGENT_SMOKE_PRODUCT_LABELS,
} from "./hobitAgentSmokeTypes";
import {
  createHobitAgentSmokePlan as createHobitAgentSmokePlanModel,
} from "./hobitAgentSmokePlan";
import {
  createHobitAgentSmokeReport,
  noHiddenSideEffectAssertions,
  resultFromSmokeCase,
} from "./hobitAgentSmokeReport";

export type {
  HobitAgentSmokeCase,
  HobitAgentSmokeComponentResult,
  HobitAgentSmokeHiddenSideEffectAssertion,
  HobitAgentSmokeInstruction,
  HobitAgentSmokePlan,
  HobitAgentSmokeReport,
  HobitAgentSmokeRequest,
  HobitAgentSmokeResult,
  HobitAgentSmokeRunResult,
  HobitAgentSmokeStatus,
} from "./hobitAgentSmokeTypes";
export { summarizeHobitAgentSmokeResults } from "./hobitAgentSmokeReport";
export {
  HOBIT_AGENT_SMOKE_PRODUCT_LABELS,
  hobitAgentSmokeStatusLabel,
} from "./hobitAgentSmokeTypes";

export function createHobitAgentSmokeInstruction():
  HobitAgentSmokeInstruction {
  return {
    body: [
      "Run Hobit agent-executed smoke.",
      "Check available agent APIs and widget/module contracts using safe self-tests and dry-runs.",
      "Do not perform hidden side effects.",
      "Report passed / failed / skipped / blocked.",
      "Do not run Codex.",
      "Do not run shell commands.",
      "Do not mutate Queue except approved dry-run or fake checks.",
      "Do not start Queue workers.",
      "Do not create Queue views.",
      "Do not launch Terminal.",
      "Do not mutate Git.",
      "Do not execute rollback.",
    ].join(" "),
    id: "hobit.agent.smoke",
    title: "Hobit agent-executed smoke",
  };
}

export function createHobitAgentSmokeRequest({
  agentApiTargetAgentId = "test.agentB",
  agentApiTesterAgentId = "test.agentA",
  createdAt = "2026-01-01T00:00:00.000Z",
  requestId,
  runnerAgentId = "workspace-agent:self-test",
  widgetInstanceId,
  workspaceId,
  workspaceRoot = null,
}: Omit<
  HobitAgentSmokeRequest,
  "dryRun" | "instructionId" | "runnerAgentId"
> &
  Partial<Pick<HobitAgentSmokeRequest, "runnerAgentId">>):
  HobitAgentSmokeRequest {
  return {
    agentApiTargetAgentId,
    agentApiTesterAgentId,
    createdAt,
    dryRun: true,
    instructionId: "hobit.agent.smoke",
    requestId,
    runnerAgentId,
    ...(widgetInstanceId ? { widgetInstanceId } : {}),
    ...(workspaceId ? { workspaceId } : {}),
    workspaceRoot,
  };
}

export function createHobitAgentSmokePlan({
  createdAt,
  instruction = createHobitAgentSmokeInstruction(),
  request,
}: {
  createdAt?: string;
  instruction?: HobitAgentSmokeInstruction;
  request: HobitAgentSmokeRequest;
}): HobitAgentSmokePlan {
  return createHobitAgentSmokePlanModel({
    createdAt,
    instruction,
    request,
  });
}

export async function runHobitAgentSmoke({
  instruction = createHobitAgentSmokeInstruction(),
  queueAdapterApi = createDefaultQueueAgentAdapterApi(),
  request,
  state,
}: {
  instruction?: HobitAgentSmokeInstruction;
  queueAdapterApi?: QueueAgentAdapterApi;
  request: HobitAgentSmokeRequest;
  state?: HobitAgentRuntimeState;
}): Promise<HobitAgentSmokeRunResult> {
  const createdAt = request.createdAt ?? "2026-01-01T00:00:00.000Z";
  const plan = createHobitAgentSmokePlan({
    createdAt,
    instruction,
    request,
  });
  const registry = createHobitAgentCapabilityRegistry();
  const runtimeState =
    state ??
    registerSelfTestAgents(request.workspaceId ?? "__local_workspace__");
  const results: HobitAgentSmokeResult[] = [
    ...workspaceAgentContextResults({
      plan,
      registry,
      request,
    }),
    ...runAgentApiSmokeResults({
      createdAt,
      plan,
      request,
      state: runtimeState,
    }),
    ...widgetContractResults(plan),
    ...(await queueCapabilitySmokeResults({
      createdAt,
      plan,
      queueAdapterApi,
      registry,
      request,
    })),
    ...restrictedCapabilityResults({ plan, registry, request }),
    hiddenSideEffectResult(plan),
  ];

  return {
    report: createHobitAgentSmokeReport({
      createdAt,
      plan,
      request,
      results,
    }),
    state: runtimeState,
  };
}

function workspaceAgentContextResults({
  plan,
  registry,
  request,
}: {
  plan: HobitAgentSmokePlan;
  registry: ReturnType<typeof createHobitAgentCapabilityRegistry>;
  request: HobitAgentSmokeRequest;
}): HobitAgentSmokeResult[] {
  const seam = buildWorkspaceAgentCapabilityRuntimeSeam({
    capabilityRegistry: registry,
    currentPrompt: "Run Agent Self-Test",
    widgetInstanceId: request.widgetInstanceId,
    workspaceId: request.workspaceId ?? "__local_workspace__",
    workspaceRoot: request.workspaceRoot ?? null,
  });

  return [
    resultFromSmokeCase({
      evidence: [`App name: ${seam.appContext.appName}.`],
      message:
        seam.appContext.appName === "Hobit"
          ? "App context exists and identifies Hobit."
          : "App context did not identify Hobit.",
      plan,
      status: seam.appContext.appName === "Hobit" ? "passed" : "failed",
      caseId: "app-context:hobit",
    }),
    resultFromSmokeCase({
      evidence: [
        `Broker boundary: ${seam.brokerBoundary.status}.`,
        "Capability manifest instructions are present.",
      ],
      message:
        seam.brokerBoundary.status === "implemented" &&
        seam.instructionBlock.includes("Compact capability manifest:")
          ? "Workspace Agent capability context can be built with broker instructions."
          : "Workspace Agent capability context is incomplete.",
      plan,
      status:
        seam.brokerBoundary.status === "implemented" &&
        seam.instructionBlock.includes("Compact capability manifest:")
          ? "passed"
          : "failed",
      caseId: "workspace-agent:capability-context",
    }),
    resultFromSmokeCase({
      evidence: [`Capability count: ${registry.capabilities.length.toString()}.`],
      message:
        registry.capabilities.length > 0
          ? "Capability manifest is available."
          : "Capability manifest is unavailable.",
      plan,
      status: registry.capabilities.length > 0 ? "passed" : "failed",
      caseId: "capability-manifest:available",
    }),
  ];
}

function runAgentApiSmokeResults({
  createdAt,
  plan,
  request,
  state,
}: {
  createdAt: string;
  plan: HobitAgentSmokePlan;
  request: HobitAgentSmokeRequest;
  state: HobitAgentRuntimeState;
}): HobitAgentSmokeResult[] {
  const result = runAgentApiSmoke({
    request: createAgentApiSmokeRequest({
      createdAt,
      messageId: `${request.requestId}:agent-api-smoke-message`,
      requestId: `${request.requestId}:agent-api-smoke`,
      targetAgentId: request.agentApiTargetAgentId ?? "test.agentB",
      testerAgentId: request.agentApiTesterAgentId ?? "test.agentA",
    }),
    state,
  });

  return result.report.results.map((smokeResult) =>
    agentApiSmokeResult(plan, smokeResult),
  );
}

function agentApiSmokeResult(
  plan: HobitAgentSmokePlan,
  smokeResult: HobitAgentApiSmokeResult,
): HobitAgentSmokeResult {
  return resultFromSmokeCase({
    evidence: smokeResult.evidence,
    hiddenSideEffectAssertions: [
      "No Codex run",
      "No shell command",
      "No Queue mutation",
      "No Terminal launch",
      "No Git mutation",
      "No rollback execution",
    ],
    message: smokeResult.message,
    plan,
    reason: smokeResult.blockedReason,
    status: smokeResult.status,
    caseId: smokeResult.caseId,
  });
}

function widgetContractResults(plan: HobitAgentSmokePlan): HobitAgentSmokeResult[] {
  const activeWidgetIds = listWidgetContracts().map((contract) => contract.widgetId);
  const contractResults = [
    widgetContractResult(plan, "agent-queue"),
    widgetContractResult(plan, "interactive-agent"),
    widgetContractResult(plan, "skill-library"),
    widgetContractResult(plan, "notes"),
    widgetContractResult(plan, "terminal"),
  ];
  const finderResult = activeWidgetIds.includes("finder")
    ? resultFromSmokeCase({
        evidence: ["Finder was present in the active Widget Agent Contract registry."],
        message: "Finder was unexpectedly included in active contract scope.",
        plan,
        status: "failed",
        caseId: "widget-contract:finder-active-scope",
      })
    : resultFromSmokeCase({
        evidence: ["Finder is explicitly excluded from this smoke scope."],
        message: "Finder excluded.",
        plan,
        reason: HOBIT_AGENT_SMOKE_PRODUCT_LABELS.finderExcluded,
        status: "skipped",
        caseId: "widget-contract:finder-active-scope",
      });

  return [
    ...contractResults,
    ...widgetExecutionUnavailableResults(plan),
    finderResult,
  ];
}

function widgetContractResult(
  plan: HobitAgentSmokePlan,
  widgetId: string,
): HobitAgentSmokeResult {
  const lookup = findWidgetContract(widgetId);
  if (lookup.status === "found") {
    return resultFromSmokeCase({
      evidence: [
        `${lookup.contract.title} declares ${lookup.contract.capabilities.length.toString()} capability contract(s).`,
        `${lookup.contract.title} declares ${lookup.contract.selfTestCases.length.toString()} self-test case(s).`,
      ],
      hiddenSideEffectAssertions: productHiddenSideEffectLabels(
        lookup.contract.hiddenSideEffectAssertions,
      ),
      message: `${lookup.contract.title} contract is available.`,
      plan,
      status: "passed",
      caseId: `widget-contract:${widgetId}`,
    });
  }

  return unavailableWidgetContractResult(plan, lookup);
}

function unavailableWidgetContractResult(
  plan: HobitAgentSmokePlan,
  lookup: Extract<HobitWidgetContractLookupResult, { status: "unavailable" }>,
): HobitAgentSmokeResult {
  return resultFromSmokeCase({
    evidence: [lookup.unavailableReason],
    hiddenSideEffectAssertions: ["No capability inference"],
    message: "Capability unavailable.",
    plan,
    reason: productUnavailableReason(lookup.unavailableReason),
    status: "skipped",
    caseId: `widget-contract:${lookup.widgetId}`,
  });
}

function widgetExecutionUnavailableResults(
  plan: HobitAgentSmokePlan,
): HobitAgentSmokeResult[] {
  return [
    resultFromSmokeCase({
      evidence: [
        "Knowledge / Skills Widget Agent execution is not implemented in this block.",
      ],
      hiddenSideEffectAssertions: [
        "No Knowledge mutation",
        "No context attach",
        "No shell command",
        "No Codex run",
        "No Terminal launch",
        "No Git mutation",
      ],
      message:
        "Knowledge / Skills adapter execution is not implemented yet. Self-test metadata only.",
      plan,
      reason:
        `${HOBIT_AGENT_SMOKE_PRODUCT_LABELS.adapterNotImplemented}. ` +
        "Dry-run unavailable for real Knowledge / Skills APIs.",
      status: "skipped",
      caseId: "widget-contract:skill-library:adapter",
    }),
    resultFromSmokeCase({
      evidence: ["Notes Widget Agent execution is not implemented in this block."],
      hiddenSideEffectAssertions: [
        "No Note mutation",
        "No hidden Note read",
        "No shell command",
        "No Codex run",
        "No Terminal launch",
        "No Git mutation",
      ],
      message:
        "Notes adapter execution is not implemented yet. Self-test metadata only.",
      plan,
      reason:
        `${HOBIT_AGENT_SMOKE_PRODUCT_LABELS.adapterNotImplemented}. ` +
        "Dry-run unavailable for real Notes APIs.",
      status: "skipped",
      caseId: "widget-contract:notes:adapter",
    }),
    resultFromSmokeCase({
      evidence: [
        "Terminal Widget Agent execution is restricted and not implemented in this block.",
      ],
      hiddenSideEffectAssertions: [
        "No Terminal session creation",
        "No Terminal command run",
        "No Terminal force kill",
        "No shell command",
        "No Codex run",
        "No Git mutation",
        "No rollback execution",
      ],
      message:
        "Terminal adapter execution is restricted and not implemented yet. Self-test does not execute commands.",
      plan,
      reason:
        `${HOBIT_AGENT_SMOKE_PRODUCT_LABELS.restrictedCapability}. ` +
        `${HOBIT_AGENT_SMOKE_PRODUCT_LABELS.runtimeExecutionNotImplemented}. ` +
        "Dry-run unavailable for Terminal execution.",
      status: "blocked",
      caseId: "widget-contract:terminal:adapter",
    }),
  ];
}

async function queueCapabilitySmokeResults({
  createdAt,
  plan,
  queueAdapterApi,
  registry,
  request,
}: {
  createdAt: string;
  plan: HobitAgentSmokePlan;
  queueAdapterApi: QueueAgentAdapterApi;
  registry: ReturnType<typeof createHobitAgentCapabilityRegistry>;
  request: HobitAgentSmokeRequest;
}): Promise<HobitAgentSmokeResult[]> {
  const broker = createHobitAgentActionBroker({
    handlers: createQueueAgentActionHandlers(queueAdapterApi),
    registry,
  });
  const brokerResult = await broker.invokeAsync<QueueAgentSelfTestReport>(
    createActionRequest({
      agentId: request.runnerAgentId,
      agentRoleId: "workspace_agent",
      capabilityId: "queue.selfTest",
      createdAt,
      dryRun: true,
      input: {},
      reason: "agent-executed-smoke",
      requestId: `${request.requestId}:queue-self-test`,
    }),
  );
  const report = brokerResult.result.output;

  if (report) {
    return [
      queueSelfTestSummaryResult(plan, report),
      ...report.cases.map((item) => queueCaseResult(plan, item)),
    ];
  }

  return [
    resultFromSmokeCase({
      evidence: [brokerResult.result.message],
      hiddenSideEffectAssertions: [
        "No Queue mutation",
        "No Queue worker start",
        "No Queue view creation",
      ],
      message: brokerResult.result.message,
      plan,
      reason:
        brokerResult.result.policyReasons[0] ??
        brokerResult.result.unavailableReason,
      status: queueBrokerBlockedStatus(brokerResult.status),
      caseId: "queue:self-test-dry-run",
    }),
  ];
}

function queueSelfTestSummaryResult(
  plan: HobitAgentSmokePlan,
  report: QueueAgentSelfTestReport,
): HobitAgentSmokeResult {
  const status =
    report.status === "failed" || report.status === "blocked"
      ? report.status
      : "passed";

  return resultFromSmokeCase({
    evidence: [
      report.productSummary,
      `${report.summary.passed.toString()} passed, ${report.summary.failed.toString()} failed, ${report.summary.skipped.toString()} skipped, ${report.summary.blocked.toString()} blocked.`,
    ],
    hiddenSideEffectAssertions: [
      "No Queue mutation",
      "No Queue worker start",
      "No Queue view creation",
      "No Terminal launch",
      "No Git mutation",
      "No rollback execution",
    ],
    message:
      report.status === "passed"
        ? `${HOBIT_AGENT_SMOKE_PRODUCT_LABELS.queueSelfTestPassed}. ${HOBIT_AGENT_SMOKE_PRODUCT_LABELS.dryRunOnly}.`
        : `${report.productSummary}. ${HOBIT_AGENT_SMOKE_PRODUCT_LABELS.dryRunOnly}.`,
    plan,
    reason:
      report.summary.skipped > 0
        ? HOBIT_AGENT_SMOKE_PRODUCT_LABELS.safeCheckSkipped
        : undefined,
    status,
    caseId: "queue:self-test-dry-run",
  });
}

function queueCaseResult(
  plan: HobitAgentSmokePlan,
  item: QueueAgentSelfTestCaseResult,
): HobitAgentSmokeResult {
  return resultFromSmokeCase({
    evidence: item.evidence,
    hiddenSideEffectAssertions: [
      "No Queue mutation",
      "No Queue worker start",
      "No Queue view creation",
      "No Codex run",
      "No shell command",
      "No Terminal launch",
      "No Git mutation",
      "No rollback execution",
    ],
    message:
      item.status === "skipped"
        ? `${item.message} ${HOBIT_AGENT_SMOKE_PRODUCT_LABELS.dryRunOnly}.`
        : item.message,
    plan,
    reason:
      item.reason ??
      (item.status === "skipped"
        ? HOBIT_AGENT_SMOKE_PRODUCT_LABELS.safeCheckSkipped
        : undefined),
    status: item.status,
    caseId: item.caseId,
  });
}

function restrictedCapabilityResults({
  plan,
  registry,
  request,
}: {
  plan: HobitAgentSmokePlan;
  registry: ReturnType<typeof createHobitAgentCapabilityRegistry>;
  request: HobitAgentSmokeRequest;
}): HobitAgentSmokeResult[] {
  const codexDecision = evaluateCapabilityPolicy(
    registry,
    createActionRequest({
      agentId: request.runnerAgentId,
      agentRoleId: "workspace_agent",
      capabilityId: "codex.runTask",
      dryRun: false,
      input: {},
      reason: "agent-executed-smoke",
      requestId: `${request.requestId}:codex-restricted`,
    }),
  );
  const shell = findCapability(registry, "workspace.shell.runCommand");
  const shellUnavailable =
    shell?.availability.status === "unavailable" ? shell.availability.reason : null;

  return [
    resultFromSmokeCase({
      evidence: codexDecision.reasons,
      hiddenSideEffectAssertions: ["No Codex run"],
      message:
        codexDecision.status === "requires_confirmation"
          ? "Codex capability is restricted."
          : "Codex capability was not restricted as expected.",
      plan,
      reason:
        codexDecision.status === "requires_confirmation"
          ? HOBIT_AGENT_SMOKE_PRODUCT_LABELS.restrictedCapability
          : codexDecision.reasons[0],
      status:
        codexDecision.status === "requires_confirmation" ? "passed" : "failed",
      caseId: "capability:codex-restricted",
    }),
    resultFromSmokeCase({
      evidence: shellUnavailable ? [shellUnavailable] : [],
      hiddenSideEffectAssertions: ["No shell command"],
      message:
        shell?.restricted && shellUnavailable
          ? "Shell capability is restricted and unavailable."
          : "Shell capability was not restricted as expected.",
      plan,
      reason: shellUnavailable
        ? productUnavailableReason(shellUnavailable)
        : undefined,
      status: shell?.restricted && shellUnavailable ? "passed" : "failed",
      caseId: "capability:shell-restricted",
    }),
  ];
}

function hiddenSideEffectResult(
  plan: HobitAgentSmokePlan,
): HobitAgentSmokeResult {
  return resultFromSmokeCase({
    evidence: noHiddenSideEffectAssertions().map((assertion) => assertion.label),
    hiddenSideEffectAssertions: noHiddenSideEffectAssertions().map(
      (assertion) => assertion.label,
    ),
    message: HOBIT_AGENT_SMOKE_PRODUCT_LABELS.noHiddenSideEffects,
    plan,
    status: "passed",
    caseId: "hidden-side-effects:no-hidden-side-effects",
  });
}

function queueBrokerBlockedStatus(status: string): HobitAgentSmokeStatus {
  return status === "dry_run_required" ||
    status === "needs_confirmation" ||
    status === "policy_blocked" ||
    status === "unavailable"
    ? "blocked"
    : "failed";
}

function productUnavailableReason(reason: string) {
  if (reason.includes("not implemented")) {
    return "Capability unavailable. Not implemented yet.";
  }

  return `Capability unavailable. ${reason}`;
}

function productHiddenSideEffectLabels(
  assertions: readonly string[],
): string[] {
  return assertions.map((assertion) =>
    assertion
      .split("_")
      .filter(Boolean)
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" "),
  );
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
