import {
  isValidElement,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
  type ReactElement,
  type ReactNode,
  useId,
  useRef,
  useState,
} from "react";
import { Button } from "../actions/Button";
import { WidgetInfoPopover } from "../overlays/WidgetInfoPopover";
import { Panel } from "../layout/Panel";
import {
  WidgetLogsPanel,
  type WidgetLogsPanelLogEntry,
} from "./WidgetLogsPanel";

export type WidgetFrameLogEntry = WidgetLogsPanelLogEntry;

type WidgetFrameProps = {
  actions?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  info?: string;
  logRefreshToken?: number;
  moveEnabled?: boolean;
  onMoveStart?: (pointerX: number, pointerY: number) => void;
  onLoadLogs?: () => Promise<WidgetFrameLogEntry[]>;
  style?: CSSProperties;
  status?: ReactNode;
  subtitle?: string;
  title: string;
};

export function WidgetFrame({
  actions,
  children,
  footer,
  info,
  logRefreshToken,
  moveEnabled = false,
  onMoveStart,
  onLoadLogs,
  style,
  status,
  subtitle,
  title,
}: WidgetFrameProps) {
  const logPanelId = useId();
  const logPanelTitleId = useId();
  const logButtonRef = useRef<HTMLButtonElement | null>(null);
  const [isLogPanelOpen, setIsLogPanelOpen] = useState(false);
  const resolvedInfo = info ?? subtitle;
  const normalizedStatusText = extractText(status).trim().toLowerCase();
  const normalizedTitle = normalizeText(title);
  const normalizedInfo = normalizeText(resolvedInfo ?? "");
  const shouldRenderStatus =
    Boolean(status) &&
    (!normalizedStatusText ||
      ![
        normalizedTitle,
        normalizedInfo,
      ].some((entry) => entry && normalizedStatusText === entry));

  function startMove(event: ReactPointerEvent<HTMLElement>) {
    if (
      !moveEnabled ||
      !onMoveStart ||
      !event.isPrimary ||
      event.button !== 0 ||
      isInteractiveHeaderTarget(event.target)
    ) {
      return;
    }

    event.preventDefault();
    onMoveStart(event.clientX, event.clientY);
  }

  const frameClassName = moveEnabled
    ? "widget-frame widget-frame-editing"
    : "widget-frame";
  const headerClassName = moveEnabled
    ? "widget-header widget-header-movable"
    : "widget-header";
  return (
    <Panel className={frameClassName} style={style}>
      <header className={headerClassName} onPointerDown={startMove}>
        <div className="widget-heading">
          <div className="widget-title-row">
            <h2 className="widget-title" title={title}>
              {title}
            </h2>
            {resolvedInfo ? (
              <WidgetInfoPopover label="Widget information" title={title}>
                {resolvedInfo}
              </WidgetInfoPopover>
            ) : null}
            {shouldRenderStatus ? (
              <div className="widget-status">{status}</div>
            ) : null}
          </div>
        </div>
        <div className="widget-actions">
          {actions}
          {onLoadLogs ? (
            <Button
              aria-controls={logPanelId}
              aria-label="Widget logs"
              aria-expanded={isLogPanelOpen}
              className="widget-icon-button"
              onClick={() => setIsLogPanelOpen((current) => !current)}
              ref={logButtonRef}
              title="Widget debug details"
              variant={isLogPanelOpen ? "secondary" : "ghost"}
            >
              ...
            </Button>
          ) : null}
        </div>
      </header>
      <div className="widget-content">{children}</div>
      <WidgetLogsPanel
        anchorRef={logButtonRef}
        id={logPanelId}
        isOpen={isLogPanelOpen}
        logRefreshToken={logRefreshToken}
        onClose={() => setIsLogPanelOpen(false)}
        onLoadLogs={onLoadLogs}
        titleId={logPanelTitleId}
      />
      {footer ? <footer className="widget-footer">{footer}</footer> : null}
    </Panel>
  );
}

function isInteractiveHeaderTarget(target: EventTarget) {
  if (!(target instanceof Element)) {
    return false;
  }

  return Boolean(
    target.closest(
      [
        ".widget-actions",
        ".terminal-pty-output",
        ".terminal-pty-stdin",
        ".terminal-placeholder-output",
        ".terminal-output-preview",
        "a",
        "button",
        "details",
        "input",
        "label",
        "option",
        "select",
        "textarea",
        "summary",
        "[contenteditable='true']",
        "[data-widget-header-drag-ignore]",
        "[role='button']",
        "[role='checkbox']",
        "[role='combobox']",
        "[role='link']",
        "[role='menu']",
        "[role='menuitem']",
        "[role='option']",
        "[role='scrollbar']",
        "[role='slider']",
        "[role='switch']",
        "[role='textbox']",
      ].join(","),
    ),
  );
}

function normalizeText(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function extractText(node: ReactNode): string {
  if (node == null || typeof node === "boolean") {
    return "";
  }

  if (typeof node === "number" || typeof node === "string") {
    return String(node);
  }

  if (Array.isArray(node)) {
    return node.map(extractText).join(" ");
  }

  if (isValidElement(node)) {
    const element = node as ReactElement<{ children?: ReactNode }>;

    return extractText(element.props.children);
  }

  return "";
}
