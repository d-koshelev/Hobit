import type { ChangeEvent } from "react";
import { Button } from "../../../design-system/Button";
import type { SkillLibraryImportTarget } from "./useSkillLibraryDocumentImport";
import type { KnowledgeDocumentDraft } from "./skillLibraryModel";

type SkillLibraryDocumentImportControlsProps = {
  documentApiAvailable: boolean;
  documentImportPath: string;
  documentImportScope: KnowledgeDocumentDraft["scope"];
  hasImportFileApi: boolean;
  importTarget: SkillLibraryImportTarget;
  importPickerAvailable: boolean;
  isDeletingDocument: boolean;
  isImportingDocument: boolean;
  isSavingDocument: boolean;
  onBrowserFileSelected: (file: File | null) => void;
  onDocumentImportScopeChange: (
    scope: KnowledgeDocumentDraft["scope"],
  ) => void;
  onImportTargetChange: (target: SkillLibraryImportTarget) => void;
  onLoadSelectedImportFile: () => void;
  onPickImportFile: () => void;
  skillImportAvailable: boolean;
};

export function SkillLibraryDocumentImportControls({
  documentApiAvailable,
  documentImportPath,
  documentImportScope,
  hasImportFileApi,
  importTarget,
  importPickerAvailable,
  isDeletingDocument,
  isImportingDocument,
  isSavingDocument,
  onBrowserFileSelected,
  onDocumentImportScopeChange,
  onImportTargetChange,
  onLoadSelectedImportFile,
  onPickImportFile,
  skillImportAvailable,
}: SkillLibraryDocumentImportControlsProps) {
  const isSkillImport = importTarget === "skill";
  const pickerDisabled =
    (!documentApiAvailable && !skillImportAvailable) ||
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
      <div className="skill-document-import-intro">
        <p className="skill-list-meta">Import selected file</p>
        <p>
          Choose one plain text or Markdown file, confirm the target, then load
          it into the catalog. Folder import, binary parsing, background
          ingestion, and vector indexing are not implemented.
        </p>
      </div>
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
      <label className="skill-field skill-document-import-target">
        <span>Target</span>
        <select
          className="input"
          onChange={(event) =>
            onImportTargetChange(
              event.currentTarget.value === "skill" ? "skill" : "document",
            )
          }
          value={importTarget}
        >
          <option value="document">Knowledge Document</option>
          <option value="skill">Skill draft</option>
        </select>
      </label>
      <label className="skill-field skill-document-import-scope">
        <span>Import as</span>
        <select
          className="input"
          disabled={isSkillImport}
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
      {isSkillImport ? (
        <p className="skill-document-import-note">
          Skill file import is limited to loading plain text or Markdown into an
          unsaved Skill draft. Structured Skill package import is not
          implemented; review and save the draft from the Skill editor.
        </p>
      ) : (
        <p className="skill-document-import-note">
          Knowledge Document import creates an active enabled document from the
          selected file through the normal document create path.
        </p>
      )}
      <Button
        disabled={
          (isSkillImport ? !skillImportAvailable : !documentApiAvailable) ||
          !hasImportFileApi ||
          !documentImportPath ||
          isImportingDocument ||
          isSavingDocument ||
          isDeletingDocument
        }
        onClick={onLoadSelectedImportFile}
        title={
          hasImportFileApi
            ? isSkillImport
              ? "Loads the selected .txt, .md, or .markdown file into an unsaved Skill draft."
              : "Imports the selected .txt, .md, or .markdown file into this workspace."
            : "File import is unavailable in this runtime."
        }
        variant="primary"
      >
        {isImportingDocument
          ? isSkillImport
            ? "Loading"
            : "Importing"
          : isSkillImport
            ? "Load skill draft"
            : "Import document"}
      </Button>
    </div>
  );
}
