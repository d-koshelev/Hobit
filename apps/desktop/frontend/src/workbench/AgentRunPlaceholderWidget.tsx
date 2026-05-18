import { Badge } from "../design-system/Badge";
import { WidgetFrame } from "../design-system/WidgetFrame";
import { CodexDirectWorkPanel } from "./CodexDirectWorkPanel";
import type { WidgetRenderProps } from "./types";

const LEGACY_AGENT_EXECUTOR_TITLES = new Set([
  "Agent Run",
  "Agent Monitoring",
  "Direct Work / Codex",
]);

export function AgentRunPlaceholderWidget({
  frameActions,
  frameMoveEnabled,
  frameStyle,
  directWorkGitReviewStatus,
  directWorkRunHandoff,
  hasGitWidget,
  instance,
  logRefreshToken,
  onDirectWorkGitReviewRequested,
  onDirectWorkRunHandoffFinalState,
  onGetAgentExecutorDiffSummary,
  onGetAgentExecutorRunDetail,
  onLoadLogs,
  onListAgentExecutorRuns,
  onCancelCodexDirectWorkRun,
  onAttachToCodexDirectWorkStream,
  onRunCodexDirectWork,
  onRunDirectWorkValidation,
  onStartCodexDirectWorkStream,
  onStartFrameMove,
  title,
}: WidgetRenderProps) {
  const frameTitle = LEGACY_AGENT_EXECUTOR_TITLES.has(title)
    ? "Agent Executor"
    : title;

  return (
    <WidgetFrame
      actions={frameActions}
      logRefreshToken={logRefreshToken}
      moveEnabled={frameMoveEnabled}
      onLoadLogs={onLoadLogs ? () => onLoadLogs(instance.id) : undefined}
      onMoveStart={onStartFrameMove}
      style={frameStyle}
      status={<Badge variant="info">Executor</Badge>}
      title={frameTitle}
    >
      <div className="agent-run-placeholder">
        <CodexDirectWorkPanel
          gitReviewStatus={
            directWorkGitReviewStatus?.sourceWidgetInstanceId === instance.id
              ? directWorkGitReviewStatus
              : null
          }
          hasGitWidget={hasGitWidget}
          directWorkRunHandoff={directWorkRunHandoff}
          onAttachToCodexDirectWorkStream={onAttachToCodexDirectWorkStream}
          onDirectWorkGitReviewRequested={onDirectWorkGitReviewRequested}
          onDirectWorkRunHandoffFinalState={onDirectWorkRunHandoffFinalState}
          onGetAgentExecutorDiffSummary={onGetAgentExecutorDiffSummary}
          onGetAgentExecutorRunDetail={onGetAgentExecutorRunDetail}
          onListAgentExecutorRuns={onListAgentExecutorRuns}
          onCancelCodexDirectWorkRun={onCancelCodexDirectWorkRun}
          onRunCodexDirectWork={onRunCodexDirectWork}
          onRunDirectWorkValidation={onRunDirectWorkValidation}
          onStartCodexDirectWorkStream={onStartCodexDirectWorkStream}
          widgetInstanceId={instance.id}
        />
      </div>
    </WidgetFrame>
  );
}
