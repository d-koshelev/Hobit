import {
  capValidationOutput,
  normalizeValidationCommandSpec,
  summarizeValidationResult,
} from "./validationModel";
import type {
  NormalizedValidationCommandSpec,
  ValidationCommandResult,
  ValidationCommandSpec,
  ValidationEvidence,
  ValidationResultSummary,
  ValidationRunRequest,
  ValidationRunStatus,
  ValidationSuiteResult,
} from "./validationTypes";

export type ValidationExecutorStatus =
  | "completed"
  | "failed_to_start"
  | "timed_out"
  | "cancelled";

export interface ValidationExecutorCapabilities {
  available: boolean;
  unavailableReason?: string;
  supportsTimeout: boolean;
  supportsCancellation: boolean;
}

export interface ValidationExecutorResult {
  status: ValidationExecutorStatus;
  exitCode?: number | null;
  stdout?: string;
  stderr?: string;
  stdoutTruncated?: boolean;
  stderrTruncated?: boolean;
  durationMs?: number;
  errorMessage?: string;
}

export interface ValidationCommandExecutor {
  capabilities: ValidationExecutorCapabilities;
  execute: (
    command: NormalizedValidationCommandSpec,
    request: ValidationRunRequest,
  ) => Promise<ValidationExecutorResult>;
}

export interface ValidationRunnerOutput {
  result: ValidationSuiteResult;
  evidence: ValidationEvidence[];
  summary: ValidationResultSummary;
  unavailable: boolean;
}

export interface ValidationRunner {
  available: boolean;
  run: (request: ValidationRunRequest) => Promise<ValidationRunnerOutput>;
  unavailableReason?: string;
}

interface ValidationRunnerOptions {
  executor: ValidationCommandExecutor;
  now?: () => string;
  nextEvidenceId?: (command: NormalizedValidationCommandSpec, index: number) => string;
}

const DEFAULT_UNAVAILABLE_REASON = "Validation execution is unavailable in this runtime.";

export const createValidationRunner = ({
  executor,
  now = () => new Date().toISOString(),
  nextEvidenceId = (_command, index) => `validation-evidence-${index + 1}`,
}: ValidationRunnerOptions): ValidationRunner => ({
  available: executor.capabilities.available,
  unavailableReason: executor.capabilities.unavailableReason,
  run: async (request) => {
    if (!executor.capabilities.available) {
      return unavailableResult(request, executor.capabilities.unavailableReason, now, nextEvidenceId);
    }

    const startedAt = now();
    const commandResults: ValidationCommandResult[] = [];
    const evidence: ValidationEvidence[] = [];
    const suiteWarnings: string[] = [];
    const suiteErrors: string[] = [];
    const commands = request.suite.commands.map(normalizeValidationCommandSpec);

    if (!executor.capabilities.supportsCancellation) {
      suiteWarnings.push("Validation cancellation is unsupported by this runner adapter.");
    }

    for (const [index, command] of commands.entries()) {
      const warnings = commandWarnings(command, executor.capabilities);
      const blockedReason = blockedCommandReason(command);
      const commandStartedAt = now();
      const commandResult = blockedReason
        ? blockedCommandResult(command, commandStartedAt, now(), warnings, blockedReason)
        : await executeCommand(command, request, executor, commandStartedAt, now(), warnings);

      commandResults.push(commandResult);
      evidence.push(commandEvidence(request, command, commandResult, nextEvidenceId(command, index)));

      if (request.suite.stopOnFirstFailure && !commandPassed(commandResult)) {
        suiteWarnings.push("Validation suite stopped after first failed command.");
        break;
      }
    }

    const result: ValidationSuiteResult = {
      runId: request.runId,
      queueItemId: request.queueItemId,
      suiteId: request.suite.id,
      status: statusFromCommands(commandResults),
      startedAt,
      completedAt: now(),
      commandResults,
      warnings: suiteWarnings,
      errors: suiteErrors,
    };

    return {
      result,
      evidence,
      summary: summarizeValidationResult(result, evidence),
      unavailable: false,
    };
  },
});

export const createUnavailableValidationRunner = (
  reason = DEFAULT_UNAVAILABLE_REASON,
): ValidationRunner =>
  createValidationRunner({
    executor: {
      capabilities: {
        available: false,
        unavailableReason: reason,
        supportsTimeout: false,
        supportsCancellation: false,
      },
      execute: async () => ({
        status: "failed_to_start",
        errorMessage: reason,
      }),
    },
  });

const executeCommand = async (
  command: NormalizedValidationCommandSpec,
  request: ValidationRunRequest,
  executor: ValidationCommandExecutor,
  startedAt: string,
  completedAt: string,
  warnings: string[],
): Promise<ValidationCommandResult> => {
  const output = await executor.execute(command, request);
  const status = commandStatus(command, output);
  const errorMessage = output.errorMessage;
  const errors = errorMessage ? [errorMessage] : [];

  return {
    commandId: command.id,
    title: command.title,
    status,
    exitCode: output.exitCode ?? null,
    allowedExitCodes: command.allowedExitCodes,
    startedAt,
    completedAt,
    durationMs: output.durationMs,
    cwd: command.cwd,
    stdout: cappedExecutorOutput(output.stdout, command.stdoutCapBytes, output.stdoutTruncated),
    stderr: cappedExecutorOutput(output.stderr, command.stderrCapBytes, output.stderrTruncated),
    warnings,
    errors,
  };
};

const unavailableResult = (
  request: ValidationRunRequest,
  reason = DEFAULT_UNAVAILABLE_REASON,
  now: () => string,
  nextEvidenceId: (command: NormalizedValidationCommandSpec, index: number) => string,
): ValidationRunnerOutput => {
  const startedAt = now();
  const commandResults = request.suite.commands.map((commandSpec, index) => {
    const command = normalizeValidationCommandSpec(commandSpec);
    return blockedCommandResult(command, startedAt, now(), [], reason);
  });
  const evidence = request.suite.commands.map((commandSpec, index) => {
    const command = normalizeValidationCommandSpec(commandSpec);
    return commandEvidence(request, command, commandResults[index]!, nextEvidenceId(command, index));
  });
  const result: ValidationSuiteResult = {
    runId: request.runId,
    queueItemId: request.queueItemId,
    suiteId: request.suite.id,
    status: "needs_review",
    startedAt,
    completedAt: now(),
    commandResults,
    warnings: [reason],
    errors: [reason],
  };

  return {
    result,
    evidence,
    summary: summarizeValidationResult(result, evidence),
    unavailable: true,
  };
};

const blockedCommandResult = (
  command: NormalizedValidationCommandSpec,
  startedAt: string,
  completedAt: string,
  warnings: string[],
  reason: string,
): ValidationCommandResult => ({
  commandId: command.id,
  title: command.title,
  status: "failed_to_start",
  exitCode: null,
  allowedExitCodes: command.allowedExitCodes,
  startedAt,
  completedAt,
  durationMs: 0,
  cwd: command.cwd,
  stdout: capValidationOutput("", command.stdoutCapBytes),
  stderr: capValidationOutput("", command.stderrCapBytes),
  warnings,
  errors: [reason],
});

const commandEvidence = (
  request: ValidationRunRequest,
  command: NormalizedValidationCommandSpec,
  result: ValidationCommandResult,
  evidenceId: string,
): ValidationEvidence => ({
  evidenceId,
  runId: request.runId,
  queueItemId: request.queueItemId,
  commandId: command.id,
  status: result.status,
  exitCode: result.exitCode,
  startedAt: result.startedAt,
  completedAt: result.completedAt,
  durationMs: result.durationMs,
  cwd: command.cwd,
  stdoutPreview: result.stdout,
  stderrPreview: result.stderr,
  warnings: result.warnings,
  errors: result.errors,
});

const commandStatus = (
  command: NormalizedValidationCommandSpec,
  output: ValidationExecutorResult,
): ValidationCommandResult["status"] => {
  if (output.status === "timed_out" || output.status === "failed_to_start" || output.status === "cancelled") {
    return output.status;
  }

  return typeof output.exitCode === "number" && command.allowedExitCodes.includes(output.exitCode)
    ? "passed"
    : "failed";
};

const statusFromCommands = (commands: ValidationCommandResult[]): ValidationRunStatus => {
  if (commands.some((command) => command.status === "cancelled" || command.status === "needs_review")) {
    return "needs_review";
  }

  if (commands.every(commandPassed)) {
    return "passed";
  }

  return "failed";
};

const commandPassed = (command: ValidationCommandResult): boolean =>
  command.status === "passed" &&
  typeof command.exitCode === "number" &&
  command.allowedExitCodes.includes(command.exitCode);

const commandWarnings = (
  command: NormalizedValidationCommandSpec,
  capabilities: ValidationExecutorCapabilities,
): string[] => {
  const warnings = [...command.validationWarnings];

  if (!capabilities.supportsTimeout && command.timeoutMs > 0) {
    warnings.push("Validation timeout is unsupported by this runner adapter.");
  }

  return warnings;
};

const blockedCommandReason = (command: NormalizedValidationCommandSpec): string | null => {
  if (command.validationErrors.length > 0) {
    return command.validationErrors.join(" ");
  }

  if (command.shellCommand && !command.executable) {
    return "Shell validation commands are unsupported by this runner adapter.";
  }

  if (
    command.safetyCategory === "writes_workspace" ||
    command.safetyCategory === "mutates_git" ||
    command.safetyCategory === "destructive" ||
    command.safetyCategory === "unknown"
  ) {
    return `Validation command safety category is not allowed: ${command.safetyCategory}.`;
  }

  const program = executableName(command.executable ?? "");
  if (!isAllowlistedProgram(program)) {
    return `Validation command program is not allowlisted: ${program || "(empty)"}.`;
  }

  if (looksMutatingOrShellLike(program, command.args)) {
    return "Validation command looks mutating or shell-like and was blocked.";
  }

  return null;
};

const cappedExecutorOutput = (
  output: string | null | undefined,
  capBytes: number,
  upstreamTruncated = false,
) => {
  const capped = capValidationOutput(output, capBytes);
  return upstreamTruncated ? { ...capped, truncated: true } : capped;
};

const executableName = (executable: string): string => {
  const normalized = executable.trim().replace(/\\/g, "/");
  return (normalized.split("/").pop() ?? normalized).toLowerCase();
};

const isAllowlistedProgram = (program: string): boolean =>
  [
    "cargo",
    "cargo.exe",
    "dotnet",
    "dotnet.exe",
    "git",
    "git.exe",
    "node",
    "node.exe",
    "npm",
    "npm.cmd",
    "npm.exe",
    "python",
    "python.exe",
    "python3",
    "python3.exe",
  ].includes(program);

const looksMutatingOrShellLike = (program: string, args: string[]): boolean => {
  if (args.some((arg) => ["&&", "||", "|", ";", ">", ">>", "<", "`"].includes(arg))) {
    return true;
  }

  if (program === "git" || program === "git.exe") {
    const subcommand = args.find((arg) => !arg.startsWith("-"))?.toLowerCase();
    return !subcommand || !["diff", "status", "log", "show", "rev-parse", "branch"].includes(subcommand);
  }

  if (program === "npm" || program === "npm.cmd" || program === "npm.exe") {
    const subcommand = args[0]?.toLowerCase();
    return subcommand === "publish" || subcommand === "version" || subcommand === "adduser";
  }

  return false;
};
