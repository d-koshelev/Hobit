import { useState } from "react";

import {
  ModuleBody,
  ModuleHeader,
  ModuleHeaderAction,
  ModuleHeaderMinimize,
  ModuleHeaderState,
  ModuleHeaderTitle,
  ModuleRail,
  ModuleShell,
  ModuleSplit,
  ModuleSplitRegion,
} from "./ModuleShell";
import { ModulePopup, type ModulePopupPosition } from "./ModulePopup";

const DEFAULT_SETTINGS_POPUP_POSITION: ModulePopupPosition = {
  x: 420,
  y: 44,
};

export function ModuleShellExample() {
  const [bodyCollapsed, setBodyCollapsed] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  return (
    <>
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
        <ModuleBody collapsed={bodyCollapsed} id="module-shell-example-body">
          <ModuleSplit
            aria-label="Neutral static module canvas"
            className="module-shell-example-content"
            defaultPrimarySize={392}
            minPrimarySize={220}
            minSecondarySize={240}
            orientation="vertical"
          >
            <ModuleSplitRegion
              aria-label="Primary surface region"
              className="module-shell-example-region module-shell-example-region-primary"
              region="primary"
            >
              <span className="module-shell-example-region-label">
                Primary surface
              </span>
              <p>Static clean canvas content for the shared module shell.</p>
              <span className="module-shell-example-line module-shell-example-line-strong" />
              <span className="module-shell-example-line" />
              <span className="module-shell-example-line module-shell-example-line-short" />
            </ModuleSplitRegion>
            <ModuleRail aria-label="Resize primary and detail regions" />
            <ModuleSplitRegion
              aria-label="Detail stack region"
              className="module-shell-example-region module-shell-example-region-detail"
              region="secondary"
            >
              <span className="module-shell-example-region-label">
                Detail stack
              </span>
              <ModuleSplit
                aria-label="Nested quiet placeholder split"
                className="module-shell-example-detail-split"
                defaultPrimarySize={142}
                minPrimarySize={96}
                minSecondarySize={96}
                orientation="horizontal"
              >
                <ModuleSplitRegion
                  aria-label="Quiet placeholder top region"
                  className="module-shell-example-detail-pane"
                  region="primary"
                >
                  <span className="module-shell-example-region-label">
                    Quiet placeholder
                  </span>
                  <p>Neutral placeholder content inside the module body.</p>
                  <span className="module-shell-example-line module-shell-example-line-strong" />
                  <span className="module-shell-example-line" />
                </ModuleSplitRegion>
                <ModuleRail aria-label="Resize quiet placeholder regions" />
                <ModuleSplitRegion
                  aria-label="Quiet placeholder bottom region"
                  className="module-shell-example-detail-pane"
                  region="secondary"
                >
                  <span className="module-shell-example-region-label">
                    Secondary placeholder
                  </span>
                  <p>Static lower detail content for horizontal rail review.</p>
                  <span className="module-shell-example-line" />
                  <span className="module-shell-example-line module-shell-example-line-short" />
                </ModuleSplitRegion>
              </ModuleSplit>
            </ModuleSplitRegion>
          </ModuleSplit>
        </ModuleBody>
      </ModuleShell>
      <ModulePopup
        closeLabel="Close settings"
        defaultPosition={DEFAULT_SETTINGS_POPUP_POSITION}
        dragLabel="Move settings popup"
        dragTitle="Drag settings popup"
        id="module-shell-example-settings-popup"
        onClose={() => setSettingsOpen(false)}
        open={settingsOpen}
        title="Settings"
        titleId="module-shell-example-settings-title"
      >
        <p>Placeholder surface</p>
      </ModulePopup>
    </>
  );
}
