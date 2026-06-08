import { act } from "react";
import type { ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

import { WorkspaceAgentV2Widget } from "./WorkspaceAgentV2Widget";

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

describe("WorkspaceAgentV2Widget scaffold", () => {
  it("renders the inert Workspace Agent v2 shell", async () => {
    await render(<WorkspaceAgentV2Widget />);

    expect(headingWithText("Workspace Agent v2")).not.toBeNull();
    expect(document.body.textContent).toContain("Experimental");
    expect(document.body.textContent).toContain("Not connected");
    expect(document.body.textContent).toContain("Review only");
    expect(document.body.textContent).toContain("Main transcript");
    expect(document.body.textContent).toContain("Activity");
    expect(document.body.textContent).toContain("Composer");
    expect(
      regionByRoleAndName("toolbar", "Workspace Agent v2 provider and mode row"),
    ).not.toBeNull();
    expect(
      regionByRoleAndName("region", "Workspace Agent v2 transcript")?.textContent,
    ).toContain("No hidden context is read.");
    expect(
      regionByRoleAndName("complementary", "Workspace Agent v2 activity pane")
        ?.textContent,
    ).toContain("No provider, Queue, Terminal, Git, JDBC, or backend runtime is invoked.");
    expect(
      regionByRoleAndName("region", "Workspace Agent v2 composer placeholder")
        ?.textContent,
    ).toContain("No provider request, Direct Run, or Queue task creation");
  });

  it("does not expose provider run or Queue creation controls", async () => {
    await render(<WorkspaceAgentV2Widget />);

    expect(buttonWithText("Run")).toBeNull();
    expect(buttonWithText("Send")).toBeNull();
    expect(buttonWithText("Create Queue task")).toBeNull();
    expect(
      inputByLabel("Workspace Agent v2 composer placeholder input")?.disabled,
    ).toBe(true);
  });

  it("does not invoke run callbacks on render", async () => {
    const onRunRequest = vi.fn();
    const onQueueTaskCreate = vi.fn();

    await render(
      <WorkspaceAgentV2Widget
        onQueueTaskCreate={onQueueTaskCreate}
        onRunRequest={onRunRequest}
      />,
    );

    expect(onRunRequest).not.toHaveBeenCalled();
    expect(onQueueTaskCreate).not.toHaveBeenCalled();
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

function headingWithText(text: string): HTMLHeadingElement | null {
  return (
    Array.from(document.querySelectorAll<HTMLHeadingElement>("h1,h2,h3")).find(
      (heading) => heading.textContent === text,
    ) ?? null
  );
}

function buttonWithText(text: string): HTMLButtonElement | null {
  return (
    Array.from(document.querySelectorAll<HTMLButtonElement>("button")).find(
      (button) => button.textContent === text,
    ) ?? null
  );
}

function inputByLabel(label: string): HTMLTextAreaElement | null {
  return (
    Array.from(document.querySelectorAll<HTMLTextAreaElement>("textarea")).find(
      (input) => input.getAttribute("aria-label") === label,
    ) ?? null
  );
}

function regionByRoleAndName(role: string, name: string): HTMLElement | null {
  return (
    Array.from(document.querySelectorAll<HTMLElement>(`[role='${role}']`)).find(
      (element) => element.getAttribute("aria-label") === name,
    ) ?? null
  );
}
