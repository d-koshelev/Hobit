import type { DirectWorkGitReviewHandoff } from "./useDirectWorkGitReviewHandoff";
import type { DirectWorkRunHandoffController } from "./useDirectWorkRunHandoff";
import type { WorkbenchWidgetInstanceActions } from "./useWorkbenchWidgetActions";
import type { AgentActivityEvent } from "./agentActivityModel";
import { agentActivityWidgetProps } from "./widgetProps/agentActivityWidgetProps";
import {
  agentExecutorWidgetProps,
  agentQueueWidgetProps,
} from "./widgetProps/queueExecutorWidgetProps";
import { databaseJdbcWidgetProps } from "./widgetProps/databaseJdbcWidgetProps";
import { gitWidgetProps } from "./widgetProps/gitWidgetProps";
import { knowledgeSkillsWidgetProps } from "./widgetProps/knowledgeSkillsWidgetProps";
import { notesWidgetProps } from "./widgetProps/notesWidgetProps";
import { sharedWidgetProps } from "./widgetProps/sharedWidgetProps";
import { terminalWidgetProps } from "./widgetProps/terminalWidgetProps";
import { workspaceAgentWidgetProps } from "./widgetProps/workspaceAgentWidgetProps";
import type {
  AgentQueueReportActionCard,
  AgentQueueTask,
} from "../workspace/types";
import type {
  AgentExecutorRunOpenRequest,
  AgentExecutorRunOpenRequestInput,
  AgentQueueItemOpenRequest,
  AgentExecutorSlot,
  CoordinatorAttachedContextInput,
  CoordinatorAttachedContextRequest,
  WorkspaceAgentQueueReportActionCardRequest,
  WorkspaceAgentQueueTaskStatusCardRequest,
  WidgetInstance,
  WidgetInstanceId,
  WidgetRenderProps,
} from "./types";
import {
  AGENT_ACTIVITY_COMPONENT_KEY,
  AGENT_QUEUE_PLACEHOLDER_COMPONENT_KEY,
  AGENT_RUN_PLACEHOLDER_COMPONENT_KEY,
  FINDER_WIDGET_COMPONENT_KEY,
  GIT_PLACEHOLDER_COMPONENT_KEY,
  INTERACTIVE_AGENT_PLACEHOLDER_COMPONENT_KEY,
  JDBC_WIDGET_COMPONENT_KEY,
  NOTES_PLACEHOLDER_COMPONENT_KEY,
  SKILL_LIBRARY_COMPONENT_KEY,
  TERMINAL_PLACEHOLDER_COMPONENT_KEY,
} from "./widgetRegistry";
import type { WorkspaceQueueApi } from "./queue/useWorkspaceQueueApi";

type WidgetHostRenderPropsOptions = {
  agentActivityEvents: AgentActivityEvent[];
  agentExecutorSlots: AgentExecutorSlot[];
  agentExecutorRunOpenRequest: AgentExecutorRunOpenRequest | null;
  agentQueueItemOpenRequest: AgentQueueItemOpenRequest | null;
  componentKey: string;
  coordinatorAttachedContextRequest: CoordinatorAttachedContextRequest | null;
  currentWorkspaceRoot?: string | null;
  workbenchId?: string | null;
  workbenchWidgets?: readonly WidgetInstance[];
  queueReportActionCardRequest: WorkspaceAgentQueueReportActionCardRequest | null;
  queueTaskStatusCardRequest: WorkspaceAgentQueueTaskStatusCardRequest | null;
  directWorkGitReview: DirectWorkGitReviewHandoff;
  directWorkRunHandoff: DirectWorkRunHandoffController;
  hasGitWidget: boolean;
  instanceId: WidgetInstanceId;
  onAttachContextToCoordinator?: (
    request: CoordinatorAttachedContextInput,
  ) => void;
  onShowQueueReportInWorkspaceChat?: (
    card: AgentQueueReportActionCard,
  ) => void;
  onShowQueueTaskInWorkspaceChat?: (task: AgentQueueTask) => void;
  onOpenAgentQueueItem?: (queueItemId: string) => void;
  onOpenAgentExecutorRun: (
    request: AgentExecutorRunOpenRequestInput,
  ) => void;
  onPublishAgentActivityEvents: (events: AgentActivityEvent[]) => void;
  widgetActions: WorkbenchWidgetInstanceActions;
  workspaceQueueApi: WorkspaceQueueApi;
};

export function widgetHostRenderProps({
  agentActivityEvents,
  agentExecutorSlots,
  agentExecutorRunOpenRequest,
  agentQueueItemOpenRequest,
  componentKey,
  coordinatorAttachedContextRequest,
  currentWorkspaceRoot,
  workbenchId,
  workbenchWidgets,
  queueReportActionCardRequest,
  queueTaskStatusCardRequest,
  directWorkGitReview,
  directWorkRunHandoff,
  hasGitWidget,
  instanceId,
  onAttachContextToCoordinator,
  onShowQueueReportInWorkspaceChat,
  onShowQueueTaskInWorkspaceChat,
  onOpenAgentQueueItem,
  onOpenAgentExecutorRun,
  onPublishAgentActivityEvents,
  widgetActions,
  workspaceQueueApi,
}: WidgetHostRenderPropsOptions): Partial<WidgetRenderProps> {
  const commonProps = sharedWidgetProps(widgetActions);

  if (componentKey === AGENT_ACTIVITY_COMPONENT_KEY) {
    return {
      ...commonProps,
      ...agentActivityWidgetProps({ agentActivityEvents }),
    };
  }

  if (componentKey === AGENT_QUEUE_PLACEHOLDER_COMPONENT_KEY) {
    return {
      ...commonProps,
      ...agentQueueWidgetProps({
        actions: widgetActions,
        agentQueueItemOpenRequest,
        agentQueueController: workspaceQueueApi.controller,
        agentExecutorSlots: workspaceQueueApi.queueExecutorSlots,
        workspaceQueueApi,
        currentWorkspaceRoot,
        onAttachContextToCoordinator,
        onShowQueueReportInWorkspaceChat,
        onShowQueueTaskInWorkspaceChat,
        onOpenAgentExecutorRun,
      }),
    };
  }

  if (componentKey === AGENT_RUN_PLACEHOLDER_COMPONENT_KEY) {
    return {
      ...commonProps,
      ...agentExecutorWidgetProps({
        actions: widgetActions,
        agentExecutorRunOpenRequest,
        directWorkGitReview,
        directWorkRunHandoff,
        hasGitWidget,
        instanceId,
        workspaceQueueApi,
        onAttachContextToCoordinator,
        onPublishAgentActivityEvents,
      }),
    };
  }

  if (componentKey === FINDER_WIDGET_COMPONENT_KEY) {
    return {
      ...commonProps,
      onAttachContextToCoordinator,
      onCreateAgentQueueTask: widgetActions.createAgentQueueTask,
      onSelectWorkspaceDirectory: widgetActions.selectWorkspaceDirectory,
    };
  }

  if (componentKey === GIT_PLACEHOLDER_COMPONENT_KEY) {
    return {
      ...commonProps,
      ...gitWidgetProps({ actions: widgetActions, directWorkGitReview }),
    };
  }

  if (componentKey === INTERACTIVE_AGENT_PLACEHOLDER_COMPONENT_KEY) {
    return {
      ...commonProps,
      ...workspaceAgentWidgetProps({
        actions: widgetActions,
        agentActivityEvents,
        coordinatorAttachedContextRequest,
        instanceId,
        onOpenAgentQueueItem,
        onPublishAgentActivityEvents,
        queueReportActionCardRequest,
        queueTaskStatusCardRequest,
        currentWorkspaceRoot,
        workbenchId,
        workbenchWidgets,
        workspaceQueueApi,
      }),
    };
  }

  if (componentKey === JDBC_WIDGET_COMPONENT_KEY) {
    return {
      ...commonProps,
      ...databaseJdbcWidgetProps(widgetActions),
    };
  }

  if (componentKey === NOTES_PLACEHOLDER_COMPONENT_KEY) {
    return {
      ...commonProps,
      ...notesWidgetProps(widgetActions),
    };
  }

  if (componentKey === SKILL_LIBRARY_COMPONENT_KEY) {
    return {
      ...knowledgeSkillsWidgetProps({
        actions: widgetActions,
        onAttachContextToCoordinator,
        onAttachKnowledgeContextToQueueTask:
          workspaceQueueApi.controller.knowledgeContext?.onAttachSelected,
      }),
    };
  }

  if (componentKey === TERMINAL_PLACEHOLDER_COMPONENT_KEY) {
    return {
      ...commonProps,
      ...terminalWidgetProps(widgetActions),
    };
  }

  return commonProps;
}
