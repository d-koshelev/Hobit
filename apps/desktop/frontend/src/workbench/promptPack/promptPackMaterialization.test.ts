import { describe, expect, it, vi } from "vitest";

import type { WorkspaceAgentQueueBridge } from "../workspaceAgentQueueBridge";
import type { QueueWidgetItemSnapshot } from "../queue/agentQueueWidgetApiTypes";
import { buildPromptPackImportPreview } from "./promptPackImportPreview";
import { materializePromptPackPreviewToQueue } from "./promptPackMaterialization";
import { parsePromptPackImportPlan } from "./promptPackParser";

describe("prompt pack Queue materialization service", () => {
  it("creates selected Queue tasks first, then links dependencies by created Queue ids", async () => {
    const preview = buildPromptPackImportPreview(
      parsePromptPackImportPlan([
        {
          path: "prompt-batch.json",
          text: JSON.stringify({
            dependencyPolicy: "explicit_only",
            id: "core-pack",
            name: "Core Pack",
            items: [
              {
                id: "setup",
                order: 1,
                priority: 4,
                prompt: "Setup prompt body.",
                tags: ["frontend", "queue"],
                title: "Setup task",
                validationCommands: ["npm.cmd run typecheck --prefix apps/desktop/frontend"],
              },
              {
                dependencies: ["setup"],
                executionWorkspace: "C:/work/hobit",
                expectedCommitTitle: "frontend: materialize prompt pack",
                id: "build",
                order: 2,
                prompt: "Build prompt body.",
                title: "Build task",
              },
            ],
          }),
        },
      ]),
    );
    const bridge = queueBridge();

    const result = await materializePromptPackPreviewToQueue({
      bridge,
      confirmed: true,
      preview,
    });

    expect(result.ok).toBe(true);
    expect(result.createdTasks).toEqual([
      { itemId: "setup", queueItemId: "queue-setup", title: "setup: Setup task" },
      { itemId: "build", queueItemId: "queue-build", title: "build: Build task" },
    ]);
    expect(bridge.createItem).toHaveBeenCalledTimes(2);
    expect(bridge.createItem).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        dependencies: [],
        priority: 4,
        queueTag: { name: "frontend" },
        status: "draft",
        title: "setup: Setup task",
      }),
    );
    expect(bridge.createItem).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        dependencies: [],
        executionWorkspace: "C:/work/hobit",
        prompt: expect.stringContaining("Build prompt body."),
        title: "build: Build task",
      }),
    );
    expect(bridge.updateItem).toHaveBeenCalledTimes(1);
    expect(bridge.updateItem).toHaveBeenCalledWith({
      itemId: "queue-build",
      patch: { dependencies: ["queue-setup"] },
      reason:
        "Materialize prompt-pack dependency links after creating all selected Queue items.",
    });
    expect(result.dependencyLinksCreated).toEqual([
      {
        dependencyItemId: "setup",
        dependencyQueueItemId: "queue-setup",
        dependentItemId: "build",
        dependentQueueItemId: "queue-build",
        status: "created",
      },
    ]);
  });

  it("preserves unsupported prompt-pack metadata in prompt text and reports warnings", async () => {
    const preview = buildPromptPackImportPreview(
      parsePromptPackImportPlan([
        {
          path: "001-metadata.md",
          text: [
            "Model profile: strong",
            "Reasoning effort: high",
            "Validator profile: standard",
            "Tags: alpha, beta",
            "Expected commit title: frontend: keep metadata",
            "Validation: npm.cmd run build --prefix apps/desktop/frontend",
            "Allowed scope: frontend only",
            "Forbidden scope: backend storage",
            "",
            "# Metadata",
            "",
            "Original body.",
          ].join("\n"),
        },
      ]),
    );
    const bridge = queueBridge();

    const result = await materializePromptPackPreviewToQueue({
      bridge,
      confirmed: true,
      preview,
    });

    const request = bridge.createItem.mock.calls[0]?.[0];
    expect(request?.prompt).toContain("Original body.");
    expect(request?.prompt).toContain("Prompt pack materialization metadata");
    expect(request?.prompt).toContain("Model profile: strong");
    expect(request?.prompt).toContain("Reasoning effort: high");
    expect(request?.prompt).toContain("Validator profile: standard");
    expect(request?.prompt).toContain("Expected commit title: frontend: keep metadata");
    expect(request?.prompt).toContain("Allowed scope");
    expect(request?.prompt).toContain("- frontend only");
    expect(request?.prompt).toContain("Forbidden scope");
    expect(request?.prompt).toContain("- backend storage");
    expect(result.warnings).toContainEqual(
      expect.objectContaining({
        code: "queue_metadata_field_unsupported",
        itemId: "001",
      }),
    );
  });

  it("does not call Queue run, start, or autorun controls while materializing", async () => {
    const preview = buildPromptPackImportPreview(
      parsePromptPackImportPlan([{ path: "001-one.md", text: "One body." }]),
    );
    const runAutonomousQueue = vi.fn();
    const stopAutonomousQueueAfterCurrent = vi.fn();
    const bridge = queueBridge({
      runAutonomousQueue,
      stopAutonomousQueueAfterCurrent,
    });

    await materializePromptPackPreviewToQueue({
      bridge,
      confirmed: true,
      preview,
    });

    expect(bridge.createItem).toHaveBeenCalledTimes(1);
    expect(bridge.updateItem).not.toHaveBeenCalled();
    expect(runAutonomousQueue).not.toHaveBeenCalled();
    expect(stopAutonomousQueueAfterCurrent).not.toHaveBeenCalled();
  });

  it("reports partial failure and skipped dependency links visibly", async () => {
    const preview = buildPromptPackImportPreview(
      parsePromptPackImportPlan([
        {
          path: "prompt-batch.json",
          text: JSON.stringify({
            dependencyPolicy: "explicit_only",
            items: [
              { id: "setup", prompt: "setup" },
              { dependencies: ["setup"], id: "build", prompt: "build" },
            ],
          }),
        },
      ]),
    );
    const bridge = queueBridge({
      createItem: vi.fn(async (request) => {
        if (request.title.startsWith("setup:")) {
          return {
            action: "queue.createItem" as const,
            error: { code: "create_failed", message: "setup failed" },
            events: [],
            message: "setup failed",
            ok: false,
            safetyClass: "safe_create_update" as const,
          };
        }

        return createResult(queueItem(request.title));
      }),
    });

    const result = await materializePromptPackPreviewToQueue({
      bridge,
      confirmed: true,
      preview,
    });

    expect(result.ok).toBe(false);
    expect(result.createdTasks).toEqual([
      { itemId: "build", queueItemId: "queue-build", title: "build: Build" },
    ]);
    expect(result.errors).toContainEqual(
      expect.objectContaining({
        code: "item_create_failed",
        itemId: "setup",
        message: "setup failed",
      }),
    );
    expect(result.warnings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "dependency_link_skipped",
          dependencyItemId: "setup",
          itemId: "build",
        }),
        expect.objectContaining({
          code: "queue_blocked_status_unsupported",
          dependencyItemId: "setup",
          itemId: "build",
        }),
      ]),
    );
    expect(result.dependencyLinksSkipped).toEqual([
      expect.objectContaining({
        dependencyItemId: "setup",
        dependentItemId: "build",
        dependentQueueItemId: "queue-build",
        status: "skipped",
      }),
    ]);
    expect(bridge.updateItem).not.toHaveBeenCalled();
  });

  it("blocks unconfirmed or invalid previews before creating Queue items", async () => {
    const preview = buildPromptPackImportPreview(
      parsePromptPackImportPlan([{ path: "001-one.md", text: "One body." }]),
    );
    const bridge = queueBridge();

    const unconfirmed = await materializePromptPackPreviewToQueue({
      bridge,
      confirmed: false,
      preview,
    });

    expect(unconfirmed.ok).toBe(false);
    expect(unconfirmed.errors[0]?.code).toBe("import_blocked");
    expect(bridge.createItem).not.toHaveBeenCalled();

    const invalidPreview = buildPromptPackImportPreview(
      parsePromptPackImportPlan([
        {
          path: "prompt-batch.json",
          text: JSON.stringify({
            items: [{ dependencies: ["missing"], id: "one", prompt: "one" }],
          }),
        },
      ]),
    );
    const invalid = await materializePromptPackPreviewToQueue({
      bridge,
      confirmed: true,
      preview: invalidPreview,
    });

    expect(invalid.ok).toBe(false);
    expect(invalid.errors[0]?.code).toBe("import_blocked");
    expect(bridge.createItem).not.toHaveBeenCalled();
  });
});

function queueBridge(
  overrides: Partial<WorkspaceAgentQueueBridge> = {},
): WorkspaceAgentQueueBridge & {
  createItem: ReturnType<typeof vi.fn>;
  updateItem: ReturnType<typeof vi.fn>;
} {
  return {
    createItem: vi.fn(async (request) => createResult(queueItem(request.title))),
    getSnapshot: vi.fn(),
    updateItem: vi.fn(async (request) =>
      updateResult(queueItem(request.itemId.replace(/^queue-/, ""))),
    ),
    ...overrides,
  } as WorkspaceAgentQueueBridge & {
    createItem: ReturnType<typeof vi.fn>;
    updateItem: ReturnType<typeof vi.fn>;
  };
}

function createResult(item: QueueWidgetItemSnapshot) {
  return {
    action: "queue.createItem" as const,
    events: [],
    item,
    message: "created",
    ok: true,
    safetyClass: "safe_create_update" as const,
  };
}

function updateResult(item: QueueWidgetItemSnapshot) {
  return {
    action: "queue.updateItem" as const,
    events: [],
    item,
    message: "updated",
    ok: true,
    safetyClass: "safe_create_update" as const,
  };
}

function queueItem(title: string): QueueWidgetItemSnapshot {
  const id = title.split(":")[0]?.trim() || title;

  return {
    id: `queue-${id}`,
    title,
  } as QueueWidgetItemSnapshot;
}
