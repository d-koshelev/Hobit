import { describe, expect, it } from "vitest";

import { parsePromptPackImportPlan } from "./promptPackParser";
import {
  PROMPT_PACK_FOLDER_OR_ZIP_SOURCE_STATUS,
  buildPromptPackImportPreview,
  promptPackEntriesFromKnowledgeImportFiles,
  validatePromptPackImportPlan,
} from "./index";

describe("prompt pack import preview service", () => {
  it("keeps stable item, command, commit, and model route ordering", () => {
    const preview = buildPromptPackImportPreview(
      parsePromptPackImportPlan([
        {
          path: "002-two.md",
          text: [
            "Model profile: strong",
            "Reasoning effort: medium",
            "Validator profile: standard",
            "Expected commit title: frontend: second",
            "Validation: npm.cmd run typecheck --prefix apps/desktop/frontend",
            "",
            "# Second",
            "",
            "Second body.",
          ].join("\n"),
        },
        {
          path: "001-one.md",
          text: [
            "Model profile: fast",
            "Reasoning effort: low",
            "Validator profile: quick",
            "Expected commit title: frontend: first",
            "Validation: npm.cmd run build --prefix apps/desktop/frontend",
            "",
            "# First",
            "",
            "First body.",
          ].join("\n"),
        },
      ]),
    );

    expect(preview.selectedItemIds).toEqual(["001", "002"]);
    expect(preview.expectedCommitTitles).toEqual([
      "frontend: first",
      "frontend: second",
    ]);
    expect(preview.validationCommands).toEqual([
      "npm.cmd run build --prefix apps/desktop/frontend",
      "npm.cmd run typecheck --prefix apps/desktop/frontend",
    ]);
    expect(
      preview.modelRouting.map(
        (route) =>
          `${route.modelProfile}/${route.reasoningEffort}/${route.validatorProfile}`,
      ),
    ).toEqual(["fast/low/quick", "strong/medium/standard"]);
  });

  it("treats parser errors and unselected dependencies as blocking", () => {
    const plan = parsePromptPackImportPlan([
      {
        path: "prompt-batch.json",
        text: JSON.stringify({
          items: [
            { id: "one", prompt: "one" },
            { id: "two", dependencies: ["one", "missing"], prompt: "two" },
          ],
        }),
      },
    ]);
    const validation = validatePromptPackImportPlan(plan, {
      selectedItemIds: ["two"],
    });

    expect(validation.canImport).toBe(false);
    expect(validation.blockingErrors.map((error) => error.code)).toEqual(
      expect.arrayContaining(["unresolved_dependency", "unselected_dependency"]),
    );
  });

  it("keeps numeric dependency suggestions as nonblocking warnings", () => {
    const preview = buildPromptPackImportPreview(
      parsePromptPackImportPlan([
        { path: "001-one.md", text: "one" },
        { path: "002-two.md", text: "two" },
      ]),
    );

    expect(preview.importAvailable).toBe(true);
    expect(preview.warnings.map((warning) => warning.code)).toContain(
      "numeric_dependency_suggestion",
    );
    expect(preview.errors).toHaveLength(0);
  });

  it("honors selected items and summarizes dependency graph shape", () => {
    const preview = buildPromptPackImportPreview(
      parsePromptPackImportPlan([
        {
          path: "prompt-batch.json",
          text: JSON.stringify({
            dependencyPolicy: "explicit_only",
            items: [
              { id: "setup", order: 1, prompt: "setup" },
              { id: "build", dependencies: ["setup"], order: 2, prompt: "build" },
              { id: "docs", order: 3, prompt: "docs" },
            ],
          }),
        },
      ]),
      { selectedItemIds: ["setup", "build"] },
    );

    expect(preview.selectedItemIds).toEqual(["setup", "build"]);
    expect(preview.unselectedItems.map((item) => item.id)).toEqual(["docs"]);
    expect(preview.dependencyGraphSummary).toMatchObject({
      blockedSelectedItemCount: 0,
      edgeCount: 1,
      hasCycles: false,
      maxDepth: 2,
      rootItemCount: 2,
      selectedItemCount: 2,
      totalItemCount: 3,
      unresolvedDependencyCount: 0,
    });
  });

  it("exposes typed folder source status without creating Queue items", () => {
    const preview = buildPromptPackImportPreview(
      parsePromptPackImportPlan([{ path: "001-one.md", text: "one" }]),
      { sourceAdapter: PROMPT_PACK_FOLDER_OR_ZIP_SOURCE_STATUS },
    );

    expect(preview.sourceAdapter.kind).toBe("available");
    expect(preview.sourceAdapter.message).toContain("No Queue items are created");
  });

  it("adapts explicit Knowledge import file results into parser entries", () => {
    const entries = promptPackEntriesFromKnowledgeImportFiles([
      {
        content: "# One\n\nBody",
        fileName: "001-one.md",
        title: "One",
      },
    ]);

    expect(entries).toEqual([
      {
        name: "001-one.md",
        path: "001-one.md",
        source: "desktop-file",
        text: "# One\n\nBody",
      },
    ]);
  });
});
