import { act } from "react";
import type { ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";

import { QueueV2Widget } from "./QueueV2Widget";

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

describe("QueueV2Widget scaffold", () => {
  it("renders the experimental Widget V2 shell placeholders without run actions", async () => {
    await render(<QueueV2Widget />);

    expect(headingWithText("Agent Queue v2")).not.toBeNull();
    expect(document.body.textContent).toContain("Experimental");
    expect(regionByRoleAndName("toolbar", "Agent Queue v2 command bar")).not.toBeNull();
    expect(document.body.textContent).toContain("Command bar placeholder");
    expect(
      regionByRoleAndName("complementary", "Agent Queue v2 left rail")?.textContent,
    ).toContain("Left rail placeholder");
    expect(regionByRoleAndName("region", "Agent Queue v2 board")?.textContent).toContain(
      "Board placeholder",
    );
    expect(
      regionByRoleAndName("region", "Agent Queue v2 closed and history")?.textContent,
    ).toContain("Closed / history placeholder");
    expect(document.querySelector("details")?.hasAttribute("open")).toBe(false);
    expect(buttonWithText("Run now")).toBeNull();
    expect(buttonWithText("Start")).toBeNull();
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

function regionByRoleAndName(role: string, name: string): HTMLElement | null {
  return (
    Array.from(document.querySelectorAll<HTMLElement>(`[role='${role}']`)).find(
      (element) => element.getAttribute("aria-label") === name,
    ) ?? null
  );
}
