import { describe, expect, it, vi } from "vitest";
import type {
  AgentQueueTask,
  AgentQueueWorkerExecutionReport,
  WorkspaceGitDiffSummary,
} from "../../workspace/types";
import * as workspaceGitApi from "../../workspace/workspaceGitApi";
import {
  resolveDiffReviewInputSnapshot,
  summarizeDiffReviewInputAvailability,
} from "./diffReviewInputSnapshotResolver";

vi.mock("../../workspace/workspaceGitApi", () => ({
  getWorkspaceGitDiffSummary: vi.fn(),
  getWorkspaceGitStatus: vi.fn(),
}));

describe("diffReviewInputSnapshotResolver", () => {
  it("resolves a full snapshot from task, report, validation, prompt-pack, and diff metadata", () => {
    const task = queueTask({
      workerExecutionReports: [
        implementationReport(),
        validationReport({ validationResult: "passed" }),
      ],
    });
    const resolution = resolveDiffReviewInputSnapshot({
      diffSummary: gitDiffSummary(),
      sourceTask: task,
      testsAddedOrUpdated: true,
    });

    expect(resolution.sourceTask).toMatchObject({
      expectedCommitTitle: "frontend: add snapshot resolver",
      promptPackBlockId: "002",
      promptPackId: "pack-1",
      queueItemId: "queue-1",
      reportId: "report-1",
      status: "review_needed",
      title: "Implement snapshot resolver",
    });
    expect(resolution.inputSnapshot.reportSummary).toBe(
      "Implemented resolver and tests.",
    );
    expect(resolution.inputSnapshot.agentFinalResponse).toContain(
      "Final response: resolver added.",
    );
    expect(resolution.inputSnapshot.actualDiffSummary).toContain(
      "2 changed file(s)",
    );
    expect(resolution.inputSnapshot.reportedChangedFiles).toEqual([
      "apps/desktop/frontend/src/workbench/diffReview/diffReviewInputSnapshotResolver.ts",
    ]);
    expect(resolution.inputSnapshot.validationEvidenceSummary).toMatchObject({
      status: "passed",
      summary: "Validation passed.",
    });
    expect(resolution.availability.warnings).toEqual([]);
  });

  it("warns explicitly when validation evidence is missing", () => {
    const resolution = resolveDiffReviewInputSnapshot({
      fileChangeSummary: "1 changed file from existing typed source.",
      sourceTask: queueTask({
        workerExecutionReports: [implementationReport()],
      }),
    });

    expect(resolution.availability.warnings).toContain(
      "Validation evidence is missing; the reviewer must request or inspect validation before acceptance.",
    );
    expect(resolution.availability.checklistFindings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          checklistItemId: "validation_evidence_exists_and_passed_or_explicit",
          id: "input_validation_missing",
          severity: "warning",
        }),
      ]),
    );
  });

  it("warns explicitly when no live diff metadata is available", () => {
    const resolution = resolveDiffReviewInputSnapshot({
      sourceTask: queueTask({
        workerExecutionReports: [
          implementationReport(),
          validationReport({ validationResult: "passed" }),
        ],
      }),
    });

    expect(resolution.inputSnapshot.actualDiffSummary).toBeNull();
    expect(resolution.inputSnapshot.unsupportedStates).toContain(
      "diff unavailable, manual diff required",
    );
    expect(resolution.availability.checklistFindings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          checklistItemId: "report_matches_actual_diff",
          detail: "diff unavailable, manual diff required",
          id: "input_diff_unavailable",
          severity: "warning",
        }),
      ]),
    );
  });

  it("preserves forbidden scope from prompt-pack metadata", () => {
    const resolution = resolveDiffReviewInputSnapshot({
      fileChangeSummary: "No diff command was run; existing typed summary only.",
      sourceTask: queueTask(),
    });

    expect(resolution.inputSnapshot.forbiddenFiles).toEqual([
      "crates/",
      "apps/desktop/src-tauri/",
    ]);
  });

  it("preserves expected commit title from prompt-pack metadata", () => {
    const resolution = resolveDiffReviewInputSnapshot({
      fileChangeSummary: "No diff command was run; existing typed summary only.",
      sourceTask: queueTask(),
    });

    expect(resolution.inputSnapshot.expectedCommitTitle).toBe(
      "frontend: add snapshot resolver",
    );
    expect(resolution.sourceTask.expectedCommitTitle).toBe(
      "frontend: add snapshot resolver",
    );
    expect(
      summarizeDiffReviewInputAvailability(resolution.inputSnapshot)
        .hasExpectedCommitTitle,
    ).toBe(true);
  });

  it("does not execute live Git commands in unit tests", () => {
    resolveDiffReviewInputSnapshot({ sourceTask: queueTask() });

    expect(workspaceGitApi.getWorkspaceGitDiffSummary).not.toHaveBeenCalled();
    expect(workspaceGitApi.getWorkspaceGitStatus).not.toHaveBeenCalled();
  });
});

function queueTask(
  overrides: Partial<AgentQueueTask> = {},
): AgentQueueTask {
  return {
    approvalPolicy: "never",
    assignedExecutorWidgetId: null,
    codexExecutable: "codex",
    createdAt: "2026-06-10T10:00:00.000Z",
    description: [
      "Prompt pack: Diff Review Pack (pack-1)",
      "Prompt item: 002",
    ].join("\n"),
    executionPolicy: "manual",
    executionWorkspace: "C:/repo/hobit",
    itemType: "implementation",
    priority: 2,
    prompt: promptPackPrompt(),
    queueItemId: "queue-1",
    sandbox: "workspace_write",
    status: "review_needed",
    title: "Implement snapshot resolver",
    updatedAt: "2026-06-10T11:00:00.000Z",
    validationStatus: "needs_review",
    workspaceId: "workspace-1",
    ...overrides,
  };
}

function implementationReport(): AgentQueueWorkerExecutionReport {
  return {
    changedFiles: [
      "apps/desktop/frontend/src/workbench/diffReview/diffReviewInputSnapshotResolver.ts",
    ],
    commandsRun: ["npm.cmd run typecheck --prefix apps/desktop/frontend"],
    createdAt: "2026-06-10T10:30:00.000Z",
    errors: [],
    itemId: "queue-1",
    rawReportPreview: "Final response: resolver added.",
    reportId: "report-1",
    reportStatus: "completed",
    summary: "Implemented resolver and tests.",
    validationCommandsSuggested: [
      "npm.cmd run typecheck --prefix apps/desktop/frontend",
    ],
    warnings: [],
    workerId: "worker-1",
  };
}

function validationReport(
  overrides: Partial<AgentQueueWorkerExecutionReport> = {},
): AgentQueueWorkerExecutionReport {
  return {
    changedFiles: [],
    commandsRun: ["typecheck (passed)"],
    createdAt: "2026-06-10T10:40:00.000Z",
    errors: [],
    itemId: "queue-1",
    rawReportPreview: "Validation evidence preview.",
    reportId: "validation-report-1",
    reportStatus: "completed",
    summary: "Validation passed.",
    validationCommandsRun: ["npm.cmd run typecheck --prefix apps/desktop/frontend"],
    validationCommandsSuggested: [],
    validationResult: "passed",
    warnings: [],
    workerId: "queue-validation",
    ...overrides,
  };
}

function gitDiffSummary(): WorkspaceGitDiffSummary {
  return {
    commandSummary: [],
    errorMessage: null,
    files: [
      {
        additions: 120,
        conflicted: false,
        deletions: 0,
        patchPreview: null,
        patchTruncated: false,
        path: "apps/desktop/frontend/src/workbench/diffReview/diffReviewInputSnapshotResolver.ts",
        staged: false,
        status: "modified",
        untracked: false,
        unstaged: true,
      },
      {
        additions: 80,
        conflicted: false,
        deletions: 0,
        patchPreview: null,
        patchTruncated: false,
        path: "apps/desktop/frontend/src/workbench/diffReview/diffReviewInputSnapshotResolver.test.ts",
        staged: false,
        status: "added",
        untracked: true,
        unstaged: false,
      },
    ],
    repoRoot: "C:/repo/hobit",
    status: "ok",
    summary: {
      conflictedCount: 0,
      stagedCount: 0,
      totalAdditions: 200,
      totalDeletions: 0,
      totalFiles: 2,
      unstagedCount: 1,
      untrackedCount: 1,
    },
  };
}

function promptPackPrompt() {
  return [
    "Implement the resolver.",
    "",
    "Prompt pack materialization metadata",
    "Pack: Diff Review Pack (pack-1)",
    "Block id: 002",
    "Expected commit title: frontend: add snapshot resolver",
    "Allowed scope:",
    "- apps/desktop/frontend/src/workbench/diffReview",
    "- apps/desktop/frontend/src/workbench/queue",
    "Forbidden scope:",
    "- crates/",
    "- apps/desktop/src-tauri/",
    "Validation commands:",
    "- npm.cmd run typecheck --prefix apps/desktop/frontend",
    "- npm.cmd run test --prefix apps/desktop/frontend -- --run diffReview",
    "Prompt-pack dependencies: 001",
  ].join("\n");
}
