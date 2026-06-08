import type {
  AgentContextSnapshot,
  AgentRunEvent,
  AgentRunRequest,
  AgentRunResult,
  AgentSandboxPolicy,
  AgentToolPolicy,
} from "../../agentRuntime";
import {
  CODEX_AGENT_PROVIDER_ID,
  createCodexProviderCapabilities,
  type CodexAgentRuntimeLaunchOptions,
} from "../../agentRuntime";
import type {
  DirectWorkApprovalPolicy,
  DirectWorkSandbox,
} from "../../../workspace/types";
import type { WorkspaceAgentV2TranscriptMessage } from "./WorkspaceAgentV2Transcript";

export type WorkspaceAgentV2DirectRunStatus =
  | "idle"
  | "preparing"
  | "materializing_context"
  | "running"
  | "completed"
  | "failed"
  | "cancelled"
  | "unsupported";

export type WorkspaceAgentV2DirectRunRequestInput = {
  readonly approvalPolicy?: DirectWorkApprovalPolicy;
  readonly codexExecutable?: string;
  readonly promptText: string;
  readonly requestId: string;
  readonly sandbox?: DirectWorkSandbox;
  readonly toolPolicy?: AgentToolPolicy;
  readonly visibleContextSnapshot?: AgentContextSnapshot;
  readonly widgetInstanceId: string;
  readonly workingDirectory?: string | null;
  readonly workspaceId: string;
};

export type WorkspaceAgentV2DirectRunRequestBuild = {
  readonly launchOptions: CodexAgentRuntimeLaunchOptions | null;
  readonly request: AgentRunRequest;
  readonly unsupportedReason: string | null;
  readonly warnings: readonly string[];
};

const codexCapabilities = createCodexProviderCapabilities({
  supportsCancellation: true,
});

export function buildWorkspaceAgentV2DirectRunRequest({
  approvalPolicy,
  codexExecutable,
  promptText,
  requestId,
  sandbox,
  toolPolicy,
  visibleContextSnapshot,
  widgetInstanceId,
  workingDirectory,
  workspaceId,
}: WorkspaceAgentV2DirectRunRequestInput): WorkspaceAgentV2DirectRunRequestBuild {
  const prompt = promptText.trim();
  const trimmedWorkingDirectory = workingDirectory?.trim() ?? "";
  const effectiveToolPolicy = toolPolicy ?? codexCapabilities.toolPolicy;
  const sandboxPolicy = sandboxPolicyFromDirectWorkSandbox(sandbox);
  const request: AgentRunRequest = {
    contextSnapshot: visibleContextSnapshot,
    createdAtMs: Date.now(),
    id: requestId,
    metadata: visibleContextSnapshot
      ? {
          contextSnapshotId: visibleContextSnapshot.id,
          lifecycle: "draft",
          mode: "direct",
          providerId: CODEX_AGENT_PROVIDER_ID,
          runId: requestId,
          tokenUsage: null,
          workspaceId,
        }
      : undefined,
    mode: "direct",
    prompt,
    providerId: CODEX_AGENT_PROVIDER_ID,
    sandboxPolicy,
    toolPolicy: effectiveToolPolicy,
    workspaceId,
  };
  const warnings = directRunRequestWarnings(request, visibleContextSnapshot);

  if (!prompt) {
    return {
      launchOptions: null,
      request,
      unsupportedReason: "Prompt is required before starting Direct Run.",
      warnings,
    };
  }

  if (!trimmedWorkingDirectory) {
    return {
      launchOptions: null,
      request,
      unsupportedReason:
        "Direct Run requires an explicit working directory before Codex can start.",
      warnings,
    };
  }

  return {
    launchOptions: {
      approvalPolicy: approvalPolicy ?? "never",
      codexExecutable: codexExecutable?.trim() || "codex",
      executionWorkspace: trimmedWorkingDirectory,
      sandbox: sandbox ?? "workspace_write",
      widgetInstanceId,
    },
    request,
    unsupportedReason: null,
    warnings,
  };
}

export function workspaceAgentV2ContextMaterializedEvent({
  request,
  sequence,
  timestampMs,
}: {
  readonly request: AgentRunRequest;
  readonly sequence: number;
  readonly timestampMs: number;
}): AgentRunEvent {
  const summary =
    request.contextSnapshot?.summary ??
    "Visible prompt context only; no hidden Workspace context was read.";

  return {
    id: `${request.id}:context:${sequence}`,
    kind: "context_materialized",
    lifecycle: "running",
    message: summary,
    runId: request.id,
    sequence,
    timestampMs,
    title: "Visible context materialized",
  };
}

export function workspaceAgentV2ResultEvent({
  result,
  sequence,
  timestampMs,
}: {
  readonly result: AgentRunResult;
  readonly sequence: number;
  readonly timestampMs: number;
}): AgentRunEvent {
  return {
    id: `${result.runId}:result:${sequence}`,
    kind:
      result.lifecycle === "completed"
        ? "completed"
        : result.lifecycle === "cancelled"
          ? "cancelled"
          : "failed",
    lifecycle: result.metadata.lifecycle,
    message: result.assistantText ?? result.errorMessage,
    runId: result.runId,
    sequence,
    timestampMs,
    title: result.lifecycle === "completed" ? "Direct Run completed" : "Direct Run ended",
  };
}

export function workspaceAgentV2ResultTranscriptMessage(
  result: AgentRunResult,
): WorkspaceAgentV2TranscriptMessage {
  const body =
    result.assistantText ??
    result.errorMessage ??
    "Direct Run finished without a final response.";
  const tokenCount = result.metadata.tokenUsage?.totalTokens;

  return {
    body,
    id: `direct-run-result:${result.runId}`,
    metadata: {
      duration:
        typeof result.metadata.durationMs === "number"
          ? `${result.metadata.durationMs}ms`
          : undefined,
      provider: result.metadata.providerId,
      status: result.lifecycle,
      tokens: typeof tokenCount === "number" ? tokenCount : undefined,
    },
    role: "result",
    title: "Direct Run result",
  };
}

export function isWorkspaceAgentV2DirectRunBusy(
  status: WorkspaceAgentV2DirectRunStatus,
) {
  return (
    status === "preparing" ||
    status === "materializing_context" ||
    status === "running"
  );
}

function directRunRequestWarnings(
  request: AgentRunRequest,
  visibleContextSnapshot: AgentContextSnapshot | undefined,
) {
  const warnings: string[] = [];

  if (request.toolPolicy.allowedTools.length > 0 || request.toolPolicy.mode !== "none") {
    warnings.push("Workspace Agent v2 Direct Run keeps Hobit provider tools disabled.");
  }

  if (!visibleContextSnapshot) {
    warnings.push("No visible context snapshot was attached to this Direct Run.");
  }

  return warnings;
}

function sandboxPolicyFromDirectWorkSandbox(
  sandbox: DirectWorkSandbox | undefined,
): AgentSandboxPolicy {
  if (sandbox === "read_only") {
    return {
      filesystem: "visible-context-only",
      network: "provider-runtime-only",
      requiresExplicitWorkspace: true,
    };
  }

  return codexCapabilities.sandboxPolicy;
}
