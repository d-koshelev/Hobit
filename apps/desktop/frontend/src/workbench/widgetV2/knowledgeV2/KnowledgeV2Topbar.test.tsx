import { afterEach, describe, expect, it, vi } from "vitest";

import { KnowledgeV2Widget } from "./KnowledgeV2Widget";
import {
  cleanupKnowledgeV2WidgetTestDom,
  buttonWithText,
  clickButtonInRegion,
  dialogByName,
  documentFixture,
  regionByName,
  render,
  skillFixture,
} from "./KnowledgeV2Widget.test-helpers";

afterEach(() => {
  cleanupKnowledgeV2WidgetTestDom();
});

describe("KnowledgeV2Widget topbar", () => {
  it("groups view, primary, secondary, and filter controls separately", async () => {
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

    expect(
      document.querySelector(".knowledge-v2-action-group[data-group='view']"),
    ).not.toBeNull();
    expect(
      document.querySelector(
        ".knowledge-v2-action-group-spaced[data-group='view']",
      ),
    ).not.toBeNull();
    expect(
      document.querySelector(".knowledge-v2-action-group[data-group='primary']"),
    ).not.toBeNull();
    expect(
      document.querySelector(
        ".knowledge-v2-action-group-spaced[data-group='primary']",
      ),
    ).not.toBeNull();
    expect(
      document.querySelector(
        ".knowledge-v2-action-group[data-group='management']",
      ),
    ).toBeNull();
    expect(
      document.querySelector(".knowledge-v2-action-group[data-group='more']"),
    ).not.toBeNull();
    expect(regionByName("Knowledge view switcher")?.textContent).toContain(
      "List",
    );
    expect(regionByName("Knowledge view switcher")?.textContent).toContain(
      "Cards",
    );
    expect(regionByName("Knowledge primary actions")?.textContent).toContain(
      "New",
    );
    expect(regionByName("Knowledge primary actions")?.textContent).toContain(
      "Import",
    );
    expect(
      regionByName("Knowledge primary actions")?.textContent,
    ).not.toContain("Draft Review");
    expect(
      regionByName("Knowledge primary actions")?.textContent,
    ).not.toContain("Manage Skills");
    expect(buttonWithText("Debug")).toBeNull();
    expect(
      regionByName("Knowledge search and filter row")?.textContent,
    ).toContain("Sort");
    expect(
      regionByName("Knowledge search and filter row")?.textContent,
    ).toContain("More filters");
    expect(onNew).not.toHaveBeenCalled();
    expect(onImport).not.toHaveBeenCalled();
    expect(onDraftReview).not.toHaveBeenCalled();
    expect(onManageSkills).not.toHaveBeenCalled();
  });

  it("keeps secondary actions accessible through More without running callbacks", async () => {
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

    const moreGroup = regionByName("Knowledge secondary actions");
    const managementGroup = regionByName("Knowledge management actions");

    expect(moreGroup?.className).toContain("knowledge-v2-more-actions");
    expect(moreGroup?.className).toContain("knowledge-v2-action-group-spaced");
    expect(managementGroup).toBeNull();
    expect(moreGroup?.textContent).not.toContain("Draft Review");
    expect(moreGroup?.textContent).not.toContain("Manage Skills");
    expect(moreGroup?.textContent).not.toContain("Debug");

    await clickButtonInRegion(
      "Knowledge secondary actions",
      "More",
    );

    const moreMenu = regionByName("Knowledge More menu");
    expect(moreMenu?.getAttribute("role")).toBe("menu");
    expect(moreMenu?.textContent).toContain("Draft Review");
    expect(moreMenu?.textContent).toContain("Manage Skills");
    expect(moreMenu?.textContent).toContain("Debug");
    expect(moreMenu?.textContent).not.toContain("Help");
    expect(onNew).not.toHaveBeenCalled();
    expect(onImport).not.toHaveBeenCalled();
    expect(onDraftReview).not.toHaveBeenCalled();
    expect(onManageSkills).not.toHaveBeenCalled();

    await clickButtonInRegion("Knowledge More menu", "Manage Skills");

    expect(dialogByName("Manage Skills")?.textContent).toContain("Skill records");
    expect(dialogByName("Manage Skills")?.textContent).not.toContain("Categories");
    expect(regionByName("Knowledge More menu")).toBeNull();
    expect(onManageSkills).not.toHaveBeenCalled();
  });
});
