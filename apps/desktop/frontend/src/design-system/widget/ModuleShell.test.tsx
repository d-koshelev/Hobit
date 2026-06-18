import { readFileSync } from "fs";
import { act, useState, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";

import moduleShellSource from "./ModuleShell.tsx?raw";
import { ModuleShellExample } from "./ModuleShellExample";
import moduleShellExampleSource from "./ModuleShellExample.tsx?raw";
import moduleControlsSource from "./ModuleControls.tsx?raw";
import modulePopupSource from "./ModulePopup.tsx?raw";
import moduleSplitSource from "./ModuleSplit.tsx?raw";
import {
  ModuleBody,
  ModuleHeader,
  ModuleHeaderAction,
  ModuleHeaderMinimize,
  ModuleHeaderState,
  ModuleHeaderTitle,
  ModuleRail,
  ModuleShell,
  ModuleSplit,
  ModuleSplitRegion,
  type ModuleRailOrientation,
} from "./ModuleShell";

let container: HTMLDivElement | null = null;
let root: Root | null = null;
const NARROW_MODULE_WIDTH = 360;
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

describe("ModuleShell", () => {
  it("renders title, state, header groups, right actions, and arbitrary body content", async () => {
    await render(
      <ModuleShell aria-label="Test module shell">
        <ModuleHeader
          left={
            <>
              <ModuleHeaderTitle>Review Module</ModuleHeaderTitle>
              <ModuleHeaderState tone="running">Running</ModuleHeaderState>
            </>
          }
          right={
            <>
              <ModuleHeaderAction>Primary</ModuleHeaderAction>
              <ModuleHeaderAction>Activity</ModuleHeaderAction>
            </>
          }
        />
        <ModuleBody>
          <article data-arbitrary-body="true">
            <h3>Arbitrary body content</h3>
            <p>Any body node can render here.</p>
          </article>
        </ModuleBody>
      </ModuleShell>,
    );

    expect(document.body.textContent).toContain("Review Module");
    expect(document.body.textContent).toContain("Running");
    expect(document.querySelector(".module-header-state-running")).not.toBeNull();
    expect(
      document.querySelector("[data-module-state-tone='running']"),
    ).not.toBeNull();

    const leftGroup = group("left");
    const rightGroup = group("right");

    expect(leftGroup.textContent).toContain("Review Module");
    expect(leftGroup.textContent).toContain("Running");
    expect(rightGroup.textContent).toContain("Primary");
    expect(rightGroup.textContent).toContain("Activity");
    expect(rightGroup.querySelectorAll(".module-header-action")).toHaveLength(2);
    expect(document.querySelector(".module-header-center")).toBeNull();
    expect(document.querySelector("[data-module-header-group='center']")).toBeNull();
    expect(document.querySelector("[data-arbitrary-body='true']")).not.toBeNull();
  });

  it("collapses only the body while keeping the header visible", async () => {
    function CollapsibleModule() {
      const [collapsed, setCollapsed] = useState(false);

      return (
        <ModuleShell bodyCollapsed={collapsed}>
          <ModuleHeader
            left={
              <>
                <ModuleHeaderTitle>Collapsible Module</ModuleHeaderTitle>
                <ModuleHeaderState tone="idle">Idle</ModuleHeaderState>
              </>
            }
            right={
              <ModuleHeaderMinimize
                collapsed={collapsed}
                onClick={() => setCollapsed((current) => !current)}
              />
            }
          />
          <ModuleBody collapsed={collapsed} id="collapsible-module-body">
            <p>Body-only content</p>
          </ModuleBody>
        </ModuleShell>
      );
    }

    await render(<CollapsibleModule />);

    const body = document.querySelector<HTMLDivElement>(
      "#collapsible-module-body",
    );
    expect(body).not.toBeNull();
    expect(body?.hidden).toBe(false);
    expect(document.querySelector(".module-header")?.textContent).toContain(
      "Collapsible Module",
    );

    await click(buttonWithAriaLabel("Collapse module body"));

    expect(body?.hidden).toBe(true);
    expect(document.querySelector(".module-shell")?.getAttribute(
      "data-module-body-collapsed",
    )).toBe("true");
    expect(document.querySelector(".module-header")?.textContent).toContain(
      "Collapsible Module",
    );
    expect(buttonWithAriaLabel("Expand module body")).not.toBeNull();

    await click(buttonWithAriaLabel("Expand module body"));

    expect(body?.hidden).toBe(false);
    expect(document.querySelector(".module-shell")?.getAttribute(
      "data-module-body-collapsed",
    )).toBe("false");
  });

  it("marks header actions as flat segments without separator classes", async () => {
    await render(
      <ModuleShell aria-label="Flat action fixture">
        <ModuleHeader
          left={<ModuleHeaderTitle>Flat Header</ModuleHeaderTitle>}
          right={
            <>
              <ModuleHeaderAction>Primary</ModuleHeaderAction>
              <ModuleHeaderAction active>Settings</ModuleHeaderAction>
              <ModuleHeaderMinimize collapsed={false} />
            </>
          }
        />
        <ModuleBody>
          <p>Body</p>
        </ModuleBody>
      </ModuleShell>,
    );

    const actions = Array.from(
      document.querySelectorAll<HTMLButtonElement>(
        "[data-module-header-action='true']",
      ),
    );

    expect(actions).toHaveLength(3);
    expect(actions.every((action) => action.dataset.moduleHeaderActionFlat === "true"))
      .toBe(true);
    expect(actions.every((action) => !action.className.includes("separator")))
      .toBe(true);
    expect(actions[1]?.dataset.active).toBe("true");
  });

  it("renders header state as a calm indicator instead of an action", async () => {
    await render(
      <ModuleShell aria-label="State indicator fixture">
        <ModuleHeader
          left={
            <>
              <ModuleHeaderTitle>State Fixture</ModuleHeaderTitle>
              <ModuleHeaderState
                aria-label="Module state: Completed"
                tone="completed"
              >
                <span className="module-header-state-value">Completed</span>
              </ModuleHeaderState>
            </>
          }
          right={<ModuleHeaderAction>Primary</ModuleHeaderAction>}
        />
        <ModuleBody>
          <p>Body</p>
        </ModuleBody>
      </ModuleShell>,
    );

    const state = document.querySelector<HTMLElement>(
      ".module-header-state-completed",
    );

    expect(state).not.toBeNull();
    expect(state?.tagName).toBe("SPAN");
    expect(state?.dataset.moduleHeaderState).toBe("indicator");
    expect(state?.dataset.moduleHeaderAction).toBeUndefined();
    expect(state?.textContent).toBe("Completed");
    expect(state?.querySelector(".module-header-state-label")).toBeNull();
    expect(buttonWithText("Primary").dataset.moduleHeaderAction).toBe("true");
  });

  it("defines shared module radius hooks for shell and header surfaces", () => {
    expect(moduleWidgetStyles).toContain(
      '.module-theme-scope[data-module-radius="sharp"]',
    );
    expect(moduleWidgetStyles).toContain("--module-radius: 0px;");
    expect(moduleWidgetStyles).toContain("--module-control-radius: 0px;");
    expect(moduleWidgetStyles).toContain("--module-popup-radius: 0px;");
    expect(moduleWidgetStyles).toContain(
      '.module-theme-scope[data-module-radius="compact"]',
    );
    expect(moduleWidgetStyles).toContain("--module-radius: 2px;");
    expect(moduleWidgetStyles).toContain("--module-control-radius: 2px;");
    expect(moduleWidgetStyles).toContain("--module-popup-radius: 2px;");
    expect(moduleWidgetStyles).toContain(
      '.module-theme-scope[data-module-radius="soft"]',
    );
    expect(moduleWidgetStyles).toContain("--module-radius: 5px;");
    expect(moduleWidgetStyles).toContain("--module-control-radius: 5px;");
    expect(moduleWidgetStyles).toContain("--module-popup-radius: 5px;");
    expect(moduleWidgetStyles).toContain(
      "border-radius: var(--module-radius);",
    );
    expect(moduleWidgetStyles).toContain(
      "var(--module-radius) var(--module-radius) 0 0",
    );
    expect(moduleWidgetStyles).not.toContain("--module-theme-radius-control");
  });

  it("renders a vertical rail with separator orientation", async () => {
    await render(<SplitFixture orientation="vertical" />);

    const rail = railByOrientation("vertical");

    expect(rail.getAttribute("role")).toBe("separator");
    expect(rail.getAttribute("aria-orientation")).toBe("vertical");
    expect(rail.getAttribute("aria-valuenow")).toBe("240");
    expect(splitByOrientation("vertical").style.getPropertyValue(
      "--module-split-primary-size",
    )).toBe("240px");
  });

  it("renders a horizontal rail with separator orientation", async () => {
    await render(<SplitFixture orientation="horizontal" />);

    const rail = railByOrientation("horizontal");

    expect(rail.getAttribute("role")).toBe("separator");
    expect(rail.getAttribute("aria-orientation")).toBe("horizontal");
    expect(rail.getAttribute("aria-valuenow")).toBe("240");
    expect(splitByOrientation("horizontal").style.getPropertyValue(
      "--module-split-primary-size",
    )).toBe("240px");
  });

  it("dragging a vertical rail changes the primary region size", async () => {
    const restoreSplitBounds = mockModuleSplitBounds({
      height: 420,
      width: 640,
    });

    try {
      await render(<SplitFixture orientation="vertical" />);

      await drag(railByOrientation("vertical"), {
        endX: 320,
        endY: 24,
        startX: 240,
        startY: 24,
      });

      expect(splitPrimarySize("vertical")).toBe(320);
    } finally {
      restoreSplitBounds();
    }
  });

  it("dragging a horizontal rail changes the primary region size", async () => {
    const restoreSplitBounds = mockModuleSplitBounds({
      height: 520,
      width: 640,
    });

    try {
      await render(<SplitFixture orientation="horizontal" />);

      await drag(railByOrientation("horizontal"), {
        endX: 24,
        endY: 310,
        startX: 24,
        startY: 240,
      });

      expect(splitPrimarySize("horizontal")).toBe(310);
    } finally {
      restoreSplitBounds();
    }
  });

  it("clamps rail dragging to the primary and secondary minimum sizes", async () => {
    const restoreSplitBounds = mockModuleSplitBounds({
      height: 420,
      width: 520,
    });

    try {
      await render(
        <SplitFixture
          minPrimarySize={180}
          minSecondarySize={210}
          orientation="vertical"
        />,
      );

      await drag(railByOrientation("vertical"), {
        endX: 20,
        endY: 24,
        startX: 240,
        startY: 24,
      });

      expect(splitPrimarySize("vertical")).toBe(180);

      await drag(railByOrientation("vertical"), {
        endX: 620,
        endY: 24,
        startX: 180,
        startY: 24,
      });

      expect(splitPrimarySize("vertical")).toBe(310);
    } finally {
      restoreSplitBounds();
    }
  });

  it("renders the dummy example without product dependencies", async () => {
    await render(<ModuleShellExample />);

    expect(document.body.textContent).toContain("Dummy Module");
    expect(document.body.textContent).toContain("Completed");
    expect(group("right").textContent).toContain("Primary");
    expect(group("right").textContent).toContain("Activity");
    expect(group("right").textContent).toContain("Settings");
    expect(group("right").textContent).toContain("More");
    expect(headerActionLabels()).toEqual([
      "Primary",
      "Activity",
      "Settings",
      "More",
      "Collapse module body",
    ]);
    expect(group("left").textContent).toBe("Dummy ModuleCompleted");
    expect(document.querySelector(".module-header-state-completed")).not.toBeNull();
    expect(document.querySelector(".module-header-state-label")).toBeNull();
    expect(moduleShellExampleSource).toContain("ModulePopup");
    expect(moduleShellExampleSource).toContain("ModuleButton");
    expect(moduleShellExampleSource).toContain("ModuleTextInput");
    expect(moduleShellExampleSource).toContain("ModuleStatus");
    expect(moduleShellExampleSource).not.toContain("module-settings-popup");
    expect(themeScopeOrThrow().dataset.moduleRadius)
      .toBe("compact");
    expect(themeScopeOrThrow().dataset.moduleShadow)
      .toBe("popup");
    expect(themeScopeOrThrow().dataset.moduleBackground)
      .toBeUndefined();

    expectForbiddenImports(moduleShellExampleSource);
  });

  it("renders the dummy UI kit primitives inside the static preview", async () => {
    await render(<ModuleShellExample />);

    const input =
      document.querySelector<HTMLInputElement>(".module-text-input");
    const textarea =
      document.querySelector<HTMLTextAreaElement>(".module-text-area");
    const buttons = Array.from(
      document.querySelectorAll<HTMLButtonElement>(".module-button"),
    );
    const statuses = Array.from(
      document.querySelectorAll<HTMLElement>(".module-status"),
    );

    expect(document.body.textContent).toContain("Input");
    expect(document.body.textContent).toContain("Statuses");
    expect(input?.placeholder).toBe("Type a concise value");
    expect(input?.value).toBe("Static module value");
    expect(textarea?.placeholder).toBe("Write a short module note");
    expect(textarea?.getAttribute("aria-invalid")).toBe("true");
    expect(buttons.map((button) => button.dataset.moduleButtonVariant)).toEqual([
      "primary",
      "secondary",
      "ghost",
      "danger",
      "quiet",
      "primary",
    ]);
    expect(statuses.map((status) => status.dataset.moduleStatusTone)).toEqual([
      "idle",
      "running",
      "completed",
      "blocked",
      "error",
    ]);
    expect(document.body.textContent).toContain("Module canvas");
    expect(document.body.textContent).toContain(
      "--module-body-background",
    );
    expect(
      document.querySelector('[data-module-notice-tone="success"]'),
    ).not.toBeNull();
  });

  it("opens and closes the dummy settings popup from the header action", async () => {
    await render(<ModuleShellExample />);

    expect(settingsPopup()).toBeNull();

    await click(buttonWithText("Settings"));

    const popup = settingsPopup();
    expect(popup).not.toBeNull();
    expect(popup?.textContent).toContain("Settings");
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
    expect(
      popup?.querySelector('[role="group"][aria-label="Radius"]'),
    ).not.toBeNull();
    expect(
      popup?.querySelector('[role="group"][aria-label="Shadows"]'),
    ).not.toBeNull();
    expect(
      popup?.querySelector('[role="group"][aria-label="Background"]'),
    ).not.toBeNull();
    expect(
      document.querySelector<HTMLButtonElement>(
        'button[aria-expanded="true"][aria-controls="module-shell-example-settings-popup"]',
      ),
    ).not.toBeNull();
    expect(buttonWithText("Compact").getAttribute("aria-pressed")).toBe("true");
    expect(buttonWithText("Popup").getAttribute("aria-pressed")).toBe("true");
    expect(buttonWithText("Grid").getAttribute("aria-pressed")).toBe("true");

    await click(buttonWithAriaLabel("Close settings"));

    expect(settingsPopup()).toBeNull();
  });

  it("changes the dummy preview radius option through local data attributes", async () => {
    await render(<ModuleShellExample />);

    await click(buttonWithText("Settings"));

    expect(themeScopeOrThrow().dataset.moduleRadius).toBe("compact");
    expect(buttonWithText("Compact").getAttribute("aria-pressed")).toBe("true");

    await click(buttonWithText("Soft"));

    expect(themeScopeOrThrow().dataset.moduleRadius).toBe("soft");
    expect(buttonWithText("Soft").getAttribute("aria-pressed")).toBe("true");

    await click(buttonWithText("Sharp"));

    expect(themeScopeOrThrow().dataset.moduleRadius).toBe("sharp");
    expect(buttonWithText("Sharp").getAttribute("aria-pressed")).toBe("true");
  });

  it("changes the dummy preview shadow option through local data attributes", async () => {
    await render(<ModuleShellExample />);

    await click(buttonWithText("Settings"));

    expect(themeScopeOrThrow().dataset.moduleShadow).toBe("popup");
    expect(buttonWithText("Popup").getAttribute("aria-pressed")).toBe("true");

    await click(buttonWithText("Module + Popup"));

    expect(themeScopeOrThrow().dataset.moduleShadow).toBe("all");
    expect(buttonWithText("Module + Popup").getAttribute("aria-pressed")).toBe(
      "true",
    );

    await click(buttonWithText("None"));

    expect(themeScopeOrThrow().dataset.moduleShadow).toBe("none");
    expect(buttonWithText("None").getAttribute("aria-pressed")).toBe("true");
  });

  it("changes each dummy preview background option on the preview root hook only", async () => {
    await render(
      <main className="module-shell-visual-preview">
        <ModuleShellExample />
      </main>,
    );

    await click(buttonWithText("Settings"));

    expect(themeScopeOrThrow().dataset.moduleBackground).toBeUndefined();
    expect(previewRootOrThrow().dataset.moduleBackground).toBe("grid");
    expect(optionLabels("Background")).toEqual(
      MODULE_BACKGROUND_OPTIONS.map(([label]) => label),
    );

    for (const [label, value] of MODULE_BACKGROUND_OPTIONS) {
      await click(buttonWithText(label));

      expect(previewRootOrThrow().dataset.moduleBackground).toBe(value);
      expect(themeScopeOrThrow().dataset.moduleBackground).toBeUndefined();
      expect(buttonWithText(label).getAttribute("aria-pressed")).toBe("true");
    }
  });

  it("renders the dummy settings popup as a floating overlay outside header and body layout", async () => {
    await render(<ModuleShellExample />);

    await click(buttonWithText("Settings"));

    const popup = settingsPopup();
    const layer = document.querySelector("[data-module-floating-layer='true']");
    const body = document.querySelector("#module-shell-example-body");
    const shell = document.querySelector(".module-shell");

    expect(popup).not.toBeNull();
    expect(layer).not.toBeNull();
    expect(popup?.dataset.modulePopupFloating).toBe("true");
    expect(layer?.classList.contains("module-shell-floating-layer")).toBe(true);
    expect(layer?.parentElement).toBe(themeScopeOrThrow());
    expect(layer?.contains(popup)).toBe(true);
    expect(layer?.closest(".module-shell")).toBeNull();
    expect(shell?.contains(layer)).toBe(false);
    expect(popup?.closest(".module-header")).toBeNull();
    expect(popup?.closest(".module-body")).toBeNull();
    expect(body?.contains(popup)).toBe(false);
  });

  it("allows the dummy settings popup to move beyond the parent module width", async () => {
    const restoreModuleShellBounds = mockModuleShellBounds(NARROW_MODULE_WIDTH);

    try {
      await render(<ModuleShellExample />);

      await click(buttonWithText("Settings"));

      const initialPopup = settingsPopupOrThrow();

      expect(
        popupCoordinate(initialPopup, "--module-popup-x"),
      ).toBeGreaterThan(NARROW_MODULE_WIDTH);

      await drag(settingsPopupDragHandle(), {
        endX: 380,
        endY: 90,
        startX: 100,
        startY: 60,
      });

      const movedPopup = settingsPopupOrThrow();

      expect(popupCoordinate(movedPopup, "--module-popup-x")).toBeGreaterThan(
        NARROW_MODULE_WIDTH,
      );
      expect(popupCoordinate(movedPopup, "--module-popup-y")).toBe(74);
    } finally {
      restoreModuleShellBounds();
    }
  });

  it("exposes the dummy settings popup header as a local drag handle", async () => {
    await render(<ModuleShellExample />);

    await click(buttonWithText("Settings"));

    const handle = settingsPopupDragHandle();

    expect(handle.getAttribute("aria-label")).toBe("Move settings popup");
    expect(handle.getAttribute("title")).toBe("Drag settings popup");
  });

  it("moves the dummy settings popup with pointer drag using local style state", async () => {
    await render(<ModuleShellExample />);

    await click(buttonWithText("Settings"));

    const initialPopup = settingsPopupOrThrow();
    const initialX = popupCoordinate(initialPopup, "--module-popup-x");
    const initialY = popupCoordinate(initialPopup, "--module-popup-y");

    await drag(settingsPopupDragHandle(), {
      endX: 150,
      endY: 90,
      startX: 100,
      startY: 60,
    });

    const movedPopup = settingsPopupOrThrow();

    expect(movedPopup.dataset.modulePopupMoving).toBe("false");
    expect(popupCoordinate(movedPopup, "--module-popup-x")).toBe(
      initialX + 50,
    );
    expect(popupCoordinate(movedPopup, "--module-popup-y")).toBe(
      initialY + 30,
    );
  });

  it("renders the dummy body with vertical and horizontal movable rails", async () => {
    await render(<ModuleShellExample />);

    const rails = Array.from(
      document.querySelectorAll<HTMLElement>("[data-module-rail]"),
    );
    const primaryRegion = document.querySelector<HTMLElement>(
      '[aria-label="Input primitive region"]',
    );
    const detailRegion = document.querySelector<HTMLElement>(
      '[aria-label="Detail stack region"]',
    );
    const topRegion = document.querySelector<HTMLElement>(
      '[aria-label="Status primitive region"]',
    );
    const bottomRegion = document.querySelector<HTMLElement>(
      '[aria-label="Composer primitive region"]',
    );

    expect(rails.map((rail) => rail.dataset.moduleRailOrientation)).toEqual([
      "vertical",
      "horizontal",
    ]);
    expect(primaryRegion?.textContent).toContain("Input");
    expect(primaryRegion?.textContent).toContain("Single line");
    expect(primaryRegion?.textContent).toContain("Multiline");
    expect(detailRegion?.textContent).toContain("Detail stack");
    expect(topRegion?.textContent).toContain("Statuses");
    expect(topRegion?.textContent).toContain("Blocked");
    expect(bottomRegion?.textContent).toContain("Composer");
    expect(bottomRegion?.textContent).toContain(
      "Helper text stays inside the module region.",
    );
    expect(document.querySelector(".module-shell-example-zone")).toBeNull();
  });

  it("keeps ModuleShell primitive source imports domain-free", () => {
    expectForbiddenImports(moduleShellSource);
    expectForbiddenImports(moduleSplitSource);
    expectForbiddenImports(modulePopupSource);
    expectForbiddenImports(moduleControlsSource);
  });
});

function SplitFixture({
  minPrimarySize = 160,
  minSecondarySize = 160,
  orientation,
}: {
  readonly minPrimarySize?: number;
  readonly minSecondarySize?: number;
  readonly orientation: ModuleRailOrientation;
}) {
  return (
    <ModuleSplit
      aria-label={`${orientation} split fixture`}
      defaultPrimarySize={240}
      minPrimarySize={minPrimarySize}
      minSecondarySize={minSecondarySize}
      orientation={orientation}
    >
      <ModuleSplitRegion region="primary">
        <p>Primary fixture region</p>
      </ModuleSplitRegion>
      <ModuleRail aria-label={`Resize ${orientation} fixture regions`} />
      <ModuleSplitRegion region="secondary">
        <p>Secondary fixture region</p>
      </ModuleSplitRegion>
    </ModuleSplit>
  );
}

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

function buttonWithAriaLabel(label: string) {
  const button = document.querySelector<HTMLButtonElement>(
    `button[aria-label="${label}"]`,
  );

  if (!button) {
    throw new Error(`Button not found: ${label}`);
  }

  return button;
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

function headerActionLabels() {
  return Array.from(group("right").querySelectorAll("button")).map(
    (button) => button.textContent?.trim() || button.getAttribute("aria-label"),
  );
}

function settingsPopup() {
  return document.querySelector<HTMLElement>(
    "#module-shell-example-settings-popup[role='dialog']",
  );
}

function settingsPopupOrThrow() {
  const popup = settingsPopup();

  if (!popup) {
    throw new Error("Settings popup not found.");
  }

  return popup;
}

function themeScopeOrThrow() {
  const shell = document.querySelector<HTMLElement>(
    "[data-module-theme-scope='true']",
  );

  if (!shell) {
    throw new Error("Module theme scope not found.");
  }

  return shell;
}

function previewRootOrThrow() {
  const root = document.querySelector<HTMLElement>(
    ".module-shell-visual-preview",
  );

  if (!root) {
    throw new Error("ModuleShell visual preview root not found.");
  }

  return root;
}

function settingsPopupDragHandle() {
  const handle = document.querySelector<HTMLElement>(
    "[data-module-popup-drag-handle='true']",
  );

  if (!handle) {
    throw new Error("Settings popup drag handle not found.");
  }

  return handle;
}

function popupCoordinate(popup: HTMLElement, propertyName: string) {
  const value = popup.style.getPropertyValue(propertyName);
  const coordinate = Number.parseInt(value, 10);

  if (!Number.isFinite(coordinate)) {
    throw new Error(`Invalid popup coordinate ${propertyName}: ${value}`);
  }

  return coordinate;
}

function railByOrientation(orientation: ModuleRailOrientation) {
  const rail = document.querySelector<HTMLElement>(
    `[data-module-rail-orientation="${orientation}"]`,
  );

  if (!rail) {
    throw new Error(`Module rail not found: ${orientation}`);
  }

  return rail;
}

function splitByOrientation(orientation: ModuleRailOrientation) {
  const split = document.querySelector<HTMLElement>(
    `[data-module-split-orientation="${orientation}"]`,
  );

  if (!split) {
    throw new Error(`Module split not found: ${orientation}`);
  }

  return split;
}

function splitPrimarySize(orientation: ModuleRailOrientation) {
  const value = splitByOrientation(orientation).style.getPropertyValue(
    "--module-split-primary-size",
  );
  const primarySize = Number.parseInt(value, 10);

  if (!Number.isFinite(primarySize)) {
    throw new Error(`Invalid split primary size ${orientation}: ${value}`);
  }

  return primarySize;
}

function mockModuleSplitBounds({
  height,
  width,
}: {
  readonly height: number;
  readonly width: number;
}) {
  const originalGetBoundingClientRect =
    HTMLElement.prototype.getBoundingClientRect;

  HTMLElement.prototype.getBoundingClientRect = function getBoundingClientRect(
    this: HTMLElement,
  ) {
    if (this.classList.contains("module-split")) {
      return {
        bottom: height,
        height,
        left: 0,
        right: width,
        top: 0,
        width,
        x: 0,
        y: 0,
        toJSON: () => ({}),
      } as DOMRect;
    }

    return originalGetBoundingClientRect.call(this);
  };

  return () => {
    HTMLElement.prototype.getBoundingClientRect =
      originalGetBoundingClientRect;
  };
}

function mockModuleShellBounds(width: number) {
  const originalGetBoundingClientRect =
    HTMLElement.prototype.getBoundingClientRect;

  HTMLElement.prototype.getBoundingClientRect = function getBoundingClientRect(
    this: HTMLElement,
  ) {
    if (this.classList.contains("module-shell")) {
      return {
        bottom: 420,
        height: 420,
        left: 0,
        right: width,
        top: 0,
        width,
        x: 0,
        y: 0,
        toJSON: () => ({}),
      } as DOMRect;
    }

    return originalGetBoundingClientRect.call(this);
  };

  return () => {
    HTMLElement.prototype.getBoundingClientRect =
      originalGetBoundingClientRect;
  };
}

function group(side: "left" | "right") {
  const element = document.querySelector<HTMLElement>(
    `[data-module-header-group="${side}"]`,
  );

  if (!element) {
    throw new Error(`Module header ${side} group not found.`);
  }

  return element;
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
