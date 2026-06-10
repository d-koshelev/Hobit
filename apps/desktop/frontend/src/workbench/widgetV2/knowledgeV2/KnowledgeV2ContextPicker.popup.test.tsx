import { afterEach, describe, expect, it, vi } from "vitest";
import { act } from "react";

import { KnowledgeV2Widget } from "./KnowledgeV2Widget";
import {
  cleanupKnowledgeV2WidgetTestDom,
  clickButton,
  clickCheckboxByLabel,
  dialogByName,
  documentFixture,
  render,
  skillFixture,
} from "./KnowledgeV2Widget.test-helpers";

afterEach(() => {
  cleanupKnowledgeV2WidgetTestDom();
});

describe("KnowledgeV2 Use as Context popup", () => {
  it("opens as a bounded floating popup with body content and sticky actions", async () => {
    await render(
      <KnowledgeV2Widget
        documents={[documentFixture()]}
        onAttachContextToCoordinator={vi.fn()}
        skills={[]}
      />,
    );

    await clickButton("Release guide");
    await clickButton("Use as context");

    const popup = dialogByName("Use as context");
    const body = popup?.querySelector<HTMLElement>("[data-popup-body]");
    const footer = popup?.querySelector<HTMLElement>(".popup-shell-footer");

    expect(popup?.classList.contains("knowledge-v2-context-picker-popup-shell")).toBe(
      true,
    );
    expect(popup?.classList.contains("popup-shell-floating")).toBe(true);
    expect(popup?.classList.contains("popup-shell-with-layout")).toBe(true);
    expect(popup?.querySelector(".popup-shell-header")?.textContent).toContain(
      "Use as context",
    );
    expect(popup?.querySelector(".popup-shell-header")?.textContent).toContain(
      "Close",
    );
    expect(body?.classList.contains("knowledge-v2-context-picker-popup-body")).toBe(
      true,
    );
    expect(body?.textContent).toContain("Selectable items");
    expect(body?.textContent).toContain("Selected items");
    expect(body?.textContent).toContain("Target");
    expect(body?.textContent).toContain("Estimated tokens");
    expect(body?.textContent).toContain("Workspace Agent current context");
    expect(body?.textContent).toContain(
      "Workspace Agent next-run context bridge is not wired",
    );
    expect(footer?.textContent).toContain("Cancel");
    expect(footer?.textContent).toContain("Attach");
    expect(body?.contains(footer ?? null)).toBe(false);
    expect(
      document.querySelector(".knowledge-v2-preview .knowledge-v2-context-picker"),
    ).toBeNull();
  });

  it("keeps long item lists inside the popup body while footer remains visible", async () => {
    const documents = Array.from({ length: 30 }, (_, index) =>
      documentFixture({
        knowledgeDocumentId: `doc_${index.toString()}`,
        quickSummary: `Long list summary ${index.toString()}.`,
        title: `Long context item ${index.toString()}`,
      }),
    );

    await render(
      <KnowledgeV2Widget
        documents={documents}
        onAttachContextToCoordinator={vi.fn()}
        skills={[]}
      />,
    );

    await clickButton("Long context item 0");
    await clickButton("Use as context");

    const popup = dialogByName("Use as context");
    const body = popup?.querySelector<HTMLElement>("[data-popup-body]");
    const footer = popup?.querySelector<HTMLElement>(".popup-shell-footer");
    const selectableList = popup?.querySelector<HTMLElement>(
      ".knowledge-v2-picker-items",
    );

    expect(body?.classList.contains("knowledge-v2-context-picker-popup-body")).toBe(
      true,
    );
    expect(selectableList?.textContent).toContain("Long context item 29");
    expect(footer?.textContent).toContain("Cancel");
    expect(footer?.textContent).toContain("Attach");
    expect(body?.contains(footer ?? null)).toBe(false);
  });

  it("disables Attach until a valid item remains selected", async () => {
    const attachToWorkspaceAgent = vi.fn();

    await render(
      <KnowledgeV2Widget
        documents={[documentFixture()]}
        onAttachContextToCoordinator={attachToWorkspaceAgent}
        skills={[]}
      />,
    );

    await clickButton("Release guide");
    await clickButton("Use as context");

    expect(buttonWithText("Attach")?.disabled).toBe(false);

    await clickCheckboxByLabel("Release guide");

    expect(buttonWithText("Attach")?.disabled).toBe(true);
    expect(dialogByName("Use as context")?.textContent).toContain(
      "Select at least one attachable Knowledge item.",
    );
    expect(attachToWorkspaceAgent).not.toHaveBeenCalled();
  });

  it("does not attach on selection alone and attaches once on explicit Attach", async () => {
    const attachToWorkspaceAgent = vi.fn();

    await render(
      <KnowledgeV2Widget
        documents={[documentFixture()]}
        onAttachContextToCoordinator={attachToWorkspaceAgent}
        skills={[skillFixture()]}
      />,
    );

    await clickButton("Release guide");
    await clickButton("Use as context");
    await clickCheckboxByLabel("React review");

    expect(attachToWorkspaceAgent).not.toHaveBeenCalled();

    await clickButton("Attach");

    expect(attachToWorkspaceAgent).toHaveBeenCalledTimes(1);
  });

  it("shows unavailable picker items as disabled with a reason", async () => {
    await render(
      <KnowledgeV2Widget
        documents={[documentFixture()]}
        onAttachContextToCoordinator={vi.fn()}
        skills={[
          skillFixture({
            reviewStatus: "needs_review",
            skillId: "needs_review_context",
            title: "Needs review context skill",
          }),
        ]}
      />,
    );

    await clickButton("Release guide");
    await clickButton("Use as context");

    const disabledItem =
      Array.from(
        document.querySelectorAll<HTMLElement>(".knowledge-v2-picker-items li"),
      ).find((item) =>
        item.textContent?.includes("Needs review context skill"),
      ) ?? null;
    const disabledInput =
      disabledItem?.querySelector<HTMLInputElement>("input[type='checkbox']") ??
      null;

    expect(disabledItem?.getAttribute("data-disabled")).toBe("true");
    expect(disabledInput?.disabled).toBe(true);
    expect(dialogByName("Use as context")?.textContent).toContain(
      "Skill review status is Needs Review; only reviewed Skills can be attached as context.",
    );
  });

  it("shows compact selected warning counts with expandable warning details", async () => {
    await render(
      <KnowledgeV2Widget
        documents={[
          documentFixture({
            content: "Large context ".repeat(1_100),
            knowledgeDocumentId: "large_context",
            title: "Large context note",
          }),
        ]}
        onAttachContextToCoordinator={vi.fn()}
        skills={[]}
      />,
    );

    await clickButton("Large context note");
    await clickButton("Use as context");

    const popup = dialogByName("Use as context");
    expect(popup?.textContent).toContain("Explicit attach only.");
    expect(popup?.textContent).toContain("1 warning: Large item: bounded context only");
    expect(popup?.textContent).toContain("Warning details");
    expect(popup?.textContent).not.toContain(
      "Select items, choose a target, then attach explicitly.",
    );
    expect(buttonWithText("Attach")?.disabled).toBe(false);

    const details = popup?.querySelector<HTMLDetailsElement>(
      ".knowledge-v2-picker-warning-summary details",
    );
    expect(details?.open).toBe(false);

    await clickSummary(details);

    expect(details?.open).toBe(true);
    expect(popup?.textContent).toContain("Large item: bounded context only.");
  });
});

function buttonWithText(textContent: string): HTMLButtonElement | null {
  return (
    Array.from(document.querySelectorAll<HTMLButtonElement>("button")).find(
      (button) => button.textContent?.includes(textContent),
    ) ?? null
  );
}

async function clickSummary(details: HTMLDetailsElement | null | undefined) {
  const summary = details?.querySelector("summary");
  expect(summary).not.toBeNull();
  await act(async () => {
    summary?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });
}
