import type { HobitAgentCapabilityId } from "../capabilities";
import type { HobitAgentId, HobitAgentRuntimeState } from "../runtime";
import type { HobitWidgetId } from "../widgets";
import type { HobitAgentSelfTestStatus } from "./types";

export type HobitAgentSmokeStatus = HobitAgentSelfTestStatus;

export const HOBIT_AGENT_SMOKE_PRODUCT_LABELS = {
  adapterNotImplemented: "Adapter not implemented yet",
  adapterNotAvailable: "Adapter not available",
  blocked: "Blocked",
  dryRunOnly: "Dry-run only",
  failed: "Failed",
  finderExcluded: "Finder excluded",
  noHiddenSideEffects: "No hidden side effects",
  noQueueMutation: "No Queue mutation",
  noQueueViewCreation: "No Queue view creation",
  noQueueWorkerStart: "No Queue worker start",
  passed: "Passed",
  queueDogfoodAgentFinishedAwaitingReview: "Agent finished - awaiting review",
  queueDogfoodBrokerLoop: "Queue dogfood broker loop",
  queueDogfoodCoordinatorAckInReview: "Coordinator ACK - in review",
  queueDogfoodDependentUnblockedAfterDone: "Dependent unblocked after done",
  queueDogfoodFollowUpReturnsToRunning:
    "Follow-up prompt returns to running",
  queueDogfoodMarkDone: "Mark done",
  queueDogfoodReviewMessageCreated: "Review message created",
  queueDogfoodValidationApproved: "Validation approved",
  queueDryRunPreviewPrepared: "Queue dry-run preview prepared",
  queueSelfTestPassed: "Queue self-test passed",
  restrictedCapability: "Restricted capability",
  runtimeExecutionNotImplemented: "Runtime execution not implemented yet",
  safeCheckSkipped: "Safe check skipped",
  skipped: "Skipped",
  singletonQueueTargetVerified: "Singleton Queue target verified",
} as const;

export function hobitAgentSmokeStatusLabel(
  status: HobitAgentSmokeStatus,
): string {
  if (status === "passed") {
    return HOBIT_AGENT_SMOKE_PRODUCT_LABELS.passed;
  }

  if (status === "failed") {
    return HOBIT_AGENT_SMOKE_PRODUCT_LABELS.failed;
  }

  if (status === "blocked") {
    return HOBIT_AGENT_SMOKE_PRODUCT_LABELS.blocked;
  }

  return HOBIT_AGENT_SMOKE_PRODUCT_LABELS.skipped;
}

export type HobitAgentSmokeInstruction = {
  body: string;
  id: "hobit.agent.smoke";
  title: string;
};

export type HobitAgentSmokeRequest = {
  agentApiTargetAgentId?: HobitAgentId;
  agentApiTesterAgentId?: HobitAgentId;
  createdAt?: string;
  dryRun: true;
  instructionId: HobitAgentSmokeInstruction["id"];
  requestId: string;
  runnerAgentId: HobitAgentId;
  widgetInstanceId?: string;
  workspaceId?: string;
  workspaceRoot?: string | null;
};

export type HobitAgentSmokeCaseKind =
  | "agent-api"
  | "agent-peer-self-test"
  | "capability-manifest"
  | "excluded-scope"
  | "hidden-side-effect"
  | "restricted-capability"
  | "workspace-agent-context"
  | "widget-contract"
  | "capability-dry-run";

export type HobitAgentSmokeSafeMode =
  | "dry-run"
  | "excluded"
  | "metadata-only"
  | "read"
  | "restricted";

export type HobitAgentSmokeCase = {
  capabilityId?: HobitAgentCapabilityId;
  caseId: string;
  componentId: string;
  componentTitle: string;
  expectedResultDescription: string;
  kind: HobitAgentSmokeCaseKind;
  plannedStatus?: HobitAgentSmokeStatus;
  productFacingReason?: string;
  required: boolean;
  safeMode: HobitAgentSmokeSafeMode;
  source: string;
  title: string;
  widgetId?: HobitWidgetId;
};

export type HobitAgentSmokePlan = {
  cases: HobitAgentSmokeCase[];
  componentIds: string[];
  createdAt: string;
  instruction: HobitAgentSmokeInstruction;
  requestId: string;
  runnerAgentId: HobitAgentId;
  workspaceId?: string;
};

export type HobitAgentSmokeResult = HobitAgentSmokeCase & {
  evidence: string[];
  hiddenSideEffectAssertions: string[];
  message: string;
  reason?: string;
  status: HobitAgentSmokeStatus;
  statusLabel: string;
};

export type HobitAgentSmokeComponentResult = {
  checkedCaseIds: string[];
  componentId: string;
  message: string;
  optionalCaseCount: number;
  requiredCaseCount: number;
  status: HobitAgentSmokeStatus;
  statusLabel: string;
  title: string;
};

export type HobitAgentSmokeHiddenSideEffectAssertion = {
  assertionId: string;
  label: string;
  passed: boolean;
};

export type HobitAgentSmokeReport = {
  cases: HobitAgentSmokeCase[];
  componentsChecked: HobitAgentSmokeComponentResult[];
  createdAt: string;
  hiddenSideEffectAssertions: HobitAgentSmokeHiddenSideEffectAssertion[];
  instructionId: HobitAgentSmokeInstruction["id"];
  overallStatus: HobitAgentSmokeStatus;
  overallStatusLabel: string;
  productFacingSummary: string;
  reportId: string;
  results: HobitAgentSmokeResult[];
  runnerAgentId: HobitAgentId;
  summary: {
    blocked: number;
    failed: number;
    passed: number;
    skipped: number;
    total: number;
  };
  workspaceId?: string;
};

export type HobitAgentSmokeRunResult = {
  report: HobitAgentSmokeReport;
  state: HobitAgentRuntimeState;
};
