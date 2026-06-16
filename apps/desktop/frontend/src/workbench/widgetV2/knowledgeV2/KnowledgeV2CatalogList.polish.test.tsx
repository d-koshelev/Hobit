import { afterEach, describe, expect, it, vi } from "vitest";
import { act } from "react";

import { KnowledgeV2Widget } from "./KnowledgeV2Widget";
import {
  buttonWithText,
  cleanupKnowledgeV2WidgetTestDom,
  clickButton,
  clickButtonByLabel,
  dialogByName,
  documentFixture,
  flushKnowledgeV2WidgetTest,
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
  it("keeps a two-item catalog as a table without a permanent helper or preview rail", async () => {
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
    expect(regionByName("Knowledge preview details")).toBeNull();
    expect(regionByName("Knowledge preview")).toBeNull();
    await clickButton("Release guide");
    expect(regionByName("Knowledge preview")).not.toBeNull();
    expect(
      document.querySelector("[aria-label='Knowledge helper rail']"),
    ).toBeNull();
    expect(text()).not.toContain("Some catalog bridges are unavailable.");
    expect(text()).not.toContain("Catalog data unavailable.");
  });

  it("shows the small catalog helper for up to five catalog items", async () => {
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
        skills={[skillFixture({ skillId: "skill_1", title: "Review skill" })]}
      />,
    );

    const catalog = regionByName("Knowledge catalog items");
    expect(catalog?.getAttribute("role")).toBe("table");
    expect(catalog?.textContent).toContain("Release guide one");
    expect(catalog?.textContent).toContain("Release guide four");
    expect(catalog?.textContent).toContain("Review skill");
    expect(catalog?.textContent).toContain("5 items shown.");
    expect(regionByName("Knowledge preview details")).toBeNull();
    expect(regionByName("Knowledge preview")).toBeNull();
    await clickButton("Release guide one");
    expect(regionByName("Knowledge preview")).not.toBeNull();
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
          documentFixture({
            knowledgeDocumentId: "doc_5",
            title: "Release guide five",
          }),
          documentFixture({
            knowledgeDocumentId: "doc_6",
            title: "Release guide six",
          }),
        ]}
        skills={[]}
      />,
    );

    const catalog = regionByName("Knowledge catalog items");
    expect(catalog?.getAttribute("role")).toBe("table");
    expect(catalog?.textContent).toContain("Release guide one");
    expect(catalog?.textContent).toContain("Release guide six");
    expect(catalog?.textContent).not.toContain("items shown.");
    expect(regionByName("Knowledge preview details")).toBeNull();
    expect(regionByName("Knowledge preview")).toBeNull();
  });

  it("renders compact row type badges and one clean row action affordance", async () => {
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
    expect(actionCell?.textContent).toBe("More");
    expect(regionByName("Knowledge catalog items")?.textContent).toContain("More");
    expect(regionByName("Knowledge catalog items")?.textContent).not.toContain(
      "Actions",
    );
    expect(actionCell?.textContent).not.toContain("Use as context");
    expect(actionCell?.textContent).not.toContain("!");
    expect(actionCell?.textContent).not.toContain("2w");
  });

  it("opens a compact row action menu with discoverable item actions", async () => {
    await render(
      <KnowledgeV2Widget
        documents={[documentFixture()]}
        onAttachContextToCoordinator={vi.fn()}
        onDeleteKnowledgeDocument={vi.fn()}
        onUpdateKnowledgeDocument={vi.fn()}
        skills={[]}
      />,
    );

    await clickButtonByLabel("More actions for Release guide");

    const menu = regionByName("Action menu for Release guide");
    expect(menu?.getAttribute("role")).toBe("menu");
    expect(menu?.textContent).toContain("Open details");
    expect(menu?.textContent).toContain("Use as context");
    expect(menu?.textContent).toContain("Archive");
    expect(menu?.textContent).toContain("Delete");
  });

  it("opens item details from the row action menu", async () => {
    await render(
      <KnowledgeV2Widget
        documents={[documentFixture()]}
        onDeleteKnowledgeDocument={vi.fn()}
        onUpdateKnowledgeDocument={vi.fn()}
        skills={[]}
      />,
    );

    await clickButtonByLabel("More actions for Release guide");
    await clickButton("Open details");

    expect(regionByName("Knowledge preview")?.textContent).toContain(
      "Release guide",
    );
    expect(dialogByName("Release guide")).not.toBeNull();
    expect(rowByTitle("Release guide")?.getAttribute("aria-selected")).toBe(
      "true",
    );
  });

  it("keeps delete behind confirmation and only calls the bridge after confirm", async () => {
    const onDeleteKnowledgeDocument = vi.fn(async () => true);

    await render(
      <KnowledgeV2Widget
        documents={[documentFixture()]}
        onDeleteKnowledgeDocument={onDeleteKnowledgeDocument}
        onUpdateKnowledgeDocument={vi.fn()}
        skills={[]}
      />,
    );

    await clickButtonByLabel("More actions for Release guide");
    await clickButton("Delete");

    expect(regionByName("Knowledge delete confirmation")?.textContent).toContain(
      'Delete "Release guide"?',
    );
    expect(onDeleteKnowledgeDocument).not.toHaveBeenCalled();

    await clickButton("Cancel");
    expect(regionByName("Knowledge delete confirmation")).toBeNull();
    expect(onDeleteKnowledgeDocument).not.toHaveBeenCalled();

    await clickButtonByLabel("More actions for Release guide");
    await clickButton("Delete");
    await clickButton("Delete");
    await flushKnowledgeV2WidgetTest();

    expect(onDeleteKnowledgeDocument).toHaveBeenCalledTimes(1);
    expect(onDeleteKnowledgeDocument).toHaveBeenCalledWith({
      knowledgeDocumentId: "kdoc_1",
    });
  });

  it("shows missing delete bridge as a disabled action with a reason", async () => {
    await render(
      <KnowledgeV2Widget
        documents={[documentFixture()]}
        onUpdateKnowledgeDocument={vi.fn()}
        skills={[]}
      />,
    );

    await clickButtonByLabel("More actions for Release guide");

    const menu = regionByName("Action menu for Release guide");
    const deleteButton =
      Array.from(menu?.querySelectorAll<HTMLButtonElement>("button") ?? []).find(
        (button) => button.textContent === "Delete",
      ) ?? null;
    expect(deleteButton?.disabled).toBe(true);
    expect(menu?.textContent).toContain(
      "Knowledge did not receive the existing Knowledge Document delete action.",
    );
  });

  it("shows unavailable context use as a disabled menu action with a reason", async () => {
    await render(
      <KnowledgeV2Widget
        documents={[
          documentFixture({
            enabled: false,
            knowledgeDocumentId: "disabled_doc",
            title: "Disabled note",
          }),
        ]}
        onDeleteKnowledgeDocument={vi.fn()}
        onUpdateKnowledgeDocument={vi.fn()}
        skills={[]}
      />,
    );

    await clickButtonByLabel("More actions for Disabled note");

    const menu = regionByName("Action menu for Disabled note");
    const useButton =
      Array.from(menu?.querySelectorAll<HTMLButtonElement>("button") ?? []).find(
        (button) => button.textContent === "Use as context",
      ) ?? null;
    expect(useButton?.disabled).toBe(true);
    expect(menu?.textContent).toContain("Knowledge Document is disabled.");
  });

  it("does not call item action callbacks on render or row details open", async () => {
    const onAttachContextToCoordinator = vi.fn();
    const onDeleteKnowledgeDocument = vi.fn();
    const onUpdateKnowledgeDocument = vi.fn();

    await render(
      <KnowledgeV2Widget
        documents={[documentFixture()]}
        onAttachContextToCoordinator={onAttachContextToCoordinator}
        onDeleteKnowledgeDocument={onDeleteKnowledgeDocument}
        onUpdateKnowledgeDocument={onUpdateKnowledgeDocument}
        skills={[]}
      />,
    );

    expect(onAttachContextToCoordinator).not.toHaveBeenCalled();
    expect(onDeleteKnowledgeDocument).not.toHaveBeenCalled();
    expect(onUpdateKnowledgeDocument).not.toHaveBeenCalled();

    await act(async () => {
      rowByTitle("Release guide")?.dispatchEvent(
        new MouseEvent("click", { bubbles: true }),
      );
    });
    await flushKnowledgeV2WidgetTest();

    expect(regionByName("Knowledge preview")).not.toBeNull();
    expect(onAttachContextToCoordinator).not.toHaveBeenCalled();
    expect(onDeleteKnowledgeDocument).not.toHaveBeenCalled();
    expect(onUpdateKnowledgeDocument).not.toHaveBeenCalled();
    expect(buttonWithText("More")).not.toBeNull();
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
