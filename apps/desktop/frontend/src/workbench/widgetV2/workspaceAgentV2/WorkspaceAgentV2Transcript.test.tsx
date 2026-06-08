import { act } from "react";
import type { ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { AgentRunResult } from "../../agentRuntime";
import { WorkspaceAgentV2Composer } from "./WorkspaceAgentV2Composer";
import { WorkspaceAgentV2Transcript } from "./WorkspaceAgentV2Transcript";

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

describe("WorkspaceAgentV2Transcript", () => {
  it("renders messages and inline metadata", async () => {
    await render(
      <WorkspaceAgentV2Transcript
        messages={[
          {
            body: "Investigate the failing typecheck.",
            id: "message-1",
            metadata: {
              provider: "local review",
              session: "session-a",
              status: "draft",
              steps: "2 events",
              thread: "thread-a",
            },
            role: "user",
            title: "Operator prompt",
          },
          {
            body: "No runtime was started.",
            id: "message-2",
            metadata: {
              duration: "4s",
              provider: "mock",
              status: "complete",
              tokens: 128,
            },
            role: "result",
            title: "Visual result",
          },
        ]}
      />,
    );

    expect(document.body.textContent).toContain("User");
    expect(document.body.textContent).toContain("Operator prompt");
    expect(document.body.textContent).toContain("Investigate the failing typecheck.");
    expect(document.body.textContent).toContain("Result");
    expect(document.body.textContent).toContain("Visual result");
    expect(document.body.textContent).toContain("Status");
    expect(document.body.textContent).toContain("draft");
    expect(document.body.textContent).toContain("Provider");
    expect(document.body.textContent).toContain("local review");
    expect(document.body.textContent).toContain("Steps");
    expect(document.body.textContent).toContain("2 events");
    expect(document.body.textContent).toContain("Duration");
    expect(document.body.textContent).toContain("4s");
    expect(document.body.textContent).toContain("Thread");
    expect(document.body.textContent).toContain("thread-a");
    expect(document.body.textContent).toContain("Session");
    expect(document.body.textContent).toContain("session-a");
    expect(document.body.textContent).toContain("Tokens");
    expect(document.body.textContent).toContain("128");
  });

  it("does not render fake token counts when tokens are unavailable", async () => {
    await render(
      <WorkspaceAgentV2Transcript
        messages={[
          {
            body: "Token metadata is not available.",
            id: "message-1",
            metadata: {
              provider: "mock",
              status: "complete",
            },
            role: "assistant",
          },
        ]}
      />,
    );

    expect(document.body.textContent).toContain("Token metadata is not available.");
    expect(document.body.textContent).not.toContain("Tokens");
    expect(document.body.textContent).not.toContain("0");
  });

  it("renders a completed Direct Run result review card", async () => {
    await render(
      <WorkspaceAgentV2Transcript
        messages={[
          {
            body: "Done.",
            id: "result-1",
            metadata: { provider: "codex-direct-work", status: "completed" },
            role: "result",
            result: resultFixture({
              assistantText: "Implemented the requested card.",
              fileChanges: [
                {
                  addedLines: 24,
                  deletedLines: 2,
                  path: "apps/desktop/frontend/src/workbench/widgetV2/workspaceAgentV2/WorkspaceAgentV2ResultCard.tsx",
                  status: "added",
                },
              ],
              validationSuggestions: [
                {
                  command: "npm.cmd run typecheck --prefix apps/desktop/frontend",
                  id: "validation-1",
                  label: "Frontend typecheck",
                  reason: "Frontend TypeScript changed.",
                  status: "suggested",
                },
              ],
            }),
            title: "Direct Run result",
          },
        ]}
      />,
    );

    expect(document.body.textContent).toContain("Completed");
    expect(document.body.textContent).toContain("codex-direct-work");
    expect(document.body.textContent).toContain("1.2s");
    expect(document.body.textContent).toContain("Implemented the requested card.");
    expect(document.body.textContent).toContain("File changes");
    expect(document.body.textContent).toContain("WorkspaceAgentV2ResultCard.tsx");
    expect(document.body.textContent).toContain("Validation suggestions");
    expect(document.body.textContent).toContain("Frontend typecheck");
  });

  it("renders a failed Direct Run result review card", async () => {
    await render(
      <WorkspaceAgentV2Transcript
        messages={[
          {
            body: "Failed.",
            id: "result-1",
            role: "result",
            result: resultFixture({
              assistantText: undefined,
              errorMessage: "provider unavailable",
              lifecycle: "failed",
              metadata: {
                ...resultFixture().metadata,
                lifecycle: "failed",
              },
              warnings: ["Runtime returned a failed final status."],
            }),
            title: "Direct Run result",
          },
        ]}
      />,
    );

    expect(document.body.textContent).toContain("Failed");
    expect(document.body.textContent).toContain("provider unavailable");
    expect(document.body.textContent).toContain("Warnings / errors");
    expect(document.body.textContent).toContain(
      "Runtime returned a failed final status.",
    );
  });

  it("clearly reports missing file-change data without inventing files", async () => {
    await render(
      <WorkspaceAgentV2Transcript
        messages={[
          {
            body: "Done.",
            id: "result-1",
            role: "result",
            result: resultFixture({ fileChanges: [] }),
            title: "Direct Run result",
          },
        ]}
      />,
    );

    expect(document.body.textContent).toContain(
      "No file-change summary was reported.",
    );
    expect(document.body.textContent).not.toContain("src/");
    expect(document.body.textContent).not.toContain(".tsx");
  });

  it("renders validation suggestions only when present", async () => {
    await render(
      <WorkspaceAgentV2Transcript
        messages={[
          {
            body: "Done.",
            id: "result-1",
            role: "result",
            result: resultFixture({ validationSuggestions: [] }),
            title: "Direct Run result",
          },
        ]}
      />,
    );

    expect(document.body.textContent).not.toContain("Validation suggestions");
  });

  it("keeps developer details hidden by default", async () => {
    await render(
      <WorkspaceAgentV2Transcript
        messages={[
          {
            body: "Done.",
            id: "result-1",
            role: "result",
            result: resultFixture(),
            title: "Direct Run result",
          },
        ]}
      />,
    );

    const details = document.querySelector<HTMLDetailsElement>(
      ".workspace-agent-v2-result-developer-details",
    );

    expect(details).not.toBeNull();
    expect(details?.open).toBe(false);
    expect(details?.querySelector("summary")?.textContent).toBe(
      "Developer details",
    );
  });
});

describe("WorkspaceAgentV2Composer", () => {
  it("renders Direct Run and Queue Run as first-class controls", async () => {
    await render(
      <WorkspaceAgentV2Composer
        preflightItems={[
          { label: "Provider", value: "Codex" },
          { label: "Mode", value: "Direct Run" },
        ]}
      />,
    );

    expect(buttonWithText("Direct Run")).not.toBeNull();
    expect(buttonWithText("Queue Run")).not.toBeNull();
    expect(buttonWithText("Queue Run")?.disabled).toBe(true);
    expect(inputByLabel("Workspace Agent v2 prompt")).not.toBeNull();
    expect(inputByLabel("Workspace Agent v2 provider and mode")).not.toBeNull();
    expect(document.body.textContent).toContain("New thread");
    expect(document.body.textContent).toContain("Direct Run preflight");
    expect(document.body.textContent).toContain("Codex");
  });

  it("calls Direct Run callback and keeps Queue Run inert", async () => {
    const onDirectRun = vi.fn();
    const onQueueRun = vi.fn();

    await render(
      <WorkspaceAgentV2Composer
        onDirectRun={onDirectRun}
        onQueueRun={onQueueRun}
      />,
    );

    expect(onDirectRun).not.toHaveBeenCalled();
    expect(onQueueRun).not.toHaveBeenCalled();

    await click(buttonWithText("Direct Run"));
    await click(buttonWithText("Queue Run"));

    expect(onDirectRun).toHaveBeenCalledTimes(1);
    expect(onQueueRun).not.toHaveBeenCalled();
  });

  it("disables Direct Run when requested with a visible reason", async () => {
    await render(
      <WorkspaceAgentV2Composer
        directRunDisabled
        directRunDisabledReason="Enter a prompt before starting Direct Run."
      />,
    );

    expect(buttonWithText("Direct Run")?.disabled).toBe(true);
    expect(buttonWithText("Direct Run")?.title).toBe(
      "Enter a prompt before starting Direct Run.",
    );
  });
});

async function render(element: ReactNode) {
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);

  await act(async () => {
    root?.render(element);
  });
}

async function click(element: HTMLElement | null) {
  expect(element).not.toBeNull();
  if (element instanceof HTMLButtonElement && element.disabled) {
    return;
  }
  await act(async () => {
    element?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });
}

function buttonWithText(text: string): HTMLButtonElement | null {
  return (
    Array.from(document.querySelectorAll<HTMLButtonElement>("button")).find(
      (button) => button.textContent === text,
    ) ?? null
  );
}

function inputByLabel(
  label: string,
): HTMLTextAreaElement | HTMLSelectElement | null {
  return (
    Array.from(
      document.querySelectorAll<HTMLTextAreaElement | HTMLSelectElement>(
        "textarea,select",
      ),
    ).find((input) => input.getAttribute("aria-label") === label) ?? null
  );
}

function resultFixture(
  overrides: Partial<AgentRunResult> = {},
): AgentRunResult {
  return {
    assistantText: "Done.",
    fileChanges: [],
    lifecycle: "completed",
    metadata: {
      completedAtMs: 2_200,
      durationMs: 1_200,
      lifecycle: "completed",
      mode: "direct",
      providerId: "codex-direct-work",
      runId: "run-1",
      startedAtMs: 1_000,
      tokenUsage: null,
      workspaceId: "workspace-1",
    },
    runId: "run-1",
    validationSuggestions: [],
    warnings: [],
    ...overrides,
  };
}
