import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";

import { ThemePicker } from "./ThemePicker";
import {
  CUSTOM_THEME_ID,
  DEFAULT_THEME_ID,
  themePresets,
} from "./themePresets";
import { THEME_STORAGE_KEY } from "./themeStorage";
import { UI_SCALE_STORAGE_KEY } from "./uiScale";
import { useAppTheme } from "./useAppTheme";

let root: Root | null = null;
let container: HTMLDivElement | null = null;

afterEach(() => {
  if (root && container) {
    act(() => {
      root?.unmount();
    });
    container.remove();
  }
  root = null;
  container = null;
  document.body.innerHTML = "";
  document.documentElement.removeAttribute("data-hobit-theme");
  document.documentElement.removeAttribute("data-hobit-theme-mode");
  document.documentElement.removeAttribute("data-hobit-ui-scale");
  document.documentElement.removeAttribute("style");
  window.localStorage.clear();
});

describe("ThemePicker", () => {
  it("defines the Discord Dark preset with the expected palette", () => {
    const discordPreset = themePresets.find(
      (preset) => preset.id === "discord-dark",
    );

    expect(discordPreset?.variables["--hb-accent-primary"]).toBe("#7289da");
    expect(discordPreset?.variables["--hb-bg-app"]).toBe("#1e2124");
    expect(discordPreset?.variables["--hb-bg-topbar"]).toBe("#1e2124");
    expect(discordPreset?.variables["--hb-bg-canvas"]).toBe("#282b30");
    expect(discordPreset?.variables["--hb-surface-widget"]).toBe("#36393e");
    expect(discordPreset?.variables["--hb-surface-panel"]).toBe("#36393e");
    expect(discordPreset?.variables["--hb-surface-widget-raised"]).toBe(
      "#424549",
    );
    expect(discordPreset?.variables["--hb-surface-panel-raised"]).toBe(
      "#424549",
    );
    expect(discordPreset?.variables["--hb-text-primary"]).toBe("#f2f3f5");
    expect(discordPreset?.variables["--hb-text-muted"]).toBe("#b5bac1");
  });

  it("applies the default theme", async () => {
    renderThemePicker();
    await flushEffects();

    expect(document.documentElement.dataset.hobitTheme).toBe(DEFAULT_THEME_ID);
    expect(rootStyle("--hb-bg-app")).toBe("#0b1320");
  });

  it("renders built-in presets", async () => {
    renderThemePicker();
    await flushEffects();

    clickButton("Theme");

    expect(document.body.textContent).toContain("Dark / Default");
    expect(document.body.textContent).toContain("Light");
    expect(document.body.textContent).toContain("Midnight");
    expect(document.body.textContent).toContain("Discord Dark");
    expect(document.body.textContent).toContain("Graphite");
    expect(document.body.textContent).toContain("Forest");
  });

  it("uses 100% UI scale by default", async () => {
    renderThemePicker();
    await flushEffects();

    expect(document.documentElement.dataset.hobitUiScale).toBe("1");
    expect(rootStyle("--ui-scale")).toBe("1");
    expect(window.localStorage.getItem(UI_SCALE_STORAGE_KEY)).toBe("1");
  });

  it("renders UI scale options", async () => {
    renderThemePicker();
    await flushEffects();

    clickButton("Theme");

    expect(document.body.textContent).toContain("UI scale");
    expect(document.body.textContent).toContain("90%");
    expect(document.body.textContent).toContain("100%");
    expect(document.body.textContent).toContain("110%");
    expect(document.body.textContent).toContain("125%");
    expect(document.body.textContent).toContain("150%");
  });

  it("persists selected UI scale and updates root variables", async () => {
    renderThemePicker();
    await flushEffects();

    clickButton("Theme");
    clickButton("125%");
    await flushEffects();

    expect(document.documentElement.dataset.hobitUiScale).toBe("1.25");
    expect(rootStyle("--ui-scale")).toBe("1.25");
    expect(rootStyle("--ui-scale-percent")).toBe("125%");
    expect(window.localStorage.getItem(UI_SCALE_STORAGE_KEY)).toBe("1.25");
  });

  it("falls back to 100% UI scale when stored scale is invalid", async () => {
    window.localStorage.setItem(UI_SCALE_STORAGE_KEY, "2");

    renderThemePicker();
    await flushEffects();

    expect(document.documentElement.dataset.hobitUiScale).toBe("1");
    expect(rootStyle("--ui-scale")).toBe("1");
    expect(window.localStorage.getItem(UI_SCALE_STORAGE_KEY)).toBe("1");
  });

  it("persists a selected preset and updates theme variables", async () => {
    renderThemePicker();
    await flushEffects();

    clickButton("Theme");
    clickButton("Light");
    await flushEffects();

    expect(document.documentElement.dataset.hobitTheme).toBe("light");
    expect(rootStyle("--hb-bg-app")).toBe("#f4f7fb");
    expect(storedTheme()?.selectedThemeId).toBe("light");
  });

  it("applies and persists Discord Dark theme variables", async () => {
    renderThemePicker();
    await flushEffects();

    clickButton("Theme");
    clickButton("Discord Dark");
    await flushEffects();

    expect(document.documentElement.dataset.hobitTheme).toBe("discord-dark");
    expect(document.documentElement.dataset.hobitThemeMode).toBe("dark");
    expect(rootStyle("--hb-accent-primary")).toBe("#7289da");
    expect(rootStyle("--hb-accent-primary-subtle")).toBe("#424549");
    expect(rootStyle("--hb-bg-app")).toBe("#1e2124");
    expect(rootStyle("--hb-bg-canvas")).toBe("#282b30");
    expect(rootStyle("--hb-bg-topbar")).toBe("#1e2124");
    expect(rootStyle("--hb-surface-input")).toBe("#282b30");
    expect(rootStyle("--hb-surface-output")).toBe("#1e2124");
    expect(rootStyle("--hb-surface-panel")).toBe("#36393e");
    expect(rootStyle("--hb-surface-panel-raised")).toBe("#424549");
    expect(rootStyle("--hb-surface-widget")).toBe("#36393e");
    expect(rootStyle("--hb-surface-widget-raised")).toBe("#424549");
    expect(rootStyle("--hb-text-primary")).toBe("#f2f3f5");
    expect(rootStyle("--hb-text-muted")).toBe("#b5bac1");
    expect(rootStyle("--hb-border-default")).toBe("#424549");
    expect(storedTheme()?.selectedThemeId).toBe("discord-dark");
  });

  it("loads persisted Discord Dark preference", async () => {
    window.localStorage.setItem(
      THEME_STORAGE_KEY,
      JSON.stringify({
        customTheme: defaultCustomThemeStorage(),
        selectedThemeId: "discord-dark",
        version: 1,
      }),
    );

    renderThemePicker();
    await flushEffects();

    expect(document.documentElement.dataset.hobitTheme).toBe("discord-dark");
    expect(rootStyle("--hb-bg-app")).toBe("#1e2124");
    expect(storedTheme()?.selectedThemeId).toBe("discord-dark");
  });

  it("renders HEX inputs for custom color fields", async () => {
    renderThemePicker();
    await flushEffects();

    clickButton("Theme");

    expect(textInput("Custom accent HEX").value).toBe("#4a84ff");
    expect(textInput("Custom background HEX").value).toBe("#0b1320");
    expect(textInput("Custom raised surface HEX").value).toBe("#182234");
  });

  it("saves and applies a custom theme", async () => {
    renderThemePicker();
    await flushEffects();

    clickButton("Theme");
    setColorInput("Custom accent", "#ff0000");
    await flushEffects();

    expect(document.documentElement.dataset.hobitTheme).toBe(CUSTOM_THEME_ID);
    expect(rootStyle("--hb-accent-primary")).toBe("#ff0000");
    expect(storedTheme()?.selectedThemeId).toBe(CUSTOM_THEME_ID);
    expect(storedTheme()?.customTheme.values.accent).toBe("#ff0000");
  });

  it("updates custom values from valid HEX text", async () => {
    renderThemePicker();
    await flushEffects();

    clickButton("Theme");
    setTextInput("Custom accent HEX", "#ABCDEF");
    await flushEffects();

    expect(document.documentElement.dataset.hobitTheme).toBe(CUSTOM_THEME_ID);
    expect(rootStyle("--hb-accent-primary")).toBe("#abcdef");
    expect(colorInput("Custom accent").value).toBe("#abcdef");
    expect(textInput("Custom accent HEX").value).toBe("#abcdef");
    expect(storedTheme()?.customTheme.values.accent).toBe("#abcdef");
  });

  it("normalizes bare HEX text input values", async () => {
    renderThemePicker();
    await flushEffects();

    clickButton("Theme");
    setTextInput("Custom surface HEX", "ABCDEF");
    await flushEffects();

    expect(rootStyle("--hb-surface-widget")).toBe("#abcdef");
    expect(colorInput("Custom surface").value).toBe("#abcdef");
    expect(textInput("Custom surface HEX").value).toBe("#abcdef");
    expect(storedTheme()?.customTheme.values.surface).toBe("#abcdef");
  });

  it("does not save invalid or empty HEX values", async () => {
    renderThemePicker();
    await flushEffects();

    clickButton("Theme");
    setTextInput("Custom accent HEX", "not-a-hex");
    await flushEffects();

    expect(document.documentElement.dataset.hobitTheme).toBe(DEFAULT_THEME_ID);
    expect(rootStyle("--hb-accent-primary")).toBe("#4a84ff");
    expect(textInput("Custom accent HEX").value).toBe("#4a84ff");
    expect(storedTheme()?.customTheme.values.accent).toBe("#4a84ff");

    setTextInput("Custom accent HEX", "");
    await flushEffects();

    expect(document.documentElement.dataset.hobitTheme).toBe(DEFAULT_THEME_ID);
    expect(textInput("Custom accent HEX").value).toBe("#4a84ff");
    expect(storedTheme()?.customTheme.values.accent).toBe("#4a84ff");
  });

  it("keeps the color picker and HEX input synchronized", async () => {
    renderThemePicker();
    await flushEffects();

    clickButton("Theme");
    setColorInput("Custom accent", "#ff0000");
    await flushEffects();

    expect(textInput("Custom accent HEX").value).toBe("#ff0000");

    setTextInput("Custom accent HEX", "00ff00");
    await flushEffects();

    expect(colorInput("Custom accent").value).toBe("#00ff00");
    expect(rootStyle("--hb-accent-primary")).toBe("#00ff00");
  });

  it("falls back to default when stored custom values are invalid", async () => {
    window.localStorage.setItem(
      THEME_STORAGE_KEY,
      JSON.stringify({
        customTheme: {
          basedOn: DEFAULT_THEME_ID,
          values: {
            accent: "not-a-color",
            background: "#0b1320",
            border: "#2d3b52",
            mutedText: "#8d97aa",
            surface: "#141d2c",
            surfaceElevated: "#182234",
            text: "#f3f6fb",
          },
        },
        selectedThemeId: CUSTOM_THEME_ID,
        version: 1,
      }),
    );

    renderThemePicker();
    await flushEffects();

    expect(document.documentElement.dataset.hobitTheme).toBe(DEFAULT_THEME_ID);
    expect(rootStyle("--hb-bg-app")).toBe("#0b1320");
    expect(storedTheme()?.selectedThemeId).toBe(DEFAULT_THEME_ID);
  });
});

function defaultCustomThemeStorage() {
  return {
    basedOn: DEFAULT_THEME_ID,
    values: {
      accent: "#4a84ff",
      background: "#0b1320",
      border: "#2d3b52",
      mutedText: "#8d97aa",
      surface: "#141d2c",
      surfaceElevated: "#182234",
      text: "#f3f6fb",
    },
  };
}

function TestThemePicker() {
  const theme = useAppTheme();

  return <ThemePicker theme={theme} />;
}

function renderThemePicker() {
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);

  act(() => {
    root?.render(<TestThemePicker />);
  });
}

function clickButton(text: string) {
  act(() => {
    buttonWithText(text).dispatchEvent(
      new MouseEvent("click", { bubbles: true }),
    );
  });
}

function setColorInput(label: string, value: string) {
  const input = colorInput(label);

  act(() => {
    setNativeInputValue(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
  });
}

function setTextInput(label: string, value: string) {
  const input = textInput(label);

  act(() => {
    setNativeInputValue(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
  });
}

function colorInput(label: string) {
  const input = document.querySelector<HTMLInputElement>(
    `input[type="color"][aria-label="${label}"]`,
  );

  if (!input) {
    throw new Error(`Color input not found: ${label}`);
  }

  return input;
}

function textInput(label: string) {
  const input = document.querySelector<HTMLInputElement>(
    `input[type="text"][aria-label="${label}"]`,
  );

  if (!input) {
    throw new Error(`Text input not found: ${label}`);
  }

  return input;
}

function setNativeInputValue(field: HTMLInputElement, value: string) {
  const descriptor = Object.getOwnPropertyDescriptor(
    HTMLInputElement.prototype,
    "value",
  );
  descriptor?.set?.call(field, value);
}

function buttonWithText(text: string) {
  const button = Array.from(document.querySelectorAll("button")).find(
    (candidate) => candidate.textContent === text,
  );

  if (!button) {
    throw new Error(`Button not found: ${text}`);
  }

  return button;
}

function rootStyle(variable: string) {
  return document.documentElement.style.getPropertyValue(variable).trim();
}

function storedTheme() {
  const storedValue = window.localStorage.getItem(THEME_STORAGE_KEY);

  return storedValue ? JSON.parse(storedValue) : null;
}

async function flushEffects() {
  await act(async () => {
    await Promise.resolve();
  });
  await act(async () => {
    await Promise.resolve();
  });
}
