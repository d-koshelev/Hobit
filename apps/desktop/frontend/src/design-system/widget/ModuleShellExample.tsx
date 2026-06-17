import { useState } from "react";

import {
  ModuleBody,
  ModuleHeader,
  ModuleHeaderAction,
  ModuleHeaderMinimize,
  ModuleHeaderState,
  ModuleHeaderTitle,
  ModuleShell,
} from "./ModuleShell";

export function ModuleShellExample() {
  const [bodyCollapsed, setBodyCollapsed] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  return (
    <ModuleShell
      aria-label="Dummy module shell example"
      bodyCollapsed={bodyCollapsed}
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
              onClick={() => setSettingsOpen(true)}
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
          aria-labelledby="module-shell-example-settings-title"
          className="module-settings-popup"
          id="module-shell-example-settings-popup"
          role="dialog"
        >
          <div className="module-settings-popup-header">
            <div className="module-settings-popup-header-group module-settings-popup-header-group-left">
              <span id="module-shell-example-settings-title">Settings</span>
            </div>
            <div className="module-settings-popup-header-group module-settings-popup-header-group-right">
              <button
                aria-label="Close settings"
                className="module-settings-popup-close"
                onClick={() => setSettingsOpen(false)}
                type="button"
              >
                x
              </button>
            </div>
          </div>
          <div className="module-settings-popup-body">
            <p>Settings surface</p>
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
