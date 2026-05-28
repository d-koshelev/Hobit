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
