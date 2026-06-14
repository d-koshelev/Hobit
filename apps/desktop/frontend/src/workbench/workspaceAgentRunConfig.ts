import type { CoordinatorDirectWorkStatus } from "./workspaceAgentDirectWorkModel";

export type WorkspaceAgentProviderId = "codex" | "claude" | "amp";

export type WorkspaceAgentProviderOption = {
  readonly id: WorkspaceAgentProviderId;
  readonly label: string;
  readonly productReason?: string;
  readonly runnable: boolean;
};

export type WorkspaceAgentRunConfig = {
  readonly model: string;
  readonly providerId: WorkspaceAgentProviderId;
  readonly providers: readonly WorkspaceAgentProviderOption[];
  readonly reasoning: string;
};

export const WORKSPACE_AGENT_DEFAULT_RUN_CONFIG: WorkspaceAgentRunConfig = {
  model: "gpt-5.5",
  providerId: "codex",
  providers: [
    {
      id: "codex",
      label: "Codex",
      runnable: true,
    },
    {
      id: "claude",
      label: "Claude",
      productReason: "Not connected",
      runnable: false,
    },
    {
      id: "amp",
      label: "Amp",
      productReason: "Not connected",
      runnable: false,
    },
  ],
  reasoning: "medium",
};

export function workspaceAgentStatusLabel(
  status: CoordinatorDirectWorkStatus | WorkspaceAgentV2Status,
): string {
  if (status === "preparing" || status === "materializing_context") {
    return "Starting";
  }

  if (status === "running") {
    return "Running";
  }

  if (status === "failed") {
    return "Failed";
  }

  if (status === "cancelled") {
    return "Cancelled";
  }

  if (status === "unsupported") {
    return "Unsupported";
  }

  return "Ready";
}

export function workspaceAgentStatusVariant(
  status: CoordinatorDirectWorkStatus | WorkspaceAgentV2Status,
): "neutral" | "info" | "success" | "warning" | "error" {
  if (
    status === "preparing" ||
    status === "materializing_context" ||
    status === "running"
  ) {
    return "info";
  }

  if (status === "failed" || status === "unsupported") {
    return "error";
  }

  if (status === "cancelled") {
    return "warning";
  }

  return "success";
}

type WorkspaceAgentV2Status =
  | "idle"
  | "preparing"
  | "materializing_context"
  | "running"
  | "completed"
  | "failed"
  | "cancelled"
  | "unsupported";
