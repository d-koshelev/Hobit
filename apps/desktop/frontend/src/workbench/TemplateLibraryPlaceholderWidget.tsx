import { Badge } from "../design-system/Badge";
import { Button } from "../design-system/Button";
import { WidgetFrame } from "../design-system/WidgetFrame";
import {
  templateLibraryPreview,
  type CoordinatorWorkflowPreview,
  type RequestTemplatePreview,
  type ResponseTemplatePreview,
} from "./templateLibraryPreview";
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
        <section className="template-library-summary">
          <div className="template-library-summary-copy">
            <p className="template-library-summary-title">
              {templateLibraryPreview.summary.title}
            </p>
            <p className="template-library-summary-text">
              {templateLibraryPreview.summary.text}
            </p>
          </div>
          <Badge variant="neutral">
            {templateLibraryPreview.summary.badgeLabel}
          </Badge>
        </section>

        <FieldPreviewSection preview={templateLibraryPreview.requestTemplate} />

        <FieldPreviewSection
          preview={templateLibraryPreview.responseTemplate}
        />

        <WorkflowPreviewSection
          preview={templateLibraryPreview.coordinatorWorkflow}
        />

        <div
          aria-label="Planned template library sections"
          className="template-library-grid"
        >
          {templateLibraryPreview.plannedSections.map((section) => (
            <section className="template-library-section" key={section.title}>
              <div className="template-library-section-header">
                <h3 className="template-library-section-title">
                  {section.title}
                </h3>
                <Badge variant="neutral">{section.badgeLabel}</Badge>
              </div>
              <ul className="template-library-list">
                {section.items.map((item) => (
                  <li className="template-library-list-item" key={item}>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>

        <div
          aria-label="Planned template actions"
          className="template-library-action-row"
        >
          {templateLibraryPreview.plannedActions.map((action) => (
            <Button disabled key={action.label} variant="secondary">
              {action.label}
            </Button>
          ))}
        </div>
      </div>
    </WidgetFrame>
  );
}

type FieldPreviewSectionProps = {
  preview: RequestTemplatePreview | ResponseTemplatePreview;
};

function FieldPreviewSection({ preview }: FieldPreviewSectionProps) {
  return (
    <section
      aria-label={preview.ariaLabel}
      className="template-library-section template-library-preview"
    >
      <TemplatePreviewHeader preview={preview} />

      <dl className="template-library-preview-grid">
        {preview.fields.map((field) => (
          <div className="template-library-preview-field" key={field.label}>
            <dt className="template-library-preview-label">{field.label}</dt>
            <dd className="template-library-preview-value">{field.value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

type WorkflowPreviewSectionProps = {
  preview: CoordinatorWorkflowPreview;
};

function WorkflowPreviewSection({ preview }: WorkflowPreviewSectionProps) {
  return (
    <section
      aria-label={preview.ariaLabel}
      className="template-library-section template-library-preview"
    >
      <TemplatePreviewHeader preview={preview} />

      <ol className="template-library-workflow-list">
        {preview.steps.map((step) => (
          <li className="template-library-workflow-item" key={step.title}>
            <div className="template-library-workflow-copy">
              <p className="template-library-preview-label">{step.title}</p>
              <p className="template-library-preview-value">{step.detail}</p>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}

type TemplatePreviewHeaderProps = {
  preview:
    | CoordinatorWorkflowPreview
    | RequestTemplatePreview
    | ResponseTemplatePreview;
};

function TemplatePreviewHeader({ preview }: TemplatePreviewHeaderProps) {
  return (
    <div className="template-library-preview-header">
      <div className="template-library-preview-copy">
        <h3 className="template-library-section-title">{preview.heading}</h3>
        <p className="template-library-preview-title">{preview.title}</p>
        <p className="template-library-preview-text">
          {preview.description}
        </p>
      </div>
      <div className="template-library-preview-badges">
        {preview.badges.map((badge) => (
          <Badge key={badge} variant="neutral">
            {badge}
          </Badge>
        ))}
      </div>
    </div>
  );
}
