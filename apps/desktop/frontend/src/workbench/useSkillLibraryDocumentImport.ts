import { useState } from "react";
import type { KnowledgeDocument } from "../workspace/types";
import {
  EMPTY_DOCUMENT_DRAFT,
  type KnowledgeDocumentDraft,
} from "./skillLibraryModel";
import { errorToMessage } from "./SkillLibraryDocumentsPanel.helpers";
import type { WidgetRenderProps } from "./types";

type UseSkillLibraryDocumentImportParams = {
  isDocumentDirty: boolean;
  loadDocuments: (preferredDocumentId: string | null) => Promise<void>;
  onCreateKnowledgeDocument: WidgetRenderProps["onCreateKnowledgeDocument"];
  onReadKnowledgeDocumentImportFile: WidgetRenderProps["onReadKnowledgeDocumentImportFile"];
  setDocumentError: (message: string | null) => void;
  setDocumentMessage: (message: string | null) => void;
  setSelectedDocumentDraft: (document: KnowledgeDocument) => void;
};

export function useSkillLibraryDocumentImport({
  isDocumentDirty,
  loadDocuments,
  onCreateKnowledgeDocument,
  onReadKnowledgeDocumentImportFile,
  setDocumentError,
  setDocumentMessage,
  setSelectedDocumentDraft,
}: UseSkillLibraryDocumentImportParams) {
  const [documentImportPath, setDocumentImportPath] = useState("");
  const [documentImportScope, setDocumentImportScope] =
    useState<KnowledgeDocumentDraft["scope"]>(EMPTY_DOCUMENT_DRAFT.scope);
  const [isImportingDocument, setIsImportingDocument] = useState(false);

  function updateDocumentImportPath(path: string) {
    setDocumentImportPath(path);
    setDocumentMessage(null);
    setDocumentError(null);
  }

  async function importDocumentFromPath() {
    if (
      !onReadKnowledgeDocumentImportFile ||
      !onCreateKnowledgeDocument ||
      isImportingDocument
    ) {
      return;
    }

    if (isDocumentDirty) {
      setDocumentMessage(
        "Save or discard the current document before importing another.",
      );
      return;
    }

    const path = documentImportPath.trim();
    if (!path) {
      setDocumentMessage("Path is required before importing.");
      return;
    }

    setIsImportingDocument(true);
    setDocumentMessage(null);
    setDocumentError(null);

    try {
      const importedFile = await onReadKnowledgeDocumentImportFile({ path });
      const importedDocument = await onCreateKnowledgeDocument({
        title: importedFile.title,
        scope: documentImportScope,
        catalogItemType: "documentation_knowledge",
        quickSummary: "",
        lifecycleStatus: "active",
        sourceLabel: importedFile.fileName,
        sourceKind: "file_import",
        sourceRef: path,
        content: importedFile.content,
        tags: "",
        enabled: true,
      });

      setSelectedDocumentDraft(importedDocument);
      await loadDocuments(importedDocument.knowledgeDocumentId);
      setDocumentImportPath("");
      setDocumentImportScope("workspace");
      setDocumentMessage("Imported document");
    } catch (importError) {
      setDocumentError(
        errorToMessage(importError, "Unable to import document."),
      );
    } finally {
      setIsImportingDocument(false);
    }
  }

  return {
    documentImportPath,
    documentImportScope,
    importDocumentFromPath,
    isImportingDocument,
    setDocumentImportScope,
    updateDocumentImportPath,
  };
}
