import { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";

import {
  WorkspaceAgentHeaderStatus,
  WorkspaceAgentStatusPanel,
} from "./WorkspaceAgentStatusPanel";

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
  it("renders Agent Codex and the Ready state", () => {
    render(<WorkspaceAgentHeaderStatus status="idle" />);

    expect(document.body.textContent).toContain("Agent");
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

  it("renders response setup details without duplicate Direct Mode labels", () => {
    render(
      <WorkspaceAgentStatusPanel
        isProviderPending={false}
        providerModeLabel="Mock/local fallback"
        supportedProposalTypeSummary="Queue task, Note, JDBC query suggestion"
      />,
    );

    expect(
      document.querySelector('[aria-label="Workspace Agent status"]'),
    ).not.toBeNull();
    expect(
      document.querySelector('[aria-label="Workspace Agent provider details"]'),
    ).not.toBeNull();
    expect(document.body.textContent).toContain("Response setup");
    expect(document.body.textContent).toContain("Backend selected");
    expect(document.body.textContent).toContain(
      "Provider fallback stays chat-only and uses visible context with no tools.",
    );
    expect(document.body.textContent).not.toContain("Direct Mode");
    expect(document.body.textContent).not.toContain("Codex Direct Mode");
  });

  it("renders provider pending state as Drafting", () => {
    render(
      <WorkspaceAgentStatusPanel
        isProviderPending={true}
        providerModeLabel="Mock/local fallback"
        supportedProposalTypeSummary="Queue task"
      />,
    );

    expect(document.body.textContent).toContain("Drafting");
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
