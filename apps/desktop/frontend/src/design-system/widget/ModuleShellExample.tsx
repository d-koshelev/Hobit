import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
} from "react";

import {
  ModuleBody,
  ModuleHeader,
  ModuleHeaderAction,
  ModuleHeaderMinimize,
  ModuleHeaderState,
  ModuleHeaderTitle,
  ModuleShell,
} from "./ModuleShell";

type PopupPosition = {
  readonly x: number;
  readonly y: number;
};

type PopupDragState = {
  readonly originX: number;
  readonly originY: number;
  readonly pointerX: number;
  readonly pointerY: number;
};

const DEFAULT_SETTINGS_POPUP_POSITION: PopupPosition = {
  x: 624,
  y: 46,
};
const SETTINGS_POPUP_WIDTH = 264;
const SETTINGS_POPUP_MARGIN = 12;

function constrainSettingsPopupInitialPosition(
  position: PopupPosition,
  boundaryWidth: number | undefined,
): PopupPosition {
  if (!boundaryWidth || boundaryWidth <= 0) {
    return position;
  }

  const maxX = Math.max(
    SETTINGS_POPUP_MARGIN,
    boundaryWidth - SETTINGS_POPUP_WIDTH - SETTINGS_POPUP_MARGIN,
  );

  return {
    x: Math.min(Math.max(position.x, SETTINGS_POPUP_MARGIN), maxX),
    y: Math.max(position.y, SETTINGS_POPUP_MARGIN),
  };
}

export function ModuleShellExample() {
  const [bodyCollapsed, setBodyCollapsed] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsDragging, setSettingsDragging] = useState(false);
  const [settingsPopupPosition, setSettingsPopupPosition] = useState(
    DEFAULT_SETTINGS_POPUP_POSITION,
  );
  const moduleShellRef = useRef<HTMLElement | null>(null);
  const settingsPopupDrag = useRef<PopupDragState | null>(null);
  const settingsPopupDragCleanup = useRef<(() => void) | null>(null);

  useEffect(() => {
    return () => {
      settingsPopupDragCleanup.current?.();
    };
  }, []);

  const settingsPopupStyle = {
    "--module-settings-popup-x": `${settingsPopupPosition.x}px`,
    "--module-settings-popup-y": `${settingsPopupPosition.y}px`,
  } as CSSProperties;

  function handleSettingsPopupDragStart(
    event: ReactPointerEvent<HTMLDivElement>,
  ) {
    if (event.button !== 0) {
      return;
    }

    event.preventDefault();
    settingsPopupDragCleanup.current?.();
    settingsPopupDrag.current = {
      originX: settingsPopupPosition.x,
      originY: settingsPopupPosition.y,
      pointerX: event.clientX,
      pointerY: event.clientY,
    };
    setSettingsDragging(true);

    const handlePointerMove = (moveEvent: PointerEvent) => {
      const drag = settingsPopupDrag.current;

      if (!drag) {
        return;
      }

      setSettingsPopupPosition({
        x: drag.originX + moveEvent.clientX - drag.pointerX,
        y: drag.originY + moveEvent.clientY - drag.pointerY,
      });
    };

    const stopDrag = () => {
      settingsPopupDragCleanup.current?.();
      settingsPopupDragCleanup.current = null;
      settingsPopupDrag.current = null;
      setSettingsDragging(false);
    };

    settingsPopupDragCleanup.current = () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", stopDrag);
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", stopDrag);
  }

  function handleSettingsOpen() {
    setSettingsPopupPosition((current) =>
      constrainSettingsPopupInitialPosition(
        current,
        moduleShellRef.current?.getBoundingClientRect().width,
      ),
    );
    setSettingsOpen(true);
  }

  return (
    <ModuleShell
      aria-label="Dummy module shell example"
      bodyCollapsed={bodyCollapsed}
      ref={moduleShellRef}
    >
      <ModuleHeader
        left={
          <>
            <ModuleHeaderTitle>Dummy Module</ModuleHeaderTitle>
            <ModuleHeaderState
              aria-label="Module state: Completed"
              tone="completed"
            >
              <span className="module-header-state-label">State</span>
              <span>Completed</span>
            </ModuleHeaderState>
          </>
        }
        right={
          <>
            <ModuleHeaderAction>Primary</ModuleHeaderAction>
            <ModuleHeaderAction>Activity</ModuleHeaderAction>
            <ModuleHeaderAction
              active={settingsOpen}
              aria-controls="module-shell-example-settings-popup"
              aria-expanded={settingsOpen}
              aria-haspopup="dialog"
              onClick={handleSettingsOpen}
            >
              Settings
            </ModuleHeaderAction>
            <ModuleHeaderAction aria-label="More dummy module actions">
              More
            </ModuleHeaderAction>
            <ModuleHeaderMinimize
              collapsed={bodyCollapsed}
              onClick={() => setBodyCollapsed((current) => !current)}
            />
          </>
        }
      />
      {settingsOpen ? (
        <div
          className="module-shell-floating-layer"
          data-module-floating-layer="true"
        >
          <div
            aria-labelledby="module-shell-example-settings-title"
            className="module-settings-popup"
            data-module-popup-floating="true"
            data-module-popup-moving={settingsDragging ? "true" : "false"}
            id="module-shell-example-settings-popup"
            role="dialog"
            style={settingsPopupStyle}
          >
            <div
              aria-label="Move settings popup"
              className="module-settings-popup-header"
              data-module-popup-drag-handle="true"
              onPointerDown={handleSettingsPopupDragStart}
              title="Drag settings popup"
            >
              <div className="module-settings-popup-header-group module-settings-popup-header-group-left">
                <span id="module-shell-example-settings-title">Settings</span>
              </div>
              <div className="module-settings-popup-header-group module-settings-popup-header-group-right">
                <button
                  aria-label="Close settings"
                  className="module-settings-popup-close"
                  onClick={() => setSettingsOpen(false)}
                  onPointerDown={(event) => event.stopPropagation()}
                  type="button"
                >
                  x
                </button>
              </div>
            </div>
            <div className="module-settings-popup-body">
              <p>Placeholder surface</p>
            </div>
          </div>
        </div>
      ) : null}
      <ModuleBody collapsed={bodyCollapsed} id="module-shell-example-body">
        <div
          aria-label="Neutral static module canvas"
          className="module-shell-example-content"
        >
          <section
            aria-label="Primary surface region"
            className="module-shell-example-region module-shell-example-region-primary"
          >
            <span className="module-shell-example-region-label">
              Primary surface
            </span>
            <p>Static clean canvas content for the shared module shell.</p>
            <span className="module-shell-example-line module-shell-example-line-strong" />
            <span className="module-shell-example-line" />
            <span className="module-shell-example-line module-shell-example-line-short" />
          </section>
          <div
            aria-hidden="true"
            className="module-shell-example-rail"
            data-module-body-rail="true"
          />
          <section
            aria-label="Detail stack region"
            className="module-shell-example-region module-shell-example-region-detail"
          >
            <span className="module-shell-example-region-label">
              Detail stack
            </span>
            <p>Neutral placeholder content inside the module body.</p>
            <span className="module-shell-example-line module-shell-example-line-strong" />
            <span className="module-shell-example-line" />
            <span className="module-shell-example-line module-shell-example-line-short" />
          </section>
        </div>
      </ModuleBody>
    </ModuleShell>
  );
}
