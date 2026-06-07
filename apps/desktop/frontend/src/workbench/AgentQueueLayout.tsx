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
  detailsPanel?: ReactNode;
  isFlowMapView?: boolean;
  layoutKey?: string;
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
const RAIL_WIDTH_STORAGE_PREFIX = "hobit.agentQueue.railWidths.";

type ResizeTarget = "left" | "right";
type RailWidths = {
  left: number;
  right: number;
};

const sessionRailWidths = new Map<string, RailWidths>();

export function AgentQueueLayout({
  detailsPanel,
  isFlowMapView = false,
  layoutKey = "default",
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
  const [leftRailWidth, setLeftRailWidth] = useState(
    () => readRailWidths(layoutKey).left,
  );
  const [rightRailWidth, setRightRailWidth] = useState(
    () => readRailWidths(layoutKey).right,
  );
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
    const widths = readRailWidths(layoutKey);
    setLeftRailWidth(widths.left);
    setRightRailWidth(widths.right);
  }, [layoutKey]);

  const persistRailWidths = useCallback(
    (nextWidths: RailWidths) => {
      writeRailWidths(layoutKey, nextWidths);
    },
    [layoutKey],
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
        const nextLeftWidth = clampRailWidth({
            layoutWidth: resizeStart.layoutWidth,
            max: MAX_LEFT_RAIL_WIDTH,
            min: MIN_LEFT_RAIL_WIDTH,
            nextWidth:
              resizeStart.leftRailWidth + event.clientX - resizeStart.clientX,
            otherRailWidth: resizeStart.rightRailWidth,
        });
        setLeftRailWidth(nextLeftWidth);
        persistRailWidths({
          left: nextLeftWidth,
          right: resizeStart.rightRailWidth,
        });
        return;
      }

      const nextRightWidth = clampRailWidth({
          layoutWidth: resizeStart.layoutWidth,
          max: MAX_RIGHT_RAIL_WIDTH,
          min: MIN_RIGHT_RAIL_WIDTH,
          nextWidth:
            resizeStart.rightRailWidth - event.clientX + resizeStart.clientX,
          otherRailWidth: resizeStart.leftRailWidth,
      });
      setRightRailWidth(nextRightWidth);
      persistRailWidths({
        left: resizeStart.leftRailWidth,
        right: nextRightWidth,
      });
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
  }, [clampRailWidth, isResizing, persistRailWidths]);

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
    persistRailWidths({
      left: DEFAULT_LEFT_RAIL_WIDTH,
      right: DEFAULT_RIGHT_RAIL_WIDTH,
    });
  }

  const style = {
    "--agent-queue-left-rail-width": `${leftRailWidth}px`,
    "--agent-queue-right-rail-width": `${rightRailWidth}px`,
  } as CSSProperties;

  return (
    <div
      className={agentQueueLayoutClassName({
        hasDetailsPanel: Boolean(detailsPanel),
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
      {detailsPanel ? detailsPanel : null}
    </div>
  );
}

function agentQueueLayoutClassName({
  hasDetailsPanel,
  isFlowMapView,
  isResizing,
}: {
  hasDetailsPanel: boolean;
  isFlowMapView: boolean;
  isResizing: boolean;
}) {
  const classNames = ["agent-queue-product-layout"];

  if (!hasDetailsPanel) {
    classNames.push("agent-queue-product-layout-no-details");
  }

  if (isFlowMapView) {
    classNames.push("agent-queue-product-layout-flow");
  }

  if (isResizing) {
    classNames.push("agent-queue-product-layout-resizing");
  }

  return classNames.join(" ");
}

function readRailWidths(layoutKey: string): RailWidths {
  const storedWidths =
    readStoredRailWidths(layoutKey) ?? sessionRailWidths.get(layoutKey);

  return {
    left: clampStoredWidth(
      storedWidths?.left,
      MIN_LEFT_RAIL_WIDTH,
      MAX_LEFT_RAIL_WIDTH,
      DEFAULT_LEFT_RAIL_WIDTH,
    ),
    right: clampStoredWidth(
      storedWidths?.right,
      MIN_RIGHT_RAIL_WIDTH,
      MAX_RIGHT_RAIL_WIDTH,
      DEFAULT_RIGHT_RAIL_WIDTH,
    ),
  };
}

function writeRailWidths(layoutKey: string, widths: RailWidths) {
  sessionRailWidths.set(layoutKey, widths);

  if (typeof window === "undefined") {
    return;
  }

  try {
    window.sessionStorage.setItem(
      `${RAIL_WIDTH_STORAGE_PREFIX}${layoutKey}`,
      JSON.stringify(widths),
    );
  } catch {
    // Session persistence is best effort; in-memory persistence still covers remounts.
  }
}

function readStoredRailWidths(layoutKey: string): Partial<RailWidths> | null {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const rawValue = window.sessionStorage.getItem(
      `${RAIL_WIDTH_STORAGE_PREFIX}${layoutKey}`,
    );

    if (!rawValue) {
      sessionRailWidths.delete(layoutKey);
      return null;
    }

    const parsedValue = JSON.parse(rawValue) as Partial<RailWidths>;
    sessionRailWidths.set(layoutKey, {
      left: Number(parsedValue.left),
      right: Number(parsedValue.right),
    });
    return parsedValue;
  } catch {
    return null;
  }
}

function clampStoredWidth(
  value: number | undefined,
  min: number,
  max: number,
  fallback: number,
) {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.max(min, Math.min(max, value))
    : fallback;
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
