import { describe, expect, it } from "vitest";
import {
  buildEvidenceRef,
  capValidationOutput,
  isValidationSuccess,
  normalizeValidationCommandSpec,
  summarizeValidationResult,
} from "./validationModel";
import type {
  ValidationCommandResult,
  ValidationCommandSpec,
  ValidationEvidence,
  ValidationSuiteResult,
} from "./validationTypes";

const commandSpec = (overrides: Partial<ValidationCommandSpec> = {}): ValidationCommandSpec => ({
  id: "typecheck",
  title: "Typecheck",
  executable: "npm.cmd",
  args: ["run", "typecheck", "--prefix", "apps/desktop/frontend"],
  cwd: "C:/repo",
  safetyCategory: "build_or_test",
  source: { kind: "manual" },
  ...overrides,
});

const commandResult = (
  overrides: Partial<ValidationCommandResult> = {},
): ValidationCommandResult => ({
  commandId: "typecheck",
  title: "Typecheck",
  status: "passed",
  exitCode: 0,
  allowedExitCodes: [0],
  cwd: "C:/repo",
  stdout: capValidationOutput("ok"),
  stderr: capValidationOutput(""),
  warnings: [],
  errors: [],
  ...overrides,
});

describe("validation model", () => {
  it("normalizes command specs", () => {
    const normalized = normalizeValidationCommandSpec(
      commandSpec({
        id: " typecheck ",
        title: " Typecheck ",
        executable: " npm.cmd ",
        cwd: " C:/repo ",
        args: undefined,
        allowedExitCodes: [1, 0, 0],
      }),
    );

    expect(normalized).toMatchObject({
      id: "typecheck",
      title: "Typecheck",
      executable: "npm.cmd",
      cwd: "C:/repo",
      args: [],
      allowedExitCodes: [0, 1],
      timeoutMs: 120_000,
      stdoutCapBytes: 12_000,
      stderrCapBytes: 12_000,
      validationErrors: [],
    });
  });

  it("caps stdout and stderr previews", () => {
    const capped = capValidationOutput("abcdef", 3);

    expect(capped).toEqual({
      text: "abc",
      truncated: true,
      originalBytes: 6,
      capBytes: 3,
    });
  });

  it("classifies success and failure", () => {
    expect(isValidationSuccess(commandResult())).toBe(true);
    expect(isValidationSuccess(commandResult({ status: "failed", exitCode: 0 }))).toBe(false);
    expect(isValidationSuccess(commandResult({ status: "passed", exitCode: 1 }))).toBe(false);
  });

  it("handles allowed exit codes", () => {
    expect(
      isValidationSuccess(commandResult({ status: "passed", exitCode: 2, allowedExitCodes: [0, 2] })),
    ).toBe(true);
  });

  it("validates missing commands without executing anything", () => {
    const normalized = normalizeValidationCommandSpec(
      commandSpec({ executable: " ", shellCommand: undefined }),
    );

    expect(normalized.validationErrors).toContain(
      "Validation command requires an executable or shell command.",
    );
  });

  it("does not mutate input command specs", () => {
    const input = commandSpec({
      args: ["run", "test"],
      env: { CI: "1" },
      allowedExitCodes: [0, 1],
      expectedOutputHints: [{ stream: "stdout", includes: "passed" }],
      capabilities: ["run_tests"],
      source: { kind: "prompt_pack", metadata: { pack: "A" } },
    });
    const before = structuredClone(input);
    const normalized = normalizeValidationCommandSpec(input);

    normalized.args.push("--changed");
    normalized.env.CI = "0";
    normalized.allowedExitCodes.push(2);
    normalized.expectedOutputHints[0]!.includes = "mutated";
    normalized.capabilities.push("writes_files");
    normalized.source.metadata!.pack = "B";

    expect(input).toEqual(before);
  });

  it("keeps huge logs out of summaries and uses evidence refs", () => {
    const hugeLog = "x".repeat(20_000);
    const result: ValidationSuiteResult = {
      runId: "run-1",
      suiteId: "suite-1",
      queueItemId: "queue-1",
      status: "passed",
      commandResults: [
        commandResult({
          stdout: capValidationOutput(hugeLog, 20),
          fullLogRef: "widget-log://run-1/typecheck",
        }),
      ],
      warnings: [],
      errors: [],
    };
    const evidence: ValidationEvidence = {
      evidenceId: "evidence-1",
      runId: "run-1",
      queueItemId: "queue-1",
      commandId: "typecheck",
      status: "passed",
      exitCode: 0,
      cwd: "C:/repo",
      stdoutPreview: capValidationOutput(hugeLog, 20),
      stderrPreview: capValidationOutput(""),
      fullLogRef: "widget-log://run-1/typecheck",
      warnings: [],
      errors: [],
    };

    const summary = summarizeValidationResult(result, [evidence]);

    expect(summary.summary).toContain("output previews capped");
    expect(JSON.stringify(summary)).not.toContain(hugeLog);
    expect(summary.evidenceRefs).toEqual([buildEvidenceRef(evidence)]);
  });
});
