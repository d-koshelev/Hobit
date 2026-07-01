import type {
  QueueWorkflowRunnerEvent,
  QueueWorkflowRunnerStep,
} from "./queueWorkflowRunnerTypes";
import { stripUndefined } from "./queueWorkflowRunnerRefs";

export function pushStep(
  steps: QueueWorkflowRunnerStep[],
  events: QueueWorkflowRunnerEvent[],
  step: QueueWorkflowRunnerStep,
) {
  steps.push(stripUndefined(step));
  events.push(
    stripUndefined({
      message: step.message,
      phase: step.phase,
      reasonCode: step.reasonCode,
      slot: step.slot,
      status: step.status,
      taskId: step.taskId,
    }),
  );
}
