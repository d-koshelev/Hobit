import type { AgentActivityEvent } from "../agentActivityModel";
import { createAgentQueueWidgetApi } from "../queue/agentQueueWidgetApi";
import type {
  AgentExecutorSlot,
  CoordinatorAttachedContextRequest,
  WidgetInstanceId,
  WidgetRenderProps,
  WorkspaceAgentQueueReportActionCardRequest,
} from "../types";
import type { WorkbenchWidgetInstanceActions } from "../useWorkbenchWidgetActions";
import {
  createWorkspaceAgentQueueBridge,
  type WorkspaceAgentQueueAutonomousControls,
  type WorkspaceAgentQueueViewControls,
} from "../workspaceAgentQueueBridge";

type WorkspaceAgentActions = Pick<
  WorkbenchWidgetInstanceActions,
  | "cancelCodexDirectWorkRun"
  | "createAgentQueueTask"
  | "createKnowledgeDocument"
  | "createSkill"
  | "createWorkspaceNote"
  | "generateCoordinatorProviderResponse"
  | "getAgentQueueRunnerSnapshot"
  | "getAgentQueueTask"
  | "listAgentQueueTaskRunLinks"
  | "listAgentQueueTasks"
  | "listAgentQueueWorkers"
  | "searchKnowledgeDocuments"
  | "selectWorkspaceDirectory"
  | "startCodexDirectWorkStream"
  | "updateAgentQueueTask"
>;

type WorkspaceAgentWidgetPropsOptions = {
  actions: WorkspaceAgentActions;
  agentExecutorSlots: AgentExecutorSlot[];
  agentQueueAutonomousControls?: WorkspaceAgentQueueAutonomousControls | null;
  agentQueueViewControls?: WorkspaceAgentQueueViewControls | null;
  coordinatorAttachedContextRequest: CoordinatorAttachedContextRequest | null;
  instanceId: WidgetInstanceId;
  onOpenAgentQueueItem?: (queueItemId: string) => void;
  onPublishAgentActivityEvents: (events: AgentActivityEvent[]) => void;
  queueReportActionCardRequest: WorkspaceAgentQueueReportActionCardRequest | null;
  workspaceId: string;
};

export function workspaceAgentWidgetProps({
  actions,
  agentExecutorSlots,
  agentQueueAutonomousControls,
  agentQueueViewControls,
  coordinatorAttachedContextRequest,
  instanceId,
  onOpenAgentQueueItem,
  onPublishAgentActivityEvents,
  queueReportActionCardRequest,
  workspaceId,
}: WorkspaceAgentWidgetPropsOptions): Partial<WidgetRenderProps> {
  const queueApi = createAgentQueueWidgetApi({
    agentExecutorSlots,
    createAgentQueueTask: actions.createAgentQueueTask,
    getAgentQueueRunnerSnapshot: actions.getAgentQueueRunnerSnapshot,
    getAgentQueueTask: actions.getAgentQueueTask,
    listAgentQueueTaskRunLinks: (queueItemId) =>
      actions.listAgentQueueTaskRunLinks({ queueItemId }),
    listAgentQueueTasks: actions.listAgentQueueTasks,
    listAgentQueueWorkers: actions.listAgentQueueWorkers,
    updateAgentQueueTask: actions.updateAgentQueueTask,
    workspaceId,
  });

  return {
    coordinatorAttachedContextRequest:
      coordinatorAttachedContextRequest?.targetCoordinatorWidgetInstanceId ===
      instanceId
        ? coordinatorAttachedContextRequest
        : undefined,
    queueReportActionCardRequest:
      queueReportActionCardRequest?.targetCoordinatorWidgetInstanceId ===
      instanceId
        ? queueReportActionCardRequest
        : undefined,
    onCancelCodexDirectWorkRun: actions.cancelCodexDirectWorkRun,
    onCreateAgentQueueTask: actions.createAgentQueueTask,
    onCreateKnowledgeDocument: actions.createKnowledgeDocument,
    onCreateSkill: actions.createSkill,
    onCreateWorkspaceNote: actions.createWorkspaceNote,
    onGenerateCoordinatorProviderResponse:
      actions.generateCoordinatorProviderResponse,
    onOpenAgentQueueItem,
    onPublishAgentActivityEvents,
    onSearchKnowledgeDocuments: actions.searchKnowledgeDocuments,
    onSelectWorkspaceDirectory: actions.selectWorkspaceDirectory,
    onStartCodexDirectWorkStream: actions.startCodexDirectWorkStream,
    onUpdateAgentQueueTask: actions.updateAgentQueueTask,
    workspaceAgentQueueBridge: createWorkspaceAgentQueueBridge({
      autonomousControls: agentQueueAutonomousControls,
      queueApi,
      queueViewControls: agentQueueViewControls,
      workspaceId,
    }),
  };
}
