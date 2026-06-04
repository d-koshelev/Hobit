import { useCallback, useRef, useState } from "react";
import { Badge } from "../design-system/Badge";
import { Button } from "../design-system/Button";
import { WidgetFrame } from "../design-system/WidgetFrame";
import {
  SkillLibraryDocumentsPanel,
  type SkillLibraryDocumentsPanelHandle,
  type SkillLibraryDocumentsToolbarState,
} from "./SkillLibraryDocumentsPanel";
import {
  SkillLibrarySkillsPanel,
  type SkillLibrarySkillsPanelHandle,
  type SkillLibrarySkillsToolbarState,
} from "./SkillLibrarySkillsPanel";
import {
  EMPTY_SKILL_DRAFT,
  statusLabel,
  statusVariant,
  type KnowledgeSurfaceTab,
} from "./skillLibraryModel";
import type { WidgetRenderProps } from "./types";

export function SkillLibraryWidget({
  frameActions,
  frameMoveEnabled,
  frameStyle,
  instance,
  logRefreshToken,
  onCreateSkill,
  onCreateKnowledgeDocument,
  onDeleteKnowledgeDocument,
  onDeleteSkill,
  onGetKnowledgeDocument,
  onGetSkill,
  onListKnowledgeDocuments,
  onListSkills,
  onLoadLogs,
  onReadKnowledgeDocumentImportFile,
  onAttachContextToCoordinator,
  onStartFrameMove,
  onUpdateKnowledgeDocument,
  onUpdateSkill,
  title,
}: WidgetRenderProps) {
  const skillsPanelRef = useRef<SkillLibrarySkillsPanelHandle | null>(null);
  const documentsPanelRef = useRef<SkillLibraryDocumentsPanelHandle | null>(
    null,
  );
  const [activeTab, setActiveTab] = useState<KnowledgeSurfaceTab>("catalog");
  const [skillsToolbarState, setSkillsToolbarState] =
    useState<SkillLibrarySkillsToolbarState>({
      isNewDisabled: true,
      reviewStatus: EMPTY_SKILL_DRAFT.reviewStatus,
    });
  const [documentsToolbarState, setDocumentsToolbarState] =
    useState<SkillLibraryDocumentsToolbarState>({
      isNewDisabled: true,
    });
  const onSkillsToolbarStateChange = useCallback(
    (state: SkillLibrarySkillsToolbarState) => {
      setSkillsToolbarState(state);
    },
    [],
  );
  const onDocumentsToolbarStateChange = useCallback(
    (state: SkillLibraryDocumentsToolbarState) => {
      setDocumentsToolbarState(state);
    },
    [],
  );

  const newActionDisabled =
    activeTab === "skills"
      ? skillsToolbarState.isNewDisabled
      : documentsToolbarState.isNewDisabled;
  const statusBadge = (
    <Badge variant={statusVariant(skillsToolbarState.reviewStatus)}>
      {statusLabel(skillsToolbarState.reviewStatus)}
    </Badge>
  );

  function startNewActiveItem() {
    if (activeTab === "skills") {
      skillsPanelRef.current?.startNewSkill();
      return;
    }

    documentsPanelRef.current?.startNewDocument();
  }

  return (
    <WidgetFrame
      actions={
        <>
          <Button
            disabled={newActionDisabled}
            onClick={startNewActiveItem}
            variant="secondary"
          >
            {activeTab === "skills" ? "New skill" : "New catalog item"}
          </Button>
          {frameActions}
        </>
      }
      logRefreshToken={logRefreshToken}
      moveEnabled={frameMoveEnabled}
      onLoadLogs={onLoadLogs ? () => onLoadLogs(instance.id) : undefined}
      onMoveStart={onStartFrameMove}
      status={statusBadge}
      style={frameStyle}
      title={title}
    >
      <div className="skill-library-shell">
        <div className="skill-library-summary">
          <span>Scoped Knowledge Catalog for documents and skills.</span>
          <span>Global and workspace-local items stay visible.</span>
          <span>Skills attach explicitly from the saved Skill record.</span>
        </div>

        <div
          className="skill-library-tabs"
          role="tablist"
          aria-label="Knowledge surface tabs"
        >
          <button
            aria-selected={activeTab === "catalog"}
            className={[
              "skill-library-tab",
              activeTab === "catalog" ? "skill-library-tab-active" : "",
            ]
              .filter(Boolean)
              .join(" ")}
            onClick={() => setActiveTab("catalog")}
            role="tab"
            type="button"
          >
            Catalog
          </button>
          <button
            aria-selected={activeTab === "skills"}
            className={[
              "skill-library-tab",
              activeTab === "skills" ? "skill-library-tab-active" : "",
            ]
              .filter(Boolean)
              .join(" ")}
            onClick={() => setActiveTab("skills")}
            role="tab"
            type="button"
          >
            Skills
          </button>
        </div>

        <SkillLibrarySkillsPanel
          isActive={activeTab === "skills"}
          onAttachContextToCoordinator={onAttachContextToCoordinator}
          onCreateSkill={onCreateSkill}
          onDeleteSkill={onDeleteSkill}
          onGetSkill={onGetSkill}
          onListSkills={onListSkills}
          onToolbarStateChange={onSkillsToolbarStateChange}
          onUpdateSkill={onUpdateSkill}
          ref={skillsPanelRef}
        />
        <SkillLibraryDocumentsPanel
          isActive={activeTab === "catalog"}
          onAttachContextToCoordinator={onAttachContextToCoordinator}
          onCreateKnowledgeDocument={onCreateKnowledgeDocument}
          onDeleteKnowledgeDocument={onDeleteKnowledgeDocument}
          onGetKnowledgeDocument={onGetKnowledgeDocument}
          onGetSkill={onGetSkill}
          onListKnowledgeDocuments={onListKnowledgeDocuments}
          onListSkills={onListSkills}
          onReadKnowledgeDocumentImportFile={onReadKnowledgeDocumentImportFile}
          onShowSkills={() => setActiveTab("skills")}
          onToolbarStateChange={onDocumentsToolbarStateChange}
          onUpdateKnowledgeDocument={onUpdateKnowledgeDocument}
          ref={documentsPanelRef}
        />
      </div>
    </WidgetFrame>
  );
}
