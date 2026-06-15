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
  type HobitAgentStatus,
} from "../runtime";
import type { HobitAgentSelfTestStatus } from "./types";

export type HobitAgentPeerSelfTestStatus = HobitAgentSelfTestStatus;

export type HobitAgentPeerSelfTestInstruction = {
  body: string;
  id: "hobit.agent.peerSelfTest";
  title: string;
};

export type HobitAgentPeerSelfTestRequest = {
  createdAt?: string;
  dryRun: true;
  instructionId: HobitAgentPeerSelfTestInstruction["id"];
  messageBody?: string;
  messageId?: string;
  requestId: string;
  requiredCapabilityIds?: readonly HobitAgentCapabilityId[];
  targetAgentId: HobitAgentId;
  testerAgentId: HobitAgentId;
  unavailableReason?: string;
  unavailableStatus?: "blocked" | "skipped";
};

export type HobitAgentPeerSelfTestCase = {
  caseId: string;
  check: "status" | "capability" | "message" | "history";
  expectedResultDescription: string;
  title: string;
};

export type HobitAgentPeerSelfTestResult = {
  blockedReason?: string;
  caseId: string;
  evidence: string[];
  message: string;
  status: HobitAgentPeerSelfTestStatus;
};

export type HobitAgentPeerSelfTestCheckResult = HobitAgentPeerSelfTestResult & {
  checkedCapabilities?: HobitAgentCapabilityId[];
  missingCapabilities?: HobitAgentCapabilityId[];
  targetStatus?: HobitAgentStatus;
};

export type HobitAgentPeerSelfTestHiddenSideEffectFlags = {
  codexRun: false;
  gitMutation: false;
  hiddenWorkerStart: false;
  queueMutation: false;
  rollbackExecution: false;
  shellCommand: false;
  terminalLaunch: false;
};

export type HobitAgentPeerSelfTestReport = {
  capabilityCheck: HobitAgentPeerSelfTestCheckResult;
  checkedCapabilities: HobitAgentCapabilityId[];
  createdAt: string;
  finalStatus: HobitAgentPeerSelfTestStatus;
  hiddenSideEffectFlags: HobitAgentPeerSelfTestHiddenSideEffectFlags;
  historyCheck: HobitAgentPeerSelfTestCheckResult;
  instructionId: HobitAgentPeerSelfTestInstruction["id"];
  messageCheck: HobitAgentPeerSelfTestCheckResult;
  messageId?: string;
  productSummary: string;
  reportId: string;
  statusCheck: HobitAgentPeerSelfTestCheckResult;
  summary: {
    blocked: number;
    failed: number;
    passed: number;
    skipped: number;
    total: number;
  };
  targetAgentId: HobitAgentId;
  testerAgentId: HobitAgentId;
};

export type HobitAgentPeerSelfTestRunResult = {
  report: HobitAgentPeerSelfTestReport;
  state: HobitAgentRuntimeState;
};

type HobitAgentPeerSelfTestAdapters = {
  afterMessageStateCreated?: (
    state: HobitAgentRuntimeState,
  ) => HobitAgentRuntimeState;
  sendMessage?: typeof sendAgentMessage;
};

export const HOBIT_AGENT_PEER_SELF_TEST_REQUIRED_CAPABILITIES = [
  "agent.status.read",
  "agent.history.read",
  "agent.message.send",
  "agent.capabilities.read",
  "agent.selfTest.run",
] as const satisfies readonly HobitAgentCapabilityId[];

export const HOBIT_AGENT_PEER_SELF_TEST_CASES: HobitAgentPeerSelfTestCase[] = [
  {
    caseId: "agent.peerSelfTest:status",
    check: "status",
    expectedResultDescription:
      "The tester can read the target agent status through the pure runtime API.",
    title: "Read Target Status",
  },
  {
    caseId: "agent.peerSelfTest:capabilities",
    check: "capability",
    expectedResultDescription:
      "The tester can read the target manifest and verify only model-level peer test capabilities.",
    title: "Read Target Capabilities",
  },
  {
    caseId: "agent.peerSelfTest:message",
    check: "message",
    expectedResultDescription:
      "The tester can send a typed internal self-test message to the target.",
    title: "Send Self-Test Message",
  },
  {
    caseId: "agent.peerSelfTest:history",
    check: "history",
    expectedResultDescription:
      "The target bounded history contains the received self-test message.",
    title: "Verify Target History",
  },
];

export function createAgentPeerSelfTestInstruction():
  HobitAgentPeerSelfTestInstruction {
  return {
    body: [
      "Run a safe Hobit agent-to-agent self-test.",
      "Read the peer status, capability manifest, and bounded history through typed model APIs.",
      "Send one typed internal self-test message.",
      "Return structured passed, failed, skipped, or blocked evidence.",
      "Do not call Codex, shell, Queue, Terminal, Git, rollback, workers, broker execution, or app control actions.",
    ].join(" "),
    id: "hobit.agent.peerSelfTest",
    title: "Hobit agent peer self-test",
  };
}

export function createAgentPeerSelfTestRequest({
  createdAt = "2026-01-01T00:00:00.000Z",
  messageBody,
  messageId,
  requestId,
  requiredCapabilityIds = HOBIT_AGENT_PEER_SELF_TEST_REQUIRED_CAPABILITIES,
  targetAgentId,
  testerAgentId,
  unavailableReason,
  unavailableStatus,
}: Omit<
  HobitAgentPeerSelfTestRequest,
  "dryRun" | "instructionId" | "requiredCapabilityIds"
> & {
  requiredCapabilityIds?: readonly HobitAgentCapabilityId[];
}): HobitAgentPeerSelfTestRequest {
  return {
    createdAt,
    dryRun: true,
    instructionId: "hobit.agent.peerSelfTest",
    ...(messageBody ? { messageBody } : {}),
    ...(messageId ? { messageId } : {}),
    requestId,
    requiredCapabilityIds: [...requiredCapabilityIds],
    targetAgentId,
    testerAgentId,
    ...(unavailableReason ? { unavailableReason } : {}),
    ...(unavailableStatus ? { unavailableStatus } : {}),
  };
}

export function runAgentPeerSelfTest({
  adapters = {},
  instruction = createAgentPeerSelfTestInstruction(),
  request,
  state,
}: {
  adapters?: HobitAgentPeerSelfTestAdapters;
  instruction?: HobitAgentPeerSelfTestInstruction;
  request: HobitAgentPeerSelfTestRequest;
  state: HobitAgentRuntimeState;
}): HobitAgentPeerSelfTestRunResult {
  const createdAt = request.createdAt ?? "2026-01-01T00:00:00.000Z";
  const checkedCapabilities = [
    ...(request.requiredCapabilityIds ??
      HOBIT_AGENT_PEER_SELF_TEST_REQUIRED_CAPABILITIES),
  ];

  if (request.unavailableStatus) {
    const check = blockedOrSkippedCheck({
      caseId: "agent.peerSelfTest:status",
      message:
        request.unavailableReason ??
        "Peer self-test is unavailable in this runtime context.",
      status: request.unavailableStatus,
    });

    return {
      report: createPeerSelfTestReport({
        capabilityCheck: blockedOrSkippedCheck({
          caseId: "agent.peerSelfTest:capabilities",
          message: check.message,
          status: request.unavailableStatus,
        }),
        checkedCapabilities,
        createdAt,
        historyCheck: blockedOrSkippedCheck({
          caseId: "agent.peerSelfTest:history",
          message: check.message,
          status: request.unavailableStatus,
        }),
        instructionId: instruction.id,
        messageCheck: blockedOrSkippedCheck({
          caseId: "agent.peerSelfTest:message",
          message: check.message,
          status: request.unavailableStatus,
        }),
        request,
        statusCheck: check,
      }),
      state,
    };
  }

  const testerStatus = getAgentStatus(state, request.testerAgentId);
  const targetStatus = getAgentStatus(state, request.targetAgentId);

  if (!testerStatus.ok || !targetStatus.ok) {
    const missingAgentId = !testerStatus.ok
      ? request.testerAgentId
      : request.targetAgentId;
    const message = `Agent ${missingAgentId} is not available for peer self-test.`;
    const statusCheck = blockedOrSkippedCheck({
      caseId: "agent.peerSelfTest:status",
      message,
      status: "blocked",
    });

    return {
      report: createPeerSelfTestReport({
        capabilityCheck: blockedOrSkippedCheck({
          caseId: "agent.peerSelfTest:capabilities",
          message,
          status: "blocked",
        }),
        checkedCapabilities,
        createdAt,
        historyCheck: blockedOrSkippedCheck({
          caseId: "agent.peerSelfTest:history",
          message,
          status: "blocked",
        }),
        instructionId: instruction.id,
        messageCheck: blockedOrSkippedCheck({
          caseId: "agent.peerSelfTest:message",
          message,
          status: "blocked",
        }),
        request,
        statusCheck,
      }),
      state,
    };
  }

  const statusCheck: HobitAgentPeerSelfTestCheckResult = {
    caseId: "agent.peerSelfTest:status",
    evidence: [
      `${request.targetAgentId} status is ${targetStatus.status}.`,
      `${request.testerAgentId} status is ${testerStatus.status}.`,
    ],
    message: `Read ${request.targetAgentId} status through the agent status API.`,
    status: "passed",
    targetStatus: targetStatus.status,
  };

  const manifestResult = getAgentCapabilityManifest(state, request.targetAgentId);
  if (!manifestResult.ok) {
    const message = `Capability manifest for ${request.targetAgentId} is unavailable.`;

    return {
      report: createPeerSelfTestReport({
        capabilityCheck: blockedOrSkippedCheck({
          caseId: "agent.peerSelfTest:capabilities",
          message,
          status: "blocked",
        }),
        checkedCapabilities,
        createdAt,
        historyCheck: blockedOrSkippedCheck({
          caseId: "agent.peerSelfTest:history",
          message,
          status: "blocked",
        }),
        instructionId: instruction.id,
        messageCheck: blockedOrSkippedCheck({
          caseId: "agent.peerSelfTest:message",
          message,
          status: "blocked",
        }),
        request,
        statusCheck,
      }),
      state,
    };
  }

  const targetCapabilityIds = manifestResult.capabilityManifest.capabilities.map(
    (capability) => capability.id,
  );
  const missingCapabilities = checkedCapabilities.filter(
    (capabilityId) => !targetCapabilityIds.includes(capabilityId),
  );
  const capabilityCheck: HobitAgentPeerSelfTestCheckResult =
    missingCapabilities.length > 0
      ? {
          caseId: "agent.peerSelfTest:capabilities",
          checkedCapabilities,
          evidence: [
            `${request.targetAgentId} manifest is missing: ${missingCapabilities.join(", ")}.`,
          ],
          message: `${request.targetAgentId} is missing required peer self-test capabilities.`,
          missingCapabilities,
          status: "failed",
        }
      : {
          caseId: "agent.peerSelfTest:capabilities",
          checkedCapabilities,
          evidence: checkedCapabilities.map(
            (capabilityId) => `${capabilityId} is declared by ${request.targetAgentId}.`,
          ),
          message: `${request.targetAgentId} exposes all required peer self-test capabilities.`,
          missingCapabilities: [],
          status: "passed",
        };

  if (capabilityCheck.status === "failed") {
    const message = "Message and history checks were skipped after capability verification failed.";

    return {
      report: createPeerSelfTestReport({
        capabilityCheck,
        checkedCapabilities,
        createdAt,
        historyCheck: blockedOrSkippedCheck({
          caseId: "agent.peerSelfTest:history",
          message,
          status: "skipped",
        }),
        instructionId: instruction.id,
        messageCheck: blockedOrSkippedCheck({
          caseId: "agent.peerSelfTest:message",
          message,
          status: "skipped",
        }),
        request,
        statusCheck,
      }),
      state,
    };
  }

  const messageId =
    request.messageId ??
    `${request.requestId}:${request.testerAgentId}:to:${request.targetAgentId}:self-test`;
  const message = createAgentMessage({
    body:
      request.messageBody ??
      `Peer self-test from ${request.testerAgentId} to ${request.targetAgentId}.`,
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
    const messageCheck = messagingFailureCheck(messagingResult);

    return {
      report: createPeerSelfTestReport({
        capabilityCheck,
        checkedCapabilities,
        createdAt,
        historyCheck: blockedOrSkippedCheck({
          caseId: "agent.peerSelfTest:history",
          message: "History verification was skipped because message delivery failed.",
          status: "skipped",
        }),
        instructionId: instruction.id,
        messageCheck,
        request,
        statusCheck,
      }),
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
  const messageCheck: HobitAgentPeerSelfTestCheckResult = {
    caseId: "agent.peerSelfTest:message",
    evidence: [
      `${delivered.messageId} was created as a self_test message.`,
      `${delivered.messageId} was marked ${delivered.status} by the pure messaging helper.`,
    ],
    message: `Delivered peer self-test message ${delivered.messageId}.`,
    status: "passed",
  };
  const history = getAgentBoundedHistory(messageState, {
    agentId: request.targetAgentId,
    direction: "received",
    kind: "self_test",
    limit: messageState.maxHistoryEvents,
  });
  const containsMessage =
    history.ok &&
    history.history.events.some(
      (event) =>
        event.message.messageId === delivered.messageId &&
        event.message.fromAgentId === request.testerAgentId &&
        event.message.toAgentId === request.targetAgentId,
    );
  const historyCheck: HobitAgentPeerSelfTestCheckResult = containsMessage
    ? {
        caseId: "agent.peerSelfTest:history",
        evidence: [
          `${request.targetAgentId} bounded history contains ${delivered.messageId}.`,
        ],
        message: `${request.targetAgentId} received-message history contains the self-test message.`,
        status: "passed",
      }
    : {
        caseId: "agent.peerSelfTest:history",
        evidence: [
          `${request.targetAgentId} received-message history did not include ${delivered.messageId}.`,
        ],
        message: `${request.targetAgentId} history is missing the delivered self-test message.`,
        status: "failed",
      };

  return {
    report: createPeerSelfTestReport({
      capabilityCheck,
      checkedCapabilities,
      createdAt,
      historyCheck,
      instructionId: instruction.id,
      messageCheck,
      messageId: delivered.messageId,
      request,
      statusCheck,
    }),
    state: messageState,
  };
}

export function summarizeAgentPeerSelfTestReport(
  reportOrResults:
    | HobitAgentPeerSelfTestReport
    | readonly HobitAgentPeerSelfTestResult[],
): HobitAgentPeerSelfTestReport["summary"] {
  const results = isAgentPeerSelfTestReport(reportOrResults)
    ? [
        reportOrResults.statusCheck,
        reportOrResults.capabilityCheck,
        reportOrResults.messageCheck,
        reportOrResults.historyCheck,
      ]
    : reportOrResults;

  return {
    blocked: results.filter((result) => result.status === "blocked").length,
    failed: results.filter((result) => result.status === "failed").length,
    passed: results.filter((result) => result.status === "passed").length,
    skipped: results.filter((result) => result.status === "skipped").length,
    total: results.length,
  };
}

function isAgentPeerSelfTestReport(
  value: HobitAgentPeerSelfTestReport | readonly HobitAgentPeerSelfTestResult[],
): value is HobitAgentPeerSelfTestReport {
  return !Array.isArray(value);
}

function createPeerSelfTestReport({
  capabilityCheck,
  checkedCapabilities,
  createdAt,
  historyCheck,
  instructionId,
  messageCheck,
  messageId,
  request,
  statusCheck,
}: {
  capabilityCheck: HobitAgentPeerSelfTestCheckResult;
  checkedCapabilities: readonly HobitAgentCapabilityId[];
  createdAt: string;
  historyCheck: HobitAgentPeerSelfTestCheckResult;
  instructionId: HobitAgentPeerSelfTestInstruction["id"];
  messageCheck: HobitAgentPeerSelfTestCheckResult;
  messageId?: string;
  request: HobitAgentPeerSelfTestRequest;
  statusCheck: HobitAgentPeerSelfTestCheckResult;
}): HobitAgentPeerSelfTestReport {
  const checks = [statusCheck, capabilityCheck, messageCheck, historyCheck];
  const finalStatus = finalStatusForChecks(checks);
  const summary = summarizeAgentPeerSelfTestReport(checks);

  return {
    capabilityCheck,
    checkedCapabilities: [...checkedCapabilities],
    createdAt,
    finalStatus,
    hiddenSideEffectFlags: noHiddenSideEffectFlags(),
    historyCheck,
    instructionId,
    messageCheck,
    ...(messageId ? { messageId } : {}),
    productSummary: productSummary({
      finalStatus,
      targetAgentId: request.targetAgentId,
      testerAgentId: request.testerAgentId,
    }),
    reportId: `${request.requestId}:report`,
    statusCheck,
    summary,
    targetAgentId: request.targetAgentId,
    testerAgentId: request.testerAgentId,
  };
}

function finalStatusForChecks(
  checks: readonly HobitAgentPeerSelfTestResult[],
): HobitAgentPeerSelfTestStatus {
  if (checks.some((check) => check.status === "failed")) {
    return "failed";
  }

  if (checks.some((check) => check.status === "blocked")) {
    return "blocked";
  }

  if (checks.some((check) => check.status === "skipped")) {
    return "skipped";
  }

  return "passed";
}

function blockedOrSkippedCheck({
  caseId,
  message,
  status,
}: {
  caseId: string;
  message: string;
  status: "blocked" | "skipped";
}): HobitAgentPeerSelfTestCheckResult {
  return status === "blocked"
    ? {
        blockedReason: message,
        caseId,
        evidence: [message],
        message,
        status,
      }
    : {
        caseId,
        evidence: [message],
        message,
        status,
      };
}

function messagingFailureCheck(
  result: Extract<HobitAgentMessagingResult, { ok: false }>,
): HobitAgentPeerSelfTestCheckResult {
  return {
    caseId: "agent.peerSelfTest:message",
    evidence: [result.error.message],
    message: `Peer self-test message delivery failed: ${result.error.message}`,
    status: "failed",
  };
}

function noHiddenSideEffectFlags(): HobitAgentPeerSelfTestHiddenSideEffectFlags {
  return {
    codexRun: false,
    gitMutation: false,
    hiddenWorkerStart: false,
    queueMutation: false,
    rollbackExecution: false,
    shellCommand: false,
    terminalLaunch: false,
  };
}

function productSummary({
  finalStatus,
  targetAgentId,
  testerAgentId,
}: {
  finalStatus: HobitAgentPeerSelfTestStatus;
  targetAgentId: HobitAgentId;
  testerAgentId: HobitAgentId;
}): string {
  if (finalStatus === "passed") {
    return `${testerAgentId} verified ${targetAgentId} through safe in-app agent APIs. No hidden execution or product mutation was represented.`;
  }

  if (finalStatus === "failed") {
    return `${testerAgentId} found peer self-test failures for ${targetAgentId}. Review the structured check results before relying on this agent pair.`;
  }

  if (finalStatus === "blocked") {
    return `${testerAgentId} could not complete the peer self-test for ${targetAgentId} because a required model condition was blocked.`;
  }

  return `${testerAgentId} skipped the peer self-test for ${targetAgentId} because the safe model check was unavailable.`;
}
