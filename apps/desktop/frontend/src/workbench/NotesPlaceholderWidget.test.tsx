import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

import { NotesPlaceholderWidget } from "./NotesPlaceholderWidget";
import type { WidgetDefinition, WidgetInstance } from "./types";
import type {
  CreateKnowledgeDocumentRequest,
  CreateWorkspaceNoteRequest,
  KnowledgeDocument,
  WorkspaceNote,
} from "../workspace/types";

type CreateNoteInput = Omit<CreateWorkspaceNoteRequest, "workspaceId">;
type CreateKnowledgeDocumentInput = Omit<
  CreateKnowledgeDocumentRequest,
  "workspaceId"
>;

let root: Root | null = null;
let container: HTMLDivElement | null = null;

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
  vi.restoreAllMocks();
});

describe("NotesPlaceholderWidget empty state", () => {
  it("renders the compact empty state and creates a note from the header New note action", async () => {
    const createdNote = note({
      body: "",
      noteId: "note_1",
      title: "Untitled note",
    });
    const onCreateWorkspaceNote = vi.fn(
      async (_request: CreateNoteInput) => createdNote,
    );
    const onGetWorkspaceNote = vi.fn(async () => createdNote);
    const onListWorkspaceNotes = vi
      .fn<() => Promise<WorkspaceNote[]>>()
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([createdNote]);
    const onUpdateWorkspaceNote = vi.fn();

    renderWidget({
      onCreateWorkspaceNote,
      onGetWorkspaceNote,
      onListWorkspaceNotes,
      onUpdateWorkspaceNote,
    });
    await flushEffects();

    expect(document.body.textContent).toContain("No notes yet.");
    expect(document.body.textContent).toContain(
      "Create one from the header to capture workspace context.",
    );
    expect(document.querySelector(".notes-empty-state-compact")).not.toBeNull();
    expect(document.querySelector(".notes-empty-state-action")).toBeNull();
    expect(buttonsWithText("New note")).toHaveLength(1);

    await clickButton("New note");
    await flushEffects();

    expect(onCreateWorkspaceNote).toHaveBeenCalledTimes(1);
    expect(onCreateWorkspaceNote.mock.calls[0][0]).toEqual({
      body: "",
      pinned: false,
      title: "Untitled note",
    });
    expect(onGetWorkspaceNote).toHaveBeenCalledWith("note_1");
    expect(document.body.textContent).toContain("Untitled note");
  });

  it("promotes the selected saved note to a Knowledge Document without changing the note", async () => {
    const selectedNote = note({
      body: "Deploy Falcon with the staged checklist.\nKeep rollback ready.",
      noteId: "note_42",
      title: "Falcon deployment note",
    });
    const createdDocument = knowledgeDocument({
      content: selectedNote.body,
      knowledgeDocumentId: "kdoc_42",
      sourceRef: selectedNote.noteId,
      title: selectedNote.title,
    });
    const onCreateKnowledgeDocument = vi.fn(
      async (_request: CreateKnowledgeDocumentInput) => createdDocument,
    );
    const onCreateWorkspaceNote = vi.fn();
    const onGetWorkspaceNote = vi.fn(async () => selectedNote);
    const onListWorkspaceNotes = vi.fn(async () => [selectedNote]);
    const onUpdateWorkspaceNote = vi.fn();

    renderWidget({
      onCreateKnowledgeDocument,
      onCreateWorkspaceNote,
      onGetWorkspaceNote,
      onListWorkspaceNotes,
      onUpdateWorkspaceNote,
    });
    await flushEffects();

    expect(buttonWithText("Create document")).toBeUndefined();
    await clickButton("Promote to Knowledge");
    await flushEffects();

    expect(buttonWithText("Create document")).toBeDefined();
    changeSelect(1, "global");
    changeSelect(2, "draft");
    changeInput(".notes-promotion-tags input", "deployment, falcon");
    await clickButton("Create document");
    await flushEffects();

    expect(onCreateKnowledgeDocument).toHaveBeenCalledTimes(1);
    expect(onCreateKnowledgeDocument.mock.calls[0][0]).toEqual({
      catalogItemType: "documentation_knowledge",
      content: selectedNote.body,
      enabled: false,
      lifecycleStatus: "draft",
      quickSummary: "Deploy Falcon with the staged checklist.",
      scope: "global",
      sourceKind: "workspace_note",
      sourceLabel: "Note: Falcon deployment note",
      sourceRef: "note_42",
      tags: "deployment, falcon",
      title: "Falcon deployment note",
    });
    expect(onUpdateWorkspaceNote).not.toHaveBeenCalled();
    expect(document.body.textContent).toContain(
      "Knowledge Document created: Falcon deployment note. Note unchanged.",
    );
  });
});

function renderWidget(
  overrides: Partial<Parameters<typeof NotesPlaceholderWidget>[0]> = {},
) {
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);

  act(() => {
    root?.render(
      <NotesPlaceholderWidget
        config={{}}
        definition={definition()}
        instance={instance()}
        title="Notes"
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
    await Promise.resolve();
  });
}

function changeInput(selector: string, value: string) {
  act(() => {
    const input = document.querySelector<HTMLInputElement>(selector);
    if (!input) {
      throw new Error(`Input not found: ${selector}`);
    }

    setNativeValue(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

function changeSelect(index: number, value: string) {
  act(() => {
    const select = Array.from(document.querySelectorAll("select"))[index];
    if (!select) {
      throw new Error(`Select not found at index: ${index.toString()}`);
    }

    setNativeValue(select, value);
    select.dispatchEvent(new Event("change", { bubbles: true }));
  });
}

function setNativeValue(
  element: HTMLInputElement | HTMLSelectElement,
  value: string,
) {
  const valueSetter = Object.getOwnPropertyDescriptor(element, "value")?.set;
  const prototype = Object.getPrototypeOf(element) as
    | HTMLInputElement
    | HTMLSelectElement;
  const prototypeValueSetter = Object.getOwnPropertyDescriptor(
    prototype,
    "value",
  )?.set;

  if (prototypeValueSetter && valueSetter !== prototypeValueSetter) {
    prototypeValueSetter.call(element, value);
  } else if (valueSetter) {
    valueSetter.call(element, value);
  } else {
    element.value = value;
  }
}

function buttonWithText(text: string) {
  return Array.from(document.querySelectorAll("button")).find(
    (button) => button.textContent === text,
  );
}

function buttonsWithText(text: string) {
  return Array.from(document.querySelectorAll("button")).filter(
    (button) => button.textContent === text,
  );
}

async function flushEffects() {
  await act(async () => {
    await Promise.resolve();
  });
  await act(async () => {
    await Promise.resolve();
  });
}

function definition(): WidgetDefinition {
  return {
    category: "notes",
    componentKey: "notes",
    defaultConfig: {},
    defaultTitle: "Notes",
    description: "Notes",
    id: "notes",
    title: "Notes",
  };
}

function instance(): WidgetInstance {
  return {
    config: {},
    definitionId: "notes",
    id: "notes_widget",
    layout: {
      area: "side",
      height: 560,
      mode: "docked",
      order: 1,
      width: 360,
      x: 864,
      y: 0,
    },
    state: {},
    title: "Notes",
    visible: true,
  };
}

function note(overrides: Partial<WorkspaceNote> = {}): WorkspaceNote {
  return {
    archived: false,
    body: "",
    createdAt: "2026-05-25T00:00:00.000Z",
    noteId: "note_1",
    pinned: false,
    title: "Untitled note",
    updatedAt: "2026-05-25T00:00:00.000Z",
    workspaceId: "workspace_1",
    ...overrides,
  };
}

function knowledgeDocument(
  overrides: Partial<KnowledgeDocument> = {},
): KnowledgeDocument {
  return {
    catalogItemType: "documentation_knowledge",
    content: "",
    createdAt: "2026-05-25T00:00:00.000Z",
    enabled: true,
    knowledgeDocumentId: "kdoc_1",
    lifecycleStatus: "active",
    quickSummary: "",
    scope: "workspace",
    sourceKind: "workspace_note",
    sourceLabel: "Note: Untitled note",
    sourceRef: "note_1",
    tags: "",
    title: "Untitled note",
    updatedAt: "2026-05-25T00:00:00.000Z",
    workspaceId: "workspace_1",
    ...overrides,
  };
}
