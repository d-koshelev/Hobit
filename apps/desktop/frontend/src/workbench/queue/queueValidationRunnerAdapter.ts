import type {
  QueueValidationCommandRun,
  QueueValidationSuiteRun,
  RunQueueValidationSuiteRequest,
} from "../../workspace/types";
import {
  capValidationOutput,
  normalizeValidationCommandSpec,
  summarizeValidationResult,
  type ValidationCommandResult,
  type ValidationCommandStatus,
  type ValidationEvidence,
  type ValidationOutputPreview,
  type ValidationRunner,
  type ValidationRunnerOutput,
  type ValidationRunRequest,
  type ValidationRunStatus,
} from "../validation";

type QueueValidationRunnerAdapterOptions = {
  available?: boolean;
  runQueueValidationSuite: (
    request: Omit<RunQueueValidationSuiteRequest, "workspaceId">,
  ) => Promise<QueueValidationSuiteRun>;
  unavailableReason?: string;
};

const DEFAULT_UNAVAILABLE_REASON =
  "Queue validation runner is only available in the Tauri desktop shell. Browser fallback cannot run local validation commands.";

export function createQueueValidationRunner({
  available = true,
  runQueueValidationSuite,
  unavailableReason = DEFAULT_UNAVAILABLE_REASON,
}: QueueValidationRunnerAdapterOptions): ValidationRunner {
  return {
    available,
    unavailableReason: available ? undefined : unavailableReason,
    run: async (request) => {
      if (!available) {
        return unavailableOutput(request, unavailableReason);
      }

      try {
        const response = await runQueueValidationSuite(
          queueValidationSuiteRequest(request),
        );

        return runnerOutputFromQueueValidation(request, response);
      } catch (error) {
        return unavailableOutput(request, errorToMessage(error));
      }
    },
  };
}

function queueValidationSuiteRequest(
  request: ValidationRunRequest,
): Omit<RunQueueValidationSuiteRequest, "workspaceId"> {
  const commands = request.suite.commands.map((command) => {
    const normalized = normalizeValidationCommandSpec(command);
    return {
      args: normalized.args,
      allowedExitCodes: normalized.allowedExitCodes,
      commandId: normalized.id,
      cwd: normalized.cwd,
      program: normalized.executable ?? "",
      safetyCategory: normalized.safetyCategory,
      source: normalized.source.kind,
      stderrCapBytes: normalized.stderrCapBytes,
      stdoutCapBytes: normalized.stdoutCapBytes,
      timeoutMs: normalized.timeoutMs > 0 ? normalized.timeoutMs : null,
      title: normalized.title,
    };
  });

  return {
    commands,
    cwd: request.suite.cwd ?? commands[0]?.cwd ?? "",
    queueItemId: request.queueItemId ?? "",
    requestedBySurface: request.requestedBySurface,
    stopOnFirstFailure: request.suite.stopOnFirstFailure ?? false,
  };
}

function runnerOutputFromQueueValidation(
  request: ValidationRunRequest,
  response: QueueValidationSuiteRun,
): ValidationRunnerOutput {
  const completedAt = new Date().toISOString();
  const commandResults = response.commandResults.map(commandResultFromQueue);
  const evidence = response.evidence.map((item): ValidationEvidence => ({
    commandId: item.commandId,
    cwd: item.cwd,
    durationMs: item.durationMs,
    errors: [
      ...(item.errorMessage ? [item.errorMessage] : []),
      ...item.commandSummary,
    ],
    evidenceId: item.evidenceId,
    exitCode: item.exitCode,
    queueItemId: item.queueItemId,
    runId: item.validationRunId,
    status: commandStatus(item.status),
    stderrPreview: outputPreview(
      item.stderrPreview,
      commandCap(request, item.commandId, "stderr"),
      item.stderrTruncated,
    ),
    stdoutPreview: outputPreview(
      item.stdoutPreview,
      commandCap(request, item.commandId, "stdout"),
      item.stdoutTruncated,
    ),
    warnings: [
      ...(item.noGitMutations ? [] : ["Validation runner did not confirm no Git mutations."]),
      ...(item.noCommitPush ? [] : ["Validation runner did not confirm no commit or push."]),
    ],
  }));
  const result = {
    commandResults,
    durationMs: response.durationMs,
    errors: response.errors,
    completedAt,
    queueItemId: response.queueItemId,
    runId: response.validationRunId,
    startedAt: completedAt,
    status: runStatus(response.status),
    suiteId: request.suite.id,
    warnings: response.warnings,
  };

  return {
    evidence,
    result,
    summary: summarizeValidationResult(result, evidence),
    unavailable: false,
  };
}

function commandResultFromQueue(
  command: QueueValidationCommandRun,
): ValidationCommandResult {
  return {
    allowedExitCodes: command.allowedExitCodes,
    commandId: command.commandId,
    cwd: command.cwd,
    durationMs: command.durationMs,
    errors: [...(command.errorMessage ? [command.errorMessage] : []), ...command.errors],
    exitCode: command.exitCode,
    stderr: outputPreview(
      command.stderrPreview,
      2_000,
      command.stderrTruncated,
    ),
    stdout: outputPreview(
      command.stdoutPreview,
      2_000,
      command.stdoutTruncated,
    ),
    status: commandStatus(command.status),
    title: command.title,
    warnings: command.warnings,
  };
}

function outputPreview(
  output: string,
  capBytes: number,
  upstreamTruncated: boolean,
): ValidationOutputPreview {
  const capped = capValidationOutput(output, capBytes);
  return upstreamTruncated ? { ...capped, truncated: true } : capped;
}

function unavailableOutput(
  request: ValidationRunRequest,
  reason: string,
): ValidationRunnerOutput {
  const now = new Date().toISOString();
  const commandResults = request.suite.commands.map((commandSpec) => {
    const command = normalizeValidationCommandSpec(commandSpec);
    return {
      allowedExitCodes: command.allowedExitCodes,
      commandId: command.id,
      cwd: command.cwd,
      durationMs: 0,
      errors: [reason],
      exitCode: null,
      stderr: capValidationOutput("", command.stderrCapBytes),
      stdout: capValidationOutput("", command.stdoutCapBytes),
      status: "failed_to_start" as const,
      title: command.title,
      warnings: [],
    };
  });
  const evidence = request.suite.commands.map((commandSpec, index) => {
    const command = normalizeValidationCommandSpec(commandSpec);
    const commandResult = commandResults[index]!;
    return {
      commandId: command.id,
      cwd: command.cwd,
      durationMs: 0,
      errors: commandResult.errors,
      evidenceId: `queue-validation-unavailable-${index + 1}`,
      exitCode: null,
      queueItemId: request.queueItemId,
      runId: request.runId,
      status: "failed_to_start" as const,
      stderrPreview: commandResult.stderr,
      stdoutPreview: commandResult.stdout,
      warnings: [],
    };
  });
  const result = {
    commandResults,
    completedAt: now,
    errors: [reason],
    queueItemId: request.queueItemId,
    runId: request.runId,
    startedAt: now,
    status: "needs_review" as const,
    suiteId: request.suite.id,
    warnings: [reason],
  };

  return {
    evidence,
    result,
    summary: summarizeValidationResult(result, evidence),
    unavailable: true,
  };
}

function commandStatus(status: string): ValidationCommandStatus {
  if (
    status === "queued" ||
    status === "running" ||
    status === "passed" ||
    status === "failed" ||
    status === "failed_to_start" ||
    status === "timed_out" ||
    status === "cancelled" ||
    status === "needs_review"
  ) {
    return status;
  }

  return "needs_review";
}

function runStatus(status: string): ValidationRunStatus {
  if (
    status === "queued" ||
    status === "running" ||
    status === "passed" ||
    status === "failed" ||
    status === "needs_review" ||
    status === "cancelled"
  ) {
    return status;
  }

  return "needs_review";
}

function commandCap(
  request: ValidationRunRequest,
  commandId: string,
  stream: "stdout" | "stderr",
) {
  const command = request.suite.commands.find(
    (candidate) => candidate.id === commandId,
  );
  return stream === "stdout"
    ? command?.stdoutCapBytes ?? 2_000
    : command?.stderrCapBytes ?? 2_000;
}

function errorToMessage(error: unknown) {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  if (typeof error === "string" && error.trim()) {
    return error;
  }

  return "Queue validation runner failed before validation evidence could be collected.";
}
