import type { AgentActivityEvent } from "../agentActivityModel";
import type {
  CoordinatorAttachedContextRequest,
  WidgetInstanceId,
  WidgetRenderProps,
  WorkspaceAgentQueueReportActionCardRequest,
} from "../types";
import type { WorkbenchWidgetInstanceActions } from "../useWorkbenchWidgetActions";
import type { WorkspaceQueueApi } from "../queue/useWorkspaceQueueApi";

type WorkspaceAgentActions = Pick<
  WorkbenchWidgetInstanceActions,
  | "cancelCodexDirectWorkRun"
  | "createAgentQueueTask"
  | "createKnowledgeDocument"
  | "createSkill"
  | "createWorkspaceNote"
  | "generateCoordinatorProviderResponse"
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
  onPublishAgentActivityEvents: (events: AgentActivityEvent[]) => void;
  queueReportActionCardRequest: WorkspaceAgentQueueReportActionCardRequest | null;
  workspaceQueueApi: WorkspaceQueueApi;
};

export function workspaceAgentWidgetProps({
  actions,
  agentActivityEvents,
  coordinatorAttachedContextRequest,
  instanceId,
  onPublishAgentActivityEvents,
  queueReportActionCardRequest,
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
    onCancelCodexDirectWorkRun: actions.cancelCodexDirectWorkRun,
    onCreateAgentQueueTask: actions.createAgentQueueTask,
    onCreateKnowledgeDocument: actions.createKnowledgeDocument,
    onCreateSkill: actions.createSkill,
    onCreateWorkspaceNote: actions.createWorkspaceNote,
    onGenerateCoordinatorProviderResponse:
      actions.generateCoordinatorProviderResponse,
    onOpenAgentQueueItem: workspaceQueueApi.openQueueItem,
    onPublishAgentActivityEvents,
    onSearchKnowledgeDocuments: actions.searchKnowledgeDocuments,
    onSelectWorkspaceDirectory: actions.selectWorkspaceDirectory,
    onStartCodexDirectWorkStream: actions.startCodexDirectWorkStream,
    onUpdateAgentQueueTask: actions.updateAgentQueueTask,
    workspaceAgentQueueBridge: workspaceQueueApi,
  };
}
