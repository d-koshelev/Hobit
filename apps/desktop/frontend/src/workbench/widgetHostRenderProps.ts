import type { DirectWorkGitReviewHandoff } from "./useDirectWorkGitReviewHandoff";
import type { DirectWorkRunHandoffController } from "./useDirectWorkRunHandoff";
import type { WorkbenchWidgetInstanceActions } from "./useWorkbenchWidgetActions";
import type { AgentActivityEvent } from "./agentActivityModel";
import type {
  AgentExecutorRunOpenRequest,
  AgentExecutorRunOpenRequestInput,
  AgentExecutorSlot,
  CoordinatorAttachedContextInput,
  CoordinatorAttachedContextRequest,
  WidgetInstanceId,
  WidgetRenderProps,
} from "./types";
import {
  AGENT_ACTIVITY_COMPONENT_KEY,
  AGENT_QUEUE_PLACEHOLDER_COMPONENT_KEY,
  AGENT_RUN_PLACEHOLDER_COMPONENT_KEY,
  GIT_PLACEHOLDER_COMPONENT_KEY,
  INTERACTIVE_AGENT_PLACEHOLDER_COMPONENT_KEY,
  JDBC_WIDGET_COMPONENT_KEY,
  NOTES_PLACEHOLDER_COMPONENT_KEY,
  SKILL_LIBRARY_COMPONENT_KEY,
  TERMINAL_PLACEHOLDER_COMPONENT_KEY,
} from "./widgetRegistry";

type WidgetHostRenderPropsOptions = {
  agentActivityEvents: AgentActivityEvent[];
  agentExecutorSlots: AgentExecutorSlot[];
  agentExecutorRunOpenRequest: AgentExecutorRunOpenRequest | null;
  componentKey: string;
  coordinatorAttachedContextRequest: CoordinatorAttachedContextRequest | null;
  directWorkGitReview: DirectWorkGitReviewHandoff;
  directWorkRunHandoff: DirectWorkRunHandoffController;
  hasGitWidget: boolean;
  instanceId: WidgetInstanceId;
  onAttachContextToCoordinator?: (
    request: CoordinatorAttachedContextInput,
  ) => void;
  onOpenAgentExecutorRun: (
    request: AgentExecutorRunOpenRequestInput,
  ) => void;
  onPublishAgentActivityEvents: (events: AgentActivityEvent[]) => void;
  widgetActions: WorkbenchWidgetInstanceActions;
};

export function widgetHostRenderProps({
  agentActivityEvents,
  agentExecutorSlots,
  agentExecutorRunOpenRequest,
  componentKey,
  coordinatorAttachedContextRequest,
  directWorkGitReview,
  directWorkRunHandoff,
  hasGitWidget,
  instanceId,
  onAttachContextToCoordinator,
  onOpenAgentExecutorRun,
  onPublishAgentActivityEvents,
  widgetActions,
}: WidgetHostRenderPropsOptions): Partial<WidgetRenderProps> {
  const isAgentActivity = componentKey === AGENT_ACTIVITY_COMPONENT_KEY;
  const isAgentExecutor = componentKey === AGENT_RUN_PLACEHOLDER_COMPONENT_KEY;
  const isAgentQueue = componentKey === AGENT_QUEUE_PLACEHOLDER_COMPONENT_KEY;
  const isGit = componentKey === GIT_PLACEHOLDER_COMPONENT_KEY;
  const isInteractiveAgent =
    componentKey === INTERACTIVE_AGENT_PLACEHOLDER_COMPONENT_KEY;
  const isJdbc = componentKey === JDBC_WIDGET_COMPONENT_KEY;
  const isNotes = componentKey === NOTES_PLACEHOLDER_COMPONENT_KEY;
  const isSkillLibrary = componentKey === SKILL_LIBRARY_COMPONENT_KEY;
  const isTerminal = componentKey === TERMINAL_PLACEHOLDER_COMPONENT_KEY;

  return {
    agentActivityEvents: isAgentActivity ? agentActivityEvents : undefined,
    agentExecutorSlots,
    agentExecutorRunOpenRequest: isAgentExecutor
      ? agentExecutorRunOpenRequest
      : undefined,
    coordinatorAttachedContextRequest:
      isInteractiveAgent &&
      coordinatorAttachedContextRequest?.targetCoordinatorWidgetInstanceId ===
        instanceId
        ? coordinatorAttachedContextRequest
        : undefined,
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
    onCancelCodexDirectWorkRun: isAgentExecutor || isInteractiveAgent
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
    onDeleteAgentQueueTask: isAgentQueue
      ? widgetActions.deleteAgentQueueTask
      : undefined,
    onCreateGitCommit: isGit ? widgetActions.createGitCommit : undefined,
    onCreateJdbcConnector: isJdbc
      ? widgetActions.createJdbcConnector
      : undefined,
    onExecuteJdbcReadOnlyQuery: isJdbc
      ? widgetActions.executeJdbcReadOnlyQuery
      : undefined,
    onCreateWorkspaceNote: isNotes || isInteractiveAgent
      ? widgetActions.createWorkspaceNote
      : undefined,
    onCreateSkill: isSkillLibrary || isInteractiveAgent
      ? widgetActions.createSkill
      : undefined,
    onCreateKnowledgeDocument: isSkillLibrary || isInteractiveAgent
      ? widgetActions.createKnowledgeDocument
      : undefined,
    onDeleteSkill: isSkillLibrary ? widgetActions.deleteSkill : undefined,
    onDeleteKnowledgeDocument: isSkillLibrary
      ? widgetActions.deleteKnowledgeDocument
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
    onGetAgentQueueTaskLatestRunLink: isAgentQueue
      ? (queueItemId) =>
          widgetActions.getAgentQueueTaskLatestRunLink({ queueItemId })
      : undefined,
    onListAgentQueueTaskRunLinks: isAgentQueue
      ? (queueItemId) =>
          widgetActions.listAgentQueueTaskRunLinks({ queueItemId })
      : undefined,
    onOpenAgentExecutorRun: isAgentQueue ? onOpenAgentExecutorRun : undefined,
    onGetGitRepositoryStatus: widgetActions.getGitRepositoryStatus,
    onGetGitFileDiff: isGit ? widgetActions.getGitFileDiff : undefined,
    onGetGitLog: isGit ? widgetActions.getGitLog : undefined,
    onGenerateCoordinatorProviderResponse: isInteractiveAgent
      ? widgetActions.generateCoordinatorProviderResponse
      : undefined,
    onGetJdbcConnector: isJdbc ? widgetActions.getJdbcConnector : undefined,
    onGetWorkspaceNote: isNotes
      ? widgetActions.getWorkspaceNote
      : undefined,
    onGetSkill: isSkillLibrary ? widgetActions.getSkill : undefined,
    onGetKnowledgeDocument: isSkillLibrary
      ? widgetActions.getKnowledgeDocument
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
    onListSkills: isSkillLibrary ? widgetActions.listSkills : undefined,
    onListKnowledgeDocuments: isSkillLibrary
      ? widgetActions.listKnowledgeDocuments
      : undefined,
    onReadKnowledgeDocumentImportFile: isSkillLibrary
      ? widgetActions.readKnowledgeDocumentImportFile
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
    onAttachContextToCoordinator:
      (isAgentQueue || isAgentExecutor || isSkillLibrary) &&
      onAttachContextToCoordinator
        ? onAttachContextToCoordinator
        : undefined,
    onPublishAgentActivityEvents: isAgentExecutor || isInteractiveAgent
      ? onPublishAgentActivityEvents
      : undefined,
    onStartAssignedAgentQueueTask: isAgentQueue
      ? widgetActions.startAssignedAgentQueueTask
      : undefined,
    onStartAgentQueueRunnerSession: isAgentQueue
      ? widgetActions.startAgentQueueRunnerSession
      : undefined,
    onStopAgentQueueRunnerSession: isAgentQueue
      ? widgetActions.stopAgentQueueRunnerSession
      : undefined,
    onGetAgentQueueRunnerSnapshot: isAgentQueue
      ? widgetActions.getAgentQueueRunnerSnapshot
      : undefined,
    onStartCodexDirectWorkStream: isAgentExecutor || isInteractiveAgent
      ? widgetActions.startCodexDirectWorkStream
      : undefined,
    onSearchKnowledgeDocuments: isInteractiveAgent
      ? widgetActions.searchKnowledgeDocuments
      : undefined,
    onUpdateAgentQueueTask: isAgentQueue
      ? widgetActions.updateAgentQueueTask
      : undefined,
    onUpdateJdbcConnector: isJdbc
      ? widgetActions.updateJdbcConnector
      : undefined,
    onValidateJdbcReadOnlySql: isJdbc
      ? widgetActions.validateJdbcReadOnlySql
      : undefined,
    onUpdateLayout: widgetActions.updateWidgetLayout,
    onUpdateState: widgetActions.updateWidgetState,
    onUpdateWorkspaceNote: isNotes
      ? widgetActions.updateWorkspaceNote
      : undefined,
    onUpdateSkill: isSkillLibrary ? widgetActions.updateSkill : undefined,
    onUpdateKnowledgeDocument: isSkillLibrary
      ? widgetActions.updateKnowledgeDocument
      : undefined,
    queueTaskAutoRefreshRequest: isAgentQueue
      ? directWorkRunHandoff.queueTaskAutoRefreshRequest
      : undefined,
  };
}
