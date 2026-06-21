import runtimeSource from "./brokerContinuationRuntime.ts?raw";

import { describe, expect, it } from "vitest";

import {
  createActionRequest,
  createActionResult,
  type HobitAgentActionRequest,
  type HobitAgentActionResult,
  type HobitAgentBrokerResult,
} from "../agents/broker";
import {
  createHobitAgentCapabilityRegistry,
  findCapability,
} from "../agents/capabilities";
import { QUEUE_START_RUN_CONFIRMATION_TOKEN } from "../agents/capabilities/queueCapabilityContracts";
import {
  createWorkspaceAgentBrokerContinuationState,
  evaluateWorkspaceAgentBrokerContinuationAttempt,
  prepareWorkspaceAgentBrokerContinuationStateForResult,
  readWorkspaceAgentQueueAutonomyGrantFromText,
  recordWorkspaceAgentBrokerContinuationAttempt,
  type WorkspaceAgentBrokerContinuationState,
} from "../workspaceAgentBrokerContinuation";
import { classifyAgentProtocolRuntimeOutput } from "./agentProtocolRuntime";
import {
  runBrokerContinuationRuntime,
  type BrokerContinuationRuntimeEffect,
} from "./brokerContinuationRuntime";

describe("BrokerContinuationRuntime", () => {
  it("continues valid typed nextAction under explicit Queue policy approval", () => {
    const request = requestFor("queue.items.list", { limit: 10 });
    const state = recordAttempt(
      createWorkspaceAgentBrokerContinuationState({
        chainId: "chain-continue",
        queueAutonomyGrant: queueAutonomyGrant("queue_acceptance_smoke"),
      }),
      request,
    );
    const result = resultFor("queue.items.list", {
      nextAction: plainNextAction("queue.item.updateRunSettings", {
        codexExecutable: "codex.cmd",
        taskId: "task-1",
      }),
      nextSuggestedCapability: "queue.item.updateRunSettings",
    });

    const runtime = brokerRuntime({
      actionIndex: 1,
      brokerResult: brokerResult(request, result),
      continuationThreadId: "thread-1",
      message: "Queue items listed.",
      request,
      state,
    });

    const recordEffect = effectOf(
      runtime.effects,
      "record_broker_action_result",
    );
    const continuationEffect = effectOf(
      runtime.effects,
      "request_continuation_turn",
    );
    expect(recordEffect.stopReason).toBeUndefined();
    expect(recordEffect.policyDiagnostics).toMatchObject({
      capabilityId: "queue.item.updateRunSettings",
      grantActive: true,
      grantMode: "queue_acceptance_smoke",
      nextActionPayloadValidated: true,
      reasonCode: "continuation_allowed",
      riskClass: "setup",
    });
    expect(continuationEffect.intent).toMatchObject({
      chainId: "chain-continue",
      resumeThreadId: "thread-1",
      turnKind: "continuation",
    });
    expect(continuationEffect.intent.prompt).toContain(
      '"type":"hobit.action.result"',
    );
    expect(continuationEffect.state.pendingNextAction).toMatchObject({
      capabilityId: "queue.item.updateRunSettings",
      input: { taskId: "task-1" },
    });
  });

  it("stops invalid typed nextAction payloads", () => {
    const request = requestFor("queue.items.list", { limit: 10 });
    const state = recordAttempt(
      createWorkspaceAgentBrokerContinuationState({ chainId: "chain-invalid" }),
      request,
    );
    const result = resultFor("queue.items.list", {
      nextAction: {
        autoContinuationSafe: true,
        capabilityId: "queue.item.updateRunSettings",
        input: { approval_policy: "never", taskId: "task-1" },
        moduleId: "queue",
        requiresConfirmation: false,
      },
      nextSuggestedCapability: "queue.item.updateRunSettings",
    });

    const runtime = brokerRuntime({
      brokerResult: brokerResult(request, result),
      request,
      state,
    });
    const recordEffect = effectOf(
      runtime.effects,
      "record_broker_action_result",
    );

    expect(recordEffect.stopReason).toBe("invalid_input");
    expect(recordEffect.policyDiagnostics).toMatchObject({
      nextActionPayloadValidated: false,
      reasonCode: "next_action_payload_invalid",
    });
    expect(runtime.effects).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ type: "invoke_next_action" })]),
    );
  });

  it("stops suggested-only next capability without executing it", () => {
    const request = requestFor("queue.items.list", { limit: 10 });
    const state = recordAttempt(
      createWorkspaceAgentBrokerContinuationState({ chainId: "chain-suggested" }),
      request,
    );
    const result = resultFor("queue.items.list", {
      nextSuggestedCapability: "queue.item.updateRunSettings",
      taskId: "task-1",
    });

    const runtime = brokerRuntime({
      brokerResult: brokerResult(request, result),
      request,
      state,
    });
    const recordEffect = effectOf(
      runtime.effects,
      "record_broker_action_result",
    );

    expect(recordEffect.stopReason).toBe("not_allowed_for_auto_continuation");
    expect(recordEffect.policyDiagnostics).toMatchObject({
      capabilityId: "queue.item.updateRunSettings",
      nextActionPresent: false,
      reasonCode: "no_next_action",
    });
  });

  it("stops nextActionUnavailable diagnostics", () => {
    const request = requestFor("queue.lifecycle.get", { taskId: "task-1" });
    const state = recordAttempt(
      createWorkspaceAgentBrokerContinuationState({ chainId: "chain-unavailable" }),
      request,
    );
    const result = resultFor("queue.lifecycle.get", {
      nextActionUnavailable: {
        missingRequiredInputs: ["messageId"],
        reasonCode: "missing_required_input",
        reasonMessage: "messageId is required before ACK.",
      },
      nextSuggestedCapability: "queue.review.ack",
      taskId: "task-1",
    });

    const runtime = brokerRuntime({
      brokerResult: brokerResult(request, result),
      request,
      state,
    });
    const recordEffect = effectOf(
      runtime.effects,
      "record_broker_action_result",
    );

    expect(recordEffect.stopReason).toBe("not_allowed_for_auto_continuation");
    expect(recordEffect.policyDiagnostics).toMatchObject({
      capabilityId: "queue.review.ack",
      reasonCode: "no_next_action",
      reasonMessage: "messageId is required before ACK.",
    });
  });

  it("stops ambiguous next actions instead of inferring a task id", () => {
    const request = requestFor("queue.items.list", { limit: 10 });
    const state = recordAttempt(
      createWorkspaceAgentBrokerContinuationState({ chainId: "chain-ambiguous" }),
      request,
    );
    const result = resultFor("queue.items.list", {
      items: [{ taskId: "task-a" }, { taskId: "task-b" }],
      nextSuggestedCapability: "queue.item.updateRunSettings",
    });

    const runtime = brokerRuntime({
      brokerResult: brokerResult(request, result),
      request,
      state,
    });
    const recordEffect = effectOf(
      runtime.effects,
      "record_broker_action_result",
    );

    expect(recordEffect.stopReason).toBe("ambiguous_next_action");
    expect(recordEffect.policyDiagnostics).toMatchObject({
      candidateTaskIds: ["task-a", "task-b"],
      reasonCode: "ambiguous_next_action",
    });
  });

  it("stops dependency_waiting without starting downstream work", () => {
    const request = requestFor("queue.lifecycle.get", { taskId: "task-b" });
    const state = recordAttempt(
      createWorkspaceAgentBrokerContinuationState({
        chainId: "chain-dependency-waiting",
        queueAutonomyGrant: queueAutonomyGrant("queue_acceptance_smoke", {
          confirmationToken: QUEUE_START_RUN_CONFIRMATION_TOKEN,
        }),
      }),
      request,
    );
    const result = resultFor("queue.lifecycle.get", {
      dependencyState: "waiting",
      nextAction: confirmedNextAction("queue.item.startRun", {
        executorWidgetId: "executor-1",
        taskId: "task-b",
      }),
      nextSuggestedCapability: "queue.item.startRun",
    });

    const runtime = brokerRuntime({
      brokerResult: brokerResult(request, result),
      request,
      state,
    });
    const recordEffect = effectOf(
      runtime.effects,
      "record_broker_action_result",
    );

    expect(recordEffect.stopReason).toBe("policy_blocked");
    expect(recordEffect.policyDiagnostics).toMatchObject({
      capabilityId: "queue.item.startRun",
      reasonCode: "dependency_waiting",
    });
    expect(runtime.effects).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ type: "invoke_next_action" })]),
    );
  });

  it("stops when the action budget is exceeded", () => {
    const firstRequest = requestFor("queue.items.list", { limit: 10 });
    const state = recordAttempt(
      createWorkspaceAgentBrokerContinuationState({
        chainId: "chain-budget",
        maxActions: 1,
      }),
      firstRequest,
    );
    const outcome = actionProtocolOutcome({
      capabilityId: "queue.lifecycle.get",
      input: { taskId: "task-1" },
      requestId: "request-lifecycle",
    });

    const runtime = runBrokerContinuationRuntime({
      agentId: "workspace-agent:test",
      continuationThreadId: "thread-1",
      createdAt: "2026-06-17T00:00:00.000Z",
      derivedChainId: "chain-budget",
      kind: "provider_protocol_result",
      protocolOutcome: outcome,
      state,
    });
    const stopEffect = effectOf(runtime.effects, "stop");

    expect(stopEffect.stopReason).toBe("max_action_count_reached");
    expect(stopEffect.capabilityId).toBe("queue.lifecycle.get");
    expect(runtime.nextState).toBeNull();
  });

  it("emits a repair turn intent for one protocol stall", () => {
    const state = createWorkspaceAgentBrokerContinuationState({
      chainId: "chain-repair",
    });
    const outcome = classifyAgentProtocolRuntimeOutput({
      mode: "typed_capability_action",
      text: "Awaiting queue.items.list result.",
    });
    if (outcome.kind !== "protocol_stall") {
      throw new Error("Expected protocol stall.");
    }

    const runtime = runBrokerContinuationRuntime({
      agentId: "workspace-agent:test",
      continuationThreadId: "thread-repair",
      createdAt: "2026-06-17T00:00:00.000Z",
      derivedChainId: "chain-repair",
      kind: "provider_protocol_result",
      protocolOutcome: outcome,
      state,
    });
    const repairEffect = effectOf(runtime.effects, "request_repair_turn");

    expect(repairEffect.intent).toMatchObject({
      chainId: "chain-repair",
      resumeThreadId: "thread-repair",
      turnKind: "protocol_repair",
    });
    expect(repairEffect.intent.prompt).toContain(
      "[Hobit action protocol repair]",
    );
    expect(repairEffect.state.protocolRepairAttempted).toBe(true);
  });

  it("injects only exact structured Queue confirmation from a valid grant", () => {
    const pendingResult = resultFor("queue.lifecycle.get", {
      nextAction: confirmedNextAction("queue.item.markDone", {
        taskId: "task-1",
      }),
      nextSuggestedCapability: "queue.item.markDone",
    });
    const state = prepareWorkspaceAgentBrokerContinuationStateForResult({
      result: pendingResult,
      state: createWorkspaceAgentBrokerContinuationState({
        chainId: "chain-confirmation",
        queueAutonomyGrant: queueAutonomyGrant("queue_acceptance_smoke", {
          confirmationToken: QUEUE_START_RUN_CONFIRMATION_TOKEN,
        }),
      }),
    });
    const outcome = actionProtocolOutcome({
      capabilityId: "queue.item.markDone",
      input: { taskId: "task-1" },
      requestId: "request-mark-done",
    });

    const runtime = runBrokerContinuationRuntime({
      agentId: "workspace-agent:test",
      continuationThreadId: "thread-confirmation",
      createdAt: "2026-06-17T00:00:00.000Z",
      derivedChainId: "chain-confirmation",
      kind: "provider_protocol_result",
      protocolOutcome: outcome,
      state,
    });
    const invokeEffect = effectOf(runtime.effects, "invoke_next_action");

    expect(effectOf(runtime.effects, "queue_structured_confirmation_injected"))
      .toMatchObject({ type: "queue_structured_confirmation_injected" });
    expect(invokeEffect.intent).toMatchObject({
      confirmationInjected: true,
      request: {
        capabilityId: "queue.item.markDone",
        confirmationToken: QUEUE_START_RUN_CONFIRMATION_TOKEN,
      },
    });
  });

  it("rejects prose grants and does not treat prose confirmation as permission", () => {
    const grantRead = readWorkspaceAgentQueueAutonomyGrantFromText(
      "I confirm. Please go.",
    );
    const request = requestFor("queue.lifecycle.get", { taskId: "task-1" });
    const state = recordAttempt(
      createWorkspaceAgentBrokerContinuationState({
        autonomyGrantRejectionReasons: grantRead.reasons,
        chainId: "chain-prose-grant",
        queueAutonomyGrant: grantRead.grant,
      }),
      request,
    );
    const result = resultFor("queue.lifecycle.get", {
      nextAction: confirmedNextAction("queue.item.startRun", {
        executorWidgetId: "executor-1",
        taskId: "task-1",
      }),
      nextSuggestedCapability: "queue.item.startRun",
    });

    const runtime = brokerRuntime({
      brokerResult: brokerResult(request, result),
      request,
      state,
    });
    const recordEffect = effectOf(
      runtime.effects,
      "record_broker_action_result",
    );

    expect(grantRead.status).toBe("none");
    expect(recordEffect.stopReason).toBe("not_allowed_for_auto_continuation");
    expect(recordEffect.policyDiagnostics).toMatchObject({
      grantActive: false,
      reasonCode: "no_grant_for_risk_class",
    });
  });

  it("stays independent from React, Queue UI, visual shell, providers, broker execution, and backend calls", () => {
    expect(runtimeSource).not.toContain("react");
    expect(runtimeSource).not.toContain("AgentQueueV2Board");
    expect(runtimeSource).not.toContain("AgentQueuePlaceholderWidget");
    expect(runtimeSource).not.toContain("widgetV2/queueV2");
    expect(runtimeSource).not.toContain("queue/details");
    expect(runtimeSource).not.toContain("ModuleShell");
    expect(runtimeSource).not.toContain("tokens.css");
    expect(runtimeSource).not.toContain("widget.css");
    expect(runtimeSource).not.toContain("createCodexAgentProvider");
    expect(runtimeSource).not.toContain("createFakeAgentProvider");
    expect(runtimeSource).not.toContain("startTurn");
    expect(runtimeSource).not.toContain("createHobitAgentActionBroker");
    expect(runtimeSource).not.toContain("invokeAsync");
    expect(runtimeSource).not.toContain("WorkspaceAgentQueueBridge");
  });
});

function brokerRuntime({
  actionIndex = 1,
  brokerResult,
  confirmationInjected = false,
  continuationThreadId = "thread-1",
  message = "Action completed.",
  request,
  state,
}: {
  actionIndex?: number;
  brokerResult: HobitAgentBrokerResult;
  confirmationInjected?: boolean;
  continuationThreadId?: string | null;
  message?: string;
  request: HobitAgentActionRequest;
  state: WorkspaceAgentBrokerContinuationState;
}) {
  return runBrokerContinuationRuntime({
    actionIndex,
    brokerResult,
    confirmationInjected,
    continuationThreadId,
    kind: "broker_action_result",
    message,
    request,
    state,
  });
}

function effectOf<
  TType extends BrokerContinuationRuntimeEffect["type"],
>(
  effects: readonly BrokerContinuationRuntimeEffect[],
  type: TType,
): Extract<BrokerContinuationRuntimeEffect, { type: TType }> {
  const effect = effects.find((item) => item.type === type);
  if (!effect) {
    throw new Error(`Missing runtime effect ${type}.`);
  }
  return effect as Extract<BrokerContinuationRuntimeEffect, { type: TType }>;
}

function actionProtocolOutcome({
  capabilityId,
  input,
  requestId,
}: {
  capabilityId: string;
  input: unknown;
  requestId: string;
}) {
  const outcome = classifyAgentProtocolRuntimeOutput({
    mode: "typed_capability_action",
    text: JSON.stringify({
      capabilityId,
      dryRun: false,
      input,
      requestId,
      type: "hobit.action.request",
    }),
  });
  if (outcome.kind !== "action_request") {
    throw new Error("Expected action request protocol outcome.");
  }
  return outcome;
}

function requestFor(
  capabilityId: string,
  input: unknown,
  requestId = `${capabilityId}:request`,
  confirmationToken: string | null = null,
) {
  return createActionRequest({
    agentId: "workspace-agent:test",
    agentRoleId: "workspace_agent",
    capabilityId,
    confirmationToken,
    createdAt: "2026-06-17T00:00:00.000Z",
    dryRun: false,
    input,
    requestId,
  });
}

function resultFor(
  capabilityId: string,
  output: unknown,
): HobitAgentActionResult {
  return createActionResult({
    capabilityId,
    message: `${capabilityId} completed.`,
    output,
    requestId: `${capabilityId}:request`,
    status: "succeeded",
  });
}

function brokerResult(
  request: HobitAgentActionRequest,
  result: HobitAgentActionResult,
): HobitAgentBrokerResult {
  const registry = createHobitAgentCapabilityRegistry();
  const capability = findCapability(registry, request.capabilityId);
  return {
    policyDecision: {
      allowed: true,
      ...(capability ? { capability } : {}),
      reasons: [],
      requiresConfirmation: false,
      requiresDryRun: false,
      status: "allowed",
    },
    request,
    result,
    status: result.status,
  };
}

function recordAttempt(
  state: WorkspaceAgentBrokerContinuationState,
  request: HobitAgentActionRequest,
) {
  const attempt = evaluateWorkspaceAgentBrokerContinuationAttempt(
    state,
    request,
  );
  if (!attempt.ok) {
    throw new Error("Expected continuation attempt to be accepted.");
  }

  return recordWorkspaceAgentBrokerContinuationAttempt(
    state,
    request,
    attempt.fingerprint,
  );
}

function queueAutonomyGrant(
  mode:
    | "queue_acceptance_smoke"
    | "queue_failure_smoke"
    | "queue_operator_flow"
    | "queue_smoke"
    | "read_only",
  overrides: Record<string, unknown> = {},
) {
  return {
    constraints: {
      noDelete: true,
      noDownstreamAutoStart: true,
      noGit: true,
      noRollback: true,
      noTerminal: true,
      noValidationExecution: true,
    },
    mode,
    type: "hobit.queue.autonomyGrant",
    ...overrides,
  };
}

function plainNextAction(
  capabilityId: string,
  input: Record<string, unknown>,
) {
  return {
    autoContinuationSafe: true,
    capabilityId,
    input,
    moduleId: "queue",
    requiresConfirmation: false,
  };
}

function confirmedNextAction(
  capabilityId: string,
  input: Record<string, unknown>,
) {
  return {
    autoContinuationSafe: false,
    capabilityId,
    confirmationRequired: {
      field: "confirmationToken",
      value: QUEUE_START_RUN_CONFIRMATION_TOKEN,
    },
    input,
    moduleId: "queue",
    requiresConfirmation: true,
  };
}
