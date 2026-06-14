import { describe, expect, it } from "vitest";

import { buildPromptPackImportPreview } from "../promptPack/promptPackImportPreview";
import { parsePromptPackImportPlan } from "../promptPack/promptPackParser";
import {
  WORKSPACE_QUEUE_SINGLETON_ID,
  buildQueueBatchMaterializationResult,
  type PromptPackImportInput,
} from "./queuePromptPackMaterializationModel";

describe("Queue prompt-pack materialization model", () => {
  it("materializes a simple linear pack into tasks and dependency edges", () => {
    const result = buildQueueBatchMaterializationResult(
      inputFromManifest({
        items: [
          promptItem("setup", { order: 1, prompt: "Setup work.", title: "Setup" }),
          promptItem("build", {
            dependencies: ["setup"],
            order: 2,
            prompt: "Build work.",
            title: "Build",
          }),
        ],
      }),
    );

    expect(result.wouldStartWorkers).toBe(false);
    expect(result.batch.tasks.map((task) => task.taskId)).toEqual([
      "queue-task-smart-pack-setup",
      "queue-task-smart-pack-build",
    ]);
    expect(result.batch.dependencies).toEqual([
      {
        createdBy: "queue_importer",
        dependencyId:
          "queue-task-smart-pack-setup->queue-task-smart-pack-build",
        downstreamTaskId: "queue-task-smart-pack-build",
        kind: "blocks_start",
        sourceDependencyItemId: "setup",
        sourceDownstreamItemId: "build",
        upstreamTaskId: "queue-task-smart-pack-setup",
      },
    ]);
    expect(result.readyCandidates.map((task) => task.source.itemId)).toEqual([
      "setup",
    ]);
    expect(
      result.waitingDependencyCandidates.map((task) => task.source.itemId),
    ).toEqual(["build"]);
    expect(result.batch.tasks[0]).toMatchObject({
      dependencyGate: "none",
      humanStatus: "ready",
      upstreamTaskIds: [],
    });
    expect(result.batch.tasks[1]).toMatchObject({
      dependencyGate: "waiting",
      humanStatus: "waiting_dependency",
      upstreamTaskIds: ["queue-task-smart-pack-setup"],
    });
  });

  it("materializes independent tasks as multiple ready candidates", () => {
    const result = buildQueueBatchMaterializationResult(
      inputFromManifest({
        items: [
          promptItem("docs", { prompt: "Docs work.", title: "Docs" }),
          promptItem("tests", { prompt: "Tests work.", title: "Tests" }),
        ],
      }),
    );

    expect(result.batch.dependencies).toEqual([]);
    expect(result.readyCandidates.map((task) => task.source.itemId)).toEqual([
      "docs",
      "tests",
    ]);
    expect(result.waitingDependencyCandidates).toEqual([]);
  });

  it("preserves prompt settings, source metadata, and policies in task drafts", () => {
    const result = buildQueueBatchMaterializationResult(
      inputFromManifest(
        {
          items: [
            promptItem("configured", {
              expectedCommitTitle: "frontend: keep settings",
              model: "gpt-5.5",
              prompt: "Configured work.",
              reasoningEffort: "high",
              source: "001-configured.md",
              tags: ["queue", "prompt-pack"],
              title: "Configured",
              validationCommands: ["npm run test -- --run Queue"],
              validatorProfile: "changed",
            }),
          ],
        },
        {
          defaults: {
            approvalPolicy: "never",
            executionWorkspace: "C:/repo",
            provider: "codex",
            sandbox: "workspace_write",
          },
        },
      ),
    );

    expect(result.batch.tasks[0]).toMatchObject({
      prompt: expect.stringContaining("Configured work."),
      settings: {
        approvalPolicy: "never",
        commitPolicy: {
          expectedCommitTitle: "frontend: keep settings",
          mode: "operator_review",
        },
        executionWorkspace: "C:/repo",
        model: "gpt-5.5",
        provider: "codex",
        reasoning: "high",
        sandbox: "workspace_write",
        validationPolicy: {
          commands: ["npm run test -- --run Queue"],
          profile: "changed",
        },
      },
      source: {
        itemId: "configured",
        packId: "smart-pack",
        packName: "Smart Pack",
        promptFileOrder: 1,
        sourcePath: "001-configured.md",
        tags: ["queue", "prompt-pack"],
      },
    });
    expect(result.batch.settingsSummary).toMatchObject({
      approvalPolicies: ["never"],
      commitPolicies: ["operator_review"],
      models: ["gpt-5.5"],
      providers: ["codex"],
      reasoning: ["high"],
      sandboxes: ["workspace_write"],
      validationProfiles: ["changed"],
    });
  });

  it("marks invalid dependencies as missing_config blockers and validation errors", () => {
    const result = buildQueueBatchMaterializationResult(
      inputFromManifest({
        items: [
          promptItem("blocked", {
            dependencies: ["missing"],
            prompt: "Blocked work.",
            title: "Blocked",
          }),
        ],
      }),
    );

    expect(result.batch.dependencies).toEqual([]);
    expect(result.blockedTasks.map((task) => task.source.itemId)).toEqual([
      "blocked",
    ]);
    expect(result.batch.tasks[0]).toMatchObject({
      blocker: {
        kind: "missing_config",
        message:
          'Prompt-pack item "blocked" depends on missing item "missing".',
      },
      humanStatus: "blocked",
    });
    expect(result.errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          blockerKind: "missing_config",
          code: "invalid_dependency",
          itemId: "blocked",
        }),
        expect.objectContaining({
          blockerKind: "missing_config",
          code: "preview_blocked",
          itemId: "blocked",
        }),
      ]),
    );
  });

  it("represents Queue Active preview warning without starting tasks", () => {
    const result = buildQueueBatchMaterializationResult(
      inputFromManifest(
        {
          items: [promptItem("ready", { prompt: "Ready work.", title: "Ready" })],
        },
        { queueState: "active" },
      ),
    );

    expect(result.batch.queue).toEqual({
      id: WORKSPACE_QUEUE_SINGLETON_ID,
      isActive: true,
      state: "active",
    });
    expect(result.batch.productWarnings).toEqual([
      "Queue is Active. Eligible imported tasks may start after creation when the scheduler evaluates the completed graph.",
    ]);
    expect(result.warnings).toContainEqual(
      expect.objectContaining({ code: "queue_active_import_warning" }),
    );
    expect(result.readyCandidates.map((task) => task.source.itemId)).toEqual([
      "ready",
    ]);
    expect(result.wouldStartWorkers).toBe(false);
  });

  it("requires the singleton Workspace Queue target", () => {
    const input = inputFromManifest({
      items: [promptItem("ready", { prompt: "Ready work.", title: "Ready" })],
    });
    const result = buildQueueBatchMaterializationResult({
      ...input,
      queue: { id: "queue-v2", state: "paused" },
    } as unknown as PromptPackImportInput);

    expect(result.batch.queue.id).toBe(WORKSPACE_QUEUE_SINGLETON_ID);
    expect(result.errors).toContainEqual(
      expect.objectContaining({ code: "singleton_queue_required" }),
    );
    expect(result.wouldStartWorkers).toBe(false);
  });
});

function inputFromManifest(
  manifest: { items: unknown[] },
  options: {
    defaults?: PromptPackImportInput["defaults"];
    queueState?: PromptPackImportInput["queue"]["state"];
  } = {},
): PromptPackImportInput {
  return {
    defaults: options.defaults,
    preview: buildPromptPackImportPreview(
      parsePromptPackImportPlan([
        {
          path: "prompt-batch.json",
          text: JSON.stringify({
            dependencyPolicy: "explicit_only",
            id: "smart-pack",
            name: "Smart Pack",
            ...manifest,
          }),
        },
      ]),
    ),
    queue: {
      id: WORKSPACE_QUEUE_SINGLETON_ID,
      state: options.queueState ?? "paused",
    },
  };
}

function promptItem(
  id: string,
  options: {
    dependencies?: string[];
    expectedCommitTitle?: string;
    model?: string;
    order?: number;
    prompt: string;
    reasoningEffort?: string;
    source?: string;
    tags?: string[];
    title: string;
    validationCommands?: string[];
    validatorProfile?: string;
  },
) {
  return {
    dependencies: options.dependencies,
    expectedCommitTitle: options.expectedCommitTitle,
    id,
    model: options.model,
    order: options.order,
    prompt: options.prompt,
    reasoningEffort: options.reasoningEffort,
    source: options.source,
    tags: options.tags,
    title: options.title,
    validationCommands: options.validationCommands,
    validatorProfile: options.validatorProfile,
  };
}
