import { describe, expect, it } from "vitest";

import type { WorkspaceWorkbenchState } from "../workspace/types";
import { createWorkbenchViewStateFromWorkspaceState } from "./viewState";

describe("createWorkbenchViewStateFromWorkspaceState Queue singleton repair", () => {
  it("quarantines duplicate Queue views before the Workbench renders", () => {
    const state = workspaceWorkbenchState({
      queueTaskCount: 3,
      widgetInstances: [
        workspaceWidget({
          definitionId: "agent-queue",
          dockY: 30,
          id: "queue_later",
          isVisible: true,
        }),
        workspaceWidget({
          definitionId: "notes",
          id: "notes_1",
          isVisible: true,
        }),
        workspaceWidget({
          definitionId: "agent-queue",
          dockY: 10,
          id: "queue_canonical",
          isVisible: true,
        }),
      ],
    });

    const viewState = createWorkbenchViewStateFromWorkspaceState(state);
    const visibleQueueWidgets = viewState.widgets.filter(
      (widget) => widget.definitionId === "agent-queue" && widget.visible,
    );

    expect(visibleQueueWidgets).toEqual([
      expect.objectContaining({ id: "queue_canonical" }),
    ]);
    expect(viewState.widgets).toEqual([
      expect.objectContaining({
        definitionId: "agent-queue",
        id: "queue_later",
        visible: false,
      }),
      expect.objectContaining({
        definitionId: "notes",
        id: "notes_1",
        visible: true,
      }),
      expect.objectContaining({
        definitionId: "agent-queue",
        id: "queue_canonical",
        visible: true,
      }),
    ]);
    expect(viewState.recentEvents).toEqual([
      expect.objectContaining({
        kind: "queue_view_repair",
        summary:
          "Duplicate Agent Queue views were quarantined. Queue tasks were preserved.",
      }),
    ]);
    expect(viewState.workspace).toMatchObject({
      id: "workspace_1",
      title: "Workspace",
    });
  });

  it("restores one canonical Queue view when duplicate persisted Queue views are hidden", () => {
    const viewState = createWorkbenchViewStateFromWorkspaceState(
      workspaceWorkbenchState({
        widgetInstances: [
          workspaceWidget({
            definitionId: "agent-queue",
            dockY: 20,
            id: "queue_b",
            isVisible: false,
          }),
          workspaceWidget({
            definitionId: "agent-queue",
            dockY: 10,
            id: "queue_a",
            isVisible: false,
          }),
        ],
      }),
    );

    expect(
      viewState.widgets.filter(
        (widget) => widget.definitionId === "agent-queue" && widget.visible,
      ),
    ).toEqual([expect.objectContaining({ id: "queue_a" })]);
  });

  it("does not mutate Queue task/domain data during view repair", () => {
    const state = workspaceWorkbenchState({
      queueTaskCount: 7,
      widgetInstances: [
        workspaceWidget({ definitionId: "agent-queue", id: "queue_1" }),
        workspaceWidget({ definitionId: "agent-queue", id: "queue_2" }),
      ],
    });
    const before = structuredClone(state);

    const viewState = createWorkbenchViewStateFromWorkspaceState(state);

    expect(state).toEqual(before);
    expect(viewState.workspace.id).toBe("workspace_1");
    expect(state.workspace.queueTaskCount).toBe(7);
  });

  it("leaves non-Queue duplicate widgets visible and unaffected", () => {
    const viewState = createWorkbenchViewStateFromWorkspaceState(
      workspaceWorkbenchState({
        widgetInstances: [
          workspaceWidget({ definitionId: "notes", id: "notes_1" }),
          workspaceWidget({ definitionId: "notes", id: "notes_2" }),
          workspaceWidget({ definitionId: "agent-queue", id: "queue_1" }),
        ],
      }),
    );

    expect(
      viewState.widgets.filter(
        (widget) => widget.definitionId === "notes" && widget.visible,
      ),
    ).toHaveLength(2);
    expect(
      viewState.recentEvents.some((event) => event.kind === "queue_view_repair"),
    ).toBe(false);
  });

  it("does not treat legacy or malformed Queue-looking ids as Queue views", () => {
    const viewState = createWorkbenchViewStateFromWorkspaceState(
      workspaceWorkbenchState({
        widgetInstances: [
          workspaceWidget({ definitionId: "agent-queue", id: "queue_1" }),
          workspaceWidget({ definitionId: "queue-v2", id: "queue_v2_1" }),
          workspaceWidget({ definitionId: "agent-run", id: "agent_run_1" }),
        ],
      }),
    );

    expect(
      viewState.widgets.filter(
        (widget) => widget.definitionId === "agent-queue" && widget.visible,
      ),
    ).toHaveLength(1);
    expect(
      viewState.widgets.find((widget) => widget.id === "queue_v2_1")?.visible,
    ).toBe(true);
    expect(
      viewState.widgets.find((widget) => widget.id === "agent_run_1")?.visible,
    ).toBe(true);
    expect(
      viewState.recentEvents.some((event) => event.kind === "queue_view_repair"),
    ).toBe(false);
  });
});

function workspaceWorkbenchState({
  queueTaskCount = 0,
  widgetInstances,
}: {
  queueTaskCount?: number;
  widgetInstances: WorkspaceWorkbenchState["widgetInstances"];
}): WorkspaceWorkbenchState {
  return {
    recentEvents: [],
    sharedStateObjects: [],
    widgetInstances,
    workbench: {
      id: "workbench_1",
      presetOriginId: null,
      workspaceId: "workspace_1",
    },
    workspace: {
      createdAt: "2026-06-14T00:00:00.000Z",
      description: null,
      id: "workspace_1",
      knowledgeDocumentCount: 0,
      lastOpenedAt: null,
      noteCount: 0,
      queueTaskCount,
      skillCount: 0,
      status: "open",
      title: "Workspace",
      updatedAt: "2026-06-14T00:00:00.000Z",
      widgetCount: widgetInstances.length,
      workbenchId: "workbench_1",
      workspaceAgentCount: 0,
    },
  };
}

function workspaceWidget({
  definitionId,
  dockY = 0,
  id,
  isVisible = true,
}: {
  definitionId: string;
  dockY?: number;
  id: string;
  isVisible?: boolean;
}): WorkspaceWorkbenchState["widgetInstances"][number] {
  return {
    alwaysOnTop: false,
    category: "core",
    config: "{}",
    definitionId,
    dockHeight: 240,
    dockWidth: 360,
    dockX: 0,
    dockY,
    id,
    isVisible,
    layoutMode: "docked",
    popoutHeight: null,
    popoutWidth: null,
    popoutX: null,
    popoutY: null,
    state: "{}",
    title: definitionId,
  };
}
