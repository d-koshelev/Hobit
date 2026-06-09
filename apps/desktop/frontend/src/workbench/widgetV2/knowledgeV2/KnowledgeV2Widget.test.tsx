import { act } from "react";
import type { ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  flush,
  renderWidget as renderSkillLibraryWidget,
} from "../../SkillLibraryWidget.test-helpers";
import { KnowledgeV2Widget } from "./KnowledgeV2Widget";

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

describe("KnowledgeV2Widget shell", () => {
  it("renders the experimental KnowledgeV2 shell placeholders", async () => {
    await render(<KnowledgeV2Widget />);

    expect(headingWithText("Knowledge Catalog v2")).not.toBeNull();
    expect(document.body.textContent).toContain("Experimental");
    expect(document.body.textContent).toContain("Frontend-only shell");
    expect(document.body.textContent).toContain("Legacy Knowledge / Skills unchanged");
    expect(
      regionByRoleAndName("toolbar", "Knowledge v2 search and action row"),
    ).not.toBeNull();
    expect(
      inputByLabel("Knowledge v2 search placeholder")?.disabled,
    ).toBe(true);
    expect(
      selectByLabel("Knowledge v2 item type filter placeholder")?.disabled,
    ).toBe(true);
    expect(
      regionByRoleAndName("region", "Knowledge v2 catalog list")?.textContent,
    ).toContain("Catalog list placeholder");
    expect(
      regionByRoleAndName("complementary", "Knowledge v2 preview details")
        ?.textContent,
    ).toContain("Preview/details placeholder");
    expect(buttonWithText("New")?.disabled).toBe(true);
    expect(buttonWithText("Import")?.disabled).toBe(true);
    expect(buttonWithText("Draft Review")?.disabled).toBe(true);
    expect(buttonWithText("Manage Skills")?.disabled).toBe(true);
  });

  it("does not call create or import placeholder callbacks on render", async () => {
    const onNew = vi.fn();
    const onImport = vi.fn();
    const onDraftReview = vi.fn();
    const onManageSkills = vi.fn();

    await render(
      <KnowledgeV2Widget
        onDraftReview={onDraftReview}
        onImport={onImport}
        onManageSkills={onManageSkills}
        onNew={onNew}
      />,
    );

    expect(onNew).not.toHaveBeenCalled();
    expect(onImport).not.toHaveBeenCalled();
    expect(onDraftReview).not.toHaveBeenCalled();
    expect(onManageSkills).not.toHaveBeenCalled();
  });

  it("keeps the existing Knowledge / Skills surface available separately", async () => {
    renderSkillLibraryWidget(
      {
        onGetSkill: vi.fn(),
        onListKnowledgeDocuments: vi.fn(async () => []),
        onListSkills: vi.fn(async () => []),
        title: "Knowledge / Skills",
      },
    );

    await flush();

    expect(document.body.textContent).toContain("Knowledge / Skills");
    expect(document.body.textContent).toContain("No catalog items yet.");
    expect(document.body.textContent).not.toContain("Knowledge Catalog v2");
    expect(document.body.textContent).not.toContain("Experimental");
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

function headingWithText(text: string): HTMLHeadingElement | null {
  return (
    Array.from(document.querySelectorAll<HTMLHeadingElement>("h1,h2,h3")).find(
      (heading) => heading.textContent === text,
    ) ?? null
  );
}

function buttonWithText(text: string): HTMLButtonElement | null {
  return (
    Array.from(document.querySelectorAll<HTMLButtonElement>("button")).find(
      (button) => button.textContent === text,
    ) ?? null
  );
}

function inputByLabel(label: string): HTMLInputElement | null {
  return (
    Array.from(document.querySelectorAll<HTMLInputElement>("input")).find(
      (input) => input.getAttribute("aria-label") === label,
    ) ?? null
  );
}

function selectByLabel(label: string): HTMLSelectElement | null {
  return (
    Array.from(document.querySelectorAll<HTMLSelectElement>("select")).find(
      (select) => select.getAttribute("aria-label") === label,
    ) ?? null
  );
}

function regionByRoleAndName(role: string, name: string): HTMLElement | null {
  return (
    Array.from(document.querySelectorAll<HTMLElement>(`[role='${role}']`)).find(
      (element) => element.getAttribute("aria-label") === name,
    ) ?? null
  );
}
