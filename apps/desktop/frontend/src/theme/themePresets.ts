import type {
  CustomTheme,
  CustomThemeValues,
  EditableThemeVariable,
  ResolvedTheme,
  ThemePreset,
  ThemeVariables,
} from "./themeTypes";

export const DEFAULT_THEME_ID = "graphite";
export const CUSTOM_THEME_ID = "custom";

export const editableThemeVariableLabels: Record<EditableThemeVariable, string> =
  {
    accent: "Accent",
    background: "Background",
    border: "Border",
    mutedText: "Muted text",
    surface: "Surface",
    surfaceElevated: "Raised surface",
    text: "Text",
  };

export const themePresets: ThemePreset[] = [
  {
    id: "dark-default",
    mode: "dark",
    name: "Dark / Default",
    variables: {
      "--hb-accent-primary": "#4a84ff",
      "--hb-accent-primary-hover": "#3f73db",
      "--hb-accent-primary-muted": "#243d6b",
      "--hb-accent-primary-subtle": "#1b2d52",
      "--hb-bg-app": "#0b1320",
      "--hb-bg-canvas": "#101826",
      "--hb-bg-topbar": "#0c1422",
      "--hb-border-default": "#2d3b52",
      "--hb-border-strong": "#3b4c67",
      "--hb-border-subtle": "#253246",
      "--hb-status-error": "#eb5757",
      "--hb-status-error-bg": "#3f1b1f",
      "--hb-status-info": "#57a5ff",
      "--hb-status-info-bg": "#1a2f52",
      "--hb-status-neutral": "#7f8a9f",
      "--hb-status-neutral-bg": "#222c3b",
      "--hb-status-success": "#46c25f",
      "--hb-status-success-bg": "#183726",
      "--hb-status-warning": "#f2ae2e",
      "--hb-status-warning-bg": "#46371a",
      "--hb-surface-input": "#16202f",
      "--hb-surface-output": "#0b111b",
      "--hb-surface-panel": "#1a2433",
      "--hb-surface-panel-raised": "#1d2838",
      "--hb-surface-widget": "#141d2c",
      "--hb-surface-widget-raised": "#182234",
      "--hb-text-disabled": "#5c687b",
      "--hb-text-muted": "#8d97aa",
      "--hb-text-primary": "#f3f6fb",
      "--hb-text-secondary": "#c2cbda",
    },
  },
  {
    id: "light",
    mode: "light",
    name: "Light",
    variables: {
      "--hb-accent-primary": "#2563eb",
      "--hb-accent-primary-hover": "#1d4ed8",
      "--hb-accent-primary-muted": "#bfdbfe",
      "--hb-accent-primary-subtle": "#dbeafe",
      "--hb-bg-app": "#f4f7fb",
      "--hb-bg-canvas": "#eef3f8",
      "--hb-bg-topbar": "#ffffff",
      "--hb-border-default": "#c6d1df",
      "--hb-border-strong": "#94a3b8",
      "--hb-border-subtle": "#d8e1ec",
      "--hb-status-error": "#b91c1c",
      "--hb-status-error-bg": "#fee2e2",
      "--hb-status-info": "#1d4ed8",
      "--hb-status-info-bg": "#dbeafe",
      "--hb-status-neutral": "#64748b",
      "--hb-status-neutral-bg": "#e2e8f0",
      "--hb-status-success": "#15803d",
      "--hb-status-success-bg": "#dcfce7",
      "--hb-status-warning": "#b45309",
      "--hb-status-warning-bg": "#fef3c7",
      "--hb-surface-input": "#ffffff",
      "--hb-surface-output": "#f8fafc",
      "--hb-surface-panel": "#eef2f7",
      "--hb-surface-panel-raised": "#ffffff",
      "--hb-surface-widget": "#ffffff",
      "--hb-surface-widget-raised": "#f6f8fb",
      "--hb-text-disabled": "#98a4b5",
      "--hb-text-muted": "#66758c",
      "--hb-text-primary": "#172033",
      "--hb-text-secondary": "#34445c",
    },
  },
  {
    id: "midnight",
    mode: "dark",
    name: "Midnight",
    variables: {
      "--hb-accent-primary": "#60a5fa",
      "--hb-accent-primary-hover": "#3b82f6",
      "--hb-accent-primary-muted": "#1d4b7a",
      "--hb-accent-primary-subtle": "#102b4a",
      "--hb-bg-app": "#050914",
      "--hb-bg-canvas": "#080f1f",
      "--hb-bg-topbar": "#060b18",
      "--hb-border-default": "#263755",
      "--hb-border-strong": "#36547d",
      "--hb-border-subtle": "#1d2b44",
      "--hb-status-error": "#fb7185",
      "--hb-status-error-bg": "#3b1720",
      "--hb-status-info": "#60a5fa",
      "--hb-status-info-bg": "#112a4d",
      "--hb-status-neutral": "#94a3b8",
      "--hb-status-neutral-bg": "#1f2937",
      "--hb-status-success": "#4ade80",
      "--hb-status-success-bg": "#12351f",
      "--hb-status-warning": "#fbbf24",
      "--hb-status-warning-bg": "#3b2b10",
      "--hb-surface-input": "#0e1829",
      "--hb-surface-output": "#030712",
      "--hb-surface-panel": "#101a2c",
      "--hb-surface-panel-raised": "#132039",
      "--hb-surface-widget": "#0c1526",
      "--hb-surface-widget-raised": "#111d33",
      "--hb-text-disabled": "#64748b",
      "--hb-text-muted": "#9aa7bb",
      "--hb-text-primary": "#f8fafc",
      "--hb-text-secondary": "#cbd5e1",
    },
  },
  {
    id: "discord-dark",
    mode: "dark",
    name: "Discord Dark",
    variables: {
      "--hb-accent-primary": "#7289da",
      "--hb-accent-primary-hover": "#7289da",
      "--hb-accent-primary-muted": "#424549",
      "--hb-accent-primary-subtle": "#424549",
      "--hb-bg-app": "#1e2124",
      "--hb-bg-canvas": "#282b30",
      "--hb-bg-topbar": "#1e2124",
      "--hb-border-default": "#424549",
      "--hb-border-strong": "#424549",
      "--hb-border-subtle": "#282b30",
      "--hb-status-error": "#ed4245",
      "--hb-status-error-bg": "#3f2528",
      "--hb-status-info": "#7289da",
      "--hb-status-info-bg": "#424549",
      "--hb-status-neutral": "#b5bac1",
      "--hb-status-neutral-bg": "#424549",
      "--hb-status-success": "#3ba55d",
      "--hb-status-success-bg": "#25382b",
      "--hb-status-warning": "#f0b232",
      "--hb-status-warning-bg": "#3d331f",
      "--hb-surface-input": "#282b30",
      "--hb-surface-output": "#1e2124",
      "--hb-surface-panel": "#36393e",
      "--hb-surface-panel-raised": "#424549",
      "--hb-surface-widget": "#36393e",
      "--hb-surface-widget-raised": "#424549",
      "--hb-text-disabled": "#6d717a",
      "--hb-text-muted": "#b5bac1",
      "--hb-text-primary": "#f2f3f5",
      "--hb-text-secondary": "#dbdee1",
    },
  },
  {
    id: "graphite",
    mode: "dark",
    name: "Graphite",
    variables: {
      "--hb-accent-primary": "#8ab4f8",
      "--hb-accent-primary-hover": "#6ea1ef",
      "--hb-accent-primary-muted": "#3b4f6b",
      "--hb-accent-primary-subtle": "#273448",
      "--hb-bg-app": "#111315",
      "--hb-bg-canvas": "#171a1d",
      "--hb-bg-topbar": "#141619",
      "--hb-border-default": "#3a4148",
      "--hb-border-strong": "#535c66",
      "--hb-border-subtle": "#2b3137",
      "--hb-status-error": "#ff6b6b",
      "--hb-status-error-bg": "#3a1d20",
      "--hb-status-info": "#8ab4f8",
      "--hb-status-info-bg": "#223145",
      "--hb-status-neutral": "#9aa1aa",
      "--hb-status-neutral-bg": "#272c31",
      "--hb-status-success": "#63d471",
      "--hb-status-success-bg": "#1d3324",
      "--hb-status-warning": "#f2c14e",
      "--hb-status-warning-bg": "#3a321b",
      "--hb-surface-input": "#1c2024",
      "--hb-surface-output": "#0d0f11",
      "--hb-surface-panel": "#20252a",
      "--hb-surface-panel-raised": "#252b31",
      "--hb-surface-widget": "#1a1e22",
      "--hb-surface-widget-raised": "#20262c",
      "--hb-text-disabled": "#69717b",
      "--hb-text-muted": "#a2abb7",
      "--hb-text-primary": "#f3f4f6",
      "--hb-text-secondary": "#d1d5db",
    },
  },
  {
    id: "forest",
    mode: "dark",
    name: "Forest",
    variables: {
      "--hb-accent-primary": "#34d399",
      "--hb-accent-primary-hover": "#10b981",
      "--hb-accent-primary-muted": "#1f5f4a",
      "--hb-accent-primary-subtle": "#163a31",
      "--hb-bg-app": "#07130f",
      "--hb-bg-canvas": "#0d1b16",
      "--hb-bg-topbar": "#0a1712",
      "--hb-border-default": "#29483c",
      "--hb-border-strong": "#3d6d5a",
      "--hb-border-subtle": "#21392f",
      "--hb-status-error": "#f87171",
      "--hb-status-error-bg": "#3b1f20",
      "--hb-status-info": "#67e8f9",
      "--hb-status-info-bg": "#123743",
      "--hb-status-neutral": "#8fa49b",
      "--hb-status-neutral-bg": "#1f2d28",
      "--hb-status-success": "#4ade80",
      "--hb-status-success-bg": "#153b25",
      "--hb-status-warning": "#facc15",
      "--hb-status-warning-bg": "#3a3513",
      "--hb-surface-input": "#11251e",
      "--hb-surface-output": "#06100d",
      "--hb-surface-panel": "#142820",
      "--hb-surface-panel-raised": "#183127",
      "--hb-surface-widget": "#10221b",
      "--hb-surface-widget-raised": "#162c23",
      "--hb-text-disabled": "#5f766d",
      "--hb-text-muted": "#9db5aa",
      "--hb-text-primary": "#f3fbf7",
      "--hb-text-secondary": "#c6d8d0",
    },
  },
];

export const defaultThemePreset =
  themePresets.find((preset) => preset.id === DEFAULT_THEME_ID) ??
  themePresets[0];

export function findThemePreset(themeId: string): ThemePreset {
  return (
    themePresets.find((preset) => preset.id === themeId) ?? defaultThemePreset
  );
}

export function createCustomValuesFromPreset(
  presetId: string,
): CustomThemeValues {
  const preset = findThemePreset(presetId);

  return {
    accent: preset.variables["--hb-accent-primary"],
    background: preset.variables["--hb-bg-app"],
    border: preset.variables["--hb-border-default"],
    mutedText: preset.variables["--hb-text-muted"],
    surface: preset.variables["--hb-surface-widget"],
    surfaceElevated: preset.variables["--hb-surface-widget-raised"],
    text: preset.variables["--hb-text-primary"],
  };
}

export function createDefaultCustomTheme(): CustomTheme {
  return {
    basedOn: DEFAULT_THEME_ID,
    values: createCustomValuesFromPreset(DEFAULT_THEME_ID),
  };
}

export function resolveTheme(
  selectedThemeId: string,
  customTheme: CustomTheme,
): ResolvedTheme {
  if (selectedThemeId === CUSTOM_THEME_ID) {
    const basePreset = findThemePreset(customTheme.basedOn);

    return {
      id: CUSTOM_THEME_ID,
      mode: "custom",
      name: "Custom",
      variables: createCustomThemeVariables(basePreset, customTheme.values),
    };
  }

  return findThemePreset(selectedThemeId);
}

function createCustomThemeVariables(
  basePreset: ThemePreset,
  values: CustomThemeValues,
): ThemeVariables {
  return {
    ...basePreset.variables,
    "--hb-accent-primary": values.accent,
    "--hb-accent-primary-hover": values.accent,
    "--hb-accent-primary-muted": `color-mix(in srgb, ${values.accent} 44%, ${values.surface})`,
    "--hb-accent-primary-subtle": `color-mix(in srgb, ${values.accent} 22%, ${values.background})`,
    "--hb-bg-app": values.background,
    "--hb-bg-canvas": values.background,
    "--hb-bg-topbar": values.surface,
    "--hb-border-default": values.border,
    "--hb-border-strong": `color-mix(in srgb, ${values.border} 72%, ${values.text})`,
    "--hb-border-subtle": `color-mix(in srgb, ${values.border} 72%, ${values.background})`,
    "--hb-surface-input": values.surface,
    "--hb-surface-output": values.background,
    "--hb-surface-panel": values.surface,
    "--hb-surface-panel-raised": values.surfaceElevated,
    "--hb-surface-widget": values.surface,
    "--hb-surface-widget-raised": values.surfaceElevated,
    "--hb-text-disabled": `color-mix(in srgb, ${values.mutedText} 70%, ${values.background})`,
    "--hb-text-muted": values.mutedText,
    "--hb-text-primary": values.text,
    "--hb-text-secondary": `color-mix(in srgb, ${values.text} 72%, ${values.mutedText})`,
  };
}
