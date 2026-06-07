import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";

import { WidgetInfoPopover } from "./WidgetInfoPopover";

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

describe("WidgetInfoPopover", () => {
  it("opens on click, closes on Escape, and returns focus to the opener", async () => {
    renderFixture();

    const button = infoButton();

    expect(document.querySelector(".popup-shell")).toBeNull();
    expect(container?.textContent).not.toContain("Shared help copy");

    await act(async () => {
      button.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      await Promise.resolve();
      await Promise.resolve();
    });

    const popup = document.querySelector<HTMLElement>(".popup-shell");

    expect(popup).not.toBeNull();
    expect(popup?.getAttribute("role")).toBe("dialog");
    expect(popup?.textContent).toContain("Shared help copy");
    expect(container?.textContent).not.toContain("Shared help copy");
    expect(button.getAttribute("aria-expanded")).toBe("true");

    await act(async () => {
      document.dispatchEvent(
        new KeyboardEvent("keydown", { bubbles: true, key: "Escape" }),
      );
      await new Promise((resolve) => window.setTimeout(resolve, 0));
    });

    expect(document.querySelector(".popup-shell")).toBeNull();
    expect(button.getAttribute("aria-expanded")).toBe("false");
    expect(document.activeElement).toBe(button);
  });
});

function renderFixture() {
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);

  act(() => {
    root?.render(
      <WidgetInfoPopover label="Test widget help" title="Test widget">
        <p>Shared help copy</p>
      </WidgetInfoPopover>,
    );
  });
}

function infoButton() {
  const button = document.querySelector<HTMLButtonElement>(
    'button[aria-label="Test widget help"]',
  );

  if (!button) {
    throw new Error("Info button not found.");
  }

  return button;
}
