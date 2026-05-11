import { useId } from "react";
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

export type GeneratedRequestPreviewInputs = {
  blockNumber: string;
  blockTitle: string;
  commitMessage: string;
  extraContextNote: string;
  goal: string;
  scope: string;
};

export type GeneratedRequestPreviewField =
  keyof GeneratedRequestPreviewInputs;

type GeneratedRequestInputConfig = {
  field: GeneratedRequestPreviewField;
  label: string;
  multiline?: boolean;
  placeholder: string;
};

const generatedRequestInputConfigs: readonly GeneratedRequestInputConfig[] = [
  {
    field: "blockNumber",
    label: "Block number",
    placeholder: "104",
  },
  {
    field: "blockTitle",
    label: "Block title",
    placeholder: "Generated request preview local-only",
  },
  {
    field: "goal",
    label: "Goal",
    multiline: true,
    placeholder: "Add a compact local generated executor request preview.",
  },
  {
    field: "scope",
    label: "Scope",
    multiline: true,
    placeholder: "Frontend local-only UI behavior inside Template Library.",
  },
  {
    field: "commitMessage",
    label: "Commit message",
    placeholder: "frontend: add generated request preview",
  },
  {
    field: "extraContextNote",
    label: "Extra context note",
    multiline: true,
    placeholder: "Keep the preview local, transient, and non-executing.",
  },
];

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

export function TemplateLibraryGeneratedRequestPreviewSection({
  inputs,
  onInputChange,
  previewText,
  requestTemplateTitle,
}: {
  inputs: GeneratedRequestPreviewInputs;
  onInputChange: (field: GeneratedRequestPreviewField, value: string) => void;
  previewText: string;
  requestTemplateTitle: string;
}) {
  const fieldIdPrefix = useId();

  return (
    <section
      aria-label="Local generated request preview"
      className="template-library-section template-library-preview template-library-generated-request"
    >
      <div className="template-library-preview-header">
        <div className="template-library-preview-copy">
          <h3 className="template-library-section-title">
            Generated Request Preview
          </h3>
          <p className="template-library-preview-title">
            {requestTemplateTitle}
          </p>
          <p className="template-library-preview-text">
            Local preview only. Inputs are not saved, the request is not
            copied/sent, and no executor is launched.
          </p>
        </div>
        <div className="template-library-preview-badges">
          <Badge variant="neutral">Local preview</Badge>
          <Badge variant="neutral">Not saved</Badge>
          <Badge variant="neutral">Not copied/sent</Badge>
          <Badge variant="neutral">No executor launched</Badge>
        </div>
      </div>

      <div
        aria-label="Local generated request fields"
        className="template-library-generated-controls"
      >
        {generatedRequestInputConfigs.map((fieldConfig) => {
          const fieldId = `${fieldIdPrefix}-${fieldConfig.field}`;
          const fieldClassName = [
            "template-library-generated-field",
            fieldConfig.multiline
              ? "template-library-generated-field-wide"
              : undefined,
          ]
            .filter(Boolean)
            .join(" ");

          return (
            <div className={fieldClassName} key={fieldConfig.field}>
              <label
                className="template-library-generated-label"
                htmlFor={fieldId}
              >
                {fieldConfig.label}
              </label>
              {fieldConfig.multiline ? (
                <textarea
                  className="input template-library-generated-textarea"
                  id={fieldId}
                  onChange={(event) =>
                    onInputChange(fieldConfig.field, event.target.value)
                  }
                  placeholder={fieldConfig.placeholder}
                  rows={3}
                  value={inputs[fieldConfig.field]}
                />
              ) : (
                <input
                  className="input"
                  id={fieldId}
                  onChange={(event) =>
                    onInputChange(fieldConfig.field, event.target.value)
                  }
                  placeholder={fieldConfig.placeholder}
                  type="text"
                  value={inputs[fieldConfig.field]}
                />
              )}
            </div>
          );
        })}
      </div>

      <div
        aria-label="Generated executor request text"
        className="template-library-generated-output"
      >
        <p className="template-library-generated-output-label">
          Executor request preview
        </p>
        <pre className="template-library-generated-prompt">{previewText}</pre>
      </div>
    </section>
  );
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
