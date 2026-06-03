import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

import { FinderWidget } from "./FinderWidget";
import type { WidgetDefinition, WidgetInstance } from "./types";

let root: Root | null = null;
let container: HTMLDivElement | null = null;

type FakeFileHandle = {
  createWritable: () => Promise<{
    close: () => Promise<void>;
    write: (content: string) => Promise<void>;
  }>;
  getFile: () => Promise<File>;
  kind: "file";
  name: string;
  readContent: () => string;
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
  it("opens an approved root, navigates folder columns, and edits a selected file in the floating preview", async () => {
    const appFile = file(
      "App.tsx",
      "export function App() {\n  return 'hello';\n}\n",
    );
    const projectRoot = directory("project", [
      file("README.md"),
      directory("src", [appFile, file("main.tsx")]),
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
    expect(document.body.textContent).toContain("export function App()");
    expect(
      document.querySelector(".finder-floating-preview-normal"),
    ).not.toBeNull();
    expect(document.body.textContent).not.toContain("Git");

    await clickButton("Minimize");
    expect(
      document.querySelector(".finder-floating-preview-minimized"),
    ).not.toBeNull();

    await clickButton("Restore");
    await clickButton("Maximize");
    expect(
      document.querySelector(".finder-floating-preview-maximized"),
    ).not.toBeNull();

    await clickButton("Edit");
    await changeTextarea("export function App() {\n  return 'saved';\n}\n");

    expect(document.body.textContent).toContain("Unsaved");

    await clickButton("Save");

    expect(appFile.readContent()).toContain("return 'saved'");
    expect(document.body.textContent).toContain("Saved");

    await clickButton("Edit");
    await changeTextarea("export function App() {\n  return 'discarded';\n}\n");
    await clickButton("Cancel");

    expect(appFile.readContent()).toContain("return 'saved'");
    expect(appFile.readContent()).not.toContain("discarded");

    await clickButton("Close");
    expect(document.querySelector(".finder-floating-preview")).toBeNull();
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

async function changeTextarea(value: string) {
  await act(async () => {
    const textarea = document.querySelector("textarea");
    if (!textarea) {
      throw new Error("Textarea not found");
    }
    const valueSetter = Object.getOwnPropertyDescriptor(
      HTMLTextAreaElement.prototype,
      "value",
    )?.set;
    valueSetter?.call(textarea, value);
    textarea.dispatchEvent(new Event("input", { bubbles: true }));
    textarea.dispatchEvent(new Event("change", { bubbles: true }));
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

function file(name: string, content = ""): FakeFileHandle {
  let currentContent = content;

  return {
    createWritable: async () => ({
      close: async () => undefined,
      write: async (nextContent: string) => {
        currentContent = nextContent;
      },
    }),
    getFile: async () => new File([currentContent], name, { type: "text/plain" }),
    kind: "file" as const,
    name,
    readContent: () => currentContent,
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
