import type {
  CodexDirectWorkRunRequest,
  CodexDirectWorkStreamSession,
} from "../directWorkStreamSessions";
import { tokenUsageFromDirectWorkStreamEvent } from "../workspaceAgentRunMetadata";
import type {
  DirectWorkApprovalPolicy,
  DirectWorkSandbox,
  DirectWorkStreamEvent,
} from "../../workspace/types";
import type {
  AgentProviderCapabilities,
  AgentRunEvent,
  AgentRunEventKind,
  AgentRunLifecycle,
  AgentRunRequest,
  AgentRunResult,
  AgentTokenUsage,
} from "./agentRuntimeTypes";

export const CODEX_AGENT_PROVIDER_ID = "codex-direct-work";

export type CodexAgentRuntimeLaunchOptions = {
  approvalPolicy?: DirectWorkApprovalPolicy;
  codexExecutable: string;
  codexThreadId?: string | null;
  executionWorkspace: string;
  skipGitRepoCheck?: boolean;
  stderrCapBytes?: number | null;
  stdoutCapBytes?: number | null;
  timeoutMs?: number | null;
  sandbox?: DirectWorkSandbox;
  widgetInstanceId: string;
};

export type CodexAgentRuntimeActions = {
  cancelCodexDirectWorkRun?: (
    widgetInstanceId: string,
    runId: string,
  ) => Promise<unknown>;
  startCodexDirectWorkStream?: (
    widgetInstanceId: string,
    request: CodexDirectWorkRunRequest,
    onEvent: (event: DirectWorkStreamEvent) => void,
    signal?: AbortSignal,
  ) => Promise<CodexDirectWorkStreamSession | null>;
};

export type CodexAgentRuntimeRunHandle = {
  runId: string;
  stopListening: () => void;
  warnings: readonly string[];
};

export type CodexAgentRuntimeAdapter = {
  capabilities: AgentProviderCapabilities;
  cancelRun: (
    widgetInstanceId: string,
    runId: string,
  ) => Promise<{ supported: boolean; warnings: readonly string[] }>;
  startRun: (
    request: AgentRunRequest,
    options: CodexAgentRuntimeLaunchOptions,
    onEvent: (event: AgentRunEvent) => void,
    signal?: AbortSignal,
    onResult?: (result: AgentRunResult) => void,
  ) => Promise<CodexAgentRuntimeRunHandle | AgentRunResult>;
};

export function createCodexProviderCapabilities(options: {
  supportsCancellation?: boolean;
} = {}): AgentProviderCapabilities {
  return {
    approvalPolicy: {
      applyChanges: "never",
      createQueueTasks: "never",
      executeTools: "never",
    },
    defaultMode: "direct",
    displayName: "Codex Direct Work",
    maxPromptChars: null,
    providerId: CODEX_AGENT_PROVIDER_ID,
    sandboxPolicy: {
      filesystem: "approved-workspace",
      network: "provider-runtime-only",
      requiresExplicitWorkspace: true,
    },
    supportedModes: ["direct"],
    supportsCancellation: Boolean(options.supportsCancellation),
    supportsFileChangeSummary: false,
    supportsStreaming: true,
    supportsTokenUsage: true,
    toolPolicy: {
      allowedTools: [],
      mode: "none",
      requiresOperatorApproval: true,
    },
  };
}

export function mapAgentRunRequestToCodexDirectWorkRequest(
  request: AgentRunRequest,
  options: CodexAgentRuntimeLaunchOptions,
): CodexDirectWorkRunRequest {
  return {
    approvalPolicy: options.approvalPolicy ?? "never",
    codexExecutable: options.codexExecutable,
    codexThreadId: options.codexThreadId ?? null,
    operatorPrompt: request.prompt,
    repoRoot: options.executionWorkspace,
    sandbox: options.sandbox ?? "workspace_write",
    skipGitRepoCheck: options.skipGitRepoCheck ?? true,
    stderrCapBytes: options.stderrCapBytes ?? null,
    stdoutCapBytes: options.stdoutCapBytes ?? null,
    timeoutMs: options.timeoutMs ?? null,
  };
}

export function codexProviderCapabilityWarnings(
  request: AgentRunRequest,
  capabilities = createCodexProviderCapabilities(),
): string[] {
  const warnings: string[] = [];

  if (!capabilities.supportedModes.includes(request.mode)) {
    warnings.push("Codex Direct Work supports direct runs only.");
  }

  if (
    request.toolPolicy.mode !== "none" ||
    request.toolPolicy.allowedTools.length > 0
  ) {
    warnings.push("Codex Direct Work adapter does not enable Hobit tool calls.");
  }

  if (!capabilities.supportsCancellation) {
    warnings.push("Cancellation is unavailable for this Codex adapter instance.");
  }

  if (!capabilities.supportsFileChangeSummary) {
    warnings.push(
      "Changed-file summaries are not reported by this adapter; use explicit Git/Finder review.",
    );
  }

  warnings.push("Token usage is reported only when Codex emits usage metadata.");

  return warnings;
}

export function mapDirectWorkStreamEventToAgentRunEvent(
  event: DirectWorkStreamEvent,
  sequence: number,
): AgentRunEvent {
  const lifecycle = lifecycleFromDirectWorkEvent(event);
  const kind = agentRunEventKindFromDirectWorkEvent(event);
  const title = titleFromDirectWorkEvent(event);

  return {
    id: `${event.runId}:${sequence}:${event.eventKind}`,
    kind,
    lifecycle,
    message: messageFromDirectWorkEvent(event),
    runId: event.runId,
    sequence,
    timestampMs: Date.now(),
    title,
  };
}

export function mapDirectWorkFinalEventToAgentRunResult({
  finalEvent,
  mode,
  providerId = CODEX_AGENT_PROVIDER_ID,
  request,
  startedAtMs,
  tokenUsage,
  warnings,
}: {
  finalEvent: DirectWorkStreamEvent;
  mode?: AgentRunRequest["mode"];
  providerId?: string;
  request: AgentRunRequest;
  startedAtMs?: number;
  tokenUsage?: AgentTokenUsage | null;
  warnings?: readonly string[];
}): AgentRunResult {
  const lifecycle = finalResultLifecycleFromDirectWorkEvent(finalEvent);
  const completedAtMs = Date.now();

  return {
    assistantText:
      lifecycle === "completed"
        ? (finalEvent.text ?? finalEvent.line ?? undefined)
        : undefined,
    errorMessage:
      lifecycle === "failed" || lifecycle === "cancelled"
        ? (finalEvent.errorMessage ??
          finalEvent.text ??
          finalEvent.stderrPreview ??
          finalEvent.finalStatus ??
          undefined)
        : undefined,
    fileChanges: [],
    lifecycle,
    metadata: {
      completedAtMs,
      durationMs:
        finalEvent.elapsedMs >= 0
          ? finalEvent.elapsedMs
          : startedAtMs
            ? completedAtMs - startedAtMs
            : null,
      lifecycle,
      mode: mode ?? request.mode,
      providerId,
      runId: finalEvent.runId,
      startedAtMs,
      tokenUsage: tokenUsage ?? null,
      workspaceId: request.workspaceId,
    },
    runId: finalEvent.runId,
    validationSuggestions: warningSuggestions(warnings ?? []),
  };
}

export function createCodexAgentRuntimeAdapter(
  actions: CodexAgentRuntimeActions,
): CodexAgentRuntimeAdapter {
  const capabilities = createCodexProviderCapabilities({
    supportsCancellation: Boolean(actions.cancelCodexDirectWorkRun),
  });

  return {
    capabilities,
    async cancelRun(widgetInstanceId, runId) {
      if (!actions.cancelCodexDirectWorkRun) {
        return {
          supported: false,
          warnings: [
            "Cancellation is unavailable for this Codex adapter instance.",
          ],
        };
      }

      await actions.cancelCodexDirectWorkRun(widgetInstanceId, runId);
      return { supported: true, warnings: [] };
    },
    async startRun(request, options, onEvent, signal, onResult) {
      const warnings = codexProviderCapabilityWarnings(request, capabilities);

      if (!actions.startCodexDirectWorkStream) {
        return unsupportedResult(request, warnings);
      }

      const startedAtMs = Date.now();
      let sequence = 0;
      let lastTokenUsage: AgentTokenUsage | null = null;
      const directWorkRequest = mapAgentRunRequestToCodexDirectWorkRequest(
        request,
        options,
      );

      const session = await actions.startCodexDirectWorkStream(
        options.widgetInstanceId,
        directWorkRequest,
        (event) => {
          sequence += 1;
          const tokenUsage = tokenUsageFromDirectWorkStreamEvent(event);
          if (tokenUsage) {
            lastTokenUsage = tokenUsage;
          }

          onEvent(mapDirectWorkStreamEventToAgentRunEvent(event, sequence));

          if (event.isFinal) {
            onResult?.(
              mapDirectWorkFinalEventToAgentRunResult({
                finalEvent: event,
                request,
                startedAtMs,
                tokenUsage: lastTokenUsage,
                warnings,
              }),
            );
          }
        },
        signal,
      );

      if (!session) {
        return unsupportedResult(request, [
          ...warnings,
          "Codex Direct Work stream was not accepted for this widget.",
        ]);
      }

      return {
        runId: session.runId,
        stopListening: session.stopListening,
        warnings,
      };
    },
  };
}

function lifecycleFromDirectWorkEvent(
  event: DirectWorkStreamEvent,
): AgentRunLifecycle {
  if (event.eventKind === "started") {
    return "starting";
  }
  if (event.eventKind === "completed" || event.eventKind === "final_message") {
    return event.isFinal ? "completed" : "running";
  }
  if (event.eventKind === "failed" || event.eventKind === "timed_out") {
    return "failed";
  }
  if (event.eventKind === "cancelled") {
    return "cancelled";
  }
  return "running";
}

function finalResultLifecycleFromDirectWorkEvent(
  event: DirectWorkStreamEvent,
): AgentRunResult["lifecycle"] {
  if (event.eventKind === "completed" || event.finalStatus === "completed") {
    return "completed";
  }
  if (event.eventKind === "cancelled" || event.finalStatus === "cancelled") {
    return "cancelled";
  }
  return "failed";
}

function agentRunEventKindFromDirectWorkEvent(
  event: DirectWorkStreamEvent,
): AgentRunEventKind {
  if (event.eventKind === "started") {
    return "provider_started";
  }
  if (event.eventKind === "completed") {
    return "completed";
  }
  if (event.eventKind === "failed" || event.eventKind === "timed_out") {
    return "failed";
  }
  if (event.eventKind === "cancelled") {
    return "cancelled";
  }
  return "response_received";
}

function titleFromDirectWorkEvent(event: DirectWorkStreamEvent) {
  if (event.eventKind === "stdout_line") {
    return "Codex stdout";
  }
  if (event.eventKind === "stderr_line") {
    return "Codex stderr";
  }
  if (event.eventKind === "codex_json_event") {
    return event.parsedCodexEventType ?? "Codex event";
  }
  if (event.eventKind === "final_message") {
    return "Final response";
  }
  if (event.eventKind === "timed_out") {
    return "Codex timed out";
  }
  return `Codex ${event.eventKind.replace(/_/g, " ")}`;
}

function messageFromDirectWorkEvent(event: DirectWorkStreamEvent) {
  return (
    event.text ??
    event.line ??
    event.errorMessage ??
    event.stderrPreview ??
    event.status ??
    event.finalStatus ??
    undefined
  );
}

function warningSuggestions(
  warnings: readonly string[],
) {
  return warnings.map((warning, index) => ({
    id: `codex-warning-${index + 1}`,
    label: "Capability warning",
    reason: warning,
    status: "skipped" as const,
  }));
}

function unsupportedResult(
  request: AgentRunRequest,
  warnings: readonly string[],
): AgentRunResult {
  return {
    errorMessage: "Codex Direct Work stream API is unavailable.",
    fileChanges: [],
    lifecycle: "blocked",
    metadata: {
      lifecycle: "blocked",
      mode: request.mode,
      providerId: CODEX_AGENT_PROVIDER_ID,
      runId: request.id,
      tokenUsage: null,
      workspaceId: request.workspaceId,
    },
    runId: request.id,
    validationSuggestions: warningSuggestions(warnings),
  };
}
