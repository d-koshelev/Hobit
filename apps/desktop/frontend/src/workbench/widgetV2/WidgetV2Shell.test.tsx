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
  it("renders shell title, status, toolbar, and actions", async () => {
    await renderWidget(
      <WidgetV2Shell
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
    expect(regionByRoleAndName("toolbar", "Widget actions")).not.toBeNull();
    expect(buttonWithText("Create")).not.toBeNull();
  });

  it("renders optional rail, inspector, and drawer slots", async () => {
    await renderWidget(
      <WidgetV2Shell title="Knowledge V2">
        <WidgetV2PanelLayout
          bottomDrawer={
            <WidgetV2BottomDrawer label="Activity drawer">
              Activity summary
            </WidgetV2BottomDrawer>
          }
          leftRail={<WidgetV2LeftRail label="Catalog rail">Catalog</WidgetV2LeftRail>}
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
      regionByRoleAndName("complementary", "Review inspector")?.textContent,
    ).toContain("Selection details");
    expect(regionByRoleAndName("region", "Activity drawer")?.textContent).toContain(
      "Activity summary",
    );
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

function regionByRoleAndName(role: string, name: string): HTMLElement | null {
  return (
    Array.from(document.querySelectorAll<HTMLElement>(`[role='${role}']`)).find(
      (element) => element.getAttribute("aria-label") === name,
    ) ?? null
  );
}
