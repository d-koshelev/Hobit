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
import { NotesPlaceholderWidget } from "./NotesPlaceholderWidget";
import { RunbookPlaceholderWidget } from "./RunbookPlaceholderWidget";
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
  AGENT_QUEUE_PLACEHOLDER_COMPONENT_KEY,
  AGENT_RUN_PLACEHOLDER_COMPONENT_KEY,
  AGENT_RUN_WIDGET_DEFINITION_ID,
  GIT_PLACEHOLDER_COMPONENT_KEY,
  getWidgetDefinition,
  INTERACTIVE_AGENT_PLACEHOLDER_COMPONENT_KEY,
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
  [NOTES_PLACEHOLDER_COMPONENT_KEY]: NotesPlaceholderWidget,
  [RUNBOOK_PLACEHOLDER_COMPONENT_KEY]: RunbookPlaceholderWidget,
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
  const runTerminalCommand =
    definition.componentKey === TERMINAL_PLACEHOLDER_COMPONENT_KEY
      ? widgetActions.runTerminalCommand
      : undefined;
  const runCodexDirectWork =
    definition.componentKey === AGENT_RUN_PLACEHOLDER_COMPONENT_KEY
      ? widgetActions.runCodexDirectWork
      : undefined;
  const listAgentExecutorRuns =
    definition.componentKey === AGENT_RUN_PLACEHOLDER_COMPONENT_KEY
      ? widgetActions.listAgentExecutorRuns
      : undefined;
  const getAgentExecutorRunDetail =
    definition.componentKey === AGENT_RUN_PLACEHOLDER_COMPONENT_KEY
      ? widgetActions.getAgentExecutorRunDetail
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
      onGetAgentQueueSnapshot={getAgentQueueSnapshot}
      onListAgentExecutorRuns={listAgentExecutorRuns}
      onGetAgentExecutorRunDetail={getAgentExecutorRunDetail}
      onLoadLogs={widgetActions.listWidgetLogs}
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
    isLegacyAgentRunTitle(instance.title)
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
