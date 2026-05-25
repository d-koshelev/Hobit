import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

import { NotesPlaceholderWidget } from "./NotesPlaceholderWidget";
import type { WidgetDefinition, WidgetInstance } from "./types";
import type { CreateWorkspaceNoteRequest, WorkspaceNote } from "../workspace/types";

type CreateNoteInput = Omit<CreateWorkspaceNoteRequest, "workspaceId">;

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
  it("renders the compact empty state and creates a note from New note", async () => {
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
      "Create a note to capture workspace context.",
    );
    expect(document.querySelector(".notes-empty-state-compact")).not.toBeNull();

    await clickNotesEmptyStateAction();
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

async function clickNotesEmptyStateAction() {
  await act(async () => {
    const button = document.querySelector<HTMLButtonElement>(
      ".notes-empty-state-action",
    );
    if (!button) {
      throw new Error("Notes empty-state action not found.");
    }
    button.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    await Promise.resolve();
  });
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
