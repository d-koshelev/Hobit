import { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";

import { WorkspaceAgentMessageBubble } from "./WorkspaceAgentMessageBubble";

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

describe("WorkspaceAgentMessageBubble", () => {
  it("renders user and assistant bubbles without visible speaker labels", () => {
    render(
      <>
        <WorkspaceAgentMessageBubble
          body="Operator visible request."
          role="operator"
        />
        <WorkspaceAgentMessageBubble
          body="Assistant visible answer."
          role="assistant"
        />
      </>,
    );

    const operatorBubble = document.querySelector(
      '[data-testid="interactive-agent-message-operator"]',
    );
    const assistantBubble = document.querySelector(
      '[data-testid="interactive-agent-message-assistant"]',
    );

    expect(operatorBubble?.getAttribute("aria-label")).toBe("User message");
    expect(assistantBubble?.getAttribute("aria-label")).toBe(
      "Workspace Agent message",
    );
    expect(operatorBubble?.textContent).toContain("Operator visible request.");
    expect(assistantBubble?.textContent).toContain("Assistant visible answer.");
    expect(operatorBubble?.textContent).not.toContain("You");
    expect(assistantBubble?.textContent).not.toContain("Workspace Agent");
  });

  it("keeps response details collapsed and renders fenced code blocks", () => {
    render(
      <WorkspaceAgentMessageBubble
        body={"Review this:\n```ts\nconst answer = 42;\n```"}
        providerMeta={{
          badgeVariant: "neutral",
          detail: "mock-local details",
          label: "Mock/local",
          tone: "neutral",
        }}
        role="assistant"
      />,
    );

    const details = document.querySelector<HTMLDetailsElement>(
      ".interactive-agent-provider-meta",
    );

    expect(document.querySelector(".interactive-agent-code-block")?.textContent).toBe(
      "const answer = 42;",
    );
    expect(details).not.toBeNull();
    expect(details?.open).toBe(false);
    expect(details?.querySelector("summary")?.textContent).toBe("Details");
  });
});

function render(node: ReactNode) {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);

  act(() => {
    root?.render(node);
  });
}
