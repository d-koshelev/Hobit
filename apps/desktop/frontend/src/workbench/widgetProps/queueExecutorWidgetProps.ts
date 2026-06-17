import type { AgentActivityEvent } from "../agentActivityModel";
import type { DirectWorkGitReviewHandoff } from "../useDirectWorkGitReviewHandoff";
import type { DirectWorkRunHandoffController } from "../useDirectWorkRunHandoff";
import type {
  AgentQueueReportActionCard,
  AgentQueueTask,
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
import type { AgentQueueController } from "../queue/useAgentQueueController";
import type { WorkbenchWidgetInstanceActions } from "../useWorkbenchWidgetActions";
import type { WorkspaceQueueApi } from "../queue/useWorkspaceQueueApi";

type AgentQueueKnowledgeActions = Pick<
  WorkbenchWidgetInstanceActions,
  | "createKnowledgeDocument"
  | "createSkill"
  | "listKnowledgeDraftReviews"
  | "recordKnowledgeDraftReview"
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
  actions: AgentQueueKnowledgeActions;
  agentQueueItemOpenRequest: AgentQueueItemOpenRequest | null;
  agentQueueController: AgentQueueController;
  agentExecutorSlots: AgentExecutorSlot[];
  currentWorkspaceRoot?: string | null;
  workspaceQueueApi: WorkspaceQueueApi;
  onAttachContextToCoordinator?: (
    request: CoordinatorAttachedContextInput,
  ) => void;
  onShowQueueReportInWorkspaceChat?: (
    card: AgentQueueReportActionCard,
  ) => void;
  onShowQueueTaskInWorkspaceChat?: (task: AgentQueueTask) => void;
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
  workspaceQueueApi: WorkspaceQueueApi;
  onAttachContextToCoordinator?: (
    request: CoordinatorAttachedContextInput,
  ) => void;
  onPublishAgentActivityEvents: (events: AgentActivityEvent[]) => void;
};

export function agentQueueWidgetProps({
  actions,
  agentQueueItemOpenRequest,
  agentQueueController,
  agentExecutorSlots,
  currentWorkspaceRoot,
  workspaceQueueApi,
  onAttachContextToCoordinator,
  onShowQueueReportInWorkspaceChat,
  onShowQueueTaskInWorkspaceChat,
  onOpenAgentExecutorRun,
}: AgentQueueWidgetPropsOptions): Partial<WidgetRenderProps> {
  return {
    agentQueueItemOpenRequest,
    agentQueueController,
    agentExecutorSlots,
    currentWorkspaceRoot:
      normalizedWorkspaceRoot(currentWorkspaceRoot) ??
      normalizedWorkspaceRoot(workspaceQueueApi.getCurrentWorkspaceRoot?.()) ??
      normalizedWorkspaceRoot(
        workspaceQueueApi.getRunSettingsDefaults?.()?.executionWorkspace,
      ),
    queueValidationRunner: workspaceQueueApi.validationRunner,
    onRequestQueueValidation: workspaceQueueApi.requestValidation,
    onAttachContextToCoordinator,
    onCreateKnowledgeDocument: actions.createKnowledgeDocument,
    onCreateSkill: actions.createSkill,
    onListKnowledgeDraftReviews: actions.listKnowledgeDraftReviews,
    onRecordKnowledgeDraftReview: actions.recordKnowledgeDraftReview,
    onShowQueueReportInWorkspaceChat,
    onShowQueueTaskInWorkspaceChat,
    onOpenAgentExecutorRun,
  };
}

function normalizedWorkspaceRoot(value: string | null | undefined) {
  const trimmed = value?.trim() ?? "";

  if (!trimmed || trimmed === "~" || trimmed === ".") {
    return null;
  }

  return trimmed;
}

export function agentExecutorWidgetProps({
  actions,
  agentExecutorRunOpenRequest,
  directWorkGitReview,
  directWorkRunHandoff,
  hasGitWidget,
  instanceId,
  workspaceQueueApi,
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
    onIngestQueueLinkedDirectWorkEvidence:
      workspaceQueueApi.ingestQueueLinkedDirectWorkEvidence,
    onListAgentExecutorRuns: actions.listAgentExecutorRuns,
    onPublishAgentActivityEvents,
    onRunCodexDirectWork: actions.runCodexDirectWork,
    onRunDirectWorkValidation: actions.runDirectWorkValidation,
    onStartCodexDirectWorkStream: actions.startCodexDirectWorkStream,
  };
}
