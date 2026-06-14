import type {
  ComponentType,
  CSSProperties,
  PointerEvent as ReactPointerEvent,
} from "react";
import { Badge } from "../design-system/Badge";
import { Button } from "../design-system/Button";
import { EmptyState } from "../design-system/EmptyState";
import { WidgetFrame } from "../design-system/WidgetFrame";
import { AgentActivityWidget } from "./AgentActivityWidget";
import { AgentQueuePlaceholderWidget } from "./AgentQueuePlaceholderWidget";
import { AgentRunPlaceholderWidget } from "./AgentRunPlaceholderWidget";
import { FinderWidget } from "./FinderWidget";
import { GitPlaceholderWidget } from "./GitPlaceholderWidget";
import { InteractiveAgentPlaceholderWidget } from "./InteractiveAgentPlaceholderWidget";
import { JdbcConnectorWidget } from "./JdbcConnectorWidget";
import { KnowledgeSkillsV2Widget } from "./KnowledgeSkillsV2Widget";
import { NotesPlaceholderWidget } from "./NotesPlaceholderWidget";
import { RunbookPlaceholderWidget } from "./RunbookPlaceholderWidget";
import { TerminalPlaceholderWidget } from "./TerminalPlaceholderWidget";
import { WidgetRemoveAction } from "./WidgetRemoveAction";
import type { AgentActivityEvent } from "./agentActivityModel";
import type { DirectWorkGitReviewHandoff } from "./useDirectWorkGitReviewHandoff";
import type { DirectWorkRunHandoffController } from "./useDirectWorkRunHandoff";
import type {
  AgentQueueReportActionCard,
  AgentQueueTask,
} from "../workspace/types";
import type {
  WidgetInstance,
  WidgetDefinition,
  WidgetPresentationMode,
  WidgetRenderProps,
  WorkbenchLayoutMode,
  AgentExecutorRunOpenRequest,
  AgentExecutorRunOpenRequestInput,
  AgentQueueItemOpenRequest,
  AgentExecutorSlot,
  CoordinatorAttachedContextInput,
  CoordinatorAttachedContextRequest,
  WorkspaceAgentQueueReportActionCardRequest,
  WorkspaceAgentQueueTaskStatusCardRequest,
} from "./types";
import type { WorkbenchWidgetInstanceActions } from "./useWorkbenchWidgetActions";
import { widgetHostRenderProps } from "./widgetHostRenderProps";
import {
  createWidgetRuntimeContext,
  WidgetRuntimeContextProvider,
} from "./widgetRuntimeContext";
import type { WorkspaceQueueApi } from "./queue/useWorkspaceQueueApi";
import {
  AGENT_ACTIVITY_COMPONENT_KEY,
  AGENT_QUEUE_PLACEHOLDER_COMPONENT_KEY,
  AGENT_RUN_PLACEHOLDER_COMPONENT_KEY,
  AGENT_RUN_WIDGET_DEFINITION_ID,
  FINDER_WIDGET_COMPONENT_KEY,
  GIT_PLACEHOLDER_COMPONENT_KEY,
  getWidgetDefinition,
  INTERACTIVE_AGENT_PLACEHOLDER_COMPONENT_KEY,
  INTERACTIVE_AGENT_WIDGET_DEFINITION_ID,
  JDBC_WIDGET_COMPONENT_KEY,
  NOTES_PLACEHOLDER_COMPONENT_KEY,
  RUNBOOK_PLACEHOLDER_COMPONENT_KEY,
  SKILL_LIBRARY_COMPONENT_KEY,
  SKILL_LIBRARY_WIDGET_DEFINITION_ID,
  TERMINAL_PLACEHOLDER_COMPONENT_KEY,
} from "./widgetRegistry";

const widgetComponents: Record<string, ComponentType<WidgetRenderProps>> = {
  [AGENT_ACTIVITY_COMPONENT_KEY]: AgentActivityWidget,
  [AGENT_QUEUE_PLACEHOLDER_COMPONENT_KEY]: AgentQueuePlaceholderWidget,
  [AGENT_RUN_PLACEHOLDER_COMPONENT_KEY]: AgentRunPlaceholderWidget,
  [FINDER_WIDGET_COMPONENT_KEY]: FinderWidget,
  [GIT_PLACEHOLDER_COMPONENT_KEY]: GitPlaceholderWidget,
  [INTERACTIVE_AGENT_PLACEHOLDER_COMPONENT_KEY]:
    InteractiveAgentPlaceholderWidget,
  [JDBC_WIDGET_COMPONENT_KEY]: JdbcConnectorWidget,
  [NOTES_PLACEHOLDER_COMPONENT_KEY]: NotesPlaceholderWidget,
  [RUNBOOK_PLACEHOLDER_COMPONENT_KEY]: RunbookPlaceholderWidget,
  [SKILL_LIBRARY_COMPONENT_KEY]: KnowledgeSkillsV2Widget,
  [TERMINAL_PLACEHOLDER_COMPONENT_KEY]: TerminalPlaceholderWidget,
};

type WidgetHostProps = {
  directWorkGitReview: DirectWorkGitReviewHandoff;
  directWorkRunHandoff: DirectWorkRunHandoffController;
  dockedSize?: {
    height: number;
    width: number;
  };
  hasGitWidget: boolean;
  agentActivityEvents: AgentActivityEvent[];
  agentExecutorRunOpenRequest: AgentExecutorRunOpenRequest | null;
  agentQueueItemOpenRequest: AgentQueueItemOpenRequest | null;
  coordinatorAttachedContextRequest: CoordinatorAttachedContextRequest | null;
  currentWorkspaceRoot?: string | null;
  queueReportActionCardRequest: WorkspaceAgentQueueReportActionCardRequest | null;
  queueTaskStatusCardRequest: WorkspaceAgentQueueTaskStatusCardRequest | null;
  agentExecutorSlots: AgentExecutorSlot[];
  instance: WidgetInstance;
  layoutMode: WorkbenchLayoutMode;
  onDockBack: (widgetInstanceId: WidgetInstance["id"]) => void;
  onPopOut: (widgetInstanceId: WidgetInstance["id"]) => void;
  onOpenAgentExecutorRun: (
    request: AgentExecutorRunOpenRequestInput,
  ) => void;
  onAttachContextToCoordinator?: (
    request: CoordinatorAttachedContextInput,
  ) => void;
  onShowQueueReportInWorkspaceChat?: (
    card: AgentQueueReportActionCard,
  ) => void;
  onShowQueueTaskInWorkspaceChat?: (task: AgentQueueTask) => void;
  onOpenAgentQueueItem?: (queueItemId: string) => void;
  onPublishAgentActivityEvents: (events: AgentActivityEvent[]) => void;
  onStartDockedDrag: (
    widgetInstanceId: WidgetInstance["id"],
    pointerX: number,
    pointerY: number,
  ) => void;
  onStartPopoutDrag: (
    widgetInstanceId: WidgetInstance["id"],
    pointerX: number,
    pointerY: number,
  ) => void;
  presentationMode: WidgetPresentationMode;
  widgetActions: WorkbenchWidgetInstanceActions;
  workspaceQueueApi: WorkspaceQueueApi;
  workspaceId: string;
};

export function WidgetHost({
  directWorkGitReview,
  directWorkRunHandoff,
  dockedSize,
  hasGitWidget,
  agentActivityEvents,
  agentExecutorRunOpenRequest,
  agentQueueItemOpenRequest,
  coordinatorAttachedContextRequest,
  currentWorkspaceRoot,
  queueReportActionCardRequest,
  queueTaskStatusCardRequest,
  agentExecutorSlots,
  instance,
  layoutMode,
  onDockBack,
  onOpenAgentExecutorRun,
  onAttachContextToCoordinator,
  onShowQueueReportInWorkspaceChat,
  onShowQueueTaskInWorkspaceChat,
  onOpenAgentQueueItem,
  onPublishAgentActivityEvents,
  onStartDockedDrag,
  onStartPopoutDrag,
  presentationMode,
  widgetActions,
  workspaceQueueApi,
  workspaceId,
}: WidgetHostProps) {
  const definition = getWidgetDefinition(instance.definitionId);
  const frameTitle = definition
    ? displayWidgetTitle(instance, definition)
    : instance.title || "widget";
  const canMoveDockedWidget =
    layoutMode === "editing" &&
    presentationMode === "docked" &&
    instance.layout.mode === "docked";
  const canRemoveWidget = layoutMode === "editing";

  function startPopoutDrag(event: ReactPointerEvent<HTMLButtonElement>) {
    if (
      presentationMode !== "popped-out" ||
      !event.isPrimary ||
      event.button !== 0
    ) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    onStartPopoutDrag(instance.id, event.clientX, event.clientY);
  }

  function startDockedDrag(pointerX: number, pointerY: number) {
    if (!canMoveDockedWidget) {
      return;
    }

    onStartDockedDrag(instance.id, pointerX, pointerY);
  }

  const presentationAction =
    presentationMode === "popped-out" ? (
      <Button onClick={() => onDockBack(instance.id)} variant="secondary">
        Dock back
      </Button>
    ) : null;

  const frameActions = (
    <>
      {presentationMode === "popped-out" ? (
        <Button
          aria-label={`Move ${frameTitle} floating widget`}
          className="widget-drag-handle"
          onPointerDown={startPopoutDrag}
          title="Drag floating widget"
          variant="ghost"
        >
          Move
        </Button>
      ) : null}
      {presentationAction}
      {canRemoveWidget ? (
        <WidgetRemoveAction
          getRemovalConfirmation={() =>
            widgetActions.getWidgetRemovalConfirmation(instance.id)
          }
          onRemove={(options) =>
            widgetActions.removeWidgetInstance(instance.id, options)
          }
          widgetTitle={frameTitle}
        />
      ) : null}
    </>
  );
  const frameStyle = widgetFrameStyle(instance, presentationMode, dockedSize);
  const loadLogs = () => widgetActions.listWidgetLogs(instance.id);
  const logRefreshToken = widgetActions.logRefreshTokens[instance.id] ?? 0;

  if (!definition) {
    return (
      <WidgetFrame
        actions={frameActions}
        logRefreshToken={logRefreshToken}
        moveEnabled={canMoveDockedWidget}
        onMoveStart={startDockedDrag}
        onLoadLogs={loadLogs}
        style={frameStyle}
        status={<Badge variant="warning">Missing</Badge>}
        subtitle={`Definition "${instance.definitionId}" is not registered.`}
        title={frameTitle}
      >
        <EmptyState
          text="This widget instance cannot render until its definition is available in the frontend registry."
          title="Widget definition missing"
        />
      </WidgetFrame>
    );
  }

  const Component = widgetComponents[definition.componentKey];
  const title = frameTitle;
  const renderProps = widgetHostRenderProps({
    agentActivityEvents,
    agentExecutorSlots,
    agentExecutorRunOpenRequest,
    agentQueueItemOpenRequest,
    componentKey: definition.componentKey,
    coordinatorAttachedContextRequest,
    currentWorkspaceRoot,
    queueReportActionCardRequest,
    queueTaskStatusCardRequest,
    directWorkGitReview,
    directWorkRunHandoff,
    hasGitWidget,
    instanceId: instance.id,
    onAttachContextToCoordinator,
    onShowQueueReportInWorkspaceChat,
    onShowQueueTaskInWorkspaceChat,
    onOpenAgentQueueItem,
    onOpenAgentExecutorRun,
    onPublishAgentActivityEvents,
    widgetActions,
    workspaceQueueApi,
  });
  const runtimeContext = createWidgetRuntimeContext({
    definition,
    instance,
    logs: {
      load: loadLogs,
      refreshToken: logRefreshToken,
    },
    workspaceId,
  });

  if (!Component) {
    return (
      <WidgetFrame
        actions={frameActions}
        logRefreshToken={logRefreshToken}
        moveEnabled={canMoveDockedWidget}
        onMoveStart={startDockedDrag}
        onLoadLogs={loadLogs}
        style={frameStyle}
        status={<Badge variant="warning">Missing</Badge>}
        subtitle={`Component "${definition.componentKey}" is not mapped.`}
        title={title}
      >
        <EmptyState
          text="This widget definition exists, but the frontend host does not know which React component should render it."
          title="Widget component missing"
        />
      </WidgetFrame>
    );
  }

  return (
    <WidgetRuntimeContextProvider runtime={runtimeContext}>
      <Component
        config={{ ...definition.defaultConfig, ...instance.config }}
        definition={definition}
        frameActions={frameActions}
        frameMoveEnabled={canMoveDockedWidget}
        frameStyle={frameStyle}
        instance={instance}
        logRefreshToken={logRefreshToken}
        {...renderProps}
        onStartFrameMove={startDockedDrag}
        title={title}
        workspaceId={workspaceId}
      />
    </WidgetRuntimeContextProvider>
  );
}

function displayWidgetTitle(
  instance: WidgetInstance,
  definition: WidgetDefinition,
) {
  if (
    definition.id === AGENT_RUN_WIDGET_DEFINITION_ID &&
    isLegacyAgentRunTitle(instance.title)
  ) {
    return definition.defaultTitle;
  }

  if (
    definition.id === INTERACTIVE_AGENT_WIDGET_DEFINITION_ID &&
    isLegacyInteractiveAgentTitle(instance.title)
  ) {
    return definition.defaultTitle;
  }

  if (
    definition.id === SKILL_LIBRARY_WIDGET_DEFINITION_ID &&
    isLegacySkillLibraryTitle(instance.title)
  ) {
    return definition.defaultTitle;
  }

  return instance.title || definition.defaultTitle;
}

function isLegacyAgentRunTitle(title: string) {
  return (
    title === "Agent Run" ||
    title === "Agent Monitoring" ||
    title === "Direct Work / Codex"
  );
}

function isLegacyInteractiveAgentTitle(title: string) {
  return title === "Interactive Agent";
}

function isLegacySkillLibraryTitle(title: string) {
  return title === "Skill Library";
}

function widgetFrameStyle(
  instance: WidgetInstance,
  presentationMode: WidgetPresentationMode,
  dockedSize: WidgetHostProps["dockedSize"],
): CSSProperties | undefined {
  if (presentationMode === "popped-out" || instance.layout.mode !== "docked") {
    return undefined;
  }

  const height = dockedSize?.height ?? instance.layout.height;
  const width = dockedSize?.width ?? instance.layout.width;

  return {
    height: `${height}px`,
    minHeight: `${height}px`,
    width: `min(100%, ${width}px)`,
  };
}
