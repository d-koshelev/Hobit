import { describe, expect, it, vi } from "vitest";

import type {
  QueueValidationSuiteRun,
  RunQueueValidationSuiteRequest,
} from "../../workspace/types";
import type { ValidationRunRequest } from "../validation";
import { createQueueValidationRunner } from "./queueValidationRunnerAdapter";

describe("queueValidationRunnerAdapter", () => {
  it("calls the typed Queue validation service once when run explicitly", async () => {
    const runQueueValidationSuite = vi.fn(
      async (
        _request: Omit<RunQueueValidationSuiteRequest, "workspaceId">,
      ): Promise<QueueValidationSuiteRun> => ({
      commandResults: [
        {
          allowedExitCodes: [0],
          commandId: "validation-1",
          commandSummary: [],
          cwd: "C:/repo",
          durationMs: 12,
          errorMessage: null,
          errors: [],
          exitCode: 0,
          status: "passed",
          stderrPreview: "",
          stderrTruncated: false,
          stdoutPreview: "ok",
          stdoutTruncated: false,
          title: "npm.cmd run test -- --run Validation",
          warnings: [],
        },
      ],
      durationMs: 12,
      errors: [],
      evidence: [
        {
          aiContextStatus: "not_used",
          args: ["run", "test", "--", "--run", "Validation"],
          commandId: "validation-1",
          commandLabel: "npm.cmd run test -- --run Validation",
          commandSummary: [],
          cwd: "C:/repo",
          durationMs: 12,
          errorMessage: null,
          evidenceId: "evidence-1",
          exitCode: 0,
          noCommitPush: true,
          noGitMutations: true,
          program: "npm.cmd",
          queueItemId: "queue-item-1",
          source: "prompt_pack",
          status: "passed",
          stderrPreview: "",
          stderrTruncated: false,
          stdoutPreview: "ok",
          stdoutTruncated: false,
          validationRunId: "validation-run-1",
          workspaceId: "workspace-1",
        },
      ],
      noCommitPush: true,
      noGitMutations: true,
      queueItemId: "queue-item-1",
      requestedBySurface: "queue",
      status: "passed",
      taskValidationStatus: "passed",
      validationRunId: "validation-run-1",
      warnings: [],
      workspaceId: "workspace-1",
      }),
    );
    const runner = createQueueValidationRunner({ runQueueValidationSuite });

    expect(runQueueValidationSuite).not.toHaveBeenCalled();

    const output = await runner.run(validationRequest());

    expect(runQueueValidationSuite).toHaveBeenCalledTimes(1);
    expect(runQueueValidationSuite.mock.calls[0]?.[0]).toMatchObject({
      commands: [
        {
          args: ["run", "test", "--", "--run", "Validation"],
          commandId: "validation-1",
          program: "npm.cmd",
          safetyCategory: "build_or_test",
        },
      ],
      cwd: "C:/repo",
      queueItemId: "queue-item-1",
      requestedBySurface: "queue",
    });
    expect(output.unavailable).toBe(false);
    expect(output.summary.status).toBe("passed");
    expect(output.evidence[0]?.stdoutPreview.text).toBe("ok");
  });

  it("does not call the service when the adapter is unavailable", async () => {
    const runQueueValidationSuite = vi.fn(
      async (
        _request: Omit<RunQueueValidationSuiteRequest, "workspaceId">,
      ): Promise<QueueValidationSuiteRun> => {
        throw new Error("should not be called");
      },
    );
    const runner = createQueueValidationRunner({
      available: false,
      runQueueValidationSuite,
      unavailableReason: "Desktop runner unavailable.",
    });

    const output = await runner.run(validationRequest());

    expect(runQueueValidationSuite).not.toHaveBeenCalled();
    expect(output.unavailable).toBe(true);
    expect(output.summary.errors).toContain("Desktop runner unavailable.");
  });
});

function validationRequest(): ValidationRunRequest {
  return {
    createdAt: "2026-01-01T00:00:00.000Z",
    queueItemId: "queue-item-1",
    requestedBySurface: "queue",
    runId: "validation-run-1",
    suite: {
      commands: [
        {
          args: ["run", "test", "--", "--run", "Validation"],
          cwd: "C:/repo",
          executable: "npm.cmd",
          id: "validation-1",
          safetyCategory: "build_or_test",
          source: {
            kind: "prompt_pack",
            label: "Prompt pack",
          },
          title: "npm.cmd run test -- --run Validation",
        },
      ],
      cwd: "C:/repo",
      id: "suite-1",
      source: {
        kind: "prompt_pack",
        label: "Prompt pack",
      },
      title: "Validation",
    },
    workspaceId: "workspace-1",
  };
}
