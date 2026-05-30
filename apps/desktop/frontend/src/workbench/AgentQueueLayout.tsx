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
  isTaskPaneResizable?: boolean;
  sidebar: ReactNode;
  taskList: ReactNode;
};

const DEFAULT_TASK_PANE_WIDTH = 320;
const MIN_TASK_PANE_WIDTH = 240;
const MAX_TASK_PANE_WIDTH = 460;
const MIN_DETAILS_PANE_WIDTH = 360;

export function AgentQueueLayout({
  detailsPanel,
  isTaskPaneResizable = false,
  sidebar,
  taskList,
}: AgentQueueLayoutProps) {
  const layoutRef = useRef<HTMLDivElement | null>(null);
  const resizeStartRef = useRef<{
    taskPaneLeft: number;
    layoutWidth: number;
  } | null>(null);
  const [taskPaneWidth, setTaskPaneWidth] = useState(DEFAULT_TASK_PANE_WIDTH);
  const [isResizing, setIsResizing] = useState(false);

  const clampTaskPaneWidth = useCallback((nextWidth: number) => {
    const layoutWidth = resizeStartRef.current?.layoutWidth;
    const maxWidth = layoutWidth
      ? Math.min(MAX_TASK_PANE_WIDTH, layoutWidth - MIN_DETAILS_PANE_WIDTH)
      : MAX_TASK_PANE_WIDTH;

    return Math.max(
      MIN_TASK_PANE_WIDTH,
      Math.min(Math.max(MIN_TASK_PANE_WIDTH, maxWidth), nextWidth),
    );
  }, []);

  useEffect(() => {
    if (!isResizing) {
      return undefined;
    }

    function handlePointerMove(event: PointerEvent) {
      const resizeStart = resizeStartRef.current;

      if (!resizeStart) {
        return;
      }

      setTaskPaneWidth(
        clampTaskPaneWidth(event.clientX - resizeStart.taskPaneLeft),
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
    };
  }, [clampTaskPaneWidth, isResizing]);

  function startTaskPaneResize(event: ReactPointerEvent<HTMLButtonElement>) {
    if (!isTaskPaneResizable || !event.isPrimary || event.button !== 0) {
      return;
    }

    const layoutRect = layoutRef.current?.getBoundingClientRect();
    const taskPaneRect =
      event.currentTarget.previousElementSibling?.getBoundingClientRect();

    if (!layoutRect || !taskPaneRect) {
      return;
    }

    event.preventDefault();
    resizeStartRef.current = {
      taskPaneLeft: taskPaneRect.left,
      layoutWidth: layoutRect.width,
    };
    setIsResizing(true);
  }

  const style = {
    "--agent-queue-task-pane-width": `${taskPaneWidth}px`,
  } as CSSProperties;

  return (
    <div
      className={agentQueueLayoutClassName({
        isResizable: isTaskPaneResizable,
        isResizing,
      })}
      ref={layoutRef}
      style={style}
    >
      {sidebar}
      {taskList}
      {isTaskPaneResizable ? (
        <button
          aria-label="Resize Tasks pane"
          aria-orientation="vertical"
          aria-valuemax={MAX_TASK_PANE_WIDTH}
          aria-valuemin={MIN_TASK_PANE_WIDTH}
          aria-valuenow={taskPaneWidth}
          className="agent-queue-task-pane-resize-handle"
          onPointerDown={startTaskPaneResize}
          role="separator"
          title="Resize Tasks pane"
          type="button"
        />
      ) : null}
      {detailsPanel}
    </div>
  );
}

function agentQueueLayoutClassName({
  isResizable,
  isResizing,
}: {
  isResizable: boolean;
  isResizing: boolean;
}) {
  const classNames = ["agent-queue-product-layout"];

  if (isResizable) {
    classNames.push("agent-queue-product-layout-resizable");
  }

  if (isResizing) {
    classNames.push("agent-queue-product-layout-resizing");
  }

  return classNames.join(" ");
}
