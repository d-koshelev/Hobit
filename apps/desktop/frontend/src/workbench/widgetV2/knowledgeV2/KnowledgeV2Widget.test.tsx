import { act } from "react";
import type { ComponentProps, ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

import type {
  KnowledgeDocument,
  KnowledgeDraftReviewDecision,
} from "../../../workspace/types/knowledgeDocuments";
import type { Skill } from "../../../workspace/types/skills";
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

describe("KnowledgeV2Widget browser", () => {
  it("renders documents and skills together", async () => {
    await render(
      <KnowledgeV2Widget
        documents={[documentFixture()]}
        skills={[skillFixture({ reviewStatus: "reviewed" })]}
      />,
    );

    expect(headingWithText("Knowledge Catalog v2")).not.toBeNull();
    expect(regionByName("Knowledge catalog items")?.getAttribute("role")).toBe(
      "table",
    );
    expect(text()).toContain("Title");
    expect(text()).toContain("Type");
    expect(text()).toContain("Status");
    expect(text()).toContain("Scope");
    expect(text()).toContain("Tags");
    expect(text()).toContain("Updated");
    expect(text()).toContain("Actions");
    expect(text()).toContain("Release guide");
    expect(text()).toContain("React review");
    expect(text()).toContain("Document");
    expect(text()).toContain("Skill");
    expect(text()).toContain("2 / 2");
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

    expect(text()).toContain("Catalog data unavailable.");
    expect(text()).toContain("No production data is being faked.");
    expect(text()).toContain("Knowledge Documents list bridge");
    expect(text()).toContain("Skills list bridge");
    expect(text()).toContain("No catalog items yet.");
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
    expect(text()).toContain("0 / 2");
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
    expect(preview?.textContent).toContain("Release guide");
    expect(preview?.textContent).toContain(
      "Release checklist for desktop builds.",
    );
    expect(preview?.textContent).toContain("Release docs");
    expect(preview?.textContent).toContain("Context usability");

    await clickButton("Details");

    const detailsPreview = regionByName("Knowledge preview");
    expect(detailsPreview?.textContent).toContain("Attachments and source refs");
    expect(preview?.textContent).toContain("docs/release.md");

    await clickButton("React review");

    const updatedPreview = regionByName("Knowledge preview");
    expect(rowByTitle("React review")?.getAttribute("data-selected")).toBe(
      "true",
    );
    expect(updatedPreview?.textContent).toContain("React review");
    expect(updatedPreview?.textContent).toContain("Use when reviewing React changes.");
    expect(updatedPreview?.textContent).toContain("Workspace Skill");
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
    expect(preview?.textContent).toContain("Context usability");
    expect(preview?.textContent).toContain(
      "Available for explicit visible attach",
    );
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
    await clickButton("Details");

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
    expect(versions?.textContent).toContain("V3");
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
    expect(preview?.textContent).toContain("Rejected safety note");
    expect(preview?.textContent).toContain("Document is disabled.");
    expect(preview?.textContent).toContain("Document is marked not searchable.");
    expect(preview?.textContent).toContain(
      "Rejected document is unavailable for normal catalog use.",
    );
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
      "Normal context candidate",
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
      "Context actions are always explicit",
    );
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

    await clickButton("Draft Review");

    const popup = dialogByName("Draft Review");
    expect(popup?.textContent).toContain("Draft documents");
    expect(popup?.textContent).toContain("Draft skills");
    expect(popup?.textContent).toContain("Needs review");
    expect(popup?.textContent).toContain("Review decisions");
    expect(popup?.textContent).toContain("1");
    expect(popup?.textContent).toContain("Raw draft contents are not");
    expect(popup?.textContent).not.toContain("draft payload");
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

    expect(buttonWithText("Attach to Workspace Agent")?.disabled).toBe(false);
    expect(buttonWithText("Attach to selected Queue task")?.disabled).toBe(false);
    expect(regionByName("KnowledgeV2 use as context")?.textContent).toContain(
      "These controls only use explicit visible callbacks.",
    );
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
    expect(buttonWithText("Attach to Workspace Agent")?.disabled).toBe(true);
    expect(buttonWithText("Attach to selected Queue task")?.disabled).toBe(true);
    expect(useAsContext?.textContent).toContain("Knowledge Document is disabled.");

    await clickButton("Attach to selected Queue task");

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

    await clickButton("Attach to Workspace Agent");

    expect(attachToWorkspaceAgent).toHaveBeenCalledTimes(1);
    expect(attachToWorkspaceAgent).toHaveBeenCalledWith({
      contextText: expect.stringContaining("Skill Library Skill"),
      sourceLabel: "KnowledgeV2 / Skill",
    });
    expect(attachToQueueTask).not.toHaveBeenCalled();
    expect(regionByName("KnowledgeV2 use as context")?.textContent).toContain(
      "React review attached to Workspace Agent as visible current-session context.",
    );
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
    await clickButton("Attach to selected Queue task");
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
    expect(regionByName("KnowledgeV2 use as context")?.textContent).toContain(
      "Release guide attached to selected task.",
    );
  });

  it("shows unavailable context bridges without pretending success", async () => {
    await render(
      <KnowledgeV2Widget documents={[documentFixture()]} skills={[]} />,
    );

    await clickButton("Release guide");

    const useAsContext = regionByName("KnowledgeV2 use as context");
    expect(buttonWithText("Attach to Workspace Agent")?.disabled).toBe(true);
    expect(buttonWithText("Attach to selected Queue task")?.disabled).toBe(true);
    expect(useAsContext?.textContent).toContain(
      "Workspace Agent attach bridge is unavailable",
    );
    expect(useAsContext?.textContent).toContain(
      "Queue task attach bridge is unavailable",
    );
    expect(useAsContext?.textContent).not.toContain("attached to Workspace Agent");
    expect(useAsContext?.textContent).not.toContain("attached to selected task");
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

async function render(element: ReactNode) {
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);

  await act(async () => {
    root?.render(element);
  });
}

async function clickButton(textContent: string) {
  const button = buttonWithText(textContent);
  expect(button).not.toBeNull();
  await act(async () => {
    button?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });
}

async function changeInput(label: string, value: string) {
  const input = inputByLabel(label);
  expect(input).not.toBeNull();
  await act(async () => {
    if (input) {
      setNativeValue(input, value);
      input.dispatchEvent(new Event("input", { bubbles: true }));
    }
  });
}

async function changeSelect(label: string, value: string) {
  const select = selectByLabel(label);
  expect(select).not.toBeNull();
  await act(async () => {
    if (select) {
      select.value = value;
      select.dispatchEvent(new Event("change", { bubbles: true }));
    }
  });
}

async function keyDown(key: string) {
  await act(async () => {
    document.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, key }));
  });
}

function setNativeValue(element: HTMLInputElement, value: string) {
  const valueSetter = Object.getOwnPropertyDescriptor(element, "value")?.set;
  const prototype = Object.getPrototypeOf(element) as HTMLInputElement;
  const prototypeValueSetter = Object.getOwnPropertyDescriptor(
    prototype,
    "value",
  )?.set;

  if (prototypeValueSetter && valueSetter !== prototypeValueSetter) {
    prototypeValueSetter.call(element, value);
    return;
  }

  valueSetter?.call(element, value);
}

function text() {
  return document.body.textContent ?? "";
}

function headingWithText(textContent: string): HTMLHeadingElement | null {
  return (
    Array.from(document.querySelectorAll<HTMLHeadingElement>("h1,h2,h3")).find(
      (heading) => heading.textContent === textContent,
    ) ?? null
  );
}

function buttonWithText(textContent: string): HTMLButtonElement | null {
  return (
    Array.from(document.querySelectorAll<HTMLButtonElement>("button")).find(
      (button) => button.textContent?.includes(textContent),
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

function regionByName(name: string): HTMLElement | null {
  return (
    Array.from(document.querySelectorAll<HTMLElement>("[aria-label]")).find(
      (element) => element.getAttribute("aria-label") === name,
    ) ?? null
  );
}

function dialogByName(name: string): HTMLElement | null {
  return (
    Array.from(document.querySelectorAll<HTMLElement>("[role='dialog']")).find(
      (element) => element.textContent?.includes(name),
    ) ?? null
  );
}

function rowByTitle(title: string): HTMLElement | null {
  const titleButton = buttonWithText(title);
  return titleButton?.closest<HTMLElement>(".knowledge-v2-row") ?? null;
}

function documentFixture(
  overrides: Partial<KnowledgeDocument> = {},
): KnowledgeDocument {
  return {
    catalogItemType: "documentation_knowledge",
    content: "Release process content.",
    createdAt: "2026-01-01T00:00:00.000Z",
    enabled: true,
    knowledgeDocumentId: "kdoc_1",
    lifecycleStatus: "active",
    quickSummary: "Release guide summary.",
    scope: "workspace",
    searchable: true,
    sourceKind: "docs_path",
    sourceLabel: "Release docs",
    sourceRef: "docs/release.md",
    tags: "release",
    title: "Release guide",
    updatedAt: "2026-01-02T00:00:00.000Z",
    workspaceId: "workspace_1",
    ...overrides,
  };
}

function skillFixture(overrides: Partial<Skill> = {}): Skill {
  return {
    createdAt: "2026-01-01T00:00:00.000Z",
    prerequisites: "Know the changed files.",
    reviewStatus: "draft",
    risks: "Missing regression coverage.",
    skillId: "skill_1",
    steps: "Read the diff.",
    tags: "review",
    title: "React review",
    updatedAt: "2026-01-03T00:00:00.000Z",
    validation: "Run relevant tests.",
    whenToUse: "Use when reviewing React changes.",
    workspaceId: "workspace_1",
    ...overrides,
  };
}

function draftReviewFixture(
  overrides: Partial<KnowledgeDraftReviewDecision> = {},
): KnowledgeDraftReviewDecision {
  return {
    action: "accepted",
    createdAt: "2026-01-04T00:00:00.000Z",
    draftPackId: "pack_1",
    proposedItemId: "draft_1",
    proposedItemKey: "document:draft_1",
    reviewId: "review_1",
    reviewedAt: "2026-01-04T00:00:00.000Z",
    sourceFingerprint: "fingerprint_1",
    updatedAt: "2026-01-04T00:00:00.000Z",
    workspaceId: "workspace_1",
    ...overrides,
  };
}
