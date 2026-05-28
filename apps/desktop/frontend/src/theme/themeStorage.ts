import {
  CUSTOM_THEME_ID,
  DEFAULT_THEME_ID,
  createDefaultCustomTheme,
  findThemePreset,
  themePresets,
} from "./themePresets";
import type {
  CustomTheme,
  CustomThemeValues,
  EditableThemeVariable,
  StoredThemePreference,
} from "./themeTypes";

export const THEME_STORAGE_KEY = "hobit.ui.theme";

const editableThemeVariables: EditableThemeVariable[] = [
  "accent",
  "background",
  "border",
  "mutedText",
  "surface",
  "surfaceElevated",
  "text",
];

const hexColorPattern = /^#?[0-9a-fA-F]{6}$/;

export function isValidThemeColor(value: string): boolean {
  return hexColorPattern.test(value);
}

export function normalizeThemeColor(value: string): string | null {
  const trimmedValue = value.trim();

  if (!isValidThemeColor(trimmedValue)) {
    return null;
  }

  const normalizedValue = trimmedValue.startsWith("#")
    ? trimmedValue
    : `#${trimmedValue}`;

  return normalizedValue.toLowerCase();
}

export function loadThemePreference(): StoredThemePreference {
  if (typeof window === "undefined") {
    return createDefaultThemePreference();
  }

  const storedValue = window.localStorage.getItem(THEME_STORAGE_KEY);

  if (!storedValue) {
    return createDefaultThemePreference();
  }

  try {
    return normalizeStoredThemePreference(JSON.parse(storedValue));
  } catch {
    return createDefaultThemePreference();
  }
}

export function saveThemePreference(preference: StoredThemePreference): void {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(THEME_STORAGE_KEY, JSON.stringify(preference));
}

export function createDefaultThemePreference(): StoredThemePreference {
  return {
    customTheme: createDefaultCustomTheme(),
    selectedThemeId: DEFAULT_THEME_ID,
    version: 1,
  };
}

export function createThemePreference(
  selectedThemeId: string,
  customTheme: CustomTheme,
): StoredThemePreference {
  return normalizeStoredThemePreference({
    customTheme,
    selectedThemeId,
    version: 1,
  });
}

function normalizeStoredThemePreference(value: unknown): StoredThemePreference {
  if (!isThemePreferenceCandidate(value)) {
    return createDefaultThemePreference();
  }

  const selectedThemeId = normalizeSelectedThemeId(value.selectedThemeId);
  const basedOn = normalizePresetId(value.customTheme.basedOn);
  const customValues = normalizeCustomThemeValues(value.customTheme.values);

  if (!customValues) {
    return createDefaultThemePreference();
  }

  return {
    customTheme: {
      basedOn,
      values: customValues,
    },
    selectedThemeId,
    version: 1,
  };
}

function normalizeSelectedThemeId(themeId: string): string {
  if (themeId === CUSTOM_THEME_ID) {
    return CUSTOM_THEME_ID;
  }

  return normalizePresetId(themeId);
}

function normalizePresetId(themeId: string): string {
  const presetIds = new Set(themePresets.map((preset) => preset.id));

  if (presetIds.has(themeId)) {
    return themeId;
  }

  return findThemePreset(DEFAULT_THEME_ID).id;
}

function normalizeCustomThemeValues(
  values: Record<string, unknown>,
): CustomThemeValues | null {
  const customValues = {} as CustomThemeValues;

  for (const variable of editableThemeVariables) {
    const value = values[variable];

    if (typeof value !== "string") {
      return null;
    }

    const normalizedValue = normalizeThemeColor(value);

    if (!normalizedValue) {
      return null;
    }

    customValues[variable] = normalizedValue;
  }

  return customValues;
}

function isThemePreferenceCandidate(
  value: unknown,
): value is StoredThemePreference {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Partial<StoredThemePreference>;

  return (
    candidate.version === 1 &&
    typeof candidate.selectedThemeId === "string" &&
    Boolean(candidate.customTheme) &&
    typeof candidate.customTheme === "object" &&
    typeof candidate.customTheme.basedOn === "string" &&
    Boolean(candidate.customTheme.values) &&
    typeof candidate.customTheme.values === "object"
  );
}
