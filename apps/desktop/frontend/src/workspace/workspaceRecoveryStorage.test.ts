import { afterEach, describe, expect, it } from "vitest";
import {
  clearLastOpenWorkspaceRecord,
  LAST_OPEN_WORKSPACE_STORAGE_KEY,
  readLastOpenWorkspaceRecord,
  saveLastOpenWorkspaceRecord,
} from "./workspaceRecoveryStorage";
import type { WorkspaceSummary } from "./types";

afterEach(() => {
  window.localStorage.clear();
});

describe("workspaceRecoveryStorage", () => {
  it("persists only safe last-open workspace metadata", () => {
    saveLastOpenWorkspaceRecord(workspaceSummary());

    expect(readLastOpenWorkspaceRecord()).toMatchObject({
      workspaceId: "workspace_1",
      workspaceTitle: "Recovery Workspace",
      workbenchId: "workbench_1",
    });
    expect(
      window.localStorage.getItem(LAST_OPEN_WORKSPACE_STORAGE_KEY),
    ).not.toContain("Hobit_queue_logic");
  });

  it("clears the last-open workspace record", () => {
    saveLastOpenWorkspaceRecord(workspaceSummary());

    clearLastOpenWorkspaceRecord();

    expect(readLastOpenWorkspaceRecord()).toBeNull();
  });

  it("drops malformed recovery records", () => {
    window.localStorage.setItem(
      LAST_OPEN_WORKSPACE_STORAGE_KEY,
      JSON.stringify({ workspaceTitle: "Missing id" }),
    );

    expect(readLastOpenWorkspaceRecord()).toBeNull();
    expect(
      window.localStorage.getItem(LAST_OPEN_WORKSPACE_STORAGE_KEY),
    ).toBeNull();
  });
});

function workspaceSummary(): WorkspaceSummary {
  return {
    createdAt: "2026-05-25T10:00:00.000Z",
    description: null,
    id: "workspace_1",
    knowledgeDocumentCount: 0,
    lastOpenedAt: "2026-05-25T11:00:00.000Z",
    noteCount: 0,
    queueTaskCount: 0,
    rootPath: "C:/Users/Dmitry/Documents/prj/Hobit_queue_logic",
    skillCount: 0,
    status: "active",
    title: "Recovery Workspace",
    updatedAt: "2026-05-25T11:00:00.000Z",
    widgetCount: 0,
    workbenchId: "workbench_1",
    workspaceAgentCount: 0,
  };
}
