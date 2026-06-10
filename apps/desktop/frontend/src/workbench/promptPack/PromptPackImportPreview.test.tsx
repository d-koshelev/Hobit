import { act } from "react";
import type { ReactElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

import { PromptPackImportPreview } from "./promptPackImportPreviewComponent";
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

    expect(document.body.textContent).toContain("Pack One");
    expect(document.body.textContent).toContain("Selected items");
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
});

function render(element: ReactElement) {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);

  act(() => {
    root?.render(element);
  });
}
