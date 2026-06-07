import { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

import { WorkspaceAgentHeaderStatus } from "./WorkspaceAgentStatusPanel";

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

describe("WorkspaceAgentStatusPanel", () => {
  it("renders Provider Codex and the Ready state", () => {
    render(<WorkspaceAgentHeaderStatus status="idle" />);

    expect(document.body.textContent).toContain("Provider");
    expect(document.body.textContent).not.toContain("Agent");
    expect(document.body.textContent).toContain("Codex");
    expect(document.body.textContent).toContain("Ready");
    expect(workspaceAgentPicker()?.getAttribute("aria-label")).toBe(
      "Workspace Agent picker",
    );
  });

  it("renders Running and Failed states", () => {
    render(<WorkspaceAgentHeaderStatus status="running" />);
    expect(document.body.textContent).toContain("Running");

    render(<WorkspaceAgentHeaderStatus status="failed" />);
    expect(document.body.textContent).toContain("Failed");
  });

  it("does not render normal-view Agent details diagnostics", () => {
    render(<WorkspaceAgentHeaderStatus status="idle" />);

    expect(document.body.textContent).not.toContain("Agent details");
    expect(document.body.textContent).not.toContain("Local chat fallback");
    expect(document.body.textContent).not.toContain("Backend");
    expect(document.body.textContent).not.toContain("Review cards available");
    expect(document.body.textContent).not.toContain("Response setup");
    expect(document.body.textContent).not.toContain("Backend selected");
    expect(document.body.textContent).not.toContain("Mock/local fallback");
    expect(document.body.textContent).not.toContain("Supported review cards");
    expect(document.body.textContent).not.toContain("Direct Mode");
    expect(document.body.textContent).not.toContain("Codex Direct Mode");
  });

  it("renders a compact prompt examples toggle when provided", () => {
    const onPromptExampleClick = vi.fn();

    render(
      <WorkspaceAgentHeaderStatus
        onPromptExampleClick={onPromptExampleClick}
        promptExamples={[
          { label: "Make a plan", prompt: "Make a plan from visible text." },
        ]}
        status="idle"
      />,
    );

    const button = document.querySelector<HTMLButtonElement>(
      'button[aria-label="Toggle Workspace Agent prompt examples"]',
    );

    expect(button?.textContent).toBe("Examples");
    expect(button?.getAttribute("aria-expanded")).toBe("false");

    act(() => {
      button?.click();
    });

    expect(button?.getAttribute("aria-expanded")).toBe("true");
    expect(
      document.querySelector('[aria-label="Workspace Agent prompt examples"]'),
    ).not.toBeNull();

    act(() => {
      buttonWithText("Make a plan")?.click();
    });

    expect(onPromptExampleClick).toHaveBeenCalledWith(
      "Make a plan from visible text.",
    );
    expect(
      document.querySelector('[aria-label="Workspace Agent prompt examples"]'),
    ).toBeNull();
  });

  it("uses the shared popup shell for prompt examples and closes with Escape", async () => {
    const onPromptExampleClick = vi.fn();

    render(
      <WorkspaceAgentHeaderStatus
        onPromptExampleClick={onPromptExampleClick}
        promptExamples={[
          { label: "Make a plan", prompt: "Make a plan from visible text." },
        ]}
        status="idle"
      />,
    );

    const button = document.querySelector<HTMLButtonElement>(
      'button[aria-label="Toggle Workspace Agent prompt examples"]',
    );

    act(() => {
      button?.focus();
      button?.click();
    });

    expect(document.querySelector(".popup-shell")).not.toBeNull();
    expect(
      document.querySelector('[aria-label="Workspace Agent prompt examples"]'),
    ).not.toBeNull();

    await act(async () => {
      document.dispatchEvent(
        new KeyboardEvent("keydown", { bubbles: true, key: "Escape" }),
      );
      await new Promise((resolve) => window.setTimeout(resolve, 0));
    });

    expect(document.querySelector(".popup-shell")).toBeNull();
    expect(document.activeElement).toBe(button);
  });
});

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

function workspaceAgentPicker() {
  return document.querySelector('select[aria-label="Workspace Agent picker"]');
}

function buttonWithText(text: string): HTMLButtonElement | undefined {
  return Array.from(document.querySelectorAll("button")).find(
    (button): button is HTMLButtonElement => button.textContent === text,
  );
}
