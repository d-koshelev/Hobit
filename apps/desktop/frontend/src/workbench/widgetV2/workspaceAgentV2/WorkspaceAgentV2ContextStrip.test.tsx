import { act } from "react";
import type { ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  WorkspaceAgentV2ContextStrip,
  type WorkspaceAgentV2ContextItem,
} from "./WorkspaceAgentV2ContextStrip";

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

describe("WorkspaceAgentV2ContextStrip", () => {
  it("renders multiple context types", async () => {
    await render(<WorkspaceAgentV2ContextStrip items={contextFixture} />);

    expect(document.body.textContent).toContain("Knowledge");
    expect(document.body.textContent).toContain("Skill");
    expect(document.body.textContent).toContain("File");
    expect(document.body.textContent).toContain("Note");
    expect(document.body.textContent).toContain("Queue task context");
    expect(document.body.textContent).toContain("Manual attachment");
    expect(document.body.textContent).toContain("Future Git review");
  });

  it("shows source, scope, and version when present", async () => {
    await render(
      <WorkspaceAgentV2ContextStrip
        items={[
          {
            id: "knowledge-1",
            label: "Workspace Agent contract",
            scope: "Workspace",
            source: "Knowledge / Skills",
            type: "knowledge",
            version: "v3",
          },
        ]}
      />,
    );

    expect(document.body.textContent).toContain("Scope: Workspace");
    expect(document.body.textContent).toContain("Source: Knowledge / Skills");
    expect(document.body.textContent).toContain("Version: v3");
  });

  it("shows stale, large, secret, disabled, and rejected warnings", async () => {
    await render(
      <WorkspaceAgentV2ContextStrip
        items={[
          {
            id: "manual-1",
            label: "Pasted incident log",
            type: "manual",
            warningDetails: ["Needs operator review before use"],
            warnings: ["stale", "large", "secret", "disabled", "rejected"],
          },
        ]}
      />,
    );

    expect(document.body.textContent).toContain("Stale");
    expect(document.body.textContent).toContain("Large");
    expect(document.body.textContent).toContain("Secret");
    expect(document.body.textContent).toContain("Disabled");
    expect(document.body.textContent).toContain("Rejected");
    expect(document.body.textContent).toContain("Needs operator review before use");
  });

  it("remove callback is explicit and local only", async () => {
    const onRemoveItem = vi.fn();
    const onAddPlaceholder = vi.fn();

    await render(
      <WorkspaceAgentV2ContextStrip
        items={[contextFixture[0]]}
        onAddPlaceholder={onAddPlaceholder}
        onRemoveItem={onRemoveItem}
      />,
    );

    expect(onRemoveItem).not.toHaveBeenCalled();
    expect(onAddPlaceholder).not.toHaveBeenCalled();

    await click(buttonWithText("Remove"));

    expect(onRemoveItem).toHaveBeenCalledTimes(1);
    expect(onRemoveItem).toHaveBeenCalledWith("knowledge-1");
    expect(onAddPlaceholder).not.toHaveBeenCalled();
  });

  it("add context callback is explicit and local only", async () => {
    const onRemoveItem = vi.fn();
    const onAddPlaceholder = vi.fn();

    await render(
      <WorkspaceAgentV2ContextStrip
        items={[contextFixture[0]]}
        onAddPlaceholder={onAddPlaceholder}
        onRemoveItem={onRemoveItem}
      />,
    );

    await click(buttonWithText("Add context"));

    expect(onAddPlaceholder).toHaveBeenCalledTimes(1);
    expect(onRemoveItem).not.toHaveBeenCalled();
  });

  it("disabled or rejected items are visually blocked and warned", async () => {
    await render(
      <WorkspaceAgentV2ContextStrip
        items={[
          {
            id: "skill-1",
            label: "Deprecated review skill",
            type: "skill",
            warnings: ["disabled", "rejected"],
          },
        ]}
      />,
    );

    const card = contextCard("Skill context: Deprecated review skill");

    expect(card?.dataset.blocked).toBe("true");
    expect(card?.textContent).toContain("Disabled");
    expect(card?.textContent).toContain("Rejected");
  });
});

const contextFixture: readonly WorkspaceAgentV2ContextItem[] = [
  {
    id: "knowledge-1",
    label: "Workspace Agent contract",
    source: "Knowledge / Skills",
    type: "knowledge",
  },
  {
    id: "skill-1",
    label: "Focused implementation skill",
    scope: "Workspace",
    type: "skill",
  },
  {
    id: "file-1",
    label: "src/workbench/WidgetHost.tsx",
    type: "file",
  },
  {
    id: "note-1",
    label: "Operator notes",
    type: "note",
  },
  {
    id: "queue-1",
    label: "Queue task 42",
    type: "queue-task-context",
  },
  {
    id: "manual-1",
    label: "Pasted summary",
    type: "manual",
  },
  {
    id: "git-1",
    label: "Selected diff metadata",
    type: "future-git-review",
  },
];

async function render(element: ReactNode) {
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);

  await act(async () => {
    root?.render(element);
  });
}

function buttonWithText(text: string): HTMLButtonElement | null {
  return (
    Array.from(document.querySelectorAll<HTMLButtonElement>("button")).find(
      (button) => button.textContent === text,
    ) ?? null
  );
}

function contextCard(label: string): HTMLElement | null {
  return (
    Array.from(document.querySelectorAll<HTMLElement>("article")).find(
      (element) => element.getAttribute("aria-label") === label,
    ) ?? null
  );
}

async function click(element: HTMLElement | null) {
  expect(element).not.toBeNull();
  await act(async () => {
    element?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });
}
