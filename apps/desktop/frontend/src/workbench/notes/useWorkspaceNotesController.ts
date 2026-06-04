import { useCallback, useEffect, useMemo, useState } from "react";
import type { KnowledgeDocument, WorkspaceNote } from "../../workspace/types";
import type { WidgetRenderProps } from "../types";

export const DEFAULT_NOTE_TITLE = "Untitled note";
const DEFAULT_PROMOTION_TYPE: KnowledgeDocument["catalogItemType"] =
  "documentation_knowledge";
const DEFAULT_PROMOTION_STATUS: KnowledgeDocument["lifecycleStatus"] = "active";

type WorkspaceNotesControllerProps = Pick<
  WidgetRenderProps,
  | "onCreateKnowledgeDocument"
  | "onCreateWorkspaceNote"
  | "onGetWorkspaceNote"
  | "onListWorkspaceNotes"
  | "onUpdateWorkspaceNote"
>;

export function useWorkspaceNotesController({
  onCreateKnowledgeDocument,
  onCreateWorkspaceNote,
  onGetWorkspaceNote,
  onListWorkspaceNotes,
  onUpdateWorkspaceNote,
}: WorkspaceNotesControllerProps) {
  const apiAvailable = Boolean(
    onCreateWorkspaceNote &&
      onGetWorkspaceNote &&
      onListWorkspaceNotes &&
      onUpdateWorkspaceNote,
  );
  const [notes, setNotes] = useState<WorkspaceNote[]>([]);
  const [selectedNote, setSelectedNote] = useState<WorkspaceNote | null>(null);
  const [draftTitle, setDraftTitle] = useState("");
  const [draftBody, setDraftBody] = useState("");
  const [draftPinned, setDraftPinned] = useState(false);
  const [searchText, setSearchText] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [isPromotionOpen, setIsPromotionOpen] = useState(false);
  const [isPromotingToKnowledge, setIsPromotingToKnowledge] = useState(false);
  const [isSelecting, setIsSelecting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [editorError, setEditorError] = useState<string | null>(null);
  const [promotionCatalogItemType, setPromotionCatalogItemType] =
    useState<KnowledgeDocument["catalogItemType"]>(DEFAULT_PROMOTION_TYPE);
  const [promotionLifecycleStatus, setPromotionLifecycleStatus] =
    useState<KnowledgeDocument["lifecycleStatus"]>(DEFAULT_PROMOTION_STATUS);
  const [promotionScope, setPromotionScope] =
    useState<KnowledgeDocument["scope"]>("workspace");
  const [promotionTags, setPromotionTags] = useState("");
  const [validationMessage, setValidationMessage] = useState<string | null>(
    null,
  );
  const [promotionMessage, setPromotionMessage] = useState<string | null>(null);
  const [promotionError, setPromotionError] = useState<string | null>(null);
  const isDirty = Boolean(
    selectedNote &&
      (draftTitle !== selectedNote.title ||
        draftBody !== selectedNote.body ||
        draftPinned !== selectedNote.pinned),
  );

  const filteredNotes = useMemo(() => {
    const query = searchText.trim().toLowerCase();

    if (!query) {
      return notes;
    }

    return notes.filter((note) =>
      `${note.title} ${note.body}`.toLowerCase().includes(query),
    );
  }, [notes, searchText]);

  const loadNotes = useCallback(
    async (preferredNoteId?: string | null) => {
      if (
        !onListWorkspaceNotes ||
        !onGetWorkspaceNote ||
        !onCreateWorkspaceNote ||
        !onUpdateWorkspaceNote
      ) {
        setNotes([]);
        clearSelectedNote();
        setLoadError("Workspace Notes API is not available in this runtime.");
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setLoadError(null);
      setEditorError(null);
      setValidationMessage(null);

      try {
        const loadedNotes = await onListWorkspaceNotes();
        setNotes(loadedNotes);

        const preferredExists = loadedNotes.some(
          (note) => note.noteId === preferredNoteId,
        );
        const noteIdToSelect = preferredExists
          ? preferredNoteId
          : loadedNotes[0]?.noteId;

        if (!noteIdToSelect) {
          clearSelectedNote();
          return;
        }

        const detail = await onGetWorkspaceNote(noteIdToSelect);

        if (!detail) {
          clearSelectedNote();
          setEditorError("The selected workspace note could not be found.");
          return;
        }

        setSelectedDraft(detail);
      } catch (error) {
        setNotes([]);
        clearSelectedNote();
        setLoadError(errorToMessage(error, "Unable to load workspace notes."));
      } finally {
        setIsLoading(false);
      }
    },
    [
      onCreateWorkspaceNote,
      onGetWorkspaceNote,
      onListWorkspaceNotes,
      onUpdateWorkspaceNote,
    ],
  );

  useEffect(() => {
    void loadNotes(null);
  }, [loadNotes]);

  async function createNote() {
    if (!onCreateWorkspaceNote || isCreating || isLoading) {
      return;
    }

    if (isDirty) {
      setValidationMessage("Save current note before creating another note.");
      return;
    }

    setIsCreating(true);
    setLoadError(null);
    setEditorError(null);
    setValidationMessage(null);

    try {
      const createdNote = await onCreateWorkspaceNote({
        title: DEFAULT_NOTE_TITLE,
        body: "",
        pinned: false,
      });
      await loadNotes(createdNote.noteId);
    } catch (error) {
      setEditorError(errorToMessage(error, "Unable to create workspace note."));
    } finally {
      setIsCreating(false);
    }
  }

  async function selectNote(noteId: string) {
    if (!onGetWorkspaceNote || isSelecting || selectedNote?.noteId === noteId) {
      return;
    }

    if (isDirty) {
      setValidationMessage("Save current note before selecting another note.");
      return;
    }

    setIsSelecting(true);
    setEditorError(null);
    setValidationMessage(null);

    try {
      const detail = await onGetWorkspaceNote(noteId);

      if (!detail) {
        setEditorError("The selected workspace note could not be found.");
        return;
      }

      setSelectedDraft(detail);
      setNotes((currentNotes) =>
        currentNotes.map((note) =>
          note.noteId === detail.noteId ? detail : note,
        ),
      );
    } catch (error) {
      setEditorError(errorToMessage(error, "Unable to open workspace note."));
    } finally {
      setIsSelecting(false);
    }
  }

  async function refreshNotes() {
    if (isDirty) {
      setValidationMessage("Save current note before refreshing notes.");
      return;
    }

    await loadNotes(selectedNote?.noteId ?? null);
  }

  function openKnowledgePromotion() {
    if (!selectedNote || isLoading) {
      return;
    }

    if (!onCreateKnowledgeDocument) {
      setPromotionError(
        "Knowledge Document creation is not available in this runtime.",
      );
      return;
    }

    if (isDirty) {
      setValidationMessage("Save current note before promoting to Knowledge.");
      return;
    }

    setPromotionCatalogItemType(DEFAULT_PROMOTION_TYPE);
    setPromotionLifecycleStatus(DEFAULT_PROMOTION_STATUS);
    setPromotionScope("workspace");
    setPromotionTags("");
    setIsPromotionOpen(true);
    setPromotionMessage(null);
    setPromotionError(null);
    setValidationMessage(null);
  }

  function cancelKnowledgePromotion() {
    if (isPromotingToKnowledge) {
      return;
    }

    setIsPromotionOpen(false);
    setPromotionMessage(null);
    setPromotionError(null);
  }

  async function promoteSelectedNoteToKnowledge() {
    if (!selectedNote || !onCreateKnowledgeDocument || isPromotingToKnowledge) {
      return;
    }

    if (isDirty) {
      setValidationMessage("Save current note before promoting to Knowledge.");
      return;
    }

    const documentTitle = selectedNote.title.trim() || DEFAULT_NOTE_TITLE;

    setIsPromotingToKnowledge(true);
    setPromotionMessage(null);
    setPromotionError(null);

    try {
      const createdDocument = await onCreateKnowledgeDocument({
        scope: promotionScope,
        catalogItemType: promotionCatalogItemType,
        quickSummary: firstUsefulLine(selectedNote.body),
        lifecycleStatus: promotionLifecycleStatus,
        title: documentTitle,
        sourceLabel: `Note: ${documentTitle}`,
        sourceKind: "workspace_note",
        sourceRef: selectedNote.noteId,
        content: selectedNote.body,
        tags: promotionTags,
        enabled: promotionLifecycleStatus === "active",
      });

      setIsPromotionOpen(false);
      setPromotionMessage(
        `Knowledge Document created: ${createdDocument.title}. Note unchanged.`,
      );
    } catch (error) {
      setPromotionError(
        errorToMessage(error, "Unable to promote note to Knowledge."),
      );
    } finally {
      setIsPromotingToKnowledge(false);
    }
  }

  async function saveNote() {
    if (!selectedNote || !onUpdateWorkspaceNote || !isDirty || isSaving) {
      return;
    }

    const nextTitle = draftTitle.trim();

    if (!nextTitle) {
      setValidationMessage("Title is required before saving.");
      return;
    }

    setIsSaving(true);
    setEditorError(null);
    setValidationMessage(null);

    try {
      const updatedNote = await onUpdateWorkspaceNote({
        noteId: selectedNote.noteId,
        title: nextTitle,
        body: draftBody,
        pinned: draftPinned,
      });

      if (!updatedNote) {
        setEditorError("The selected workspace note could not be found.");
        return;
      }

      setSelectedDraft(updatedNote);
      setNotes((currentNotes) =>
        currentNotes.map((note) =>
          note.noteId === updatedNote.noteId ? updatedNote : note,
        ),
      );
    } catch (error) {
      setEditorError(errorToMessage(error, "Unable to save workspace note."));
    } finally {
      setIsSaving(false);
    }
  }

  function updateDraftTitle(value: string) {
    setDraftTitle(value);
    setValidationMessage(null);
    setPromotionMessage(null);
    setPromotionError(null);
  }

  function updateDraftBody(value: string) {
    setDraftBody(value);
    setValidationMessage(null);
    setPromotionMessage(null);
    setPromotionError(null);
  }

  function updateDraftPinned(value: boolean) {
    setDraftPinned(value);
    setValidationMessage(null);
  }

  function setSelectedDraft(note: WorkspaceNote) {
    setSelectedNote(note);
    setDraftTitle(note.title);
    setDraftBody(note.body);
    setDraftPinned(note.pinned);
    setIsPromotionOpen(false);
    setPromotionMessage(null);
    setPromotionError(null);
  }

  function clearSelectedNote() {
    setSelectedNote(null);
    setDraftTitle("");
    setDraftBody("");
    setDraftPinned(false);
    setIsPromotionOpen(false);
    setPromotionMessage(null);
    setPromotionError(null);
  }

  return {
    apiAvailable,
    cancelKnowledgePromotion,
    createNote,
    draftBody,
    draftPinned,
    draftTitle,
    editorError,
    filteredNotes,
    isCreating,
    isDirty,
    isLoading,
    isPromotingToKnowledge,
    isPromotionOpen,
    isSaving,
    isSelecting,
    knowledgePromotionAvailable: Boolean(onCreateKnowledgeDocument),
    loadError,
    notes,
    openKnowledgePromotion,
    promoteSelectedNoteToKnowledge,
    promotionCatalogItemType,
    promotionError,
    promotionLifecycleStatus,
    promotionMessage,
    promotionScope,
    promotionTags,
    refreshNotes,
    saveNote,
    searchText,
    selectNote,
    selectedNote,
    setPromotionCatalogItemType,
    setPromotionLifecycleStatus,
    setPromotionScope,
    setPromotionTags,
    setSearchText,
    updateDraftBody,
    updateDraftPinned,
    updateDraftTitle,
    validationMessage,
  };
}

function errorToMessage(error: unknown, fallback: string): string {
  if (error instanceof Error) {
    return error.message;
  }

  return fallback;
}

function firstUsefulLine(value: string) {
  return (
    value
      .split(/\r?\n/)
      .map((line) => line.trim())
      .find(Boolean) ?? ""
  );
}
