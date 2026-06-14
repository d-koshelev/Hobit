import { describe, expect, it } from "vitest";

import {
  buildPromptPackImportPreview,
  promptPackPreviewFromSourceText,
} from "../promptPack/promptPackImportPreview";
import { parsePromptPackImportPlan } from "../promptPack/promptPackParser";
import {
  buildSmartQueueMaterializationFromPromptPackPreview,
  promptPackPreviewToSmartQueuePromptPackInput,
} from "./smartQueuePromptPackPreviewAdapter";

describe("smartQueuePromptPackPreviewAdapter", () => {
  it("adds Smart Queue materialization to the active prompt-pack preview", () => {
    const preview = promptPackPreviewFromSourceText(
      JSON.stringify({
        id: "active-pack",
        items: [{ id: "001", prompt: "Do the work.", title: "One" }],
        name: "Active Pack",
      }),
    );

    expect(preview?.smartQueueMaterialization.queue).toMatchObject({
      queueId: "workspace-queue",
      singleton: true,
      singletonKey: "workspace-queue",
    });
    expect(preview?.smartQueueMaterialization.tasks).toHaveLength(1);
    expect(preview?.smartQueueMaterialization.tasks[0]).toMatchObject({
      humanStatus: { label: "Ready", status: "ready" },
      prompt: "Do the work.",
      wouldStart: false,
    });
  });

  it("previews one prompt as one Ready task", () => {
    const preview = previewFromItems([
      { id: "001", prompt: "First prompt.", title: "First" },
    ]);

    expect(preview.smartQueueMaterialization.summary).toMatchObject({
      blockedTaskCount: 0,
      dependencyCount: 0,
      readyTaskCount: 1,
      taskCount: 1,
      waitingDependencyCount: 0,
    });
    expect(preview.smartQueueMaterialization.tasks[0]?.humanStatus.label).toBe(
      "Ready",
    );
  });

  it("previews three sequential prompts as Ready then Waiting dependency tasks", () => {
    const preview = previewFromItems([
      { id: "001", prompt: "First.", title: "First" },
      { dependencies: ["001"], id: "002", prompt: "Second.", title: "Second" },
      { dependencies: ["002"], id: "003", prompt: "Third.", title: "Third" },
    ]);

    expect(
      preview.smartQueueMaterialization.dependencies.map((dependency) => [
        dependency.sourceDependencyReference,
        dependency.sourceDownstreamPromptId,
      ]),
    ).toEqual([
      ["001", "002"],
      ["002", "003"],
    ]);
    expect(
      preview.smartQueueMaterialization.tasks.map((task) => task.humanStatus.label),
    ).toEqual(["Ready", "Waiting dependency", "Waiting dependency"]);
    expect(preview.smartQueueMaterialization.summary).toMatchObject({
      dependencyCount: 2,
      readyTaskCount: 1,
      waitingDependencyCount: 2,
    });
  });

  it("applies pack default settings and lets per-prompt settings override them", () => {
    const preview = previewFromItems([
      { id: "defaulted", prompt: "Use defaults.", title: "Defaulted" },
      {
        id: "override",
        modelProfile: "strong",
        prompt: "Use prompt settings.",
        reasoningEffort: "high",
        title: "Override",
        validationCommands: ["npm.cmd run typecheck"],
        validatorProfile: "strict",
      },
    ]);
    const materialization = buildSmartQueueMaterializationFromPromptPackPreview(
      preview,
      {
        defaultSettings: {
          executionWorkspace: "C:/repo",
          model: "default-model",
          reasoning: "medium",
          validationPolicy: {
            commands: ["npm.cmd run test"],
            profile: "default",
          },
        },
      },
    );

    expect(materialization.tasks[0]?.settings).toMatchObject({
      executionWorkspace: "C:/repo",
      model: "default-model",
      reasoning: "medium",
      validationPolicy: {
        commands: ["npm.cmd run test"],
        profile: "default",
      },
    });
    expect(materialization.tasks[1]?.settings).toMatchObject({
      executionWorkspace: "C:/repo",
      model: "strong",
      reasoning: "high",
      validationPolicy: {
        commands: ["npm.cmd run typecheck"],
        profile: "strict",
      },
    });
  });

  it("surfaces empty prompt bodies as Blocked: missing prompt", () => {
    const preview = previewFromItems([
      { id: "empty", prompt: "", title: "Empty prompt" },
    ]);
    const task = preview.smartQueueMaterialization.tasks[0];

    expect(preview.importAvailable).toBe(false);
    expect(task?.humanStatus.label).toBe("Blocked: missing prompt");
    expect(preview.smartQueueMaterialization.issues).toContainEqual(
      expect.objectContaining({
        code: "missing_prompt",
        reason: "Blocked: missing prompt",
        sourcePromptId: "empty",
      }),
    );
  });

  it("surfaces missing dependencies as Blocked: missing dependency", () => {
    const preview = previewFromItems([
      {
        dependencies: ["missing"],
        id: "dependent",
        prompt: "Needs missing upstream.",
        title: "Dependent",
      },
    ]);
    const task = preview.smartQueueMaterialization.tasks[0];

    expect(preview.importAvailable).toBe(false);
    expect(task?.humanStatus.label).toBe("Blocked: missing dependency");
    expect(preview.smartQueueMaterialization.issues).toContainEqual(
      expect.objectContaining({
        code: "missing_dependency",
        reason: "Blocked: missing dependency",
        sourcePromptId: "dependent",
      }),
    );
  });

  it("surfaces circular dependency issues when the pure model supports them", () => {
    const preview = previewFromItems([
      { dependencies: ["002"], id: "001", prompt: "First.", title: "First" },
      { dependencies: ["001"], id: "002", prompt: "Second.", title: "Second" },
    ]);

    expect(preview.importAvailable).toBe(false);
    expect(
      preview.smartQueueMaterialization.tasks.map((task) => task.humanStatus.label),
    ).toEqual(["Blocked: circular dependency", "Blocked: circular dependency"]);
    expect(preview.smartQueueMaterialization.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "circular_dependency",
          reason: "Blocked: circular dependency",
          sourcePromptId: "001",
        }),
        expect.objectContaining({
          code: "circular_dependency",
          reason: "Blocked: circular dependency",
          sourcePromptId: "002",
        }),
      ]),
    );
  });

  it("reports graph-only preview with no task start or Queue widget creation operations", () => {
    const preview = previewFromItems([
      { id: "001", prompt: "First prompt.", title: "First" },
    ]);
    const smartQueueInput = promptPackPreviewToSmartQueuePromptPackInput(preview);

    expect(preview.smartQueueMaterialization.wouldStartTasks).toBe(false);
    expect(
      preview.smartQueueMaterialization.tasks.every(
        (task) => task.wouldStart === false,
      ),
    ).toBe(true);
    expect(preview.smartQueueMaterialization.queue).toMatchObject({
      queueId: "workspace-queue",
      singleton: true,
      singletonKey: "workspace-queue",
      scope: "workspace",
    });
    expect("queueWidgetOperations" in preview.smartQueueMaterialization).toBe(false);
    expect("queueViewOperations" in preview.smartQueueMaterialization).toBe(false);
    expect("createdWidgetIds" in preview.smartQueueMaterialization).toBe(false);
    expect(smartQueueInput.prompts).toHaveLength(1);
  });
});

function previewFromItems(items: readonly Record<string, unknown>[]) {
  return buildPromptPackImportPreview(
    parsePromptPackImportPlan([
      {
        path: "prompt-batch.json",
        text: JSON.stringify({
          dependencyPolicy: "explicit_only",
          id: "adapter-pack",
          items,
          name: "Adapter Pack",
        }),
      },
    ]),
  );
}
