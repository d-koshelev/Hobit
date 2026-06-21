import type {
  AgentActivityEvent,
  AgentActivityLifecycleStage,
  AgentActivitySeverity,
  AgentActivityStatus,
} from "../agentActivityModel";

export function hobitActionActivityEvent({
  actionIndex,
  details,
  lifecycleStage,
  rawPreview,
  runId,
  severity,
  status,
  summary,
  timestampMs,
  title,
  widgetInstanceId,
  workspaceId,
}: {
  actionIndex?: number;
  details?: string;
  lifecycleStage?: AgentActivityLifecycleStage;
  rawPreview?: string;
  runId: string;
  severity: AgentActivitySeverity;
  status: AgentActivityStatus;
  summary?: string;
  timestampMs: number;
  title: string;
  widgetInstanceId: string;
  workspaceId: string;
}): AgentActivityEvent {
  return {
    id: `${workspaceId}:${widgetInstanceId}:hobit-action:${runId}:${actionIndex ?? "chain"}:${status}:${title}`,
    details,
    lifecycleStage,
    rawPreview,
    runKind: "workspace-agent-broker-continuation",
    runId,
    severity,
    sourceKind: "workspace-agent",
    sourceLabel: "Workspace Agent",
    sourceWidgetInstanceId: widgetInstanceId,
    status,
    summary,
    timestamp: timestampMs,
    timestampLabel: "0s",
    title: actionIndex ? `${title}` : title,
    workspaceId,
  };
}
