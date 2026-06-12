import { describe, expect, it } from "vitest";

import { parsePromptPackImportPlan } from "./promptPackParser";
import type { PromptPackFileEntry } from "./promptPackModel";
import { selfDevelopmentSmokePromptPackEntries } from "./selfDevelopmentSmokePromptPackFixture.test-fixtures";

describe("prompt pack parser", () => {
  it("parses prompt-batch.json items into normalized import drafts", () => {
    const plan = parsePromptPackImportPlan([
      {
        name: "prompt-batch.json",
        text: JSON.stringify({
          id: "core-model-batch-001",
          name: "Core Model Batch",
          items: [
            {
              id: "PROMPT-PACK-PARSER-MODEL-01",
              title: "Add prompt-pack parser",
              prompt: "Implement parser exactly.\n\nKeep bodies intact.",
              modelProfile: "strong",
              reasoningEffort: "medium",
              validatorProfile: "standard",
              tags: ["queue", "parser"],
              priority: 4,
              dependencies: ["PROMPT-PACK-AUDIT-00"],
              executionWorkspace: "C:/Users/Dmitry/Documents/prj/Hobit_fixed",
              expectedCommitTitle: "frontend: add prompt pack parser",
              validationCommands: ["npm.cmd run typecheck --prefix apps/desktop/frontend"],
              allowedScope: ["apps/desktop/frontend/src/workbench/promptPack"],
              forbiddenScope: ["backend storage"],
            },
          ],
        }),
      },
    ]);

    expect(plan.pack).toMatchObject({
      id: "core-model-batch-001",
      name: "Core Model Batch",
    });
    expect(plan.items).toHaveLength(1);
    expect(plan.items[0]).toMatchObject({
      allowedScope: ["apps/desktop/frontend/src/workbench/promptPack"],
      dependencies: ["prompt-pack-audit-00"],
      executionWorkspace: "C:/Users/Dmitry/Documents/prj/Hobit_fixed",
      expectedCommitTitle: "frontend: add prompt pack parser",
      forbiddenScope: ["backend storage"],
      id: "prompt-pack-parser-model-01",
      modelProfile: "strong",
      priority: 4,
      reasoningEffort: "medium",
      tags: ["queue", "parser"],
      title: "Add prompt-pack parser",
      validationCommands: ["npm.cmd run typecheck --prefix apps/desktop/frontend"],
      validatorProfile: "standard",
    });
    expect(plan.items[0].promptBody).toBe(
      "Implement parser exactly.\n\nKeep bodies intact.",
    );
    expect(plan.items[0].queueDraft.status).toBe("draft");
    expect(plan.items[0].queueDraft.executionPolicy).toBe("manual");
    expect(plan.errors.map((error) => error.code)).toContain(
      "unresolved_dependency",
    );
  });

  it("parses numbered markdown files and suggests numeric dependencies", () => {
    const plan = parsePromptPackImportPlan([
      {
        path: "prompts/core/README.md",
        text: "# Core Prompt Pack\n",
      },
      {
        path: "prompts/core/001-first-task.md",
        text: "# First task\n\nDo the first thing.\n",
      },
      {
        path: "prompts/core/016.001-second-task.md",
        text: "# Second task\n\nDo the second thing.\n",
      },
    ]);

    expect(plan.pack.name).toBe("Core Prompt Pack");
    expect(plan.items.map((item) => item.id)).toEqual(["001", "016.001"]);
    expect(plan.items[1]).toMatchObject({
      suggestedDependencyIds: ["001"],
      title: "Second task",
    });
    expect(plan.warnings.map((warning) => warning.code)).toContain(
      "numeric_dependency_suggestion",
    );
  });

  it("uses explicit markdown headers without removing prompt body text", () => {
    const body = [
      "Model profile: strong",
      "Reasoning effort: high",
      "Validator profile: standard",
      "Tags: alpha, beta",
      "Priority: 5",
      "Dependencies: 001",
      "Expected commit title: frontend: wire parser",
      "Validation:",
      "- npm.cmd run typecheck --prefix apps/desktop/frontend",
      "- npm.cmd run test --prefix apps/desktop/frontend -- --run prompt pack",
      "Allowed scope:",
      "- frontend parser",
      "Forbidden scope:",
      "- queue creation",
      "",
      "# Header title",
      "",
      "Prompt body line one.",
      "Prompt body line two.",
    ].join("\n");

    const plan = parsePromptPackImportPlan([
      {
        path: "001-header-task.md",
        text: body,
      },
    ]);

    expect(plan.items[0]).toMatchObject({
      allowedScope: ["frontend parser"],
      dependencies: ["001"],
      expectedCommitTitle: "frontend: wire parser",
      forbiddenScope: ["queue creation"],
      modelProfile: "strong",
      priority: 5,
      reasoningEffort: "high",
      tags: ["alpha", "beta"],
      title: "Header title",
      validationCommands: [
        "npm.cmd run typecheck --prefix apps/desktop/frontend",
        "npm.cmd run test --prefix apps/desktop/frontend -- --run prompt pack",
      ],
      validatorProfile: "standard",
    });
    expect(plan.items[0].promptBody).toBe(body);
  });

  it("preserves markdown body exactly after optional front matter", () => {
    const exactBody = "# Title\n\nLine with trailing spaces.  \n\n```ts\nconst x = 1;\n```\n";
    const plan = parsePromptPackImportPlan([
      {
        path: "001-title.md",
        text: `---\nid: custom-id\nmodelProfile: ignored-by-header-parser\n---\n${exactBody}`,
      },
    ]);

    expect(plan.items[0].id).toBe("custom-id");
    expect(plan.items[0].modelProfile).toBe("ignored-by-header-parser");
    expect(plan.items[0].promptBody).toBe(exactBody);
  });

  it("reports duplicate ids and missing prompt bodies", () => {
    const plan = parsePromptPackImportPlan([
      {
        path: "001-empty.md",
        text: "",
      },
      {
        path: "prompt-batch.json",
        text: JSON.stringify({
          items: [{ id: "001", title: "Duplicate", prompt: "body" }],
        }),
      },
    ]);

    expect(plan.errors.map((error) => error.code)).toEqual(
      expect.arrayContaining(["duplicate_item_id", "missing_body"]),
    );
  });

  it("uses a valid folder manifest without keeping a stale duplicate parse error", () => {
    const plan = parsePromptPackImportPlan([
      {
        path: "prompts/prompt-batch.json",
        text: '{"name":"Bad duplicate"},{"name":"Not valid as one JSON document"}',
      },
      {
        path: "prompt-batch.json",
        text: JSON.stringify({
          name: "Valid Folder Pack",
          prompts: [
            { file: "001.md", id: "001", title: "One" },
            {
              dependencies: ["001"],
              file: "002.md",
              id: "002",
              title: "Two",
            },
          ],
        }),
      },
      { path: "001.md", text: "# One\n\nFirst body." },
      { path: "002.md", text: "# Two\n\nSecond body." },
    ]);

    expect(plan.items.map((item) => item.id)).toEqual(["001", "002"]);
    expect(plan.items[1].dependencies).toEqual(["001"]);
    expect(plan.errors).toEqual([]);
    expect(plan.diagnostics.map((diagnostic) => diagnostic.message).join("\n")).not.toContain(
      "prompt-batch.json could not be parsed",
    );
  });

  it("still reports a parse error when every manifest candidate is invalid", () => {
    const plan = parsePromptPackImportPlan([
      {
        path: "prompt-batch.json",
        text: '{"name":"Invalid"},{"items":[]}',
      },
    ]);

    expect(plan.errors).toContainEqual(
      expect.objectContaining({
        code: "invalid_json",
        path: "prompt-batch.json",
      }),
    );
  });

  it("resolves explicit dependencies and reports missing dependencies", () => {
    const plan = parsePromptPackImportPlan([
      {
        path: "prompt-batch.json",
        text: JSON.stringify({
          items: [
            { id: "001", title: "First", prompt: "first" },
            {
              id: "002",
              title: "Second",
              prompt: "second",
              dependsOn: ["001", "missing"],
            },
          ],
        }),
      },
    ]);

    expect(plan.items[1].dependencies).toEqual(["001", "missing"]);
    expect(plan.errors).toContainEqual(
      expect.objectContaining({
        code: "unresolved_dependency",
        itemId: "002",
      }),
    );
  });

  it("can harden numeric order when policy explicitly requests it", () => {
    const plan = parsePromptPackImportPlan(
      [
        { path: "001-one.md", text: "one" },
        { path: "002-two.md", text: "two" },
      ],
      { dependencyPolicy: "hard_numeric_order" },
    );

    expect(plan.items[1].dependencies).toEqual(["001"]);
    expect(plan.warnings.map((warning) => warning.code)).not.toContain(
      "numeric_dependency_suggestion",
    );
  });

  it("accepts hard numeric dependency policy from prompt-batch.json", () => {
    const plan = parsePromptPackImportPlan([
      {
        path: "prompt-batch.json",
        text: JSON.stringify({
          dependencyPolicy: "sequential",
        }),
      },
      { path: "001-one.md", text: "one" },
      { path: "002-two.md", text: "two" },
    ]);

    expect(plan.dependencyPolicy).toBe("hard_numeric_order");
    expect(plan.items[1].dependencies).toEqual(["001"]);
  });

  it("does not mutate input file entries", () => {
    const entries: PromptPackFileEntry[] = [
      {
        path: "001-title.md",
        size: 12,
        source: "test",
        text: "# Title\n\nBody",
      },
    ];
    const snapshot = JSON.stringify(entries);

    parsePromptPackImportPlan(entries);

    expect(JSON.stringify(entries)).toBe(snapshot);
  });

  it("parses the self-development smoke fixture with dependency and validation metadata", () => {
    const plan = parsePromptPackImportPlan(selfDevelopmentSmokePromptPackEntries);

    expect(plan.errors).toEqual([]);
    expect(plan.pack).toMatchObject({
      id: "hobit-self-development-smoke",
      name: "Hobit Self-Development Smoke",
    });
    expect(plan.items.map((item) => item.id)).toEqual([
      "001-safe-docs-noop",
      "002-dependent-follow-up",
    ]);

    const first = plan.items[0];
    expect(first).toMatchObject({
      expectedCommitTitle: "docs: smoke no-op readiness note",
      validationCommands: ["git status --short --branch", "git diff --check"],
      executionWorkspace: ".",
      modelProfile: "standard",
      reasoningEffort: "medium",
      validatorProfile: "standard",
    });
    expect(first.allowedScope).toContain(
      "apps/desktop/frontend/src/workbench/promptPack/fixtures/self-development-smoke-prompt-pack/**",
    );
    expect(first.forbiddenScope).toEqual(
      expect.arrayContaining([
        "apps/desktop/frontend/src/workbench/**/*.tsx",
        "apps/desktop/frontend/src/workbench/**/*.ts",
        "crates/**",
        "scripts/**",
      ]),
    );
    expect(first.promptBody).toContain("No auto-commit.");
    expect(first.promptBody).toContain("No auto-push.");
    expect(first.promptBody).toContain("No destructive commands.");
    expect(first.promptBody).toContain("No hidden execution.");
    expect(first.queueDraft.executionPolicy).toBe("manual");

    const second = plan.items[1];
    expect(second.dependencies).toEqual(["001-safe-docs-noop"]);
    expect(second.expectedCommitTitle).toBe(
      "docs: verify dependent readiness gate",
    );
    expect(second.validationCommands).toEqual([
      "git status --short --branch",
      "git diff --check",
    ]);
    expect(second.promptBody).toContain("no auto-run expectation");
    expect(second.promptBody).toContain("No auto-commit.");
    expect(second.promptBody).toContain("No auto-push.");
    expect(second.promptBody).toContain("No destructive commands.");
    expect(second.promptBody).toContain("No hidden execution.");
    expect(second.queueDraft.executionPolicy).toBe("manual");
  });
});
