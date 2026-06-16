import { useState } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import { isTauriRuntime } from "../../../workspace/tauriEnvironment";
import type { KnowledgeDocument } from "../../../workspace/types";
import {
  EMPTY_DOCUMENT_DRAFT,
  EMPTY_SKILL_DRAFT,
  type KnowledgeDocumentDraft,
  type SkillDraft,
} from "./skillLibraryModel";
import { knowledgeDocumentQuickSummaryWarning } from "../../knowledgeDocumentQuickSummaryWarning";
import { errorToMessage } from "./SkillLibraryDocumentsPanel.helpers";
import type { WidgetRenderProps } from "../../types";

const MAX_IMPORT_FILE_BYTES = 1024 * 1024;
const LARGE_IMPORT_CONTENT_CHARS = 100_000;

type UseSkillLibraryDocumentImportParams = {
  isDocumentDirty: boolean;
  loadDocuments: (preferredDocumentId: string | null) => Promise<void>;
  onLoadSkillImportDraft: (request: SkillImportDraftRequest) => void;
  onCreateKnowledgeDocument: WidgetRenderProps["onCreateKnowledgeDocument"];
  onReadKnowledgeDocumentImportFile: WidgetRenderProps["onReadKnowledgeDocumentImportFile"];
  setDocumentError: (message: string | null) => void;
  setDocumentMessage: (message: string | null) => void;
  setSelectedDocumentDraft: (document: KnowledgeDocument) => void;
};

export type SkillLibraryImportTarget = "document" | "skill";

export type SkillImportDraftRequest = {
  draft: SkillDraft;
  fileName: string;
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
  onLoadSkillImportDraft,
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
  const [importTarget, setImportTarget] =
    useState<SkillLibraryImportTarget>("document");
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

    if (file.size > MAX_IMPORT_FILE_BYTES) {
      setDocumentMessage("Selected file is too large. Import supports files up to 1 MB.");
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

  async function loadSelectedImportFile() {
    if (isImportingDocument) {
      return;
    }

    if (importTarget === "document" && !onCreateKnowledgeDocument) {
      return;
    }

    if (importTarget === "document" && isDocumentDirty) {
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
      const importWarnings = knowledgeImportWarnings(importedFile.content);
      if (importTarget === "skill") {
        onLoadSkillImportDraft({
          draft: skillDraftFromImportedFile(importedFile),
          fileName: importedFile.fileName,
        });
        setDocumentImportSelection(null);
        setDocumentMessage(
          `Loaded ${importedFile.fileName} as a Skill draft for review. Save it from the Skill editor to keep it.`,
        );
        return;
      }

      const createKnowledgeDocument = onCreateKnowledgeDocument;

      if (!createKnowledgeDocument) {
        return;
      }

      const importedDocument = await createKnowledgeDocument({
        title: importedFile.title,
        scope: documentImportScope,
        catalogItemType: "documentation_knowledge",
        quickSummary: "",
        lifecycleStatus: "active",
        sourceLabel: importedFile.fileName,
        sourceKind: "import_file",
        sourceRef: importedFile.sourceRef,
        sourceRefs: [
          {
            cap: "Explicit single-file plain text/Markdown import only",
            caps: ["Explicit single-file plain text/Markdown import only"],
            fileName: importedFile.fileName,
            kind: "import_file",
            label: importedFile.fileName,
            path: importedFile.sourceRef,
            reason: "Operator imported one selected text/Markdown file.",
            warnings: [
              "No folder import, binary parsing, or background ingest.",
              ...importWarnings,
            ],
            workspaceScope:
              documentImportScope === "global" ? "global" : "workspace-local",
          },
        ],
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
          importWarnings.length > 0
            ? `Import warnings: ${importWarnings.join(" ")}`
            : "",
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
    importTarget,
    loadSelectedImportFile,
    importPickerAvailable,
    isImportingDocument,
    pickDesktopImportFile,
    selectBrowserImportFile,
    setDocumentImportScope,
    setImportTarget,
  };
}

function knowledgeImportWarnings(content: string) {
  const warnings: string[] = [];

  if (content.length > LARGE_IMPORT_CONTENT_CHARS) {
    warnings.push("Large content was imported; future context uses bounded excerpts.");
  }

  if (containsPossibleSecret(content)) {
    warnings.push("Possible credential or token detected; redact before use.");
  }

  return warnings;
}

function containsPossibleSecret(value: string) {
  const lowered = value.toLocaleLowerCase();
  return (
    lowered.includes("-----begin private key-----") ||
    /\b(password|passwd|pwd|api[_-]?key|secret|token|access[_-]?key)\s*[:=]/i.test(value) ||
    /\baws[_-]?secret[_-]?access[_-]?key\b/i.test(value) ||
    /\bAKIA[0-9A-Z]{16}\b/.test(value)
  );
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

function skillDraftFromImportedFile(importedFile: {
  content: string;
  fileName: string;
  sourceRef: string;
  title: string;
}): SkillDraft {
  return {
    ...EMPTY_SKILL_DRAFT,
    prerequisites: [`Source file: ${importedFile.fileName}`, importedFile.sourceRef].filter(Boolean).join("\n"),
    steps: importedFile.content,
    tags: "import",
    title: importedFile.title,
    whenToUse: `Review this imported Skill draft before use. Source: ${importedFile.fileName}`,
  };
}
