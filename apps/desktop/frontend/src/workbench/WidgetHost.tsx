import type {
  ComponentType,
  CSSProperties,
  PointerEvent as ReactPointerEvent,
} from "react";
import { Badge } from "../design-system/Badge";
import { Button } from "../design-system/Button";
import { EmptyState } from "../design-system/EmptyState";
import { WidgetFrame } from "../design-system/WidgetFrame";
import { NotesPlaceholderWidget } from "./NotesPlaceholderWidget";
import { OperationalAgentChatPlaceholderWidget } from "./OperationalAgentChatPlaceholderWidget";
import { TerminalPlaceholderWidget } from "./TerminalPlaceholderWidget";
import type {
  WidgetInstance,
  WidgetPresentationMode,
  WidgetRenderProps,
} from "./types";
import type { WorkbenchWidgetInstanceActions } from "./useWorkbenchWidgetActions";
import {
  AGENT_CHAT_PLACEHOLDER_COMPONENT_KEY,
  getWidgetDefinition,
  NOTES_PLACEHOLDER_COMPONENT_KEY,
  TERMINAL_PLACEHOLDER_COMPONENT_KEY,
} from "./widgetRegistry";

const widgetComponents: Record<string, ComponentType<WidgetRenderProps>> = {
  [AGENT_CHAT_PLACEHOLDER_COMPONENT_KEY]: OperationalAgentChatPlaceholderWidget,
  [NOTES_PLACEHOLDER_COMPONENT_KEY]: NotesPlaceholderWidget,
  [TERMINAL_PLACEHOLDER_COMPONENT_KEY]: TerminalPlaceholderWidget,
};

type WidgetHostProps = {
  instance: WidgetInstance;
  onDockBack: (widgetInstanceId: WidgetInstance["id"]) => void;
  onPopOut: (widgetInstanceId: WidgetInstance["id"]) => void;
  onStartPopoutDrag: (
    widgetInstanceId: WidgetInstance["id"],
    pointerX: number,
    pointerY: number,
  ) => void;
  presentationMode: WidgetPresentationMode;
  widgetActions: WorkbenchWidgetInstanceActions;
};

export function WidgetHost({
  instance,
  onDockBack,
  onPopOut,
  onStartPopoutDrag,
  presentationMode,
  widgetActions,
}: WidgetHostProps) {
  const definition = getWidgetDefinition(instance.definitionId);
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

  const presentationAction =
    presentationMode === "popped-out" ? (
      <Button onClick={() => onDockBack(instance.id)} variant="secondary">
        Dock back
      </Button>
    ) : (
      <Button onClick={() => onPopOut(instance.id)} variant="ghost">
        Pop out
      </Button>
    );

  const frameActions = (
    <>
      {presentationMode === "popped-out" ? (
        <Button
          aria-label={`Move ${instance.title || "widget"} popout`}
          className="widget-drag-handle"
          onPointerDown={startPopoutDrag}
          title="Drag popout"
          variant="ghost"
        >
          Move
        </Button>
      ) : null}
      {presentationAction}
    </>
  );
  const frameStyle = widgetFrameStyle(instance, presentationMode);
  const loadLogs = () => widgetActions.listWidgetLogs(instance.id);
  const logRefreshToken = widgetActions.logRefreshTokens[instance.id] ?? 0;

  if (!definition) {
    return (
      <WidgetFrame
        actions={frameActions}
        logRefreshToken={logRefreshToken}
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

  if (!Component) {
    return (
      <WidgetFrame
        actions={frameActions}
        logRefreshToken={logRefreshToken}
        onLoadLogs={loadLogs}
        style={frameStyle}
        status={<Badge variant="warning">Missing</Badge>}
        subtitle={`Component "${definition.componentKey}" is not mapped.`}
        title={instance.title || definition.defaultTitle}
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
      frameStyle={frameStyle}
      instance={instance}
      logRefreshToken={logRefreshToken}
      onLoadLogs={widgetActions.listWidgetLogs}
      onUpdateLayout={widgetActions.updateWidgetLayout}
      onUpdateState={widgetActions.updateWidgetState}
      title={instance.title || definition.defaultTitle}
    />
  );
}

function widgetFrameStyle(
  instance: WidgetInstance,
  presentationMode: WidgetPresentationMode,
): CSSProperties | undefined {
  if (presentationMode === "popped-out" || instance.layout.mode !== "docked") {
    return undefined;
  }

  return {
    height: `${instance.layout.height}px`,
    minHeight: `${instance.layout.height}px`,
    width: `min(100%, ${instance.layout.width}px)`,
  };
}
