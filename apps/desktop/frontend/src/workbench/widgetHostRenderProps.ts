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
        agentExecutorSlots,
        directWorkRunHandoff,
        onAttachContextToCoordinator,
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
        onAttachContextToCoordinator,
        onPublishAgentActivityEvents,
      }),
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
        coordinatorAttachedContextRequest,
        instanceId,
        onPublishAgentActivityEvents,
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
      ...commonProps,
      ...knowledgeSkillsWidgetProps({
        actions: widgetActions,
        onAttachContextToCoordinator,
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
