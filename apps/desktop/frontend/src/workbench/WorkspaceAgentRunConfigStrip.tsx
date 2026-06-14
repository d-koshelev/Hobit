import { useId } from "react";
import { Badge } from "../design-system/Badge";
import { Select } from "../design-system";
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
  const providerSelectId = useId();

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
        <label
          className="workspace-agent-run-config-label"
          htmlFor={providerSelectId}
        >
          Provider
        </label>
        <Select
          aria-label="Workspace Agent provider"
          className="workspace-agent-provider-select"
          id={providerSelectId}
          onChange={() => undefined}
          value={config.providerId}
        >
          {config.providers.map((provider) => {
            const label = provider.runnable
              ? provider.label
              : `${provider.label} ${provider.productReason ?? "unavailable"}`;

            return (
              <option
                aria-disabled={!provider.runnable}
                disabled={!provider.runnable}
                key={provider.id}
                title={
                  provider.runnable
                    ? `${provider.label} is the active Workspace Agent provider.`
                    : `${provider.label} is unavailable: ${provider.productReason ?? "Unavailable"}.`
                }
                value={provider.id}
              >
                {label}
              </option>
            );
          })}
        </Select>
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
    <div
      aria-label={`Workspace Agent ${label.toLowerCase()} setting`}
      aria-readonly="true"
      className="workspace-agent-run-config-item workspace-agent-run-config-readonly"
      title={`${label} is read-only in this header. Run details show the active configuration.`}
    >
      <span className="workspace-agent-run-config-label">{label}:</span>
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
