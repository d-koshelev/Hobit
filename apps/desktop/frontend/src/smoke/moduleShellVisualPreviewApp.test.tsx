import { readFileSync } from "fs";
import { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";

import { ModuleShellVisualPreviewApp } from "./moduleShellVisualPreviewApp";
import previewSource from "./moduleShellVisualPreviewApp.tsx?raw";

let container: HTMLDivElement | null = null;
let root: Root | null = null;
const previewStyles = readFrontendFile(
  "src/smoke/moduleShellVisualPreview.css",
);
const MODULE_BACKGROUND_OPTIONS = [
  ["Plain", "plain"],
  ["Grid", "grid"],
  ["Fine grid", "fine-grid"],
  ["Dots", "dots"],
  ["Sparse dots", "sparse-dots"],
  ["Dense grid", "dense-grid"],
  ["Cross grid", "cross-grid"],
  ["Noir", "noir"],
] as const;

afterEach(() => {
  if (container && root) {
    act(() => {
      root?.unmount();
    });
    container.remove();
  }

  container = null;
  root = null;
  document.body.innerHTML = "";
});

describe("ModuleShell visual preview smoke app", () => {
  it("renders only the static ModuleShellExample inside a dev preview harness", async () => {
    await render(<ModuleShellVisualPreviewApp />);

    expect(
      document.querySelector('[aria-label="ModuleShell visual preview"]'),
    ).not.toBeNull();
    expect(document.querySelector(".module-shell")).not.toBeNull();
    expect(document.body.textContent).toContain("Dummy Module");
    expect(document.body.textContent).toContain("Completed");
    expect(document.body.textContent).toContain("Settings");
    expect(document.body.textContent).toContain("Input");
    expect(document.body.textContent).toContain("Statuses");
    expect(document.body.textContent).toContain(
      "Module text blocks sit directly on the canvas.",
    );
    expect(document.querySelector(".module-text-input")).not.toBeNull();
    expect(document.querySelector(".module-text-area")).not.toBeNull();
    expect(document.querySelector(".module-button-primary")).not.toBeNull();
    expect(
      document.querySelector('[data-module-status-tone="completed"]'),
    ).not.toBeNull();
    expect(
      document.querySelector('[data-module-notice-tone="warning"]'),
    ).not.toBeNull();
    expect(
      document.querySelector('[data-module-rail-orientation="vertical"]'),
    ).not.toBeNull();
    expect(
      document.querySelector('[data-module-rail-orientation="horizontal"]'),
    ).not.toBeNull();
    expect(themeScope()?.dataset.moduleRadius)
      .toBe("compact");
    expect(themeScope()?.dataset.moduleShadow)
      .toBe("popup");
    expect(themeScope()?.dataset.moduleBackground)
      .toBeUndefined();
    expect(previewRoot()?.dataset.moduleBackground)
      .toBe("grid");
  });

  it("opens the settings popup in the local preview overlay layer", async () => {
    await render(<ModuleShellVisualPreviewApp />);

    await click(buttonWithText("Settings"));

    const popup = document.querySelector(
      "#module-shell-example-settings-popup[role='dialog']",
    );
    const layer = document.querySelector("[data-module-floating-layer='true']");
    const stage = document.querySelector(".module-shell-visual-preview__stage");
    const shell = document.querySelector(".module-shell");

    expect(popup).not.toBeNull();
    expect(layer).not.toBeNull();
    expect(layer?.parentElement).toBe(themeScope());
    expect(stage?.contains(layer)).toBe(true);
    expect(shell?.contains(layer)).toBe(false);
    expect(layer?.classList.contains("module-shell-floating-layer")).toBe(true);
    expect(layer?.contains(popup)).toBe(true);
    expect(popup?.textContent).toContain("Radius");
    expect(popup?.textContent).toContain("Sharp");
    expect(popup?.textContent).toContain("Compact");
    expect(popup?.textContent).toContain("Soft");
    expect(popup?.textContent).toContain("Shadows");
    expect(popup?.textContent).toContain("None");
    expect(popup?.textContent).toContain("Popup");
    expect(popup?.textContent).toContain("Module + Popup");
    expect(popup?.textContent).toContain("Background");
    expect(optionLabels("Background")).toEqual(
      MODULE_BACKGROUND_OPTIONS.map(([label]) => label),
    );
    expect(themeScope()?.dataset.moduleRadius).toBe("compact");
    expect(themeScope()?.dataset.moduleShadow).toBe("popup");
    expect(themeScope()?.dataset.moduleBackground).toBeUndefined();
    expect(previewRoot()?.dataset.moduleBackground).toBe("grid");
    expect(popup?.closest(".module-shell")).toBeNull();
    expect(popup?.closest(".module-header")).toBeNull();
    expect(popup?.closest(".module-body")).toBeNull();
  });

  it("updates preview theme hooks from the local settings controls", async () => {
    await render(<ModuleShellVisualPreviewApp />);

    await click(buttonWithText("Settings"));
    await click(buttonWithText("Soft"));
    await click(buttonWithText("Module + Popup"));

    expect(themeScope()?.dataset.moduleRadius).toBe("soft");
    expect(themeScope()?.dataset.moduleShadow).toBe("all");
    expect(themeScope()?.dataset.moduleBackground).toBeUndefined();
    expect(buttonWithText("Soft").getAttribute("aria-pressed")).toBe("true");
    expect(buttonWithText("Module + Popup").getAttribute("aria-pressed")).toBe(
      "true",
    );

    for (const [label, value] of MODULE_BACKGROUND_OPTIONS) {
      await click(buttonWithText(label));

      expect(previewRoot()?.dataset.moduleBackground).toBe(value);
      expect(themeScope()?.dataset.moduleBackground).toBeUndefined();
      expect(buttonWithText(label).getAttribute("aria-pressed")).toBe("true");
    }
  });

  it("defines preview-local background variants", () => {
    for (const [, value] of MODULE_BACKGROUND_OPTIONS) {
      expect(previewStyles).toContain(
        `.module-shell-visual-preview[data-module-background="${value}"]`,
      );
    }

    expect(previewStyles).not.toContain(
      ".module-body[data-module-background",
    );
    expect(previewStyles).not.toContain(
      ".module-popup[data-module-background",
    );
  });

  it("keeps collapse anchored in the local preview stage", async () => {
    await render(<ModuleShellVisualPreviewApp />);

    const stage = document.querySelector(".module-shell-visual-preview__stage");
    const shell = document.querySelector<HTMLElement>(".module-shell");
    const stageClassName = stage?.className;
    const shellParent = shell?.parentElement;
    const scope = themeScope();

    expect(stage?.contains(shell)).toBe(true);
    expect(stage?.contains(scope)).toBe(true);
    expect(shellParent).toBe(scope);
    expect(shell?.getAttribute("data-module-body-collapsed")).toBe("false");

    await click(buttonWithAriaLabel("Collapse module body"));

    expect(stage?.className).toBe(stageClassName);
    expect(stage?.contains(shell)).toBe(true);
    expect(shell?.parentElement).toBe(shellParent);
    expect(shell?.getAttribute("data-module-body-collapsed")).toBe("true");
    expect(document.querySelector(".module-header")?.textContent).toContain(
      "Dummy Module",
    );

    await click(buttonWithAriaLabel("Expand module body"));

    expect(stage?.className).toBe(stageClassName);
    expect(shell?.parentElement).toBe(shellParent);
    expect(shell?.getAttribute("data-module-body-collapsed")).toBe("false");
  });

  it("keeps the preview entrypoint isolated from product modules and runtime APIs", () => {
    const imports = extractImportText(previewSource);

    expect(imports).toContain("moduleshellexample");

    for (const term of [
      "workbenchcanvas",
      "widgetregistry",
      "widgethost",
      "widgetframe",
      "widgetv2shell",
      "queue",
      "workspaceagent",
      "workspace-agent",
      "interactive-agent",
      "knowledge",
      "skill",
      "terminal",
      "notes",
      "agentactivity",
      "agent-activity",
      "scheduler",
      "runtime",
      "backend",
      "tauri",
      "storage",
      "schema",
    ]) {
      expect(imports).not.toContain(term);
    }
  });
});

async function render(element: ReactNode) {
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);

  await act(async () => {
    root?.render(element);
    await Promise.resolve();
  });
}

async function click(element: HTMLElement) {
  await act(async () => {
    element.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    await Promise.resolve();
  });
}

function buttonWithText(label: string) {
  const button = Array.from(document.querySelectorAll("button")).find(
    (candidate) => candidate.textContent?.trim() === label,
  );

  if (!button) {
    throw new Error(`Button not found: ${label}`);
  }

  return button;
}

function buttonWithAriaLabel(label: string) {
  const button = document.querySelector<HTMLButtonElement>(
    `button[aria-label="${label}"]`,
  );

  if (!button) {
    throw new Error(`Button not found: ${label}`);
  }

  return button;
}

function optionLabels(groupLabel: string) {
  const optionGroup = document.querySelector<HTMLElement>(
    `[role="group"][aria-label="${groupLabel}"]`,
  );

  if (!optionGroup) {
    throw new Error(`Option group not found: ${groupLabel}`);
  }

  return Array.from(optionGroup.querySelectorAll("button")).map(
    (button) => button.textContent?.trim() ?? "",
  );
}

function themeScope() {
  return document.querySelector<HTMLElement>(
    "[data-module-theme-scope='true']",
  );
}

function previewRoot() {
  return document.querySelector<HTMLElement>(".module-shell-visual-preview");
}

function extractImportText(source: string) {
  const lines = source.split(/\r?\n/);
  const importLines: string[] = [];
  let inImport = false;

  for (const line of lines) {
    const trimmed = line.trim();

    if (trimmed.startsWith("import ")) {
      inImport = true;
    }

    if (inImport) {
      importLines.push(trimmed);
    }

    if (inImport && trimmed.endsWith(";")) {
      inImport = false;
    }
  }

  return importLines.join("\n").toLowerCase();
}

function readFrontendFile(path: string) {
  return readFileSync(`${process.cwd()}/${path}`, "utf8");
}
