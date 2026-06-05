import { useEffect, useMemo, useRef, useState } from "react";
import { RendererMemoryDiagnosticsPanel } from "../diagnostics/RendererMemoryDiagnosticsPanel";
import {
  isRendererMemoryDiagnosticsEnabled,
  rendererDiagnosticsSourceFromWorkbench,
  retainedDirectWorkCharCount,
} from "../diagnostics/rendererMemoryDiagnostics";
import { WorkbenchResizeHandles } from "./WorkbenchResizeHandles";
import { WorkbenchWidgetGhost } from "./WorkbenchWidgetGhost";
import { WidgetHost } from "./WidgetHost";
import { WorkbenchEmptyCanvas } from "./WorkbenchEmptyCanvas";
import {
  mergeAgentActivityEvents,
  type AgentActivityEvent,
} from "./agentActivityModel";
import { queueExecutorSlotsFromWidgets } from "./agentQueueTaskUiModel";
import { coordinatorNotesWidgetsForCanvasWidth } from "./presets";
import { useDirectWorkGitReviewHandoff } from "./useDirectWorkGitReviewHandoff";
import { useDirectWorkRunHandoff } from "./useDirectWorkRunHandoff";
import { useWorkspaceQueueApi } from "./queue/useWorkspaceQueueApi";
import {
  AGENT_QUEUE_WIDGET_DEFINITION_ID,
  INTERACTIVE_AGENT_WIDGET_DEFINITION_ID,
  isUserFacingWidgetDefinition,
} from "./widgetRegistry";
import type { WorkbenchWidgetInstanceActions } from "./useWorkbenchWidgetActions";
import { useWorkbenchLayoutInteractions } from "./useWorkbenchLayoutInteractions";
import type {
  AgentExecutorRunOpenRequest,
  AgentExecutorRunOpenRequestInput,
  CoordinatorAttachedContextInput,
  CoordinatorAttachedContextRequest,
  WorkspaceAgentQueueReportActionCardRequest,
  WidgetInstanceId,
  WorkbenchLayoutMode,
  WorkbenchViewState,
} from "./types";
import type { AgentQueueReportActionCard } from "../workspace/types";
import {
  clampPopoutPosition,
  defaultPopoutPosition,
  removeStalePopoutPositions,
  removeStaleWidgetIds,
  visibleWidgetIdSet,
  workbenchCanvasGridStyle,
  widgetDockedSize,
  widgetLayoutItemStyle,
  widgetLayoutSurfaceStyle,
  widgetPopoutLayerStyle,
  type PopoutPosition,
  type PopoutPositionMap,
  type ResizeDirection,
  type WorkbenchGridSize,
} from "./workbenchLayoutGeometry";

type WorkbenchCanvasProps = {
  gridSize: WorkbenchGridSize;
  layoutMode: WorkbenchLayoutMode;
  onOpenWidgetCatalog: () => void;
  onStartCoordinatorWorkspace?: () => void;
  viewState: WorkbenchViewState;
  widgetActions: WorkbenchWidgetInstanceActions;
};

type ActivePopoutDrag = {
  offsetX: number;
  offsetY: number;
  widgetInstanceId: WidgetInstanceId;
};

export function WorkbenchCanvas({
  gridSize,
  layoutMode,
  onOpenWidgetCatalog,
  onStartCoordinatorWorkspace,
  viewState,
  widgetActions,
}: WorkbenchCanvasProps) {
  const [poppedOutWidgetIds, setPoppedOutWidgetIds] = useState<WidgetInstanceId[]>([]);
  const [popoutPositions, setPopoutPositions] = useState<PopoutPositionMap>({});
  const [layoutSurfaceWidth, setLayoutSurfaceWidth] = useState<number | null>(null);
  const [activePopoutDrag, setActivePopoutDrag] = useState<ActivePopoutDrag | null>(null);
  const [frontWidgetInstanceId, setFrontWidgetInstanceId] = useState<WidgetInstanceId | null>(null);
  const agentExecutorRunOpenRequestIdRef = useRef(0);
  const [agentExecutorRunOpenRequest, setAgentExecutorRunOpenRequest] =
    useState<AgentExecutorRunOpenRequest | null>(null);
  const [agentActivityEvents, setAgentActivityEvents] = useState<
    AgentActivityEvent[]
  >([]);
  const coordinatorAttachedContextRequestIdRef = useRef(0);
  const [
    coordinatorAttachedContextRequest,
    setCoordinatorAttachedContextRequest,
  ] = useState<CoordinatorAttachedContextRequest | null>(null);
  const queueReportActionCardRequestIdRef = useRef(0);
  const [
    queueReportActionCardRequest,
    setQueueReportActionCardRequest,
  ] = useState<WorkspaceAgentQueueReportActionCardRequest | null>(null);
  const userFacingWidgets = viewState.widgets.filter((widget) =>
    isUserFacingWidgetDefinition(widget.definitionId),
  );
  const visibleWidgets = userFacingWidgets
    .filter((widget) => widget.visible)
    .sort((first, second) => first.layout.order - second.layout.order);
  // Deprecated Git widget instances are filtered out of the product canvas.
  // Direct Work review uses Workspace Git APIs instead of a visible Git widget.
  const hasGitWidget = false;
  const coordinatorWidget = visibleWidgets.find(
    (widget) => widget.definitionId === INTERACTIVE_AGENT_WIDGET_DEFINITION_ID,
  );
  const queueWidget = visibleWidgets.find(
    (widget) => widget.definitionId === AGENT_QUEUE_WIDGET_DEFINITION_ID,
  );
  const queueExecutorSlots = useMemo(
    () => queueExecutorSlotsFromWidgets(viewState.widgets),
    [viewState.widgets],
  );
  const directWorkGitReview = useDirectWorkGitReviewHandoff();
  const directWorkRunHandoff = useDirectWorkRunHandoff();
  const workspaceQueueApi = useWorkspaceQueueApi({
    actions: widgetActions,
    directWorkRunHandoff,
    queueExecutorSlots,
    workspaceId: viewState.workspace.id,
  });
  const canvasLabel = `${viewState.workbench.preset.title} canvas`;
  const isLayoutEditing = layoutMode === "editing";
  const renderedVisibleWidgets = isLayoutEditing
    ? visibleWidgets
    : coordinatorNotesWidgetsForCanvasWidth({
        canvasWidth: layoutSurfaceWidth,
        presetId: viewState.workbench.preset.id,
        widgets: visibleWidgets,
      });
  const memoryDiagnosticsEnabled = isRendererMemoryDiagnosticsEnabled();
  const memoryDiagnosticsSource = useMemo(
    () =>
      rendererDiagnosticsSourceFromWorkbench({
        agentActivityEventCount: agentActivityEvents.length,
        directWorkRetainedCharCount: retainedDirectWorkCharCount(
          workspaceQueueApi.controller.runActivity.eventState.rawEvents,
        ),
        directWorkRunHandoffCount: Object.keys(directWorkRunHandoff.handoffs)
          .length,
        mountedWidgets: renderedVisibleWidgets.map((widget) => ({
          definitionId: widget.definitionId,
          id: widget.id,
        })),
        queueItemCount: workspaceQueueApi.controller.tasks.length,
        queueRunActivityEventCount:
          workspaceQueueApi.controller.runActivity.eventState.events.length,
        queueRunActivityRawEventCount:
          workspaceQueueApi.controller.runActivity.eventState.rawEvents.length,
        queueRunHistoryCount: workspaceQueueApi.controller.runHistory.totalCount,
        viewState,
      }),
    [
      agentActivityEvents.length,
      directWorkRunHandoff.handoffs,
      renderedVisibleWidgets,
      viewState,
      workspaceQueueApi.controller.runActivity.eventState.events.length,
      workspaceQueueApi.controller.runActivity.eventState.rawEvents,
      workspaceQueueApi.controller.runHistory.totalCount,
      workspaceQueueApi.controller.tasks.length,
    ],
  );
  const {
    activeDockedDragWidgetInstanceId,
    activeDockedResizeDirection,
    activeDockedResizeWidgetInstanceId,
    dockedDragPositions,
    dockedResizeSizes,
    layoutSurfaceRef,
    startDockedDrag,
    startDockedResize,
  } = useWorkbenchLayoutInteractions({
    gridSize,
    isLayoutEditing,
    visibleWidgets,
    widgetActions,
    widgets: viewState.widgets,
  });
  const canvasShellClass = "canvas-shell";
  const layoutSurfaceStyle = {
    ...widgetLayoutSurfaceStyle(
      renderedVisibleWidgets,
      dockedDragPositions,
      dockedResizeSizes,
    ),
    ...(isLayoutEditing ? {} : { minHeight: "100%" }),
  };
  const canvasGridStyle = workbenchCanvasGridStyle(gridSize);

  useEffect(() => {
    setAgentActivityEvents([]);
  }, [viewState.workspace.id]);

  useEffect(() => {
    if (!workspaceQueueApi.queueItemOpenRequest || !queueWidget) {
      return;
    }

    const target =
      typeof document === "undefined"
        ? null
        : Array.from(
            document.querySelectorAll<HTMLElement>("[data-widget-instance-id]"),
          ).find((element) => element.dataset.widgetInstanceId === queueWidget.id);

    target?.scrollIntoView({
      block: "nearest",
      inline: "nearest",
    });
  }, [queueWidget?.id, workspaceQueueApi.queueItemOpenRequest?.id]);

  useEffect(() => {
    const surface = layoutSurfaceRef.current;

    if (!surface) {
      return;
    }

    const observedSurface = surface;

    function updateSurfaceWidth() {
      setLayoutSurfaceWidth(observedSurface.getBoundingClientRect().width);
    }

    updateSurfaceWidth();

    if (typeof ResizeObserver === "undefined") {
      window.addEventListener("resize", updateSurfaceWidth);

      return () => {
        window.removeEventListener("resize", updateSurfaceWidth);
      };
    }

    const resizeObserver = new ResizeObserver(updateSurfaceWidth);

    resizeObserver.observe(observedSurface);

    return () => {
      resizeObserver.disconnect();
    };
  }, [visibleWidgets.length]);

  useEffect(() => {
    const visibleWidgetIds = visibleWidgetIdSet(visibleWidgets);

    setFrontWidgetInstanceId((currentId) =>
      currentId && visibleWidgetIds.has(currentId) ? currentId : null,
    );
    setPoppedOutWidgetIds((currentIds) =>
      removeStaleWidgetIds(currentIds, visibleWidgetIds),
    );
    setPopoutPositions((currentPositions) =>
      removeStalePopoutPositions(currentPositions, visibleWidgetIds),
    );
  }, [viewState.widgets]);

  useEffect(() => {
    if (!activePopoutDrag) {
      return;
    }

    const drag = activePopoutDrag;

    document.body.classList.add("widget-popout-dragging");

    function movePopout(event: PointerEvent) {
      setPopoutPositions((currentPositions) => ({
        ...currentPositions,
        [drag.widgetInstanceId]: clampPopoutPosition({
          x: event.clientX - drag.offsetX,
          y: event.clientY - drag.offsetY,
        }),
      }));
    }

    function finishDrag() {
      setActivePopoutDrag(null);
    }

    window.addEventListener("pointermove", movePopout);
    window.addEventListener("pointerup", finishDrag);
    window.addEventListener("pointercancel", finishDrag);

    return () => {
      document.body.classList.remove("widget-popout-dragging");
      window.removeEventListener("pointermove", movePopout);
      window.removeEventListener("pointerup", finishDrag);
      window.removeEventListener("pointercancel", finishDrag);
    };
  }, [activePopoutDrag]);

  useEffect(() => {
    function clampPositionsToViewport() {
      setPopoutPositions((currentPositions) => {
        const nextPositions = { ...currentPositions };

        for (const widgetId of Object.keys(nextPositions)) {
          const position = nextPositions[widgetId];

          if (position) {
            nextPositions[widgetId] = clampPopoutPosition(position);
          }
        }

        return nextPositions;
      });
    }

    window.addEventListener("resize", clampPositionsToViewport);

    return () => {
      window.removeEventListener("resize", clampPositionsToViewport);
    };
  }, []);

  function popOutWidget(widgetInstanceId: WidgetInstanceId) {
    setFrontWidgetInstanceId(widgetInstanceId);
    setPoppedOutWidgetIds((currentIds) =>
      currentIds.includes(widgetInstanceId)
        ? currentIds
        : [...currentIds, widgetInstanceId],
    );
    setPopoutPositions((currentPositions) => ({
      ...currentPositions,
      [widgetInstanceId]:
        currentPositions[widgetInstanceId] ?? defaultPopoutPosition(),
    }));
  }

  function dockBackWidget(widgetInstanceId: WidgetInstanceId) {
    setFrontWidgetInstanceId(widgetInstanceId);
    setPoppedOutWidgetIds((currentIds) =>
      currentIds.filter((currentId) => currentId !== widgetInstanceId),
    );
    setPopoutPositions((currentPositions) => {
      const nextPositions = { ...currentPositions };

      delete nextPositions[widgetInstanceId];

      return nextPositions;
    });
    setActivePopoutDrag((currentDrag) =>
      currentDrag?.widgetInstanceId === widgetInstanceId ? null : currentDrag,
    );
  }

  function startPopoutDrag(
    widgetInstanceId: WidgetInstanceId,
    pointerX: number,
    pointerY: number,
  ) {
    setFrontWidgetInstanceId(widgetInstanceId);
    const currentPosition =
      popoutPositions[widgetInstanceId] ?? defaultPopoutPosition();

    setPopoutPositions((currentPositions) => ({
      ...currentPositions,
      [widgetInstanceId]: currentPosition,
    }));
    setActivePopoutDrag({
      offsetX: pointerX - currentPosition.x,
      offsetY: pointerY - currentPosition.y,
      widgetInstanceId,
    });
  }

  function openAgentExecutorRun(request: AgentExecutorRunOpenRequestInput) {
    const executorWidgetInstanceId = request.executorWidgetInstanceId.trim();
    const runId = request.runId.trim();

    if (!executorWidgetInstanceId || !runId) {
      return;
    }

    const target =
      typeof document === "undefined"
        ? null
        : Array.from(
            document.querySelectorAll<HTMLElement>("[data-widget-instance-id]"),
          ).find(
            (element) =>
              element.dataset.widgetInstanceId === executorWidgetInstanceId,
          );

    target?.scrollIntoView({
      block: "nearest",
      inline: "nearest",
    });
    setAgentExecutorRunOpenRequest({
      executorWidgetInstanceId,
      id: ++agentExecutorRunOpenRequestIdRef.current,
      runId,
    });
  }

  function startWidgetDrag(
    widgetInstanceId: WidgetInstanceId,
    pointerX: number,
    pointerY: number,
  ) {
    setFrontWidgetInstanceId(widgetInstanceId);
    startDockedDrag(widgetInstanceId, pointerX, pointerY);
  }

  function startWidgetResize(
    widgetInstanceId: WidgetInstanceId,
    direction: ResizeDirection,
    pointerX: number,
    pointerY: number,
  ) {
    setFrontWidgetInstanceId(widgetInstanceId);
    startDockedResize(widgetInstanceId, direction, pointerX, pointerY);
  }

  function attachContextToCoordinator(request: CoordinatorAttachedContextInput) {
    const contextText = request.contextText.trim();
    const sourceLabel = request.sourceLabel.trim();

    if (!contextText || !sourceLabel || !coordinatorWidget) {
      return;
    }

    const target =
      typeof document === "undefined"
        ? null
        : Array.from(
            document.querySelectorAll<HTMLElement>("[data-widget-instance-id]"),
          ).find(
            (element) => element.dataset.widgetInstanceId === coordinatorWidget.id,
          );

    target?.scrollIntoView({
      block: "nearest",
      inline: "nearest",
    });
    setCoordinatorAttachedContextRequest({
      contextText,
      id: ++coordinatorAttachedContextRequestIdRef.current,
      sourceLabel,
      targetCoordinatorWidgetInstanceId: coordinatorWidget.id,
    });
  }

  function showQueueReportInWorkspaceChat(card: AgentQueueReportActionCard) {
    if (!coordinatorWidget) {
      return;
    }

    const target =
      typeof document === "undefined"
        ? null
        : Array.from(
            document.querySelectorAll<HTMLElement>("[data-widget-instance-id]"),
          ).find(
            (element) => element.dataset.widgetInstanceId === coordinatorWidget.id,
          );

    target?.scrollIntoView({
      block: "nearest",
      inline: "nearest",
    });
    setQueueReportActionCardRequest({
      card,
      id: ++queueReportActionCardRequestIdRef.current,
      targetCoordinatorWidgetInstanceId: coordinatorWidget.id,
    });
  }

  function publishAgentActivityEvents(events: AgentActivityEvent[]) {
    const workspaceId = viewState.workspace.id;
    const scopedEvents = events.filter((event) => event.workspaceId === workspaceId);

    if (scopedEvents.length === 0) {
      return;
    }

    setAgentActivityEvents((currentEvents) =>
      mergeAgentActivityEvents(currentEvents, scopedEvents),
    );
  }

  if (visibleWidgets.length === 0) {
    return (
      <>
        <WorkbenchEmptyCanvas
          canvasGridStyle={canvasGridStyle}
          canvasLabel={canvasLabel}
          canvasShellClass={canvasShellClass}
          onOpenWidgetCatalog={onOpenWidgetCatalog}
          onStartCoordinatorWorkspace={
            onStartCoordinatorWorkspace ?? onOpenWidgetCatalog
          }
        />
        {memoryDiagnosticsEnabled ? (
          <RendererMemoryDiagnosticsPanel source={memoryDiagnosticsSource} />
        ) : null}
      </>
    );
  }

  return (
    <>
      <section
        className={canvasShellClass}
        aria-label={canvasLabel}
        style={canvasGridStyle}
      >
        <div className="canvas-stack">
          <div
            className="widget-layout-surface"
            ref={layoutSurfaceRef}
            style={layoutSurfaceStyle}
          >
            {renderedVisibleWidgets.map((widget) => {
              const isPoppedOut = poppedOutWidgetIds.includes(widget.id);
              const isDragging = activeDockedDragWidgetInstanceId === widget.id;
              const isResizing =
                activeDockedResizeWidgetInstanceId === widget.id;
              const itemClassName = isDragging
                ? "widget-layout-item widget-layout-item-dragging"
                : isResizing
                  ? "widget-layout-item widget-layout-item-resizing"
                  : "widget-layout-item";
              const dockedSize =
                dockedResizeSizes[widget.id] ?? widgetDockedSize(widget);

              return (
                <div
                  className={itemClassName}
                  data-widget-instance-id={widget.id}
                  key={widget.id}
                  onFocusCapture={() => setFrontWidgetInstanceId(widget.id)}
                  onPointerDownCapture={() =>
                    setFrontWidgetInstanceId(widget.id)
                  }
                  style={{
                    ...widgetLayoutItemStyle(
                      widget,
                      dockedDragPositions,
                      dockedResizeSizes,
                    ),
                    zIndex:
                      isDragging || isResizing
                        ? 20
                        : frontWidgetInstanceId === widget.id
                          ? 18
                          : undefined,
                  }}
                >
                  {isPoppedOut ? (
                    <>
                      <WorkbenchWidgetGhost
                        instance={widget}
                        onDockBack={dockBackWidget}
                      />
                      <div
                        aria-label={`${widget.title} floating widget`}
                        className="widget-popout-layer"
                        role="dialog"
                        style={{
                          ...widgetPopoutLayerStyle(popoutPositions[widget.id]),
                          zIndex:
                            frontWidgetInstanceId === widget.id ? 50 : undefined,
                        }}
                      >
                        <WidgetHost
                          agentActivityEvents={agentActivityEvents}
                          agentExecutorRunOpenRequest={
                            agentExecutorRunOpenRequest
                          }
                          coordinatorAttachedContextRequest={
                            coordinatorAttachedContextRequest
                          }
                          queueReportActionCardRequest={
                            queueReportActionCardRequest
                          }
                          directWorkGitReview={directWorkGitReview}
                          directWorkRunHandoff={directWorkRunHandoff}
                          hasGitWidget={hasGitWidget}
                          instance={widget}
                          layoutMode={layoutMode}
                          onDockBack={dockBackWidget}
                          onAttachContextToCoordinator={
                            coordinatorWidget
                              ? attachContextToCoordinator
                              : undefined
                          }
                          onShowQueueReportInWorkspaceChat={
                            coordinatorWidget
                              ? showQueueReportInWorkspaceChat
                              : undefined
                          }
                          onPublishAgentActivityEvents={
                            publishAgentActivityEvents
                          }
                          onOpenAgentExecutorRun={openAgentExecutorRun}
                          onPopOut={popOutWidget}
                          onStartDockedDrag={startWidgetDrag}
                          onStartPopoutDrag={startPopoutDrag}
                          presentationMode="popped-out"
                          widgetActions={widgetActions}
                          workspaceQueueApi={workspaceQueueApi}
                          workspaceId={viewState.workspace.id}
                        />
                      </div>
                    </>
                  ) : (
                    <div className="widget-docked-surface">
                      <WidgetHost
                        agentActivityEvents={agentActivityEvents}
                        agentExecutorRunOpenRequest={
                          agentExecutorRunOpenRequest
                        }
                        coordinatorAttachedContextRequest={
                          coordinatorAttachedContextRequest
                        }
                        queueReportActionCardRequest={
                          queueReportActionCardRequest
                        }
                        dockedSize={dockedSize}
                        directWorkGitReview={directWorkGitReview}
                        directWorkRunHandoff={directWorkRunHandoff}
                        hasGitWidget={hasGitWidget}
                        instance={widget}
                        layoutMode={layoutMode}
                        onDockBack={dockBackWidget}
                        onAttachContextToCoordinator={
                          coordinatorWidget
                            ? attachContextToCoordinator
                            : undefined
                        }
                        onShowQueueReportInWorkspaceChat={
                          coordinatorWidget
                            ? showQueueReportInWorkspaceChat
                            : undefined
                        }
                        onPublishAgentActivityEvents={publishAgentActivityEvents}
                        onOpenAgentExecutorRun={openAgentExecutorRun}
                        onPopOut={popOutWidget}
                        onStartDockedDrag={startWidgetDrag}
                        onStartPopoutDrag={startPopoutDrag}
                        presentationMode="docked"
                        widgetActions={widgetActions}
                        workspaceQueueApi={workspaceQueueApi}
                        workspaceId={viewState.workspace.id}
                      />
                      {isLayoutEditing && widget.layout.mode === "docked" ? (
                        <WorkbenchResizeHandles
                          activeDirection={
                            isResizing ? activeDockedResizeDirection : null
                          }
                          onStartResize={(direction, pointerX, pointerY) =>
                            startWidgetResize(
                              widget.id,
                              direction,
                              pointerX,
                              pointerY,
                            )
                          }
                        />
                      ) : null}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </section>
      {memoryDiagnosticsEnabled ? (
        <RendererMemoryDiagnosticsPanel source={memoryDiagnosticsSource} />
      ) : null}
    </>
  );
}
