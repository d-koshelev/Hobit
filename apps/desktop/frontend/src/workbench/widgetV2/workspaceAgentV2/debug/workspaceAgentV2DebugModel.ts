export type WorkspaceAgentV2DebugRow = {
  readonly label: string;
  readonly value: string;
};

export type WorkspaceAgentV2DebugSection = {
  readonly rows: readonly WorkspaceAgentV2DebugRow[];
  readonly title: string;
};

export type WorkspaceAgentV2DebugModelInput = {
  readonly activityEventCount: number;
  readonly approvalPolicy: string;
  readonly callbackAvailability: {
    readonly cancelRun: boolean;
    readonly contextAddPlaceholder: boolean;
    readonly contextRemove: boolean;
    readonly openQueue: boolean;
    readonly openQueueTask: boolean;
    readonly queueTaskCreate: boolean;
    readonly runRequest: boolean;
    readonly startRunStream: boolean;
  };
  readonly codexExecutable: string;
  readonly contextCount: number;
  readonly contextWarningCount: number;
  readonly currentRunId?: string | null;
  readonly directRunDisabledReason?: string;
  readonly directRunStatus: string;
  readonly directRunSupported: boolean;
  readonly directRunWarningCount: number;
  readonly queueBridgeState: {
    readonly attachKnowledgeToQueueTask: boolean;
    readonly attachSkillToQueueTask: boolean;
    readonly createItem: boolean;
  };
  readonly queueRunDisabledReason?: string;
  readonly queueRunStatus: string;
  readonly sandbox: string;
  readonly toolPolicyAllowedCount: number;
  readonly visibleContextSnapshotId?: string | null;
  readonly widgetInstanceId: string;
  readonly workingDirectory?: string | null;
  readonly workspaceId: string;
};

export type WorkspaceAgentV2DebugModel = {
  readonly diagnostics: readonly WorkspaceAgentV2DebugSection[];
  readonly rawSummary: readonly WorkspaceAgentV2DebugRow[];
};

export function buildWorkspaceAgentV2DebugModel({
  activityEventCount,
  approvalPolicy,
  callbackAvailability,
  codexExecutable,
  contextCount,
  contextWarningCount,
  currentRunId,
  directRunDisabledReason,
  directRunStatus,
  directRunSupported,
  directRunWarningCount,
  queueBridgeState,
  queueRunDisabledReason,
  queueRunStatus,
  sandbox,
  toolPolicyAllowedCount,
  visibleContextSnapshotId,
  widgetInstanceId,
  workingDirectory,
  workspaceId,
}: WorkspaceAgentV2DebugModelInput): WorkspaceAgentV2DebugModel {
  return {
    diagnostics: [
      {
        title: "Provider and runtime",
        rows: [
          { label: "Provider", value: "Codex" },
          { label: "Mode", value: "Direct Run / Queue task draft" },
          {
            label: "Direct Run adapter",
            value: directRunSupported ? "Supported" : "Unsupported",
          },
          { label: "Direct Run status", value: directRunStatus },
          { label: "Queue Run status", value: queueRunStatus },
          { label: "Activity events", value: activityEventCount.toString() },
        ],
      },
      {
        title: "Preflight internals",
        rows: [
          { label: "Working directory", value: workingDirectory?.trim() || "Not configured" },
          { label: "Sandbox", value: sandbox },
          { label: "Approval policy", value: approvalPolicy },
          { label: "Allowed Hobit tools", value: toolPolicyAllowedCount.toString() },
          { label: "Visible context refs", value: contextCount.toString() },
          { label: "Context warnings", value: contextWarningCount.toString() },
          { label: "Runtime warnings", value: directRunWarningCount.toString() },
        ],
      },
      {
        title: "Codex executable and config",
        rows: [
          { label: "Executable", value: codexExecutable.trim() || "codex" },
          {
            label: "Direct Run blocker",
            value: directRunDisabledReason ?? "None",
          },
          {
            label: "Queue task blocker",
            value: queueRunDisabledReason ?? "None",
          },
        ],
      },
      {
        title: "Queue bridge",
        rows: [
          {
            label: "Create Queue task",
            value: queueBridgeState.createItem ? "Available" : "Unavailable",
          },
          {
            label: "Attach Knowledge",
            value: queueBridgeState.attachKnowledgeToQueueTask ? "Available" : "Unavailable",
          },
          {
            label: "Attach Skill",
            value: queueBridgeState.attachSkillToQueueTask ? "Available" : "Unavailable",
          },
          { label: "Queue task action", value: "Creates draft task only; does not run" },
        ],
      },
      {
        title: "Callback availability",
        rows: [
          { label: "Run request", value: availabilityLabel(callbackAvailability.runRequest) },
          {
            label: "Start Direct Work stream",
            value: availabilityLabel(callbackAvailability.startRunStream),
          },
          { label: "Cancel run", value: availabilityLabel(callbackAvailability.cancelRun) },
          { label: "Queue task created", value: availabilityLabel(callbackAvailability.queueTaskCreate) },
          { label: "Open Queue", value: availabilityLabel(callbackAvailability.openQueue) },
          { label: "Open Queue task", value: availabilityLabel(callbackAvailability.openQueueTask) },
          {
            label: "Add context placeholder",
            value: availabilityLabel(callbackAvailability.contextAddPlaceholder),
          },
          { label: "Remove context", value: availabilityLabel(callbackAvailability.contextRemove) },
        ],
      },
      {
        title: "Scaffold and runtime limitations",
        rows: [
          { label: "Provider tools", value: "Disabled for Workspace Agent V2 runs" },
          { label: "Hidden context", value: "Not read" },
          { label: "Auto-run", value: "Not started from Queue task creation" },
          { label: "Persistence", value: "No new persistence behavior in this surface" },
        ],
      },
    ],
    rawSummary: [
      { label: "Workspace id", value: workspaceId },
      { label: "Widget instance id", value: widgetInstanceId },
      { label: "Current run/task id", value: currentRunId ?? "None" },
      { label: "Context snapshot id", value: visibleContextSnapshotId ?? "None" },
    ],
  };
}

function availabilityLabel(isAvailable: boolean) {
  return isAvailable ? "Available" : "Unavailable";
}
