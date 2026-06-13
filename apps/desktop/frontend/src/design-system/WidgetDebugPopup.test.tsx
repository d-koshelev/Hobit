import { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

import { WidgetDebugPopup } from "./widget/WidgetDebugPopup";

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

describe("WidgetDebugPopup", () => {
  it("renders when open", async () => {
    await render(
      <WidgetDebugPopup onClose={vi.fn()} open title="Runtime details">
        <p>Diagnostic body</p>
      </WidgetDebugPopup>,
    );

    const popup = document.querySelector<HTMLElement>(".widget-debug-popup");

    expect(popup).not.toBeNull();
    expect(popup?.getAttribute("role")).toBe("dialog");
    expect(popup?.textContent).toContain("Runtime details");
  });

  it("closes via onClose", async () => {
    const onClose = vi.fn();

    await render(
      <WidgetDebugPopup onClose={onClose} open title="Runtime details">
        <p>Diagnostic body</p>
      </WidgetDebugPopup>,
    );

    const closeButton = findButton("Close");

    await act(async () => {
      closeButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      await Promise.resolve();
    });

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("renders title and children", async () => {
    await render(
      <WidgetDebugPopup onClose={vi.fn()} open title="Bridge diagnostics">
        <pre>{JSON.stringify({ status: "ready" })}</pre>
      </WidgetDebugPopup>,
    );

    expect(document.body.textContent).toContain("Bridge diagnostics");
    expect(document.body.textContent).toContain('"status":"ready"');
  });

  it("renders copy diagnostics action if provided", async () => {
    const onCopy = vi.fn();

    await render(
      <WidgetDebugPopup
        copyDiagnostics={{ onCopy }}
        onClose={vi.fn()}
        open
        title="Raw diagnostics"
      >
        <p>Raw payload</p>
      </WidgetDebugPopup>,
    );

    const copyButton = findButton("Copy diagnostics");

    expect(copyButton).not.toBeNull();

    await act(async () => {
      copyButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      await Promise.resolve();
    });

    expect(onCopy).toHaveBeenCalledTimes(1);
  });
});

async function render(element: ReactNode) {
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);

  await act(async () => {
    root?.render(element);
    await Promise.resolve();
  });
}

function findButton(label: string) {
  return Array.from(document.querySelectorAll<HTMLButtonElement>("button")).find(
    (button) => button.textContent === label,
  );
}
