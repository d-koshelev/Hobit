import { Badge } from "../design-system/Badge";
import { WidgetFrame } from "../design-system/WidgetFrame";
import {
  StaticPreviewFieldList,
  StaticPreviewPlannedActions,
} from "./StaticPreviewPrimitives";
import type { WidgetRenderProps } from "./types";

const overviewLogSteps = [
  "Inspecting current code",
  "Adding file src/workbench/AgentRunPlaceholderWidget.tsx",
  "Implementing component AgentRunPlaceholderWidget",
  "Running validation",
  "Fixing validation error",
  "Creating commit",
];

const resultReportFields = [
  {
    label: "Block title",
    value: "Block 67 - Agent Run placeholder surface",
  },
  {
    label: "Files changed",
    value: "Lists exact frontend and docs files touched by the block.",
  },
  {
    label: "Validation results",
    value: "Reports each requested command as passed, failed, or not run.",
  },
  {
    label: "Commit",
    value: "Includes commit hash and message, or states why no commit exists.",
  },
  {
    label: "Warnings",
    value: "Shows skipped checks, failures, caveats, and residual risk.",
  },
  {
    label: "Out of scope",
    value: "Names runtime, streaming, parsing, validation, and agent execution exclusions.",
  },
  {
    label: "Final git status",
    value: "Reports final branch and working tree state honestly.",
  },
];

const plannedAgentRunActions = [
  { label: "Start run planned" },
  { label: "Capture response planned" },
  { label: "Validate result planned" },
  { label: "Open raw log planned" },
];

export function AgentRunPlaceholderWidget({
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
      <div className="agent-run-placeholder">
        <section className="agent-run-summary">
          <div className="agent-run-summary-copy">
            <p className="agent-run-summary-title">Agent Run</p>
            <p className="agent-run-summary-text">
              Static planned surface for future agent/task execution
              observability. Runs cannot be started, logs do not stream,
              responses are not captured, results are not validated, and no
              agent runtime is connected.
            </p>
          </div>
          <Badge variant="neutral">Static preview</Badge>
        </section>

        <div
          aria-label="Static Agent Run observability previews"
          className="agent-run-view-grid"
        >
          <section className="agent-run-view agent-run-overview">
            <div className="agent-run-view-header">
              <div className="agent-run-view-copy">
                <h3 className="agent-run-view-title">Overview Log</h3>
                <p className="agent-run-view-text">
                  Operator-friendly logical steps. Static preview only.
                </p>
              </div>
              <Badge variant="neutral">Planned</Badge>
            </div>
            <ol className="agent-run-overview-list">
              {overviewLogSteps.map((step) => (
                <li className="agent-run-overview-step" key={step}>
                  {step}
                </li>
              ))}
            </ol>
          </section>

          <section className="agent-run-view agent-run-result">
            <div className="agent-run-view-header">
              <div className="agent-run-view-copy">
                <h3 className="agent-run-view-title">Result Report</h3>
                <p className="agent-run-view-text">
                  Final acceptance artifact shaped by the future Response
                  Template.
                </p>
              </div>
              <Badge variant="neutral">Planned</Badge>
            </div>
            <StaticPreviewFieldList
              className="agent-run-result-grid"
              fieldClassName="agent-run-result-field"
              fields={resultReportFields}
              labelClassName="agent-run-result-label"
              valueClassName="agent-run-result-value"
            />
          </section>

          <section className="agent-run-view agent-run-raw">
            <div className="agent-run-view-header">
              <div className="agent-run-view-copy">
                <h3 className="agent-run-view-title">Raw Log</h3>
                <p className="agent-run-view-text">
                  Debug and audit trace. No live output is attached.
                </p>
              </div>
              <Badge variant="neutral">Planned</Badge>
            </div>
            <div
              className="agent-run-raw-log"
              aria-label="Static Raw Log preview"
            >
              <p className="agent-run-raw-placeholder">
                Raw agent/tool/runtime output will appear here when a future
                runtime exists.
              </p>
              <code className="agent-run-raw-sample">
                12:04:11 planned-runtime: static sample event only
              </code>
            </div>
          </section>
        </div>

        <StaticPreviewPlannedActions
          actions={plannedAgentRunActions}
          aria-label="Planned Agent Run actions"
          className="agent-run-actions"
        />
      </div>
    </WidgetFrame>
  );
}
