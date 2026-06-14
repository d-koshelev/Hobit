import { Badge } from "../../../design-system/Badge";
import {
  displayTaskTitle,
  queueExecutorInfoForTask,
  statusBadgeVariant,
} from "../../agentQueueTaskUiModel";
import {
  hasReviewEvidenceForTask,
  isSelectedTaskRunning,
} from "./agentQueueTaskDetailsEvidence";
import {
  selectedTaskStatusRailLabel,
} from "./agentQueueTaskDetailsFormatters";
import type {
  AgentQueueController,
  SelectedAgentQueueTask,
} from "./agentQueueTaskDetailsTypes";
import { overviewStateSentence } from "./agentQueueTaskDetailsViewModel";

export function AgentQueueTaskOverviewSection({
  queue,
  selectedTask,
}: {
  queue: AgentQueueController;
  selectedTask: SelectedAgentQueueTask;
}) {
  const dependencyState = queue.dependencyStates.get(selectedTask.queueItemId);
  const routingState = queue.assignedWorkerRoutingStates.get(
    selectedTask.queueItemId,
  );
  const executorInfo = queueExecutorInfoForTask({
    dependencyState,
    routingState,
    task: selectedTask,
  });
  const isRunning = isSelectedTaskRunning(queue, selectedTask);

  return (
    <section
      aria-label="Selected task overview"
      className="agent-queue-expanded-header agent-queue-overview"
    >
      <div className="agent-queue-expanded-heading">
        <div>
          <p className="agent-queue-expanded-kicker">Overview</p>
          <h3>{displayTaskTitle(selectedTask)}</h3>
          <p className="agent-queue-overview-state">
            {isRunning
              ? "Agent is working on this task."
              : overviewStateSentence(queue, selectedTask, executorInfo.label)}
          </p>
        </div>
        {isRunning ? null : (
          <div
            className={[
              "agent-queue-executor-info-box",
              "agent-queue-executor-info-large",
              `agent-queue-executor-info-${executorInfo.tone}`,
            ].join(" ")}
            title={executorInfo.detail}
          >
            <span>Runner</span>
            <strong>{executorInfo.label}</strong>
          </div>
        )}
      </div>

      <div className="agent-queue-expanded-badges">
        <Badge variant={statusBadgeVariant(selectedTask.status)}>
          {isRunning ? "Running" : selectedTaskStatusRailLabel(selectedTask)}
        </Badge>
        {isRunning ? (
          <Badge variant="info">{queue.runActivity.currentStage}</Badge>
        ) : hasReviewEvidenceForTask(queue, selectedTask) ? (
          <Badge variant="warning">
            Awaiting review
          </Badge>
        ) : selectedTask.status === "completed" ||
          selectedTask.status === "failed" ||
          selectedTask.status === "cancelled" ||
          selectedTask.status === "review_needed" ? (
          <Badge variant="warning">
            Result pending
          </Badge>
        ) : null}
      </div>

      {isRunning ? (
        <p className="agent-queue-overview-next">
          Current stage: {queue.runActivity.currentStage}.
        </p>
      ) : null}
    </section>
  );
}
