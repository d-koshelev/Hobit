import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

import { WidgetFrame } from "./WidgetFrame";

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

describe("WidgetFrame logs", () => {
  it("keeps widget logs behind the Logs button", async () => {
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);

    await act(async () => {
      root?.render(
        <WidgetFrame
          onLoadLogs={async () => [
            {
              createdAt: "2026-05-22T10:00:00.000Z",
              id: "log_1",
              level: "info",
              message: "Widget state saved",
            },
          ]}
          title="Test Widget"
        >
          <p>Widget body</p>
        </WidgetFrame>,
      );
    });

    expect(document.body.textContent).not.toContain("Widget state saved");

    await act(async () => {
      buttonWithText("Logs").dispatchEvent(
        new MouseEvent("click", { bubbles: true }),
      );
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(document.body.textContent).toContain("Logs");
    expect(document.body.textContent).toContain("Widget state saved");
  });
});

describe("WidgetFrame move handle", () => {
  it("starts a move from the header title but not from widget body textareas", async () => {
    const onMoveStart = vi.fn();

    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);

    await act(async () => {
      root?.render(
        <WidgetFrame
          moveEnabled
          onMoveStart={onMoveStart}
          title="Movable Widget"
        >
          <textarea aria-label="Widget body input" />
        </WidgetFrame>,
      );
    });

    document
      .querySelector(".widget-title")
      ?.dispatchEvent(pointerEvent("pointerdown", { clientX: 12, clientY: 16 }));

    expect(onMoveStart).toHaveBeenCalledWith(12, 16);

    document
      .querySelector("textarea")
      ?.dispatchEvent(pointerEvent("pointerdown", { clientX: 32, clientY: 40 }));

    expect(onMoveStart).toHaveBeenCalledTimes(1);
  });

  it("does not start a move from header controls", async () => {
    const onMoveStart = vi.fn();

    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);

    await act(async () => {
      root?.render(
        <WidgetFrame
          actions={<input aria-label="Header filter" />}
          moveEnabled
          onMoveStart={onMoveStart}
          title="Movable Widget"
        >
          <p>Widget body</p>
        </WidgetFrame>,
      );
    });

    document
      .querySelector("input")
      ?.dispatchEvent(pointerEvent("pointerdown", { clientX: 20, clientY: 24 }));

    expect(onMoveStart).not.toHaveBeenCalled();
  });
});

function buttonWithText(text: string) {
  const button = Array.from(document.querySelectorAll("button")).find(
    (candidate) => candidate.textContent === text,
  );

  if (!button) {
    throw new Error(`Button not found: ${text}`);
  }

  return button;
}

function pointerEvent(
  type: string,
  {
    button = 0,
    clientX,
    clientY,
    isPrimary = true,
  }: {
    button?: number;
    clientX: number;
    clientY: number;
    isPrimary?: boolean;
  },
) {
  const event = new MouseEvent(type, {
    bubbles: true,
    button,
    cancelable: true,
    clientX,
    clientY,
  });

  Object.defineProperty(event, "isPrimary", { value: isPrimary });
  Object.defineProperty(event, "pointerId", { value: 1 });

  return event;
}
