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
  hasGitWidget,
  instance,
  logRefreshToken,
  onDirectWorkGitReviewRequested,
  onGetAgentExecutorRunDetail,
  onLoadLogs,
  onListAgentExecutorRuns,
  onCancelCodexDirectWorkRun,
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
        <section className="agent-run-summary">
          <div className="agent-run-summary-copy">
            <p className="agent-run-summary-title">Agent Executor</p>
            <p className="agent-run-summary-text">
              Runs one task and shows live execution, logs, result, changed
              files, and validation. The current executor provider is Codex CLI;
              Hobit still does not auto-commit, push, mutate Git, or execute
              queued work from here.
            </p>
          </div>
          <div className="agent-run-summary-actions">
            <Badge variant="neutral">Codex CLI</Badge>
            <Badge variant="neutral">One task</Badge>
          </div>
        </section>

        <CodexDirectWorkPanel
          gitReviewStatus={
            directWorkGitReviewStatus?.sourceWidgetInstanceId === instance.id
              ? directWorkGitReviewStatus
              : null
          }
          hasGitWidget={hasGitWidget}
          onDirectWorkGitReviewRequested={onDirectWorkGitReviewRequested}
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
