import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "../design-system/Button";
import { WidgetInfoPopover } from "../design-system/WidgetInfoPopover";
import { WidgetFrame } from "../design-system/WidgetFrame";
import {
  SkillLibraryDocumentsPanel,
  type SkillLibraryDocumentsPanelHandle,
} from "./SkillLibraryDocumentsPanel";
import type { WidgetRenderProps } from "./types";
import { useWidgetRuntimeContext } from "./widgetRuntimeContext";
import { KnowledgeV2Widget } from "./widgetV2/knowledgeV2";

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

  const statusBadge = (
    <WidgetInfoPopover
      label="Knowledge / Skills help"
      title="Knowledge / Skills"
    >
      <p>
        Knowledge / Skills opens the Knowledge Catalog surface over existing
        Knowledge Documents and Skill records.
      </p>
      <p>
        Catalog data is loaded through the existing Knowledge / Skills frontend
        actions. Creating, importing, reviewing, and attaching remain explicit.
      </p>
      <p>
        This route does not add hidden ingestion, backend behavior, storage
        changes, schema changes, or automatic context use.
      </p>
    </WidgetInfoPopover>
  );

  return (
    <WidgetFrame
      actions={frameActions}
      logRefreshToken={effectiveLogRefreshToken}
      moveEnabled={frameMoveEnabled}
      onLoadLogs={loadLogs}
      onMoveStart={onStartFrameMove}
      status={statusBadge}
      style={frameStyle}
      title={title}
    >
      <KnowledgeV2Widget
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
            <span>Legacy Knowledge / Skills</span>
            <span>Compatibility surface</span>
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
