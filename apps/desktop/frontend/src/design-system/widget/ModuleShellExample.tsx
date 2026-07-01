import { useEffect, useRef, useState } from "react";

import {
  ModuleButton,
  ModuleField,
  ModuleFieldHint,
  ModuleKeyValueRow,
  ModuleMonoText,
  ModuleMutedText,
  ModuleNotice,
  ModuleSectionTitle,
  ModuleStatus,
  ModuleStatusBadge,
  ModuleTextArea,
  ModuleTextBlock,
  ModuleTextInput,
} from "./ModuleControls";
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

type ModuleThemeRadiusOption = "sharp" | "compact" | "soft";
type ModuleThemeShadowOption = "none" | "popup" | "all";
type ModulePreviewBackgroundOption =
  | "plain"
  | "grid"
  | "fine-grid"
  | "dots"
  | "sparse-dots"
  | "dense-grid"
  | "cross-grid"
  | "noir";

const MODULE_THEME_RADIUS_OPTIONS: ReadonlyArray<{
  readonly label: string;
  readonly value: ModuleThemeRadiusOption;
}> = [
  { label: "Sharp", value: "sharp" },
  { label: "Compact", value: "compact" },
  { label: "Soft", value: "soft" },
];

const MODULE_THEME_SHADOW_OPTIONS: ReadonlyArray<{
  readonly label: string;
  readonly value: ModuleThemeShadowOption;
}> = [
  { label: "None", value: "none" },
  { label: "Popup", value: "popup" },
  { label: "Module + Popup", value: "all" },
];

const MODULE_PREVIEW_BACKGROUND_OPTIONS: ReadonlyArray<{
  readonly label: string;
  readonly value: ModulePreviewBackgroundOption;
}> = [
  { label: "Plain", value: "plain" },
  { label: "Grid", value: "grid" },
  { label: "Fine grid", value: "fine-grid" },
  { label: "Dots", value: "dots" },
  { label: "Sparse dots", value: "sparse-dots" },
  { label: "Dense grid", value: "dense-grid" },
  { label: "Cross grid", value: "cross-grid" },
  { label: "Noir", value: "noir" },
];

export function ModuleShellExample() {
  const themeScopeRef = useRef<HTMLDivElement>(null);
  const [bodyCollapsed, setBodyCollapsed] = useState(false);
  const [moduleRadius, setModuleRadius] =
    useState<ModuleThemeRadiusOption>("compact");
  const [moduleShadow, setModuleShadow] =
    useState<ModuleThemeShadowOption>("popup");
  const [moduleBackground, setModuleBackground] =
    useState<ModulePreviewBackgroundOption>("grid");
  const [settingsOpen, setSettingsOpen] = useState(false);

  useEffect(() => {
    const previewRoot = themeScopeRef.current?.closest(
      ".module-shell-visual-preview",
    );

    if (!(previewRoot instanceof HTMLElement)) {
      return undefined;
    }

    previewRoot.dataset.moduleBackground = moduleBackground;

    return () => {
      if (previewRoot.dataset.moduleBackground === moduleBackground) {
        delete previewRoot.dataset.moduleBackground;
      }
    };
  }, [moduleBackground]);

  return (
    <div
      className="module-theme-scope module-shell-example-theme"
      data-module-radius={moduleRadius}
      data-module-shadow={moduleShadow}
      data-module-theme-scope="true"
      ref={themeScopeRef}
    >
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
                <span className="module-header-state-value">Completed</span>
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
              aria-label="Input primitive region"
              className="module-shell-example-region module-shell-example-region-primary"
              region="primary"
            >
              <ModuleTextBlock className="module-ui-kit-stack">
                <ModuleSectionTitle>Input</ModuleSectionTitle>
                <ModuleField
                  helperText="Compact helper text stays close to the control."
                  label="Single line"
                >
                  <ModuleTextInput
                    defaultValue="Static module value"
                    placeholder="Type a concise value"
                  />
                </ModuleField>
                <ModuleField
                  error="Example error text"
                  helperText="Short module body copy uses the same graphite field rhythm."
                  label="Multiline"
                >
                  <ModuleTextArea
                    defaultValue="Static multiline content for future module body composition."
                    invalid
                    placeholder="Write a short module note"
                    rows={4}
                  />
                </ModuleField>
                <div
                  aria-label="Button primitive variants"
                  className="module-ui-kit-button-row"
                >
                  <ModuleButton variant="primary">Primary</ModuleButton>
                  <ModuleButton variant="secondary">Secondary</ModuleButton>
                  <ModuleButton variant="ghost">Ghost</ModuleButton>
                  <ModuleButton variant="danger">Danger</ModuleButton>
                  <ModuleButton disabled variant="quiet">
                    Disabled
                  </ModuleButton>
                </div>
              </ModuleTextBlock>
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
                  aria-label="Status primitive region"
                  className="module-shell-example-detail-pane"
                  region="primary"
                >
                  <ModuleTextBlock className="module-ui-kit-stack">
                    <ModuleSectionTitle>Statuses</ModuleSectionTitle>
                    <div className="module-ui-kit-status-list">
                      <ModuleStatus tone="idle">Idle</ModuleStatus>
                      <ModuleStatus tone="running">Running</ModuleStatus>
                      <ModuleStatus tone="completed">Completed</ModuleStatus>
                      <ModuleStatus tone="blocked">Blocked</ModuleStatus>
                      <ModuleStatus tone="error">Error</ModuleStatus>
                    </div>
                    <div
                      aria-label="Compact status badges"
                      className="module-ui-kit-badge-row"
                    >
                      <ModuleStatusBadge tone="active">Active</ModuleStatusBadge>
                      <ModuleStatusBadge tone="draft">Draft</ModuleStatusBadge>
                      <ModuleStatusBadge tone="disabled">
                        Disabled
                      </ModuleStatusBadge>
                    </div>
                    <div className="module-ui-kit-key-values">
                      <ModuleKeyValueRow label="Surface" value="Module canvas" />
                      <ModuleKeyValueRow label="Density" value="Compact" />
                      <ModuleKeyValueRow
                        label="Token"
                        value={<ModuleMonoText>--module-body-background</ModuleMonoText>}
                      />
                    </div>
                    <div className="module-ui-kit-notice-stack">
                      <ModuleNotice tone="info" title="Info">
                        Informational copy uses the neutral module accent range.
                      </ModuleNotice>
                      <ModuleNotice tone="neutral" title="Neutral">
                        Module text blocks sit directly on the canvas.
                      </ModuleNotice>
                      <ModuleNotice tone="success" title="Success">
                        Completed stays on the calm green semantic tone.
                      </ModuleNotice>
                      <ModuleNotice tone="warning" title="Warning">
                        Notices use a thin left rail instead of a heavy card.
                      </ModuleNotice>
                      <ModuleNotice tone="error" title="Error">
                        Error tone is visible without becoming oversized.
                      </ModuleNotice>
                    </div>
                    <ModuleMutedText>
                      Muted body copy is short, low contrast, and aligned with
                      the module content rhythm.
                    </ModuleMutedText>
                  </ModuleTextBlock>
                </ModuleSplitRegion>
                <ModuleRail aria-label="Resize quiet placeholder regions" />
                <ModuleSplitRegion
                  aria-label="Composer primitive region"
                  className="module-shell-example-detail-pane"
                  region="secondary"
                >
                  <ModuleTextBlock className="module-ui-kit-composer">
                    <ModuleSectionTitle>Composer</ModuleSectionTitle>
                    <ModuleField label="Message">
                      <ModuleTextArea
                        placeholder="Static composer placeholder"
                        rows={3}
                      />
                    </ModuleField>
                    <div className="module-ui-kit-composer-actions">
                      <ModuleButton size="compact" variant="primary">
                        Send
                      </ModuleButton>
                      <ModuleFieldHint>
                        Helper text stays inside the module region.
                      </ModuleFieldHint>
                    </div>
                  </ModuleTextBlock>
                </ModuleSplitRegion>
              </ModuleSplit>
            </ModuleSplitRegion>
          </ModuleSplit>
        </ModuleBody>
      </ModuleShell>
      <ModulePopup
        className="module-shell-example-settings-popup"
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
        <ModuleTextBlock className="module-ui-kit-popup-stack">
          <ModuleSectionTitle>Settings</ModuleSectionTitle>
          <div className="module-theme-preview-controls">
            <div className="module-theme-preview-control">
              <ModuleSectionTitle>Radius</ModuleSectionTitle>
              <div
                aria-label="Radius"
                className="module-theme-preview-options"
                role="group"
              >
                {MODULE_THEME_RADIUS_OPTIONS.map((option) => (
                  <ModuleButton
                    aria-pressed={moduleRadius === option.value}
                    key={option.value}
                    onClick={() => setModuleRadius(option.value)}
                    size="compact"
                    variant="secondary"
                  >
                    {option.label}
                  </ModuleButton>
                ))}
              </div>
            </div>
            <div className="module-theme-preview-control">
              <ModuleSectionTitle>Shadows</ModuleSectionTitle>
              <div
                aria-label="Shadows"
                className="module-theme-preview-options"
                role="group"
              >
                {MODULE_THEME_SHADOW_OPTIONS.map((option) => (
                  <ModuleButton
                    aria-pressed={moduleShadow === option.value}
                    key={option.value}
                    onClick={() => setModuleShadow(option.value)}
                    size="compact"
                    variant="secondary"
                  >
                    {option.label}
                  </ModuleButton>
                ))}
              </div>
            </div>
            <div className="module-theme-preview-control">
              <ModuleSectionTitle>Background</ModuleSectionTitle>
              <div
                aria-label="Background"
                className="module-theme-preview-options"
                role="group"
              >
                {MODULE_PREVIEW_BACKGROUND_OPTIONS.map((option) => (
                  <ModuleButton
                    aria-pressed={moduleBackground === option.value}
                    key={option.value}
                    onClick={() => setModuleBackground(option.value)}
                    size="compact"
                    variant="secondary"
                  >
                    {option.label}
                  </ModuleButton>
                ))}
              </div>
            </div>
          </div>
        </ModuleTextBlock>
      </ModulePopup>
    </div>
  );
}
