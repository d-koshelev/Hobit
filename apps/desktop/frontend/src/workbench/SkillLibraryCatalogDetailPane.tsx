import type { KnowledgeDocument, Skill } from "../workspace/types";
import {
  CatalogDocumentEditor,
  CatalogSkillPreview,
} from "./SkillLibraryCatalogPreview";
import { isSourceBackedDocument } from "./SkillLibraryDocumentsPanel.helpers";
import type {
  KnowledgeCatalogAttachmentState,
  KnowledgeCatalogListItem,
  KnowledgeDocumentDraft,
} from "./skillLibraryModel";

type SkillLibraryCatalogDetailPaneProps = {
  attachmentState?: KnowledgeCatalogAttachmentState;
  canAttachContextToCoordinator: boolean;
  canAttachKnowledgeContextToQueueTask: boolean;
  canCreateAgentQueueTask: boolean;
  documentApiAvailable: boolean;
  documentDraft: KnowledgeDocumentDraft;
  documents: KnowledgeDocument[];
  error: string | null;
  isCreatingRefreshTask: boolean;
  isDeletingDocument: boolean;
  isDocumentDirty: boolean;
  isSavingDocument: boolean;
  item: KnowledgeCatalogListItem | null;
  message: string | null;
  selectedDocument: KnowledgeDocument | null;
  selectedSkill: Skill | null;
  skills: Skill[];
  onArchiveDocument: () => void;
  onAttachDocumentToQueueTask: () => void;
  onAttachSkillToQueueTask: () => void;
  onAttachSkillToWorkspaceAgent: () => void;
  onCreateRefreshTask: () => void;
  onDeleteDocument: () => void;
  onDiscardDraft: () => void;
  onMarkStale: () => void;
  onRestoreDocument: () => void;
  onSaveDocument: () => void;
  onSetDocumentDraftField: <Key extends keyof KnowledgeDocumentDraft>(
    key: Key,
    value: KnowledgeDocumentDraft[Key],
  ) => void;
  onManageSkill: () => void;
};

export function SkillLibraryCatalogDetailPane({
  attachmentState,
  canAttachContextToCoordinator,
  canAttachKnowledgeContextToQueueTask,
  canCreateAgentQueueTask,
  documentApiAvailable,
  documentDraft,
  documents,
  error,
  isCreatingRefreshTask,
  isDeletingDocument,
  isDocumentDirty,
  isSavingDocument,
  item,
  message,
  selectedDocument,
  selectedSkill,
  skills,
  onArchiveDocument,
  onAttachDocumentToQueueTask,
  onAttachSkillToQueueTask,
  onAttachSkillToWorkspaceAgent,
  onCreateRefreshTask,
  onDeleteDocument,
  onDiscardDraft,
  onMarkStale,
  onRestoreDocument,
  onSaveDocument,
  onSetDocumentDraftField,
  onManageSkill,
}: SkillLibraryCatalogDetailPaneProps) {
  return (
    <section className="skill-editor-pane" aria-label="Selected catalog item">
      {selectedSkill ? (
        <CatalogSkillPreview
          attachmentState={attachmentState}
          canAttachToWorkspaceAgent={canAttachContextToCoordinator}
          canAttachToQueueTask={Boolean(
            selectedSkill && canAttachKnowledgeContextToQueueTask,
          )}
          documents={documents}
          error={error}
          item={item}
          message={message}
          onAttachToQueueTask={onAttachSkillToQueueTask}
          onAttachToWorkspaceAgent={onAttachSkillToWorkspaceAgent}
          onManageSkill={onManageSkill}
          skill={selectedSkill}
          skills={skills}
        />
      ) : (
        <CatalogDocumentEditor
          attachmentState={attachmentState}
          canAttachToQueueTask={Boolean(
            selectedDocument &&
              !isDocumentDirty &&
              canAttachKnowledgeContextToQueueTask,
          )}
          canCreateRefreshTask={Boolean(
            selectedDocument &&
              !isDocumentDirty &&
              canCreateAgentQueueTask &&
              isSourceBackedDocument(selectedDocument),
          )}
          documentApiAvailable={documentApiAvailable}
          documents={documents}
          draft={documentDraft}
          error={error}
          isCreatingRefreshTask={isCreatingRefreshTask}
          isDeletingDocument={isDeletingDocument}
          isDirty={isDocumentDirty}
          isSavingDocument={isSavingDocument}
          item={item}
          message={message}
          onAttachToQueueTask={onAttachDocumentToQueueTask}
          onArchiveDocument={onArchiveDocument}
          onCreateRefreshTask={onCreateRefreshTask}
          onDeleteDocument={onDeleteDocument}
          onDiscardDraft={onDiscardDraft}
          onMarkStale={onMarkStale}
          onRestoreDocument={onRestoreDocument}
          onSaveDocument={onSaveDocument}
          onSetDraftField={onSetDocumentDraftField}
          skills={skills}
        />
      )}
    </section>
  );
}
