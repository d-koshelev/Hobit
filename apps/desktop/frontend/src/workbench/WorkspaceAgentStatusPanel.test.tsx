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
    expect(document.body.textContent).toContain("Claude: Not connected");
    expect(document.body.textContent).toContain("Amp: Not connected");
    expect(document.body.textContent).toContain("Model");
    expect(document.body.textContent).toContain("gpt-5.5");
    expect(document.body.textContent).toContain("Reasoning");
    expect(document.body.textContent).toContain("medium");
    expect(document.body.textContent).toContain("Ready");
    expect(
      document.querySelector('[aria-label="Workspace Agent run configuration"]'),
    ).not.toBeNull();
    expect(
      document.querySelector('[aria-label="Workspace Agent provider options"]'),
    ).not.toBeNull();
  });

  it("keeps unsupported providers visible but not runnable", () => {
    render(<WorkspaceAgentHeaderStatus status="idle" />);

    expect(providerOption("Codex")?.getAttribute("aria-current")).toBe("true");
    expect(providerOption("Codex")?.getAttribute("aria-disabled")).toBe(
      "false",
    );
    expect(
      providerOption("Claude: Not connected")?.getAttribute("aria-disabled"),
    ).toBe("true");
    expect(
      providerOption("Amp: Not connected")?.getAttribute("aria-disabled"),
    ).toBe("true");
    expect(providerOption("Claude: Not connected")?.title).toBe(
      "Claude is unavailable: Not connected.",
    );
    expect(
      document.querySelector("button.workspace-agent-provider-option"),
    ).toBeNull();
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

  it("renders the Activity toggle next to prompt examples in the header row", () => {
    const onActivityToggle = vi.fn();

    render(
      <WorkspaceAgentHeaderStatus
        isActivityVisible={false}
        onActivityToggle={onActivityToggle}
        onPromptExampleClick={vi.fn()}
        promptExamples={[
          { label: "Make a plan", prompt: "Make a plan from visible text." },
        ]}
        status="idle"
      />,
    );

    const header = document.querySelector(".interactive-agent-frame-status");
    const examplesButton = buttonWithText("Examples");
    const activityButton = buttonWithText("Show activity");

    expect(header?.contains(examplesButton ?? null)).toBe(true);
    expect(header?.contains(activityButton ?? null)).toBe(true);
    expect(activityButton?.getAttribute("aria-expanded")).toBe("false");

    act(() => {
      activityButton?.click();
    });

    expect(onActivityToggle).toHaveBeenCalledTimes(1);
  });

  it("renders an explicit prompt-pack import action when provided", () => {
    const onPromptPackImportClick = vi.fn();

    render(
      <WorkspaceAgentHeaderStatus
        onPromptPackImportClick={onPromptPackImportClick}
        status="idle"
      />,
    );

    const button = document.querySelector<HTMLButtonElement>(
      'button[aria-label="Start prompt-pack import"]',
    );

    expect(button?.textContent).toBe("Import pack");

    act(() => {
      button?.click();
    });

    expect(onPromptPackImportClick).toHaveBeenCalledTimes(1);
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

function buttonWithText(text: string): HTMLButtonElement | undefined {
  return Array.from(document.querySelectorAll("button")).find(
    (button): button is HTMLButtonElement => button.textContent === text,
  );
}

function providerOption(text: string): HTMLElement | undefined {
  return Array.from(
    document.querySelectorAll<HTMLElement>(
      ".workspace-agent-provider-option",
    ),
  ).find((option) => option.textContent === text);
}
