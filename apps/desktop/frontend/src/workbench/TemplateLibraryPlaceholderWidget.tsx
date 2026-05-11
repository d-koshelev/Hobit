import { Badge } from "../design-system/Badge";
import { Button } from "../design-system/Button";
import { WidgetFrame } from "../design-system/WidgetFrame";
import type { WidgetRenderProps } from "./types";

const plannedTemplateSections = [
  {
    title: "Request Templates",
    items: ["Codex implementation block", "Audit block", "Bugfix block"],
  },
  {
    title: "Response Templates",
    items: [
      "Implementation result",
      "No-code audit result",
      "Failed/blocked result",
    ],
  },
];

const plannedCoordinatorSteps = [
  "Select template",
  "Fill variables",
  "Preview executor request",
  "Capture response",
  "Validate response",
];

const requestTemplatePreviewFields = [
  {
    label: "Block",
    value: "Numbered executor block with a short implementation title.",
  },
  {
    label: "Goal",
    value: "Concrete outcome the executor must deliver.",
  },
  {
    label: "Context",
    value: "Relevant product boundary, contracts, and current implementation notes.",
  },
  {
    label: "Scope",
    value: "Focused work area and explicit placeholder-only limits.",
  },
  {
    label: "Likely files",
    value: "Expected files or modules to inspect before editing.",
  },
  {
    label: "Do not change",
    value: "Protected systems, runtime behavior, storage, and dependencies.",
  },
  {
    label: "Implementation requirements",
    value: "Ordered requirements the executor must satisfy.",
  },
  {
    label: "Safety rules",
    value: "Stop conditions and forbidden scope expansion.",
  },
  {
    label: "Validation",
    value: "Required automated checks and manual check reporting.",
  },
  {
    label: "Commit",
    value: "One focused commit message suggestion.",
  },
  {
    label: "Final response",
    value: "Files changed, validation, warnings, commit, and final git status.",
  },
];

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
      subtitle="Request and Response template surface"
      title={title}
    >
      <div className="template-library-placeholder">
        <section className="template-library-summary">
          <div className="template-library-summary-copy">
            <p className="template-library-summary-title">Template Library</p>
            <p className="template-library-summary-text">
              Request and Response Templates are planned. Template editing,
              request generation, and response validation are not available yet.
            </p>
          </div>
          <Badge variant="neutral">Static preview</Badge>
        </section>

        <section
          aria-label="Static Request Template preview"
          className="template-library-section template-library-preview"
        >
          <div className="template-library-preview-header">
            <div className="template-library-preview-copy">
              <h3 className="template-library-section-title">
                Request Template Preview
              </h3>
              <p className="template-library-preview-title">
                Codex implementation block
              </p>
              <p className="template-library-preview-text">
                Static example only. It is not editable, persisted, generated,
                copied, sent to an executor, or connected to variables.
              </p>
            </div>
            <div className="template-library-preview-badges">
              <Badge variant="neutral">Static</Badge>
              <Badge variant="neutral">Planned</Badge>
            </div>
          </div>

          <dl className="template-library-preview-grid">
            {requestTemplatePreviewFields.map((field) => (
              <div className="template-library-preview-field" key={field.label}>
                <dt className="template-library-preview-label">
                  {field.label}
                </dt>
                <dd className="template-library-preview-value">
                  {field.value}
                </dd>
              </div>
            ))}
          </dl>
        </section>

        <div
          aria-label="Planned template library sections"
          className="template-library-grid"
        >
          {plannedTemplateSections.map((section) => (
            <section className="template-library-section" key={section.title}>
              <div className="template-library-section-header">
                <h3 className="template-library-section-title">
                  {section.title}
                </h3>
                <Badge variant="neutral">Planned</Badge>
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

          <section className="template-library-section">
            <div className="template-library-section-header">
              <h3 className="template-library-section-title">
                Coordinator Workflow
              </h3>
              <Badge variant="neutral">Planned</Badge>
            </div>
            <ol className="template-library-list template-library-step-list">
              {plannedCoordinatorSteps.map((step) => (
                <li className="template-library-list-item" key={step}>
                  <span>{step}</span>
                </li>
              ))}
            </ol>
          </section>
        </div>

        <div
          aria-label="Planned template actions"
          className="template-library-action-row"
        >
          <Button disabled variant="secondary">
            New template
          </Button>
          <Button disabled variant="secondary">
            Preview request
          </Button>
          <Button disabled variant="secondary">
            Validate response
          </Button>
        </div>
      </div>
    </WidgetFrame>
  );
}
