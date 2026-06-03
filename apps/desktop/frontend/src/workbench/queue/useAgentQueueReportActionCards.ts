import { useMemo } from "react";

import type { AgentQueueTask } from "../../workspace/types";
import { normalizeItemType } from "../agentQueueTaskUiModel";
import { linkedDiffReviewTasks } from "./agentQueueDiffReviewModel";
import {
  buildDiffReviewReportActionCard,
  buildWorkerExecutionReportActionCard,
} from "./agentQueueReportActionCardModel";

type UseAgentQueueReportActionCardsInput = {
  selectedTask: AgentQueueTask | null;
  tasks: AgentQueueTask[];
};

export function useAgentQueueReportActionCards({
  selectedTask,
  tasks,
}: UseAgentQueueReportActionCardsInput) {
  const linkedReviewsForSelectedTask = useMemo(
    () => linkedDiffReviewTasks(selectedTask, tasks),
    [selectedTask, tasks],
  );
  const dependentTasksForSelectedTask = useMemo(
    () =>
      selectedTask
        ? tasks.filter((task) =>
            (task.dependsOn ?? []).includes(selectedTask.queueItemId),
          )
        : [],
    [selectedTask, tasks],
  );
  const workerReportActionCard = useMemo(() => {
    const latestReport =
      selectedTask?.workerExecutionReports?.[
        selectedTask.workerExecutionReports.length - 1
      ] ?? null;

    if (!selectedTask || !latestReport) {
      return null;
    }

    return buildWorkerExecutionReportActionCard({
      dependentTasks: dependentTasksForSelectedTask,
      linkedDiffReviewTask: linkedReviewsForSelectedTask[0] ?? null,
      report: latestReport,
      sourceTask: selectedTask,
    });
  }, [dependentTasksForSelectedTask, linkedReviewsForSelectedTask, selectedTask]);
  const diffReviewReportActionCard = useMemo(() => {
    if (!selectedTask || normalizeItemType(selectedTask.itemType) !== "diff_review") {
      return null;
    }

    return buildDiffReviewReportActionCard({
      diffReviewTask: selectedTask,
      sourceTask:
        tasks.find(
          (task) => task.queueItemId === selectedTask.diffReview?.sourceItemId,
        ) ?? null,
    });
  }, [selectedTask, tasks]);

  return {
    diffReviewReportActionCard,
    linkedReviewsForSelectedTask,
    workerReportActionCard,
  };
}
