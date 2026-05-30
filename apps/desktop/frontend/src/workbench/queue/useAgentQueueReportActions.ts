import type {
  AgentQueueTask,
  AgentQueueWorkerExecutionReport,
} from "../../workspace/types";
import { displayTaskTitle } from "../agentQueueTaskUiModel";

export function buildDemoWorkerExecutionReport({
  task,
  workerId,
}: {
  task: AgentQueueTask;
  workerId: string;
}): AgentQueueWorkerExecutionReport {
  const now = new Date().toISOString();
  const plan = task.executionPlanPreview;
  const changedFiles = plan?.likelyFilesOrAreas.filter(isLikelyFilePath) ?? [];
  const likelyAreas =
    plan?.likelyFilesOrAreas.filter((value) => !isLikelyFilePath(value)) ?? [];
  const followUpRecommendation =
    plan?.splitRecommendation ??
    (task.status === "failed" || task.validationStatus === "failed"
      ? "Create a follow-up/sub-block for fixes before coordinator finalization."
      : undefined);

  return {
    changedFiles,
    commandsRun: [],
    createdAt: now,
    errors: task.status === "failed" ? ["Task status was already failed."] : [],
    followUpRecommendation,
    itemId: task.queueItemId,
    rawReportPreview: [
      "Worker execution report preview",
      `Queue item: ${displayTaskTitle(task)} (${task.queueItemId})`,
      `Worker: ${workerId || "unassigned"}`,
      "Source: local Queue model attachment",
      "No execution, validation, provider, Executor, or Codex process was started by this attachment.",
    ].join("\n"),
    reportId: `worker-report-${task.queueItemId}-${Date.now().toString(36)}`,
    reportStatus: followUpRecommendation ? "needs_follow_up" : "reported",
    rollbackRecommendation:
      task.status === "failed"
        ? "Review changed files and validation output before any separate rollback decision."
        : undefined,
    summary:
      plan && plan.status !== "not_planned"
        ? `Worker report received for ${displayTaskTitle(
            task,
          )}. Expected plan was ${plan.status}; coordinator review is still required.`
        : `Worker report received for ${displayTaskTitle(
            task,
          )}. Coordinator review is still required.`,
    validationCommandsSuggested: plan?.expectedValidationCommands ?? [],
    validationResult: "not_run",
    warnings:
      likelyAreas.length > 0
        ? [`Likely affected areas reported: ${likelyAreas.join(", ")}.`]
        : ["Report is model-only evidence and has not been independently validated."],
    workerId: workerId || "unassigned",
  };
}

function isLikelyFilePath(value: string) {
  return (
    /^(?:apps|crates|docs|scripts)[\\/]/.test(value) ||
    /\.[A-Za-z0-9]+$/.test(value)
  );
}
