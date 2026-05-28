import { act, type ReactNode } from "react";
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

  it("renders the active thread pill with a compact id and full title", () => {
    const threadId = "thread_visible_1234567890";
    renderPanel({ threadId });

    const threadPill = threadCopyPill();
    expect(threadPill.textContent).toBe("Thread active thread_v...");
    expect(threadPill.title).toBe(`Codex thread id: ${threadId}`);
  });

  it("copies the full Codex thread id from the active thread pill", async () => {
    const writeText = vi.fn(async () => undefined);
    setClipboard(writeText);
    const threadId = "thread_visible_1234567890";
    renderPanel({ threadId });

    await clickThreadPill();

    expect(writeText).toHaveBeenCalledWith(threadId);
    expect(document.body.textContent).toContain("Thread copied.");
  });

  it("shows compact thread copy failure when clipboard is unavailable", async () => {
    renderPanel({ threadId: "thread_unavailable_123456" });

    await clickThreadPill();

    expect(document.body.textContent).toContain("Clipboard unavailable.");
  });

  it("shows compact thread copy failure when clipboard write fails", async () => {
    const writeText = vi.fn(async () => {
      throw new Error("blocked");
    });
    setClipboard(writeText);
    renderPanel({ threadId: "thread_failed_123456" });

    await clickThreadPill();

    expect(writeText).toHaveBeenCalledWith("thread_failed_123456");
    expect(document.body.textContent).toContain("Copy failed.");
  });

  it("does not render a separate thread copy button", () => {
    renderPanel({ threadId: "thread_visible_1234567890" });

    expect(
      Array.from(threadControls().querySelectorAll("button")).some(
        (button) => button.textContent === "Copy",
      ),
    ).toBe(false);
  });

  it("shows no active thread without a thread copy action", () => {
    renderPanel({ threadId: null });

    expect(document.body.textContent).toContain("No active thread");
    expect(buttonWithLabel("Copy Codex thread id")).toBeUndefined();
  });

  it("keeps working directory edits routed through onDirectoryChange", async () => {
    const onDirectoryChange = vi.fn();
    renderPanel({ onDirectoryChange });

    await setInputValue("C:/work/new-project");

    expect(onDirectoryChange).toHaveBeenCalledWith("C:/work/new-project");
  });

  it("keeps New thread routed through onResetThread", async () => {
    const onResetThread = vi.fn();
    renderPanel({ onResetThread, threadId: "thread_reset_123456" });

    await clickButtonWithText("New thread");

    expect(onResetThread).toHaveBeenCalledTimes(1);
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
      status: "running",
    });

    expect(document.body.textContent).toContain(
      "Codex is runningRunning command: git status",
    );
    const details = document.querySelector<HTMLDetailsElement>(
      ".interactive-agent-direct-mode-details",
    );
    expect(details?.open).toBe(false);
    expect(details?.textContent).toContain("item.started command_execution");
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
      error={null}
      finalResult={null}
      knowledgeLookup={EMPTY_WORKSPACE_KNOWLEDGE_LOOKUP}
      logs={[]}
      onDirectoryChange={vi.fn()}
      onResetThread={vi.fn()}
      onSelectWorkspaceDirectory={vi.fn(async () => null)}
      runId={null}
      status="idle"
      threadId={null}
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

function buttonWithLabel(label: string) {
  return Array.from(document.querySelectorAll("button")).find(
    (button) => button.getAttribute("aria-label") === label,
  );
}

function threadControls() {
  const controls = document.querySelector<HTMLElement>(
    '[aria-label="Codex thread controls"]',
  );
  if (!controls) {
    throw new Error("Codex thread controls not found.");
  }
  return controls;
}

function threadCopyPill() {
  const pill = buttonWithLabel("Copy Codex thread id");
  if (!pill) {
    throw new Error("Thread copy pill not found.");
  }
  return pill;
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

async function clickThreadPill() {
  await act(async () => {
    threadCopyPill().dispatchEvent(new MouseEvent("click", { bubbles: true }));
    await Promise.resolve();
    await Promise.resolve();
  });
}

async function clickButtonWithText(text: string) {
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
