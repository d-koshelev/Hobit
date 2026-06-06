import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

import { homeDir } from "@tauri-apps/api/path";
import {
  createWorkspaceGitCommit,
  getWorkspaceGitFileDiff,
  getWorkspaceGitLog,
  getWorkspaceGitStatus,
  pushWorkspaceGit,
} from "../workspace/workspaceGitApi";
import type {
  GitCommitResponse,
  GitFileChange,
  GitFileDiff,
  GitLog,
  GitPushResponse,
  GitRepositoryStatus,
  AgentQueueTask,
} from "../workspace/types";
import { FinderWidget } from "./FinderWidget";
import type { WidgetDefinition, WidgetInstance } from "./types";

vi.mock("../workspace/workspaceGitApi", () => ({
  createWorkspaceGitCommit: vi.fn(),
  getWorkspaceGitFileDiff: vi.fn(),
  getWorkspaceGitLog: vi.fn(),
  getWorkspaceGitStatus: vi.fn(),
  pushWorkspaceGit: vi.fn(),
}));
vi.mock("@tauri-apps/api/path", () => ({
  homeDir: vi.fn(),
}));

let root: Root | null = null;
let container: HTMLDivElement | null = null;
const homeDirMock = vi.mocked(homeDir);
const getWorkspaceGitStatusMock = vi.mocked(getWorkspaceGitStatus);
const getWorkspaceGitFileDiffMock = vi.mocked(getWorkspaceGitFileDiff);
const getWorkspaceGitLogMock = vi.mocked(getWorkspaceGitLog);
const createWorkspaceGitCommitMock = vi.mocked(createWorkspaceGitCommit);
const pushWorkspaceGitMock = vi.mocked(pushWorkspaceGit);

type FakeFileHandle = {
  createWritable: () => Promise<{
    close: () => Promise<void>;
    write: (content: string) => Promise<void>;
  }>;
  getFile: () => Promise<File>;
  kind: "file";
  name: string;
  readContent: () => string;
};

type FakeDirectoryHandle = {
  kind: "directory";
  name: string;
  values: () => AsyncGenerator<FakeHandle>;
};

type FakeHandle = FakeDirectoryHandle | FakeFileHandle;

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
  Object.defineProperty(window, "showDirectoryPicker", {
    configurable: true,
    value: undefined,
    writable: true,
  });
  getWorkspaceGitStatusMock.mockReset();
  getWorkspaceGitFileDiffMock.mockReset();
  getWorkspaceGitLogMock.mockReset();
  createWorkspaceGitCommitMock.mockReset();
  pushWorkspaceGitMock.mockReset();
  homeDirMock.mockReset();
  vi.restoreAllMocks();
});

describe("FinderWidget", () => {
  it("opens the user home path as the default root when no explicit root is selected", async () => {
    homeDirMock.mockResolvedValue("C:/Users/Dmitry");

    renderWidget();
    await act(async () => {
      await flushPromises();
    });

    expect(document.body.textContent).toContain("Home");
    expect(document.body.textContent).toContain("C:/Users/Dmitry");
    expect(document.body.textContent).toContain("Home path");
    expect(document.body.textContent).toContain(
      "Home is open as the default root path. Directory columns require a supported directory handle in this runtime.",
    );
    expect(getWorkspaceGitStatusMock).not.toHaveBeenCalled();
    expect(getWorkspaceGitLogMock).not.toHaveBeenCalled();
  });

  it("restores a persisted explicit path root when supported by widget state", async () => {
    homeDirMock.mockResolvedValue("C:/Users/Dmitry");

    renderWidget({
      instance: {
        ...instance(),
        state: {
          finderRoot: {
            label: "C:/work/project",
            path: "C:/work/project",
            source: "explicit",
          },
        },
      },
    });
    await act(async () => {
      await flushPromises();
    });

    expect(document.body.textContent).toContain("Root");
    expect(document.body.textContent).toContain("C:/work/project");
    expect(document.body.textContent).toContain("Path root");
    expect(document.body.textContent).toContain(
      "Directory listing is unavailable until this root is reopened with a supported directory handle.",
    );
    expect(homeDirMock).toHaveBeenCalledTimes(1);
  });

  it("renders universal pane controls for columns, Git, commit, and history", async () => {
    renderWidget();

    expect(finderPane("Finder Columns view").textContent).toContain(
      "Columns view",
    );
    expect(finderPane("Finder Columns view").className).toContain(
      "finder-pane-normal",
    );
    expect(finderPane("Finder Git panel").textContent).toContain("Git panel");
    expect(finderPane("Finder Git panel").className).toContain(
      "finder-pane-normal",
    );
    expect(finderPane("Finder Commit panel").textContent).toContain(
      "Commit panel",
    );
    expect(finderPane("Finder Commit panel").className).toContain(
      "finder-pane-minimized",
    );
    expect(finderPane("Finder History panel").textContent).toContain(
      "History panel",
    );
    expect(finderPane("Finder History panel").className).toContain(
      "finder-pane-minimized",
    );

    await clickButtonByLabel("Minimize Git panel");
    expect(finderPane("Finder Git panel").className).toContain(
      "finder-pane-minimized",
    );

    await clickButtonByLabel("Restore Git panel");
    expect(finderPane("Finder Git panel").className).toContain(
      "finder-pane-normal",
    );

    await clickButtonByLabel("Maximize History panel");
    expect(finderPane("Finder History panel").className).toContain(
      "finder-pane-maximized",
    );
  });

  it("opens an approved root, navigates folder columns, and edits a selected file in the floating preview", async () => {
    const appFile = file(
      "App.tsx",
      "export function App() {\n  return 'hello';\n}\n",
    );
    const projectRoot = directory("project", [
      file("README.md"),
      directory("src", [appFile, file("main.tsx")]),
    ]);
    getWorkspaceGitStatusMock.mockResolvedValue(
      gitStatus([
        gitChange("unstaged", "modified", "README.md"),
        gitChange("unstaged", "added", "src/App.tsx"),
      ]),
    );
    getWorkspaceGitFileDiffMock.mockResolvedValue(
      gitFileDiff(
        "src/App.tsx",
        "diff --git a/src/App.tsx b/src/App.tsx\n+  return 'hello';",
      ),
    );
    getWorkspaceGitLogMock.mockResolvedValue(
      gitLog([
        gitLogEntry("abc123456789", "abc1234", "finder: add history"),
        gitLogEntry("def456789012", "def4567", "finder: add diffs"),
      ]),
    );
    const showDirectoryPicker = vi.fn(async () => projectRoot);
    Object.defineProperty(window, "showDirectoryPicker", {
      configurable: true,
      value: showDirectoryPicker,
      writable: true,
    });

    renderWidget();

    await clickButton("Open root");

    expect(showDirectoryPicker).toHaveBeenCalledTimes(1);
    expect(getWorkspaceGitStatusMock).toHaveBeenCalledWith({
      repoRoot: "project",
    });
    expect(getWorkspaceGitLogMock).toHaveBeenCalledWith({
      limit: 30,
      repoRoot: "project",
    });
    expect(document.body.textContent).toContain("project");
    expect(document.body.textContent).toContain("src");
    expect(document.body.textContent).toContain("README.md");
    expect(document.body.textContent).toContain("2 changed");
    expect(document.body.textContent).toContain("Repository root: project");
    expect(document.body.textContent).toContain("Refresh status");
    expect(document.body.textContent).toContain("Select changed file");
    expect(document.body.textContent).toContain("Commit selected");
    expect(document.body.textContent).toContain("Push manually");
    expect(document.body.textContent).toContain("Modified");
    expect(document.body.textContent).toContain("Added");
    expect(document.body.textContent).toContain("finder: add history");
    expect(document.body.textContent).toContain("abc123456789");
    expect(document.querySelectorAll(".finder-column")).toHaveLength(1);

    await clickButtonContaining("finder: add diffs");

    expect(document.body.textContent).toContain("def456789012");

    await clickButton("Changed files");
    expect(document.body.textContent).toContain("README.md");
    expect(document.body.textContent).toContain("src");

    await clickButtonContaining("src");

    expect(document.querySelectorAll(".finder-column")).toHaveLength(2);
    expect(document.body.textContent).toContain("App.tsx");
    expect(document.body.textContent).not.toContain("main.tsx");

    await clickButtonContaining("App.tsx");

    expect(finderEntryButton("src").className).toContain("finder-entry-path");
    expect(finderEntryButton("src").className).not.toContain(
      "finder-entry-selected",
    );
    expect(finderEntryButton("App.tsx").className).toContain(
      "finder-entry-selected",
    );
    expect(getWorkspaceGitFileDiffMock).toHaveBeenCalledWith({
      maxPatchBytes: 96 * 1024,
      path: "src/App.tsx",
      repoRoot: "project",
    });
    expect(document.body.textContent).toContain("src/App.tsx");
    expect(document.body.textContent).toContain("export function App()");
    expect(
      document.querySelector(".finder-floating-preview-normal"),
    ).not.toBeNull();

    await clickButton("Git");
    expect(document.body.textContent).toContain(
      "diff --git a/src/App.tsx b/src/App.tsx",
    );
    expect(document.body.textContent).toContain("available");
    await clickButton("Content");

    await clickButton("Minimize");
    expect(
      document.querySelector(".finder-floating-preview-minimized"),
    ).not.toBeNull();

    await clickButton("Restore");
    await clickButton("Maximize");
    expect(
      document.querySelector(".finder-floating-preview-maximized"),
    ).not.toBeNull();

    await clickButton("Edit");
    await changeTextarea("export function App() {\n  return 'saved';\n}\n");

    expect(document.body.textContent).toContain("Unsaved");

    await clickButton("Save");

    expect(appFile.readContent()).toContain("return 'saved'");
    expect(document.body.textContent).toContain("Saved");

    await clickButton("Edit");
    await changeTextarea("export function App() {\n  return 'discarded';\n}\n");
    await clickButton("Cancel");

    expect(appFile.readContent()).toContain("return 'saved'");
    expect(appFile.readContent()).not.toContain("discarded");

    await clickButton("Close");
    expect(document.querySelector(".finder-floating-preview")).toBeNull();
  });

  it("shows an honest unsupported listing state when only the native directory label picker is available", async () => {
    const onSelectWorkspaceDirectory = vi.fn(async () => "C:/work/project");
    const onUpdateState = vi.fn(async () => undefined);
    getWorkspaceGitStatusMock.mockResolvedValue(gitStatus([]));
    getWorkspaceGitLogMock.mockResolvedValue(gitLog([]));

    renderWidget({ onSelectWorkspaceDirectory, onUpdateState });

    await clickButton("Open root");

    expect(onSelectWorkspaceDirectory).toHaveBeenCalledTimes(1);
    expect(getWorkspaceGitStatusMock).toHaveBeenCalledWith({
      repoRoot: "C:/work/project",
    });
    expect(getWorkspaceGitLogMock).toHaveBeenCalledWith({
      limit: 30,
      repoRoot: "C:/work/project",
    });
    expect(document.body.textContent).toContain("C:/work/project");
    expect(document.body.textContent).toContain(
      "Directory listing is unavailable in this frontend runtime.",
    );
    expect(document.body.textContent).toContain("Clean");
    expect(document.body.textContent).toContain("0 changed");
    expect(document.querySelectorAll(".finder-column")).toHaveLength(0);
    expect(onUpdateState).toHaveBeenCalledWith("finder_widget", {
      finderRoot: {
        label: "C:/work/project",
        path: "C:/work/project",
        source: "explicit",
      },
    });
  });

  it("creates a manual Knowledge Queue task from a selected Finder file", async () => {
    const projectRoot = directory("project", [
      directory("src", [file("App.tsx", "export function App() {}\n")]),
    ]);
    const createQueueTask = vi.fn(async (request) =>
      queueTaskFromRequest(request, "Q-FILE"),
    );
    getWorkspaceGitStatusMock.mockResolvedValue(gitStatus([]));
    getWorkspaceGitLogMock.mockResolvedValue(gitLog([]));
    Object.defineProperty(window, "showDirectoryPicker", {
      configurable: true,
      value: vi.fn(async () => projectRoot),
      writable: true,
    });

    renderWidget({ onCreateAgentQueueTask: createQueueTask });

    await clickButton("Open root");
    expect(document.body.textContent).not.toContain("Knowledge source");
    await clickButtonContaining("src");
    expect(document.body.textContent).not.toContain("Folder");
    await clickButtonContaining("App.tsx");
    expect(document.body.textContent).not.toContain("File");
    expect(document.body.textContent).toContain("Selected actions");
    await clickButton("Create Knowledge task");

    expect(createQueueTask).toHaveBeenCalledWith(
      expect.objectContaining({
        description:
          "Generate draft Knowledge from selected Finder file: src/App.tsx. Draft output only; do not activate Knowledge.",
        executionPolicy: "manual",
        priority: 0,
        queueTagName: "Knowledge generation",
        status: "queued",
        title: "Generate file Knowledge: src/App.tsx",
        validationStatus: "not_started",
      }),
    );
    const request = createQueueTask.mock.calls[0]?.[0];
    expect(request?.prompt).toContain("Queue knowledge generation task.");
    expect(request?.prompt).toContain("* Finder approved root: project");
    expect(request?.prompt).toContain("* codebase file: src/App.tsx");
    expect(request?.prompt).toContain("Structured source refs:");
    expect(request?.prompt).toContain("label: Finder approved root");
    expect(request?.prompt).toContain("label: Finder selected file");
    expect(request?.prompt).toContain("path: src/App.tsx");
    expect(request?.prompt).toContain("selector: file: src/App.tsx");
    expect(request?.prompt).toContain("reason: Generate draft Knowledge from the explicit Finder selection.");
    expect(request?.prompt).toContain(
      "Fallback: if task metadata has no sourceRefs field",
    );
    expect(request?.prompt).toContain(
      "Current Queue task API has no durable sourceRefs field",
    );
    expect(request?.prompt).toContain("Return draft Knowledge only.");
    expect(request?.prompt).toContain(
      "Do not create, edit, enable, or activate Knowledge records.",
    );
    expect(document.body.textContent).toContain(
      "Queue task Q-FILE created. It was not assigned or run.",
    );
  });

  it("creates a manual Knowledge Queue task from a selected Finder folder", async () => {
    const projectRoot = directory("project", [
      directory("docs", [file("README.md", "# Docs\n")]),
    ]);
    const createQueueTask = vi.fn(async (request) =>
      queueTaskFromRequest(request, "Q-FOLDER"),
    );
    getWorkspaceGitStatusMock.mockResolvedValue(gitStatus([]));
    getWorkspaceGitLogMock.mockResolvedValue(gitLog([]));
    Object.defineProperty(window, "showDirectoryPicker", {
      configurable: true,
      value: vi.fn(async () => projectRoot),
      writable: true,
    });

    renderWidget({ onCreateAgentQueueTask: createQueueTask });

    await clickButton("Open root");
    await clickButtonContaining("docs");
    await clickButton("Create Knowledge task");

    expect(createQueueTask).toHaveBeenCalledWith(
      expect.objectContaining({
        description:
          "Generate draft Knowledge from selected Finder folder: docs. Draft output only; do not activate Knowledge.",
        executionPolicy: "manual",
        queueTagName: "Knowledge generation",
        status: "queued",
        title: "Generate folder Knowledge: docs",
      }),
    );
    expect(createQueueTask.mock.calls[0]?.[0].prompt).toContain(
      "* codebase folder: docs",
    );
    expect(createQueueTask.mock.calls[0]?.[0].prompt).toContain(
      "label: Finder selected folder",
    );
    expect(createQueueTask.mock.calls[0]?.[0].prompt).toContain("path: docs");
    expect(document.body.textContent).toContain(
      "Queue task Q-FOLDER created. It was not assigned or run.",
    );
  });

  it("blocks oversized and binary selected files from direct Knowledge source import", async () => {
    const projectRoot = directory("project", [
      file("large.md", "x".repeat(101 * 1024)),
      file("binary.dat", "before\u0000after"),
    ]);
    const createQueueTask = vi.fn(async (request) =>
      queueTaskFromRequest(request, "Q-BLOCKED"),
    );
    getWorkspaceGitStatusMock.mockResolvedValue(gitStatus([]));
    getWorkspaceGitLogMock.mockResolvedValue(gitLog([]));
    Object.defineProperty(window, "showDirectoryPicker", {
      configurable: true,
      value: vi.fn(async () => projectRoot),
      writable: true,
    });

    renderWidget({ onCreateAgentQueueTask: createQueueTask });

    await clickButton("Open root");
    await clickButtonContaining("large.md");

    expect(buttonWithText("Create Knowledge task")?.disabled).toBe(true);
    expect(document.body.textContent).toContain(
      "oversized for direct source import",
    );

    await clickButtonContaining("binary.dat");

    expect(buttonWithText("Create Knowledge task")?.disabled).toBe(true);
    expect(document.body.textContent).toContain(
      "not supported for direct source import",
    );
    expect(document.body.textContent).toContain(
      "Binary file preview is unsupported.",
    );
    expect(createQueueTask).not.toHaveBeenCalled();
  });

  it("renders modified, added, deleted, and untracked Git markers from WorkspaceGitApi", async () => {
    const projectRoot = directory("project", [
      file("README.md"),
      file("scratch.ts"),
      directory("src", [file("App.tsx"), file("main.tsx")]),
    ]);
    getWorkspaceGitStatusMock.mockResolvedValue(
      gitStatus([
        gitChange("unstaged", "modified", "README.md"),
        gitChange("unstaged", "added", "src/App.tsx"),
        gitChange("unstaged", "deleted", "src/old.ts"),
        gitChange("untracked", "untracked", "scratch.ts"),
      ]),
    );
    getWorkspaceGitLogMock.mockResolvedValue(gitLog([]));
    Object.defineProperty(window, "showDirectoryPicker", {
      configurable: true,
      value: vi.fn(async () => projectRoot),
      writable: true,
    });

    renderWidget();

    await clickButton("Open root");

    expect(document.body.textContent).toContain("4 changed");
    expect(document.body.textContent).toContain("Modified");
    expect(document.body.textContent).toContain("Added");
    expect(document.body.textContent).toContain("Deleted");
    expect(document.body.textContent).toContain("Untracked");

    await clickButton("Changed files");

    expect(document.body.textContent).toContain("README.md");
    expect(document.body.textContent).toContain("scratch.ts");
    expect(document.body.textContent).toContain("src");

    await clickButtonContaining("src");

    expect(document.body.textContent).toContain("App.tsx");
    expect(document.body.textContent).not.toContain("main.tsx");
  });

  it("attaches selected-file Git diff context to Workspace Agent when the context API is available", async () => {
    const appFile = file("App.tsx", "export function App() {}\n");
    const projectRoot = directory("project", [directory("src", [appFile])]);
    const attachContext = vi.fn();
    getWorkspaceGitStatusMock.mockResolvedValue(
      gitStatus([gitChange("unstaged", "modified", "src/App.tsx")]),
    );
    getWorkspaceGitFileDiffMock.mockResolvedValue(
      gitFileDiff(
        "src/App.tsx",
        "diff --git a/src/App.tsx b/src/App.tsx\n@@\n-export function App() {}\n+export function App() { return null; }",
      ),
    );
    getWorkspaceGitLogMock.mockResolvedValue(gitLog([]));
    Object.defineProperty(window, "showDirectoryPicker", {
      configurable: true,
      value: vi.fn(async () => projectRoot),
      writable: true,
    });

    renderWidget({ onAttachContextToCoordinator: attachContext });

    await clickButton("Open root");
    await clickButtonContaining("src");
    await clickButtonContaining("App.tsx");
    await clickButton("Git");
    await clickButton("Attach to Workspace Agent");

    expect(attachContext).toHaveBeenCalledWith({
      sourceLabel: "Finder / Git diff",
      contextText: expect.stringContaining("Finder selected-file Git diff"),
    });
    expect(attachContext.mock.calls[0][0].contextText).toContain(
      "Path: src/App.tsx",
    );
    expect(attachContext.mock.calls[0][0].contextText).toContain(
      "Patch preview:",
    );
    expect(document.body.textContent).toContain(
      "Git diff attached to Workspace Agent as visible context.",
    );
  });

  it("creates a manual local commit from selected Finder Git changes", async () => {
    const projectRoot = directory("project", [
      file("README.md"),
      directory("src", [file("App.tsx")]),
    ]);
    getWorkspaceGitStatusMock
      .mockResolvedValueOnce(
        gitStatus([
          gitChange("unstaged", "modified", "README.md"),
          gitChange("unstaged", "added", "src/App.tsx"),
        ]),
      )
      .mockResolvedValueOnce(gitStatus([]));
    getWorkspaceGitLogMock
      .mockResolvedValueOnce(gitLog([]))
      .mockResolvedValueOnce(
        gitLog([
          gitLogEntry(
            "abc123456789",
            "abc1234",
            "finder: commit selected files",
          ),
        ]),
      );
    createWorkspaceGitCommitMock.mockResolvedValue(
      gitCommitResponse({
        commitHash: "abc123456789",
        includedFiles: ["README.md"],
      }),
    );
    Object.defineProperty(window, "showDirectoryPicker", {
      configurable: true,
      value: vi.fn(async () => projectRoot),
      writable: true,
    });

    renderWidget();

    await clickButton("Open root");
    await clickButton("Commit");
    await changeInput("Commit title", "finder: commit selected files");
    await changeTextareaByLabel("Commit body", "Manual Finder Git commit.");
    await clickCheckboxForPath("src/App.tsx");
    await clickButton("Commit selected files");

    expect(document.body.textContent).toContain("Confirm local commit");
    expect(document.body.textContent).toContain("Manual Finder Git commit.");

    await clickButton("Commit");

    expect(createWorkspaceGitCommitMock).toHaveBeenCalledWith({
      commitMessage:
        "finder: commit selected files\n\nManual Finder Git commit.",
      includedFiles: ["README.md"],
      repoRoot: "project",
    });
    expect(document.body.textContent).toContain("Commit created");
    expect(document.body.textContent).toContain("abc123456789");
    expect(getWorkspaceGitStatusMock).toHaveBeenCalledTimes(2);
    expect(getWorkspaceGitLogMock).toHaveBeenCalledTimes(2);
  });

  it("pushes local commits only after manual Finder Git confirmation", async () => {
    const projectRoot = directory("project", [file("README.md")]);
    getWorkspaceGitStatusMock
      .mockResolvedValueOnce(gitStatus([], { ahead: 2 }))
      .mockResolvedValueOnce(gitStatus([]));
    getWorkspaceGitLogMock.mockResolvedValue(gitLog([]));
    pushWorkspaceGitMock.mockResolvedValue(gitPushResponse());
    Object.defineProperty(window, "showDirectoryPicker", {
      configurable: true,
      value: vi.fn(async () => projectRoot),
      writable: true,
    });

    renderWidget();

    await clickButton("Open root");
    await clickButton("Push");

    expect(document.body.textContent).toContain("Branch");
    expect(document.body.textContent).toContain("origin/main");
    expect(document.body.textContent).toContain("2");

    await clickButton("Push upstream");
    expect(document.body.textContent).toContain("Confirm push");
    expect(document.body.textContent).toContain("No force push will be performed.");

    await clickButton("Push");

    expect(pushWorkspaceGitMock).toHaveBeenCalledWith({
      expectedAhead: 2,
      expectedBehind: 0,
      expectedBranch: "main",
      expectedUpstream: "origin/main",
      operatorConfirmed: true,
      repoRoot: "project",
    });
    expect(document.body.textContent).toContain("Push completed");
    expect(getWorkspaceGitStatusMock).toHaveBeenCalledTimes(2);
  });

  it("blocks manual Finder Git push when upstream is unknown", async () => {
    const projectRoot = directory("project", [file("README.md")]);
    getWorkspaceGitStatusMock.mockResolvedValue(
      gitStatus([], { ahead: 1, upstream: null }),
    );
    getWorkspaceGitLogMock.mockResolvedValue(gitLog([]));
    Object.defineProperty(window, "showDirectoryPicker", {
      configurable: true,
      value: vi.fn(async () => projectRoot),
      writable: true,
    });

    renderWidget();

    await clickButton("Open root");
    await clickButton("Push");

    expect(document.body.textContent).toContain(
      "Push is blocked because upstream is unknown.",
    );
    expect(pushWorkspaceGitMock).not.toHaveBeenCalled();
  });

  it("shows repository path errors inside the Finder Git panel", async () => {
    const onSelectWorkspaceDirectory = vi.fn(async () => "C:/missing/project");
    getWorkspaceGitStatusMock.mockRejectedValue(
      new Error("repository path not found: C:/missing/project"),
    );
    getWorkspaceGitLogMock.mockResolvedValue(gitLog([]));

    renderWidget({ onSelectWorkspaceDirectory });

    await clickButton("Open root");

    expect(document.body.textContent).toContain(
      "Repository root: C:/missing/project",
    );
    expect(document.body.textContent).toContain(
      "repository path not found: C:/missing/project",
    );
    expect(document.body.textContent).toContain(
      "Git status has not loaded for this approved root.",
    );
  });
});

function renderWidget(overrides: Partial<Parameters<typeof FinderWidget>[0]> = {}) {
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);

  act(() => {
    root?.render(
      <FinderWidget
        config={{}}
        definition={definition()}
        instance={instance()}
        title="Finder"
        {...overrides}
      />,
    );
  });
}

async function clickButton(text: string) {
  await act(async () => {
    const button = buttonWithText(text);
    if (!button) {
      throw new Error(`Button not found: ${text}`);
    }
    button.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    await flushPromises();
  });
}

async function clickButtonContaining(text: string) {
  await act(async () => {
    const button = buttonContainingText(text);
    if (!button) {
      throw new Error(`Button not found containing: ${text}`);
    }
    button.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    await flushPromises();
  });
}

async function clickButtonByLabel(label: string) {
  await act(async () => {
    const button = document.querySelector<HTMLButtonElement>(
      `button[aria-label="${label}"]`,
    );
    if (!button) {
      throw new Error(`Button not found by label: ${label}`);
    }
    button.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    await flushPromises();
  });
}

function finderPane(label: string) {
  const pane = document.querySelector<HTMLElement>(`section[aria-label="${label}"]`);
  if (!pane) {
    throw new Error(`Finder pane not found: ${label}`);
  }
  return pane;
}

function finderEntryButton(text: string) {
  const button = Array.from(
    document.querySelectorAll<HTMLButtonElement>(".finder-entry"),
  ).find((entryButton) => entryButton.textContent?.includes(text));
  if (!button) {
    throw new Error(`Finder entry not found: ${text}`);
  }
  return button;
}

async function changeTextarea(value: string) {
  await act(async () => {
    const textarea = document.querySelector("textarea");
    if (!textarea) {
      throw new Error("Textarea not found");
    }
    const valueSetter = Object.getOwnPropertyDescriptor(
      HTMLTextAreaElement.prototype,
      "value",
    )?.set;
    valueSetter?.call(textarea, value);
    textarea.dispatchEvent(new Event("input", { bubbles: true }));
    textarea.dispatchEvent(new Event("change", { bubbles: true }));
    await flushPromises();
  });
}

async function changeInput(label: string, value: string) {
  await act(async () => {
    const input = document.querySelector<HTMLInputElement>(
      `input[aria-label="${label}"]`,
    );
    if (!input) {
      throw new Error(`Input not found: ${label}`);
    }
    const valueSetter = Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      "value",
    )?.set;
    valueSetter?.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
    await flushPromises();
  });
}

async function changeTextareaByLabel(label: string, value: string) {
  await act(async () => {
    const textarea = document.querySelector<HTMLTextAreaElement>(
      `textarea[aria-label="${label}"]`,
    );
    if (!textarea) {
      throw new Error(`Textarea not found: ${label}`);
    }
    const valueSetter = Object.getOwnPropertyDescriptor(
      HTMLTextAreaElement.prototype,
      "value",
    )?.set;
    valueSetter?.call(textarea, value);
    textarea.dispatchEvent(new Event("input", { bubbles: true }));
    textarea.dispatchEvent(new Event("change", { bubbles: true }));
    await flushPromises();
  });
}

async function clickCheckboxForPath(path: string) {
  await act(async () => {
    const label = Array.from(document.querySelectorAll("label")).find(
      (candidate) => candidate.textContent?.includes(path),
    );
    const checkbox = label?.querySelector<HTMLInputElement>(
      'input[type="checkbox"]',
    );
    if (!checkbox) {
      throw new Error(`Checkbox not found for path: ${path}`);
    }
    checkbox.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    await flushPromises();
  });
}

function buttonWithText(text: string) {
  return Array.from(document.querySelectorAll("button")).find(
    (button) => button.textContent === text,
  );
}

function buttonContainingText(text: string) {
  return Array.from(document.querySelectorAll("button")).find((button) =>
    button.textContent?.includes(text),
  );
}

async function flushPromises() {
  for (let index = 0; index < 6; index += 1) {
    await Promise.resolve();
  }
}

function directory(name: string, children: FakeHandle[]): FakeDirectoryHandle {
  return {
    kind: "directory" as const,
    name,
    values: async function* values() {
      for (const child of children) {
        yield child;
      }
    },
  };
}

function file(name: string, content = ""): FakeFileHandle {
  let currentContent = content;

  return {
    createWritable: async () => ({
      close: async () => undefined,
      write: async (nextContent: string) => {
        currentContent = nextContent;
      },
    }),
    getFile: async () => new File([currentContent], name, { type: "text/plain" }),
    kind: "file" as const,
    name,
    readContent: () => currentContent,
  };
}

function gitStatus(
  changedFiles: GitFileChange[],
  branchOverrides: Partial<NonNullable<GitRepositoryStatus["branch"]>> = {},
): GitRepositoryStatus {
  return {
    branch: {
      ahead: 0,
      behind: 0,
      isDetached: false,
      name: "main",
      upstream: "origin/main",
      ...branchOverrides,
    },
    changedFiles,
    lastCommit: null,
    warnings: [],
    workingTree: {
      isClean: changedFiles.length === 0,
      isDirty: changedFiles.length > 0,
      stagedCount: changedFiles.filter((file) => file.area === "staged").length,
      unstagedCount: changedFiles.filter((file) => file.area === "unstaged")
        .length,
      untrackedCount: changedFiles.filter((file) => file.area === "untracked")
        .length,
    },
  };
}

function gitPushResponse(): GitPushResponse {
  return {
    ahead: 2,
    behind: 0,
    branch: "main",
    commandSummary: [
      { args: ["push", "origin", "HEAD:main"], program: "git" },
    ],
    durationMs: 12,
    exitCode: 0,
    forcePushPerformed: false,
    operatorConfirmedRequired: true,
    remote: "origin",
    remoteBranch: "main",
    repoRoot: "project",
    status: "pushed",
    stderr: "",
    stdout: "",
    upstream: "origin/main",
  };
}

function gitChange(area: string, kind: string, path: string): GitFileChange {
  return {
    area,
    kind,
    originalPath: null,
    path,
  };
}

function gitFileDiff(path: string, patch: string): GitFileDiff {
  return {
    commandSummary: [{ args: ["diff", "--", path], program: "git" }],
    errorMessage: null,
    patch,
    patchTruncated: false,
    path,
    repoRoot: "project",
    status: "available",
  };
}

function gitCommitResponse({
  commitHash,
  includedFiles,
}: {
  commitHash: string;
  includedFiles: string[];
}): GitCommitResponse {
  return {
    autoCommit: false,
    branch: "main",
    cleanPerformed: false,
    commandSummary: [{ args: ["commit"], program: "git" }],
    commitHash,
    commitMessage: "finder: commit selected files",
    durationMs: 42,
    errorMessage: null,
    exitCode: 0,
    forcePushPerformed: false,
    includedFiles,
    operatorConfirmedRequired: true,
    pushPerformed: false,
    repoRoot: "project",
    resetPerformed: false,
    status: "committed",
    stderr: "",
    stdout: "",
  };
}

function gitLog(entries: GitLog["entries"]): GitLog {
  return {
    commandSummary: [{ args: ["log"], program: "git" }],
    entries,
    repoRoot: "project",
  };
}

function gitLogEntry(hash: string, shortHash: string, subject: string) {
  return {
    author: "Hobit",
    date: "2026-06-04",
    hash,
    shortHash,
    subject,
  };
}

function queueTaskFromRequest(
  request: Parameters<
    NonNullable<Parameters<typeof FinderWidget>[0]["onCreateAgentQueueTask"]>
  >[0],
  queueItemId: string,
): AgentQueueTask {
  return {
    assignedExecutorWidgetId: null,
    createdAt: "2026-06-04T00:00:00.000Z",
    description: request.description,
    executionPolicy: request.executionPolicy,
    prompt: request.prompt,
    priority: request.priority,
    queueItemId,
    queueTagName: request.queueTagName,
    status: request.status,
    title: request.title,
    updatedAt: "2026-06-04T00:00:00.000Z",
    validationStatus: request.validationStatus,
    workspaceId: "workspace",
  };
}

function definition(): WidgetDefinition {
  return {
    category: "codebase",
    componentKey: "finder-widget",
    defaultConfig: {},
    defaultTitle: "Finder",
    description: "Finder",
    id: "finder",
    title: "Finder",
  };
}

function instance(): WidgetInstance {
  return {
    config: {},
    definitionId: "finder",
    id: "finder_widget",
    layout: {
      area: "main",
      height: 600,
      mode: "docked",
      order: 1,
      width: 840,
      x: 0,
      y: 0,
    },
    state: {},
    title: "Finder",
    visible: true,
  };
}
