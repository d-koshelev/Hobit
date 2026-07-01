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
import type {
  AgentProvider,
  AgentProviderEvent,
  AgentProviderTurnRequest,
} from "./agentProvider";

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

export type CodexAgentProviderOptions = CodexAgentRuntimeActions & {
  codexExecutable: string;
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

export function mapDirectWorkStreamEventToAgentProviderEvent(
  event: DirectWorkStreamEvent,
  sequence: number,
  providerId = CODEX_AGENT_PROVIDER_ID,
): AgentProviderEvent {
  const base = {
    providerId,
    providerThreadId: event.codexThreadId ?? null,
    rawDirectWorkEvent: event,
    runId: event.runId,
    sequence,
    timestampMs: Date.now(),
  };

  if (event.eventKind === "started") {
    return {
      ...base,
      type: "run_started",
    };
  }

  if (event.eventKind === "cancelled") {
    return {
      ...base,
      message: event.text ?? event.status ?? undefined,
      type: "cancelled",
    };
  }

  if (event.eventKind === "failed" || event.eventKind === "timed_out") {
    return {
      ...base,
      errorMessage:
        event.errorMessage ??
        event.text ??
        event.stderrPreview ??
        event.finalStatus ??
        "Codex Direct Work failed.",
      type: "error",
    };
  }

  if (event.isFinal) {
    return {
      ...base,
      elapsedMs: event.elapsedMs >= 0 ? event.elapsedMs : null,
      finalMessage: messageFromDirectWorkEvent(event),
      status: providerFinalStatusFromDirectWorkEvent(event),
      type: "run_finished",
    };
  }

  const text = messageFromDirectWorkEvent(event);
  if (text) {
    const structuredType = structuredProviderEventTypeFromText(text);
    if (structuredType) {
      return {
        ...base,
        text,
        type: structuredType,
      };
    }
  }

  if (event.eventKind === "stdout_line" || event.eventKind === "stderr_line") {
    return {
      ...base,
      text: text ?? "",
      type: "text_delta",
    };
  }

  return {
    ...base,
    text: text ?? event.eventKind,
    type: "message_delta",
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
    validationSuggestions: [],
    warnings: warnings ?? [],
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

export function createCodexAgentProvider({
  cancelCodexDirectWorkRun,
  codexExecutable,
  startCodexDirectWorkStream,
}: CodexAgentProviderOptions): AgentProvider {
  const capabilities = createCodexProviderCapabilities({
    supportsCancellation: Boolean(cancelCodexDirectWorkRun),
  });

  return {
    capabilities,
    async cancelRun(widgetInstanceId, runId) {
      if (!cancelCodexDirectWorkRun) {
        return {
          message: "Codex Direct Work cancellation is unavailable.",
          providerId: CODEX_AGENT_PROVIDER_ID,
          runId,
          status: "not_supported",
        };
      }

      const response = await cancelCodexDirectWorkRun(widgetInstanceId, runId);
      return {
        message:
          response && isRecord(response) && typeof response.message === "string"
            ? response.message
            : "Codex Direct Work cancellation requested.",
        providerId: CODEX_AGENT_PROVIDER_ID,
        runId,
        status: "requested",
      };
    },
    providerDisplayName: capabilities.displayName,
    providerId: CODEX_AGENT_PROVIDER_ID,
    async startTurn(request, onEvent, options) {
      if (!startCodexDirectWorkStream) {
        onEvent({
          errorMessage: "Codex Direct Work stream API is unavailable.",
          providerId: CODEX_AGENT_PROVIDER_ID,
          providerThreadId: request.providerThreadId ?? null,
          runId: request.id,
          sequence: 1,
          timestampMs: Date.now(),
          type: "error",
        });
        onEvent({
          elapsedMs: null,
          providerId: CODEX_AGENT_PROVIDER_ID,
          providerThreadId: request.providerThreadId ?? null,
          runId: request.id,
          sequence: 2,
          status: "failed",
          timestampMs: Date.now(),
          type: "run_finished",
        });
        return null;
      }

      let sequence = 0;
      const session = await startCodexDirectWorkStream(
        request.widgetInstanceId,
        codexProviderTurnRequestToDirectWorkRequest(request, codexExecutable),
        (event) => {
          sequence += 1;
          onEvent(
            mapDirectWorkStreamEventToAgentProviderEvent(
              event,
              sequence,
              CODEX_AGENT_PROVIDER_ID,
            ),
          );
        },
        options?.signal,
      );

      if (!session) {
        onEvent({
          errorMessage:
            "Codex Direct Work stream was not accepted for this widget.",
          providerId: CODEX_AGENT_PROVIDER_ID,
          providerThreadId: request.providerThreadId ?? null,
          runId: request.id,
          sequence: sequence + 1,
          timestampMs: Date.now(),
          type: "error",
        });
        return null;
      }

      return {
        providerId: CODEX_AGENT_PROVIDER_ID,
        runId: session.runId,
        stopListening: session.stopListening,
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

function providerFinalStatusFromDirectWorkEvent(
  event: DirectWorkStreamEvent,
): "cancelled" | "completed" | "failed" {
  const lifecycle = finalResultLifecycleFromDirectWorkEvent(event);
  return lifecycle === "cancelled" || lifecycle === "completed"
    ? lifecycle
    : "failed";
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

function codexProviderTurnRequestToDirectWorkRequest(
  request: AgentProviderTurnRequest,
  codexExecutable: string,
) {
  return {
    approvalPolicy: request.approvalPolicy,
    codexExecutable,
    codexThreadId: request.providerThreadId ?? null,
    operatorPrompt: request.prompt,
    repoRoot: request.workingDirectory,
    sandbox: request.sandbox,
    skipGitRepoCheck: true,
    stderrCapBytes: null,
    stdoutCapBytes: null,
    timeoutMs: null,
  };
}

function structuredProviderEventTypeFromText(
  text: string,
): Extract<
  AgentProviderEvent["type"],
  | "action_request_detected"
  | "final_answer"
  | "structured_output"
  | "workflow_request_detected"
> | null {
  const parsed = parseJsonRecord(text);
  const type = parsed ? stringField(parsed, "type") : null;
  if (type === "hobit.action.request") {
    return "action_request_detected";
  }
  if (type === "hobit.workflow.request") {
    return "workflow_request_detected";
  }
  if (type === "hobit.final.answer") {
    return "final_answer";
  }

  return parsed ? "structured_output" : null;
}

function parseJsonRecord(text: string): Record<string, unknown> | null {
  const trimmed = text.trim();
  if (!trimmed.startsWith("{") || !trimmed.endsWith("}")) {
    return null;
  }

  try {
    const parsed = JSON.parse(trimmed) as unknown;
    return isRecord(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function stringField(value: Record<string, unknown>, fieldName: string) {
  const field = value[fieldName];
  return typeof field === "string" && field.trim() ? field.trim() : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
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
    validationSuggestions: [],
    warnings,
  };
}
