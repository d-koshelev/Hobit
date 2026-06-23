import type { AgentActivityEvent } from "../agentActivityModel";
import type {
  CoordinatorAttachedContextRequest,
  WidgetInstance,
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
  | "readPromptPackSource"
  | "startCodexDirectWorkStream"
  | "updateAgentQueueTask"
>;

type WorkspaceAgentWidgetPropsOptions = {
  actions: WorkspaceAgentActions;
  agentActivityEvents: AgentActivityEvent[];
  coordinatorAttachedContextRequest: CoordinatorAttachedContextRequest | null;
  currentWorkspaceRoot?: string | null;
  instanceId: WidgetInstanceId;
  workbenchId?: string | null;
  workbenchWidgets?: readonly WidgetInstance[];
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
  currentWorkspaceRoot,
  instanceId,
  workbenchId,
  workbenchWidgets,
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
    onInvokeHobitAgentActionRequest:
      workspaceQueueApi.invokeHobitAgentActionRequest,
    onOpenAgentQueueItem,
    onPublishAgentActivityEvents,
    onSearchKnowledgeDocuments: actions.searchKnowledgeDocuments,
    onSelectWorkspaceDirectory: actions.selectWorkspaceDirectory,
    onReadPromptPackSource: actions.readPromptPackSource,
    onStartCodexDirectWorkStream: actions.startCodexDirectWorkStream,
    onUpdateAgentQueueTask: actions.updateAgentQueueTask,
    createQueueItemsFromPromptPackPreview: (preview, options) =>
      materializePromptPackPreviewToQueue({
        bridge: workspaceQueueApi,
        confirmed: true,
        currentWorkspaceRoot:
          normalizedWorkspaceRoot(options?.currentWorkspaceRoot) ??
          normalizedWorkspaceRoot(currentWorkspaceRoot) ??
          normalizedWorkspaceRoot(workspaceQueueApi.getCurrentWorkspaceRoot?.()) ??
          normalizedWorkspaceRoot(
            workspaceQueueApi.getRunSettingsDefaults?.()?.executionWorkspace,
          ),
        preview,
      }),
    agentQueueController: workspaceQueueApi.controller,
    queueValidationRunner: workspaceQueueApi.validationRunner,
    workspaceAgentQueueBridge: workspaceQueueApi,
    workbenchId,
    workbenchWidgets,
    workspaceAgentQueueWorkflowPersistence:
      workspaceQueueApi.queueWorkflowPersistence,
  };
}

function normalizedWorkspaceRoot(value: string | null | undefined) {
  const trimmed = value?.trim() ?? "";

  if (!trimmed || trimmed === "~" || trimmed === ".") {
    return null;
  }

  return trimmed;
}
