import { useCallback, useRef } from "react";
import { WidgetInfoPopover } from "../design-system/WidgetInfoPopover";
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

  const statusBadge = (
    <WidgetInfoPopover
      label="Legacy Knowledge / Skills compatibility information"
      title="Legacy Knowledge / Skills"
    >
      <p>
        Compatibility surface for the previous Knowledge / Skills UI. The
        normal product route renders KnowledgeV2 through the saved-compatible
        skill-library identity.
      </p>
      <p>
        Only enabled active documents are searched before Workspace Agent Codex
        runs. Skills are attached only through explicit operator actions.
      </p>
      <p>
        Imports accept one selected .txt, .md, or .markdown file. Folder
        ingestion, hidden memory, and vector search are not implemented.
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
      <div className="skill-library-shell">
        <div className="skill-library-summary skill-library-summary-secondary">
          <span>Legacy Knowledge / Skills</span>
          <span>Compatibility surface</span>
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
          ref={documentsPanelRef}
        />
      </div>
    </WidgetFrame>
  );
}

// Compatibility export for focused legacy tests and dev-only fallback imports.
// Normal saved workspace and Widget Catalog paths route through KnowledgeSkillsV2Widget.
export const SkillLibraryWidget = LegacyKnowledgeSkillsWidget;
