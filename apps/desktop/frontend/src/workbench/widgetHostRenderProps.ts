import type { DirectWorkGitReviewHandoff } from "./useDirectWorkGitReviewHandoff";
import type { DirectWorkRunHandoffController } from "./useDirectWorkRunHandoff";
import type { WorkbenchWidgetInstanceActions } from "./useWorkbenchWidgetActions";
import type {
  AgentExecutorSlot,
  WidgetInstanceId,
  WidgetRenderProps,
} from "./types";
import {
  AGENT_QUEUE_PLACEHOLDER_COMPONENT_KEY,
  AGENT_RUN_PLACEHOLDER_COMPONENT_KEY,
  GIT_PLACEHOLDER_COMPONENT_KEY,
  INTERACTIVE_AGENT_PLACEHOLDER_COMPONENT_KEY,
  JDBC_WIDGET_COMPONENT_KEY,
  NOTES_PLACEHOLDER_COMPONENT_KEY,
  TERMINAL_PLACEHOLDER_COMPONENT_KEY,
} from "./widgetRegistry";

type WidgetHostRenderPropsOptions = {
  agentExecutorSlots: AgentExecutorSlot[];
  componentKey: string;
  directWorkGitReview: DirectWorkGitReviewHandoff;
  directWorkRunHandoff: DirectWorkRunHandoffController;
  hasGitWidget: boolean;
  instanceId: WidgetInstanceId;
  widgetActions: WorkbenchWidgetInstanceActions;
};

export function widgetHostRenderProps({
  agentExecutorSlots,
  componentKey,
  directWorkGitReview,
  directWorkRunHandoff,
  hasGitWidget,
  instanceId,
  widgetActions,
}: WidgetHostRenderPropsOptions): Partial<WidgetRenderProps> {
  const isAgentExecutor = componentKey === AGENT_RUN_PLACEHOLDER_COMPONENT_KEY;
  const isAgentQueue = componentKey === AGENT_QUEUE_PLACEHOLDER_COMPONENT_KEY;
  const isGit = componentKey === GIT_PLACEHOLDER_COMPONENT_KEY;
  const isInteractiveAgent =
    componentKey === INTERACTIVE_AGENT_PLACEHOLDER_COMPONENT_KEY;
  const isJdbc = componentKey === JDBC_WIDGET_COMPONENT_KEY;
  const isNotes = componentKey === NOTES_PLACEHOLDER_COMPONENT_KEY;
  const isTerminal = componentKey === TERMINAL_PLACEHOLDER_COMPONENT_KEY;

  return {
    agentExecutorSlots,
    directWorkGitReviewRequest: isGit
      ? directWorkGitReview.request
      : undefined,
    directWorkGitReviewStatus: isAgentExecutor
      ? directWorkGitReview.status
      : undefined,
    directWorkRunHandoff: isAgentExecutor
      ? (directWorkRunHandoff.handoffs[instanceId] ?? null)
      : undefined,
    hasGitWidget,
    onAssignAgentQueueTaskToExecutor: isAgentQueue
      ? widgetActions.assignAgentQueueTaskToExecutor
      : undefined,
    onAttachToCodexDirectWorkStream: isAgentExecutor
      ? widgetActions.attachToCodexDirectWorkStream
      : undefined,
    onCancelCodexDirectWorkRun: isAgentExecutor
      ? widgetActions.cancelCodexDirectWorkRun
      : undefined,
    onForceKillCodexDirectWorkRun: isAgentExecutor
      ? widgetActions.forceKillCodexDirectWorkRun
      : undefined,
    onClearAgentQueueTaskAssignment: isAgentQueue
      ? widgetActions.clearAgentQueueTaskAssignment
      : undefined,
    onCreateAgentQueueTask: isAgentQueue || isInteractiveAgent
      ? widgetActions.createAgentQueueTask
      : undefined,
    onCreateGitCommit: isGit ? widgetActions.createGitCommit : undefined,
    onCreateJdbcConnector: isJdbc
      ? widgetActions.createJdbcConnector
      : undefined,
    onCreateWorkspaceNote: isNotes || isInteractiveAgent
      ? widgetActions.createWorkspaceNote
      : undefined,
    onDirectWorkGitReviewRequested: isAgentExecutor
      ? directWorkGitReview.requestReview
      : undefined,
    onDirectWorkGitReviewStatusChange: isGit
      ? directWorkGitReview.updateStatus
      : undefined,
    onDirectWorkRunHandoffFinalState: isAgentExecutor
      ? directWorkRunHandoff.recordFinalState
      : undefined,
    onDirectWorkRunHandoffStarted: isAgentQueue
      ? directWorkRunHandoff.recordHandoff
      : undefined,
    onGetAgentExecutorDiffSummary: isAgentExecutor
      ? widgetActions.getAgentExecutorDiffSummary
      : undefined,
    onGetAgentExecutorRunDetail: isAgentExecutor
      ? widgetActions.getAgentExecutorRunDetail
      : undefined,
    onGetAgentQueueTask: isAgentQueue
      ? widgetActions.getAgentQueueTask
      : undefined,
    onGetGitRepositoryStatus: widgetActions.getGitRepositoryStatus,
    onGenerateCoordinatorProviderResponse: isInteractiveAgent
      ? widgetActions.generateCoordinatorProviderResponse
      : undefined,
    onGetJdbcConnector: isJdbc ? widgetActions.getJdbcConnector : undefined,
    onGetWorkspaceNote: isNotes
      ? widgetActions.getWorkspaceNote
      : undefined,
    onListAgentExecutorRuns: isAgentExecutor
      ? widgetActions.listAgentExecutorRuns
      : undefined,
    onListAgentQueueTasks: isAgentQueue
      ? widgetActions.listAgentQueueTasks
      : undefined,
    onListJdbcConnectors: isJdbc
      ? widgetActions.listJdbcConnectors
      : undefined,
    onListWorkspaceNotes: isNotes
      ? widgetActions.listWorkspaceNotes
      : undefined,
    onLoadLogs: widgetActions.listWidgetLogs,
    onRunCodexDirectWork: isAgentExecutor
      ? widgetActions.runCodexDirectWork
      : undefined,
    onRunDirectWorkValidation: isAgentExecutor
      ? widgetActions.runDirectWorkValidation
      : undefined,
    onRunTerminalCommand: isTerminal
      ? widgetActions.runTerminalCommand
      : undefined,
    onCreateTerminalPtySession: isTerminal
      ? widgetActions.createTerminalPtySession
      : undefined,
    onWriteTerminalPtySession: isTerminal
      ? widgetActions.writeTerminalPtySession
      : undefined,
    onResizeTerminalPtySession: isTerminal
      ? widgetActions.resizeTerminalPtySession
      : undefined,
    onStopTerminalPtySession: isTerminal
      ? widgetActions.stopTerminalPtySession
      : undefined,
    onKillTerminalPtySession: isTerminal
      ? widgetActions.killTerminalPtySession
      : undefined,
    onCloseTerminalPtySession: isTerminal
      ? widgetActions.closeTerminalPtySession
      : undefined,
    onGetTerminalPtySession: isTerminal
      ? widgetActions.getTerminalPtySession
      : undefined,
    onListTerminalPtySessions: isTerminal
      ? widgetActions.listTerminalPtySessions
      : undefined,
    onStartAssignedAgentQueueTask: isAgentQueue
      ? widgetActions.startAssignedAgentQueueTask
      : undefined,
    onStartCodexDirectWorkStream: isAgentExecutor
      ? widgetActions.startCodexDirectWorkStream
      : undefined,
    onUpdateAgentQueueTask: isAgentQueue
      ? widgetActions.updateAgentQueueTask
      : undefined,
    onUpdateJdbcConnector: isJdbc
      ? widgetActions.updateJdbcConnector
      : undefined,
    onUpdateLayout: widgetActions.updateWidgetLayout,
    onUpdateState: widgetActions.updateWidgetState,
    onUpdateWorkspaceNote: isNotes
      ? widgetActions.updateWorkspaceNote
      : undefined,
    queueTaskAutoRefreshRequest: isAgentQueue
      ? directWorkRunHandoff.queueTaskAutoRefreshRequest
      : undefined,
  };
}
