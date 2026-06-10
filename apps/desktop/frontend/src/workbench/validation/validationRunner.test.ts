import { describe, expect, it, vi } from "vitest";
import { createUnavailableValidationRunner, createValidationRunner } from "./validationRunner";
import type { ValidationCommandExecutor, ValidationExecutorResult } from "./validationRunner";
import type { ValidationCommandSpec, ValidationRunRequest } from "./validationTypes";

const commandSpec = (overrides: Partial<ValidationCommandSpec> = {}): ValidationCommandSpec => ({
  id: "typecheck",
  title: "Typecheck",
  executable: "npm.cmd",
  args: ["run", "typecheck", "--prefix", "apps/desktop/frontend"],
  cwd: "C:/repo",
  safetyCategory: "build_or_test",
  source: { kind: "manual" },
  timeoutMs: 1_000,
  stdoutCapBytes: 4,
  stderrCapBytes: 4,
  ...overrides,
});

const runRequest = (
  commands: ValidationCommandSpec[] = [commandSpec()],
): ValidationRunRequest => ({
  runId: "run-1",
  workspaceId: "workspace-1",
  queueItemId: "queue-1",
  requestedBySurface: "queue",
  suite: {
    id: "suite-1",
    title: "Suite",
    commands,
    stopOnFirstFailure: true,
    source: { kind: "manual" },
  },
  createdAt: "2026-06-10T00:00:00.000Z",
});

const executor = (
  overrides: Partial<ValidationCommandExecutor> = {},
): ValidationCommandExecutor => ({
  capabilities: {
    available: true,
    supportsTimeout: true,
    supportsCancellation: false,
  },
  execute: vi.fn(async (): Promise<ValidationExecutorResult> => ({
    status: "completed",
    exitCode: 0,
    stdout: "ok",
    stderr: "",
    durationMs: 12,
  })),
  ...overrides,
});

describe("validation runner", () => {
  it("does not call the executor during construction", () => {
    const mockExecutor = executor();

    createValidationRunner({ executor: mockExecutor });

    expect(mockExecutor.execute).not.toHaveBeenCalled();
  });

  it("calls the injected executor only on explicit run", async () => {
    const mockExecutor = executor();
    const runner = createValidationRunner({ executor: mockExecutor });

    expect(mockExecutor.execute).not.toHaveBeenCalled();

    const output = await runner.run(runRequest());

    expect(mockExecutor.execute).toHaveBeenCalledTimes(1);
    expect(output.result.status).toBe("passed");
    expect(output.evidence).toHaveLength(1);
    expect(output.evidence[0]).toMatchObject({
      runId: "run-1",
      queueItemId: "queue-1",
      commandId: "typecheck",
      status: "passed",
    });
  });

  it("caps stdout and stderr previews", async () => {
    const mockExecutor = executor({
      execute: vi.fn(async (): Promise<ValidationExecutorResult> => ({
        status: "completed",
        exitCode: 0,
        stdout: "abcdef",
        stderr: "uvwxyz",
      })),
    });
    const runner = createValidationRunner({ executor: mockExecutor });

    const output = await runner.run(runRequest());

    expect(output.result.commandResults[0].stdout).toMatchObject({
      text: "abcd",
      truncated: true,
      originalBytes: 6,
      capBytes: 4,
    });
    expect(output.evidence[0].stderrPreview.truncated).toBe(true);
  });

  it("maps non-zero exits to failed status", async () => {
    const mockExecutor = executor({
      execute: vi.fn(async (): Promise<ValidationExecutorResult> => ({
        status: "completed",
        exitCode: 2,
        stdout: "",
        stderr: "failed",
      })),
    });
    const runner = createValidationRunner({ executor: mockExecutor });

    const output = await runner.run(runRequest());

    expect(output.result.status).toBe("failed");
    expect(output.result.commandResults[0]).toMatchObject({
      status: "failed",
      exitCode: 2,
    });
    expect(output.summary.failedCount).toBe(1);
  });

  it("adds timeout and cancel unsupported warnings", async () => {
    const mockExecutor = executor({
      capabilities: {
        available: true,
        supportsTimeout: false,
        supportsCancellation: false,
      },
    });
    const runner = createValidationRunner({ executor: mockExecutor });

    const output = await runner.run(runRequest());

    expect(output.result.warnings).toContain(
      "Validation cancellation is unsupported by this runner adapter.",
    );
    expect(output.result.commandResults[0].warnings).toContain(
      "Validation timeout is unsupported by this runner adapter.",
    );
  });

  it("blocks unsafe commands without calling the executor", async () => {
    const mockExecutor = executor();
    const runner = createValidationRunner({ executor: mockExecutor });

    const output = await runner.run(
      runRequest([
        commandSpec({
          id: "reset",
          title: "Reset",
          executable: "git",
          args: ["reset", "--hard"],
          safetyCategory: "mutates_git",
        }),
      ]),
    );

    expect(mockExecutor.execute).not.toHaveBeenCalled();
    expect(output.result.status).toBe("failed");
    expect(output.result.commandResults[0].status).toBe("failed_to_start");
    expect(output.result.commandResults[0].errors.join(" ")).toContain(
      "safety category",
    );
  });

  it("returns an explicit unavailable result", async () => {
    const runner = createUnavailableValidationRunner("Desktop validation bridge unavailable.");

    const output = await runner.run(runRequest());

    expect(output.unavailable).toBe(true);
    expect(output.result.status).toBe("needs_review");
    expect(output.result.errors).toContain("Desktop validation bridge unavailable.");
    expect(output.evidence[0]).toMatchObject({
      status: "failed_to_start",
      commandId: "typecheck",
    });
  });
});
