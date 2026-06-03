import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

import { FinderWidget } from "./FinderWidget";
import type { WidgetDefinition, WidgetInstance } from "./types";

let root: Root | null = null;
let container: HTMLDivElement | null = null;

type FakeFileHandle = {
  kind: "file";
  name: string;
};

type FakeDirectoryHandle = {
  kind: "directory";
  name: string;
  values: () => AsyncGenerator<FakeHandle>;
};

type FakeHandle = FakeDirectoryHandle | FakeFileHandle;

afterEach(() => {
  if (root && container) {
    act(() => {
      root?.unmount();
    });
    container.remove();
  }
  root = null;
  container = null;
  document.body.innerHTML = "";
  Object.defineProperty(window, "showDirectoryPicker", {
    configurable: true,
    value: undefined,
    writable: true,
  });
  vi.restoreAllMocks();
});

describe("FinderWidget", () => {
  it("opens an approved root, navigates folder columns, and selects a file preview placeholder", async () => {
    const projectRoot = directory("project", [
      file("README.md"),
      directory("src", [file("App.tsx"), file("main.tsx")]),
    ]);
    const showDirectoryPicker = vi.fn(async () => projectRoot);
    Object.defineProperty(window, "showDirectoryPicker", {
      configurable: true,
      value: showDirectoryPicker,
      writable: true,
    });

    renderWidget();

    await clickButton("Open root");

    expect(showDirectoryPicker).toHaveBeenCalledTimes(1);
    expect(document.body.textContent).toContain("project");
    expect(document.body.textContent).toContain("src");
    expect(document.body.textContent).toContain("README.md");
    expect(document.querySelectorAll(".finder-column")).toHaveLength(1);

    await clickButtonContaining("src");

    expect(document.querySelectorAll(".finder-column")).toHaveLength(2);
    expect(document.body.textContent).toContain("App.tsx");
    expect(document.body.textContent).toContain("main.tsx");

    await clickButtonContaining("App.tsx");

    expect(document.body.textContent).toContain("src/App.tsx");
    expect(document.body.textContent).toContain(
      "File content preview is intentionally not wired in this MVP.",
    );
    expect(document.body.textContent).not.toContain("Git");
    expect(document.body.textContent).not.toContain("Save");
  });

  it("shows an honest unsupported listing state when only the native directory label picker is available", async () => {
    const onSelectWorkspaceDirectory = vi.fn(async () => "C:/work/project");

    renderWidget({ onSelectWorkspaceDirectory });

    await clickButton("Open root");

    expect(onSelectWorkspaceDirectory).toHaveBeenCalledTimes(1);
    expect(document.body.textContent).toContain("C:/work/project");
    expect(document.body.textContent).toContain(
      "Directory listing is unavailable in this frontend runtime.",
    );
    expect(document.querySelectorAll(".finder-column")).toHaveLength(0);
  });
});

function renderWidget(overrides: Partial<Parameters<typeof FinderWidget>[0]> = {}) {
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);

  act(() => {
    root?.render(
      <FinderWidget
        config={{}}
        definition={definition()}
        instance={instance()}
        title="Finder"
        {...overrides}
      />,
    );
  });
}

async function clickButton(text: string) {
  await act(async () => {
    const button = buttonWithText(text);
    if (!button) {
      throw new Error(`Button not found: ${text}`);
    }
    button.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    await flushPromises();
  });
}

async function clickButtonContaining(text: string) {
  await act(async () => {
    const button = buttonContainingText(text);
    if (!button) {
      throw new Error(`Button not found containing: ${text}`);
    }
    button.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    await flushPromises();
  });
}

function buttonWithText(text: string) {
  return Array.from(document.querySelectorAll("button")).find(
    (button) => button.textContent === text,
  );
}

function buttonContainingText(text: string) {
  return Array.from(document.querySelectorAll("button")).find((button) =>
    button.textContent?.includes(text),
  );
}

async function flushPromises() {
  for (let index = 0; index < 6; index += 1) {
    await Promise.resolve();
  }
}

function directory(name: string, children: FakeHandle[]): FakeDirectoryHandle {
  return {
    kind: "directory" as const,
    name,
    values: async function* values() {
      for (const child of children) {
        yield child;
      }
    },
  };
}

function file(name: string): FakeFileHandle {
  return {
    kind: "file" as const,
    name,
  };
}

function definition(): WidgetDefinition {
  return {
    category: "codebase",
    componentKey: "finder-widget",
    defaultConfig: {},
    defaultTitle: "Finder",
    description: "Finder",
    id: "finder",
    title: "Finder",
  };
}

function instance(): WidgetInstance {
  return {
    config: {},
    definitionId: "finder",
    id: "finder_widget",
    layout: {
      area: "main",
      height: 600,
      mode: "docked",
      order: 1,
      width: 840,
      x: 0,
      y: 0,
    },
    state: {},
    title: "Finder",
    visible: true,
  };
}
