import { act } from "react";
import type { ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";

import {
  WidgetV2BottomDrawer,
  WidgetV2LeftRail,
  WidgetV2PanelLayout,
  WidgetV2RightInspector,
  WidgetV2Shell,
  WidgetV2Toolbar,
} from "./WidgetV2Shell";

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

describe("Widget V2 shell primitives", () => {
  it("renders title, meaningful status, toolbar, and actions", async () => {
    await renderWidget(
      <WidgetV2Shell
        info={{
          content: "Live queue is active when a task is running.",
          label: "Queue widget guidance",
          title: "Queue V2",
        }}
        actions={<button type="button">Review</button>}
        status={{ label: "Ready", tone: "ready", detail: "Ready to inspect" }}
        title="Queue V2"
      >
        <WidgetV2Toolbar>
          <button type="button">Create</button>
        </WidgetV2Toolbar>
        <WidgetV2PanelLayout primary={<p>Primary queue board</p>} />
      </WidgetV2Shell>,
    );

    expect(headingWithText("Queue V2")).not.toBeNull();
    expect(document.body.textContent).toContain("Ready");
    expect(buttonWithText("Review")).not.toBeNull();
    expect(buttonWithText("Create")).not.toBeNull();

    await act(async () => {
      infoButton("Queue widget guidance").focus();
      await Promise.resolve();
    });

    expect(document.querySelector(".popup-shell")).not.toBeNull();
    expect(document.body.textContent).toContain(
      "Live queue is active when a task is running.",
    );
  });

  it("routes legacy subtitle into InfoTip and keeps it out of persistent header text", async () => {
    await renderWidget(
      <WidgetV2Shell
        subtitle="Frontend-only QueueV2 shell."
        title="Queue V2"
      >
        <WidgetV2PanelLayout primary={<p>Primary queue board</p>} />
      </WidgetV2Shell>,
    );

    expect(document.body.textContent).not.toContain("Frontend-only QueueV2 shell.");

    await act(async () => {
      infoButton().focus();
      await Promise.resolve();
    });

    expect(document.querySelector(".popup-shell")).not.toBeNull();
    expect(document.body.textContent).toContain("Frontend-only QueueV2 shell.");
  });

  it("does not render non-meaningful status badges", async () => {
    await renderWidget(
      <WidgetV2Shell
        status={{
          detail: "Experimental implementation path.",
          label: "Experimental",
          tone: "warning",
        }}
        title="Queue V2"
      >
        <WidgetV2PanelLayout primary={<p>Primary queue board</p>} />
      </WidgetV2Shell>,
    );

    expect(document.querySelector(".widget-v2-status")).toBeNull();
    expect(document.body.textContent).not.toContain("Experimental");
  });

  it("keeps a separate compact developer action slot", async () => {
    await renderWidget(
      <WidgetV2Shell
        actions={<button type="button">Review</button>}
        developerActions={<button type="button">Debug</button>}
        title="Queue V2"
      >
        <WidgetV2PanelLayout primary={<p>Primary queue board</p>} />
      </WidgetV2Shell>,
    );

    expect(buttonWithText("Review")).not.toBeNull();
    expect(buttonWithText("Debug")).not.toBeNull();
  });

  it("renders optional rail, inspector, and drawer slots", async () => {
    await renderWidget(
      <WidgetV2Shell title="Knowledge">
        <WidgetV2PanelLayout
          bottomDrawer={
            <WidgetV2BottomDrawer label="Activity drawer">
              Activity summary
            </WidgetV2BottomDrawer>
          }
          leftRail={
            <WidgetV2LeftRail label="Catalog rail">Catalog</WidgetV2LeftRail>
          }
          primary={<p>Knowledge review surface</p>}
          rightInspector={
            <WidgetV2RightInspector label="Review inspector">
              Selection details
            </WidgetV2RightInspector>
          }
        />
      </WidgetV2Shell>,
    );

    expect(regionByRoleAndName("complementary", "Catalog rail")?.textContent).toContain(
      "Catalog",
    );
    expect(
      regionByRoleAndName("complementary", "Catalog rail")?.classList.contains(
        "ui-surface-inset-min",
      ),
    ).toBe(true);
    expect(
      regionByRoleAndName("complementary", "Review inspector")?.textContent,
    ).toContain("Selection details");
    expect(
      regionByRoleAndName("complementary", "Review inspector")?.classList.contains(
        "ui-surface-inset-min",
      ),
    ).toBe(true);
    expect(
      regionByRoleAndName("region", "Activity drawer")?.textContent,
    ).toContain("Activity summary");
    expect(
      regionByRoleAndName("region", "Activity drawer")?.classList.contains(
        "ui-surface-inset-min",
      ),
    ).toBe(true);
  });

  it("keeps the primary surface visible", async () => {
    await renderWidget(
      <WidgetV2PanelLayout
        leftRail={<WidgetV2LeftRail>Navigation</WidgetV2LeftRail>}
        primary={<button type="button">Visible primary action</button>}
        primaryLabel="Queue board"
      />,
    );

    const primarySurface = regionByRoleAndName("region", "Queue board");

    expect(primarySurface).not.toBeNull();
    expect(primarySurface?.textContent).toContain("Visible primary action");
    expect(primarySurface?.classList.contains("ui-surface-inset-min")).toBe(
      true,
    );
    expect(buttonWithText("Visible primary action")).not.toBeNull();
  });
});

async function renderWidget(element: ReactNode) {
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);

  await act(async () => {
    root?.render(element);
  });
}

function headingWithText(text: string): HTMLHeadingElement | null {
  return Array.from(document.querySelectorAll<HTMLHeadingElement>("h1,h2,h3")).find(
    (heading) => heading.textContent === text,
  ) ?? null;
}

function buttonWithText(text: string): HTMLButtonElement | null {
  return Array.from(document.querySelectorAll<HTMLButtonElement>("button")).find(
    (button) => button.textContent === text,
  ) ?? null;
}

function infoButton(label = "Widget information"): HTMLButtonElement {
  const button = document.querySelector<HTMLButtonElement>(
    `button[aria-label="${label}"]`,
  );

  if (!button) {
    throw new Error(`Info tip button with aria-label "${label}" not found.`);
  }

  return button;
}

function regionByRoleAndName(role: string, name: string): HTMLElement | null {
  return (
    Array.from(document.querySelectorAll<HTMLElement>(`[role='${role}']`)).find(
      (element) => element.getAttribute("aria-label") === name,
    ) ?? null
  );
}
