import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { describe, expect, it, vi } from "vitest";

import type { WidgetDefinition, WidgetInstance } from "./types";
import {
  createWidgetRuntimeContext,
  useWidgetRuntimeContext,
  WidgetRuntimeContextProvider,
  type WidgetRuntimeContextValue,
} from "./widgetRuntimeContext";

describe("WidgetRuntimeContext", () => {
  it("returns safe defaults when no provider is mounted", async () => {
    const { result, unmount } = renderRuntimeConsumer();

    expect(result.current.identity).toEqual({});
    expect(result.current.logs.isAvailable).toBe(false);
    expect(result.current.logs.refreshToken).toBe(0);
    await expect(result.current.logs.load()).resolves.toEqual([]);

    unmount();
  });

  it("passes widget identity and workspace identity through the provider", () => {
    const runtime = createWidgetRuntimeContext({
      definition: widgetDefinition(),
      instance: widgetInstance(),
      logs: {
        load: vi.fn(async () => []),
        refreshToken: 3,
      },
      workspaceId: "workspace_1",
    });

    const { result, unmount } = renderRuntimeConsumer(runtime);

    expect(result.current.identity).toEqual({
      componentKey: "test-widget",
      widgetDefinitionId: "test-definition",
      widgetInstanceId: "widget_1",
      workspaceId: "workspace_1",
    });
    expect(result.current.logs.isAvailable).toBe(true);
    expect(result.current.logs.refreshToken).toBe(3);

    unmount();
  });

  it("does not invoke runtime affordances while mounting the provider", async () => {
    const loadLogs = vi.fn(async () => [
      {
        createdAt: "2026-06-07T00:00:00Z",
        id: "log_1",
        level: "info",
        message: "Loaded on demand",
        payload: null,
        runId: null,
        widgetInstanceId: "widget_1",
      },
    ]);
    const runtime = createWidgetRuntimeContext({
      definition: widgetDefinition(),
      instance: widgetInstance(),
      logs: {
        load: loadLogs,
        refreshToken: 1,
      },
      workspaceId: "workspace_1",
    });

    const { result, unmount } = renderRuntimeConsumer(runtime);

    expect(loadLogs).not.toHaveBeenCalled();
    await expect(result.current.logs.load()).resolves.toHaveLength(1);
    expect(loadLogs).toHaveBeenCalledTimes(1);

    unmount();
  });
});

function renderRuntimeConsumer(runtime?: WidgetRuntimeContextValue) {
  let root: Root | null = null;
  const container = document.createElement("div");
  const result = {} as {
    current: ReturnType<typeof useWidgetRuntimeContext>;
  };
  document.body.append(container);

  function Consumer() {
    result.current = useWidgetRuntimeContext();
    return null;
  }

  const tree = runtime ? (
    <WidgetRuntimeContextProvider runtime={runtime}>
      <Consumer />
    </WidgetRuntimeContextProvider>
  ) : (
    <Consumer />
  );

  act(() => {
    root = createRoot(container);
    root.render(tree);
  });

  return {
    result,
    unmount() {
      act(() => {
        root?.unmount();
      });
      container.remove();
    },
  };
}

function widgetDefinition(): WidgetDefinition {
  return {
    category: "core",
    componentKey: "test-widget",
    defaultConfig: {},
    defaultTitle: "Test Widget",
    description: "Test widget.",
    id: "test-definition",
    title: "Test Widget",
  };
}

function widgetInstance(): WidgetInstance {
  return {
    config: {},
    definitionId: "test-definition",
    id: "widget_1",
    layout: {
      area: "main",
      height: 240,
      mode: "docked",
      order: 0,
      width: 320,
      x: 0,
      y: 0,
    },
    state: {},
    title: "Test Widget",
    visible: true,
  };
}
