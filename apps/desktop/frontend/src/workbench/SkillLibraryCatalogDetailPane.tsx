import type { KnowledgeDocument, Skill } from "../workspace/types";
import {
  CatalogDocumentPreview,
  CatalogSkillPreview,
} from "./SkillLibraryCatalogPreview";
import type {
  KnowledgeCatalogAttachmentState,
  KnowledgeCatalogListItem,
} from "./skillLibraryModel";

type SkillLibraryCatalogDetailPaneProps = {
  attachmentState?: KnowledgeCatalogAttachmentState;
  canAttachContextToCoordinator: boolean;
  canAttachKnowledgeContextToQueueTask: boolean;
  documents: KnowledgeDocument[];
  error: string | null;
  isDocumentDirty: boolean;
  item: KnowledgeCatalogListItem | null;
  message: string | null;
  selectedDocument: KnowledgeDocument | null;
  selectedSkill: Skill | null;
  skills: Skill[];
  onAttachDocumentToQueueTask: () => void;
  onAttachSkillToQueueTask: () => void;
  onAttachSkillToWorkspaceAgent: () => void;
  onEditDocument: () => void;
  onEditSkill: () => void;
};

export function SkillLibraryCatalogDetailPane({
  attachmentState,
  canAttachContextToCoordinator,
  canAttachKnowledgeContextToQueueTask,
  documents,
  error,
  isDocumentDirty,
  item,
  message,
  selectedDocument,
  selectedSkill,
  skills,
  onAttachDocumentToQueueTask,
  onAttachSkillToQueueTask,
  onAttachSkillToWorkspaceAgent,
  onEditDocument,
  onEditSkill,
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
          onEditSkill={onEditSkill}
          skill={selectedSkill}
          skills={skills}
        />
      ) : selectedDocument ? (
        <CatalogDocumentPreview
          attachmentState={attachmentState}
          canAttachToQueueTask={Boolean(
            !isDocumentDirty && canAttachKnowledgeContextToQueueTask,
          )}
          document={selectedDocument}
          documents={documents}
          error={error}
          item={item}
          message={message}
          onAttachToQueueTask={onAttachDocumentToQueueTask}
          onEditDocument={onEditDocument}
          skills={skills}
        />
      ) : (
        <div className="skill-catalog-empty-preview">
          <p className="skill-list-meta">Selected preview</p>
          <h3>No catalog item selected.</h3>
          <p>
            Select a Knowledge Document or Skill from the catalog, or use New
            item to create a document in the editor drawer.
          </p>
        </div>
      )}
    </section>
  );
}
