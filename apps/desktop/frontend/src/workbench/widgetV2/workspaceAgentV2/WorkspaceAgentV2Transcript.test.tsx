import { act } from "react";
import type { ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

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
});

describe("WorkspaceAgentV2Composer", () => {
  it("renders Direct Run and Queue Run as first-class controls", async () => {
    await render(<WorkspaceAgentV2Composer />);

    expect(buttonWithText("Direct Run")).not.toBeNull();
    expect(buttonWithText("Queue Run")).not.toBeNull();
    expect(inputByLabel("Workspace Agent v2 prompt")).not.toBeNull();
    expect(inputByLabel("Workspace Agent v2 provider and mode")).not.toBeNull();
    expect(document.body.textContent).toContain("New thread");
  });

  it("calls provided no-op test callbacks only when inert buttons are clicked", async () => {
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
    expect(onQueueRun).toHaveBeenCalledTimes(1);
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
