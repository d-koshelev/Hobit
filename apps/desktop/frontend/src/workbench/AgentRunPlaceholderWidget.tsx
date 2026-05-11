import { Badge } from "../design-system/Badge";
import { WidgetFrame } from "../design-system/WidgetFrame";
import {
  AgentRunOverviewPreview,
  AgentRunPlannedActions,
  AgentRunRawLogPreview,
  AgentRunResultReportPreview,
  AgentRunSummarySection,
} from "./AgentRunPlaceholderSections";
import type { WidgetRenderProps } from "./types";

const agentRunSummary = {
  title: "Agent Monitoring",
  text:
    "Static planned surface for monitoring one selected or active agent/task execution. Overview, result, and raw trace are previews only; logs do not stream, responses are not captured, results are not validated, and no agent runtime is connected.",
  badgeLabel: "Static preview",
};

const overviewLogSteps = [
  "Inspecting current code",
  "Adding placeholder observability UI",
  "Implementing monitoring preview sections",
  "Running validation",
  "Fixing validation error",
  "Creating commit",
];

const resultReportFields = [
  {
    label: "Block title",
    value: "Block 67 - Agent Monitoring placeholder surface",
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
  { label: "Select execution planned" },
  { label: "Capture result planned" },
  { label: "Validate result planned" },
  { label: "Open raw trace planned" },
];

const rawLogPreview = {
  placeholder:
    "Raw agent/tool/runtime output will appear here when a future runtime exists.",
  sample: "12:04:11 planned-runtime: static sample event only",
};

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
        <AgentRunSummarySection
          badgeLabel={agentRunSummary.badgeLabel}
          text={agentRunSummary.text}
          title={agentRunSummary.title}
        />

        <div
          aria-label="Static Agent Monitoring observability previews"
          className="agent-run-view-grid"
        >
          <AgentRunOverviewPreview steps={overviewLogSteps} />
          <AgentRunResultReportPreview fields={resultReportFields} />
          <AgentRunRawLogPreview
            placeholder={rawLogPreview.placeholder}
            sample={rawLogPreview.sample}
          />
        </div>

        <AgentRunPlannedActions actions={plannedAgentRunActions} />
      </div>
    </WidgetFrame>
  );
}
