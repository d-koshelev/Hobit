import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

import { NotesPlaceholderWidget } from "./NotesPlaceholderWidget";
import type { WidgetDefinition, WidgetInstance } from "./types";
import type {
  CreateKnowledgeDocumentRequest,
  CreateWorkspaceNoteRequest,
  KnowledgeDocument,
  UpdateWorkspaceNoteRequest,
  WorkspaceNote,
} from "../workspace/types";

type CreateNoteInput = Omit<CreateWorkspaceNoteRequest, "workspaceId">;
type CreateKnowledgeDocumentInput = Omit<
  CreateKnowledgeDocumentRequest,
  "workspaceId"
>;
type UpdateNoteInput = Omit<UpdateWorkspaceNoteRequest, "workspaceId">;

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
    expect(buttonWithLabel("New note")).toBeDefined();

    await clickButtonWithLabel("New note");
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
    changeSelectByLabelText("Scope", "global");
    changeSelectByLabelText("Status", "draft");
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
      sourceKind: "note",
      sourceLabel: "Note: Falcon deployment note",
      sourceRef: "note_42",
      sourceRefs: [
        expect.objectContaining({
          caps: ["Explicit saved Note promotion only"],
          kind: "note",
          label: "Note: Falcon deployment note",
          noteId: "note_42",
          reason: "Operator promoted a saved selected Note into Knowledge.",
          warnings: [
            "Original Note remains unchanged; Notes are not auto-ingested.",
          ],
          workspaceScope: "global",
        }),
      ],
      tags: "deployment, falcon",
      title: "Falcon deployment note",
    });
    expect(onUpdateWorkspaceNote).not.toHaveBeenCalled();
    expect(document.body.textContent).toContain(
      "Knowledge Document created: Falcon deployment note. Note unchanged.",
    );
  });

  it("keeps the notes list and editor in a resizable split layout with a collapsible divider", async () => {
    const selectedNote = note({
      body: "Keep this selected.",
      noteId: "note_42",
      title: "Falcon deployment note",
    });
    const onCreateWorkspaceNote = vi.fn();
    const onGetWorkspaceNote = vi.fn(async () => selectedNote);
    const onListWorkspaceNotes = vi.fn(async () => [selectedNote]);
    const onUpdateWorkspaceNote = vi.fn();

    renderWidget({
      onCreateWorkspaceNote,
      onGetWorkspaceNote,
      onListWorkspaceNotes,
      onUpdateWorkspaceNote,
    });
    await flushEffects();

    expect(document.querySelector(".notes-product-shell")).not.toBeNull();
    expect(document.querySelector(".notes-list-pane")).not.toBeNull();
    expect(resizeSeparator()).toBeDefined();
    expect(document.querySelector(".notes-editor-pane")).not.toBeNull();
    expect(resizeSeparator()?.getAttribute("aria-orientation")).toBe(
      "vertical",
    );

    const shell = document.querySelector<HTMLElement>(".notes-product-shell");
    if (!shell) {
      throw new Error("Notes product shell not found.");
    }
    Object.defineProperty(shell, "clientWidth", {
      configurable: true,
      value: 640,
    });
    shell.getBoundingClientRect = () =>
      ({
        bottom: 400,
        height: 400,
        left: 10,
        right: 650,
        top: 0,
        width: 640,
        x: 10,
        y: 0,
        toJSON: () => ({}),
      }) as DOMRect;

    const separator = resizeSeparator();
    if (!separator) {
      throw new Error("Resize separator not found.");
    }
    separator.setPointerCapture = vi.fn();
    separator.releasePointerCapture = vi.fn();

    await dragSeparator(separator, 206, 260);

    expect(shell.style.getPropertyValue("--notes-list-width")).toBe("250px");
    expect(separator.getAttribute("aria-valuenow")).toBe("250");
    expect(document.querySelector(".notes-editor-pane")).not.toBeNull();

    await clickButtonWithLabel("Collapse notes list");
    expect(document.querySelector(".notes-list-pane")).toBeNull();
    expect(
      document.querySelector(".notes-product-shell-list-collapsed"),
    ).not.toBeNull();
    expect(document.querySelector(".notes-editor-pane")).not.toBeNull();

    await clickButtonWithLabel("Expand notes list");
    expect(document.querySelector(".notes-list-pane")).not.toBeNull();
    expect(shell.style.getPropertyValue("--notes-list-width")).toBe("250px");
  });

  it("saves a dirty focused note with Ctrl+S and clears the dirty state", async () => {
    const selectedNote = note({
      body: "Original body.",
      noteId: "note_42",
      title: "Falcon deployment note",
    });
    const updatedNote = {
      ...selectedNote,
      body: "Updated body.",
      updatedAt: "2026-05-25T00:01:00.000Z",
    };
    const onCreateWorkspaceNote = vi.fn();
    const onGetWorkspaceNote = vi.fn(async () => selectedNote);
    const onListWorkspaceNotes = vi.fn(async () => [selectedNote]);
    const onUpdateWorkspaceNote = vi.fn(
      async (_request: UpdateNoteInput) => updatedNote,
    );

    renderWidget({
      onCreateWorkspaceNote,
      onGetWorkspaceNote,
      onListWorkspaceNotes,
      onUpdateWorkspaceNote,
    });
    await flushEffects();

    changeTextarea(".notes-body-input", "Updated body.");
    expect(document.body.textContent).toContain("Unsaved");

    await act(async () => {
      const textarea =
        document.querySelector<HTMLTextAreaElement>(".notes-body-input");
      if (!textarea) {
        throw new Error("Textarea not found: .notes-body-input");
      }

      textarea.focus();
      textarea.dispatchEvent(
        new KeyboardEvent("keydown", {
          bubbles: true,
          ctrlKey: true,
          key: "s",
        }),
      );
      await Promise.resolve();
    });
    await flushEffects();

    expect(onUpdateWorkspaceNote).toHaveBeenCalledTimes(1);
    expect(onUpdateWorkspaceNote.mock.calls[0][0]).toEqual({
      body: "Updated body.",
      noteId: "note_42",
      pinned: false,
      title: "Falcon deployment note",
    });
    expect(document.body.textContent).toContain("Saved");
  });

  it("keeps Markdown source editable and disables browser spellcheck for the note body", async () => {
    const selectedNote = note({
      body: "# Release note\n\n- Check `api`",
      noteId: "note_42",
      title: "Falcon deployment note",
    });
    const onCreateWorkspaceNote = vi.fn();
    const onGetWorkspaceNote = vi.fn(async () => selectedNote);
    const onListWorkspaceNotes = vi.fn(async () => [selectedNote]);
    const onUpdateWorkspaceNote = vi.fn();

    renderWidget({
      onCreateWorkspaceNote,
      onGetWorkspaceNote,
      onListWorkspaceNotes,
      onUpdateWorkspaceNote,
    });
    await flushEffects();

    const textarea =
      document.querySelector<HTMLTextAreaElement>(".notes-body-input");

    expect(textarea).not.toBeNull();
    expect(textarea?.value).toBe(selectedNote.body);
    expect(textarea?.getAttribute("spellcheck")).toBe("false");

    changeTextarea(".notes-body-input", "# Release note\n\nUpdated body.");

    expect(textareaValue(".notes-body-input")).toBe(
      "# Release note\n\nUpdated body.",
    );
    expect(document.body.textContent).toContain("Unsaved");
  });

  it("renders a compact Markdown preview without changing the saved source", async () => {
    const selectedNote = note({
      body: "# Release note\n\n- Check `api`\n- Ship **carefully**",
      noteId: "note_42",
      title: "Falcon deployment note",
    });
    const onCreateWorkspaceNote = vi.fn();
    const onGetWorkspaceNote = vi.fn(async () => selectedNote);
    const onListWorkspaceNotes = vi.fn(async () => [selectedNote]);
    const onUpdateWorkspaceNote = vi.fn();

    renderWidget({
      onCreateWorkspaceNote,
      onGetWorkspaceNote,
      onListWorkspaceNotes,
      onUpdateWorkspaceNote,
    });
    await flushEffects();

    await clickButton("Preview");

    expect(document.querySelector(".notes-body-input")).toBeNull();
    expect(document.querySelector(".notes-markdown-preview")).not.toBeNull();
    expect(document.querySelector("h1")?.textContent).toBe("Release note");
    expect(document.querySelector(".notes-inline-code")?.textContent).toBe(
      "api",
    );
    expect(document.querySelectorAll(".notes-markdown-list li")).toHaveLength(
      2,
    );
    expect(onUpdateWorkspaceNote).not.toHaveBeenCalled();
  });

  it("renders fenced JSON blocks with JSON token styling", async () => {
    const selectedNote = note({
      body: '```json\n{"name":"Falcon","count":2,"ok":true}\n```',
      noteId: "note_42",
      title: "Falcon deployment note",
    });
    const onCreateWorkspaceNote = vi.fn();
    const onGetWorkspaceNote = vi.fn(async () => selectedNote);
    const onListWorkspaceNotes = vi.fn(async () => [selectedNote]);
    const onUpdateWorkspaceNote = vi.fn();

    renderWidget({
      onCreateWorkspaceNote,
      onGetWorkspaceNote,
      onListWorkspaceNotes,
      onUpdateWorkspaceNote,
    });
    await flushEffects();

    await clickButton("Preview");

    expect(document.querySelector(".notes-json-code-block")).not.toBeNull();
    expect(document.querySelector(".notes-json-key")?.textContent).toBe(
      '"name"',
    );
    expect(document.querySelector(".notes-json-string")?.textContent).toBe(
      '"Falcon"',
    );
    expect(document.querySelector(".notes-json-number")?.textContent).toBe("2");
    expect(document.querySelector(".notes-json-boolean")?.textContent).toBe(
      "true",
    );
  });

  it("renders whole-note JSON as formatted preview and preserves Pretty JSON explicit formatting", async () => {
    const selectedNote = note({
      body: '{"b":2,"a":[1]}',
      noteId: "note_42",
      title: "Falcon deployment note",
    });
    const onCreateWorkspaceNote = vi.fn();
    const onGetWorkspaceNote = vi.fn(async () => selectedNote);
    const onListWorkspaceNotes = vi.fn(async () => [selectedNote]);
    const onUpdateWorkspaceNote = vi.fn();

    renderWidget({
      onCreateWorkspaceNote,
      onGetWorkspaceNote,
      onListWorkspaceNotes,
      onUpdateWorkspaceNote,
    });
    await flushEffects();

    await clickButton("Preview");

    expect(document.querySelector(".notes-json-code-block")?.textContent).toBe(
      '{\n  "b": 2,\n  "a": [\n    1\n  ]\n}',
    );
    expect(onUpdateWorkspaceNote).not.toHaveBeenCalled();

    await clickButton("Edit");
    await clickButton("Format");

    expect(textareaValue(".notes-body-input")).toBe(
      '{\n  "b": 2,\n  "a": [\n    1\n  ]\n}',
    );
    expect(onUpdateWorkspaceNote).not.toHaveBeenCalled();
  });

  it("pretty formats JSON explicitly and saves the formatted dirty note", async () => {
    const selectedNote = note({
      body: '{"b":2,"a":[1]}',
      noteId: "note_42",
      title: "Falcon deployment note",
    });
    const formattedBody = '{\n  "b": 2,\n  "a": [\n    1\n  ]\n}';
    const updatedNote = {
      ...selectedNote,
      body: formattedBody,
      updatedAt: "2026-05-25T00:01:00.000Z",
    };
    const onCreateWorkspaceNote = vi.fn();
    const onGetWorkspaceNote = vi.fn(async () => selectedNote);
    const onListWorkspaceNotes = vi.fn(async () => [selectedNote]);
    const onUpdateWorkspaceNote = vi.fn(
      async (_request: UpdateNoteInput) => updatedNote,
    );

    renderWidget({
      onCreateWorkspaceNote,
      onGetWorkspaceNote,
      onListWorkspaceNotes,
      onUpdateWorkspaceNote,
    });
    await flushEffects();

    await clickButton("Format");

    expect(textareaValue(".notes-body-input")).toBe(formattedBody);
    expect(document.body.textContent).toContain("Unsaved");

    await clickButton("Save");
    await flushEffects();

    expect(onUpdateWorkspaceNote).toHaveBeenCalledWith({
      body: formattedBody,
      noteId: "note_42",
      pinned: false,
      title: "Falcon deployment note",
    });
    expect(document.body.textContent).toContain("Saved");
  });

  it("shows an inline formatting error for invalid JSON without changing content", async () => {
    const selectedNote = note({
      body: "{ bad json",
      noteId: "note_42",
      title: "Falcon deployment note",
    });
    const onCreateWorkspaceNote = vi.fn();
    const onGetWorkspaceNote = vi.fn(async () => selectedNote);
    const onListWorkspaceNotes = vi.fn(async () => [selectedNote]);
    const onUpdateWorkspaceNote = vi.fn();

    renderWidget({
      onCreateWorkspaceNote,
      onGetWorkspaceNote,
      onListWorkspaceNotes,
      onUpdateWorkspaceNote,
    });
    await flushEffects();

    await clickButton("Format");

    expect(textareaValue(".notes-body-input")).toBe("{ bad json");
    expect(document.body.textContent).toContain(
      "Invalid JSON. Note body was not changed.",
    );
    expect(onUpdateWorkspaceNote).not.toHaveBeenCalled();
  });

  it("shows an inline formatting error for invalid CSV without changing content", async () => {
    const selectedNote = note({
      body: 'name,note\nAda,"open',
      noteId: "note_42",
      title: "Falcon deployment note",
    });
    const onCreateWorkspaceNote = vi.fn();
    const onGetWorkspaceNote = vi.fn(async () => selectedNote);
    const onListWorkspaceNotes = vi.fn(async () => [selectedNote]);
    const onUpdateWorkspaceNote = vi.fn();

    renderWidget({
      onCreateWorkspaceNote,
      onGetWorkspaceNote,
      onListWorkspaceNotes,
      onUpdateWorkspaceNote,
    });
    await flushEffects();

    changeSelectByLabelText("Format", "normalize-csv");
    await clickButton("Format");

    expect(textareaValue(".notes-body-input")).toBe('name,note\nAda,"open');
    expect(document.body.textContent).toContain(
      "Invalid CSV. A quoted field is not closed.",
    );
    expect(onUpdateWorkspaceNote).not.toHaveBeenCalled();
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

async function clickButtonWithLabel(label: string) {
  await act(async () => {
    const button = buttonWithLabel(label);
    if (!button) {
      throw new Error(`Button not found: ${label}`);
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

function changeTextarea(selector: string, value: string) {
  act(() => {
    const textarea = document.querySelector<HTMLTextAreaElement>(selector);
    if (!textarea) {
      throw new Error(`Textarea not found: ${selector}`);
    }

    setNativeValue(textarea, value);
    textarea.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

function textareaValue(selector: string) {
  const textarea = document.querySelector<HTMLTextAreaElement>(selector);
  if (!textarea) {
    throw new Error(`Textarea not found: ${selector}`);
  }

  return textarea.value;
}

function changeSelectByLabelText(labelText: string, value: string) {
  act(() => {
    const label = Array.from(document.querySelectorAll("label")).find(
      (candidate) =>
        Array.from(candidate.querySelectorAll("span")).some(
          (span) => span.textContent === labelText,
        ),
    );
    const select = label?.querySelector("select");

    if (!select) {
      throw new Error(`Select not found for label: ${labelText}`);
    }

    setNativeValue(select, value);
    select.dispatchEvent(new Event("change", { bubbles: true }));
  });
}

function setNativeValue(
  element: HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement,
  value: string,
) {
  const valueSetter = Object.getOwnPropertyDescriptor(element, "value")?.set;
  const prototype = Object.getPrototypeOf(element) as
    | HTMLInputElement
    | HTMLSelectElement
    | HTMLTextAreaElement;
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

function buttonWithLabel(label: string) {
  return Array.from(document.querySelectorAll("button")).find(
    (button) => button.getAttribute("aria-label") === label,
  );
}

function resizeSeparator() {
  return document.querySelector<HTMLElement>('[role="separator"]');
}

async function dragSeparator(
  separator: HTMLElement,
  startClientX: number,
  endClientX: number,
) {
  await act(async () => {
    dispatchPointer(separator, "pointerdown", startClientX);
    await Promise.resolve();
  });
  await act(async () => {
    dispatchPointer(separator, "pointermove", endClientX);
    await Promise.resolve();
  });
  await act(async () => {
    dispatchPointer(separator, "pointerup", endClientX);
    await Promise.resolve();
  });
}

function dispatchPointer(
  element: HTMLElement,
  type: "pointerdown" | "pointermove" | "pointerup",
  clientX: number,
) {
  const PointerEventConstructor = window.PointerEvent ?? MouseEvent;
  element.dispatchEvent(
    new PointerEventConstructor(type, {
      bubbles: true,
      clientX,
      pointerId: 1,
    } as PointerEventInit),
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
