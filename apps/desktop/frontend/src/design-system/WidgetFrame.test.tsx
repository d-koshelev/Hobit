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

describe("WidgetFrame header", () => {
  it("renders title in the frame header", async () => {
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);

    await act(async () => {
      root?.render(
        <WidgetFrame onLoadLogs={async () => []} title="Cleaner Widget">
          <p>Widget body</p>
        </WidgetFrame>,
      );
    });

    expect(document.body.textContent).toContain("Cleaner Widget");
  });

  it("renders subtitle only through InfoTip and keeps it out of the default header text", async () => {
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);

    await act(async () => {
      root?.render(
        <WidgetFrame
          onLoadLogs={async () => []}
          subtitle="Legacy explanatory subtitle"
          title="Test Widget"
        >
          <p>Widget body</p>
        </WidgetFrame>,
      );
    });

    expect(document.body.textContent).not.toContain(
      "Legacy explanatory subtitle",
    );

    const infoButton = document.querySelector<HTMLButtonElement>(
      'button[aria-label="Widget information"]',
    );

    if (!infoButton) {
      throw new Error("Widget information button not found.");
    }

    await act(async () => {
      infoButton.dispatchEvent(
        new MouseEvent("mouseover", { bubbles: true }),
      );
      await Promise.resolve();
    });

    if (!document.querySelector(".popup-shell")) {
      await act(async () => {
        infoButton.dispatchEvent(new MouseEvent("click", { bubbles: true }));
        await Promise.resolve();
      });
    }

    expect(document.body.textContent).toContain("Legacy explanatory subtitle");
  });

  it("renders the info prop through InfoTip", async () => {
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);

    await act(async () => {
      root?.render(
        <WidgetFrame
          info="Widget info text"
          onLoadLogs={async () => []}
          title="Info Widget"
        >
          <p>Widget body</p>
        </WidgetFrame>,
      );
    });

    const infoButton = document.querySelector<HTMLButtonElement>(
      'button[aria-label="Widget information"]',
    );

    if (!infoButton) {
      throw new Error("Widget information button not found.");
    }

    await act(async () => {
      infoButton.dispatchEvent(
        new MouseEvent("mouseover", { bubbles: true }),
      );
      await Promise.resolve();
    });

    expect(document.body.textContent).toContain("Widget info text");
  });

  it("renders meaningful status and filters duplicate status labels", async () => {
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);

    await act(async () => {
      root?.render(
        <WidgetFrame onLoadLogs={async () => []} status="Ready" title="Ready">
          <p>Widget body</p>
        </WidgetFrame>,
      );
    });

    expect(document.querySelector(".widget-status")).toBeNull();

    await act(async () => {
      root?.render(
        <WidgetFrame onLoadLogs={async () => []} status="Ready" title="Queue">
          <p>Widget body</p>
        </WidgetFrame>,
      );
    });

    expect(document.querySelector(".widget-status")).not.toBeNull();
  });

  it("keeps logs debug access compact and secondary", async () => {
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);

    await act(async () => {
      root?.render(
        <WidgetFrame onLoadLogs={async () => []} title="Test Widget">
          <p>Widget body</p>
        </WidgetFrame>,
      );
    });

    const logsButton = buttonWithAriaLabel("Widget logs");
    expect(logsButton.textContent).toBe("...");
    expect(logsButton.className).toContain("widget-icon-button");

    await act(async () => {
      logsButton.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      await Promise.resolve();
    });

    expect(document.querySelector("[role='dialog']")).not.toBeNull();
  });
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
      buttonWithAriaLabel("Widget logs").dispatchEvent(
        new MouseEvent("click", { bubbles: true }),
      );
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(document.body.textContent).toContain("...");
    expect(document.body.textContent).toContain("Widget state saved");
    expect(container?.textContent).not.toContain("Widget state saved");
    const dialog = document.querySelector<HTMLElement>("[role='dialog']");
    expect(dialog).not.toBeNull();
    expect(dialog?.id).toBe(
      buttonWithAriaLabel("Widget logs").getAttribute("aria-controls"),
    );
    expect(buttonWithAriaLabel("Widget logs").getAttribute("aria-expanded")).toBe(
      "true",
    );
    expect(dialog?.style.maxHeight).not.toBe("");
  });

  it("closes the logs popup on Escape or outside press and returns focus", async () => {
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

    const logsButton = buttonWithAriaLabel("Widget logs");

    await act(async () => {
      logsButton.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(document.querySelector(".popup-shell")).not.toBeNull();

    await act(async () => {
      document.dispatchEvent(
        new KeyboardEvent("keydown", { bubbles: true, key: "Escape" }),
      );
      await new Promise((resolve) => window.setTimeout(resolve, 0));
    });

    expect(document.querySelector(".popup-shell")).toBeNull();
    expect(logsButton.getAttribute("aria-expanded")).toBe("false");
    expect(document.activeElement).toBe(logsButton);

    await act(async () => {
      logsButton.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(document.querySelector(".popup-shell")).not.toBeNull();

    await act(async () => {
      document.body.dispatchEvent(
        new MouseEvent("pointerdown", { bubbles: true }),
      );
      await new Promise((resolve) => window.setTimeout(resolve, 0));
    });

    expect(document.querySelector(".popup-shell")).toBeNull();
    expect(logsButton.getAttribute("aria-expanded")).toBe("false");
    expect(document.activeElement).toBe(logsButton);
  });

  it("shows widget log empty and error states inside the popup", async () => {
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);

    await act(async () => {
      root?.render(
        <WidgetFrame onLoadLogs={async () => []} title="Test Widget">
          <p>Widget body</p>
        </WidgetFrame>,
      );
    });

    await act(async () => {
      buttonWithAriaLabel("Widget logs").dispatchEvent(
        new MouseEvent("click", { bubbles: true }),
      );
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(document.body.textContent).toContain("No widget logs yet.");

    await act(async () => {
      buttonWithAriaLabel("Widget logs").dispatchEvent(
        new MouseEvent("click", { bubbles: true }),
      );
      await Promise.resolve();
    });

    await act(async () => {
      root?.render(
        <WidgetFrame
          onLoadLogs={async () => {
            throw new Error("Widget logs failed");
          }}
          title="Test Widget"
        >
          <p>Widget body</p>
        </WidgetFrame>,
      );
    });

    await act(async () => {
      buttonWithAriaLabel("Widget logs").dispatchEvent(
        new MouseEvent("click", { bubbles: true }),
      );
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(document.querySelector("[role='alert']")?.textContent).toBe(
      "Widget logs failed",
    );
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

function buttonWithAriaLabel(label: string) {
  const button = document.querySelector<HTMLButtonElement>(
    `button[aria-label="${label}"]`,
  );

  if (!button) {
    throw new Error(`Button not found: ${label}`);
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
