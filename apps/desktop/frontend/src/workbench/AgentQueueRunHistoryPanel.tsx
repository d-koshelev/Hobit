import { Badge } from "../design-system/Badge";
import { Button } from "../design-system/Button";
import type {
  AgentQueueTask,
  AgentQueueTaskRunLinkSummary,
} from "../workspace/types";
import { displayTaskTitle, shortWidgetInstanceId } from "./agentQueueTaskUiModel";
import type {
  AgentQueueLatestRunLinkController,
  AgentQueueRunHistoryController,
} from "./queue/useAgentQueueController";
import type {
  AgentExecutorRunOpenRequestInput,
  AgentExecutorSlot,
  CoordinatorAttachedContextInput,
} from "./types";

type AgentQueueRunHistoryPanelProps = {
  executorSlots: AgentExecutorSlot[];
  latestRun: AgentQueueLatestRunLinkController;
  onAttachContextToCoordinator?: (
    request: CoordinatorAttachedContextInput,
  ) => void;
  onOpenAgentExecutorRun?: (
    request: AgentExecutorRunOpenRequestInput,
  ) => void;
  runHistory: AgentQueueRunHistoryController;
  selectedTask: AgentQueueTask;
};

export function AgentQueueRunHistoryPanel({
  executorSlots,
  latestRun,
  onAttachContextToCoordinator,
  onOpenAgentExecutorRun,
  runHistory,
  selectedTask,
}: AgentQueueRunHistoryPanelProps) {
  return (
    <>
      <div className="agent-queue-execution-group">
        <div className="agent-queue-execution-group-header">
          <div>
            <p
              className="agent-queue-execution-group-title"
              title="Shows recent safe run-link metadata for this Queue task."
            >
              Run history
            </p>
          </div>
          <div className="agent-queue-execution-badges">
            <Badge variant={runHistory.totalCount > 0 ? "info" : "neutral"}>
              {runHistory.totalCount > 0
                ? totalRunsLabel(runHistory.totalCount)
                : "none"}
            </Badge>
          </div>
        </div>

        {!runHistory.apiAvailable ? (
          <p className="agent-queue-run-note">
            Run history metadata is only available in the Tauri desktop shell.
          </p>
        ) : runHistory.isLoading ? (
          <p className="agent-queue-run-note">Loading run history.</p>
        ) : runHistory.error ? (
          <p
            className="agent-queue-message agent-queue-message-error"
            role="alert"
          >
            {runHistory.error}
          </p>
        ) : runHistory.links.length > 0 ? (
          <RunHistorySummary
            executorSlots={executorSlots}
            links={runHistory.links}
            onAttachContextToCoordinator={onAttachContextToCoordinator}
            onOpenAgentExecutorRun={onOpenAgentExecutorRun}
            onRefresh={runHistory.onRefresh}
            selectedTask={selectedTask}
            totalCount={runHistory.totalCount}
          />
        ) : (
          <div className="agent-queue-run-empty-state">
            <p className="agent-queue-run-note">No runs yet.</p>
            <Button onClick={() => runHistory.onRefresh()} variant="ghost">
              Refresh
            </Button>
          </div>
        )}
      </div>

      <div className="agent-queue-execution-group">
        <div className="agent-queue-execution-group-header">
          <div>
            <p
              className="agent-queue-execution-group-title"
              title="Shows safe metadata for the newest Executor run linked to this Queue task."
            >
              Latest run
            </p>
          </div>
          <div className="agent-queue-execution-badges">
            <Badge
              variant={
                latestRun.link
                  ? runStatusBadgeVariant(latestRun.link.status)
                  : "neutral"
              }
            >
              {latestRun.link ? runStatusLabel(latestRun.link.status) : "none"}
            </Badge>
          </div>
        </div>

        {!latestRun.apiAvailable ? (
          <p className="agent-queue-run-note">
            Latest run metadata is only available in the Tauri desktop shell.
          </p>
        ) : latestRun.isLoading ? (
          <p className="agent-queue-run-note">Loading latest run.</p>
        ) : latestRun.error ? (
          <p
            className="agent-queue-message agent-queue-message-error"
            role="alert"
          >
            {latestRun.error}
          </p>
        ) : latestRun.link ? (
          <LatestRunSummary
            executorSlots={executorSlots}
            link={latestRun.link}
            onAttachContextToCoordinator={onAttachContextToCoordinator}
            onOpenAgentExecutorRun={onOpenAgentExecutorRun}
            onRefresh={latestRun.onRefresh}
            selectedTask={selectedTask}
          />
        ) : (
          <div className="agent-queue-run-empty-state">
            <p className="agent-queue-run-note">No runs yet.</p>
            <Button onClick={() => latestRun.onRefresh()} variant="ghost">
              Refresh
            </Button>
          </div>
        )}
      </div>
    </>
  );
}

function RunHistorySummary({
  executorSlots,
  links,
  onAttachContextToCoordinator,
  onOpenAgentExecutorRun,
  onRefresh,
  selectedTask,
  totalCount,
}: {
  executorSlots: AgentExecutorSlot[];
  links: NonNullable<AgentQueueLatestRunLinkController["link"]>[];
  onAttachContextToCoordinator?: (
    request: CoordinatorAttachedContextInput,
  ) => void;
  onOpenAgentExecutorRun?: (
    request: AgentExecutorRunOpenRequestInput,
  ) => void;
  onRefresh: () => void;
  selectedTask: AgentQueueTask;
  totalCount: number;
}) {
  const visibleLinks = links.slice(0, 3);
  const isLimited = totalCount > visibleLinks.length;

  return (
    <>
      <div className="agent-queue-run-history-list">
        {visibleLinks.map((link) => {
          const executorSlot = executorSlots.find(
            (slot) => slot.widgetInstanceId === link.executorWidgetId,
          );
          const runRef = shortWidgetInstanceId(link.directWorkRunId);

          return (
            <div className="agent-queue-run-history-item" key={link.linkId}>
              <div className="agent-queue-run-history-main">
                <Badge variant={runStatusBadgeVariant(link.status)}>
                  {runStatusLabel(link.status)}
                </Badge>
                <span>{runSourceLabel(link.source)}</span>
                <span>Run {runRef}</span>
              </div>
              <div className="agent-queue-run-history-meta">
                <span>Started {formatRunTimestamp(link.startedAt)}</span>
                <span>
                  {link.completedAt
                    ? `Completed ${formatRunTimestamp(link.completedAt)}`
                    : "Running"}
                </span>
                <Button
                  disabled={!executorSlot}
                  onClick={() =>
                    onOpenAgentExecutorRun?.({
                      executorWidgetInstanceId: link.executorWidgetId,
                      runId: link.directWorkRunId,
                    })
                  }
                  title={
                    executorSlot
                      ? "Open the local executor run detail."
                      : "Owning local executor is not visible on this Workbench."
                  }
                  variant="ghost"
                >
                  Open run detail
                </Button>
                <Button
                  disabled={!onAttachContextToCoordinator}
                  onClick={() =>
                    onAttachContextToCoordinator?.({
                      contextText: queueRunAttachedContextText({
                        executorLabel:
                          executorSlot?.label ??
                          `Local executor ${shortWidgetInstanceId(link.executorWidgetId)}`,
                        link,
                        selectedTask,
                      }),
                      sourceLabel: "Queue run history row",
                    })
                  }
                  title={
                    onAttachContextToCoordinator
                      ? "Attach this safe run metadata to Workspace Agent."
                      : "Workspace Agent is not visible on this Workbench."
                  }
                  variant="ghost"
                >
                  Attach to Workspace Agent
                </Button>
                {!executorSlot ? <span>Local executor not visible</span> : null}
              </div>
            </div>
          );
        })}
      </div>
      <div className="agent-queue-run-actions">
        {isLimited ? (
          <p className="agent-queue-run-note">
            Showing latest {visibleLinks.length} of {totalCount} total runs.
          </p>
        ) : null}
        <Button onClick={() => onRefresh()} variant="ghost">
          Refresh
        </Button>
      </div>
    </>
  );
}

function LatestRunSummary({
  executorSlots,
  link,
  onAttachContextToCoordinator,
  onOpenAgentExecutorRun,
  onRefresh,
  selectedTask,
}: {
  executorSlots: AgentExecutorSlot[];
  link: NonNullable<AgentQueueLatestRunLinkController["link"]>;
  onAttachContextToCoordinator?: (
    request: CoordinatorAttachedContextInput,
  ) => void;
  onOpenAgentExecutorRun?: (
    request: AgentExecutorRunOpenRequestInput,
  ) => void;
  onRefresh: () => void;
  selectedTask: AgentQueueTask;
}) {
  const executorSlot = executorSlots.find(
    (slot) => slot.widgetInstanceId === link.executorWidgetId,
  );
  const executorLabel =
    executorSlot?.label ?? `Local executor ${shortWidgetInstanceId(link.executorWidgetId)}`;

  return (
    <>
      <dl className="agent-queue-latest-run-facts">
        <div>
          <dt>Source</dt>
          <dd>{runSourceLabel(link.source)}</dd>
        </div>
        <div>
          <dt>Executor</dt>
          <dd>{executorLabel}</dd>
        </div>
        <div>
          <dt>Run</dt>
          <dd>{shortWidgetInstanceId(link.directWorkRunId)}</dd>
        </div>
        <div>
          <dt>Started</dt>
          <dd>{formatRunTimestamp(link.startedAt)}</dd>
        </div>
        <div>
          <dt>Completed</dt>
          <dd>{link.completedAt ? formatRunTimestamp(link.completedAt) : "Running"}</dd>
        </div>
        <div>
          <dt>Review</dt>
          <dd>{link.reviewStatus ? runReviewStatusLabel(link.reviewStatus) : "None"}</dd>
        </div>
      </dl>
      <div className="agent-queue-run-actions">
        <Button
          disabled={!executorSlot}
          onClick={() =>
            onOpenAgentExecutorRun?.({
              executorWidgetInstanceId: link.executorWidgetId,
              runId: link.directWorkRunId,
            })
          }
          title={
            executorSlot
              ? "Open the local executor run detail."
              : "Owning local executor is not visible on this Workbench."
          }
          variant="ghost"
        >
          Open run detail
        </Button>
        <Button
          disabled={!onAttachContextToCoordinator}
          onClick={() =>
            onAttachContextToCoordinator?.({
              contextText: queueRunAttachedContextText({
                executorLabel,
                link,
                selectedTask,
              }),
              sourceLabel: "Queue latest run",
            })
          }
          title={
            onAttachContextToCoordinator
              ? "Attach this safe run metadata to Workspace Agent."
              : "Workspace Agent is not visible on this Workbench."
          }
          variant="ghost"
        >
          Attach to Workspace Agent
        </Button>
        <Button onClick={() => onRefresh()} variant="ghost">
          Refresh
        </Button>
      </div>
      {!executorSlot ? (
        <p className="agent-queue-run-note">
          Owning local executor is not visible on this Workbench.
        </p>
      ) : null}
    </>
  );
}

function queueRunAttachedContextText({
  executorLabel,
  link,
  selectedTask,
}: {
  executorLabel: string;
  link: AgentQueueTaskRunLinkSummary;
  selectedTask: AgentQueueTask;
}) {
  return [
    "Queue run metadata",
    `Queue task: ${displayTaskTitle(selectedTask)} (${selectedTask.queueItemId})`,
    `Executor: ${executorLabel} (${link.executorWidgetId})`,
    `Run: ${link.directWorkRunId}`,
    `Run link: ${link.linkId}`,
    `Source: ${runSourceLabel(link.source)}`,
    `Status: ${runStatusLabel(link.status)}`,
    `Started: ${formatRunTimestamp(link.startedAt)}`,
    `Completed: ${
      link.completedAt ? formatRunTimestamp(link.completedAt) : "Running"
    }`,
    link.reviewStatus ? `Review: ${runReviewStatusLabel(link.reviewStatus)}` : null,
    link.validationStatus ? `Validation: ${link.validationStatus}` : null,
  ]
    .filter((line): line is string => Boolean(line))
    .join("\n");
}

function runSourceLabel(source: string) {
  switch (source) {
    case "autorun":
      return "autorun";
    case "sequential_runner":
      return "sequential runner";
    case "manual":
      return "manual";
    default:
      return "unknown";
  }
}

function runStatusLabel(status: string) {
  switch (status) {
    case "review_needed":
      return "review needed";
    case "timed_out":
      return "timed out";
    default:
      return status;
  }
}

function runReviewStatusLabel(status: string) {
  return status === "review_needed" ? "review needed" : "unknown";
}

function totalRunsLabel(totalCount: number) {
  return totalCount === 1 ? "1 total run" : `${totalCount} total runs`;
}

function runStatusBadgeVariant(status: string) {
  if (status === "completed") {
    return "success";
  }

  if (status === "failed" || status === "timed_out" || status === "cancelled") {
    return "error";
  }

  if (status === "running") {
    return "info";
  }

  return "neutral";
}

function formatRunTimestamp(value: string) {
  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return parsed.toLocaleString(undefined, {
    dateStyle: "short",
    timeStyle: "short",
  });
}
