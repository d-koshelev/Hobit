import { useState } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import { isTauriRuntime } from "../workspace/tauriEnvironment";
import type { KnowledgeDocument } from "../workspace/types";
import {
  EMPTY_DOCUMENT_DRAFT,
  type KnowledgeDocumentDraft,
} from "./skillLibraryModel";
import { knowledgeDocumentQuickSummaryWarning } from "./knowledgeDocumentQuickSummaryWarning";
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

type ImportSelection =
  | {
      fileName: string;
      kind: "browser_file";
      sourceRef: string;
      title: string;
      content: string;
    }
  | {
      fileName: string;
      kind: "desktop_path";
      path: string;
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
  const [documentImportSelection, setDocumentImportSelection] =
    useState<ImportSelection | null>(null);
  const [documentImportScope, setDocumentImportScope] =
    useState<KnowledgeDocumentDraft["scope"]>(EMPTY_DOCUMENT_DRAFT.scope);
  const [isImportingDocument, setIsImportingDocument] = useState(false);
  const importPickerAvailable = isTauriRuntime();

  async function pickDesktopImportFile() {
    if (!importPickerAvailable || isImportingDocument) {
      return;
    }

    setDocumentMessage(null);
    setDocumentError(null);

    try {
      const selectedFile = (await open({
        directory: false,
        filters: [
          {
            extensions: ["txt", "md", "markdown"],
            name: "Text or Markdown",
          },
        ],
        multiple: false,
      })) as string | string[] | null;
      const path = Array.isArray(selectedFile)
        ? selectedFile[0]
        : selectedFile;

      if (!path) {
        return;
      }

      const fileName = fileNameFromPath(path);
      if (!isSupportedImportFileName(fileName)) {
        setDocumentMessage(
          "Choose a .txt, .md, or .markdown file. Folder import is not supported.",
        );
        return;
      }

      setDocumentImportSelection({
        fileName,
        kind: "desktop_path",
        path,
      });
    } catch (pickerError) {
      setDocumentError(
        errorToMessage(pickerError, "Unable to open file picker."),
      );
    }
  }

  async function selectBrowserImportFile(file: File | null) {
    setDocumentMessage(null);
    setDocumentError(null);

    if (!file) {
      return;
    }

    if (!isSupportedImportFileName(file.name)) {
      setDocumentMessage(
        "Choose a .txt, .md, or .markdown file. Folder import is not supported.",
      );
      return;
    }

    try {
      const content = await file.text();
      setDocumentImportSelection({
        content,
        fileName: file.name,
        kind: "browser_file",
        sourceRef: file.name,
        title: titleFromFileName(file.name),
      });
    } catch (readError) {
      setDocumentError(errorToMessage(readError, "Unable to read file."));
    }
  }

  async function importDocumentFromPath() {
    if (
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

    if (!documentImportSelection) {
      setDocumentMessage(
        "Choose a .txt, .md, or .markdown file before importing.",
      );
      return;
    }

    setIsImportingDocument(true);
    setDocumentMessage(null);
    setDocumentError(null);

    try {
      const importedFile =
        documentImportSelection.kind === "desktop_path"
          ? await readDesktopImportSelection(
              documentImportSelection,
              onReadKnowledgeDocumentImportFile,
            )
          : documentImportSelection;
      const importedDocument = await onCreateKnowledgeDocument({
        title: importedFile.title,
        scope: documentImportScope,
        catalogItemType: "documentation_knowledge",
        quickSummary: "",
        lifecycleStatus: "active",
        sourceLabel: importedFile.fileName,
        sourceKind: "file_import",
        sourceRef: importedFile.sourceRef,
        content: importedFile.content,
        tags: "",
        enabled: true,
      });

      setSelectedDocumentDraft(importedDocument);
      await loadDocuments(importedDocument.knowledgeDocumentId);
      setDocumentImportSelection(null);
      setDocumentImportScope("workspace");
      setDocumentMessage(
        [
          "Imported document",
          knowledgeDocumentQuickSummaryWarning(importedDocument),
        ]
          .filter(Boolean)
          .join(". "),
      );
    } catch (importError) {
      setDocumentError(
        errorToMessage(importError, "Unable to import document."),
      );
    } finally {
      setIsImportingDocument(false);
    }
  }

  return {
    documentImportPath: documentImportSelection?.fileName ?? "",
    documentImportScope,
    importDocumentFromPath,
    importPickerAvailable,
    isImportingDocument,
    pickDesktopImportFile,
    selectBrowserImportFile,
    setDocumentImportScope,
  };
}

async function readDesktopImportSelection(
  selection: Extract<ImportSelection, { kind: "desktop_path" }>,
  readImportFile: WidgetRenderProps["onReadKnowledgeDocumentImportFile"],
) {
  if (!readImportFile) {
    throw new Error(
      "Desktop file import is only available in the Tauri desktop shell.",
    );
  }

  const importedFile = await readImportFile({ path: selection.path });

  return {
    content: importedFile.content,
    fileName: importedFile.fileName,
    sourceRef: selection.path,
    title: importedFile.title,
  };
}

function isSupportedImportFileName(fileName: string) {
  return /\.(txt|md|markdown)$/i.test(fileName.trim());
}

function fileNameFromPath(path: string) {
  return path.split(/[\\/]/).pop() || path;
}

function titleFromFileName(fileName: string) {
  return fileName.replace(/\.(txt|md|markdown)$/i, "") || fileName;
}
