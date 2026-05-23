import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";

import { WorkbenchShell } from "./WorkbenchShell";
import type { WorkbenchViewState } from "./types";

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
});

describe("WorkbenchShell global activity", () => {
  it("renders the compact shell summary and opens Recent Activity in a bottom drawer", () => {
    renderShell();

    expect(document.body.textContent).toContain("Idle");
    expect(document.body.textContent).toContain("No active local runs");
    expect(document.querySelector("#workbench-activity-panel")).toBeNull();
    expect(
      document.querySelector(".canvas-shell")?.textContent,
    ).not.toContain("Recent Activity");

    const activityButton = buttonWithText("Activity");

    act(() => {
      activityButton.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(activityButton.getAttribute("aria-expanded")).toBe("true");
    expect(document.querySelector("#workbench-activity-panel")).not.toBeNull();
    expect(document.body.textContent).toContain("Recent Activity");
    expect(document.body.textContent).toContain("Widget added");
    expect(document.body.textContent).toContain("Workspace opened");
    expect(
      document.querySelector(".canvas-shell")?.textContent,
    ).not.toContain("Recent Activity");

    act(() => {
      buttonWithText("Close").dispatchEvent(
        new MouseEvent("click", { bubbles: true }),
      );
    });

    expect(document.querySelector("#workbench-activity-panel")).toBeNull();
    expect(activityButton.getAttribute("aria-expanded")).toBe("false");
  });
});

function renderShell() {
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);

  act(() => {
    root?.render(
      <WorkbenchShell
        onViewStateChange={() => undefined}
        viewState={workbenchViewState()}
      />,
    );
  });
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

function workbenchViewState(): WorkbenchViewState {
  return {
    recentEvents: [
      {
        createdAt: "2026-05-22T10:00:00.000Z",
        id: "event_workspace_opened",
        kind: "workspace_opened",
        summary: "Workspace opened",
      },
      {
        createdAt: "2026-05-22T10:01:00.000Z",
        id: "event_widget_added",
        kind: "widget_instance_added",
        summary: "Widget added",
      },
    ],
    sharedStateObjects: [],
    widgets: [],
    workbench: {
      id: "workbench_1",
      preset: {
        description: null,
        id: "preset_empty",
        title: "Empty Workbench",
      },
    },
    workspace: {
      description: null,
      id: "workspace_1",
      status: "open",
      title: "Shell Activity Test",
    },
  };
}
