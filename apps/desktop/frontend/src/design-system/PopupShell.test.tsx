import { act, useRef } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

import { PopupShell } from "./PopupShell";
import { WidgetPopupShell } from "./WidgetPopupShell";

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

  it("moves popups by a marked drag header", async () => {
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
    const title = document.querySelector<HTMLElement>("[data-popup-drag-handle]");

    expect(popup).not.toBeNull();
    expect(title).not.toBeNull();

    await act(async () => {
      title?.dispatchEvent(
        new MouseEvent("pointerdown", {
          bubbles: true,
          clientX: 730,
          clientY: 704,
        }),
      );
      await Promise.resolve();
    });

    await act(async () => {
      window.dispatchEvent(
        new MouseEvent("pointermove", {
          clientX: 640,
          clientY: 620,
        }),
      );
      window.dispatchEvent(
        new MouseEvent("pointerup", {
          clientX: 640,
          clientY: 620,
        }),
      );
      await Promise.resolve();
    });

    expect(Number.parseFloat(popup?.style.left ?? "0")).toBeGreaterThan(0);
    expect(Number.parseFloat(popup?.style.top ?? "0")).toBeLessThan(700);
  });

  it("does not start dragging from popup content or header buttons", async () => {
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
    const content = document.querySelector<HTMLElement>("[data-popup-content]");
    const closeButton = document.querySelector<HTMLElement>("[data-popup-close]");

    expect(popup).not.toBeNull();
    expect(content).not.toBeNull();
    expect(closeButton).not.toBeNull();

    await act(async () => {
      content?.dispatchEvent(
        new MouseEvent("pointerdown", {
          bubbles: true,
          clientX: 730,
          clientY: 704,
        }),
      );
      window.dispatchEvent(
        new MouseEvent("pointermove", {
          clientX: 640,
          clientY: 620,
        }),
      );
      closeButton?.dispatchEvent(
        new MouseEvent("pointerdown", {
          bubbles: true,
          clientX: 770,
          clientY: 704,
        }),
      );
      window.dispatchEvent(
        new MouseEvent("pointermove", {
          clientX: 560,
          clientY: 580,
        }),
      );
      await Promise.resolve();
    });

    expect(popup?.style.left).toBe("");
    expect(popup?.style.transform).toBe("");
  });

  it("renders standard widget popups with bounded body and sticky footer zones", async () => {
    const onRequestClose = vi.fn();

    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);

    await act(async () => {
      root?.render(
        <StandardWidgetPopupFixture isOpen onRequestClose={onRequestClose} />,
      );
      await Promise.resolve();
    });

    const popup = document.querySelector<HTMLElement>(".popup-shell");
    const header = document.querySelector<HTMLElement>(".popup-shell-header");
    const body = document.querySelector<HTMLElement>("[data-popup-body]");
    const footer = document.querySelector<HTMLElement>(".popup-shell-footer");

    expect(popup).not.toBeNull();
    expect(popup?.classList.contains("popup-shell-with-layout")).toBe(true);
    expect(Number.parseFloat(popup?.style.maxHeight ?? "0")).toBeGreaterThan(0);
    expect(header?.getAttribute("data-popup-drag-handle")).toBe("true");
    expect(header?.classList.contains("ui-popup-section-padding-min")).toBe(
      true,
    );
    expect(body?.classList.contains("ui-popup-section-padding-min")).toBe(true);
    expect(body?.getAttribute("data-popup-body")).toBe("true");
    expect(body?.textContent).toContain("Long popup line 39");
    expect(footer?.textContent).toContain("Apply");
    expect(footer?.classList.contains("ui-popup-section-padding-min")).toBe(
      true,
    );
    expect(footer?.classList.contains("ui-control-group-gap-min")).toBe(true);
    expect(body?.contains(footer)).toBe(false);
  });

  it("renders resize handles when a popup opts in", async () => {
    const onRequestClose = vi.fn();

    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);

    await act(async () => {
      root?.render(
        <StandardWidgetPopupFixture
          isOpen
          onRequestClose={onRequestClose}
          resizable
        />,
      );
      await Promise.resolve();
    });

    const handles = document.querySelectorAll("[data-popup-resize-handle]");

    expect(handles).toHaveLength(8);
    expect(
      document.querySelector("[data-popup-resize-handle='se']"),
    ).not.toBeNull();
  });

  it("resizes from the corner without closing", async () => {
    const onRequestClose = vi.fn();

    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);

    await act(async () => {
      root?.render(
        <StandardWidgetPopupFixture
          isOpen
          onRequestClose={onRequestClose}
          resizable
        />,
      );
      await Promise.resolve();
    });

    const popup = document.querySelector<HTMLElement>(".popup-shell");
    const handle = document.querySelector<HTMLElement>(
      "[data-popup-resize-handle='se']",
    );

    expect(popup).not.toBeNull();
    expect(handle).not.toBeNull();

    mockPopupRect(popup, {
      height: 300,
      left: 100,
      top: 80,
      width: 400,
    });

    await act(async () => {
      handle?.dispatchEvent(
        new MouseEvent("pointerdown", {
          bubbles: true,
          clientX: 500,
          clientY: 380,
        }),
      );
      await Promise.resolve();
    });

    await act(async () => {
      window.dispatchEvent(
        new MouseEvent("pointermove", {
          clientX: 560,
          clientY: 430,
        }),
      );
      window.dispatchEvent(new MouseEvent("pointerup"));
      await Promise.resolve();
    });

    expect(popup?.style.width).toBe("460px");
    expect(popup?.style.height).toBe("350px");
    expect(onRequestClose).not.toHaveBeenCalled();
  });

  it("enforces minimum popup resize dimensions", async () => {
    const onRequestClose = vi.fn();

    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);

    await act(async () => {
      root?.render(
        <StandardWidgetPopupFixture
          isOpen
          onRequestClose={onRequestClose}
          resizable
        />,
      );
      await Promise.resolve();
    });

    const popup = document.querySelector<HTMLElement>(".popup-shell");
    const handle = document.querySelector<HTMLElement>(
      "[data-popup-resize-handle='nw']",
    );

    expect(popup).not.toBeNull();
    expect(handle).not.toBeNull();

    mockPopupRect(popup, {
      height: 300,
      left: 100,
      top: 80,
      width: 400,
    });

    await act(async () => {
      handle?.dispatchEvent(
        new MouseEvent("pointerdown", {
          bubbles: true,
          clientX: 100,
          clientY: 80,
        }),
      );
      await Promise.resolve();
    });

    await act(async () => {
      window.dispatchEvent(
        new MouseEvent("pointermove", {
          clientX: 600,
          clientY: 500,
        }),
      );
      window.dispatchEvent(new MouseEvent("pointerup"));
      await Promise.resolve();
    });

    expect(popup?.style.width).toBe("320px");
    expect(popup?.style.height).toBe("180px");
    expect(onRequestClose).not.toHaveBeenCalled();
  });

  it("enforces the shared widget popup layout even without custom footer actions", async () => {
    const onRequestClose = vi.fn();

    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);

    await act(async () => {
      root?.render(
        <WidgetPopupShell
          id="enforced-widget-popup"
          isOpen
          onRequestClose={onRequestClose}
          title="Enforced popup"
          titleId="enforced-widget-popup-title"
          variant="floating"
        >
          <button type="button">Body action</button>
          <p>Body content stays in the scroll zone.</p>
        </WidgetPopupShell>,
      );
      await Promise.resolve();
    });

    const popup = document.querySelector<HTMLElement>(".popup-shell");
    const header = popup?.querySelector<HTMLElement>(".popup-shell-header");
    const body = popup?.querySelector<HTMLElement>("[data-popup-body]");

    expect(popup?.classList.contains("popup-shell-with-layout")).toBe(true);
    expect(header?.getAttribute("data-popup-drag-handle")).toBe("true");
    expect(header?.textContent).toContain("Enforced popup");
    expect(body?.textContent).toContain("Body content stays in the scroll zone.");
    expect(body?.querySelector("button")?.textContent).toBe("Body action");
  });

  it("keeps Close and Escape behavior working", async () => {
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

    const closeButton = document.querySelector<HTMLElement>("[data-popup-close]");

    await act(async () => {
      closeButton?.dispatchEvent(
        new MouseEvent("click", {
          bubbles: true,
        }),
      );
      await Promise.resolve();
    });

    expect(onRequestClose).toHaveBeenCalledTimes(1);

    await act(async () => {
      document.dispatchEvent(
        new KeyboardEvent("keydown", {
          bubbles: true,
          key: "Escape",
        }),
      );
      await Promise.resolve();
    });

    expect(onRequestClose).toHaveBeenCalledTimes(2);
  });

  it("reopens at the initial anchored position after a previous drag", async () => {
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

    const title = document.querySelector<HTMLElement>("[data-popup-drag-handle]");

    await act(async () => {
      title?.dispatchEvent(
        new MouseEvent("pointerdown", {
          bubbles: true,
          clientX: 730,
          clientY: 704,
        }),
      );
      window.dispatchEvent(
        new MouseEvent("pointermove", {
          clientX: 640,
          clientY: 620,
        }),
      );
      window.dispatchEvent(new MouseEvent("pointerup"));
      await Promise.resolve();
    });

    expect(document.querySelector<HTMLElement>(".popup-shell")?.style.left).not.toBe(
      "",
    );

    await act(async () => {
      root?.render(
        <AnchoredPopupFixture isOpen={false} onRequestClose={onRequestClose} />,
      );
      await Promise.resolve();
    });

    await act(async () => {
      root?.render(
        <AnchoredPopupFixture isOpen onRequestClose={onRequestClose} />,
      );
      await Promise.resolve();
    });

    const reopenedPopup = document.querySelector<HTMLElement>(".popup-shell");

    expect(reopenedPopup?.style.left).toBe("");
    expect(reopenedPopup?.style.right).not.toBe("");
  });
});

function StandardWidgetPopupFixture({
  isOpen,
  onRequestClose,
  resizable = false,
}: {
  isOpen: boolean;
  onRequestClose: () => void;
  resizable?: boolean;
}) {
  const anchorRef = useRef<HTMLButtonElement | null>(null);

  function bindAnchor(element: HTMLButtonElement | null) {
    anchorRef.current = element;

    if (element) {
      element.getBoundingClientRect = () =>
        ({
          bottom: 80,
          height: 24,
          left: 40,
          right: 120,
          toJSON: () => ({}),
          top: 56,
          width: 80,
          x: 40,
          y: 56,
        }) as DOMRect;
    }
  }

  return (
    <div className="widget-frame">
      <button ref={bindAnchor} type="button">
        Open
      </button>
      <WidgetPopupShell
        actions={
          <button data-popup-close onClick={onRequestClose} type="button">
            Close
          </button>
        }
        anchorRef={anchorRef}
        footer={<button type="button">Apply</button>}
        id="standard-widget-popup"
        isOpen={isOpen}
        onRequestClose={onRequestClose}
        resizable={resizable}
        title="Standard popup"
        titleId="standard-widget-popup-title"
      >
        {Array.from({ length: 40 }, (_, index) => (
          <p data-popup-content key={index}>
            Long popup line {index.toString()}
          </p>
        ))}
      </WidgetPopupShell>
    </div>
  );
}

function mockPopupRect(
  element: HTMLElement | null,
  rect: { height: number; left: number; top: number; width: number },
) {
  if (!element) {
    return;
  }

  element.getBoundingClientRect = () =>
    ({
      bottom: rect.top + rect.height,
      height: rect.height,
      left: rect.left,
      right: rect.left + rect.width,
      toJSON: () => ({}),
      top: rect.top,
      width: rect.width,
      x: rect.left,
      y: rect.top,
    }) as DOMRect;
}

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
        <div data-popup-drag-handle>
          <h2 id="test-popup-title">Popup title</h2>
          <button data-popup-close onClick={onRequestClose} type="button">
            Close
          </button>
        </div>
        <p data-popup-content>Popup content</p>
      </PopupShell>
    </div>
  );
}
