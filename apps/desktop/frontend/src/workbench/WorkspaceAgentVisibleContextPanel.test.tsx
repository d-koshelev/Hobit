import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

import { WorkspaceAgentVisibleContextPanel } from "./WorkspaceAgentVisibleContextPanel";

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
  vi.restoreAllMocks();
});

describe("WorkspaceAgentVisibleContextPanel", () => {
  it("renders visible attached context and removable helper copy", () => {
    renderPanel();

    expect(document.body.textContent).toContain("Visible attached context");
    expect(document.body.textContent).toContain("Executor run detail");
    expect(document.body.textContent).toContain("Run: run_safe_123456");
    expect(document.body.textContent).toContain(
      "Included in the message below. Edit or remove it before Send.",
    );
  });

  it("caps rendered attached context preview without dropping the attachment", () => {
    const hiddenTail = "large attached context tail";

    renderPanel(vi.fn(), {
      contextText: `${"A".repeat(5000)}\n${hiddenTail}`,
      sourceLabel: "Executor run detail",
    });

    expect(document.body.textContent).toContain("Preview capped");
    expect(document.body.textContent).toContain(
      "The full attached context remains included",
    );
    expect(document.body.textContent).not.toContain(hiddenTail);
  });

  it("calls onRemove from the remove action", () => {
    const onRemove = vi.fn();
    renderPanel(onRemove);

    act(() => {
      removeButton()?.dispatchEvent(
        new MouseEvent("click", { bubbles: true, cancelable: true }),
      );
    });

    expect(onRemove).toHaveBeenCalledTimes(1);
  });

  it("renders nothing without visible attached context", () => {
    renderPanel(vi.fn(), null);

    expect(document.body.textContent).toBe("");
  });
});

function renderPanel(
  onRemove = vi.fn(),
  context: Parameters<typeof WorkspaceAgentVisibleContextPanel>[0]["context"] = {
    contextText: "Executor run metadata\nRun: run_safe_123456",
    sourceLabel: "Executor run detail",
  },
) {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);

  act(() => {
    root?.render(
      <WorkspaceAgentVisibleContextPanel
        context={context}
        onRemove={onRemove}
      />,
    );
  });
}

function removeButton() {
  return Array.from(document.querySelectorAll("button")).find(
    (button) => button.textContent === "Remove",
  );
}
