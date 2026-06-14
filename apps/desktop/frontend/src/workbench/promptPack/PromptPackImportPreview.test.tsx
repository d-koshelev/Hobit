import { act } from "react";
import type { ReactElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  PromptPackImportPreview,
  PromptPackImportPreviewCard,
} from "./promptPackImportPreviewComponent";
import { buildPromptPackImportPreview } from "./promptPackImportPreview";
import { parsePromptPackImportPlan } from "./promptPackParser";

let container: HTMLDivElement | null = null;
let root: Root | null = null;

afterEach(() => {
  if (root) {
    act(() => root?.unmount());
  }
  container?.remove();
  container = null;
  root = null;
});

describe("PromptPackImportPreview", () => {
  it("renders the import plan without creating Queue items", () => {
    const onCreateQueueItem = vi.fn();
    const preview = buildPromptPackImportPreview(
      parsePromptPackImportPlan([
        {
          path: "prompt-batch.json",
          text: JSON.stringify({
            id: "pack-one",
            name: "Pack One",
            items: [
              {
                expectedCommitTitle: "frontend: one",
                id: "one",
                modelProfile: "strong",
                prompt: "one",
                reasoningEffort: "medium",
                validationCommands: [
                  "npm.cmd run typecheck --prefix apps/desktop/frontend",
                ],
                validatorProfile: "standard",
              },
            ],
          }),
        },
      ]),
    );

    render(<PromptPackImportPreview preview={preview} />);

    expect(
      document.querySelector('[aria-label="Prompt-pack import preview card"]'),
    ).not.toBeNull();
    expect(document.body.textContent).toContain("Pack One");
    expect(document.body.textContent).toContain("Selected items");
    expect(document.body.textContent).toContain("Smart Queue preview");
    expect(document.body.textContent).toContain("Queue target");
    expect(document.body.textContent).toContain("Singleton Workspace Queue");
    expect(document.body.textContent).toContain("Would start tasks");
    expect(document.body.textContent).toContain("No Queue view created");
    expect(document.body.textContent).toContain("frontend: one");
    expect(document.body.textContent).toContain("strong / medium / standard");
    expect(document.body.textContent).toContain(
      "Preview is read-only. It does not create Queue items",
    );
    expect(onCreateQueueItem).not.toHaveBeenCalled();
  });

  it("renders honest unavailable state when no preview exists", () => {
    render(<PromptPackImportPreview preview={null} />);

    expect(document.body.textContent).toContain("Prompt-pack preview unavailable");
    expect(document.body.textContent).toContain(
      "Local folder and zip import are unavailable",
    );
  });

  it("renders product action buttons without firing create on render", () => {
    const onCreateQueueItems = vi.fn();
    const onCancel = vi.fn();
    const preview = promptPackPreview();

    render(
      <PromptPackImportPreviewCard
        actions={{
          cancel: {
            disabled: false,
            label: "Cancel",
            onClick: onCancel,
          },
          create: {
            disabled: false,
            label: "Create Queue items",
            onClick: onCreateQueueItems,
          },
        }}
        preview={preview}
      />,
    );

    expect(buttonWithText("Create Queue items")).not.toBeNull();
    expect(buttonWithText("Cancel")).not.toBeNull();
    expect(onCreateQueueItems).not.toHaveBeenCalled();
    expect(onCancel).not.toHaveBeenCalled();
  });

  it("keeps create disabled with a visible bridge reason", () => {
    const onCreateQueueItems = vi.fn();

    render(
      <PromptPackImportPreviewCard
        actions={{
          cancel: {
            disabled: false,
            label: "Cancel",
            onClick: vi.fn(),
          },
          create: {
            disabled: true,
            disabledReason:
              "Workspace Agent Queue bridge is unavailable. No Queue items can be created from this import card.",
            label: "Create Queue items",
            onClick: onCreateQueueItems,
          },
        }}
        preview={promptPackPreview()}
      />,
    );

    expect(buttonWithText("Create Queue items")?.hasAttribute("disabled")).toBe(
      true,
    );
    expect(document.body.textContent).toContain(
      "Workspace Agent Queue bridge is unavailable",
    );
    expect(onCreateQueueItems).not.toHaveBeenCalled();
  });

  it("does not call create when cancel is clicked", async () => {
    const onCreateQueueItems = vi.fn();
    const onCancel = vi.fn();

    render(
      <PromptPackImportPreviewCard
        actions={{
          cancel: {
            disabled: false,
            label: "Cancel",
            onClick: onCancel,
          },
          create: {
            disabled: false,
            label: "Create Queue items",
            onClick: onCreateQueueItems,
          },
        }}
        preview={promptPackPreview()}
      />,
    );

    await clickButton("Cancel");

    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onCreateQueueItems).not.toHaveBeenCalled();
  });

  it("calls create only when the create button is clicked", async () => {
    const onCreateQueueItems = vi.fn();

    render(
      <PromptPackImportPreviewCard
        actions={{
          cancel: {
            disabled: false,
            label: "Cancel",
            onClick: vi.fn(),
          },
          create: {
            disabled: false,
            label: "Create Queue items",
            onClick: onCreateQueueItems,
          },
        }}
        preview={promptPackPreview()}
      />,
    );

    expect(onCreateQueueItems).not.toHaveBeenCalled();

    await clickButton("Create Queue items");

    expect(onCreateQueueItems).toHaveBeenCalledTimes(1);
  });
});

function render(element: ReactElement) {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);

  act(() => {
    root?.render(element);
  });
}

async function clickButton(text: string) {
  await act(async () => {
    const button = buttonWithText(text);
    if (!button) {
      throw new Error(`Button not found: ${text}`);
    }
    button.click();
    await Promise.resolve();
  });
}

function buttonWithText(text: string) {
  return Array.from(document.querySelectorAll("button")).find(
    (button) => button.textContent === text,
  );
}

function promptPackPreview() {
  return buildPromptPackImportPreview(
    parsePromptPackImportPlan([
      {
        path: "prompt-batch.json",
        text: JSON.stringify({
          description: "Preview pack description",
          id: "pack-one",
          items: [
            {
              allowedScope: ["apps/desktop/frontend/src/workbench/**"],
              dependencies: ["setup"],
              forbiddenScope: ["crates/**"],
              id: "one",
              priority: 2,
              prompt: "one",
              tags: ["frontend"],
              title: "One",
              validationCommands: [
                "npm.cmd run typecheck --prefix apps/desktop/frontend",
              ],
            },
            {
              id: "setup",
              prompt: "setup",
              tags: ["queue"],
              title: "Setup",
            },
          ],
          name: "Pack One",
        }),
      },
    ]),
  );
}
