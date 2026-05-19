import type {
  ComponentType,
  CSSProperties,
  PointerEvent as ReactPointerEvent,
} from "react";
import { Badge } from "../design-system/Badge";
import { Button } from "../design-system/Button";
import { EmptyState } from "../design-system/EmptyState";
import { WidgetFrame } from "../design-system/WidgetFrame";
import { AgentQueuePlaceholderWidget } from "./AgentQueuePlaceholderWidget";
import { AgentRunPlaceholderWidget } from "./AgentRunPlaceholderWidget";
import { GitPlaceholderWidget } from "./GitPlaceholderWidget";
import { InteractiveAgentPlaceholderWidget } from "./InteractiveAgentPlaceholderWidget";
import { JdbcConnectorWidget } from "./JdbcConnectorWidget";
import { NotesPlaceholderWidget } from "./NotesPlaceholderWidget";
import { RunbookPlaceholderWidget } from "./RunbookPlaceholderWidget";
import { TerminalPlaceholderWidget } from "./TerminalPlaceholderWidget";
import { WidgetRemoveAction } from "./WidgetRemoveAction";
import type { DirectWorkGitReviewHandoff } from "./useDirectWorkGitReviewHandoff";
import type { DirectWorkRunHandoffController } from "./useDirectWorkRunHandoff";
import type {
  WidgetInstance,
  WidgetDefinition,
  WidgetPresentationMode,
  WidgetRenderProps,
  WorkbenchLayoutMode,
  AgentExecutorSlot,
} from "./types";
import type { WorkbenchWidgetInstanceActions } from "./useWorkbenchWidgetActions";
import { widgetHostRenderProps } from "./widgetHostRenderProps";
import {
  AGENT_QUEUE_PLACEHOLDER_COMPONENT_KEY,
  AGENT_RUN_PLACEHOLDER_COMPONENT_KEY,
  AGENT_RUN_WIDGET_DEFINITION_ID,
  GIT_PLACEHOLDER_COMPONENT_KEY,
  getWidgetDefinition,
  INTERACTIVE_AGENT_PLACEHOLDER_COMPONENT_KEY,
  INTERACTIVE_AGENT_WIDGET_DEFINITION_ID,
  JDBC_WIDGET_COMPONENT_KEY,
  NOTES_PLACEHOLDER_COMPONENT_KEY,
  RUNBOOK_PLACEHOLDER_COMPONENT_KEY,
  TERMINAL_PLACEHOLDER_COMPONENT_KEY,
} from "./widgetRegistry";

const widgetComponents: Record<string, ComponentType<WidgetRenderProps>> = {
  [AGENT_QUEUE_PLACEHOLDER_COMPONENT_KEY]: AgentQueuePlaceholderWidget,
  [AGENT_RUN_PLACEHOLDER_COMPONENT_KEY]: AgentRunPlaceholderWidget,
  [GIT_PLACEHOLDER_COMPONENT_KEY]: GitPlaceholderWidget,
  [INTERACTIVE_AGENT_PLACEHOLDER_COMPONENT_KEY]:
    InteractiveAgentPlaceholderWidget,
  [JDBC_WIDGET_COMPONENT_KEY]: JdbcConnectorWidget,
  [NOTES_PLACEHOLDER_COMPONENT_KEY]: NotesPlaceholderWidget,
  [RUNBOOK_PLACEHOLDER_COMPONENT_KEY]: RunbookPlaceholderWidget,
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
  agentExecutorSlots: AgentExecutorSlot[];
  instance: WidgetInstance;
  layoutMode: WorkbenchLayoutMode;
  onDockBack: (widgetInstanceId: WidgetInstance["id"]) => void;
  onPopOut: (widgetInstanceId: WidgetInstance["id"]) => void;
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
};

export function WidgetHost({
  directWorkGitReview,
  directWorkRunHandoff,
  dockedSize,
  hasGitWidget,
  agentExecutorSlots,
  instance,
  layoutMode,
  onDockBack,
  onPopOut,
  onStartDockedDrag,
  onStartPopoutDrag,
  presentationMode,
  widgetActions,
}: WidgetHostProps) {
  const definition = getWidgetDefinition(instance.definitionId);
  const frameTitle = definition
    ? displayWidgetTitle(instance, definition)
    : instance.title || "widget";
  const canMoveDockedWidget =
    layoutMode === "editing" &&
    presentationMode === "docked" &&
    instance.layout.mode === "docked";

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
    ) : (
      <Button onClick={() => onPopOut(instance.id)} variant="ghost">
        Float
      </Button>
    );

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
      <WidgetRemoveAction
        onRemove={() => widgetActions.removeWidgetInstance(instance.id)}
        widgetTitle={frameTitle}
      />
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
    agentExecutorSlots,
    componentKey: definition.componentKey,
    directWorkGitReview,
    directWorkRunHandoff,
    hasGitWidget,
    instanceId: instance.id,
    widgetActions,
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
    />
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
