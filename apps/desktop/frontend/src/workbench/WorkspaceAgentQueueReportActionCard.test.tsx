import { type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { act } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  WorkspaceAgentQueueReportActionCard,
} from "./WorkspaceAgentQueueReportActionCard";
import {
  getWorkspaceGitDiffSummary,
  getWorkspaceGitStatus,
} from "../workspace/workspaceGitApi";
import type { AgentQueueReportActionCard } from "../workspace/types";

vi.mock("../workspace/workspaceGitApi", () => ({
  getWorkspaceGitDiffSummary: vi.fn(),
  getWorkspaceGitStatus: vi.fn(),
}));

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
  vi.restoreAllMocks();
});

describe("WorkspaceAgentQueueReportActionCard", () => {
  it("loads a Coordinator review summary through Workspace Git API without opening Git widget or committing", async () => {
    const getStatusMock = vi.mocked(getWorkspaceGitStatus);
    const getDiffSummaryMock = vi.mocked(getWorkspaceGitDiffSummary);
    const recordActionResult = vi.fn();
    getStatusMock.mockResolvedValue(gitStatusFixture());
    getDiffSummaryMock.mockResolvedValue(gitDiffSummaryFixture());

    renderCard(
      <WorkspaceAgentQueueReportActionCard
        actionResults={{}}
        card={queueReportCard()}
        onPatchCard={vi.fn()}
        onRecordActionResult={recordActionResult}
      />,
    );

    await clickButton("Review changes");

    expect(getStatusMock).toHaveBeenCalledWith({ repoRoot: "C:\\repo" });
    expect(getDiffSummaryMock).toHaveBeenCalledWith({
      includePatchPreview: false,
      maxFiles: 20,
      maxPatchBytesPerFile: 0,
      repoRoot: "C:\\repo",
    });
    expect(recordActionResult).toHaveBeenCalledWith(
      "queue-report-card-source-1-report-1",
      "review_changes",
      expect.objectContaining({
        message:
          "Review changes loaded read-only Workspace Git status and diff summary. No commit was created.",
        status: "completed",
      }),
    );
    expect(document.body.textContent).toContain("Coordinator review summary");
    expect(document.body.textContent).toContain("source-1");
    expect(document.body.textContent).toContain("Source Queue item");
    expect(document.body.textContent).toContain(
      "Final Direct Work response visible to coordinator.",
    );
    expect(document.body.textContent).toContain("Changed files summary");
    expect(document.body.textContent).toContain("2 changed file(s)");
    expect(document.body.textContent).toContain("src/report-card.tsx modified +4 -1");
    expect(document.body.textContent).toContain("Git status summary");
    expect(document.body.textContent).toContain("Branch main");
    expect(document.body.textContent).toContain("No Git widget was opened");
    expect(document.body.textContent).toContain(
      "no commit, push, reset, checkout, clean, or stash action ran",
    );
  });
});

function renderCard(element: ReactNode) {
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);

  act(() => {
    root?.render(element);
  });
}

async function clickButton(text: string) {
  await act(async () => {
    const button = Array.from(document.querySelectorAll("button")).find(
      (candidate) => candidate.textContent === text,
    );
    if (!button) {
      throw new Error(`Button not found: ${text}`);
    }
    button.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    await Promise.resolve();
    await Promise.resolve();
  });
}

function queueReportCard(): AgentQueueReportActionCard {
  return {
    cardId: "queue-report-card-source-1-report-1",
    changedFiles: ["src/report-card.tsx"],
    createdAt: "2026-05-31T10:02:00.000Z",
    errors: [],
    finalResponse: "Final Direct Work response visible to coordinator.",
    linkedFollowUpItemIds: [],
    recommendedActions: [
      {
        actionId: "review_changes",
        description: "Review changes.",
        enabled: true,
        label: "Review changes",
        type: "review_changes",
      },
    ],
    reportKind: "worker_execution",
    reportStatus: "reported",
    reportSummary: "Worker report summary.",
    sourceExecutionWorkspace: "C:\\repo",
    sourceItemId: "source-1",
    sourceItemPriority: 1,
    sourceItemStatus: "review_needed",
    sourceItemTitle: "Source Queue item",
    sourceItemType: "implementation",
    sourceQueueTag: "Implementation",
    sourceReportId: "report-1",
    warnings: [],
  };
}

function gitStatusFixture() {
  return {
    branch: {
      ahead: 0,
      behind: 0,
      isDetached: false,
      name: "main",
      upstream: "origin/main",
    },
    changedFiles: [
      {
        area: "working_tree",
        kind: "modified",
        originalPath: null,
        path: "src/report-card.tsx",
      },
      {
        area: "working_tree",
        kind: "untracked",
        originalPath: null,
        path: "src/report-card.test.tsx",
      },
    ],
    lastCommit: {
      author: "Test User",
      committedAt: "2026-05-31T09:00:00.000Z",
      hash: "abc1234",
      title: "previous commit",
    },
    warnings: [],
    workingTree: {
      isClean: false,
      isDirty: true,
      stagedCount: 0,
      unstagedCount: 1,
      untrackedCount: 1,
    },
  };
}

function gitDiffSummaryFixture() {
  return {
    commandSummary: [],
    errorMessage: null,
    files: [
      {
        additions: 4,
        conflicted: false,
        deletions: 1,
        patchPreview: null,
        patchTruncated: false,
        path: "src/report-card.tsx",
        staged: false,
        status: "modified",
        unstaged: true,
        untracked: false,
      },
      {
        additions: null,
        conflicted: false,
        deletions: null,
        patchPreview: null,
        patchTruncated: false,
        path: "src/report-card.test.tsx",
        staged: false,
        status: "untracked",
        unstaged: false,
        untracked: true,
      },
    ],
    repoRoot: "C:\\repo",
    status: "changed",
    summary: {
      conflictedCount: 0,
      stagedCount: 0,
      totalAdditions: 4,
      totalDeletions: 1,
      totalFiles: 2,
      unstagedCount: 1,
      untrackedCount: 1,
    },
  };
}
