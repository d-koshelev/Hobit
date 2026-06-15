import type { HobitAgentCapabilityId } from "../capabilities";
import {
  createAgentMessage,
  markMessageDelivered,
  sendAgentMessage,
  type HobitAgentMessagingResult,
} from "../messaging";
import {
  getAgentBoundedHistory,
  getAgentCapabilityManifest,
  getAgentStatus,
  listAgents,
  type HobitAgentId,
  type HobitAgentRuntimeState,
} from "../runtime";
import {
  createAgentPeerSelfTestRequest,
  runAgentPeerSelfTest,
} from "./hobitAgentPeerSelfTest";
import {
  createAgentApiSmokeCases,
  createAgentApiSmokeInstruction,
  HOBIT_AGENT_API_SMOKE_REQUIRED_CAPABILITIES,
  type HobitAgentApiSmokeCase,
  type HobitAgentApiSmokeHiddenSideEffectFlags,
  type HobitAgentApiSmokeInstruction,
  type HobitAgentApiSmokeReport,
  type HobitAgentApiSmokeRequest,
  type HobitAgentApiSmokeResult,
  type HobitAgentApiSmokeRunResult,
  type HobitAgentApiSmokeStatus,
} from "./hobitAgentApiSmokeTypes";

export type {
  HobitAgentApiSmokeCase,
  HobitAgentApiSmokeHiddenSideEffectFlags,
  HobitAgentApiSmokeInstruction,
  HobitAgentApiSmokeReport,
  HobitAgentApiSmokeRequest,
  HobitAgentApiSmokeResult,
  HobitAgentApiSmokeRunResult,
  HobitAgentApiSmokeStatus,
} from "./hobitAgentApiSmokeTypes";
export {
  createAgentApiSmokeCases,
  createAgentApiSmokeInstruction,
  createAgentApiSmokeRequest,
  HOBIT_AGENT_API_SMOKE_REQUIRED_CAPABILITIES,
} from "./hobitAgentApiSmokeTypes";

type HobitAgentApiSmokeAdapters = {
  afterMessageStateCreated?: (
    state: HobitAgentRuntimeState,
  ) => HobitAgentRuntimeState;
  runPeerSelfTest?: typeof runAgentPeerSelfTest;
  sendMessage?: typeof sendAgentMessage;
};

export function runAgentApiSmoke({
  adapters = {},
  instruction = createAgentApiSmokeInstruction(),
  request,
  state,
}: {
  adapters?: HobitAgentApiSmokeAdapters;
  instruction?: HobitAgentApiSmokeInstruction;
  request: HobitAgentApiSmokeRequest;
  state: HobitAgentRuntimeState;
}): HobitAgentApiSmokeRunResult {
  const createdAt = request.createdAt ?? "2026-01-01T00:00:00.000Z";
  const requiredCapabilityIds = [
    ...(request.requiredCapabilityIds ??
      HOBIT_AGENT_API_SMOKE_REQUIRED_CAPABILITIES),
  ];
  const testerStatus = getAgentStatus(state, request.testerAgentId);
  const targetStatus = getAgentStatus(state, request.targetAgentId);

  if (!testerStatus.ok || !targetStatus.ok) {
    const missingAgentId = !testerStatus.ok
      ? request.testerAgentId
      : request.targetAgentId;
    const message = `Agent ${missingAgentId} is unavailable for Agent API smoke.`;
    const results = requiredCapabilityIds.map((capabilityId) =>
      blockedResult({
        capabilityId,
        message,
      }),
    );

    return {
      report: createAgentApiSmokeReport({
        checkedCapabilities: requiredCapabilityIds,
        createdAt,
        instructionId: instruction.id,
        request,
        results,
      }),
      state,
    };
  }

  const manifestResult = getAgentCapabilityManifest(state, request.targetAgentId);
  if (!manifestResult.ok) {
    const message = `Capability manifest for ${request.targetAgentId} is unavailable.`;
    const results = requiredCapabilityIds.map((capabilityId) =>
      blockedResult({
        capabilityId,
        message,
      }),
    );

    return {
      report: createAgentApiSmokeReport({
        checkedCapabilities: requiredCapabilityIds,
        createdAt,
        instructionId: instruction.id,
        request,
        results,
      }),
      state,
    };
  }

  const targetCapabilityIds = manifestResult.capabilityManifest.capabilities.map(
    (capability) => capability.id,
  );
  const agentCapabilityIds = targetCapabilityIds.filter((capabilityId) =>
    capabilityId.startsWith("agent."),
  );
  const missingRequiredCapabilityIds = requiredCapabilityIds.filter(
    (capabilityId) => !targetCapabilityIds.includes(capabilityId),
  );
  const smokeCases = createAgentApiSmokeCases({
    capabilityIds: [
      ...new Set([...agentCapabilityIds, ...missingRequiredCapabilityIds]),
    ],
  });
  const results: HobitAgentApiSmokeResult[] = [];

  const statusCase = findSmokeCase(smokeCases, "agent.status.read");
  if (statusCase) {
    results.push({
      capabilityId: statusCase.capabilityId,
      caseId: statusCase.caseId,
      evidence: [
        `${request.targetAgentId} status is ${targetStatus.status}.`,
        `${request.testerAgentId} status is ${testerStatus.status}.`,
      ],
      message: `Read ${request.targetAgentId} status through agent.status.read.`,
      status: "passed",
    });
  }

  const capabilitiesCase = findSmokeCase(smokeCases, "agent.capabilities.read");
  if (capabilitiesCase) {
    results.push(
      missingRequiredCapabilityIds.length > 0
        ? {
            capabilityId: capabilitiesCase.capabilityId,
            caseId: capabilitiesCase.caseId,
            evidence: [
              `${request.targetAgentId} manifest is missing: ${missingRequiredCapabilityIds.join(", ")}.`,
            ],
            message: `${request.targetAgentId} is missing required Agent API capabilities.`,
            status: "failed",
          }
        : {
            capabilityId: capabilitiesCase.capabilityId,
            caseId: capabilitiesCase.caseId,
            evidence: requiredCapabilityIds.map(
              (capabilityId) =>
                `${capabilityId} is declared by ${request.targetAgentId}.`,
            ),
            message: `Read ${request.targetAgentId} Agent API capability manifest.`,
            status: "passed",
          },
    );
  }

  const unsupportedResults = smokeCases
    .filter(
      (smokeCase) =>
        !isSupportedAgentApiSmokeCapability(smokeCase.capabilityId) &&
        targetCapabilityIds.includes(smokeCase.capabilityId),
    )
    .map((smokeCase) => ({
      capabilityId: smokeCase.capabilityId,
      caseId: smokeCase.caseId,
      evidence: [
        `${smokeCase.capabilityId} is present, but no safe Agent API smoke case exists yet.`,
      ],
      message: `${smokeCase.capabilityId} was skipped because no safe smoke case exists yet.`,
      status: "skipped" as const,
    }));
  results.push(...unsupportedResults);

  if (missingRequiredCapabilityIds.length > 0) {
    const missingResults = missingRequiredCapabilityIds
      .filter((capabilityId) => capabilityId !== "agent.capabilities.read")
      .map((capabilityId) => ({
        capabilityId,
        caseId: `${capabilityId}:api-smoke:missing`,
        evidence: [`${request.targetAgentId} does not declare ${capabilityId}.`],
        message: `${capabilityId} is required for Agent API smoke but is missing.`,
        status: "failed" as const,
      }));

    return {
      report: createAgentApiSmokeReport({
        checkedCapabilities: checkedCapabilityIds(smokeCases, requiredCapabilityIds),
        createdAt,
        instructionId: instruction.id,
        request,
        results: [...results, ...missingResults],
      }),
      state,
    };
  }

  const messageResult = runMessageSmoke({
    adapters,
    createdAt,
    request,
    state,
  });
  results.push(messageResult.result);
  const messageState = messageResult.state;

  const historyCase = findSmokeCase(smokeCases, "agent.history.read");
  if (historyCase) {
    results.push(
      messageResult.deliveredMessageId
        ? runHistorySmoke({
            caseId: historyCase.caseId,
            deliveredMessageId: messageResult.deliveredMessageId,
            request,
            state: messageState,
          })
        : skippedResult({
            capabilityId: historyCase.capabilityId,
            caseId: historyCase.caseId,
            message:
              "History verification was skipped because the smoke message was not delivered.",
          }),
    );
  }

  const selfTestCase = findSmokeCase(smokeCases, "agent.selfTest.run");
  const selfTestResult = selfTestCase
    ? runPeerSelfTestSmoke({
        adapters,
        createdAt,
        request,
        state: messageState,
        smokeCase: selfTestCase,
      })
    : null;
  if (selfTestResult) {
    results.push(selfTestResult.result);
  }

  return {
    report: createAgentApiSmokeReport({
      checkedCapabilities: checkedCapabilityIds(smokeCases, requiredCapabilityIds),
      createdAt,
      instructionId: instruction.id,
      request,
      results,
    }),
    state: selfTestResult?.state ?? messageState,
  };
}

export function summarizeAgentApiSmokeReport(
  reportOrResults:
    | HobitAgentApiSmokeReport
    | readonly HobitAgentApiSmokeResult[],
): HobitAgentApiSmokeReport["summary"] {
  const results: readonly HobitAgentApiSmokeResult[] =
    "results" in reportOrResults ? reportOrResults.results : reportOrResults;

  return {
    blocked: results.filter((result) => result.status === "blocked").length,
    failed: results.filter((result) => result.status === "failed").length,
    passed: results.filter((result) => result.status === "passed").length,
    skipped: results.filter((result) => result.status === "skipped").length,
    total: results.length,
  };
}

function runMessageSmoke({
  adapters,
  createdAt,
  request,
  state,
}: {
  adapters: HobitAgentApiSmokeAdapters;
  createdAt: string;
  request: HobitAgentApiSmokeRequest;
  state: HobitAgentRuntimeState;
}): {
  deliveredMessageId?: string;
  result: HobitAgentApiSmokeResult;
  state: HobitAgentRuntimeState;
} {
  const messageId =
    request.messageId ??
    `${request.requestId}:${request.testerAgentId}:to:${request.targetAgentId}:api-smoke`;
  const message = createAgentMessage({
    body:
      request.messageBody ??
      `Agent API smoke from ${request.testerAgentId} to ${request.targetAgentId}.`,
    createdAt,
    fromAgentId: request.testerAgentId,
    kind: "self_test",
    messageId,
    threadId: `${request.requestId}:thread`,
    toAgentId: request.targetAgentId,
  });
  const messagingResult = (adapters.sendMessage ?? sendAgentMessage)({
    histories: state.histories,
    maxHistoryEvents: state.maxHistoryEvents,
    message,
    registeredAgentIds: listAgents(state).map((agent) => agent.agentId),
  });

  if (!messagingResult.ok) {
    return {
      result: messagingFailureResult(messagingResult),
      state: {
        ...state,
        histories: messagingResult.histories,
      },
    };
  }

  const delivered = markMessageDelivered(messagingResult.message);
  const messageState = adapters.afterMessageStateCreated
    ? adapters.afterMessageStateCreated({
        ...state,
        histories: messagingResult.histories,
      })
    : {
        ...state,
        histories: messagingResult.histories,
      };

  return {
    deliveredMessageId: delivered.messageId,
    result: {
      capabilityId: "agent.message.send",
      caseId: "agent.apiSmoke:message.send",
      evidence: [
        `${delivered.messageId} was created as a self_test message.`,
        `${delivered.messageId} was marked ${delivered.status} by the pure messaging helper.`,
      ],
      message: `Delivered Agent API smoke message ${delivered.messageId}.`,
      status: "passed",
    },
    state: messageState,
  };
}

function runHistorySmoke({
  caseId,
  deliveredMessageId,
  request,
  state,
}: {
  caseId: string;
  deliveredMessageId: string;
  request: HobitAgentApiSmokeRequest;
  state: HobitAgentRuntimeState;
}): HobitAgentApiSmokeResult {
  const history = getAgentBoundedHistory(state, {
    agentId: request.targetAgentId,
    direction: "received",
    kind: "self_test",
    limit: state.maxHistoryEvents,
  });
  const containsMessage =
    history.ok &&
    history.history.events.some(
      (event) =>
        event.message.messageId === deliveredMessageId &&
        event.message.fromAgentId === request.testerAgentId &&
        event.message.toAgentId === request.targetAgentId,
    );

  if (containsMessage) {
    return {
      capabilityId: "agent.history.read",
      caseId,
      evidence: [
        `${request.targetAgentId} bounded history contains ${deliveredMessageId}.`,
      ],
      message: `${request.targetAgentId} received-message history contains the Agent API smoke message.`,
      status: "passed",
    };
  }

  return {
    capabilityId: "agent.history.read",
    caseId,
    evidence: [
      `${request.targetAgentId} received-message history did not include ${deliveredMessageId}.`,
    ],
    message: `${request.targetAgentId} history is missing the delivered Agent API smoke message.`,
    status: "failed",
  };
}

function runPeerSelfTestSmoke({
  adapters,
  createdAt,
  request,
  smokeCase,
  state,
}: {
  adapters: HobitAgentApiSmokeAdapters;
  createdAt: string;
  request: HobitAgentApiSmokeRequest;
  smokeCase: HobitAgentApiSmokeCase;
  state: HobitAgentRuntimeState;
}): { result: HobitAgentApiSmokeResult; state: HobitAgentRuntimeState } {
  const peerSelfTest = (adapters.runPeerSelfTest ?? runAgentPeerSelfTest)({
    request: createAgentPeerSelfTestRequest({
      createdAt,
      messageId: `${request.requestId}:peer-self-test`,
      requestId: `${request.requestId}:peer-self-test`,
      targetAgentId: request.targetAgentId,
      testerAgentId: request.testerAgentId,
    }),
    state,
  });

  const status = peerSelfTest.report.finalStatus;
  const blockedReason =
    status === "blocked" ? peerSelfTest.report.productSummary : undefined;

  return {
    result: {
      ...(blockedReason ? { blockedReason } : {}),
      capabilityId: smokeCase.capabilityId,
      caseId: smokeCase.caseId,
      evidence: [
        `Peer self-test final status: ${peerSelfTest.report.finalStatus}.`,
        `Peer self-test report id: ${peerSelfTest.report.reportId}.`,
      ],
      message:
        status === "passed"
          ? "Ran the safe peer self-test helper successfully."
          : peerSelfTest.report.productSummary,
      status,
    },
    state: peerSelfTest.state,
  };
}

function createAgentApiSmokeReport({
  checkedCapabilities,
  createdAt,
  instructionId,
  request,
  results,
}: {
  checkedCapabilities: readonly HobitAgentCapabilityId[];
  createdAt: string;
  instructionId: HobitAgentApiSmokeInstruction["id"];
  request: HobitAgentApiSmokeRequest;
  results: readonly HobitAgentApiSmokeResult[];
}): HobitAgentApiSmokeReport {
  const stableResults = [...results].sort((left, right) =>
    left.caseId.localeCompare(right.caseId),
  );
  const summary = summarizeAgentApiSmokeReport(stableResults);
  const finalStatus = finalStatusForResults(stableResults);

  return {
    checkedCapabilities: [...checkedCapabilities],
    createdAt,
    finalStatus,
    hiddenSideEffectFlags: noHiddenSideEffectFlags(),
    instructionId,
    productFacingSummary: productFacingSummary({
      finalStatus,
      summary,
      targetAgentId: request.targetAgentId,
      testerAgentId: request.testerAgentId,
    }),
    reportId: `${request.requestId}:report`,
    results: stableResults,
    summary,
    targetAgentId: request.targetAgentId,
    testerAgentId: request.testerAgentId,
  };
}

function finalStatusForResults(
  results: readonly HobitAgentApiSmokeResult[],
): HobitAgentApiSmokeStatus {
  if (results.some((result) => result.status === "failed")) {
    return "failed";
  }

  if (results.some((result) => result.status === "blocked")) {
    return "blocked";
  }

  if (results.some((result) => result.status === "skipped")) {
    return "skipped";
  }

  return "passed";
}

function checkedCapabilityIds(
  smokeCases: readonly HobitAgentApiSmokeCase[],
  requiredCapabilityIds: readonly HobitAgentCapabilityId[],
): HobitAgentCapabilityId[] {
  return [
    ...new Set([
      ...requiredCapabilityIds,
      ...smokeCases.map((smokeCase) => smokeCase.capabilityId),
    ]),
  ].sort((left, right) => left.localeCompare(right));
}

function findSmokeCase(
  smokeCases: readonly HobitAgentApiSmokeCase[],
  capabilityId: HobitAgentCapabilityId,
): HobitAgentApiSmokeCase | undefined {
  return smokeCases.find((smokeCase) => smokeCase.capabilityId === capabilityId);
}

function isSupportedAgentApiSmokeCapability(
  capabilityId: HobitAgentCapabilityId,
): boolean {
  return HOBIT_AGENT_API_SMOKE_REQUIRED_CAPABILITIES.some(
    (supportedCapabilityId) => supportedCapabilityId === capabilityId,
  );
}

function blockedResult({
  capabilityId,
  message,
}: {
  capabilityId: HobitAgentCapabilityId;
  message: string;
}): HobitAgentApiSmokeResult {
  return {
    blockedReason: message,
    capabilityId,
    caseId: `${capabilityId}:api-smoke:blocked`,
    evidence: [message],
    message,
    status: "blocked",
  };
}

function skippedResult({
  capabilityId,
  caseId,
  message,
}: {
  capabilityId: HobitAgentCapabilityId;
  caseId: string;
  message: string;
}): HobitAgentApiSmokeResult {
  return {
    capabilityId,
    caseId,
    evidence: [message],
    message,
    status: "skipped",
  };
}

function messagingFailureResult(
  result: Extract<HobitAgentMessagingResult, { ok: false }>,
): HobitAgentApiSmokeResult {
  return {
    capabilityId: "agent.message.send",
    caseId: "agent.apiSmoke:message.send",
    evidence: [result.error.message],
    message: `Agent API smoke message delivery failed: ${result.error.message}`,
    status: "failed",
  };
}

function noHiddenSideEffectFlags(): HobitAgentApiSmokeHiddenSideEffectFlags {
  return {
    codexRun: false,
    gitMutation: false,
    queueMutation: false,
    rollbackExecution: false,
    shellCommand: false,
    terminalLaunch: false,
    widgetViewCreation: false,
    workerStart: false,
  };
}

function productFacingSummary({
  finalStatus,
  summary,
  targetAgentId,
  testerAgentId,
}: {
  finalStatus: HobitAgentApiSmokeStatus;
  summary: HobitAgentApiSmokeReport["summary"];
  targetAgentId: HobitAgentId;
  testerAgentId: HobitAgentId;
}): string {
  if (finalStatus === "passed") {
    return `${testerAgentId} checked ${targetAgentId} agent APIs in safe smoke mode: ${summary.passed} passed, ${summary.failed} failed, ${summary.skipped} skipped, ${summary.blocked} blocked. No hidden execution or product mutation was represented.`;
  }

  if (finalStatus === "failed") {
    return `${testerAgentId} found Agent API smoke failures for ${targetAgentId}: ${summary.passed} passed, ${summary.failed} failed, ${summary.skipped} skipped, ${summary.blocked} blocked. Review the structured results before relying on this agent API surface.`;
  }

  if (finalStatus === "blocked") {
    return `${testerAgentId} could not complete Agent API smoke for ${targetAgentId}: ${summary.blocked} checks were blocked.`;
  }

  return `${testerAgentId} skipped at least one Agent API smoke check for ${targetAgentId} because no safe smoke case was available yet.`;
}
