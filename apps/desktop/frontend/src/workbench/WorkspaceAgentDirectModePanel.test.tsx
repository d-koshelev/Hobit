import { act, createRef, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

import { WorkspaceAgentDirectModePanel } from "./WorkspaceAgentDirectModePanel";
import {
  EMPTY_WORKSPACE_AGENT_ACTIVITY_SUMMARY,
  EMPTY_WORKSPACE_KNOWLEDGE_LOOKUP,
} from "./workspaceAgentDirectWorkModel";

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
  Object.defineProperty(navigator, "clipboard", {
    configurable: true,
    value: undefined,
  });
  vi.restoreAllMocks();
});

describe("Workspace directory API adapters", () => {
  it("opens the Tauri dialog as a single directory picker", async () => {
    const open = vi.fn(async () => "C:/work/selected");
    const { tauriWorkspaceApi } = await loadTauriWorkspaceApi(open);

    const selectedDirectory = await tauriWorkspaceApi.selectWorkspaceDirectory();

    expect(selectedDirectory).toBe("C:/work/selected");
    expect(open).toHaveBeenCalledWith({ directory: true, multiple: false });
    expect(open).toHaveBeenCalledTimes(1);
  });

  it("returns null when the Tauri directory picker is canceled", async () => {
    const open = vi.fn(async () => null);
    const { tauriWorkspaceApi } = await loadTauriWorkspaceApi(open);

    await expect(tauriWorkspaceApi.selectWorkspaceDirectory()).resolves.toBe(
      null,
    );
  });

  it("handles unexpected array directory picker results defensively", async () => {
    const open = vi.fn(async () => ["/home/dmitry/first", "/home/dmitry/extra"]);
    const { tauriWorkspaceApi } = await loadTauriWorkspaceApi(open);

    await expect(tauriWorkspaceApi.selectWorkspaceDirectory()).resolves.toBe(
      "/home/dmitry/first",
    );
  });

  it("accepts Linux absolute directory paths returned by the desktop picker", async () => {
    const open = vi.fn(async () => "/home/dmitry/work/hobit");
    const { tauriWorkspaceApi } = await loadTauriWorkspaceApi(open);

    await expect(tauriWorkspaceApi.selectWorkspaceDirectory()).resolves.toBe(
      "/home/dmitry/work/hobit",
    );
  });

  it("reports dialog picker failures as readable errors", async () => {
    const open = vi.fn(async () => {
      throw new Error("plugin:dialog|open denied");
    });
    const { tauriWorkspaceApi } = await loadTauriWorkspaceApi(open);

    await expect(tauriWorkspaceApi.selectWorkspaceDirectory()).rejects.toThrow(
      "Directory picker failed: plugin:dialog|open denied",
    );
  });

  it("keeps the browser memory fallback as a no-op directory picker", async () => {
    vi.resetModules();
    const { memoryWorkspaceApi } = await import("../workspace/memoryWorkspaceApi");

    await expect(memoryWorkspaceApi.selectWorkspaceDirectory()).resolves.toBe(
      null,
    );
  });
});

describe("WorkspaceAgentDirectModePanel", () => {
  it("renders the full working directory value and title", () => {
    const directory =
      "C:/Users/Dmitry/Documents/prj/Hobit_fixed/apps/desktop/frontend";
    renderPanel({ directWorkDirectory: directory });

    expect(workingDirectoryInput().value).toBe(directory);
    expect(workingDirectoryInput().title).toBe(directory);
  });

  it("keeps long working directories inspectable through the input title", () => {
    const directory =
      "C:/very/long/project/path/with/many/segments/that/needs/operator/verification";
    renderPanel({ directWorkDirectory: directory });

    expect(workingDirectoryInput().title).toBe(directory);
    expect(buttonWithLabel("Copy working directory")).toBeDefined();
    expect(buttonWithLabel("Browse for working directory")).toBeDefined();
  });

  it("clicking Browse calls the directory picker API", async () => {
    const onSelectWorkspaceDirectory = vi.fn(async () => null);
    renderPanel({ onSelectWorkspaceDirectory });

    await clickButtonByLabel("Browse for working directory");

    expect(onSelectWorkspaceDirectory).toHaveBeenCalledTimes(1);
  });

  it("updates the working directory through the existing callback after Browse selection", async () => {
    const onDirectoryChange = vi.fn();
    const onSelectWorkspaceDirectory = vi.fn(async () => "C:/work/selected");
    renderPanel({ onDirectoryChange, onSelectWorkspaceDirectory });

    await clickButtonByLabel("Browse for working directory");

    expect(onDirectoryChange).toHaveBeenCalledWith("C:/work/selected");
  });

  it("accepts Linux directory paths through the existing Browse callback", async () => {
    const onDirectoryChange = vi.fn();
    const onSelectWorkspaceDirectory = vi.fn(
      async () => "/home/dmitry/work/hobit",
    );
    renderPanel({ onDirectoryChange, onSelectWorkspaceDirectory });

    await clickButtonByLabel("Browse for working directory");

    expect(onDirectoryChange).toHaveBeenCalledWith("/home/dmitry/work/hobit");
  });

  it("leaves the working directory unchanged when Browse is canceled", async () => {
    const onDirectoryChange = vi.fn();
    const onSelectWorkspaceDirectory = vi.fn(async () => null);
    renderPanel({ onDirectoryChange, onSelectWorkspaceDirectory });

    await clickButtonByLabel("Browse for working directory");

    expect(onDirectoryChange).not.toHaveBeenCalled();
  });

  it("shows a compact Browse failure when the directory picker fails", async () => {
    const onDirectoryChange = vi.fn();
    const onSelectWorkspaceDirectory = vi.fn(async () => {
      throw new Error("Native directory picker unavailable.");
    });
    renderPanel({ onDirectoryChange, onSelectWorkspaceDirectory });

    await clickButtonByLabel("Browse for working directory");

    expect(onDirectoryChange).not.toHaveBeenCalled();
    expect(document.body.textContent).toContain(
      "Browse failed: Native directory picker unavailable.",
    );
  });

  it("copies the working directory without changing run behavior", async () => {
    const writeText = vi.fn(async () => undefined);
    setClipboard(writeText);
    const directory = "C:/work/project";
    const onDirectoryChange = vi.fn();
    renderPanel({ directWorkDirectory: directory, onDirectoryChange });

    await clickButtonByLabel("Copy working directory");

    expect(writeText).toHaveBeenCalledWith(directory);
    expect(onDirectoryChange).not.toHaveBeenCalled();
    expect(document.body.textContent).toContain("Copied working directory.");
  });

  it("does not render duplicate bottom thread controls", () => {
    renderPanel();

    expect(document.body.textContent).not.toContain("No active thread");
    expect(document.body.textContent).not.toContain("New thread");
    expect(buttonWithLabel("Copy Codex thread id")).toBeUndefined();
  });

  it("keeps working directory edits routed through onDirectoryChange", async () => {
    const onDirectoryChange = vi.fn();
    renderPanel({ onDirectoryChange });

    await setInputValue("C:/work/new-project");

    expect(onDirectoryChange).toHaveBeenCalledWith("C:/work/new-project");
  });

  it("exposes the unsafe local-dev sandbox as an explicit operator choice", async () => {
    const onSandboxChange = vi.fn();
    renderPanel({ directWorkSandbox: "danger_full_access", onSandboxChange });

    expect(sandboxOption("Full access").getAttribute("aria-checked")).toBe(
      "true",
    );
    expect(document.body.textContent).toContain(
      "danger_full_access is unsafe",
    );
    expect(document.body.textContent).toContain(
      "disables Codex sandbox restrictions",
    );
    expect(document.body.textContent).toContain("will not auto-commit");

    await clickSandboxOption("Read only");

    expect(onSandboxChange).toHaveBeenCalledWith("read_only");
  });

  it("renders one compact activity line while keeping raw details collapsed", () => {
    renderPanel({
      activitySummary: {
        latestTitle: "Running command: git status",
        severity: "info",
        shortText: "Running command: git status",
        status: "running",
        stepCount: 2,
      },
      logs: [
        {
          id: "raw-1",
          kind: "codex_json_event",
          text: "item.started command_execution",
        },
      ],
      runId: "run_activity",
    });

    expect(document.body.textContent).toContain(
      "Codex is running: Running command: git status",
    );
    const details = document.querySelector<HTMLDetailsElement>(
      ".interactive-agent-direct-mode-details",
    );
    expect(details).toBeNull();
    expect(document.body.textContent).not.toContain(
      "item.started command_execution",
    );
  });

  it("renders compact completed run metadata instead of final text inline", () => {
    renderPanel({
      activitySummary: {
        latestTitle: "Completed run",
        severity: "success",
        shortText: "Completed run",
        status: "completed",
        stepCount: 10,
      },
      finalResult: "Full assistant final response should stay in details.",
      runMetadata: {
        durationMs: 11_000,
        status: "completed",
        stepCount: 10,
        threadId: "019ea9ad123456789",
        tokenUsage: {
          inputTokens: 33_576,
          outputTokens: 118,
        },
      },
    });

    expect(document.body.textContent).toContain(
      "Completed - 10 steps - 11s - thread 019ea9ad... - tokens 33,576 in, 118 out",
    );
    expect(document.body.textContent).not.toContain("Final:");
    expect(document.body.textContent).not.toContain(
      "Full assistant final response should stay in details.",
    );
  });

  it("keeps Run details available for full final response and logs", () => {
    renderPanel({
      finalResult: "Full assistant final response in details.",
      isDetailsOpen: true,
      logs: [
        {
          id: "log-1",
          kind: "final_message",
          text: "Final: raw log text in details only.",
        },
      ],
      runMetadata: {
        durationMs: 1100,
        status: "completed",
        stepCount: 1,
        threadId: null,
        tokenUsage: null,
      },
    });

    expect(document.body.textContent).toContain("Run details");
    expect(document.body.textContent).toContain(
      "Full assistant final response in details.",
    );
    expect(document.body.textContent).toContain(
      "Final: raw log text in details only.",
    );
  });

  it("does not invent token usage when token metadata is unavailable", () => {
    renderPanel({
      runMetadata: {
        durationMs: 1100,
        status: "completed",
        stepCount: 1,
        threadId: null,
        tokenUsage: null,
      },
    });

    expect(document.body.textContent).toContain("Completed - 1 step - 1.1s");
    expect(document.body.textContent).not.toContain("tokens");
  });

  it("does not render Agent Activity inside the Direct Work detail panel", () => {
    renderPanel();

    expect(
      document.querySelector('[aria-label="Workspace Agent activity panel"]'),
    ).toBeNull();
  });
});

type RenderPanelOptions = Partial<
  Parameters<typeof WorkspaceAgentDirectModePanel>[0]
>;

function renderPanel(options: RenderPanelOptions = {}) {
  render(
    <WorkspaceAgentDirectModePanel
      activitySummary={EMPTY_WORKSPACE_AGENT_ACTIVITY_SUMMARY}
      directWorkDirectory="~"
      directWorkSandbox="workspace_write"
      error={null}
      finalResult={null}
      isDetailsOpen={false}
      isSettingsOpen={true}
      knowledgeLookup={EMPTY_WORKSPACE_KNOWLEDGE_LOOKUP}
      logs={[]}
      onDirectoryChange={vi.fn()}
      onRequestCloseDetails={vi.fn()}
      onRequestCloseSettings={vi.fn()}
      onSandboxChange={vi.fn()}
      onSelectWorkspaceDirectory={vi.fn(async () => null)}
      runId={null}
      runMetadata={null}
      runDetailsAnchorRef={createRef<HTMLButtonElement>()}
      settingsAnchorRef={createRef<HTMLButtonElement>()}
      threadNotice={null}
      warning={null}
      {...options}
    />,
  );
}

function render(node: ReactNode) {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);

  act(() => {
    root?.render(node);
  });
}

function setClipboard(writeText: (value: string) => Promise<void>) {
  Object.defineProperty(navigator, "clipboard", {
    configurable: true,
    value: { writeText },
  });
}

function workingDirectoryInput() {
  const input = document.querySelector<HTMLInputElement>(
    'input[aria-label="Working directory"]',
  );
  if (!input) {
    throw new Error("Working directory input not found.");
  }
  return input;
}

function sandboxOption(label: string) {
  const option = Array.from(
    document.querySelectorAll<HTMLButtonElement>(
      '[role="radio"][aria-checked]',
    ),
  ).find((button) => button.textContent === label);
  if (!option) {
    throw new Error(`Codex sandbox option not found: ${label}`);
  }
  return option;
}

async function clickSandboxOption(label: string) {
  await act(async () => {
    sandboxOption(label).dispatchEvent(
      new MouseEvent("click", { bubbles: true }),
    );
    await Promise.resolve();
  });
}

function buttonWithLabel(label: string) {
  return Array.from(document.querySelectorAll("button")).find(
    (button) => button.getAttribute("aria-label") === label,
  );
}

async function clickButtonByLabel(label: string) {
  await act(async () => {
    const button = buttonWithLabel(label);
    if (!button) {
      throw new Error(`Button not found: ${label}`);
    }
    button.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    await Promise.resolve();
    await Promise.resolve();
  });
}

async function setInputValue(value: string) {
  const input = workingDirectoryInput();

  await act(async () => {
    const descriptor = Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      "value",
    );
    descriptor?.set?.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
  });
}

async function loadTauriWorkspaceApi(
  open: (options?: unknown) => Promise<unknown>,
) {
  vi.resetModules();
  const invoke = vi.fn(async () => null);
  vi.doMock("@tauri-apps/api/core", () => ({
    invoke,
  }));
  vi.doMock("@tauri-apps/api/event", () => ({
    listen: vi.fn(),
  }));
  vi.doMock("@tauri-apps/api/path", () => ({
    homeDir: vi.fn(),
  }));
  vi.doMock("@tauri-apps/plugin-dialog", () => ({
    open,
  }));

  try {
    return await import("../workspace/tauriWorkspaceApi");
  } finally {
    vi.doUnmock("@tauri-apps/api/core");
    vi.doUnmock("@tauri-apps/api/event");
    vi.doUnmock("@tauri-apps/api/path");
    vi.doUnmock("@tauri-apps/plugin-dialog");
  }
}
