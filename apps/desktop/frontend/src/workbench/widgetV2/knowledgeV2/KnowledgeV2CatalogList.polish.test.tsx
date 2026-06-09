import { afterEach, describe, expect, it, vi } from "vitest";

import { KnowledgeV2Widget } from "./KnowledgeV2Widget";
import {
  cleanupKnowledgeV2WidgetTestDom,
  clickButton,
  documentFixture,
  regionByName,
  render,
  rowByTitle,
  skillFixture,
  text,
} from "./KnowledgeV2Widget.test-helpers";

afterEach(() => {
  cleanupKnowledgeV2WidgetTestDom();
});

describe("KnowledgeV2 catalog row polish", () => {
  it("keeps a two-item catalog as table plus preview without a helper rail", async () => {
    await render(
      <KnowledgeV2Widget
        documents={[documentFixture()]}
        skills={[skillFixture({ reviewStatus: "reviewed" })]}
      />,
    );

    const catalog = regionByName("Knowledge catalog items");
    expect(catalog?.getAttribute("role")).toBe("table");
    expect(catalog?.textContent).toContain("Title");
    expect(catalog?.textContent).toContain("Release guide");
    expect(catalog?.textContent).toContain("React review");
    expect(catalog?.textContent).toContain("2 items shown.");
    expect(regionByName("Knowledge v2 preview details")).not.toBeNull();
    await clickButton("Release guide");
    expect(regionByName("Knowledge preview")).not.toBeNull();
    expect(
      document.querySelector("[aria-label='KnowledgeV2 helper rail']"),
    ).toBeNull();
    expect(text()).not.toContain("Some catalog bridges are unavailable.");
    expect(text()).not.toContain("Catalog data unavailable.");
  });

  it("does not show the small catalog helper for normal larger lists", async () => {
    await render(
      <KnowledgeV2Widget
        documents={[
          documentFixture({
            knowledgeDocumentId: "doc_1",
            title: "Release guide one",
          }),
          documentFixture({
            knowledgeDocumentId: "doc_2",
            title: "Release guide two",
          }),
          documentFixture({
            knowledgeDocumentId: "doc_3",
            title: "Release guide three",
          }),
          documentFixture({
            knowledgeDocumentId: "doc_4",
            title: "Release guide four",
          }),
        ]}
        skills={[]}
      />,
    );

    const catalog = regionByName("Knowledge catalog items");
    expect(catalog?.getAttribute("role")).toBe("table");
    expect(catalog?.textContent).toContain("Release guide one");
    expect(catalog?.textContent).toContain("Release guide four");
    expect(catalog?.textContent).not.toContain("items shown.");
    expect(regionByName("Knowledge v2 preview details")).not.toBeNull();
    await clickButton("Release guide one");
    expect(regionByName("Knowledge preview")).not.toBeNull();
  });

  it("renders compact row type badges and action labels", async () => {
    await render(
      <KnowledgeV2Widget
        documents={[
          documentFixture({
            catalogItemType: "runbook",
            content: "Large ".repeat(2_500),
            knowledgeDocumentId: "runbook_doc",
            title: "Release runbook",
          }),
          documentFixture({
            knowledgeDocumentId: "doc_item",
            title: "Release document",
          }),
        ]}
        onAttachContextToCoordinator={vi.fn()}
        skills={[skillFixture({ reviewStatus: "reviewed" })]}
      />,
    );

    expect(rowByTitle("Release document")?.textContent).toContain("DOC");
    expect(rowByTitle("React review")?.textContent).toContain("SKILL");
    expect(rowByTitle("Release runbook")?.textContent).toContain("RUNBOOK");

    const actionCell = rowByTitle("Release runbook")?.querySelector(
      ".knowledge-v2-row-actions",
    );
    expect(actionCell?.textContent).toBe("...Use!");
    expect(actionCell?.textContent).not.toContain("Use as context");
    expect(actionCell?.textContent).not.toContain("2w");
    expect(
      actionCell?.querySelector<HTMLButtonElement>(".knowledge-v2-row-use-button")
        ?.textContent,
    ).toBe("Use");
  });

  it("renders empty row tags as a muted product placeholder", async () => {
    await render(
      <KnowledgeV2Widget
        documents={[
          documentFixture({
            tags: "",
          }),
        ]}
        skills={[]}
      />,
    );

    const row = rowByTitle("Release guide");
    expect(row?.textContent).toContain("No tags");
    expect(row?.textContent).not.toContain("None");
    expect(row?.querySelector(".knowledge-v2-muted")?.textContent).toBe(
      "No tags",
    );
  });

  it("renders missing and unknown row dates with muted treatment", async () => {
    await render(
      <KnowledgeV2Widget
        documents={[
          documentFixture({
            updatedAt: "",
          }),
        ]}
        skills={[]}
      />,
    );

    const row = rowByTitle("Release guide");
    const mutedDate = Array.from(
      row?.querySelectorAll<HTMLElement>(".knowledge-v2-muted") ?? [],
    ).find((element) => element.textContent === "Unknown");
    expect(mutedDate?.getAttribute("data-muted")).toBe("true");
  });

  it("keeps long titles in the truncating title control", async () => {
    const longTitle =
      "Release readiness operating note with an intentionally long catalog title for normal widget width";

    await render(
      <KnowledgeV2Widget
        documents={[
          documentFixture({
            quickSummary: "Short usable summary for the long-title row.",
            title: longTitle,
          }),
        ]}
        skills={[]}
      />,
    );

    const row = rowByTitle(longTitle);
    const titleButton = row?.querySelector<HTMLButtonElement>(
      ".knowledge-v2-row-title",
    );
    expect(titleButton?.getAttribute("aria-label")).toContain(longTitle);
    expect(titleButton?.getAttribute("title")).toContain(longTitle);
    expect(titleButton?.className).toContain("knowledge-v2-row-title");
    expect(
      row?.querySelector(".knowledge-v2-row-title span")?.getAttribute("title"),
    ).toBe(longTitle);
  });

  it("keeps the selected row accessible and visibly marked", async () => {
    await render(
      <KnowledgeV2Widget
        documents={[documentFixture()]}
        skills={[skillFixture({ reviewStatus: "reviewed" })]}
      />,
    );

    await clickButton("React review");

    const selectedRow = rowByTitle("React review");
    expect(selectedRow?.getAttribute("aria-selected")).toBe("true");
    expect(selectedRow?.getAttribute("data-selected")).toBe("true");
    expect(rowByTitle("Release guide")?.getAttribute("aria-selected")).toBe(
      "false",
    );
  });
});
