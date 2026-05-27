import { Badge } from "../design-system/Badge";
import type { CoordinatorDirectWorkStatus } from "./workspaceAgentDirectWorkModel";

type BadgeVariant = "neutral" | "info" | "success" | "warning" | "error";

export function WorkspaceAgentHeaderStatus({
  agentLabel = "Codex",
  status,
}: {
  agentLabel?: string;
  status: CoordinatorDirectWorkStatus;
}) {
  return (
    <div className="interactive-agent-frame-status">
      <label className="interactive-agent-agent-picker">
        <span>Agent</span>
        <select
          aria-label="Workspace Agent picker"
          className="input interactive-agent-agent-select"
          defaultValue="codex"
          disabled
        >
          <option value="codex">{agentLabel}</option>
        </select>
      </label>
      <span className="interactive-agent-frame-status-label">Status</span>
      <Badge variant={workspaceAgentStatusVariant(status)}>
        {workspaceAgentStatusLabel(status)}
      </Badge>
    </div>
  );
}

export function WorkspaceAgentStatusPanel({
  isProviderPending,
  providerModeLabel,
  supportedProposalTypeSummary,
}: {
  isProviderPending: boolean;
  providerModeLabel: string;
  supportedProposalTypeSummary: string;
}) {
  return (
    <section
      aria-label="Workspace Agent status"
      className="interactive-agent-status"
    >
      <details
        aria-label="Workspace Agent provider details"
        className="interactive-agent-provider-disclosure interactive-agent-provider-secondary"
      >
        <summary>Agent details</summary>
        <div className="interactive-agent-provider-row">
          <span className="interactive-agent-status-label">Chat response</span>
          <Badge
            variant={workspaceAgentProviderBadgeVariant(
              providerModeLabel,
              isProviderPending,
            )}
          >
            {isProviderPending
              ? "Drafting"
              : workspaceAgentProviderDisplayLabel(providerModeLabel)}
          </Badge>
          <span className="interactive-agent-status-label">Runtime</span>
          <Badge variant="neutral">Backend</Badge>
        </div>
        <p className="interactive-agent-text">
          Codex runs from the selected working directory when available.
          Fallback chat stays visible context only with tools disabled.
        </p>
        <p className="interactive-agent-text">
          Review cards available: {supportedProposalTypeSummary}. Queue and
          Note cards require approval plus a separate create action; JDBC cards
          stay copy-only.
        </p>
      </details>
    </section>
  );
}

function workspaceAgentStatusLabel(
  status: CoordinatorDirectWorkStatus,
): string {
  if (status === "running") {
    return "Running";
  }

  if (status === "failed") {
    return "Failed";
  }

  return "Ready";
}

function workspaceAgentStatusVariant(
  status: CoordinatorDirectWorkStatus,
): BadgeVariant {
  if (status === "running") {
    return "info";
  }

  if (status === "failed") {
    return "error";
  }

  return "success";
}

function workspaceAgentProviderBadgeVariant(
  providerModeLabel: string,
  isProviderPending: boolean,
): BadgeVariant {
  if (isProviderPending) {
    return "warning";
  }

  if (providerModeLabel === "Provider error") {
    return "error";
  }

  if (
    providerModeLabel === "Provider timeout" ||
    providerModeLabel === "Invalid provider response" ||
    providerModeLabel === "Network failure" ||
    providerModeLabel === "Request too large"
  ) {
    return "warning";
  }

  if (
    providerModeLabel === "Not configured" ||
    providerModeLabel.includes("unavailable")
  ) {
    return "warning";
  }

  if (
    providerModeLabel === "Local fallback" ||
    providerModeLabel === "Mock/local fallback"
  ) {
    return "neutral";
  }

  return "info";
}

function workspaceAgentProviderDisplayLabel(providerModeLabel: string): string {
  if (
    providerModeLabel === "Local fallback" ||
    providerModeLabel === "Mock/local fallback"
  ) {
    return "Local chat fallback";
  }

  return providerModeLabel;
}
