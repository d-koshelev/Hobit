import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "../design-system/Button";
import { WidgetFrame } from "../design-system/WidgetFrame";
import {
  SkillLibraryDocumentsPanel,
  type SkillLibraryDocumentsPanelHandle,
} from "./knowledge/legacySkillLibrary/SkillLibraryDocumentsPanel";
import { KnowledgeWidget } from "./knowledge";
import type { WidgetRenderProps } from "./types";
import { useWidgetRuntimeContext } from "./widgetRuntimeContext";

type KnowledgeV2LegacyFlow = "drafts" | "import" | "new" | "skills";

export function KnowledgeSkillsV2Widget({
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
  onAttachContextToCoordinator,
  onAttachKnowledgeContextToQueueTask,
  onReadKnowledgeDocumentImportFile,
  onListKnowledgeDocuments,
  onListKnowledgeDraftReviews,
  onListSkills,
  onLoadLogs,
  onRecordKnowledgeDraftReview,
  onStartFrameMove,
  onUpdateKnowledgeDocument,
  onUpdateSkill,
  title,
}: WidgetRenderProps) {
  const runtime = useWidgetRuntimeContext();
  const legacyPanelRef = useRef<SkillLibraryDocumentsPanelHandle | null>(null);
  const [legacyFlow, setLegacyFlow] = useState<KnowledgeV2LegacyFlow | null>(
    null,
  );
  const widgetInstanceId = runtime.identity.widgetInstanceId ?? instance.id;
  const loadLogs = runtime.logs.isAvailable
    ? runtime.logs.load
    : onLoadLogs
      ? () => onLoadLogs(widgetInstanceId)
      : undefined;
  const effectiveLogRefreshToken = runtime.logs.isAvailable
    ? runtime.logs.refreshToken
    : logRefreshToken;
  const onDocumentsToolbarStateChange = useCallback(() => undefined, []);

  useEffect(() => {
    if (!legacyFlow) {
      return;
    }

    const panel = legacyPanelRef.current;
    if (!panel) {
      return;
    }

    switch (legacyFlow) {
      case "drafts":
        panel.openDraftReviewFlow();
        return;
      case "import":
        panel.openImportFlow();
        return;
      case "new":
        panel.startNewDocument();
        return;
      case "skills":
        panel.openSkillsFlow();
        return;
    }
  }, [legacyFlow]);

  return (
    <WidgetFrame
      actions={frameActions}
      info="Knowledge / Skills opens explicit document and skill review, creation, import, draft review, and attach flows."
      logRefreshToken={effectiveLogRefreshToken}
      moveEnabled={frameMoveEnabled}
      onLoadLogs={loadLogs}
      onMoveStart={onStartFrameMove}
      style={frameStyle}
      title={title}
    >
      <KnowledgeWidget
        displaySubtitle="Dense catalog review for existing Knowledge Documents and Skills."
        displayTitle="Knowledge Catalog"
        onAttachContextToCoordinator={onAttachContextToCoordinator}
        onAttachKnowledgeContextToQueueTask={onAttachKnowledgeContextToQueueTask}
        onDeleteKnowledgeDocument={onDeleteKnowledgeDocument}
        onDeleteSkill={onDeleteSkill}
        onDraftReview={() => setLegacyFlow("drafts")}
        onImport={() => setLegacyFlow("import")}
        onListKnowledgeDocuments={onListKnowledgeDocuments}
        onListKnowledgeDraftReviews={onListKnowledgeDraftReviews}
        onListSkills={onListSkills}
        onManageSkills={() => setLegacyFlow("skills")}
        onNew={() => setLegacyFlow("new")}
        onUpdateKnowledgeDocument={onUpdateKnowledgeDocument}
      />
      {legacyFlow ? (
        <section
          aria-label="Legacy Knowledge / Skills existing flow"
          className="skill-library-shell"
        >
          <div className="skill-library-summary skill-library-summary-secondary">
            <Button onClick={() => setLegacyFlow(null)} variant="ghost">
              Close existing flow
            </Button>
          </div>
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
            onListKnowledgeDraftReviews={onListKnowledgeDraftReviews}
            onListSkills={onListSkills}
            onReadKnowledgeDocumentImportFile={onReadKnowledgeDocumentImportFile}
            onToolbarStateChange={onDocumentsToolbarStateChange}
            onRecordKnowledgeDraftReview={onRecordKnowledgeDraftReview}
            onUpdateKnowledgeDocument={onUpdateKnowledgeDocument}
            onUpdateSkill={onUpdateSkill}
            ref={legacyPanelRef}
          />
        </section>
      ) : null}
    </WidgetFrame>
  );
}
