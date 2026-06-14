import { describe, expect, it } from "vitest";

import {
  decideSmartQueueCoordinatorAction,
  proposeSmartQueueRollbackAttemptDecision,
  type SmartQueueCoordinatorDecision,
  type SmartQueueDecisionInput,
  type SmartQueueFailureKind,
  type SmartQueueWorkerReport,
} from "./smartQueueCoordinatorDecision";

describe("smartQueueCoordinatorDecision", () => {
  it("creates Needs decision for validation failure with product-facing reason", () => {
    const decision = decide(
      report({
        evidenceSummary: "Validation command failed.",
        failureKind: "validation_failure",
        stage: "validation",
      }),
    );

    expect(decision).toMatchObject({
      action: "request_human_input",
      humanStatus: {
        label: "Needs decision: validation failed",
        status: "needs_decision",
        text: "Needs decision: validation failed",
      },
      productLabel: "Needs decision: validation failed",
      recommendedActions: [
        "retry_with_modified_prompt",
        "request_human_input",
        "mark_failed",
      ],
      requiresOperatorApproval: true,
      severity: "needs_decision",
      shortReason: "validation failed",
    });
  });

  it("creates an exec failure blocker decision", () => {
    const decision = decide(
      report({
        failureKind: "execution_failure",
        shortReason: "Worker exited non-zero.",
        stage: "execution",
      }),
    );

    expect(decision).toMatchObject({
      action: "move_blocked",
      humanStatus: { status: "blocked", text: "Blocked: exec failure" },
      productLabel: "Blocked: exec failure",
      recommendedActions: ["move_blocked", "request_human_input"],
      shortReason: "exec failure",
    });
  });

  it("creates Blocked: missing config", () => {
    expect(decide(report({ failureKind: "missing_config" }))).toMatchObject({
      action: "move_blocked",
      humanStatus: { status: "blocked", text: "Blocked: missing config" },
      productLabel: "Blocked: missing config",
      shortReason: "missing config",
    });
  });

  it("creates Blocked: dependency failed", () => {
    expect(
      decide(report({ failureKind: "dependency_failed", stage: "dependency" })),
    ).toMatchObject({
      action: "move_blocked",
      humanStatus: { status: "blocked", text: "Blocked: dependency failed" },
      productLabel: "Blocked: dependency failed",
      shortReason: "dependency failed",
    });
  });

  it("creates Blocked: dependency blocked", () => {
    expect(
      decide(report({ failureKind: "dependency_blocked", stage: "dependency" })),
    ).toMatchObject({
      action: "move_blocked",
      humanStatus: { status: "blocked", text: "Blocked: dependency blocked" },
      productLabel: "Blocked: dependency blocked",
      shortReason: "dependency blocked",
    });
  });

  it("creates Blocked: dirty workspace", () => {
    expect(
      decide(report({ failureKind: "dirty_worktree", stage: "environment" })),
    ).toMatchObject({
      action: "move_blocked",
      humanStatus: { status: "blocked", text: "Blocked: dirty workspace" },
      productLabel: "Blocked: dirty workspace",
      shortReason: "dirty workspace",
    });
  });

  it("recommends retry_same for timeout when retry budget remains", () => {
    const decision = decide(report({ failureKind: "timeout" }), {
      maxRetries: 3,
      retryCount: 1,
    });

    expect(decision).toMatchObject({
      action: "retry_same",
      productLabel: "Retry available",
      recommendedActions: ["retry_same"],
      retryPolicy: {
        canRetry: true,
        maxRetries: 3,
        retryCount: 1,
      },
    });
  });

  it("does not recommend retry_same for timeout when retry budget is exhausted", () => {
    const decision = decide(report({ failureKind: "timeout" }), {
      maxRetries: 2,
      retryCount: 2,
    });

    expect(decision).toMatchObject({
      action: "move_blocked",
      productLabel: "Retry limit reached",
      retryPolicy: {
        canRetry: false,
        exhaustedReason: "Retry limit reached",
      },
    });
    expect(decision.recommendedActions).not.toContain("retry_same");
  });

  it("recommends retry_same for tool failure only while retry budget remains", () => {
    expect(
      decide(report({ failureKind: "tool_failure" }), {
        maxRetries: 1,
        retryCount: 0,
      }),
    ).toMatchObject({
      action: "retry_same",
      productLabel: "Retry available",
    });
    expect(
      decide(report({ failureKind: "tool_failure" }), {
        maxRetries: 1,
        retryCount: 1,
      }),
    ).toMatchObject({
      action: "move_blocked",
      productLabel: "Retry limit reached",
    });
  });

  it("requests Workspace Agent assistance for missing context by default", () => {
    const decision = decide(
      report({
        attemptId: "attempt-1",
        evidenceSummary: "The worker needs a product decision.",
        failureKind: "missing_context",
        shortReason: "context needed",
      }),
    );

    expect(decision).toMatchObject({
      action: "request_workspace_agent_assistance",
      assistanceRequest: {
        attemptId: "attempt-1",
        availableActions: expect.arrayContaining([
          "request_workspace_agent_assistance",
          "request_human_input",
          "retry_with_modified_prompt",
          "move_blocked",
        ]),
        evidenceSummary: "The worker needs a product decision.",
        reasonKind: "missing_context",
        recommendedAction: "request_workspace_agent_assistance",
        shortReason: "context needed",
        taskId: "task-1",
      },
      productLabel: "Ask Workspace Agent",
    });
  });

  it("can request human input for missing context without Workspace Agent runtime", () => {
    expect(
      decide(report({ failureKind: "missing_context" }), {
        preferWorkspaceAgentAssistance: false,
      }),
    ).toMatchObject({
      action: "request_human_input",
      assistanceRequest: undefined,
      humanStatus: { status: "needs_decision", text: "Needs decision" },
      productLabel: "Needs decision",
    });
  });

  it("marks rollback proposal destructive and approval-gated without executing rollback", () => {
    const decision = proposeSmartQueueRollbackAttemptDecision({
      maxRetries: 1,
      report: report({
        failureKind: "validation_failure",
        suggestedActions: ["rollback_attempt_proposal"],
      }),
      retryCount: 1,
    });

    expect(decision).toMatchObject({
      action: "rollback_attempt_proposal",
      destructive: true,
      productLabel: "Needs decision: rollback proposal",
      recommendedActions: ["rollback_attempt_proposal"],
      requiresOperatorApproval: true,
      sideEffects: {
        wouldRollback: false,
      },
    });
  });

  it("requests human input for unknown failure", () => {
    expect(
      decide(
        report({
          failureKind: "unknown",
          shortReason: "worker stopped without a classified failure",
        }),
      ),
    ).toMatchObject({
      action: "request_human_input",
      humanStatus: { status: "needs_decision", text: "Needs decision" },
      productLabel: "Needs decision",
      recommendedActions: ["request_human_input"],
      shortReason: "worker stopped without a classified failure",
    });
  });

  it("keeps product-facing labels stable and hides internal enum names", () => {
    const decisions = [
      decide(report({ failureKind: "validation_failure" })),
      decide(report({ failureKind: "missing_config" })),
      decide(report({ failureKind: "dependency_failed" })),
      decide(report({ failureKind: "dirty_worktree" })),
      decide(report({ failureKind: "timeout" }), {
        maxRetries: 1,
        retryCount: 0,
      }),
      decide(report({ failureKind: "timeout" }), {
        maxRetries: 0,
        retryCount: 0,
      }),
      decide(report({ failureKind: "missing_context" })),
    ];

    expect(decisions.map((decision) => decision.productLabel)).toEqual([
      "Needs decision: validation failed",
      "Blocked: missing config",
      "Blocked: dependency failed",
      "Blocked: dirty workspace",
      "Retry available",
      "Retry limit reached",
      "Ask Workspace Agent",
    ]);
    for (const decision of decisions) {
      expect(decision.productLabel).not.toMatch(/_/);
      expect(decision.humanStatus.text).not.toMatch(/_/);
    }
  });

  it("returns decision proposals only and does not execute side effects", () => {
    const decision = decide(report({ failureKind: "timeout" }), {
      maxRetries: 3,
      retryCount: 0,
    });

    expect(decision.sideEffects).toEqual({
      wouldCallWorkspaceAgent: false,
      wouldExecuteRetry: false,
      wouldMutateQueue: false,
      wouldRollback: false,
      wouldStartWorker: false,
    });
    expect("execute" in decision).toBe(false);
    expect("run" in decision).toBe(false);
    expect("workspaceApi" in decision).toBe(false);
    expect("tauri" in decision).toBe(false);
  });
});

function decide(
  workerReport: SmartQueueWorkerReport,
  overrides: Omit<Partial<SmartQueueDecisionInput>, "report"> = {},
): SmartQueueCoordinatorDecision {
  return decideSmartQueueCoordinatorAction({
    maxRetries: 0,
    retryCount: 0,
    ...overrides,
    report: workerReport,
  });
}

function report(
  overrides: Partial<SmartQueueWorkerReport> & {
    failureKind: SmartQueueFailureKind;
  },
): SmartQueueWorkerReport {
  return {
    evidenceSummary: "Worker report evidence.",
    shortReason: "worker report",
    stage: "execution",
    taskId: "task-1",
    ...overrides,
  };
}
