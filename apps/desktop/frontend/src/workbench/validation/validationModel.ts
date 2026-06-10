import type {
  NormalizedValidationCommandSpec,
  ValidationCommandResult,
  ValidationCommandSpec,
  ValidationEvidence,
  ValidationEvidenceRef,
  ValidationOutputPreview,
  ValidationResultSummary,
  ValidationRunStatus,
  ValidationSuiteResult,
} from "./validationTypes";

const DEFAULT_TIMEOUT_MS = 120_000;
const DEFAULT_OUTPUT_CAP_BYTES = 12_000;

const byteLength = (value: string): number => new TextEncoder().encode(value).length;

const trimOptional = (value: string | undefined): string | undefined => {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
};

const uniqNumbers = (values: number[] | undefined): number[] => {
  const source = values && values.length > 0 ? values : [0];
  return Array.from(
    new Set(
      source.filter((value) => Number.isInteger(value) && value >= 0 && value <= 255),
    ),
  ).sort((left, right) => left - right);
};

const positiveOrDefault = (value: number | undefined, fallback: number): number => {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
    return fallback;
  }
  return Math.floor(value);
};

export const normalizeValidationCommandSpec = (
  spec: ValidationCommandSpec,
): NormalizedValidationCommandSpec => {
  const executable = trimOptional(spec.executable);
  const shellCommand = trimOptional(spec.shellCommand);
  const cwd = spec.cwd.trim();
  const validationErrors: string[] = [];
  const validationWarnings: string[] = [];

  if (!spec.id.trim()) {
    validationErrors.push("Validation command id is required.");
  }

  if (!spec.title.trim()) {
    validationErrors.push("Validation command title is required.");
  }

  if (!cwd) {
    validationErrors.push("Validation command working directory is required.");
  }

  if (!executable && !shellCommand) {
    validationErrors.push("Validation command requires an executable or shell command.");
  }

  if (executable && shellCommand) {
    validationWarnings.push(
      "Validation command includes both executable and shell command; executable/args should be preferred.",
    );
  }

  return {
    ...spec,
    id: spec.id.trim(),
    title: spec.title.trim(),
    executable,
    shellCommand,
    cwd,
    args: [...(spec.args ?? [])],
    timeoutMs: positiveOrDefault(spec.timeoutMs, DEFAULT_TIMEOUT_MS),
    env: { ...(spec.env ?? {}) },
    allowedExitCodes: uniqNumbers(spec.allowedExitCodes),
    expectedOutputHints: (spec.expectedOutputHints ?? []).map((hint) => ({ ...hint })),
    capabilities: [...(spec.capabilities ?? [])],
    stdoutCapBytes: positiveOrDefault(spec.stdoutCapBytes, DEFAULT_OUTPUT_CAP_BYTES),
    stderrCapBytes: positiveOrDefault(spec.stderrCapBytes, DEFAULT_OUTPUT_CAP_BYTES),
    source: {
      ...spec.source,
      metadata: spec.source.metadata ? { ...spec.source.metadata } : undefined,
    },
    validationErrors,
    validationWarnings,
  };
};

export const capValidationOutput = (
  output: string | null | undefined,
  capBytes = DEFAULT_OUTPUT_CAP_BYTES,
): ValidationOutputPreview => {
  const text = output ?? "";
  const normalizedCap = positiveOrDefault(capBytes, DEFAULT_OUTPUT_CAP_BYTES);
  const originalBytes = byteLength(text);

  if (originalBytes <= normalizedCap) {
    return {
      text,
      truncated: false,
      originalBytes,
      capBytes: normalizedCap,
    };
  }

  let low = 0;
  let high = text.length;
  while (low < high) {
    const mid = Math.ceil((low + high) / 2);
    if (byteLength(text.slice(0, mid)) <= normalizedCap) {
      low = mid;
    } else {
      high = mid - 1;
    }
  }

  return {
    text: text.slice(0, low),
    truncated: true,
    originalBytes,
    capBytes: normalizedCap,
  };
};

export const isValidationSuccess = (
  result: Pick<ValidationCommandResult, "status" | "exitCode" | "allowedExitCodes">,
): boolean => {
  if (result.status !== "passed") {
    return false;
  }

  if (typeof result.exitCode !== "number") {
    return false;
  }

  return result.allowedExitCodes.includes(result.exitCode);
};

const statusFromCommands = (commands: ValidationCommandResult[]): ValidationRunStatus => {
  if (commands.some((command) => command.status === "running" || command.status === "queued")) {
    return "running";
  }

  if (commands.some((command) => command.status === "cancelled")) {
    return "needs_review";
  }

  if (commands.some((command) => command.status === "needs_review")) {
    return "needs_review";
  }

  if (commands.some((command) => !isValidationSuccess(command))) {
    return "failed";
  }

  return "passed";
};

export const buildEvidenceRef = (evidence: ValidationEvidence): ValidationEvidenceRef => ({
  evidenceId: evidence.evidenceId,
  runId: evidence.runId,
  queueItemId: evidence.queueItemId,
  commandId: evidence.commandId,
  status: evidence.status,
  fullLogRef: evidence.fullLogRef,
});

export const summarizeValidationResult = (
  result: ValidationSuiteResult,
  evidence: ValidationEvidence[] = [],
): ValidationResultSummary => {
  const derivedStatus = result.status === "queued" || result.status === "running"
    ? result.status
    : statusFromCommands(result.commandResults);
  const passedCount = result.commandResults.filter(isValidationSuccess).length;
  const failedCount = result.commandResults.filter(
    (command) =>
      command.status === "failed" ||
      command.status === "failed_to_start" ||
      command.status === "timed_out" ||
      (command.status === "passed" && !isValidationSuccess(command)),
  ).length;
  const needsReviewCount = result.commandResults.filter(
    (command) => command.status === "needs_review" || command.status === "cancelled",
  ).length;
  const truncatedCount = result.commandResults.filter(
    (command) => command.stdout.truncated || command.stderr.truncated,
  ).length;
  const summaryParts = [
    `${passedCount}/${result.commandResults.length} commands passed`,
    failedCount > 0 ? `${failedCount} failed` : "",
    needsReviewCount > 0 ? `${needsReviewCount} need review` : "",
    truncatedCount > 0 ? `${truncatedCount} output previews capped` : "",
  ].filter(Boolean);

  return {
    status: derivedStatus,
    severity: derivedStatus === "passed" ? "info" : derivedStatus === "needs_review" ? "warning" : "error",
    title: `Validation ${derivedStatus.replace("_", " ")}`,
    summary: summaryParts.join("; "),
    commandCount: result.commandResults.length,
    passedCount,
    failedCount,
    needsReviewCount,
    warnings: [...result.warnings],
    errors: [...result.errors],
    evidenceRefs: evidence.map(buildEvidenceRef),
  };
};
