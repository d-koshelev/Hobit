import { act, useRef } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

import { PopupShell } from "./PopupShell";

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

describe("PopupShell", () => {
  it("renders anchored popups in a fixed portal without shifting widget layout", async () => {
    const onRequestClose = vi.fn();

    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);

    await act(async () => {
      root?.render(
        <AnchoredPopupFixture isOpen onRequestClose={onRequestClose} />,
      );
      await Promise.resolve();
    });

    const popup = document.querySelector<HTMLElement>(".popup-shell");

    expect(popup).not.toBeNull();
    expect(popup?.classList.contains("popup-shell-anchored")).toBe(true);
    expect(container.textContent).not.toContain("Popup content");
    expect(Number.parseFloat(popup?.style.top ?? "0")).toBeLessThan(700);
    expect(Number.parseFloat(popup?.style.maxHeight ?? "0")).toBeGreaterThan(0);
  });

  it("supports the floating variant above widgets", async () => {
    const onRequestClose = vi.fn();

    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);

    await act(async () => {
      root?.render(
        <AnchoredPopupFixture
          isOpen
          onRequestClose={onRequestClose}
          variant="floating"
        />,
      );
      await Promise.resolve();
    });

    const popup = document.querySelector<HTMLElement>(".popup-shell");

    expect(popup).not.toBeNull();
    expect(popup?.classList.contains("popup-shell-floating")).toBe(true);
    expect(container.textContent).not.toContain("Popup content");
  });
});

function AnchoredPopupFixture({
  isOpen,
  onRequestClose,
  variant,
}: {
  isOpen: boolean;
  onRequestClose: () => void;
  variant?: "anchored" | "floating";
}) {
  const anchorRef = useRef<HTMLButtonElement | null>(null);

  function bindAnchor(element: HTMLButtonElement | null) {
    anchorRef.current = element;

    if (element) {
      element.getBoundingClientRect = () =>
        ({
          bottom: 724,
          height: 24,
          left: 720,
          right: 780,
          toJSON: () => ({}),
          top: 700,
          width: 60,
          x: 720,
          y: 700,
        }) as DOMRect;
    }
  }

  return (
    <div className="widget-frame">
      <button ref={bindAnchor} type="button">
        Anchor
      </button>
      <PopupShell
        anchorRef={anchorRef}
        id="test-popup"
        isOpen={isOpen}
        labelId="test-popup-title"
        onRequestClose={onRequestClose}
        variant={variant}
      >
        <h2 id="test-popup-title">Popup title</h2>
        <p>Popup content</p>
      </PopupShell>
    </div>
  );
}
