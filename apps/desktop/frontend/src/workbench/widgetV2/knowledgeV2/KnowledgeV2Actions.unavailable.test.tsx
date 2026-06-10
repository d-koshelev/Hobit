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
  it("shows disabled reasons when explicit action callbacks are absent", async () => {
    await render(
      <KnowledgeV2Widget
        documents={[documentFixture()]}
        skills={[skillFixture()]}
      />,
    );

    await expectUnavailableAction(
      "New",
      "Open existing create flow",
      "Creation is unavailable because KnowledgeV2 did not receive an explicit create-flow callback.",
    );
    await expectUnavailableAction(
      "Import",
      "Open existing import flow",
      "Import is unavailable because KnowledgeV2 did not receive an explicit import-flow callback.",
    );
    await expectUnavailableAction(
      "Draft Review",
      "Open existing draft review flow",
      "Draft review management is unavailable because KnowledgeV2 did not receive an explicit draft-review callback.",
    );
    await expectUnavailableAction(
      "Manage Skills",
      "Open existing skills flow",
      "Skill management is unavailable because KnowledgeV2 did not receive an explicit Skill-management callback.",
    );
  });

  it("shows local partial details for Manage Skills when the Skill bridge is unavailable", async () => {
    const onManageSkills = vi.fn();

    await render(
      <KnowledgeV2Widget
        documents={[documentFixture()]}
        onManageSkills={onManageSkills}
      />,
    );

    expect(buttonWithText("Manage Skills")?.textContent).toContain("Partial");

    await clickButton("Manage Skills");

    const dialog = dialogByName("Manage Skills");
    expect(dialog?.textContent).toContain("Partial");
    expect(dialog?.textContent).toContain(
      "Some bridge details unavailable.",
    );
    expect(dialog?.textContent).not.toContain(
      "Manage Skills is partial because the Skill list bridge is not fully available in this KnowledgeV2 host.",
    );
    expect(dialog?.textContent).toContain("Skills list bridge is unavailable");
    expect(onManageSkills).not.toHaveBeenCalled();

    await clickButton("Open existing skills flow");

    expect(onManageSkills).toHaveBeenCalledTimes(1);
  });
});

async function expectUnavailableAction(
  actionLabel: string,
  bridgeLabel: string,
  reason: string,
) {
  await keyDown("Escape");
  await clickButton(actionLabel);
  const footerButton = buttonWithText(bridgeLabel);
  const dialog = dialogByName(actionLabel);
  expect(footerButton?.disabled).toBe(true);
  expect(footerButton?.title).toBe(reason);
  expect(dialog?.textContent).toContain("Bridge unavailable.");
  expect(dialog?.textContent).not.toContain(reason);
  expect(dialog?.querySelector(".popup-shell-footer p")).toBeNull();
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
