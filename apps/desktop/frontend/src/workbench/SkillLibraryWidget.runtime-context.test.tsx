import { describe, expect, it, vi } from "vitest";

import {
  changeInput,
  changeTextareaByLabel,
  clickButton,
  flush,
  knowledgeDocumentFixture,
  renderWidget,
  renderWidgetThroughHost,
} from "./SkillLibraryWidget.test-helpers";
import { createWidgetRuntimeContext } from "./widgetRuntimeContext";

describe("SkillLibraryWidget WidgetRuntimeContext", () => {
  it("uses WidgetRuntimeContext for widget-local logs while preserving direct-prop fallback", async () => {
    const runtimeLoadLogs = vi.fn(async () => [
      logEntry(
        "log_runtime",
        "Loaded from runtime context",
        "runtime_skill_widget",
      ),
    ]);
    const legacyLoadLogs = vi.fn(async () => [
      logEntry("log_legacy", "Loaded from legacy props", "skill_widget"),
    ]);
    const runtime = createWidgetRuntimeContext({
      definition: {
        category: "knowledge",
        componentKey: "skill-library-widget",
        defaultConfig: {},
        defaultTitle: "Knowledge / Skills",
        description: "Knowledge / Skills",
        id: "skill-library",
        title: "Knowledge / Skills",
      },
      instance: {
        config: {},
        definitionId: "skill-library",
        id: "runtime_skill_widget",
        layout: {
          area: "main",
          height: 720,
          mode: "docked",
          order: 0,
          width: 760,
          x: 0,
          y: 0,
        },
        state: {},
        title: "Knowledge / Skills",
        visible: true,
      },
      logs: {
        load: runtimeLoadLogs,
        refreshToken: 7,
      },
      workspaceId: "workspace_runtime",
    });

    renderWidget(
      {
        onListKnowledgeDocuments: vi.fn(async () => []),
        onListSkills: vi.fn(async () => []),
        onLoadLogs: legacyLoadLogs,
      },
      runtime,
    );

    await flush();
    await clickButton("Logs");

    expect(runtime.identity).toEqual({
      componentKey: "skill-library-widget",
      widgetDefinitionId: "skill-library",
      widgetInstanceId: "runtime_skill_widget",
      workspaceId: "workspace_runtime",
    });
    expect(runtimeLoadLogs).toHaveBeenCalledTimes(1);
    expect(legacyLoadLogs).not.toHaveBeenCalled();
    expect(document.body.textContent).toContain("Loaded from runtime context");
  });

  it("keeps the legacy log prop path working for compatibility wrappers", async () => {
    const legacyLoadLogs = vi.fn(async () => [
      logEntry("log_legacy", "Loaded from legacy props", "skill_widget"),
    ]);

    renderWidget({
      onListKnowledgeDocuments: vi.fn(async () => []),
      onListSkills: vi.fn(async () => []),
      onLoadLogs: legacyLoadLogs,
    });

    await flush();
    await clickButton("Logs");

    expect(legacyLoadLogs).toHaveBeenCalledWith("skill_widget");
    expect(document.body.textContent).toContain("Loaded from legacy props");
  });

  it("renders through WidgetHost with runtime context logs and existing Knowledge props", async () => {
    const listWidgetLogs = vi.fn(async () => [
      logEntry("log_host", "Host runtime log", "skill_widget"),
    ]);
    const createKnowledgeDocument = vi.fn(async (request) =>
      knowledgeDocumentFixture({
        ...request,
        knowledgeDocumentId: "doc_host",
      }),
    );

    renderWidgetThroughHost({
      actions: {
        createKnowledgeDocument,
        listWidgetLogs,
      },
    });

    await flush();

    expect(document.body.textContent).toContain("No catalog items yet.");

    await clickButton("New item");
    await changeInput('input[placeholder="Untitled document"]', "Host docs");
    await changeTextareaByLabel("Full content", "Host-rendered content.");
    await clickButton("Save document");

    expect(createKnowledgeDocument).toHaveBeenCalledWith(
      expect.objectContaining({
        content: "Host-rendered content.",
        title: "Host docs",
      }),
    );

    await clickButton("Logs");

    expect(listWidgetLogs).toHaveBeenCalledWith("skill_widget");
    expect(document.body.textContent).toContain("Host runtime log");
  });
});

function logEntry(id: string, message: string, widgetInstanceId: string) {
  return {
    createdAt: "2026-06-07T00:00:00Z",
    id,
    level: "info",
    message,
    payload: null,
    runId: null,
    widgetInstanceId,
  };
}
