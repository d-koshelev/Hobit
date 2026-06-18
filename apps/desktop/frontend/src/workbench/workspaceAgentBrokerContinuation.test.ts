import { describe, expect, it } from "vitest";

import { createActionRequest, createActionResult } from "./agents/broker";
import {
  createHobitAgentCapabilityRegistry,
  findCapability,
} from "./agents/capabilities";
import continuationSource from "./workspaceAgentBrokerContinuation.ts?raw";
import {
  classifyWorkspaceAgentBrokerContinuationCapability,
  createWorkspaceAgentBrokerActionResultContext,
  createWorkspaceAgentBrokerContinuationState,
  deriveWorkspaceAgentBrokerContinuationRequestId,
  evaluateWorkspaceAgentBrokerContinuationAttempt,
  formatWorkspaceAgentBrokerContinuationPrompt,
  recordWorkspaceAgentBrokerContinuationProtocolRepair,
  recordWorkspaceAgentBrokerContinuationAttempt,
  shouldContinueWorkspaceAgentBrokerAction,
  WORKSPACE_AGENT_BROKER_CONTINUATION_MAX_ACTIONS,
} from "./workspaceAgentBrokerContinuation";

describe("workspaceAgentBrokerContinuation", () => {
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
        nextSuggestedCapability: "queue.item.updateRunSettings",
      }),
      state,
    });

    expect(decision).toEqual({ shouldContinue: true });
  });

  it("stops on broker statuses that require user or policy intervention", () => {
    const statuses = [
      ["needs_confirmation", "confirmation_required"],
      ["policy_blocked", "policy_blocked"],
      ["unavailable", "unavailable"],
      ["dry_run_required", "dry_run_required"],
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

  it("allows queue.review.getEvidenceBundle to continue after successful backend read-only evidence results", () => {
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
    ).toEqual({ shouldContinue: true });
    expect(context).toMatchObject({
      capabilityId: "queue.review.getEvidenceBundle",
      ids: {
        runId: "run-1",
        taskIds: ["task-1"],
      },
      nextSuggestedCapability: "queue.review.createMessage",
      safety: {
        didLaunchShell: false,
        didMutateGit: false,
        didRunValidation: false,
        didStartTerminal: false,
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
    ]) {
      expect(
        classifyWorkspaceAgentBrokerContinuationCapability(capabilityId).kind,
      ).toBe("restricted");
    }
  });

  it("keeps transitional write and finalization capabilities out of auto-continuation", () => {
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
        validationApproved: true,
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

  it("blocks unregistered and wrong evidence capability ids from auto-continuation", () => {
    const registry = createHobitAgentCapabilityRegistry();

    for (const capabilityId of [
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
      "operator-confirmed",
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
          "operator-confirmed",
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
      executorWidgetIds: [],
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

function resultFor(capabilityId: string, output: unknown) {
  return createActionResult({
    capabilityId,
    message: `${capabilityId} completed.`,
    output,
    requestId: `${capabilityId}:request`,
    status: "succeeded",
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
