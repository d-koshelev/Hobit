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

const responseTemplatePreviewFields = [
  {
    label: "Header",
    value: "Starts with the block number and title, such as Block 62.",
  },
  {
    label: "Files changed",
    value: "Lists the exact files touched by the implementation block.",
  },
  {
    label: "What changed",
    value: "Summarizes the delivered work without claiming extra behavior.",
  },
  {
    label: "Validation results",
    value: "Reports every requested command as passed, failed, or not run.",
  },
  {
    label: "Warnings",
    value: "Calls out skipped checks, failures, caveats, and residual risk.",
  },
  {
    label: "Commit",
    value: "Includes hash and message, or says plainly when commit failed.",
  },
  {
    label: "Out of scope",
    value: "Names work intentionally not implemented by the block.",
  },
  {
    label: "Final git status",
    value: "Reports final branch and working-tree state after the task.",
  },
];

const coordinatorWorkflowPreviewSteps = [
  {
    title: "Select Request Template",
    detail:
      "Choose the future template that will become the executor prompt for one block.",
  },
  {
    title: "Fill variables",
    detail:
      "Provide block scope, context, exclusions, validation, and the paired Response Template.",
  },
  {
    title: "Preview executor request",
    detail:
      "Review the generated prompt before it is copied, sent, or handed to an executor.",
  },
  {
    title: "Start fresh executor thread/task",
    detail:
      "Run one new executor task per block so prior strategy does not become hidden scope.",
  },
  {
    title: "Capture executor response",
    detail:
      "Record the final report that should follow the selected Response Template.",
  },
  {
    title: "Validate response against Response Template",
    detail:
      "Check required sections, skipped validation, failed commands, warnings, and commit reporting.",
  },
  {
    title: "Review Git state",
    detail:
      "Use the Git Widget as the post-code-block review surface for changes, validation, and commits.",
  },
  {
    title: "Accept / Fix / Next block",
    detail:
      "Coordinator and operator decide whether to accept, request a fix, rerun, or create the next block.",
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
      subtitle="Request, Response, and workflow surface"
      title={title}
    >
      <div className="template-library-placeholder">
        <section className="template-library-summary">
          <div className="template-library-summary-copy">
            <p className="template-library-summary-title">Template Library</p>
            <p className="template-library-summary-text">
              Request and Response Templates are planned. Template editing,
              request generation, executor threads, response capture, parsing,
              validation, and Git association are not available yet.
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

        <section
          aria-label="Static Response Template preview"
          className="template-library-section template-library-preview"
        >
          <div className="template-library-preview-header">
            <div className="template-library-preview-copy">
              <h3 className="template-library-section-title">
                Response Template Preview
              </h3>
              <p className="template-library-preview-title">
                Implementation result
              </p>
              <p className="template-library-preview-text">
                Static example only. It is not editable, persisted, captured,
                parsed, validated, or connected to executor agents. No-code audit
                and failed/blocked results are separate planned response kinds.
              </p>
            </div>
            <div className="template-library-preview-badges">
              <Badge variant="neutral">Static</Badge>
              <Badge variant="neutral">Planned</Badge>
            </div>
          </div>

          <dl className="template-library-preview-grid">
            {responseTemplatePreviewFields.map((field) => (
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

        <section
          aria-label="Static Coordinator Workflow preview"
          className="template-library-section template-library-preview"
        >
          <div className="template-library-preview-header">
            <div className="template-library-preview-copy">
              <h3 className="template-library-section-title">
                Coordinator Workflow Preview
              </h3>
              <p className="template-library-preview-title">
                Future executor block flow
              </p>
              <p className="template-library-preview-text">
                Static planned flow only. It does not generate requests, launch
                executor tasks, capture responses, validate responses, or link
                Git review state.
              </p>
            </div>
            <div className="template-library-preview-badges">
              <Badge variant="neutral">Static</Badge>
              <Badge variant="neutral">Planned</Badge>
            </div>
          </div>

          <ol className="template-library-workflow-list">
            {coordinatorWorkflowPreviewSteps.map((step) => (
              <li className="template-library-workflow-item" key={step.title}>
                <div className="template-library-workflow-copy">
                  <p className="template-library-preview-label">
                    {step.title}
                  </p>
                  <p className="template-library-preview-value">
                    {step.detail}
                  </p>
                </div>
              </li>
            ))}
          </ol>
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
        </div>

        <div
          aria-label="Planned template actions"
          className="template-library-action-row"
        >
          <Button disabled variant="secondary">
            Generate request planned
          </Button>
          <Button disabled variant="secondary">
            Capture response planned
          </Button>
          <Button disabled variant="secondary">
            Validate response planned
          </Button>
          <Button disabled variant="secondary">
            Review Git planned
          </Button>
        </div>
      </div>
    </WidgetFrame>
  );
}
