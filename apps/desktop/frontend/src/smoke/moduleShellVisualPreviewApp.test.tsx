import { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";

import { ModuleShellVisualPreviewApp } from "./moduleShellVisualPreviewApp";
import previewSource from "./moduleShellVisualPreviewApp.tsx?raw";

let container: HTMLDivElement | null = null;
let root: Root | null = null;

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
    expect(document.body.textContent).toContain(
      "Static clean canvas content for the shared module shell.",
    );
    expect(document.querySelector("[data-module-body-rail='true']")).not.toBeNull();
  });

  it("opens the settings popup in the local preview overlay layer", async () => {
    await render(<ModuleShellVisualPreviewApp />);

    await click(buttonWithText("Settings"));

    const popup = document.querySelector(
      "#module-shell-example-settings-popup[role='dialog']",
    );
    const layer = document.querySelector("[data-module-floating-layer='true']");
    const stage = document.querySelector(".module-shell-visual-preview__stage");

    expect(popup).not.toBeNull();
    expect(layer).not.toBeNull();
    expect(stage?.contains(layer)).toBe(true);
    expect(layer?.classList.contains("module-shell-floating-layer")).toBe(true);
    expect(layer?.contains(popup)).toBe(true);
    expect(popup?.closest(".module-header")).toBeNull();
    expect(popup?.closest(".module-body")).toBeNull();
  });

  it("keeps the preview entrypoint isolated from product modules and runtime APIs", () => {
    const imports = extractImportText(previewSource);

    expect(imports).toContain("moduleshellexample");

    for (const term of [
      "workbenchcanvas",
      "widgetregistry",
      "widgethost",
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
