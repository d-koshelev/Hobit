import type { AgentActivityEvent } from "../agentActivityModel";
import type {
  CoordinatorAttachedContextRequest,
  WidgetInstanceId,
  WidgetRenderProps,
} from "../types";
import type { WorkbenchWidgetInstanceActions } from "../useWorkbenchWidgetActions";

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
>;

type WorkspaceAgentWidgetPropsOptions = {
  actions: WorkspaceAgentActions;
  coordinatorAttachedContextRequest: CoordinatorAttachedContextRequest | null;
  instanceId: WidgetInstanceId;
  onPublishAgentActivityEvents: (events: AgentActivityEvent[]) => void;
};

export function workspaceAgentWidgetProps({
  actions,
  coordinatorAttachedContextRequest,
  instanceId,
  onPublishAgentActivityEvents,
}: WorkspaceAgentWidgetPropsOptions): Partial<WidgetRenderProps> {
  return {
    coordinatorAttachedContextRequest:
      coordinatorAttachedContextRequest?.targetCoordinatorWidgetInstanceId ===
      instanceId
        ? coordinatorAttachedContextRequest
        : undefined,
    onCancelCodexDirectWorkRun: actions.cancelCodexDirectWorkRun,
    onCreateAgentQueueTask: actions.createAgentQueueTask,
    onCreateKnowledgeDocument: actions.createKnowledgeDocument,
    onCreateSkill: actions.createSkill,
    onCreateWorkspaceNote: actions.createWorkspaceNote,
    onGenerateCoordinatorProviderResponse:
      actions.generateCoordinatorProviderResponse,
    onPublishAgentActivityEvents,
    onSearchKnowledgeDocuments: actions.searchKnowledgeDocuments,
    onSelectWorkspaceDirectory: actions.selectWorkspaceDirectory,
    onStartCodexDirectWorkStream: actions.startCodexDirectWorkStream,
  };
}
