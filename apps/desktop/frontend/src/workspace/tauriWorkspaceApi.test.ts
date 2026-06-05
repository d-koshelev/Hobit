import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  homeDir: vi.fn(),
  invoke: vi.fn(),
  listen: vi.fn(),
  open: vi.fn(),
}));

vi.mock("@tauri-apps/api/core", () => ({
  invoke: mocks.invoke,
}));

vi.mock("@tauri-apps/api/event", () => ({
  listen: mocks.listen,
}));

vi.mock("@tauri-apps/api/path", () => ({
  homeDir: mocks.homeDir,
}));

vi.mock("@tauri-apps/plugin-dialog", () => ({
  open: mocks.open,
}));

import {
  createAgentQueueTask,
  startAssignedAgentQueueTask,
} from "./tauriAgentQueueApi";
import { listAgentExecutorRuns } from "./tauriAgentExecutorHistoryApi";
import { createGitCommit } from "./tauriGitCommitApi";
import { getGitFileDiff, getGitLog } from "./tauriGitReviewApi";
import { getGitRepositoryStatus } from "./tauriGitStatusApi";
import {
  createWorkspaceGitCommit,
  getWorkspaceGitDiffSummary,
  getWorkspaceGitFileDiff,
  getWorkspaceGitLog,
  getWorkspaceGitStatus,
  pushWorkspaceGit,
} from "./tauriWorkspaceGitApi";
import {
  createTerminalPtySession,
  closeTerminalPtySession,
  killTerminalPtySession,
  resizeTerminalPtySession,
  stopTerminalPtySession,
  writeTerminalPtySession,
} from "./tauriTerminalPtyApi";
import { tauriWorkspaceApi } from "./tauriWorkspaceApi";
import {
  createKnowledgeDocument,
  searchKnowledgeDocuments,
  updateKnowledgeDocument,
} from "./tauriWorkspaceKnowledgeDocumentsApi";

describe("tauri workspace api adapter", () => {
  beforeEach(() => {
    mocks.homeDir.mockReset();
    mocks.invoke.mockReset();
    mocks.listen.mockReset();
    mocks.open.mockReset();
  });

  it("uses a single-directory picker and handles cancel, string, arrays, and failures", async () => {
    mocks.open.mockResolvedValueOnce(null);
    await expect(tauriWorkspaceApi.selectWorkspaceDirectory()).resolves.toBeNull();
    expect(mocks.open).toHaveBeenLastCalledWith({
      directory: true,
      multiple: false,
    });

    mocks.open.mockResolvedValueOnce("C:/work");
    await expect(tauriWorkspaceApi.selectWorkspaceDirectory()).resolves.toBe(
      "C:/work",
    );

    mocks.open.mockResolvedValueOnce(["C:/first", "C:/second"]);
    await expect(tauriWorkspaceApi.selectWorkspaceDirectory()).resolves.toBe(
      "C:/first",
    );

    mocks.open.mockRejectedValueOnce(new Error("dialog unavailable"));
    await expect(tauriWorkspaceApi.selectWorkspaceDirectory()).rejects.toThrow(
      "Directory picker failed: dialog unavailable",
    );
  });

  it("normalizes recent workspace metadata and compact stats", async () => {
    mocks.invoke.mockResolvedValueOnce([
      {
        id: "ws_1",
        title: "Incident",
        description: "Review",
        status: "active",
        created_at: "2026-05-27T10:00:00Z",
        updated_at: "2026-05-27T11:00:00Z",
        last_opened_at: "2026-05-27T12:00:00Z",
        widget_count: 7,
        workspace_agent_count: 2,
        note_count: 3,
        skill_count: 4,
        knowledge_document_count: 5,
        queue_task_count: 6,
        workbench_id: "wb_1",
      },
    ]);

    await expect(tauriWorkspaceApi.listWorkspaces()).resolves.toEqual([
      {
        id: "ws_1",
        title: "Incident",
        description: "Review",
        status: "active",
        createdAt: "2026-05-27T10:00:00Z",
        updatedAt: "2026-05-27T11:00:00Z",
        lastOpenedAt: "2026-05-27T12:00:00Z",
        widgetCount: 7,
        workspaceAgentCount: 2,
        noteCount: 3,
        skillCount: 4,
        knowledgeDocumentCount: 5,
        queueTaskCount: 6,
        workbenchId: "wb_1",
      },
    ]);
    expect(mocks.invoke).toHaveBeenCalledWith("list_workspaces");
  });

  it("maps workspace rename payloads and normalized summaries", async () => {
    mocks.invoke.mockResolvedValueOnce({
      id: "ws_1",
      title: "Incident Review",
      description: "Review",
      status: "active",
      created_at: "2026-05-27T10:00:00Z",
      updated_at: "2026-05-27T11:05:00Z",
      last_opened_at: "2026-05-27T12:00:00Z",
      widget_count: 7,
      workspace_agent_count: 2,
      note_count: 3,
      skill_count: 4,
      knowledge_document_count: 5,
      queue_task_count: 6,
      workbench_id: "wb_1",
    });

    await expect(
      tauriWorkspaceApi.updateWorkspace({
        title: "Incident Review",
        workspaceId: "ws_1",
      }),
    ).resolves.toEqual({
      id: "ws_1",
      title: "Incident Review",
      description: "Review",
      status: "active",
      createdAt: "2026-05-27T10:00:00Z",
      updatedAt: "2026-05-27T11:05:00Z",
      lastOpenedAt: "2026-05-27T12:00:00Z",
      widgetCount: 7,
      workspaceAgentCount: 2,
      noteCount: 3,
      skillCount: 4,
      knowledgeDocumentCount: 5,
      queueTaskCount: 6,
      workbenchId: "wb_1",
    });
    expect(mocks.invoke).toHaveBeenCalledWith("update_workspace", {
      request: {
        title: "Incident Review",
        workspace_id: "ws_1",
      },
    });
  });

  it("maps widget layout update payloads without changing layout metadata names", async () => {
    mocks.invoke.mockResolvedValueOnce(null);

    await tauriWorkspaceApi.updateWidgetInstanceLayout({
      workspaceId: "ws_1",
      workbenchId: "wb_1",
      widgetInstanceId: "wid_1",
      layout: {
        layoutMode: "docked",
        dockX: 10,
        dockY: 20,
        dockWidth: 480,
        dockHeight: 320,
        popoutX: null,
        popoutY: null,
        popoutWidth: null,
        popoutHeight: null,
        alwaysOnTop: false,
        isVisible: true,
      },
    });

    expect(mocks.invoke).toHaveBeenCalledWith("update_widget_instance_layout", {
      request: {
        workspace_id: "ws_1",
        workbench_id: "wb_1",
        widget_instance_id: "wid_1",
        layout: {
          layout_mode: "docked",
          dock_x: 10,
          dock_y: 20,
          dock_width: 480,
          dock_height: 320,
          popout_x: null,
          popout_y: null,
          popout_width: null,
          popout_height: null,
          always_on_top: false,
          is_visible: true,
        },
      },
    });
  });

  it("keeps Git review command names and request shapes separate from commit", async () => {
    mocks.invoke
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null);

    await getGitRepositoryStatus(gitScope());
    await getGitFileDiff({ ...gitScope(), path: "src/lib.rs", maxPatchBytes: 42 });
    await getGitLog({ ...gitScope(), limit: 15 });
    await createGitCommit({
      workspaceId: "ws_1",
      workbenchId: "wb_1",
      widgetInstanceId: "git_1",
      repoRoot: "C:/repo",
      commitMessage: "test commit",
      includedFiles: ["src/lib.rs"],
    });

    expect(mocks.invoke).toHaveBeenNthCalledWith(1, "get_git_repository_status", {
      request: {
        workspace_id: "ws_1",
        workbench_id: "wb_1",
        widget_instance_id: "git_1",
        repository_root: "C:/repo",
      },
    });
    expect(mocks.invoke).toHaveBeenNthCalledWith(2, "get_git_file_diff", {
      request: {
        workspace_id: "ws_1",
        workbench_id: "wb_1",
        widget_instance_id: "git_1",
        repository_root: "C:/repo",
        path: "src/lib.rs",
        max_patch_bytes: 42,
      },
    });
    expect(mocks.invoke).toHaveBeenNthCalledWith(3, "get_git_log", {
      request: {
        workspace_id: "ws_1",
        workbench_id: "wb_1",
        widget_instance_id: "git_1",
        repository_root: "C:/repo",
        limit: 15,
      },
    });
    expect(mocks.invoke).toHaveBeenNthCalledWith(4, "create_git_commit", {
      request: {
        workspace_id: "ws_1",
        workbench_id: "wb_1",
        widget_instance_id: "git_1",
        repo_root: "C:/repo",
        commit_message: "test commit",
        included_files: ["src/lib.rs"],
      },
    });
  });

  it("maps widget-independent Workspace Git command names without widget ids", async () => {
    mocks.invoke
      .mockResolvedValueOnce(tauriGitStatus())
      .mockResolvedValueOnce(tauriGitDiffSummary())
      .mockResolvedValueOnce({
        repo_root: "C:/repo",
        path: "src/lib.rs",
        status: "available",
        patch: "diff",
        patch_truncated: false,
        error_message: null,
        command_summary: [{ program: "git", args: ["diff"] }],
      })
      .mockResolvedValueOnce({
        repo_root: "C:/repo",
        entries: [
          {
            hash: "abcdef123",
            short_hash: "abcdef1",
            subject: "commit",
            author: "Hobit",
            date: "2026-06-04",
          },
        ],
        command_summary: [{ program: "git", args: ["log"] }],
      })
      .mockResolvedValueOnce(tauriGitCommit())
      .mockResolvedValueOnce(tauriGitPush());

    await getWorkspaceGitStatus({ repoRoot: "C:/repo" });
    await getWorkspaceGitDiffSummary({
      repoRoot: "C:/repo",
      maxFiles: 25,
      maxPatchBytesPerFile: 4096,
      includePatchPreview: false,
    });
    await getWorkspaceGitFileDiff({
      repoRoot: "C:/repo",
      path: "src/lib.rs",
      maxPatchBytes: 42,
    });
    await getWorkspaceGitLog({
      repoRoot: "C:/repo",
      limit: 15,
    });
    await createWorkspaceGitCommit({
      repoRoot: "C:/repo",
      commitMessage: "test commit",
      includedFiles: ["src/lib.rs"],
    });
    await pushWorkspaceGit({
      expectedAhead: 2,
      expectedBehind: 0,
      expectedBranch: "main",
      expectedUpstream: "origin/main",
      operatorConfirmed: true,
      repoRoot: "C:/repo",
    });

    expect(mocks.invoke).toHaveBeenNthCalledWith(1, "get_workspace_git_status", {
      request: {
        repo_root: "C:/repo",
      },
    });
    expect(mocks.invoke).toHaveBeenNthCalledWith(
      2,
      "get_workspace_git_diff_summary",
      {
        request: {
          repo_root: "C:/repo",
          max_files: 25,
          max_patch_bytes_per_file: 4096,
          include_patch_preview: false,
        },
      },
    );
    expect(mocks.invoke).toHaveBeenNthCalledWith(
      3,
      "get_workspace_git_file_diff",
      {
        request: {
          repo_root: "C:/repo",
          path: "src/lib.rs",
          max_patch_bytes: 42,
        },
      },
    );
    expect(mocks.invoke).toHaveBeenNthCalledWith(
      4,
      "get_workspace_git_log",
      {
        request: {
          repo_root: "C:/repo",
          limit: 15,
        },
      },
    );
    expect(mocks.invoke).toHaveBeenNthCalledWith(
      5,
      "create_workspace_git_commit",
      {
        request: {
          repo_root: "C:/repo",
          commit_message: "test commit",
          included_files: ["src/lib.rs"],
        },
      },
    );
    expect(mocks.invoke).toHaveBeenNthCalledWith(6, "push_workspace_git", {
      request: {
        repo_root: "C:/repo",
        expected_branch: "main",
        expected_upstream: "origin/main",
        expected_ahead: 2,
        expected_behind: 0,
        operator_confirmed: true,
      },
    });
  });

  it("normalizes Git diff, history, status, and local commit DTOs", async () => {
    mocks.invoke
      .mockResolvedValueOnce(tauriGitStatus())
      .mockResolvedValueOnce({
        repo_root: "C:/repo",
        path: "src/lib.rs",
        status: "available",
        patch: "diff",
        patch_truncated: true,
        error_message: null,
        command_summary: [{ program: "git", args: ["diff"] }],
      })
      .mockResolvedValueOnce({
        repo_root: "C:/repo",
        entries: [
          {
            hash: "abcdef123",
            short_hash: "abcdef1",
            subject: "commit",
            author: "Hobit",
            date: "2026-05-27",
          },
        ],
        command_summary: [{ program: "git", args: ["log"] }],
      })
      .mockResolvedValueOnce({
        repo_root: "C:/repo",
        entries: [
          {
            hash: "fedcba987",
            short_hash: "fedcba9",
            subject: "workspace commit",
            author: "Hobit",
            date: "2026-06-04",
          },
        ],
        command_summary: [{ program: "git", args: ["log"] }],
      })
      .mockResolvedValueOnce(tauriGitCommit());

    await expect(getGitRepositoryStatus(gitScope())).resolves.toMatchObject({
      branch: { isDetached: false },
      changedFiles: [{ originalPath: "src/old.ts" }],
      workingTree: { stagedCount: 1, unstagedCount: 2, untrackedCount: 3 },
    });
    await expect(getGitFileDiff({ ...gitScope(), path: "src/lib.rs" })).resolves
      .toMatchObject({
        commandSummary: [{ args: ["diff"], program: "git" }],
        patchTruncated: true,
        repoRoot: "C:/repo",
      });
    await expect(getGitLog({ ...gitScope() })).resolves.toMatchObject({
      entries: [{ shortHash: "abcdef1" }],
    });
    await expect(getWorkspaceGitLog({ repoRoot: "C:/repo" })).resolves.toMatchObject({
      entries: [{ shortHash: "fedcba9" }],
    });
    await expect(
      createGitCommit({
        workspaceId: "ws_1",
        workbenchId: "wb_1",
        widgetInstanceId: "git_1",
        repoRoot: "C:/repo",
        commitMessage: "message",
        includedFiles: ["src/lib.rs"],
      }),
    ).resolves.toMatchObject({
      autoCommit: false,
      cleanPerformed: false,
      forcePushPerformed: false,
      operatorConfirmedRequired: true,
      pushPerformed: false,
      resetPerformed: false,
    });
  });

  it("maps Knowledge Document create, update, and search scope fields", async () => {
    mocks.invoke
      .mockResolvedValueOnce(tauriKnowledgeDocument({ scope: "global" }))
      .mockResolvedValueOnce(tauriKnowledgeDocument({ enabled: false }))
      .mockResolvedValueOnce([
        {
          knowledge_document_id: "kdoc_1",
          document_title: "Doc",
          scope: "global",
          source_label: "Paste",
          tags: "ops",
          chunk_id: "chunk_1",
          chunk_index: 0,
          snippet: "match",
          score: 12,
        },
      ]);

    await expect(
      createKnowledgeDocument({
        workspaceId: "ws_1",
        scope: "global",
        catalogItemType: "known_issue",
        quickSummary: "Quick",
        lifecycleStatus: "draft",
        title: "Doc",
        sourceLabel: "Paste",
        sourceKind: "operator_authored",
        sourceRef: "manual",
        content: "Content",
        tags: "ops",
        enabled: true,
      }),
    ).resolves.toMatchObject({
      catalogItemType: "documentation_knowledge",
      enabled: true,
      lifecycleStatus: "active",
      scope: "global",
    });
    expect(mocks.invoke).toHaveBeenNthCalledWith(1, "create_knowledge_document", {
      request: {
        workspace_id: "ws_1",
        scope: "global",
        catalog_item_type: "known_issue",
        quick_summary: "Quick",
        lifecycle_status: "draft",
        title: "Doc",
        source_label: "Paste",
        source_kind: "operator_authored",
        source_ref: "manual",
        content: "Content",
        tags: "ops",
        enabled: true,
      },
    });

    await expect(
      updateKnowledgeDocument({
        workspaceId: "ws_1",
        knowledgeDocumentId: "kdoc_1",
        scope: "workspace",
        catalogItemType: "validation_rule",
        quickSummary: "Validate",
        lifecycleStatus: "active",
        title: "Doc",
        sourceLabel: "Paste",
        sourceKind: "file",
        sourceRef: "docs/checks.md",
        content: "Content",
        tags: "ops",
        enabled: false,
      }),
    ).resolves.toMatchObject({ enabled: false, scope: "workspace" });
    expect(mocks.invoke).toHaveBeenNthCalledWith(2, "update_knowledge_document", {
      request: expect.objectContaining({
        enabled: false,
        knowledge_document_id: "kdoc_1",
        catalog_item_type: "validation_rule",
        lifecycle_status: "active",
        quick_summary: "Validate",
        scope: "workspace",
        source_label: "Paste",
        source_kind: "file",
        source_ref: "docs/checks.md",
      }),
    });

    await expect(
      searchKnowledgeDocuments({
        workspaceId: "ws_1",
        query: "match",
        limit: 3,
      }),
    ).resolves.toEqual([
      {
        knowledgeDocumentId: "kdoc_1",
        documentTitle: "Doc",
        scope: "global",
        sourceLabel: "Paste",
        tags: "ops",
        chunkId: "chunk_1",
        chunkIndex: 0,
        snippet: "match",
        score: 12,
      },
    ]);
  });

  it("maps Terminal PTY requests, raw writes, resize, and stable action command names", async () => {
    mocks.invoke.mockResolvedValue(tauriTerminalSession());

    await createTerminalPtySession({
      workspaceId: "ws_1",
      workbenchId: "wb_1",
      widgetInstanceId: "term_1",
      shell: "",
      shellArgs: ["-NoLogo"],
      workingDirectory: "~/repo",
      cols: 100,
      rows: 30,
      outputBufferCapBytes: 65536,
    });
    await writeTerminalPtySession({ ...terminalScope(), data: "\u001b[A\r" });
    await resizeTerminalPtySession({ ...terminalScope(), cols: 120, rows: 40 });
    await stopTerminalPtySession(terminalScope());
    await killTerminalPtySession(terminalScope());
    await closeTerminalPtySession(terminalScope());

    expect(mocks.invoke).toHaveBeenNthCalledWith(1, "create_terminal_pty_session", {
      request: {
        workspace_id: "ws_1",
        workbench_id: "wb_1",
        widget_instance_id: "term_1",
        shell: "",
        shell_args: ["-NoLogo"],
        working_directory: "~/repo",
        cols: 100,
        rows: 30,
        output_buffer_cap_bytes: 65536,
      },
    });
    expect(mocks.invoke).toHaveBeenNthCalledWith(2, "write_terminal_pty_session", {
      request: {
        workspace_id: "ws_1",
        workbench_id: "wb_1",
        widget_instance_id: "term_1",
        session_id: "pty_1",
        data: "\u001b[A\r",
      },
    });
    expect(mocks.invoke).toHaveBeenNthCalledWith(3, "resize_terminal_pty_session", {
      request: {
        workspace_id: "ws_1",
        workbench_id: "wb_1",
        widget_instance_id: "term_1",
        session_id: "pty_1",
        cols: 120,
        rows: 40,
      },
    });
    expect(mocks.invoke).toHaveBeenNthCalledWith(
      4,
      "stop_terminal_pty_session",
      { request: terminalSnakeScope() },
    );
    expect(mocks.invoke).toHaveBeenNthCalledWith(
      5,
      "kill_terminal_pty_session",
      { request: terminalSnakeScope() },
    );
    expect(mocks.invoke).toHaveBeenNthCalledWith(
      6,
      "close_terminal_pty_session",
      { request: terminalSnakeScope() },
    );
  });

  it("normalizes Terminal PTY output DTO fields", async () => {
    mocks.invoke.mockResolvedValueOnce(tauriTerminalSession());

    await expect(
      writeTerminalPtySession({ ...terminalScope(), data: "input" }),
    ).resolves.toMatchObject({
      output: {
        capBytes: 65536,
        chunks: [
          {
            byteLen: 4,
            sequence: 1,
            streamKind: "pty",
            text: "raw\u001b[0m",
          },
        ],
        droppedBytes: 2,
        totalBufferedBytes: 6,
      },
      sessionId: "pty_1",
    });
  });

  it("maps Agent Queue and Executor run DTOs at the adapter boundary", async () => {
    mocks.invoke
      .mockResolvedValueOnce({
        queue_item_id: "queue_1",
        workspace_id: "ws_1",
        title: "Task",
        description: "Description",
        prompt: "Prompt",
        status: "queued",
        priority: 2,
        execution_policy: "auto",
        assigned_executor_widget_id: null,
        created_at: "1",
        updated_at: "2",
      })
      .mockResolvedValueOnce({
        workspace_id: "ws_1",
        queue_item_id: "queue_1",
        workbench_id: "wb_1",
        executor_widget_instance_id: "exec_1",
        run_id: "run_1",
        status: "running",
      })
      .mockResolvedValueOnce({
        workspace_id: "ws_1",
        workbench_id: "wb_1",
        widget_instance_id: "exec_1",
        runs: [
          {
            run_id: "run_1",
            status: "completed",
            command_kind: "codex_direct_work",
            result_type: "direct_work_result",
            started_at: "1",
            finished_at: "2",
            duration_ms: 10,
            title: "Run",
            repo_root: "C:/repo",
            mode: "direct",
            validation_profile: null,
            validation_status: null,
            has_result: true,
            log_count: 3,
          },
        ],
      });

    await expect(
      createAgentQueueTask({
        workspaceId: "ws_1",
        title: "Task",
        description: "Description",
        prompt: "Prompt",
        status: "queued",
        priority: 2,
        executionPolicy: "auto",
      }),
    ).resolves.toMatchObject({
      executionPolicy: "auto",
      queueItemId: "queue_1",
    });
    expect(mocks.invoke).toHaveBeenNthCalledWith(1, "create_agent_queue_task", {
      request: expect.objectContaining({
        execution_policy: "auto",
        workspace_id: "ws_1",
      }),
    });

    await expect(
      startAssignedAgentQueueTask({
        workspaceId: "ws_1",
        queueItemId: "queue_1",
        codexExecutable: "codex",
        repoRoot: "C:/repo",
        sandbox: "workspace_write",
        approvalPolicy: "never",
      }),
    ).resolves.toMatchObject({
      executorWidgetInstanceId: "exec_1",
      runId: "run_1",
    });
    expect(mocks.invoke).toHaveBeenNthCalledWith(
      2,
      "start_assigned_agent_queue_task",
      {
        request: expect.objectContaining({
          approval_policy: "never",
          materialized_operator_prompt: null,
          queue_item_id: "queue_1",
          repo_root: "C:/repo",
        }),
      },
    );

    await expect(
      listAgentExecutorRuns({
        workspaceId: "ws_1",
        workbenchId: "wb_1",
        widgetInstanceId: "exec_1",
        limit: 20,
      }),
    ).resolves.toMatchObject({
      runs: [{ commandKind: "codex_direct_work", logCount: 3, runId: "run_1" }],
    });
    expect(mocks.invoke).toHaveBeenNthCalledWith(3, "list_agent_executor_runs", {
      request: {
        workspace_id: "ws_1",
        workbench_id: "wb_1",
        widget_instance_id: "exec_1",
        limit: 20,
      },
    });
  });
});

function gitScope() {
  return {
    workspaceId: "ws_1",
    workbenchId: "wb_1",
    widgetInstanceId: "git_1",
    repositoryRoot: "C:/repo",
  };
}

function tauriGitStatus() {
  return {
    branch: {
      name: "main",
      upstream: "origin/main",
      ahead: 1,
      behind: 2,
      is_detached: false,
    },
    working_tree: {
      is_clean: false,
      is_dirty: true,
      staged_count: 1,
      unstaged_count: 2,
      untracked_count: 3,
    },
    changed_files: [
      {
        area: "unstaged",
        kind: "renamed",
        path: "src/new.ts",
        original_path: "src/old.ts",
      },
    ],
    last_commit: {
      hash: "abcdef",
      title: "subject",
      author: "Hobit",
      committed_at: "2026-05-27T10:00:00Z",
    },
    warnings: ["bounded"],
  };
}

function tauriGitDiffSummary() {
  return {
    repo_root: "C:/repo",
    status: "dirty",
    files: [
      {
        path: "src/lib.rs",
        status: "modified",
        staged: false,
        unstaged: true,
        untracked: false,
        conflicted: false,
        additions: 2,
        deletions: 1,
        patch_preview: "diff",
        patch_truncated: false,
      },
    ],
    summary: {
      total_files: 1,
      staged_count: 0,
      unstaged_count: 1,
      untracked_count: 0,
      conflicted_count: 0,
      total_additions: 2,
      total_deletions: 1,
    },
    error_message: null,
    command_summary: [{ program: "git", args: ["status"] }],
  };
}

function tauriGitCommit() {
  return {
    status: "committed",
    commit_hash: "abc123",
    branch: "main",
    repo_root: "C:/repo",
    included_files: ["src/lib.rs"],
    commit_message: "message",
    exit_code: 0,
    stdout: "out",
    stderr: "",
    duration_ms: 9,
    error_message: null,
    command_summary: [{ program: "git", args: ["commit"] }],
    push_performed: false,
    force_push_performed: false,
    reset_performed: false,
    clean_performed: false,
    auto_commit: false,
    operator_confirmed_required: true,
  };
}

function tauriGitPush() {
  return {
    status: "pushed",
    branch: "main",
    upstream: "origin/main",
    remote: "origin",
    remote_branch: "main",
    repo_root: "C:/repo",
    ahead: 2,
    behind: 0,
    exit_code: 0,
    stdout: "",
    stderr: "",
    duration_ms: 12,
    command_summary: [{ program: "git", args: ["push", "origin", "HEAD:main"] }],
    force_push_performed: false,
    operator_confirmed_required: true,
  };
}

function terminalScope() {
  return {
    workspaceId: "ws_1",
    workbenchId: "wb_1",
    widgetInstanceId: "term_1",
    sessionId: "pty_1",
  };
}

function terminalSnakeScope() {
  return {
    workspace_id: "ws_1",
    workbench_id: "wb_1",
    widget_instance_id: "term_1",
    session_id: "pty_1",
  };
}

function tauriKnowledgeDocument(
  overrides: Partial<{
    enabled: boolean;
    scope: "global" | "workspace";
  }> = {},
) {
  return {
    knowledge_document_id: "kdoc_1",
    workspace_id: "ws_1",
    scope: overrides.scope ?? "workspace",
    catalog_item_type: "documentation_knowledge",
    quick_summary: "",
    lifecycle_status: "active",
    title: "Doc",
    source_label: "Paste",
    source_kind: "operator_authored",
    source_ref: "",
    content: "Content",
    tags: "ops",
    enabled: overrides.enabled ?? true,
    created_at: "1",
    updated_at: "2",
  };
}

function tauriTerminalSession() {
  return {
    session_id: "pty_1",
    workspace_id: "ws_1",
    workbench_id: "wb_1",
    widget_instance_id: "term_1",
    shell: "",
    shell_args: ["-NoLogo"],
    working_directory: "C:/Users/Dmitry/repo",
    cols: 100,
    rows: 30,
    status: "running",
    started_at: "1",
    ended_at: null,
    exit_code: null,
    error_message: null,
    output: {
      chunks: [
        {
          sequence: 1,
          stream_kind: "pty",
          text: "raw\u001b[0m",
          byte_len: 4,
        },
      ],
      total_buffered_bytes: 6,
      dropped_bytes: 2,
      cap_bytes: 65536,
    },
  };
}
