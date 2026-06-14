import { describe, expect, it } from "vitest";

import {
  SMART_QUEUE_WORKSPACE_QUEUE_ID,
  materializeSmartQueuePromptPack,
  type SmartQueuePromptInput,
  type SmartQueuePromptPackInput,
} from "./smartQueuePromptPackMaterialization";

describe("smartQueuePromptPackMaterialization", () => {
  it("materializes one prompt with no dependencies as one Ready task", () => {
    const preview = materializeSmartQueuePromptPack(pack([prompt("001")]));

    expect(preview.queue).toMatchObject({
      queueId: SMART_QUEUE_WORKSPACE_QUEUE_ID,
      scope: "workspace",
      singleton: true,
      singletonKey: "workspace-queue",
    });
    expect(preview.tasks).toHaveLength(1);
    expect(preview.tasks[0]).toMatchObject({
      dependencyGate: { gate: "none" },
      humanStatus: { label: "Ready", status: "ready", text: "Ready" },
      order: 1,
      prompt: "Do prompt 001.",
      queueId: SMART_QUEUE_WORKSPACE_QUEUE_ID,
      title: "Prompt 001",
      wouldStart: false,
    });
    expect(preview.summary).toEqual({
      blockedTaskCount: 0,
      dependencyCount: 0,
      readyTaskCount: 1,
      taskCount: 1,
      waitingDependencyCount: 0,
    });
  });

  it("materializes three sequential prompts as dependencies 001 -> 002 -> 003", () => {
    const preview = materializeSmartQueuePromptPack(
      pack([
        prompt("001"),
        prompt("002", { dependencies: ["001"] }),
        prompt("003", { dependencies: ["002"] }),
      ]),
    );

    expect(preview.dependencies.map((dependency) => dependency.dependencyId)).toEqual([
      "queue-task-smart-pack-001->queue-task-smart-pack-002",
      "queue-task-smart-pack-002->queue-task-smart-pack-003",
    ]);
    expect(preview.dependencies).toEqual([
      expect.objectContaining({
        downstreamTaskId: "queue-task-smart-pack-002",
        kind: "blocks_start",
        sourceDependencyReference: "001",
        upstreamTaskId: "queue-task-smart-pack-001",
      }),
      expect.objectContaining({
        downstreamTaskId: "queue-task-smart-pack-003",
        kind: "blocks_start",
        sourceDependencyReference: "002",
        upstreamTaskId: "queue-task-smart-pack-002",
      }),
    ]);
    expect(preview.tasks.map((task) => task.upstreamTaskIds)).toEqual([
      [],
      ["queue-task-smart-pack-001"],
      ["queue-task-smart-pack-002"],
    ]);
  });

  it("keeps dependent prompts Waiting dependency, not Blocked", () => {
    const preview = materializeSmartQueuePromptPack(
      pack([prompt("001"), prompt("002", { dependencies: ["001"] })]),
    );

    expect(preview.tasks[1]).toMatchObject({
      blockedReason: undefined,
      dependencyGate: {
        gate: "waiting",
        waitingTaskIds: ["queue-task-smart-pack-001"],
      },
      humanStatus: {
        label: "Waiting dependency",
        status: "waiting_dependency",
        text: "Waiting for: queue-task-smart-pack-001",
      },
      lifecycle: "ready",
    });
  });

  it("applies pack default settings to all tasks", () => {
    const preview = materializeSmartQueuePromptPack(
      pack([prompt("001"), prompt("002")], {
        defaultSettings: {
          approvalPolicy: "on-request",
          commitPolicy: { mode: "operator_review" },
          executionWorkspace: "C:/repo",
          model: "gpt-5.5",
          reasoning: "high",
          sandbox: "workspace-write",
          validationPolicy: { commands: ["npm test"], profile: "changed" },
        },
      }),
    );

    expect(preview.tasks.map((task) => task.settings)).toEqual([
      expect.objectContaining({
        approvalPolicy: "on-request",
        commitPolicy: { mode: "operator_review" },
        executionWorkspace: "C:/repo",
        model: "gpt-5.5",
        reasoning: "high",
        sandbox: "workspace-write",
        validationPolicy: { commands: ["npm test"], profile: "changed" },
      }),
      expect.objectContaining({
        approvalPolicy: "on-request",
        commitPolicy: { mode: "operator_review" },
        executionWorkspace: "C:/repo",
        model: "gpt-5.5",
        reasoning: "high",
        sandbox: "workspace-write",
        validationPolicy: { commands: ["npm test"], profile: "changed" },
      }),
    ]);
  });

  it("lets per-prompt settings override pack defaults", () => {
    const preview = materializeSmartQueuePromptPack(
      pack(
        [
          prompt("001", {
            settings: {
              approvalPolicy: "never",
              model: "gpt-5.5-codex",
              validationPolicy: { commands: ["npm run typecheck"], profile: "fast" },
            },
          }),
        ],
        {
          defaultSettings: {
            approvalPolicy: "on-request",
            model: "gpt-5.5",
            reasoning: "medium",
            validationPolicy: { commands: ["npm test"], profile: "changed" },
          },
        },
      ),
    );

    expect(preview.tasks[0].settings).toMatchObject({
      approvalPolicy: "never",
      model: "gpt-5.5-codex",
      reasoning: "medium",
      validationPolicy: { commands: ["npm run typecheck"], profile: "fast" },
    });
  });

  it("preserves source prompt metadata", () => {
    const preview = materializeSmartQueuePromptPack(
      pack(
        [
          prompt("analysis", {
            promptNumber: 7,
            sourceName: "007-analysis.md",
            sourcePath: "packs/smart/007-analysis.md",
          }),
        ],
        {
          sourceName: "Smart Pack",
          sourcePackId: "source-pack",
          sourcePath: "packs/smart",
        },
      ),
    );

    expect(preview.tasks[0].source).toEqual({
      packId: "source-pack",
      packName: "Smart Pack",
      packPath: "packs/smart",
      promptId: "analysis",
      promptNumber: 7,
      sourceName: "007-analysis.md",
      sourcePath: "packs/smart/007-analysis.md",
    });
  });

  it("creates Blocked: missing prompt for an empty prompt body", () => {
    const preview = materializeSmartQueuePromptPack(
      pack([prompt("001", { body: "   " })]),
    );

    expect(preview.tasks[0]).toMatchObject({
      blockedReason: "Blocked: missing prompt",
      blockers: [{ kind: "missing_prompt", reason: "missing prompt" }],
      humanStatus: {
        label: "Blocked: missing prompt",
        status: "blocked",
        text: "Blocked: missing prompt",
      },
      lifecycle: "blocked",
    });
    expect(preview.issues).toContainEqual(
      expect.objectContaining({
        code: "missing_prompt",
        reason: "Blocked: missing prompt",
        sourcePromptId: "001",
      }),
    );
  });

  it("creates Blocked: missing dependency for a missing dependency reference", () => {
    const preview = materializeSmartQueuePromptPack(
      pack([prompt("002", { dependencies: ["missing"] })]),
    );

    expect(preview.dependencies).toEqual([]);
    expect(preview.tasks[0]).toMatchObject({
      blockedReason: "Blocked: missing dependency",
      blockers: [{ kind: "missing_config", reason: "missing dependency" }],
      humanStatus: {
        label: "Blocked: missing dependency",
        status: "blocked",
        text: "Blocked: missing dependency",
      },
      requestedDependencyReferences: ["missing"],
    });
    expect(preview.issues).toContainEqual(
      expect.objectContaining({
        code: "missing_dependency",
        reason: "Blocked: missing dependency",
        sourcePromptId: "002",
      }),
    );
  });

  it("creates product-facing circular dependency issues", () => {
    const preview = materializeSmartQueuePromptPack(
      pack([
        prompt("001", { dependencies: ["002"] }),
        prompt("002", { dependencies: ["001"] }),
      ]),
    );

    expect(preview.dependencies).toHaveLength(2);
    expect(preview.tasks.map((task) => task.humanStatus.text)).toEqual([
      "Blocked: circular dependency",
      "Blocked: circular dependency",
    ]);
    expect(preview.issues).toEqual(
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

  it("does not create Queue widget/view creation operations or auto-run tasks", () => {
    const preview = materializeSmartQueuePromptPack(pack([prompt("001")]));

    expect(preview.wouldStartTasks).toBe(false);
    expect(preview.tasks.every((task) => task.wouldStart === false)).toBe(true);
    expect("queueWidgetOperations" in preview).toBe(false);
    expect("queueViewOperations" in preview).toBe(false);
    expect("createdWidgetIds" in preview).toBe(false);
  });

  it("counts Ready, Waiting dependency, and Blocked tasks in the preview", () => {
    const preview = materializeSmartQueuePromptPack(
      pack([
        prompt("001"),
        prompt("002", { dependencies: ["001"] }),
        prompt("003", { body: "" }),
      ]),
    );

    expect(preview.summary).toEqual({
      blockedTaskCount: 1,
      dependencyCount: 1,
      readyTaskCount: 1,
      taskCount: 3,
      waitingDependencyCount: 1,
    });
  });

  it("keeps smartQueueEligibility human status integration stable", () => {
    const preview = materializeSmartQueuePromptPack(
      pack([prompt("001"), prompt("002", { dependencies: ["001"] })]),
    );

    expect(preview.tasks.map((task) => task.humanStatus)).toEqual([
      {
        label: "Ready",
        reason: undefined,
        status: "ready",
        text: "Ready",
      },
      {
        label: "Waiting dependency",
        reason: "Waiting for: queue-task-smart-pack-001",
        status: "waiting_dependency",
        text: "Waiting for: queue-task-smart-pack-001",
      },
    ]);
  });
});

function pack(
  prompts: readonly SmartQueuePromptInput[],
  overrides: Partial<SmartQueuePromptPackInput> = {},
): SmartQueuePromptPackInput {
  return {
    prompts,
    sourceName: "Smart Pack",
    sourcePackId: "smart-pack",
    sourcePath: "packs/smart",
    ...overrides,
  };
}

function prompt(
  promptId: string,
  overrides: Partial<SmartQueuePromptInput> = {},
): SmartQueuePromptInput {
  return {
    body: `Do prompt ${promptId}.`,
    promptId,
    title: `Prompt ${promptId}`,
    ...overrides,
  };
}
