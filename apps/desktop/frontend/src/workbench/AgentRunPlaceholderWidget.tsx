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
  agentExecutorRunOpenRequest,
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
  onAttachContextToCoordinator,
  onCancelCodexDirectWorkRun,
  onForceKillCodexDirectWorkRun,
  onAttachToCodexDirectWorkStream,
  onPublishAgentActivityEvents,
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
      title={frameTitle}
    >
      <div className="agent-run-placeholder">
        <CodexDirectWorkPanel
          gitReviewStatus={
            directWorkGitReviewStatus?.sourceWidgetInstanceId === instance.id
              ? directWorkGitReviewStatus
              : null
          }
          agentExecutorRunOpenRequest={
            agentExecutorRunOpenRequest?.executorWidgetInstanceId === instance.id
              ? agentExecutorRunOpenRequest
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
          onAttachContextToCoordinator={onAttachContextToCoordinator}
          onCancelCodexDirectWorkRun={onCancelCodexDirectWorkRun}
          onForceKillCodexDirectWorkRun={onForceKillCodexDirectWorkRun}
          onPublishAgentActivityEvents={onPublishAgentActivityEvents}
          onRunCodexDirectWork={onRunCodexDirectWork}
          onRunDirectWorkValidation={onRunDirectWorkValidation}
          onStartCodexDirectWorkStream={onStartCodexDirectWorkStream}
          widgetInstanceId={instance.id}
        />
      </div>
    </WidgetFrame>
  );
}
