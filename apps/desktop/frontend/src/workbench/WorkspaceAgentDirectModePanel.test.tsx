import { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

import { WorkspaceAgentDirectModePanel } from "./WorkspaceAgentDirectModePanel";
import { EMPTY_WORKSPACE_KNOWLEDGE_LOOKUP } from "./workspaceAgentDirectWorkModel";

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

  it("shows a compact thread id with the full thread id in the title", () => {
    const threadId = "thread_visible_1234567890";
    renderPanel({ threadId });

    expect(document.body.textContent).toContain("Thread active thread_v...");
    expect(
      document.querySelector(`[title="Codex thread id: ${threadId}"]`),
    ).not.toBeNull();
  });

  it("copies the full Codex thread id", async () => {
    const writeText = vi.fn(async () => undefined);
    setClipboard(writeText);
    const threadId = "thread_visible_1234567890";
    renderPanel({ threadId });

    await clickButtonByLabel("Copy Codex thread id");

    expect(writeText).toHaveBeenCalledWith(threadId);
    expect(document.body.textContent).toContain("Copied Codex thread id.");
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
});

type RenderPanelOptions = Partial<
  Parameters<typeof WorkspaceAgentDirectModePanel>[0]
>;

function renderPanel(options: RenderPanelOptions = {}) {
  render(
    <WorkspaceAgentDirectModePanel
      directWorkDirectory="~"
      error={null}
      finalResult={null}
      knowledgeLookup={EMPTY_WORKSPACE_KNOWLEDGE_LOOKUP}
      logs={[]}
      onDirectoryChange={vi.fn()}
      onResetThread={vi.fn()}
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
