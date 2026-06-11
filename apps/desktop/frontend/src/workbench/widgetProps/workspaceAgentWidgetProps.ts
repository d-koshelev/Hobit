import type { AgentActivityEvent } from "../agentActivityModel";
import type {
  CoordinatorAttachedContextRequest,
  WidgetInstanceId,
  WidgetRenderProps,
  WorkspaceAgentQueueReportActionCardRequest,
  WorkspaceAgentQueueTaskStatusCardRequest,
} from "../types";
import type { WorkbenchWidgetInstanceActions } from "../useWorkbenchWidgetActions";
import type { WorkspaceQueueApi } from "../queue/useWorkspaceQueueApi";
import { materializePromptPackPreviewToQueue } from "../promptPack";

type WorkspaceAgentActions = Pick<
  WorkbenchWidgetInstanceActions,
  | "cancelCodexDirectWorkRun"
  | "createAgentQueueTask"
  | "createKnowledgeDocument"
  | "createSkill"
  | "createWorkspaceNote"
  | "generateCoordinatorProviderResponse"
  | "getKnowledgeDocument"
  | "searchKnowledgeDocuments"
  | "selectWorkspaceDirectory"
  | "startCodexDirectWorkStream"
  | "updateAgentQueueTask"
>;

type WorkspaceAgentWidgetPropsOptions = {
  actions: WorkspaceAgentActions;
  agentActivityEvents: AgentActivityEvent[];
  coordinatorAttachedContextRequest: CoordinatorAttachedContextRequest | null;
  instanceId: WidgetInstanceId;
  onOpenAgentQueueItem?: (queueItemId: string) => void;
  onPublishAgentActivityEvents: (events: AgentActivityEvent[]) => void;
  queueReportActionCardRequest: WorkspaceAgentQueueReportActionCardRequest | null;
  queueTaskStatusCardRequest: WorkspaceAgentQueueTaskStatusCardRequest | null;
  workspaceQueueApi: WorkspaceQueueApi;
};

export function workspaceAgentWidgetProps({
  actions,
  agentActivityEvents,
  coordinatorAttachedContextRequest,
  instanceId,
  onOpenAgentQueueItem,
  onPublishAgentActivityEvents,
  queueReportActionCardRequest,
  queueTaskStatusCardRequest,
  workspaceQueueApi,
}: WorkspaceAgentWidgetPropsOptions): Partial<WidgetRenderProps> {
  return {
    agentActivityEvents,
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
    queueTaskStatusCardRequest:
      queueTaskStatusCardRequest?.targetCoordinatorWidgetInstanceId ===
      instanceId
        ? queueTaskStatusCardRequest
        : undefined,
    onCancelCodexDirectWorkRun: actions.cancelCodexDirectWorkRun,
    onCreateAgentQueueTask: actions.createAgentQueueTask,
    onCreateKnowledgeDocument: actions.createKnowledgeDocument,
    onCreateSkill: actions.createSkill,
    onCreateWorkspaceNote: actions.createWorkspaceNote,
    onGenerateCoordinatorProviderResponse:
      actions.generateCoordinatorProviderResponse,
    onGetKnowledgeDocument: actions.getKnowledgeDocument,
    onOpenAgentQueueItem,
    onPublishAgentActivityEvents,
    onSearchKnowledgeDocuments: actions.searchKnowledgeDocuments,
    onSelectWorkspaceDirectory: actions.selectWorkspaceDirectory,
    onStartCodexDirectWorkStream: actions.startCodexDirectWorkStream,
    onUpdateAgentQueueTask: actions.updateAgentQueueTask,
    createQueueItemsFromPromptPackPreview: (preview) =>
      materializePromptPackPreviewToQueue({
        bridge: workspaceQueueApi,
        confirmed: true,
        preview,
      }),
    agentQueueController: workspaceQueueApi.controller,
    workspaceAgentQueueBridge: workspaceQueueApi,
  };
}
