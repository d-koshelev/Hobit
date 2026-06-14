import type { AgentQueueTask, AgentQueueWorkerExecutionReport } from "../../../../workspace/types";
import type { QueueInspectorSnapshot } from "../../../queue/queueV2ViewModel";
import type { AgentQueueController } from "../../../queue/details/agentQueueTaskDetailsTypes";
import type { QueueV2TaskDetailsAction } from "../queueV2TaskDetailsActions";

export type QueueV2DebugFact = {
  label: string;
  value: string;
};

export type QueueV2DebugSection = {
  facts: QueueV2DebugFact[];
  title: string;
};

export type QueueV2DebugModel = {
  logs: readonly string[];
  sections: readonly QueueV2DebugSection[];
};

export type BuildQueueV2DebugModelInput = {
  currentWorkspaceRoot: string | null;
  inspector: QueueInspectorSnapshot | null;
  queue: AgentQueueController | undefined;
  task: AgentQueueTask | null;
  taskActions: readonly QueueV2TaskDetailsAction[];
  validationDisabledReason: string | undefined | null;
};

export function buildQueueV2DebugModel(
  {
    currentWorkspaceRoot,
    inspector,
    queue,
    task,
    taskActions,
    validationDisabledReason,
  }: BuildQueueV2DebugModelInput,
): QueueV2DebugModel {
  const currentTask = task;
  const workerExecutionReports = currentTask?.workerExecutionReports;
  const latestReport =
    workerExecutionReports && workerExecutionReports.length > 0
      ? workerExecutionReports[workerExecutionReports.length - 1]
      : null;
  const workspaceRoot = (currentWorkspaceRoot ?? "").trim();
  const runDiagnosticEvents = buildTaskDiagnosticEvents(currentTask, latestReport);
  const queueFoundation = queue?.foundation;
  const queueRun = queue?.run;
  const runStartedState = queueRun?.startedRunId ?? "none";

  return {
    logs: runDiagnosticEvents,
    sections: [
      {
        title: "Queue bridge state",
        facts: [
          { label: "API", value: formatAvailability(Boolean(queue?.apiAvailable)) },
          {
            label: "Queue scheduler",
            value: queueFoundation?.globalExecutionState ?? "unknown",
          },
          {
            label: "Workers online / total",
            value: `${countBoolean(
              queueFoundation?.workers?.filter((worker) => worker.status !== "paused")
                .length,
            )} / ${countBoolean(queueFoundation?.workers?.length)}`,
          },
          {
            label: "Selected task match",
            value:
              queue?.selectedTask?.queueItemId === currentTask?.queueItemId
                ? "Yes"
                : "No",
          },
          {
            label: "Selected workspace",
            value: workspaceRoot.length > 0 ? workspaceRoot : "not provided",
          },
        ],
      },
      {
        title: "Callback availability",
        facts: [
          {
            label: "Refresh tasks",
            value: formatAvailability(Boolean(queue?.apiAvailable && queue?.refreshTasks)),
          },
          {
            label: "Run task",
            value: formatAvailability(Boolean(queueRun?.onStartAssignedTask)),
          },
          {
            label: "Save / create task",
            value: formatAvailability(Boolean(queue?.createTask)),
          },
          {
            label: "Set workspace draft",
            value: formatAvailability(Boolean(queueRun?.onRepoRootDraftChange)),
          },
          {
            label: "Start queue workers",
            value: formatAvailability(Boolean(queueFoundation?.onStartWorkers)),
          },
          {
            label: "Attach report",
            value: formatAvailability(Boolean(queue?.workerReport?.onAttachDemoReport)),
          },
          {
            label: "Coordinator finalize",
            value: formatAvailability(Boolean(queue?.coordinatorFinalization?.onFinalize)),
          },
        ],
      },
      {
        title: "Provider / runtime details",
        facts: [
          {
            label: "Execution workspace",
            value: currentTask?.executionWorkspace?.trim() ?? "not set",
          },
          {
            label: "Codex executable",
            value: currentTask?.codexExecutable ?? "not set",
          },
          { label: "Approval policy (task)", value: currentTask?.approvalPolicy ?? "not set" },
          {
            label: "Compatible workers",
            value: inspector?.workerAssignment?.compatibleWorkerIds?.length
              ? inspector.workerAssignment.compatibleWorkerIds.join(", ")
              : "none",
          },
          {
            label: "Sandbox",
            value: queueRun?.sandbox ?? "not set",
          },
          {
            label: "Approval policy (runtime)",
            value: queueRun?.approvalPolicy || "not set",
          },
          {
            label: "Executor selection",
            value: queueRun?.executorSelectionMessage ?? "not available",
          },
          {
            label: "Current run id",
            value: runStartedState,
          },
        ],
      },
      {
        title: "Action availability diagnostics",
        facts: taskActions.map((action) => ({
          label: `${action.label}${action.disabled ? " (disabled)" : ""}`,
          value: action.disabled
            ? action.technicalReason ?? action.reason ?? "No action reason recorded."
            : "Available",
        })),
      },
      {
        title: "Raw IDs",
        facts: [
          { label: "Task id", value: currentTask?.queueItemId ?? "none" },
          { label: "Workspace id", value: currentTask?.workspaceId ?? "none" },
          {
            label: "Latest report id",
            value: latestReport?.reportId ?? "none",
          },
          {
            label: "Assigned worker",
            value: currentTask?.assignedWorkerId ?? "unassigned",
          },
          {
            label: "Assigned executor",
            value: currentTask?.assignedExecutorWidgetId ?? "unassigned",
          },
          {
            label: "Report record count",
            value: String(currentTask?.workerExecutionReports?.length ?? 0),
          },
        ],
      },
      {
        title: "Task diagnostics",
        facts: [
          { label: "Lifecycle", value: inspector?.lifecycle ?? "unknown" },
          { label: "Next action", value: inspector?.nextAction ?? "unknown" },
          {
            label: "Queue objective",
            value:
              currentTask?.description?.trim() || currentTask?.prompt || "empty",
          },
          {
            label: "Primary blocker",
            value: inspector?.blockerSummary.primaryReason ?? "none",
          },
          {
            label: "Validation request",
            value: validationDisabledReason ?? "Validation request is available.",
          },
          {
            label: "Coordinator status",
            value: currentTask?.coordinatorStatus ?? "not_reported",
          },
          {
            label: "Status",
            value: currentTask?.status ?? "unknown",
          },
        ],
      },
      {
        title: "Run diagnostics",
        facts: [
          {
            label: "Run readiness",
            value: queueRun?.readinessMessage ?? "not prepared",
          },
          {
            label: "Run blockers",
            value:
              queueRun?.preconditionMessages?.length
                ? queueRun.preconditionMessages[0]
                : "none",
          },
          {
            label: "Saved task settings",
            value: queueRun?.hasUnsavedTaskSettings === false ? "No" : "Yes",
          },
          {
            label: "Executor selection",
            value: queueRun?.executorSelectionMessage ?? "not available",
          },
          {
            label: "Start message",
            value: queueRun?.startMessage ?? "none",
          },
        ],
      },
      {
        title: "Implementation notes moved from default UI",
        facts: [
          {
            label: "Prompt materialization preview",
            value:
              currentTask?.context?.materializedAt
                ? "Materialized context data exists for this task."
                : "No materialized context preview currently visible in default UI.",
          },
          {
            label: "Raw report preview",
            value:
              latestReport?.rawReportPreview ?? "No raw report preview recorded.",
          },
          {
            label: "Raw task metadata summary",
            value: `report-previews: ${currentTask?.workerExecutionReports?.length ?? 0}`,
          },
        ],
      },
      {
        title: "Task logs",
        facts: [
          { label: "Entry count", value: `${runDiagnosticEvents.length.toString()} entries` },
          {
            label: "Latest log",
            value:
              runDiagnosticEvents.length > 0
                ? runDiagnosticEvents[runDiagnosticEvents.length - 1]
                : "No log entries",
          },
        ],
      },
    ],
  };
}

function buildTaskDiagnosticEvents(
  task: AgentQueueTask | null,
  latestReport: AgentQueueWorkerExecutionReport | null,
): string[] {
  if (!task) {
    return [];
  }

  return [
    `Created ${task.createdAt}`,
    `Current status ${task.status}`,
    latestReport
      ? `Latest report ${latestReport.reportId} status ${latestReport.reportStatus}`
      : "No latest report.",
    `Validation status ${task.validationStatus}`,
    latestReport?.summary ? `Latest report summary: ${latestReport.summary}` : "No summary",
  ];
}

function formatAvailability(available: boolean): string {
  return available ? "available" : "missing";
}

function countBoolean(value: number | undefined): string {
  return typeof value === "number" ? String(value) : "0";
}
