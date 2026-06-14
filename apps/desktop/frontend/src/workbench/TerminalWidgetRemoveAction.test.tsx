import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { TerminalPtySession, WorkspaceWorkbenchState } from "../workspace/types";
import type { WorkbenchViewState } from "./types";
import { WidgetRemoveAction } from "./WidgetRemoveAction";
import {
  getWidgetRemovalConfirmation,
  removeWidgetInstanceFromWorkbenchView,
} from "./widgetDeletionAction";

const workspaceApiMocks = vi.hoisted(() => ({
  deleteWidgetInstanceFromWorkbench: vi.fn(),
  killTerminalPtySession: vi.fn(),
  listTerminalPtySessions: vi.fn(),
}));

vi.mock("../workspace/workspaceApi", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("../workspace/workspaceApi")>();

  return {
    ...actual,
    deleteWidgetInstanceFromWorkbench:
      workspaceApiMocks.deleteWidgetInstanceFromWorkbench,
    killTerminalPtySession: workspaceApiMocks.killTerminalPtySession,
    listTerminalPtySessions: workspaceApiMocks.listTerminalPtySessions,
  };
});

let root: Root | null = null;
let container: HTMLDivElement | null = null;

beforeEach(() => {
  workspaceApiMocks.deleteWidgetInstanceFromWorkbench.mockResolvedValue(
    workspaceWorkbenchState(),
  );
  workspaceApiMocks.killTerminalPtySession.mockResolvedValue(
    terminalSession({ status: "killed" }),
  );
  workspaceApiMocks.listTerminalPtySessions.mockResolvedValue([]);
});

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

describe("Terminal widget removal", () => {
  it("leaves inactive Terminal removal on the normal remove path", async () => {
    workspaceApiMocks.listTerminalPtySessions.mockResolvedValue([
      terminalSession({ sessionId: "pty_exited", status: "exited" }),
      terminalSession({ sessionId: "pty_killed", status: "killed" }),
    ]);

    await removeWidgetInstanceFromWorkbenchView(
      workbenchViewState({ widgets: [terminalWidget()] }),
      "terminal_1",
    );

    expect(workspaceApiMocks.listTerminalPtySessions).toHaveBeenCalledWith({
      workspaceId: "workspace_1",
      workbenchId: "workbench_1",
      widgetInstanceId: "terminal_1",
    });
    expect(workspaceApiMocks.killTerminalPtySession).not.toHaveBeenCalled();
    expect(workspaceApiMocks.deleteWidgetInstanceFromWorkbench).toHaveBeenCalledWith(
      expect.objectContaining({
        widgetInstanceId: "terminal_1",
      }),
    );
  });

  it("reports active Terminal sessions before removal confirmation", async () => {
    workspaceApiMocks.listTerminalPtySessions.mockResolvedValue([
      terminalSession({ sessionId: "pty_running", status: "running" }),
    ]);

    await expect(
      getWidgetRemovalConfirmation(
        workbenchViewState({ widgets: [terminalWidget()] }),
        "terminal_1",
      ),
    ).resolves.toEqual({ kind: "terminal-active-sessions" });
  });

  it("force kills every active session owned by the removed Terminal widget", async () => {
    workspaceApiMocks.listTerminalPtySessions.mockResolvedValue([
      terminalSession({ sessionId: "pty_owned_primary", status: "running" }),
      terminalSession({ sessionId: "pty_owned_split", status: "stopping" }),
      terminalSession({ sessionId: "pty_inactive", status: "exited" }),
      terminalSession({
        sessionId: "pty_other",
        status: "running",
        widgetInstanceId: "terminal_2",
      }),
    ]);

    await removeWidgetInstanceFromWorkbenchView(
      workbenchViewState({
        widgets: [terminalWidget(), terminalWidget({ id: "terminal_2" })],
      }),
      "terminal_1",
      { forceKillTerminalSessions: true },
    );

    expect(workspaceApiMocks.killTerminalPtySession).toHaveBeenCalledTimes(2);
    expect(workspaceApiMocks.killTerminalPtySession).toHaveBeenNthCalledWith(1, {
      workspaceId: "workspace_1",
      workbenchId: "workbench_1",
      widgetInstanceId: "terminal_1",
      sessionId: "pty_owned_primary",
    });
    expect(workspaceApiMocks.killTerminalPtySession).toHaveBeenNthCalledWith(2, {
      workspaceId: "workspace_1",
      workbenchId: "workbench_1",
      widgetInstanceId: "terminal_1",
      sessionId: "pty_owned_split",
    });
    expect(workspaceApiMocks.deleteWidgetInstanceFromWorkbench).toHaveBeenCalledWith(
      expect.objectContaining({
        widgetInstanceId: "terminal_1",
      }),
    );
  });

  it("does not remove the Terminal widget when force kill fails", async () => {
    workspaceApiMocks.listTerminalPtySessions.mockResolvedValue([
      terminalSession({ sessionId: "pty_running", status: "running" }),
    ]);
    workspaceApiMocks.killTerminalPtySession.mockRejectedValue(
      new Error("kill failed"),
    );

    await expect(
      removeWidgetInstanceFromWorkbenchView(
        workbenchViewState({ widgets: [terminalWidget()] }),
        "terminal_1",
        { forceKillTerminalSessions: true },
      ),
    ).rejects.toThrow("Terminal PTY sessions could not be force killed");

    expect(workspaceApiMocks.deleteWidgetInstanceFromWorkbench).not.toHaveBeenCalled();
  });

  it("keeps non-Terminal widget removal unchanged", async () => {
    await removeWidgetInstanceFromWorkbenchView(
      workbenchViewState({ widgets: [notesWidget()] }),
      "notes_1",
    );

    expect(workspaceApiMocks.listTerminalPtySessions).not.toHaveBeenCalled();
    expect(workspaceApiMocks.killTerminalPtySession).not.toHaveBeenCalled();
    expect(workspaceApiMocks.deleteWidgetInstanceFromWorkbench).toHaveBeenCalledWith(
      expect.objectContaining({
        widgetInstanceId: "notes_1",
      }),
    );
  });
});

describe("WidgetRemoveAction Terminal force kill confirmation", () => {
  it("shows Force Kill copy and passes the force-kill option for active Terminal sessions", async () => {
    const onRemove = vi.fn().mockResolvedValue(undefined);

    renderRemoveAction({
      getRemovalConfirmation: async () => ({ kind: "terminal-active-sessions" }),
      onRemove,
    });

    await clickButton("Remove");

    expect(document.body.textContent).toContain(
      "This Terminal has running sessions. Force kill them before removing the widget?",
    );
    expect(buttonWithText("Cancel")).not.toBeNull();

    await clickButton("Force kill sessions and remove");

    expect(onRemove).toHaveBeenCalledWith({
      forceKillTerminalSessions: true,
    });
  });

  it("keeps the confirmation open with product-facing feedback when force kill fails", async () => {
    const onRemove = vi
      .fn()
      .mockRejectedValue(
        new Error("Terminal PTY sessions could not be force killed. kill failed"),
      );

    renderRemoveAction({
      getRemovalConfirmation: async () => ({ kind: "terminal-active-sessions" }),
      onRemove,
    });

    await clickButton("Remove");
    await clickButton("Force kill sessions and remove");

    expect(document.body.textContent).toContain(
      "Terminal sessions could not be force killed. The widget was not removed.",
    );
    expect(buttonWithText("Cancel")).not.toBeNull();
    expect(buttonWithText("Force kill sessions and remove")).not.toBeNull();
    expect(onRemove).toHaveBeenCalledTimes(1);
  });

  it("keeps normal widget confirmation copy for non-running removal", async () => {
    const onRemove = vi.fn().mockResolvedValue(undefined);

    renderRemoveAction({
      getRemovalConfirmation: async () => ({ kind: "normal" }),
      onRemove,
    });

    await clickButton("Remove");

    expect(document.body.textContent).toContain(
      "Remove this widget from the workbench?",
    );
    expect(buttonWithText("Keep")).not.toBeNull();

    await clickButton("Remove widget");

    expect(onRemove).toHaveBeenCalledWith({
      forceKillTerminalSessions: false,
    });
  });
});

function renderRemoveAction({
  getRemovalConfirmation,
  onRemove,
}: {
  getRemovalConfirmation: () => Promise<{ kind: "normal" | "terminal-active-sessions" }>;
  onRemove: (options?: { forceKillTerminalSessions?: boolean }) => Promise<void>;
}) {
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);

  act(() => {
    root?.render(
      <WidgetRemoveAction
        getRemovalConfirmation={getRemovalConfirmation}
        onRemove={onRemove}
        widgetTitle="Terminal"
      />,
    );
  });
}

async function clickButton(text: string) {
  await act(async () => {
    buttonWithText(text).dispatchEvent(new MouseEvent("click", { bubbles: true }));
    await Promise.resolve();
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

function workspaceWorkbenchState(): WorkspaceWorkbenchState {
  return {
    recentEvents: [],
    sharedStateObjects: [],
    widgetInstances: [],
    workbench: {
      id: "workbench_1",
      presetOriginId: null,
      workspaceId: "workspace_1",
    },
    workspace: {
      createdAt: "1",
      description: null,
      id: "workspace_1",
      knowledgeDocumentCount: 0,
      lastOpenedAt: null,
      noteCount: 0,
      queueTaskCount: 0,
      skillCount: 0,
      status: "open",
      title: "Workspace",
      updatedAt: "1",
      widgetCount: 0,
      workbenchId: "workbench_1",
      workspaceAgentCount: 0,
    },
  };
}

function workbenchViewState(
  overrides: Partial<WorkbenchViewState> = {},
): WorkbenchViewState {
  return {
    recentEvents: [],
    sharedStateObjects: [],
    widgets: [],
    workbench: {
      id: "workbench_1",
      preset: {
        description: null,
        id: "preset_1",
        title: "Workbench",
      },
    },
    workspace: {
      description: null,
      id: "workspace_1",
      status: "open",
      title: "Workspace",
    },
    ...overrides,
  };
}

function terminalWidget(
  overrides: Partial<WorkbenchViewState["widgets"][number]> = {},
): WorkbenchViewState["widgets"][number] {
  return {
    config: {},
    definitionId: "terminal",
    id: "terminal_1",
    layout: {
      area: "main",
      height: 320,
      mode: "docked",
      order: 0,
      width: 480,
      x: 0,
      y: 0,
    },
    state: {},
    title: "Terminal",
    visible: true,
    ...overrides,
  };
}

function notesWidget(): WorkbenchViewState["widgets"][number] {
  return {
    config: {},
    definitionId: "notes",
    id: "notes_1",
    layout: {
      area: "main",
      height: 240,
      mode: "docked",
      order: 0,
      width: 360,
      x: 0,
      y: 0,
    },
    state: {},
    title: "Notes",
    visible: true,
  };
}

function terminalSession(
  overrides: Partial<TerminalPtySession> = {},
): TerminalPtySession {
  return {
    cols: 80,
    endedAt: null,
    errorMessage: null,
    exitCode: null,
    output: {
      capBytes: 65536,
      chunks: [],
      droppedBytes: 0,
      totalBufferedBytes: 0,
    },
    rows: 24,
    sessionId: "pty_1",
    shell: "powershell.exe",
    shellArgs: [],
    startedAt: "1",
    status: "running",
    widgetInstanceId: "terminal_1",
    workbenchId: "workbench_1",
    workingDirectory: "C:/repo",
    workspaceId: "workspace_1",
    ...overrides,
  };
}
