import { CodexDirectWorkForm } from "./CodexDirectWorkForm";
import { CodexDirectWorkLiveLog } from "./CodexDirectWorkLiveLog";
import { CodexDirectWorkNotice } from "./CodexDirectWorkNotice";
import { CodexDirectWorkPostRunReview } from "./CodexDirectWorkPostRunReview";
import { CodexDirectWorkQueueSource } from "./CodexDirectWorkQueueSource";
import { CodexDirectWorkResultSummary } from "./CodexDirectWorkResultSummary";
import { CodexDirectWorkStopPanel } from "./CodexDirectWorkStopPanel";
import { isOneShotFallbackRunning } from "./CodexDirectWorkStatusText";
import { CodexDirectWorkPanelOverview } from "./CodexDirectWorkPanelOverview";
import { AgentExecutorRunHistoryPanel } from "./AgentExecutorRunHistoryPanel";
import type { CodexDirectWorkPanelProps } from "./CodexDirectWorkPanelTypes";
import { useAgentExecutorController } from "./executor/useAgentExecutorController";

export function CodexDirectWorkPanel(props: CodexDirectWorkPanelProps) {
  const {
    gitReviewStatus,
    hasGitWidget,
    onGetAgentExecutorDiffSummary,
    onGetAgentExecutorRunDetail,
    onListAgentExecutorRuns,
    onStartCodexDirectWorkStream,
    widgetInstanceId,
  } = props;
  const {
    canKillActiveStreamingRun,
    canRunBackend,
    canStopActiveStreamingRun,
    cancelKillConfirmation,
    forceKillStreamingRun,
    handleValidationError,
    historyRefreshToken,
    isKillConfirming,
    isKillRequesting,
    isRunning,
    isStopRequesting,
    liveLogEntries,
    liveRun,
    queueRunSource,
    requestKillConfirmation,
    runDirectWork,
    runDirectWorkValidationAndRefresh,
    runErrorMessage,
    runInfoNotice,
    runResult,
    runResultTiming,
    stopNotice,
    stopStreamingRun,
    validationRepositoryRoot,
  } = useAgentExecutorController(props);

  return (
    <section
      aria-label="Agent Executor Direct Work"
      className="codex-direct-work-panel"
    >
      <CodexDirectWorkPanelOverview
        canRunBackend={canRunBackend}
        isRunning={isRunning}
        liveRun={liveRun}
        runErrorMessage={runErrorMessage}
        runResult={runResult}
        widgetInstanceId={widgetInstanceId}
      />

      {queueRunSource ? <CodexDirectWorkQueueSource handoff={queueRunSource} /> : null}

      <CodexDirectWorkForm
        canRunBackend={canRunBackend}
        isRunning={isRunning}
        onSubmit={(request) => {
          void runDirectWork(request);
        }}
        onValidationError={handleValidationError}
      />

      {isRunning ? (
        <CodexDirectWorkNotice
          message={
            isOneShotFallbackRunning(liveLogEntries)
              ? "Live streaming was unavailable; the desktop backend is running the one-shot fallback."
              : onStartCodexDirectWorkStream
                ? "Starting or running Codex streaming. Live events appear below."
              : "The desktop backend is running the existing Codex Direct Work command."
          }
          title="Running Codex Direct Work"
          variant="info"
        />
      ) : null}

      {canStopActiveStreamingRun || canKillActiveStreamingRun ? (
        <CodexDirectWorkStopPanel
          isKillConfirming={isKillConfirming}
          isKillRequesting={isKillRequesting}
          isStopRequesting={isStopRequesting}
          onCancelKill={cancelKillConfirmation}
          onConfirmKill={() => void forceKillStreamingRun()}
          onRequestKill={requestKillConfirmation}
          onStopStreamingRun={() => void stopStreamingRun()}
        />
      ) : null}

      {stopNotice ? (
        <CodexDirectWorkNotice
          message={stopNotice.message}
          title={stopNotice.title}
          variant={stopNotice.variant}
        />
      ) : null}

      {liveRun || liveLogEntries.length > 0 ? (
        <CodexDirectWorkLiveLog
          entries={liveLogEntries}
          gitReviewStatus={gitReviewStatus}
          hasGitWidget={hasGitWidget}
          liveRun={liveRun}
        />
      ) : null}

      {runErrorMessage ? (
        <CodexDirectWorkNotice
          message={runErrorMessage}
          title="Direct Work request failed"
          variant="error"
        />
      ) : null}

      {runInfoNotice ? (
        <CodexDirectWorkNotice
          message={runInfoNotice.message}
          title={runInfoNotice.title}
          variant="info"
        />
      ) : null}

      {runResult ? (
        <CodexDirectWorkResultSummary
          gitReviewStatus={gitReviewStatus}
          hasGitWidget={hasGitWidget}
          result={runResult}
          timing={runResultTiming}
        />
      ) : null}

      {validationRepositoryRoot ? (
        <CodexDirectWorkPostRunReview
          onGetAgentExecutorDiffSummary={onGetAgentExecutorDiffSummary}
          onRunDirectWorkValidation={runDirectWorkValidationAndRefresh}
          repositoryRoot={validationRepositoryRoot}
          widgetInstanceId={widgetInstanceId}
        />
      ) : null}

      <AgentExecutorRunHistoryPanel
        onGetAgentExecutorRunDetail={onGetAgentExecutorRunDetail}
        onListAgentExecutorRuns={onListAgentExecutorRuns}
        refreshToken={historyRefreshToken}
        widgetInstanceId={widgetInstanceId}
      />
    </section>
  );
}
