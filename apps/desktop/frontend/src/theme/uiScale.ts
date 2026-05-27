export const UI_SCALE_STORAGE_KEY = "hobit.ui.scale";

export const UI_SCALE_OPTIONS = [
  { label: "90%", value: 0.9 },
  { label: "100%", value: 1 },
  { label: "110%", value: 1.1 },
  { label: "125%", value: 1.25 },
  { label: "150%", value: 1.5 },
] as const;

export type UiScaleValue = (typeof UI_SCALE_OPTIONS)[number]["value"];

export const DEFAULT_UI_SCALE: UiScaleValue = 1;

export function isUiScaleValue(value: number): value is UiScaleValue {
  return UI_SCALE_OPTIONS.some((option) => option.value === value);
}

export function normalizeUiScale(value: unknown): UiScaleValue {
  const numericValue =
    typeof value === "number"
      ? value
      : typeof value === "string"
        ? Number(value)
        : Number.NaN;

  return isUiScaleValue(numericValue) ? numericValue : DEFAULT_UI_SCALE;
}

export function loadUiScalePreference(): UiScaleValue {
  if (typeof window === "undefined") {
    return DEFAULT_UI_SCALE;
  }

  return normalizeUiScale(window.localStorage.getItem(UI_SCALE_STORAGE_KEY));
}

export function saveUiScalePreference(scale: UiScaleValue): void {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(UI_SCALE_STORAGE_KEY, String(scale));
}
