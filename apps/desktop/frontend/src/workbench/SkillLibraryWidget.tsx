import { useCallback, useRef } from "react";
import { WidgetFrame } from "../design-system/WidgetFrame";
import {
  SkillLibraryDocumentsPanel,
  type SkillLibraryDocumentsPanelHandle,
} from "./SkillLibraryDocumentsPanel";
import type { WidgetRenderProps } from "./types";
import { useWidgetRuntimeContext } from "./widgetRuntimeContext";

export function LegacyKnowledgeSkillsWidget({
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
  onListKnowledgeDraftReviews,
  onListSkills,
  onLoadLogs,
  onAttachKnowledgeContextToQueueTask,
  onReadKnowledgeDocumentImportFile,
  onAttachContextToCoordinator,
  onStartFrameMove,
  onUpdateKnowledgeDocument,
  onRecordKnowledgeDraftReview,
  onUpdateSkill,
  title,
}: WidgetRenderProps) {
  const runtime = useWidgetRuntimeContext();
  const documentsPanelRef = useRef<SkillLibraryDocumentsPanelHandle | null>(
    null,
  );
  const onDocumentsToolbarStateChange = useCallback(() => undefined, []);
  const widgetInstanceId = runtime.identity.widgetInstanceId ?? instance.id;
  const loadLogs = runtime.logs.isAvailable
    ? runtime.logs.load
    : onLoadLogs
      ? () => onLoadLogs(widgetInstanceId)
      : undefined;
  const effectiveLogRefreshToken = runtime.logs.isAvailable
    ? runtime.logs.refreshToken
    : logRefreshToken;

  return (
    <WidgetFrame
      actions={frameActions}
      info="Knowledge / Skills supports explicit document and skill management. Imports are single selected text or Markdown files."
      logRefreshToken={effectiveLogRefreshToken}
      moveEnabled={frameMoveEnabled}
      onLoadLogs={loadLogs}
      onMoveStart={onStartFrameMove}
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
          onListKnowledgeDraftReviews={onListKnowledgeDraftReviews}
          onListSkills={onListSkills}
          onReadKnowledgeDocumentImportFile={onReadKnowledgeDocumentImportFile}
          onToolbarStateChange={onDocumentsToolbarStateChange}
          onRecordKnowledgeDraftReview={onRecordKnowledgeDraftReview}
          onUpdateKnowledgeDocument={onUpdateKnowledgeDocument}
          onUpdateSkill={onUpdateSkill}
          ref={documentsPanelRef}
        />
      </div>
    </WidgetFrame>
  );
}

// Compatibility export for focused legacy tests and dev-only fallback imports.
// Normal saved workspace and Widget Catalog paths route through KnowledgeSkillsV2Widget.
export const SkillLibraryWidget = LegacyKnowledgeSkillsWidget;
