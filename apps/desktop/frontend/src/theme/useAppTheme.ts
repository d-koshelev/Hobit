import { useEffect, useMemo, useState } from "react";
import {
  CUSTOM_THEME_ID,
  createCustomValuesFromPreset,
  resolveTheme,
} from "./themePresets";
import {
  createThemePreference,
  loadThemePreference,
  normalizeThemeColor,
  saveThemePreference,
} from "./themeStorage";
import {
  loadUiScalePreference,
  normalizeUiScale,
  saveUiScalePreference,
  type UiScaleValue,
} from "./uiScale";
import type {
  CustomTheme,
  EditableThemeVariable,
  ResolvedTheme,
  StoredThemePreference,
} from "./themeTypes";

export type AppThemeController = {
  customTheme: CustomTheme;
  resetCustomTheme: (presetId?: string) => void;
  resolvedTheme: ResolvedTheme;
  selectedThemeId: string;
  selectPresetTheme: (themeId: string) => void;
  selectCustomTheme: () => void;
  selectUiScale: (scale: UiScaleValue) => void;
  uiScale: UiScaleValue;
  updateCustomThemeValue: (
    variable: EditableThemeVariable,
    value: string,
  ) => boolean;
};

export function useAppTheme(): AppThemeController {
  const [themePreference, setThemePreference] = useState<StoredThemePreference>(
    () => loadThemePreference(),
  );
  const [uiScale, setUiScale] = useState<UiScaleValue>(() =>
    loadUiScalePreference(),
  );
  const resolvedTheme = useMemo(
    () =>
      resolveTheme(
        themePreference.selectedThemeId,
        themePreference.customTheme,
      ),
    [themePreference],
  );

  useEffect(() => {
    applyTheme(resolvedTheme);
    saveThemePreference(themePreference);
  }, [resolvedTheme, themePreference]);

  useEffect(() => {
    applyUiScale(uiScale);
    saveUiScalePreference(uiScale);
  }, [uiScale]);

  function commitThemePreference(
    selectedThemeId: string,
    customTheme: CustomTheme,
  ) {
    setThemePreference(createThemePreference(selectedThemeId, customTheme));
  }

  function selectPresetTheme(themeId: string) {
    commitThemePreference(themeId, themePreference.customTheme);
  }

  function selectCustomTheme() {
    commitThemePreference(CUSTOM_THEME_ID, themePreference.customTheme);
  }

  function selectUiScale(scale: UiScaleValue) {
    setUiScale(normalizeUiScale(scale));
  }

  function resetCustomTheme(presetId = themePreference.customTheme.basedOn) {
    commitThemePreference(CUSTOM_THEME_ID, {
      basedOn: presetId,
      values: createCustomValuesFromPreset(presetId),
    });
  }

  function updateCustomThemeValue(
    variable: EditableThemeVariable,
    value: string,
  ): boolean {
    const normalizedValue = normalizeThemeColor(value);

    if (!normalizedValue) {
      return false;
    }

    commitThemePreference(CUSTOM_THEME_ID, {
      ...themePreference.customTheme,
      values: {
        ...themePreference.customTheme.values,
        [variable]: normalizedValue,
      },
    });

    return true;
  }

  return {
    customTheme: themePreference.customTheme,
    resetCustomTheme,
    resolvedTheme,
    selectedThemeId: themePreference.selectedThemeId,
    selectCustomTheme,
    selectPresetTheme,
    selectUiScale,
    uiScale,
    updateCustomThemeValue,
  };
}

function applyTheme(theme: ResolvedTheme): void {
  if (typeof document === "undefined") {
    return;
  }

  const root = document.documentElement;

  root.dataset.hobitTheme = theme.id;
  root.dataset.hobitThemeMode = theme.mode;
  root.style.colorScheme = theme.mode === "light" ? "light" : "dark";

  for (const [variable, value] of Object.entries(theme.variables)) {
    root.style.setProperty(variable, value);
  }
}

function applyUiScale(scale: UiScaleValue): void {
  if (typeof document === "undefined") {
    return;
  }

  const normalizedScale = normalizeUiScale(scale);
  const root = document.documentElement;

  root.dataset.hobitUiScale = String(normalizedScale);
  root.style.setProperty("--ui-scale", String(normalizedScale));
  root.style.setProperty(
    "--ui-scale-percent",
    `${Math.round(normalizedScale * 100)}%`,
  );
}
