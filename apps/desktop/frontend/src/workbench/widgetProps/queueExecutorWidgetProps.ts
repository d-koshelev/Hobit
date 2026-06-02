import type { AgentActivityEvent } from "../agentActivityModel";
import type { DirectWorkGitReviewHandoff } from "../useDirectWorkGitReviewHandoff";
import type { DirectWorkRunHandoffController } from "../useDirectWorkRunHandoff";
import type {
  AgentQueueReportActionCard,
} from "../../workspace/types";
import type {
  AgentExecutorRunOpenRequest,
  AgentExecutorRunOpenRequestInput,
  AgentQueueItemOpenRequest,
  AgentExecutorSlot,
  CoordinatorAttachedContextInput,
  WidgetInstanceId,
  WidgetRenderProps,
} from "../types";
import type { WorkbenchWidgetInstanceActions } from "../useWorkbenchWidgetActions";

type AgentQueueActions = Pick<
  WorkbenchWidgetInstanceActions,
  | "assignAgentQueueTaskToExecutor"
  | "clearAgentQueueTaskAssignment"
  | "createAgentQueueTask"
  | "deleteAgentQueueTask"
  | "createAgentQueueWorker"
  | "deleteAgentQueueWorker"
  | "getAgentExecutorRunDetail"
  | "getAgentQueueRunnerSnapshot"
  | "getAgentQueueTask"
  | "getAgentQueueTaskLatestRunLink"
  | "listenToDirectWorkStreamEvents"
  | "listAgentQueueTaskRunLinks"
  | "listAgentQueueTasks"
  | "listAgentQueueWorkers"
  | "startAgentQueueRunnerSession"
  | "startAssignedAgentQueueTask"
  | "stopAgentQueueRunnerSession"
  | "updateAgentQueueTask"
  | "updateAgentQueueWorker"
>;

type AgentExecutorActions = Pick<
  WorkbenchWidgetInstanceActions,
  | "attachToCodexDirectWorkStream"
  | "cancelCodexDirectWorkRun"
  | "forceKillCodexDirectWorkRun"
  | "getAgentExecutorDiffSummary"
  | "getAgentExecutorRunDetail"
  | "listAgentExecutorRuns"
  | "runCodexDirectWork"
  | "runDirectWorkValidation"
  | "startCodexDirectWorkStream"
>;

type AgentQueueWidgetPropsOptions = {
  actions: AgentQueueActions;
  agentQueueItemOpenRequest: AgentQueueItemOpenRequest | null;
  agentExecutorSlots: AgentExecutorSlot[];
  directWorkRunHandoff: DirectWorkRunHandoffController;
  onAttachContextToCoordinator?: (
    request: CoordinatorAttachedContextInput,
  ) => void;
  onShowQueueReportInWorkspaceChat?: (
    card: AgentQueueReportActionCard,
  ) => void;
  onOpenAgentExecutorRun: (
    request: AgentExecutorRunOpenRequestInput,
  ) => void;
};

type AgentExecutorWidgetPropsOptions = {
  actions: AgentExecutorActions;
  agentExecutorRunOpenRequest: AgentExecutorRunOpenRequest | null;
  directWorkGitReview: DirectWorkGitReviewHandoff;
  directWorkRunHandoff: DirectWorkRunHandoffController;
  hasGitWidget: boolean;
  instanceId: WidgetInstanceId;
  onAttachContextToCoordinator?: (
    request: CoordinatorAttachedContextInput,
  ) => void;
  onPublishAgentActivityEvents: (events: AgentActivityEvent[]) => void;
};

export function agentQueueWidgetProps({
  actions,
  agentQueueItemOpenRequest,
  agentExecutorSlots,
  directWorkRunHandoff,
  onAttachContextToCoordinator,
  onShowQueueReportInWorkspaceChat,
  onOpenAgentExecutorRun,
}: AgentQueueWidgetPropsOptions): Partial<WidgetRenderProps> {
  return {
    agentQueueItemOpenRequest,
    agentExecutorSlots,
    onAssignAgentQueueTaskToExecutor: actions.assignAgentQueueTaskToExecutor,
    onAttachContextToCoordinator,
    onShowQueueReportInWorkspaceChat,
    onClearAgentQueueTaskAssignment: actions.clearAgentQueueTaskAssignment,
    onCreateAgentQueueTask: actions.createAgentQueueTask,
    onCreateAgentQueueWorker: actions.createAgentQueueWorker,
    onDeleteAgentQueueTask: actions.deleteAgentQueueTask,
    onDeleteAgentQueueWorker: actions.deleteAgentQueueWorker,
    onDirectWorkRunHandoffStarted: directWorkRunHandoff.recordHandoff,
    onGetAgentExecutorRunDetail: actions.getAgentExecutorRunDetail,
    onGetAgentQueueRunnerSnapshot: actions.getAgentQueueRunnerSnapshot,
    onGetAgentQueueTask: actions.getAgentQueueTask,
    onGetAgentQueueTaskLatestRunLink: (queueItemId) =>
      actions.getAgentQueueTaskLatestRunLink({ queueItemId }),
    onListenToDirectWorkStreamEvents: actions.listenToDirectWorkStreamEvents,
    onListAgentQueueTaskRunLinks: (queueItemId) =>
      actions.listAgentQueueTaskRunLinks({ queueItemId }),
    onListAgentQueueTasks: actions.listAgentQueueTasks,
    onListAgentQueueWorkers: actions.listAgentQueueWorkers,
    onOpenAgentExecutorRun,
    onStartAgentQueueRunnerSession: actions.startAgentQueueRunnerSession,
    onStartAssignedAgentQueueTask: actions.startAssignedAgentQueueTask,
    onStopAgentQueueRunnerSession: actions.stopAgentQueueRunnerSession,
    onUpdateAgentQueueTask: actions.updateAgentQueueTask,
    onUpdateAgentQueueWorker: actions.updateAgentQueueWorker,
    queueTaskAutoRefreshRequest:
      directWorkRunHandoff.queueTaskAutoRefreshRequest,
  };
}

export function agentExecutorWidgetProps({
  actions,
  agentExecutorRunOpenRequest,
  directWorkGitReview,
  directWorkRunHandoff,
  hasGitWidget,
  instanceId,
  onAttachContextToCoordinator,
  onPublishAgentActivityEvents,
}: AgentExecutorWidgetPropsOptions): Partial<WidgetRenderProps> {
  return {
    agentExecutorRunOpenRequest,
    directWorkGitReviewStatus: directWorkGitReview.status,
    directWorkRunHandoff: directWorkRunHandoff.handoffs[instanceId] ?? null,
    hasGitWidget,
    onAttachContextToCoordinator,
    onAttachToCodexDirectWorkStream: actions.attachToCodexDirectWorkStream,
    onCancelCodexDirectWorkRun: actions.cancelCodexDirectWorkRun,
    onDirectWorkGitReviewRequested: directWorkGitReview.requestReview,
    onDirectWorkRunHandoffFinalState: directWorkRunHandoff.recordFinalState,
    onForceKillCodexDirectWorkRun: actions.forceKillCodexDirectWorkRun,
    onGetAgentExecutorDiffSummary: actions.getAgentExecutorDiffSummary,
    onGetAgentExecutorRunDetail: actions.getAgentExecutorRunDetail,
    onListAgentExecutorRuns: actions.listAgentExecutorRuns,
    onPublishAgentActivityEvents,
    onRunCodexDirectWork: actions.runCodexDirectWork,
    onRunDirectWorkValidation: actions.runDirectWorkValidation,
    onStartCodexDirectWorkStream: actions.startCodexDirectWorkStream,
  };
}
