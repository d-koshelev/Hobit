import type { useAgentQueueController } from "./queue/useAgentQueueController";
import { AgentQueueAutorunPanel } from "./AgentQueueAutorunPanel";
import { AgentQueueEmptySelection } from "./AgentQueueEmptySelection";
import { AgentQueueTaskAssignmentPanel } from "./AgentQueueTaskAssignmentPanel";
import { AgentQueueTaskRunPanel } from "./AgentQueueTaskRunPanel";
import { AgentQueueTaskSection } from "./AgentQueueTaskSection";
import type { AgentExecutorSlot } from "./types";

type AgentQueueController = ReturnType<typeof useAgentQueueController>;

type AgentQueueTaskDetailsPanelProps = {
  agentExecutorSlots: AgentExecutorSlot[];
  assignmentInputId: string;
  executionPolicyInputId: string;
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
            Workspace queue tasks are loading from desktop storage.
          </p>
        </div>
      ) : loadError ? (
        <div className="agent-queue-empty-state" role="alert">
          <p className="empty-state-title">Queue unavailable.</p>
          <p className="empty-state-text">{loadError}</p>
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
            hasExecutorSlots={agentExecutorSlots.length > 0}
            run={run}
            runner={queue.runner}
            selectedTask={selectedTask}
          />

          <AgentQueueTaskAssignmentPanel
            apiAvailable={assignmentApiAvailable}
            assignmentError={assignmentError}
            assignmentMessage={assignmentMessage}
            currentSelection={selectedExecutorWidgetId}
            executorSlots={agentExecutorSlots}
            inputId={assignmentInputId}
            isAssigning={isAssigning}
            isDirty={isDirty}
            onAssign={() => void assignSelectedTask()}
            onClear={() => void clearSelectedTaskAssignment()}
            onSelectionChange={(executorWidgetInstanceId) => {
              selectExecutorWidget(executorWidgetInstanceId);
            }}
            selectedTask={selectedTask}
          />

          <AgentQueueAutorunPanel autorun={queue.autorun} />

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
        <AgentQueueEmptySelection />
      )}
    </section>
  );
}
