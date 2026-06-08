import type {
  AgentProviderCapabilities,
  AgentProviderId,
  AgentRunEvent,
  AgentRunLifecycle,
  AgentRunMetadata,
  AgentRunRequest,
  AgentTokenUsage,
} from "./agentRuntimeTypes";

export type AgentRunMetadataSummary = {
  durationLabel: string | null;
  lifecycleLabel: string;
  modeLabel: string;
  providerLabel: string;
  runId: string;
  tokenUsageLabel: string | null;
};

export type AgentRunEventGroup = {
  events: AgentRunEvent[];
  latestLifecycle: AgentRunLifecycle;
  runId: string;
};

export type AgentRunRequestValidation = {
  errors: string[];
  valid: boolean;
};

export const AGENT_RUN_LIFECYCLE_LABELS: Record<AgentRunLifecycle, string> = {
  "awaiting-review": "Awaiting review",
  blocked: "Blocked",
  cancelled: "Cancelled",
  completed: "Completed",
  draft: "Draft",
  failed: "Failed",
  queued: "Queued",
  running: "Running",
  starting: "Starting",
};

export function createMockProviderCapabilities(
  providerId: AgentProviderId = "mock",
): AgentProviderCapabilities {
  return {
    approvalPolicy: {
      applyChanges: "never",
      createQueueTasks: "after-review",
      executeTools: "never",
    },
    defaultMode: "review",
    displayName: "Mock provider",
    maxPromptChars: 12_000,
    providerId,
    sandboxPolicy: {
      filesystem: "visible-context-only",
      network: "none",
      requiresExplicitWorkspace: true,
    },
    supportedModes: ["review", "direct", "queue"],
    supportsCancellation: false,
    supportsFileChangeSummary: false,
    supportsStreaming: false,
    supportsTokenUsage: false,
    toolPolicy: {
      allowedTools: [],
      mode: "none",
      requiresOperatorApproval: true,
    },
  };
}

export function summarizeAgentRunMetadata(
  metadata: AgentRunMetadata,
): AgentRunMetadataSummary {
  return {
    durationLabel: durationLabel(metadata.durationMs),
    lifecycleLabel: agentRunLifecycleLabel(metadata.lifecycle),
    modeLabel: agentRunModeLabel(metadata.mode),
    providerLabel: metadata.providerId,
    runId: metadata.runId,
    tokenUsageLabel: tokenUsageLabel(metadata.tokenUsage ?? null),
  };
}

export function groupAgentRunEventsByRun(
  events: readonly AgentRunEvent[],
): AgentRunEventGroup[] {
  const groups = new Map<string, AgentRunEvent[]>();

  for (const event of events) {
    const runEvents = groups.get(event.runId) ?? [];
    runEvents.push(event);
    groups.set(event.runId, runEvents);
  }

  return Array.from(groups.entries())
    .map(([runId, runEvents]) => {
      const sortedEvents = [...runEvents].sort(compareAgentRunEvents);
      return {
        events: sortedEvents,
        latestLifecycle:
          sortedEvents[sortedEvents.length - 1]?.lifecycle ?? "draft",
        runId,
      };
    })
    .sort((first, second) => {
      const firstTime = first.events[0]?.timestampMs ?? 0;
      const secondTime = second.events[0]?.timestampMs ?? 0;
      return firstTime === secondTime
        ? first.runId.localeCompare(second.runId)
        : firstTime - secondTime;
    });
}

export function validateAgentRunRequest(
  request: AgentRunRequest,
  capabilities?: AgentProviderCapabilities,
): AgentRunRequestValidation {
  const errors: string[] = [];

  if (!request.id.trim()) {
    errors.push("Run request id is required.");
  }

  if (!request.workspaceId.trim()) {
    errors.push("Workspace id is required.");
  }

  if (!request.providerId.trim()) {
    errors.push("Provider id is required.");
  }

  if (!request.prompt.trim()) {
    errors.push("Prompt is required.");
  }

  if (request.toolPolicy.mode === "none" && request.toolPolicy.allowedTools.length > 0) {
    errors.push("Tool policy cannot allow tools when mode is none.");
  }

  if (
    capabilities &&
    !capabilities.supportedModes.includes(request.mode)
  ) {
    errors.push(`Run mode ${request.mode} is not supported by the provider.`);
  }

  if (
    capabilities?.maxPromptChars !== null &&
    capabilities?.maxPromptChars !== undefined &&
    request.prompt.length > capabilities.maxPromptChars
  ) {
    errors.push("Prompt exceeds the provider prompt limit.");
  }

  return {
    errors,
    valid: errors.length === 0,
  };
}

export function agentRunLifecycleLabel(lifecycle: AgentRunLifecycle) {
  return AGENT_RUN_LIFECYCLE_LABELS[lifecycle];
}

function compareAgentRunEvents(first: AgentRunEvent, second: AgentRunEvent) {
  if (first.timestampMs !== second.timestampMs) {
    return first.timestampMs - second.timestampMs;
  }

  if (first.sequence !== second.sequence) {
    return first.sequence - second.sequence;
  }

  return first.id.localeCompare(second.id);
}

function agentRunModeLabel(mode: AgentRunMetadata["mode"]) {
  if (mode === "direct") {
    return "Direct run";
  }

  if (mode === "queue") {
    return "Queue run";
  }

  return "Review";
}

function durationLabel(durationMs: number | null | undefined) {
  if (durationMs === null || durationMs === undefined || durationMs < 0) {
    return null;
  }

  if (durationMs < 1000) {
    return `${durationMs}ms`;
  }

  const seconds = durationMs / 1000;
  return seconds < 10 ? `${seconds.toFixed(1)}s` : `${Math.round(seconds)}s`;
}

function tokenUsageLabel(tokenUsage: AgentTokenUsage | null) {
  if (!tokenUsage) {
    return null;
  }

  const parts = [
    tokenPart(tokenUsage.inputTokens, "in"),
    tokenPart(tokenUsage.outputTokens, "out"),
    tokenPart(tokenUsage.totalTokens, "total"),
  ].filter((part): part is string => Boolean(part));

  return parts.length > 0 ? parts.join(", ") : null;
}

function tokenPart(value: number | undefined, label: string) {
  return typeof value === "number" && Number.isFinite(value)
    ? `${new Intl.NumberFormat("en-US").format(value)} ${label}`
    : null;
}
