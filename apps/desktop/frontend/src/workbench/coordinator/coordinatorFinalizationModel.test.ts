import { describe, expect, it } from "vitest";
import type { CoordinatorDecision, CoordinatorFinalizationRequest } from ".";
import {
  buildExpectedCommitTitleFromMetadata,
  shouldUnblockDependents,
  summarizeCoordinatorFinalizationState,
  validateCommitHashFormat,
  validateCoordinatorDecisionRequest,
  validateExpectedCommitTitle,
} from ".";

const allDecisions: CoordinatorDecision[] = [
  "accept_without_commit",
  "accept_with_commit",
  "request_changes",
  "create_follow_up",
  "mark_blocked",
  "mark_failed",
  "rollback_required",
  "manual_review_required",
];

describe("coordinator finalization model", () => {
  it("validates every coordinator decision with expected required fields", () => {
    for (const decision of allDecisions) {
      const result = validateCoordinatorDecisionRequest(requestForDecision(decision));

      expect(result.errors, decision).toEqual([]);
      expect(result.ok, decision).toBe(true);
      expect(result.sourceQueueTaskId, decision).toBe("queue-1");
      expect(result.summary, decision).toBe(
        summarizeCoordinatorFinalizationState(result.state),
      );
    }
  });

  it("requires a valid hash for accept_with_commit", () => {
    const result = validateCoordinatorDecisionRequest({
      ...requestForDecision("accept_with_commit"),
      commit: {
        hash: null,
        title: "frontend: add coordinator finalization model",
      },
    });

    expect(result.ok).toBe(false);
    expect(result.nextAction).toBe("resolve_commit");
    expect(result.errors.map((item) => item.message)).toContain(
      "Accept with commit requires a valid commit hash.",
    );
  });

  it("allows missing hash only for accept_without_commit with an explicit reason", () => {
    const missingReason = validateCoordinatorDecisionRequest({
      ...requestForDecision("accept_without_commit"),
      commit: {
        hash: null,
      },
    });
    const withReason = validateCoordinatorDecisionRequest(
      requestForDecision("accept_without_commit"),
    );
    const nonAccept = validateCoordinatorDecisionRequest({
      ...requestForDecision("request_changes"),
      commit: {
        hash: null,
        title: null,
      },
    });

    expect(missingReason.ok).toBe(false);
    expect(missingReason.errors.map((item) => item.message)).toContain(
      "Accept without commit requires an explicit missing-hash reason.",
    );
    expect(withReason.ok).toBe(true);
    expect(nonAccept.ok).toBe(false);
    expect(nonAccept.errors.map((item) => item.message)).toContain(
      "Missing commit hash is allowed only for accept_without_commit.",
    );
  });

  it("validates short and full SHA formats", () => {
    expect(validateCommitHashFormat("abc1234")).toMatchObject({
      hashFormat: "short_sha",
      normalizedHash: "abc1234",
      valid: true,
    });
    expect(
      validateCommitHashFormat("0123456789abcdef0123456789abcdef01234567"),
    ).toMatchObject({
      hashFormat: "full_sha",
      normalizedHash: "0123456789abcdef0123456789abcdef01234567",
      valid: true,
    });
    expect(validateCommitHashFormat("abc123")).toMatchObject({
      hashFormat: "invalid",
      valid: false,
    });
    expect(validateCommitHashFormat("not-a-sha")).toMatchObject({
      hashFormat: "invalid",
      valid: false,
    });
  });

  it("fails generic commit titles", () => {
    const direct = validateExpectedCommitTitle(
      "fix",
      "frontend: add coordinator finalization model",
    );
    const request = validateCoordinatorDecisionRequest({
      ...requestForDecision("accept_with_commit"),
      commit: {
        hash: "abc1234",
        title: "fix",
      },
    });

    expect(direct.valid).toBe(false);
    expect(direct.titleStatus).toBe("generic");
    expect(request.ok).toBe(false);
    expect(request.commitValidation.titleStatus).toBe("generic");
  });

  it("fails project-name-prefixed repository commit titles", () => {
    const result = validateCoordinatorDecisionRequest({
      ...requestForDecision("accept_with_commit"),
      commit: {
        hash: "abc1234",
        title: "Hobit: frontend: add coordinator finalization model",
      },
    });

    expect(result.ok).toBe(false);
    expect(result.commitValidation.titleStatus).toBe("project_prefixed");
    expect(result.errors.map((item) => item.message)).toContain(
      "Project names belong in reports, not repository commit titles.",
    );
  });

  it("warns when prompt-pack expected title is unavailable for commit validation", () => {
    const result = validateCoordinatorDecisionRequest({
      ...requestForDecision("accept_with_commit"),
      promptPackMetadata: {
        ...metadata(),
        expectedCommitTitle: null,
      },
    });

    expect(result.ok).toBe(true);
    expect(result.warnings.map((item) => item.message)).toContain(
      "Prompt-pack expected commit title is missing.",
    );
  });

  it("builds expected commit title from prompt-pack metadata", () => {
    expect(buildExpectedCommitTitleFromMetadata(metadata())).toBe(
      "frontend: add coordinator finalization model",
    );
    expect(
      buildExpectedCommitTitleFromMetadata({
        ...metadata(),
        expectedCommitTitle: "   ",
      }),
    ).toBeNull();
  });

  it("blocks accepted finalization when validation evidence is missing", () => {
    const result = validateCoordinatorDecisionRequest({
      ...requestForDecision("accept_with_commit"),
      validationEvidence: null,
    });

    expect(result.ok).toBe(false);
    expect(result.nextAction).toBe("run_validation");
    expect(result.errors.map((item) => item.code)).toContain(
      "validation_evidence_missing",
    );
  });

  it("warns instead of blocking non-accepted decisions when validation is missing", () => {
    const result = validateCoordinatorDecisionRequest({
      ...requestForDecision("request_changes"),
      validationEvidence: null,
    });

    expect(result.ok).toBe(true);
    expect(result.warnings.map((item) => item.code)).toContain(
      "validation_evidence_missing",
    );
  });

  it("blocks accept_with_commit when Diff Review is missing", () => {
    const result = validateCoordinatorDecisionRequest({
      ...requestForDecision("accept_with_commit"),
      diffReview: null,
    });

    expect(result.ok).toBe(false);
    expect(result.nextAction).toBe("create_diff_review");
    expect(result.errors.map((item) => item.code)).toContain("diff_review_missing");
  });

  it("warns accept_without_commit when Diff Review is missing", () => {
    const result = validateCoordinatorDecisionRequest({
      ...requestForDecision("accept_without_commit"),
      diffReview: null,
    });

    expect(result.ok).toBe(true);
    expect(result.warnings.map((item) => item.code)).toContain(
      "diff_review_missing",
    );
  });

  it("unblocks dependents only for accepted finalized decisions", () => {
    const accepted = validateCoordinatorDecisionRequest(
      requestForDecision("accept_with_commit"),
    );

    expect(accepted.shouldUnblockDependents).toBe(true);
    expect(
      shouldUnblockDependents({
        decision: "accept_with_commit",
        state: "ready_for_finalization",
      }),
    ).toBe(false);
    expect(
      shouldUnblockDependents({
        decision: "request_changes",
        state: "finalized",
      }),
    ).toBe(false);

    for (const decision of allDecisions.filter(
      (item) => item !== "accept_with_commit" && item !== "accept_without_commit",
    )) {
      expect(
        validateCoordinatorDecisionRequest(requestForDecision(decision))
          .shouldUnblockDependents,
      ).toBe(false);
    }
  });

  it("does not mutate the input request", () => {
    const request = requestForDecision("accept_with_commit");
    const before = JSON.stringify(request);

    validateCoordinatorDecisionRequest(request);

    expect(JSON.stringify(request)).toBe(before);
  });
});

function requestForDecision(
  decision: CoordinatorDecision,
): CoordinatorFinalizationRequest {
  const base: CoordinatorFinalizationRequest = {
    commit:
      decision === "accept_without_commit"
        ? {
            hash: null,
            missingHashReason: "No files changed; validation-only task.",
            title: null,
          }
        : {
            hash: "abc1234",
            title: "frontend: add coordinator finalization model",
          },
    decision,
    dependencyGate: {
      dependentTaskIds: ["queue-2"],
      readyToUnblock: false,
      reason: "Dependents wait for explicit accepted finalization.",
    },
    diffReview: {
      recommendation: "accept_ready",
      reportId: "diff-report-1",
      status: "reported",
      taskId: "diff-review-1",
    },
    operatorNote: "Coordinator reviewed visible evidence.",
    promptPackMetadata: metadata(),
    sourceQueueTask: {
      id: "queue-1",
      status: "review_needed",
      title: "Add coordinator decision model",
    },
    validationEvidence: {
      evidenceRefs: [
        {
          id: "validation-1",
          kind: "validation",
          status: "passed",
        },
      ],
      status: "passed",
      summary: "typecheck and focused tests passed",
    },
  };

  if (decision === "create_follow_up") {
    return {
      ...base,
      commit: {
        hash: "abc1234",
        title: "frontend: add coordinator finalization model",
      },
      dependencyGate: {
        dependentTaskIds: ["follow-up-1"],
        readyToUnblock: false,
        reason: "Follow-up created but not accepted.",
      },
    };
  }

  return base;
}

function metadata() {
  return {
    allowedScope: ["apps/desktop/frontend/src/workbench/coordinator"],
    blockId: "COORDINATOR-DECISION-COMMIT-VALIDATION-MODEL-01",
    dependencies: [],
    expectedCommitTitle: "frontend: add coordinator finalization model",
    forbiddenScope: ["backend", "storage", "schema"],
    packId: "self-dev",
    packName: "Hobit self-development",
    projectName: "Hobit",
    validationCommands: ["npm.cmd run typecheck --prefix apps/desktop/frontend"],
  };
}
