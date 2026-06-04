import { describe, expect, it } from "vitest";

import { memoryWorkspaceApi } from "./memoryWorkspaceApi";

describe("memory workspace api fallback", () => {
  it("returns null for the desktop directory picker fallback", async () => {
    await expect(memoryWorkspaceApi.selectWorkspaceDirectory()).resolves.toBeNull();
  });

  it("keeps workspace lifecycle metadata in memory without default widget insertion", async () => {
    const workspace = await memoryWorkspaceApi.createWorkspace({
      title: " API drift memory ",
      description: null,
    });

    expect(workspace).toMatchObject({
      lastOpenedAt: null,
      title: "API drift memory",
      widgetCount: 0,
      workspaceAgentCount: 0,
      noteCount: 0,
      skillCount: 0,
      knowledgeDocumentCount: 0,
      queueTaskCount: 0,
    });

    const session = await memoryWorkspaceApi.openWorkspace(workspace.id);
    const listed = await memoryWorkspaceApi.listWorkspaces();

    expect(session).toMatchObject({
      activeWidgetId: null,
      status: "open",
      workspaceId: workspace.id,
    });
    expect(listed.some((candidate) => candidate.id === workspace.id)).toBe(true);
    expect(
      await memoryWorkspaceApi.getWorkspaceWorkbenchState(workspace.id),
    ).toMatchObject({
      widgetInstances: [],
    });
  });

  it("preserves Knowledge Document workspace/global scope and enabled search behavior", async () => {
    const first = await memoryWorkspaceApi.createWorkspace({
      title: "Knowledge memory first",
    });
    const second = await memoryWorkspaceApi.createWorkspace({
      title: "Knowledge memory second",
    });
    const uniqueNeedle = `driftneedle_${Date.now()}_${Math.random()}`;

    const workspaceDocument = await memoryWorkspaceApi.createKnowledgeDocument({
      workspaceId: first.id,
      scope: "workspace",
      title: "Workspace doc",
      sourceLabel: "Workspace paste",
      content: `${uniqueNeedle} workspace-only`,
      tags: "workspace",
      enabled: true,
    });
    const globalDocument = await memoryWorkspaceApi.createKnowledgeDocument({
      workspaceId: first.id,
      scope: "global",
      title: "Global doc",
      sourceLabel: "Global paste",
      content: `${uniqueNeedle} global`,
      tags: "global",
      enabled: true,
    });
    await memoryWorkspaceApi.createKnowledgeDocument({
      workspaceId: second.id,
      scope: "workspace",
      title: "Disabled doc",
      sourceLabel: "Disabled paste",
      content: `${uniqueNeedle} disabled`,
      tags: "disabled",
      enabled: false,
    });
    await memoryWorkspaceApi.createKnowledgeDocument({
      workspaceId: second.id,
      scope: "workspace",
      title: "Stale doc",
      sourceLabel: "Stale paste",
      content: `${uniqueNeedle} stale`,
      tags: "stale",
      enabled: true,
      lifecycleStatus: "stale",
    });

    const firstManualResults = await memoryWorkspaceApi.searchKnowledgeDocuments({
      workspaceId: first.id,
      query: "workspace-only",
      limit: 5,
    });
    const secondResults = await memoryWorkspaceApi.searchKnowledgeDocuments({
      workspaceId: second.id,
      query: uniqueNeedle,
      limit: 10,
    });

    expect(workspaceDocument.scope).toBe("workspace");
    expect(globalDocument).toMatchObject({ scope: "global", workspaceId: "" });
    expect(
      firstManualResults.map((result) => result.documentTitle),
    ).toEqual(["Workspace doc"]);
    expect(firstManualResults[0]?.snippet).toContain("workspace-only");
    expect(
      secondResults.map((result) => ({
        documentTitle: result.documentTitle,
        scope: result.scope,
        sourceLabel: result.sourceLabel,
        snippet: result.snippet,
      })),
    ).toEqual([
      expect.objectContaining({
        documentTitle: "Global doc",
        scope: "global",
        sourceLabel: "Global paste",
        snippet: expect.stringContaining(uniqueNeedle),
      }),
    ]);
  });

  it("uses explicit unsupported behavior for desktop-only browser fallbacks", async () => {
    await expect(
      memoryWorkspaceApi.getGitRepositoryStatus({
        workspaceId: "ws_1",
        workbenchId: "wb_1",
        widgetInstanceId: "git_1",
        repositoryRoot: "C:/repo",
      }),
    ).rejects.toThrow("Git status is only available");
    await expect(
      memoryWorkspaceApi.getWorkspaceGitStatus({
        repoRoot: "C:/repo",
      }),
    ).rejects.toThrow("Workspace Git status is only available");
    await expect(
      memoryWorkspaceApi.createTerminalPtySession({
        workspaceId: "ws_1",
        workbenchId: "wb_1",
        widgetInstanceId: "term_1",
        shell: "",
        shellArgs: [],
        workingDirectory: "~",
      }),
    ).rejects.toThrow("Terminal PTY sessions are only available");
    await expect(
      memoryWorkspaceApi.getAgentQueueTaskLatestRunLink({
        workspaceId: "ws_1",
        queueItemId: "queue_1",
      }),
    ).resolves.toBeNull();
    await expect(
      memoryWorkspaceApi.listAgentQueueTaskRunLinks({
        workspaceId: "ws_1",
        queueItemId: "queue_1",
      }),
    ).resolves.toEqual([]);
  });
});
