import { act, type ComponentProps } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

import type {
  GitCommitResponse,
  GitFileDiff,
  GitLog,
  GitRepositoryStatus,
} from "../workspace/types";
import { GitPlaceholderWidget } from "./GitPlaceholderWidget";
import type { WidgetDefinition, WidgetInstance } from "./types";

vi.mock("../workspace/tauriEnvironment", () => ({
  isTauriRuntime: () => true,
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

describe("GitPlaceholderWidget", () => {
  it("renders compact header and avoids explanatory top copy", async () => {
    renderWidget();

    expect(document.body.textContent).toContain("Git");
    expect(document.body.textContent).toContain("Repo path");
    expect(buttonWithText("Refresh")).not.toBeNull();
    expect(document.body.textContent).not.toContain(
      "Read-only snapshot from the explicit path above",
    );
    expect(document.body.textContent).not.toContain("Refresh snapshot");
  });

  it("renders changed files and requests selected-file diff from Changes", async () => {
    const getStatus = vi.fn(async () => statusFixture());
    const getDiff = vi.fn(async () => diffFixture());
    renderWidget({ onGetGitRepositoryStatus: getStatus, onGetGitFileDiff: getDiff });

    await refreshRepository();
    expect(document.body.textContent).toContain("2 changed files");
    expect(document.body.textContent).toContain("src/lib.rs");
    expect(document.body.textContent).toContain("README.md");

    await clickText("src/lib.rs");

    expect(getDiff).toHaveBeenCalledWith(
      "git_widget",
      "C:\\repo",
      "src/lib.rs",
    );
    expect(document.body.textContent).toContain("Diff");
    expect(document.body.textContent).toContain("+changed");
  });

  it("shows diff empty and error states", async () => {
    renderWidget({
      onGetGitRepositoryStatus: async () => statusFixture(),
      onGetGitFileDiff: async () => ({
        ...diffFixture(),
        errorMessage: "Untracked file patch preview is not available.",
        patch: null,
        status: "untracked",
      }),
    });

    await refreshRepository();
    await clickText("Diff");
    expect(document.body.textContent).toContain("No file selected");

    await clickText("Changes");
    await clickText("README.md");
    expect(document.body.textContent).toContain("Untracked file");

    renderWidget({
      onGetGitRepositoryStatus: async () => statusFixture(),
      onGetGitFileDiff: async () => {
        throw new Error("diff failed");
      },
    });
    await refreshRepository();
    await clickText("src/lib.rs");
    expect(document.body.textContent).toContain("Diff unavailable");
    expect(document.body.textContent).toContain("diff failed");
  });

  it("loads and renders recent history", async () => {
    const getLog = vi.fn(async () => logFixture());
    renderWidget({
      onGetGitRepositoryStatus: async () => statusFixture(),
      onGetGitLog: getLog,
    });

    await refreshRepository();
    await clickText("History");

    expect(getLog).toHaveBeenCalledWith("git_widget", "C:\\repo");
    expect(document.body.textContent).toContain("abc1234");
    expect(document.body.textContent).toContain("git: add diff and history views");
  });

  it("keeps explicit local commit flow and no dangerous Git buttons", async () => {
    const createCommit = vi.fn(async (_request) => commitFixture());
    renderWidget({
      onCreateGitCommit: async (_widgetInstanceId, request) =>
        createCommit(request),
      onGetGitRepositoryStatus: async () => statusFixture(),
    });

    await refreshRepository();
    await clickText("Commit");

    expect(document.body.textContent).toContain("Local commit");
    expect(buttonWithText("Create local commit")).not.toBeNull();
    expect(document.body.textContent).not.toContain("Push");
    expect(document.body.textContent).not.toContain("Reset");
    expect(document.body.textContent).not.toContain("Clean");
    expect(document.body.textContent).not.toContain("Stash");
  });
});

function renderWidget(
  props: Partial<ComponentProps<typeof GitPlaceholderWidget>> = {},
) {
  if (root && container) {
    act(() => {
      root?.unmount();
    });
    container.remove();
  }

  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);

  act(() => {
    root?.render(
      <GitPlaceholderWidget
        config={{}}
        definition={definition()}
        instance={instance()}
        onCreateGitCommit={async () => commitFixture()}
        onGetGitFileDiff={async () => diffFixture()}
        onGetGitLog={async () => logFixture()}
        onGetGitRepositoryStatus={async () => statusFixture()}
        title="Git"
        {...props}
      />,
    );
  });
}

async function refreshRepository() {
  const input = document.querySelector<HTMLInputElement>("input.git-repo-input");
  if (!input) {
    throw new Error("repo input not found");
  }

  await act(async () => {
    setNativeInputValue(input, "C:\\repo");
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
  });
  await clickText("Refresh");
}

async function clickText(text: string) {
  const element = Array.from(document.querySelectorAll("button")).find(
    (button) => button.textContent?.includes(text),
  );

  if (!element) {
    throw new Error(`button not found: ${text}`);
  }

  await act(async () => {
    element.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });
}

function buttonWithText(text: string) {
  return Array.from(document.querySelectorAll("button")).find(
    (button) => button.textContent === text,
  );
}

function setNativeInputValue(field: HTMLInputElement, value: string) {
  const descriptor = Object.getOwnPropertyDescriptor(
    HTMLInputElement.prototype,
    "value",
  );
  descriptor?.set?.call(field, value);
}

function definition(): WidgetDefinition {
  return {
    category: "codebase",
    componentKey: "git-placeholder",
    defaultConfig: {},
    defaultTitle: "Git",
    description: "Git",
    id: "git",
    title: "Git",
  };
}

function instance(): WidgetInstance {
  return {
    config: {},
    definitionId: "git",
    id: "git_widget",
    layout: {
      area: "main",
      height: 560,
      mode: "docked",
      order: 1,
      width: 760,
      x: 0,
      y: 0,
    },
    state: {},
    title: "Git",
    visible: true,
  };
}

function statusFixture(): GitRepositoryStatus {
  return {
    branch: {
      ahead: 1,
      behind: 0,
      isDetached: false,
      name: "main",
      upstream: "origin/main",
    },
    changedFiles: [
      {
        area: "unstaged",
        kind: "modified",
        originalPath: null,
        path: "src/lib.rs",
      },
      {
        area: "untracked",
        kind: "untracked",
        originalPath: null,
        path: "README.md",
      },
    ],
    lastCommit: null,
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

function diffFixture(): GitFileDiff {
  return {
    commandSummary: [],
    errorMessage: null,
    patch: "--- unstaged diff ---\ndiff --git a/src/lib.rs b/src/lib.rs\n+changed",
    patchTruncated: false,
    path: "src/lib.rs",
    repoRoot: "C:\\repo",
    status: "available",
  };
}

function logFixture(): GitLog {
  return {
    commandSummary: [],
    entries: [
      {
        author: "Dmitry",
        date: "2026-05-27T10:00:00+00:00",
        hash: "abc123456789",
        shortHash: "abc1234",
        subject: "git: add diff and history views",
      },
    ],
    repoRoot: "C:\\repo",
  };
}

function commitFixture(): GitCommitResponse {
  return {
    autoCommit: false,
    branch: "main",
    cleanPerformed: false,
    commandSummary: [],
    commitHash: "abc123456789",
    commitMessage: "git: add diff and history views",
    durationMs: 12,
    errorMessage: null,
    exitCode: 0,
    forcePushPerformed: false,
    includedFiles: ["src/lib.rs"],
    operatorConfirmedRequired: true,
    pushPerformed: false,
    repoRoot: "C:\\repo",
    resetPerformed: false,
    status: "committed",
    stderr: "",
    stdout: "",
  };
}
