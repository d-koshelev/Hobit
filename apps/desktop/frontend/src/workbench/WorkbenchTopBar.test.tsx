import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { AppThemeController } from "../theme/useAppTheme";
import { WorkbenchTopBar } from "./WorkbenchTopBar";
import type { WorkbenchViewState } from "./types";
import { DEFAULT_WORKBENCH_GRID_SIZE } from "./workbenchLayoutGeometry";

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
  vi.clearAllMocks();
});

describe("WorkbenchTopBar", () => {
  it("renames the current workspace from an explicit top-bar action", async () => {
    const onRenameWorkspace = vi.fn().mockResolvedValue(true);

    renderTopBar({ onRenameWorkspace });

    await awaitAct(() => {
      buttonWithText("Rename").dispatchEvent(
        new MouseEvent("click", { bubbles: true }),
      );
    });

    const input = document.querySelector<HTMLInputElement>(
      "input[aria-label='Workspace name']",
    );

    if (!input) {
      throw new Error("Workspace name input not found.");
    }

    await awaitAct(() => {
      setInputValue(input, "Incident Review");
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });
    await awaitAct(() => {
      buttonWithText("Save").dispatchEvent(
        new MouseEvent("click", { bubbles: true }),
      );
    });

    expect(onRenameWorkspace).toHaveBeenCalledWith("Incident Review");
    expect(
      document.querySelector("input[aria-label='Workspace name']"),
    ).toBeNull();
  });

  it("groups Theme, Layout Lock, and Grid under the View control", async () => {
    renderTopBar();

    expect(document.body.textContent).toContain("View");
    expect(document.body.textContent).not.toContain("Theme");
    expect(document.body.textContent).not.toContain("Layout unlocked");
    expect(document.body.textContent).not.toContain("Grid");

    await awaitAct(() => {
      buttonWithText("View").dispatchEvent(
        new MouseEvent("click", { bubbles: true }),
      );
    });

    expect(document.body.textContent).toContain("Theme");
    expect(document.body.textContent).toContain("Layout unlocked");
    expect(document.body.textContent).toContain("Grid");
  });
});

function renderTopBar({
  onRenameWorkspace = vi.fn().mockResolvedValue(true),
}: {
  onRenameWorkspace?: (title: string) => Promise<boolean>;
} = {}) {
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);

  act(() => {
    root?.render(
      <WorkbenchTopBar
        activityPanelId="activity-panel"
        activityStatus={{
          assistiveText: "No active local runs",
          detail: "No active local runs",
          kind: "idle",
          label: "Idle",
        }}
        gridSize={DEFAULT_WORKBENCH_GRID_SIZE}
        isActivityPanelOpen={false}
        layoutMode="editing"
        onGridSizeChange={vi.fn()}
        onLayoutModeChange={vi.fn()}
        onOpenWidgetCatalog={vi.fn()}
        onRenameWorkspace={onRenameWorkspace}
        onToggleActivityPanel={vi.fn()}
        theme={themeController()}
        viewState={workbenchViewState()}
      />,
    );
  });
}

function workbenchViewState(): WorkbenchViewState {
  return {
    recentEvents: [],
    sharedStateObjects: [],
    widgets: [],
    workbench: {
      id: "workbench_1",
      preset: {
        description: null,
        id: "coordinator-notes",
        title: "Agent + Notes Workbench",
      },
    },
    workspace: {
      description: null,
      id: "workspace_1",
      status: "active",
      title: "Shell Activity Test",
    },
  };
}

function themeController(): AppThemeController {
  return {
    customTheme: {
      basedOn: "dark-default",
      values: {
        accent: "#4a84ff",
        background: "#0b1320",
        border: "#2d3b52",
        mutedText: "#8d97aa",
        surface: "#141d2c",
        surfaceElevated: "#182234",
        text: "#f3f6fb",
      },
    },
    resetCustomTheme: vi.fn(),
    resolvedTheme: {
      id: "dark-default",
      mode: "dark",
      name: "Dark / Default",
      variables: {} as AppThemeController["resolvedTheme"]["variables"],
    },
    selectedThemeId: "dark-default",
    selectCustomTheme: vi.fn(),
    selectPresetTheme: vi.fn(),
    selectUiScale: vi.fn(),
    uiScale: 1,
    updateCustomThemeValue: vi.fn(),
  };
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

function setInputValue(input: HTMLInputElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(
    HTMLInputElement.prototype,
    "value",
  )?.set;

  if (!setter) {
    throw new Error("HTMLInputElement value setter not found.");
  }

  setter.call(input, value);
}

function awaitAct(action: () => void) {
  return act(async () => {
    action();
    await Promise.resolve();
  });
}
