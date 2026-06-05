import type { Ref } from "react";
import { Button } from "../design-system/Button";
import type { KnowledgeDocument } from "../workspace/types";
import type { KnowledgeDraftReviewItem, KnowledgeDraftReviewPack } from "./knowledgeDraftPacks";
import type { KnowledgeDocumentDraft } from "./skillLibraryModel";
import { SkillLibraryDocumentImportControls } from "./SkillLibraryDocumentImportControls";
import { SkillLibraryDraftReviewPanel } from "./SkillLibraryDraftReviewPanel";
import {
  SkillLibrarySkillsPanel,
  type SkillLibrarySkillsPanelHandle,
} from "./SkillLibrarySkillsPanel";
import type { WidgetRenderProps } from "./types";

export type KnowledgeUtilityPanel = "import" | "drafts" | "skills" | null;

type DraftReviewDecision = "accepted" | "pending" | "rejected";

type SkillLibraryCatalogUtilityPanelsProps = {
  activeUtilityPanel: KnowledgeUtilityPanel;
  documentApiAvailable: boolean;
  documentImportPath: string;
  documentImportScope: KnowledgeDocumentDraft["scope"];
  draftPayload: string;
  draftReviewDecisions: Record<string, DraftReviewDecision>;
  draftReviewPack: KnowledgeDraftReviewPack | null;
  hasImportFileApi: boolean;
  isAcceptingDraftItem: boolean;
  isDeletingDocument: boolean;
  isImportingDocument: boolean;
  isSavingDocument: boolean;
  onAcceptDraftItem: (item: KnowledgeDraftReviewItem) => void;
  onAttachContextToCoordinator: WidgetRenderProps["onAttachContextToCoordinator"];
  onAttachKnowledgeContextToQueueTask: WidgetRenderProps["onAttachKnowledgeContextToQueueTask"];
  onClearDraftReviewPayload: () => void;
  onCreateSkill: WidgetRenderProps["onCreateSkill"];
  onDeleteSkill: WidgetRenderProps["onDeleteSkill"];
  onDocumentImportPathChange: (path: string) => void;
  onDocumentImportScopeChange: (scope: KnowledgeDocument["scope"]) => void;
  onDraftPayloadChange: (payload: string) => void;
  onGetSkill: WidgetRenderProps["onGetSkill"];
  onImportDocument: () => void;
  onListSkills: WidgetRenderProps["onListSkills"];
  onLoadDraftReviewPayload: () => void;
  onRejectDraftItem: (item: KnowledgeDraftReviewItem) => void;
  onSkillsChanged: () => void;
  onStartNewSkill: () => void;
  onToggleUtilityPanel: (panel: Exclude<KnowledgeUtilityPanel, null>) => void;
  onUpdateSkill: WidgetRenderProps["onUpdateSkill"];
  skillCreateAvailable: boolean;
  skillsPanelRef: Ref<SkillLibrarySkillsPanelHandle>;
};

export function SkillLibraryCatalogUtilityPanels({
  activeUtilityPanel,
  documentApiAvailable,
  documentImportPath,
  documentImportScope,
  draftPayload,
  draftReviewDecisions,
  draftReviewPack,
  hasImportFileApi,
  isAcceptingDraftItem,
  isDeletingDocument,
  isImportingDocument,
  isSavingDocument,
  onAcceptDraftItem,
  onAttachContextToCoordinator,
  onAttachKnowledgeContextToQueueTask,
  onClearDraftReviewPayload,
  onCreateSkill,
  onDeleteSkill,
  onDocumentImportPathChange,
  onDocumentImportScopeChange,
  onDraftPayloadChange,
  onGetSkill,
  onImportDocument,
  onListSkills,
  onLoadDraftReviewPayload,
  onRejectDraftItem,
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
      {activeUtilityPanel === "import" ? (
        <section
          className="skill-library-utility-panel"
          aria-label="Knowledge import"
        >
          <SkillLibraryDocumentImportControls
            documentApiAvailable={documentApiAvailable}
            documentImportPath={documentImportPath}
            documentImportScope={documentImportScope}
            hasImportFileApi={hasImportFileApi}
            isDeletingDocument={isDeletingDocument}
            isImportingDocument={isImportingDocument}
            isSavingDocument={isSavingDocument}
            onDocumentImportPathChange={onDocumentImportPathChange}
            onDocumentImportScopeChange={onDocumentImportScopeChange}
            onImportDocument={onImportDocument}
          />
        </section>
      ) : null}
      {activeUtilityPanel === "drafts" ? (
        <section
          className="skill-library-utility-panel"
          aria-label="Queue Knowledge draft review"
        >
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
        </section>
      ) : null}
      <section
        className="skill-library-utility-panel"
        hidden={activeUtilityPanel !== "skills"}
        aria-label="Skill records"
      >
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
      </section>
    </>
  );
}
