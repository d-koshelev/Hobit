export type HobitWidgetId = string;

export type HobitWidgetCapabilitySideEffect =
  | "read"
  | "write"
  | "execute"
  | "destructive";

export type HobitWidgetConfirmationRequirement =
  | "none"
  | "recommended"
  | "required";

export type HobitWidgetContractAvailability =
  | {
      status: "available";
      unavailableReason?: never;
    }
  | {
      status: "unavailable";
      unavailableReason: string;
    };

export type HobitWidgetCapabilityPolicy = {
  confirmationRequirement: HobitWidgetConfirmationRequirement;
  forbiddenSideEffects: string[];
  restricted: boolean;
  sideEffectLevel: HobitWidgetCapabilitySideEffect;
  supportsDryRun: boolean;
  supportsPreview: boolean;
};

export type HobitWidgetCapabilityContract = HobitWidgetCapabilityPolicy & {
  auditEventNames: string[];
  availability: HobitWidgetContractAvailability;
  capabilityId: string;
  description: string;
  inputSchemaDescription: string;
  outputSchemaDescription: string;
  title: string;
};

export type HobitWidgetSelfTestInstruction = {
  body: string;
  id: string;
  title: string;
};

export type HobitWidgetSelfTestCase = {
  caseId: string;
  capabilityId: string;
  expectedResultDescription: string;
  hiddenSideEffectAssertions: string[];
  title: string;
};

export type HobitWidgetSelfTestStatus =
  | "passed"
  | "failed"
  | "skipped"
  | "blocked";

export type HobitWidgetSelfTestResult = {
  blockedReason?: string;
  caseId: string;
  evidence: string[];
  hiddenSideEffectAssertions: string[];
  message: string;
  status: HobitWidgetSelfTestStatus;
};

export type HobitWidgetSelfTestReport = {
  instruction: HobitWidgetSelfTestInstruction;
  results: HobitWidgetSelfTestResult[];
  summary: {
    blocked: number;
    failed: number;
    passed: number;
    skipped: number;
    total: number;
  };
  widgetId: HobitWidgetId;
};

export type HobitWidgetAgentContract = {
  availability: HobitWidgetContractAvailability;
  capabilities: HobitWidgetCapabilityContract[];
  expectedResultDescription: string;
  hiddenSideEffectAssertions: string[];
  ownerModule: string;
  ownerSurface: string;
  productDescription: string;
  selfTestCases: HobitWidgetSelfTestCase[];
  selfTestInstruction: HobitWidgetSelfTestInstruction;
  title: string;
  widgetId: HobitWidgetId;
};

export type HobitWidgetContractLookupResult =
  | {
      contract: HobitWidgetAgentContract;
      status: "found";
    }
  | {
      selfTestReport: HobitWidgetSelfTestReport;
      status: "unavailable";
      unavailableReason: string;
      widgetId: HobitWidgetId;
    };

export function createWidgetCapabilityContract(
  capability: HobitWidgetCapabilityContract,
): HobitWidgetCapabilityContract {
  return {
    ...capability,
    auditEventNames: [...capability.auditEventNames].sort(),
    forbiddenSideEffects: [...capability.forbiddenSideEffects].sort(),
  };
}

export function createWidgetSelfTestInstruction({
  body,
  id,
  title,
}: HobitWidgetSelfTestInstruction): HobitWidgetSelfTestInstruction {
  return { body, id, title };
}

export function createWidgetAgentContract(
  contract: HobitWidgetAgentContract,
): HobitWidgetAgentContract {
  const stableContract = {
    ...contract,
    capabilities: [...contract.capabilities]
      .map(createWidgetCapabilityContract)
      .sort((left, right) => left.capabilityId.localeCompare(right.capabilityId)),
    hiddenSideEffectAssertions: [
      ...contract.hiddenSideEffectAssertions,
    ].sort(),
    selfTestCases: [...contract.selfTestCases].sort((left, right) =>
      left.caseId.localeCompare(right.caseId),
    ),
  };

  assertWidgetContractHasSelfTest(stableContract);
  return stableContract;
}

export function listWidgetCapabilities(
  contract: HobitWidgetAgentContract,
): HobitWidgetCapabilityContract[] {
  return [...contract.capabilities];
}

export function listWidgetSelfTestCases(
  contract: HobitWidgetAgentContract,
): HobitWidgetSelfTestCase[] {
  return [...contract.selfTestCases];
}

export function createWidgetSelfTestReport({
  instruction,
  results,
  widgetId,
}: {
  instruction: HobitWidgetSelfTestInstruction;
  results: readonly HobitWidgetSelfTestResult[];
  widgetId: HobitWidgetId;
}): HobitWidgetSelfTestReport {
  const stableResults = [...results].sort((left, right) =>
    left.caseId.localeCompare(right.caseId),
  );

  return {
    instruction,
    results: stableResults,
    summary: summarizeWidgetSelfTestReport(stableResults),
    widgetId,
  };
}

export function summarizeWidgetSelfTestReport(
  reportOrResults:
    | HobitWidgetSelfTestReport
    | readonly HobitWidgetSelfTestResult[],
): HobitWidgetSelfTestReport["summary"] {
  const results: readonly HobitWidgetSelfTestResult[] =
    isWidgetSelfTestReport(reportOrResults)
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

function isWidgetSelfTestReport(
  value: HobitWidgetSelfTestReport | readonly HobitWidgetSelfTestResult[],
): value is HobitWidgetSelfTestReport {
  return !Array.isArray(value);
}

export function assertWidgetContractHasSelfTest(
  contract: Pick<
    HobitWidgetAgentContract,
    "selfTestCases" | "selfTestInstruction" | "widgetId"
  >,
): true {
  if (!contract.selfTestInstruction.body.trim()) {
    throw new Error(`${contract.widgetId} is missing a self-test instruction.`);
  }

  if (contract.selfTestCases.length === 0) {
    throw new Error(`${contract.widgetId} is missing self-test cases.`);
  }

  return true;
}

export function createUnavailableWidgetContractLookupResult({
  unavailableReason,
  widgetId,
}: {
  unavailableReason: string;
  widgetId: HobitWidgetId;
}): HobitWidgetContractLookupResult {
  const instruction = createWidgetSelfTestInstruction({
    body: [
      `Widget contract ${widgetId} is unavailable.`,
      "Do not infer capabilities or execute product actions.",
      "Return skipped or blocked self-test evidence with the unavailable reason.",
    ].join(" "),
    id: `${widgetId}.selfTest.unavailable`,
    title: "Unavailable widget contract self-test",
  });

  return {
    selfTestReport: createWidgetSelfTestReport({
      instruction,
      results: [
        {
          blockedReason: unavailableReason,
          caseId: `${widgetId}:contract-unavailable`,
          evidence: [unavailableReason],
          hiddenSideEffectAssertions: ["no_capability_inference"],
          message: `${widgetId} contract is unavailable.`,
          status: "skipped",
        },
      ],
      widgetId,
    }),
    status: "unavailable",
    unavailableReason,
    widgetId,
  };
}
