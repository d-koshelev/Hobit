import { describe, expect, it } from "vitest";

import {
  createActionRequest,
  createActionResult,
  HOBIT_AGENT_ACTION_STATUS_TAXONOMY,
  type HobitAgentActionStatus,
} from "./agents/broker";
import {
  createHobitAgentCapabilityRegistry,
  findCapability,
} from "./agents/capabilities";
import {
  QUEUE_CAPABILITY_CONTRACT_BY_ID,
  QUEUE_START_RUN_CONFIRMATION_TOKEN,
} from "./agents/capabilities/queueCapabilityContracts";
import continuationSource from "./workspaceAgentBrokerContinuation.ts?raw";
import {
  applyWorkspaceAgentQueueAutonomyGrantToActionRequest,
  classifyWorkspaceAgentBrokerContinuationCapability,
  createWorkspaceAgentBrokerActionResultContext,
  createWorkspaceAgentBrokerContinuationState,
  decideWorkspaceAgentBrokerActionContinuation,
  deriveWorkspaceAgentBrokerContinuationRequestId,
  evaluateWorkspaceAgentBrokerContinuationAttempt,
  formatWorkspaceAgentBrokerContinuationPrompt,
  normalizeWorkspaceAgentQueueAutonomyGrant,
  prepareWorkspaceAgentBrokerContinuationStateForResult,
  readWorkspaceAgentQueueAutonomyGrantFromText,
  recordWorkspaceAgentBrokerContinuationProtocolRepair,
  recordWorkspaceAgentBrokerContinuationAttempt,
  shouldContinueWorkspaceAgentBrokerAction,
  WORKSPACE_AGENT_BROKER_CONTINUATION_MAX_ACTIONS,
} from "./workspaceAgentBrokerContinuation";

describe("workspaceAgentBrokerContinuation", () => {
  it("exposes the compact broker action status taxonomy", () => {
    expect(HOBIT_AGENT_ACTION_STATUS_TAXONOMY).toEqual([
      "succeeded",
      "blocked",
      "blocked_actionable",
      "invalid_input",
      "needs_confirmation",
      "already_exists",
      "already_done",
      "already_failed",
      "precondition_failed",
      "policy_blocked",
      "unavailable",
      "paused",
      "failed_unexpected",
    ]);
  });

  it("defaults the broker continuation budget to 16 actions", () => {
    const state = createWorkspaceAgentBrokerContinuationState({
      chainId: "chain-default-budget",
    });

    expect(WORKSPACE_AGENT_BROKER_CONTINUATION_MAX_ACTIONS).toBe(16);
    expect(state.maxActions).toBe(16);
    expect(state.protocolRepairAttempted).toBe(false);
  });

  it("records a single protocol repair attempt without counting it as a broker action", () => {
    const state = createWorkspaceAgentBrokerContinuationState({
      chainId: "chain-protocol-repair",
    });
    const repaired = recordWorkspaceAgentBrokerContinuationProtocolRepair(state);

    expect(repaired).toMatchObject({
      actionCount: 0,
      chainId: "chain-protocol-repair",
      protocolRepairAttempted: true,
    });
    expect(state.protocolRepairAttempted).toBe(false);
  });

  it("derives Queue auto-continuation from capability risk metadata", () => {
    expect(continuationSource).not.toContain(
      "AUTO_CONTINUATION_ALLOWED_CAPABILITIES",
    );

    expect(
      classifyWorkspaceAgentBrokerContinuationCapability("queue.lifecycle.get"),
    ).toMatchObject({ kind: "allowed" });
    expect(
      classifyWorkspaceAgentBrokerContinuationCapability(
        "queue.review.createMessage",
      ),
    ).toMatchObject({ kind: "not_allowed" });
    expect(
      classifyWorkspaceAgentBrokerContinuationCapability("queue.item.markDone"),
    ).toMatchObject({ kind: "not_allowed" });
    expect(
      classifyWorkspaceAgentBrokerContinuationCapability("queue.item.fail"),
    ).toMatchObject({ kind: "not_allowed" });
  });

  it("parses only structured Queue autonomy grants", () => {
    expect(readWorkspaceAgentQueueAutonomyGrantFromText("go")).toMatchObject({
      grant: null,
      status: "none",
    });
    expect(
      readWorkspaceAgentQueueAutonomyGrantFromText("I confirm"),
    ).toMatchObject({
      grant: null,
      status: "none",
    });

    const grantRead = readWorkspaceAgentQueueAutonomyGrantFromText(
      JSON.stringify({
        confirmationToken: QUEUE_START_RUN_CONFIRMATION_TOKEN,
        constraints: queueAutonomyConstraints(),
        maxActions: 99,
        mode: "queue_acceptance_smoke",
        type: "hobit.queue.autonomyGrant",
      }),
    );

    expect(grantRead).toMatchObject({
      grant: {
        confirmationToken: QUEUE_START_RUN_CONFIRMATION_TOKEN,
        maxActions: 99,
        mode: "queue_acceptance_smoke",
        type: "hobit.queue.autonomyGrant",
      },
      policy: {
        active: true,
        maxActions: WORKSPACE_AGENT_BROKER_CONTINUATION_MAX_ACTIONS,
      },
      status: "valid",
    });
    expect(
      createWorkspaceAgentBrokerContinuationState({
        chainId: "chain-capped-grant",
        queueAutonomyGrant: grantRead.grant,
      }).maxActions,
    ).toBe(WORKSPACE_AGENT_BROKER_CONTINUATION_MAX_ACTIONS);
    expect(
      normalizeWorkspaceAgentQueueAutonomyGrant({
        constraints: queueAutonomyConstraints(),
        mode: "queue_failure_smoke",
        type: "hobit.queue.autonomyGrant",
      }),
    ).toMatchObject({
      mode: "queue_failure_smoke",
      type: "hobit.queue.autonomyGrant",
    });
  });

  it("parses a structured Queue autonomy grant embedded in the manual smoke prompt prose", () => {
    const grant = {
      confirmationToken: QUEUE_START_RUN_CONFIRMATION_TOKEN,
      constraints: queueAutonomyConstraints(),
      maxActions: 16,
      mode: "queue_acceptance_smoke",
      scope: { taskIds: ["task-a"] },
      type: "hobit.queue.autonomyGrant",
    };
    const grantRead = readWorkspaceAgentQueueAutonomyGrantFromText(
      `Run the queue_acceptance_smoke workflow. The following JSON object is the only autonomy grant for this run: ${JSON.stringify(
        grant,
      )} Do not infer anything from this prose.`,
    );

    expect(grantRead).toMatchObject({
      grant: {
        confirmationToken: QUEUE_START_RUN_CONFIRMATION_TOKEN,
        mode: "queue_acceptance_smoke",
        scope: { taskIds: ["task-a"] },
      },
      policy: {
        active: true,
        allowedRiskClasses: expect.arrayContaining(["setup", "final_accept"]),
        mode: "queue_acceptance_smoke",
      },
      status: "valid",
    });
  });

  it("parses a structured Queue autonomy grant inside a fenced JSON block", () => {
    const grantRead = readWorkspaceAgentQueueAutonomyGrantFromText(`
Use typed Queue capabilities only.

\`\`\`json
${JSON.stringify({
  confirmationToken: QUEUE_START_RUN_CONFIRMATION_TOKEN,
  constraints: queueAutonomyConstraints(),
  mode: "queue_failure_smoke",
  type: "hobit.queue.autonomyGrant",
})}
\`\`\`
`);

    expect(grantRead).toMatchObject({
      grant: {
        confirmationToken: QUEUE_START_RUN_CONFIRMATION_TOKEN,
        mode: "queue_failure_smoke",
      },
      status: "valid",
    });
  });

  it("rejects malformed Queue autonomy grants without inferring permission from prose", () => {
    expect(
      readWorkspaceAgentQueueAutonomyGrantFromText(
        '{"type":"hobit.queue.autonomyGrant","mode":"queue_acceptance_smoke"',
      ),
    ).toMatchObject({
      grant: null,
      status: "invalid",
    });
    expect(
      readWorkspaceAgentQueueAutonomyGrantFromText(
        JSON.stringify({
          confirmationToken: "confirmed",
          constraints: queueAutonomyConstraints(),
          mode: "queue_acceptance_smoke",
          type: "hobit.queue.autonomyGrant",
        }),
      ),
    ).toMatchObject({
      grant: null,
      status: "invalid",
    });
    expect(
      readWorkspaceAgentQueueAutonomyGrantFromText(
        JSON.stringify({
          constraints: queueAutonomyConstraints(),
          mode: "approve_everything",
          type: "hobit.queue.autonomyGrant",
        }),
      ),
    ).toMatchObject({
      grant: null,
      status: "invalid",
    });
    expect(
      readWorkspaceAgentQueueAutonomyGrantFromText(
        JSON.stringify({
          allowedCapabilities: ["queue.item.delete"],
          constraints: queueAutonomyConstraints(),
          mode: "queue_operator_flow",
          type: "hobit.queue.autonomyGrant",
        }),
      ),
    ).toMatchObject({
      grant: null,
      status: "invalid",
    });
  });

  it("allows safe Queue control-plane success results to continue", () => {
    const request = requestFor("queue.items.list", { limit: 10 });
    const state = recordAttempt(
      createWorkspaceAgentBrokerContinuationState({ chainId: "chain-1" }),
      request,
    );
    const decision = shouldContinueWorkspaceAgentBrokerAction({
      request,
      result: resultFor("queue.items.list", {
        items: [{ taskId: "task-1" }],
        nextAction: {
          autoContinuationSafe: true,
          capabilityId: "queue.lifecycle.get",
          input: { taskId: "task-1" },
          requiresConfirmation: false,
        },
        nextSuggestedCapability: "queue.lifecycle.get",
      }),
      state,
    });

    expect(decision).toEqual({ shouldContinue: true });
  });

  it("keeps run-start and finalizer nextActions blocked without a Queue autonomy grant", () => {
    const cases = [
      [
        "queue.enable",
        confirmedNextAction("queue.item.startRun", {
          executorWidgetId: "executor-1",
          taskId: "task-1",
        }),
        "queue.item.startRun",
      ],
      [
        "queue.lifecycle.get",
        confirmedNextAction("queue.item.markDone", { taskId: "task-1" }),
        "queue.item.markDone",
      ],
      [
        "queue.lifecycle.get",
        confirmedNextAction("queue.item.fail", {
          reason: "Worker failed.",
          taskId: "task-1",
        }),
        "queue.item.fail",
      ],
    ] as const;

    for (const [capabilityId, nextAction, nextSuggestedCapability] of cases) {
      const request = requestFor(capabilityId, { taskId: "task-1" });
      const state = recordAttempt(
        createWorkspaceAgentBrokerContinuationState({
          chainId: `chain-no-grant-${nextSuggestedCapability}`,
        }),
        request,
      );

      expect(
        shouldContinueWorkspaceAgentBrokerAction({
          request,
          result: resultFor(capabilityId, {
            nextAction,
            nextSuggestedCapability,
            taskId: "task-1",
          }),
          state,
        }),
      ).toEqual({
        shouldContinue: false,
        stopReason: "not_allowed_for_auto_continuation",
      });
    }
  });

  it("applies Queue autonomy modes by risk class and denied capability intersection", () => {
    const noGrantState = createWorkspaceAgentBrokerContinuationState({
      chainId: "chain-no-grant-setup",
    });
    const readOnlyState = createWorkspaceAgentBrokerContinuationState({
      chainId: "chain-read-only",
      queueAutonomyGrant: queueAutonomyGrant("read_only"),
    });
    const queueSmokeState = createWorkspaceAgentBrokerContinuationState({
      chainId: "chain-queue-smoke",
      queueAutonomyGrant: queueAutonomyGrant("queue_smoke", {
        confirmationToken: QUEUE_START_RUN_CONFIRMATION_TOKEN,
      }),
    });
    const deniedAckState = createWorkspaceAgentBrokerContinuationState({
      chainId: "chain-denied-ack",
      queueAutonomyGrant: queueAutonomyGrant("queue_smoke", {
        deniedCapabilities: ["queue.review.ack"],
      }),
    });
    const acceptanceState = createWorkspaceAgentBrokerContinuationState({
      chainId: "chain-acceptance-setup",
      queueAutonomyGrant: queueAutonomyGrant("queue_acceptance_smoke"),
    });
    const failureState = createWorkspaceAgentBrokerContinuationState({
      chainId: "chain-failure-setup",
      queueAutonomyGrant: queueAutonomyGrant("queue_failure_smoke"),
    });

    expect(
      classifyWorkspaceAgentBrokerContinuationCapability(
        "queue.lifecycle.get",
        readOnlyState.queueAutonomyPolicy,
      ).kind,
    ).toBe("allowed");
    expect(
      classifyWorkspaceAgentBrokerContinuationCapability(
        "queue.enable",
        readOnlyState.queueAutonomyPolicy,
      ).kind,
    ).toBe("not_allowed");
    expect(
      classifyWorkspaceAgentBrokerContinuationCapability(
        "queue.item.updateRunSettings",
        noGrantState.queueAutonomyPolicy,
      ).kind,
    ).toBe("not_allowed");
    expect(
      classifyWorkspaceAgentBrokerContinuationCapability(
        "queue.item.updateRunSettings",
        readOnlyState.queueAutonomyPolicy,
      ).kind,
    ).toBe("not_allowed");
    expect(
      classifyWorkspaceAgentBrokerContinuationCapability(
        "queue.item.updateRunSettings",
        queueSmokeState.queueAutonomyPolicy,
      ).kind,
    ).toBe("allowed");
    expect(
      classifyWorkspaceAgentBrokerContinuationCapability(
        "queue.item.updateRunSettings",
        acceptanceState.queueAutonomyPolicy,
      ).kind,
    ).toBe("allowed");
    expect(
      classifyWorkspaceAgentBrokerContinuationCapability(
        "queue.item.updateRunSettings",
        failureState.queueAutonomyPolicy,
      ).kind,
    ).toBe("allowed");
    expect(
      classifyWorkspaceAgentBrokerContinuationCapability(
        "queue.item.startRun",
        queueSmokeState.queueAutonomyPolicy,
      ).kind,
    ).toBe("allowed");
    expect(
      classifyWorkspaceAgentBrokerContinuationCapability(
        "queue.review.createMessage",
        queueSmokeState.queueAutonomyPolicy,
      ).kind,
    ).toBe("allowed");
    expect(
      classifyWorkspaceAgentBrokerContinuationCapability(
        "queue.item.markDone",
        queueSmokeState.queueAutonomyPolicy,
      ).kind,
    ).toBe("not_allowed");
    expect(
      classifyWorkspaceAgentBrokerContinuationCapability(
        "queue.review.ack",
        deniedAckState.queueAutonomyPolicy,
      ).kind,
    ).toBe("not_allowed");
  });

  it("allows queue.item.updateRunSettings only under setup-capable Queue grants", () => {
    const listRequest = requestFor(
      "queue.items.list",
      { limit: 10 },
      "request-list-settings",
    );
    const listResult = resultFor("queue.items.list", {
      items: [
        {
          nextAction: plainNextAction("queue.item.updateRunSettings", {
            codexExecutable: "codex.cmd",
            taskId: "task-setup",
          }),
          nextSuggestedCapability: "queue.item.updateRunSettings",
          taskId: "task-setup",
        },
      ],
      nextAction: plainNextAction("queue.item.updateRunSettings", {
        codexExecutable: "codex.cmd",
        taskId: "task-setup",
      }),
      nextSuggestedCapability: "queue.item.updateRunSettings",
    });
    const acceptanceState = recordAttempt(
      createWorkspaceAgentBrokerContinuationState({
        chainId: "chain-settings-acceptance",
        queueAutonomyGrant: queueAutonomyGrant("queue_acceptance_smoke"),
      }),
      listRequest,
    );
    const noGrantState = recordAttempt(
      createWorkspaceAgentBrokerContinuationState({
        chainId: "chain-settings-no-grant",
      }),
      listRequest,
    );
    const readOnlyState = recordAttempt(
      createWorkspaceAgentBrokerContinuationState({
        chainId: "chain-settings-read-only",
        queueAutonomyGrant: queueAutonomyGrant("read_only"),
      }),
      listRequest,
    );

    expect(
      shouldContinueWorkspaceAgentBrokerAction({
        request: listRequest,
        result: listResult,
        state: acceptanceState,
      }),
    ).toEqual({ shouldContinue: true });
    expect(
      decideWorkspaceAgentBrokerActionContinuation({
        request: listRequest,
        result: listResult,
        state: noGrantState,
      }),
    ).toMatchObject({
      diagnostics: {
        capabilityId: "queue.item.updateRunSettings",
        grantActive: false,
        nextActionPayloadValidated: true,
        reasonCode: "no_grant_for_risk_class",
        riskClass: "setup",
      },
      shouldContinue: false,
      stopReason: "not_allowed_for_auto_continuation",
    });
    expect(
      decideWorkspaceAgentBrokerActionContinuation({
        request: listRequest,
        result: listResult,
        state: readOnlyState,
      }),
    ).toMatchObject({
      diagnostics: {
        capabilityId: "queue.item.updateRunSettings",
        grantActive: true,
        grantMode: "read_only",
        reasonCode: "risk_class_not_allowed",
        riskClass: "setup",
      },
      shouldContinue: false,
      stopReason: "not_allowed_for_auto_continuation",
    });
  });

  it("classifies queue.item.updateRunSettings as setup risk", () => {
    expect(QUEUE_CAPABILITY_CONTRACT_BY_ID.get("queue.item.updateRunSettings"))
      .toMatchObject({
        autoContinuationSafe: true,
        riskClass: "setup",
      });
  });

  it("allows queue.control.setManualEnabled only under setup-capable Queue grants", () => {
    const controlRequest = requestFor(
      "queue.control.get",
      {},
      "request-control-get",
    );
    const controlResult = resultFor("queue.control.get", {
      nextAction: plainNextAction("queue.control.setManualEnabled", {
        expectedVersion: 2,
        reason: "prepare_manual_queue_smoke",
      }),
      nextSuggestedCapability: "queue.control.setManualEnabled",
      queueEnabled: false,
      status: "disabled",
      version: 2,
    });
    const setupGrantState = recordAttempt(
      createWorkspaceAgentBrokerContinuationState({
        chainId: "chain-control-set-setup",
        queueAutonomyGrant: queueAutonomyGrant("queue_acceptance_smoke"),
      }),
      controlRequest,
    );
    const noGrantState = recordAttempt(
      createWorkspaceAgentBrokerContinuationState({
        chainId: "chain-control-set-no-grant",
      }),
      controlRequest,
    );
    const readOnlyState = recordAttempt(
      createWorkspaceAgentBrokerContinuationState({
        chainId: "chain-control-set-read-only",
        queueAutonomyGrant: queueAutonomyGrant("read_only"),
      }),
      controlRequest,
    );

    expect(
      shouldContinueWorkspaceAgentBrokerAction({
        request: controlRequest,
        result: controlResult,
        state: setupGrantState,
      }),
    ).toEqual({ shouldContinue: true });
    expect(
      decideWorkspaceAgentBrokerActionContinuation({
        request: controlRequest,
        result: controlResult,
        state: noGrantState,
      }),
    ).toMatchObject({
      diagnostics: {
        capabilityId: "queue.control.setManualEnabled",
        grantActive: false,
        nextActionPayloadValidated: true,
        reasonCode: "no_grant_for_risk_class",
        riskClass: "setup",
      },
      shouldContinue: false,
      stopReason: "not_allowed_for_auto_continuation",
    });
    expect(
      decideWorkspaceAgentBrokerActionContinuation({
        request: controlRequest,
        result: controlResult,
        state: readOnlyState,
      }),
    ).toMatchObject({
      diagnostics: {
        capabilityId: "queue.control.setManualEnabled",
        grantActive: true,
        grantMode: "read_only",
        reasonCode: "risk_class_not_allowed",
        riskClass: "setup",
      },
      shouldContinue: false,
      stopReason: "not_allowed_for_auto_continuation",
    });
  });

  it("classifies queue.control.setManualEnabled as backend-backed setup risk", () => {
    expect(QUEUE_CAPABILITY_CONTRACT_BY_ID.get("queue.control.setManualEnabled"))
      .toMatchObject({
        autoContinuationSafe: true,
        backing: "backend_backed",
        confirmationRequirement: "recommended",
        riskClass: "setup",
        sideEffectLevel: "write",
      });
  });

  it("propagates Queue autonomy grant state through create-create-list continuation", () => {
    let state = createWorkspaceAgentBrokerContinuationState({
      chainId: "chain-grant-propagation",
      queueAutonomyGrant: queueAutonomyGrant("queue_acceptance_smoke", {
        maxActions: 5,
      }),
    });

    expect(state.queueAutonomyPolicy).toMatchObject({
      active: true,
      mode: "queue_acceptance_smoke",
    });
    expect(state.maxActions).toBe(5);

    const createARequest = requestFor(
      "queue.createItem",
      { prompt: "Create upstream task.", title: "Task A" },
      "request-create-a",
    );
    state = recordAttempt(state, createARequest);
    expect(state.actionCount).toBe(1);
    expect(state.queueAutonomyPolicy.active).toBe(true);

    const createAResult = resultFor("queue.createItem", {
      nextAction: plainNextAction("queue.item.updateRunSettings", {
        codexExecutable: "codex.cmd",
        taskId: "task-a",
      }),
      nextSuggestedCapability: "queue.item.updateRunSettings",
      taskId: "task-a",
    });
    expect(
      shouldContinueWorkspaceAgentBrokerAction({
        request: createARequest,
        result: createAResult,
        state,
      }),
    ).toEqual({ shouldContinue: true });
    state = prepareWorkspaceAgentBrokerContinuationStateForResult({
      result: createAResult,
      state,
    });
    expect(state.pendingNextAction).toMatchObject({
      capabilityId: "queue.item.updateRunSettings",
      input: { taskId: "task-a" },
    });
    expect(state.queueAutonomyPolicy.active).toBe(true);

    const createBRequest = requestFor(
      "queue.createItem",
      {
        dependsOn: ["task-a"],
        prompt: "Create downstream task.",
        title: "Task B",
      },
      "request-create-b",
    );
    state = recordAttempt(state, createBRequest);
    expect(state.actionCount).toBe(2);
    expect(state.pendingNextAction).toBeNull();
    expect(state.queueAutonomyPolicy.active).toBe(true);

    const listRequest = requestFor(
      "queue.items.list",
      { taskId: "task-a" },
      "request-list-task-a",
    );
    state = recordAttempt(state, listRequest);
    expect(state.actionCount).toBe(3);

    const listResult = resultFor("queue.items.list", {
      items: [{ taskId: "task-a" }],
      nextAction: plainNextAction("queue.item.updateRunSettings", {
        codexExecutable: "codex.cmd",
        taskId: "task-a",
      }),
      nextSuggestedCapability: "queue.item.updateRunSettings",
    });
    const decision = decideWorkspaceAgentBrokerActionContinuation({
      request: listRequest,
      result: listResult,
      state,
    });

    expect(decision).toMatchObject({
      diagnostics: {
        allowedRiskClasses: expect.arrayContaining(["setup"]),
        capabilityId: "queue.item.updateRunSettings",
        grantActive: true,
        grantMode: "queue_acceptance_smoke",
        moduleId: "queue",
        nextActionModuleId: "queue",
        nextActionPayloadValidated: true,
        reasonCode: "continuation_allowed",
        riskClass: "setup",
      },
      shouldContinue: true,
    });
    expect(state.maxActions - state.actionCount).toBe(2);
  });

  it("stops on broker statuses that require user or policy intervention", () => {
    const statuses = [
      ["needs_confirmation", "confirmation_required"],
      ["policy_blocked", "policy_blocked"],
      ["unavailable", "unavailable"],
      ["dry_run_required", "dry_run_required"],
      ["blocked", "blocked"],
      ["paused", "paused"],
      ["already_failed", "already_failed"],
      ["failed_unexpected", "failed_unexpected"],
      ["failed", "failed"],
      ["invalid_input", "invalid_input"],
    ] as const;

    for (const [status, stopReason] of statuses) {
      const request = requestFor("queue.items.list", {});
      const state = recordAttempt(
        createWorkspaceAgentBrokerContinuationState({
          chainId: `chain-${status}`,
        }),
        request,
      );

      expect(
        shouldContinueWorkspaceAgentBrokerAction({
          request,
          result: createActionResult({
            capabilityId: request.capabilityId,
            message: status,
            requestId: request.requestId,
            status,
          }),
          state,
        }),
      ).toEqual({
        shouldContinue: false,
        stopReason,
      });
    }
  });

  it("requires a typed nextAction before actionable or idempotent statuses can continue", () => {
    const statuses = [
      ["blocked_actionable", "blocked"],
      ["already_exists", "already_exists"],
      ["already_done", "already_done"],
      ["precondition_failed", "precondition_failed"],
    ] as const;

    for (const [status, stopReason] of statuses) {
      const request = requestFor("queue.lifecycle.get", { taskId: "task-1" });
      const state = recordAttempt(
        createWorkspaceAgentBrokerContinuationState({
          chainId: `chain-no-next-action-${status}`,
          queueAutonomyGrant: queueAutonomyGrant("queue_smoke"),
        }),
        request,
      );

      expect(
        shouldContinueWorkspaceAgentBrokerAction({
          request,
          result: resultFor(
            "queue.lifecycle.get",
            {
              nextSuggestedCapability: "queue.review.ack",
              taskId: "task-1",
            },
            status,
          ),
          state,
        }),
      ).toEqual({
        shouldContinue: false,
        stopReason,
      });
    }
  });

  it("stops before invoking repeated request ids and repeated capability/input fingerprints", () => {
    const state = createWorkspaceAgentBrokerContinuationState({
      chainId: "chain-repeat",
    });
    const first = requestFor("queue.items.list", { limit: 10 }, "request-1");
    const recorded = recordAttempt(state, first);
    const sameId = requestFor("queue.items.list", { limit: 25 }, "request-1");
    const sameFingerprint = requestFor(
      "queue.items.list",
      { limit: 10 },
      "request-2",
    );

    expect(
      evaluateWorkspaceAgentBrokerContinuationAttempt(recorded, sameId),
    ).toMatchObject({
      ok: false,
      stopReason: "repeated_request_id",
    });
    expect(
      evaluateWorkspaceAgentBrokerContinuationAttempt(
        recorded,
        sameFingerprint,
      ),
    ).toMatchObject({
      ok: false,
      stopReason: "repeated_request_fingerprint",
    });
  });

  it("derives unique continuation ids for runtime-generated request ids without weakening fingerprint stops", () => {
    let state = createWorkspaceAgentBrokerContinuationState({
      chainId: "chain-derived",
    });
    const first = requestFor(
      "queue.items.list",
      { limit: 10 },
      deriveWorkspaceAgentBrokerContinuationRequestId({
        actionIndex: 1,
        capabilityId: "queue.items.list",
        chainId: state.chainId,
      }),
      null,
      "derived",
    );
    const firstAttempt = evaluateWorkspaceAgentBrokerContinuationAttempt(
      state,
      first,
    );

    expect(firstAttempt).toMatchObject({
      ok: true,
    });
    if (!firstAttempt.ok) {
      throw new Error("Expected derived first attempt to be accepted.");
    }
    state = recordWorkspaceAgentBrokerContinuationAttempt(
      state,
      first,
      firstAttempt.fingerprint,
    );

    const secondDifferentInput = requestFor(
      "queue.items.list",
      { limit: 25 },
      deriveWorkspaceAgentBrokerContinuationRequestId({
        actionIndex: 2,
        capabilityId: "queue.items.list",
        chainId: state.chainId,
      }),
      null,
      "derived",
    );
    expect(
      evaluateWorkspaceAgentBrokerContinuationAttempt(
        state,
        secondDifferentInput,
      ),
    ).toMatchObject({
      ok: true,
    });

    const sameFingerprintWithDerivedId = requestFor(
      "queue.items.list",
      { limit: 10 },
      deriveWorkspaceAgentBrokerContinuationRequestId({
        actionIndex: 3,
        capabilityId: "queue.items.list",
        chainId: state.chainId,
      }),
      null,
      "derived",
    );
    expect(
      evaluateWorkspaceAgentBrokerContinuationAttempt(
        state,
        sameFingerprintWithDerivedId,
      ),
    ).toMatchObject({
      ok: false,
      stopReason: "repeated_request_fingerprint",
    });
  });

  it("stops at the configured max action count", () => {
    let state = createWorkspaceAgentBrokerContinuationState({
      chainId: "chain-max",
      maxActions: 2,
    });
    state = recordAttempt(state, requestFor("queue.items.list", { limit: 1 }));
    state = recordAttempt(
      state,
      requestFor("queue.targetSingletonQueue", {}, "request-2"),
    );

    expect(
      evaluateWorkspaceAgentBrokerContinuationAttempt(
        state,
        requestFor("queue.items.list", { limit: 3 }, "request-3"),
      ),
    ).toMatchObject({
      ok: false,
      stopReason: "max_action_count_reached",
    });
  });

  it("allows queue.lifecycle.get to continue after successful read-only results", () => {
    const request = requestFor(
      "queue.lifecycle.get",
      { taskId: "task-1" },
      "request-lifecycle-get",
    );
    const state = recordAttempt(
      createWorkspaceAgentBrokerContinuationState({
        chainId: "chain-lifecycle-get",
      }),
      request,
    );

    expect(
      classifyWorkspaceAgentBrokerContinuationCapability("queue.lifecycle.get")
        .kind,
    ).toBe("allowed");
    expect(
      shouldContinueWorkspaceAgentBrokerAction({
        request,
        result: resultFor("queue.lifecycle.get", {
          lifecycle: { taskId: "task-1", ticketState: "awaiting_review" },
        }),
        state,
      }),
    ).toEqual({ shouldContinue: true });
  });

  it("stops with visible nextAction after evidence read when review creation is next", () => {
    const registry = createHobitAgentCapabilityRegistry();
    const capability = findCapability(
      registry,
      "queue.review.getEvidenceBundle",
    );
    if (!capability) {
      throw new Error("Expected queue.review.getEvidenceBundle to be registered.");
    }

    const request = requestFor(
      "queue.review.getEvidenceBundle",
      { runId: "run-1", taskId: "task-1" },
      "request-evidence-get",
    );
    const state = recordAttempt(
      createWorkspaceAgentBrokerContinuationState({
        chainId: "chain-evidence-get",
      }),
      request,
    );
    const result = resultFor("queue.review.getEvidenceBundle", {
      evidenceBundleId: "bundle-1",
      evidenceBundlePersistence: "backend_durable",
      evidenceState: "available",
      nextAction: {
        autoContinuationSafe: false,
        capabilityId: "queue.review.createMessage",
        input: {
          evidenceBundleId: "bundle-1",
          runId: "run-1",
          taskId: "task-1",
        },
        requiresConfirmation: false,
      },
      nextSuggestedCapability: "queue.review.createMessage",
      runId: "run-1",
      taskId: "task-1",
    });
    const context = createWorkspaceAgentBrokerActionResultContext({
      request,
      result,
      summary: "Queue worker evidence bundle read from backend.",
    });

    expect(capability).toMatchObject({
      confirmationRequirement: "none",
      ownerSurface: "Agent Queue",
      restricted: false,
      sideEffectLevel: "read",
    });
    expect(capability.forbiddenSideEffects).toEqual(
      expect.arrayContaining([
        "codex_run",
        "git_mutation",
        "rollback_execution",
        "shell_command",
        "terminal_launch",
        "validation_execution",
        "worker_auto_run",
        "worker_start",
      ]),
    );
    expect(
      classifyWorkspaceAgentBrokerContinuationCapability(capability).kind,
    ).toBe("allowed");
    expect(
      shouldContinueWorkspaceAgentBrokerAction({
        capability,
        request,
        result,
        state,
      }),
    ).toEqual({
      shouldContinue: false,
      stopReason: "not_allowed_for_auto_continuation",
    });
    expect(context).toMatchObject({
      capabilityId: "queue.review.getEvidenceBundle",
      ids: {
        evidenceBundleIds: ["bundle-1"],
        runId: "run-1",
        taskIds: ["task-1"],
      },
      nextAction: {
        capabilityId: "queue.review.createMessage",
        input: {
          evidenceBundleId: "bundle-1",
          runId: "run-1",
          taskId: "task-1",
        },
      },
      nextSuggestedCapability: "queue.review.createMessage",
      queueState: {
        evidenceState: "available",
        nextSuggestedCapability: "queue.review.createMessage",
      },
      safety: {
        didLaunchShell: false,
        didMutateGit: false,
        didRunValidation: false,
        didStartTerminal: false,
      },
    });
  });

  it("allows successful queue.review.ack to continue so backend lifecycle state can be read", () => {
    const registry = createHobitAgentCapabilityRegistry();
    const capability = findCapability(registry, "queue.review.ack");
    if (!capability) {
      throw new Error("Expected queue.review.ack to be registered.");
    }

    const request = requestFor(
      "queue.review.ack",
      { messageId: "review-message-1", taskId: "task-1" },
      "request-review-ack",
    );
    const state = recordAttempt(
      createWorkspaceAgentBrokerContinuationState({
        chainId: "chain-review-ack",
      }),
      request,
    );
    const result = resultFor("queue.review.ack", {
      aggregate: {
        commitState: "none",
        dependencyState: "none",
        durableFlags: {
          commitState: false,
          dependencyState: true,
          evidenceState: true,
          frontendOverlayUsed: false,
          latestRunLink: true,
          reviewState: true,
          taskRow: true,
          validationState: false,
        },
        evidenceState: "available",
        evidenceSummary: {
          available: true,
          notDurableReason: null,
          source: "durable_worker_evidence_bundle",
          summary: "Worker final report.",
        },
        latestRun: {
          completedAt: "2026-06-17T10:02:00.000Z",
          executorWidgetId: "executor-1",
          finalDetailAvailable: true,
          reviewStatus: "review_needed",
          runId: "run-1",
          runLinkId: "run-link-1",
          source: "agent_executor",
          startedAt: "2026-06-17T10:00:00.000Z",
          status: "completed",
          validationStatus: null,
        },
        reviewState: "in_review",
        taskId: "task-1",
        ticketState: "in_review",
        validationState: "unknown",
        workerRunState: "completed",
      },
      messageId: "review-message-1",
      nextAction: {
        autoContinuationSafe: true,
        capabilityId: "queue.lifecycle.get",
        input: { taskId: "task-1" },
        requiresConfirmation: false,
      },
      nextSuggestedCapability: "queue.lifecycle.get",
      queueMutation: "backend_domain",
      reviewState: "in_review",
      taskId: "task-1",
      ticketState: "in_review",
      workerRunState: "completed",
      wouldPersistBackend: true,
    });
    const context = createWorkspaceAgentBrokerActionResultContext({
      request,
      result,
      summary: "Queue review acknowledged.",
    });

    expect(capability).toMatchObject({
      ownerSurface: "Agent Queue",
      restricted: false,
      sideEffectLevel: "write",
    });
    expect(
      classifyWorkspaceAgentBrokerContinuationCapability(capability).kind,
    ).toBe("allowed");
    expect(
      shouldContinueWorkspaceAgentBrokerAction({
        capability,
        request,
        result,
        state,
      }),
    ).toEqual({ shouldContinue: true });
    expect(context).toMatchObject({
      capabilityId: "queue.review.ack",
      ids: {
        messageIds: ["review-message-1"],
        runId: "run-1",
        taskIds: ["task-1"],
      },
      nextAction: {
        capabilityId: "queue.lifecycle.get",
        input: { taskId: "task-1" },
      },
      nextSuggestedCapability: "queue.lifecycle.get",
      queueState: {
        commitState: "none",
        dependencyState: "none",
        durableFlags: {
          reviewState: true,
          taskRow: true,
        },
        evidenceState: "available",
        latestRun: {
          runId: "run-1",
          status: "completed",
        },
        nextSuggestedCapability: "queue.lifecycle.get",
        reviewState: "in_review",
        ticketState: "in_review",
        validationState: "unknown",
        workerRunState: "completed",
      },
    });
  });

  it("blocks shell, raw Codex, Git, Terminal, rollback, and validation capabilities from auto-continuation", () => {
    for (const capabilityId of [
      "workspace.shell.runCommand",
      "codex.runTask",
      "git.commit",
      "terminal.open",
      "rollback.execute",
      "validation.run",
      "delete.queueItem",
    ]) {
      expect(
        classifyWorkspaceAgentBrokerContinuationCapability(capabilityId).kind,
      ).toBe("restricted");
    }
  });

  it("keeps transitional write and finalization capabilities out of auto-continuation", () => {
    const operatorFlowState = createWorkspaceAgentBrokerContinuationState({
      chainId: "chain-transitional-operator-flow",
      queueAutonomyGrant: queueAutonomyGrant("queue_operator_flow", {
        confirmationToken: QUEUE_START_RUN_CONFIRMATION_TOKEN,
      }),
    });

    for (const capabilityId of [
      "queue.coordinator.approveValidation",
      "queue.coordinator.addFollowUpPrompt",
      "queue.item.markDone",
      "queue.item.block",
      "queue.item.fail",
    ]) {
      const request = requestFor(capabilityId, {
        coordinatorAgentId: "workspace-agent",
        prompt: "Continue with a visible follow-up.",
        reason: "Needs operator decision.",
        taskId: "task-1",
      });
      const state = recordAttempt(
        createWorkspaceAgentBrokerContinuationState({
          chainId: `chain-${capabilityId}`,
        }),
        request,
      );

      expect(
        classifyWorkspaceAgentBrokerContinuationCapability(capabilityId).kind,
      ).toBe("not_allowed");
      if (
        capabilityId === "queue.coordinator.approveValidation" ||
        capabilityId === "queue.coordinator.addFollowUpPrompt" ||
        capabilityId === "queue.item.block"
      ) {
        expect(
          classifyWorkspaceAgentBrokerContinuationCapability(
            capabilityId,
            operatorFlowState.queueAutonomyPolicy,
          ).kind,
        ).toBe("not_allowed");
      }
      expect(
        shouldContinueWorkspaceAgentBrokerAction({
          request,
          result: resultFor(capabilityId, { taskId: "task-1" }),
          state,
        }),
      ).toEqual({
        shouldContinue: false,
        stopReason: "not_allowed_for_auto_continuation",
      });
    }
  });

  it("keeps finalization blocked outside finalizer-specific Queue autonomy grants", () => {
    const queueSmokeState = createWorkspaceAgentBrokerContinuationState({
      chainId: "chain-queue-smoke-finalization",
      queueAutonomyGrant: queueAutonomyGrant("queue_smoke", {
        confirmationToken: QUEUE_START_RUN_CONFIRMATION_TOKEN,
      }),
    });
    const acceptanceState = createWorkspaceAgentBrokerContinuationState({
      chainId: "chain-acceptance-finalization",
      queueAutonomyGrant: queueAutonomyGrant("queue_acceptance_smoke", {
        confirmationToken: QUEUE_START_RUN_CONFIRMATION_TOKEN,
      }),
    });

    expect(
      classifyWorkspaceAgentBrokerContinuationCapability(
        "queue.item.markDone",
        queueSmokeState.queueAutonomyPolicy,
      ).kind,
    ).toBe("not_allowed");
    expect(
      classifyWorkspaceAgentBrokerContinuationCapability(
        "queue.item.markDone",
        acceptanceState.queueAutonomyPolicy,
      ).kind,
    ).toBe("allowed");
  });

  it("does not wildcard-allow review writes or unsafe post-ACK continuation requests", () => {
    for (const capabilityId of [
      "queue.review.createMessage",
      "queue.item.markDone",
      "queue.item.block",
      "queue.item.fail",
      "queue.coordinator.approveValidation",
      "queue.coordinator.addFollowUpPrompt",
    ]) {
      const request = requestFor(capabilityId, {
        coordinatorAgentId: "workspace-agent",
        messageId: "review-message-1",
        prompt: "Continue from ACK.",
        reason: "Review ACK does not finalize the task.",
        taskId: "task-1",
      });
      const state = recordAttempt(
        createWorkspaceAgentBrokerContinuationState({
          chainId: `chain-post-ack-${capabilityId}`,
        }),
        request,
      );

      expect(
        classifyWorkspaceAgentBrokerContinuationCapability(capabilityId).kind,
      ).toBe("not_allowed");
      expect(
        shouldContinueWorkspaceAgentBrokerAction({
          request,
          result: resultFor(capabilityId, { taskId: "task-1" }),
          state,
        }),
      ).toEqual({
        shouldContinue: false,
        stopReason: "not_allowed_for_auto_continuation",
      });
    }
  });

  it("does not infer continuation from nextSuggestedCapability alone", () => {
    const request = requestFor(
      "queue.review.createMessage",
      { taskId: "task-1" },
      "request-suggested-only",
    );
    const state = recordAttempt(
      createWorkspaceAgentBrokerContinuationState({
        chainId: "chain-suggested-only",
      }),
      request,
    );

    expect(
      shouldContinueWorkspaceAgentBrokerAction({
        request,
        result: resultFor("queue.review.createMessage", {
          messageId: "review-message-1",
          nextSuggestedCapability: "queue.review.ack",
          taskId: "task-1",
        }),
        state,
      }),
    ).toEqual({
      shouldContinue: false,
      stopReason: "not_allowed_for_auto_continuation",
    });
  });

  it("stops with diagnostics when nextActionUnavailable is structured", () => {
    const request = requestFor(
      "queue.items.list",
      { limit: 10 },
      "request-structured-next-action-unavailable",
    );
    const state = recordAttempt(
      createWorkspaceAgentBrokerContinuationState({
        chainId: "chain-structured-next-action-unavailable",
      }),
      request,
    );

    expect(
      decideWorkspaceAgentBrokerActionContinuation({
        request,
        result: resultFor("queue.items.list", {
          nextActionUnavailable: {
            missingRequiredInputs: ["taskId"],
            reasonCode: "missing_required_input",
            reasonMessage: "taskId is required before lifecycle can be read.",
          },
          nextSuggestedCapability: "queue.lifecycle.get",
        }),
        state,
      }),
    ).toMatchObject({
      diagnostics: {
        capabilityId: "queue.lifecycle.get",
        moduleId: "queue",
        nextActionPayloadValidated: null,
        nextActionPresent: false,
        reasonCode: "no_next_action",
      },
      shouldContinue: false,
      stopReason: "not_allowed_for_auto_continuation",
    });
  });

  it("reports ambiguous_next_action when a list result has multiple candidate task ids", () => {
    const request = requestFor(
      "queue.items.list",
      { limit: 10 },
      "request-list-ambiguous",
    );
    const state = recordAttempt(
      createWorkspaceAgentBrokerContinuationState({
        chainId: "chain-list-ambiguous",
        queueAutonomyGrant: queueAutonomyGrant("queue_acceptance_smoke"),
      }),
      request,
    );
    const result = resultFor("queue.items.list", {
      candidateTaskIds: ["task-a", "task-b"],
      itemCount: 2,
      items: [{ taskId: "task-a" }, { taskId: "task-b" }],
      nextActionUnavailable: {
        ambiguousCandidateIds: ["task-a", "task-b"],
        reasonCode: "ambiguous_next_action",
        reasonMessage:
          "A top-level Queue nextAction is unavailable because the result contains multiple candidate task ids.",
      },
      nextActionUnavailableCode: "ambiguous_next_action",
      nextActionUnavailableReason:
        "A top-level Queue nextAction is unavailable because the result contains multiple candidate task ids.",
      nextSuggestedCapability: "queue.item.updateRunSettings",
    });
    const decision = decideWorkspaceAgentBrokerActionContinuation({
      request,
      result,
      state,
    });
    const context = createWorkspaceAgentBrokerActionResultContext({
      policyDiagnostics: decision.diagnostics,
      request,
      result,
      stopReason: decision.shouldContinue ? undefined : decision.stopReason,
      summary: "Queue items listed.",
    });

    expect(decision).toMatchObject({
      diagnostics: {
        candidateTaskIds: ["task-a", "task-b"],
        capabilityId: "queue.item.updateRunSettings",
        grantActive: true,
        moduleId: "queue",
        nextActionPayloadValidated: null,
        nextActionModuleId: null,
        nextActionPresent: false,
        reasonCode: "ambiguous_next_action",
        riskClass: "setup",
      },
      shouldContinue: false,
      stopReason: "ambiguous_next_action",
    });
    expect(context.policyDiagnostics).toMatchObject({
      candidateTaskIds: ["task-a", "task-b"],
      reasonCode: "ambiguous_next_action",
    });
    expect(context.nextActionUnavailable).toMatchObject({
      ambiguousCandidateIds: ["task-a", "task-b"],
      reasonCode: "ambiguous_next_action",
    });
  });

  it("continues review duplicate to ACK using messageId from typed nextAction", () => {
    const request = requestFor(
      "queue.review.createMessage",
      { taskId: "task-1" },
      "request-review-duplicate",
    );
    const state = recordAttempt(
      createWorkspaceAgentBrokerContinuationState({
        chainId: "chain-review-duplicate",
        queueAutonomyGrant: queueAutonomyGrant("queue_smoke"),
      }),
      request,
    );

    expect(
      shouldContinueWorkspaceAgentBrokerAction({
        request,
        result: resultFor(
          "queue.review.createMessage",
          {
            existingReviewMessageId: "review-message-1",
            nextAction: plainNextAction("queue.review.ack", {
              messageId: "review-message-1",
              taskId: "task-1",
            }),
            nextSuggestedCapability: "queue.review.ack",
            taskId: "task-1",
          },
          "already_exists",
        ),
        state,
      }),
    ).toEqual({ shouldContinue: true });
  });

  it("continues blocked_actionable only through a valid typed nextAction allowed by policy", () => {
    const request = requestFor(
      "queue.lifecycle.get",
      { taskId: "task-1" },
      "request-blocked-actionable-mark-done",
    );
    const state = recordAttempt(
      createWorkspaceAgentBrokerContinuationState({
        chainId: "chain-blocked-actionable-mark-done",
        queueAutonomyGrant: queueAutonomyGrant("queue_acceptance_smoke", {
          confirmationToken: QUEUE_START_RUN_CONFIRMATION_TOKEN,
        }),
      }),
      request,
    );

    expect(
      decideWorkspaceAgentBrokerActionContinuation({
        request,
        result: resultFor(
          "queue.lifecycle.get",
          {
            nextAction: confirmedNextAction("queue.item.markDone", {
              taskId: "task-1",
            }),
            nextSuggestedCapability: "queue.item.markDone",
            taskId: "task-1",
          },
          "blocked_actionable",
        ),
        state,
      }),
    ).toMatchObject({
      diagnostics: {
        capabilityId: "queue.item.markDone",
        nextActionPayloadValidated: true,
        reasonCode: "continuation_allowed",
      },
      shouldContinue: true,
    });
  });

  it("reports deniedCapabilities and missing confirmation as distinct policy diagnostics", () => {
    const deniedRequest = requestFor(
      "queue.items.list",
      { taskId: "task-1" },
      "request-denied-settings",
    );
    const deniedState = recordAttempt(
      createWorkspaceAgentBrokerContinuationState({
        chainId: "chain-denied-settings",
        queueAutonomyGrant: queueAutonomyGrant("queue_smoke", {
          deniedCapabilities: ["queue.item.updateRunSettings"],
        }),
      }),
      deniedRequest,
    );
    const deniedDecision = decideWorkspaceAgentBrokerActionContinuation({
      request: deniedRequest,
      result: resultFor("queue.items.list", {
        nextAction: plainNextAction("queue.item.updateRunSettings", {
          codexExecutable: "codex.cmd",
          taskId: "task-1",
        }),
        nextSuggestedCapability: "queue.item.updateRunSettings",
      }),
      state: deniedState,
    });

    expect(deniedDecision).toMatchObject({
      diagnostics: {
        capabilityId: "queue.item.updateRunSettings",
        deniedCapabilitiesBlocked: true,
        reasonCode: "capability_denied_by_grant",
      },
      shouldContinue: false,
    });

    const confirmationRequest = requestFor(
      "queue.enable",
      {},
      "request-missing-confirmation",
    );
    const confirmationState = recordAttempt(
      createWorkspaceAgentBrokerContinuationState({
        chainId: "chain-missing-confirmation",
        queueAutonomyGrant: queueAutonomyGrant("queue_smoke"),
      }),
      confirmationRequest,
    );

    expect(
      decideWorkspaceAgentBrokerActionContinuation({
        request: confirmationRequest,
        result: resultFor("queue.enable", {
          nextAction: confirmedNextAction("queue.item.startRun", {
            executorWidgetId: "executor-1",
            taskId: "task-1",
          }),
          nextSuggestedCapability: "queue.item.startRun",
        }),
        state: confirmationState,
      }),
    ).toMatchObject({
      diagnostics: {
        capabilityId: "queue.item.startRun",
        confirmationMissing: true,
        reasonCode: "confirmation_required",
      },
      shouldContinue: false,
      stopReason: "confirmation_required",
    });
  });

  it("blocks mismatched nextSuggestedCapability and dependency-waiting startRun nextActions under grants", () => {
    const request = requestFor("queue.enable", {}, "request-enable-mismatch");
    const state = recordAttempt(
      createWorkspaceAgentBrokerContinuationState({
        chainId: "chain-next-action-mismatch",
        queueAutonomyGrant: queueAutonomyGrant("queue_acceptance_smoke", {
          confirmationToken: QUEUE_START_RUN_CONFIRMATION_TOKEN,
        }),
      }),
      request,
    );

    expect(
      decideWorkspaceAgentBrokerActionContinuation({
        request,
        result: resultFor("queue.enable", {
          nextAction: confirmedNextAction("queue.item.startRun", {
            executorWidgetId: "executor-1",
            taskId: "task-1",
          }),
          nextSuggestedCapability: "queue.review.ack",
        }),
        state,
      }),
    ).toMatchObject({
      diagnostics: {
        reasonCode: "next_action_suggestion_mismatch",
      },
      shouldContinue: false,
      stopReason: "invalid_input",
    });
    expect(
      decideWorkspaceAgentBrokerActionContinuation({
        request,
        result: resultFor("queue.enable", {
          aggregate: {
            dependencyState: "waiting",
          },
          nextAction: confirmedNextAction("queue.item.startRun", {
            executorWidgetId: "executor-1",
            taskId: "task-1",
          }),
          nextSuggestedCapability: "queue.item.startRun",
        }),
        state,
      }),
    ).toMatchObject({
      diagnostics: {
        reasonCode: "dependency_waiting",
      },
      shouldContinue: false,
      stopReason: "policy_blocked",
    });
  });

  it("rejects invalid nextAction payloads instead of repairing field names", () => {
    const request = requestFor(
      "queue.review.createMessage",
      { taskId: "task-1" },
      "request-invalid-next-action",
    );
    const state = recordAttempt(
      createWorkspaceAgentBrokerContinuationState({
        chainId: "chain-invalid-next-action",
      }),
      request,
    );

    expect(
      decideWorkspaceAgentBrokerActionContinuation({
        request,
        result: resultFor("queue.review.createMessage", {
          nextAction: {
            autoContinuationSafe: true,
            capabilityId: "queue.review.ack",
            input: {
              reviewMessageId: "review-message-1",
              taskId: "task-1",
            },
            requiresConfirmation: false,
          },
          nextSuggestedCapability: "queue.review.ack",
        }),
        state,
      }),
    ).toMatchObject({
      diagnostics: {
        moduleId: "queue",
        nextActionPayloadValidated: false,
        reasonCode: "next_action_payload_invalid",
      },
      shouldContinue: false,
      stopReason: "invalid_input",
    });
  });

  it("blocks unregistered and wrong evidence capability ids from auto-continuation", () => {
    const registry = createHobitAgentCapabilityRegistry();

    for (const capabilityId of [
      "queue.item.finishEverything",
      "queue.review.unregistered",
      "queue.lifecycle.getEvidenceBundle",
    ]) {
      const request = requestFor(capabilityId, { taskId: "task-1" });
      const state = recordAttempt(
        createWorkspaceAgentBrokerContinuationState({
          chainId: `chain-${capabilityId}`,
        }),
        request,
      );

      expect(findCapability(registry, capabilityId)).toBeNull();
      expect(
        classifyWorkspaceAgentBrokerContinuationCapability(capabilityId).kind,
      ).toBe("not_allowed");
      expect(
        shouldContinueWorkspaceAgentBrokerAction({
          request,
          result: resultFor(capabilityId, { taskId: "task-1" }),
          state,
        }),
      ).toEqual({
        shouldContinue: false,
        stopReason: "not_allowed_for_auto_continuation",
      });
    }
  });

  it("allows queue.item.startRun continuation only after confirmed explicit-id success", () => {
    const request = requestFor(
      "queue.item.startRun",
      { executorWidgetId: "executor-1", taskId: "task-1" },
      "request-start",
      QUEUE_START_RUN_CONFIRMATION_TOKEN,
    );
    const state = recordAttempt(
      createWorkspaceAgentBrokerContinuationState({ chainId: "chain-start" }),
      request,
    );

    expect(
      shouldContinueWorkspaceAgentBrokerAction({
        request,
        result: resultFor("queue.item.startRun", {
          executorWidgetId: "executor-1",
          runId: "run-1",
          taskId: "task-1",
        }),
        state,
      }),
    ).toEqual({ shouldContinue: true });

    expect(
      shouldContinueWorkspaceAgentBrokerAction({
        request: requestFor(
          "queue.item.startRun",
          { taskId: "task-1" },
          "request-start-missing-executor",
          QUEUE_START_RUN_CONFIRMATION_TOKEN,
        ),
        result: resultFor("queue.item.startRun", {
          runId: "run-1",
          taskId: "task-1",
        }),
        state,
      }),
    ).toEqual({
      shouldContinue: false,
      stopReason: "not_allowed_for_auto_continuation",
    });

    expect(
      shouldContinueWorkspaceAgentBrokerAction({
        request: requestFor(
          "queue.item.startRun",
          { executorWidgetId: "executor-1", taskId: "task-1" },
          "request-start-wrong-token",
          "confirmed",
        ),
        result: resultFor("queue.item.startRun", {
          executorWidgetId: "executor-1",
          runId: "run-1",
          taskId: "task-1",
        }),
        state,
      }),
    ).toEqual({
      shouldContinue: false,
      stopReason: "not_allowed_for_auto_continuation",
    });
  });

  it("continues queue.enable to queue.item.startRun inside an exact-token Queue autonomy grant", () => {
    const request = requestFor("queue.enable", {}, "request-enable");
    let state = recordAttempt(
      createWorkspaceAgentBrokerContinuationState({
        chainId: "chain-enable-start",
        queueAutonomyGrant: queueAutonomyGrant("queue_acceptance_smoke", {
          confirmationToken: QUEUE_START_RUN_CONFIRMATION_TOKEN,
        }),
      }),
      request,
    );
    const result = resultFor("queue.enable", {
      nextAction: confirmedNextAction("queue.item.startRun", {
        executorWidgetId: "executor-1",
        taskId: "task-1",
      }),
      nextSuggestedCapability: "queue.item.startRun",
      taskId: "task-1",
    });

    expect(
      shouldContinueWorkspaceAgentBrokerAction({
        request,
        result,
        state,
      }),
    ).toEqual({ shouldContinue: true });

    state = prepareWorkspaceAgentBrokerContinuationStateForResult({
      result,
      state,
    });
    const emittedStartRun = requestFor(
      "queue.item.startRun",
      { executorWidgetId: "executor-1", taskId: "task-1" },
      "request-start-from-next-action",
    );
    const applied = applyWorkspaceAgentQueueAutonomyGrantToActionRequest(
      state,
      emittedStartRun,
    );

    expect(applied.confirmationInjected).toBe(true);
    expect(applied.request.confirmationToken).toBe(
      QUEUE_START_RUN_CONFIRMATION_TOKEN,
    );
  });

  it("does not inject confirmation from prose, missing grants, wrong tokens, or wrong nextAction input", () => {
    const noGrantState = prepareWorkspaceAgentBrokerContinuationStateForResult({
      result: resultFor("queue.enable", {
        nextAction: confirmedNextAction("queue.item.startRun", {
          executorWidgetId: "executor-1",
          taskId: "task-1",
        }),
        nextSuggestedCapability: "queue.item.startRun",
      }),
      state: createWorkspaceAgentBrokerContinuationState({
        chainId: "chain-no-grant-token",
      }),
    });
    const wrongTokenState = prepareWorkspaceAgentBrokerContinuationStateForResult({
      result: resultFor("queue.enable", {
        nextAction: confirmedNextAction("queue.item.startRun", {
          executorWidgetId: "executor-1",
          taskId: "task-1",
        }),
        nextSuggestedCapability: "queue.item.startRun",
      }),
      state: createWorkspaceAgentBrokerContinuationState({
        chainId: "chain-wrong-token",
        queueAutonomyGrant: {
          constraints: queueAutonomyConstraints(),
          confirmationToken: "confirmed",
          mode: "queue_acceptance_smoke",
          type: "hobit.queue.autonomyGrant",
        },
      }),
    });
    const grantedState = prepareWorkspaceAgentBrokerContinuationStateForResult({
      result: resultFor("queue.enable", {
        nextAction: confirmedNextAction("queue.item.startRun", {
          executorWidgetId: "executor-1",
          taskId: "task-1",
        }),
        nextSuggestedCapability: "queue.item.startRun",
      }),
      state: createWorkspaceAgentBrokerContinuationState({
        chainId: "chain-wrong-input-token",
        queueAutonomyGrant: queueAutonomyGrant("queue_acceptance_smoke", {
          confirmationToken: QUEUE_START_RUN_CONFIRMATION_TOKEN,
        }),
      }),
    });

    expect(
      applyWorkspaceAgentQueueAutonomyGrantToActionRequest(
        noGrantState,
        requestFor(
          "queue.item.startRun",
          { executorWidgetId: "executor-1", taskId: "task-1" },
          "request-no-grant-start",
        ),
      ).confirmationInjected,
    ).toBe(false);
    expect(
      applyWorkspaceAgentQueueAutonomyGrantToActionRequest(
        wrongTokenState,
        requestFor(
          "queue.item.startRun",
          { executorWidgetId: "executor-1", taskId: "task-1" },
          "request-wrong-token-start",
        ),
      ).confirmationInjected,
    ).toBe(false);
    expect(
      applyWorkspaceAgentQueueAutonomyGrantToActionRequest(
        grantedState,
        requestFor(
          "queue.item.startRun",
          { executorWidgetId: "executor-2", taskId: "task-1" },
          "request-wrong-input-start",
        ),
      ).confirmationInjected,
    ).toBe(false);
  });

  it("gates markDone and fail by grant mode, exact confirmation, and final no-downstream behavior", () => {
    const acceptanceLifecycleRequest = requestFor(
      "queue.lifecycle.get",
      { taskId: "task-1" },
      "request-lifecycle-acceptance",
    );
    const acceptanceState = recordAttempt(
      createWorkspaceAgentBrokerContinuationState({
        chainId: "chain-mark-done",
        queueAutonomyGrant: queueAutonomyGrant("queue_acceptance_smoke", {
          confirmationToken: QUEUE_START_RUN_CONFIRMATION_TOKEN,
        }),
      }),
      acceptanceLifecycleRequest,
    );
    const markDoneResult = resultFor("queue.lifecycle.get", {
      nextAction: confirmedNextAction("queue.item.markDone", {
        taskId: "task-1",
      }),
      nextSuggestedCapability: "queue.item.markDone",
      taskId: "task-1",
    });

    expect(
      shouldContinueWorkspaceAgentBrokerAction({
        request: acceptanceLifecycleRequest,
        result: markDoneResult,
        state: acceptanceState,
      }),
    ).toEqual({ shouldContinue: true });
    expect(
      shouldContinueWorkspaceAgentBrokerAction({
        request: requestFor(
          "queue.item.markDone",
          { taskId: "task-1" },
          "request-mark-done-final",
          QUEUE_START_RUN_CONFIRMATION_TOKEN,
        ),
        result: resultFor("queue.item.markDone", {
          decisionId: "decision-1",
          taskId: "task-1",
        }),
        state: recordAttempt(
          createWorkspaceAgentBrokerContinuationState({
            chainId: "chain-mark-done-final",
            queueAutonomyGrant: queueAutonomyGrant("queue_acceptance_smoke", {
              confirmationToken: QUEUE_START_RUN_CONFIRMATION_TOKEN,
            }),
          }),
          requestFor(
            "queue.item.markDone",
            { taskId: "task-1" },
            "request-mark-done-final",
            QUEUE_START_RUN_CONFIRMATION_TOKEN,
          ),
        ),
      }),
    ).toEqual({
      shouldContinue: false,
      stopReason: "not_allowed_for_auto_continuation",
    });

    const failureLifecycleRequest = requestFor(
      "queue.lifecycle.get",
      { taskId: "task-1" },
      "request-lifecycle-failure",
    );
    const failureState = recordAttempt(
      createWorkspaceAgentBrokerContinuationState({
        chainId: "chain-fail",
        queueAutonomyGrant: queueAutonomyGrant("queue_failure_smoke", {
          confirmationToken: QUEUE_START_RUN_CONFIRMATION_TOKEN,
        }),
      }),
      failureLifecycleRequest,
    );
    const failResult = resultFor("queue.lifecycle.get", {
      nextAction: confirmedNextAction("queue.item.fail", {
        reason: "Worker failed.",
        taskId: "task-1",
      }),
      nextSuggestedCapability: "queue.item.fail",
      taskId: "task-1",
    });

    expect(
      shouldContinueWorkspaceAgentBrokerAction({
        request: failureLifecycleRequest,
        result: failResult,
        state: failureState,
      }),
    ).toEqual({ shouldContinue: true });

    const failFinalRequest = requestFor(
      "queue.item.fail",
      { reason: "Worker failed.", taskId: "task-1" },
      "request-fail-final",
      QUEUE_START_RUN_CONFIRMATION_TOKEN,
    );
    expect(
      shouldContinueWorkspaceAgentBrokerAction({
        request: failFinalRequest,
        result: resultFor("queue.item.fail", {
          reason: "Worker failed.",
          taskId: "task-1",
        }),
        state: recordAttempt(
          createWorkspaceAgentBrokerContinuationState({
            chainId: "chain-fail-final",
            queueAutonomyGrant: queueAutonomyGrant("queue_failure_smoke", {
              confirmationToken: QUEUE_START_RUN_CONFIRMATION_TOKEN,
            }),
          }),
          failFinalRequest,
        ),
      }),
    ).toEqual({
      shouldContinue: false,
      stopReason: "not_allowed_for_auto_continuation",
    });
  });

  it("creates compact hobit.action.result context with ids, blockers, safety, and no raw logs or secrets", () => {
    const request = requestFor("queue.items.list", { limit: 10 });
    const context = createWorkspaceAgentBrokerActionResultContext({
      request,
      result: resultFor("queue.items.list", {
        availableExecutors: [
          { executorWidgetId: "executor-1", label: "Local executor" },
        ],
        hiddenSideEffectFlags: {
          didLaunchShell: false,
          didLaunchTerminal: false,
          didMutateGit: false,
          didRunValidation: false,
        },
        items: [
          {
            blockerReasons: ["Missing Codex executable."],
            latestRunId: "run-old",
            taskId: "task-1",
          },
        ],
        nextSuggestedCapability: "queue.item.updateRunSettings",
        rawLogs:
          "this full log line should not be copied into continuation context",
        secretToken: "secret-value-123",
      }),
      summary: "Queue items listed.",
    });
    const prompt = formatWorkspaceAgentBrokerContinuationPrompt({
      actionIndex: 1,
      context,
      maxActions: WORKSPACE_AGENT_BROKER_CONTINUATION_MAX_ACTIONS,
    });

    expect(context).toMatchObject({
      capabilityId: "queue.items.list",
      ids: {
        executorWidgetIds: ["executor-1"],
        runId: null,
        taskIds: ["task-1"],
      },
      nextSuggestedCapability: "queue.item.updateRunSettings",
      safety: {
        didLaunchShell: false,
        didMutateGit: false,
        didRunValidation: false,
        didStartTerminal: false,
      },
      type: "hobit.action.result",
    });
    expect(context.blockers).toContain("Missing Codex executable.");
    expect(context.notDone).toEqual(
      expect.arrayContaining(["No validation run.", "No Git mutation."]),
    );
    expect(prompt).toContain('"type":"hobit.action.result"');
    expect(prompt).toContain("hobit.final.answer");
    expect(prompt).toContain("Intermediate prose is not a capability call");
    expect(prompt).not.toContain("awaiting capability result");
    expect(prompt).toContain('"taskIds":["task-1"]');
    expect(prompt.length).toBeLessThanOrEqual(3600);
    expect(prompt).not.toContain("secret-value-123");
    expect(prompt).not.toContain("full log line");
  });

  it("includes backend aggregate state dimensions in compact lifecycle result context", () => {
    const request = requestFor(
      "queue.lifecycle.get",
      { taskId: "task-acked" },
      "request-lifecycle-acked",
    );
    const context = createWorkspaceAgentBrokerActionResultContext({
      request,
      result: resultFor("queue.lifecycle.get", {
        aggregateSource: "tauri_queue_item_aggregate",
        authoritativeBackendAggregate: true,
        blockerReasons: ["Review message has been acknowledged."],
        blockers: [
          {
            code: "review_acknowledged",
            message: "Review message has been acknowledged.",
          },
        ],
        commitState: "not_durable",
        dependencyState: "none",
        durableFlags: {
          commitState: false,
          dependencyState: true,
          evidenceState: true,
          frontendOverlayUsed: false,
          latestRunLink: true,
          reviewState: true,
          taskRow: true,
          validationState: false,
        },
        evidenceState: "available",
        evidenceSummary: {
          available: true,
          notDurableReason: null,
          source: "durable_worker_evidence_bundle",
          summary: "Worker final report.",
        },
        latestRun: {
          completedAt: "2026-06-17T10:02:00.000Z",
          executorWidgetId: "executor-1",
          finalDetailAvailable: true,
          reviewStatus: "review_needed",
          runId: "run-1",
          runLinkId: "run-link-1",
          source: "agent_executor",
          startedAt: "2026-06-17T10:00:00.000Z",
          status: "completed",
          validationStatus: null,
        },
        lifecycle: null,
        nextActions: [],
        nextSuggestedCapability: null,
        reviewState: "in_review",
        taskId: "task-acked",
        ticketState: "in_review",
        validationState: "unknown",
        workerRunState: "completed",
      }),
      summary:
        "Queue lifecycle read from backend aggregate. Review message has been acknowledged.",
    });
    const prompt = formatWorkspaceAgentBrokerContinuationPrompt({
      actionIndex: 2,
      context,
      maxActions: WORKSPACE_AGENT_BROKER_CONTINUATION_MAX_ACTIONS,
    });

    expect(context.blockers).toContain(
      "Review message has been acknowledged.",
    );
    expect(context.queueState).toMatchObject({
      blockers: ["Review message has been acknowledged."],
      commitState: "not_durable",
      dependencyState: "none",
      durableFlags: {
        commitState: false,
        evidenceState: true,
        reviewState: true,
        validationState: false,
      },
      evidenceState: "available",
      evidenceSummary: {
        available: true,
        source: "durable_worker_evidence_bundle",
        summary: "Worker final report.",
      },
      latestRun: {
        executorWidgetId: "executor-1",
        runId: "run-1",
        status: "completed",
      },
      nextSuggestedCapability: null,
      reviewState: "in_review",
      ticketState: "in_review",
      validationState: "unknown",
      workerRunState: "completed",
    });
    expect(prompt).toContain('"ticketState":"in_review"');
    expect(prompt).toContain('"reviewState":"in_review"');
    expect(prompt).toContain('"evidenceState":"available"');
    expect(prompt).toContain("hobit.final.answer");
  });

  it("supports the ACK to lifecycle read to final-answer smoke continuation path", () => {
    const ackRequest = requestFor(
      "queue.review.ack",
      { messageId: "review-message-1", taskId: "task-1" },
      "request-smoke-ack",
    );
    let state = recordAttempt(
      createWorkspaceAgentBrokerContinuationState({
        chainId: "chain-ack-lifecycle-final",
      }),
      ackRequest,
    );
    const ackResult = resultFor("queue.review.ack", {
      messageId: "review-message-1",
      nextAction: {
        autoContinuationSafe: true,
        capabilityId: "queue.lifecycle.get",
        input: { taskId: "task-1" },
        requiresConfirmation: false,
      },
      nextSuggestedCapability: "queue.lifecycle.get",
      reviewState: "in_review",
      taskId: "task-1",
      ticketState: "in_review",
      workerRunState: "completed",
    });

    expect(
      shouldContinueWorkspaceAgentBrokerAction({
        request: ackRequest,
        result: ackResult,
        state,
      }),
    ).toEqual({ shouldContinue: true });

    const lifecycleRequest = requestFor(
      "queue.lifecycle.get",
      { taskId: "task-1" },
      "request-smoke-lifecycle",
    );
    const lifecycleAttempt = evaluateWorkspaceAgentBrokerContinuationAttempt(
      state,
      lifecycleRequest,
    );
    expect(lifecycleAttempt).toMatchObject({ ok: true });
    if (!lifecycleAttempt.ok) {
      throw new Error("Expected lifecycle continuation attempt to be accepted.");
    }
    state = recordWorkspaceAgentBrokerContinuationAttempt(
      state,
      lifecycleRequest,
      lifecycleAttempt.fingerprint,
    );
    const lifecycleResult = resultFor("queue.lifecycle.get", {
      authoritativeBackendAggregate: true,
      evidenceState: "available",
      lifecycle: null,
      nextSuggestedCapability: null,
      reviewState: "in_review",
      taskId: "task-1",
      ticketState: "in_review",
      workerRunState: "completed",
    });
    const context = createWorkspaceAgentBrokerActionResultContext({
      request: lifecycleRequest,
      result: lifecycleResult,
      summary: "Queue lifecycle read from backend aggregate.",
    });
    const prompt = formatWorkspaceAgentBrokerContinuationPrompt({
      actionIndex: state.actionCount,
      context,
      maxActions: state.maxActions,
    });

    expect(
      shouldContinueWorkspaceAgentBrokerAction({
        request: lifecycleRequest,
        result: lifecycleResult,
        state,
      }),
    ).toEqual({ shouldContinue: true });
    expect(context.queueState).toMatchObject({
      nextSuggestedCapability: null,
      reviewState: "in_review",
      ticketState: "in_review",
    });
    expect(prompt).toContain(
      '{"type":"hobit.final.answer","message":"..."}',
    );
  });

  it("supports an acceptance dependency smoke workflow under queue_acceptance_smoke grant", () => {
    let state = createWorkspaceAgentBrokerContinuationState({
      chainId: "chain-acceptance-dependency-smoke",
      queueAutonomyGrant: queueAutonomyGrant("queue_acceptance_smoke", {
        confirmationToken: QUEUE_START_RUN_CONFIRMATION_TOKEN,
      }),
    });

    state = expectContinues(
      state,
      requestFor("queue.createItem", {
        prompt: "Run upstream task A.",
        title: "Task A",
      }),
      resultFor("queue.createItem", { taskId: "task-a" }),
    );
    state = expectContinues(
      state,
      requestFor(
        "queue.createItem",
        {
          dependsOn: ["task-a"],
          prompt: "Run downstream task B after A.",
          title: "Task B",
        },
        "queue.createItem:request-b",
      ),
      resultFor("queue.createItem", {
        dependencyState: "waiting",
        taskId: "task-b",
      }),
    );
    state = expectContinues(
      state,
      requestFor("queue.enable", {}, "queue.enable:request-a"),
      resultFor("queue.enable", {
        nextAction: confirmedNextAction("queue.item.startRun", {
          executorWidgetId: "executor-1",
          taskId: "task-a",
        }),
        nextSuggestedCapability: "queue.item.startRun",
      }),
    );
    state = expectContinues(
      state,
      requestFor(
        "queue.item.startRun",
        { executorWidgetId: "executor-1", taskId: "task-a" },
        "queue.item.startRun:request-a",
        QUEUE_START_RUN_CONFIRMATION_TOKEN,
      ),
      resultFor("queue.item.startRun", {
        nextAction: plainNextAction("queue.lifecycle.get", {
          taskId: "task-a",
        }),
        nextSuggestedCapability: "queue.lifecycle.get",
        runId: "run-a",
      }),
    );
    state = expectContinues(
      state,
      requestFor(
        "queue.review.getEvidenceBundle",
        { runId: "run-a", taskId: "task-a" },
        "queue.review.getEvidenceBundle:request-a",
      ),
      resultFor("queue.review.getEvidenceBundle", {
        evidenceBundleId: "bundle-a",
        nextAction: plainNextAction(
          "queue.review.createMessage",
          {
            evidenceBundleId: "bundle-a",
            runId: "run-a",
            taskId: "task-a",
          },
          false,
        ),
        nextSuggestedCapability: "queue.review.createMessage",
      }),
    );
    state = expectContinues(
      state,
      requestFor(
        "queue.review.createMessage",
        { evidenceBundleId: "bundle-a", runId: "run-a", taskId: "task-a" },
        "queue.review.createMessage:request-a",
      ),
      resultFor("queue.review.createMessage", {
        nextAction: plainNextAction("queue.review.ack", {
          messageId: "message-a",
          taskId: "task-a",
        }),
        nextSuggestedCapability: "queue.review.ack",
      }),
    );
    state = expectContinues(
      state,
      requestFor(
        "queue.review.ack",
        { messageId: "message-a", taskId: "task-a" },
        "queue.review.ack:request-a",
      ),
      resultFor("queue.review.ack", {
        nextAction: plainNextAction("queue.lifecycle.get", {
          taskId: "task-a",
        }),
        nextSuggestedCapability: "queue.lifecycle.get",
      }),
    );
    state = expectContinues(
      state,
      requestFor(
        "queue.lifecycle.get",
        { taskId: "task-a" },
        "queue.lifecycle.get:request-a-ready",
      ),
      resultFor("queue.lifecycle.get", {
        nextAction: confirmedNextAction("queue.item.markDone", {
          taskId: "task-a",
        }),
        nextSuggestedCapability: "queue.item.markDone",
      }),
    );

    const markDoneRequest = requestFor(
      "queue.item.markDone",
      { taskId: "task-a" },
      "queue.item.markDone:request-a",
      QUEUE_START_RUN_CONFIRMATION_TOKEN,
    );
    const finalState = recordAttempt(state, markDoneRequest);
    expect(
      shouldContinueWorkspaceAgentBrokerAction({
        request: markDoneRequest,
        result: resultFor("queue.item.markDone", {
          dependencyState: "ready",
          downstreamTaskId: "task-b",
          taskId: "task-a",
        }),
        state: finalState,
      }),
    ).toEqual({
      shouldContinue: false,
      stopReason: "not_allowed_for_auto_continuation",
    });
  });

  it("supports a failure dependency smoke workflow under queue_failure_smoke grant", () => {
    let state = createWorkspaceAgentBrokerContinuationState({
      chainId: "chain-failure-dependency-smoke",
      queueAutonomyGrant: queueAutonomyGrant("queue_failure_smoke", {
        confirmationToken: QUEUE_START_RUN_CONFIRMATION_TOKEN,
      }),
    });

    state = expectContinues(
      state,
      requestFor("queue.createItem", {
        prompt: "Run upstream task A.",
        title: "Task A",
      }),
      resultFor("queue.createItem", { taskId: "task-a" }),
    );
    state = expectContinues(
      state,
      requestFor(
        "queue.item.startRun",
        { executorWidgetId: "executor-1", taskId: "task-a" },
        "queue.item.startRun:failure-request-a",
        QUEUE_START_RUN_CONFIRMATION_TOKEN,
      ),
      resultFor("queue.item.startRun", {
        nextAction: plainNextAction("queue.review.getEvidenceBundle", {
          runId: "run-a",
          taskId: "task-a",
        }),
        nextSuggestedCapability: "queue.review.getEvidenceBundle",
        runId: "run-a",
      }),
    );
    state = expectContinues(
      state,
      requestFor(
        "queue.review.createMessage",
        { runId: "run-a", taskId: "task-a" },
        "queue.review.createMessage:failure-request-a",
      ),
      resultFor("queue.review.createMessage", {
        nextAction: plainNextAction("queue.review.ack", {
          messageId: "message-a",
          taskId: "task-a",
        }),
        nextSuggestedCapability: "queue.review.ack",
      }),
    );
    state = expectContinues(
      state,
      requestFor(
        "queue.lifecycle.get",
        { taskId: "task-a" },
        "queue.lifecycle.get:failure-request-a",
      ),
      resultFor("queue.lifecycle.get", {
        nextAction: confirmedNextAction("queue.item.fail", {
          reason: "Worker failed.",
          taskId: "task-a",
        }),
        nextSuggestedCapability: "queue.item.fail",
      }),
    );

    const failRequest = requestFor(
      "queue.item.fail",
      { reason: "Worker failed.", taskId: "task-a" },
      "queue.item.fail:failure-request-a",
      QUEUE_START_RUN_CONFIRMATION_TOKEN,
    );
    const finalState = recordAttempt(state, failRequest);
    expect(
      shouldContinueWorkspaceAgentBrokerAction({
        request: failRequest,
        result: resultFor("queue.item.fail", {
          dependencyState: "failed_upstream",
          downstreamTaskId: "task-b",
          taskId: "task-a",
        }),
        state: finalState,
      }),
    ).toEqual({
      shouldContinue: false,
      stopReason: "not_allowed_for_auto_continuation",
    });
  });

  it("keeps continuation structured-only without natural-language id inference", () => {
    const request = requestFor(
      "queue.review.getEvidenceBundle",
      {},
      "request-no-prose-ids",
    );
    const context = createWorkspaceAgentBrokerActionResultContext({
      request,
      result: resultFor("queue.review.getEvidenceBundle", {
        finalAgentMessage:
          "Prose mentions taskId task-from-prose, runId run-from-prose, evidenceBundleId bundle-from-prose, and messageId message-from-prose.",
      }),
      summary:
        "Prose mentions taskId task-from-prose, runId run-from-prose, evidenceBundleId bundle-from-prose, and messageId message-from-prose.",
    });
    const prompt = formatWorkspaceAgentBrokerContinuationPrompt({
      actionIndex: 3,
      context,
      maxActions: WORKSPACE_AGENT_BROKER_CONTINUATION_MAX_ACTIONS,
    });

    expect(context.ids).toEqual({
      evidenceBundleIds: [],
      executorWidgetIds: [],
      messageIds: [],
      runId: null,
      taskIds: [],
    });
    expect(prompt).toContain(
      "Never infer taskId, runId, evidenceBundleId, messageId, or executorWidgetId",
    );
    expect(continuationSource).not.toContain("new RegExp");
    expect(continuationSource).not.toContain(".match(");
    expect(continuationSource).not.toContain("classifyUserIntent");
  });
});

function requestFor(
  capabilityId: string,
  input: unknown,
  requestId = `${capabilityId}:request`,
  confirmationToken: string | null = null,
  requestIdSource?: "derived" | "explicit",
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
    requestIdSource,
  });
}

function resultFor(
  capabilityId: string,
  output: unknown,
  status: HobitAgentActionStatus = "succeeded",
) {
  return createActionResult({
    capabilityId,
    message: `${capabilityId} completed.`,
    output,
    requestId: `${capabilityId}:request`,
    status,
  });
}

function recordAttempt(
  state: ReturnType<typeof createWorkspaceAgentBrokerContinuationState>,
  request: ReturnType<typeof requestFor>,
) {
  const attempt = evaluateWorkspaceAgentBrokerContinuationAttempt(
    state,
    request,
  );
  if (!attempt.ok) {
    throw new Error("Expected first attempt to be accepted.");
  }

  return recordWorkspaceAgentBrokerContinuationAttempt(
    state,
    request,
    attempt.fingerprint,
  );
}

function expectContinues(
  state: ReturnType<typeof createWorkspaceAgentBrokerContinuationState>,
  request: ReturnType<typeof requestFor>,
  result: ReturnType<typeof resultFor>,
) {
  const recorded = recordAttempt(state, request);
  expect(
    shouldContinueWorkspaceAgentBrokerAction({
      request,
      result,
      state: recorded,
    }),
  ).toEqual({ shouldContinue: true });

  return prepareWorkspaceAgentBrokerContinuationStateForResult({
    result,
    state: recorded,
  });
}

function queueAutonomyConstraints() {
  return {
    noDelete: true,
    noDownstreamAutoStart: true,
    noGit: true,
    noRollback: true,
    noTerminal: true,
    noValidationExecution: true,
  };
}

function queueAutonomyGrant(
  mode:
    | "read_only"
    | "queue_smoke"
    | "queue_acceptance_smoke"
    | "queue_failure_smoke"
    | "queue_operator_flow",
  overrides: Record<string, unknown> = {},
) {
  return {
    constraints: queueAutonomyConstraints(),
    mode,
    type: "hobit.queue.autonomyGrant",
    ...overrides,
  };
}

function confirmedNextAction(capabilityId: string, input: Record<string, unknown>) {
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

function plainNextAction(
  capabilityId: string,
  input: Record<string, unknown>,
  autoContinuationSafe = true,
) {
  return {
    autoContinuationSafe,
    capabilityId,
    input,
    moduleId: "queue",
    requiresConfirmation: false,
  };
}
