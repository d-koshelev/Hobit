import { describe, expect, it } from "vitest";
import {
  buildDefaultDiffReviewChecklist,
  buildDiffReviewPromptBody,
  summarizeDiffReviewRecommendation,
  validateDiffReviewRequest,
  type DiffReviewChecklistItemId,
  type DiffReviewRequest,
} from "./diffReviewModel";

const REQUIRED_ITEM_IDS: DiffReviewChecklistItemId[] = [
  "report_matches_actual_diff",
  "allowed_scope_respected",
  "forbidden_files_not_changed",
  "project_contracts_respected",
  "validation_evidence_exists_and_passed_or_explicit",
  "tests_added_or_updated_where_required",
  "prompt_pack_metadata_preserved",
  "expected_commit_title_available_and_correct",
  "no_hidden_commit_push_finalize",
  "dependent_tasks_unblock_state",
];

describe("diffReviewModel", () => {
  it("builds the required default checklist items", () => {
    const checklist = buildDefaultDiffReviewChecklist();

    expect(checklist.map((item) => item.id)).toEqual(REQUIRED_ITEM_IDS);
    expect(checklist.every((item) => item.required)).toBe(true);
  });

  it("keeps recommendation summaries stable", () => {
    expect(summarizeDiffReviewRecommendation("accept_ready")).toBe(
      "Accept ready: checklist evidence supports coordinator acceptance.",
    );
    expect(summarizeDiffReviewRecommendation("request_changes")).toBe(
      "Request changes: findings require implementation follow-up.",
    );
    expect(summarizeDiffReviewRecommendation("validation_required")).toBe(
      "Validation required: acceptance is blocked until validation evidence is explicit.",
    );
    expect(summarizeDiffReviewRecommendation("blocked")).toBe(
      "Blocked: required review inputs or source context are unavailable.",
    );
    expect(summarizeDiffReviewRecommendation("rollback_required")).toBe(
      "Rollback required: changes appear unsafe enough to require operator rollback discussion.",
    );
    expect(summarizeDiffReviewRecommendation("manual_review_required")).toBe(
      "Manual review required: a human reviewer must inspect unresolved scope, diff, or metadata gaps.",
    );
  });

  it("creates findings when diff, validation, and report evidence are missing", () => {
    const result = validateDiffReviewRequest(diffReviewRequest({
      inputSnapshot: {
        actualDiffSummary: "",
        reportSummary: null,
        validationEvidenceSummary: null,
      },
    }));

    expect(result.findings.map((finding) => finding.id)).toEqual(
      expect.arrayContaining([
        "missing_actual_diff",
        "missing_worker_report",
        "missing_or_unpassed_validation",
      ]),
    );
    expect(result.recommendation).toBe("blocked");
  });

  it("generates a read-only no-code-change prompt by default", () => {
    const prompt = buildDiffReviewPromptBody(diffReviewRequest());

    expect(prompt).toContain("Read-only by default.");
    expect(prompt).toContain("Do not modify code");
    expect(prompt).toContain("Do not modify code, create commits, push, rollback, finalize the source task, unblock dependents, run Terminal commands, or start Queue/Executor work.");
    expect(prompt).toContain("produce a recommendation report only");
  });

  it("does not mutate the input request", () => {
    const request = diffReviewRequest({
      inputSnapshot: {
        actualDiffSummary: "2 files changed",
        allowedScope: ["apps/desktop/frontend/src/workbench/diffReview"],
        forbiddenFiles: ["crates/"],
        reportSummary: "Added model only.",
        validationEvidenceSummary: {
          commandCount: 1,
          errors: [],
          evidenceRefs: [],
          failedCount: 0,
          needsReviewCount: 0,
          passedCount: 1,
          severity: "info",
          status: "passed",
          summary: "typecheck passed",
          title: "Validation passed",
          warnings: [],
        },
      },
    });
    const before = JSON.stringify(request);

    validateDiffReviewRequest(request);
    buildDiffReviewPromptBody(request);

    expect(JSON.stringify(request)).toBe(before);
  });
});

function diffReviewRequest(
  overrides: Partial<DiffReviewRequest> = {},
): DiffReviewRequest {
  return {
    createdAt: "2026-06-10T12:00:00.000Z",
    inputSnapshot: {
      actualDiffSummary: "1 file changed",
      allowedScope: ["apps/desktop/frontend/src/workbench/diffReview"],
      forbiddenFiles: [],
      reportedChangedFiles: [
        "apps/desktop/frontend/src/workbench/diffReview/diffReviewModel.ts",
      ],
      reportSummary: "Added Diff Review model.",
      testsAddedOrUpdated: true,
      validationEvidenceSummary: {
        commandCount: 1,
        errors: [],
        evidenceRefs: [],
        failedCount: 0,
        needsReviewCount: 0,
        passedCount: 1,
        severity: "info",
        status: "passed",
        summary: "relevant tests passed",
        title: "Validation passed",
        warnings: [],
      },
    },
    readonlyByDefault: true,
    requestId: "diff-review-1",
    sourceTask: {
      expectedCommitTitle: "frontend: add diff review model",
      queueItemId: "queue-1",
      title: "Add Diff Review model",
    },
    state: "draft",
    workspaceId: "workspace-1",
    ...overrides,
  };
}
