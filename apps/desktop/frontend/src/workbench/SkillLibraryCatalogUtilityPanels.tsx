import type { Ref } from "react";
import { Button } from "../design-system/Button";
import type { KnowledgeDocument, Skill } from "../workspace/types";
import { CatalogDocumentEditor } from "./SkillLibraryCatalogPreview";
import type { KnowledgeDraftReviewItem, KnowledgeDraftReviewPack } from "./knowledgeDraftPacks";
import type {
  KnowledgeCatalogAttachmentState,
  KnowledgeCatalogListItem,
  KnowledgeDocumentDraft,
} from "./skillLibraryModel";
import { SkillLibraryDocumentImportControls } from "./SkillLibraryDocumentImportControls";
import { SkillLibraryDraftReviewPanel } from "./SkillLibraryDraftReviewPanel";
import {
  SkillLibrarySkillsPanel,
  type SkillLibrarySkillsPanelHandle,
} from "./SkillLibrarySkillsPanel";
import type { WidgetRenderProps } from "./types";

export type KnowledgeUtilityPanel =
  | "document"
  | "import"
  | "drafts"
  | "skills"
  | null;

type DraftReviewDecision = "accepted" | "pending" | "rejected";

type SkillLibraryCatalogUtilityPanelsProps = {
  activeUtilityPanel: KnowledgeUtilityPanel;
  attachmentState?: KnowledgeCatalogAttachmentState;
  canAttachKnowledgeContextToQueueTask: boolean;
  canCreateAgentQueueTask: boolean;
  documentApiAvailable: boolean;
  documentDraft: KnowledgeDocumentDraft;
  documentError: string | null;
  documentImportPath: string;
  documentImportScope: KnowledgeDocumentDraft["scope"];
  documentMessage: string | null;
  documents: KnowledgeDocument[];
  draftPayload: string;
  draftReviewDecisions: Record<string, DraftReviewDecision>;
  draftReviewPack: KnowledgeDraftReviewPack | null;
  hasImportFileApi: boolean;
  importPickerAvailable: boolean;
  isAcceptingDraftItem: boolean;
  isCreatingRefreshTask: boolean;
  isDeletingDocument: boolean;
  isDocumentDirty: boolean;
  isImportingDocument: boolean;
  isSavingDocument: boolean;
  selectedCatalogItem: KnowledgeCatalogListItem | null;
  selectedDocument: KnowledgeDocument | null;
  skills: Skill[];
  onAcceptDraftItem: (item: KnowledgeDraftReviewItem) => void;
  onArchiveDocument: () => void;
  onAttachDocumentToQueueTask: () => void;
  onAttachContextToCoordinator: WidgetRenderProps["onAttachContextToCoordinator"];
  onAttachKnowledgeContextToQueueTask: WidgetRenderProps["onAttachKnowledgeContextToQueueTask"];
  onClearDraftReviewPayload: () => void;
  onCloseUtilityPanel: () => void;
  onCreateRefreshTask: () => void;
  onCreateSkill: WidgetRenderProps["onCreateSkill"];
  onDeleteDocument: () => void;
  onDeleteSkill: WidgetRenderProps["onDeleteSkill"];
  onDiscardDraft: () => void;
  onDocumentImportScopeChange: (scope: KnowledgeDocument["scope"]) => void;
  onDraftPayloadChange: (payload: string) => void;
  onImportBrowserFileSelected: (file: File | null) => void;
  onGetSkill: WidgetRenderProps["onGetSkill"];
  onImportDocument: () => void;
  onListSkills: WidgetRenderProps["onListSkills"];
  onLoadDraftReviewPayload: () => void;
  onMarkStale: () => void;
  onOpenDocumentPanel: () => void;
  onPickImportFile: () => void;
  onRejectDraftItem: (item: KnowledgeDraftReviewItem) => void;
  onRestoreDocument: () => void;
  onSaveDocument: () => void;
  onSetDocumentDraftField: <Key extends keyof KnowledgeDocumentDraft>(
    key: Key,
    value: KnowledgeDocumentDraft[Key],
  ) => void;
  onSkillsChanged: () => void;
  onStartNewSkill: () => void;
  onToggleUtilityPanel: (panel: Exclude<KnowledgeUtilityPanel, null>) => void;
  onUpdateSkill: WidgetRenderProps["onUpdateSkill"];
  skillCreateAvailable: boolean;
  skillsPanelRef: Ref<SkillLibrarySkillsPanelHandle>;
};

export function SkillLibraryCatalogUtilityPanels({
  activeUtilityPanel,
  attachmentState,
  canAttachKnowledgeContextToQueueTask,
  canCreateAgentQueueTask,
  documentApiAvailable,
  documentDraft,
  documentError,
  documentImportPath,
  documentImportScope,
  documentMessage,
  documents,
  draftPayload,
  draftReviewDecisions,
  draftReviewPack,
  hasImportFileApi,
  importPickerAvailable,
  isAcceptingDraftItem,
  isCreatingRefreshTask,
  isDeletingDocument,
  isDocumentDirty,
  isImportingDocument,
  isSavingDocument,
  selectedCatalogItem,
  selectedDocument,
  skills,
  onAcceptDraftItem,
  onArchiveDocument,
  onAttachDocumentToQueueTask,
  onAttachContextToCoordinator,
  onAttachKnowledgeContextToQueueTask,
  onClearDraftReviewPayload,
  onCloseUtilityPanel,
  onCreateRefreshTask,
  onCreateSkill,
  onDeleteDocument,
  onDeleteSkill,
  onDiscardDraft,
  onDocumentImportScopeChange,
  onDraftPayloadChange,
  onImportBrowserFileSelected,
  onGetSkill,
  onImportDocument,
  onListSkills,
  onLoadDraftReviewPayload,
  onMarkStale,
  onOpenDocumentPanel,
  onPickImportFile,
  onRejectDraftItem,
  onRestoreDocument,
  onSaveDocument,
  onSetDocumentDraftField,
  onSkillsChanged,
  onStartNewSkill,
  onToggleUtilityPanel,
  onUpdateSkill,
  skillCreateAvailable,
  skillsPanelRef,
}: SkillLibraryCatalogUtilityPanelsProps) {
  return (
    <>
      <div className="skill-library-panel-actions" aria-label="Catalog actions">
        <Button
          onClick={onOpenDocumentPanel}
          variant={activeUtilityPanel === "document" ? "primary" : "secondary"}
        >
          {selectedDocument ? "Edit item" : "New item"}
        </Button>
        <Button
          onClick={() => onToggleUtilityPanel("import")}
          variant={activeUtilityPanel === "import" ? "primary" : "secondary"}
        >
          Import file
        </Button>
        <Button
          onClick={() => onToggleUtilityPanel("drafts")}
          variant={activeUtilityPanel === "drafts" ? "primary" : "secondary"}
        >
          Review Queue drafts
        </Button>
        <Button
          onClick={() => onToggleUtilityPanel("skills")}
          variant={activeUtilityPanel === "skills" ? "primary" : "secondary"}
        >
          Manage skills
        </Button>
      </div>
      {activeUtilityPanel ? (
        <div className="skill-library-drawer-backdrop">
          <section
            className="skill-library-utility-panel skill-library-drawer"
            aria-label={panelAriaLabel(activeUtilityPanel)}
          >
            <div className="skill-library-panel-header">
              <div>
                <p className="skill-list-meta">Secondary flow</p>
                <h3>{panelTitle(activeUtilityPanel, documentDraft)}</h3>
              </div>
              <Button onClick={onCloseUtilityPanel} variant="ghost">
                Close
              </Button>
            </div>
            {activeUtilityPanel === "document" ? (
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
                    selectedDocument.sourceRef.trim(),
                )}
                documentApiAvailable={documentApiAvailable}
                documents={documents}
                draft={documentDraft}
                error={documentError}
                isCreatingRefreshTask={isCreatingRefreshTask}
                isDeletingDocument={isDeletingDocument}
                isDirty={isDocumentDirty}
                isSavingDocument={isSavingDocument}
                item={selectedCatalogItem}
                message={documentMessage}
                onArchiveDocument={onArchiveDocument}
                onAttachToQueueTask={onAttachDocumentToQueueTask}
                onCreateRefreshTask={onCreateRefreshTask}
                onDeleteDocument={onDeleteDocument}
                onDiscardDraft={onDiscardDraft}
                onMarkStale={onMarkStale}
                onRestoreDocument={onRestoreDocument}
                onSaveDocument={onSaveDocument}
                onSetDraftField={onSetDocumentDraftField}
                skills={skills}
              />
            ) : null}
            {activeUtilityPanel === "import" ? (
          <SkillLibraryDocumentImportControls
            documentApiAvailable={documentApiAvailable}
            documentImportPath={documentImportPath}
            documentImportScope={documentImportScope}
            hasImportFileApi={hasImportFileApi}
            importPickerAvailable={importPickerAvailable}
            isDeletingDocument={isDeletingDocument}
            isImportingDocument={isImportingDocument}
            isSavingDocument={isSavingDocument}
            onBrowserFileSelected={onImportBrowserFileSelected}
            onDocumentImportScopeChange={onDocumentImportScopeChange}
            onImportDocument={onImportDocument}
            onPickImportFile={onPickImportFile}
          />
            ) : null}
            {activeUtilityPanel === "drafts" ? (
          <SkillLibraryDraftReviewPanel
            documentApiAvailable={documentApiAvailable}
            draftPayload={draftPayload}
            draftReviewDecisions={draftReviewDecisions}
            draftReviewPack={draftReviewPack}
            isAcceptingDraftItem={isAcceptingDraftItem}
            onAcceptDraftItem={onAcceptDraftItem}
            onClearDraftReviewPayload={onClearDraftReviewPayload}
            onDraftPayloadChange={onDraftPayloadChange}
            onLoadDraftReviewPayload={onLoadDraftReviewPayload}
            onRejectDraftItem={onRejectDraftItem}
            skillCreateAvailable={skillCreateAvailable}
          />
            ) : null}
            {activeUtilityPanel === "skills" ? (
              <>
                <div className="skill-library-panel-header">
                  <div>
                    <p className="skill-list-meta">Skill records</p>
                    <h3>Manage skills</h3>
                  </div>
                  <Button onClick={onStartNewSkill} variant="secondary">
                    New skill
                  </Button>
                </div>
        <SkillLibrarySkillsPanel
          isActive={activeUtilityPanel === "skills"}
          onAttachContextToCoordinator={onAttachContextToCoordinator}
          onAttachKnowledgeContextToQueueTask={onAttachKnowledgeContextToQueueTask}
          onCreateSkill={onCreateSkill}
          onDeleteSkill={onDeleteSkill}
          onGetSkill={onGetSkill}
          onListSkills={onListSkills}
          onSkillsChanged={onSkillsChanged}
          onToolbarStateChange={() => undefined}
          onUpdateSkill={onUpdateSkill}
          ref={skillsPanelRef}
        />
              </>
            ) : null}
          </section>
        </div>
      ) : null}
    </>
  );
}

function panelTitle(
  panel: Exclude<KnowledgeUtilityPanel, null>,
  documentDraft: KnowledgeDocumentDraft,
) {
  switch (panel) {
    case "document":
      return documentDraft.knowledgeDocumentId ? "Edit catalog item" : "New catalog item";
    case "import":
      return "Import file";
    case "drafts":
      return "Review Queue drafts";
    case "skills":
      return "Manage skills";
  }
}

function panelAriaLabel(panel: Exclude<KnowledgeUtilityPanel, null>) {
  switch (panel) {
    case "document":
      return "Catalog item editor";
    case "import":
      return "Knowledge import";
    case "drafts":
      return "Queue Knowledge draft review";
    case "skills":
      return "Skill records";
  }
}
