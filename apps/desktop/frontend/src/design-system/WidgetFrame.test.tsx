import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";

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

function buttonWithText(text: string) {
  const button = Array.from(document.querySelectorAll("button")).find(
    (candidate) => candidate.textContent === text,
  );

  if (!button) {
    throw new Error(`Button not found: ${text}`);
  }

  return button;
}
