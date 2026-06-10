import { act } from "react";
import type { ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  DestructiveConfirmationPopup,
  RowActionMenu,
  TopbarGroup,
} from "./ActionPrimitives";

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

describe("shared action primitives", () => {
  it("opens and closes a row action menu without firing callbacks on render", async () => {
    const onOpen = vi.fn();

    await render(
      <RowActionMenu
        items={[{ id: "open", label: "Open", onSelect: onOpen }]}
        label="More actions for report"
      />,
    );

    expect(onOpen).not.toHaveBeenCalled();
    expect(menuByName("Action menu for report")).toBeNull();

    await click(buttonByText("More"));

    expect(menuByName("Action menu for report")).not.toBeNull();
    expect(onOpen).not.toHaveBeenCalled();

    await click(buttonByText("Open"));

    expect(onOpen).toHaveBeenCalledTimes(1);
    expect(menuByName("Action menu for report")).toBeNull();
  });

  it("shows disabled menu action reasons and does not call disabled actions", async () => {
    const onSelect = vi.fn();

    await render(
      <RowActionMenu
        items={[
          {
            disabledReason: "Select a task before running.",
            id: "run",
            label: "Run",
            onSelect,
          },
        ]}
        label="More actions for task"
      />,
    );

    await click(buttonByText("More"));

    expect(menuByName("Action menu for task")?.textContent).toContain(
      "Select a task before running.",
    );
    expect(buttonByText("Run")?.disabled).toBe(true);

    await click(buttonByText("Run"));

    expect(onSelect).not.toHaveBeenCalled();
  });

  it("passes the row menu trigger to selected item handlers", async () => {
    const onSelect = vi.fn();

    await render(
      <RowActionMenu
        items={[{ id: "details", label: "Open details", onSelect }]}
        label="More actions for task"
      />,
    );

    const trigger = buttonByText("More");
    await click(trigger);
    await click(buttonByText("Open details"));

    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect.mock.calls[0]?.[0]).toBe(trigger);
  });

  it("requires destructive confirmation and cancellation does not invoke action", async () => {
    const onCancel = vi.fn();
    const onConfirm = vi.fn();

    await render(
      <DestructiveConfirmationPopup
        ariaLabel="Delete report confirmation"
        body={
          <>
            <p>
              <strong>Delete report?</strong>
            </p>
            <p>This cannot be undone.</p>
          </>
        }
        confirmLabel="Delete"
        id="delete-report"
        isOpen
        onCancel={onCancel}
        onConfirm={onConfirm}
        title="Delete report"
      />,
    );

    expect(onCancel).not.toHaveBeenCalled();
    expect(onConfirm).not.toHaveBeenCalled();
    expect(regionByName("Delete report confirmation")?.textContent).toContain(
      "Delete report?",
    );

    await click(buttonByText("Cancel"));

    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it("runs destructive callback only from the explicit confirm action", async () => {
    const onConfirm = vi.fn();

    await render(
      <DestructiveConfirmationPopup
        body={<p>Permanent deletion.</p>}
        confirmLabel="Delete"
        id="confirm-delete"
        isOpen
        onCancel={vi.fn()}
        onConfirm={onConfirm}
        title="Delete item"
      />,
    );

    expect(onConfirm).not.toHaveBeenCalled();

    await click(buttonByText("Delete"));

    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it("renders topbar groups with spacing and priority classes", async () => {
    await render(
      <div>
        <TopbarGroup data-group="primary" label="Primary actions" priority="primary">
          <button type="button">New</button>
        </TopbarGroup>
        <TopbarGroup data-group="secondary" label="Secondary actions">
          <button type="button">Refresh</button>
        </TopbarGroup>
      </div>,
    );

    const primary = groupByName("Primary actions");
    const secondary = groupByName("Secondary actions");

    expect(primary?.className).toContain("ui-topbar-group");
    expect(primary?.className).toContain("ui-topbar-group-primary");
    expect(primary?.dataset.group).toBe("primary");
    expect(secondary?.className).toContain("ui-topbar-group");
    expect(secondary?.className).toContain("ui-topbar-group-secondary");
    expect(secondary?.dataset.group).toBe("secondary");
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

async function click(element: HTMLElement | null) {
  expect(element).not.toBeNull();
  if (element instanceof HTMLButtonElement && element.disabled) {
    return;
  }
  await act(async () => {
    element?.dispatchEvent(
      new MouseEvent("click", { bubbles: true, cancelable: true }),
    );
    await Promise.resolve();
  });
}

function buttonByText(text: string) {
  return (
    Array.from(document.querySelectorAll<HTMLButtonElement>("button")).find(
      (button) => button.textContent === text,
    ) ?? null
  );
}

function menuByName(name: string) {
  return (
    Array.from(document.querySelectorAll<HTMLElement>("[role='menu']")).find(
      (element) => element.getAttribute("aria-label") === name,
    ) ?? null
  );
}

function regionByName(name: string) {
  return (
    Array.from(document.querySelectorAll<HTMLElement>("section")).find(
      (element) => element.getAttribute("aria-label") === name,
    ) ?? null
  );
}

function groupByName(name: string) {
  return (
    Array.from(document.querySelectorAll<HTMLElement>("[role='group']")).find(
      (element) => element.getAttribute("aria-label") === name,
    ) ?? null
  );
}
