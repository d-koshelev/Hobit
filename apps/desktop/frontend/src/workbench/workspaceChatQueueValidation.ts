import type { AgentQueueTask } from "../workspace/types";
import { getQueuePromptPackImportMetadata } from "./promptPack/queuePromptPackMetadata";
import type {
  ValidationCommandSpec,
  ValidationRunner,
  ValidationRunRequest,
  ValidationSuiteSpec,
} from "./validation";

export type WorkspaceChatValidationAvailability = {
  canRequest: boolean;
  disabledReason: string | null;
  hasKnownCommands: boolean;
};

export type WorkspaceChatValidationSuiteDraft = {
  commands: ValidationCommandSpec[];
  suite: ValidationSuiteSpec;
  warnings: string[];
};

export function workspaceChatValidationAvailability({
  queueBridgeAvailable,
  runner,
  task,
}: {
  queueBridgeAvailable: boolean;
  runner?: ValidationRunner | null;
  task: AgentQueueTask;
}): WorkspaceChatValidationAvailability {
  const hasKnownCommands = validationCommandTextsForQueueTask(task).length > 0;
  const runnerUnavailableReason = validationRunnerUnavailableReason(
    runner,
    "Workspace Chat",
  );

  if (runnerUnavailableReason) {
    return {
      canRequest: false,
      disabledReason: runnerUnavailableReason,
      hasKnownCommands,
    };
  }

  if (!queueBridgeAvailable) {
    return {
      canRequest: false,
      disabledReason:
        "Queue update bridge is unavailable, so validation evidence cannot be attached.",
      hasKnownCommands,
    };
  }

  if (!task.executionWorkspace?.trim()) {
    return {
      canRequest: false,
      disabledReason:
        "Validation needs an execution workspace on the Queue task.",
      hasKnownCommands,
    };
  }

  if (!hasKnownCommands) {
    return {
      canRequest: false,
      disabledReason:
        "No validation commands or suite are available for this Queue task.",
      hasKnownCommands,
    };
  }

  return {
    canRequest: true,
    disabledReason: null,
    hasKnownCommands,
  };
}

export function buildWorkspaceChatValidationSuiteDraft({
  manualCommand,
  task,
}: {
  manualCommand?: string;
  task: AgentQueueTask;
}): WorkspaceChatValidationSuiteDraft {
  const commandTexts = uniqueNonEmpty([
    ...validationCommandTextsForQueueTask(task),
    manualCommand?.trim() ?? "",
  ]);
  const commands = commandTexts.map((commandText, index) =>
    validationCommandSpecFromText({
      commandText,
      index,
      task,
    }),
  );

  return {
    commands,
    suite: {
      commands,
      cwd: task.executionWorkspace?.trim(),
      id: `workspace-chat-validation-${task.queueItemId}`,
      source: {
        kind: "manual",
        label: "Workspace Chat validation request",
      },
      stopOnFirstFailure: false,
      title: `Workspace Chat validation for ${task.title}`,
    },
    warnings: commandTexts.length === 0
      ? ["No validation commands are selected."]
      : [],
  };
}

export function buildWorkspaceChatValidationRunRequest({
  createdAt,
  manualCommand,
  runId,
  task,
}: {
  createdAt: string;
  manualCommand?: string;
  runId: string;
  task: AgentQueueTask;
}): ValidationRunRequest {
  return buildQueueTaskValidationRunRequest({
    createdAt,
    manualCommand,
    requestedBySurface: "workspace_chat",
    runId,
    task,
  });
}

export function buildQueueTaskValidationRunRequest({
  createdAt,
  manualCommand,
  requestedBySurface,
  runId,
  task,
}: {
  createdAt: string;
  manualCommand?: string;
  requestedBySurface: ValidationRunRequest["requestedBySurface"];
  runId: string;
  task: AgentQueueTask;
}): ValidationRunRequest {
  return {
    createdAt,
    queueItemId: task.queueItemId,
    requestedBySurface,
    runId,
    suite: buildWorkspaceChatValidationSuiteDraft({ manualCommand, task }).suite,
    workspaceId: task.workspaceId,
  };
}

export function validationRunnerUnavailableReason(
  runner: ValidationRunner | null | undefined,
  surfaceLabel: string,
) {
  if (!runner) {
    return `Validation runner is unavailable in this ${surfaceLabel} surface.`;
  }

  if (!runner.available) {
    return (
      runner.unavailableReason ??
      `Validation runner is unavailable in this ${surfaceLabel} surface.`
    );
  }

  return null;
}

export function validationCommandTextsForQueueTask(task: AgentQueueTask): string[] {
  const promptPackMetadata = getQueuePromptPackImportMetadata(task);
  const latestReport = task.workerExecutionReports?.[
    task.workerExecutionReports.length - 1
  ];

  return uniqueNonEmpty([
    ...(promptPackMetadata?.validationCommands ?? []),
    ...(task.executionPlanPreview?.expectedValidationCommands ?? []),
    ...(latestReport?.validationCommandsSuggested ?? []),
  ]);
}

function validationCommandSpecFromText({
  commandText,
  index,
  task,
}: {
  commandText: string;
  index: number;
  task: AgentQueueTask;
}): ValidationCommandSpec {
  const parsed = parseCommandLine(commandText);
  const source = {
    kind: "manual" as const,
    label: "Workspace Chat validation request",
    metadata: {
      queueItemId: task.queueItemId,
      rawCommand: commandText,
    },
  };

  if (!parsed || parsed.tokens.length === 0) {
    return {
      cwd: task.executionWorkspace ?? "",
      id: `workspace-chat-validation-${index + 1}`,
      safetyCategory: "unknown",
      shellCommand: commandText,
      source,
      stderrCapBytes: 2_000,
      stdoutCapBytes: 2_000,
      title: commandTitle(commandText, index),
    };
  }

  const [executable, ...args] = parsed.tokens;

  return {
    args,
    cwd: task.executionWorkspace ?? "",
    executable,
    id: `workspace-chat-validation-${index + 1}`,
    safetyCategory: inferSafetyCategory(executable, args),
    source,
    stderrCapBytes: 2_000,
    stdoutCapBytes: 2_000,
    title: commandTitle(commandText, index),
  };
}

function parseCommandLine(commandText: string): { tokens: string[] } | null {
  const tokens: string[] = [];
  let current = "";
  let quote: "\"" | "'" | null = null;

  for (const char of commandText.trim()) {
    if ((char === "\"" || char === "'") && quote === null) {
      quote = char;
      continue;
    }

    if (char === quote) {
      quote = null;
      continue;
    }

    if (/\s/.test(char) && quote === null) {
      if (current) {
        tokens.push(current);
        current = "";
      }
      continue;
    }

    current += char;
  }

  if (quote !== null) {
    return null;
  }

  if (current) {
    tokens.push(current);
  }

  return { tokens };
}

function inferSafetyCategory(
  executable: string,
  args: string[],
): ValidationCommandSpec["safetyCategory"] {
  const program = executableName(executable);
  const firstArg = args[0]?.toLowerCase() ?? "";
  const joinedArgs = args.join(" ").toLowerCase();

  if (program === "git" || program === "git.exe") {
    return ["diff", "status", "log", "show", "rev-parse", "branch"].includes(firstArg)
      ? "read_only"
      : "mutates_git";
  }

  if (program === "cargo" || program === "cargo.exe") {
    return firstArg === "fmt" ? "writes_workspace" : "build_or_test";
  }

  if (program === "npm" || program === "npm.cmd" || program === "npm.exe") {
    return joinedArgs.includes("publish") || joinedArgs.includes(" version ")
      ? "unknown"
      : "build_or_test";
  }

  if (
    program === "node" ||
    program === "node.exe" ||
    program === "python" ||
    program === "python.exe" ||
    program === "python3" ||
    program === "python3.exe" ||
    program === "dotnet" ||
    program === "dotnet.exe"
  ) {
    return "build_or_test";
  }

  return "unknown";
}

function executableName(executable: string) {
  const normalized = executable.trim().replace(/\\/g, "/");
  return (normalized.split("/").pop() ?? normalized).toLowerCase();
}

function commandTitle(commandText: string, index: number) {
  return commandText.trim() || `Validation command ${index + 1}`;
}

function uniqueNonEmpty(values: string[]) {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const value of values) {
    const trimmed = value.trim();
    const key = trimmed.toLowerCase();

    if (!trimmed || seen.has(key)) {
      continue;
    }

    seen.add(key);
    result.push(trimmed);
  }

  return result;
}
