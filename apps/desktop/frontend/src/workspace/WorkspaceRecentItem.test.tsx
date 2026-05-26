import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { WorkspaceSummary } from "./types";
import { WorkspaceRecentItem } from "./WorkspaceRecentItem";

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

describe("WorkspaceRecentItem", () => {
  it("renders created, last opened, and compact stats without an active badge", () => {
    renderRecentItem(
      workspaceSummary({
        createdAt: "2026-05-25T10:00:00.000Z",
        lastOpenedAt: "2026-05-25T20:34:00.000Z",
        updatedAt: "2026-05-25T20:34:00.000Z",
        widgetCount: 2,
        workspaceAgentCount: 1,
        noteCount: 2,
        skillCount: 1,
        knowledgeDocumentCount: 3,
        queueTaskCount: 1,
      }),
    );

    expect(document.body.textContent).toContain("Created:");
    expect(document.body.textContent).toContain("25");
    expect(document.body.textContent).toContain("2026");
    expect(document.body.textContent).toContain("Last opened:");
    expect(document.body.textContent).toContain("Widgets: 2");
    expect(document.body.textContent).toContain("Agents: 1");
    expect(document.body.textContent).toContain("Notes: 2");
    expect(document.body.textContent).toContain("Skills: 1");
    expect(document.body.textContent).toContain("Docs: 3");
    expect(document.body.textContent).toContain("Queue: 1");
    expect(document.body.textContent).not.toContain("active");
  });

  it("opens the selected workspace from the compact action", () => {
    const onOpenWorkspace = vi.fn();
    const workspace = workspaceSummary();
    renderRecentItem(workspace, undefined, onOpenWorkspace);

    act(() => {
      buttonWithText("Open").dispatchEvent(
        new MouseEvent("click", { bubbles: true }),
      );
    });

    expect(onOpenWorkspace).toHaveBeenCalledWith(workspace);
  });

  it("uses Updated when last opened is unavailable", () => {
    renderRecentItem(
      workspaceSummary({
        lastOpenedAt: null,
        updatedAt: "2026-05-25T20:34:00.000Z",
      }),
    );

    expect(document.body.textContent).toContain("Updated:");
    expect(document.body.textContent).not.toContain("Last opened:");
  });

  it("keeps delete behind confirmation", async () => {
    const onDeleteWorkspace = vi.fn().mockResolvedValue(undefined);
    renderRecentItem(workspaceSummary(), onDeleteWorkspace);

    expect(onDeleteWorkspace).not.toHaveBeenCalled();

    act(() => {
      buttonWithText("Delete").dispatchEvent(
        new MouseEvent("click", { bubbles: true }),
      );
    });

    const confirmButton = buttonWithText("Delete Workspace");
    expect(confirmButton.hasAttribute("disabled")).toBe(true);

    await act(async () => {
      const input = document.querySelector("input");

      if (!input) {
        throw new Error("Delete confirmation input not found.");
      }

      input.value = "Lifecycle Workspace";
      input.dispatchEvent(new Event("input", { bubbles: true }));
      await Promise.resolve();
    });

    await act(async () => {
      buttonWithText("Delete Workspace").dispatchEvent(
        new MouseEvent("click", { bubbles: true }),
      );
      await Promise.resolve();
    });

    expect(onDeleteWorkspace).toHaveBeenCalledTimes(1);
  });
});

function renderRecentItem(
  workspace = workspaceSummary(),
  onDeleteWorkspace:
    | ((workspace: WorkspaceSummary) => Promise<void>)
    | undefined = undefined,
  onOpenWorkspace: (workspace: WorkspaceSummary) => void = () => undefined,
) {
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);

  act(() => {
    root?.render(
      <WorkspaceRecentItem
        isDeleting={false}
        isDisabled={false}
        isOpening={false}
        onDeleteWorkspace={onDeleteWorkspace ?? (() => Promise.resolve())}
        onOpenWorkspace={onOpenWorkspace}
        workspace={workspace}
      />,
    );
  });
}

function workspaceSummary(
  overrides: Partial<WorkspaceSummary> = {},
): WorkspaceSummary {
  return {
    createdAt: "2026-05-25T10:00:00.000Z",
    description: null,
    id: "workspace_1",
    knowledgeDocumentCount: 0,
    lastOpenedAt: null,
    noteCount: 0,
    queueTaskCount: 0,
    skillCount: 0,
    status: "active",
    title: "Lifecycle Workspace",
    updatedAt: "2026-05-25T10:00:00.000Z",
    widgetCount: 0,
    workbenchId: "workbench_1",
    workspaceAgentCount: 0,
    ...overrides,
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
