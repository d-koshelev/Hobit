import type { ChangeEvent } from "react";
import { Button } from "../design-system/Button";
import type { KnowledgeDocumentDraft } from "./skillLibraryModel";

type SkillLibraryDocumentImportControlsProps = {
  documentApiAvailable: boolean;
  documentImportPath: string;
  documentImportScope: KnowledgeDocumentDraft["scope"];
  hasImportFileApi: boolean;
  importPickerAvailable: boolean;
  isDeletingDocument: boolean;
  isImportingDocument: boolean;
  isSavingDocument: boolean;
  onBrowserFileSelected: (file: File | null) => void;
  onDocumentImportScopeChange: (
    scope: KnowledgeDocumentDraft["scope"],
  ) => void;
  onImportDocument: () => void;
  onPickImportFile: () => void;
};

export function SkillLibraryDocumentImportControls({
  documentApiAvailable,
  documentImportPath,
  documentImportScope,
  hasImportFileApi,
  importPickerAvailable,
  isDeletingDocument,
  isImportingDocument,
  isSavingDocument,
  onBrowserFileSelected,
  onDocumentImportScopeChange,
  onImportDocument,
  onPickImportFile,
}: SkillLibraryDocumentImportControlsProps) {
  const pickerDisabled =
    !documentApiAvailable ||
    !hasImportFileApi ||
    isImportingDocument ||
    isSavingDocument ||
    isDeletingDocument;

  function handleBrowserFileChange(event: ChangeEvent<HTMLInputElement>) {
    onBrowserFileSelected(event.currentTarget.files?.[0] ?? null);
    event.currentTarget.value = "";
  }

  return (
    <div className="skill-document-import">
      <div className="skill-field skill-document-import-path">
        <span>Selected file</span>
        <div className="skill-document-import-picker-row">
          {importPickerAvailable ? (
            <Button
              disabled={pickerDisabled}
              onClick={onPickImportFile}
              title="Choose one .txt, .md, or .markdown file. Folder import is not supported."
              variant="secondary"
            >
              Choose file
            </Button>
          ) : (
            <label
              className={[
                "button",
                "button-secondary",
                pickerDisabled
                  ? "skill-document-import-file-button-disabled"
                  : "",
              ]
                .filter(Boolean)
                .join(" ")}
              title="Choose one .txt, .md, or .markdown file. Folder import is not supported."
            >
              Choose file
              <input
                accept=".txt,.md,.markdown,text/plain,text/markdown"
                aria-label="Choose Knowledge import file"
                className="skill-document-import-file-input"
                disabled={pickerDisabled}
                onChange={handleBrowserFileChange}
                type="file"
              />
            </label>
          )}
          <span className="skill-document-import-file-label">
            {documentImportPath || "No file selected"}
          </span>
        </div>
      </div>
      <label className="skill-field skill-document-import-scope">
        <span>Import as</span>
        <select
          className="input"
          onChange={(event) =>
            onDocumentImportScopeChange(
              event.currentTarget.value === "global" ? "global" : "workspace",
            )
          }
          value={documentImportScope}
        >
          <option value="workspace">Workspace document</option>
          <option value="global">Global document</option>
        </select>
      </label>
      <Button
        disabled={
          !documentApiAvailable ||
          !hasImportFileApi ||
          !documentImportPath ||
          isImportingDocument ||
          isSavingDocument ||
          isDeletingDocument
        }
        onClick={onImportDocument}
        title={
          hasImportFileApi
            ? "Imports the selected .txt, .md, or .markdown file into this workspace."
            : "File import is unavailable in this runtime."
        }
        variant="secondary"
      >
        {isImportingDocument ? "Importing" : "Import .txt/.md"}
      </Button>
    </div>
  );
}
