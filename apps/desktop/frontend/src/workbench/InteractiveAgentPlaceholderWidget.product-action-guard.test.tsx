import { describe, expect, it, vi } from "vitest";

import {
  clickButton,
  providerResponse,
  renderWidget,
  setTextareaValue,
} from "./InteractiveAgentPlaceholderWidget.test-utils";

describe("InteractiveAgentPlaceholderWidget product-action guard", () => {
  it("routes path-based prompt-pack import through preview instead of Codex", async () => {
    const provider = vi.fn(async () => providerResponse());
    const startDirectWork = vi.fn();
    const createQueueItemsFromPromptPackPreview = vi.fn();
    renderWidget({
      createQueueItemsFromPromptPackPreview,
      onGenerateCoordinatorProviderResponse: provider,
      onStartCodexDirectWorkStream: startDirectWork,
    });

    await setTextareaValue(
      [
        "Import this prompt pack into Queue, show preview first, do not create Queue items until I confirm:",
        "",
        "C:\\Users\\Dmitry\\Documents\\prj\\hobit-realistic-dogfooding-smoke-pack",
      ].join("\n"),
    );
    await clickButton("Run with Codex");

    expect(startDirectWork).not.toHaveBeenCalled();
    expect(provider).not.toHaveBeenCalled();
    expect(createQueueItemsFromPromptPackPreview).not.toHaveBeenCalled();
    expect(document.body.textContent).toContain(
      "Prompt-pack import preview started from the requested path.",
    );
    expect(document.body.textContent).toContain("Import prompt pack");
    expect(document.body.textContent).toContain(
      "C:\\Users\\Dmitry\\Documents\\prj\\hobit-realistic-dogfooding-smoke-pack",
    );
  });

  it("fails prompt-pack confirmation without an active preview before Codex starts", async () => {
    const provider = vi.fn(async () => providerResponse());
    const startDirectWork = vi.fn();
    const createQueueItemsFromPromptPackPreview = vi.fn();
    renderWidget({
      createQueueItemsFromPromptPackPreview,
      onGenerateCoordinatorProviderResponse: provider,
      onStartCodexDirectWorkStream: startDirectWork,
    });

    await setTextareaValue("confirm import");
    await clickButton("Run with Codex");

    expect(startDirectWork).not.toHaveBeenCalled();
    expect(provider).not.toHaveBeenCalled();
    expect(createQueueItemsFromPromptPackPreview).not.toHaveBeenCalled();
    expect(document.body.textContent).toContain(
      "there is no active prompt-pack import preview to confirm",
    );
    expect(document.body.textContent).toContain("No Codex run");
  });

  it("blocks raw SQLite or shell product-action requests before Codex starts", async () => {
    const provider = vi.fn(async () => providerResponse());
    const startDirectWork = vi.fn();
    const createQueueItemsFromPromptPackPreview = vi.fn();
    renderWidget({
      createQueueItemsFromPromptPackPreview,
      onGenerateCoordinatorProviderResponse: provider,
      onStartCodexDirectWorkStream: startDirectWork,
    });

    await setTextareaValue(
      "Use rg and node:sqlite to reverse engineer prompt-pack import storage and create Queue item rows.",
    );
    await clickButton("Run with Codex");

    expect(startDirectWork).not.toHaveBeenCalled();
    expect(provider).not.toHaveBeenCalled();
    expect(createQueueItemsFromPromptPackPreview).not.toHaveBeenCalled();
    expect(document.body.textContent).toContain(
      "typed product action unavailable",
    );
    expect(document.body.textContent).toContain(
      "raw SQLite, shell, or ad hoc storage mutation is not a product action connector",
    );
  });
});
