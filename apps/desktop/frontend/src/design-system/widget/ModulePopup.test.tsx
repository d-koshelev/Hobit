import { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ModulePopup } from "./ModulePopup";
import modulePopupSource from "./ModulePopup.tsx?raw";

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
