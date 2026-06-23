import { afterEach, describe, expect, it, vi } from "vitest";
import { createWorkbenchViewStateFromWorkspaceState } from "../workbench/viewState";
import {
  createWorkspaceRecoveryPassState,
  recoverLastOpenWorkspace,
  runWorkspaceRecoveryPass,
  type WorkspaceRecoveryResult,
  type WorkspaceRecoveryStateSink,
} from "./workspaceRecovery";
import { LAST_OPEN_WORKSPACE_STORAGE_KEY } from "./workspaceRecoveryStorage";
import type {
  WorkspaceSessionSummary,
  WorkspaceSummary,
  WorkspaceWorkbenchState,
} from "./types";

const workspaceApiMocks = vi.hoisted(() => ({
  getWorkspaceWorkbenchState: vi.fn(),
  openWorkspace: vi.fn(),
}));

vi.mock("./workspaceApi", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("./workspaceApi")>();

  return {
    ...actual,
    getWorkspaceWorkbenchState: workspaceApiMocks.getWorkspaceWorkbenchState,
    openWorkspace: workspaceApiMocks.openWorkspace,
  };
});

afterEach(() => {
  window.localStorage.clear();
  vi.clearAllMocks();
});

describe("recoverLastOpenWorkspace", () => {
  it("opens and restores the persisted last workspace", async () => {
    const workspace = workspaceSummary({
      rootPath: "C:/Users/Dmitry/Documents/prj/Hobit_queue_logic",
    });
    writeRecoveryRecord(workspace);
    workspaceApiMocks.openWorkspace.mockResolvedValue(sessionSummary());
    workspaceApiMocks.getWorkspaceWorkbenchState.mockResolvedValue(
      workspaceWorkbenchState(workspace),
    );

    const recovery = await recoverLastOpenWorkspace();

    expect(recovery.kind).toBe("restored");
    expect(workspaceApiMocks.openWorkspace).toHaveBeenCalledWith(workspace.id);
    expect(workspaceApiMocks.getWorkspaceWorkbenchState).toHaveBeenCalledWith(
      workspace.id,
    );

    if (recovery.kind === "restored") {
      expect(recovery.viewState.workspace.id).toBe(workspace.id);
      expect(recovery.viewState.workspace.rootPath).toBe(
        "C:/Users/Dmitry/Documents/prj/Hobit_queue_logic",
      );
      expect(recovery.viewState.workspace.title).toBe(workspace.title);
      expect(recovery.viewState.widgets.map((widget) => widget.definitionId))
        .toEqual(["interactive-agent", "notes"]);
    }
  });

  it("returns a failure notice and clears stale recovery when restore fails", async () => {
    const workspace = workspaceSummary({
      id: "workspace_missing",
      title: "Missing Workspace",
      workbenchId: "workbench_missing",
    });
    writeRecoveryRecord(workspace);
    workspaceApiMocks.openWorkspace.mockResolvedValue(null);

    const recovery = await recoverLastOpenWorkspace();

    expect(recovery.kind).toBe("failed");
    expect(
      window.localStorage.getItem(LAST_OPEN_WORKSPACE_STORAGE_KEY),
    ).toBeNull();

    if (recovery.kind === "failed") {
      expect(recovery.notice.title).toBe("Workspace recovery failed");
      expect(recovery.notice.message).toContain("Missing Workspace");
      expect(recovery.notice.message).toContain(
        "Choose a recent workspace below to continue.",
      );
    }
  });

  it("fails recovery instead of using mismatched workspace state", async () => {
    const workspace = workspaceSummary();
    const otherWorkspace = workspaceSummary({
      id: "workspace_other",
      title: "Other Workspace",
      workbenchId: "workbench_other",
    });
    writeRecoveryRecord(workspace);
    workspaceApiMocks.openWorkspace.mockResolvedValue(sessionSummary());
    workspaceApiMocks.getWorkspaceWorkbenchState.mockResolvedValue(
      workspaceWorkbenchState(otherWorkspace),
    );

    const recovery = await recoverLastOpenWorkspace();

    expect(recovery.kind).toBe("failed");
    expect(
      window.localStorage.getItem(LAST_OPEN_WORKSPACE_STORAGE_KEY),
    ).toBeNull();

    if (recovery.kind === "failed") {
      expect(recovery.notice.message).toContain("Recovery Workspace");
      expect(recovery.notice.message).toContain(
        "Recovered Workspace did not match the saved Workspace id.",
      );
    }
  });

  it("does nothing when no last workspace is persisted", async () => {
    const recovery = await recoverLastOpenWorkspace();

    expect(recovery.kind).toBe("none");
    expect(workspaceApiMocks.openWorkspace).not.toHaveBeenCalled();
  });
});

describe("runWorkspaceRecoveryPass", () => {
  it("reuses in-flight recovery so StrictMode cleanup cannot strand restoring state", async () => {
    const workspace = workspaceSummary();
    const viewState = createWorkbenchViewStateFromWorkspaceState(
      workspaceWorkbenchState(workspace),
    );
    const restored: WorkspaceRecoveryResult = {
      kind: "restored",
      viewState,
      workspace,
    };
    const state = createWorkspaceRecoveryPassState();
    const sink = recoveryStateSink();
    let resolveRecovery: (recovery: WorkspaceRecoveryResult) => void;
    const recoveryPromise = new Promise<WorkspaceRecoveryResult>((resolve) => {
      resolveRecovery = resolve;
    });
    const recover = vi.fn(() => recoveryPromise);

    const stopFirstPass = runWorkspaceRecoveryPass(state, sink, recover);
    stopFirstPass();
    const stopSecondPass = runWorkspaceRecoveryPass(state, sink, recover);

    resolveRecovery!(restored);
    await recoveryPromise;
    await flushMicrotasks();

    expect(recover).toHaveBeenCalledTimes(1);
    expect(sink.setWorkbenchViewState).toHaveBeenCalledTimes(1);
    expect(sink.setWorkbenchViewState).toHaveBeenCalledWith(viewState);
    expect(sink.setRecoveryNotice).toHaveBeenCalledWith(null);
    expect(sink.setIsRecoveringWorkspace).toHaveBeenCalledWith(false);

    stopSecondPass();
  });

  it("escapes restoring state when recovery returns a failure", async () => {
    const failed: WorkspaceRecoveryResult = {
      kind: "failed",
      notice: {
        title: "Workspace recovery failed",
        message: "Choose a recent workspace below to continue.",
      },
    };
    const state = createWorkspaceRecoveryPassState();
    const sink = recoveryStateSink();

    runWorkspaceRecoveryPass(state, sink, () => Promise.resolve(failed));
    await flushMicrotasks();

    expect(sink.setWorkbenchViewState).not.toHaveBeenCalled();
    expect(sink.setRecoveryNotice).toHaveBeenCalledWith(failed.notice);
    expect(sink.setIsRecoveringWorkspace).toHaveBeenCalledWith(false);
  });
});

function writeRecoveryRecord(workspace: WorkspaceSummary) {
  window.localStorage.setItem(
    LAST_OPEN_WORKSPACE_STORAGE_KEY,
    JSON.stringify({
      workspaceId: workspace.id,
      workspaceTitle: workspace.title,
      workbenchId: workspace.workbenchId,
      savedAt: "2026-05-25T11:05:00.000Z",
    }),
  );
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
    title: "Recovery Workspace",
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
): WorkspaceWorkbenchState {
  return {
    recentEvents: [],
    sharedStateObjects: [],
    widgetInstances: ["interactive-agent", "notes"].map(
      (definitionId, index) => ({
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
      }),
    ),
    workbench: {
      id: workspace.workbenchId ?? "workbench_1",
      presetOriginId: null,
      workspaceId: workspace.id,
    },
    workspace,
  };
}

function recoveryStateSink(): WorkspaceRecoveryStateSink {
  return {
    setIsRecoveringWorkspace: vi.fn(),
    setRecoveryNotice: vi.fn(),
    setWorkbenchViewState: vi.fn(),
  };
}

async function flushMicrotasks() {
  await Promise.resolve();
  await Promise.resolve();
}
