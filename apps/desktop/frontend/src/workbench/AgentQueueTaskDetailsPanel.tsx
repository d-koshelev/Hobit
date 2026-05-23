import type { useAgentQueueController } from "./queue/useAgentQueueController";
import { AgentQueueEmptySelection } from "./AgentQueueEmptySelection";
import { AgentQueueTaskRunPanel } from "./AgentQueueTaskRunPanel";
import { AgentQueueTaskSection } from "./AgentQueueTaskSection";
import type {
  AgentExecutorRunOpenRequestInput,
  AgentExecutorSlot,
} from "./types";

type AgentQueueController = ReturnType<typeof useAgentQueueController>;

type AgentQueueTaskDetailsPanelProps = {
  agentExecutorSlots: AgentExecutorSlot[];
  assignmentInputId: string;
  executionPolicyInputId: string;
  onOpenAgentExecutorRun?: (
    request: AgentExecutorRunOpenRequestInput,
  ) => void;
  priorityInputId: string;
  promptInputId: string;
  queue: AgentQueueController;
  selectedTaskHint: string;
  statusInputId: string;
  titleInputId: string;
};

export function AgentQueueTaskDetailsPanel({
  agentExecutorSlots,
  assignmentInputId,
  executionPolicyInputId,
  onOpenAgentExecutorRun,
  priorityInputId,
  promptInputId,
  queue,
  selectedTaskHint,
  statusInputId,
  titleInputId,
}: AgentQueueTaskDetailsPanelProps) {
  const {
    assignmentApiAvailable,
    assignmentError,
    assignmentMessage,
    assignSelectedTask,
    clearSelectedTaskAssignment,
    deleteTask,
    draft,
    editorError,
    isAssigning,
    isDirty,
    isLoading,
    isSaving,
    loadError,
    run,
    saveTask,
    selectedExecutorWidgetId,
    selectedTask,
    selectExecutorWidget,
    tasks,
    updateDraft,
    updatePriority,
    validationMessage,
  } = queue;

  return (
    <section
      aria-label="Selected Agent Queue task"
      className="agent-queue-task-editor-pane"
    >
      {isLoading ? (
        <div className="agent-queue-empty-state">
          <p className="empty-state-title">Loading queue.</p>
          <p className="empty-state-text">
            Workspace queue tasks are loading.
          </p>
        </div>
      ) : loadError ? (
        <div className="agent-queue-empty-state" role="alert">
          <p className="empty-state-title">Queue unavailable.</p>
          <p className="empty-state-text">
            {loadError} Use Refresh to try again.
          </p>
        </div>
      ) : selectedTask ? (
        <div className="agent-queue-task-editor">
          <AgentQueueTaskSection
            deleteTask={deleteTask}
            draft={draft}
            executionPolicyInputId={executionPolicyInputId}
            isDirty={isDirty}
            isSaving={isSaving}
            onDraftChange={updateDraft}
            onPriorityChange={updatePriority}
            onSave={() => void saveTask()}
            priorityInputId={priorityInputId}
            promptInputId={promptInputId}
            selectedTaskHint={selectedTaskHint}
            statusInputId={statusInputId}
            titleInputId={titleInputId}
          />

          <AgentQueueTaskRunPanel
            apiAvailable={assignmentApiAvailable}
            assignmentError={assignmentError}
            assignmentMessage={assignmentMessage}
            autorun={queue.autorun}
            currentSelection={selectedExecutorWidgetId}
            executorSlots={agentExecutorSlots}
            hasExecutorSlots={agentExecutorSlots.length > 0}
            inputId={assignmentInputId}
            isAssigning={isAssigning}
            isDirty={isDirty}
            latestRun={queue.latestRun}
            onAssign={() => void assignSelectedTask()}
            onClear={() => void clearSelectedTaskAssignment()}
            onOpenAgentExecutorRun={onOpenAgentExecutorRun}
            onSelectionChange={(executorWidgetInstanceId) => {
              selectExecutorWidget(executorWidgetInstanceId);
            }}
            run={run}
            runHistory={queue.runHistory}
            runner={queue.runner}
            selectedTask={selectedTask}
          />

          {validationMessage ? (
            <p
              className="agent-queue-message agent-queue-message-warning"
              role="alert"
            >
              {validationMessage}
            </p>
          ) : null}
          {editorError ? (
            <p
              className="agent-queue-message agent-queue-message-error"
              role="alert"
            >
              {editorError}
            </p>
          ) : null}
          <details className="agent-queue-details agent-queue-safety-details">
            <summary>Queue boundaries</summary>
            <p className="agent-queue-boundary-note">
              Queue tasks are workspace-local records. Queue does not show live
              logs, run hidden background scheduling, launch Terminal commands,
              or mutate Git.
            </p>
          </details>
        </div>
      ) : (
        <AgentQueueEmptySelection hasTasks={tasks.length > 0} />
      )}
    </section>
  );
}
