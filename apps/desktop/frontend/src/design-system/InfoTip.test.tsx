import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";

import { InfoTip } from "./overlays/InfoTip";

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

describe("InfoTip", () => {
  it("renders an accessible trigger and opens on hover/click", async () => {
    renderFixture();

    const tipButton = infoButton();

    expect(tipButton).not.toBeNull();
    expect(tipButton.getAttribute("aria-label")).toBe("Widget details");

    await act(async () => {
      tipButton.dispatchEvent(
        new MouseEvent("mouseover", {
          bubbles: true,
        }),
      );
      tipButton.dispatchEvent(
        new MouseEvent("pointerover", {
          bubbles: true,
        }),
      );
      tipButton.dispatchEvent(
        new MouseEvent("mousemove", {
          bubbles: true,
        }),
      );
      await Promise.resolve();
    });

    await act(async () => {
      if (!document.querySelector(".popup-shell")) {
        tipButton.dispatchEvent(
          new MouseEvent("mouseenter", {
            bubbles: true,
          }),
        );
      }
      await Promise.resolve();
    });

    if (!document.querySelector(".popup-shell")) {
      await act(async () => {
        tipButton.focus();
        await Promise.resolve();
      });
    }

    if (!document.querySelector(".popup-shell")) {
      throw new Error("InfoTip did not open on hover or focus.");
    }

    expect(document.querySelector(".popup-shell")).not.toBeNull();
    expect(
      document.querySelector<HTMLElement>(".popup-shell")?.textContent,
    ).toContain("Short explanatory copy.");
    expect(tipButton.getAttribute("aria-expanded")).toBe("true");

    await act(async () => {
      tipButton.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      await Promise.resolve();
    });

    expect(document.querySelector(".popup-shell")).toBeNull();

    await act(async () => {
      tipButton.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      await Promise.resolve();
    });

    expect(document.querySelector(".popup-shell")).not.toBeNull();
  });

  it("opens on focus and keeps accessible content available", async () => {
    renderFixture();

    const tipButton = infoButton();

    await act(async () => {
      tipButton.focus();
      await Promise.resolve();
    });

    expect(document.querySelector(".popup-shell")).not.toBeNull();
    expect(document.body.textContent).toContain("Tooltip title");
    expect(document.body.textContent).toContain("Short explanatory copy.");
    expect(tipButton.getAttribute("aria-expanded")).toBe("true");

    await act(async () => {
      tipButton.blur();
      await Promise.resolve();
      tipButton.focus();
      await Promise.resolve();
    });

    expect(document.querySelector(".popup-shell")).not.toBeNull();
  });

  it("closes on Escape and returns focus to the trigger", async () => {
    renderFixture();

    const tipButton = infoButton();

    await act(async () => {
      tipButton.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(document.querySelector(".popup-shell")).not.toBeNull();

    await act(async () => {
      document.dispatchEvent(
        new KeyboardEvent("keydown", {
          bubbles: true,
          key: "Escape",
        }),
      );
      await new Promise((resolve) => window.setTimeout(resolve, 0));
    });

    expect(document.querySelector(".popup-shell")).toBeNull();
    expect(tipButton.getAttribute("aria-expanded")).toBe("false");
    expect(document.activeElement).toBe(tipButton);
  });
});

function renderFixture() {
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);

  act(() => {
    root?.render(
      <InfoTip label="Widget details" title="Tooltip title">
        Short explanatory copy.
      </InfoTip>,
    );
  });
}

function infoButton() {
  const button = document.querySelector<HTMLButtonElement>(
    'button[aria-label="Widget details"]',
  );

  if (!button) {
    throw new Error("InfoTip trigger not found.");
  }

  return button;
}
