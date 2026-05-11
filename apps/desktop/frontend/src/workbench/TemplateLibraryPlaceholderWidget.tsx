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
