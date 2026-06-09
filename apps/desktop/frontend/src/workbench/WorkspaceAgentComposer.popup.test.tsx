import { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  EMPTY_WORKSPACE_AGENT_ACTIVITY_SUMMARY,
  EMPTY_WORKSPACE_KNOWLEDGE_LOOKUP,
} from "./workspaceAgentDirectWorkModel";
import { WorkspaceAgentComposer } from "./WorkspaceAgentComposer";

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
});

describe("WorkspaceAgentComposer popups", () => {
  it("uses the shared popup shell for Codex settings and closes outside with focus return", async () => {
    render(<ComposerFixture />);

    const settingsButton = document.querySelector<HTMLButtonElement>(
      'button[aria-label="Toggle Codex settings"]',
    );

    await act(async () => {
      settingsButton?.focus();
      settingsButton?.click();
      await Promise.resolve();
    });

    expect(document.querySelector(".popup-shell")).not.toBeNull();
    expect(
      document.querySelector('[aria-label="Codex settings"]'),
    ).not.toBeNull();
    expect(document.body.textContent).toContain("Working dir");
    expect(document.body.textContent).toContain("Sandbox");

    await act(async () => {
      document.body.dispatchEvent(
        new MouseEvent("pointerdown", { bubbles: true }),
      );
      await new Promise((resolve) => window.setTimeout(resolve, 0));
    });

    expect(document.querySelector(".popup-shell")).toBeNull();
    expect(document.activeElement).toBe(settingsButton);
  });

  it("uses the shared popup shell for Run details and closes with Escape", async () => {
    render(<ComposerFixture />);

    const detailsButton = buttonWithText("Run details");

    await act(async () => {
      detailsButton?.focus();
      detailsButton?.click();
      await Promise.resolve();
    });

    expect(document.querySelector(".popup-shell")).not.toBeNull();
    expect(
      document.querySelector('[aria-label="Workspace Agent run details"]'),
    ).not.toBeNull();
    expect(document.body.textContent).toContain("No run details yet.");
    expect(
      document
        .querySelector(".interactive-agent-composer")
        ?.querySelector(".interactive-agent-run-details-popup"),
    ).toBeNull();

    await act(async () => {
      document.dispatchEvent(
        new KeyboardEvent("keydown", { bubbles: true, key: "Escape" }),
      );
      await new Promise((resolve) => window.setTimeout(resolve, 0));
    });

    expect(document.querySelector(".popup-shell")).toBeNull();
    expect(document.activeElement).toBe(detailsButton);
  });
});

function ComposerFixture() {
  return (
    <WorkspaceAgentComposer
      canSend
      directMode={{
        activitySummary: EMPTY_WORKSPACE_AGENT_ACTIVITY_SUMMARY,
        canStartDirectWork: true,
        canStopDirectWork: false,
        directWorkDirectory: "~",
        directWorkSandbox: "read_only",
        error: null,
        finalResult: null,
        isStopPending: false,
        knowledgeLookup: EMPTY_WORKSPACE_KNOWLEDGE_LOOKUP,
        logs: [],
        onDirectoryChange: vi.fn(),
        onSandboxChange: vi.fn(),
        onSelectWorkspaceDirectory: vi.fn(async () => null),
        onStopDirectWork: vi.fn(),
        runId: null,
        runMetadata: null,
        status: "idle",
        threadId: null,
        threadNotice: null,
        warning: null,
      }}
      draft=""
      isProviderPending={false}
      onMessageChange={vi.fn()}
      onRemoveVisibleContext={vi.fn()}
      onRunWithCodex={vi.fn()}
      onSend={vi.fn()}
      textareaRef={{ current: null }}
      visibleAttachedContext={null}
    />
  );
}

function render(node: ReactNode) {
  if (!container) {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  }

  act(() => {
    root?.render(node);
  });
}

function buttonWithText(text: string): HTMLButtonElement | undefined {
  return Array.from(document.querySelectorAll("button")).find(
    (button): button is HTMLButtonElement => button.textContent === text,
  );
}
