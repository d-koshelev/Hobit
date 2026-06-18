import { readFileSync } from "fs";
import { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ModulePopup } from "./ModulePopup";
import modulePopupSource from "./ModulePopup.tsx?raw";

let container: HTMLDivElement | null = null;
let root: Root | null = null;
const moduleTokenStyles = readFrontendFile("src/styles/tokens.css");
const moduleWidgetStyles = readFrontendFile("src/styles/ui/widget.css");

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

describe("ModulePopup", () => {
  it("renders when open", async () => {
    await render(
      <ModulePopup
        id="test-module-popup"
        onClose={() => undefined}
        open={true}
        title="Test popup"
      >
        <p>Quiet popup body</p>
      </ModulePopup>,
    );

    const popup = modulePopup();

    expect(popup).not.toBeNull();
    expect(popup?.textContent).toContain("Test popup");
    expect(popup?.textContent).toContain("Quiet popup body");
    expect(popup?.classList.contains("module-popup")).toBe(true);
    expect(popup?.dataset.modulePopupFloating).toBe("true");
    expect(document.querySelector("[data-module-floating-layer='true']")).not.toBeNull();
  });

  it("does not render when closed", async () => {
    await render(
      <ModulePopup
        id="test-module-popup"
        onClose={() => undefined}
        open={false}
        title="Test popup"
      >
        <p>Quiet popup body</p>
      </ModulePopup>,
    );

    expect(modulePopup()).toBeNull();
    expect(document.querySelector("[data-module-floating-layer='true']")).toBeNull();
  });

  it("calls onClose from the close action", async () => {
    const onClose = vi.fn();

    await render(
      <ModulePopup
        closeLabel="Close test popup"
        id="test-module-popup"
        onClose={onClose}
        open={true}
        title="Test popup"
      >
        <p>Quiet popup body</p>
      </ModulePopup>,
    );

    await click(buttonWithAriaLabel("Close test popup"));

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("exposes the popup header as the drag handle", async () => {
    await render(
      <ModulePopup
        dragLabel="Move test popup"
        dragTitle="Drag test popup"
        id="test-module-popup"
        onClose={() => undefined}
        open={true}
        title="Test popup"
      >
        <p>Quiet popup body</p>
      </ModulePopup>,
    );

    const handle = modulePopupDragHandle();

    expect(handle.classList.contains("module-popup-header")).toBe(true);
    expect(handle.getAttribute("aria-label")).toBe("Move test popup");
    expect(handle.getAttribute("title")).toBe("Drag test popup");
  });

  it("marks the popup close action as a flat header segment", async () => {
    await render(
      <ModulePopup
        closeLabel="Close test popup"
        id="test-module-popup"
        onClose={() => undefined}
        open={true}
        title="Test popup"
      >
        <p>Quiet popup body</p>
      </ModulePopup>,
    );

    const close = buttonWithAriaLabel("Close test popup");

    expect(close.dataset.modulePopupClose).toBe("true");
    expect(close.dataset.modulePopupCloseFlat).toBe("true");
    expect(close.className).not.toContain("separator");
  });

  it("uses theme-controlled graphite popup elevation instead of bright default outlines", () => {
    expect(moduleTokenStyles).toContain("--module-radius: 2px;");
    expect(moduleTokenStyles).toContain(
      "--module-popup-radius: var(--module-radius);",
    );
    expect(moduleWidgetStyles).toContain(
      '.module-theme-scope[data-module-radius="soft"]',
    );
    expect(moduleWidgetStyles).toContain("--module-popup-radius: 5px;");
    expect(moduleTokenStyles).toContain("--module-theme-shadow-module: none;");
    expect(moduleTokenStyles).toContain("--module-popup-shadow-subtle:");
    expect(moduleTokenStyles).toContain("--module-popup-shadow-subtle-active:");
    expect(moduleTokenStyles).toContain(
      "--module-theme-shadow-popup: var(--module-popup-shadow-subtle);",
    );
    expect(moduleTokenStyles).toContain(
      "--module-palette-popup-border: #22282f;",
    );
    expect(moduleTokenStyles).toContain(
      "--module-popup-focus-outline-color: var(--module-palette-popup-focus);",
    );
    expect(moduleTokenStyles).toContain(
      "--module-popup-close-background: var(--module-popup-header-background);",
    );
    expect(moduleTokenStyles).not.toContain("--module-popup-shadow: none");
    expect(moduleTokenStyles).not.toMatch(
      /--module-palette-popup-border:\s*#(?:fff|ffffff)\b/i,
    );

    expect(moduleWidgetStyles).toContain(
      "border: 1px solid var(--module-popup-border-color);",
    );
    expect(moduleWidgetStyles).toContain(
      "border-radius: var(--module-popup-radius);",
    );
    expect(moduleWidgetStyles).toContain(
      "box-shadow: var(--module-theme-shadow-popup);",
    );
    expect(moduleWidgetStyles).toContain(
      "border-color: var(--module-popup-border-active-color);",
    );
    expect(moduleWidgetStyles).toContain(
      "box-shadow: var(--module-theme-shadow-popup-active);",
    );
    expect(moduleWidgetStyles).not.toContain(
      "box-shadow: var(--module-popup-shadow);",
    );
    expect(moduleWidgetStyles).toContain(
      "outline: 1px solid var(--module-popup-focus-outline-color);",
    );
    expect(moduleWidgetStyles).toContain(
      "background: var(--module-popup-header-background);",
    );
    expect(moduleWidgetStyles).toContain(
      "background: var(--module-popup-close-background);",
    );
  });

  it("updates local style position when the header is dragged", async () => {
    await render(
      <ModulePopup
        defaultPosition={{ x: 20, y: 30 }}
        id="test-module-popup"
        onClose={() => undefined}
        open={true}
        title="Test popup"
      >
        <p>Quiet popup body</p>
      </ModulePopup>,
    );

    const initialPopup = modulePopupOrThrow();

    expect(popupCoordinate(initialPopup, "--module-popup-x")).toBe(20);
    expect(popupCoordinate(initialPopup, "--module-popup-y")).toBe(30);

    await drag(modulePopupDragHandle(), {
      endX: 125,
      endY: 85,
      startX: 100,
      startY: 60,
    });

    const movedPopup = modulePopupOrThrow();

    expect(movedPopup.dataset.modulePopupMoving).toBe("false");
    expect(popupCoordinate(movedPopup, "--module-popup-x")).toBe(45);
    expect(popupCoordinate(movedPopup, "--module-popup-y")).toBe(55);
  });

  it("keeps dragged position state beyond a narrow local layer", async () => {
    await render(
      <div className="narrow-popup-stage" style={{ width: 120 }}>
        <ModulePopup
          defaultPosition={{ x: 20, y: 30 }}
          id="test-module-popup"
          onClose={() => undefined}
          open={true}
          title="Test popup"
        >
          <p>Quiet popup body</p>
        </ModulePopup>
      </div>,
    );

    const layer = document.querySelector("[data-module-floating-layer='true']");

    expect(layer?.parentElement?.classList.contains("narrow-popup-stage")).toBe(
      true,
    );

    await drag(modulePopupDragHandle(), {
      endX: 520,
      endY: 80,
      startX: 100,
      startY: 60,
    });

    expect(popupCoordinate(modulePopupOrThrow(), "--module-popup-x")).toBe(440);
    expect(
      popupCoordinate(modulePopupOrThrow(), "--module-popup-x"),
    ).toBeGreaterThan(120);
  });

  it("uses domain-free imports only", () => {
    expectForbiddenImports(modulePopupSource);
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

async function drag(
  element: HTMLElement,
  options: {
    readonly endX: number;
    readonly endY: number;
    readonly startX: number;
    readonly startY: number;
  },
) {
  await act(async () => {
    element.dispatchEvent(
      new MouseEvent("pointerdown", {
        bubbles: true,
        button: 0,
        clientX: options.startX,
        clientY: options.startY,
      }),
    );
    window.dispatchEvent(
      new MouseEvent("pointermove", {
        bubbles: true,
        clientX: options.endX,
        clientY: options.endY,
      }),
    );
    window.dispatchEvent(
      new MouseEvent("pointerup", {
        bubbles: true,
        clientX: options.endX,
        clientY: options.endY,
      }),
    );
    await Promise.resolve();
  });
}

function modulePopup() {
  return document.querySelector<HTMLElement>("#test-module-popup[role='dialog']");
}

function modulePopupOrThrow() {
  const popup = modulePopup();

  if (!popup) {
    throw new Error("ModulePopup not found.");
  }

  return popup;
}

function modulePopupDragHandle() {
  const handle = document.querySelector<HTMLElement>(
    "[data-module-popup-drag-handle='true']",
  );

  if (!handle) {
    throw new Error("ModulePopup drag handle not found.");
  }

  return handle;
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

function popupCoordinate(popup: HTMLElement, propertyName: string) {
  const value = popup.style.getPropertyValue(propertyName);
  const coordinate = Number.parseInt(value, 10);

  if (!Number.isFinite(coordinate)) {
    throw new Error(`Invalid popup coordinate ${propertyName}: ${value}`);
  }

  return coordinate;
}

function expectForbiddenImports(source: string) {
  const imports = extractImportText(source);

  for (const term of [
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
    "workbench",
    "widgethost",
    "widgetregistry",
    "widgetframe",
    "widgetv2shell",
    "storage",
    "schema",
  ]) {
    expect(imports).not.toContain(term);
  }
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
