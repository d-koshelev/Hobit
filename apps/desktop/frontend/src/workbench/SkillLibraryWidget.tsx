import { useCallback, useRef, useState } from "react";
import { WidgetFrame } from "../design-system/WidgetFrame";
import {
  SkillLibraryDocumentsPanel,
  type SkillLibraryDocumentsPanelHandle,
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
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const onDocumentsToolbarStateChange = useCallback(() => undefined, []);

  const statusBadge = (
    <div className="skill-library-help" data-widget-header-drag-ignore>
      <button
        aria-expanded={isHelpOpen}
        aria-label="Knowledge / Skills help"
        className="skill-library-info-button"
        onClick={() => setIsHelpOpen((current) => !current)}
        title="Knowledge / Skills help"
        type="button"
      >
        i
      </button>
      {isHelpOpen ? (
        <div className="skill-library-info-popover" role="dialog">
          <p>
            Knowledge / Skills is a unified catalog of workspace and global
            Knowledge Documents plus workspace Skill records.
          </p>
          <p>
            Only enabled active documents are searched before Workspace Agent
            Codex runs. Skills are attached only through explicit operator
            actions.
          </p>
          <p>
            Imports accept one selected .txt, .md, or .markdown file. Folder
            ingestion, hidden memory, and vector search are not implemented.
          </p>
        </div>
      ) : null}
    </div>
  );

  return (
    <WidgetFrame
      actions={frameActions}
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
