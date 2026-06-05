import { useCallback, useRef, useState } from "react";
import { Badge } from "../design-system/Badge";
import { Button } from "../design-system/Button";
import { WidgetFrame } from "../design-system/WidgetFrame";
import {
  SkillLibraryDocumentsPanel,
  type SkillLibraryDocumentsPanelHandle,
  type SkillLibraryDocumentsToolbarState,
} from "./SkillLibraryDocumentsPanel";
import type { WidgetRenderProps } from "./types";

export function SkillLibraryWidget({
  frameActions,
  frameMoveEnabled,
  frameStyle,
  instance,
  logRefreshToken,
  onCreateSkill,
  onCreateAgentQueueTask,
  onCreateKnowledgeDocument,
  onDeleteKnowledgeDocument,
  onDeleteSkill,
  onGetKnowledgeDocument,
  onGetSkill,
  onListKnowledgeDocuments,
  onListSkills,
  onLoadLogs,
  onAttachKnowledgeContextToQueueTask,
  onReadKnowledgeDocumentImportFile,
  onAttachContextToCoordinator,
  onStartFrameMove,
  onUpdateKnowledgeDocument,
  onUpdateSkill,
  title,
}: WidgetRenderProps) {
  const documentsPanelRef = useRef<SkillLibraryDocumentsPanelHandle | null>(
    null,
  );
  const [documentsToolbarState, setDocumentsToolbarState] =
    useState<SkillLibraryDocumentsToolbarState>({
      isNewDisabled: true,
    });
  const onDocumentsToolbarStateChange = useCallback(
    (state: SkillLibraryDocumentsToolbarState) => {
      setDocumentsToolbarState(state);
    },
    [],
  );

  const statusBadge = (
    <Badge variant="info">Catalog</Badge>
  );

  function startNewCatalogItem() {
    documentsPanelRef.current?.startNewDocument();
  }

  return (
    <WidgetFrame
      actions={
        <>
          <Button
            disabled={documentsToolbarState.isNewDisabled}
            onClick={startNewCatalogItem}
            variant="secondary"
          >
            New catalog item
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
        <SkillLibraryDocumentsPanel
          isActive={true}
          onAttachContextToCoordinator={onAttachContextToCoordinator}
          onAttachKnowledgeContextToQueueTask={onAttachKnowledgeContextToQueueTask}
          onCreateAgentQueueTask={onCreateAgentQueueTask}
          onCreateKnowledgeDocument={onCreateKnowledgeDocument}
          onCreateSkill={onCreateSkill}
          onDeleteKnowledgeDocument={onDeleteKnowledgeDocument}
          onDeleteSkill={onDeleteSkill}
          onGetKnowledgeDocument={onGetKnowledgeDocument}
          onGetSkill={onGetSkill}
          onListKnowledgeDocuments={onListKnowledgeDocuments}
          onListSkills={onListSkills}
          onReadKnowledgeDocumentImportFile={onReadKnowledgeDocumentImportFile}
          onToolbarStateChange={onDocumentsToolbarStateChange}
          onUpdateKnowledgeDocument={onUpdateKnowledgeDocument}
          onUpdateSkill={onUpdateSkill}
          ref={documentsPanelRef}
        />
      </div>
    </WidgetFrame>
  );
}
