import { useId, useState } from "react";
import { Button } from "../design-system/Button";
import { WidgetFrame } from "../design-system/WidgetFrame";
import { AgentQueueLayout } from "./AgentQueueLayout";
import { AgentQueueNewTaskDialog } from "./AgentQueueNewTaskDialog";
import { AgentQueueTaskDetailsPanel } from "./AgentQueueTaskDetailsPanel";
import { AgentQueueTaskList } from "./AgentQueueTaskList";
import { AgentQueueWidgetStatusBadge } from "./AgentQueueWidgetStatusBadge";
import {
  emptyDraft,
  MAX_PRIORITY,
  MIN_PRIORITY,
  queueSingleState,
  taskPreview,
  validateDraft,
  type TaskDraft,
} from "./agentQueueTaskUiModel";
import { useAgentQueueController } from "./queue/useAgentQueueController";
import type { WidgetRenderProps } from "./types";

export function AgentQueuePlaceholderWidget({
  frameActions,
  frameMoveEnabled,
  frameStyle,
  instance,
  logRefreshToken,
  agentExecutorSlots = [],
  onAssignAgentQueueTaskToExecutor,
  onClearAgentQueueTaskAssignment,
  onCreateAgentQueueTask,
  onDeleteAgentQueueTask,
  onGetAgentQueueTask,
  onGetAgentQueueTaskLatestRunLink,
  onGetAgentQueueRunnerSnapshot,
  onListAgentQueueTaskRunLinks,
  onListAgentQueueTasks,
  onLoadLogs,
  onAttachContextToCoordinator,
  onOpenAgentExecutorRun,
  onDirectWorkRunHandoffStarted,
  queueTaskAutoRefreshRequest,
  onStartFrameMove,
  onStartAssignedAgentQueueTask,
  onStartAgentQueueRunnerSession,
  onStopAgentQueueRunnerSession,
  onUpdateAgentQueueTask,
  title,
}: WidgetRenderProps) {
  const titleInputId = useId();
  const promptInputId = useId();
  const statusInputId = useId();
  const priorityInputId = useId();
  const executionPolicyInputId = useId();
  const assignmentInputId = useId();
  const createTitleInputId = useId();
  const createDescriptionInputId = useId();
  const createPromptInputId = useId();
  const createPriorityInputId = useId();
  const createExecutionPolicyInputId = useId();
  const createDialogTitleId = useId();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [createDraft, setCreateDraft] = useState<TaskDraft>(() =>
    newTaskDialogDraft(),
  );
  const [createDialogError, setCreateDialogError] = useState<string | null>(
    null,
  );
  const queue = useAgentQueueController({
    agentExecutorSlots,
    onAssignAgentQueueTaskToExecutor,
    onClearAgentQueueTaskAssignment,
    onCreateAgentQueueTask,
    onDeleteAgentQueueTask,
    onDirectWorkRunHandoffStarted,
    onGetAgentQueueTask,
    onGetAgentQueueTaskLatestRunLink,
    onGetAgentQueueRunnerSnapshot,
    onListAgentQueueTaskRunLinks,
    onListAgentQueueTasks,
    onStartAssignedAgentQueueTask,
    onStartAgentQueueRunnerSession,
    onStopAgentQueueRunnerSession,
    onUpdateAgentQueueTask,
    queueTaskAutoRefreshRequest,
  });
  const {
    apiAvailable,
    createTask,
    filteredTasks,
    isCreating,
    isDirty,
    isLoading,
    isSaving,
    isSelecting,
    loadError,
    refreshTasks,
    selectedTask,
    selectTask,
    setStatusFilter,
    statusFilter,
    tasks,
  } = queue;

  const queueFrameActions = (
    <>
      <Button
        disabled={isLoading || isSaving || !apiAvailable}
        onClick={() => void refreshTasks()}
        variant="ghost"
      >
        Refresh
      </Button>
      <Button
        disabled={isCreating || isLoading || !apiAvailable}
        onClick={() => {
          setCreateDraft(newTaskDialogDraft());
          setCreateDialogError(null);
          setIsCreateDialogOpen(true);
        }}
        variant="primary"
      >
        {isCreating ? "Creating" : "New task"}
      </Button>
      {frameActions}
    </>
  );
  const singleState = queueSingleState({
    isLoading,
    loadError,
  });
  const selectedTaskHint = selectedTask ? taskPreview(selectedTask) : "";

  function updateCreateDraft(nextDraft: Partial<TaskDraft>) {
    setCreateDraft((currentDraft) => ({
      ...currentDraft,
      ...nextDraft,
    }));
    setCreateDialogError(null);
  }

  function updateCreatePriority(value: string) {
    const parsedValue = Number.parseInt(value, 10);
    const priority = Number.isFinite(parsedValue)
      ? Math.min(MAX_PRIORITY, Math.max(MIN_PRIORITY, parsedValue))
      : MIN_PRIORITY;

    updateCreateDraft({ priority });
  }

  function cancelCreateTask() {
    setIsCreateDialogOpen(false);
    setCreateDialogError(null);
  }

  async function confirmCreateTask() {
    const validationError = validateDraft(createDraft);

    if (validationError) {
      setCreateDialogError(validationError);
      return;
    }

    if (isDirty) {
      setCreateDialogError("Save current task before creating another task.");
      return;
    }

    const didCreate = await createTask(createDraft);

    if (didCreate) {
      setCreateDraft(newTaskDialogDraft());
      setCreateDialogError(null);
      setIsCreateDialogOpen(false);
    }
  }

  return (
    <WidgetFrame
      actions={queueFrameActions}
      logRefreshToken={logRefreshToken}
      moveEnabled={frameMoveEnabled}
      onLoadLogs={onLoadLogs ? () => onLoadLogs(instance.id) : undefined}
      onMoveStart={onStartFrameMove}
      status={
        <AgentQueueWidgetStatusBadge
          apiAvailable={apiAvailable}
          isDirty={isDirty}
          isLoading={isLoading}
          isSaving={isSaving}
          loadError={loadError}
          selectedTask={selectedTask}
        />
      }
      style={frameStyle}
      title={title}
    >
      <div className="agent-queue-product-shell">
        {singleState ? (
          <div
            className="agent-queue-empty-state agent-queue-empty-state-compact"
            role={loadError ? "alert" : undefined}
          >
            <p className="empty-state-title">{singleState.title}</p>
            <p className="empty-state-text">{singleState.text}</p>
          </div>
        ) : (
          <AgentQueueLayout
            isTaskPaneResizable={Boolean(frameMoveEnabled)}
            detailsPanel={
              <AgentQueueTaskDetailsPanel
                agentExecutorSlots={agentExecutorSlots}
                assignmentInputId={assignmentInputId}
                executionPolicyInputId={executionPolicyInputId}
                priorityInputId={priorityInputId}
                promptInputId={promptInputId}
                queue={queue}
                onAttachContextToCoordinator={onAttachContextToCoordinator}
                onOpenAgentExecutorRun={onOpenAgentExecutorRun}
                selectedTaskHint={selectedTaskHint}
                statusInputId={statusInputId}
                titleInputId={titleInputId}
              />
            }
            taskList={
              <AgentQueueTaskList
                filteredTasks={filteredTasks}
                isLoading={isLoading}
                isSelecting={isSelecting}
                loadError={loadError}
                onSelectTask={(queueItemId) => void selectTask(queueItemId)}
                onStatusFilterChange={setStatusFilter}
                selectedTask={selectedTask}
                statusFilter={statusFilter}
                tasks={tasks}
              />
            }
          />
        )}
        {isCreateDialogOpen ? (
          <AgentQueueNewTaskDialog
            apiAvailable={apiAvailable}
            createDescriptionInputId={createDescriptionInputId}
            createDialogError={createDialogError}
            createDialogTitleId={createDialogTitleId}
            createDraft={createDraft}
            createExecutionPolicyInputId={createExecutionPolicyInputId}
            createPriorityInputId={createPriorityInputId}
            createPromptInputId={createPromptInputId}
            createTitleInputId={createTitleInputId}
            isCreating={isCreating}
            onCancel={cancelCreateTask}
            onConfirm={() => void confirmCreateTask()}
            onDraftChange={updateCreateDraft}
            onPriorityChange={updateCreatePriority}
          />
        ) : null}
      </div>
    </WidgetFrame>
  );
}

function newTaskDialogDraft(): TaskDraft {
  return {
    ...emptyDraft(),
    title: "New task",
  };
}
