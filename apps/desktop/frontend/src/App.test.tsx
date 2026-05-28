import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

import App from "./App";
import type {
  WorkspaceSessionSummary,
  WorkspaceSummary,
  WorkspaceWorkbenchState,
} from "./workspace/types";

const workspaceApiMocks = vi.hoisted(() => ({
  addWidgetInstanceToWorkbench: vi.fn(),
  createWorkspace: vi.fn(),
  deleteWorkspace: vi.fn(),
  getWorkspaceWorkbenchState: vi.fn(),
  listTerminalPtySessions: vi.fn(),
  listWorkspaces: vi.fn(),
  openWorkspace: vi.fn(),
  updateWidgetInstanceLayout: vi.fn(),
}));

vi.mock("./workspace/workspaceApi", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("./workspace/workspaceApi")>();

  return {
    ...actual,
    addWidgetInstanceToWorkbench: workspaceApiMocks.addWidgetInstanceToWorkbench,
    createWorkspace: workspaceApiMocks.createWorkspace,
    deleteWorkspace: workspaceApiMocks.deleteWorkspace,
    getWorkspaceWorkbenchState: workspaceApiMocks.getWorkspaceWorkbenchState,
    listTerminalPtySessions: workspaceApiMocks.listTerminalPtySessions,
    listWorkspaces: workspaceApiMocks.listWorkspaces,
    openWorkspace: workspaceApiMocks.openWorkspace,
    updateWidgetInstanceLayout: workspaceApiMocks.updateWidgetInstanceLayout,
  };
});

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

describe("App workspace lifecycle", () => {
  it("closes an opened workspace back to the start screen without deleting data", async () => {
    const workspace = workspaceSummary();
    workspaceApiMocks.listWorkspaces.mockResolvedValue([workspace]);
    workspaceApiMocks.openWorkspace.mockResolvedValue(sessionSummary());
    workspaceApiMocks.getWorkspaceWorkbenchState.mockResolvedValue(
      workspaceWorkbenchState(workspace),
    );
    workspaceApiMocks.listTerminalPtySessions.mockResolvedValue([]);

    renderApp();
    await flushEffects();

    expect(document.body.textContent).toContain("Recent Workspaces");
    expect(document.body.textContent).toContain("Lifecycle Workspace");
    expect(document.body.textContent).toContain("Theme");
    expect(document.body.textContent).toContain("New Workspace");
    expect(document.body.textContent).toContain("Start with Workspace Agent");
    expect(document.body.textContent).toContain("Start empty");
    expect(presetStatusTexts()).toEqual(["Selected", "Manual"]);
    expect(radioWithValue("coordinator-notes").checked).toBe(true);
    expect(radioWithValue("empty").checked).toBe(false);
    expect(document.body.textContent).toContain("Widgets: 5");
    expect(document.body.textContent).toContain("Agents: 1");
    expect(document.body.textContent).toContain("Notes: 2");
    expect(document.body.textContent).toContain("Docs: 1");
    expect(document.body.textContent).toContain("Queue: 3");
    expect(sectionByLabel("recent-workspaces-title").compareDocumentPosition(
      sectionByLabel("new-workspace-title"),
    )).toBe(Node.DOCUMENT_POSITION_FOLLOWING);

    await act(async () => {
      buttonWithText("Open").dispatchEvent(
        new MouseEvent("click", { bubbles: true }),
      );
      await Promise.resolve();
    });
    await flushEffects();

    expect(workspaceApiMocks.openWorkspace).toHaveBeenCalledWith(workspace.id);
    expect(document.body.textContent).toContain("Close workspace");
    expect(document.body.textContent).toContain("Lifecycle Workspace");

    act(() => {
      buttonWithText("Close workspace").dispatchEvent(
        new MouseEvent("click", { bubbles: true }),
      );
    });
    await flushEffects();

    expect(document.body.textContent).toContain("New Workspace");
    expect(document.body.textContent).toContain("Lifecycle Workspace");
    expect(workspaceApiMocks.deleteWorkspace).not.toHaveBeenCalled();
  });

  it("creates the default Workspace Agent plus Notes workspace", async () => {
    const workspace = workspaceSummary({
      id: "workspace_create",
      title: "Untitled",
      workbenchId: "workbench_create",
    });
    workspaceApiMocks.listWorkspaces.mockResolvedValue([]);
    workspaceApiMocks.createWorkspace.mockResolvedValue(workspace);
    workspaceApiMocks.openWorkspace.mockResolvedValue(
      sessionSummary({ workspaceId: workspace.id }),
    );
    workspaceApiMocks.getWorkspaceWorkbenchState.mockResolvedValue(
      workspaceWorkbenchState(workspace, []),
    );
    workspaceApiMocks.addWidgetInstanceToWorkbench
      .mockResolvedValueOnce(workspaceWorkbenchState(workspace, ["interactive-agent"]))
      .mockResolvedValueOnce(
        workspaceWorkbenchState(workspace, ["interactive-agent", "notes"]),
      );
    workspaceApiMocks.updateWidgetInstanceLayout
      .mockResolvedValueOnce(workspaceWorkbenchState(workspace, ["interactive-agent"]))
      .mockResolvedValueOnce(
        workspaceWorkbenchState(workspace, ["interactive-agent", "notes"]),
      );

    renderApp();
    await flushEffects();

    expect(document.body.textContent).toContain("No recent workspaces yet.");
    expect(presetStatusTexts()).toEqual(["Selected", "Manual"]);
    expect(radioWithValue("coordinator-notes").checked).toBe(true);
    expect(radioWithValue("empty").checked).toBe(false);
    expect(sectionByLabel("new-workspace-title").compareDocumentPosition(
      sectionByLabel("recent-workspaces-title"),
    )).toBe(Node.DOCUMENT_POSITION_FOLLOWING);

    await act(async () => {
      buttonWithText("Create Workspace").dispatchEvent(
        new MouseEvent("click", { bubbles: true }),
      );
      await Promise.resolve();
    });
    await flushEffects();

    expect(
      workspaceApiMocks.addWidgetInstanceToWorkbench.mock.calls.map(
        ([request]) => request.definitionId,
      ),
    ).toEqual(["interactive-agent", "notes"]);
  });

  it("keeps start empty available without changing the default start mode", async () => {
    const workspace = workspaceSummary({
      id: "workspace_empty",
      title: "Untitled",
      workbenchId: "workbench_empty",
    });
    workspaceApiMocks.listWorkspaces.mockResolvedValue([]);
    workspaceApiMocks.createWorkspace.mockResolvedValue(workspace);
    workspaceApiMocks.openWorkspace.mockResolvedValue(
      sessionSummary({ workspaceId: workspace.id }),
    );
    workspaceApiMocks.getWorkspaceWorkbenchState.mockResolvedValue(
      workspaceWorkbenchState(workspace, []),
    );

    renderApp();
    await flushEffects();

    expect(radioWithValue("coordinator-notes").checked).toBe(true);
    expect(radioWithValue("empty").checked).toBe(false);
    expect(presetStatusTexts()).toEqual(["Selected", "Manual"]);

    await act(async () => {
      radioWithValue("empty").dispatchEvent(
        new MouseEvent("click", { bubbles: true }),
      );
      await Promise.resolve();
    });

    expect(radioWithValue("coordinator-notes").checked).toBe(false);
    expect(radioWithValue("empty").checked).toBe(true);
    expect(presetStatusTexts()).toEqual(["Default", "Selected"]);

    await act(async () => {
      buttonWithText("Create Workspace").dispatchEvent(
        new MouseEvent("click", { bubbles: true }),
      );
      await Promise.resolve();
    });
    await flushEffects();

    expect(workspaceApiMocks.createWorkspace).toHaveBeenCalledWith({
      title: "Untitled",
      description: null,
    });
    expect(workspaceApiMocks.addWidgetInstanceToWorkbench).not.toHaveBeenCalled();
  });
});

function renderApp() {
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);

  act(() => {
    root?.render(<App />);
  });
}

function workspaceSummary(
  overrides: Partial<WorkspaceSummary> = {},
): WorkspaceSummary {
  return {
    createdAt: "2026-05-25T10:00:00.000Z",
    description: null,
    id: "workspace_1",
    knowledgeDocumentCount: 1,
    lastOpenedAt: "2026-05-25T11:00:00.000Z",
    noteCount: 2,
    queueTaskCount: 3,
    skillCount: 4,
    status: "active",
    title: "Lifecycle Workspace",
    updatedAt: "2026-05-25T11:00:00.000Z",
    widgetCount: 5,
    workbenchId: "workbench_1",
    workspaceAgentCount: 1,
    ...overrides,
  };
}

function sessionSummary(
  overrides: Partial<WorkspaceSessionSummary> = {},
): WorkspaceSessionSummary {
  return {
    activeWidgetId: null,
    id: "session_1",
    status: "open",
    workspaceId: "workspace_1",
    ...overrides,
  };
}

function workspaceWorkbenchState(
  workspace: WorkspaceSummary,
  widgetDefinitionIds: string[] = [],
): WorkspaceWorkbenchState {
  return {
    recentEvents: [],
    sharedStateObjects: [],
    widgetInstances: widgetDefinitionIds.map((definitionId, index) => ({
      alwaysOnTop: false,
      category: definitionId === "notes" ? "notes" : "core",
      config: "{}",
      definitionId,
      dockHeight: 560,
      dockWidth: definitionId === "notes" ? 360 : 840,
      dockX: definitionId === "notes" ? 864 : 0,
      dockY: 0,
      id: `widget_${index + 1}`,
      isVisible: true,
      layoutMode: "docked",
      popoutHeight: null,
      popoutWidth: null,
      popoutX: null,
      popoutY: null,
      state: "{}",
      title: definitionId === "notes" ? "Notes" : "Workspace Agent",
    })),
    workbench: {
      id: workspace.workbenchId ?? "workbench_1",
      presetOriginId: null,
      workspaceId: workspace.id,
    },
    workspace,
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

function sectionByLabel(labelId: string) {
  const section = document.querySelector(`[aria-labelledby="${labelId}"]`);

  if (!section) {
    throw new Error(`Section not found: ${labelId}`);
  }

  return section;
}

function presetStatusTexts() {
  return Array.from(document.querySelectorAll(".preset-choice-status")).map(
    (badge) => badge.textContent,
  );
}

function radioWithValue(value: string) {
  const radio = document.querySelector<HTMLInputElement>(
    `input[name="workspace-preset"][value="${value}"]`,
  );

  if (!radio) {
    throw new Error(`Workspace preset radio not found: ${value}`);
  }

  return radio;
}

async function flushEffects() {
  await act(async () => {
    await Promise.resolve();
  });
  await act(async () => {
    await Promise.resolve();
  });
}
