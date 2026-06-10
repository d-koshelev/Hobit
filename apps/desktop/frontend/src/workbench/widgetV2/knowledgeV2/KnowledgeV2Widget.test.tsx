import type { ComponentProps } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  flush,
  renderWidget as renderSkillLibraryWidget,
} from "../../SkillLibraryWidget.test-helpers";
import { KnowledgeV2Widget } from "./KnowledgeV2Widget";
import {
  changeInput,
  changeSelect,
  chooseRadioByLabel,
  cleanupKnowledgeV2WidgetTestDom,
  clickButtonByLabel,
  buttonWithText,
  clickButton,
  clickButtonInRegion,
  clickCheckboxByLabel,
  dialogByName,
  documentFixture,
  draftReviewFixture,
  headingWithText,
  inputByLabel,
  keyDown,
  regionByName,
  render,
  rowByTitle,
  selectByLabel,
  skillFixture,
  text,
} from "./KnowledgeV2Widget.test-helpers";

afterEach(() => {
  cleanupKnowledgeV2WidgetTestDom();
});

describe("KnowledgeV2Widget browser", () => {
  it("renders documents and skills together", async () => {
    await render(
      <KnowledgeV2Widget
        documents={[
          documentFixture(),
          documentFixture({
            knowledgeDocumentId: "global_doc",
            scope: "global",
            title: "Global API guide",
          }),
          documentFixture({
            catalogItemType: "runbook",
            knowledgeDocumentId: "runbook_doc",
            title: "Release runbook",
          }),
        ]}
        skills={[skillFixture({ reviewStatus: "reviewed" })]}
      />,
    );

    expect(headingWithText("Knowledge Catalog v2")).not.toBeNull();
    expect(regionByName("Knowledge catalog items")?.getAttribute("role")).toBe(
      "table",
    );
    expect(regionByName("Knowledge v2 preview details")).toBeNull();
    expect(regionByName("Knowledge preview")).toBeNull();
    expect(text()).toContain("Title");
    expect(text()).toContain("Type");
    expect(text()).toContain("Status");
    expect(text()).toContain("Scope");
    expect(text()).toContain("Tags");
    expect(text()).toContain("Updated");
    expect(text()).toContain("More");
    expect(text()).toContain("Release guide");
    expect(text()).toContain("Global API guide");
    expect(text()).toContain("Release runbook");
    expect(text()).toContain("React review");
    expect(text()).toContain("Document");
    expect(text()).toContain("Runbook");
    expect(text()).toContain("Skill");
    expect(text()).toContain("4 / 4");
  });

  it("loads documents and skills from existing Knowledge / Skills list actions", async () => {
    const onListKnowledgeDocuments = vi.fn(async () => [documentFixture()]);
    const onListSkills = vi.fn(async () => [
      skillFixture({ reviewStatus: "reviewed" }),
    ]);

    await render(
      <KnowledgeV2Widget
        draftReviews={[draftReviewFixture()]}
        onListKnowledgeDocuments={onListKnowledgeDocuments}
        onListSkills={onListSkills}
      />,
    );
    await flush();

    expect(onListKnowledgeDocuments).toHaveBeenCalledTimes(1);
    expect(onListSkills).toHaveBeenCalledTimes(1);
    expect(text()).toContain("Release guide");
    expect(text()).toContain("React review");
    expect(text()).toContain("2 / 2");
    expect(text()).not.toContain("Catalog data unavailable.");
  });

  it("shows an honest unavailable state when the experimental path has no data bridge", async () => {
    await render(<KnowledgeV2Widget />);

    expect(text()).toContain("Data unavailable");
    expect(text()).toContain("Catalog data unavailable.");
    expect(text()).toContain("No production data is being faked.");
    expect(text()).toContain("Knowledge Documents list bridge");
    expect(text()).toContain("Skills list bridge");
    expect(text()).toContain("No catalog items yet.");
    expect(buttonWithText("Retry")).not.toBeNull();
  });

  it("replaces the normal partial bridge banner with compact data-source details", async () => {
    await render(
      <KnowledgeV2Widget
        documents={[documentFixture()]}
        onDraftReview={vi.fn()}
        onListKnowledgeDraftReviews={async () => []}
        skills={undefined}
      />,
    );

    expect(text()).toContain("Data sources: partial");
    expect(text()).not.toContain("Some catalog bridges are unavailable.");
    expect(
      document.querySelector("[aria-label='KnowledgeV2 data bridge status']"),
    ).toBeNull();
    expect(text()).not.toContain(
      "the current list action requires a selected draft pack",
    );

    await clickButtonByLabel("KnowledgeV2 information");
    const details = dialogByName("KnowledgeV2");
    expect(details?.textContent).toContain("Documents");
    expect(details?.textContent).toContain("1 loaded");
    expect(details?.textContent).toContain("Skills");
    expect(details?.textContent).toContain("Unavailable");
    expect(details?.textContent).toContain("Drafts");
    expect(details?.textContent).toContain("Partial");
    expect(details?.textContent).toContain("Skills list bridge");
    expect(details?.textContent).toContain("Draft Review bridge details stay local");

    await keyDown("Escape");
    await clickButton("Draft Review");
    const draftReview = dialogByName("Draft Review");
    expect(draftReview?.textContent).toContain(
      "Some bridge details unavailable.",
    );
    expect(draftReview?.textContent).not.toContain(
      "Draft Review is partial because the available list action requires a selected draft pack.",
    );
    expect(draftReview?.textContent).toContain(
      "Draft review item bridge is partial: the current list action requires a selected draft pack",
    );
  });

  it("shows service unavailable actions when bridge loading fails", async () => {
    const onImport = vi.fn();
    const onListKnowledgeDocuments = vi.fn(async () => {
      throw new Error("documents offline");
    });
    const onListSkills = vi.fn(async () => [skillFixture()]);

    await render(
      <KnowledgeV2Widget
        onImport={onImport}
        onListKnowledgeDocuments={onListKnowledgeDocuments}
        onListSkills={onListSkills}
      />,
    );
    await flush();

    expect(text()).toContain("Data sources: partial");
    expect(text()).not.toContain("Some catalog bridges are unavailable.");
    expect(text()).not.toContain("Load failed: documents: documents offline");
    expect(text()).toContain("React review");

    await clickButtonByLabel("KnowledgeV2 information");
    expect(dialogByName("KnowledgeV2")?.textContent).toContain(
      "documents: documents offline",
    );
    expect(buttonWithText("Retry data bridge")).not.toBeNull();
    await clickButton("Retry data bridge");
    await flush();
    expect(onListKnowledgeDocuments).toHaveBeenCalledTimes(2);
    expect(onImport).not.toHaveBeenCalled();
  });

  it("keeps draft items out of the default list until the draft filter is selected", async () => {
    await render(
      <KnowledgeV2Widget
        documents={[
          documentFixture(),
          documentFixture({
            knowledgeDocumentId: "draft_doc",
            lifecycleStatus: "draft",
            quickSummary: "Generated draft summary.",
            title: "Generated architecture draft",
          }),
        ]}
        skills={[
          skillFixture({ reviewStatus: "reviewed" }),
          skillFixture({
            reviewStatus: "draft",
            skillId: "draft_skill",
            whenToUse: "Use when reviewing generated Skill candidates.",
            title: "Draft Skill candidate",
          }),
        ]}
      />,
    );

    expect(text()).toContain("Release guide");
    expect(text()).toContain("React review");
    expect(text()).not.toContain("Generated architecture draft");
    expect(text()).not.toContain("Draft Skill candidate");
    expect(text()).toContain("2 / 4");

    await changeSelect("Filter Knowledge catalog by status", "draft");

    expect(text()).not.toContain("Release guide");
    expect(text()).not.toContain("React review");
    expect(text()).toContain("Generated architecture draft");
    expect(text()).toContain("Draft Skill candidate");
    expect(text()).toContain("2 / 4");
  });

  it("changes visible items when filters change", async () => {
    await render(
      <KnowledgeV2Widget
        documents={[documentFixture()]}
        skills={[skillFixture({ reviewStatus: "reviewed" })]}
      />,
    );

    expect(inputByLabel("Search Knowledge catalog")).not.toBeNull();
    expect(selectByLabel("Filter Knowledge catalog by type")).not.toBeNull();
    expect(selectByLabel("Filter Knowledge catalog by status")).not.toBeNull();
    expect(selectByLabel("Filter Knowledge catalog by scope")).not.toBeNull();
    expect(inputByLabel("Filter Knowledge catalog by tag")).not.toBeNull();
    expect(selectByLabel("Sort Knowledge catalog")).not.toBeNull();
    expect(text()).toContain("More filters");

    await changeSelect("Filter Knowledge catalog by type", "skill");

    expect(text()).not.toContain("Release guide");
    expect(text()).toContain("React review");
    expect(text()).toContain("1 / 2");

    await changeInput("Search Knowledge catalog", "missing item");

    expect(text()).not.toContain("React review");
    expect(text()).toContain("No search results.");
    expect(buttonWithText("Clear filters")).not.toBeNull();
    expect(text()).toContain("0 / 2");

    await clickButton("Clear filters");
    expect(text()).toContain("Release guide");
    expect(text()).toContain("React review");
    expect(text()).toContain("2 / 2");
  });

  it("toggles between default dense list and optional cards view", async () => {
    await render(
      <KnowledgeV2Widget
        documents={[documentFixture()]}
        skills={[skillFixture()]}
      />,
    );

    expect(regionByName("Knowledge catalog items")?.getAttribute("role")).toBe(
      "table",
    );
    expect(buttonWithText("List")?.getAttribute("aria-pressed")).toBe("true");
    expect(buttonWithText("Cards")?.getAttribute("aria-pressed")).toBe("false");

    await clickButton("Cards");

    expect(regionByName("Knowledge catalog items")?.getAttribute("role")).toBe(
      "list",
    );
    expect(buttonWithText("List")?.getAttribute("aria-pressed")).toBe("false");
    expect(buttonWithText("Cards")?.getAttribute("aria-pressed")).toBe("true");
  });

  it("updates the preview when an item is selected", async () => {
    await render(
      <KnowledgeV2Widget
        documents={[
          documentFixture({
            content: "Desktop release body preview with validation notes.",
            quickSummary: "Release checklist for desktop builds.",
            sourceRefs: [
              {
                kind: "docs_path",
                label: "Release notes",
                path: "docs/release.md",
              },
            ],
          }),
        ]}
        skills={[skillFixture()]}
      />,
    );

    await clickButton("Release guide");

    const preview = regionByName("Knowledge preview");
    expect(rowByTitle("Release guide")?.getAttribute("data-selected")).toBe(
      "true",
    );
    expect(
      document.querySelector<HTMLElement>(".popup-shell-title")?.textContent,
    ).toBe("Release guide");
    expect(preview?.textContent).toContain(
      "Release checklist for desktop builds.",
    );
    expect(preview?.textContent).not.toContain("Release docs");
    expect(preview?.textContent).toContain("Context: Usable");
    expect(preview?.textContent).not.toContain("Open source details");
    expect(dialogByName("Release guide")).not.toBeNull();

    await clickButtonInRegion("Knowledge preview", "Details");

    const detailsPreview = regionByName("Knowledge preview");
    expect(detailsPreview?.textContent).toContain("Release docs");
    expect(detailsPreview?.textContent).toContain("Attachments and source refs");
    expect(detailsPreview?.textContent).toContain("docs/release.md");

    await clickButton("React review");

    const updatedPreview = regionByName("Knowledge preview");
    expect(rowByTitle("React review")?.getAttribute("data-selected")).toBe(
      "true",
    );
    expect(
      document.querySelector<HTMLElement>(".popup-shell-title")?.textContent,
    ).toBe("React review");
    expect(updatedPreview?.textContent).toContain("Use when reviewing React changes.");
    expect(updatedPreview?.textContent).not.toContain("Workspace Skill");
  });

  it("renders Overview summary, tags, and context state", async () => {
    await render(
      <KnowledgeV2Widget
        documents={[
          documentFixture({
            quickSummary: "Release context summary.",
            tags: "release,validation",
          }),
        ]}
        onAttachContextToCoordinator={vi.fn()}
        skills={[]}
      />,
    );

    await clickButton("Release guide");

    const preview = regionByName("Knowledge preview");
    expect(preview?.textContent).toContain("Overview");
    expect(preview?.textContent).toContain("Summary");
    expect(preview?.textContent).toContain("Release context summary.");
    expect(preview?.textContent).toContain("What it does");
    expect(preview?.textContent).toContain("Use cases");
    expect(preview?.textContent).toContain("release");
    expect(preview?.textContent).toContain("validation");
    expect(preview?.textContent).toContain("Context: Usable");
    expect(preview?.textContent).not.toContain("Open source details");
  });

  it("renders Details source, scope, and attachments when present", async () => {
    await render(
      <KnowledgeV2Widget
        documents={[
          documentFixture({
            createdByTaskId: "queue_task_1",
            createdFromRunId: "run_1",
            sourceRefs: [
              {
                kind: "docs_path",
                label: "Release notes",
                path: "docs/release.md",
              },
              {
                kind: "queue_run",
                label: "Draft run",
                runId: "run_1",
              },
            ],
          }),
        ]}
        skills={[]}
      />,
    );

    await clickButton("Release guide");
    await clickButtonInRegion("Knowledge preview", "Details");

    const preview = regionByName("Knowledge preview");
    expect(preview?.textContent).toContain("Source");
    expect(preview?.textContent).toContain("Release docs");
    expect(preview?.textContent).toContain("Docs Path");
    expect(preview?.textContent).toContain("Workspace");
    expect(preview?.textContent).toContain("2 source refs supplied.");
    expect(preview?.textContent).toContain("Release notes");
    expect(preview?.textContent).toContain("docs/release.md");
    expect(preview?.textContent).toContain("Created by task");
    expect(preview?.textContent).toContain("Queue Task 1");
    expect(preview?.textContent).toContain("Created from run");
    expect(preview?.textContent).toContain("Run 1");
    await clickButtonInRegion("Knowledge preview", "Source");
    expect(regionByName("Knowledge preview")?.textContent).toContain(
      "Reference text",
    );
    expect(regionByName("Knowledge preview")?.textContent).toContain(
      "Open source details",
    );
  });

  it("renders unavailable Versions and Usage states without inventing history", async () => {
    await render(
      <KnowledgeV2Widget
        documents={[
          documentFixture({
            version: 3,
            versionSummary: "Current summary only.",
          }),
        ]}
        skills={[]}
      />,
    );

    await clickButton("Release guide");
    await clickButton("Versions");

    const versions = regionByName("Knowledge preview");
    expect(versions?.textContent).toContain("Current version");
    expect(versions?.textContent).toContain("v3");
    expect(versions?.textContent).toContain("Current summary only.");
    expect(versions?.textContent).toContain("Version history unavailable");
    expect(versions?.textContent).toContain(
      "Full version history is not wired",
    );
    expect(versions?.textContent).not.toContain("Previous version");

    await clickButton("Usage");

    const usage = regionByName("Knowledge preview");
    expect(usage?.textContent).toContain("Usage tracking unavailable");
    expect(usage?.textContent).toContain(
      "No Workspace Agent, Queue, run, prompt, or widget usage data is being invented",
    );
    expect(usage?.textContent).not.toContain("Used by Workspace Agent");
    expect(usage?.textContent).not.toContain("Used by Queue");
  });

  it("shows warning details for disabled and rejected items", async () => {
    await render(
      <KnowledgeV2Widget
        documents={[
          documentFixture({
            enabled: false,
            knowledgeDocumentId: "disabled",
            lifecycleStatus: "rejected",
            searchable: false,
            title: "Rejected safety note",
          }),
        ]}
        skills={[]}
      />,
    );

    await clickButton("Rejected safety note");

    const preview = regionByName("Knowledge preview");
    expect(
      document.querySelector<HTMLElement>(".popup-shell-title")?.textContent,
    ).toBe("Rejected safety note");
    expect(preview?.textContent).toContain("Rejected");
    expect(preview?.textContent).toContain("Unavailable");
    expect(preview?.textContent).toContain("3 warnings");
    expect(preview?.textContent).not.toContain("Document is marked not searchable.");

    await clickButtonInRegion("Knowledge preview", "Details");
    await clickButton("Show details");

    expect(regionByName("Knowledge preview")?.textContent).toContain(
      "Document is disabled.",
    );
    expect(regionByName("Knowledge preview")?.textContent).toContain(
      "Document is marked not searchable.",
    );
    expect(preview?.textContent).toContain(
      "Rejected document is unavailable for normal catalog use.",
    );
  });

  it("renders all KnowledgeV2 lifecycle badges compactly", async () => {
    await render(
      <KnowledgeV2Widget
        documents={[
          documentFixture({
            knowledgeDocumentId: "published",
            lifecycleStatus: "active",
            title: "Published document",
          }),
          documentFixture({
            knowledgeDocumentId: "draft",
            lifecycleStatus: "draft",
            title: "Draft document",
          }),
          documentFixture({
            knowledgeDocumentId: "archived",
            lifecycleStatus: "archived",
            title: "Archived document",
          }),
          documentFixture({
            knowledgeDocumentId: "rejected",
            lifecycleStatus: "rejected",
            title: "Rejected document",
          }),
          documentFixture({
            knowledgeDocumentId: "stale",
            lifecycleStatus: "stale",
            title: "Stale document",
          }),
          documentFixture({
            content: "Large ".repeat(2_200),
            knowledgeDocumentId: "large",
            lifecycleStatus: "active",
            title: "Large document",
          }),
          documentFixture({
            enabled: false,
            knowledgeDocumentId: "unavailable",
            lifecycleStatus: "active",
            searchable: false,
            title: "Unavailable document",
          }),
        ]}
        skills={[]}
      />,
    );

    const catalog = regionByName("Knowledge catalog items");
    for (const label of [
      "Published",
      "Archived",
      "Rejected",
      "Stale",
      "Large",
      "Unavailable",
    ]) {
      expect(catalog?.textContent).toContain(label);
    }

    await clickButton("Published document");
    expect(
      document.querySelector<HTMLElement>(
        ".knowledge-v2-details-header-badges",
      )?.textContent,
    ).toContain("Published");
    await changeSelect("Filter Knowledge catalog by status", "draft");
    expect(regionByName("Knowledge catalog items")?.textContent).toContain("Draft");
    await clickButton("Draft document");
    expect(
      document.querySelector<HTMLElement>(
        ".knowledge-v2-details-header-badges",
      )?.textContent,
    ).toContain("Draft");
    await changeSelect("Filter Knowledge catalog by status", "all");
    await clickButton("Archived document");
    expect(
      document.querySelector<HTMLElement>(
        ".knowledge-v2-details-header-badges",
      )?.textContent,
    ).toContain("Archived");
    await clickButton("Rejected document");
    expect(
      document.querySelector<HTMLElement>(
        ".knowledge-v2-details-header-badges",
      )?.textContent,
    ).toContain("Rejected");
    await clickButton("Stale document");
    expect(regionByName("Knowledge preview")?.textContent).toContain(
      "Context: Stale",
    );
    await clickButton("Large document");
    expect(regionByName("Knowledge preview")?.textContent).toContain(
      "Context: Large",
    );
    expect(regionByName("Knowledge preview")?.textContent).toContain("1 warning: Large");
    await clickButton("Unavailable document");
    expect(regionByName("Knowledge preview")?.textContent).toContain(
      "Context: Unavailable",
    );
    expect(regionByName("Knowledge preview")?.textContent).toContain("2 warnings");
  });

  it("renders stale and large context warnings while keeping attach explicit", async () => {
    await render(
      <KnowledgeV2Widget
        documents={[
          documentFixture({
            knowledgeDocumentId: "stale",
            lifecycleStatus: "stale",
            title: "Stale attach item",
          }),
          documentFixture({
            content: "Large ".repeat(2_200),
            knowledgeDocumentId: "large",
            title: "Large attach item",
          }),
        ]}
        onAttachContextToCoordinator={vi.fn()}
        skills={[]}
      />,
    );

    await clickButton("Stale attach item");
    expect(buttonWithText("Use as context")?.disabled).toBe(false);

    await clickButton("Large attach item");
    expect(regionByName("Knowledge preview")?.textContent).toContain("Large");
    expect(buttonWithText("Use as context")?.disabled).toBe(false);
  });

  it("renders explicit action buttons without showing action forms by default", async () => {
    const onNew = vi.fn();
    const onImport = vi.fn();
    const onDraftReview = vi.fn();
    const onManageSkills = vi.fn();

    await render(
      <KnowledgeV2Widget
        documents={[documentFixture()]}
        onDraftReview={onDraftReview}
        onImport={onImport}
        onManageSkills={onManageSkills}
        onNew={onNew}
        skills={[skillFixture()]}
      />,
    );

    expect(text()).not.toContain("Catalog list placeholder");
    expect(text()).not.toContain("Preview/details placeholder");
    expect(buttonWithText("New")).not.toBeNull();
    expect(buttonWithText("List")).not.toBeNull();
    expect(buttonWithText("Cards")).not.toBeNull();
    expect(buttonWithText("Import")).not.toBeNull();
    expect(buttonWithText("Draft Review")).not.toBeNull();
    expect(buttonWithText("Manage Skills")).not.toBeNull();
    expect(buttonWithText("Help")).not.toBeNull();
    expect(
      document.querySelector("[aria-label='KnowledgeV2 helper rail']"),
    ).toBeNull();
    expect(
      document.querySelector("[aria-label='KnowledgeV2 legend rail']"),
    ).toBeNull();
    expect(
      document.querySelector("[aria-label='KnowledgeV2 tips rail']"),
    ).toBeNull();
    expect(text()).not.toContain("draft payload");
    expect(text()).not.toContain("Raw draft contents");
    expect(text()).not.toContain("Choose or drop a text/Markdown file");
    expect(text()).not.toContain("Open existing import flow");
    expect(text()).not.toContain("New document");
    expect(text()).not.toContain("Open existing create flow");
    expect(text()).not.toContain("Normal context candidate");
    expect(
      regionByName("Knowledge catalog items")?.textContent ?? "",
    ).not.toContain("Import");
    expect(
      regionByName("Knowledge preview")?.textContent ?? "",
    ).not.toContain("Draft Review");
    expect(inputByLabel("Search Knowledge catalog")?.disabled).toBe(false);
    expect(onNew).not.toHaveBeenCalled();
    expect(onImport).not.toHaveBeenCalled();
    expect(onDraftReview).not.toHaveBeenCalled();
    expect(onManageSkills).not.toHaveBeenCalled();
  });

  it("does not call create or import callbacks while loading catalog data", async () => {
    const onNew = vi.fn();
    const onImport = vi.fn();
    const onListKnowledgeDocuments = vi.fn(async () => [documentFixture()]);
    const onListSkills = vi.fn(async () => [skillFixture()]);

    await render(
      <KnowledgeV2Widget
        onImport={onImport}
        onListKnowledgeDocuments={onListKnowledgeDocuments}
        onListSkills={onListSkills}
        onNew={onNew}
      />,
    );
    await flush();

    expect(onListKnowledgeDocuments).toHaveBeenCalledTimes(1);
    expect(onListSkills).toHaveBeenCalledTimes(1);
    expect(onNew).not.toHaveBeenCalled();
    expect(onImport).not.toHaveBeenCalled();
  });

  it("opens and closes KnowledgeV2 action popups while keeping the catalog stable", async () => {
    await render(
      <KnowledgeV2Widget
        documents={[documentFixture()]}
        skills={[skillFixture()]}
      />,
    );

    const catalogBefore = regionByName("Knowledge catalog items");
    expect(catalogBefore?.textContent).toContain("Release guide");

    await clickButton("Import");
    expect(dialogByName("Import")?.textContent).toContain(
      "Choose or drop a text/Markdown file",
    );
    expect(dialogByName("Import")?.textContent).toContain("Safety details");
    expect(dialogByName("Import")?.textContent).not.toContain(
      "KnowledgeV2 has no direct file picker or raw path input in this popup yet.",
    );
    const importPopup = dialogByName("Import");
    expect(importPopup?.classList.contains("popup-shell-with-layout")).toBe(true);
    expect(importPopup?.querySelector("[data-popup-body]")?.textContent).toContain(
      "Choose or drop a text/Markdown file",
    );
    expect(
      importPopup?.querySelector("[data-popup-body]")?.textContent,
    ).not.toContain("Open existing import flow");
    expect(importPopup?.querySelector(".popup-shell-footer")?.textContent).toContain(
      "Open existing import flow",
    );
    expect(text()).not.toContain("Choose Knowledge import file");
    expect(regionByName("Knowledge catalog items")?.textContent).toContain(
      "Release guide",
    );

    await clickButton("Close");
    expect(dialogByName("Import")).toBeNull();

    await clickButton("Draft Review");
    expect(dialogByName("Draft Review")?.textContent).toContain(
      "Draft documents",
    );

    await keyDown("Escape");
    expect(dialogByName("Draft Review")).toBeNull();

    await clickButton("Help");
    expect(dialogByName("Help / Legend")?.textContent).toContain(
      "Ready and usable",
    );

    await clickButton("Close");
    expect(dialogByName("Help / Legend")).toBeNull();
  });

  it("opens the correct explicit action popup without callbacks on open", async () => {
    const onNew = vi.fn();
    const onImport = vi.fn();
    const onDraftReview = vi.fn();
    const onManageSkills = vi.fn();

    await render(
      <KnowledgeV2Widget
        documents={[documentFixture()]}
        onDraftReview={onDraftReview}
        onImport={onImport}
        onManageSkills={onManageSkills}
        onNew={onNew}
        skills={[skillFixture()]}
      />,
    );

    await clickButton("New");
    expect(dialogByName("New")?.textContent).toContain("New document");
    expect(dialogByName("New")?.textContent).toContain("New skill");
    expect(dialogByName("New")?.textContent).toContain("New runbook/procedure");
    expect(onNew).not.toHaveBeenCalled();
    await keyDown("Escape");

    await clickButton("Import");
    expect(dialogByName("Import")?.textContent).toContain("Raw path fallback");
    expect(dialogByName("Import")?.textContent).toContain("Partial");
    expect(onImport).not.toHaveBeenCalled();
    await keyDown("Escape");

    await clickButton("Draft Review");
    expect(dialogByName("Draft Review")?.textContent).toContain("Review decisions");
    expect(onDraftReview).not.toHaveBeenCalled();
    await keyDown("Escape");

    await clickButton("Manage Skills");
    expect(dialogByName("Manage Skills")?.textContent).toContain("Categories");
    expect(dialogByName("Manage Skills")?.textContent).toContain("Templates");
    expect(dialogByName("Manage Skills")?.textContent).toContain("Validation");
    expect(onManageSkills).not.toHaveBeenCalled();
    await keyDown("Escape");

    await clickButton("Help");
    expect(dialogByName("Help / Legend")?.textContent).toContain(
      "Explicit attach only.",
    );
    expect(dialogByName("Help / Legend")?.textContent).toContain("Archived");
    expect(dialogByName("Help / Legend")?.textContent).toContain("Large");
    await keyDown("Escape");
  });

  it("shows draft summary only inside Draft Review popup", async () => {
    await render(
      <KnowledgeV2Widget
        draftReviews={[draftReviewFixture()]}
        documents={[
          documentFixture({
            knowledgeDocumentId: "draft_doc",
            lifecycleStatus: "draft",
            title: "Generated architecture draft",
          }),
        ]}
        skills={[
          skillFixture({
            reviewStatus: "needs_review",
            skillId: "needs_review_skill",
            title: "Skill needs review",
          }),
        ]}
      />,
    );

    expect(text()).not.toContain("Draft documents");
    expect(text()).not.toContain("Raw draft contents");
    expect(text()).not.toContain("Generated architecture draft");

    await clickButton("Draft Review");

    const popup = dialogByName("Draft Review");
    expect(popup?.textContent).toContain("Draft documents");
    expect(popup?.textContent).toContain("Draft skills");
    expect(popup?.textContent).toContain("Needs review");
    expect(popup?.textContent).toContain("Review decisions");
    expect(popup?.textContent).toContain("1");
    expect(popup?.textContent).toContain("Review details");
    expect(popup?.textContent).toContain(
      "Raw draft contents stay out of this catalog browser.",
    );
    expect(popup?.textContent).not.toContain("draft payload");
  });

  it("formats invalid metadata as unknown instead of invalid", async () => {
    await render(
      <KnowledgeV2Widget
        documents={[
          documentFixture({
            updatedAt: "not-a-date",
          }),
        ]}
        skills={[]}
      />,
    );

    expect(text()).toContain("Unknown");
    expect(text()).not.toContain("Invalid");

    await clickButton("Release guide");

    await clickButtonInRegion("Knowledge preview", "Details");
    expect(regionByName("Knowledge preview")?.textContent).toContain("Unknown");
    expect(regionByName("Knowledge preview")?.textContent).not.toContain(
      "Invalid",
    );
  });

  it("collapses row tags and keeps dense list out of horizontal-scroll mode", async () => {
    await render(
      <KnowledgeV2Widget
        documents={[
          documentFixture({
            tags: "release,validation,desktop,smoke",
          }),
        ]}
        skills={[]}
      />,
    );

    const catalog = regionByName("Knowledge catalog items");
    const row = rowByTitle("Release guide");
    expect(catalog?.className).not.toContain("horizontal-scroll");
    expect(row?.textContent).toContain("release");
    expect(row?.textContent).toContain("validation");
    expect(row?.textContent).toContain("+2");
    expect(row?.textContent).not.toContain("desktop");
    expect(row?.textContent).not.toContain("smoke");
  });

  it("truncates long row titles accessibly", async () => {
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
    expect(
      row?.querySelector(".knowledge-v2-row-title span")?.getAttribute("title"),
    ).toBe(longTitle);
    expect(titleButton?.className).toContain("knowledge-v2-row-title");
  });

  it("keeps action callbacks explicit inside popups", async () => {
    const onNew = vi.fn();
    const onImport = vi.fn();
    const onDraftReview = vi.fn();
    const onManageSkills = vi.fn();

    await render(
      <KnowledgeV2Widget
        documents={[documentFixture()]}
        onDraftReview={onDraftReview}
        onImport={onImport}
        onManageSkills={onManageSkills}
        onNew={onNew}
        skills={[skillFixture()]}
      />,
    );

    await clickButton("New");
    expect(onNew).not.toHaveBeenCalled();
    await clickButton("Open existing create flow");
    expect(onNew).toHaveBeenCalledTimes(1);

    await keyDown("Escape");
    await clickButton("Import");
    await clickButton("Open existing import flow");
    expect(onImport).toHaveBeenCalledTimes(1);

    await keyDown("Escape");
    await clickButton("Draft Review");
    await clickButton("Open existing draft review flow");
    expect(onDraftReview).toHaveBeenCalledTimes(1);

    await keyDown("Escape");
    await clickButton("Manage Skills");
    await clickButton("Open existing skills flow");
    expect(onManageSkills).toHaveBeenCalledTimes(1);
  });

  it("enables context actions for an approved KnowledgeV2 item", async () => {
    await render(
      <KnowledgeV2Widget
        documents={[documentFixture()]}
        onAttachContextToCoordinator={vi.fn()}
        onAttachKnowledgeContextToQueueTask={vi.fn(async () => ({
          message: "Release guide attached to selected task.",
          status: "attached" as const,
          taskTitle: "Selected task",
        }))}
        skills={[]}
      />,
    );

    await clickButton("Release guide");

    expect(buttonWithText("Use as context")?.disabled).toBe(false);
    expect(buttonWithText("Archive")?.disabled).toBe(true);
    expect(buttonWithText("Delete")?.disabled).toBe(true);
    expect(buttonWithText("Close")?.disabled).toBe(false);
    expect(regionByName("KnowledgeV2 use as context")?.querySelector("p")).toBeNull();

    await clickButton("Use as context");

    const picker = regionByName("KnowledgeV2 Use as Context picker");
    expect(picker?.textContent).toContain("Selectable items");
    expect(picker?.textContent).toContain("Selected items");
    expect(picker?.textContent).toContain("1 selected");
    expect(picker?.textContent).toContain("Estimated tokens");
    expect(picker?.textContent).toContain("Estimated bytes");
    expect(picker?.textContent).toContain("Workspace Agent current context");
    expect(picker?.textContent).toContain("Workspace Agent next-run context bridge is not wired");
    expect(picker?.textContent).toContain("Selected Queue task");
    expect(picker?.textContent).toContain("Copy reference");
  });

  it("disables context attach for rejected or disabled KnowledgeV2 items with a reason", async () => {
    const attachToWorkspaceAgent = vi.fn();
    const attachToQueueTask = vi.fn(async () => ({
      message: "Should not attach.",
      status: "attached" as const,
    }));

    await render(
      <KnowledgeV2Widget
        documents={[
          documentFixture({
            enabled: false,
            knowledgeDocumentId: "rejected_disabled",
            lifecycleStatus: "rejected",
            searchable: false,
            title: "Rejected context item",
          }),
        ]}
        onAttachContextToCoordinator={attachToWorkspaceAgent}
        onAttachKnowledgeContextToQueueTask={attachToQueueTask}
        skills={[]}
      />,
    );

    await clickButton("Rejected context item");

    const useAsContext = regionByName("KnowledgeV2 use as context");
    const useAsContextButton = buttonWithText("Use as context");
    expect(useAsContext?.querySelector("p")).toBeNull();
    expect(useAsContextButton?.disabled).toBe(true);
    expect(useAsContextButton?.title).toContain("Knowledge Document is disabled.");

    await clickButton("Use as context");
    expect(regionByName("KnowledgeV2 Use as Context picker")).toBeNull();

    expect(attachToWorkspaceAgent).not.toHaveBeenCalled();
    expect(attachToQueueTask).not.toHaveBeenCalled();
  });

  it("calls the explicit Workspace Agent attach callback once only after click", async () => {
    const attachToWorkspaceAgent = vi.fn();
    const attachToQueueTask = vi.fn();

    await render(
      <KnowledgeV2Widget
        documents={[]}
        onAttachContextToCoordinator={attachToWorkspaceAgent}
        onAttachKnowledgeContextToQueueTask={attachToQueueTask}
        skills={[skillFixture({ reviewStatus: "reviewed" })]}
      />,
    );

    expect(attachToWorkspaceAgent).not.toHaveBeenCalled();
    expect(attachToQueueTask).not.toHaveBeenCalled();

    await clickButton("React review");
    expect(attachToWorkspaceAgent).not.toHaveBeenCalled();

    await clickButton("Use as context");
    expect(attachToWorkspaceAgent).not.toHaveBeenCalled();

    await clickButton("Attach");

    expect(attachToWorkspaceAgent).toHaveBeenCalledTimes(1);
    expect(attachToWorkspaceAgent).toHaveBeenCalledWith({
      contextText: expect.stringContaining("Skill Library Skill"),
      sourceLabel: "KnowledgeV2 / Skill",
    });
    expect(attachToQueueTask).not.toHaveBeenCalled();
    expect(regionByName("Knowledge preview")?.textContent).toContain(
      "React review attached to Workspace Agent as visible current-session context.",
    );
  });

  it("updates picker selection count and estimate without attaching on selection alone", async () => {
    const attachToWorkspaceAgent = vi.fn();
    const attachToQueueTask = vi.fn();
    const createQueueTask = vi.fn();
    const runQueueTask = vi.fn();

    await render(
      <KnowledgeV2Widget
        documents={[documentFixture()]}
        onAttachContextToCoordinator={attachToWorkspaceAgent}
        onAttachKnowledgeContextToQueueTask={attachToQueueTask}
        skills={[skillFixture({ reviewStatus: "reviewed" })]}
        {...({
          onCreateAgentQueueTask: createQueueTask,
          onStartAssignedAgentQueueTask: runQueueTask,
        } as Partial<ComponentProps<typeof KnowledgeV2Widget>>)}
      />,
    );

    await clickButton("Release guide");
    await clickButtonInRegion("KnowledgeV2 use as context", "Use as context");

    let picker = regionByName("KnowledgeV2 Use as Context picker");
    expect(picker?.textContent).toContain("1 selected");
    expect(picker?.textContent).not.toContain("Estimated tokensUnavailable");

    await clickCheckboxByLabel("React review");

    picker = regionByName("KnowledgeV2 Use as Context picker");
    expect(picker?.textContent).toContain("2 selected");
    expect(attachToWorkspaceAgent).not.toHaveBeenCalled();
    expect(attachToQueueTask).not.toHaveBeenCalled();
    expect(createQueueTask).not.toHaveBeenCalled();
    expect(runQueueTask).not.toHaveBeenCalled();
  });

  it("attaches selected Queue context without creating or running Queue work", async () => {
    const attachToQueueTask = vi.fn(async () => ({
      message: "Release guide attached to selected task.",
      status: "attached" as const,
      taskTitle: "Selected task",
    }));
    const attachToWorkspaceAgent = vi.fn();
    const createQueueTask = vi.fn();
    const runQueueTask = vi.fn();

    await render(
      <KnowledgeV2Widget
        documents={[documentFixture()]}
        onAttachContextToCoordinator={attachToWorkspaceAgent}
        onAttachKnowledgeContextToQueueTask={attachToQueueTask}
        skills={[]}
        {...({
          onCreateAgentQueueTask: createQueueTask,
          onStartAssignedAgentQueueTask: runQueueTask,
        } as Partial<ComponentProps<typeof KnowledgeV2Widget>>)}
      />,
    );

    await clickButton("Release guide");
    await clickButton("Use as context");
    await chooseRadioByLabel("Selected Queue task");
    await clickButton("Attach");
    await flush();

    expect(attachToQueueTask).toHaveBeenCalledTimes(1);
    expect(attachToQueueTask).toHaveBeenCalledWith({
      document: expect.objectContaining({
        knowledgeDocumentId: "kdoc_1",
        title: "Release guide",
      }),
      kind: "knowledge_document",
    });
    expect(attachToWorkspaceAgent).not.toHaveBeenCalled();
    expect(createQueueTask).not.toHaveBeenCalled();
    expect(runQueueTask).not.toHaveBeenCalled();
    expect(regionByName("Knowledge preview")?.textContent).toContain(
      "Release guide attached to selected task.",
    );
  });

  it("shows unavailable context bridges without pretending success", async () => {
    await render(
      <KnowledgeV2Widget documents={[documentFixture()]} skills={[]} />,
    );

    await clickButton("Release guide");

    const useAsContext = regionByName("KnowledgeV2 use as context");
    expect(buttonWithText("Use as context")?.title).toContain(
      "Use as Context is unavailable because no Workspace Agent, Queue, or clipboard context bridge is connected.",
    );
    expect(useAsContext?.textContent).not.toContain("attached to Workspace Agent");
    expect(useAsContext?.textContent).not.toContain("attached to selected task");
    expect(buttonWithText("Use as context")?.disabled).toBe(true);

    await clickButton("Use as context");
    expect(regionByName("KnowledgeV2 Use as Context picker")).toBeNull();
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

    expect(text()).toContain("Knowledge / Skills");
    expect(text()).toContain("No catalog items yet.");
    expect(text()).not.toContain("Knowledge Catalog v2");
    expect(text()).not.toContain("Experimental");
  });
});
