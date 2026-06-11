import { describe, expect, it, vi } from "vitest";

import type { DirectWorkStreamEvent } from "../workspace/types";
import {
  classifyPromptPackImportIntent,
  createProductActionToolLoopGuardState,
  isPromptPackImportConfirmationText,
  PRODUCT_ACTION_TOOL_LOOP_ATTEMPT_LIMIT,
  recordProductActionToolLoopAttempt,
  runWorkspaceAgentProductActionCancel,
  runWorkspaceAgentProductActionConfirmation,
} from "./workspaceAgentProductActionGuards";

describe("workspaceAgentProductActionGuards", () => {
  it("classifies path-based prompt-pack import as start instead of confirm", () => {
    const text = [
      "Import this prompt pack into Queue, show preview first, do not create Queue items until I confirm:",
      "",
      "C:\\Users\\Dmitry\\Documents\\prj\\hobit-realistic-dogfooding-smoke-pack",
    ].join("\n");

    expect(
      classifyPromptPackImportIntent(text, { hasPendingImport: false }),
    ).toEqual({
      kind: "start_prompt_pack_import_preview",
      source: expect.objectContaining({
        sourcePath:
          "C:\\Users\\Dmitry\\Documents\\prj\\hobit-realistic-dogfooding-smoke-pack",
      }),
    });
    expect(isPromptPackImportConfirmationText(text, false)).toBe(false);
  });

  it("recognizes prompt-pack import confirmation text only in product context", () => {
    expect(isPromptPackImportConfirmationText("confirm import", false)).toBe(
      true,
    );
    expect(isPromptPackImportConfirmationText("yes", true)).toBe(true);
    expect(isPromptPackImportConfirmationText("yes", false)).toBe(false);
    expect(
      isPromptPackImportConfirmationText("create task read AGENTS.md", true),
    ).toBe(false);
    expect(
      classifyPromptPackImportIntent(
        "Implement TypeScript import routing for source files.",
        { hasPendingImport: true },
      ).kind,
    ).toBe("unknown");
  });

  it("classifies cancel only as active preview cancellation intent", () => {
    expect(
      classifyPromptPackImportIntent("cancel import", { hasPendingImport: true })
        .kind,
    ).toBe("cancel_prompt_pack_import_preview");
    expect(
      classifyPromptPackImportIntent("discard this preview", {
        hasPendingImport: true,
      }).kind,
    ).toBe("cancel_prompt_pack_import_preview");
  });

  it("returns unavailable for prompt-pack confirmation without active preview", async () => {
    const createQueueItemsFromPromptPackPreview = vi.fn();

    const result = await runWorkspaceAgentProductActionConfirmation({
      createQueueItemsFromPromptPackPreview,
      imports: {},
      onPatchPromptPackImport: vi.fn(),
      text: "confirm import",
    });

    expect(result.handled).toBe(true);
    expect(result.body).toContain(
      "there is no active prompt-pack import preview to confirm",
    );
    expect(result.body).toContain("No Codex run");
    expect(createQueueItemsFromPromptPackPreview).not.toHaveBeenCalled();
  });

  it("routes prompt-pack confirmation through the typed create action", async () => {
    const createQueueItemsFromPromptPackPreview = vi.fn(
      async (..._args: unknown[]) => ({
        createdTasks: [
          {
            itemId: "001",
            queueItemId: "queue-001",
            title: "001: Import one",
          },
        ],
        dependencyLinksCreated: [],
        dependencyLinksSkipped: [],
        errors: [],
        ok: true,
        warnings: [],
      }),
    );
    const patchImport = vi.fn();

    const result = await runWorkspaceAgentProductActionConfirmation({
      createQueueItemsFromPromptPackPreview,
      imports: {
        "prompt-pack-import-1": {
          id: "prompt-pack-import-1",
          sourceText: JSON.stringify({
            id: "pack",
            items: [
              {
                id: "001",
                prompt: "Do one thing.",
                title: "Import one",
              },
            ],
            name: "Pack",
          }),
        },
      },
      onPatchPromptPackImport: patchImport,
      text: "confirm import",
    });

    expect(result.handled).toBe(true);
    expect(result.body).toContain("typed Queue action path");
    expect(result.body).toContain("No Codex run");
    expect(createQueueItemsFromPromptPackPreview).toHaveBeenCalledTimes(1);
    expect(createQueueItemsFromPromptPackPreview.mock.calls[0]?.[0]).toMatchObject({
      importAvailable: true,
      selectedItemIds: ["001"],
    });
    expect(patchImport).toHaveBeenCalledWith("prompt-pack-import-1", {
      result: expect.objectContaining({ ok: true }),
    });
  });

  it("cancels an active prompt-pack preview without materializing Queue items", () => {
    const cancelImport = vi.fn();
    const createQueueItemsFromPromptPackPreview = vi.fn();

    const result = runWorkspaceAgentProductActionCancel({
      createQueueItemsFromPromptPackPreview,
      imports: {
        "prompt-pack-import-1": {
          id: "prompt-pack-import-1",
          sourceText: JSON.stringify({
            id: "pack",
            items: [{ id: "001", prompt: "Do one thing.", title: "Import one" }],
            name: "Pack",
          }),
        },
      },
      onCancelPromptPackImport: cancelImport,
      onPatchPromptPackImport: vi.fn(),
      text: "cancel prompt-pack import",
    });

    expect(result.handled).toBe(true);
    expect(result.body).toContain("was cancelled");
    expect(cancelImport).toHaveBeenCalledWith("prompt-pack-import-1");
    expect(createQueueItemsFromPromptPackPreview).not.toHaveBeenCalled();
  });

  it("returns unavailable without a typed prompt-pack create action", async () => {
    const result = await runWorkspaceAgentProductActionConfirmation({
      imports: {
        "prompt-pack-import-1": {
          id: "prompt-pack-import-1",
          sourceText: JSON.stringify({
            id: "pack",
            items: [{ id: "001", prompt: "Do one thing.", title: "Import one" }],
            name: "Pack",
          }),
        },
      },
      onPatchPromptPackImport: vi.fn(),
      text: "create queue items",
    });

    expect(result).toEqual({
      body: expect.stringContaining("typed product action unavailable"),
      handled: true,
    });
    expect(result.body).toContain("No Codex run");
    expect(result.body).toContain("SQLite write");
  });

  it("caps failed raw shell/SQLite product-action attempts", () => {
    const state = createProductActionToolLoopGuardState(
      "Use raw SQLite to create Queue item rows.",
    );
    let latest = null;

    for (let index = 0; index < PRODUCT_ACTION_TOOL_LOOP_ATTEMPT_LIMIT; index += 1) {
      latest = recordProductActionToolLoopAttempt(
        state,
        commandFailedEvent(
          "node -e \"require('node:sqlite'); db.exec('insert into queue_items values (...)')\"",
        ),
      );
    }

    expect(latest).toMatchObject({
      attemptCount: PRODUCT_ACTION_TOOL_LOOP_ATTEMPT_LIMIT,
      shouldStop: true,
    });
    expect(latest?.message).toContain("typed product action unavailable");
    expect(latest?.message).toContain("stopped raw shell/SQLite");
  });

  it("does not enable the loop cap for ordinary code tasks", () => {
    const state = createProductActionToolLoopGuardState(
      "Implement tests for Queue SQLite storage guards.",
    );
    const result = recordProductActionToolLoopAttempt(
      state,
      commandFailedEvent("rg queue_items apps/desktop/frontend/src"),
    );

    expect(state.enabled).toBe(false);
    expect(result).toBeNull();
  });
});

function commandFailedEvent(command: string): DirectWorkStreamEvent {
  return {
    codexThreadId: null,
    elapsedMs: 100,
    errorMessage: null,
    eventKind: "codex_json_event",
    exitCode: null,
    failedStage: null,
    finalStatus: null,
    isFinal: false,
    line: JSON.stringify({
      item: {
        command,
        exit_code: 1,
        status: "failed",
        type: "command_execution",
      },
      type: "item.completed",
    }),
    parsedCodexEventType: "item.completed",
    runId: "run-1",
    status: "running",
    stderrPreview: null,
    text: null,
    widgetInstanceId: "coordinator_widget",
    workbenchId: "workbench-1",
    workspaceId: "workspace-1",
  };
}
