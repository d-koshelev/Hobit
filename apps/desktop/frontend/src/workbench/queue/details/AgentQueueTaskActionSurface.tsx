import { AgentQueueTaskRunPanel } from "../../AgentQueueTaskRunPanel";
import type {
  AgentExecutorRunOpenRequestInput,
  AgentExecutorSlot,
  CoordinatorAttachedContextInput,
} from "../../types";
import type {
  AgentQueueController,
  SelectedAgentQueueTask,
} from "./agentQueueTaskDetailsTypes";
import { AgentQueueTaskNextActionPanel } from "./AgentQueueTaskNextActionPanel";

export function AgentQueueTaskActionSurface({
  agentExecutorSlots,
  assignmentInputId,
  onAttachContextToCoordinator,
  onOpenAgentExecutorRun,
  queue,
  selectedTask,
}: {
  agentExecutorSlots: AgentExecutorSlot[];
  assignmentInputId: string;
  onAttachContextToCoordinator?: (
    request: CoordinatorAttachedContextInput,
  ) => void;
  onOpenAgentExecutorRun?: (
    request: AgentExecutorRunOpenRequestInput,
  ) => void;
  queue: AgentQueueController;
  selectedTask: SelectedAgentQueueTask;
}) {
  return (
    <section
      aria-label="Selected task actions and settings"
      className="agent-queue-actions-settings"
    >
      <AgentQueueTaskNextActionPanel queue={queue} selectedTask={selectedTask} />

      <AgentQueueTaskRunPanel
        apiAvailable={queue.assignmentApiAvailable}
        assignmentError={queue.assignmentError}
        assignmentMessage={queue.assignmentMessage}
        autorun={queue.autorun}
        currentSelection={queue.selectedExecutorWidgetId}
        dependencyState={queue.dependencyStates.get(selectedTask.queueItemId)}
        executorSlots={agentExecutorSlots}
        executionPlan={queue.executionPlan}
        hasExecutorSlots={agentExecutorSlots.length > 0}
        includeAdvancedDetails={false}
        inputId={assignmentInputId}
        isAssigning={queue.isAssigning}
        isDirty={queue.isDirty || queue.editTask.isEditing}
        latestRun={queue.latestRun}
        onAssign={() => void queue.assignSelectedTask()}
        onClear={() => void queue.clearSelectedTaskAssignment()}
        onPromoteDraftToQueued={() => queue.draftPromotion.onPromote()}
        onOpenAgentExecutorRun={onOpenAgentExecutorRun}
        onAttachContextToCoordinator={onAttachContextToCoordinator}
        onSelectionChange={(executorWidgetInstanceId) => {
          queue.selectExecutorWidget(executorWidgetInstanceId);
        }}
        canPromoteDraftToQueued={queue.draftPromotion.canPromote}
        run={queue.run}
        runHistory={queue.runHistory}
        runner={queue.runner}
        routingState={queue.assignedWorkerRoutingStates.get(
          selectedTask.queueItemId,
        )}
        selectedTask={selectedTask}
        queueTags={queue.foundation.queueTags}
        workers={queue.foundation.workers}
      />
    </section>
  );
}
