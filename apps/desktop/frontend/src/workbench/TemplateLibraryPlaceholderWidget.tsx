import { Badge } from "../design-system/Badge";
import { WidgetFrame } from "../design-system/WidgetFrame";
import {
  CoordinatorWorkflowPreviewSection,
  RequestTemplatePreviewSection,
  ResponseTemplatePreviewSection,
  TemplateLibraryPlannedActions,
  TemplateLibraryPlannedSections,
  TemplateLibrarySummarySection,
} from "./TemplateLibraryPlaceholderSections";
import { templateLibraryPreview } from "./templateLibraryPreview";
import type { WidgetRenderProps } from "./types";

export function TemplateLibraryPlaceholderWidget({
  frameActions,
  frameMoveEnabled,
  frameStyle,
  instance,
  logRefreshToken,
  onLoadLogs,
  onStartFrameMove,
  title,
}: WidgetRenderProps) {
  return (
    <WidgetFrame
      actions={frameActions}
      logRefreshToken={logRefreshToken}
      moveEnabled={frameMoveEnabled}
      onLoadLogs={onLoadLogs ? () => onLoadLogs(instance.id) : undefined}
      onMoveStart={onStartFrameMove}
      style={frameStyle}
      status={<Badge variant="neutral">Placeholder</Badge>}
      title={title}
    >
      <div className="template-library-placeholder">
        <TemplateLibrarySummarySection summary={templateLibraryPreview.summary} />
        <RequestTemplatePreviewSection
          preview={templateLibraryPreview.requestTemplate}
        />
        <ResponseTemplatePreviewSection
          preview={templateLibraryPreview.responseTemplate}
        />
        <CoordinatorWorkflowPreviewSection
          preview={templateLibraryPreview.coordinatorWorkflow}
        />
        <TemplateLibraryPlannedSections
          sections={templateLibraryPreview.plannedSections}
        />
        <TemplateLibraryPlannedActions
          actions={templateLibraryPreview.plannedActions}
        />
      </div>
    </WidgetFrame>
  );
}
