import { afterEach, describe, expect, it, vi } from "vitest";

import { KnowledgeV2Widget } from "./KnowledgeV2Widget";
import {
  cleanupKnowledgeV2WidgetTestDom,
  clickButton,
  documentFixture,
  render,
  rowByTitle,
  skillFixture,
} from "./KnowledgeV2Widget.test-helpers";

afterEach(() => {
  cleanupKnowledgeV2WidgetTestDom();
});

describe("KnowledgeV2 catalog row polish", () => {
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
