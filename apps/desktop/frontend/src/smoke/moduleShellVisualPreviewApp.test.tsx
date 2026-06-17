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
    expect(document.body.textContent).toContain(
      "Static clean canvas content for the shared module shell.",
    );
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
