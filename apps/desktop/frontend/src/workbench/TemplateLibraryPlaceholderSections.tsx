import { Badge } from "../design-system/Badge";
import {
  StaticPreviewFieldList,
  StaticPreviewPlannedActions,
} from "./StaticPreviewPrimitives";
import type {
  CoordinatorWorkflowPreview,
  RequestTemplatePreview,
  ResponseTemplatePreview,
  TemplateLibraryPreviewModel,
  TemplatePreviewSection,
} from "./templateLibraryPreview";

export function TemplateLibrarySummarySection({
  summary,
}: {
  summary: TemplateLibraryPreviewModel["summary"];
}) {
  return (
    <section className="template-library-summary">
      <div className="template-library-summary-copy">
        <p className="template-library-summary-title">{summary.title}</p>
        <p className="template-library-summary-text">{summary.text}</p>
      </div>
      <Badge variant="neutral">{summary.badgeLabel}</Badge>
    </section>
  );
}

export function RequestTemplatePreviewSection({
  preview,
}: {
  preview: RequestTemplatePreview;
}) {
  return <FieldPreviewSection preview={preview} />;
}

export function ResponseTemplatePreviewSection({
  preview,
}: {
  preview: ResponseTemplatePreview;
}) {
  return <FieldPreviewSection preview={preview} />;
}

export function CoordinatorWorkflowPreviewSection({
  preview,
}: {
  preview: CoordinatorWorkflowPreview;
}) {
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

export function TemplateLibraryPlannedSections({
  sections,
}: {
  sections: readonly TemplatePreviewSection[];
}) {
  return (
    <div
      aria-label="Planned template library sections"
      className="template-library-grid"
    >
      {sections.map((section) => (
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
  );
}

export function TemplateLibraryPlannedActions({
  actions,
}: {
  actions: TemplateLibraryPreviewModel["plannedActions"];
}) {
  return (
    <StaticPreviewPlannedActions
      actions={actions}
      aria-label="Planned template actions"
      className="template-library-action-row"
    />
  );
}

function FieldPreviewSection({
  preview,
}: {
  preview: RequestTemplatePreview | ResponseTemplatePreview;
}) {
  return (
    <section
      aria-label={preview.ariaLabel}
      className="template-library-section template-library-preview"
    >
      <TemplatePreviewHeader preview={preview} />

      <StaticPreviewFieldList
        className="template-library-preview-grid"
        fieldClassName="template-library-preview-field"
        fields={preview.fields}
        labelClassName="template-library-preview-label"
        valueClassName="template-library-preview-value"
      />
    </section>
  );
}

function TemplatePreviewHeader({
  preview,
}: {
  preview:
    | CoordinatorWorkflowPreview
    | RequestTemplatePreview
    | ResponseTemplatePreview;
}) {
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
