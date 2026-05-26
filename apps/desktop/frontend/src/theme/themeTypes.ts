export type AppThemeMode = "dark" | "light" | "custom";

export type ThemeCssVariable =
  | "--hb-bg-app"
  | "--hb-bg-topbar"
  | "--hb-bg-canvas"
  | "--hb-surface-widget"
  | "--hb-surface-widget-raised"
  | "--hb-surface-panel"
  | "--hb-surface-panel-raised"
  | "--hb-surface-input"
  | "--hb-surface-output"
  | "--hb-border-subtle"
  | "--hb-border-default"
  | "--hb-border-strong"
  | "--hb-text-primary"
  | "--hb-text-secondary"
  | "--hb-text-muted"
  | "--hb-text-disabled"
  | "--hb-accent-primary"
  | "--hb-accent-primary-hover"
  | "--hb-accent-primary-subtle"
  | "--hb-accent-primary-muted"
  | "--hb-status-success"
  | "--hb-status-warning"
  | "--hb-status-error"
  | "--hb-status-info"
  | "--hb-status-neutral"
  | "--hb-status-success-bg"
  | "--hb-status-warning-bg"
  | "--hb-status-error-bg"
  | "--hb-status-info-bg"
  | "--hb-status-neutral-bg";

export type ThemeVariables = Record<ThemeCssVariable, string>;

export type EditableThemeVariable =
  | "accent"
  | "background"
  | "surface"
  | "surfaceElevated"
  | "text"
  | "mutedText"
  | "border";

export type CustomThemeValues = Record<EditableThemeVariable, string>;

export type ThemePreset = {
  id: string;
  mode: Exclude<AppThemeMode, "custom">;
  name: string;
  variables: ThemeVariables;
};

export type CustomTheme = {
  basedOn: string;
  values: CustomThemeValues;
};

export type ResolvedTheme = {
  id: string;
  mode: AppThemeMode;
  name: string;
  variables: ThemeVariables;
};

export type StoredThemePreference = {
  customTheme: CustomTheme;
  selectedThemeId: string;
  version: 1;
};
