import {
  listWidgetContracts,
  type HobitWidgetAgentContract,
} from "../widgets";
import {
  HOBIT_AGENT_SMOKE_PRODUCT_LABELS,
  type HobitAgentSmokeCase,
  type HobitAgentSmokeInstruction,
  type HobitAgentSmokePlan,
  type HobitAgentSmokeRequest,
} from "./hobitAgentSmokeTypes";

export function createHobitAgentSmokePlan({
  createdAt,
  instruction,
  request,
}: {
  createdAt?: string;
  instruction: HobitAgentSmokeInstruction;
  request: HobitAgentSmokeRequest;
}): HobitAgentSmokePlan {
  const resolvedCreatedAt =
    createdAt ?? request.createdAt ?? "2026-01-01T00:00:00.000Z";
  const cases = [
    ...workspaceAgentContextPlanCases(),
    ...agentRuntimePlanCases(),
    ...widgetContractPlanCases(),
    ...queueCapabilityPlanCases(),
    ...queueDogfoodBrokerPlanCases(),
    ...widgetExecutionUnavailablePlanCases(),
    finderExcludedPlanCase(),
    ...restrictedCapabilityPlanCases(),
    hiddenSideEffectPlanCase(),
  ];

  return {
    cases,
    componentIds: componentIdsForCases(cases),
    createdAt: resolvedCreatedAt,
    instruction,
    requestId: request.requestId,
    runnerAgentId: request.runnerAgentId,
    ...(request.workspaceId ? { workspaceId: request.workspaceId } : {}),
  };
}

function workspaceAgentContextPlanCases(): HobitAgentSmokeCase[] {
  return [
    smokeCase({
      caseId: "app-context:hobit",
      componentId: "workspace-agent-context",
      componentTitle: "Workspace Agent context",
      expectedResultDescription:
        "The Workspace Agent smoke context identifies Hobit and the current Workspace scope.",
      kind: "workspace-agent-context",
      required: true,
      safeMode: "read",
      source: "Workspace Agent capability context",
      title: "Hobit app context",
    }),
    smokeCase({
      caseId: "workspace-agent:capability-context",
      componentId: "workspace-agent-context",
      componentTitle: "Workspace Agent context",
      expectedResultDescription:
        "Workspace Agent capability context includes broker instructions and capability manifest text.",
      kind: "workspace-agent-context",
      required: true,
      safeMode: "read",
      source: "Workspace Agent capability context",
      title: "Capability context",
    }),
    smokeCase({
      caseId: "capability-manifest:available",
      componentId: "capability-manifest",
      componentTitle: "Capability manifest",
      expectedResultDescription:
        "The typed Hobit capability manifest is available for structured action selection.",
      kind: "capability-manifest",
      required: true,
      safeMode: "read",
      source: "Capability Registry",
      title: "Capability manifest",
    }),
  ];
}

function agentRuntimePlanCases(): HobitAgentSmokeCase[] {
  return [
    smokeCase({
      capabilityId: "agent.status.read",
      caseId: "agent.apiSmoke:status.read",
      componentId: "agent-api-smoke",
      componentTitle: "Agent API smoke",
      expectedResultDescription:
        "The runner can read target agent status through the in-app agent runtime API.",
      kind: "agent-api",
      required: true,
      safeMode: "read",
      source: "Agent API Smoke Runner",
      title: "agent.status.read available",
    }),
    smokeCase({
      capabilityId: "agent.history.read",
      caseId: "agent.apiSmoke:history.read",
      componentId: "agent-api-smoke",
      componentTitle: "Agent API smoke",
      expectedResultDescription:
        "The runner can read bounded target history after a safe self-test message.",
      kind: "agent-api",
      required: true,
      safeMode: "read",
      source: "Agent API Smoke Runner",
      title: "agent.history.read available",
    }),
    smokeCase({
      capabilityId: "agent.message.send",
      caseId: "agent.apiSmoke:message.send",
      componentId: "agent-api-smoke",
      componentTitle: "Agent API smoke",
      expectedResultDescription:
        "The runner can send one typed self-test message through the in-app agent messaging model.",
      kind: "agent-api",
      required: true,
      safeMode: "dry-run",
      source: "Agent API Smoke Runner",
      title: "agent.message.send available",
    }),
    smokeCase({
      capabilityId: "agent.capabilities.read",
      caseId: "agent.apiSmoke:capabilities.read",
      componentId: "agent-api-smoke",
      componentTitle: "Agent API smoke",
      expectedResultDescription:
        "The runner can read the target agent capability manifest.",
      kind: "agent-api",
      required: true,
      safeMode: "read",
      source: "Agent API Smoke Runner",
      title: "agent.capabilities.read available",
    }),
    smokeCase({
      capabilityId: "agent.selfTest.run",
      caseId: "agent.apiSmoke:selfTest.run",
      componentId: "agent-peer-self-test",
      componentTitle: "Agent Peer SelfTest",
      expectedResultDescription:
        "The runner can use the peer self-test helper as part of agent API smoke.",
      kind: "agent-peer-self-test",
      required: true,
      safeMode: "dry-run",
      source: "Agent Peer SelfTest",
      title: "agent.selfTest.run peer self-test",
    }),
  ];
}

function widgetContractPlanCases(): HobitAgentSmokeCase[] {
  return listWidgetContracts().map((contract) =>
    smokeCase({
      caseId: `widget-contract:${contract.widgetId}`,
      componentId: "widget-contracts",
      componentTitle: "Widget Agent Contracts",
      expectedResultDescription:
        `${contract.title} contract exists with capabilities, self-test cases, and hidden side-effect assertions.`,
      kind: "widget-contract",
      required: true,
      safeMode: "metadata-only",
      source: "Widget Agent Contract registry",
      title: widgetContractTitle(contract),
      widgetId: contract.widgetId,
    }),
  );
}

function queueCapabilityPlanCases(): HobitAgentSmokeCase[] {
  return [
    smokeCase({
      capabilityId: "queue.targetSingletonQueue",
      caseId: "queue:singleton-target",
      componentId: "queue-safe-smoke",
      componentTitle: "Agent Queue safe checks",
      expectedResultDescription:
        "The smoke can resolve the singleton Queue target without creating a Queue view.",
      kind: "capability-dry-run",
      required: true,
      safeMode: "dry-run",
      source: "Action Broker queue.selfTest",
      title: HOBIT_AGENT_SMOKE_PRODUCT_LABELS.singletonQueueTargetVerified,
      widgetId: "agent-queue",
    }),
    smokeCase({
      capabilityId: "queue.createItems",
      caseId: "queue:create-items-dry-run",
      componentId: "queue-safe-smoke",
      componentTitle: "Agent Queue safe checks",
      expectedResultDescription:
        "Queue create-items smoke runs only as a safe dry-run/fake check and does not create tasks.",
      kind: "capability-dry-run",
      required: true,
      safeMode: "dry-run",
      source: "Action Broker queue.selfTest",
      title: HOBIT_AGENT_SMOKE_PRODUCT_LABELS.queueDryRunPreviewPrepared,
      widgetId: "agent-queue",
    }),
    smokeCase({
      capabilityId: "queue.createItems",
      caseId: "queue:dry-run-target-singleton",
      componentId: "queue-safe-smoke",
      componentTitle: "Agent Queue safe checks",
      expectedResultDescription:
        "Queue createItems dry-run reports it would target the singleton Workspace Queue.",
      kind: "capability-dry-run",
      required: true,
      safeMode: "dry-run",
      source: "Action Broker queue.selfTest",
      title: HOBIT_AGENT_SMOKE_PRODUCT_LABELS.singletonQueueTargetVerified,
      widgetId: "agent-queue",
    }),
    smokeCase({
      capabilityId: "queue.createItems",
      caseId: "queue:no-auto-run",
      componentId: "queue-safe-smoke",
      componentTitle: "Agent Queue safe checks",
      expectedResultDescription:
        "Queue createItems dry-run reports it would not auto-run Queue workers.",
      kind: "capability-dry-run",
      required: true,
      safeMode: "dry-run",
      source: "Action Broker queue.selfTest",
      title: HOBIT_AGENT_SMOKE_PRODUCT_LABELS.noQueueWorkerStart,
      widgetId: "agent-queue",
    }),
    smokeCase({
      capabilityId: "queue.createItems",
      caseId: "queue:no-duplicate-view",
      componentId: "queue-safe-smoke",
      componentTitle: "Agent Queue safe checks",
      expectedResultDescription:
        "Queue createItems dry-run reports it would not create a duplicate Queue view.",
      kind: "capability-dry-run",
      required: true,
      safeMode: "dry-run",
      source: "Action Broker queue.selfTest",
      title: HOBIT_AGENT_SMOKE_PRODUCT_LABELS.noQueueViewCreation,
      widgetId: "agent-queue",
    }),
    smokeCase({
      capabilityId: "queue.selfTest",
      caseId: "queue:self-test-dry-run",
      componentId: "queue-safe-smoke",
      componentTitle: "Agent Queue safe checks",
      expectedResultDescription:
        "Queue self-test reports singleton, dry-run, and hidden side-effect evidence.",
      kind: "capability-dry-run",
      required: true,
      safeMode: "dry-run",
      source: "Action Broker queue.selfTest",
      title: HOBIT_AGENT_SMOKE_PRODUCT_LABELS.queueSelfTestPassed,
      widgetId: "agent-queue",
    }),
    smokeCase({
      capabilityId: "queue.preparePromptPackPreview",
      caseId: "queue:prompt-pack-preview-dry-run",
      componentId: "queue-safe-smoke",
      componentTitle: "Agent Queue safe checks",
      expectedResultDescription:
        "Queue prompt-pack preview dry-run returns Smart Queue materialization without creating Queue items.",
      kind: "capability-dry-run",
      required: true,
      safeMode: "dry-run",
      source: "Action Broker queue.selfTest",
      title: "Queue prompt-pack preview dry-run",
      widgetId: "agent-queue",
    }),
    smokeCase({
      capabilityId: "queue.selfTest",
      caseId: "queue:no-mutation",
      componentId: "queue-safe-smoke",
      componentTitle: "Agent Queue safe checks",
      expectedResultDescription:
        "Queue self-test asserts no real Queue task mutation occurred.",
      kind: "capability-dry-run",
      required: true,
      safeMode: "dry-run",
      source: "Action Broker queue.selfTest",
      title: HOBIT_AGENT_SMOKE_PRODUCT_LABELS.noQueueMutation,
      widgetId: "agent-queue",
    }),
    smokeCase({
      capabilityId: "queue.selfTest",
      caseId: "queue:no-hidden-side-effects",
      componentId: "queue-safe-smoke",
      componentTitle: "Agent Queue safe checks",
      expectedResultDescription:
        "Queue self-test asserts no hidden Codex, shell, Terminal, Git, rollback, worker, Autorun, or duplicate Queue view side effects.",
      kind: "capability-dry-run",
      required: true,
      safeMode: "dry-run",
      source: "Action Broker queue.selfTest",
      title: HOBIT_AGENT_SMOKE_PRODUCT_LABELS.noHiddenSideEffects,
      widgetId: "agent-queue",
    }),
  ];
}

function queueDogfoodBrokerPlanCases(): HobitAgentSmokeCase[] {
  return [
    smokeCase({
      caseId: "queue-dogfood-broker:summary",
      componentId: "queue-dogfood-broker-loop",
      componentTitle: "Queue dogfood broker loop",
      expectedResultDescription:
        "The fake Queue dogfood lifecycle loop runs through the real Action Broker capabilities.",
      kind: "capability-dry-run",
      required: true,
      safeMode: "dry-run",
      source: "Action Broker Queue dogfood self-test",
      title: HOBIT_AGENT_SMOKE_PRODUCT_LABELS.queueDogfoodBrokerLoop,
      widgetId: "agent-queue",
    }),
    smokeCase({
      capabilityId: "queue.lifecycle.agentFinished",
      caseId: "queue-dogfood-broker:agent-finished-awaiting-review",
      componentId: "queue-dogfood-broker-loop",
      componentTitle: "Queue dogfood broker loop",
      expectedResultDescription:
        "queue.lifecycle.agentFinished moves fake running work to awaiting review through the broker.",
      kind: "capability-dry-run",
      required: true,
      safeMode: "dry-run",
      source: "Action Broker Queue dogfood self-test",
      title:
        HOBIT_AGENT_SMOKE_PRODUCT_LABELS.queueDogfoodAgentFinishedAwaitingReview,
      widgetId: "agent-queue",
    }),
    smokeCase({
      capabilityId: "queue.review.createMessage",
      caseId: "queue-dogfood-broker:review-message-created",
      componentId: "queue-dogfood-broker-loop",
      componentTitle: "Queue dogfood broker loop",
      expectedResultDescription:
        "queue.review.createMessage creates fake review evidence through the broker.",
      kind: "capability-dry-run",
      required: true,
      safeMode: "dry-run",
      source: "Action Broker Queue dogfood self-test",
      title: HOBIT_AGENT_SMOKE_PRODUCT_LABELS.queueDogfoodReviewMessageCreated,
      widgetId: "agent-queue",
    }),
    smokeCase({
      capabilityId: "queue.review.ack",
      caseId: "queue-dogfood-broker:coordinator-ack-in-review",
      componentId: "queue-dogfood-broker-loop",
      componentTitle: "Queue dogfood broker loop",
      expectedResultDescription:
        "queue.review.ack moves the fake item into review through the broker.",
      kind: "capability-dry-run",
      required: true,
      safeMode: "dry-run",
      source: "Action Broker Queue dogfood self-test",
      title: HOBIT_AGENT_SMOKE_PRODUCT_LABELS.queueDogfoodCoordinatorAckInReview,
      widgetId: "agent-queue",
    }),
    smokeCase({
      capabilityId: "queue.coordinator.approveValidation",
      caseId: "queue-dogfood-broker:validation-approved",
      componentId: "queue-dogfood-broker-loop",
      componentTitle: "Queue dogfood broker loop",
      expectedResultDescription:
        "queue.coordinator.approveValidation records model-only fake validation approval through the broker.",
      kind: "capability-dry-run",
      required: true,
      safeMode: "dry-run",
      source: "Action Broker Queue dogfood self-test",
      title: HOBIT_AGENT_SMOKE_PRODUCT_LABELS.queueDogfoodValidationApproved,
      widgetId: "agent-queue",
    }),
    smokeCase({
      capabilityId: "queue.item.markDone",
      caseId: "queue-dogfood-broker:mark-done",
      componentId: "queue-dogfood-broker-loop",
      componentTitle: "Queue dogfood broker loop",
      expectedResultDescription:
        "queue.item.markDone closes the fake item with fake commit metadata and no Git mutation.",
      kind: "capability-dry-run",
      required: true,
      safeMode: "dry-run",
      source: "Action Broker Queue dogfood self-test",
      title: HOBIT_AGENT_SMOKE_PRODUCT_LABELS.queueDogfoodMarkDone,
      widgetId: "agent-queue",
    }),
    smokeCase({
      capabilityId: "queue.item.markDone",
      caseId: "queue-dogfood-broker:dependent-unblocked-after-done",
      componentId: "queue-dogfood-broker-loop",
      componentTitle: "Queue dogfood broker loop",
      expectedResultDescription:
        "The fake dependent task becomes eligible only after the upstream lifecycle is done.",
      kind: "capability-dry-run",
      required: true,
      safeMode: "dry-run",
      source: "Action Broker Queue dogfood self-test",
      title:
        HOBIT_AGENT_SMOKE_PRODUCT_LABELS.queueDogfoodDependentUnblockedAfterDone,
      widgetId: "agent-queue",
    }),
    smokeCase({
      capabilityId: "queue.coordinator.addFollowUpPrompt",
      caseId: "queue-dogfood-broker:follow-up-running",
      componentId: "queue-dogfood-broker-loop",
      componentTitle: "Queue dogfood broker loop",
      expectedResultDescription:
        "queue.coordinator.addFollowUpPrompt returns the same fake item to running/additional_prompt_running.",
      kind: "capability-dry-run",
      required: true,
      safeMode: "dry-run",
      source: "Action Broker Queue dogfood self-test",
      title:
        HOBIT_AGENT_SMOKE_PRODUCT_LABELS.queueDogfoodFollowUpReturnsToRunning,
      widgetId: "agent-queue",
    }),
    smokeCase({
      capabilityId: "queue.item.fail",
      caseId: "queue-dogfood-broker:failure-dependent-blocked",
      componentId: "queue-dogfood-broker-loop",
      componentTitle: "Queue dogfood broker loop",
      expectedResultDescription:
        "The fake failure branch keeps dependent work ineligible through the dependency gate.",
      kind: "capability-dry-run",
      required: true,
      safeMode: "dry-run",
      source: "Action Broker Queue dogfood self-test",
      title: "Failure keeps dependent blocked",
      widgetId: "agent-queue",
    }),
    smokeCase({
      caseId: "queue-dogfood-broker:no-hidden-side-effects",
      componentId: "queue-dogfood-broker-loop",
      componentTitle: "Queue dogfood broker loop",
      expectedResultDescription:
        "The broker loop asserts no Codex, shell, Terminal, Git, rollback, worker, duplicate Queue view, backend persistence, or regex routing side effects.",
      kind: "hidden-side-effect",
      required: true,
      safeMode: "dry-run",
      source: "Action Broker Queue dogfood self-test",
      title: HOBIT_AGENT_SMOKE_PRODUCT_LABELS.noHiddenSideEffects,
      widgetId: "agent-queue",
    }),
    smokeCase({
      caseId: "queue-dogfood-broker:backend-durability",
      componentId: "queue-dogfood-broker-runtime-gaps",
      componentTitle: "Queue dogfood broker runtime gaps",
      expectedResultDescription:
        "Backend durability is outside the fake broker self-test and must be reported honestly.",
      kind: "capability-dry-run",
      plannedStatus: "skipped",
      productFacingReason: "Frontend fake broker self-test only",
      required: false,
      safeMode: "metadata-only",
      source: "Action Broker Queue dogfood self-test",
      title: "Backend durability not covered",
      widgetId: "agent-queue",
    }),
    smokeCase({
      caseId: "queue-dogfood-broker:real-worker-execution",
      componentId: "queue-dogfood-broker-runtime-gaps",
      componentTitle: "Queue dogfood broker runtime gaps",
      expectedResultDescription:
        "Real worker execution is outside the fake broker self-test and must be reported honestly.",
      kind: "capability-dry-run",
      plannedStatus: "blocked",
      productFacingReason:
        HOBIT_AGENT_SMOKE_PRODUCT_LABELS.runtimeExecutionNotImplemented,
      required: false,
      safeMode: "metadata-only",
      source: "Action Broker Queue dogfood self-test",
      title: "Real worker execution not covered",
      widgetId: "agent-queue",
    }),
    smokeCase({
      caseId: "queue-dogfood-broker:real-validation-execution",
      componentId: "queue-dogfood-broker-runtime-gaps",
      componentTitle: "Queue dogfood broker runtime gaps",
      expectedResultDescription:
        "Real validation execution is outside the fake broker self-test and must be reported honestly.",
      kind: "capability-dry-run",
      plannedStatus: "blocked",
      productFacingReason:
        HOBIT_AGENT_SMOKE_PRODUCT_LABELS.runtimeExecutionNotImplemented,
      required: false,
      safeMode: "metadata-only",
      source: "Action Broker Queue dogfood self-test",
      title: "Real validation execution not covered",
      widgetId: "agent-queue",
    }),
    smokeCase({
      caseId: "queue-dogfood-broker:real-git-commit-execution",
      componentId: "queue-dogfood-broker-runtime-gaps",
      componentTitle: "Queue dogfood broker runtime gaps",
      expectedResultDescription:
        "Real Git commit execution is outside the fake broker self-test and must be reported honestly.",
      kind: "capability-dry-run",
      plannedStatus: "blocked",
      productFacingReason:
        HOBIT_AGENT_SMOKE_PRODUCT_LABELS.runtimeExecutionNotImplemented,
      required: false,
      safeMode: "metadata-only",
      source: "Action Broker Queue dogfood self-test",
      title: "Real Git commit execution not covered",
      widgetId: "agent-queue",
    }),
  ];
}

function widgetExecutionUnavailablePlanCases(): HobitAgentSmokeCase[] {
  return [
    smokeCase({
      caseId: "widget-contract:skill-library:adapter",
      componentId: "widget-adapter-execution",
      componentTitle: "Widget adapter execution",
      expectedResultDescription:
        "Knowledge / Skills adapter execution is not implemented and must not be simulated as success.",
      kind: "widget-contract",
      plannedStatus: "skipped",
      productFacingReason: HOBIT_AGENT_SMOKE_PRODUCT_LABELS.adapterNotImplemented,
      required: false,
      safeMode: "metadata-only",
      source: "Widget Agent Contract registry",
      title: "Knowledge / Skills adapter execution",
      widgetId: "skill-library",
    }),
    smokeCase({
      caseId: "widget-contract:notes:adapter",
      componentId: "widget-adapter-execution",
      componentTitle: "Widget adapter execution",
      expectedResultDescription:
        "Notes adapter execution is not implemented and must not be simulated as success.",
      kind: "widget-contract",
      plannedStatus: "skipped",
      productFacingReason: HOBIT_AGENT_SMOKE_PRODUCT_LABELS.adapterNotImplemented,
      required: false,
      safeMode: "metadata-only",
      source: "Widget Agent Contract registry",
      title: "Notes adapter execution",
      widgetId: "notes",
    }),
    smokeCase({
      caseId: "widget-contract:terminal:adapter",
      componentId: "widget-adapter-execution",
      componentTitle: "Widget adapter execution",
      expectedResultDescription:
        "Terminal adapter/runtime execution is restricted and not implemented for agent smoke.",
      kind: "widget-contract",
      plannedStatus: "blocked",
      productFacingReason: HOBIT_AGENT_SMOKE_PRODUCT_LABELS.restrictedCapability,
      required: false,
      safeMode: "restricted",
      source: "Widget Agent Contract registry",
      title: "Terminal adapter execution",
      widgetId: "terminal",
    }),
  ];
}

function finderExcludedPlanCase(): HobitAgentSmokeCase {
  return smokeCase({
    caseId: "widget-contract:finder-active-scope",
    componentId: "finder-excluded",
    componentTitle: "Finder",
    expectedResultDescription:
      "Finder is explicitly excluded from this active agent-executed smoke scope.",
    kind: "excluded-scope",
    plannedStatus: "skipped",
    productFacingReason: HOBIT_AGENT_SMOKE_PRODUCT_LABELS.finderExcluded,
    required: false,
    safeMode: "excluded",
    source: "Widget Agent Contract registry",
    title: "Finder excluded",
    widgetId: "finder",
  });
}

function restrictedCapabilityPlanCases(): HobitAgentSmokeCase[] {
  return [
    smokeCase({
      capabilityId: "codex.runTask",
      caseId: "capability:codex-restricted",
      componentId: "restricted-capabilities",
      componentTitle: "Restricted capabilities",
      expectedResultDescription:
        "Codex run is a restricted explicit execution capability, not a default smoke path.",
      kind: "restricted-capability",
      required: true,
      safeMode: "restricted",
      source: "Capability policy",
      title: "Codex capability restricted",
    }),
    smokeCase({
      capabilityId: "workspace.shell.runCommand",
      caseId: "capability:shell-restricted",
      componentId: "restricted-capabilities",
      componentTitle: "Restricted capabilities",
      expectedResultDescription:
        "Shell command execution is restricted and unavailable for agent-executed smoke.",
      kind: "restricted-capability",
      required: true,
      safeMode: "restricted",
      source: "Capability Registry",
      title: "Shell capability restricted",
    }),
  ];
}

function hiddenSideEffectPlanCase(): HobitAgentSmokeCase {
  return smokeCase({
    caseId: "hidden-side-effects:no-hidden-side-effects",
    componentId: "hidden-side-effect-assertions",
    componentTitle: "Hidden side-effect assertions",
    expectedResultDescription:
      "Smoke asserts no Codex run, shell command, Queue mutation, worker start, Queue view creation, Terminal launch, Git mutation, or rollback execution.",
    kind: "hidden-side-effect",
    required: true,
    safeMode: "read",
    source: "Self-Test Runner",
    title: "Hidden side-effect assertions",
  });
}

function widgetContractTitle(contract: HobitWidgetAgentContract): string {
  if (contract.widgetId === "agent-queue") {
    return "Agent Queue / QueueV2 widget contract";
  }

  if (contract.widgetId === "interactive-agent") {
    return "Workspace Agent widget contract";
  }

  if (contract.widgetId === "skill-library") {
    return "Knowledge / Skills widget contract";
  }

  if (contract.widgetId === "notes") {
    return "Notes widget contract";
  }

  if (contract.widgetId === "terminal") {
    return "Terminal widget contract";
  }

  return `${contract.title} widget contract`;
}

function componentIdsForCases(
  cases: readonly Pick<HobitAgentSmokeCase, "componentId">[],
): string[] {
  return [...new Set(cases.map((item) => item.componentId))].sort((left, right) =>
    left.localeCompare(right),
  );
}

function smokeCase(input: HobitAgentSmokeCase): HobitAgentSmokeCase {
  return input;
}
