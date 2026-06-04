import { Button } from "../design-system/Button";
import type { KnowledgeDocumentDraft } from "./skillLibraryModel";

type SkillLibraryDocumentImportControlsProps = {
  documentApiAvailable: boolean;
  documentImportPath: string;
  documentImportScope: KnowledgeDocumentDraft["scope"];
  hasImportFileApi: boolean;
  isDeletingDocument: boolean;
  isImportingDocument: boolean;
  isSavingDocument: boolean;
  onDocumentImportPathChange: (path: string) => void;
  onDocumentImportScopeChange: (
    scope: KnowledgeDocumentDraft["scope"],
  ) => void;
  onImportDocument: () => void;
};

export function SkillLibraryDocumentImportControls({
  documentApiAvailable,
  documentImportPath,
  documentImportScope,
  hasImportFileApi,
  isDeletingDocument,
  isImportingDocument,
  isSavingDocument,
  onDocumentImportPathChange,
  onDocumentImportScopeChange,
  onImportDocument,
}: SkillLibraryDocumentImportControlsProps) {
  return (
    <div className="skill-document-import">
      <label className="skill-field skill-document-import-path">
        <span>Import path</span>
        <input
          className="input"
          onChange={(event) =>
            onDocumentImportPathChange(event.currentTarget.value)
          }
          placeholder="Path to .txt, .md, or .markdown file"
          value={documentImportPath}
        />
      </label>
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
          isImportingDocument ||
          isSavingDocument ||
          isDeletingDocument
        }
        onClick={onImportDocument}
        title={
          hasImportFileApi
            ? "Imports one explicit .txt, .md, or .markdown file into this workspace."
            : "Import from path is only available in the Tauri desktop shell."
        }
        variant="secondary"
      >
        {isImportingDocument ? "Importing" : "Import .txt/.md"}
      </Button>
    </div>
  );
}
