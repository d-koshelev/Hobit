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
import { NotesPlaceholderWidget } from "./NotesPlaceholderWidget";
import { OperationalAgentChatPlaceholderWidget } from "./OperationalAgentChatPlaceholderWidget";
import { TemplateLibraryPlaceholderWidget } from "./TemplateLibraryPlaceholderWidget";
import { TerminalPlaceholderWidget } from "./TerminalPlaceholderWidget";
import { WidgetRemoveAction } from "./WidgetRemoveAction";
import type { DirectWorkGitReviewHandoff } from "./useDirectWorkGitReviewHandoff";
import type {
  WidgetInstance,
  WidgetDefinition,
  WidgetPresentationMode,
  WidgetRenderProps,
  WorkbenchLayoutMode,
} from "./types";
import type { WorkbenchWidgetInstanceActions } from "./useWorkbenchWidgetActions";
import {
  AGENT_CHAT_PLACEHOLDER_COMPONENT_KEY,
  AGENT_QUEUE_PLACEHOLDER_COMPONENT_KEY,
  AGENT_RUN_WIDGET_DEFINITION_ID,
  AGENT_RUN_PLACEHOLDER_COMPONENT_KEY,
  GIT_PLACEHOLDER_COMPONENT_KEY,
  getWidgetDefinition,
  NOTES_PLACEHOLDER_COMPONENT_KEY,
  TEMPLATE_LIBRARY_PLACEHOLDER_COMPONENT_KEY,
  TERMINAL_PLACEHOLDER_COMPONENT_KEY,
} from "./widgetRegistry";

const widgetComponents: Record<string, ComponentType<WidgetRenderProps>> = {
  [AGENT_CHAT_PLACEHOLDER_COMPONENT_KEY]: OperationalAgentChatPlaceholderWidget,
  [AGENT_QUEUE_PLACEHOLDER_COMPONENT_KEY]: AgentQueuePlaceholderWidget,
  [AGENT_RUN_PLACEHOLDER_COMPONENT_KEY]: AgentRunPlaceholderWidget,
  [GIT_PLACEHOLDER_COMPONENT_KEY]: GitPlaceholderWidget,
  [NOTES_PLACEHOLDER_COMPONENT_KEY]: NotesPlaceholderWidget,
  [TEMPLATE_LIBRARY_PLACEHOLDER_COMPONENT_KEY]:
    TemplateLibraryPlaceholderWidget,
  [TERMINAL_PLACEHOLDER_COMPONENT_KEY]: TerminalPlaceholderWidget,
};

type WidgetHostProps = {
  directWorkGitReview: DirectWorkGitReviewHandoff;
  dockedSize?: {
    height: number;
    width: number;
  };
  hasGitWidget: boolean;
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
  dockedSize,
  hasGitWidget,
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
          aria-label={`Move ${instance.title || "widget"} floating widget`}
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
        widgetTitle={instance.title || "widget"}
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
        title={instance.title || "Unknown Widget"}
      >
        <EmptyState
          text="This widget instance cannot render until its definition is available in the frontend registry."
          title="Widget definition missing"
        />
      </WidgetFrame>
    );
  }

  const Component = widgetComponents[definition.componentKey];
  const title = displayWidgetTitle(instance, definition);
  const runTerminalCommand =
    definition.componentKey === TERMINAL_PLACEHOLDER_COMPONENT_KEY
      ? widgetActions.runTerminalCommand
      : undefined;
  const persistAgentChatProposal =
    definition.componentKey === AGENT_CHAT_PLACEHOLDER_COMPONENT_KEY
      ? widgetActions.persistAgentChatProposal
      : undefined;
  const generateAgentChatAiProposal =
    definition.componentKey === AGENT_CHAT_PLACEHOLDER_COMPONENT_KEY
      ? widgetActions.generateAgentChatAiProposal
      : undefined;
  const getAgentMonitoringSnapshot =
    definition.componentKey === AGENT_RUN_PLACEHOLDER_COMPONENT_KEY
      ? widgetActions.getAgentMonitoringSnapshot
      : undefined;
  const createAgentQueueItemFromProposal =
    definition.componentKey === AGENT_RUN_PLACEHOLDER_COMPONENT_KEY
      ? widgetActions.createAgentQueueItemFromProposal
      : undefined;
  const runCodexDirectWork =
    definition.componentKey === AGENT_RUN_PLACEHOLDER_COMPONENT_KEY
      ? widgetActions.runCodexDirectWork
      : undefined;
  const runDirectWorkValidation =
    definition.componentKey === AGENT_RUN_PLACEHOLDER_COMPONENT_KEY
      ? widgetActions.runDirectWorkValidation
      : undefined;
  const cancelCodexDirectWorkRun =
    definition.componentKey === AGENT_RUN_PLACEHOLDER_COMPONENT_KEY
      ? widgetActions.cancelCodexDirectWorkRun
      : undefined;
  const startCodexDirectWorkStream =
    definition.componentKey === AGENT_RUN_PLACEHOLDER_COMPONENT_KEY
      ? widgetActions.startCodexDirectWorkStream
      : undefined;
  const getAgentQueueSnapshot =
    definition.componentKey === AGENT_QUEUE_PLACEHOLDER_COMPONENT_KEY
      ? widgetActions.getAgentQueueSnapshot
      : undefined;

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
      directWorkGitReviewRequest={
        definition.componentKey === GIT_PLACEHOLDER_COMPONENT_KEY
          ? directWorkGitReview.request
          : undefined
      }
      directWorkGitReviewStatus={
        definition.componentKey === AGENT_RUN_PLACEHOLDER_COMPONENT_KEY
          ? directWorkGitReview.status
          : undefined
      }
      frameActions={frameActions}
      frameMoveEnabled={canMoveDockedWidget}
      frameStyle={frameStyle}
      hasGitWidget={hasGitWidget}
      instance={instance}
      logRefreshToken={logRefreshToken}
      onCreateAgentQueueItemFromProposal={createAgentQueueItemFromProposal}
      onDirectWorkGitReviewRequested={
        definition.componentKey === AGENT_RUN_PLACEHOLDER_COMPONENT_KEY
          ? directWorkGitReview.requestReview
          : undefined
      }
      onDirectWorkGitReviewStatusChange={
        definition.componentKey === GIT_PLACEHOLDER_COMPONENT_KEY
          ? directWorkGitReview.updateStatus
          : undefined
      }
      onGetGitRepositoryStatus={widgetActions.getGitRepositoryStatus}
      onGetAgentMonitoringSnapshot={getAgentMonitoringSnapshot}
      onGetAgentQueueSnapshot={getAgentQueueSnapshot}
      onGenerateAgentChatAiProposal={generateAgentChatAiProposal}
      onLoadLogs={widgetActions.listWidgetLogs}
      onPersistAgentChatProposal={persistAgentChatProposal}
      onRunCodexDirectWork={runCodexDirectWork}
      onRunDirectWorkValidation={runDirectWorkValidation}
      onCancelCodexDirectWorkRun={cancelCodexDirectWorkRun}
      onStartCodexDirectWorkStream={startCodexDirectWorkStream}
      onRunTerminalCommand={runTerminalCommand}
      onStartFrameMove={startDockedDrag}
      onUpdateLayout={widgetActions.updateWidgetLayout}
      onUpdateState={widgetActions.updateWidgetState}
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
    instance.title === "Agent Run"
  ) {
    return definition.defaultTitle;
  }

  return instance.title || definition.defaultTitle;
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
