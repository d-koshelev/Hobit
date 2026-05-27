import { useState } from "react";
import { Button } from "../design-system/Button";
import { Select } from "../design-system/Select";
import {
  CUSTOM_THEME_ID,
  editableThemeVariableLabels,
  themePresets,
} from "./themePresets";
import { UI_SCALE_OPTIONS } from "./uiScale";
import type { AppThemeController } from "./useAppTheme";

type ThemePickerProps = {
  theme: AppThemeController;
};

export function ThemePicker({ theme }: ThemePickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const isCustomSelected = theme.selectedThemeId === CUSTOM_THEME_ID;

  return (
    <div className="theme-picker">
      <Button
        aria-expanded={isOpen}
        className="theme-picker-trigger"
        onClick={() => setIsOpen((current) => !current)}
        variant={isOpen ? "secondary" : "ghost"}
      >
        Theme
      </Button>
      {isOpen ? (
        <section className="theme-picker-panel" aria-label="Interface theme">
          <div className="theme-picker-section">
            <p className="theme-picker-title">Presets</p>
            <div className="theme-preset-list">
              {themePresets.map((preset) => (
                <button
                  aria-pressed={theme.selectedThemeId === preset.id}
                  className="theme-preset-option"
                  key={preset.id}
                  onClick={() => theme.selectPresetTheme(preset.id)}
                  type="button"
                >
                  <span className="theme-preset-swatch-row">
                    <span
                      className="theme-swatch"
                      style={{
                        background: preset.variables["--hb-bg-app"],
                        borderColor: preset.variables["--hb-border-default"],
                      }}
                    />
                    <span
                      className="theme-swatch"
                      style={{
                        background: preset.variables["--hb-surface-widget"],
                        borderColor: preset.variables["--hb-border-default"],
                      }}
                    />
                    <span
                      className="theme-swatch"
                      style={{
                        background: preset.variables["--hb-accent-primary"],
                        borderColor: preset.variables["--hb-accent-primary"],
                      }}
                    />
                  </span>
                  <span className="theme-preset-name">{preset.name}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="theme-picker-section">
            <div className="theme-picker-section-heading">
              <p className="theme-picker-title">Custom</p>
              <Button
                className="theme-picker-small-action"
                onClick={theme.selectCustomTheme}
                variant={isCustomSelected ? "secondary" : "ghost"}
              >
                Apply custom
              </Button>
            </div>
            <label className="theme-custom-base">
              <span>Base</span>
              <Select
                aria-label="Custom theme base preset"
                onChange={(event) => theme.resetCustomTheme(event.target.value)}
                value={theme.customTheme.basedOn}
              >
                {themePresets.map((preset) => (
                  <option key={preset.id} value={preset.id}>
                    {preset.name}
                  </option>
                ))}
              </Select>
            </label>
            <div className="theme-custom-grid">
              {Object.entries(editableThemeVariableLabels).map(
                ([variable, label]) => (
                  <label className="theme-color-control" key={variable}>
                    <span>{label}</span>
                    <input
                      aria-label={`Custom ${label.toLowerCase()}`}
                      onChange={(event) =>
                        theme.updateCustomThemeValue(
                          variable as keyof typeof editableThemeVariableLabels,
                          event.target.value,
                        )
                      }
                      type="color"
                      value={
                        theme.customTheme.values[
                          variable as keyof typeof editableThemeVariableLabels
                        ]
                      }
                    />
                  </label>
                ),
              )}
            </div>
            <Button
              className="theme-picker-small-action"
              onClick={() => theme.resetCustomTheme()}
              variant="ghost"
            >
              Reset custom
            </Button>
          </div>

          <div className="theme-picker-section">
            <div className="theme-picker-section-heading">
              <p className="theme-picker-title">UI scale</p>
              <span className="theme-scale-current">
                {Math.round(theme.uiScale * 100)}%
              </span>
            </div>
            <div
              aria-label="UI scale"
              className="theme-scale-options"
              role="group"
            >
              {UI_SCALE_OPTIONS.map((option) => (
                <button
                  aria-pressed={theme.uiScale === option.value}
                  className="theme-scale-option"
                  key={option.value}
                  onClick={() => theme.selectUiScale(option.value)}
                  type="button"
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>
        </section>
      ) : null}
    </div>
  );
}
