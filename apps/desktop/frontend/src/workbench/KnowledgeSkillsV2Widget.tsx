import { WidgetInfoPopover } from "../design-system/WidgetInfoPopover";
import { WidgetFrame } from "../design-system/WidgetFrame";
import type { WidgetRenderProps } from "./types";
import { useWidgetRuntimeContext } from "./widgetRuntimeContext";
import { KnowledgeV2Widget } from "./widgetV2/knowledgeV2";

export function KnowledgeSkillsV2Widget({
  frameActions,
  frameMoveEnabled,
  frameStyle,
  instance,
  logRefreshToken,
  onAttachContextToCoordinator,
  onAttachKnowledgeContextToQueueTask,
  onListKnowledgeDocuments,
  onListKnowledgeDraftReviews,
  onListSkills,
  onLoadLogs,
  onStartFrameMove,
  title,
}: WidgetRenderProps) {
  const runtime = useWidgetRuntimeContext();
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
        onListKnowledgeDocuments={onListKnowledgeDocuments}
        onListKnowledgeDraftReviews={onListKnowledgeDraftReviews}
        onListSkills={onListSkills}
      />
    </WidgetFrame>
  );
}
