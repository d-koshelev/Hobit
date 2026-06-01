import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";

type AgentQueueLayoutProps = {
  detailsPanel: ReactNode;
  isFlowMapView?: boolean;
  sidebar: ReactNode;
  taskList: ReactNode;
};

const DEFAULT_LEFT_RAIL_WIDTH = 220;
const MIN_LEFT_RAIL_WIDTH = 180;
const MAX_LEFT_RAIL_WIDTH = 360;
const DEFAULT_RIGHT_RAIL_WIDTH = 320;
const MIN_RIGHT_RAIL_WIDTH = 220;
const MAX_RIGHT_RAIL_WIDTH = 520;
const MIN_FLOW_MAP_WIDTH = 520;
const RESIZE_HANDLE_TOTAL_WIDTH = 20;

type ResizeTarget = "left" | "right";

export function AgentQueueLayout({
  detailsPanel,
  isFlowMapView = false,
  sidebar,
  taskList,
}: AgentQueueLayoutProps) {
  const layoutRef = useRef<HTMLDivElement | null>(null);
  const resizeStartRef = useRef<{
    clientX: number;
    leftRailWidth: number;
    layoutWidth: number;
    rightRailWidth: number;
    target: ResizeTarget;
  } | null>(null);
  const [leftRailWidth, setLeftRailWidth] = useState(DEFAULT_LEFT_RAIL_WIDTH);
  const [rightRailWidth, setRightRailWidth] = useState(DEFAULT_RIGHT_RAIL_WIDTH);
  const [isResizing, setIsResizing] = useState(false);

  const clampRailWidth = useCallback(
    ({
      layoutWidth,
      max,
      min,
      nextWidth,
      otherRailWidth,
    }: {
      layoutWidth: number;
      max: number;
      min: number;
      nextWidth: number;
      otherRailWidth: number;
    }) => {
      const availableMax =
        layoutWidth > 0
          ? layoutWidth -
            otherRailWidth -
            MIN_FLOW_MAP_WIDTH -
            RESIZE_HANDLE_TOTAL_WIDTH
          : max;
      const maxWidth = Math.max(min, Math.min(max, availableMax));

      return Math.max(min, Math.min(maxWidth, nextWidth));
    },
    [],
  );

  useEffect(() => {
    if (!isResizing) {
      return undefined;
    }

    const previousBodyCursor = document.body.style.cursor;
    const previousBodyUserSelect = document.body.style.userSelect;
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";

    function handlePointerMove(event: PointerEvent) {
      const resizeStart = resizeStartRef.current;

      if (!resizeStart) {
        return;
      }

      if (resizeStart.target === "left") {
        setLeftRailWidth(
          clampRailWidth({
            layoutWidth: resizeStart.layoutWidth,
            max: MAX_LEFT_RAIL_WIDTH,
            min: MIN_LEFT_RAIL_WIDTH,
            nextWidth:
              resizeStart.leftRailWidth + event.clientX - resizeStart.clientX,
            otherRailWidth: resizeStart.rightRailWidth,
          }),
        );
        return;
      }

      setRightRailWidth(
        clampRailWidth({
          layoutWidth: resizeStart.layoutWidth,
          max: MAX_RIGHT_RAIL_WIDTH,
          min: MIN_RIGHT_RAIL_WIDTH,
          nextWidth:
            resizeStart.rightRailWidth - event.clientX + resizeStart.clientX,
          otherRailWidth: resizeStart.leftRailWidth,
        }),
      );
    }

    function handlePointerUp() {
      resizeStartRef.current = null;
      setIsResizing(false);
    }

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
    window.addEventListener("pointercancel", handlePointerUp);

    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
      window.removeEventListener("pointercancel", handlePointerUp);
      document.body.style.cursor = previousBodyCursor;
      document.body.style.userSelect = previousBodyUserSelect;
    };
  }, [clampRailWidth, isResizing]);

  function startColumnResize(
    target: ResizeTarget,
    event: ReactPointerEvent<HTMLButtonElement>,
  ) {
    if (!isFlowMapView || !event.isPrimary || event.button !== 0) {
      return;
    }

    const layoutRect = layoutRef.current?.getBoundingClientRect();

    if (!layoutRect) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    resizeStartRef.current = {
      clientX: event.clientX,
      leftRailWidth,
      layoutWidth: layoutRect.width,
      rightRailWidth,
      target,
    };
    setIsResizing(true);
  }

  function resetColumnWidths() {
    setLeftRailWidth(DEFAULT_LEFT_RAIL_WIDTH);
    setRightRailWidth(DEFAULT_RIGHT_RAIL_WIDTH);
  }

  const style = {
    "--agent-queue-left-rail-width": `${leftRailWidth}px`,
    "--agent-queue-right-rail-width": `${rightRailWidth}px`,
  } as CSSProperties;

  return (
    <div
      className={agentQueueLayoutClassName({
        isFlowMapView,
        isResizing,
      })}
      ref={layoutRef}
      style={style}
    >
      {sidebar}
      {isFlowMapView ? (
        <AgentQueueColumnResizeHandle
          ariaLabel="Resize Queue controls rail"
          ariaValueMax={MAX_LEFT_RAIL_WIDTH}
          ariaValueMin={MIN_LEFT_RAIL_WIDTH}
          ariaValueNow={leftRailWidth}
          onDoubleClick={resetColumnWidths}
          onPointerDown={(event) => startColumnResize("left", event)}
          title="Drag to resize Queue controls. Double-click to reset columns."
        />
      ) : null}
      {taskList}
      {isFlowMapView ? (
        <AgentQueueColumnResizeHandle
          ariaLabel="Resize selected item rail"
          ariaValueMax={MAX_RIGHT_RAIL_WIDTH}
          ariaValueMin={MIN_RIGHT_RAIL_WIDTH}
          ariaValueNow={rightRailWidth}
          onDoubleClick={resetColumnWidths}
          onPointerDown={(event) => startColumnResize("right", event)}
          title="Drag to resize selected item rail. Double-click to reset columns."
        />
      ) : null}
      {detailsPanel}
    </div>
  );
}

function agentQueueLayoutClassName({
  isFlowMapView,
  isResizing,
}: {
  isFlowMapView: boolean;
  isResizing: boolean;
}) {
  const classNames = ["agent-queue-product-layout"];

  if (isFlowMapView) {
    classNames.push("agent-queue-product-layout-flow");
  }

  if (isResizing) {
    classNames.push("agent-queue-product-layout-resizing");
  }

  return classNames.join(" ");
}

function AgentQueueColumnResizeHandle({
  ariaLabel,
  ariaValueMax,
  ariaValueMin,
  ariaValueNow,
  onDoubleClick,
  onPointerDown,
  title,
}: {
  ariaLabel: string;
  ariaValueMax: number;
  ariaValueMin: number;
  ariaValueNow: number;
  onDoubleClick: () => void;
  onPointerDown: (event: ReactPointerEvent<HTMLButtonElement>) => void;
  title: string;
}) {
  return (
    <button
      aria-label={ariaLabel}
      aria-orientation="vertical"
      aria-valuemax={ariaValueMax}
      aria-valuemin={ariaValueMin}
      aria-valuenow={ariaValueNow}
      className="agent-queue-column-resize-handle"
      onDoubleClick={onDoubleClick}
      onPointerDown={onPointerDown}
      role="separator"
      title={title}
      type="button"
    />
  );
}
