import { Badge } from "../design-system/Badge";
import type { CoordinatorDirectWorkStatus } from "./workspaceAgentDirectWorkModel";
import {
  WORKSPACE_AGENT_DEFAULT_RUN_CONFIG,
  workspaceAgentStatusLabel,
  workspaceAgentStatusVariant,
  type WorkspaceAgentRunConfig,
} from "./workspaceAgentRunConfig";

export function WorkspaceAgentRunConfigStrip({
  config = WORKSPACE_AGENT_DEFAULT_RUN_CONFIG,
  status,
}: {
  readonly config?: WorkspaceAgentRunConfig;
  readonly status: CoordinatorDirectWorkStatus | WorkspaceAgentV2Status;
}) {
  return (
    <div
      aria-label="Workspace Agent run configuration"
      className="workspace-agent-run-config"
    >
      <div className="workspace-agent-run-config-item">
        <span className="workspace-agent-run-config-label">Status</span>
        <Badge variant={workspaceAgentStatusVariant(status)}>
          {workspaceAgentStatusLabel(status)}
        </Badge>
      </div>
      <div className="workspace-agent-run-config-item workspace-agent-run-config-provider">
        <span className="workspace-agent-run-config-label">Provider</span>
        <div
          aria-label="Workspace Agent provider options"
          className="workspace-agent-provider-options"
          role="list"
        >
          {config.providers.map((provider) => {
            const isActive = provider.id === config.providerId;
            const label = provider.runnable
              ? provider.label
              : `${provider.label}: ${provider.productReason ?? "Unavailable"}`;

            return (
              <span
                aria-disabled={!provider.runnable}
                aria-current={isActive ? "true" : undefined}
                className="workspace-agent-provider-option"
                data-active={isActive ? "true" : "false"}
                data-runnable={provider.runnable ? "true" : "false"}
                key={provider.id}
                role="listitem"
                title={
                  provider.runnable
                    ? `${provider.label} is the active Workspace Agent provider.`
                    : `${provider.label} is unavailable: ${provider.productReason ?? "Unavailable"}.`
                }
              >
                {label}
              </span>
            );
          })}
        </div>
      </div>
      <ConfigValue label="Model" value={config.model} />
      <ConfigValue label="Reasoning" value={config.reasoning} />
    </div>
  );
}

function ConfigValue({
  label,
  value,
}: {
  readonly label: string;
  readonly value: string;
}) {
  return (
    <div className="workspace-agent-run-config-item">
      <span className="workspace-agent-run-config-label">{label}</span>
      <span className="workspace-agent-run-config-value">{value}</span>
    </div>
  );
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
