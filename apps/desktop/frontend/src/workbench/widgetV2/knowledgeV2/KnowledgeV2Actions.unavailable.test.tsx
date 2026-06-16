import { act } from "react";
import type { ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { KnowledgeDocument } from "../../../workspace/types/knowledgeDocuments";
import type { Skill } from "../../../workspace/types/skills";
import { KnowledgeV2Widget } from "./KnowledgeV2Widget";

let root: Root | null = null;
let container: HTMLDivElement | null = null;

afterEach(() => {
  if (root && container) {
    act(() => root?.unmount());
    container.remove();
  }
  root = null;
  container = null;
  document.body.innerHTML = "";
});

describe("KnowledgeV2 unavailable actions", () => {
  it("hides callback-backed actions when explicit callbacks are absent", async () => {
    await render(
      <KnowledgeV2Widget
        documents={[documentFixture()]}
        skills={[skillFixture()]}
      />,
    );

    expect(buttonWithText("New")).toBeNull();
    expect(buttonWithText("Import")).toBeNull();
    expect(buttonWithText("Draft Review")).toBeNull();
    expect(buttonWithText("Manage Skills")).toBeNull();

    await openMoreAction("Debug");

    const dialog = dialogByName("Knowledge diagnostics");
    expect(dialog?.textContent).toContain("Callback Availability");
    expect(dialog?.textContent).toContain("onNew");
    expect(dialog?.textContent).toContain("callback missing");
    expect(dialog?.textContent).toContain("Missing onImport callback.");
  });

  it("keeps Manage Skills product-facing and moves bridge detail to debug", async () => {
    const onManageSkills = vi.fn();

    await render(
      <KnowledgeV2Widget
        documents={[documentFixture()]}
        onManageSkills={onManageSkills}
      />,
    );

    expect(buttonWithText("Manage Skills")).toBeNull();

    await openMoreAction("Manage Skills");

    const dialog = dialogByName("Manage Skills");
    expect(dialog?.textContent).toContain("Available");
    expect(dialog?.textContent).not.toContain("Some bridge details unavailable.");
    expect(dialog?.textContent).not.toContain("Skills list bridge is unavailable");
    expect(onManageSkills).not.toHaveBeenCalled();

    await clickButton("Open existing skills flow");

    expect(onManageSkills).toHaveBeenCalledTimes(1);

    await keyDown("Escape");
    await openMoreAction("Debug");
    expect(dialogByName("Knowledge diagnostics")?.textContent).toContain(
      "Skills list bridge is unavailable",
    );
  });
});

async function openMoreAction(label: string) {
  await clickButton("More");
  await clickButton(label);
}

async function render(element: ReactNode) {
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  await act(async () => root?.render(element));
}

async function clickButton(textContent: string) {
  const button = buttonWithText(textContent);
  expect(button).not.toBeNull();
  await act(async () => {
    button?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });
}

async function keyDown(key: string) {
  await act(async () => {
    document.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, key }));
  });
}

function buttonWithText(textContent: string): HTMLButtonElement | null {
  return (
    Array.from(document.querySelectorAll<HTMLButtonElement>("button")).find(
      (button) => button.textContent?.includes(textContent),
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

function documentFixture(): KnowledgeDocument {
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
  };
}

function skillFixture(): Skill {
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
  };
}
