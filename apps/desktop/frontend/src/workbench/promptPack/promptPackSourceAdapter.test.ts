import { describe, expect, it, vi } from "vitest";

import {
  buildPromptPackImportPreview,
  parsePromptPackImportPlan,
  promptPackEntriesFromImportSource,
} from ".";
import {
  realisticDogfoodingSmokePromptPackEntries,
  realisticDogfoodingSmokePromptPackFixturePath,
} from "./selfDevelopmentSmokePromptPackFixture.test-fixtures";

const exactSmokePackPath = realisticDogfoodingSmokePromptPackFixturePath;

describe("prompt-pack source adapter", () => {
  it("loads exact smoke pack path entries and resolves manifest references to prompt bodies", async () => {
    const shellCallback = vi.fn();
    const codexCallback = vi.fn();
    const sqliteCallback = vi.fn();
    const terminalCallback = vi.fn();
    const autorunCallback = vi.fn();
    const readPromptPackSource = vi.fn(async ({ path }: { path: string }) => {
      expect(path).toBe(exactSmokePackPath);
      return promptPackEntriesFromImportSource({
        files: realisticDogfoodingSmokePromptPackEntries.map((entry) => ({
          byteSize: entry.text.length,
          fileName: entry.name ?? (entry.path ?? "").split("/").pop() ?? "",
          relativePath: (entry.path ?? "").split("/").pop() ?? "",
          text: entry.text,
        })),
        sourceKind: "folder",
        sourcePath: exactSmokePackPath,
      });
    });

    const entries = await readPromptPackSource({ path: exactSmokePackPath });
    const paths = entries.map((entry) => entry.path).sort();
    expect(paths).toEqual([
      "001-add-dogfooding-smoke-result-doc.md",
      "002-record-dependent-gate-result.md",
      "README.md",
      "prompt-batch.json",
    ]);

    const preview = buildPromptPackImportPreview(parsePromptPackImportPlan(entries));
    expect(preview.importAvailable).toBe(true);
    expect(preview.errors).toHaveLength(0);
    expect(preview.selectedItems).toHaveLength(2);
    expect(preview.dependencyGraphSummary.edgeCount).toBe(1);
    expect(preview.dependencyGraphSummary.unresolvedDependencyCount).toBe(0);
    expect(preview.selectedItems[0].promptBody.trim()).not.toBe("");
    expect(preview.selectedItems[1].promptBody).toContain(
      "Do not infer readiness from import alone.",
    );
    expect(preview.selectedItems[1].dependencies).toEqual([
      "001-add-dogfooding-smoke-result-doc",
    ]);
    expect(preview.errors.map((error) => error.message).join("\n")).not.toContain(
      "prompt-batch.json could not be parsed",
    );

    expect(shellCallback).not.toHaveBeenCalled();
    expect(codexCallback).not.toHaveBeenCalled();
    expect(sqliteCallback).not.toHaveBeenCalled();
    expect(terminalCallback).not.toHaveBeenCalled();
    expect(autorunCallback).not.toHaveBeenCalled();
  });

  it("keeps plain numbered Markdown files compatible with parser entries", () => {
    const preview = buildPromptPackImportPreview(
      parsePromptPackImportPlan([
        {
          path: "README.md",
          source: "test",
          text: "# Plain Numbered Pack",
        },
        {
          path: "prompt-batch.json",
          source: "test",
          text: JSON.stringify({
            dependency_policy: "explicit",
            items: [
              { id: "001", path: "001.md", title: "One" },
              {
                dependencies: ["001"],
                id: "002",
                path: "002.md",
                title: "Two",
              },
            ],
          }),
        },
        {
          path: "001.md",
          source: "test",
          text: "# One\n\nFirst body.",
        },
        {
          path: "002.md",
          source: "test",
          text: "# Two\n\nSecond body.",
        },
      ]),
    );

    expect(preview.importAvailable).toBe(true);
    expect(preview.selectedItems.map((item) => item.id)).toEqual(["001", "002"]);
    expect(preview.selectedItems[0].promptBody).toContain("First body.");
    expect(preview.selectedItems[1].promptBody).toContain("Second body.");
    expect(preview.selectedItems[1].dependencies).toEqual(["001"]);
  });

  it("reports item-level errors when a manifest references a missing prompt file", () => {
    const preview = buildPromptPackImportPreview(
      parsePromptPackImportPlan([
        {
          path: "prompt-batch.json",
          source: "test",
          text: JSON.stringify({
            items: [
              {
                id: "001",
                path: "001.md",
                title: "Missing body",
              },
            ],
          }),
        },
      ]),
    );

    expect(preview.importAvailable).toBe(false);
    expect(preview.errors).toContainEqual(
      expect.objectContaining({
        code: "missing_body",
        itemId: "001",
      }),
    );
  });
});
